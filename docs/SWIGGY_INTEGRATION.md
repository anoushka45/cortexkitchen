# CortexKitchen x Swiggy Builders Club: Complete Integration Reference

> **Status:** Active development, Phase 6A. Swiggy market intelligence, occupancy, and procurement enrichment are live in the planning pipeline; compliance remediation (exclusivity, competitive-intelligence anonymisation) is complete; execution tools (checkout, table booking) are implemented but blocked on staging credentials.
> **Access:** Swiggy Builders Club approved (builders@swiggy.in)  
> **Staging creds:** Pending (form submitted)  
> **Docs:** https://mcp.swiggy.com/builders/docs/  
> **Discord:** https://discord.gg/HrmGg3aG9g  
> **Swiggy full docs index:** https://mcp.swiggy.com/builders/llms.txt  

---

## 1. What CortexKitchen is becoming

CortexKitchen started as a planning tool: trigger a scenario, a set of specialist agents analyze internal data, a critic scores it, the owner gets a plan.

With Swiggy MCP it becomes a **Swiggy-native restaurant operating system**: Swiggy is a live data source for area market intelligence, occupancy signals, and ingredient procurement, alongside the operational data the pipeline already reasons over. The system plans intelligently with real market context and, once execution tools are unblocked by staging credentials, will act autonomously on the owner's behalf within an approval gate.

**The one-liner:** "The operating brain for a Swiggy-native restaurant: knows your business, knows your market, acts on your behalf."

---

## 2. The three Swiggy MCP servers

| Server | Endpoint | Tools | What it gives us |
|--------|----------|-------|------------------|
| Food | `POST mcp.swiggy.com/food` | 14 | Delivery orders, competitor menus, restaurant discovery |
| Instamart | `POST mcp.swiggy.com/im` | 13 | Ingredient procurement, stock availability, live pricing |
| Dineout | `POST mcp.swiggy.com/dineout` | 8 | Table reservations, competitor occupancy, slot management |

All three share one OAuth token per user session (5-day TTL). One authentication, all 35 tools.

---

## 3. Authentication: OAuth 2.1 with PKCE

### Flow
```
1. Generate PKCE verifier + challenge
2. Redirect user to /auth/authorize?response_type=code&client_id=<from-dcr>
   &redirect_uri=<callback>&code_challenge=<S256>&scope=mcp:tools
3. User authenticates via phone + OTP in browser
4. Exchange code for token at POST /auth/token
5. Store access_token per org_id (5-day TTL, re-auth on 401)
```

### Key endpoints
```
GET  https://mcp.swiggy.com/auth/authorize     # start flow
POST https://mcp.swiggy.com/auth/token         # exchange code
POST https://mcp.swiggy.com/auth/logout        # revoke session
GET  https://mcp.swiggy.com/.well-known/oauth-authorization-server
```

### Token call pattern
```python
POST https://mcp.swiggy.com/food
Authorization: Bearer {access_token}
Content-Type: application/json
Accept: application/json, text/event-stream   # REQUIRED: 406 without it

{
  "jsonrpc": "2.0",
  "method": "tools/call",
  "params": { "name": "search_restaurants", "arguments": { ... } },
  "id": 1
}
```

### Response envelope (all tools): ACTUAL format (discovered via live test)

**Success:**
```json
{
  "result": {
    "content": [{"type": "text", "text": "human-readable summary"}],
    "structuredContent": { }
  },
  "jsonrpc": "2.0",
  "id": 1
}
```

Parsing: use `result["structuredContent"]` (machine-readable). If absent, fall back to
`{"text": result["content"][0]["text"]}`.

**Error:**
```json
{ "error": {"code": -32601, "message": "Tool not found"}, "jsonrpc": "2.0", "id": 1 }
```

> **NOTE:** The original documented envelope `{"success": true, "data": {...}}` was
> incorrect. `SwiggyMCPClient.call_tool()` was updated in P6-S05/S06 to use the real format.
> All response schemas in section 17 show the actual `structuredContent` field values.

### Multi-tenant architecture (CortexKitchen)
Each restaurant owner authenticates their own Swiggy account. Token stored encrypted per `org_id` in the `connectors` table. Re-auth on 401. 5-day TTL: no refresh tokens in v1.

### Error handling
| HTTP | Meaning | Action |
|------|---------|--------|
| 401 | Token expired / invalid | Re-run OAuth flow |
| 419 | Session revoked | Full re-auth (phone + OTP) |
| 403 | Scope missing | Re-auth with broader scope |
| 400 | Bad input | Fix arguments, do not retry |
| 5xx | Upstream error | Exponential backoff, max 5 retries |

---

## 4. The tools relevant to a restaurant operator (out of 35)

The remaining tools are consumer commerce tools: `flush_food_cart`, `apply_food_coupon`, `create_address`, `delete_address`, `get_food_order_details`, and similar. These serve end-users placing orders, not restaurant operators planning their business, so CortexKitchen does not use them.

Of the tools documented below, a few are genuinely called in the live pipeline today
(`search_restaurants`, `get_restaurant_menu`, `fetch_food_coupons`, `search_products`,
`get_saved_locations`, `search_restaurants_dineout`, `get_restaurant_details`,
`get_available_slots`), a few are confirmed non-viable and removed (`search_menu`,
`your_go_to_items`), a few return only the developer's personal account data and are used
only as chat assistant context (`get_food_orders`, `track_food_order`, `get_orders`), and the
execution tools (`update_cart`, `get_cart`, `clear_cart`, `checkout`, `create_cart`,
`book_table`) are implemented in code but blocked on Swiggy staging credentials.

---

### 4.1 Food MCP: 6 tools

**`get_addresses`**
```
Parameters: none
Returns: saved addresses with addressId, label, display text (NO coordinates: privacy)
Use: foundation for all Food + Instamart calls. Call once per session, cache addressId.
```

