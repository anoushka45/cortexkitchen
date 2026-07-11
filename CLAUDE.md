# CortexKitchen — Claude Code Master Reference

> **Read this file completely before touching any code.**
> Last updated: Phase 6A compliance/completion plan finalized in the tracker
> (P6-A19–A29), Phase 6B (Guest Concierge) scoped as 9 tasks, gated on P6-B1.
> Branch `feature/phase6a-completion` not yet created — next action is P6-A19,
> pending explicit go-ahead. See the tracker for full task detail (Phase 6A /
> Phase 6B sheets) — this file gives orientation, the tracker is the source
> of truth for task-level status.
> Reference zip: cortexkitchen-dev (latest dev branch)

---

## Product vision

CortexKitchen is a **two-sided platform powered by Swiggy MCP**, with two
independent user groups:

**Side 1 — Restaurant OS (Phase 6A, in progress).** A restaurant operator
tool: owners/managers log in to run operations. An 11-node LangGraph planning
pipeline produces operational plans informed by weather forecasts, Indian
holidays, and *area-level* market signals (not named-competitor data — see
the compliance section below for why). Flagship feature: an autonomous
procurement loop — weather/demand signal → ingredient shortage detected →
real Instamart price check → Action Queue approval via a trust ladder → real
checkout (once staging creds land) or WhatsApp vendor coordination as
fallback. Does NOT connect to any specific restaurant's real Swiggy listing
(no real restaurant yet — that requires the Partner API) and does NOT show
individual competitor restaurant names or prices (compliance, see below).

**Side 2 — Guest Concierge (Phase 6B, not started).** A consumer-facing event
planning assistant, fully independent of the Restaurant OS — no fake
restaurant connection, no shared data. A guest describes an event and the
concierge uses all 3 Swiggy MCP servers (Dineout, Food, Instamart) to
actually plan and book it end-to-end. The differentiator over just asking
ChatGPT/Gemini: a generic LLM can only *suggest* — it can't see live slot
availability, can't confirm a coupon is still active, and can't place a
real booking or checkout. Guest Concierge does all three, live, in one
conversation. Gated on P6-B1 (Swiggy written consent, clause 2.1(v)) before
any code starts. The two sides connect naturally later, once restaurants are
real and listed on Swiggy — that's roadmap, not current state.

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

## CRITICAL: Signed Swiggy Integration Agreement — compliance plan (IN PROGRESS)

A real Integration Agreement between Swiggy Limited and the dev (as an Individual
Developer partner) was signed, effective **2026-07-09**, 1-year Term. The full
agreement text is NOT committed to this repo and should not be pasted into
other tools/services — clause 12.5 (Confidentiality) bars disclosing the
Agreement's existence/contents to any third party without Swiggy's prior
written consent. This section only records the compliance implications for
this codebase.

**Not legal advice — this is an engineering-risk summary flagged for the
dev to resolve with Swiggy directly, not something to silently code around.**

### Flagged contradictions — now tracked as concrete tasks

1. **Clause 4(iv) — competitive-intelligence ban vs. the Market Intelligence
   feature.** The Agreement prohibits using the Swiggy MCP "directly or
   indirectly, to (i) gather competitive intelligence on Swiggy...
   restaurants, sellers... (ii) benchmark... a product... that competes
   with... Swiggy's services." `CompetitorEnricher` and the competitor-facing
   calls in `OccupancyEnricher` do exactly this today — named restaurants,
   named prices, named deals.
   **Resolution: P6-A20** (tracker, Phase 6A) — replace all named-restaurant
   output with area-level aggregates only ("area avg for North Indian mains:
   Rs.265", "3 restaurants near you are HIGH occupancy tonight", "2
   restaurants have active deals" — never a restaurant name, never an
   individual price). The word "competitor" is being removed from all
   outputs/prompts/UI in favor of "area market signals." **Not yet
   remediated in code** — P6-A20 is Planned, not Completed, in the tracker.

2. **Clause 6 (Exclusivity) vs. the Zomato stub connector.** The Agreement
   bars partnering with "any other food delivery, dining out and/or quick
   commerce platform" for a similar solution, enforceable by injunctive
   relief (6.3) — not just damages. Confirmed via codebase audit this is
   more than a name in one file: `ZomatoConnector` (a genuine no-op stub,
   never calls a live API), `provider_registry.py`'s `CAPABILITY_PROVIDERS`
   lists `zomato` alongside `swiggy` under `competitor_pricing` and
   `order_history`, and the `/connectors` frontend page has a live "Zomato"
   card. Bad optics under clause 17's audit rights even though nothing
   actually calls Zomato.
   **Resolution: P6-A19** (tracker, Phase 6A) — full removal: connector
   file, both `provider_registry.py` entries, the frontend card, its test
   file, and `ConnectorType.zomato` from the DB enum. Does **not** touch
   `FeedbackSource.zomato` (separate enum, same file) — that's just a
   provenance tag for feedback that originated from a Zomato review, no live
   Zomato connection, legitimate to keep. **Not yet remediated in code.**

