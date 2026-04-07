"""
Shared orchestration state for the CortexKitchen LangGraph workflow.

This module defines the central state object (`OrchestratorState`) that is passed
throughout the entire multi-agent pipeline. It acts as the single source of truth
for one orchestration run, ensuring that all agents operate on a consistent and
predictable data structure.

The state is intentionally designed as a TypedDict to enforce a fixed schema while
retaining the flexibility of a dictionary. Each field represents either:
1. Request metadata (input context such as scenario, target date, timestamp)
2. Outputs produced by individual domain agents (forecast, reservation, complaints, etc.)
3. Intermediate aggregation results (combined operational recommendations)
4. Validation layer outputs (critic agent verdict)
5. Final API-ready response
6. Error handling (capturing any fatal issues during execution)

Design principles:
- Single source of truth: All agents read from and write to this shared state object.
- Strict ownership: Each agent is responsible only for its designated output key and
  must not modify unrelated fields. This prevents side effects and keeps the system modular.
- Incremental enrichment: The state starts empty (with `None` values) and is progressively
  populated as the workflow executes step-by-step.
- Observability: By inspecting the state at any point, we can understand which agents
  have executed, what outputs were produced, and where failures occurred.

This structure enables clean orchestration, easier debugging, and scalability when
adding new agents or capabilities to the system.
"""

from typing import TypedDict, Optional
from datetime import datetime, timezone


class OrchestratorState(TypedDict):
    # ── Request metadata ────────────────────────────────────────────────────
    scenario: str                        # e.g. "friday_rush"
    target_date: Optional[str]           # ISO date string, e.g. "2026-04-11"
    requested_at: str                    # ISO datetime of the request

    # ── Agent outputs ────────────────────────────────────────────────────────
    forecast_output: Optional[dict]      # Demand Forecast Agent result
    reservation_output: Optional[dict]   # Reservation Agent result
    complaint_output: Optional[dict]     # Complaint Intelligence Agent result
    menu_output: Optional[dict]          # Menu Intelligence Agent result
    inventory_output: Optional[dict]     # Inventory & Waste Agent result

    # ── Aggregation ──────────────────────────────────────────────────────────
    aggregated_recommendation: Optional[dict]  # Ops Manager aggregation

    # ── Critic ───────────────────────────────────────────────────────────────
    critic_output: Optional[dict]        # Critic Agent verdict

    # ── Final response ───────────────────────────────────────────────────────
    final_response: Optional[dict]       # Assembled response ready for the API
    error: Optional[str]                 # Set if any node encounters a fatal error


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