**`search_restaurants`**
```
Parameters:
  addressId  string  required  from get_addresses
  query      string  required  restaurant name or cuisine type
  offset     number  optional  pagination (default 0)

Returns: restaurants with id, name, availabilityStatus, rating, distanceKm, costForTwo
Use: competitor discovery. Only recommend OPEN restaurants.
CortexKitchen use: CompetitorEnricher: find competitor restaurants by cuisine near our address
```

**`get_restaurant_menu`**
```
Parameters:
  addressId     string  required  from get_addresses
  restaurantId  string  required  from search_restaurants
  page          number  optional  default 1
  pageSize      number  optional  default 5, max 8

Returns: paginated categories with items, prices, hasVariants, hasAddons
CortexKitchen use: CompetitorEnricher: pull competitor menu pricing by category
```

**`search_menu`**
```
Parameters:
  addressId               string  required
  query                   string  required  dish name
  restaurantIdOfAddedItem string  optional  scope to one restaurant
  vegFilter               number  optional  1=veg only
  offset                  number  optional

Returns: dishes with prices, variants (variations OR variantsV2, never both), addons
CortexKitchen use: not used. Confirmed live to return zero results for every query tested against
this Swiggy sandbox/account, so `CompetitorEnricher` does not call it. Dish-level pricing is instead
derived by keyword-classifying every competitor menu item into a category (pizza, pasta, sides,
etc.) from `get_restaurant_menu` output, since exact dish-name matching between menus does not
reliably align.
```

**`get_food_orders`**
```
Parameters:
  addressId   string   required
  orderCount  number   optional  default 5, max 20

Returns: active + recent orders with items, status, restaurant info
CortexKitchen use: sync nightly → orders table (source='swiggy', channel='delivery')
                   ForecastService trains Prophet on real delivery demand
```

**`track_food_order`**
```
Parameters:
  orderId  string  optional  if omitted returns all active orders

Returns: status, ETA, delivery partner location, prep time, delivery time
CortexKitchen use: sync -> feedback table (source='swiggy_delivery')
                   delivery latency patterns feed the complaint_intelligence node
                   this returns the developer's own personal delivery tracking, not a
                   restaurant's, so it is used only as chatbot context, not planning input
```

---

### 4.2 Instamart MCP: 9 tools

**`get_addresses`** *(same as Food, different server)*
```
Parameters: none
Returns: saved addresses with addressId
Note: same tool name, different endpoint (mcp.swiggy.com/im)
```

**`search_products`**
```
Parameters:
  addressId  string  required
  query      string  required  product name, category, or brand
  offset     number  optional

Returns: products with variants, each variant has spinId (SKU identifier), price, unit, availability
CRITICAL: add variants to cart using spinId, NOT product id
CortexKitchen use: ProcurementEnricher: search for shortage ingredients, get live price + spinId
```

**`your_go_to_items`**
```
Parameters:
  addressId  string  required
  offset     number  optional

Returns: frequently/recently ordered items with variants and spinIds
CortexKitchen use: not used. Confirmed live to return the developer's own personal grocery habits
                   (pet food, personal groceries), not restaurant procurement data. Was calling
                   this from ProcurementEnricher and it was leaking into the real planning
                   pipeline's inventory prompt; fully removed.
```

**`update_cart`**
```
Parameters:
  selectedAddressId  string    required
  items              object[]  required  [{spinId, quantity}]

NOTE: REPLACES entire cart, does not append
CortexKitchen use: ProcurementExecutor (`executor/`), implemented but not yet exercised: blocked on
                   Swiggy staging credentials. Always call get_cart before to verify current state.
```

**`get_cart`**
```
Parameters: none
Returns: cart items, bill breakdown, availablePaymentMethods
CortexKitchen use: ProcurementExecutor: read before every mutate, verify before checkout.
                   Blocked on staging credentials, same as update_cart.
```

**`clear_cart`**
```
Parameters: none
CortexKitchen use: ProcurementExecutor: clear before building new procurement cart.
                   Blocked on staging credentials, same as update_cart.
```

**`checkout`**
```
Parameters:
  addressId      string  required
  paymentMethod  string  optional  from get_cart availablePaymentMethods

CRITICAL: NOT idempotent. On 5xx, call get_orders to check if the order placed before retrying.
COD only in Builders Club v1.
CortexKitchen use: ProcurementExecutor, gated by Action Queue approval. Blocked on staging
                   credentials: implemented in code, not yet exercised against a live account.
```

**`get_orders`**
```
Parameters:
  count      number   optional  default 10, max 20
  orderType  string   optional  default "DASH"
  activeOnly boolean  optional

Returns the developer's own personal procurement history, not a restaurant's.
CortexKitchen use: intended as the check-then-retry pattern after a checkout 5xx, once checkout
                   is exercised against a live account.
```

---

### 4.3 Dineout MCP: 7 tools

**`get_saved_locations`**
```
Parameters: none
Returns: saved addresses with id and addressLine (for Dineout: NOT same as Food/Instamart addressId)
IMPORTANT: Dineout uses lat/lng for searches, not addressId like Food/Instamart
           get_saved_locations returns addressId you can pass to search_restaurants_dineout
           which resolves coordinates server-side
CortexKitchen use: OccupancyEnricher: resolve location for Dineout searches
```

**`search_restaurants_dineout`**
```
Parameters:
  query       string  required   restaurant name, cuisine, locality, or category
  entityType  string  optional   "locality" | "CUISINE" | "RESTAURANT_CATEGORY"
  addressId   string  optional   from get_saved_locations (coordinates resolved server-side)
  latitude    number  optional   use for direct city/area searches
  longitude   number  optional   use for direct city/area searches

entityType matters:
  locality search → entityType="locality"
  cuisine search → entityType="CUISINE"
  category search (cafe, pub) → entityType="RESTAURANT_CATEGORY"
  restaurant name → omit entityType

Returns: restaurants with cuisines, rating, costForTwo, distance, highlights, offers, deals
CortexKitchen use: OccupancyEnricher: find competitor restaurants by cuisine near us
```

