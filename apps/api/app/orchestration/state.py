"""
Shared orchestration state for CortexKitchen LangGraph workflow.

Every key uses the keep_last reducer — LangGraph requires this for ALL keys
when the graph has parallel fan-out nodes, even keys that are only written once.
"""

from typing import TypedDict, Optional, Annotated
from datetime import datetime, timezone


def keep_last(current, new):
    """Reducer: always keep the newest non-None value."""
    if new is None:
        return current
    return new


class OrchestratorState(TypedDict):
    scenario:     Annotated[Optional[str],  keep_last]
    target_date:  Annotated[Optional[str],  keep_last]
    requested_at: Annotated[Optional[str],  keep_last]

    forecast_output:    Annotated[Optional[dict], keep_last]
    reservation_output: Annotated[Optional[dict], keep_last]
    complaint_output:   Annotated[Optional[dict], keep_last]
    menu_output:        Annotated[Optional[dict], keep_last]
    inventory_output:   Annotated[Optional[dict], keep_last]

    aggregated_recommendation: Annotated[Optional[dict], keep_last]
    critic_output:             Annotated[Optional[dict], keep_last]
    final_response:            Annotated[Optional[dict], keep_last]
    error:                     Annotated[Optional[str],  keep_last]


def make_initial_state(scenario: str, target_date: Optional[str] = None) -> OrchestratorState:
    """Build a clean initial state for a new orchestration run."""
    return OrchestratorState(
        scenario=scenario,
        target_date=target_date,
        requested_at=datetime.now(timezone.utc).isoformat(),
        forecast_output=None,
        reservation_output=None,
        complaint_output=None,
        menu_output=None,
        inventory_output=None,
        aggregated_recommendation=None,
        critic_output=None,
        final_response=None,
        error=None,
    )