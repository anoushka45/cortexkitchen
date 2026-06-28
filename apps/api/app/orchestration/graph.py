"""
CortexKitchen LangGraph orchestration graph.

Enhanced for P1-10:
- Supports simulation mode for deterministic testing
- Enables critic override for validation scenarios
- Adds debug observability for LangGraph state inspection
- Maintains backward compatibility with existing workflows
"""

import functools
import os
import time
import uuid

import sentry_sdk
from collections.abc import AsyncGenerator
from datetime import datetime, timezone
from typing import Any

import structlog
from langchain_core.runnables import RunnableConfig
from langgraph.graph import StateGraph, END

from app.orchestration.state import OrchestratorState, make_initial_state
from app.orchestration.nodes import (
    ops_manager_node,
    demand_forecast_node,
    reservation_node,
    complaint_intelligence_node,
    menu_intelligence_node,
    inventory_node,
    aggregator_node,
    critic_node,
    final_assembler_node,
    qdrant_enrichment_node,
    replan_orchestrator_node,
)


def phase1_sync_node(state):
    """Barrier — collects outputs from reservation, complaint_intelligence, and inventory,
    then unblocks menu_intelligence. Ensures aggregator fires exactly once (not twice)
    by making all parallel paths the same hop-length before menu."""
    return state


# ── Node name constants ──────────────────────────────────────────────────────

OPS_MANAGER = "ops_manager"
DEMAND_FORECAST = "demand_forecast"
QDRANT_ENRICHMENT = "qdrant_enrichment"
RESERVATION = "reservation"
COMPLAINT_INTELLIGENCE = "complaint_intelligence"
INVENTORY = "inventory"
PHASE1_SYNC = "phase1_sync"
MENU_INTELLIGENCE = "menu_intelligence"
AGGREGATOR = "aggregator"
CRITIC = "critic"
REPLAN_ORCHESTRATOR = "replan_orchestrator"
FINAL_ASSEMBLER = "final_assembler"


def _llm_log_fields(llm: Any | None) -> dict:
    if llm is None:
        return {}

    fields = {}
    provider_used = getattr(llm, "last_provider_used", None)
    if provider_used:
        fields["llm_provider_used"] = provider_used
        fields["llm_fallback_used"] = bool(getattr(llm, "last_fallback_used", False))

    metadata = getattr(llm, "provider_metadata", None)
    if isinstance(metadata, dict):
        fields.update(metadata)

    return fields


# ── Dependency injection helper ──────────────────────────────────────────────

def _inject(node_fn, traces: list, **deps):
    """Wrap async node functions with dep injection, structlog tracing, and timing."""
    @functools.wraps(node_fn)
    async def _wrapped(state: OrchestratorState) -> OrchestratorState:
        log = structlog.get_logger()
        node = node_fn.__name__.replace("_node", "")
        started_at = datetime.now(timezone.utc).isoformat()
        t0 = time.perf_counter()
        log.info("node_start", node=node)

        # All providers this node might write to (default llm + any tier providers)
        llm_dep = deps.get("llm")
        registry_providers = list((state.get("llm_registry") or {}).values())
        all_providers = [p for p in [llm_dep] + registry_providers if p is not None]
        for p in all_providers:
            p.drain_usage()  # clear slate so only this node's calls are captured

        try:
            result = await node_fn(state, **deps)
            duration_ms = round((time.perf_counter() - t0) * 1000, 2)

            node_usage = []
            for p in all_providers:
                node_usage.extend(p.drain_usage())
            node_cost_usd = round(sum(u.get("cost_usd", 0) for u in node_usage), 6)

            log.info("node_end", node=node, duration_ms=duration_ms, **_llm_log_fields(deps.get("llm")))
            traces.append({
                "node": node,
                "started_at": started_at,
                "ended_at": datetime.now(timezone.utc).isoformat(),
                "duration_ms": duration_ms,
                "llm_usage": node_usage,
                "node_cost_usd": node_cost_usd,
            })
            return result
        except Exception as exc:
            duration_ms = round((time.perf_counter() - t0) * 1000, 2)

            node_usage = []
            for p in all_providers:
                node_usage.extend(p.drain_usage())
            node_cost_usd = round(sum(u.get("cost_usd", 0) for u in node_usage), 6)

            log.error(
                "node_error",
                node=node,
                duration_ms=duration_ms,
                error=str(exc),
                **_llm_log_fields(deps.get("llm")),
            )
            traces.append({
                "node": node,
                "started_at": started_at,
                "ended_at": datetime.now(timezone.utc).isoformat(),
                "duration_ms": duration_ms,
                "error": str(exc),
                "llm_usage": node_usage,
                "node_cost_usd": node_cost_usd,
            })
            with sentry_sdk.new_scope() as scope:
                scope.set_tag("langgraph.node", node)
                scope.set_extra("duration_ms", duration_ms)
                sentry_sdk.capture_exception(exc)
            raise
    return _wrapped


