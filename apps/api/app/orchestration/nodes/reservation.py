"""
Reservation Agent node.

Wraps ReservationService — analyses table capacity and booking pressure
for the target Friday, then writes to `reservation_output`.
"""

from datetime import datetime
from sqlalchemy.orm import Session

from app.orchestration.state import OrchestratorState
from app.domain.services.reservation_service import ReservationService
from app.infrastructure.llm.base import BaseLLMProvider


def _parse_target_date(date_str: str | None) -> datetime:
    """Parse ISO date string or fall back to the next Friday."""
    if date_str:
        return datetime.fromisoformat(date_str)

    # Default: roll forward to the next Friday
    today = datetime.utcnow()
    days_ahead = (4 - today.weekday()) % 7 or 7  # weekday 4 = Friday
    return today.replace(hour=0, minute=0, second=0, microsecond=0)


async def reservation_node(
    state: OrchestratorState,
    db: Session,
    llm: BaseLLMProvider,
) -> OrchestratorState:
    """
    Analyses reservations and capacity risk for the target date.
    Writes to state['reservation_output'].
    """
    if state.get("error"):
        return state

    try:
        target_date = _parse_target_date(state.get("target_date"))
        service = ReservationService(db=db, llm=llm)
        result = await service.analyse_and_recommend(target_date=target_date)
        return {**state, "reservation_output": result}

    except Exception as exc:
        return {
            **state,
            "reservation_output": {
                "service": "reservation",
                "error": str(exc),
                "data": None,
                "recommendation": None,
            },
        }