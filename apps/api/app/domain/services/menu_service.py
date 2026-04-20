from sqlalchemy.orm import Session

from app.domain.services.complaint_service import ComplaintService
from app.domain.services.forecast_service import ForecastService
from app.domain.services.inventory_service import InventoryService
from app.infrastructure.llm.base import BaseLLMProvider
from app.infrastructure.llm.prompt_utils import PromptUtils


class MenuService:
    """Builds Friday menu insights from demand, complaints, and inventory pressure."""

    def __init__(self, db: Session, llm: BaseLLMProvider):
        self.db = db
        self.llm = llm

    def get_top_items(self) -> list[dict]:
        forecast_service = ForecastService(db=self.db, llm=self.llm)
        return forecast_service.get_top_friday_items()

    async def analyse_and_recommend(
        self,
        forecast_data: dict | None = None,
        complaint_data: dict | None = None,
        inventory_data: dict | None = None,
    ) -> dict:
        top_items = self.get_top_items()

        if complaint_data is None:
            complaint_service = ComplaintService(db=self.db, llm=self.llm)
            complaint_data = complaint_service.get_complaint_summary(days=28)

        if inventory_data is None:
            inventory_service = InventoryService(db=self.db, llm=self.llm)
            demand_ratio = 1.0
            if forecast_data:
                predicted = forecast_data.get("predicted_orders", 0)
                avg = forecast_data.get("avg_friday_orders", 0)
                if avg:
                    demand_ratio = predicted / avg
            inventory_data = inventory_service.compute_alerts(
                inventory_service.get_all_stock(),
                demand_ratio=demand_ratio,
            )

        shortage_alerts = (inventory_data or {}).get("shortage_alerts") or []
        overstock_alerts = (inventory_data or {}).get("overstock_alerts") or []
        complaint_themes = (complaint_data or {}).get("unique_complaints") or []

        data = {
            "top_items": top_items,
            "forecast_snapshot": {
                "predicted_orders": (forecast_data or {}).get("predicted_orders"),
                "predicted_peak_orders": (forecast_data or {}).get("predicted_peak_orders"),
                "avg_friday_orders": (forecast_data or {}).get("avg_friday_orders"),
                "target_date": (forecast_data or {}).get("target_date"),
            },
            "complaint_themes": complaint_themes[:5],
            "shortage_ingredients": [
                alert.get("ingredient") for alert in shortage_alerts if isinstance(alert, dict) and alert.get("ingredient")
            ],
            "overstock_ingredients": [
                alert.get("ingredient") for alert in overstock_alerts if isinstance(alert, dict) and alert.get("ingredient")
            ],
            "note": "Phase 2 menu insights combine demand, complaints, and inventory context.",
        }

        top_item_lines = "\n".join(
            f"  - {item.get('item')} ({item.get('category')}): ordered {item.get('total_ordered')} times"
            for item in top_items
        ) or "  None"

        shortage_lines = "\n".join(
            f"  - {alert.get('ingredient')}: severity={alert.get('severity')}, shortfall={alert.get('shortfall')}, spoilage_risk={alert.get('spoilage_risk')}"
            for alert in shortage_alerts
            if isinstance(alert, dict)
        ) or "  None"

        overstock_lines = "\n".join(
            f"  - {alert.get('ingredient')}: excess={alert.get('excess')}, spoilage_risk={alert.get('spoilage_risk')}"
            for alert in overstock_alerts
            if isinstance(alert, dict)
        ) or "  None"

        complaint_lines = "\n".join(f"  - {theme}" for theme in complaint_themes[:5]) or "  None"

        prompt = f"""
## Context
Friday menu planning context:
- Predicted Friday orders: {(forecast_data or {}).get('predicted_orders', 'N/A')}
- Predicted peak orders: {(forecast_data or {}).get('predicted_peak_orders', 'N/A')}
- Average Friday orders: {(forecast_data or {}).get('avg_friday_orders', 'N/A')}
- Target date: {(forecast_data or {}).get('target_date', 'N/A')}

Top Friday items:
{top_item_lines}

Complaint themes to watch:
{complaint_lines}

Inventory shortages:
{shortage_lines}

Inventory overstock:
{overstock_lines}

## Task
Recommend how the restaurant should shape Friday's menu focus. Prioritise items that are popular and operationally safe,
avoid pushing items likely to suffer from ingredient shortages or complaint patterns, and suggest practical promo or menu
positioning actions that can be executed within the next 24 hours.

## Response format
Respond with a JSON object containing:
- "highlight_items": array of strings — items to feature prominently for Friday service
- "deprioritize_items": array of strings — items to avoid pushing due to risk, complaints, or weak operational fit
- "promo_candidates": array of strings — items suitable for Friday promotion
- "inventory_blockers": array of strings — ingredient or stock constraints affecting menu choices
- "complaint_watchouts": array of strings — quality or service issues menu execution should watch closely
- "operational_notes": array of strings — practical kitchen/front-of-house actions tied to the menu plan
- "reasoning": string — one concise summary of the menu strategy
- "priority": string — "high", "medium", or "low"
- "risks": array of strings — what could go wrong if the menu plan is ignored
"""

        recommendation = await self.llm.complete_json(
            prompt=prompt,
            system_prompt=PromptUtils.SYSTEM_MENU_AGENT,
        )

        return {
            "service": "menu",
            "data": data,
            "recommendation": recommendation,
        }
