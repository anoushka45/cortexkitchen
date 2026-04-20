from unittest.mock import AsyncMock, MagicMock

import pytest


@pytest.mark.asyncio
async def test_critic_prefers_input_summary_over_raw_bundle():
    from app.domain.services.critic_service import CriticService

    db = MagicMock()
    llm = MagicMock()
    llm.complete_json = AsyncMock(
        return_value={"verdict": "approved", "score": 0.8, "notes": "Looks good."}
    )

    service = CriticService(db=db, llm=llm)
    recommendation = {
        "scenario": "friday_rush",
        "agents": {"inventory": {"recommendation": {"restock_actions": ["oversized dict dump"]}}},
    }

    await service.evaluate(
        agent="ops_manager",
        recommendation=recommendation,
        input_summary="Scenario: friday_rush | Date: 2026-04-25\n[Inventory] Restock mozzarella only.",
    )

    prompt = llm.complete_json.await_args.kwargs["prompt"]
    assert "Restock mozzarella only." in prompt
    assert "oversized dict dump" not in prompt
