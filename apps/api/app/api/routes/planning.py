"""
Planning routes — Friday Rush scenario endpoint.

POST /api/v1/planning/friday-rush
    Runs the full multi-agent LangGraph for the Friday Rush scenario
    and returns a validated recommendation bundle.
"""

from fastapi import APIRouter, Depends, HTTPException, status

from app.api.dependencies import get_orchestration_deps
from app.api.schemas.planning import FridayRushRequest, FridayRushResponse
from app.core.exceptions import AppError
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

    - Accepts an optional target_date (ISO string). Defaults to next Friday.
    - Returns per-agent recommendations, RAG context, and critic verdict.
    - HTTP 200 even when critic verdict is 'revision' or 'blocked' — the
      status field in the response body communicates the outcome.
    - HTTP 500 only on unexpected orchestration failure.
    """
    try:
        result = await run_friday_rush(
            deps=deps,
            target_date=body.target_date,
        )
    except AppError:
        raise  # Let the global AppError handler in main.py handle it
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

    # Shape the flat result dict into the typed response model
    return FridayRushResponse(
        scenario=result.get("scenario", "friday_rush"),
        target_date=result.get("target_date"),
        status=result.get("status", "unknown"),
        generated_at=result.get("generated_at", ""),
        recommendations=result.get("recommendations", {}),
        rag_context=result.get("rag_context"),
        critic=result.get("critic", {}),
    )