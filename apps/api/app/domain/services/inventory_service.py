"""
InventoryService — P2-02.

Queries the inventory table and cross-references predicted Friday demand
to surface shortage and overstock alerts.

Shortage:  quantity_in_stock < reorder_threshold
Overstock: quantity_in_stock > reorder_threshold * OVERSTOCK_MULTIPLIER

Demand pressure is derived from the forecast's predicted_orders relative
to the average Friday orders — used to escalate alert severity.
"""

import re
from types import SimpleNamespace

from sqlalchemy.orm import Session

from app.domain.scenarios import ScenarioDefinition
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
            baseline_stock = getattr(item, "source_quantity_in_stock", stock)
            projected_drawdown = getattr(item, "projected_drawdown", 0.0)
            scenario_adjustment_reason = getattr(item, "scenario_adjustment_reason", None)

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
                    "baseline_stock":    round(baseline_stock, 2),
                    "projected_drawdown": round(projected_drawdown, 2),
                    "scenario_adjustment_reason": scenario_adjustment_reason,
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
                    "baseline_stock":    round(baseline_stock, 2),
                    "projected_drawdown": round(projected_drawdown, 2),
                    "scenario_adjustment_reason": scenario_adjustment_reason,
                })

        return {
            "total_items_checked": len(stock_items),
            "shortage_alerts":     shortage_alerts,
            "overstock_alerts":    overstock_alerts,
            "high_demand_week":    high_demand,
            "demand_ratio":        round(demand_ratio, 2),
        }

    def project_stock_for_scenario(
        self,
        stock_items: list[Inventory],
        scenario_profile: ScenarioDefinition | None,
        demand_ratio: float,
    ) -> list[SimpleNamespace]:
        scenario_id = (scenario_profile or {}).get("id", "friday_rush")
        projected_items: list[SimpleNamespace] = []

        for item in stock_items:
            drawdown = self._projected_drawdown(item, scenario_id, demand_ratio)
            projected_items.append(
                SimpleNamespace(
                    ingredient_name=item.ingredient_name,
                    unit=item.unit,
                    quantity_in_stock=round(max(item.quantity_in_stock - drawdown, 0), 2),
                    reorder_threshold=item.reorder_threshold,
                    spoilage_risk=item.spoilage_risk,
                    source_quantity_in_stock=item.quantity_in_stock,
                    projected_drawdown=round(drawdown, 2),
                    scenario_adjustment_reason=self._scenario_adjustment_reason(
                        item.ingredient_name,
                        scenario_id,
                        drawdown,
                    ),
                )
            )

        return projected_items

    def _projected_drawdown(
        self,
        item: Inventory,
        scenario_id: str,
        demand_ratio: float,
    ) -> float:
        ingredient = item.ingredient_name.lower()
        threshold = float(item.reorder_threshold)
        shortage = max(threshold - float(item.quantity_in_stock), 0.0)
        demand_multiplier = max(demand_ratio, 0.85)

        if scenario_id == "weekday_lunch":
            if any(token in ingredient for token in ["burger buns", "coca cola", "tomato sauce"]):
                return round(threshold * 0.18 * demand_multiplier, 2)
            if any(token in ingredient for token in ["mozzarella", "pizza dough", "pepperoni", "basil"]):
                return round(threshold * 0.08 * demand_multiplier, 2)
            return round(threshold * 0.05 * demand_multiplier, 2)

        if scenario_id == "holiday_spike":
            if any(token in ingredient for token in ["mozzarella", "pizza dough", "pepperoni", "basil", "tomato sauce"]):
                return round(threshold * 0.45 * demand_multiplier, 2)
            if any(token in ingredient for token in ["burger buns", "coca cola cans", "chicken", "paneer"]):
                return round(threshold * 0.32 * demand_multiplier, 2)
            return round(threshold * 0.16 * demand_multiplier, 2)

        if scenario_id == "low_stock_weekend":
            if shortage > 0:
                return round((threshold * 0.25) + (shortage * 0.45 * demand_multiplier), 2)
            if any(token in ingredient for token in ["mozzarella", "pizza dough", "pepperoni", "basil", "garlic"]):
                return round(threshold * 0.22 * demand_multiplier, 2)
            return round(threshold * 0.1 * demand_multiplier, 2)

        if any(token in ingredient for token in ["mozzarella", "pizza dough", "pepperoni", "basil", "garlic"]):
            return round(threshold * 0.18 * demand_multiplier, 2)
        if any(token in ingredient for token in ["burger buns", "coca cola cans", "chicken"]):
            return round(threshold * 0.12 * demand_multiplier, 2)
        return round(threshold * 0.06 * demand_multiplier, 2)

    def _scenario_adjustment_reason(
        self,
        ingredient_name: str,
        scenario_id: str,
        projected_drawdown: float,
    ) -> str | None:
        if projected_drawdown <= 0:
            return None

        if scenario_id == "weekday_lunch":
            return f"Projected lunch-service drawdown applied to {ingredient_name.lower()}."
        if scenario_id == "holiday_spike":
            return f"Projected holiday-spike drawdown applied to {ingredient_name.lower()}."
        if scenario_id == "low_stock_weekend":
            return f"Projected constrained-stock weekend drawdown applied to {ingredient_name.lower()}."
        return f"Projected Friday rush drawdown applied to {ingredient_name.lower()}."

    def normalize_scenario_language(
        self,
        payload: dict | list | str | None,
        scenario_label: str,
    ):
        if scenario_label == "Friday Rush":
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
            (r"\bFriday's demand\b", f"{scenario_label} demand"),
            (r"\bFriday demand\b", f"{scenario_label} demand"),
            (r"\bbefore Friday\b", "before this service window"),
            (r"\bon Friday\b", f"during {scenario_label}"),
            (r"\bFriday\b", scenario_label),
        ]

        normalized = payload
        for pattern, replacement in replacements:
            normalized = re.sub(pattern, replacement, normalized, flags=re.IGNORECASE)
        return normalized

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
        scenario_label: str,
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
                    f"Use {excess:g}{unit} excess {ingredient} in specials before the {scenario_label} service window."
                )
            else:
                waste_actions.append(
                    f"Pause {ingredient} reorders; current stock exceeds the {scenario_label} buffer by {excess:g}{unit}."
                )

        return {
            **guarded,
            "restock_actions": restock_actions,
            "waste_reduction_actions": waste_actions,
            "priority": guarded.get("priority") or ("high" if restock_actions else "medium"),
            "reasoning": guarded.get("reasoning")
            or f"Critical shortages are prioritised with restock quantities capped to the immediate {scenario_label} need.",
            "risks": guarded.get("risks") or [
                f"{scenario_label} service may stock out on critical ingredients if restocking is delayed."
            ],
        }

    # ── LLM recommendation ────────────────────────────────────────────────────

    async def analyse_and_recommend(
        self,
        forecast_data: dict | None = None,
        scenario_profile: ScenarioDefinition | None = None,
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

        projected_stock_items = self.project_stock_for_scenario(
            stock_items=stock_items,
            scenario_profile=scenario_profile,
            demand_ratio=demand_ratio,
        )
        alerts = self.compute_alerts(projected_stock_items, demand_ratio)

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
        scenario_label = scenario_profile["label"] if scenario_profile else "Friday Rush"
        service_window = scenario_profile["service_window"] if scenario_profile else "18:00-22:00"

        prompt = PromptUtils.format_recommendation_prompt(
            context=f"""
Inventory status ahead of {scenario_label}:
- Service window: {service_window}
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
                "restocking, reorder, and waste-reduction actions before this service window. Prioritize "
                "critical shortages first, keep every restock quantity realistic for the next "
                "24 hours, and never suggest ordering more than the max_actionable_restock "
                "listed for an ingredient."
            ),
        )

        recommendation = await self.llm.complete_json(
            prompt=prompt,
            system_prompt=PromptUtils.SYSTEM_INVENTORY_AGENT,
        )
        recommendation = self.normalize_scenario_language(
            recommendation,
            scenario_label=scenario_label,
        )
        recommendation = self.merge_guardrailed_recommendation(
            recommendation=recommendation,
            actionable_shortages=actionable_shortages,
            overstock_alerts=alerts["overstock_alerts"],
            scenario_label=scenario_label,
        )

        return {
            "service": "inventory",
            "data":    {
                **alerts,
                "scenario_label": scenario_label,
                "service_window": service_window,
            },
            "recommendation": recommendation,
        }
