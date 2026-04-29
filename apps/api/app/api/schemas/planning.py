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


PlanningScenarioId = Literal[
    "friday_rush",
    "weekday_lunch",
    "holiday_spike",
    "low_stock_weekend",
]



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


class PlanningRunRequest(FridayRushRequest):
    scenario: PlanningScenarioId = Field(
        default="friday_rush",
        description="Scenario preset to run through the shared planning workflow.",
    )


class PlanningScenarioOption(BaseModel):
    id: PlanningScenarioId
    label: str
    description: str
    default_weekday: int
    service_window: str
    operational_focus: str


class PlanningScenarioListResponse(BaseModel):
    scenarios: list[PlanningScenarioOption]


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


class CostAnalysisResult(BaseModel):
    cost_pressure_score: float = Field(
        description="0.0 to 1.0 score where higher means more operational pressure"
    )
    benefit_score: float = Field(
        description="0.0 to 1.0 score where higher means stronger expected operational benefit"
    )
    tradeoff_score: float = Field(
        description="0.0 to 1.0 score where higher means better cost/benefit balance"
    )
    pressure_components: Dict[str, float] = Field(default_factory=dict)
    benefit_components: Dict[str, float] = Field(default_factory=dict)
    tradeoff_notes: list[str] = Field(default_factory=list)
    recommended_focus: list[str] = Field(default_factory=list)
    signals: Dict[str, Any] = Field(default_factory=dict)


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
    cost_analysis: Optional[CostAnalysisResult] = None
    dimension_scores: Optional[Dict[str, float]] = Field(
        default=None,
        description="Per-dimension critic scoring for safety, feasibility, evidence, actionability, and clarity"
    )
    revision_reasons: list[str] = Field(
        default_factory=list,
        description="Short reasons explaining what weakened the plan"
    )
    actionable_feedback: list[str] = Field(
        default_factory=list,
        description="Concrete next changes the planner should make"
    )
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
