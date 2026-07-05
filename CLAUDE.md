# CortexKitchen — Claude Code Master Reference

> **Read this file completely before touching any code.**
> Last updated: Phase 6 — 41 tasks complete, market intelligence expansion next.
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
- `search_menu` — all dishes matching query near any address
- `get_restaurant_menu` — any restaurant's full public menu
- `search_products` — Instamart products at any address
- `search_restaurants_dineout` — all Dineout restaurants
- `get_available_slots` — any restaurant's slot availability
- `get_restaurant_details` — any restaurant's details + deals
- `fetch_food_coupons(restaurantId=competitor_id)` — competitor's live coupons

**WHAT DOES NOT WORK (returns personal consumer account data):**
- `get_food_orders` — YOUR personal order history. not a restaurant's.
- `track_food_order` — YOUR personal delivery tracking.
- `your_go_to_items` — YOUR personal grocery habits.
- `get_orders` (Instamart) — YOUR personal procurement history.

The sync tasks (order_sync, feedback_sync, reservation_sync) were built before
this was fully understood. They return personal account data for the dev's
Swiggy account. Do NOT expand these or treat their output as restaurant data.
They are useful ONLY as chatbot context ("what did I order recently").

---

## Current system state (41 tasks complete)

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
| `search_restaurants` | Food | CompetitorEnricher | Working |
| `get_restaurant_menu` | Food | CompetitorEnricher | Working |
| `search_menu` | Food | chatbot only | Working — add to enricher |
| `get_food_orders` | Food | order_sync + chatbot | Personal data only |
| `track_food_order` | Food | feedback_sync | Personal data only |
| `search_products` | Instamart | ProcurementEnricher + chatbot | Working |
| `your_go_to_items` | Instamart | ProcurementEnricher | Personal data, may return empty |
| `get_saved_locations` | Dineout | OccupancyEnricher + dineout_manager | Working |
| `search_restaurants_dineout` | Dineout | OccupancyEnricher | Working |
| `get_available_slots` | Dineout | OccupancyEnricher + dineout_manager | Working, not parsing deals[] |
| `get_booking_status` | Dineout | reservation_sync | Only works after book_table |

### Tools to add next (public data, no staging needed)

| Tool | Where | What it adds |
|------|-------|-------------|
| `search_menu` | CompetitorEnricher | Dish-level pricing across all competitors |
| `fetch_food_coupons` | CompetitorEnricher | Competitor live Swiggy deals tonight |
| `get_restaurant_details` | OccupancyEnricher | Competitor Dineout deals + amenities |
| slot `deals[]` | OccupancyEnricher | Parse deals from already-fetched get_available_slots |

### Tools waiting for staging creds

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
│   ├── competitor.py      search_restaurants + get_restaurant_menu → competitor pricing
│   ├── occupancy.py       search_restaurants_dineout + get_available_slots → occupancy
│   └── procurement.py     search_products + your_go_to_items → ingredient prices
├── sync/
│   ├── order_sync.py      get_food_orders (personal data — limited value)
│   ├── feedback_sync.py   track_food_order (personal data — limited value)
│   └── reservation_sync.py get_booking_status skeleton
└── executor/              EMPTY — ProcurementExecutor when staging creds arrive

domain/services/
├── market_intel_service.py  Orchestrates enrichers concurrently
├── chat_service.py          Groq function calling: 7 tools including 3 Swiggy
├── critic_service.py        LLM critic with assumption diffs + stale assumptions
├── evaluation_sanity.py     Diffs 1-6 (incl. 2 market/dineout diffs)
└── ...others existing

api/routes/
├── market.py     GET /market/pulse — live Swiggy data independent of planning
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
SwiggyMarketIntelPanel.tsx  — competitor pricing table, occupancy badge
SwiggyStatusWidget.tsx      — connection status bar
SwiggySignalBadge.tsx       — Swiggy attribution badge
HighlightSwiggy.tsx         — Swiggy branded highlight
```

Swiggy logo: `apps/web/cortexkitchen-ui/public/swiggy-logo.png`

---

## What's being built next — in priority order

### Priority 1: Market intelligence expansion (P6-MI05 to MI11)
Branch: `feature/swiggy-market-intel-extended`

**P6-MI05** — `search_menu` in CompetitorEnricher (dish-level pricing)
**P6-MI06** — `fetch_food_coupons` (competitor Swiggy promotional deals)
**P6-MI07** — `get_restaurant_details` + slot `deals[]` (Dineout competitor deals)
**P6-MI08** — Assumption Diff 7 (competitor deals vs occupancy signal contradiction)
**P6-MI09** — Pricing impact model (quantify revenue effect of alerts)
**P6-MI10** — Scenario recommendation engine (proactive suggestion)
**P6-MI11** — Competitor price trend view on /market page

### Priority 2: Action queue (P6-S32)
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
search_menu        → dish-level prices → critic flags overpriced items precisely
get_restaurant_details → competitor deals → reservation node revises walk-in estimate
slot deals[]       → Diff 7 fires → plan corrected for demand absorption by competitors
pricing impact model → critic gets revenue numbers → plan is quantified not just directional
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
