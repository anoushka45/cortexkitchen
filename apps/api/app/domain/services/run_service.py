from datetime import datetime
from typing import Any

from sqlalchemy.orm import Session

from app.infrastructure.db.models import PlanningRun


class RunService:
    """Persists and retrieves planning runs for audit/history views."""

    def __init__(self, db: Session):
        self.db = db

    def create_from_response(self, response: dict[str, Any]) -> PlanningRun:
        critic = response.get("critic") or {}
        meta = response.get("meta") or {}

        run = PlanningRun(
            scenario=response.get("scenario") or "unknown",
            target_date=response.get("target_date"),
            status=response.get("status") or "unknown",
            critic_verdict=critic.get("verdict"),
            critic_score=critic.get("score"),
            decision_log_id=critic.get("decision_log_id"),
            final_response=response,
            recommendations=response.get("recommendations"),
            rag_context=response.get("rag_context"),
            critic=critic,
            metadata_=meta,
            generated_at=self._parse_datetime(response.get("generated_at")),
        )
        self.db.add(run)
        self.db.commit()
        self.db.refresh(run)
        return run

    def list_runs(
        self,
        limit: int = 25,
        scenario: str | None = None,
        status: str | None = None,
        verdict: str | None = None,
    ) -> list[PlanningRun]:
        query = self.db.query(PlanningRun)
        if scenario:
            query = query.filter(PlanningRun.scenario == scenario)
        if status:
            query = query.filter(PlanningRun.status == status)
        if verdict:
            query = query.filter(PlanningRun.critic_verdict == verdict)
        return (
            query.order_by(PlanningRun.created_at.desc(), PlanningRun.id.desc())
            .limit(limit)
            .all()
        )

    def get_run(self, run_id: int) -> PlanningRun | None:
        return self.db.query(PlanningRun).filter(PlanningRun.id == run_id).first()

    def to_summary(self, run: PlanningRun) -> dict[str, Any]:
        return {
            "id": run.id,
            "scenario": run.scenario,
            "target_date": run.target_date,
            "status": run.status,
            "critic_verdict": run.critic_verdict,
            "critic_score": run.critic_score,
            "decision_log_id": run.decision_log_id,
            "generated_at": self._format_datetime(run.generated_at),
            "created_at": self._format_datetime(run.created_at),
        }

    def to_detail(self, run: PlanningRun) -> dict[str, Any]:
        return {
            **self.to_summary(run),
            "final_response": run.final_response,
            "recommendations": run.recommendations,
            "rag_context": run.rag_context,
            "critic": run.critic,
            "metadata": run.metadata_,
        }

    def _parse_datetime(self, value: Any) -> datetime | None:
        if not value:
            return None
        if isinstance(value, datetime):
            return value
        try:
            return datetime.fromisoformat(str(value).replace("Z", "+00:00")).replace(tzinfo=None)
        except ValueError:
            return None

    def _format_datetime(self, value: datetime | None) -> str | None:
        return value.isoformat() if value else None
