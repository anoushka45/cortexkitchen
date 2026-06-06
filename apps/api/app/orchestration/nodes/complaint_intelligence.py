"""
Complaint Intelligence Agent node.

Uses ComplaintService for DB-backed analysis AND MemoryService for
RAG retrieval of similar past complaints and relevant SOPs.
Writes to `complaint_output`.
"""

from sqlalchemy.orm import Session
from datetime import datetime

from app.orchestration.state import OrchestratorState
from app.domain.services.complaint_service import ComplaintService
from app.infrastructure.llm.base import BaseLLMProvider
from app.infrastructure.vector.memory_service import MemoryService


async def complaint_intelligence_node(
    state: OrchestratorState,
    db: Session,
    llm: BaseLLMProvider,
    memory: MemoryService | None = None,
) -> OrchestratorState:
    """
    Summarises complaints, retrieves similar past issues via RAG,
    and surfaces relevant SOPs. Writes to state['complaint_output'].
    """
    if state.get("error"):
        return state

    try:
        service = ComplaintService(db=db, llm=llm)
        target_date = (
            datetime.fromisoformat(state["target_date"])
            if state.get("target_date")
            else None
        )

        # RAG retrieval happens BEFORE the LLM call so context feeds the prompt
        rag_context: dict = {"similar_complaints": [], "relevant_sops": []}
        if memory is not None:
            org_id = state.get("org_id")
            summary = service.get_complaint_summary(days=28)
            top_complaint = (summary.get("unique_complaints") or ["slow service"])[0]
            if org_id is not None:
                rag_context["similar_complaints"] = memory.retrieve_similar_complaints(
                    query=top_complaint, org_id=org_id, top_k=3
                )
                rag_context["relevant_sops"] = memory.retrieve_relevant_sops(
                    query=top_complaint, org_id=org_id, top_k=2
                )

        result = await service.analyse_and_recommend(
            days=28,
            scenario_profile=state.get("scenario_profile"),
            target_date=target_date,
            rag_context=rag_context,
        )

        result["rag_context"] = rag_context
        return {**state, "complaint_output": result}

    except Exception as exc:
        return {
            **state,
            "complaint_output": {
                "service": "complaint",
                "error": str(exc),
                "data": None,
                "recommendation": None,
                "rag_context": {},
            },
        }