**`get_restaurant_details`**
```
Parameters:
  restaurantId  string  required  from search_restaurants_dineout
  latitude      number  required  same as search
  longitude     number  required  same as search

Returns: ratings, deals, timings, address, amenities, exclusive Dineout offers
CortexKitchen use: OccupancyEnricher: richer competitor context (deals, amenities)
                   dineout_manager_node: our own restaurant details
```

**`get_available_slots`**
```
Parameters:
  restaurantId  string  required
  date          string  required  YYYY-MM-DD or epoch timestamp
  latitude      number  required
  longitude     number  required

Returns: slots up to 7 days ahead, grouped as breakfast/lunch/dinner bands
         each slot has: slotId, itemId, reservationTime (epoch), displayTime, deals[]
         deals have isFree boolean: only FREE reservations work in Builders Club v1
CortexKitchen use: OccupancyEnricher: competitor slot availability = occupancy signal
                   dineout_manager_node: our own slot availability tonight
```

**`book_table`**
```
Parameters:
  restaurantId    string  required
  slotId          number  required  from slot.deals[].slotId
  itemId          string  required  from slot.deals[].itemId (format: "restaurantId-ticketId")
  reservationTime number  required  epoch from slot.reservationTime
  guestCount      number  required  1-20
  latitude        number  required
  longitude       number  required

CRITICAL: NOT idempotent. On 5xx, call get_booking_status before retrying.
Only FREE reservations (isFree=true, bookingPrice=0) in Builders Club v1.
CortexKitchen use: DineoutExecutor (`executor/`), gated by Action Queue approval. Implemented in
                   code, not yet exercised: blocked on Swiggy staging credentials, and there is no
                   real Dineout restaurant ID configured yet.
```

**`create_cart`** *(used internally by book_table)*
```
Parameters:
  restaurantId    string  required
  cartType        string  required  "DEAL_TICKET_PURCHASE" for booking
  latitude        number  required
  longitude       number  required
  slotId          number  optional  required for booking
  itemId          string  optional  required for booking
  reservationTime number  optional  required for booking
  guestCount      number  optional  required for booking

Note: book_table calls create_cart internally. Only use directly for standalone cart operations.
```

**`get_booking_status`**
```
Parameters:
  orderId  string  required  from book_table confirmation

Returns: restaurant name, date, time, guests, deal title, status
CortexKitchen use: check-then-retry after book_table 5xx
                   sync → reservations table (source='dineout')
                   dineout_manager_node: our booking density tonight
```

---

## 5. Architecture: how it all fits together

### Three data layers

```
LAYER 0 - Unified data layer (PostgreSQL): always present, always authoritative
  orders         source='swiggy'|'pos'|'walk_in'  channel='delivery'|'dine_in'
  reservations   source='dineout'|'phone' (eazydiner removed, see D-023 in docs/DECISIONS.md)
  feedback       source='swiggy_delivery'|'google'|'internal'|'zomato' (provenance tag only)
  inventory      stock levels + procurement history
  action_queue   pending actions awaiting approval
  vendors, vendor_price_quotes  manual/WhatsApp procurement records

LAYER 1 - Live market intelligence (area-level aggregates only, not persisted)
  market intel           Food + Dineout MCP, anonymised to area_restaurant_count, deals_summary,
                         landscape_summary, category pricing: never a named restaurant (D-024)
  ingredient_market      Instamart MCP: search_products (your_go_to_items removed, personal data)
  live signals           independent of Swiggy: weather, holidays, industry trends, FSSAI alerts

LAYER 2 - Action surface (with approval gates)
  Instamart procurement  update_cart -> get_cart -> checkout, gated by the Action Queue's
                         trust-ladder approval, not yet exercised: blocked on staging credentials
  Dineout management     create_cart -> book_table, same staging-credential block
```

### Connector pattern

Every external platform implements `BaseConnector` with two modes:

```python
class BaseConnector(ABC):
    def __init__(self, client: SwiggyMCPClient, org_id: int): ...

    async def sync(self) -> dict:
        """Nightly job. Pulls historical data. Writes to layer 0."""
        ...

    async def enrich(self, context: dict) -> dict | None:
        """At planning time. Live signals. NOT written to DB. Returns None on any failure."""
        ...
```

`SwiggyConnector` is the reference implementation. Future connectors are scoped to non-competing
categories only (Google Reviews, Square POS, loyalty/rewards, accounting/inventory tools) while the
signed Integration Agreement's exclusivity clause is in effect; see D-019 and D-023 in
`docs/DECISIONS.md`.
Token per org stored in `connectors` table via `ConnectorRepository`.

### LangGraph pipeline: fourteen nodes

Full per-node detail lives in `docs/AGENTS.md`. Summary of where Swiggy and live-signal data enters:

```
ops_manager
    |
live_signals                 <- weather, holidays, industry trends, FSSAI alerts fetched once
    |
demand_forecast               <- weather applies a real multiplier to the Prophet forecast number
    |
qdrant_enrichment             <- PlanningMemoryService: past approved plans (recency-decay ANN)
    |
    +-- reservation           <- OccupancyEnricher: anonymised Dineout area occupancy
    +-- complaint_intelligence
    +-- inventory              <- ProcurementEnricher: Instamart prices + availability
    +-- market_intel           <- CompetitorEnricher + OccupancyEnricher, merged with live_signals
    +-- dineout_manager        <- Dineout slot and deal analysis
            | (LangGraph fan-in: all 5 complete before menu_intelligence fires)
    menu_intelligence
            |
        aggregator
            |
          critic
            |
     (approved, or revision -> replan_orchestrator -> aggregator, max 2 cycles)
            |
    final_assembler -> plan + Action Queue items
```

### Product modes

