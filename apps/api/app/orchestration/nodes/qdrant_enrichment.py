"""
Qdrant Early Enrichment node (P6-S04).

Runs once after demand_forecast and before the parallel domain fan-out.
Pre-fetches complaint history and SOP context from Qdrant into shared_context
so all agents have access without making individual Qdrant queries.
"""

import structlog

from app.orchestration.state import OrchestratorState

log = structlog.get_logger()


async def qdrant_enrichment_node(
    state: OrchestratorState,
    memory,
) -> OrchestratorState:
    """
    Pre-enrichment step: retrieves shared Qdrant context before parallel nodes run.
    Writes to state['shared_context']. Degrades gracefully — errors return empty dict.
    """
    if state.get("error"):
        return {**state, "shared_context": {}}

    if memory is None:
        return {**state, "shared_context": {}}

    org_id   = state.get("org_id") or 0
    scenario = state.get("scenario") or ""
    query    = f"{scenario} restaurant operations planning"

    try:
        complaints = memory.retrieve_similar_complaints(query, org_id, top_k=5)
        sops       = memory.retrieve_relevant_sops(query, org_id, top_k=3)
        shared = {
            "complaints": complaints,
            "sops":       sops,
        }
        log.info(
            "qdrant_enrichment_complete",
            complaints_retrieved=len(complaints),
            sops_retrieved=len(sops),
            org_id=org_id,
        )
    except Exception as exc:
        log.warning("qdrant_enrichment_failed", error=str(exc))
        shared = {}

    return {**state, "shared_context": shared}
