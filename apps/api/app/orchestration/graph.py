"""
CortexKitchen LangGraph orchestration graph.

Graph topology for the Friday Rush scenario:

    [START]
       │
   ops_manager          ← validates scenario, short-circuits on bad input
       │
   ┌───┴──────────────────────────────────────┐
   │   (parallel fan-out — all run together)  │
   demand_forecast   reservation   complaint_intelligence   menu   inventory
   └───────────────────────┬──────────────────────────────────────────────┘
                           │
                       aggregator           ← Ops Manager assembles the bundle
                           │
                         critic             ← Critic Agent validates + logs
                           │
                    final_assembler         ← shapes the API response
                           │
                         [END]

Parallel fan-out is implemented via LangGraph's `add_edge` from one node
to multiple targets — LangGraph executes them concurrently when possible.

Dependencies are injected at graph-run time via a `deps` dict, keeping
node functions pure and testable.
"""

import functools
from typing import Any

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

OPS_MANAGER            = "ops_manager"
DEMAND_FORECAST        = "demand_forecast"
RESERVATION            = "reservation"
COMPLAINT_INTELLIGENCE = "complaint_intelligence"
MENU_INTELLIGENCE      = "menu_intelligence"
INVENTORY              = "inventory"
AGGREGATOR             = "aggregator"
CRITIC                 = "critic"
FINAL_ASSEMBLER        = "final_assembler"


# ── Dependency injection helper ──────────────────────────────────────────────

def _inject(node_fn, **deps):
    """
    Wrap an async node function so it receives infrastructure deps
    (db, llm, memory) as keyword arguments at call time.

    LangGraph node callables must accept exactly `(state) -> state`.
    This wrapper closes over the deps dict and calls the real function.
    """
    @functools.wraps(node_fn)
    async def _wrapped(state: OrchestratorState) -> OrchestratorState:
        return await node_fn(state, **deps)
    return _wrapped


def _inject_sync(node_fn, **deps):
    """Same as _inject but for synchronous nodes."""
    @functools.wraps(node_fn)
    def _wrapped(state: OrchestratorState) -> OrchestratorState:
        return node_fn(state, **deps)
    return _wrapped


# ── Conditional edge: abort if ops_manager sets an error ────────────────────

def _route_after_ops_manager(state: OrchestratorState) -> str:
    """
    After ops_manager validates the scenario:
    - If there's a fatal error → jump straight to final_assembler
      (which will surface the error in the response).
    - Otherwise → proceed to demand_forecast (first parallel node).
    """
    if state.get("error"):
        return FINAL_ASSEMBLER
    return DEMAND_FORECAST


# ── Graph factory ────────────────────────────────────────────────────────────

def build_graph(deps: dict[str, Any]):
    """
    Build and compile the CortexKitchen LangGraph for the Friday Rush scenario.

    Args:
        deps: Infrastructure dependencies, expected keys:
            - db       : SQLAlchemy Session
            - llm      : BaseLLMProvider instance
            - memory   : MemoryService instance (optional, can be None)

    Returns:
        A compiled LangGraph runnable (supports .ainvoke / .invoke).

    Usage:
        graph = build_graph({"db": db_session, "llm": gemini, "memory": mem})
        state = await graph.ainvoke(make_initial_state("friday_rush", "2026-04-11"))
        result = state["final_response"]
    """
    db     = deps["db"]
    llm    = deps["llm"]
    memory = deps.get("memory")  # Optional

    graph = StateGraph(OrchestratorState)

    # ── Register nodes ───────────────────────────────────────────────────────

    # ops_manager is synchronous (no I/O)
    graph.add_node(OPS_MANAGER, ops_manager_node)

    # Domain agents — async, receive db + llm
    graph.add_node(DEMAND_FORECAST,        _inject(demand_forecast_node,        db=db, llm=llm))
    graph.add_node(RESERVATION,            _inject(reservation_node,            db=db, llm=llm))
    graph.add_node(COMPLAINT_INTELLIGENCE, _inject(complaint_intelligence_node, db=db, llm=llm, memory=memory))
    graph.add_node(MENU_INTELLIGENCE,      _inject(menu_intelligence_node,      db=db, llm=llm))
    graph.add_node(INVENTORY,              _inject(inventory_node,              db=db, llm=llm))

    # Aggregator is synchronous
    graph.add_node(AGGREGATOR,      aggregator_node)

    # Critic and assembler — async
    graph.add_node(CRITIC,          _inject(critic_node,          db=db, llm=llm))
    graph.add_node(FINAL_ASSEMBLER, final_assembler_node)

    # ── Wire edges ───────────────────────────────────────────────────────────

    # Entry point
    graph.set_entry_point(OPS_MANAGER)

    # Conditional route after ops_manager (abort path on bad scenario)
    graph.add_conditional_edges(
        OPS_MANAGER,
        _route_after_ops_manager,
        {
            DEMAND_FORECAST: DEMAND_FORECAST,
            FINAL_ASSEMBLER: FINAL_ASSEMBLER,
        },
    )

    # Parallel fan-out: demand_forecast kicks off all other domain agents
    # LangGraph runs nodes concurrently when they have no inter-dependency.
    graph.add_edge(DEMAND_FORECAST, RESERVATION)
    graph.add_edge(DEMAND_FORECAST, COMPLAINT_INTELLIGENCE)
    graph.add_edge(DEMAND_FORECAST, MENU_INTELLIGENCE)
    graph.add_edge(DEMAND_FORECAST, INVENTORY)

    # Fan-in: all domain agents must finish before aggregation
    graph.add_edge(RESERVATION,            AGGREGATOR)
    graph.add_edge(COMPLAINT_INTELLIGENCE, AGGREGATOR)
    graph.add_edge(MENU_INTELLIGENCE,      AGGREGATOR)
    graph.add_edge(INVENTORY,              AGGREGATOR)

    # Linear tail: aggregate → critic → assemble → done
    graph.add_edge(AGGREGATOR,      CRITIC)
    graph.add_edge(CRITIC,          FINAL_ASSEMBLER)
    graph.add_edge(FINAL_ASSEMBLER, END)

    return graph.compile()


# ── Convenience runner ───────────────────────────────────────────────────────

async def run_friday_rush(
    deps: dict[str, Any],
    target_date: str | None = None,
) -> dict:
    """
    Top-level convenience function for the Friday Rush scenario.

    Args:
        deps        : Infrastructure deps (db, llm, memory).
        target_date : ISO date string for the target Friday (optional).

    Returns:
        The `final_response` dict from the completed graph state.
    """
    graph = build_graph(deps)
    initial_state = make_initial_state(scenario="friday_rush", target_date=target_date)
    final_state = await graph.ainvoke(initial_state)
    return final_state.get("final_response", {})