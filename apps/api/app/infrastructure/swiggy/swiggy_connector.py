"""SwiggyConnector — BaseConnector implementation for Swiggy MCP.

sync()   → P6-S03 (orders) done; P6-S04 (reservations) and P6-S05 (feedback) pending
enrich() → P6-S06 (CompetitorEnricher), P6-S07 (OccupancyEnricher),
           P6-S08 (ProcurementEnricher)
"""

from app.core.settings import get_settings
from app.infrastructure.swiggy.base_connector import BaseConnector
from app.infrastructure.swiggy.connector_repository import ConnectorRepository
from app.infrastructure.swiggy.sync.order_sync import SwiggyOrderSyncService


class SwiggyConnector(BaseConnector):
    """Swiggy MCP connector — order sync live; enrichers and remaining sync pending."""

    async def sync(self) -> dict:
        """Nightly sync: pulls Swiggy food orders into the orders table.

        Reads SWIGGY_ADDRESS_ID from settings (dev) or connector record (prod).
        Updates connector sync_status in the connectors table.
        Returns {"synced": N, "skipped": N, "errors": N}.
        """
        address_id = get_settings().swiggy_address_id
        if not address_id:
            self._log("swiggy_sync_skipped", reason="SWIGGY_ADDRESS_ID not configured")
            return {"synced": 0, "skipped": 0, "errors": 0}

        repo = ConnectorRepository(self._db)
        repo.update_sync_status(self.org_id, "swiggy", "syncing")

        try:
            result = await SwiggyOrderSyncService(self._client, self._db).sync(address_id)
            repo.update_sync_status(self.org_id, "swiggy", "success")
            self._log("swiggy_sync_complete", **result)
            return result
        except Exception as exc:
            repo.update_sync_status(self.org_id, "swiggy", "error", error=str(exc))
            self._log("swiggy_sync_error", error=str(exc))
            return {"synced": 0, "skipped": 0, "errors": 1}

    async def enrich(self, context: dict) -> dict | None:
        raise NotImplementedError(
            "SwiggyConnector.enrich() will be implemented in P6-S06 through P6-S08 "
            "(CompetitorEnricher via Food MCP, OccupancyEnricher via Dineout MCP, "
            "ProcurementEnricher via Instamart MCP)."
        )
