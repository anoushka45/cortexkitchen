"""Unit tests for SwiggyMCPClient.

All tests mock httpx — no real HTTP calls. Verifies graceful degradation:
every failure path returns None and never raises.
"""

import pytest
from unittest.mock import AsyncMock, MagicMock, patch

from app.infrastructure.swiggy.client import SwiggyMCPClient, FOOD_ENDPOINT


# ── Helpers ───────────────────────────────────────────────────────────────────

def _make_response(status_code: int, body: dict | None = None):
    resp = MagicMock()
    resp.status_code = status_code
    resp.json.return_value = body or {}
    return resp


# ── Tests ─────────────────────────────────────────────────────────────────────

def test_is_available_true():
    with patch("app.infrastructure.swiggy.client.get_settings") as mock_settings:
        mock_settings.return_value.swiggy_access_token = "tok_abc123"
        client = SwiggyMCPClient()
        assert client.is_available() is True


def test_is_available_false():
    with patch("app.infrastructure.swiggy.client.get_settings") as mock_settings:
        mock_settings.return_value.swiggy_access_token = ""
        client = SwiggyMCPClient()
        assert client.is_available() is False


@pytest.mark.asyncio
async def test_call_tool_returns_none_on_401():
    client = SwiggyMCPClient()
    mock_response = _make_response(401)

    with patch("app.infrastructure.swiggy.client.get_settings") as mock_settings, \
         patch("httpx.AsyncClient") as mock_httpx:
        mock_settings.return_value.swiggy_access_token = "tok"
        mock_ctx = AsyncMock()
        mock_ctx.__aenter__ = AsyncMock(return_value=mock_ctx)
        mock_ctx.__aexit__ = AsyncMock(return_value=False)
        mock_ctx.post = AsyncMock(return_value=mock_response)
        mock_httpx.return_value = mock_ctx

        result = await client.call_tool(FOOD_ENDPOINT, "search_restaurants", {"addressId": "x", "query": "pizza"})

    assert result is None


@pytest.mark.asyncio
async def test_call_tool_returns_none_on_500_after_retry():
    client = SwiggyMCPClient()
    mock_response = _make_response(500)

    with patch("app.infrastructure.swiggy.client.get_settings") as mock_settings, \
         patch("httpx.AsyncClient") as mock_httpx, \
         patch("asyncio.sleep", new_callable=AsyncMock):
        mock_settings.return_value.swiggy_access_token = "tok"
        mock_ctx = AsyncMock()
        mock_ctx.__aenter__ = AsyncMock(return_value=mock_ctx)
        mock_ctx.__aexit__ = AsyncMock(return_value=False)
        mock_ctx.post = AsyncMock(return_value=mock_response)
        mock_httpx.return_value = mock_ctx

        result = await client.call_tool(FOOD_ENDPOINT, "search_restaurants", {})

    assert result is None
    # post called twice (initial + retry)
    assert mock_ctx.post.call_count == 2


@pytest.mark.asyncio
async def test_call_tool_returns_data_on_success():
    client = SwiggyMCPClient()
    success_body = {"success": True, "data": {"restaurants": [{"id": "r1", "name": "Pizza Palace"}]}}
    mock_response = _make_response(200, success_body)

    with patch("app.infrastructure.swiggy.client.get_settings") as mock_settings, \
         patch("httpx.AsyncClient") as mock_httpx:
        mock_settings.return_value.swiggy_access_token = "tok"
        mock_ctx = AsyncMock()
        mock_ctx.__aenter__ = AsyncMock(return_value=mock_ctx)
        mock_ctx.__aexit__ = AsyncMock(return_value=False)
        mock_ctx.post = AsyncMock(return_value=mock_response)
        mock_httpx.return_value = mock_ctx

        result = await client.call_tool(FOOD_ENDPOINT, "search_restaurants", {"addressId": "x", "query": "pizza"})

    assert result == success_body["data"]
    assert result["restaurants"][0]["name"] == "Pizza Palace"


@pytest.mark.asyncio
async def test_call_tool_never_raises():
    client = SwiggyMCPClient()

    with patch("app.infrastructure.swiggy.client.get_settings") as mock_settings, \
         patch("httpx.AsyncClient") as mock_httpx:
        mock_settings.return_value.swiggy_access_token = "tok"
        mock_ctx = AsyncMock()
        mock_ctx.__aenter__ = AsyncMock(return_value=mock_ctx)
        mock_ctx.__aexit__ = AsyncMock(return_value=False)
        mock_ctx.post = AsyncMock(side_effect=Exception("network failure"))
        mock_httpx.return_value = mock_ctx

        # Must not raise — must return None
        result = await client.call_tool(FOOD_ENDPOINT, "search_restaurants", {})

    assert result is None


@pytest.mark.asyncio
async def test_call_tool_returns_none_on_success_false():
    client = SwiggyMCPClient()
    error_body = {"success": False, "error": {"message": "Invalid addressId"}}
    mock_response = _make_response(200, error_body)

    with patch("app.infrastructure.swiggy.client.get_settings") as mock_settings, \
         patch("httpx.AsyncClient") as mock_httpx:
        mock_settings.return_value.swiggy_access_token = "tok"
        mock_ctx = AsyncMock()
        mock_ctx.__aenter__ = AsyncMock(return_value=mock_ctx)
        mock_ctx.__aexit__ = AsyncMock(return_value=False)
        mock_ctx.post = AsyncMock(return_value=mock_response)
        mock_httpx.return_value = mock_ctx

        result = await client.call_tool(FOOD_ENDPOINT, "search_restaurants", {})

    assert result is None
