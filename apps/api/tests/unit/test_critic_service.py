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


@pytest.mark.asyncio
async def test_critic_returns_dimension_scores_and_feedback():
    from app.domain.services.critic_service import CriticService

    recommendation = {
        "scenario": "friday_rush",
        "target_date": "2026-05-08",
        "summary_for_critic": "Scenario: friday_rush | Date: 2026-05-08",
        "agents": {
            "forecast": {"recommendation": {"recommendation": "Prep for demand."}},
            "reservation": {"recommendation": {"recommendation": "Manage seating carefully."}},
            "complaint": {"recommendation": {"action_items": ["Check service timing"]}},
            "menu": {"recommendation": {"highlight_items": ["Chicken Tikka Pizza"]}},
            "inventory": {
                "data": {"shortage_alerts": [], "overstock_alerts": []},
                "recommendation": {"restock_actions": [], "priority": "low"},
            },
        },
    }

    db = MagicMock()
    llm = MagicMock()
    llm.complete_json = AsyncMock(
        return_value={
            "verdict": "revision",
            "score": 0.72,
            "notes": "Good direction, but needs sharper staffing guidance.",
            "dimension_scores": {
                "safety": 0.9,
                "feasibility": 0.6,
                "evidence": 0.8,
                "actionability": 0.55,
                "clarity": 0.7,
            },
            "revision_reasons": [
                "Staffing change is underspecified.",
                "Reservation-pressure mitigation is too vague.",
            ],
            "actionable_feedback": [
                "Quantify extra staffing by role and shift.",
                "Add one explicit waitlist-control action.",
            ],
        }
    )

    service = CriticService(db=db, llm=llm)
    result = await service.evaluate(
        agent="ops_manager",
        recommendation=recommendation,
        input_summary="Scenario: friday_rush | Date: 2026-05-08",
    )

    assert result["dimension_scores"]["safety"] == 0.9
    assert result["dimension_scores"]["actionability"] == 0.55
    assert result["revision_reasons"] == [
        "Staffing change is underspecified.",
        "Reservation-pressure mitigation is too vague.",
    ]
    assert result["actionable_feedback"] == [
        "Quantify extra staffing by role and shift.",
        "Add one explicit waitlist-control action.",
    ]


@pytest.mark.asyncio
async def test_critic_persists_advanced_metadata_in_decision_log():
    from app.domain.services.critic_service import CriticService

    db = MagicMock()
    llm = MagicMock()
    llm.complete_json = AsyncMock(
        return_value={
            "verdict": "revision",
            "score": 0.68,
            "notes": "Needs clearer execution details.",
            "dimension_scores": {"feasibility": 0.6, "clarity": 0.55},
            "revision_reasons": ["Execution sequencing is unclear."],
            "actionable_feedback": ["Separate prep actions from service-floor actions."],
        }
    )

    def refresh_log(log):
        log.id = 321

    db.refresh.side_effect = refresh_log

    service = CriticService(db=db, llm=llm)
    result = await service.evaluate_and_log(
        agent="ops_manager",
        recommendation={
            "scenario": "friday_rush",
            "target_date": "2026-05-08",
            "summary_for_critic": "Scenario: friday_rush | Date: 2026-05-08",
            "agents": {
                "forecast": {"recommendation": {"recommendation": "Prep for demand."}},
                "reservation": {"recommendation": {"recommendation": "Hold a small waitlist."}},
                "complaint": {"recommendation": {"action_items": ["Watch service speed"]}},
                "menu": {"recommendation": {"highlight_items": ["Margherita"]}},
                "inventory": {
                    "data": {"shortage_alerts": [], "overstock_alerts": []},
                    "recommendation": {"restock_actions": [], "priority": "low"},
                },
            },
        },
        input_summary="Scenario: friday_rush | Date: 2026-05-08",
    )

    log = db.add.call_args.args[0]
    assert log.metadata_["dimension_scores"]["feasibility"] == 0.6
    assert log.metadata_["revision_reasons"] == ["Execution sequencing is unclear."]
    assert log.metadata_["actionable_feedback"] == [
        "Separate prep actions from service-floor actions."
    ]
    assert result["decision_log_id"] == 321
