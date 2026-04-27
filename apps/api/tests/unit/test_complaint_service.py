from unittest.mock import AsyncMock, MagicMock

import pytest


@pytest.mark.asyncio
async def test_complaint_service_adds_scenario_watchouts_to_summary():
    from app.domain.services.complaint_service import ComplaintService

    db = MagicMock()
    llm = MagicMock()
    llm.complete_json = AsyncMock(return_value={"issues": [], "overall_summary": "", "action_items": []})

    service = ComplaintService(db=db, llm=llm)
    service.get_complaint_summary = MagicMock(
        return_value={
            "period_days": 28,
            "total_feedback": 12,
            "sentiment_breakdown": {
                "negative": 4,
                "positive": 6,
                "neutral": 2,
                "negative_pct": 33.3,
            },
            "unique_complaints": ["Slow takeaway handoff"],
            "unique_positives": ["Friendly staff"],
        }
    )

    result = await service.analyse_and_recommend(
        scenario_profile={
            "id": "weekday_lunch",
            "label": "Weekday Lunch",
            "service_window": "12:00-15:00",
            "operational_focus": "Lunch pacing and staffing efficiency.",
        }
    )

    assert result["data"]["scenario_label"] == "Weekday Lunch"
    assert result["data"]["service_window"] == "12:00-15:00"
    assert any("Takeaway packaging" in item for item in result["data"]["scenario_watchouts"])
