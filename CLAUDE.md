# CortexKitchen — Claude Code Master Reference

> **Read this file completely before touching any code.**
> This is the single source of truth for the current system state, what is planned,
> how Swiggy integrates, and what the demo to the Swiggy team must show.
> Updated after every PR merge.

## Git rules (non-negotiable)

- **Never** add `Co-Authored-By: Claude` or any Claude authorship line to commit messages.
- **Never** add `🤖 Generated with Claude Code` or any Claude attribution line to PR descriptions.
- Commit messages and PR descriptions are authored by Anoushka only.

---

## Product vision

CortexKitchen is a **Swiggy-native restaurant operating system**. A restaurant owner
wakes up, opens CortexKitchen, and sees:
- overnight Swiggy performance (orders, delivery times, ratings)
- what competitors are charging today
- which ingredients are running low AND what they cost on Instamart right now
- how full nearby restaurants are tonight
- an action queue: approve an Instamart order, open more Dineout slots

The system plans, advises, and executes — on the restaurant's behalf, using Swiggy's
own platform data via MCP.

**This product will be demoed to the Swiggy team. Every Swiggy integration point must
be polished, clearly labelled with Swiggy branding, and the workflow must be
immediately legible to someone who knows the Swiggy platform.**

---

## Current system state (as of last merge: P6-S10–S13c)

### CRITICAL — Swiggy MCP actual response format (discovered via live test)

The real Swiggy MCP response is JSON-RPC 2.0, NOT the `{success, data}` envelope:

```json
{
  "result": {
    "content": [{"type": "text", "text": "..."}],
    "structuredContent": { }
  },
  "jsonrpc": "2.0",
  "id": 1
}
```

`call_tool()` returns `result["structuredContent"]` if present, else `{"text": content[0]["text"]}`.
Error at top level: `{"error": {"code": -32601, "message": "..."}}` → returns None.

**Accept header is required**: `Accept: application/json, text/event-stream`
Without it the server returns 406 Not Acceptable. This header is set in `client.py` on every call.

### What is built and working

**Backend — planning pipeline (LangGraph)**

```
ops_manager
    │
demand_forecast (Prophet — currently synthetic data, will use real Swiggy orders)
    │
qdrant_enrichment (shared Qdrant RAG context for all domain nodes — P6-S04)
    │
    ├── reservation          (ReservationService — synthetic data)
    ├── complaint_intelligence (ComplaintService + Qdrant RAG)
    ├── inventory            (InventoryService)
    ├── market_intel         (MarketIntelService — P6-S11 ✅)
    ├── dineout_manager      (OccupancyEnricher on OUR slots — P6-S12 ✅)
    └── [above 5 fan in to]
menu_intelligence            (MenuService + assumption diffing)
    │
aggregator                   (builds unified recommendation brief)
    │
critic                       (5-dimension LLM scoring + replanning loop — P6-S04)
    │
replan_orchestrator          (injects critic notes, re-runs aggregator — P6-S04)
    │
final_assembler              (builds API response)
```

Key features already shipped:
- Per-node model tier routing via CometAPI (fast/balanced/strong per node)
- Cross-agent assumption diffing (5 active diffs — Diffs 5+6 added P6-S13 ✅)
- Qdrant early enrichment node (shared RAG context before parallel fan-out)
- Critic replanning loop (rejected/revision → replan, max 2 retries)
- Semantic cache (Qdrant embedding-based, 0.92 threshold)
- Agentic chatbot with Groq function calling (query_runs, get_run_detail,
  trigger_planning_run, get_inventory_status, + 3 Swiggy tools P6-S13c ✅)
- LangSmith observability on all nodes
- Multi-tenant (org_id scoped throughout)
- Role-aware PDF + Excel exports
- Redis result cache (plan outputs, 1hr TTL, approved verdicts only)
- MarketIntelService — orchestrates CompetitorEnricher + OccupancyEnricher + ProcurementEnricher (P6-S10 ✅)

