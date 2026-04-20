"""
Ops Manager Agent node.

Responsibilities:
- Validate incoming scenario type
- Set up any missing state defaults
- (Future) decide which agents should run based on scenario config

This node runs first in every graph execution.
"""

from datetime import datetime, timedelta

from app.orchestration.state import OrchestratorState


SUPPORTED_SCENARIOS = {"friday_rush"}


def _resolve_target_date(target_date: str | None) -> str:
    """Normalize empty target_date to the next Friday in ISO format."""
    if target_date:
        return target_date

    today = datetime.utcnow()
    days_ahead = (4 - today.weekday()) % 7
    if days_ahead == 0:
        days_ahead = 7
    next_friday = today + timedelta(days=days_ahead)
    return next_friday.strftime("%Y-%m-%d")


def ops_manager_node(state: OrchestratorState) -> OrchestratorState:
    """
    Entry node — validates scenario and prepares orchestration state.
    Does not call the LLM directly; it coordinates other agents.
    """
    scenario = state.get("scenario", "")

    if scenario not in SUPPORTED_SCENARIOS:
        return {
            **state,
            "error": f"Unknown scenario '{scenario}'. Supported: {SUPPORTED_SCENARIOS}",
        }

    # Stub: In Phase 2+ this node could dynamically decide which agents to skip
    # based on scenario config, feature flags, or cached results.
    return {
        **state,
        "target_date": _resolve_target_date(state.get("target_date")),
        "error": None,  # Ensure error is cleared for a valid scenario
    }
