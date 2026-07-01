"""MarketIntelService — P6-S10.

Orchestrates all three Swiggy enrichers concurrently at planning time and
assembles their outputs into state fields ready for the pipeline nodes.

Responsibilities:
  - Run CompetitorEnricher, OccupancyEnricher, ProcurementEnricher in parallel
  - Return a structured result mapping each output to its OrchestratorState key
  - Fail open: any enricher returning None is silently omitted; the service
    never raises, so callers (LangGraph nodes) always get a usable result

Returned dict shape:
  {
    "swiggy_competitor_context":  {...} | None,
    "swiggy_occupancy_context":   {...} | None,
    "swiggy_procurement_options": {...} | None,
    "market_intel_output": {
      "competitor_pricing":   {...} | None,
      "area_occupancy":       "HIGH" | "MEDIUM" | "LOW" | None,
      "pricing_alerts":       [...],
      "tonight_busy":         bool | None,
      "procurement_options":  [...],
      "fetched_at":           "YYYY-MM-DD",
    },
  }
"""

import asyncio
import logging
from datetime import date
from typing import Optional

from app.infrastructure.swiggy.client import SwiggyMCPClient
from app.infrastructure.swiggy.enrichers.competitor import CompetitorEnricher
from app.infrastructure.swiggy.enrichers.occupancy import OccupancyEnricher
from app.infrastructure.swiggy.enrichers.procurement import ProcurementEnricher

log = logging.getLogger(__name__)


class MarketIntelService:
    """Parallel orchestrator for all three Swiggy enrichers.

    Instantiate once per planning run, passing the org's SwiggyMCPClient.
    Call run() with planning context; it returns all enricher outputs ready to
    be written into OrchestratorState.
    """

    def __init__(self, client: SwiggyMCPClient) -> None:
        self._competitor  = CompetitorEnricher(client)
        self._occupancy   = OccupancyEnricher(client)
        self._procurement = ProcurementEnricher(client)

    # ── public ───────────────────────────────────────────────────────────────

    async def run(self, context: dict) -> dict:
        """Run all enrichers concurrently and return combined state payloads.

        context keys used (all optional — enrichers degrade gracefully):
          org_id          int        — scopes Redis cache keys
          address_id      str        — Swiggy Food + Instamart addressId
          cuisine         str        — e.g. "North Indian"
          our_items       list       — [{"name": str, "price": float}, ...]
          shortage_items  list[str]  — ingredients that are low in stock

        Returns a dict with four keys:
          swiggy_competitor_context   → CompetitorEnricher output or None
          swiggy_occupancy_context    → OccupancyEnricher output or None
          swiggy_procurement_options  → ProcurementEnricher output or None
          market_intel_output         → assembled summary for market_intel_node
        """
        try:
            return await self._run(context)
        except Exception as exc:
            log.warning("market_intel_service_error: %s", exc)
            return self._empty_result()

    # ── internal ─────────────────────────────────────────────────────────────

    async def _run(self, context: dict) -> dict:
        competitor_ctx, occupancy_ctx, procurement_ctx = await asyncio.gather(
            self._competitor.enrich(context),
            self._occupancy.enrich(context),
            self._procurement.enrich(context),
            return_exceptions=False,
        )

        log.info(
            "market_intel_service_done competitor=%s occupancy=%s procurement=%s",
            competitor_ctx is not None,
            occupancy_ctx is not None,
            procurement_ctx is not None,
        )

        market_intel_output = self._assemble_market_intel(
            competitor_ctx, occupancy_ctx, procurement_ctx
        )

        return {
            "swiggy_competitor_context":  competitor_ctx,
            "swiggy_occupancy_context":   occupancy_ctx,
            "swiggy_procurement_options": procurement_ctx,
            "market_intel_output":        market_intel_output,
        }

    def _assemble_market_intel(
        self,
        competitor_ctx:  Optional[dict],
        occupancy_ctx:   Optional[dict],
        procurement_ctx: Optional[dict],
    ) -> dict:
        """Build the market_intel_output dict that market_intel_node writes to state."""
        pricing_alerts    = competitor_ctx.get("alerts", [])   if competitor_ctx  else []
        area_avg          = competitor_ctx.get("area_avg")      if competitor_ctx  else None
        occupancy_signal  = occupancy_ctx.get("occupancy_signal") if occupancy_ctx else None
        tonight_busy      = occupancy_ctx.get("tonight_busy")     if occupancy_ctx else None
        proc_options      = (
            procurement_ctx.get("procurement_options", []) if procurement_ctx else []
        )

        return {
            "competitor_pricing":  area_avg,
            "area_occupancy":      occupancy_signal,
            "pricing_alerts":      pricing_alerts,
            "tonight_busy":        tonight_busy,
            "procurement_options": proc_options,
            "fetched_at":          date.today().isoformat(),
        }

    @staticmethod
    def _empty_result() -> dict:
        return {
            "swiggy_competitor_context":  None,
            "swiggy_occupancy_context":   None,
            "swiggy_procurement_options": None,
            "market_intel_output": {
                "competitor_pricing":  None,
                "area_occupancy":      None,
                "pricing_alerts":      [],
                "tonight_busy":        None,
                "procurement_options": [],
                "fetched_at":          date.today().isoformat(),
            },
        }
