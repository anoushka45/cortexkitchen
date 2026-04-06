from __future__ import annotations

from typing import Any

from langgraph.graph import END, StateGraph

from app.orchestration.nodes import (
    complaint_node,
    critic_node,
    final_response_node,
    forecast_node,
    ops_manager_node,
    reservation_node,
)
from app.orchestration.state import OrchestrationState


def build_orchestration_graph(
    reservation_service: Any,
    forecast_service: Any,
    complaint_service: Any,
    critic_service: Any,
):
    graph = StateGraph(OrchestrationState)

    async def reservation_wrapper(state: OrchestrationState) -> OrchestrationState:
        return await reservation_node(state, reservation_service)

    async def forecast_wrapper(state: OrchestrationState) -> OrchestrationState:
        return await forecast_node(state, forecast_service)

    async def complaint_wrapper(state: OrchestrationState) -> OrchestrationState:
        return await complaint_node(state, complaint_service)

    async def critic_wrapper(state: OrchestrationState) -> OrchestrationState:
        return await critic_node(state, critic_service)

    graph.add_node("ops_manager", ops_manager_node)
    graph.add_node("reservation", reservation_wrapper)
    graph.add_node("forecast", forecast_wrapper)
    graph.add_node("complaint", complaint_wrapper)
    graph.add_node("critic", critic_wrapper)
    graph.add_node("final_response", final_response_node)

    graph.set_entry_point("ops_manager")

    graph.add_edge("ops_manager", "reservation")
    graph.add_edge("reservation", "forecast")
    graph.add_edge("forecast", "complaint")
    graph.add_edge("complaint", "critic")
    graph.add_edge("critic", "final_response")
    graph.add_edge("final_response", END)

    return graph.compile()