**Backend — Swiggy infrastructure**

```
infrastructure/swiggy/
├── client.py              SwiggyMCPClient — JSON-RPC 2.0, per-org OAuth,
│                          Accept header required, result.structuredContent parsing,
│                          graceful degradation (never raises), circuit breaker
├── circuit_breaker.py     Redis-backed — 3 failures/5min → open 30min, auto-reset
├── base_connector.py      BaseConnector ABC — sync() + enrich() interface
├── swiggy_connector.py    SwiggyConnector — orchestrates order + feedback + reservation sync
├── connector_repository.py CRUD for connectors table (per-org token storage)
├── provider_registry.py   Routes capabilities to providers (swiggy→zomato fallback)
├── enrichers/             CompetitorEnricher, OccupancyEnricher, ProcurementEnricher ✅ (P6-S07-S09)
├── executor/              EMPTY — ProcurementExecutor etc to be built (P6-S15-S16)
└── sync/
    ├── order_sync.py      get_food_orders → orders table (P6-S03 ✅)
    ├── feedback_sync.py   track_food_order → feedback table (P6-S06 ✅)
    └── reservation_sync.py get_booking_status → reservations table (P6-S05 ✅ skeleton)
```

Helper script: `scripts/get_swiggy_token.py` — one-command PKCE OAuth flow, saves token + address ID to .env

**Backend — DB schema (current)**

```
orders        + source (internal/swiggy/pos), channel (dine_in/delivery), external_order_id
reservations  + source (internal/dineout), external_booking_id
feedback      + delivery_time_actual_mins, delivery_time_promised_mins, was_late,
                external_order_id (dedup key for Swiggy delivery feedback)
connectors    per-org platform registry + connector_metadata JSONB
                (stores dineout_order_ids for reservation sync)
```

New enums: ConnectorType (swiggy/pos_square/google_reviews/zomato),
SyncStatus (never_synced/syncing/success/error),
FeedbackSource now includes swiggy_delivery

Latest migration: `d2c8f1e4b7a9` — adds feedback.external_order_id + connectors.connector_metadata

**Backend — API routes**

```
POST /api/v1/planning/run          trigger planning scenario
GET  /api/v1/runs                  list planning runs
GET  /api/v1/runs/{id}             get run detail
POST /api/v1/chat                  agentic chatbot
GET  /api/v1/health                health check
POST /api/v1/auth/login            JWT auth
POST /api/v1/auth/register
GET  /api/v1/restaurant-profiles   restaurant profile management
GET  /api/v1/settings              org settings
POST /api/v1/connectors/swiggy/sync  trigger live Swiggy MCP sync (P6-S05/S06 ✅)
GET  /api/v1/connectors/status       connector health + sync counts
```

**Frontend — existing pages**

```
/                    landing page
/login               auth
/register            auth
/dashboard           main ops dashboard (ForecastChart, AgentCard, CriticBanner,
                     ManagerActionPanel, ReservationSummary, InventoryAlerts,
                     MenuInsights, ComplaintInsights, RunHistory, WhatIfPanel)
/runs                planning run history
/chat                agentic chatbot
/settings            org settings
/restaurant-profiles restaurant profile management
/data-health         data health monitoring
```

**MCP server (CortexKitchen exposes itself as MCP)**
Tools: run_planning_scenario, get_run_history
Location: check mcp_server.py at repo root or apps/api/

---

## What is being built next (Phase 6 — Swiggy integration)

### Build order — follow this exactly

**STEP 1 — Complete sync layer (needs OAuth token, all read-only)**

P6-S05  `sync/reservation_sync.py`
- Tool: get_booking_status (Dineout)
- Maps to: reservations table, source='dineout', external_booking_id=orderId

P6-S06  `sync/feedback_sync.py`
- Tool: track_food_order (Food)
- Maps to: feedback table, source='swiggy_delivery'
- Fields: delivery_time_actual_mins, delivery_time_promised_mins, was_late

