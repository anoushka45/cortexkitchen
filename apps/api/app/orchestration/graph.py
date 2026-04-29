"""
CortexKitchen LangGraph orchestration graph.

Enhanced for P1-10:
- Supports simulation mode for deterministic testing
- Enables critic override for validation scenarios
- Adds debug observability for LangGraph state inspection
- Maintains backward compatibility with existing workflows
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

def _inject(node_fn, **deps):
    """Wrap async node functions with injected dependencies."""
    @functools.wraps(node_fn)
    async def _wrapped(state: OrchestratorState) -> OrchestratorState:
        return await node_fn(state, **deps)
    return _wrapped


def _inject_sync(node_fn, **deps):
    """Wrap synchronous node functions with injected dependencies."""
    @functools.wraps(node_fn)
    def _wrapped(state: OrchestratorState) -> OrchestratorState:
        return node_fn(state, **deps)
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

def build_graph(deps: dict[str, Any]):
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

    graph = StateGraph(OrchestratorState)

    # ── Register nodes ───────────────────────────────────────────────────────

    graph.add_node(OPS_MANAGER, ops_manager_node)

    graph.add_node(
        DEMAND_FORECAST,
        _inject(demand_forecast_node, db=db, llm=llm),
    )
    graph.add_node(
        RESERVATION,
        _inject(reservation_node, db=db, llm=llm),
    )
    graph.add_node(
        COMPLAINT_INTELLIGENCE,
        _inject(complaint_intelligence_node, db=db, llm=llm, memory=memory),
    )
    graph.add_node(
        MENU_INTELLIGENCE,
        _inject(menu_intelligence_node, db=db, llm=llm),
    )
    graph.add_node(
        INVENTORY,
        _inject(inventory_node, db=db, llm=llm),
    )

    graph.add_node(AGGREGATOR, aggregator_node)

    graph.add_node(
        CRITIC,
        _inject(critic_node, db=db, llm=llm),
    )

    graph.add_node(FINAL_ASSEMBLER, final_assembler_node)

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
    graph = build_graph(deps)


    # Create initial state with P1-10 enhancements
    initial_state = make_initial_state(
        scenario=scenario,
        target_date=target_date,
        simulation_mode=simulation_mode,
        force_critic_decision=force_critic_decision,
        debug=debug,
    )

    # Inject P1-10 testing flags
    initial_state["simulation_mode"] = simulation_mode
    initial_state["force_critic_decision"] = force_critic_decision
    initial_state["debug"] = debug

    # Initialize debug trace container
    if debug:
        initial_state["execution_trace"] = []

    # Execute graph
    final_state = await graph.ainvoke(initial_state)

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
