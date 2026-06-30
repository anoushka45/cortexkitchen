"""Unit tests for OccupancyEnricher (P6-S08).

All Swiggy Dineout API calls and Redis are mocked — no live token needed.
"""

import pytest
from unittest.mock import AsyncMock, MagicMock

from app.infrastructure.swiggy.enrichers.occupancy import OccupancyEnricher


# ── helpers ───────────────────────────────────────────────────────────────────

LOCATION = {"id": "loc_01", "lat": 12.9716, "lng": 77.5946}

AVAILABLE_RESTAURANT = {"id": "drest_42", "name": "The Fatty Bao", "availability": "AVAILABLE"}
UNAVAILABLE_RESTAURANT = {"id": "drest_99", "name": "Closed Spot", "availability": "UNAVAILABLE"}

SLOTS_BUSY = {
    "slots": [
        {"displayTime": "7:00 PM", "availabilityCount": 1},
        {"displayTime": "7:30 PM", "availabilityCount": 0},
        {"displayTime": "8:00 PM", "availabilityCount": 2},
    ]
}

SLOTS_QUIET = {
    "slots": [
        {"displayTime": "7:00 PM", "availabilityCount": 8},
        {"displayTime": "7:30 PM", "availabilityCount": 10},
        {"displayTime": "8:00 PM", "availabilityCount": 12},
    ]
}

CONTEXT = {"org_id": 1, "cuisine": "North Indian"}


def _client(locations=None, restaurants=None, slots=None):
    c = MagicMock()

    async def call_tool(endpoint, tool_name, arguments):
        if tool_name == "get_saved_locations":
            return {"locations": locations if locations is not None else [LOCATION]}
        if tool_name == "search_restaurants_dineout":
            return {"restaurants": restaurants if restaurants is not None else [AVAILABLE_RESTAURANT]}
        if tool_name == "get_available_slots":
            return slots
        return None

    c.call_tool = call_tool
    return c


def _enricher(client, cached=None):
    e = OccupancyEnricher(client)
    e._cache_get = AsyncMock(return_value=cached)
    e._cache_set = AsyncMock()
    return e


# ── tests ─────────────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_returns_none_when_no_saved_locations():
    enricher = _enricher(_client(locations=[]))
    result = await enricher.enrich(CONTEXT)
    assert result is None


@pytest.mark.asyncio
async def test_returns_none_when_location_has_no_lat_lng():
    enricher = _enricher(_client(locations=[{"id": "loc_01"}]))  # no lat/lng
    result = await enricher.enrich(CONTEXT)
    assert result is None


@pytest.mark.asyncio
async def test_returns_none_when_no_available_competitors():
    enricher = _enricher(_client(restaurants=[UNAVAILABLE_RESTAURANT]))
    result = await enricher.enrich(CONTEXT)
    assert result is None


@pytest.mark.asyncio
async def test_returns_none_when_slot_calls_all_fail():
    enricher = _enricher(_client(slots=None))  # get_available_slots returns None
    result = await enricher.enrich(CONTEXT)
    assert result is None


@pytest.mark.asyncio
async def test_high_signal_when_few_slots_available():
    enricher = _enricher(_client(slots=SLOTS_BUSY))
    result = await enricher.enrich(CONTEXT)
    assert result is not None
    assert result["occupancy_signal"] == "HIGH"
    assert result["tonight_busy"] is True


@pytest.mark.asyncio
async def test_low_signal_when_many_slots_available():
    enricher = _enricher(_client(slots=SLOTS_QUIET))
    result = await enricher.enrich(CONTEXT)
    assert result is not None
    assert result["occupancy_signal"] == "LOW"
    assert result["tonight_busy"] is False


@pytest.mark.asyncio
async def test_prompt_text_contains_signal_and_competitors():
    enricher = _enricher(_client(slots=SLOTS_BUSY))
    result = await enricher.enrich(CONTEXT)
    assert result is not None
    assert "## Occupancy Signal" in result["prompt_text"]
    assert "HIGH" in result["prompt_text"]


@pytest.mark.asyncio
async def test_cache_hit_skips_api_calls():
    cached = {"occupancy_signal": "MEDIUM", "tonight_busy": False, "cached": True}
    enricher = _enricher(_client(), cached=cached)
    result = await enricher.enrich(CONTEXT)
    assert result == cached


@pytest.mark.asyncio
async def test_cache_written_after_successful_fetch():
    enricher = _enricher(_client(slots=SLOTS_BUSY))
    result = await enricher.enrich(CONTEXT)
    assert result is not None
    enricher._cache_set.assert_awaited_once()


@pytest.mark.asyncio
async def test_unavailable_restaurants_filtered_out():
    mixed = [AVAILABLE_RESTAURANT, UNAVAILABLE_RESTAURANT]
    call_count = {"n": 0}

    async def call_tool(endpoint, tool_name, arguments):
        if tool_name == "get_saved_locations":
            return {"locations": [LOCATION]}
        if tool_name == "search_restaurants_dineout":
            return {"restaurants": mixed}
        if tool_name == "get_available_slots":
            call_count["n"] += 1
            return SLOTS_BUSY
        return None

    c = MagicMock()
    c.call_tool = call_tool
    enricher = _enricher(c)
    await enricher.enrich(CONTEXT)
    # only the AVAILABLE restaurant should trigger a slot call
    assert call_count["n"] == 1


@pytest.mark.asyncio
async def test_max_three_slot_calls_enforced():
    five_restaurants = [
        {"id": f"drest_{i}", "name": f"R{i}", "availability": "AVAILABLE"}
        for i in range(5)
    ]
    call_count = {"n": 0}

    async def call_tool(endpoint, tool_name, arguments):
        if tool_name == "get_saved_locations":
            return {"locations": [LOCATION]}
        if tool_name == "search_restaurants_dineout":
            return {"restaurants": five_restaurants}
        if tool_name == "get_available_slots":
            call_count["n"] += 1
            return SLOTS_BUSY
        return None

    c = MagicMock()
    c.call_tool = call_tool
    enricher = _enricher(c)
    await enricher.enrich(CONTEXT)
    assert call_count["n"] <= 3


@pytest.mark.asyncio
async def test_exception_returns_none_never_raises():
    c = MagicMock()
    c.call_tool = AsyncMock(side_effect=RuntimeError("Dineout down"))
    enricher = _enricher(c)
    result = await enricher.enrich(CONTEXT)
    assert result is None
