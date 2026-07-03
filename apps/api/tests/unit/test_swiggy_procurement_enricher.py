"""Unit tests for ProcurementEnricher (P6-S09).

All Swiggy Instamart API calls and Redis are mocked — no live token needed.
"""

import pytest
from unittest.mock import AsyncMock, MagicMock

from app.infrastructure.swiggy.enrichers.procurement import ProcurementEnricher


# ── helpers ───────────────────────────────────────────────────────────────────

# Field names match the live Swiggy MCP response (see commit 82373ef):
# variations (not variants), price is {offerPrice, mrp} (not a float),
# quantityDescription (not unit), isInStockAndAvailable (not inStock),
# displayName (not name), and the products key is 'products' on both endpoints.
VARIANT_IN_STOCK = {
    "spinId": "spin_42",
    "price": {"offerPrice": 45.0, "mrp": 50.0},
    "quantityDescription": "1kg",
    "isInStockAndAvailable": True,
}
VARIANT_NO_SPIN = {
    "price": {"offerPrice": 20.0},
    "quantityDescription": "500g",
    "isInStockAndAvailable": True,
}  # no spinId — skip

SEARCH_RESPONSE = {
    "products": [
        {"id": "prod_1", "displayName": "Fresh Tomatoes", "category": "Vegetables",
         "variations": [VARIANT_IN_STOCK]},
    ]
}

GO_TO_RESPONSE = {
    "products": [
        {"productId": "prod_2", "displayName": "Amul Butter",
         "variations": [{"spinId": "spin_99", "price": {"offerPrice": 55.0}, "quantityDescription": "100g", "isInStockAndAvailable": True}],
         "lastOrderedAt": "2026-06-20T10:00:00Z"},
    ]
}

CONTEXT = {
    "org_id": 1,
    "address_id": "addr_abc",
    "shortage_items": ["tomatoes", "paneer"],
}


_UNSET = object()


def _client(search_data=_UNSET, go_to_data=_UNSET):
    c = MagicMock()

    async def call_tool(endpoint, tool_name, arguments):
        if tool_name == "your_go_to_items":
            return GO_TO_RESPONSE if go_to_data is _UNSET else go_to_data
        if tool_name == "search_products":
            return SEARCH_RESPONSE if search_data is _UNSET else search_data
        return None

    c.call_tool = call_tool
    return c


def _enricher(client, cached=None):
    e = ProcurementEnricher(client)
    e._cache_get = AsyncMock(return_value=cached)
    e._cache_set = AsyncMock()
    return e


# ── tests ─────────────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_returns_none_when_no_address_id():
    enricher = ProcurementEnricher(_client())
    enricher._cache_get = AsyncMock(return_value=None)
    with MagicMock() as mock_settings:
        import app.infrastructure.swiggy.enrichers.procurement as mod
        original = mod.get_settings
        try:
            mod.get_settings = lambda: MagicMock(swiggy_address_id="")
            result = await enricher.enrich({"org_id": 1})  # no address_id key
        finally:
            mod.get_settings = original
    assert result is None


@pytest.mark.asyncio
async def test_returns_none_when_all_calls_return_nothing():
    enricher = _enricher(_client(search_data=None, go_to_data=None))
    result = await enricher.enrich(CONTEXT)
    assert result is None


@pytest.mark.asyncio
async def test_procurement_options_populated_with_spinid():
    enricher = _enricher(_client())
    result = await enricher.enrich(CONTEXT)
    assert result is not None
    opts = result["procurement_options"]
    assert len(opts) >= 1
    assert opts[0]["ingredient"] == "tomatoes"
    assert opts[0]["spinId"] == "spin_42"
    assert opts[0]["price"] == 45.0
    assert opts[0]["inStock"] is True


@pytest.mark.asyncio
async def test_go_to_items_populated():
    enricher = _enricher(_client())
    result = await enricher.enrich(CONTEXT)
    assert result is not None
    go_to = result["go_to_items"]
    assert len(go_to) >= 1
    assert go_to[0]["name"] == "Amul Butter"
    assert go_to[0]["price"] == 55.0
    assert go_to[0]["spinId"] == "spin_99"
    assert go_to[0]["lastOrderedAt"] is not None


@pytest.mark.asyncio
async def test_variant_without_spinid_is_skipped():
    no_spin_response = {
        "products": [{"id": "p1", "displayName": "X", "variations": [VARIANT_NO_SPIN]}]
    }
    enricher = _enricher(_client(search_data=no_spin_response, go_to_data={"products": []}))
    result = await enricher.enrich({"org_id": 1, "address_id": "addr_abc", "shortage_items": ["cream"]})
    # No usable variant, no go_to items either → None
    assert result is None


@pytest.mark.asyncio
async def test_max_five_search_calls_enforced():
    call_count = {"n": 0}

    async def call_tool(endpoint, tool_name, arguments):
        if tool_name == "your_go_to_items":
            return {"products": []}
        if tool_name == "search_products":
            call_count["n"] += 1
            return SEARCH_RESPONSE
        return None

    c = MagicMock()
    c.call_tool = call_tool
    enricher = _enricher(c)

    many_items = [f"ingredient_{i}" for i in range(10)]
    await enricher.enrich({**CONTEXT, "shortage_items": many_items})
    assert call_count["n"] <= 5


@pytest.mark.asyncio
async def test_prompt_text_contains_section_header():
    enricher = _enricher(_client())
    result = await enricher.enrich(CONTEXT)
    assert result is not None
    assert "## Live Procurement Options" in result["prompt_text"]
    assert "tomatoes" in result["prompt_text"].lower()


@pytest.mark.asyncio
async def test_cache_hit_skips_api_calls():
    cached = {"procurement_options": [{"ingredient": "onions", "spinId": "spin_01"}], "cached": True}
    enricher = _enricher(_client(), cached=cached)
    result = await enricher.enrich(CONTEXT)
    assert result == cached


@pytest.mark.asyncio
async def test_cache_written_after_successful_fetch():
    enricher = _enricher(_client())
    result = await enricher.enrich(CONTEXT)
    assert result is not None
    enricher._cache_set.assert_awaited_once()


@pytest.mark.asyncio
async def test_works_with_only_go_to_items_no_shortage():
    """No shortage items — should still return go_to_items."""
    enricher = _enricher(_client())
    result = await enricher.enrich({"org_id": 1, "address_id": "addr_abc", "shortage_items": []})
    assert result is not None
    assert len(result["go_to_items"]) >= 1
    assert result["procurement_options"] == []


@pytest.mark.asyncio
async def test_exception_returns_none_never_raises():
    c = MagicMock()
    c.call_tool = AsyncMock(side_effect=RuntimeError("Instamart down"))
    enricher = _enricher(c)
    result = await enricher.enrich(CONTEXT)
    assert result is None
