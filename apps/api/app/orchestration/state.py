"""
Shared orchestration state for CortexKitchen LangGraph workflow.

This TypedDict is the single source of truth passed between all agent nodes.
Each agent reads what it needs and writes its own output key — nothing else.
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