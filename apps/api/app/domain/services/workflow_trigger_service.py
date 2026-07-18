"""Built-in workflow triggers -- evaluates a finished planning run's response and
auto-creates Action Queue rows when certain conditions hold. Deliberately NOT a
full owner-defined trigger/condition/action builder -- just 2 fixed conditions,
matching the scope call in P6-A11 (a general builder is a much bigger UI/DB
investment for marginal demo value beyond having these triggers exist).

Both triggers create recommendation-tier actions only -- neither one auto-executes
anything. A restock alert or a "review your pricing" flag always needs a human to
actually act on it; this is a level below the WhatsApp-order flow (P6-A9), which is
approve_required rather than a passive recommendation.
"""

import re

from app.domain.services.action_queue_service import ActionQueueService
from app.infrastructure.db.models import ActionStatus, ActionTier, Vendor, VendorPriceQuote


def _join_naturally(items: list[str]) -> str:
    if len(items) == 1:
        return items[0]
    if len(items) == 2:
        return f"{items[0]} and {items[1]}"
    return f"{', '.join(items[:-1])}, and {items[-1]}"


class WorkflowTriggerService:
    def __init__(self, db):
        self.db = db
        self.action_queue = ActionQueueService(db)

    def evaluate_and_queue(self, org_id: int, plan_result: dict) -> list:
        """Runs both built-in triggers against a finished plan's response dict
        and creates an Action Queue row for each one that fires. Returns the
        list of created actions (empty if neither condition holds)."""
        created = []
        shortage_action = self._check_critical_shortages(org_id, plan_result)
        if shortage_action:
            created.append(shortage_action)
        pricing_action = self._check_busy_plus_competitor_deals(org_id, plan_result)
        if pricing_action:
            created.append(pricing_action)
        return created

    def _has_pending(self, org_id: int, category: str) -> bool:
        """Avoids queuing a duplicate recommendation every time the same
        condition holds across repeated planning runs in the same day."""
        pending = self.action_queue.list_actions(org_id, status=ActionStatus.pending)
        return any(a.category == category for a in pending)

    def _check_critical_shortages(self, org_id: int, plan_result: dict):
        """Trigger 1: 2+ critical shortages found -> queue an urgent restock action.

        The action carries full per-ingredient detail (stock/threshold/shortfall/
        recommended restock qty, a real cheapest-vendor suggestion when a
        VendorPriceQuote exists, and the real forecast demand reason when a
        weather/holiday signal adjusted it) -- all of it was already computed by
        InventoryService/ForecastService for this run, just not previously
        attached to the stored action row (P6-A31: Action Center hero card +
        list needed this to show real numbers, not placeholders).
        """
        if self._has_pending(org_id, "restock_alert"):
            return None
        inv_data = ((plan_result.get("recommendations") or {}).get("inventory") or {}).get("data") or {}
        critical = [
            a for a in (inv_data.get("shortage_alerts") or [])
            if isinstance(a, dict) and a.get("severity") == "critical" and a.get("ingredient")
        ]
        if len(critical) < 2:
            return None

        reason = self._demand_reason(plan_result)
        shortages = [
            {
                "ingredient": a["ingredient"],
                "unit": a.get("unit"),
                "quantity_in_stock": a.get("quantity_in_stock"),
                "reorder_threshold": a.get("reorder_threshold"),
                "shortfall": a.get("shortfall"),
                "recommended_restock_qty": a.get("recommended_restock_qty"),
                "suggested_vendor": self._suggest_vendor(org_id, a["ingredient"]),
                "reason": reason or f"Stock is running below your usual minimum of {a.get('reorder_threshold')}{a.get('unit') or ''}.",
            }
            for a in critical
        ]
        names = [s["ingredient"] for s in shortages]
        shown = names[:3]
        title = f"{_join_naturally(shown)} {'is' if len(shown) == 1 else 'are'} running low"
        if len(names) > len(shown):
            title += f" (and {len(names) - len(shown)} more)"
        return self.action_queue.create_action(
            org_id=org_id, category="restock_alert", tier=ActionTier.recommendation,
            title=title,
            payload={"ingredients": names, "shortages": shortages},
        )

    def _suggest_vendor(self, org_id: int, ingredient: str) -> str | None:
        """Real cheapest-vendor lookup via VendorPriceQuote -- None (never a
        fabricated name) when no quote exists for this ingredient yet. Never
        raises: a lookup failure should still let the restock alert itself
        get created, just without a vendor suggestion attached."""
        try:
            quote = (
                self.db.query(VendorPriceQuote)
                .join(Vendor, Vendor.id == VendorPriceQuote.vendor_id)
                .filter(Vendor.org_id == org_id, VendorPriceQuote.ingredient.ilike(ingredient))
                .order_by(VendorPriceQuote.price.asc())
                .first()
            )
            if not quote:
                return None
            vendor = self.db.query(Vendor).filter(Vendor.id == quote.vendor_id).first()
            return vendor.name if vendor else None
        except Exception:
            self.db.rollback()
            return None

    def _demand_reason(self, plan_result: dict) -> str | None:
        """Real forecast-adjustment reason (weather/holiday demand multiplier)
        when one actually fired for this run -- None otherwise, never guessed.

        forecast_data['adjustment_reasons'] holds internal audit strings like
        "weather (rain): x1.3" (also used verbatim in the LLM prompt/evidence
        panel elsewhere) -- here the parenthesized cause is pulled out and
        turned into a plain sentence instead of showing that raw format to
        a restaurant owner.
        """
        forecast_data = ((plan_result.get("recommendations") or {}).get("forecast") or {}).get("data") or {}
        multiplier = forecast_data.get("adjustment_multiplier")
        raw_reasons = forecast_data.get("adjustment_reasons")
        if not multiplier or multiplier == 1.0 or not raw_reasons:
            return None
        pct = round((float(multiplier) - 1.0) * 100)
        direction = "higher" if pct > 0 else "lower"
        causes = [m.group(1) for r in raw_reasons if (m := re.search(r"\(([^)]+)\)", r))] or raw_reasons
        return f"Demand is expected to be {abs(pct)}% {direction} than usual because of {_join_naturally(causes)}."

    def _check_busy_plus_competitor_deals(self, org_id: int, plan_result: dict):
        """Trigger 2: tonight_busy + 2+ Dineout deals live in the area -> queue a
        pricing/promo review action. Same signal Diff 7 (evaluation_sanity.py)
        already flags to the critic -- this surfaces it as an actionable item too,
        not just a plan-revision note."""
        if self._has_pending(org_id, "pricing_promo_review"):
            return None
        market_intel = plan_result.get("market_intel") or {}
        tonight_busy = market_intel.get("tonight_busy")
        deals_count = (
            (market_intel.get("dineout_deals_count") or 0)
            + len(market_intel.get("slot_deals_found") or [])
        )
        if tonight_busy is not True or deals_count < 2:
            return None
        return self.action_queue.create_action(
            org_id=org_id, category="pricing_promo_review", tier=ActionTier.recommendation,
            title=(
                f"Tonight looks busy, and {deals_count} nearby deals are live right now. "
                "Worth double-checking your own pricing."
            ),
            payload={"tonight_busy": tonight_busy, "area_deals_count": deals_count},
        )
