"""OccupancyEnricher — P6-S08.

Fetches live competitor Dineout slot availability at planning time and injects
an occupancy signal into the reservation node prompt.

Flow:
  get_saved_locations() → lat/lng + location id
  → search_restaurants_dineout(cuisine) → up to 5 AVAILABLE competitors
  → get_available_slots(restaurantId, tonight) for up to MAX_SLOT_CALLS
  → compute HIGH/MEDIUM/LOW occupancy signal from average availabilityCount
  → cache Redis 30 min (key: enricher:occupancy:{org_id}:{date})
  → return dict or None on any failure

IMPORTANT: Dineout uses lat/lng from get_saved_locations.
           Do NOT pass Food/Instamart addressId to Dineout tools.
"""

import json
from datetime import date
from typing import Optional

import redis.asyncio as aioredis
import structlog

from app.core.settings import get_settings
from app.infrastructure.swiggy.client import DINEOUT_ENDPOINT, SwiggyMCPClient

# structlog, not stdlib logging — see procurement.py for why.
log = structlog.get_logger()

_CACHE_TTL       = 1800  # 30 minutes
_MAX_SLOT_CALLS  = 3     # hard rate-limit per planning run
_DINNER_HOURS    = {"19:00", "19:30", "20:00", "20:30", "21:00", "21:30"}  # hhmm 24h
_HIGH_THRESHOLD  = 2     # avg availabilityCount <= this → HIGH occupancy
_LOW_THRESHOLD   = 5     # avg availabilityCount > this → LOW occupancy


