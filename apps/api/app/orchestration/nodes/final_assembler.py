"""
Final Assembler node.

Takes the critic-validated bundle and shapes it into the clean,
structured response that the Friday Rush API endpoint will return.
Writes to `final_response`.
"""

from datetime import datetime, timezone

from app.orchestration.state import OrchestratorState


def final_assembler_node(state: OrchestratorState) -> OrchestratorState:
    """
    Assembles the final API response from all collected state.
    Always produces a valid final_response even if some agents errored.
    Writes to state['final_response'].
    """
    critic = state.get("critic_output") or {}
    bundle = state.get("aggregated_recommendation") or {}

    def _safe_rec(output: dict | None) -> dict | None:
        if not output or output.get("error"):
            return None
        return output.get("recommendation")

    final_response = {
        "scenario": state.get("scenario"),
        "target_date": state.get("target_date"),
        "generated_at": datetime.now(timezone.utc).isoformat(),

        # Per-agent recommendations for the dashboard cards
        "recommendations": {
            "forecast":    _safe_rec(state.get("forecast_output")),
            "reservation": _safe_rec(state.get("reservation_output")),
            "complaint":   _safe_rec(state.get("complaint_output")),
            "menu":        _safe_rec(state.get("menu_output")),
            "inventory":   _safe_rec(state.get("inventory_output")),
        },

        # RAG evidence surface — complaint context for the dashboard
        "rag_context": (
            state.get("complaint_output", {}).get("rag_context")
            if state.get("complaint_output") else None
        ),

        # Critic verdict block
        "critic": {
            "verdict":          critic.get("verdict", "unknown"),
            "score":            critic.get("score", 0.0),
            "notes":            critic.get("notes", ""),
            "decision_log_id":  critic.get("decision_log_id"),
        },

        # High-level status for the frontend
        "status": _derive_status(critic),
    }

    return {**state, "final_response": final_response}


def _derive_status(critic: dict) -> str:
    """Map critic verdict + score to a simple frontend status string."""
    verdict = critic.get("verdict", "unknown")
    score = float(critic.get("score", 0.0))

    if verdict == "unknown":
        return "unknown"
    if verdict == "approved" and score >= 0.7:
        return "ready"
    if verdict == "rejected":
        return "blocked"
    if verdict == "revision" or score < 0.7:
        return "needs_review"
    return "unknown"