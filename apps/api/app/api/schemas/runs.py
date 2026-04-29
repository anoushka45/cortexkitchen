from typing import Any, Literal

from pydantic import BaseModel, Field


class PlanningRunSummary(BaseModel):
    id: int
    scenario: str
    target_date: str | None = None
    status: str
    critic_verdict: str | None = None
    critic_score: float | None = None
    decision_log_id: int | None = None
    generated_at: str | None = None
    created_at: str | None = None


class PlanningRunDetail(PlanningRunSummary):
    final_response: dict[str, Any]
    recommendations: dict[str, Any] | None = None
    rag_context: dict[str, Any] | None = None
    critic: dict[str, Any] | None = None
    metadata: dict[str, Any] | None = None


class PlanningRunListResponse(BaseModel):
    runs: list[PlanningRunSummary]


class DataRange(BaseModel):
    count: int
    date_range: list[str | None] = Field(default_factory=list)


class ScenarioCoverage(BaseModel):
    scenario: str
    label: str
    date: str
    reservations: int
    guests: int
    waitlist: int
    occupancy_pct: float


class FeedbackHealth(DataRange):
    negative: int
    positive: int
    neutral: int
    negative_pct: float


class InventoryHealth(BaseModel):
    items: int
    shortage_alerts: int
    critical_shortages: int
    overstock_alerts: int


class DataHealthResponse(BaseModel):
    orders: DataRange
    reservations: DataRange
    feedback: FeedbackHealth
    inventory: InventoryHealth
    menu: dict[str, int]
    scenario_coverage: list[ScenarioCoverage]
    status: Literal["ok"] = "ok"
