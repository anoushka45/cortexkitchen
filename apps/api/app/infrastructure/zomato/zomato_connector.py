"""ZomatoConnector — BaseConnector stub proving the multi-provider architecture
is real, not a Swiggy-only system with a "zomato" string sitting unused in
provider_registry.py's CAPABILITY_PROVIDERS.

No live Zomato API access exists yet. Both sync() and enrich() return a clear
"not yet connected" result -- never raise, matching BaseConnector's graceful-
degradation contract. When real Zomato API access is added, only this file
changes; ProviderRegistry, the connectors table, and every planning node that
reads enrichment data stay exactly as they are today.
"""

from app.infrastructure.base_connector import BaseConnector


class ZomatoConnector(BaseConnector):
    """Zomato connector stub. client is unused (no live API yet) -- pass None."""

    async def sync(self) -> dict:
        self._log("zomato_sync_not_connected")
        return {"synced": 0, "errors": 0, "status": "not_connected"}

    async def enrich(self, context: dict) -> dict | None:
        self._log("zomato_enrich_not_connected")
        return None
