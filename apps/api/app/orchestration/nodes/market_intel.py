"""market_intel_node — P6-S11.

10th LangGraph node. Runs in parallel with reservation / complaint_intelligence
/ inventory in the fan-out from qdrant_enrichment, then fans in to
menu_intelligence alongside the other three.

Calls MarketIntelService which runs CompetitorEnricher + OccupancyEnricher +
ProcurementEnricher concurrently. All three outputs are written to state so:
  - aggregator/critic receive full market context (market_intel_output)
  - menu_intelligence can read swiggy_competitor_context for the Market Context
    section it injects into its LLM prompt
  - reservation can read swiggy_occupancy_context for the Occupancy Signal section
  - swiggy_procurement_options provides go_to_items context (shortage-specific
    options come from inventory_node calling ProcurementEnricher with actual
    shortage_items after its own analysis completes)

Fails open: returns state unchanged (no market context) if Swiggy is unavailable.
"""

from app.orchestration.state import OrchestratorState
from app.domain.services.market_intel_service import MarketIntelService
from app.infrastructure.swiggy.client import SwiggyMCPClient


async def market_intel_node(
    state: OrchestratorState,
    swiggy_client: SwiggyMCPClient,
) -> OrchestratorState:
    """
    Fetches live Swiggy market intelligence and writes it to state.
    Never raises — returns state unchanged on any failure or missing token.
    """
    if state.get("error"):
        return state

    if not swiggy_client.is_available():
        return {
            **state,
            "market_intel_output": None,
            "market_intel_assumptions": {"swiggy_available": False},
        }

    scenario_profile = state.get("scenario_profile") or {}
    context = {
        "org_id":  state.get("org_id") or 0,
        "cuisine": scenario_profile.get("cuisine") or "restaurant",
        # address_id falls back to settings.swiggy_address_id inside each enricher
    }

    service = MarketIntelService(swiggy_client)
    result  = await service.run(context)

    market_intel = result.get("market_intel_output") or {}
    assumptions = {
        "swiggy_available":             True,
        "assumed_competitor_avg_price": market_intel.get("competitor_pricing"),
        "assumed_area_occupancy":       market_intel.get("area_occupancy"),
        "pricing_alerts_count":         len(market_intel.get("pricing_alerts") or []),
        "tonight_busy":                 market_intel.get("tonight_busy"),
        "fetched_at":                   market_intel.get("fetched_at"),
    }

    return {
        **state,
        "swiggy_competitor_context": result.get("swiggy_competitor_context"),
        "swiggy_occupancy_context":  result.get("swiggy_occupancy_context"),
        "market_intel_output":       market_intel,
        "market_intel_assumptions":  assumptions,
    }
