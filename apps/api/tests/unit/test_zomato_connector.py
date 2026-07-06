"""Unit tests for ZomatoConnector -- a stub proving the multi-provider
architecture is real (not Swiggy-only), even with no live Zomato API access.
"""

from unittest.mock import MagicMock

import pytest

from app.infrastructure.base_connector import BaseConnector
from app.infrastructure.zomato.zomato_connector import ZomatoConnector


def _connector():
    return ZomatoConnector(client=None, db=MagicMock(), org_id=1)


def test_zomato_connector_is_a_real_base_connector_subclass():
    connector = _connector()
    assert isinstance(connector, BaseConnector)


@pytest.mark.asyncio
async def test_sync_returns_not_connected_without_raising():
    connector = _connector()
    result = await connector.sync()
    assert result == {"synced": 0, "errors": 0, "status": "not_connected"}


@pytest.mark.asyncio
async def test_enrich_returns_none_without_raising():
    connector = _connector()
    result = await connector.enrich({"cuisine": "pizza"})
    assert result is None


def test_base_connector_accepts_none_client():
    """BaseConnector's client param is intentionally untyped (Any) -- confirms
    a connector with no live API client at all can still be constructed."""
    connector = _connector()
    assert connector._client is None
    assert connector.org_id == 1
