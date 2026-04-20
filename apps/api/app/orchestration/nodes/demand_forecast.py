"""
Demand Forecast Agent node.

Wraps ForecastService — runs the baseline demand forecast and
writes the result to `forecast_output` in shared state.

Enhanced for P1-10:
- Supports simulation mode
- Adds debug execution tracing
"""

from datetime import datetime
from sqlalchemy.orm import Session

from app.orchestration.state import OrchestratorState
from app.domain.services.forecast_service import ForecastService
from app.infrastructure.llm.base import BaseLLMProvider


def _parse_target_date(date_str: str | None) -> datetime | None:
    """Parse ISO date string or return None for default."""
    if date_str:
        return datetime.fromisoformat(date_str)
    return None


async def demand_forecast_node(
    state: OrchestratorState,
    db: Session,
    llm: BaseLLMProvider,
) -> OrchestratorState:
    """
    Predicts Friday demand and peak windows.
    Writes to state['forecast_output'].
    """
    if state.get("error"):
        return state

    # ── Debug tracing ───────────────────────────────────────────────────────
    if state.get("debug") and state.get("execution_trace") is not None:
        state["execution_trace"].append("demand_forecast")

    try:
        # ── P1-10: Simulation Mode ──────────────────────────────────────────
        if state.get("simulation_mode", False):
            target_date = state.get("target_date") or "next Friday"

            simulated_result = {
                "service": "forecast",
                "data": {
                    "predicted_covers": 180,
                    "peak_window": "19:00–21:00",
                    "confidence": 0.87,
                },
                "recommendation": {
                    "expected_demand": "High",
                    "staffing_level": "Increase staffing by 20%",
                    "prep_strategy": "Pre-prep high-demand menu items",
                },
                "target_date": target_date,
            }

            return {**state, "forecast_output": simulated_result}

        # ── Production Mode ─────────────────────────────────────────────────
        target_date = _parse_target_date(state.get("target_date"))
        service = ForecastService(db=db, llm=llm)
        result = await service.analyse_and_recommend(target_date=target_date)
        return {**state, "forecast_output": result}

    except Exception as exc:
        return {
            **state,
            "forecast_output": {
                "service": "forecast",
                "error": str(exc),
                "data": None,
                "recommendation": None,
            },
        }