def _inject_sync(node_fn, traces: list, **deps):
    """Wrap sync node functions with dep injection, structlog tracing, and timing."""
    @functools.wraps(node_fn)
    def _wrapped(state: OrchestratorState) -> OrchestratorState:
        log = structlog.get_logger()
        node = node_fn.__name__.replace("_node", "")
        started_at = datetime.now(timezone.utc).isoformat()
        t0 = time.perf_counter()
        log.info("node_start", node=node)
        result = node_fn(state, **deps)
        duration_ms = round((time.perf_counter() - t0) * 1000, 2)
        log.info("node_end", node=node, duration_ms=duration_ms)
        traces.append({"node": node, "started_at": started_at,
                       "ended_at": datetime.now(timezone.utc).isoformat(),
                       "duration_ms": duration_ms})
        return result
    return _wrapped


def _log_node(node_fn, traces: list):
    """Wrap plain (no-dep) nodes with structlog tracing and timing."""
    @functools.wraps(node_fn)
    def _wrapped(state: OrchestratorState) -> OrchestratorState:
        log = structlog.get_logger()
        node = node_fn.__name__.replace("_node", "")
        started_at = datetime.now(timezone.utc).isoformat()
        t0 = time.perf_counter()
        log.info("node_start", node=node)
        result = node_fn(state)
        duration_ms = round((time.perf_counter() - t0) * 1000, 2)
        log.info("node_end", node=node, duration_ms=duration_ms)
        traces.append({"node": node, "started_at": started_at,
                       "ended_at": datetime.now(timezone.utc).isoformat(),
                       "duration_ms": duration_ms})
        return result
    return _wrapped


# ── Conditional edges ────────────────────────────────────────────────────────

def _route_after_ops_manager(state: OrchestratorState) -> str:
    if state.get("error"):
        return FINAL_ASSEMBLER
    return DEMAND_FORECAST


def _route_after_critic(state: OrchestratorState) -> str:
    """
    Replanning loop: if verdict is not 'approved' and we haven't exhausted
    retries (max 2), route back through replan_orchestrator → aggregator → critic.
    Otherwise proceed to final_assembler.
    """
    critic_out   = state.get("critic_output") or {}
    verdict      = critic_out.get("verdict", "revision")
    replan_count = state.get("replan_count") or 0

    if verdict == "approved" or replan_count >= 2:
        return FINAL_ASSEMBLER
    return REPLAN_ORCHESTRATOR


# ── Graph factory ────────────────────────────────────────────────────────────

