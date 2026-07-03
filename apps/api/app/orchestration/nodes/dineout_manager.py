"""dineout_manager_node — P6-S12.

11th LangGraph node. Runs in parallel with reservation / complaint_intelligence
/ inventory / market_intel in the fan-out from qdrant_enrichment.

IMPORTANT — Swiggy MCP is 100% consumer-facing (confirmed from Swiggy Builders Club docs).
This means:

  WHAT WORKS with consumer API:
  - get_available_slots(restaurantId=OUR_ID) → reads YOUR restaurant's public slot
    visibility as any consumer would see it. Valid if SWIGGY_DINEOUT_RESTAURANT_ID is set.

  WHAT DOES NOT WORK (needs Swiggy Partner API — not in Builders Club):
  - Opening / closing your own Dineout slots
  - Seeing your incoming bookings / guest list
  - book_table does NOT open slots at your own restaurant — it books a table FOR
    a consumer AT a restaurant. "Open more slots" via book_table is architecturally wrong.

Current behaviour:
  get_saved_locations() → lat/lng
  get_available_slots(restaurantId=OUR_ID, date=tonight, lat, lng)
  → assess how many dinner slots are visible to consumers tonight
  → write dineout_manager_output + dineout_manager_assumptions to state

FUTURE USE (needs Swiggy Partner API): actual slot management — open/close slots,
view incoming reservation list, manage table inventory.

Degrades gracefully to None when SWIGGY_DINEOUT_RESTAURANT_ID not set or any failure.
"""

import asyncio
from datetime import date
from typing import Optional

import structlog

from app.core.settings import get_settings
from app.infrastructure.swiggy.client import DINEOUT_ENDPOINT, SwiggyMCPClient
from app.orchestration.state import OrchestratorState

# structlog, not stdlib logging — see infrastructure/swiggy/enrichers/procurement.py for why.
log = structlog.get_logger()

_DINNER_HOURS = {"19:00", "19:30", "20:00", "20:30", "21:00", "21:30"}
_LOW_SLOT_THRESHOLD = 3   # availabilityCount <= this → slot considered low
_OPEN_MORE_RATIO    = 0.5  # if > 50% of tonight's slots are low → recommend opening more


async def dineout_manager_node(
    state: OrchestratorState,
    swiggy_client: SwiggyMCPClient,
) -> OrchestratorState:
    """
    Checks own Dineout slot availability for tonight and writes assessment to state.
    Never raises — returns state unchanged on any failure or missing config.
    """
    if state.get("error"):
        return state

    if not swiggy_client.is_available():
        return {
            **state,
            "dineout_manager_output": None,
            "dineout_manager_assumptions": {"swiggy_available": False},
        }

    try:
        result = await _check_own_slots(state, swiggy_client)
    except Exception as exc:
        log.warning("dineout_manager_node_error", error=str(exc))
        result = None

    if result is None:
        return {
            **state,
            "dineout_manager_output": None,
            "dineout_manager_assumptions": {"swiggy_available": True, "own_slots_checked": False},
        }

    assumptions = {
        "swiggy_available":          True,
        "own_slots_checked":         True,
        "assumed_dineout_slots_low": result.get("open_more_recommended", False),
        "assumed_slots_tonight":     result.get("total_slots_tonight", 0),
        "low_availability_slots":    result.get("low_availability_slots", 0),
        "fetched_at":                result.get("fetched_at"),
    }

    return {
        **state,
        "dineout_manager_output":    result,
        "dineout_manager_assumptions": assumptions,
    }


# ── internal ─────────────────────────────────────────────────────────────────

async def _check_own_slots(
    state: OrchestratorState,
    client: SwiggyMCPClient,
) -> Optional[dict]:
    settings = get_settings()

    # Resolve our Dineout restaurant ID — settings → restaurant_profile → fail
    restaurant_profile = state.get("restaurant_profile") or {}
    our_r_id = (
        restaurant_profile.get("dineout_restaurant_id")
        or settings.swiggy_dineout_restaurant_id
        or ""
    )
    if not our_r_id:
        log.info("dineout_manager_no_restaurant_id", hint="set SWIGGY_DINEOUT_RESTAURANT_ID to enable")
        return None

    # Step 1 — resolve Dineout lat/lng (same pattern as OccupancyEnricher)
    location = await _get_location(client)
    if not location:
        return None

    tonight = date.today().isoformat()

    # Step 2 — get our own slot availability tonight
    data = await client.call_tool(
        DINEOUT_ENDPOINT,
        "get_available_slots",
        {
            "restaurantId": str(our_r_id),
            "date":         tonight,
            "latitude":     location["lat"],
            "longitude":    location["lng"],
        },
    )
    if not data:
        return None

    slots = data.get("slots") or []
    dinner_slots = [s for s in slots if _is_dinner_slot(s.get("displayTime") or "")]

    if not dinner_slots:
        return {
            "total_slots_tonight":    0,
            "low_availability_slots": 0,
            "open_more_recommended":  False,
            "prompt_text":            "No Dineout dinner slots found for tonight.",
            "fetched_at":             tonight,
        }

    low_slots = [
        s for s in dinner_slots
        if (s.get("availabilityCount") or 0) <= _LOW_SLOT_THRESHOLD
    ]
    low_ratio = len(low_slots) / len(dinner_slots)
    open_more = low_ratio > _OPEN_MORE_RATIO

    result = {
        "total_slots_tonight":    len(dinner_slots),
        "low_availability_slots": len(low_slots),
        "open_more_recommended":  open_more,
        "slot_details": [
            {
                "time":              s.get("displayTime"),
                "availability_count": s.get("availabilityCount"),
            }
            for s in dinner_slots
        ],
        "prompt_text": _build_prompt(len(dinner_slots), len(low_slots), open_more),
        "fetched_at":  tonight,
    }

    log.info(
        "dineout_manager_done",
        total=len(dinner_slots), low=len(low_slots), open_more=open_more,
    )
    return result


async def _get_location(client: SwiggyMCPClient) -> Optional[dict]:
    data = await client.call_tool(DINEOUT_ENDPOINT, "get_saved_locations", {})
    if not data:
        return None
    for loc in data.get("locations") or []:
        if loc.get("lat") and loc.get("lng"):
            return {"lat": float(loc["lat"]), "lng": float(loc["lng"])}
    return None


def _is_dinner_slot(display_time: str) -> bool:
    try:
        parts = display_time.lower().replace(".", "").strip().split()
        if len(parts) < 2:
            return False
        time_part, meridiem = parts[0], parts[1]
        hh, mm = (int(x) for x in time_part.split(":"))
        if meridiem == "pm" and hh != 12:
            hh += 12
        return f"{hh:02d}:{mm:02d}" in _DINNER_HOURS
    except Exception:
        return False


def _build_prompt(total: int, low: int, open_more: bool) -> str:
    lines = ["## Your Dineout Availability Tonight"]
    lines.append(f"Dinner slots: {total} total, {low} with low availability (≤{_LOW_SLOT_THRESHOLD} seats).")
    if open_more:
        lines.append(
            "Recommendation: consider opening additional Dineout slots — "
            f"{low}/{total} dinner-hour slots are nearly full."
        )
    else:
        lines.append("Dineout capacity appears adequate for tonight.")
    return "\n".join(lines)
