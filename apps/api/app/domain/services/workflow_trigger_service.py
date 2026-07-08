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

from app.domain.services.action_queue_service import ActionQueueService
from app.infrastructure.db.models import ActionStatus, ActionTier


class WorkflowTriggerService:
    def __init__(self, db):
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
        """Trigger 1: 2+ critical shortages found -> queue an urgent restock action."""
        if self._has_pending(org_id, "restock_alert"):
            return None
        inv_data = ((plan_result.get("recommendations") or {}).get("inventory") or {}).get("data") or {}
        shortages = [
            a.get("ingredient") for a in (inv_data.get("shortage_alerts") or [])
            if isinstance(a, dict) and a.get("severity") == "critical" and a.get("ingredient")
        ]
        if len(shortages) < 2:
            return None
        return self.action_queue.create_action(
            org_id=org_id, category="restock_alert", tier=ActionTier.recommendation,
            title=f"{len(shortages)} critical shortages: {', '.join(shortages[:3])}",
            payload={"ingredients": shortages},
        )

    def _check_busy_plus_competitor_deals(self, org_id: int, plan_result: dict):
        """Trigger 2: tonight_busy + 2+ competitor Dineout deals live -> queue a
        pricing/promo review action. Same signal Diff 7 (evaluation_sanity.py)
        already flags to the critic -- this surfaces it as an actionable item too,
        not just a plan-revision note."""
        if self._has_pending(org_id, "pricing_promo_review"):
            return None
        market_intel = plan_result.get("market_intel") or {}
        tonight_busy = market_intel.get("tonight_busy")
        deals_count = (
            len(market_intel.get("competitor_dineout_deals") or [])
            + len(market_intel.get("slot_deals_found") or [])
        )
        if tonight_busy is not True or deals_count < 2:
            return None
        return self.action_queue.create_action(
            org_id=org_id, category="pricing_promo_review", tier=ActionTier.recommendation,
            title=f"Review pricing/promos tonight -- {deals_count} competitor deal(s) live while you're at HIGH occupancy",
            payload={"tonight_busy": tonight_busy, "competitor_deals_count": deals_count},
        )
