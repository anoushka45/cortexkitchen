# CortexKitchen — Claude Code Master Reference

> **Read this file completely before touching any code.**
> Last updated: P6-A21→A26 done on `feature/live-intelligence-signals` —
> nine tasks (P6-A21–A29: live-
> intelligence signals, scenario overhaul, and a real-product IA pass
> merging `/operations` into Today and `/runs`+`/data-health` into Data)
> share this one combined branch. **P6-A21 (weather + holidays)**, **P6-A22
> (industry trends, curated RSS)**, **P6-A23 (regulatory alerts, FSSAI
> public notices)**, and **P6-A24 (unify all signals into the planning
> pipeline)** are all DONE. Weather/trends/compliance are independently
> fail-open services under `infrastructure/external/` (`WeatherService`,
> `TrendsService`, `ComplianceAlertsService`), each wired into
> `GET /market/pulse` (independent of `swiggy_connected`) with its own
> `/market` card, AND now actually reach the planning pipeline: fetched once
> by `demand_forecast_node` (weather shifts the actual forecast number via
> `ForecastService._apply_signal_adjustments`, transparent — pre-adjustment
> value/multiplier/reasons preserved; trends/compliance are narrative-only
> there), then read back from state (never re-fetched) by
> `market_intel_node`, which merges all five sources (competitor, occupancy,
> weather, trends, compliance) into one `market_intel_output
> ["live_signals_text"]` (`MarketIntelService._build_live_signals_text`) —
> read by `menu_intelligence` and condensed into a `[Live Signals]` line for
> the critic (`aggregator.py`). Existing state field names
> (`swiggy_competitor_context`, `swiggy_occupancy_context`,
> `market_intel_output`) are unchanged. Critically, `market_intel_node` no
> longer nulls everything to `None` when Swiggy is unavailable — one source
> going down never blocks the other three now.
> Along the way, live testing found `OccupancyEnricher` (Dineout) never
> actually worked end-to-end — three separate live response-shape
> mismatches (`search_restaurants_dineout`'s empty `structuredContent`
> needing a `render_restaurants_dineout` follow-up, `get_restaurant_details`'
> nested `offers`/`restaurant` fields, `get_available_slots`' slots living in
> `_meta` with no numeric `availabilityCount` field anymore) — all fixed,
> plus the identical bug in `dineout_manager.py` (currently dormant, no real
> Dineout restaurant ID configured yet).
> **P6-A25 (scenario-selection overhaul) is DONE.** `PlanningRunRequest.scenario`
> relaxed from a 4-value Literal to `str`; new `custom_profile` field
> (`ScenarioProfilePayload`). New `ScenarioProfileService` (new
> `POST /planning/scenario-from-text`) turns free-form text ("we're hosting
> an event today, expecting large turnover") into a full profile via an LLM
> call — same never-raise + deterministic-fallback pattern as
> `ScenarioRecommender`, always fills all 3 required keys since
> `complaint_service`/`inventory_service`/`reservation_service` read
> `scenario_profile["label"]` etc. via direct dict access, not `.get()`.
> `ops_manager_node` now branches: known preset → unchanged; unknown
> scenario + `custom_profile` present → build from that; unknown scenario +
> no `custom_profile` → still a hard error. New `OrchestratorState` field:
> `custom_profile`. Custom-profile runs bypass both the semantic cache and
> the Redis plan cache. Frontend: deduplicated the two verbatim-identical
> `SCENARIO_OPTIONS` arrays into `lib/scenarios.ts`; `PlanShiftModal.tsx` now
> has a free-text input alongside the existing tile grid, not replacing it.
> Full detail in `docs/PRODUCT_MODES.md`.
> **P6-A26 (Today Dashboard redesign) is DONE.** `/operations` (agent cards,
> forecast chart, critic banner) merged directly into `/dashboard`'s success
> view — the `justTriggered`-gated redirect and transient "opening
> Operations" screen are gone entirely; fresh triggers and history loads now
> render one unified view. `/operations` is now a 2-line redirect page
> (`?run=<id>` preserved as `/dashboard?run=<id>`, handled on `/dashboard`
> itself via `loadFromHistory({id})`). `<ActionQueuePanel/>` now also
> renders in the success view (previously idle-state only), and the
> "Operations" nav entry is removed from `NavBar.tsx` — Today is Action
> Queue's actual primary-nav home now. New `TodayContextStrip` component
> (condensed weather/holiday/trends/compliance/area-occupancy badges, all 4
> P6-A24 signals) renders inside `PlanShiftModal.tsx` above the scenario
> tiles/free-text input, sourced from `TodayIdleState`'s already-fetched
> `getMarketPulse()` — zero new fetch. Frontend-only task; `npx tsc --noEmit`
> and `npx eslint` both clean. **Not visually tested in a running browser**
> (the user's own `npm dev` was already running) — this is the second
> frontend task in a row without hands-on browser verification; recommend
> testing A25 + A26 together in one browser session before continuing much
> further.
> Next: P6-A27 (Data page redesign). See the tracker for full task detail
> (Phase 6A / Phase 6B sheets) — this file gives orientation, the tracker is
> the source of truth for task-level status.
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
   feature — DONE (P6-A20).** The Agreement prohibits using the Swiggy MCP
   "directly or indirectly, to (i) gather competitive intelligence on
   Swiggy... restaurants, sellers... (ii) benchmark... a product... that
   competes with... Swiggy's services." `CompetitorEnricher` and the
   competitor-facing calls in `OccupancyEnricher` did exactly this — named
   restaurants, named prices, named deals, in the result dict, the LLM
   prompt, the `/market/pulse` API response, the operator chatbot's
   `swiggy_get_competitor_deals` tool, and the `/market` page UI.
   All of it replaced with area-level aggregates only: `area_restaurant_count`,
   `deals_active_count`/`deals_summary`, `landscape_summary` (count/avg
   rating/cost-for-two range/offers count), `dineout_deals_count`/
   `dineout_deals_summary` — never a restaurant name paired with a specific
   price, deal, rating, or occupancy figure. `category_pricing`'s
   `cheapest_dish`/`priciest_dish` keep the dish name (not restaurant-
   identifying) but drop which restaurant serves it. Propagated through
   every consumer: `market_intel_service.py`, `market_intel.py` node,
   `workflow_trigger_service.py`, `mcp_server.py`'s `get_market_brief`,
   `chat_service.py`'s three `swiggy_get_*` tools, `market.py`'s Pydantic
   models, and `SwiggyLiveMarketPanel.tsx`'s three named-data cards (now
   aggregate cards). `evaluation_sanity.py`'s Diff 7 already read a count
   field, not the raw list, so it needed no change. 487 backend tests pass,
   frontend typechecks clean.

2. **Clause 6 (Exclusivity) vs. the Zomato stub connector — DONE (P6-A19).**
   The Agreement bars partnering with "any other food delivery, dining out
   and/or quick commerce platform" for a similar solution, enforceable by
   injunctive relief (6.3) — not just damages. The codebase audit found this
   was more than a name in one file: `ZomatoConnector` (a genuine no-op
   stub, never called a live API), `provider_registry.py`'s
   `CAPABILITY_PROVIDERS` listed `zomato` alongside `swiggy` under
   `competitor_pricing`/`order_history` (plus `eazydiner` — Zomato's own
   dining vertical — under `reservation_data`, found during remediation),
   and the `/connectors` frontend page had a live "Zomato" card. All removed:
   `apps/api/app/infrastructure/zomato/` deleted, both provider_registry.py
   lists now list only `swiggy`, the frontend card removed, `test_zomato_
   connector.py` deleted, `ConnectorType.zomato` removed from `models.py`.
   `connector_type` is a plain `String(50)` column (not a DB enum), so no
   Alembic migration was needed. `FeedbackSource.zomato` (separate enum,
   same file) was deliberately left untouched — just a provenance tag for
   feedback that originated from a Zomato review, no live Zomato connection.
   The multi-provider *architecture* (`BaseConnector`, `provider_registry.py`'s
   pattern, `ConnectorType`) was never the problem and stays fully intact —
   already proven extensible by `pos_square`/`google_reviews`, neither of
   which is a food-delivery/dining/quick-commerce competitor.
   `base_connector.py`'s docstring now states explicitly what the pattern
   may extend to (POS systems, loyalty/rewards platforms, accounting/
   inventory tools, review aggregators, payment processors) and what it must
   not, while clause 6.1 is in effect (any other food delivery/dining-out/
   quick-commerce platform — e.g. Zomato, EazyDiner). 487 backend tests pass,
   frontend typechecks clean, post-removal.

3. **Clause 2.1(v) — prior written consent required before any new
   implementation.** An ongoing obligation on every future MCP-touching
   feature, not a one-time signing formality. Applies most directly to
   **Guest Concierge (Phase 6B)** — it's gated on **P6-B1** in the tracker
   (send Swiggy a technical brief, get written sign-off) before any Phase 6B
   code is written. Does not apply to the live-intelligence signals (P6-A21
   through P6-A23) — none of weather, industry trends, or regulatory alerts
   touch the Swiggy MCP at all.

### What remains fully compliant and unaffected

- **Instamart procurement** (`search_products`, and `update_cart`/`get_cart`/
  `checkout` once staging creds land) — address-based, not restaurant-listing
  based, not competitive intelligence. This is the flagship real, live,
  compliant Swiggy use case (P6-A30's autonomous procurement loop) and does
  not depend on the dev's restaurant having a real Swiggy listing.
- Demand forecasting, business analytics, financial scorecard, Action Queue,
  trust-ladder mechanic, WhatsApp vendor coordination, Vendor/Supplier model
  — no Swiggy MCP dependency at all.
- Live-intelligence signals (P6-A21–A23: weather/holidays via Open-Meteo,
  industry trends via curated RSS, regulatory alerts via FSSAI's public
  notices) — zero Swiggy MCP involvement, zero paid services.

### Current plan — see the tracker for full task detail

Phase 6A remaining (16 tasks, P6-A21→A36, in order): compliance batch DONE
(A19 Zomato removal, A20 anonymise market intel — both complete on
`feature/compliance-fixes`, merged to `dev`).

Next up — **nine tasks (P6-A21–A29) on one combined branch**
(`feature/live-intelligence-signals`), since live intelligence, scenario
intake, and the dashboard/data-page IA redesign are all tightly coupled:

1. **A21 Weather + holidays — DONE.** **A22 industry trends (RSS)**, **A23
   regulatory alerts (FSSAI)** — still planned, same independently fail-open
   pattern. A21 applies a real deterministic multiplier to Prophet's raw
   forecast (holiday/weather-adjusted, not just narrative prompt text — the
   actual fix for "scenario only changes labels, not the number").
2. **A24 "unify"** — merges all three plus the existing anonymised Swiggy
   area signals inside the *existing* `market_intel_node`/`MarketIntelService`
   rather than a new graph node, so the state field names 5+ other files
   already read by name never change.
3. **A25 scenario-selection overhaul** — the 4 scenarios are hardcoded
   end-to-end today and `demand_forecast` doesn't algorithmically branch on
   which one is picked (only labeling text does). Backend relaxation +
   natural-language-to-profile service + the input widget itself; presets
   kept as shortcuts, not replaced.
4. **A26 Today Dashboard redesign** — real-product IA decision: merges
   `/operations` into `/dashboard` (trigger a plan and watch it complete in
   one view, not two pages), adds a live-signals context strip next to the
   scenario picker, and gives the Action Queue — Phase 6A's biggest existing
   feature — an actual primary-nav home for the first time.
5. **A27 Data page redesign** — merges `/runs` + `/data-health` into one
   page with the existing design system (fixing `/runs`'s known
   weakest-screen problem and the `/runs/{id}` 404), adds an Action Queue
   history section that doesn't exist anywhere today.
6. **A28 Menu Engineering Matrix** — retargeted to live on the new Data page
   (analytical/historical, not a daily trigger-time decision) instead of the
   now-merged `/operations`.
7. **A29 action-item specificity validation (conditional)** — checks whether
   richer signals + the redesigned Today view already fix the "generic
   response" feedback before committing to a separate prompt-engineering task.

Then, each on its own existing branch: autonomous procurement loop, the
flagship demo (**A30**, depends on A24 — needs live signals actually wired
in) → Instamart event supplies in the operator chatbot (**A31**) →
structured outputs (**A32**) → voice interface (**A33**) → eval pipeline
refresh (**A34**) → docs/screenshots (**A35**) → sync to main (**A36**).
Full detail, acceptance criteria, and branch names are in the "Phase 6A"
tracker sheet — this file is orientation, not a duplicate of it.

Phase 6B (Guest Concierge, 9 tasks, P6-B1→B9) is scoped in the "Phase 6B"
tracker sheet, gated entirely on P6-B1 (Swiggy consent) and starting only
after P6-A36 (sync to main). Do not write Phase 6B code before that gate
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
