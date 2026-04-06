"""
Demand Forecast Agent node.

Wraps ForecastService — runs the baseline demand forecast and
writes the result to `forecast_output` in shared state.
"""

from sqlalchemy.orm import Session

from app.orchestration.state import OrchestratorState
from app.domain.services.forecast_service import ForecastService
from app.infrastructure.llm.base import BaseLLMProvider


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
        return state  # Short-circuit on upstream error

    try:
        service = ForecastService(db=db, llm=llm)
        result = await service.analyse_and_recommend()
        return {**state, "forecast_output": result}

    except Exception as exc:
        # Soft failure: log the error but allow the graph to continue.
        # Other agents can still run; the aggregator will note the gap.
        return {
            **state,
            "forecast_output": {
                "service": "forecast",
                "error": str(exc),
                "data": None,
                "recommendation": None,
            },
        }