# CortexKitchen — Claude Code Master Reference

> **Read this file completely before touching any code.**
> Last updated: Phase 6 — market intelligence expansion (P6-MI05–MI14) complete.
> Reference zip: cortexkitchen-dev (latest dev branch)

---

## Product vision

CortexKitchen is a **Swiggy-native restaurant operating system**. A restaurant
owner gets a market-aware operational plan that knows what competitors are
charging tonight, which ingredients are running low and what they cost on
Instamart, how full nearby restaurants are on Dineout, and what deals
competitors are running — all baked into a single actionable plan.

**Being demoed to the Swiggy team. Every Swiggy integration must be polished,
clearly attributed with Swiggy branding, and immediately legible.**

---

## CRITICAL: Swiggy MCP is 100% consumer-facing

Verified from Swiggy Builders Club docs. This means:

**WHAT WORKS — public market data (account activity irrelevant):**
- `search_restaurants` — all restaurants near any address
- `get_restaurant_menu` — any restaurant's full public menu
- `search_products` — Instamart products at any address
- `search_restaurants_dineout` — all Dineout restaurants
- `get_available_slots` — any restaurant's slot availability
- `get_restaurant_details` — any restaurant's details + deals
- `fetch_food_coupons(restaurantId=competitor_id)` — competitor's live coupons

**CONFIRMED NON-VIABLE in this sandbox (not personal data — genuinely empty):**
- `search_menu` — returns ZERO results for every query tested against this
  Swiggy sandbox/account. Real API calls, real zero value. `CompetitorEnricher`
  no longer calls it (`_search_dish_prices` removed, P6-MI12). Re-test if the
  Swiggy account/sandbox changes before re-adding.

**WHAT DOES NOT WORK (returns personal consumer account data):**
- `get_food_orders` — YOUR personal order history. not a restaurant's.
- `track_food_order` — YOUR personal delivery tracking.
- `your_go_to_items` — YOUR personal grocery habits (confirmed live: pet food,
  personal groceries). Fully removed from `ProcurementEnricher` (P6-MI13) —
  it was leaking into the real planning pipeline's inventory prompt, not just
  a display surface. Do not re-add without a hard product reason.
- `get_orders` (Instamart) — YOUR personal procurement history.

The sync tasks (order_sync, feedback_sync, reservation_sync) were built before
this was fully understood. They return personal account data for the dev's
Swiggy account. Do NOT expand these or treat their output as restaurant data.
They are useful ONLY as chatbot context ("what did I order recently").

---

## Current system state (51 tasks complete)

### Pipeline — 11 nodes live

```
ops_manager
    │
demand_forecast (Prophet, synthetic data)
    │
qdrant_enrichment (shared RAG context — SOPs, complaints, past plans)
    │
    ├── reservation          ← OccupancyEnricher: Dineout competitor slots
    ├── complaint_intel      ← Qdrant RAG over feedback
    ├── inventory            ← ProcurementEnricher: Instamart live prices
    ├── market_intel_node    ← CompetitorEnricher + OccupancyEnricher (parallel)
    └── dineout_manager_node ← competitor slot analysis (public data)
            │
menu_intelligence (reads all 5 parallel outputs, synthesises)
            │
aggregator → critic (replanning loop, max 2 retries) → final_assembler
```

### Swiggy tools currently called in production