def build_graph(deps: dict[str, Any], traces: list | None = None):
    """
    Build and compile the CortexKitchen LangGraph.

    Args:
        deps: Infrastructure dependencies:
            - db       : SQLAlchemy Session
            - llm      : BaseLLMProvider instance
            - memory   : MemoryService instance (optional)

    Returns:
        Compiled LangGraph runnable.
    """
    db              = deps["db"]
    llm             = deps["llm"]
    memory          = deps.get("memory")
    planning_memory = deps.get("planning_memory")
    tr              = traces if traces is not None else []

    graph = StateGraph(OrchestratorState)

    # ── Register nodes ───────────────────────────────────────────────────────

    graph.add_node(OPS_MANAGER, _log_node(ops_manager_node, tr))

    graph.add_node(DEMAND_FORECAST,        _inject(demand_forecast_node,        tr, db=db, llm=llm))
    graph.add_node(QDRANT_ENRICHMENT,      _inject(qdrant_enrichment_node,      tr, memory=memory, planning_memory=planning_memory))
    graph.add_node(RESERVATION,            _inject(reservation_node,            tr, db=db, llm=llm))
    graph.add_node(COMPLAINT_INTELLIGENCE, _inject(complaint_intelligence_node, tr, db=db, llm=llm, memory=memory))
    graph.add_node(INVENTORY,              _inject(inventory_node,              tr, db=db, llm=llm))
    graph.add_node(PHASE1_SYNC,            _log_node(phase1_sync_node,         tr))
    graph.add_node(MENU_INTELLIGENCE,      _inject(menu_intelligence_node,      tr, db=db, llm=llm))

    graph.add_node(AGGREGATOR,          _log_node(aggregator_node,          tr))
    graph.add_node(CRITIC,              _inject(critic_node,                 tr, db=db, llm=llm))
    graph.add_node(REPLAN_ORCHESTRATOR, _log_node(replan_orchestrator_node, tr))
    graph.add_node(FINAL_ASSEMBLER,     _log_node(final_assembler_node,     tr))

    # ── Wire edges ───────────────────────────────────────────────────────────

    graph.set_entry_point(OPS_MANAGER)

    graph.add_conditional_edges(
        OPS_MANAGER,
        _route_after_ops_manager,
        {
            DEMAND_FORECAST: DEMAND_FORECAST,
            FINAL_ASSEMBLER: FINAL_ASSEMBLER,
        },
    )

    # Qdrant pre-enrichment before parallel fan-out
    graph.add_edge(DEMAND_FORECAST, QDRANT_ENRICHMENT)

    # Full parallel fan-out: reservation, complaint, inventory run together
    graph.add_edge(QDRANT_ENRICHMENT, RESERVATION)
    graph.add_edge(QDRANT_ENRICHMENT, COMPLAINT_INTELLIGENCE)
    graph.add_edge(QDRANT_ENRICHMENT, INVENTORY)

    # Phase1 barrier — all three parallel agents must complete before menu starts.
    # This equalises hop-counts so aggregator fires exactly once (not twice).
    graph.add_edge(RESERVATION,            PHASE1_SYNC)
    graph.add_edge(COMPLAINT_INTELLIGENCE, PHASE1_SYNC)
    graph.add_edge(INVENTORY,              PHASE1_SYNC)

    # Menu runs after all parallel agents are done (reads inventory shortage list)
    graph.add_edge(PHASE1_SYNC, MENU_INTELLIGENCE)

    # Single fan-in: aggregator fires exactly once, after menu
    graph.add_edge(MENU_INTELLIGENCE, AGGREGATOR)

    # Aggregator → Critic → conditional replanning loop
    graph.add_edge(AGGREGATOR, CRITIC)
    graph.add_conditional_edges(
        CRITIC,
        _route_after_critic,
        {
            FINAL_ASSEMBLER:     FINAL_ASSEMBLER,
            REPLAN_ORCHESTRATOR: REPLAN_ORCHESTRATOR,
        },
    )

    # Replan loop: orchestrator injects context → re-aggregate → re-evaluate
    graph.add_edge(REPLAN_ORCHESTRATOR, AGGREGATOR)
    graph.add_edge(FINAL_ASSEMBLER, END)

    return graph.compile()


# ── Convenience runner ───────────────────────────────────────────────────────

async def run_friday_rush(
    deps: dict[str, Any],
    target_date: str | None = None,
    simulation_mode: bool = False,
    force_critic_decision: str | None = None,
    debug: bool = False,
) -> dict:
    return await run_planning_scenario(
        deps=deps,
        scenario="friday_rush",
        target_date=target_date,
        simulation_mode=simulation_mode,
        force_critic_decision=force_critic_decision,
        debug=debug,
    )


