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
from datetime import date
from typing import Optional

import structlog

from app.infrastructure.swiggy.circuit_breaker import get_state
from app.infrastructure.swiggy.client import SwiggyMCPClient
from app.infrastructure.swiggy.enrichers.competitor import CompetitorEnricher
from app.infrastructure.swiggy.enrichers.occupancy import OccupancyEnricher

# structlog, not stdlib logging — see procurement.py enricher for why.
log = structlog.get_logger()


class MarketIntelService:
    """Parallel orchestrator for all three Swiggy enrichers.

    Instantiate once per planning run, passing the org's SwiggyMCPClient.
    Call run() with planning context; it returns all enricher outputs ready to
    be written into OrchestratorState.
    """

    def __init__(self, client: SwiggyMCPClient) -> None:
        self._competitor = CompetitorEnricher(client)
        self._occupancy  = OccupancyEnricher(client)

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
            log.warning("market_intel_service_error", error=str(exc))
            return self._empty_result()

    # ── internal ─────────────────────────────────────────────────────────────

    async def _run(self, context: dict) -> dict:
        competitor_ctx, occupancy_ctx = await asyncio.gather(
            self._competitor.enrich(context),
            self._occupancy.enrich(context),
            return_exceptions=False,
        )

        log.info(
            "market_intel_service_done",
            competitor=competitor_ctx is not None,
            occupancy=occupancy_ctx is not None,
        )

        market_intel_output = self._assemble_market_intel(competitor_ctx, occupancy_ctx)
        if competitor_ctx is None:
            market_intel_output["competitor_status"] = await self._competitor_status()

        return {
            "swiggy_competitor_context": competitor_ctx,
            "swiggy_occupancy_context":  occupancy_ctx,
            "market_intel_output":       market_intel_output,
        }

    def _assemble_market_intel(
        self,
        competitor_ctx: Optional[dict],
        occupancy_ctx:  Optional[dict],
    ) -> dict:
        """Build the market_intel_output dict that market_intel_node writes to state."""
        pricing_alerts   = competitor_ctx.get("alerts", [])      if competitor_ctx else []
        area_avg         = competitor_ctx.get("area_avg")         if competitor_ctx else None
        occupancy_signal = occupancy_ctx.get("occupancy_signal")  if occupancy_ctx  else None
        tonight_busy     = occupancy_ctx.get("tonight_busy")      if occupancy_ctx  else None

        # P6-MI06/MI09: competitor Swiggy deals, pricing impact model (bonus, exact-match only)
        competitor_deals = competitor_ctx.get("competitor_deals") if competitor_ctx else None
        pricing_impact   = competitor_ctx.get("pricing_impact")   if competitor_ctx else None
        # Category-level pricing (dish-name-independent) — the primary market intel signal
        category_pricing = competitor_ctx.get("category_pricing") if competitor_ctx else None
        # Competitor landscape (rating/cost-for-two/distance) + synthesized market ranking
        competitor_landscape = competitor_ctx.get("competitor_landscape") if competitor_ctx else None
        positioning          = competitor_ctx.get("positioning")          if competitor_ctx else None
        # Market context signals: menu breadth, cuisine crowding, veg mix
        menu_breadth     = competitor_ctx.get("menu_breadth")     if competitor_ctx else None
        cuisine_crowding = competitor_ctx.get("cuisine_crowding") if competitor_ctx else None
        veg_mix          = competitor_ctx.get("veg_mix")          if competitor_ctx else None

        # P6-MI07: Dineout competitor deals — from get_restaurant_details + parsed slot deals[]
        competitor_dineout_deals = occupancy_ctx.get("competitor_dineout_deals") if occupancy_ctx else None
        slot_deals_found         = occupancy_ctx.get("slot_deals_found")         if occupancy_ctx else None
        # Occupancy-by-time-slot chart data
        slot_availability_by_time = occupancy_ctx.get("slot_availability_by_time") if occupancy_ctx else None

        return {
            "competitor_pricing":         area_avg,
            "area_occupancy":             occupancy_signal,
            "pricing_alerts":             pricing_alerts,
            "tonight_busy":               tonight_busy,
            "competitor_deals":           competitor_deals,
            "pricing_impact":             pricing_impact,
            "category_pricing":           category_pricing,
            "competitor_landscape":       competitor_landscape,
            "positioning":                positioning,
            "menu_breadth":               menu_breadth,
            "cuisine_crowding":           cuisine_crowding,
            "veg_mix":                    veg_mix,
            "competitor_dineout_deals":   competitor_dineout_deals,
            "slot_deals_found":           slot_deals_found,
            "slot_availability_by_time":  slot_availability_by_time,
            "fetched_at":                 date.today().isoformat(),
        }

    async def _competitor_status(self) -> dict:
        """Distinguish "temporarily degraded, will retry" from "no data" when
        CompetitorEnricher returns None, so the frontend doesn't show the same
        blank state for both. Never raises — defaults to "no_data" on any error.
        """
        try:
            circuit_state = await get_state("swiggy", "food")
        except Exception:
            return {"state": "no_data", "resets_in_seconds": None}

        if circuit_state.get("state") == "open":
            return {
                "state": "degraded_circuit_open",
                "resets_in_seconds": circuit_state.get("resets_in_seconds"),
            }
        return {"state": "no_data", "resets_in_seconds": None}

    @staticmethod
    def _empty_result() -> dict:
        return {
            "swiggy_competitor_context": None,
            "swiggy_occupancy_context":  None,
            "market_intel_output": {
                "competitor_pricing":       None,
                "area_occupancy":           None,
                "pricing_alerts":           [],
                "tonight_busy":             None,
                "competitor_deals":         None,
                "pricing_impact":           None,
                "category_pricing":         None,
                "competitor_landscape":     None,
                "positioning":              None,
                "menu_breadth":             None,
                "cuisine_crowding":         None,
                "veg_mix":                  None,
                "competitor_dineout_deals": None,
                "slot_deals_found":         None,
                "slot_availability_by_time": None,
                "fetched_at":               date.today().isoformat(),
            },
        }
