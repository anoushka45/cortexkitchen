from datetime import datetime
import re

from sqlalchemy.orm import Session

from app.domain.services.complaint_service import ComplaintService
from app.domain.services.forecast_service import ForecastService
from app.domain.services.inventory_service import InventoryService
from app.infrastructure.llm.base import BaseLLMProvider
from app.infrastructure.llm.prompt_utils import PromptUtils


class MenuService:
    """Builds menu insights from demand, complaints, inventory pressure, and scenario context."""

    def __init__(self, db: Session, llm: BaseLLMProvider):
        self.db = db
        self.llm = llm

    def get_top_items(self, target_date: datetime | None = None) -> list[dict]:
        forecast_service = ForecastService(db=self.db, llm=self.llm)
        if hasattr(forecast_service, "get_top_service_day_items"):
            return forecast_service.get_top_service_day_items(target_date)
        return forecast_service.get_top_friday_items()

    def normalize_scenario_language(
        self,
        payload: dict | list | str | None,
        scenario_label: str,
    ):
        if scenario_label == "Service":
            return payload

        if isinstance(payload, dict):
            return {
                key: self.normalize_scenario_language(value, scenario_label)
                for key, value in payload.items()
            }
        if isinstance(payload, list):
            return [self.normalize_scenario_language(value, scenario_label) for value in payload]
        if not isinstance(payload, str):
            return payload

        replacements = [
            (r"\bFriday rush\b", scenario_label),
            (r"\bFriday service\b", f"{scenario_label} service"),
            (r"\bFriday promotion\b", f"{scenario_label} promotion"),
            (r"\bon Friday\b", f"during {scenario_label}"),
            (r"\bFriday\b", scenario_label),
        ]

        normalized = payload
        for pattern, replacement in replacements:
            normalized = re.sub(pattern, replacement, normalized, flags=re.IGNORECASE)
        return normalized

    async def analyse_and_recommend(
        self,
        target_date: datetime | None = None,
        forecast_data: dict | None = None,
        complaint_data: dict | None = None,
        inventory_data: dict | None = None,
    ) -> dict:
        top_items = self.get_top_items(target_date)

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
        scenario_label = (
            (inventory_data or {}).get("scenario_label")
            or (complaint_data or {}).get("scenario_label")
            or (forecast_data or {}).get("scenario_label")
            or "Service"
        )
        service_window = (
            (inventory_data or {}).get("service_window")
            or (complaint_data or {}).get("service_window")
            or (forecast_data or {}).get("service_window")
            or "target service window"
        )
        scenario_watchouts = (complaint_data or {}).get("scenario_watchouts") or []

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
                alert.get("ingredient")
                for alert in shortage_alerts
                if isinstance(alert, dict) and alert.get("ingredient")
            ],
            "overstock_ingredients": [
                alert.get("ingredient")
                for alert in overstock_alerts
                if isinstance(alert, dict) and alert.get("ingredient")
            ],
            "scenario_label": scenario_label,
            "service_window": service_window,
            "scenario_watchouts": scenario_watchouts[:3],
            "note": "Phase 3 menu insights combine demand, complaints, inventory, and scenario context.",
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
        watchout_lines = "\n".join(f"  - {item}" for item in scenario_watchouts[:3]) or "  None"

        service_day_label = (forecast_data or {}).get("service_day_label", "service")
        prompt = f"""
## Context
Menu planning context for {scenario_label} ({service_day_label} service):
- Service window: {service_window}
- Predicted service orders: {(forecast_data or {}).get('predicted_orders', 'N/A')}
- Predicted peak orders: {(forecast_data or {}).get('predicted_peak_orders', 'N/A')}
- Average matching-day orders: {(forecast_data or {}).get('avg_friday_orders', 'N/A')}
- Target date: {(forecast_data or {}).get('target_date', 'N/A')}

Top items on matching service days:
{top_item_lines}

Complaint themes to watch:
{complaint_lines}

Scenario watchouts:
{watchout_lines}

Inventory shortages:
{shortage_lines}

Inventory overstock:
{overstock_lines}

## Task
Recommend how the restaurant should shape the menu focus for the target service window. Prioritise items that are popular and operationally safe,
avoid pushing items likely to suffer from ingredient shortages or complaint patterns, and suggest practical promo or menu
positioning actions that can be executed within the next 24 hours.

## Response format
Respond with a JSON object containing:
- "highlight_items": array of strings - items to feature prominently for the target service window
- "deprioritize_items": array of strings - items to avoid pushing due to risk, complaints, or weak operational fit
- "promo_candidates": array of strings - items suitable for promotion in this service window
- "inventory_blockers": array of strings - ingredient or stock constraints affecting menu choices
- "complaint_watchouts": array of strings - quality or service issues menu execution should watch closely
- "operational_notes": array of strings - practical kitchen/front-of-house actions tied to the menu plan
- "reasoning": string - one concise summary of the menu strategy
- "priority": string - "high", "medium", or "low"
- "risks": array of strings - what could go wrong if the menu plan is ignored
"""

        recommendation = await self.llm.complete_json(
            prompt=prompt,
            system_prompt=PromptUtils.SYSTEM_MENU_AGENT,
        )
        recommendation = self.normalize_scenario_language(
            recommendation,
            scenario_label=scenario_label,
        )

        return {
            "service": "menu",
            "data": data,
            "recommendation": recommendation,
        }