| Mode | Trigger | What runs | Output |
|------|---------|-----------|--------|
| Planning | Owner triggers a scenario on `/planning` | Full fourteen-node pipeline | Operational plan, streamed live |
| Daily summary | On-demand, cached 1 hour per org | `BriefingService.get_summary()` | Short AI-generated executive summary on the Dashboard (`GET /business/summary`) |

A separate always-on live-monitoring mode (a dedicated `/live` alerts feed polling during service
hours) was scoped early on but was not built; the live-intelligence context strip on the Dashboard
and Planning pages, refreshed hourly, covers the same need today.

---

## 6. Non-idempotent tools: critical patterns

Three tools are NOT safe to blind-retry on failure:

### `checkout` (Instamart)
```python
# On 5xx:
try:
    result = await checkout(addressId=addr)
except Exception as e:
    if is_5xx(e):
        # CHECK FIRST before retrying
        orders = await get_orders(activeOnly=True)
        if order_already_placed(orders, cart_items):
            return orders[0]  # treat as success
        else:
            return await checkout(addressId=addr)  # safe to retry
```

### `place_food_order` (Food): NOT used by CortexKitchen (consumer tool)
Same pattern. Listed for completeness.

### `book_table` (Dineout)
```python
# On 5xx:
try:
    result = await book_table(restaurantId=rid, slotId=sid, ...)
except Exception as e:
    if is_5xx(e):
        status = await get_booking_status(orderId=...)
        if status.confirmed:
            return status  # already booked
        else:
            return await book_table(...)  # safe to retry
```

### Exponential backoff (all retriable errors)
```python
async def retry(fn, max_attempts=4):
    for attempt in range(max_attempts):
        try:
            return await fn()
        except Exception as e:
            if not is_retriable(e) or attempt == max_attempts - 1:
                raise
            delay = 0.5 * (2 ** attempt)  # 0.5, 1, 2, 4s
            await asyncio.sleep(delay + random.random() * delay * 0.3)

def is_retriable(e):
    status = getattr(e, 'status', None)
    return status and 500 <= status < 600
```

---

## 7. Rate limits

| Scope | Planned limit (v1.x) |
|-------|---------------------|
| Per user per server (reads) | 120 req/min |
| Per user per server (writes) | 30 req/min |
| Burst (10s window) | 2x steady-state |

Rate limiting NOT enforced in v1.0: upstream shedding handles abuse. Wire 429 handler anyway for v1.1 readiness. Honor `Retry-After` header when it arrives.

**CortexKitchen limits per planning run:**
- Max 3 `get_restaurant_menu` calls (CompetitorEnricher)
- Max 3 `get_available_slots` calls (OccupancyEnricher)
- Max 5 `search_products` calls (ProcurementEnricher)

---

## 8. Implementation status

This section originally laid out a week-by-week build plan with task IDs and branch names before
any of it was built. Implementation diverged from that plan in normal, expected ways (different
table names, a different final node count, features realized differently than first scoped), so
carrying the original plan forward here would misstate what actually exists. Task-level status now
lives in the project's Excel progress tracker and in `CLAUDE.md`; this section states what is true
today.

**Delivered:** BaseConnector and SwiggyMCPClient with circuit breaker, provider registry, and tool
tracing; connector sync jobs for orders, feedback, and reservation status; CompetitorEnricher,
OccupancyEnricher, ProcurementEnricher, and MarketIntelService; the `market_intel` and
`dineout_manager` graph nodes; ActionQueueService with a trust-ladder approval mechanic;
PlanningMemoryService, SemanticPlanCache, and SemanticChatCache; live intelligence signals
independent of Swiggy (weather, industry trends, regulatory alerts); compliance remediation
(removal of the Zomato stub connector, anonymisation of market intelligence); the `/market`,
`/connectors`, `/action-center` frontend pages; five MCP server tools for Claude Code and Claude
Desktop.

**Blocked on Swiggy staging credentials:** Instamart checkout execution (`update_cart`, `get_cart`,
`checkout`) and Dineout table booking execution (`create_cart`, `book_table`). Both are implemented
in code (`executor/`) but not yet exercised against a live account.

**Not built as originally scoped:** a dedicated `/live` real-time alerts page (superseded by the
hourly-refreshed live-intelligence context strip on the Dashboard and Planning pages) and a
scheduled 7am email brief (superseded by an on-demand, hourly-cached executive summary on the
Dashboard, `GET /business/summary`). A POS CSV connector and a voice interface remain future work.

---

## 9. Database tables

Full schema detail lives in `docs/DATA_MODEL.md`. The tables most relevant to the Swiggy
integration: `connectors` (per-org OAuth token and sync status), `orders` and `reservations`
(`source` and `channel` columns distinguish Swiggy-originated rows from internal ones), `feedback`
(`source` enum includes `swiggy_delivery`), `action_queue` (approval lifecycle for procurement and
other agentic actions), `vendors` and `vendor_price_quotes` (manual and WhatsApp-based procurement,
not an e-commerce checkout table, since real procurement today is mostly phone and market visits).
There is no separate `platform_orders`, `procurement_orders`, `market_snapshots`, or `daily_briefs`
table: market intelligence is not persisted (fetched fresh per run) and the daily summary is cached
in Redis, not stored in its own table.

---

## 10. OrchestratorState fields relevant to Swiggy and live signals

```python
swiggy_competitor_context     # from CompetitorEnricher, area-level only, no named restaurants
swiggy_occupancy_context      # from OccupancyEnricher, area-level only
market_intel_output           # from the market_intel node; includes live_signals_text,
                               # which merges Swiggy signals with weather/trends/compliance
weather_signal                # from the live_signals node
trends_signal                 # from the live_signals node
compliance_alerts_signal      # from the live_signals node
holiday_context                # from the live_signals node
custom_profile                 # free-text or dynamically composed scenario profile
```

Full current field list lives in `app/orchestration/state.py`.

---

## 11. Cross-agent assumption diffing

