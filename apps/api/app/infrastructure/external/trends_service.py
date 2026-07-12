"""TrendsService — P6-A22.

Fetches a curated list of Indian F&B/hospitality trade-press RSS feeds via
feedparser and summarizes recent headlines into a short "what's trending"
digest using the existing LLM provider (create_llm_provider() -- no new LLM
integration). RSS-only, deliberately: not Google Trends/pytrends, which
scrapes a Google-internal endpoint outside its public API surface -- a ToS
gray area this project has chosen to avoid given how carefully it treats
Swiggy's own terms. RSS is a syndication format meant to be fetched by
third parties, zero ToS risk.

Never raises -- returns None if every feed is unreachable (or the LLM call
fails) so callers run fine without it. Caches the digest in Redis for 1 hour
(trade news moves far slower than Swiggy pricing/occupancy, and an LLM call
isn't free) -- keyed globally, not per-org, since every operator reading
this sees the same real-world industry news.
"""

import asyncio
import calendar
import json
from datetime import date
from typing import Optional

import feedparser
import httpx
import redis.asyncio as aioredis
import structlog

from app.core.settings import get_settings

log = structlog.get_logger()

_TIMEOUT = 10.0
_CACHE_TTL = 3600  # 1 hour
_CACHE_KEY = "trends_service:digest"
_MAX_HEADLINES = 20  # capped across all feeds combined, most recent first -- headline
                     # count alone (not depth) is what lets the LLM actually find the
                     # restaurant-relevant handful instead of forcing generic ones through

# Curated Indian F&B/hospitality/agri-commodity trade press -- each confirmed
# live (2026-07-11) as a real, publicly syndicated RSS feed. Deliberately more
# than one source: any single feed going away (redesign, moved URL) degrades
# the digest, not the whole signal. Generic retail top-stories deliberately
# left out -- it diluted the digest with non-food retail news (electronics,
# apparel) crowding out the genuinely food/restaurant-relevant headlines.
_FEEDS: tuple[str, ...] = (
    "https://retail.economictimes.indiatimes.com/rss/food-entertainment",
    "https://www.thehindubusinessline.com/economy/agri-business/feeder/default.rss",
)

_DIGEST_SYSTEM_PROMPT = (
    "You brief an Indian restaurant owner on trade-press news that actually affects "
    "how they run their restaurant this week -- ingredient costs and sourcing, FSSAI/"
    "regulatory compliance, delivery-platform policy or fee changes, and consumer "
    "demand shifts specific to Indian food service. You are given headlines PLUS their "
    "article summaries -- use the summary detail, don't just restate the headline.\n\n"
    "Write 4-5 bullet points (plain text, one line each, no markdown headers). Each "
    "bullet must: (1) state the specific fact from the article (a number, a policy, a "
    "named ingredient/commodity -- not a vague paraphrase), and (2) end with a concrete "
    "operational implication for a restaurant owner (what to check, adjust, or watch, "
    "not generic advice like 'monitor the situation'). Aggressively skip anything "
    "without a real, specific restaurant-operations angle -- a generic funding/M&A "
    "story or macro retail news does not qualify just because it's food-adjacent. If "
    "fewer than 4 headlines genuinely qualify, write fewer bullets rather than padding.\n\n"
    "Tone: stay neutral and factual about any named platform or company (Swiggy, "
    "Zomato, etc.) -- never phrase a bullet as scrutinizing, doubting, or casting a "
    "platform's compliance/practices in a negative light. If a headline involves one, "
    "state what happened plainly and pivot straight to what the restaurant owner should "
    "do for their OWN business, without implying distrust of the platform."
)


class TrendsService:
    """Live industry-trends digest from curated RSS feeds. get_digest() is the only public method."""

    def __init__(self) -> None:
        self._redis: Optional[aioredis.Redis] = None

    async def get_digest(self) -> Optional[dict]:
        try:
            return await self._get_digest()
        except Exception as exc:
            log.warning("trends_service_error", error=str(exc))
            return None

    async def _get_digest(self) -> Optional[dict]:
        cached = await self._cache_get()
        if cached is not None:
            log.info("trends_service_cache_hit")
            return cached

        headlines = await self._fetch_headlines()
        if not headlines:
            return None

        digest = await self._summarize(headlines)
        if not digest:
            return None

        result = {
            "digest": digest,
            "headline_count": len(headlines),
            "sources_used": len({h["source"] for h in headlines}),
            "prompt_text": f"## Industry Trends\n{digest}",
            "fetched_at": date.today().isoformat(),
        }
        await self._cache_set(result)
        log.info("trends_service_done", headlines=len(headlines), sources=result["sources_used"])
        return result

    async def _fetch_headlines(self) -> list[dict]:
        """Fetch all feeds concurrently; one feed failing never blocks the others."""

        async def _fetch_one(url: str) -> list[dict]:
            try:
                async with httpx.AsyncClient(timeout=_TIMEOUT) as client:
                    resp = await client.get(url, headers={"User-Agent": "Mozilla/5.0"})
                    resp.raise_for_status()
                parsed = feedparser.parse(resp.content)
                entries = []
                for entry in parsed.entries[:_MAX_HEADLINES]:
                    title = str(entry.get("title") or "").strip()
                    if not title:
                        continue
                    published_struct = entry.get("published_parsed")
                    entries.append({
                        "title": title,
                        "summary": str(entry.get("summary") or "").strip(),
                        "published_epoch": calendar.timegm(published_struct) if published_struct else 0,
                        "source": url,
                    })
                return entries
            except Exception as exc:
                log.warning("trends_service_feed_error", url=url, error=str(exc))
                return []

        results = await asyncio.gather(*(_fetch_one(url) for url in _FEEDS))
        all_headlines = [h for feed_entries in results for h in feed_entries]

        # Most recent first; entries with no parseable date sort last.
        all_headlines.sort(key=lambda h: h["published_epoch"], reverse=True)
        return all_headlines[:_MAX_HEADLINES]

    async def _summarize(self, headlines: list[dict]) -> Optional[str]:
        from app.infrastructure.llm.factory import create_llm_provider

        headline_lines = "\n\n".join(
            f"HEADLINE: {h['title']}\nSUMMARY: {h['summary']}" if h["summary"] else f"HEADLINE: {h['title']}"
            for h in headlines
        )
        prompt = f"Recent headlines with article summaries:\n\n{headline_lines}"

        try:
            llm = create_llm_provider(get_settings())
            digest = await llm.complete(prompt, system_prompt=_DIGEST_SYSTEM_PROMPT)
        except Exception as exc:
            log.warning("trends_service_llm_error", error=str(exc))
            return None

        return digest.strip() if digest else None

    # ── Redis cache ──────────────────────────────────────────────────────────

    async def _get_redis(self) -> aioredis.Redis:
        if self._redis is None:
            self._redis = aioredis.from_url(
                get_settings().redis_url, encoding="utf-8", decode_responses=True,
            )
        return self._redis

    async def _cache_get(self) -> Optional[dict]:
        try:
            r = await self._get_redis()
            raw = await r.get(_CACHE_KEY)
            return json.loads(raw) if raw else None
        except Exception as exc:
            log.debug("trends_service_cache_get_error", error=str(exc))
            return None

    async def _cache_set(self, value: dict) -> None:
        try:
            r = await self._get_redis()
            await r.setex(_CACHE_KEY, _CACHE_TTL, json.dumps(value, default=str))
        except Exception as exc:
            log.debug("trends_service_cache_set_error", error=str(exc))
