"""
Inventory & Waste Agent node.

Phase 1: stub node — returns a placeholder output.
A dedicated InventoryService will be wired here in Phase 2.
Writes to `inventory_output`.
"""

from sqlalchemy.orm import Session

from app.orchestration.state import OrchestratorState
from app.infrastructure.llm.base import BaseLLMProvider


async def inventory_node(
    state: OrchestratorState,
    db: Session,
    llm: BaseLLMProvider,
) -> OrchestratorState:
    """
    Detects stock pressure and waste risk.
    Phase 1 returns a structured stub — real inventory query in Phase 2.
    Writes to state['inventory_output'].
    """
    if state.get("error"):
        return state

    # Phase 1 stub — no DB query yet; inventory schema exists but
    # dedicated analytics service is Phase 2 scope.
    inventory_output = {
        "service": "inventory",
        "data": {
            "note": "Phase 1 stub — inventory analytics deferred to Phase 2.",
            "shortage_alerts": [],
            "overstock_alerts": [],
        },
        "recommendation": {
            "action": "No inventory alerts at this time. Verify stock levels manually before Friday rush.",
        },
    }
    return {**state, "inventory_output": inventory_output}