"""
Shared orchestration state for CortexKitchen LangGraph workflow.

Every key uses the keep_last reducer — LangGraph requires this for ALL keys
when the graph has parallel fan-out nodes, even keys that are only written once.

Enhanced for P1-10:
- Supports simulation mode for deterministic testing
- Enables critic override for validation scenarios
- Adds debug observability and execution tracing
- Maintains backward compatibility with existing workflows
"""

from typing import TypedDict, Optional, Annotated, List, Dict, Any
from datetime import datetime, timezone


# ── Reducer ──────────────────────────────────────────────────────────────────

def keep_last(current, new):
    """Reducer: always keep the newest non-None value."""
    if new is None:
        return current
    return new


# ── Orchestration State ──────────────────────────────────────────────────────

class OrchestratorState(TypedDict):
    # Core request metadata
    scenario:     Annotated[Optional[str], keep_last]
    target_date:  Annotated[Optional[str], keep_last]
    requested_at: Annotated[Optional[str], keep_last]

    # P1-10 Testing & Simulation Controls
    simulation_mode: Annotated[Optional[bool], keep_last]
    force_critic_decision: Annotated[Optional[str], keep_last]
    debug: Annotated[Optional[bool], keep_last]

    # Domain agent outputs
    forecast_output:    Annotated[Optional[Dict[str, Any]], keep_last]
    reservation_output: Annotated[Optional[Dict[str, Any]], keep_last]
    complaint_output:   Annotated[Optional[Dict[str, Any]], keep_last]
    menu_output:        Annotated[Optional[Dict[str, Any]], keep_last]
    inventory_output:   Annotated[Optional[Dict[str, Any]], keep_last]

    # Aggregated intelligence
    aggregated_recommendation: Annotated[Optional[Dict[str, Any]], keep_last]

    # Critic evaluation
    critic_output: Annotated[Optional[Dict[str, Any]], keep_last]

    # Final response returned to the API layer
    final_response: Annotated[Optional[Dict[str, Any]], keep_last]

    # Debug and observability
    execution_trace: Annotated[Optional[List[str]], keep_last]

    # Error handling
    error: Annotated[Optional[str], keep_last]


# ── Initial State Factory ────────────────────────────────────────────────────

def make_initial_state(
    scenario: str,
    target_date: Optional[str] = None,
    simulation_mode: bool = False,
    force_critic_decision: Optional[str] = None,
    debug: bool = False,
) -> OrchestratorState:
    """
    Build a clean initial state for a new orchestration run.

    Args:
        scenario: Name of the orchestration scenario.
        target_date: Optional ISO date string.
        simulation_mode: Enables deterministic outputs using mock data.
        force_critic_decision: Overrides critic verdict for testing.
        debug: Enables execution tracing and observability.

    Returns:
        A fully initialized OrchestratorState.
    """
    return OrchestratorState(
        # Core metadata
        scenario=scenario,
        target_date=target_date,
        requested_at=datetime.now(timezone.utc).isoformat(),

        # P1-10 controls
        simulation_mode=simulation_mode,
        force_critic_decision=force_critic_decision,
        debug=debug,

        # Domain outputs
        forecast_output=None,
        reservation_output=None,
        complaint_output=None,
        menu_output=None,
        inventory_output=None,

        # Aggregated results
        aggregated_recommendation=None,
        critic_output=None,
        final_response=None,

        # Observability
        execution_trace=[] if debug else None,

        # Error handling
        error=None,
    )