| Tool | Server | Called in | Status |
|------|--------|-----------|--------|
| `search_restaurants` | Food | CompetitorEnricher | Working — paginated + ad/sponsored listings filtered (P6-MI12) |
| `get_restaurant_menu` | Food | CompetitorEnricher | Working |
| `search_menu` | Food | chatbot only | Confirmed zero results in this sandbox — removed from CompetitorEnricher (P6-MI12) |
| `fetch_food_coupons` | Food | CompetitorEnricher | Working — competitor Swiggy deals (P6-MI06) |
| `get_food_orders` | Food | order_sync + chatbot | Personal data only |
| `track_food_order` | Food | feedback_sync | Personal data only |
| `search_products` | Instamart | ProcurementEnricher + chatbot | Working |
| `your_go_to_items` | Instamart | none | REMOVED — was leaking into the planning pipeline (P6-MI13) |
| `get_saved_locations` | Dineout | OccupancyEnricher + dineout_manager | Working |
| `search_restaurants_dineout` | Dineout | OccupancyEnricher | Working — same ad-filtering as Food (P6-MI12) |
| `get_restaurant_details` | Dineout | OccupancyEnricher | Working — competitor deals + amenities (P6-MI07) |
| `get_available_slots` | Dineout | OccupancyEnricher + dineout_manager | Working, now parsing deals[] (P6-MI07) |
| `get_booking_status` | Dineout | reservation_sync | Only works after book_table |

### Market intelligence expansion (P6-MI05–MI14) — Completed

The original 7-task plan (MI05–MI11) shipped, but MI05's `search_menu` approach and the
`your_go_to_items` field were superseded/removed after live testing (MI12–MI14 below):

