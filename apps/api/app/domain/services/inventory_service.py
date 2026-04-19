"""
InventoryService — P2-02.

Queries the inventory table and cross-references predicted Friday demand
to surface shortage and overstock alerts.

Shortage:  quantity_in_stock < reorder_threshold
Overstock: quantity_in_stock > reorder_threshold * OVERSTOCK_MULTIPLIER

Demand pressure is derived from the forecast's predicted_orders relative
to the average Friday orders — used to escalate alert severity.
"""

from sqlalchemy.orm import Session

from app.infrastructure.db.models import Inventory
from app.infrastructure.llm.base import BaseLLMProvider
from app.infrastructure.llm.prompt_utils import PromptUtils


OVERSTOCK_MULTIPLIER = 3.0   # stock > 3x threshold = overstock
HIGH_DEMAND_RATIO    = 1.15  # predicted > 115% of avg = high demand week


class InventoryService:

    def __init__(self, db: Session, llm: BaseLLMProvider):
        self.db = db
        self.llm = llm

    # ── Data layer ────────────────────────────────────────────────────────────

    def get_all_stock(self) -> list[Inventory]:
        items = self.db.query(Inventory).all()
        print(f"[DEBUG] Inventory query returned {len(items)} items")
        return items

    # ── Alert logic ───────────────────────────────────────────────────────────

    def compute_alerts(
        self,
        stock_items: list[Inventory],
        demand_ratio: float = 1.0,
    ) -> dict:
        """
        Evaluate every inventory row and return shortage + overstock alerts.

        demand_ratio = predicted_orders / avg_friday_orders.
        A ratio above HIGH_DEMAND_RATIO escalates shortage severity to 'critical'.
        """
        shortage_alerts  = []
        overstock_alerts = []
        high_demand      = demand_ratio >= HIGH_DEMAND_RATIO

        for item in stock_items:
            stock     = item.quantity_in_stock
            threshold = item.reorder_threshold

            if stock < threshold:
                severity = (
                    "critical" if (high_demand or item.spoilage_risk)
                    else "warning"
                )
                shortage_alerts.append({
                    "ingredient":        item.ingredient_name,
                    "unit":              item.unit,
                    "quantity_in_stock": round(stock, 2),
                    "reorder_threshold": round(threshold, 2),
                    "shortfall":         round(threshold - stock, 2),
                    "spoilage_risk":     item.spoilage_risk,
                    "severity":          severity,
                })

            elif stock > threshold * OVERSTOCK_MULTIPLIER:
                overstock_alerts.append({
                    "ingredient":        item.ingredient_name,
                    "unit":              item.unit,
                    "quantity_in_stock": round(stock, 2),
                    "reorder_threshold": round(threshold, 2),
                    "excess":            round(stock - threshold * OVERSTOCK_MULTIPLIER, 2),
                    "spoilage_risk":     item.spoilage_risk,
                    "severity":          "warning" if item.spoilage_risk else "info",
                })

        return {
            "total_items_checked": len(stock_items),
            "shortage_alerts":     shortage_alerts,
            "overstock_alerts":    overstock_alerts,
            "high_demand_week":    high_demand,
            "demand_ratio":        round(demand_ratio, 2),
        }

    # ── LLM recommendation ────────────────────────────────────────────────────

    async def analyse_and_recommend(
        self,
        forecast_data: dict | None = None,
    ) -> dict:
        """
        Query stock, compute alerts, and ask the LLM for operational actions.

        forecast_data: the `data` sub-dict from forecast_output, used to
                       derive demand_ratio. Treated as optional so the node
                       degrades gracefully if forecast failed upstream.
        """
        stock_items = self.get_all_stock()

        # Derive demand ratio from forecast if available
        demand_ratio = 1.0
        if forecast_data:
            predicted = forecast_data.get("predicted_orders", 0)
            avg       = forecast_data.get("avg_friday_orders", 0)
            if avg and avg > 0:
                demand_ratio = predicted / avg

        alerts = self.compute_alerts(stock_items, demand_ratio)

        # Build LLM prompt
        shortage_lines = "\n".join(
            f"  - {a['ingredient']} ({a['unit']}): "
            f"stock={a['quantity_in_stock']}, threshold={a['reorder_threshold']}, "
            f"shortfall={a['shortfall']}, severity={a['severity']}, "
            f"spoilage_risk={a['spoilage_risk']}"
            for a in alerts["shortage_alerts"]
        ) or "  None"

        overstock_lines = "\n".join(
            f"  - {a['ingredient']} ({a['unit']}): "
            f"stock={a['quantity_in_stock']}, excess={a['excess']}, "
            f"spoilage_risk={a['spoilage_risk']}"
            for a in alerts["overstock_alerts"]
        ) or "  None"

        prompt = PromptUtils.format_recommendation_prompt(
            context=f"""
Inventory status ahead of Friday rush:
- Total ingredients checked: {alerts['total_items_checked']}
- High demand week: {alerts['high_demand_week']} (demand ratio: {alerts['demand_ratio']})

Shortage alerts:
{shortage_lines}

Overstock alerts:
{overstock_lines}
""",
            task=(
                "Based on the inventory status and demand forecast, recommend specific "
                "restocking, reorder, and waste-reduction actions before Friday."
            ),
        )

        recommendation = await self.llm.complete_json(
            prompt=prompt,
            system_prompt=PromptUtils.SYSTEM_INVENTORY_AGENT,
        )

        return {
            "service": "inventory",
            "data":    alerts,
            "recommendation": recommendation,
        }