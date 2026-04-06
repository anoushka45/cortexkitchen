"""
Menu Intelligence Agent node.

Phase 1: lightweight stub — returns top Friday items from ForecastService
as a menu signal. A dedicated MenuService will be wired here in Phase 2.
Writes to `menu_output`.
"""

from sqlalchemy.orm import Session

from app.orchestration.state import OrchestratorState
from app.domain.services.forecast_service import ForecastService
from app.infrastructure.llm.base import BaseLLMProvider


async def menu_intelligence_node(
    state: OrchestratorState,
    db: Session,
    llm: BaseLLMProvider,
) -> OrchestratorState:
    """
    Surfaces top-selling items and promo candidates.
    Phase 1 uses ForecastService.get_top_friday_items() as the data source.
    Writes to state['menu_output'].
    """
    if state.get("error"):
        return state

    try:
        # Reuse ForecastService for top-item data in Phase 1
        service = ForecastService(db=db, llm=llm)
        top_items = service.get_top_friday_items()

        menu_output = {
            "service": "menu",
            "data": {
                "top_items": top_items,
                "note": "Phase 1 stub — using Friday order history. Full MenuService in Phase 2.",
            },
            # No LLM recommendation in Phase 1 — keeps it lightweight
            "recommendation": {
                "insight": "Focus prep on top-selling items listed above.",
                "promo_candidates": [i["item"] for i in top_items[:2]] if top_items else [],
            },
        }
        return {**state, "menu_output": menu_output}

    except Exception as exc:
        return {
            **state,
            "menu_output": {
                "service": "menu",
                "error": str(exc),
                "data": None,
                "recommendation": None,
            },
        }