- **Category-independent pricing (P6-MI12)** — exact dish-name matching between our menu and
  competitor menus never reliably aligns ("Butter Chicken" vs "Butter Chicken Masala" vs "Murgh
  Makhani"), so `CompetitorEnricher` classifies every competitor dish into a category by
  keyword-in-name (`_classify_dish`: pizza/pasta/burger/sides/dessert/beverage), independent of
  exact string matching. `category_pricing` compares your full category average against the area's,
  naming the cheapest/priciest dish per category. Three more zero-extra-call signals from data
  already in `search_restaurants`: `positioning` (your estimated cost-for-two ranked among
  competitors), `menu_breadth` (your item count vs competitor average), `cuisine_crowding`
  (competitors sharing your cuisine), `veg_mix` (area veg/non-veg composition). Sponsored/ad
  listings (`"(Ad)"` suffix) are filtered with a pagination fallback.
- **`your_go_to_items` fully removed (P6-MI13)** — was reaching the real planning pipeline's
  inventory prompt via `ProcurementEnricher`, not just a display surface. See the consumer-data
  warning above.
- **`fetch_food_coupons` competitor deals (P6-MI06)** and **`get_restaurant_details` + slot
  `deals[]` Dineout competitor deals (P6-MI07)** — both live in `CompetitorEnricher` /
  `OccupancyEnricher` respectively (`competitor_deals`, `competitor_dineout_deals`,
  `slot_deals_found` in their result dicts).
- Assumption Diff 7 (`EvaluationSanityChecker`) fires when `tonight_busy=True` and 2+ competitor
  Dineout deals are live — demand may be absorbed by competitor promotions rather than reaching us.
- Pricing impact model (P6-MI09) quantifies revenue effect for exact dish-name matches only
  (`pricing_impact` — honestly scoped, since exact matching is unreliable per MI12 above).
- `ScenarioRecommender` (`domain/services/scenario_recommender.py`) suggests a scenario preset via
  `GET /planning/recommend`, using recent run history, live market signals, calendar context
  (weekend/holiday — see `INDIAN_HOLIDAYS_2026` in `core/constants.py`), and inventory shortage count.
- `GET /market/trends` returns per-dish price history + occupancy signal history across past
  planning runs (no new Swiggy calls — reads stored `final_response.market_intel`). `/market` page
  renders this via `MarketTrendChart.tsx`.
- **`/market` page redesign (P6-MI14)** — full detail, one card per Swiggy tool, un-collapsed
  (see frontend section below).

### Tools waiting for staging creds (execution, not enrichment)

| Tool | Needed for |
|------|-----------|
| `update_cart` | Instamart procurement execution |
| `get_cart` | Verify before checkout |
| `checkout` | Place Instamart order |
| `book_table` | Dineout booking |
| `create_cart` | Internal to book_table |

### What's built — backend services

```
infrastructure/swiggy/
├── client.py              SwiggyMCPClient — JSON-RPC 2.0, OAuth, circuit breaker
├── circuit_breaker.py     Redis-backed circuit breaker
├── base_connector.py      BaseConnector ABC (sync + enrich)
├── swiggy_connector.py    SwiggyConnector (sync orchestrates all 3 sync services)
├── connector_repository.py CRUD for connectors table
├── provider_registry.py   Capability routing
├── enrichers/
│   ├── competitor.py      search_restaurants (ad-filtered, paginated) + get_restaurant_menu +
│   │                      fetch_food_coupons → category pricing (keyword-classified, not exact-name),
│   │                      positioning, menu breadth, cuisine crowding, veg mix, deals, pricing impact
│   ├── occupancy.py       search_restaurants_dineout (ad-filtered) + get_available_slots +
│   │                      get_restaurant_details → occupancy signal, competitor Dineout deals, slot deals[]
│   └── procurement.py     search_products → ingredient prices (your_go_to_items removed — personal data)
├── sync/
│   ├── order_sync.py      get_food_orders (personal data — limited value)
│   ├── feedback_sync.py   track_food_order (personal data — limited value)
│   └── reservation_sync.py get_booking_status skeleton
└── executor/              EMPTY — ProcurementExecutor when staging creds arrive

domain/services/
├── market_intel_service.py  Orchestrates enrichers concurrently
├── scenario_recommender.py  P6-MI10 — suggests a scenario preset from run history + market + calendar + inventory signals
├── chat_service.py          Groq function calling: 7 tools including 3 Swiggy
├── critic_service.py        LLM critic with assumption diffs + stale assumptions
├── evaluation_sanity.py     Diffs 1-7 (incl. 3 market/dineout diffs — Diff 7 added P6-MI08)
└── ...others existing

api/routes/
├── market.py     GET /market/pulse (category pricing, positioning, menu breadth, cuisine crowding,
│                 veg mix, deals, pricing impact), GET /market/ingredient-search (on-demand),
│                 GET /market/trends — price/occupancy history
├── planning.py   GET /planning/recommend — ScenarioRecommender suggestion (P6-MI10)
├── connectors.py POST /connectors/swiggy/sync, GET /connectors/status
├── business.py   GET /business/performance — revenue/profit analytics
└── ...others existing
```

### What's built — frontend pages

```
/dashboard       Today view: planning trigger, scenario picker, run history
/operations      Agent cards, forecast chart, critic banner, manager panel
/market          Live market intel: competitor pricing, occupancy, procurement
/connectors      Swiggy connection status, sync trigger
/chat            Agentic chatbot with Groq function calling + Swiggy tools
/runs            Planning run history
/data-health     Data health monitoring
/restaurant-profiles Restaurant profile management
/settings        Org settings
```

### Swiggy components in frontend

```
SwiggyLiveMarketPanel.tsx   — /market page, P6-MI14 redesign: 10 detailed cards, one per Swiggy
                              tool (category pricing, market context, exact menu matches, competitor
                              deals, competitor landscape, area occupancy, Dineout deals/slots,
                              Instamart prices, ingredient lookup) — un-collapsed, full detail
CategoryPricingChart.tsx    — your avg vs area avg per category, grouped bar chart
PricingImpactChart.tsx      — diverging bar chart, revenue impact of exact-match pricing gaps
OccupancyBySlotChart.tsx    — status-colored (HIGH/MEDIUM/LOW) bar chart by time slot
IngredientPriceLookup.tsx   — on-demand Instamart ingredient search
MarketTrendChart.tsx        — P6-MI11: per-dish price trend + occupancy trend line charts
SwiggyStatusWidget.tsx      — connection status bar
SwiggySignalBadge.tsx       — Swiggy attribution badge
HighlightSwiggy.tsx         — Swiggy branded highlight
```

`SwiggyMarketIntelPanel.tsx` and `CompetitorLandscapeChart.tsx` were deleted — both superseded by
`SwiggyLiveMarketPanel.tsx`'s redesign (the latter was an illegible unlabeled bubble chart, replaced
by a labelled list inline in the panel).