Full detail and the current diff list live in `docs/ARCHITECTURE.md`'s "Cross-agent assumption
diffing" section and D-017 in `docs/DECISIONS.md`. Each domain node, including `market_intel` and
`dineout_manager`, writes the assumptions it acted on to state; `EvaluationSanityChecker` cross-diffs
them after the parallel fan-out and surfaces contradictions to the critic.

---

## 12. CortexKitchen's own MCP server tools

`apps/api/mcp_server.py` exposes five tools today, alongside `run_planning_scenario` and
`get_run_history`:

```python
get_market_brief      # calls MarketIntelService live, returns an anonymised area market snapshot
get_action_queue       # returns pending (or other-status) actions for the org
approve_action         # owner approves an action from Claude Desktop; for a WhatsApp vendor
                        # order this is the same step that sends the message
```

These share the same backend services as the in-app chat assistant's equivalent tools, so both
surfaces behave identically.

---

## 13. Key constraints and gotchas

- **COD only** in Builders Club v1. No UPI or card payments.
- **₹1000 cap** on Food orders in Builders Club v1. Instamart has no documented cap but has ₹99 minimum.
- **book_table** only supports FREE reservations (isFree=true, bookingPrice=0) in v1.
- **Dineout uses lat/lng** not addressId for most calls. get_saved_locations returns addressId that Dineout resolves to coordinates server-side. Do NOT pass Food/Instamart addressId to Dineout tools.
- **search_menu returns variants as EITHER `variations` OR `variantsV2`**, never both. Check which field exists and use consistently in cart operations.
- **Cart is per-restaurant** (Food) and per-address (Instamart). Changing restaurant/address flushes cart.
- **update_cart REPLACES** entire Instamart cart. Not additive.
- **Widgets (restaurant-card, menu-item, cart-widget)** are documented but NOT live in v1.0. The iframe hosting layer is in progress. Build against the data payload, not the widget URLs.
- **Rate limiting not enforced** in v1.0. Upstream shedding handles abuse. Wire 429 handler for v1.1.
- **Refresh tokens not wired** in v1.0. Re-run full OAuth on token expiry.
- **Staging at** `mcp-staging.swiggy.com/{server}`: same shape as production, seeded data, no real orders.
- **localhost works** without staging creds. OAuth against real server, redirect_uri = http://localhost.

---

## 14. Swiggy docs reference URLs

```
Full docs index:      https://mcp.swiggy.com/builders/llms.txt
Full docs text:       https://mcp.swiggy.com/builders/llms-full.txt
Per-page markdown:    append .md to any docs URL
  e.g. https://mcp.swiggy.com/builders/docs/reference/food/search_restaurants.md

Food tool schemas:    https://mcp.swiggy.com/builders/docs/reference/food/
Instamart schemas:    https://mcp.swiggy.com/builders/docs/reference/instamart/
Dineout schemas:      https://mcp.swiggy.com/builders/docs/reference/dineout/
Auth flow:            https://mcp.swiggy.com/builders/docs/start/authenticate/
Delegated auth:       https://mcp.swiggy.com/builders/docs/start/enterprise/delegated-auth/
Error codes:          https://mcp.swiggy.com/builders/docs/reference/errors/
Rate limits:          https://mcp.swiggy.com/builders/docs/operate/rate-limits/
Ship to production:   https://mcp.swiggy.com/builders/docs/build/ship-to-production/
Access / onboarding:  https://mcp.swiggy.com/builders/docs/operate/access/
LangGraph recipe:     https://mcp.swiggy.com/builders/docs/start/developer/build-an-agent/
```

---

## 15. MCP Governance Layer

Three governance components make Swiggy MCP calls production-safe:

### Circuit Breaker (`infrastructure/swiggy/circuit_breaker.py`)

Redis-backed per-endpoint circuit breaker. Prevents cascading failures when a Swiggy endpoint is degraded.

| Constant | Value | Description |
|----------|-------|-------------|
| `FAILURE_THRESHOLD` | 3 | Failures within `WINDOW_SECONDS` to trip the circuit |
| `WINDOW_SECONDS` | 300 | Sliding failure window (Redis INCR TTL) |
| `OPEN_SECONDS` | 1800 | How long the circuit stays open before auto-reset |

**Redis keys:**
- `circuit:fail:swiggy:{tag}`: failure counter (INCR with 300s TTL)
- `circuit:open:swiggy:{tag}`: open flag (SETEX 1800s)

**Fail-open policy:** if Redis is unavailable, `is_open()` returns `False` so calls are attempted rather than blocked.

**Integration:** `SwiggyMCPClient.call_tool()` calls `is_open()` before every HTTP request. On `None` result: `record_failure()`. On success: `record_success()` (also clears the counter for faster recovery).

**Health endpoint:** `GET /health/circuits` returns current state for all three endpoints (`food`, `im`, `dineout`).

---

### Tool Tracing (`SwiggyMCPClient._traces`)

Every Swiggy MCP call appends a trace dict to `self._traces`. Call `drain_traces()` at the end of a connector run to collect them for observability.

**Trace shape:**
```json
{
  "provider": "swiggy",
  "endpoint": "food",
  "tool": "search_restaurants",
  "status": "ok",
  "duration_ms": 234.1,
  "attempt": 1
}
```

`status` values: `"ok"` | `"circuit_open"` | `"auth_error"` | `"http_{code}"` | `"tool_error"` | `"exception"`

A `circuit_open` trace is recorded without an HTTP call: this is how you can distinguish blocked calls from network failures in post-run analysis.

---

### Provider Registry (`infrastructure/swiggy/provider_registry.py`)

Routes planning capabilities to the highest-priority healthy provider. Uses both DB `sync_status` and live circuit breaker state.

```python
CAPABILITY_PROVIDERS = {
    "competitor_pricing": ["swiggy"],
    "reservation_data":   ["swiggy"],
    "procurement":        ["swiggy"],
    "order_history":      ["swiggy"],
}
```