After S05+S06: existing 9-node pipeline runs on REAL Swiggy data for first time.

**STEP 2 — Market intelligence enrichers (needs OAuth token, all read-only)**

P6-S07  `enrichers/competitor.py` — CompetitorEnricher
- Tools: get_addresses → search_restaurants → search_menu + get_restaurant_menu (max 3)
- Output: competitor_pricing dict (area avg price per dish, pricing alerts)
- Wired into: menu_intel node prompt as ## Market Context section
- Redis cache: 30min TTL

P6-S08  `enrichers/occupancy.py` — OccupancyEnricher
- Tools: get_saved_locations → search_restaurants_dineout → get_restaurant_details
         → get_available_slots (today)
- Output: occupancy_signal (HIGH/MEDIUM/LOW), tonight_busy bool
- Wired into: reservation node prompt
- Redis cache: 30min TTL

P6-S09  `enrichers/procurement.py` — ProcurementEnricher
- Tools: get_addresses → search_products (per shortage item, max 5)
         + your_go_to_items (frequent reorders)
- Output: procurement_options list with spinId, price, unit, inStock per ingredient
- CRITICAL: store spinId in state — needed for layer 2 execution
- Wired into: inventory node prompt as ## Live Procurement Options section
- Redis cache: 30min TTL

**STEP 3 — New state fields + MarketIntelService**

P6-S10  Add to OrchestratorState (all Annotated[Optional[Dict], keep_last]):
- swiggy_competitor_context
- swiggy_occupancy_context
- swiggy_procurement_options
- swiggy_delivery_signal
- market_intel_output
- dineout_manager_output

MarketIntelService: orchestrates all 3 enrichers, manages Redis cache.

**STEP 4 — New LangGraph nodes (11-node pipeline)**

P6-S11  market_intel_node (10th node, parallel in fan-out)
- Runs: CompetitorEnricher + OccupancyEnricher
- Output: market_intel_output (competitor_pricing, area_occupancy, pricing_alerts)
- Writes: market_assumptions dict (for assumption diffing)
- LangGraph: add to parallel fan-out alongside reservation/complaint/inventory

P6-S12  dineout_manager_node (11th node, parallel in fan-out)
- Checks: your own Dineout slot availability tonight via get_booking_status
- If reservation node predicts high walk-in AND Dineout slots low → queue book_table action
- Writes: dineout_assumptions dict

P6-S13  Assumption diffs 5+6 in EvaluationSanityChecker:
- Diff 5: market_intel assumed_competitor_avg_price vs menu_intel promoted item prices
- Diff 6: dineout_manager assumed_dineout_slots_low vs reservation assumed_peak_occupancy

**STEP 5 — Add Swiggy tools to chatbot (HIGH PRIORITY FOR DEMO)**

The chatbot already has Groq function calling (P6-S04). Add these tools:
- search_menu(query, addressId) → "what's the average biryani price near me?"
- get_food_orders(addressId) → "what were my top selling items last week on Swiggy?"
- search_products(query, addressId) → "what does cream cost on Instamart right now?"

This makes the chatbot genuinely Swiggy-aware and is VERY demo-friendly.

**STEP 6 — Action queue**

P6-S14  ActionQueueService + action_queue table
- action_type: AUTO_EXECUTE | APPROVE_REQUIRED | RECOMMENDATION
- status: PENDING | APPROVED | EXECUTED | REJECTED | EXPIRED
- Plan output now includes action_queue section in API response

**STEP 7 — Frontend Swiggy integration**

P6-F04  /connectors page (CAN BUILD NOW — connectors table already exists)
- Lists available connectors with status badges (Connected/Disconnected/Error)
- Swiggy logo prominently displayed
- Shows: last sync time, records synced, data freshness indicator
- Connect button → triggers OAuth flow (phone + OTP)
- Disconnect → revokes token
- DEMO CRITICAL: this is the first thing the Swiggy team will see

