from __future__ import annotations

from typing import Any

from app.orchestration.state import OrchestrationState


async def ops_manager_node(state: OrchestrationState) -> OrchestrationState:
    """
    Entry node for the graph.
    Right now it only marks the workflow as started.
    Later this can become the real router / planner node.
    """
    return {
        **state,
        "current_step": "ops_manager",
        "status": "pending",
        "errors": state.get("errors", []),
    }


async def reservation_node(
    state: OrchestrationState,
    reservation_service: Any,
) -> OrchestrationState:
    try:
        result = await reservation_service.analyse_and_recommend(state["target_date"])
        return {
            **state,
            "current_step": "reservation",
            "reservation_result": result,
        }
    except Exception as exc:
        errors = state.get("errors", [])
        errors.append(f"reservation_node failed: {str(exc)}")
        return {
            **state,
            "current_step": "reservation",
            "errors": errors,
            "status": "failed",
        }


async def forecast_node(
    state: OrchestrationState,
    forecast_service: Any,
) -> OrchestrationState:
    try:
        result = await forecast_service.analyse_and_recommend()
        return {
            **state,
            "current_step": "forecast",
            "forecast_result": result,
        }
    except Exception as exc:
        errors = state.get("errors", [])
        errors.append(f"forecast_node failed: {str(exc)}")
        return {
            **state,
            "current_step": "forecast",
            "errors": errors,
            "status": "failed",
        }


async def complaint_node(
    state: OrchestrationState,
    complaint_service: Any,
) -> OrchestrationState:
    try:
        result = await complaint_service.analyse_and_recommend()
        return {
            **state,
            "current_step": "complaint",
            "complaint_result": result,
        }
    except Exception as exc:
        errors = state.get("errors", [])
        errors.append(f"complaint_node failed: {str(exc)}")
        return {
            **state,
            "current_step": "complaint",
            "errors": errors,
            "status": "failed",
        }


async def critic_node(
    state: OrchestrationState,
    critic_service: Any,
) -> OrchestrationState:
    try:
        recommendation_bundle = {
            "reservation": state.get("reservation_result"),
            "forecast": state.get("forecast_result"),
            "complaint": state.get("complaint_result"),
        }

        result = await critic_service.evaluate(
            agent="ops_manager",
            recommendation=recommendation_bundle,
            input_summary=f"Friday planning workflow for {state['target_date'].date()}",
        )

        return {
            **state,
            "current_step": "critic",
            "critic_result": result,
        }
    except Exception as exc:
        errors = state.get("errors", [])
        errors.append(f"critic_node failed: {str(exc)}")
        return {
            **state,
            "current_step": "critic",
            "errors": errors,
            "status": "failed",
        }


async def final_response_node(state: OrchestrationState) -> OrchestrationState:
    final_output = {
        "scenario": state.get("scenario", "friday_rush_planning"),
        "target_date": state["target_date"].isoformat(),
        "reservation": state.get("reservation_result"),
        "forecast": state.get("forecast_result"),
        "complaints": state.get("complaint_result"),
        "critic": state.get("critic_result"),
        "errors": state.get("errors", []),
        "status": "failed" if state.get("errors") else "success",
    }

    return {
        **state,
        "current_step": "final_response",
        "final_output": final_output,
        "status": "failed" if state.get("errors") else "success",
    }