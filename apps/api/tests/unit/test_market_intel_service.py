"""Unit tests for MarketIntelService, focused on competitor_status —
distinguishing "temporarily degraded (circuit breaker open)" from "no data"
when CompetitorEnricher returns None. See run 233 investigation: competitor
pricing vanished while Instamart pricing worked fine in the same run, root
caused to the Food MCP circuit breaker being open while Instamart's was closed.
"""

from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from app.domain.services.market_intel_service import MarketIntelService


def _service_with_mocked_enrichers(competitor_result, occupancy_result=None):
    service = MarketIntelService(client=MagicMock())
    service._competitor = MagicMock()
    service._competitor.enrich = AsyncMock(return_value=competitor_result)
    service._occupancy = MagicMock()
    service._occupancy.enrich = AsyncMock(return_value=occupancy_result)
    return service


@pytest.mark.asyncio
async def test_no_status_field_when_competitor_data_present():
    service = _service_with_mocked_enrichers({"area_avg": {"pizza": 300}, "alerts": []})
    result = await service.run({"org_id": 1})
    assert "competitor_status" not in result["market_intel_output"]


@pytest.mark.asyncio
async def test_degraded_circuit_open_status_when_circuit_tripped():
    service = _service_with_mocked_enrichers(None)
    with patch(
        "app.domain.services.market_intel_service.get_state",
        AsyncMock(return_value={"state": "open", "recent_failures": 3, "resets_in_seconds": 1109}),
    ):
        result = await service.run({"org_id": 1})

    status = result["market_intel_output"]["competitor_status"]
    assert status["state"] == "degraded_circuit_open"
    assert status["resets_in_seconds"] == 1109


@pytest.mark.asyncio
async def test_no_data_status_when_circuit_closed_but_still_none():
    service = _service_with_mocked_enrichers(None)
    with patch(
        "app.domain.services.market_intel_service.get_state",
        AsyncMock(return_value={"state": "closed", "recent_failures": 0, "resets_in_seconds": None}),
    ):
        result = await service.run({"org_id": 1})

    status = result["market_intel_output"]["competitor_status"]
    assert status["state"] == "no_data"
    assert status["resets_in_seconds"] is None


@pytest.mark.asyncio
async def test_defaults_to_no_data_when_circuit_check_itself_fails():
    service = _service_with_mocked_enrichers(None)
    with patch(
        "app.domain.services.market_intel_service.get_state",
        AsyncMock(side_effect=RuntimeError("redis down")),
    ):
        result = await service.run({"org_id": 1})

    status = result["market_intel_output"]["competitor_status"]
    assert status["state"] == "no_data"
