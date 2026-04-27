"""
Request and response schemas for the planning endpoints.

Kept in a dedicated file so the route handler stays clean
and schemas can be reused by future endpoints.

Enhanced for P1-10 to support:
- Multi-date simulations
- Critic override testing
- Simulation mode for deterministic outputs
- Debug observability for LangGraph state inspection
"""

from typing import Any, Optional, Literal, Dict
from datetime import datetime

from pydantic import BaseModel, Field



# ── Request ───────────────────────────────────────────────────────────────────

class FridayRushRequest(BaseModel):
    """
    Request schema for generating a Friday Rush operational plan.

    Attributes:
        target_date: Optional ISO date string. Defaults to the next Friday
                     if not provided.
        simulation_mode: Enables deterministic outputs using mock or
                         rule-based data instead of real forecasting.
        force_critic_decision: Overrides the critic's verdict for testing.
        debug: Enables verbose logs and LangGraph state inspection.
    """

    target_date: Optional[str] = Field(
        default=None,
        description=(
            "ISO date string for the target Friday, "
            "e.g. '2026-04-11'. Defaults to the next Friday."
        ),
        examples=["2026-04-11"],
    )

    simulation_mode: bool = Field(
        default=False,
        description=(
            "Runs the system in simulation mode using mock or "
            "deterministic data instead of real forecasting."
        ),
        examples=[False],
    )

    force_critic_decision: Optional[
        Literal["approved", "rejected", "revision"]
    ] = Field(
        default=None,
        description=(
            "Overrides the critic's decision for testing purposes. "
            "If provided, the critic will return this verdict."
        ),
        examples=["approved", "rejected"],
    )

    debug: bool = Field(
        default=False,
        description=(
            "Enables verbose logging and includes LangGraph state "
            "snapshots in the response meta."
        ),
        examples=[True],
    )


# ── Per-agent recommendation block ───────────────────────────────────────────

class AgentRecommendations(BaseModel):
    """
    Consolidated recommendations from all agents involved in the
    Friday Rush planning workflow.
    """

    forecast: Optional[Dict[str, Any]] = None
    reservation: Optional[Dict[str, Any]] = None
    complaint: Optional[Dict[str, Any]] = None
    menu: Optional[Dict[str, Any]] = None
    inventory: Optional[Dict[str, Any]] = None


# ── Critic block ──────────────────────────────────────────────────────────────

class CriticResult(BaseModel):
    """
    Represents the evaluation outcome from the Critic Agent.
    """

    verdict: str = Field(
        description="approved | rejected | revision | unknown"
    )
    score: float = Field(
        description="0.0 – 1.0 quality score"
    )
    notes: str = ""
    decision_log_id: Optional[int] = Field(
        default=None,
        description="ID of the persisted DecisionLog row"
    )
    sanity_checks: Optional[Dict[str, Any]] = Field(
        default=None,
        description="Automated evaluation sanity-check report"
    )


# ── Response ──────────────────────────────────────────────────────────────────

class FridayRushResponse(BaseModel):
    """
    Response schema for the Friday Rush Planner.
    Aggregates insights from all agents along with critic feedback
    and optional RAG context.
    """

    scenario: str
    target_date: Optional[str]
    status: str = Field(
        description="ready | needs_review | blocked | unknown"
    )
    generated_at: str
    recommendations: AgentRecommendations
    rag_context: Optional[Dict[str, Any]] = None
    critic: CriticResult
    meta: Dict[str, Any] = Field(default_factory=dict)