async def run_planning_scenario(
    deps: dict[str, Any],
    scenario: str,
    target_date: str | None = None,
    simulation_mode: bool = False,
    force_critic_decision: str | None = None,
    debug: bool = False,
    org_capacity: int = 70,
    org_peak_hours: str = "18:00-22:00",
    restaurant_profile: dict | None = None,
    critic_threshold: float = 0.7,
    org_id: int | None = None,
) -> dict:
    """
    Top-level convenience function for a named planning scenario.

    Args:
        deps: Infrastructure dependencies.
        scenario: Scenario id from the scenario registry.
        target_date: Optional ISO date string.
        simulation_mode: Enables deterministic simulation.
        force_critic_decision: Overrides critic verdict for testing.
        debug: Enables observability and state tracing.

    Returns:
        Final API-ready response from the LangGraph workflow.
    """
    # ── Semantic cache check (Qdrant, similarity >= 0.92) ───────────────────
    semantic_cache = deps.get("semantic_cache")
    if semantic_cache and org_id and not simulation_mode and not force_critic_decision and not debug:
        try:
            cached = semantic_cache.get(org_id, scenario, target_date)
            if cached is not None:
                structlog.get_logger().info(
                    "semantic_cache_hit", scenario=scenario, org_id=org_id
                )
                return cached
        except Exception:
            pass

    # Shared list — every node wrapper appends its timing record here
    traces: list[dict] = []
    graph = build_graph(deps, traces=traces)

    # Bind run_id + scenario to structlog context — propagates into every node log
    run_id = uuid.uuid4().hex[:8]
    structlog.contextvars.clear_contextvars()
    structlog.contextvars.bind_contextvars(run_id=run_id, scenario=scenario)
    log = structlog.get_logger()

    # Restaurant profile overrides org-level capacity/peak_hours when supplied
    effective_capacity   = restaurant_profile["capacity"]   if restaurant_profile else org_capacity
    effective_peak_hours = restaurant_profile["peak_hours"] if restaurant_profile else org_peak_hours

    # Create initial state with P1-10 enhancements
    initial_state = make_initial_state(
        scenario=scenario,
        target_date=target_date,
        simulation_mode=simulation_mode,
        force_critic_decision=force_critic_decision,
        debug=debug,
        restaurant_profile=restaurant_profile,
    )

    # Inject P1-10 testing flags
    initial_state["simulation_mode"] = simulation_mode
    initial_state["force_critic_decision"] = force_critic_decision
    initial_state["debug"] = debug
    initial_state["org_id"] = org_id
    initial_state["org_capacity"] = effective_capacity
    initial_state["org_peak_hours"] = effective_peak_hours
    initial_state["critic_threshold"] = critic_threshold

    # Initialize debug trace container
    if debug:
        initial_state["execution_trace"] = []

    # Inject tier registry into state when tiered comet mode is active
    if deps.get("llm_registry"):
        initial_state["llm_registry"] = deps["llm_registry"]

    # Execute graph with LangSmith trace metadata
    run_label = f"{scenario}/{target_date or 'next'}"
    llm_metadata = _llm_log_fields(deps.get("llm"))
    config = RunnableConfig(
        run_name=f"cortexkitchen/{run_label}",
        tags=[scenario, "planning_run"],
        metadata={"scenario": scenario, "target_date": target_date or "", "run_id": run_id, **llm_metadata},
    )
    t0 = time.perf_counter()
    log.info("graph_start", target_date=target_date or "next", **llm_metadata)
    final_state = await graph.ainvoke(initial_state, config=config)
    total_duration_ms = round((time.perf_counter() - t0) * 1000, 2)

    # Collect usage captured per-node by _inject, then drain any remainder
    llm_usage = []
    for trace in traces:
        llm_usage.extend(trace.get("llm_usage") or [])
    llm_usage.extend(deps["llm"].drain_usage())
    for tier_llm in deps.get("llm_registry", {}).values():
        llm_usage.extend(tier_llm.drain_usage())
    total_cost_usd  = round(sum(u.get("cost_usd", 0)  for u in llm_usage), 6)
    total_tokens    = sum(u.get("prompt_tokens", 0) + u.get("completion_tokens", 0) for u in llm_usage)

    llm_metadata = _llm_log_fields(deps.get("llm"))
    log.info("graph_end", duration_ms=total_duration_ms,
             total_tokens=total_tokens, total_cost_usd=total_cost_usd, **llm_metadata)

    # Attach observability data to the final response meta so RunService persists it
    final_response = final_state.get("final_response", {})
    obs = {
        "run_id": run_id,
        "node_traces": traces,
        "llm_usage": llm_usage,
        "total_duration_ms": total_duration_ms,
        "total_tokens": total_tokens,
        "total_cost_usd": total_cost_usd,
        **llm_metadata,
    }
    final_response.setdefault("meta", {}).update(obs)
    final_state = {**final_state, "final_response": final_response}

    # Append debug metadata
    final_response = final_state.get("final_response", {})

    if debug:
        meta = final_response.setdefault("meta", {})
        meta.update(
            {
                "debug": True,
                "simulation_mode": simulation_mode,
                "forced_critic_decision": force_critic_decision,
                "execution_trace": final_state.get("execution_trace", []),
                "replan_count": final_state.get("replan_count", 0),
            }
        )

    # ── Persist results ───────────────────────────────────────────────────────
    verdict = (final_response.get("critic") or {}).get("verdict", "")

    # Semantic cache — store regardless of verdict (serves any future similar query)
    if semantic_cache and org_id and not simulation_mode and not force_critic_decision:
        try:
            semantic_cache.set(org_id, scenario, target_date, final_response)
        except Exception:
            pass

    # Planning memory — store only approved runs so insights represent validated patterns
    planning_memory = deps.get("planning_memory")
    if planning_memory and org_id and verdict == "approved" and not simulation_mode:
        try:
            run_id = final_response.get("meta", {}).get("planning_run_id")
            planning_memory.store(org_id, scenario, run_id, final_response)
        except Exception:
            pass

    return final_response


