"""
Request and response schemas for the planning endpoints.

Kept in a dedicated file so the route handler stays clean
and schemas can be reused by future endpoints.
"""

from typing import Any, Optional
from datetime import datetime

from pydantic import BaseModel, Field

from app.api.schemas.common import MetaInfo


# ── Request ───────────────────────────────────────────────────────────────────

class FridayRushRequest(BaseModel):
    target_date: Optional[str] = Field(
        default=None,
        description="ISO date string for the target Friday, e.g. '2026-04-11'. Defaults to next Friday.",
        examples=["2026-04-11"],
    )


# ── Per-agent recommendation block ───────────────────────────────────────────

class AgentRecommendations(BaseModel):
    forecast:    Optional[dict[str, Any]] = None
    reservation: Optional[dict[str, Any]] = None
    complaint:   Optional[dict[str, Any]] = None
    menu:        Optional[dict[str, Any]] = None
    inventory:   Optional[dict[str, Any]] = None


# ── Critic block ──────────────────────────────────────────────────────────────

class CriticResult(BaseModel):
    verdict:         str = Field(description="approved | rejected | revision | unknown")
    score:           float = Field(description="0.0 – 1.0 quality score")
    notes:           str = ""
    decision_log_id: Optional[int] = Field(default=None, description="ID of the persisted DecisionLog row")


# ── Response ──────────────────────────────────────────────────────────────────

class FridayRushResponse(BaseModel):
    scenario:        str
    target_date:     Optional[str]
    status:          str = Field(description="ready | needs_review | blocked | unknown")
    generated_at:    str
    recommendations: AgentRecommendations
    rag_context:     Optional[dict[str, Any]] = None
    critic:          CriticResult
    meta:            MetaInfo = Field(default_factory=MetaInfo)