3. **Clause 2.1(v) — prior written consent required before any new
   implementation.** An ongoing obligation on every future MCP-touching
   feature, not a one-time signing formality. Applies most directly to
   **Guest Concierge (Phase 6B)** — it's gated on **P6-B1** in the tracker
   (send Swiggy a technical brief, get written sign-off) before any Phase 6B
   code is written. Does not apply to weather/holiday signals (P6-A21) —
   that's Open-Meteo + internal constants, zero Swiggy MCP.

### What remains fully compliant and unaffected

- **Instamart procurement** (`search_products`, and `update_cart`/`get_cart`/
  `checkout` once staging creds land) — address-based, not restaurant-listing
  based, not competitive intelligence. This is the flagship real, live,
  compliant Swiggy use case (P6-A22's autonomous procurement loop) and does
  not depend on the dev's restaurant having a real Swiggy listing.
- Demand forecasting, business analytics, financial scorecard, Action Queue,
  trust-ladder mechanic, WhatsApp vendor coordination, Vendor/Supplier model
  — no Swiggy MCP dependency at all.
- Weather + holiday signals (P6-A21) — Open-Meteo + internal constants, zero
  Swiggy MCP involvement.

### Current plan — see the tracker for full task detail

Phase 6A remaining (11 tasks, P6-A19→A29, in order): compliance fixes first
(A19 Zomato removal, A20 anonymise market intel) → weather/holiday signals
(A21) → autonomous procurement loop, the flagship demo (A22) → Instamart
event supplies in the operator chatbot (A23) → menu engineering matrix UI
(A24) → structured outputs (A25) → voice interface (A26) → eval pipeline
refresh (A27) → docs/screenshots (A28) → sync to main (A29). Full detail,
acceptance criteria, and branch names are in the "Phase 6A" tracker sheet —
this file is orientation, not a duplicate of it.

Phase 6B (Guest Concierge, 9 tasks, P6-B1→B9) is scoped in the "Phase 6B"
tracker sheet, gated entirely on P6-B1 (Swiggy consent) and starting only
after P6-A29 (sync to main). Do not write Phase 6B code before that gate
clears.

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
├── business_analytics_service.py  Shared analytics (dish margin, complaint categories, peak hours,
│                                  expense proration, composite health score — P6-A6) used identically
│                                  by business.py AND the planning pipeline/chatbot (menu_intelligence,
│                                  complaint_intelligence, reservation, chat_service)
├── chat_service.py          Groq function calling: Swiggy tools + business analytics context
├── critic_service.py        LLM critic with assumption diffs + stale assumptions
├── evaluation_sanity.py     Diffs 1-7 (incl. 3 market/dineout diffs — Diff 7 added P6-MI08)
└── ...others existing

api/routes/
├── market.py     GET /market/pulse (category pricing, positioning, menu breadth, cuisine crowding,
│                 veg mix, deals, pricing impact), GET /market/ingredient-search (on-demand),
│                 GET /market/trends — price/occupancy history
├── planning.py   GET /planning/recommend — ScenarioRecommender suggestion (P6-MI10)
├── connectors.py POST /connectors/swiggy/sync, GET /connectors/status
├── business.py   GET /business/performance — revenue/profit analytics + real P&L (net profit,
│                 net margin) + composite health score, backed by the new Expense ledger (P6-A6)
└── ...others existing
```

### Financial scorecard (P6-A6)

`Expense` (`infrastructure/db/models.py`) is a per-org fixed/recurring cost (rent, utilities,
marketing, other; `labor` category exists but is unpopulated — no staffing feature yet, included so
it slots in later without a schema change). `BusinessAnalyticsService.get_daily_expense_total`
prorates one-time/daily/weekly/monthly costs into a daily-equivalent figure (e.g. Rs.50k/month rent
→ ~Rs.1,667/day). `GET /business/performance` now returns real net profit/net margin per day and
per period, plus a single `health_score` (0-100, deterministic: 70% net margin normalized against a
30%-benchmark + 30% guest sentiment). Seed data (`scripts/seed_demo_data.py`) includes rent,
utilities, marketing, and one one-time expense for org 1.

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