# ── SSE node names → state field mapping ─────────────────────────────────────
_NODE_SSE_MAP: dict[str, str] = {
    "demand_forecast":        "forecast",
    "qdrant_enrichment":      "enrichment",
    "reservation":            "reservation",
    "complaint_intelligence": "complaint",
    "menu_intelligence":      "menu",
    "inventory":              "inventory",
    "aggregator":             "aggregator",
    "critic":                 "critic",
    "replan_orchestrator":    "replan",
}

_NODE_OUTPUT_FIELD: dict[str, str] = {
    "forecast":    "forecast_output",
    "reservation": "reservation_output",
    "complaint":   "complaint_output",
    "menu":        "menu_output",
    "inventory":   "inventory_output",
    "aggregator":  "aggregated_recommendation",
    "critic":      "critic_output",
}

# Human-readable hints emitted when a node STARTS — shown in the loading pipeline
_NODE_START_HINTS: dict[str, str] = {
    "demand_forecast":        "Running Prophet model on 90 days of order history…",
    "qdrant_enrichment":      "Searching Qdrant memory for relevant SOPs and past incidents…",
    "reservation":            "Querying confirmed bookings and mapping peak-hour pressure…",
    "complaint_intelligence": "Analysing 28 days of guest feedback with RAG retrieval…",
    "inventory":              "Cross-referencing all ingredients against the demand forecast…",
    "menu_intelligence":      "Applying inventory constraints to build menu guidance…",
    "aggregator":             "Synthesising all agent outputs into one consolidated brief…",
    "critic":                 "Scoring the plan — safety · feasibility · evidence · actionability · clarity…",
    "replan_orchestrator":    "Critic flagged issues — injecting corrective context for retry…",
}


