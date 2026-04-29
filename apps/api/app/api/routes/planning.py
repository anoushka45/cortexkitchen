"""Planning routes for reusable multi-scenario orchestration."""

from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status

from app.api.dependencies import get_orchestration_deps
from app.api.schemas.planning import (
    FridayRushRequest,
    FridayRushResponse,
    PlanningRunRequest,
    PlanningScenarioListResponse,
)
from app.core.exceptions import AppError
from app.domain.scenarios import list_scenarios
from app.domain.services.run_service import RunService
from app.orchestration import run_friday_rush, run_planning_scenario

router = APIRouter(prefix="/planning", tags=["planning"])


@router.get(
    "/scenarios",
    response_model=PlanningScenarioListResponse,
    summary="List supported planning scenarios",
)
def get_scenarios() -> PlanningScenarioListResponse:
    return PlanningScenarioListResponse(scenarios=list_scenarios())


def _build_response(result: dict, meta: dict, fallback_scenario: str) -> FridayRushResponse:
    return FridayRushResponse(
        scenario=result.get("scenario", fallback_scenario),
        target_date=result.get("target_date"),
        status=result.get("status", "unknown"),
        generated_at=result.get("generated_at", ""),
        recommendations=result.get("recommendations", {}),
        rag_context=result.get("rag_context"),
        critic=result.get(
            "critic",
            {
                "verdict": "unknown",
                "score": 0.0,
                "notes": "No critic output available.",
                "decision_log_id": None,
            },
        ),
        meta=meta,
    )


def _decorate_meta(result: dict, body, scenario: str) -> dict:
    meta = result.get("meta", {})
    meta.setdefault("timestamp", datetime.now(timezone.utc).isoformat())
    meta.setdefault("scenario", scenario)
    if body.debug:
        meta.setdefault("debug", True)
        meta.setdefault("simulation_mode", body.simulation_mode)
        meta.setdefault("forced_critic_decision", body.force_critic_decision)
    return meta


@router.post(
    "/run",
    response_model=FridayRushResponse,
    summary="Run a planning scenario",
    description=(
        "Triggers the shared multi-agent orchestration for a selected scenario preset. "
        "Supports Friday rush, weekday lunch, holiday spike, and low-stock weekend framing."
    ),
)
async def run_planning(
    body: PlanningRunRequest,
    deps: dict = Depends(get_orchestration_deps),
) -> FridayRushResponse:
    try:
        result = await run_planning_scenario(
            deps=deps,
            scenario=body.scenario,
            target_date=body.target_date,
            simulation_mode=body.simulation_mode,
            force_critic_decision=body.force_critic_decision,
            debug=body.debug,
        )
    except AppError:
        raise
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Orchestration failed: {exc}",
        )

    if not result:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Orchestration returned an empty response.",
        )

    meta = _decorate_meta(result, body, body.scenario)
    try:
        run = RunService(deps["db"]).create_from_response({**result, "meta": meta})
        meta.setdefault("planning_run_id", run.id)
    except Exception as exc:
        meta.setdefault("run_persistence_error", str(exc))

    return _build_response(result, meta, body.scenario)


@router.post(
    "/friday-rush",
    response_model=FridayRushResponse,
    summary="Run Friday Rush planning",
    description=(
        "Triggers the full multi-agent orchestration for the Friday Night Rush scenario. "
        "This route is kept for backward compatibility; new scenario-aware clients should use /planning/run."
    ),
)
async def friday_rush(
    body: FridayRushRequest,
    deps: dict = Depends(get_orchestration_deps),
) -> FridayRushResponse:
    try:
        result = await run_friday_rush(
            deps=deps,
            target_date=body.target_date,
            simulation_mode=body.simulation_mode,
            force_critic_decision=body.force_critic_decision,
            debug=body.debug,
        )
    except AppError:
        raise
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Orchestration failed: {exc}",
        )

    if not result:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Orchestration returned an empty response.",
        )

    meta = _decorate_meta(result, body, "friday_rush")
    try:
        run = RunService(deps["db"]).create_from_response({**result, "meta": meta})
        meta.setdefault("planning_run_id", run.id)
    except Exception as exc:
        meta.setdefault("run_persistence_error", str(exc))

    return _build_response(result, meta, "friday_rush")
