from unittest.mock import AsyncMock, MagicMock, patch

import pytest


@pytest.mark.asyncio
async def test_menu_service_returns_structured_output():
    from app.domain.services.menu_service import MenuService

    db = MagicMock()
    llm = MagicMock()
    llm.complete_json = AsyncMock(
        return_value={
            "highlight_items": ["Margherita", "Pepperoni"],
            "deprioritize_items": ["Truffle Special"],
            "promo_candidates": ["Garlic Bread"],
            "inventory_blockers": ["Mozzarella running low"],
            "complaint_watchouts": ["Watch pizza temperature on dispatch"],
            "operational_notes": ["Pre-batch dough for top two pizzas"],
            "reasoning": "Back proven items and avoid shortage-driven misses.",
            "priority": "high",
            "risks": ["Slow service if kitchen spreads prep too thin"],
        }
    )

    with patch("app.domain.services.menu_service.ForecastService") as MockForecastService:
        MockForecastService.return_value.get_top_service_day_items.return_value = [
            {"item": "Margherita", "category": "pizza", "total_ordered": 80}
        ]
        service = MenuService(db=db, llm=llm)
        result = await service.analyse_and_recommend(
            forecast_data={"predicted_orders": 120, "target_date": "2026-04-11"},
            complaint_data={"unique_complaints": ["cold pizza"]},
            inventory_data={"shortage_alerts": [{"ingredient": "Mozzarella", "severity": "critical", "shortfall": 5}]},
        )

    assert result["service"] == "menu"
    assert result["data"]["top_items"][0]["item"] == "Margherita"
    assert result["recommendation"]["highlight_items"] == ["Margherita", "Pepperoni"]


@pytest.mark.asyncio
async def test_menu_service_prompt_mentions_inventory_and_complaints():
    from app.domain.services.menu_service import MenuService

    db = MagicMock()
    llm = MagicMock()
    llm.complete_json = AsyncMock(return_value={})

    with patch("app.domain.services.menu_service.ForecastService") as MockForecastService:
        MockForecastService.return_value.get_top_service_day_items.return_value = []
        service = MenuService(db=db, llm=llm)
        await service.analyse_and_recommend(
            forecast_data={"predicted_orders": 120},
            complaint_data={"unique_complaints": ["cold pizza"]},
            inventory_data={"shortage_alerts": [{"ingredient": "Mozzarella", "severity": "critical", "shortfall": 5}]},
        )

    prompt = llm.complete_json.await_args.kwargs["prompt"]
    assert "cold pizza" in prompt
    assert "Mozzarella" in prompt
    assert "highlight_items" in prompt


def test_menu_service_language_normalization_rewrites_non_friday_text():
    from app.domain.services.menu_service import MenuService

    service = MenuService(db=MagicMock(), llm=MagicMock())
    normalized = service.normalize_scenario_language(
        {
            "reasoning": "Use Friday promotion slots for faster moving items.",
            "operational_notes": ["Hold back on Friday if stock is tight."],
        },
        scenario_label="Holiday Spike",
    )

    assert "Friday" not in normalized["reasoning"]
    assert "Holiday Spike" in normalized["reasoning"]
    assert "Friday" not in normalized["operational_notes"][0]