def _completion_hint(node_name: str, state_update: dict) -> str:
    """Extract a brief human-readable hint from a node's completed state update."""
    try:
        if node_name == "demand_forecast":
            data = (state_update.get("forecast_output") or {}).get("data") or {}
            pred = data.get("predicted_orders") or data.get("predicted_covers")
            method = data.get("method", "")
            return f"{method} model: {round(float(pred))} predicted orders" if pred else "Forecast complete"

        if node_name == "qdrant_enrichment":
            ctx   = state_update.get("shared_context") or {}
            n_c   = len(ctx.get("complaints", []))
            n_s   = len(ctx.get("sops", []))
            n_p   = len(ctx.get("past_plans", []))
            parts = []
            if n_c:  parts.append(f"{n_c} complaint{'s' if n_c != 1 else ''}")
            if n_s:  parts.append(f"{n_s} SOP{'s' if n_s != 1 else ''}")
            if n_p:  parts.append(f"{n_p} past plan{'s' if n_p != 1 else ''}")
            return f"Memory loaded: {', '.join(parts)}" if parts else "Context loaded from memory"

        if node_name == "reservation":
            data = (state_update.get("reservation_output") or {}).get("data") or {}
            pct  = data.get("occupancy_pct")
            total = data.get("total_guests")
            cap   = data.get("capacity")
            return f"{pct}% occupancy · {total} advance bookings vs {cap} seats" if pct is not None else "Reservation analysis complete"

        if node_name == "complaint_intelligence":
            data    = (state_update.get("complaint_output") or {}).get("data") or {}
            total   = data.get("total_feedback", 0)
            neg_pct = (data.get("sentiment_breakdown") or {}).get("negative_pct", "?")
            return f"{total} feedback items · {neg_pct}% negative sentiment"

        if node_name == "inventory":
            data     = (state_update.get("inventory_output") or {}).get("data") or {}
            alerts   = data.get("shortage_alerts") or []
            n_crit   = sum(1 for a in alerts if isinstance(a, dict) and a.get("severity") == "critical")
            n_warn   = sum(1 for a in alerts if isinstance(a, dict) and a.get("severity") == "warning")
            n_items  = data.get("total_items_checked", 0)
            return f"{n_items} ingredients checked · {n_crit} critical · {n_warn} warning shortages"

        if node_name == "menu_intelligence":
            out = state_update.get("menu_output") or {}
            if out.get("error"):
                return f"Skipped — {str(out['error'])[:60]}"
            rec  = out.get("recommendation") or {}
            n_hi = len(rec.get("highlight_items") or [])
            n_bl = len(rec.get("inventory_blockers") or [])
            return f"{n_hi} items to feature · {n_bl} blocked by stock"

        if node_name == "aggregator":
            bundle   = state_update.get("aggregated_recommendation") or {}
            agents   = bundle.get("agents") or {}
            n_ran    = sum(1 for v in agents.values() if isinstance(v, dict) and v.get("data") is not None)
            return f"Brief assembled from {n_ran} agent output(s)"

        if node_name == "critic":
            out     = state_update.get("critic_output") or {}
            verdict = out.get("verdict", "?")
            score   = out.get("score")
            sanity  = out.get("sanity_report") or {}
            n_err   = sum(1 for i in (sanity.get("issues") or []) if i.get("severity") == "error")
            score_s = f" · score {round(float(score), 2)}" if score is not None else ""
            sane_s  = f" · {n_err} sanity error(s)" if n_err else " · sanity ✓"
            return f"{verdict.capitalize()}{score_s}{sane_s}"

        if node_name == "replan_orchestrator":
            return f"Replan #{state_update.get('replan_count', 1)} context injected"

    except Exception:
        pass
    return ""