Swiggy logo: `apps/web/cortexkitchen-ui/public/swiggy-logo.png`

---

## What's being built next — in priority order

### Priority 1: Market intelligence expansion (P6-MI05 to MI14) — COMPLETE
Branch: `feature/swiggy-market-intel-extended`

**P6-MI05** — `search_menu` in CompetitorEnricher (dish-level pricing) — Superseded, see MI12
**P6-MI06** — `fetch_food_coupons` (competitor Swiggy promotional deals) — Done
**P6-MI07** — `get_restaurant_details` + slot `deals[]` (Dineout competitor deals) — Done
**P6-MI08** — Assumption Diff 7 (competitor deals vs occupancy signal contradiction) — Done
**P6-MI09** — Pricing impact model (quantify revenue effect of alerts) — Done
**P6-MI10** — Scenario recommendation engine (proactive suggestion) — Done, `GET /planning/recommend`
**P6-MI11** — Competitor price trend view on /market page — Done, `GET /market/trends` + `MarketTrendChart.tsx`
**P6-MI12** — Category-independent dish classification + positioning/menu-breadth/cuisine-crowding/veg-mix — Done
**P6-MI13** — Remove `your_go_to_items` from the planning pipeline (personal-data leak) — Done
**P6-MI14** — `/market` page redesign — detailed per-tool cards, 4 new charts — Done

### Priority 2: Action queue (P6-S32) — next up
Branch: `feature/action-queue`
ActionQueueService + table + UI. No Swiggy write calls yet.
Plan output includes approve/reject actions.

### Priority 3: Live monitor + brief mode (P6-S36, P6-F07, P6-F08)
BriefingService, LiveMonitorService, /brief and /live pages.

### Priority 4: Staging creds dependent (P6-S43, P6-S44)
ProcurementExecutor (Instamart checkout), Dineout booking execution.
BLOCKED until staging creds from Swiggy arrive.

### Priority 5: UI redesign (P6-F09 to F12 — partially done)
Design system and theming partially shipped. Continue with remaining pages.

---

## How market intelligence feeds the pipeline

Every new tool addition makes the plan better:

```
fetch_food_coupons → competitor deals → menu_intel changes what to promote tonight
category pricing   → keyword-classified area avg → critic flags overpriced categories precisely
get_restaurant_details → competitor deals → reservation node revises walk-in estimate
slot deals[]       → Diff 7 fires → plan corrected for demand absorption by competitors
pricing impact model → critic gets revenue numbers → plan is quantified not just directional
positioning/menu breadth/cuisine crowding/veg mix → /market page context, not yet in pipeline prompts
```

---

## Key constraints — Swiggy rules

**BEFORE writing any Swiggy tool call:**
1. Read docs/SWIGGY_INTEGRATION.md (response schemas in section 16+17)
2. Verify at https://mcp.swiggy.com/builders/llms.txt

**Non-negotiable:**
- `checkout` and `book_table` are NOT idempotent. Check-then-retry on 5xx.
- Dineout uses lat/lng. Food + Instamart use addressId. Never mix.
- `update_cart` REPLACES entire Instamart cart. Not additive.
- All enrichers return None on failure. Never raise. Nodes handle None gracefully.
- `spinId` (not product id) for Instamart cart operations.
- Accept: application/json, text/event-stream header required on every call.
- Response format: `result.structuredContent` not `success/data`.

**OAuth:**
```
SWIGGY_ACCESS_TOKEN=eyJ...  (5-day TTL, run scripts/get_swiggy_token.py to refresh)
SWIGGY_ADDRESS_ID=cjpfcd75ofl5oefqs8mg
```

---

## After every PR merge — update this file

Update "Current system state" section.
Add newly built files to the relevant section.
Mark newly completed tools as "Working" in the tool table.
No zip uploads needed if this file is current.