`swiggy` is currently the only provider for every capability. The list-based structure stays -
it exists to support future providers (POS, review platforms, loyalty/rewards, accounting/inventory
tools), not to be permanently single-entry.

**Two routing methods:**
- `get_provider(org_id, capability, db)`: synchronous; DB health only. Use when you can't await.
- `get_provider_async(org_id, capability, db)`: async; DB health AND circuit breaker state. Use this in production enricher calls.

**Routing logic:** iterates providers in priority order; skips any that either (a) lack a healthy connector row in the `connectors` table, or (b) have an open circuit for the capability's endpoint. Returns the first passing provider, or `None`.

**`_SWIGGY_CAPABILITY_ENDPOINT` map:**
```python
{
    "competitor_pricing": "food",
    "reservation_data":   "dineout",
    "procurement":        "im",
    "order_history":      "food",
}
```

Adding a new provider (e.g. Google Reviews for sentiment data) requires only: (1) a connector row in `CAPABILITY_PROVIDERS`, and (2) a `BaseConnector` subclass. The registry routes to it automatically when the org's connector row is active and the circuit is closed.

---

## 16. For Claude Code: rules when working on Swiggy integration

```
You have access to Swiggy Builders Club docs. Before writing any Swiggy tool call,
parameter name, or error handling code, verify against:

- Index:     https://mcp.swiggy.com/builders/llms.txt
- Full text: https://mcp.swiggy.com/builders/llms-full.txt
- Per-page:  append .md to any https://mcp.swiggy.com/builders/docs/... URL

Rules:
1. Never invent tool names or parameters. If docs don't cover it, say so.
2. checkout and book_table are NOT idempotent. Always check-then-retry on 5xx.
3. Dineout uses lat/lng, Food/Instamart use addressId: do not mix them.
4. update_cart REPLACES the entire Instamart cart: not additive.
5. Swiggy enricher calls always return None on failure: never raise.
   Nodes must handle None gracefully and fall back to synthetic data.
6. spinId (not product id) is used for Instamart cart operations.
7. All Swiggy tokens stored per org_id in connectors table, never in env vars directly.
```

---

## 17. Response schemas: actual field names per tool

All responses follow the JSON-RPC 2.0 envelope. `call_tool()` returns the `structuredContent`
dict directly: the schemas below show the **contents of structuredContent**, not the full envelope.

```
full response → result.structuredContent → (what is shown below)
```

Claude Code must use these exact field names when writing sync or enricher code.

---

### Food MCP response schemas

**`get_addresses`**
```json
{
  "addresses": [
    {
      "id": "addr_01HXYZ",
      "label": "Home",
      "addressLine": "123 MG Road",
      "city": "Bengaluru",
      "displayText": "123 MG Road, Bengaluru"
    }
  ]
}
```
Key fields: `addresses[]`, each has `id` (use as addressId), `label`, `displayText`

---

**`get_food_orders`**
```json
{
  "orders": [
    {
      "orderId": "SW-001",
      "restaurantName": "Pizza Palace",
      "status": "delivered",
      "totalAmount": 360.0,
      "orderedAt": "2026-06-26T19:30:00+05:30",
      "items": [
        {
          "name": "Margherita Pizza",
          "quantity": 2,
          "price": 150.0
        }
      ]
    }
  ]
}
```
Key fields: `orders[]`, each has `orderId`, `restaurantName`, `status`, `totalAmount`, `orderedAt` (ISO-8601), `items[]` with `name`, `quantity`, `price`

CortexKitchen mapping:
- `orderId` → `external_order_id` prefix (appended with item index for per-item rows)
- `orderedAt` → `ordered_at` (parse to naive UTC datetime)
- `status == "delivered"` → `is_delivery=True`, `source="swiggy"`, `channel="delivery"`

---

**`track_food_order`**
```json
{
  "orderId": "SW-001",
  "status": "delivered",
  "prepTime": 18,
  "deliveryTime": 34,
  "promisedTime": 30,
  "isLate": true,
  "restaurantName": "Pizza Palace",
  "deliveryPartner": {
    "name": "Ravi",
    "phone": "XXXXXX1234"
  }
}
```
Key fields: `orderId`, `status`, `prepTime` (mins), `deliveryTime` (mins), `promisedTime` (mins), `isLate` (bool)

CortexKitchen mapping:
- `deliveryTime` → `delivery_time_actual_mins`
- `promisedTime` → `delivery_time_promised_mins`
- `isLate` → `was_late`
- `orderId` → `external_order_id` for dedup on feedback table

---

**`search_restaurants`**
```json
{
  "restaurants": [
    {
      "id": "rest_42",
      "name": "Biryani House",
      "availabilityStatus": "OPEN",
      "avgRating": 4.3,
      "totalRatings": 1240,
      "costForTwo": 400,
      "distanceKm": 2.1,
      "deliveryTime": "30-35 MIN",
      "cuisines": ["Biryani", "North Indian"]
    }
  ],
  "nextOffset": 10
}
```
Key fields: `restaurants[]`, each has `id`, `name`, `availabilityStatus` (filter to "OPEN" only), `avgRating`, `costForTwo`, `distanceKm`, `cuisines[]`

---

**`get_restaurant_menu`**
```json
{
  "restaurantId": "rest_42",
  "categories": [
    {
      "name": "Starters",
      "items": [
        {
          "id": "item_1",
          "name": "Chicken Tikka",
          "price": 220.0,
          "hasVariants": false,
          "hasAddons": true,
          "isAvailable": true
        }
      ]
    }
  ],
  "totalPages": 3
}
```
Key fields: `categories[]`, each has `name`, `items[]` with `id`, `name`, `price`, `isAvailable`

CortexKitchen use: extract `name` + `price` per item to build competitor pricing benchmark

---