async def stream_planning_scenario(
    deps: dict[str, Any],
    scenario: str,
    target_date: str | None = None,
    simulation_mode: bool = False,
    force_critic_decision: str | None = None,
    debug: bool = False,
    org_capacity: int = 70,
    org_peak_hours: str = "18:00-22:00",
    restaurant_profile: dict | None = None,
    critic_threshold: float = 0.7,
    org_id: int | None = None,
) -> AsyncGenerator[dict[str, Any], None]:
    """
    Streams planning results node-by-node for SSE delivery.

    Yields dicts:
      {"event": "node_complete", "node": str}        — as each agent finishes
      {"event": "complete",      "response": dict}   — full final response
      {"event": "error",         "message": str}     — on failure
    """
    traces: list[dict] = []
    graph_instance = build_graph(deps, traces=traces)

    run_id = uuid.uuid4().hex[:8]
    structlog.contextvars.clear_contextvars()
    structlog.contextvars.bind_contextvars(run_id=run_id, scenario=scenario)
    log = structlog.get_logger()

    effective_capacity   = restaurant_profile["capacity"]   if restaurant_profile else org_capacity
    effective_peak_hours = restaurant_profile["peak_hours"] if restaurant_profile else org_peak_hours

    initial_state = make_initial_state(
        scenario=scenario, target_date=target_date,
        simulation_mode=simulation_mode, force_critic_decision=force_critic_decision,
        debug=debug, restaurant_profile=restaurant_profile,
    )
    initial_state.update({
        "simulation_mode":        simulation_mode,
        "force_critic_decision":  force_critic_decision,
        "debug":                  debug,
        "org_id":                 org_id,
        "org_capacity":           effective_capacity,
        "org_peak_hours":         effective_peak_hours,
        "critic_threshold":       critic_threshold,
    })
    if debug:
        initial_state["execution_trace"] = []

    # Inject tier registry into state when tiered comet mode is active
    if deps.get("llm_registry"):
        initial_state["llm_registry"] = deps["llm_registry"]

    run_label = f"{scenario}/{target_date or 'next'}"
    llm_metadata = _llm_log_fields(deps.get("llm"))
    config = RunnableConfig(
        run_name=f"cortexkitchen/stream/{run_label}",
        tags=[scenario, "planning_run", "stream"],
        metadata={"scenario": scenario, "target_date": target_date or "", "run_id": run_id, **llm_metadata},
    )

    t0 = time.perf_counter()
    log.info("stream_start", target_date=target_date or "next", **llm_metadata)

    final_response: dict | None = None

    async for event in graph_instance.astream_events(initial_state, config=config, version="v2"):
        etype = event.get("event", "")
        ename = event.get("name", "")
        sse_name = _NODE_SSE_MAP.get(ename)

        if sse_name:
            if etype == "on_chain_start":
                yield {
                    "event": "node_start",
                    "node": sse_name,
                    "hint": _NODE_START_HINTS.get(ename, ""),
                }
            elif etype == "on_chain_end":
                state_update = (event.get("data") or {}).get("output") or {}
                yield {
                    "event": "node_complete",
                    "node": sse_name,
                    "hint": _completion_hint(ename, state_update if isinstance(state_update, dict) else {}),
                }

        elif ename == FINAL_ASSEMBLER and etype == "on_chain_end":
            state_update = (event.get("data") or {}).get("output") or {}
            if isinstance(state_update, dict):
                final_response = state_update.get("final_response")

    total_duration_ms = round((time.perf_counter() - t0) * 1000, 2)
    llm_usage = []
    for trace in traces:
        llm_usage.extend(trace.get("llm_usage") or [])
    llm_usage.extend(deps["llm"].drain_usage())
    for tier_llm in deps.get("llm_registry", {}).values():
        llm_usage.extend(tier_llm.drain_usage())
    total_cost_usd = round(sum(u.get("cost_usd", 0) for u in llm_usage), 6)
    total_tokens   = sum(u.get("prompt_tokens", 0) + u.get("completion_tokens", 0) for u in llm_usage)

    log.info("stream_end", duration_ms=total_duration_ms,
             total_tokens=total_tokens, total_cost_usd=total_cost_usd)

    if final_response:
        obs = {
            "run_id": run_id, "node_traces": traces,
            "llm_usage": llm_usage, "total_duration_ms": total_duration_ms,
            "total_tokens": total_tokens, "total_cost_usd": total_cost_usd,
            **llm_metadata,
        }
        final_response.setdefault("meta", {}).update(obs)

        # Store approved runs in planning memory for future enrichment
        planning_memory = deps.get("planning_memory")
        stream_verdict  = (final_response.get("critic") or {}).get("verdict", "")
        if planning_memory and org_id and stream_verdict == "approved" and not simulation_mode:
            try:
                s_run_id = final_response.get("meta", {}).get("planning_run_id")
                planning_memory.store(org_id, scenario, s_run_id, final_response)
            except Exception:
                pass

        yield {"event": "complete", "response": final_response}
    else:
        yield {"event": "error", "message": "Graph completed without a final response"}