P6-F06  Dashboard Swiggy widget (CAN BUILD NOW)
- Small status bar: "Swiggy connected · last sync 2h ago · 23 orders today"
- Swiggy logo/badge
- Today's Swiggy KPIs: orders today, avg delivery time, current rating
- Quick reorder button (your_go_to_items → one-tap Instamart)

P6-F01  Market intel panel on /runs/{id} (needs P6-S11)
- Competitor pricing table: your price vs area avg vs cheapest competitor
- Area occupancy badge (HIGH/MEDIUM/LOW with count)
- Instamart prices for shortage items
- Pricing alerts: red if >20% above area avg
- Swiggy logo next to "Powered by Swiggy MCP"

P6-F02  Action queue UI on /runs/{id} (needs P6-S14)
- Pending actions with type badge
- Approve/Reject buttons
- Instamart cart preview modal before approving checkout
- Procurement tracker: placed orders, ETA, delivered status

P6-F03  /brief page (needs P6-S17)
P6-F05  /live page (needs P6-S18)

**STEP 8 — Write tools (needs staging creds from Swiggy)**

P6-S15  ProcurementExecutor
- Flow: get_cart → clear_cart → update_cart (spinIds) → get_cart →
        LangGraph interrupt() → owner approval → checkout
- check-then-retry: on 5xx → get_orders before retrying checkout (non-idempotent)
- Stores in: procurement_orders table

P6-S16  Dineout booking execution
- Flow: create_cart → book_table
- check-then-retry: on 5xx → get_booking_status before retrying (non-idempotent)
- Stores in: reservations table

**STEP 9 — Product modes**

P6-S17  BriefingService — APScheduler 07:00 IST
- Lightweight run: demand_forecast + market_intel_node only
- Overnight Swiggy signals: get_food_orders since last run, track_food_order performance
- Stores in: daily_briefs table
- Sends email digest

P6-S18  LiveMonitorService — SSE during service hours (12-14, 19-22 IST)
- Polls every 30s: active orders, in-flight deliveries, procurement status
- Pushes to: /live page frontend

P6-S19  3 new CortexKitchen MCP server tools
- get_market_brief → calls MarketIntelService live
- get_action_queue → pending actions for org
- approve_action → triggers execution from Claude Desktop

---

## Swiggy integration — critical rules for Claude Code

**BEFORE WRITING ANY SWIGGY TOOL CALL:**
1. Read docs/SWIGGY_INTEGRATION.md (full reference with response schemas)
2. Verify tool name + parameters at https://mcp.swiggy.com/builders/llms.txt

**NON-NEGOTIABLE RULES:**
- `checkout` and `book_table` are NOT idempotent. On 5xx → check-then-retry.
  Never blind-retry. See docs/SWIGGY_INTEGRATION.md section 6.
- Dineout uses `lat`/`lng`. Food + Instamart use `addressId`. NEVER mix them.
- `update_cart` (Instamart) REPLACES the entire cart. Not additive.
- All enrichers MUST return None on any failure. Never raise. Nodes fall back
  to synthetic data gracefully.
- `spinId` (not product id) is the identifier for Instamart cart operations.
- OAuth tokens stored per org_id in connectors table. SWIGGY_ACCESS_TOKEN in
  settings is dev-only convenience.
- Rate limits: max 3 get_restaurant_menu calls, max 3 get_available_slots calls,
  max 5 search_products calls per planning run.

**ENV VARS (Swiggy):**
```
SWIGGY_ACCESS_TOKEN=   # personal OAuth token (dev only)
SWIGGY_ADDRESS_ID=     # saved address ID from get_addresses
```

---

## Swiggy workflows — how each integration point works

### Workflow 1: Morning data sync (nightly job)
```
APScheduler 02:00 IST
    → SwiggyOrderSyncService.sync(address_id)
        → get_food_orders (Food MCP)
        → upserts to orders table (source=swiggy, channel=delivery)
    → SwiggyReservationSyncService.sync()
        → get_booking_status (Dineout MCP)
        → upserts to reservations table (source=dineout)
    → SwiggyFeedbackSyncService.sync()
        → track_food_order (Food MCP)
        → upserts to feedback table (source=swiggy_delivery)
```
Result: By morning, DB has real Swiggy data. Pipeline runs on truth, not synthetic.

