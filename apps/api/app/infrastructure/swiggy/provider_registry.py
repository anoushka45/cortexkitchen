"""
Capability-to-provider registry for MCP connectors.

Maps planning capabilities to ordered provider lists. At runtime, returns
the highest-priority provider that has an active connector record for the org.

No DB migration needed — reads from the existing `connectors` table which
already tracks per-org platform health (sync_status, error_count).

Adding a new provider (e.g. Zomato for competitor pricing) means:
  1. Insert a row into CAPABILITY_PROVIDERS below
  2. Implement a BaseConnector subclass for it
  3. The registry automatically routes to it when the org's connector is active
"""

from sqlalchemy.orm import Session

CAPABILITY_PROVIDERS: dict[str, list[str]] = {
    "competitor_pricing": ["swiggy", "zomato"],
    "reservation_data":   ["swiggy", "eazydiner"],
    "procurement":        ["swiggy"],
    "order_history":      ["swiggy", "zomato"],
}

_HEALTHY_STATUSES = {"success", "syncing"}


class ProviderRegistry:
    """
    Routes a planning capability to the best available provider for an org.

    Priority is positional: first provider in CAPABILITY_PROVIDERS[capability]
    that has an active connector record wins.
    """

    def get_provider(self, org_id: int, capability: str, db: Session) -> str | None:
        """
        Return the highest-priority active provider for a capability, or None.

        'Active' = connector row exists AND sync_status in _HEALTHY_STATUSES.
        Falls back down the priority list until one is found.
        """
        from app.infrastructure.db.models import Connector

        candidates = CAPABILITY_PROVIDERS.get(capability, [])
        if not candidates:
            return None

        active_types = {
            row.connector_type
            for row in db.query(Connector).filter(
                Connector.org_id == org_id,
                Connector.sync_status.in_(list(_HEALTHY_STATUSES)),
            ).all()
        }

        for provider in candidates:
            if provider in active_types:
                return provider

        return None

    def all_providers_for(self, capability: str) -> list[str]:
        """Return the full provider priority list for a capability."""
        return list(CAPABILITY_PROVIDERS.get(capability, []))

    def capabilities(self) -> dict[str, list[str]]:
        """Return the full capability → providers map."""
        return dict(CAPABILITY_PROVIDERS)
