"""Demand Forecast Agent node."""

import asyncio
from datetime import datetime

from sqlalchemy.orm import Session

from app.core.calendar_utils import get_date_context
from app.core.constants import DEFAULT_RESTAURANT_LAT, DEFAULT_RESTAURANT_LNG
from app.domain.services.forecast_service import ForecastService
from app.infrastructure.external.compliance_alerts_service import ComplianceAlertsService
from app.infrastructure.external.trends_service import TrendsService
from app.infrastructure.external.weather_service import WeatherService
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

    llm = (state.get("llm_registry") or {}).get("fast") or llm

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

        # Live-intelligence signals (P6-A21/A22/A23) — weather + holiday,
        # industry trends, regulatory alerts. None is Swiggy MCP, so no
        # consent/compliance gating applies. All independently fail open: any
        # one failing (or a missing target_date for weather/holiday) just
        # means no adjustment/context from it, the forecast still runs on
        # Prophet's raw output. Only weather actually shifts the predicted
        # number (_apply_signal_adjustments) -- trends/compliance are narrative
        # context for the LLM recommendation only. Fetched here (not deferred
        # to market_intel_node) so they're available even though this node
        # runs before the qdrant_enrichment fan-out; market_intel_node reads
        # them back from state rather than re-fetching (P6-A24).
        weather_signal = None
        is_holiday, holiday_name = False, None
        if target_date is not None:
            _, is_holiday, holiday_name = get_date_context(target_date.date().isoformat())
            weather_signal = await WeatherService().get_forecast(
                lat=DEFAULT_RESTAURANT_LAT,
                lng=DEFAULT_RESTAURANT_LNG,
                target_date=target_date.date(),
            )

        trends_signal, compliance_alerts_signal = await asyncio.gather(
            TrendsService().get_digest(),
            ComplianceAlertsService().get_alerts(),
        )

        service = ForecastService(db=db, llm=llm)
        result = await service.analyse_and_recommend(
            target_date=target_date,
            org_capacity=state.get("org_capacity"),
            weather_signal=weather_signal,
            is_holiday=is_holiday,
            holiday_name=holiday_name,
            trends_signal=trends_signal,
            compliance_alerts_signal=compliance_alerts_signal,
        )
        result.setdefault("data", {})
        result["data"]["service_window"] = scenario_profile.get("service_window", "18:00-22:00")
        result["data"]["scenario_label"] = scenario_profile.get("label", state.get("scenario"))
        return {
            **state,
            "forecast_output": result,
            "weather_signal": weather_signal,
            "trends_signal": trends_signal,
            "compliance_alerts_signal": compliance_alerts_signal,
        }

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
