"""CompetitorEnricher — P6-S07.

Fetches live competitor pricing from Swiggy Food MCP at planning time and injects
it into the menu_intelligence node prompt as a Market Context section.

Flow:
  search_restaurants(cuisine) → up to 3 open competitors
  → get_restaurant_menu(restaurantId) for each  [max MAX_MENU_CALLS]
  → build area averages + pricing alerts vs our menu
  → cache in Redis 30 min (key: enricher:competitor:{org_id}:{date})
  → return dict or None on any failure

The returned dict is injected by menu_intelligence node as:
  "## Market Context\n{prompt_text}"
"""

import json
import logging
from datetime import date
from typing import Optional

import redis.asyncio as aioredis

from app.core.settings import get_settings
from app.infrastructure.swiggy.client import FOOD_ENDPOINT, SwiggyMCPClient

log = logging.getLogger(__name__)

_CACHE_TTL = 1800        # 30 minutes
_MAX_MENU_CALLS = 3      # hard rate-limit per planning run
_ALERT_THRESHOLD = 0.10  # flag our price if > 10% above area avg


class CompetitorEnricher:
    """Live competitor pricing from Swiggy Food MCP.

    Instantiate once per planning run. enrich() is the only public method.
    Returns None on any failure so callers never need try/except.
    """

    def __init__(self, client: SwiggyMCPClient) -> None:
        self._client = client
        self._redis: Optional[aioredis.Redis] = None

    # ── public ──────────────────────────────────────────────────────────────

    async def enrich(self, context: dict) -> Optional[dict]:
        """Fetch live competitor pricing and return structured market context.

        context keys used:
          org_id       int   — for cache scoping
          address_id   str   — Swiggy addressId (falls back to settings)
          cuisine      str   — e.g. "Indian" or "North Indian" (default "restaurant")
          our_items    list  — [{"name": str, "price": float}, ...] for alert generation

        Returns:
          {
            "area_avg":   {"butter chicken": 280.0, ...},
            "cheapest":   {"butter chicken": {"price": 240.0, "restaurant": "KFC"}},
            "restaurants": ["Name A", "Name B"],
            "alerts":     ["Your Margherita is 14% above the area average (Rs.240)"],
            "prompt_text": "## Market Context\n...",
            "fetched_at": "2026-06-30",
          }
          or None if Swiggy is unreachable or returns no usable data.
        """
        try:
            return await self._enrich(context)
        except Exception as exc:
            log.warning("competitor_enricher_error: %s", exc)
            return None

    # ── internal ─────────────────────────────────────────────────────────────

    async def _enrich(self, context: dict) -> Optional[dict]:
        org_id     = int(context.get("org_id") or 0)
        address_id = str(context.get("address_id") or get_settings().swiggy_address_id or "")
        cuisine    = str(context.get("cuisine") or "restaurant")
        our_items  = list(context.get("our_items") or [])

        if not address_id:
            log.warning("competitor_enricher_no_address_id")
            return None

        cache_key = f"enricher:competitor:{org_id}:{date.today().isoformat()}"
        cached = await self._cache_get(cache_key)
        if cached is not None:
            log.info("competitor_enricher_cache_hit key=%s", cache_key)
            return cached

        # Step 1 — find nearby open competitors
        restaurants = await self._get_open_competitors(address_id, cuisine)
        if not restaurants:
            return None

        # Step 2 — pull menus (max MAX_MENU_CALLS)
        competitor_menus = await self._fetch_menus(address_id, restaurants)
        if not competitor_menus:
            return None

        # Step 3 — compute area averages and alerts
        area_avg, cheapest = self._compute_averages(competitor_menus)
        alerts = self._generate_alerts(area_avg, our_items)
        restaurant_names = [c["name"] for c in competitor_menus]

        result = {
            "area_avg":    area_avg,
            "cheapest":    cheapest,
            "restaurants": restaurant_names,
            "alerts":      alerts,
            "prompt_text": self._build_prompt(area_avg, cheapest, alerts, restaurant_names, our_items),
            "fetched_at":  date.today().isoformat(),
        }

        await self._cache_set(cache_key, result)
        log.info(
            "competitor_enricher_done restaurants=%d dishes=%d alerts=%d",
            len(restaurant_names), len(area_avg), len(alerts),
        )
        return result

    async def _get_open_competitors(self, address_id: str, cuisine: str) -> list[dict]:
        data = await self._client.call_tool(
            FOOD_ENDPOINT,
            "search_restaurants",
            {"addressId": address_id, "query": cuisine},
        )
        if not data:
            return []
        restaurants = data.get("restaurants") or []
        open_only = [r for r in restaurants if r.get("availabilityStatus") == "OPEN"]
        return open_only[:_MAX_MENU_CALLS]

    async def _fetch_menus(self, address_id: str, restaurants: list[dict]) -> list[dict]:
        results = []
        for restaurant in restaurants:
            r_id   = restaurant.get("id") or restaurant.get("restaurantId")
            r_name = restaurant.get("name", "Unknown")
            if not r_id:
                continue
            menu = await self._client.call_tool(
                FOOD_ENDPOINT,
                "get_restaurant_menu",
                {"addressId": address_id, "restaurantId": str(r_id)},
            )
            if menu:
                results.append({"name": r_name, "menu": menu})
            if len(results) >= _MAX_MENU_CALLS:
                break
        return results

    def _compute_averages(
        self, competitor_menus: list[dict]
    ) -> tuple[dict[str, float], dict[str, dict]]:
        """Build {dish_name: avg_price} and {dish_name: {price, restaurant}} dicts."""
        price_lists: dict[str, list[float]] = {}
        cheapest_map: dict[str, dict] = {}

        for competitor in competitor_menus:
            r_name = competitor["name"]
            menu   = competitor["menu"]
            categories = menu.get("categories") or menu.get("menu") or []

            for category in categories:
                items = category.get("items") or []
                for item in items:
                    name  = str(item.get("name") or "").strip().lower()
                    price = self._extract_price(item)
                    if not name or price <= 0:
                        continue

                    price_lists.setdefault(name, []).append(price)

                    if name not in cheapest_map or price < cheapest_map[name]["price"]:
                        cheapest_map[name] = {"price": price, "restaurant": r_name}

        area_avg = {
            name: round(sum(prices) / len(prices), 2)
            for name, prices in price_lists.items()
            if prices
        }
        return area_avg, cheapest_map

    def _extract_price(self, item: dict) -> float:
        """Extract the base price from an item, handling variant shapes."""
        price = item.get("price") or item.get("defaultPrice") or 0
        if price:
            return float(price)

        # variantsV2 shape
        variants_v2 = item.get("variantsV2") or {}
        variant_groups = variants_v2.get("variantGroups") or []
        for group in variant_groups:
            for v in group.get("variations") or []:
                if v.get("price"):
                    return float(v["price"])

        # variations shape
        for variation in item.get("variations") or []:
            if variation.get("price"):
                return float(variation["price"])

        return 0.0

    def _generate_alerts(self, area_avg: dict[str, float], our_items: list[dict]) -> list[str]:
        """Flag our items priced significantly above the area average."""
        alerts = []
        for our_item in our_items:
            name       = str(our_item.get("name") or "").strip().lower()
            our_price  = float(our_item.get("price") or 0)
            avg_price  = area_avg.get(name)

            if not avg_price or our_price <= 0:
                continue

            pct_above = (our_price - avg_price) / avg_price
            if pct_above > _ALERT_THRESHOLD:
                alerts.append(
                    f"Your {our_item['name']} (Rs.{our_price:.0f}) is "
                    f"{pct_above * 100:.0f}% above the area average (Rs.{avg_price:.0f})."
                )
        return alerts

    def _build_prompt(
        self,
        area_avg: dict[str, float],
        cheapest: dict[str, dict],
        alerts: list[str],
        restaurant_names: list[str],
        our_items: list[dict],
    ) -> str:
        lines = ["## Market Context", f"Competitors checked: {', '.join(restaurant_names)}", ""]

        if alerts:
            lines.append("**Pricing alerts:**")
            lines.extend(f"- {a}" for a in alerts)
            lines.append("")

        if area_avg:
            lines.append("**Area average prices (from Swiggy):**")
            our_price_map = {
                str(i.get("name") or "").strip().lower(): float(i.get("price") or 0)
                for i in our_items
            }
            for dish, avg in sorted(area_avg.items())[:15]:  # cap at 15 dishes
                our_p = our_price_map.get(dish)
                cheapest_entry = cheapest.get(dish, {})
                row = f"- {dish.title()}: area avg Rs.{avg:.0f}"
                if cheapest_entry:
                    row += f", cheapest Rs.{cheapest_entry['price']:.0f} at {cheapest_entry['restaurant']}"
                if our_p:
                    row += f", your price Rs.{our_p:.0f}"
                lines.append(row)

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
            log.debug("competitor_enricher_cache_get_error: %s", exc)
            return None

    async def _cache_set(self, key: str, value: dict) -> None:
        try:
            r = await self._get_redis()
            await r.setex(key, _CACHE_TTL, json.dumps(value, default=str))
        except Exception as exc:
            log.debug("competitor_enricher_cache_set_error: %s", exc)
