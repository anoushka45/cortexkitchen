"""CompetitorEnricher — P6-S07.

Fetches live competitor pricing from Swiggy Food MCP at planning time and injects
it into the menu_intelligence node prompt as a Market Context section.

Flow:
  search_restaurants(cuisine) → up to 5 open, ORGANIC (non-ad) competitors
  → get_restaurant_menu(restaurantId) for each  [max MAX_MENU_CALLS]
  → classify every dish found by keyword (pizza/pasta/burger/sides/dessert/beverage),
    independent of exact dish naming — this is the PRIMARY analysis signal
  → exact dish-name matches against our own menu, when they happen to occur, produce
    a bonus pricing-impact readout — but are never the basis for the headline verdict
  → fetch_food_coupons for competitor deals, extract landscape (rating/cost/distance),
    compute market positioning (rank among competitors by estimated cost-for-two)
  → cache in Redis 30 min (key: enricher:competitor:{org_id}:{date})
  → return dict or None on any failure

The returned dict is injected by menu_intelligence node as:
  "## Market Context\n{prompt_text}"
"""

import json
import re
from datetime import date
from typing import Optional

import redis.asyncio as aioredis
import structlog

from app.core.settings import get_settings
from app.infrastructure.swiggy.client import FOOD_ENDPOINT, SwiggyMCPClient

# structlog, not stdlib logging — see procurement.py for why.
log = structlog.get_logger()

_CACHE_TTL = 1800        # 30 minutes
_MAX_MENU_CALLS = 3      # hard rate-limit per planning run
_ALERT_THRESHOLD = 0.10  # flag our price if > 10% above area avg
_MAX_COUPON_CALLS = 3    # hard rate-limit: max fetch_food_coupons calls per run (P6-MI06)
_PRICING_ELASTICITY = -0.8      # demand elasticity: 8% volume change per 10% price change (P6-MI09)
_AVG_ORDERS_PER_WEEK = 150       # default weekly order volume used for revenue impact estimate
_AVG_ORDER_VALUE = 350.0         # INR default average order value
_MAX_LANDSCAPE_ENTRIES = 15      # cap for the competitor landscape chart (display only, not a rate limit)