**`search_menu`**
```json
{
  "items": [
    {
      "id": "item_1",
      "name": "Butter Chicken",
      "restaurantId": "rest_42",
      "restaurantName": "Punjab Grill",
      "price": 320.0,
      "hasVariants": true,
      "variations": [
        {"id": "v1", "name": "Half", "price": 180.0},
        {"id": "v2", "name": "Full", "price": 320.0}
      ]
    }
  ],
  "nextOffset": 10
}
```
Key fields: `data.items[]`, each has `name`, `restaurantName`, `price`, `hasVariants`
CRITICAL: item has EITHER `variations` OR `variantsV2`, never both. Check which exists.

CortexKitchen use (P6-MI05): `CompetitorEnricher._search_dish_prices()` calls this once per
our top dish (max 5/run) to get dish-level competitor prices across ALL nearby restaurants -
more precise than the category-level averages from `get_restaurant_menu`.

---

**`fetch_food_coupons`**

Request parameters: `restaurantId` (required, competitor's restaurant ID), `addressId` (required),
`couponCode` (optional: omit to get all available coupons for that restaurant).

```json
{
  "bestCoupons": [
    {
      "code": "SAVE20",
      "title": "20% off above Rs.300",
      "discountAmount": 20,
      "requiresOnlinePayment": false
    }
  ],
  "moreOffers": [
    {
      "code": "FLAT15",
      "title": "15% off, no minimum",
      "discountAmount": 15,
      "requiresOnlinePayment": false
    }
  ]
}
```
Key fields: `bestCoupons[]` + `moreOffers[]` (combine both), each has `code`, `title`,
`discountAmount` (or `discountPercentage`), `requiresOnlinePayment`.
CRITICAL: filter to `requiresOnlinePayment=false` only: Builders Club v1 supports COD checkout only.
Returns PUBLIC promotional data regardless of the calling account's activity: safe to call for
any competitor's restaurantId.

CortexKitchen use (P6-MI06): `CompetitorEnricher._fetch_competitor_deals()` calls this for up to
3 nearby restaurants per run; the raw named-restaurant result is reduced to a count + area-level
summary (`deals_active_count`/`deals_summary`, P6-A20) before it reaches the Area Market Signals
prompt or anything downstream: no restaurant name is ever paired with its specific deal.

---

### Instamart MCP response schemas

**`search_products`**
```json
{
  "products": [
    {
      "id": "prod_1",
      "name": "Amul Fresh Cream",
      "category": "Dairy",
      "variants": [
        {
          "spinId": "spin_42",
          "name": "200ml",
          "price": 45.0,
          "mrp": 50.0,
          "inStock": true,
          "unit": "200ml"
        }
      ]
    }
  ],
  "nextOffset": 10
}
```
Key fields: `products[]`, each has `name`, `category`, `variants[]`
Per variant: `spinId` (CRITICAL: use for cart, not product id), `price`, `mrp`, `inStock`, `unit`

CortexKitchen mapping:
- take `products[0].variants[0]` as best match
- store `spinId` for later execution (ProcurementExecutor)
- `price` → live ingredient cost
- `inStock` → availability flag

---

**`your_go_to_items`**
```json
{
  "items": [
    {
      "productId": "prod_1",
      "name": "Amul Butter",
      "variants": [
        {
          "spinId": "spin_99",
          "price": 55.0,
          "unit": "100g",
          "inStock": true
        }
      ],
      "lastOrderedAt": "2026-06-20T10:00:00Z"
    }
  ]
}
```
Key fields: `data.items[]`, same variant structure as search_products. `lastOrderedAt` for recency signal.

---

**`get_cart`**
```json
{
  "items": [
    {
      "spinId": "spin_42",
      "name": "Amul Fresh Cream 200ml",
      "quantity": 3,
      "price": 45.0
    }
  ],
  "bill": {
    "itemTotal": 135.0,
    "deliveryFee": 25.0,
    "total": 160.0
  },
  "availablePaymentMethods": ["COD"]
}
```
Key fields: `items[]`, `bill.total`, `availablePaymentMethods[]`
Always check `availablePaymentMethods` before checkout: COD only in Builders Club v1.

---

**`checkout`**
```json
{
  "orderId": "IM-001",
  "status": "placed",
  "estimatedDelivery": "2026-06-29T20:45:00+05:30",
  "total": 160.0
}
```
Key fields: `orderId`, to be recorded against the corresponding `action_queue` row once checkout execution is unblocked
CRITICAL: NOT idempotent. On 5xx, call `get_orders` before retrying.

---

**`get_orders` (Instamart)**
```json
{
  "orders": [
    {
      "orderId": "IM-001",
      "status": "delivered",
      "total": 160.0,
      "items": [{"name": "Amul Fresh Cream", "quantity": 3}],
      "placedAt": "2026-06-29T20:30:00+05:30",
      "deliveryAddress": {
        "lat": 19.076,
        "lng": 72.877
      }
    }
  ]
}
```
Key fields: `orders[]`, each has `orderId`, `status`, `total`, `items[]`, `deliveryAddress.lat`, `deliveryAddress.lng`
Use `deliveryAddress.lat/lng` for `track_order` call.

---

**`track_order` (Instamart)**
```json
{
  "orderId": "IM-001",
  "status": "out_for_delivery",
  "eta": "2026-06-29T20:50:00+05:30",
  "deliveryPartnerName": "Suresh",
  "storeInfo": {"name": "Instamart Store: Andheri"}
}
```
Key fields: `data.status`, `data.eta`

---

### Dineout MCP response schemas

**`get_saved_locations`**
```json
{
  "locations": [
    {
      "id": "loc_01",
      "addressLine": "123 MG Road, Bengaluru",
      "lat": 12.9716,
      "lng": 77.5946
    }
  ]
}
```
Key fields: `locations[]`, each has `id` (use as addressId for Dineout), `lat`, `lng`
IMPORTANT: store `lat` and `lng`: needed for `get_available_slots` and `book_table`

---

**`search_restaurants_dineout`**
```json
{
  "restaurants": [
    {
      "id": "drest_42",
      "name": "The Fatty Bao",
      "cuisines": ["Asian", "Japanese"],
      "avgRating": 4.5,
      "costForTwo": 1200,
      "distanceKm": 1.8,
      "availability": "AVAILABLE",
      "highlights": ["Valet Parking", "Live Music"],
      "offers": ["20% off on pre-booking"]
    }
  ]
}
```
Key fields: `restaurants[]`, each has `id`, `name`, `avgRating`, `costForTwo`, `availability` (filter to "AVAILABLE"), `highlights`, `offers`

---

**`get_restaurant_details`** (Dineout)
```json
{
  "id": "drest_42",
  "name": "The Fatty Bao",
  "avgRating": 4.5,
  "timings": "12:00 PM - 11:00 PM",
  "address": "123 MG Road, Bengaluru",
  "deals": [
    {
      "title": "20% off on food bill",
      "isFree": true,
      "bookingPrice": 0
    }
  ],
  "amenities": ["WiFi", "Valet", "Live Music"]
}
```
Key fields: `deals[]`: each has `isFree` (only use isFree=true in Builders Club v1), `bookingPrice`

---

**`get_available_slots`**
```json
{
  "slots": [
    {
      "dateStr": "2026-06-30",
      "displayTime": "7:00 PM",
      "reservationTime": 1751289600,
      "slotGroupName": "Dinner",
      "availabilityCount": 4,
      "deals": [
        {
          "slotId": 4242,
          "itemId": "drest_42-ticket_7",
          "isFree": true,
          "bookingPrice": 0,
          "title": "Free Table Booking",
          "discountPercentage": 0
        }
      ]
    }
  ]
}
```
Key fields per slot:
- `dateStr` → date string YYYY-MM-DD
- `displayTime` → human-readable time
- `reservationTime` → epoch timestamp (pass to book_table)
- `availabilityCount` → seats remaining (low = high occupancy signal)
- `deals[].slotId` → pass to book_table as slotId
- `deals[].itemId` → pass to book_table as itemId (format: "restaurantId-ticketId")
- `deals[].isFree` → ONLY use isFree=true deals in Builders Club v1

CortexKitchen occupancy signal:
- high occupancy = availabilityCount < 2 across most slots
- area_occupancy_signal = HIGH if >50% of competitor slots have availabilityCount < 2

---

**`book_table`**
```json
{
  "orderId": "DO-001",
  "bookingId": "BK-001",
  "status": "confirmed",
  "restaurantName": "The Fatty Bao",
  "reservationTime": 1751289600,
  "guestCount": 4,
  "confirmationCode": "CK4242"
}
```
Key fields: `orderId` (use for get_booking_status), `bookingId`, `status`, `confirmationCode`
CRITICAL: NOT idempotent. On 5xx → call `get_booking_status` with orderId before retrying.

---

**`get_booking_status`**
```json
{
  "orderId": "DO-001",
  "restaurantName": "The Fatty Bao",
  "date": "2026-06-30",
  "time": "7:00 PM",
  "guestCount": 4,
  "dealTitle": "Free Table Booking",
  "status": "confirmed"
}
```
Key fields: `orderId`, `status`, `date`, `time`, `guestCount`

CortexKitchen mapping:
- `orderId` → `external_booking_id` in reservations table
- `status` → map to `ReservationStatus` enum (confirmed/cancelled)
- `date` + `time` → parse to `reserved_at` datetime

---

## 18. What each tool maps to in CortexKitchen

| Swiggy tool | Server | Maps to | DB table / State field |
|-------------|--------|---------|----------------------|
| `get_food_orders` | Food | order sync | `orders` (source=swiggy) |
| `track_food_order` | Food | feedback sync | `feedback` (source=swiggy_delivery) |
| `get_booking_status` | Dineout | reservation sync | `reservations` (source=dineout) |
| `search_restaurants` | Food | CompetitorEnricher | `swiggy_competitor_context` state (area aggregates only, no named restaurants) |
| `search_menu` | Food | not used | confirmed zero results in this sandbox for every query tested; removed from CompetitorEnricher |
| `fetch_food_coupons` | Food | CompetitorEnricher | `swiggy_competitor_context.deals_active_count`/`.deals_summary` |
| `get_restaurant_menu` | Food | CompetitorEnricher | `swiggy_competitor_context` state |
| `search_products` | Instamart | ProcurementEnricher | `swiggy_procurement_options` state |
| `your_go_to_items` | Instamart | not used | removed: returns the developer's personal grocery habits, was leaking into the planning pipeline's inventory prompt |
| `get_saved_locations` | Dineout | OccupancyEnricher | `swiggy_occupancy_context` state |
| `search_restaurants_dineout` | Dineout | OccupancyEnricher | `swiggy_occupancy_context` state |
| `get_restaurant_details` | Dineout | OccupancyEnricher | `swiggy_occupancy_context.dineout_deals_count`/`.dineout_deals_summary` |
| `get_available_slots` | Dineout | OccupancyEnricher | `swiggy_occupancy_context` state + `.slot_deals_found` parsed from `deals[]` |
| `update_cart` | Instamart | ProcurementExecutor (`executor/`, blocked on staging credentials) | would write to `action_queue` on execution |
| `get_cart` | Instamart | ProcurementExecutor | verify before checkout |
| `clear_cart` | Instamart | ProcurementExecutor | before building new cart |
| `checkout` | Instamart | ProcurementExecutor | would update the corresponding `action_queue` row's `status`/`executed_at` |
| `get_orders` | Instamart | not used in the planning pipeline | returns the developer's personal procurement history |
| `book_table` | Dineout | DineoutExecutor (`executor/`, blocked on staging credentials) | `reservations` table |
| `create_cart` | Dineout | DineoutExecutor | internal to `book_table` |
| `get_addresses` | Food/IM | all Food+IM calls | resolve addressId once per session |