### Workflow 2: Planning run with market intelligence
```
Owner triggers planning scenario
    → ops_manager parses scenario
    → demand_forecast (Prophet on real Swiggy order history)
    → qdrant_enrichment (shared RAG context)
    → PARALLEL FAN-OUT:
        reservation + OccupancyEnricher
            → get_saved_locations + search_restaurants_dineout + get_available_slots
            → competitor occupancy injected into reservation prompt
        complaint_intelligence (real Swiggy delivery complaints from feedback table)
        inventory + ProcurementEnricher
            → search_products (per shortage item)
            → live Instamart prices + spinIds injected into inventory prompt
        menu_intelligence + CompetitorEnricher
            → search_restaurants + search_menu + get_restaurant_menu
            → competitor pricing injected into menu prompt
        market_intel_node (NEW — purely Swiggy-powered)
            → competitor snapshot: prices, occupancy, trending dishes
        dineout_manager_node (NEW — your own Dineout presence)
            → your slot availability tonight
    → aggregator (internal data + market context combined)
    → EvaluationSanityChecker (assumption diffs including market diffs)
    → critic (market-aware scoring)
    → action_queue (Instamart procurement, Dineout slot actions)
    → final_assembler → plan API response
```
Result: Plan says "butter chicken ₹40 above area avg. Approve Instamart order for tomatoes?"

### Workflow 3: Owner approves action
```
Frontend action queue → owner taps Approve on Instamart order
    → ActionQueueService.approve(action_id)
    → ProcurementExecutor:
        → get_cart (read current state)
        → clear_cart
        → update_cart (spinIds from procurement_options)
        → get_cart (verify before checkout)
        → LangGraph interrupt() — owner sees cart preview
        → checkout (COD, ₹999 max in Builders Club v1)
        → procurement_orders table updated
        → track_order → LiveMonitorService SSE → /live page updates
```
Result: Ingredients ordered. Owner sees delivery ETA. Complaint about running out of tomatoes never happens.

### Workflow 4: Daily brief (7am)
```
APScheduler 07:00 IST
    → BriefingService triggers lightweight pipeline:
        → demand_forecast (today's prediction)
        → market_intel_node (overnight competitor moves)
        → get_food_orders (last night's Swiggy performance)
        → track_food_order (delivery performance summary)
    → Generates daily_brief JSON
    → Stores in daily_briefs table
    → Email digest sent
    → /brief page shows brief
```
Result: Owner opens laptop at 7am, sees: "23 Swiggy orders yesterday. Avg delivery 34min (4min above promise). Competitor biryani prices dropped ₹30. Tomatoes low — Instamart ₹24/kg."

### Workflow 5: Live ops monitor during service
```
12:00 IST / 19:00 IST → LiveMonitorService activates
    → SSE feed to /live page
    → Polls every 30s:
        get_food_orders (activeOnly=true) → active delivery orders
        track_food_order → in-flight ETAs
        track_order → Instamart procurement status
    → Alerts on: delivery > threshold, order spike, ingredient arrived
```
Result: Chef can see live Swiggy order queue on kitchen display. Manager gets alert when 8pm surge hits.

---

## Swiggy branding rules (DEMO CRITICAL)

The Swiggy logo is at: `apps/web/cortexkitchen-ui/public/swiggy-logo.png`

Use it:
- On the /connectors page next to "Swiggy Food + Instamart + Dineout"
- On the market intel panel with "Powered by Swiggy MCP"
- On the dashboard connector status widget
- On any data card that shows Swiggy-sourced data
- On the action queue when showing Instamart orders
- On the /brief page overnight Swiggy performance section

Do NOT use it:
- On synthetic/internal data cards
- As a generic decoration unrelated to Swiggy data

