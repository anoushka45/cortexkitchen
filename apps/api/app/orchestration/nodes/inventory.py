"""
Inventory & Waste Agent node — P2-02.

Replaces the Phase 1 stub with a real InventoryService call.
Cross-references stock levels against the demand forecast to surface
shortage and overstock alerts, then asks the LLM for operational actions.

Writes to state['inventory_output'].
"""

from sqlalchemy.orm import Session

from app.orchestration.state import OrchestratorState
from app.domain.services.inventory_service import InventoryService
from app.infrastructure.llm.base import BaseLLMProvider
from app.infrastructure.swiggy.client import SwiggyMCPClient
from app.infrastructure.swiggy.enrichers.procurement import ProcurementEnricher


async def inventory_node(
    state: OrchestratorState,
    db: Session,
    llm: BaseLLMProvider,
    swiggy_client: SwiggyMCPClient | None = None,
) -> OrchestratorState:
    """
    Detects stock pressure and waste risk using real inventory data.
    Writes to state['inventory_output'].
    """
    if state.get("error"):
        return state

    llm = (state.get("llm_registry") or {}).get("fast") or llm

    if state.get("debug") and state.get("execution_trace") is not None:
        state["execution_trace"].append("inventory")

    try:
        if state.get("simulation_mode", False):
            sim_output = {
                "service": "inventory",
                "data": {
                    "total_items_checked": 10,
                    "shortage_alerts": [
                        {
                            "ingredient":        "Mozzarella",
                            "unit":              "kg",
                            "quantity_in_stock": 3.5,
                            "reorder_threshold": 8.0,
                            "shortfall":         4.5,
                            "spoilage_risk":     True,
                            "severity":          "critical",
                        }
                    ],
                    "overstock_alerts": [],
                    "high_demand_week": True,
                    "demand_ratio":     1.2,
                },
                "recommendation": {
                    "restock_actions":       ["Order 10kg Mozzarella immediately"],
                    "waste_reduction_actions": [],
                    "priority":              "high",
                    "reasoning":             "Critical shortage on high-demand week.",
                    "risks":                 ["Unable to fulfil pizza orders during peak hours"],
                },
            }
            sim_data = sim_output["data"]
            return {
                **state,
                "inventory_output": sim_output,
                "inventory_assumptions": {
                    "items_flagged_low": [
                        a["ingredient"] for a in (sim_data.get("shortage_alerts") or [])
                        if isinstance(a, dict) and a.get("ingredient")
                    ],
                    "items_flagged_overstock": [
                        a["ingredient"] for a in (sim_data.get("overstock_alerts") or [])
                        if isinstance(a, dict) and a.get("ingredient")
                    ],
                },
            }

        # Pull forecast data from state to compute demand ratio
        forecast_data = None
        forecast_output = state.get("forecast_output")
        if forecast_output and isinstance(forecast_output, dict):
            forecast_data = forecast_output.get("data")

        service = InventoryService(db=db, llm=llm)
        result  = await service.analyse_and_recommend(
            forecast_data=forecast_data,
            scenario_profile=state.get("scenario_profile"),
            procurement_context=state.get("swiggy_procurement_options"),
        )
        data = result.get("data") or {}

        shortage_names = [
            a["ingredient"] for a in (data.get("shortage_alerts") or [])
            if isinstance(a, dict) and a.get("ingredient")
        ]

        # Run ProcurementEnricher now that we know the actual shortage items.
        # Must happen here (post-analysis) — market_intel_node runs in parallel
        # and doesn't have shortage data yet.
        procurement_ctx = None
        if swiggy_client and swiggy_client.is_available() and shortage_names:
            enricher = ProcurementEnricher(swiggy_client)
            procurement_ctx = await enricher.enrich({
                "org_id":         state.get("org_id") or 0,
                "shortage_items": shortage_names,
            })

        return {
            **state,
            "inventory_output": result,
            "swiggy_procurement_options": procurement_ctx,
            "inventory_assumptions": {
                "items_flagged_low":      shortage_names,
                "items_flagged_overstock": [
                    a["ingredient"] for a in (data.get("overstock_alerts") or [])
                    if isinstance(a, dict) and a.get("ingredient")
                ],
            },
        }

    except Exception as exc:
        return {
            **state,
            "inventory_output": {
                "service": "inventory",
                "error":   str(exc),
                "data":    None,
                "recommendation": None,
            },
            "inventory_assumptions": None,
        }
