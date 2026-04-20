"""
Aggregator node (Ops Manager second pass).

Collects all individual agent outputs from state and assembles
a single unified recommendation bundle for the Critic to evaluate.
No LLM call here — pure data assembly.
"""

from app.orchestration.state import OrchestratorState


def aggregator_node(state: OrchestratorState) -> OrchestratorState:
    """
    Assembles all agent outputs into one recommendation bundle.
    Skips agents that errored without failing the whole flow.
    Writes to state['aggregated_recommendation'].
    """
    if state.get("error"):
        return state

    def _extract(output: dict | None, key: str = "recommendation"):
        """Safely pull a field from an agent output dict."""
        if output is None:
            return None
        if "error" in output and output["error"]:
            return {"error": output["error"]}
        return output.get(key)

    bundle = {
        "scenario": state.get("scenario"),
        "target_date": state.get("target_date"),
        "agents": {
            "forecast": {
                "data": _extract(state.get("forecast_output"), "data"),
                "recommendation": _extract(state.get("forecast_output")),
            },
            "reservation": {
                "data": _extract(state.get("reservation_output"), "data"),
                "recommendation": _extract(state.get("reservation_output")),
            },
            "complaint": {
                "data": _extract(state.get("complaint_output"), "data"),
                "recommendation": _extract(state.get("complaint_output")),
                "rag_context": state.get("complaint_output", {}).get("rag_context") if state.get("complaint_output") else None,
            },
            "menu": {
                "data": _extract(state.get("menu_output"), "data"),
                "recommendation": _extract(state.get("menu_output")),
            },
            "inventory": {
                "data": _extract(state.get("inventory_output"), "data"),
                "recommendation": _extract(state.get("inventory_output")),
            },
        },
        # Flat summary for the Critic prompt — easier than passing the full nested dict
        "summary_for_critic": _build_critic_summary(state),
    }

    return {**state, "aggregated_recommendation": bundle}


def _build_critic_summary(state: OrchestratorState) -> str:
    """
    Build a concise plain-text summary of all agent recommendations
    for the Critic Agent prompt. Omits errored/null agents gracefully.
    """
    lines = [f"Scenario: {state.get('scenario')} | Date: {state.get('target_date', 'next Friday')}"]
    lines.append("")

    agent_map = {
        "Demand Forecast": state.get("forecast_output"),
        "Reservation":     state.get("reservation_output"),
        "Complaint":       state.get("complaint_output"),
        "Menu":            state.get("menu_output"),
        "Inventory":       state.get("inventory_output"),
    }

    for label, output in agent_map.items():
        if output is None:
            lines.append(f"[{label}] — did not run")
            continue
        if output.get("error"):
            lines.append(f"[{label}] — error: {output['error']}")
            continue
        rec = output.get("recommendation", {})
        if isinstance(rec, dict):
            rec_text = rec.get("recommendation") or rec.get("action") or rec.get("insight") or str(rec)
        else:
            rec_text = str(rec)
        lines.append(f"[{label}] {rec_text}")

    return "\n".join(lines)