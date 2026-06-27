"""BaseConnector ABC — contract for all external platform connectors.

Every connector (Swiggy, Zomato, Google Reviews, Square POS, EazyDiner)
implements this interface. Two modes:

  sync()   — nightly job, writes historical data to the DB (Layer 0)
  enrich() — at planning time, returns live signals without touching the DB

Graceful degradation: enrich() must return None on any failure so that
LangGraph nodes can fall back to synthetic data without crashing.
"""

import structlog
from abc import ABC, abstractmethod

from app.infrastructure.swiggy.client import SwiggyMCPClient

log = structlog.get_logger()


class BaseConnector(ABC):
    """Abstract connector that every platform integration must implement."""

    def __init__(self, client: SwiggyMCPClient, org_id: int) -> None:
        self.client = client
        self.org_id = org_id

    @abstractmethod
    async def sync(self) -> dict:
        """Nightly job. Pull historical data. Write to DB (Layer 0).

        Returns a summary dict: {"synced": N, "errors": M, ...}
        """

    @abstractmethod
    async def enrich(self, context: dict) -> dict | None:
        """At planning time. Fetch live signals. Do NOT write to DB.

        context — caller-supplied hints (scenario, target_date, etc.)
        Returns enrichment dict on success, None on any failure.
        """

    def _log(self, msg: str, **kwargs) -> None:
        """Structured log with org_id bound."""
        log.info(msg, org_id=self.org_id, connector=self.__class__.__name__, **kwargs)
