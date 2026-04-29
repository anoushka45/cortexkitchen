"""Menu Intelligence Agent node."""

from datetime import datetime
from sqlalchemy.orm import Session

from app.orchestration.state import OrchestratorState
from app.domain.services.menu_service import MenuService
from app.infrastructure.llm.base import BaseLLMProvider


async def menu_intelligence_node(
    state: OrchestratorState,
    db: Session,
    llm: BaseLLMProvider,
) -> OrchestratorState:
    """
    Builds menu guidance from demand, complaint, and inventory context.
    Writes to state['menu_output'].
    """
    if state.get("error"):
        return state

    try:
        if state.get("simulation_mode", False):
            return {
                **state,
                "menu_output": {
                    "service": "menu",
                    "data": {
                        "top_items": [
                            {"item": "Margherita", "category": "pizza", "total_ordered": 80},
                            {"item": "Pepperoni", "category": "pizza", "total_ordered": 62},
                        ],
                        "forecast_snapshot": {
                            "predicted_orders": 128,
                            "avg_friday_orders": 112,
                            "target_date": state.get("target_date"),
                        },
                        "complaint_themes": ["watch pizza temperature at dispatch"],
                        "shortage_ingredients": ["Mozzarella"],
                        "overstock_ingredients": ["Basil"],
                        "note": "Simulation mode menu insight payload.",
                    },
                    "recommendation": {
                        "highlight_items": ["Margherita", "Pepperoni"],
                        "deprioritize_items": ["Four Cheese Special"],
                        "promo_candidates": ["Garlic Bread"],
                        "inventory_blockers": ["Mozzarella is below safe Friday stock"],
                        "complaint_watchouts": ["Keep handoff time tight so pizzas stay hot"],
                        "operational_notes": [
                            "Stage toppings for Margherita and Pepperoni before peak",
                            "Use basil surplus in sides and garnish prep",
                        ],
                        "reasoning": "Push high-volume favourites that the kitchen can execute fast without worsening shortage risk.",
                        "priority": "high",
                        "risks": ["Slowdowns and quality misses if low-stock specialty pizzas are pushed too hard"],
                    },
                },
            }

        service = MenuService(db=db, llm=llm)
        result = await service.analyse_and_recommend(
            target_date=datetime.fromisoformat(state.get("target_date")) if state.get("target_date") else None,
            forecast_data=(state.get("forecast_output") or {}).get("data"),
            complaint_data=(state.get("complaint_output") or {}).get("data"),
            inventory_data=(state.get("inventory_output") or {}).get("data"),
        )
        return {**state, "menu_output": result}

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
