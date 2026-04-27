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
        "scenario_profile": state.get("scenario_profile"),
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
    scenario_profile = state.get("scenario_profile") or {}
    scenario_label = scenario_profile.get("label") or state.get("scenario")
    lines = [f"Scenario: {scenario_label} ({state.get('scenario')}) | Date: {state.get('target_date', 'next planning window')}"]
    if scenario_profile:
        lines.append(
            f"Operational focus: {scenario_profile.get('operational_focus')} | Service window: {scenario_profile.get('service_window')}"
        )
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
            rec_text = (
                rec.get("recommendation")
                or rec.get("action")
                or rec.get("insight")
                or _summarize_recommendation_dict(label, rec)
            )
        else:
            rec_text = str(rec)
        lines.append(f"[{label}] {rec_text}")

    return "\n".join(lines)


def _summarize_recommendation_dict(label: str, recommendation: dict) -> str:
    """Create a critic-friendly summary instead of dumping raw dicts."""
    if label == "Inventory":
        restock_actions = recommendation.get("restock_actions") or []
        waste_actions = recommendation.get("waste_reduction_actions") or []
        parts = []
        if restock_actions:
            parts.append(f"Restock: {', '.join(restock_actions[:2])}")
        if waste_actions:
            parts.append(f"Waste reduction: {', '.join(waste_actions[:2])}")
        if recommendation.get("reasoning"):
            parts.append(str(recommendation["reasoning"]))
        return " | ".join(parts) if parts else "No concrete inventory actions provided."

    if label == "Complaint":
        issues = recommendation.get("issues") or []
        action_items = recommendation.get("action_items") or []
        parts = []
        if issues:
            top_issues = [str(issue.get("issue")) for issue in issues[:2] if isinstance(issue, dict) and issue.get("issue")]
            if top_issues:
                parts.append(f"Top issues: {', '.join(top_issues)}")
        if action_items:
            parts.append(f"Actions: {', '.join(map(str, action_items[:2]))}")
        if recommendation.get("overall_summary"):
            parts.append(str(recommendation["overall_summary"]))
        return " | ".join(parts) if parts else "No concrete complaint actions provided."

    if label == "Menu":
        promo_candidates = recommendation.get("promo_candidates") or []
        highlight_items = recommendation.get("highlight_items") or []
        deprioritize_items = recommendation.get("deprioritize_items") or []
        parts = []
        if highlight_items:
            parts.append(f"Highlight: {', '.join(map(str, highlight_items[:2]))}")
        if deprioritize_items:
            parts.append(f"Avoid pushing: {', '.join(map(str, deprioritize_items[:2]))}")
        if promo_candidates:
            parts.append(f"Promo candidates: {', '.join(map(str, promo_candidates[:2]))}")
        if recommendation.get("reasoning"):
            parts.append(str(recommendation["reasoning"]))
        return " | ".join(parts) if parts else "No concrete menu actions provided."

    return str(recommendation)