# Dish-name keyword classification, used to bucket EVERY competitor dish into our own
# category vocabulary regardless of how any given restaurant names or sections its menu.
# This replaces exact dish-name matching as the basis for category analysis -- exact
# names essentially never align across restaurants ("Four Cheese" vs "double cheese
# garden fresh veggie pizza"), but keyword-in-name classification works for both.
_CATEGORY_KEYWORDS: dict[str, tuple[str, ...]] = {
    "pizza":    ("pizza",),
    "pasta":    ("pasta", "penne", "spaghetti", "macaroni", "fusilli", "lasagna", "noodle", "linguine"),
    "burger":   ("burger", "sandwich"),
    "sides":    ("fries", "wedges", "garlic bread", "starter", "appetizer", "wings", "nugget", "salad"),
    "dessert":  ("brownie", "cake", "tiramisu", "dessert", "ice cream", "gelato", "pastry"),
    "beverage": ("shake", "juice", "soda", "cola", "lemonade", "coffee", "tea", "smoothie", "beverage", "mocktail"),
}


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
            log.warning("competitor_enricher_error", error=str(exc))
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
            log.info("competitor_enricher_cache_hit", cache_key=cache_key)
            return cached

        # Step 1 — find nearby open competitors
        restaurants = await self._get_open_competitors(address_id, cuisine)
        if not restaurants:
            return None

        # Step 2 — pull menus (max MAX_MENU_CALLS)
        competitor_menus = await self._fetch_menus(address_id, restaurants)
        if not competitor_menus:
            return None

        # Step 3 — compute area averages (dish-name AND category-level) and alerts
        area_avg, cheapest, category_prices = self._compute_averages(competitor_menus)
        alerts = self._generate_alerts(area_avg, our_items)
        restaurant_names = [c["name"] for c in competitor_menus]

        # Step 4 — competitor Swiggy deals (P6-MI06), category-level pricing (primary
        # signal — dish-name independent), pricing impact (bonus, only when exact dish
        # names happen to match), and market positioning (ranks us among competitors).
        competitor_deals = await self._fetch_competitor_deals(address_id, restaurants)
        category_pricing = self._compute_category_pricing(category_prices, our_items)
        pricing_impact   = self._compute_pricing_impact(area_avg, our_items)
        # rating/costForTwo/distanceKm are already in the search_restaurants response
        # (Step 1) — just retained here instead of discarded, zero extra API calls.
        competitor_landscape = self._extract_landscape(restaurants)
        positioning = self._compute_positioning(competitor_landscape, our_items)
        # Market context signals -- all derived from data already fetched, zero extra calls.
        menu_breadth    = self._compute_menu_breadth(competitor_menus, our_items)
        cuisine_crowding = self._compute_cuisine_crowding(restaurants, cuisine)
        veg_mix         = self._compute_veg_mix(restaurants)

        result = {
            "area_avg":              area_avg,
            "cheapest":              cheapest,
            "competitor_deals":      competitor_deals,
            "pricing_impact":        pricing_impact,
            "category_pricing":      category_pricing,
            "competitor_landscape":  competitor_landscape,
            "positioning":           positioning,
            "menu_breadth":          menu_breadth,
            "cuisine_crowding":      cuisine_crowding,
            "veg_mix":               veg_mix,
            "restaurants":           restaurant_names,
            "alerts":                alerts,
            "prompt_text": self._build_prompt(
                area_avg, cheapest, alerts, restaurant_names, our_items,
                competitor_deals, pricing_impact, category_pricing, positioning,
                menu_breadth, cuisine_crowding, veg_mix, competitor_landscape,
            ),
            "fetched_at":  date.today().isoformat(),
        }

        await self._cache_set(cache_key, result)
        log.info(
            "competitor_enricher_done",
            restaurants=len(restaurant_names), dishes=len(area_avg), alerts=len(alerts),
            categories=len(category_pricing), deals=len(competitor_deals),
        )
        return result

    async def _get_open_competitors(self, address_id: str, cuisine: str) -> list[dict]:
        """Return open, ORGANIC (non-sponsored) competitors from search_restaurants.

        Live testing found search_restaurants is dominated by sponsored placements —
        8 of the first 10 results for a generic query came back tagged "(Ad)" in the
        name, e.g. "Emma's Pizza Kitchen (Ad)". These are paid listings, not organic
        nearby competitive pressure, and pollute pricing/landscape data if included.
        Filters them out; if too few organic results remain on page 1, fetches a
        second page (offset) since organic listings do exist further down.

        Not capped here — _fetch_menus() and _fetch_competitor_deals() each already
        enforce their own rate limits internally. Keeping the full list available lets
        _extract_landscape() show more competitors on the market landscape chart at
        zero extra API cost (same response, just not thrown away).
        """
        organic: list[dict] = []
        seen_ids: set[str] = set()
        for offset in (0, 10):
            data = await self._client.call_tool(
                FOOD_ENDPOINT,
                "search_restaurants",
                {"addressId": address_id, "query": cuisine, "offset": offset},
            )
            if not data:
                break
            restaurants = data.get("restaurants") or []
            for r in restaurants:
                r_id = str(r.get("id") or r.get("restaurantId") or r.get("name") or "")
                if (
                    r.get("availabilityStatus") == "OPEN"
                    and not self._is_sponsored(r.get("name"))
                    and r_id not in seen_ids
                ):
                    seen_ids.add(r_id)
                    organic.append(r)
            if len(organic) >= 5 or not restaurants:
                break
        return organic

    def _is_sponsored(self, name: Optional[str]) -> bool:
        """True if a restaurant name is tagged as a sponsored/ad placement."""
        return bool(name) and "(ad)" in str(name).lower()

    def _extract_landscape(self, restaurants: list[dict]) -> list[dict]:
        """Build the detailed competitor landscape entries (rating, cost-for-two,
        distance, delivery time, cuisines, live offer, veg flag).

        All of these fields are already present in the search_restaurants response
        used in Step 1 — this just retains them instead of discarding them when
        building competitor_menus. Zero extra API calls.
        """
        landscape = []
        for r in restaurants[:_MAX_LANDSCAPE_ENTRIES]:
            name = r.get("name")
            rating = r.get("avgRating")
            cost_for_two = self._parse_cost_for_two(r.get("costForTwo"))
            if not name or rating is None or cost_for_two is None:
                continue
            landscape.append({
                "name":                str(name),
                "rating":              float(rating),
                "total_ratings":       str(r.get("totalRatings") or ""),
                "cost_for_two":        cost_for_two,
                "distance_km":         float(r.get("distanceKm") or 0),
                "delivery_time_range": str(r.get("deliveryTimeRange") or ""),
                "cuisines":            list(r.get("cuisines") or []),
                "offer":               str(r.get("offer") or ""),
                "veg":                 bool(r.get("veg", False)),
            })
        return landscape

    def _parse_cost_for_two(self, value) -> Optional[float]:
        """costForTwo comes back as a formatted string like '₹500 for two', not a
        number — extract the first digit run. Returns None if nothing parseable."""
        if value is None:
            return None
        if isinstance(value, (int, float)):
            return float(value)
        match = re.search(r"[\d,]+", str(value))
        if not match:
            return None
        return float(match.group(0).replace(",", ""))

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
    ) -> tuple[dict[str, float], dict[str, dict], dict[str, list[dict]]]:
        """Build {dish_name: avg_price}, {dish_name: {price, restaurant}}, and
        {category: [{name, price, restaurant}]} (keyword-classified, dish-name
        independent) dicts. The category dict keeps names+restaurant, not just
        prices, so downstream analysis can name the actual cheapest/priciest dish
        per category, not just report a number.
        """
        price_lists: dict[str, list[float]] = {}
        cheapest_map: dict[str, dict] = {}
        category_dishes: dict[str, list[dict]] = {}

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

                    bucket = self._classify_dish(name)
                    if bucket:
                        category_dishes.setdefault(bucket, []).append({
                            "name": str(item.get("name") or "").strip(),
                            "price": price,
                            "restaurant": r_name,
                        })

        area_avg = {
            name: round(sum(prices) / len(prices), 2)
            for name, prices in price_lists.items()
            if prices
        }
        return area_avg, cheapest_map, category_dishes

    def _classify_dish(self, name: str) -> Optional[str]:
        """Bucket a dish name into our category vocabulary via keyword match.

        Checked against the dish name itself, not the menu section it's filed
        under — competitor menu sections are inconsistently named ("Bestsellers",
        "Combo Meals") but dish names reliably contain the food-type word.
        """
        for bucket, keywords in _CATEGORY_KEYWORDS.items():
            if any(kw in name for kw in keywords):
                return bucket
        return None

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

    async def _fetch_competitor_deals(
        self, address_id: str, restaurants: list[dict]
    ) -> list[dict]:
        """Fetch live Swiggy coupons for each competitor restaurant.

        fetch_food_coupons returns PUBLIC promotional data regardless of account
        activity. Filtered to COD-compatible coupons (requiresOnlinePayment=False)
        since Builders Club v1 only supports COD checkout.
        """
        deals = []

        for restaurant in restaurants[:_MAX_COUPON_CALLS]:
            r_id   = restaurant.get("id") or restaurant.get("restaurantId")
            r_name = restaurant.get("name", "Unknown")
            if not r_id:
                continue

            data = await self._client.call_tool(
                FOOD_ENDPOINT,
                "fetch_food_coupons",
                {"restaurantId": str(r_id), "addressId": address_id},
            )
            if not data:
                continue

            all_coupons = (data.get("bestCoupons") or []) + (data.get("moreOffers") or [])

            for coupon in all_coupons:
                if coupon.get("requiresOnlinePayment"):
                    continue

                discount = coupon.get("discountAmount") or coupon.get("discountPercentage") or 0
                title    = str(coupon.get("title") or coupon.get("description") or "Deal")

                if discount > 0:
                    deals.append({
                        "restaurant":   r_name,
                        "restaurantId": str(r_id),
                        "deal_title":   title,
                        "discount":     discount,
                        "code":         coupon.get("code", ""),
                    })

        log.info("competitor_enricher_deals_done", deals_found=len(deals))
        return deals

    def _compute_pricing_impact(
        self, area_avg: dict[str, float], our_items: list[dict]
    ) -> list[dict]:
        """Quantify revenue impact of pricing gaps vs area average.

        Simple demand elasticity model: price_gap_pct * elasticity = volume_change_pct.
        Weekly revenue impact = avg_order_value * avg_orders_per_week * volume_change_pct.
        Ignores gaps under 5% as noise.
        """
        impacts = []
        for item in our_items:
            name      = str(item.get("name") or "").strip().lower()
            our_price = float(item.get("price") or 0)
            avg_price = area_avg.get(name)

            if not avg_price or our_price <= 0 or avg_price <= 0:
                continue

            gap_pct = (our_price - avg_price) / avg_price  # positive = we're more expensive
            if abs(gap_pct) < 0.05:
                continue

            volume_change_pct = gap_pct * _PRICING_ELASTICITY
            weekly_revenue_impact = _AVG_ORDER_VALUE * _AVG_ORDERS_PER_WEEK * volume_change_pct

            impacts.append({
                "item":                      item.get("name"),
                "our_price":                 our_price,
                "area_avg":                  avg_price,
                "gap_pct":                   round(gap_pct * 100, 1),
                "direction":                 "above" if gap_pct > 0 else "below",
                "volume_change_pct":         round(volume_change_pct * 100, 1),
                "weekly_revenue_impact_inr": round(weekly_revenue_impact, 0),
            })

        impacts.sort(key=lambda x: abs(x["weekly_revenue_impact_inr"]), reverse=True)
        return impacts[:5]

    def _compute_category_pricing(
        self, category_dishes: dict[str, list[dict]], our_items: list[dict]
    ) -> list[dict]:
        """Compare our own menu categories against the area, independent of dish naming.

        your_avg = average of ALL our items in a category (e.g. all 8 of our "pizza"
        items). area_avg = average of every competitor dish keyword-classified into
        that same category (could be 40+ dishes across 3 competitor menus) — no dish
        name needs to match anything for this to work. This is the primary market
        intelligence signal; exact dish-name matches (see _generate_alerts) are too
        rare in practice to carry the analysis on their own.

        Also names the actual cheapest/priciest competitor dish per category -- the
        one piece of concrete, named evidence a bare average doesn't give you.
        """
        your_prices: dict[str, list[float]] = {}
        for item in our_items:
            category = str(item.get("category") or "").strip().lower()
            price    = float(item.get("price") or 0)
            if not category or price <= 0:
                continue
            your_prices.setdefault(category, []).append(price)

        results = []
        for category, prices in your_prices.items():
            dishes = category_dishes.get(category)
            if not dishes:
                continue

            your_avg = round(sum(prices) / len(prices), 2)
            area_avg_val = round(sum(d["price"] for d in dishes) / len(dishes), 2)
            diff_pct = round((your_avg - area_avg_val) / area_avg_val * 100, 1)

            if diff_pct > 5:
                verdict = "above"
            elif diff_pct < -5:
                verdict = "below"
            else:
                verdict = "in line"

            cheapest_dish = min(dishes, key=lambda d: d["price"])
            priciest_dish = max(dishes, key=lambda d: d["price"])

            results.append({
                "category":                  category,
                "your_avg":                  your_avg,
                "area_avg":                  area_avg_val,
                "diff_pct":                  diff_pct,
                "verdict":                   verdict,
                "competitor_dishes_sampled": len(dishes),
                "cheapest_dish":             cheapest_dish,
                "priciest_dish":             priciest_dish,
            })

        results.sort(key=lambda x: abs(x["diff_pct"]), reverse=True)
        return results

    def _compute_positioning(
        self, competitor_landscape: list[dict], our_items: list[dict]
    ) -> Optional[dict]:
        """Synthesize the competitor landscape into a ranked positioning statement
        instead of a bare list of names — "you'd rank Nth cheapest of M nearby."

        Estimates our own "cost for two" as 2x our average item price (a rough proxy
        matching Swiggy's own "for two" convention) since we don't have a real one.
        """
        if not competitor_landscape or not our_items:
            return None

        prices = [float(i.get("price") or 0) for i in our_items if i.get("price")]
        if not prices:
            return None

        our_cost_for_two = round((sum(prices) / len(prices)) * 2, 0)
        competitor_costs = [c["cost_for_two"] for c in competitor_landscape]

        cheaper_count = sum(1 for c in competitor_costs if c < our_cost_for_two)
        pricier_count = sum(1 for c in competitor_costs if c > our_cost_for_two)
        rank = cheaper_count + 1  # 1 = cheapest overall
        total = len(competitor_costs) + 1

        return {
            "your_cost_for_two_estimate": our_cost_for_two,
            "rank":                       rank,
            "total":                      total,
            "cheaper_than_count":         pricier_count,
            "pricier_than_count":         cheaper_count,
        }

    def _compute_menu_breadth(
        self, competitor_menus: list[dict], our_items: list[dict]
    ) -> Optional[dict]:
        """Compare menu size (item count) — are we under- or over-menued for this
        market? Uses competitor_menus already fetched in Step 2, zero extra calls.
        """
        if not competitor_menus or not our_items:
            return None

        competitor_counts = []
        for competitor in competitor_menus:
            count = 0
            categories = competitor["menu"].get("categories") or competitor["menu"].get("menu") or []
            for category in categories:
                count += len(category.get("items") or [])
            if count > 0:
                competitor_counts.append(count)

        if not competitor_counts:
            return None

        return {
            "your_item_count":            len(our_items),
            "competitor_avg_item_count":  round(sum(competitor_counts) / len(competitor_counts), 1),
            "competitors_sampled":        len(competitor_counts),
        }

    def _compute_cuisine_crowding(self, restaurants: list[dict], cuisine: str) -> Optional[dict]:
        """What share of nearby organic competitors also serve our cuisine? A market-
        saturation signal, built from the cuisines[] field already in the
        search_restaurants response (Step 1) — zero extra calls.
        """
        if not restaurants:
            return None

        cuisine_lower = cuisine.strip().lower()
        if not cuisine_lower or cuisine_lower == "restaurant":
            return None

        matching = sum(
            1 for r in restaurants
            if any(cuisine_lower in str(c).lower() or str(c).lower() in cuisine_lower
                   for c in (r.get("cuisines") or []))
        )

        return {
            "cuisine":         cuisine,
            "matching_count":  matching,
            "total_checked":   len(restaurants),
        }

    def _compute_veg_mix(self, restaurants: list[dict]) -> Optional[dict]:
        """What share of nearby organic competitors are pure-veg? Uses the veg
        flag already in the search_restaurants response (Step 1) — zero extra calls.
        """
        if not restaurants:
            return None

        veg_count = sum(1 for r in restaurants if r.get("veg") is True)

        return {
            "veg_count": veg_count,
            "total":     len(restaurants),
        }

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
        competitor_deals: Optional[list[dict]] = None,
        pricing_impact: Optional[list[dict]] = None,
        category_pricing: Optional[list[dict]] = None,
        positioning: Optional[dict] = None,
        menu_breadth: Optional[dict] = None,
        cuisine_crowding: Optional[dict] = None,
        veg_mix: Optional[dict] = None,
        competitor_landscape: Optional[list[dict]] = None,
    ) -> str:
        competitor_deals = competitor_deals or []
        pricing_impact = pricing_impact or []
        category_pricing = category_pricing or []

        lines = ["## Market Context", f"Competitors checked: {', '.join(restaurant_names)}", ""]

        # Category pricing leads — this is the primary, dish-name-independent signal.
        if category_pricing:
            lines.append("**Category pricing vs area (primary signal):**")
            for cat in category_pricing:
                lines.append(
                    f"- Your {cat['category'].title()} avg Rs.{cat['your_avg']:.0f} vs area "
                    f"Rs.{cat['area_avg']:.0f} ({cat['diff_pct']:+.0f}%, {cat['verdict']}, "
                    f"based on {cat['competitor_dishes_sampled']} nearby dish(es))."
                )
            lines.append("")

        if positioning:
            lines.append(
                f"**Market position:** Estimated Rs.{positioning['your_cost_for_two_estimate']:.0f} for two "
                f"ranks #{positioning['rank']} of {positioning['total']} nearby options "
                f"({positioning['pricier_than_count']} cheaper, {positioning['cheaper_than_count']} pricier)."
            )
            lines.append("")

        if menu_breadth:
            lines.append(
                f"**Menu breadth:** You have {menu_breadth['your_item_count']} items vs a nearby average "
                f"of {menu_breadth['competitor_avg_item_count']:.0f} "
                f"(sampled {menu_breadth['competitors_sampled']} competitor menus)."
            )
            lines.append("")

        if cuisine_crowding:
            lines.append(
                f"**Cuisine crowding:** {cuisine_crowding['matching_count']} of "
                f"{cuisine_crowding['total_checked']} nearby restaurants also serve "
                f"{cuisine_crowding['cuisine']}."
            )
            lines.append("")

        if veg_mix:
            lines.append(
                f"**Area veg/non-veg mix:** {veg_mix['veg_count']} of {veg_mix['total']} nearby "
                f"restaurants are pure veg."
            )
            lines.append("")

        if competitor_landscape:
            top = sorted(competitor_landscape, key=lambda c: c.get("rating") or 0, reverse=True)[:3]
            lines.append("**Competitor landscape (top by rating):**")
            for c in top:
                offer_note = f', running "{c["offer"]}"' if c.get("offer") else ""
                lines.append(
                    f"- {c['name']}: {c.get('rating', '?')} stars, Rs.{c.get('cost_for_two', 0):.0f} for "
                    f"two, {c.get('distance_km', 0):.1f}km away{offer_note}"
                )
            lines.append("")

        if alerts:
            lines.append("**Pricing alerts (exact dish-name matches):**")
            lines.extend(f"- {a}" for a in alerts)
            lines.append("")

        our_price_map = {
            str(i.get("name") or "").strip().lower(): float(i.get("price") or 0)
            for i in our_items
        }

        if area_avg:
            lines.append("**Area average prices — dishes found nearby (from Swiggy):**")
            for dish, avg in sorted(area_avg.items())[:15]:  # cap at 15 dishes
                our_p = our_price_map.get(dish)
                cheapest_entry = cheapest.get(dish, {})
                row = f"- {dish.title()}: area avg Rs.{avg:.0f}"
                if cheapest_entry:
                    row += f", cheapest Rs.{cheapest_entry['price']:.0f} at {cheapest_entry['restaurant']}"
                if our_p:
                    row += f", your price Rs.{our_p:.0f}"
                lines.append(row)
            lines.append("")

        if competitor_deals:
            lines.append("## Competitor Swiggy Deals Tonight")
            lines.append(f"{len(competitor_deals)} competitor deal(s) live right now:")
            for deal in competitor_deals[:8]:
                lines.append(f"- {deal['restaurant']}: {deal['deal_title']}")
            lines.append(
                "Implication: price-sensitive customers have alternatives tonight. "
                "Consider promotional response or focus on quality differentiation."
            )
            lines.append("")

        if pricing_impact:
            lines.append("## Pricing Impact Analysis (bonus — exact dish-name matches only)")
            for impact in pricing_impact:
                verb = "increase" if impact["direction"] == "above" else "decrease"
                lines.append(
                    f"- {impact['item']}: you're {abs(impact['gap_pct']):.0f}% {impact['direction']} "
                    f"area avg (Rs.{impact['our_price']:.0f} vs Rs.{impact['area_avg']:.0f}). "
                    f"Matching area avg could {verb} weekly revenue by "
                    f"Rs.{abs(impact['weekly_revenue_impact_inr']):.0f}."
                )
            lines.append("")

        return "\n".join(lines).rstrip()

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
            log.debug("competitor_enricher_cache_get_error", error=str(exc))
            return None

    async def _cache_set(self, key: str, value: dict) -> None:
        try:
            r = await self._get_redis()
            await r.setex(key, _CACHE_TTL, json.dumps(value, default=str))
        except Exception as exc:
            log.debug("competitor_enricher_cache_set_error", error=str(exc))