Every Swiggy data card should have a small Swiggy badge + "via Swiggy MCP" label.
This makes the integration immediately visible to the Swiggy team during the demo.

---

## Project structure

```
cortexkitchen-dev/
├── CLAUDE.md                          ← this file
├── docs/
│   ├── SWIGGY_INTEGRATION.md          ← Swiggy reference (tool params, response schemas)
│   ├── ARCHITECTURE.md                ← system architecture
│   ├── AGENTS.md                      ← LangGraph node documentation
│   ├── APIS.md                        ← API endpoint reference
│   ├── DATA_MODEL.md                  ← DB schema
│   ├── DECISIONS.md                   ← architectural decision records
│   └── ROADMAP.md                     ← phase-by-phase roadmap
├── apps/
│   ├── api/
│   │   └── app/
│   │       ├── core/settings.py       ← all env vars including Swiggy
│   │       ├── orchestration/
│   │       │   ├── graph.py           ← LangGraph graph definition
│   │       │   ├── state.py           ← OrchestratorState TypedDict
│   │       │   └── nodes/             ← all 9 existing nodes
│   │       ├── domain/services/       ← business logic per domain
│   │       ├── infrastructure/
│   │       │   ├── swiggy/            ← ALL Swiggy code lives here
│   │       │   │   ├── client.py
│   │       │   │   ├── enrichers/     ← build CompetitorEnricher etc here
│   │       │   │   ├── executor/      ← build ProcurementExecutor etc here
│   │       │   │   └── sync/          ← order_sync done, reservation+feedback next
│   │       │   ├── cache/             ← Redis: plan_cache + semantic_cache
│   │       │   ├── vector/            ← Qdrant: memory, session, planning
│   │       │   └── jobs/async_runner.py ← Redis job queue
│   │       └── api/routes/            ← FastAPI route handlers
│   └── web/cortexkitchen-ui/
│       ├── app/                       ← Next.js pages (dashboard, runs, chat etc)
│       ├── components/dashboard/      ← all dashboard components
│       └── public/swiggy-logo.png    ← Swiggy logo for UI
└── CortexKitchen_Progress_Tracker_v5.xlsx ← task tracker
```

---

## Patterns to follow — always check these before writing new code

**Redis caching:** `apps/api/app/infrastructure/cache/plan_cache.py`
**Semantic cache:** `apps/api/app/infrastructure/cache/semantic_cache.py`
**Structlog logging:** `apps/api/app/core/logging.py`
**Settings pattern:** `apps/api/app/core/settings.py` (Pydantic BaseSettings)
**LangGraph state:** `apps/api/app/orchestration/state.py`
**Existing sync pattern:** `apps/api/app/infrastructure/swiggy/sync/order_sync.py`
**Existing enricher base:** `apps/api/app/infrastructure/swiggy/base_connector.py`
**Circuit breaker:** `apps/api/app/infrastructure/swiggy/circuit_breaker.py`

---

## What needs OAuth token vs staging creds

**Works with production OAuth token (get via npx mcp-remote):**
All read-only tools: get_food_orders, track_food_order, get_addresses,
search_restaurants, search_menu, get_restaurant_menu, get_available_slots,
get_booking_status, get_saved_locations, search_restaurants_dineout,
get_restaurant_details, search_products, your_go_to_items, get_orders,
get_cart, track_order

**Needs staging creds (mcp-staging.swiggy.com) — write tools that cost real money:**
checkout, place_food_order, book_table, update_cart, clear_cart

**Get OAuth token:**
```bash
npx mcp-remote https://mcp.swiggy.com/food
# completes phone + OTP in browser
# copy access_token → SWIGGY_ACCESS_TOKEN in .env
# call get_addresses once → copy id → SWIGGY_ADDRESS_ID in .env
```

---

## After every PR merge — update this file

Section to update: "Current system state"
What to add: what was built, which files changed, which features are now live
Keep it current so Claude Code never needs a zip upload to understand the codebase.
