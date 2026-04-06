"""
Critic Agent node.

Validates the aggregated recommendation bundle against operational rules
using CriticService. Logs the decision to the database.
Writes to `critic_output`.
"""

from sqlalchemy.orm import Session

from app.orchestration.state import OrchestratorState
from app.domain.services.critic_service import CriticService
from app.infrastructure.llm.base import BaseLLMProvider


async def critic_node(
    state: OrchestratorState,
    db: Session,
    llm: BaseLLMProvider,
) -> OrchestratorState:
    """
    Evaluates the aggregated recommendation and logs the decision.
    Writes to state['critic_output'].
    """
    if state.get("error"):
        return state

    bundle = state.get("aggregated_recommendation")
    if bundle is None:
        return {
            **state,
            "critic_output": {
                "verdict": "rejected",
                "score": 0.0,
                "notes": "No aggregated recommendation was produced — nothing to evaluate.",
            },
        }

    try:
        service = CriticService(db=db, llm=llm)
        result = await service.evaluate_and_log(
            agent="ops_manager",
            recommendation=bundle,
            input_summary=bundle.get("summary_for_critic", ""),
            retrieved_context=str(bundle.get("agents", {}).get("complaint", {}).get("rag_context")),
            reasoning_summary=f"Multi-agent Friday rush evaluation for {bundle.get('target_date', 'next Friday')}",
        )
        return {**state, "critic_output": result}

    except Exception as exc:
        return {
            **state,
            "critic_output": {
                "verdict": "revision",
                "score": 0.0,
                "notes": f"Critic evaluation failed: {exc}",
                "error": str(exc),
            },
        }