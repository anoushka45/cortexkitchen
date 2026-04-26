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
RESTOCK_CAP_MULTIPLIER = 3.0


class InventoryService:

    def __init__(self, db: Session, llm: BaseLLMProvider):
        self.db = db
        self.llm = llm

    # ── Data layer ────────────────────────────────────────────────────────────

    def get_all_stock(self) -> list[Inventory]:
        items = self.db.query(Inventory).all()        
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

    def build_capped_restock_actions(self, shortage_alerts: list[dict]) -> list[str]:
        """Build deterministic restock actions that cannot exceed sanity caps."""
        priority_order = {"critical": 0, "warning": 1}
        sorted_alerts = sorted(
            shortage_alerts,
            key=lambda alert: priority_order.get(alert.get("severity"), 2),
        )

        actions = []
        for alert in sorted_alerts:
            ingredient = alert["ingredient"]
            unit = alert["unit"]
            current_stock = float(alert["quantity_in_stock"])
            shortfall = float(alert["shortfall"])
            recommended_qty = float(alert.get("recommended_restock_qty", alert["shortfall"]))
            max_actionable_qty = float(
                alert.get("max_actionable_restock_qty", recommended_qty)
            )
            capped_qty = round(min(recommended_qty, max_actionable_qty), 2)
            urgency = (
                "immediately"
                if alert.get("severity") == "critical"
                else "within 24 hours"
            )
            actions.append(
                f"Order {capped_qty:g}{unit} {ingredient} {urgency} "
                f"(covers {shortfall:g}{unit} shortfall; current stock {current_stock:g}{unit}; "
                f"within max actionable cap {max_actionable_qty:g}{unit})."
            )

        return actions

    def merge_guardrailed_recommendation(
        self,
        recommendation: dict,
        actionable_shortages: list[dict],
        overstock_alerts: list[dict],
    ) -> dict:
        """
        Keep LLM reasoning, but make quantity-sensitive inventory actions deterministic.

        The critic sanity checker should be a backstop, not the first place impossible
        restock quantities are corrected.
        """
        guarded = recommendation if isinstance(recommendation, dict) else {}
        restock_actions = self.build_capped_restock_actions(actionable_shortages)

        waste_actions = guarded.get("waste_reduction_actions")
        if not isinstance(waste_actions, list):
            waste_actions = []

        for alert in overstock_alerts:
            ingredient = alert["ingredient"]
            excess = alert["excess"]
            unit = alert["unit"]
            if alert.get("spoilage_risk"):
                waste_actions.append(
                    f"Use {excess:g}{unit} excess {ingredient} in specials before Friday service."
                )
            else:
                waste_actions.append(
                    f"Pause {ingredient} reorders; current stock exceeds Friday buffer by {excess:g}{unit}."
                )

        return {
            **guarded,
            "restock_actions": restock_actions,
            "waste_reduction_actions": waste_actions,
            "priority": guarded.get("priority") or ("high" if restock_actions else "medium"),
            "reasoning": guarded.get("reasoning")
            or "Critical shortages are prioritized with restock quantities capped to the immediate Friday need.",
            "risks": guarded.get("risks") or [
                "Friday service may stock out on critical ingredients if restocking is delayed."
            ],
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

        actionable_shortages = []
        for alert in alerts["shortage_alerts"]:
            current_stock = float(alert["quantity_in_stock"])
            shortfall = float(alert["shortfall"])
            max_actionable_restock = round(
                max(shortfall, current_stock * RESTOCK_CAP_MULTIPLIER),
                2,
            )
            actionable_shortages.append({
                **alert,
                "recommended_restock_qty": shortfall,
                "max_actionable_restock_qty": max_actionable_restock,
            })
        alerts["shortage_alerts"] = actionable_shortages

        critical_shortages = [a for a in actionable_shortages if a["severity"] == "critical"]
        warning_shortages = [a for a in actionable_shortages if a["severity"] != "critical"]

        # Build LLM prompt
        shortage_lines = "\n".join(
            f"  - {a['ingredient']} ({a['unit']}): "
            f"stock={a['quantity_in_stock']}, threshold={a['reorder_threshold']}, "
            f"shortfall={a['shortfall']}, recommended_restock={a['recommended_restock_qty']}, "
            f"max_actionable_restock={a['max_actionable_restock_qty']}, "
            f"severity={a['severity']}, spoilage_risk={a['spoilage_risk']}"
            for a in actionable_shortages
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
- Critical shortages requiring first attention: {len(critical_shortages)}
- Warning shortages: {len(warning_shortages)}

Shortage alerts:
{shortage_lines}

Overstock alerts:
{overstock_lines}
""",
            task=(
                "Based on the inventory status and demand forecast, recommend specific "
                "restocking, reorder, and waste-reduction actions before Friday. Prioritize "
                "critical shortages first, keep every restock quantity realistic for the next "
                "24 hours, and never suggest ordering more than the max_actionable_restock "
                "listed for an ingredient."
            ),
        )

        recommendation = await self.llm.complete_json(
            prompt=prompt,
            system_prompt=PromptUtils.SYSTEM_INVENTORY_AGENT,
        )
        recommendation = self.merge_guardrailed_recommendation(
            recommendation=recommendation,
            actionable_shortages=actionable_shortages,
            overstock_alerts=alerts["overstock_alerts"],
        )

        return {
            "service": "inventory",
            "data":    alerts,
            "recommendation": recommendation,
        }
