"""Planning routes for reusable multi-scenario orchestration."""

import json as _json
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import StreamingResponse

from sqlalchemy.orm import Session
from app.api.dependencies import get_current_user, get_db, get_orchestration_deps
from app.infrastructure.db.models import Organization, RestaurantProfile
from app.api.schemas.planning import (
    FridayRushRequest,
    FridayRushResponse,
    PlanningRunRequest,
    PlanningScenarioListResponse,
    WhatIfRequest,
    WhatIfResponse,
)
from app.core.exceptions import AppError
from app.domain.scenarios import list_scenarios
from app.domain.services.cost_aware_scoring import CostAwareScoringService
from app.domain.services.run_service import RunService
from app.infrastructure.cache.plan_cache import build_cache_key, cache_plan, get_cached_plan
from app.orchestration import run_friday_rush, run_planning_scenario, stream_planning_scenario

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
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> FridayRushResponse:
    # Cache is bypassed for simulation runs, forced critic decisions, and debug mode
    cacheable = (
        not body.simulation_mode
        and not body.force_critic_decision
        and not body.debug
    )

    if cacheable:
        cache_key = build_cache_key(
            org_id=current_user["org_id"],
            scenario=body.scenario,
            target_date=body.target_date,
        )
        cached = await get_cached_plan(cache_key)
        if cached:
            cached["cache_hit"] = True
            if "meta" in cached:
                cached["meta"]["total_cost_usd"] = 0.0
                cached["meta"]["cache_hit"] = True
            # Persist cache hits so every run appears in history
            try:
                run = RunService(deps["db"]).create_from_response(
                    cached,
                    org_id=current_user.get("org_id"),
                )
                cached["meta"]["planning_run_id"] = run.id
            except Exception:
                pass
            return FridayRushResponse(**cached)

    # Pull org settings so agents use tenant-configured capacity and hours
    org = db.query(Organization).filter(Organization.id == current_user["org_id"]).first()
    org_settings = org.settings or {} if org else {}
    org_capacity        = int(org_settings.get("capacity",         70))
    org_peak_hours      = str(org_settings.get("peak_hours",       "18:00-22:00"))
    org_critic_threshold = float(org_settings.get("critic_threshold", 0.7))

    # Resolve restaurant profile if provided — scoped to the caller's org
    restaurant_profile = None
    if body.restaurant_id:
        rp = db.query(RestaurantProfile).filter(
            RestaurantProfile.id == body.restaurant_id,
            RestaurantProfile.org_id == current_user["org_id"],
        ).first()
        if rp:
            restaurant_profile = {
                "id":         rp.id,
                "name":       rp.name,
                "cuisine":    rp.cuisine,
                "capacity":   rp.capacity,
                "peak_hours": rp.peak_hours,
                "timezone":   rp.timezone,
            }

    try:
        result = await run_planning_scenario(
            deps=deps,
            scenario=body.scenario,
            target_date=body.target_date,
            simulation_mode=body.simulation_mode,
            force_critic_decision=body.force_critic_decision,
            debug=body.debug,
            org_capacity=org_capacity,
            org_peak_hours=org_peak_hours,
            restaurant_profile=restaurant_profile,
            critic_threshold=org_critic_threshold,
            org_id=current_user["org_id"],
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
        run = RunService(deps["db"]).create_from_response(
            {**result, "meta": meta},
            org_id=current_user.get("org_id"),
        )
        meta.setdefault("planning_run_id", run.id)
    except Exception as exc:
        meta.setdefault("run_persistence_error", str(exc))

    response = _build_response(result, meta, body.scenario)
    response.cache_hit = False

    if cacheable and response.critic.verdict == "approved":
        await cache_plan(cache_key, response.model_dump())

    return response


@router.post(
    "/stream",
    summary="Run a planning scenario with SSE streaming",
    description=(
        "Identical request body to /run. Streams results node-by-node via Server-Sent Events. "
        "Emits 'node_complete' events as each agent finishes, then a 'complete' event with the full response."
    ),
)
async def stream_planning(
    body: PlanningRunRequest,
    deps: dict = Depends(get_orchestration_deps),
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> StreamingResponse:
    cacheable = (
        not body.simulation_mode
        and not body.force_critic_decision
        and not body.debug
    )

    org = db.query(Organization).filter(Organization.id == current_user["org_id"]).first()
    org_settings = org.settings or {} if org else {}
    org_capacity         = int(org_settings.get("capacity",         70))
    org_peak_hours       = str(org_settings.get("peak_hours",       "18:00-22:00"))
    org_critic_threshold = float(org_settings.get("critic_threshold", 0.7))

    restaurant_profile = None
    if body.restaurant_id:
        rp = db.query(RestaurantProfile).filter(
            RestaurantProfile.id == body.restaurant_id,
            RestaurantProfile.org_id == current_user["org_id"],
        ).first()
        if rp:
            restaurant_profile = {
                "id": rp.id, "name": rp.name, "cuisine": rp.cuisine,
                "capacity": rp.capacity, "peak_hours": rp.peak_hours, "timezone": rp.timezone,
            }

    cache_key = build_cache_key(
        org_id=current_user["org_id"],
        scenario=body.scenario,
        target_date=body.target_date,
    ) if cacheable else None

    def _sse(event: str, data: dict) -> str:
        return f"event: {event}\ndata: {_json.dumps(data)}\n\n"

    async def event_generator():
        # Cache hit — emit all nodes instantly, then the full response
        if cacheable and cache_key:
            cached = await get_cached_plan(cache_key)
            if cached:
                for node in ["forecast", "reservation", "complaint", "menu", "inventory", "aggregator", "critic"]:
                    yield _sse("node_complete", {"node": node, "cached": True})
                cached["cache_hit"] = True
                if "meta" in cached:
                    cached["meta"]["total_cost_usd"] = 0.0
                    cached["meta"]["cache_hit"] = True
                try:
                    run = RunService(deps["db"]).create_from_response(cached, org_id=current_user.get("org_id"))
                    cached["meta"]["planning_run_id"] = run.id
                except Exception:
                    pass
                yield _sse("complete", cached)
                return

        # Full streaming run
        try:
            async for evt in stream_planning_scenario(
                deps=deps,
                scenario=body.scenario,
                target_date=body.target_date,
                simulation_mode=body.simulation_mode,
                force_critic_decision=body.force_critic_decision,
                debug=body.debug,
                org_capacity=org_capacity,
                org_peak_hours=org_peak_hours,
                restaurant_profile=restaurant_profile,
                critic_threshold=org_critic_threshold,
                org_id=current_user["org_id"],
            ):
                if evt["event"] == "node_complete":
                    yield _sse("node_complete", {"node": evt["node"]})

                elif evt["event"] == "complete":
                    result = evt["response"]
                    meta = _decorate_meta(result, body, body.scenario)
                    try:
                        run = RunService(deps["db"]).create_from_response(
                            {**result, "meta": meta}, org_id=current_user.get("org_id")
                        )
                        meta.setdefault("planning_run_id", run.id)
                    except Exception as exc:
                        meta.setdefault("run_persistence_error", str(exc))

                    final_resp = _build_response(result, meta, body.scenario)
                    final_resp.cache_hit = False

                    if cacheable and cache_key and final_resp.critic.verdict == "approved":
                        await cache_plan(cache_key, final_resp.model_dump())

                    yield _sse("complete", final_resp.model_dump())

                elif evt["event"] == "error":
                    yield _sse("error", {"message": evt.get("message", "Unknown error")})

        except Exception as exc:
            yield _sse("error", {"message": f"Stream error: {exc}"})

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


@router.post(
    "/whatif",
    response_model=WhatIfResponse,
    summary="What-if demand simulator",
    description=(
        "Recalculates demand ratios and cost/benefit tradeoffs for a user-supplied cover count. "
        "No LLM calls — purely deterministic. Use to explore 'what if I expect X covers?' without a full run."
    ),
)
def whatif_planning(
    body: WhatIfRequest,
    current_user: dict = Depends(get_current_user),
) -> WhatIfResponse:
    bundle = {
        "agents": {
            "forecast": {
                "data": {
                    "predicted_orders":    body.predicted_covers,
                    "avg_friday_orders":   body.avg_covers,
                    "avg_same_day_orders": body.avg_covers,
                },
                "recommendation": {},
            },
            "reservation": {"data": {"occupancy_pct": 0, "waitlist_count": 0}, "recommendation": {}},
            "inventory":   {"data": {"shortage_alerts": [], "overstock_alerts": []}, "recommendation": {}},
            "menu":        {"recommendation": {}},
        }
    }

    result = CostAwareScoringService().evaluate_bundle(bundle)

    return WhatIfResponse(
        scenario=body.scenario,
        service_window=body.service_window,
        predicted_covers=body.predicted_covers,
        avg_covers=body.avg_covers,
        demand_ratio=result["signals"]["demand_ratio"],
        cost_pressure_score=result["cost_pressure_score"],
        benefit_score=result["benefit_score"],
        tradeoff_score=result["tradeoff_score"],
        pressure_components=result["pressure_components"],
        tradeoff_notes=result["tradeoff_notes"],
        recommended_focus=result["recommended_focus"],
    )


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
    current_user: dict = Depends(get_current_user),
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
        run = RunService(deps["db"]).create_from_response(
            {**result, "meta": meta}, org_id=current_user.get("org_id")
        )
        meta.setdefault("planning_run_id", run.id)
    except Exception as exc:
        meta.setdefault("run_persistence_error", str(exc))

    return _build_response(result, meta, "friday_rush")