class OccupancyEnricher:
    """Live area occupancy signal from Swiggy Dineout MCP.

    Returns None on any failure so reservation node runs without it.
    """

    def __init__(self, client: SwiggyMCPClient) -> None:
        self._client = client
        self._redis: Optional[aioredis.Redis] = None

    # ── public ──────────────────────────────────────────────────────────────

    async def enrich(self, context: dict) -> Optional[dict]:
        """Return live occupancy context or None on any failure.

        context keys used:
          org_id    int  — cache scoping
          cuisine   str  — e.g. "North Indian" (default "restaurant")

        Returns:
          {
            "occupancy_signal": "HIGH" | "MEDIUM" | "LOW",
            "tonight_busy":     bool,
            "competitors_checked": int,
            "avg_availability_count": float,
            "prompt_text": "## Occupancy Signal\\n...",
            "fetched_at": "2026-06-30",
          }
          or None.
        """
        try:
            return await self._enrich(context)
        except Exception as exc:
            log.warning("occupancy_enricher_error", error=str(exc))
            return None

    # ── internal ─────────────────────────────────────────────────────────────

    async def _enrich(self, context: dict) -> Optional[dict]:
        org_id  = int(context.get("org_id") or 0)
        cuisine = str(context.get("cuisine") or "restaurant")
        today   = date.today().isoformat()

        cache_key = f"enricher:occupancy:{org_id}:{today}"
        cached = await self._cache_get(cache_key)
        if cached is not None:
            log.info("occupancy_enricher_cache_hit", cache_key=cache_key)
            return cached

        # Step 1 — resolve Dineout location (lat/lng)
        location = await self._get_location()
        if not location:
            return None

        lat = location["lat"]
        lng = location["lng"]
        loc_id = location["id"]

        # Step 2 — find nearby available competitors
        competitors = await self._get_competitors(cuisine, loc_id)
        if not competitors:
            return None

        # Step 3 — get tonight's slot availability for up to MAX_SLOT_CALLS
        availability_counts = await self._fetch_slot_counts(competitors, today, lat, lng)
        if not availability_counts:
            return None

        # Step 4 — compute signal
        avg_count = sum(availability_counts) / len(availability_counts)
        signal    = self._compute_signal(avg_count)

        result = {
            "occupancy_signal":        signal,
            "tonight_busy":            signal == "HIGH",
            "competitors_checked":     len(availability_counts),
            "avg_availability_count":  round(avg_count, 2),
            "prompt_text":             self._build_prompt(signal, len(availability_counts), avg_count),
            "fetched_at":              today,
        }

        await self._cache_set(cache_key, result)
        log.info(
            "occupancy_enricher_done",
            signal=signal, competitors=len(availability_counts), avg_slots=round(avg_count, 1),
        )
        return result

    async def _get_location(self) -> Optional[dict]:
        """Call get_saved_locations and return the first location with lat/lng."""
        data = await self._client.call_tool(DINEOUT_ENDPOINT, "get_saved_locations", {})
        if not data:
            return None
        locations = data.get("locations") or []
        for loc in locations:
            if loc.get("lat") and loc.get("lng"):
                return {"id": str(loc["id"]), "lat": float(loc["lat"]), "lng": float(loc["lng"])}
        return None

    async def _get_competitors(self, cuisine: str, location_id: str) -> list[dict]:
        """Search for nearby available Dineout restaurants by cuisine."""
        data = await self._client.call_tool(
            DINEOUT_ENDPOINT,
            "search_restaurants_dineout",
            {"query": cuisine, "addressId": location_id, "entityType": "CUISINE"},
        )
        if not data:
            return []
        restaurants = data.get("restaurants") or []
        available = [r for r in restaurants if r.get("availability") == "AVAILABLE"]
        return available[:_MAX_SLOT_CALLS]

    async def _fetch_slot_counts(
        self, competitors: list[dict], tonight: str, lat: float, lng: float
    ) -> list[float]:
        """Fetch availabilityCount for each competitor's tonight slots.

        Returns a flat list of counts across all restaurants — one entry per
        dinner-hour slot found, capped at MAX_SLOT_CALLS restaurants queried.
        """
        counts: list[float] = []
        queried = 0

        for restaurant in competitors:
            if queried >= _MAX_SLOT_CALLS:
                break
            r_id = restaurant.get("id") or restaurant.get("restaurantId")
            if not r_id:
                continue

            data = await self._client.call_tool(
                DINEOUT_ENDPOINT,
                "get_available_slots",
                {
                    "restaurantId": str(r_id),
                    "date":         tonight,
                    "latitude":     lat,
                    "longitude":    lng,
                },
            )
            queried += 1

            if not data:
                continue

            slots = data.get("slots") or []
            for slot in slots:
                if self._is_dinner_slot(slot.get("displayTime") or ""):
                    count = slot.get("availabilityCount")
                    if count is not None:
                        counts.append(float(count))

        return counts

    def _is_dinner_slot(self, display_time: str) -> bool:
        """Check if a slot displayTime falls in dinner service hours."""
        try:
            parts = display_time.lower().replace(".", "").strip().split()
            if len(parts) < 2:
                return False
            time_part, meridiem = parts[0], parts[1]
            hh, mm = (int(x) for x in time_part.split(":"))
            if meridiem == "pm" and hh != 12:
                hh += 12
            hhmm = f"{hh:02d}:{mm:02d}"
            return hhmm in _DINNER_HOURS
        except Exception:
            return False

    def _compute_signal(self, avg_count: float) -> str:
        if avg_count <= _HIGH_THRESHOLD:
            return "HIGH"
        if avg_count <= _LOW_THRESHOLD:
            return "MEDIUM"
        return "LOW"

    def _build_prompt(self, signal: str, competitors: int, avg_count: float) -> str:
        signal_desc = {
            "HIGH":   "Most nearby competitors are nearly full tonight.",
            "MEDIUM": "Nearby competitors have moderate availability tonight.",
            "LOW":    "Nearby competitors have ample availability tonight.",
        }[signal]

        lines = [
            "## Occupancy Signal",
            f"Area tonight: **{signal}** (based on {competitors} nearby Dineout competitor(s), "
            f"avg {avg_count:.1f} slots remaining per dinner time slot).",
            signal_desc,
        ]
        if signal == "HIGH":
            lines.append(
                "Recommendation: consider opening additional Dineout slots "
                "or increasing walk-in capacity for tonight."
            )
        return "\n".join(lines)

    # ── Redis helpers ─────────────────────────────────────────────────────────

    async def _get_redis(self) -> aioredis.Redis:
        if self._redis is None:
            self._redis = aioredis.from_url(
                get_settings().redis_url,
                encoding="utf-8",
                decode_responses=True,
            )
        return self._redis

    async def _cache_get(self, key: str) -> Optional[dict]:
        try:
            r = await self._get_redis()
            raw = await r.get(key)
            return json.loads(raw) if raw else None
        except Exception as exc:
            log.debug("occupancy_enricher_cache_get_error", error=str(exc))
            return None

    async def _cache_set(self, key: str, value: dict) -> None:
        try:
            r = await self._get_redis()
            await r.setex(key, _CACHE_TTL, json.dumps(value, default=str))
        except Exception as exc:
            log.debug("occupancy_enricher_cache_set_error", error=str(exc))
