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
)


# ── Node name constants ──────────────────────────────────────────────────────

OPS_MANAGER = "ops_manager"
DEMAND_FORECAST = "demand_forecast"
RESERVATION = "reservation"
COMPLAINT_INTELLIGENCE = "complaint_intelligence"
MENU_INTELLIGENCE = "menu_intelligence"
INVENTORY = "inventory"
AGGREGATOR = "aggregator"
CRITIC = "critic"
FINAL_ASSEMBLER = "final_assembler"


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
        try:
            result = await node_fn(state, **deps)
            duration_ms = round((time.perf_counter() - t0) * 1000, 2)
            log.info("node_end", node=node, duration_ms=duration_ms)
            traces.append({"node": node, "started_at": started_at,
                           "ended_at": datetime.now(timezone.utc).isoformat(),
                           "duration_ms": duration_ms})
            return result
        except Exception as exc:
            duration_ms = round((time.perf_counter() - t0) * 1000, 2)
            log.error("node_error", node=node, duration_ms=duration_ms, error=str(exc))
            traces.append({"node": node, "started_at": started_at,
                           "ended_at": datetime.now(timezone.utc).isoformat(),
                           "duration_ms": duration_ms, "error": str(exc)})
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


# ── Conditional edge: abort if ops_manager sets an error ─────────────────────

def _route_after_ops_manager(state: OrchestratorState) -> str:
    """
    After ops_manager validates the scenario:
    - If there's a fatal error → jump to final_assembler.
    - Otherwise → proceed with orchestration.
    """
    if state.get("error"):
        return FINAL_ASSEMBLER
    return DEMAND_FORECAST


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
    db = deps["db"]
    llm = deps["llm"]
    memory = deps.get("memory")
    tr = traces if traces is not None else []

    graph = StateGraph(OrchestratorState)

    # ── Register nodes ───────────────────────────────────────────────────────

    graph.add_node(OPS_MANAGER, _log_node(ops_manager_node, tr))

    graph.add_node(DEMAND_FORECAST,        _inject(demand_forecast_node,        tr, db=db, llm=llm))
    graph.add_node(RESERVATION,            _inject(reservation_node,            tr, db=db, llm=llm))
    graph.add_node(COMPLAINT_INTELLIGENCE, _inject(complaint_intelligence_node, tr, db=db, llm=llm, memory=memory))
    graph.add_node(MENU_INTELLIGENCE,      _inject(menu_intelligence_node,      tr, db=db, llm=llm))
    graph.add_node(INVENTORY,              _inject(inventory_node,              tr, db=db, llm=llm))

    graph.add_node(AGGREGATOR,     _log_node(aggregator_node,      tr))
    graph.add_node(CRITIC,         _inject(critic_node,            tr, db=db, llm=llm))
    graph.add_node(FINAL_ASSEMBLER, _log_node(final_assembler_node, tr))

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

    # Parallel fan-out
    graph.add_edge(DEMAND_FORECAST, RESERVATION)
    graph.add_edge(DEMAND_FORECAST, COMPLAINT_INTELLIGENCE)
    graph.add_edge(DEMAND_FORECAST, MENU_INTELLIGENCE)
    graph.add_edge(DEMAND_FORECAST, INVENTORY)

    # Fan-in
    graph.add_edge(RESERVATION, AGGREGATOR)
    graph.add_edge(COMPLAINT_INTELLIGENCE, AGGREGATOR)
    graph.add_edge(MENU_INTELLIGENCE, AGGREGATOR)
    graph.add_edge(INVENTORY, AGGREGATOR)

    # Linear tail
    graph.add_edge(AGGREGATOR, CRITIC)
    graph.add_edge(CRITIC, FINAL_ASSEMBLER)
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
    initial_state["org_capacity"] = effective_capacity
    initial_state["org_peak_hours"] = effective_peak_hours

    # Initialize debug trace container
    if debug:
        initial_state["execution_trace"] = []

    # Execute graph with LangSmith trace metadata
    run_label = f"{scenario}/{target_date or 'next'}"
    config = RunnableConfig(
        run_name=f"cortexkitchen/{run_label}",
        tags=[scenario, "planning_run"],
        metadata={"scenario": scenario, "target_date": target_date or "", "run_id": run_id},
    )
    t0 = time.perf_counter()
    log.info("graph_start", target_date=target_date or "next")
    final_state = await graph.ainvoke(initial_state, config=config)
    total_duration_ms = round((time.perf_counter() - t0) * 1000, 2)

    # Drain token/cost usage from the LLM provider
    llm_usage = deps["llm"].drain_usage()
    total_cost_usd  = round(sum(u.get("cost_usd", 0)  for u in llm_usage), 6)
    total_tokens    = sum(u.get("prompt_tokens", 0) + u.get("completion_tokens", 0) for u in llm_usage)

    log.info("graph_end", duration_ms=total_duration_ms,
             total_tokens=total_tokens, total_cost_usd=total_cost_usd)

    # Attach observability data to the final response meta so RunService persists it
    final_response = final_state.get("final_response", {})
    obs = {
        "run_id": run_id,
        "node_traces": traces,
        "llm_usage": llm_usage,
        "total_duration_ms": total_duration_ms,
        "total_tokens": total_tokens,
        "total_cost_usd": total_cost_usd,
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
            }
        )

    return final_response
