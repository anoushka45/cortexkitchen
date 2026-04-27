"""
Planning routes — Friday Rush scenario endpoint.

POST /api/v1/planning/friday-rush
    Runs the full multi-agent LangGraph for the Friday Rush scenario
    and returns a validated recommendation bundle.
"""

from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status

from app.api.dependencies import get_orchestration_deps
from app.api.schemas.planning import FridayRushRequest, FridayRushResponse
from app.core.exceptions import AppError
from app.domain.services.run_service import RunService
from app.orchestration import run_friday_rush

router = APIRouter(prefix="/planning", tags=["planning"])


@router.post(
    "/friday-rush",
    response_model=FridayRushResponse,
    summary="Run Friday Rush planning",
    description=(
        "Triggers the full multi-agent orchestration for the Friday Night Rush scenario. "
        "Runs demand forecasting, reservation analysis, complaint intelligence, menu and "
        "inventory checks, aggregates results, validates via the Critic Agent, and returns "
        "a structured recommendation bundle. Every run is logged to the decision_log table."
    ),
)
async def friday_rush(
    body: FridayRushRequest,
    deps: dict = Depends(get_orchestration_deps),
) -> FridayRushResponse:
    """
    End-to-end Friday Rush planning endpoint.

    Enhancements for P1-10:
    - Accepts optional simulation and debugging parameters.
    - Enables critic override for deterministic testing.
    - Supports multi-date simulations beyond Fridays.
    - Provides observability into LangGraph execution.

    Behavior:
    - Defaults to the next Friday if target_date is not provided.
    - Returns HTTP 200 even when the critic verdict is 'revision' or 'blocked'.
    - Returns HTTP 500 only on unexpected orchestration failure.
    """
    try:
        result = await run_friday_rush(
            deps=deps,
            target_date=body.target_date,
            simulation_mode=body.simulation_mode,
            force_critic_decision=body.force_critic_decision,
            debug=body.debug,
        )
    except AppError:
        # Handled globally in main.py
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

    # Populate metadata when debug mode is enabled
    meta = result.get("meta", {})
    meta.setdefault("timestamp", datetime.now(timezone.utc).isoformat())
    if body.debug:
        meta.setdefault("debug", True)
        meta.setdefault("simulation_mode", body.simulation_mode)
        meta.setdefault(
            "forced_critic_decision", body.force_critic_decision
        )

    try:
        run = RunService(deps["db"]).create_from_response({**result, "meta": meta})
        meta.setdefault("planning_run_id", run.id)
    except Exception as exc:
        meta.setdefault("run_persistence_error", str(exc))

    # Shape the flat result dict into the typed response model
    return FridayRushResponse(
        scenario=result.get("scenario", "friday_rush"),
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
