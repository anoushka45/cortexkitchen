"""ProcurementEnricher — P6-S09.

Fetches live Instamart prices and spinIds for shortage ingredients at planning time.
Injects a Live Procurement Options section into the inventory node prompt.

Flow:
  your_go_to_items(addressId) → frequent reorder candidates (spinId + price)
  → search_products(query=ingredient, addressId) for each shortage item
    (max MAX_SEARCH_CALLS total — enforced across all items)
  → build procurement_options list with spinId, price, unit, inStock per ingredient
  → cache Redis 30 min (key: enricher:procurement:{org_id}:{date})
  → return dict or None on any failure

CRITICAL: spinId (variant-level SKU) must persist in OrchestratorState.
          ProcurementExecutor (P6-S15) uses spinIds for update_cart.
          The product id is NOT accepted by cart operations — only spinId is.
"""

import json
import logging
from datetime import date
from typing import Optional

import redis.asyncio as aioredis

from app.core.settings import get_settings
from app.infrastructure.swiggy.client import INSTAMART_ENDPOINT, SwiggyMCPClient

log = logging.getLogger(__name__)

_CACHE_TTL        = 1800  # 30 minutes
_MAX_SEARCH_CALLS = 5     # hard rate-limit: max search_products calls per run


class ProcurementEnricher:
    """Live Instamart ingredient prices and spinIds from Swiggy.

    Returns None on any failure so inventory node runs without it.
    spinIds in the returned dict are stored in OrchestratorState for checkout.
    """

    def __init__(self, client: SwiggyMCPClient) -> None:
        self._client = client
        self._redis: Optional[aioredis.Redis] = None

    # ── public ──────────────────────────────────────────────────────────────

    async def enrich(self, context: dict) -> Optional[dict]:
        """Fetch live Instamart prices and return procurement options.

        context keys used:
          org_id          int        — cache scoping
          address_id      str        — Instamart addressId (falls back to settings)
          shortage_items  list[str]  — ingredient names from inventory analysis
                                       e.g. ["tomatoes", "paneer", "cream"]

        Returns:
          {
            "procurement_options": [
              {"ingredient": "tomatoes", "spinId": "spin_42",
               "price": 45.0, "unit": "1kg", "inStock": True},
              ...
            ],
            "go_to_items": [
              {"name": "Amul Butter", "spinId": "spin_99",
               "price": 55.0, "unit": "100g", "inStock": True,
               "lastOrderedAt": "2026-06-20T10:00:00Z"},
              ...
            ],
            "prompt_text": "## Live Procurement Options\\n...",
            "fetched_at": "2026-06-30",
          }
          or None.
        """
        try:
            return await self._enrich(context)
        except Exception as exc:
            log.warning("procurement_enricher_error: %s", exc)
            return None

    # ── internal ─────────────────────────────────────────────────────────────

    async def _enrich(self, context: dict) -> Optional[dict]:
        org_id         = int(context.get("org_id") or 0)
        address_id     = str(context.get("address_id") or get_settings().swiggy_address_id or "")
        shortage_items = list(context.get("shortage_items") or [])

        if not address_id:
            log.warning("procurement_enricher_no_address_id")
            return None

        cache_key = f"enricher:procurement:{org_id}:{date.today().isoformat()}"
        cached = await self._cache_get(cache_key)
        if cached is not None:
            log.info("procurement_enricher_cache_hit key=%s", cache_key)
            return cached

        # Step 1 — frequent reorder candidates (no call limit)
        go_to_items = await self._fetch_go_to_items(address_id)

        # Step 2 — search for each shortage ingredient (capped at MAX_SEARCH_CALLS)
        procurement_options = await self._search_shortage_items(address_id, shortage_items)

        if not procurement_options and not go_to_items:
            return None

        result = {
            "procurement_options": procurement_options,
            "go_to_items":         go_to_items,
            "prompt_text":         self._build_prompt(procurement_options, go_to_items),
            "fetched_at":          date.today().isoformat(),
        }

        await self._cache_set(cache_key, result)
        log.info(
            "procurement_enricher_done options=%d go_to=%d",
            len(procurement_options), len(go_to_items),
        )
        return result

    async def _fetch_go_to_items(self, address_id: str) -> list[dict]:
        data = await self._client.call_tool(
            INSTAMART_ENDPOINT,
            "your_go_to_items",
            {"addressId": address_id},
        )
        if not data:
            return []

        results = []
        for item in data.get("products") or []:
            variant = self._best_variant(item.get("variations") or [])
            if not variant:
                continue
            results.append({
                "name":          str(item.get("displayName") or item.get("name") or ""),
                "spinId":        variant["spinId"],
                "price":         variant["price"],
                "unit":          variant["unit"],
                "inStock":       variant["inStock"],
                "lastOrderedAt": item.get("lastOrderedAt"),
            })
        return results

    async def _search_shortage_items(
        self, address_id: str, shortage_items: list[str]
    ) -> list[dict]:
        results = []
        calls_made = 0

        for ingredient in shortage_items:
            if calls_made >= _MAX_SEARCH_CALLS:
                log.info(
                    "procurement_enricher_rate_limit reached=%d items_skipped=%d",
                    _MAX_SEARCH_CALLS, len(shortage_items) - calls_made,
                )
                break

            data = await self._client.call_tool(
                INSTAMART_ENDPOINT,
                "search_products",
                {"addressId": address_id, "query": str(ingredient)},
            )
            calls_made += 1

            if not data:
                continue

            products = data.get("products") or []
            if not products:
                continue

            best_product = products[0]
            variant = self._best_variant(best_product.get("variations") or [])
            if not variant:
                continue

            results.append({
                "ingredient": str(ingredient),
                "spinId":     variant["spinId"],
                "price":      variant["price"],
                "unit":       variant["unit"],
                "inStock":    variant["inStock"],
            })

        return results

    def _best_variant(self, variants: list[dict]) -> Optional[dict]:
        """Return the first in-stock variant, or the first variant if none are in stock."""
        if not variants:
            return None
        for v in variants:
            spin_id = v.get("spinId")
            if not spin_id:
                continue
            price_obj = v.get("price") or {}
            price = float(price_obj.get("offerPrice") or price_obj.get("mrp") or 0)
            return {
                "spinId":  str(spin_id),
                "price":   price,
                "unit":    str(v.get("quantityDescription") or v.get("unit") or ""),
                "inStock": bool(v.get("isInStockAndAvailable", v.get("inStock", True))),
            }
        return None

    def _build_prompt(self, options: list[dict], go_to_items: list[dict]) -> str:
        lines = ["## Live Procurement Options (Instamart)"]

        if options:
            lines.append("")
            lines.append("**Shortage items — live prices:**")
            for opt in options:
                status = "in stock" if opt["inStock"] else "OUT OF STOCK"
                lines.append(
                    f"- {opt['ingredient'].title()}: Rs.{opt['price']:.0f}/{opt['unit']} "
                    f"({status})"
                )

        if go_to_items:
            lines.append("")
            lines.append("**Frequent reorder items:**")
            for item in go_to_items[:5]:  # cap at 5 in prompt
                status = "in stock" if item["inStock"] else "OUT OF STOCK"
                lines.append(
                    f"- {item['name']}: Rs.{item['price']:.0f}/{item['unit']} ({status})"
                )

        if not options and not go_to_items:
            lines.append("No procurement data available.")

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
            log.debug("procurement_enricher_cache_get_error: %s", exc)
            return None

    async def _cache_set(self, key: str, value: dict) -> None:
        try:
            r = await self._get_redis()
            await r.setex(key, _CACHE_TTL, json.dumps(value, default=str))
        except Exception as exc:
            log.debug("procurement_enricher_cache_set_error: %s", exc)
