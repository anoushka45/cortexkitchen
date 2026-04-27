"""Demand Forecast Agent node."""

from datetime import datetime

from sqlalchemy.orm import Session

from app.domain.services.forecast_service import ForecastService
from app.infrastructure.llm.base import BaseLLMProvider
from app.orchestration.state import OrchestratorState


def _parse_target_date(date_str: str | None) -> datetime | None:
    if date_str:
        return datetime.fromisoformat(date_str)
    return None


async def demand_forecast_node(
    state: OrchestratorState,
    db: Session,
    llm: BaseLLMProvider,
) -> OrchestratorState:
    """Predict demand and peak windows for the selected planning scenario."""
    if state.get("error"):
        return state

    if state.get("debug") and state.get("execution_trace") is not None:
        state["execution_trace"].append("demand_forecast")

    try:
        scenario_profile = state.get("scenario_profile") or {}

        if state.get("simulation_mode", False):
            target_date = state.get("target_date") or "next planning window"
            simulated_result = {
                "service": "forecast",
                "data": {
                    "predicted_covers": 180,
                    "peak_window": scenario_profile.get("service_window", "18:00-22:00"),
                    "confidence": 0.87,
                    "service_day_label": scenario_profile.get("label", "Friday Rush"),
                    "service_window": scenario_profile.get("service_window", "18:00-22:00"),
                },
                "recommendation": {
                    "expected_demand": "High",
                    "staffing_level": "Increase staffing by 20%",
                    "prep_strategy": "Pre-prep high-demand menu items",
                },
                "target_date": target_date,
            }
            return {**state, "forecast_output": simulated_result}

        target_date = _parse_target_date(state.get("target_date"))
        service = ForecastService(db=db, llm=llm)
        result = await service.analyse_and_recommend(target_date=target_date)
        result.setdefault("data", {})
        result["data"]["service_window"] = scenario_profile.get("service_window", "18:00-22:00")
        result["data"]["scenario_label"] = scenario_profile.get("label", state.get("scenario"))
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
