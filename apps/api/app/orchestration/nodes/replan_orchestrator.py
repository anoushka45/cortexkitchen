"""
Replan Orchestrator node (P6-S04).

Triggered when the Critic returns 'rejected' or 'revision' and replan_count < 2.
Injects the critic's feedback into replan_context so the Aggregator can pass it
to the Critic on the next pass — without re-running the expensive domain nodes.
"""

from app.orchestration.state import OrchestratorState


def replan_orchestrator_node(state: OrchestratorState) -> OrchestratorState:
    """
    Handles critic-driven replanning. Increments retry count, injects critic
    feedback into state so the next aggregator pass highlights what to fix.
    Max 2 retries — enforced by the graph's conditional routing, not here.
    """
    critic_out = state.get("critic_output") or {}
    revision_reasons  = critic_out.get("revision_reasons") or []
    actionable_feedback = critic_out.get("actionable_feedback") or ""
    verdict           = critic_out.get("verdict", "revision")
    score             = critic_out.get("score", 0.0)

    prev_count   = state.get("replan_count") or 0
    prev_context = state.get("replan_context") or ""

    attempt_lines = [
        f"[Replan attempt {prev_count + 1}] Critic verdict: {verdict} (score={score})",
    ]
    if revision_reasons:
        attempt_lines.append(f"  Revision reasons: {'; '.join(revision_reasons)}")
    if actionable_feedback:
        attempt_lines.append(f"  Actionable feedback: {actionable_feedback}")

    new_context = "\n".join(
        filter(None, [prev_context, "\n".join(attempt_lines)])
    )

    return {
        **state,
        "replan_count":  prev_count + 1,
        "replan_context": new_context,
        "critic_output": None,
    }
