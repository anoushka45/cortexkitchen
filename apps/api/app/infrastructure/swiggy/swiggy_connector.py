"""SwiggyConnector — reference implementation of BaseConnector for Swiggy MCP.

This is a skeleton class. sync() and enrich() raise NotImplementedError with
clear messages describing what each will do when implemented in later tasks.
The class exists now so the import chain is complete and tests can verify
the structure without needing the full implementation.

Implementation roadmap:
  sync()   → P6-S03 (orders), P6-S04 (reservations), P6-S05 (feedback)
  enrich() → P6-S06 (CompetitorEnricher), P6-S07 (OccupancyEnricher),
              P6-S08 (ProcurementEnricher)
"""

from app.infrastructure.swiggy.base_connector import BaseConnector


class SwiggyConnector(BaseConnector):
    """Swiggy MCP connector — skeleton pending P6-S03 through P6-S08."""

    async def sync(self) -> dict:
        raise NotImplementedError(
            "SwiggyConnector.sync() will be implemented in P6-S03 through P6-S05 "
            "(order/reservation/feedback sync via get_food_orders, "
            "get_booking_status, and track_food_order)."
        )

    async def enrich(self, context: dict) -> dict | None:
        raise NotImplementedError(
            "SwiggyConnector.enrich() will be implemented in P6-S06 through P6-S08 "
            "(CompetitorEnricher via Food MCP, OccupancyEnricher via Dineout MCP, "
            "ProcurementEnricher via Instamart MCP)."
        )
