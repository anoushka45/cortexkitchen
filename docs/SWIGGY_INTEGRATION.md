# CortexKitchen x Swiggy Builders Club — Complete Integration Reference

> **Status:** Active development — Phase 6  
> **Access:** Swiggy Builders Club approved (builders@swiggy.in)  
> **Staging creds:** Pending (form submitted)  
> **Docs:** https://mcp.swiggy.com/builders/docs/  
> **Discord:** https://discord.gg/HrmGg3aG9g  
> **Swiggy full docs index:** https://mcp.swiggy.com/builders/llms.txt  

---

## 1. What CortexKitchen is becoming

CortexKitchen started as a planning tool — trigger a scenario, 9 agents analyze internal data, critic scores it, owner gets a plan.

With Swiggy MCP it becomes a **Swiggy-native restaurant operating system**: Swiggy is the primary data source for orders, reservations, complaints, and market intelligence. The system plans intelligently with real market context and executes actions autonomously on the owner's behalf.

**The one-liner:** "The operating brain for a Swiggy-native restaurant — knows your business, knows your market, acts on your behalf."

---

## 2. The three Swiggy MCP servers

| Server | Endpoint | Tools | What it gives us |
|--------|----------|-------|------------------|
| Food | `POST mcp.swiggy.com/food` | 14 | Delivery orders, competitor menus, restaurant discovery |
| Instamart | `POST mcp.swiggy.com/im` | 13 | Ingredient procurement, stock availability, live pricing |
| Dineout | `POST mcp.swiggy.com/dineout` | 8 | Table reservations, competitor occupancy, slot management |

All three share one OAuth token per user session (5-day TTL). One authentication, all 35 tools.

---

## 3. Authentication — OAuth 2.1 with PKCE

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

{
  "jsonrpc": "2.0",
  "method": "tools/call",
  "params": { "name": "search_restaurants", "arguments": { ... } },
  "id": 1
}
```

### Response envelope (all tools)
```json
{ "success": true, "data": { ... }, "message": "optional" }
{ "success": false, "error": { "message": "description" } }
```

### Multi-tenant architecture (CortexKitchen)
Each restaurant owner authenticates their own Swiggy account. Token stored encrypted per `org_id` in the `connectors` table. Re-auth on 401. 5-day TTL — no refresh tokens in v1.

### Error handling
| HTTP | Meaning | Action |
|------|---------|--------|
| 401 | Token expired / invalid | Re-run OAuth flow |
| 419 | Session revoked | Full re-auth (phone + OTP) |
| 403 | Scope missing | Re-auth with broader scope |
| 400 | Bad input | Fix arguments, do not retry |
| 5xx | Upstream error | Exponential backoff, max 5 retries |

---

## 4. The 22 tools we use (out of 35)

### Why 22 not 35
The other 13 are consumer commerce tools — `flush_food_cart`, `apply_food_coupon`, `create_address`, `delete_address`, `get_food_order_details` etc. These serve end-users placing orders, not restaurant operators planning their business. We don't use them.

---

### 4.1 Food MCP — 6 tools

**`get_addresses`**
```
Parameters: none
Returns: saved addresses with addressId, label, display text (NO coordinates — privacy)
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
CortexKitchen use: CompetitorEnricher — find competitor restaurants by cuisine near our address
```

**`get_restaurant_menu`**
```
Parameters:
  addressId     string  required  from get_addresses
  restaurantId  string  required  from search_restaurants
  page          number  optional  default 1
  pageSize      number  optional  default 5, max 8

Returns: paginated categories with items, prices, hasVariants, hasAddons
CortexKitchen use: CompetitorEnricher — pull competitor menu pricing by category
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
CortexKitchen use: CompetitorEnricher — dish-level competitive pricing ("butter chicken near me")
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
CortexKitchen use: sync → feedback table (source='swiggy_delivery')
                   delivery latency patterns feed complaint_intelligence node
                   LiveMonitorService polls during service hours
```

---

### 4.2 Instamart MCP — 9 tools

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
CortexKitchen use: ProcurementEnricher — search for shortage ingredients, get live price + spinId
```

**`your_go_to_items`**
```
Parameters:
  addressId  string  required
  offset     number  optional

Returns: frequently/recently ordered items with variants and spinIds
CortexKitchen use: ProcurementEnricher — quick reorder suggestions for frequent ingredients
                   one-tap reorder instead of searching from scratch
```

**`update_cart`**
```
Parameters:
  selectedAddressId  string    required
  items              object[]  required  [{spinId, quantity}]

NOTE: REPLACES entire cart, does not append
CortexKitchen use: ProcurementExecutor — add shortage ingredients after owner approval
                   always call get_cart before to verify current state
```

**`get_cart`**
```
Parameters: none
Returns: cart items, bill breakdown, availablePaymentMethods
CortexKitchen use: ProcurementExecutor — read before every mutate, verify before checkout
                   NEVER trust cached cart state — always re-fetch
```

**`clear_cart`**
```
Parameters: none
CortexKitchen use: ProcurementExecutor — clear before building new procurement cart
                   also needed when switching delivery address mid-flow
```

**`checkout`**
```
Parameters:
  addressId      string  required
  paymentMethod  string  optional  from get_cart availablePaymentMethods

CRITICAL: NOT idempotent. On 5xx → call get_orders to check if order placed BEFORE retrying.
COD only in Builders Club v1.
CortexKitchen use: ProcurementExecutor — place Instamart order after LangGraph interrupt() approval
```

**`get_orders`**
```
Parameters:
  count      number   optional  default 10, max 20
  orderType  string   optional  default "DASH"
  activeOnly boolean  optional

CortexKitchen use: check-then-retry pattern after checkout 5xx
                   also procurement history analysis
```

**`track_order`**
```
Parameters:
  orderId  string  required  from get_orders
  lat      number  required  delivery address latitude
  lng      number  required  delivery address longitude

CortexKitchen use: LiveMonitorService — track Instamart procurement delivery during service hours
```

---

### 4.3 Dineout MCP — 7 tools

**`get_saved_locations`**
```
Parameters: none
Returns: saved addresses with id and addressLine (for Dineout — NOT same as Food/Instamart addressId)
IMPORTANT: Dineout uses lat/lng for searches, not addressId like Food/Instamart
           get_saved_locations returns addressId you can pass to search_restaurants_dineout
           which resolves coordinates server-side
CortexKitchen use: OccupancyEnricher — resolve location for Dineout searches
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
CortexKitchen use: OccupancyEnricher — find competitor restaurants by cuisine near us
```

**`get_restaurant_details`**
```
Parameters:
  restaurantId  string  required  from search_restaurants_dineout
  latitude      number  required  same as search
  longitude     number  required  same as search

Returns: ratings, deals, timings, address, amenities, exclusive Dineout offers
CortexKitchen use: OccupancyEnricher — richer competitor context (deals, amenities)
                   dineout_manager_node — our own restaurant details
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
         deals have isFree boolean — only FREE reservations work in Builders Club v1
CortexKitchen use: OccupancyEnricher — competitor slot availability = occupancy signal
                   dineout_manager_node — our own slot availability tonight
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

CRITICAL: NOT idempotent. On 5xx → call get_booking_status BEFORE retrying.
Only FREE reservations (isFree=true, bookingPrice=0) in Builders Club v1.
CortexKitchen use: dineout_manager_node — open more slots for our restaurant when walk-in surge expected
                   executes after LangGraph interrupt() owner approval
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
                   dineout_manager_node — our booking density tonight
```

---

## 5. Architecture — how it all fits together

### Three data layers

```
LAYER 0 — Unified data layer (PostgreSQL) — always present, always authoritative
  orders         source='swiggy'|'pos'|'walk_in'  channel='delivery'|'dine_in'
  reservations   source='dineout'|'eazydiner'|'phone'
  feedback       source='swiggy_delivery'|'google'|'internal'
  inventory      stock levels + procurement history
  action_queue   pending actions awaiting approval
  procurement_orders  Instamart orders placed

LAYER 1 — Live market intelligence (Redis, 30min TTL, NOT persisted)
  competitor_pricing     Food MCP: search_restaurants + search_menu + get_restaurant_menu
  area_occupancy         Dineout MCP: search_restaurants_dineout + get_available_slots
  ingredient_market      Instamart MCP: search_products + your_go_to_items
  delivery_signal        Food MCP: get_food_orders + track_food_order (real-time)

LAYER 2 — Action surface (with approval gates)
  Instamart procurement  update_cart → get_cart → LangGraph interrupt() → checkout
  Dineout management     create_cart → book_table (after approval)
```

### Connector pattern

Every external platform implements `BaseConnector` with two modes:

```python
class BaseConnector(ABC):
    async def sync(self, org_id: int) -> SyncResult:
        """Nightly job. Pulls historical data. Writes to layer 0."""
        ...

    async def enrich(self, context: dict) -> EnrichmentResult:
        """At planning time. Live signals. NOT written to DB."""
        ...
```

`SwiggyConnector` is the reference implementation. Future connectors (Zomato, Google Reviews, Square POS, EazyDiner) follow the same pattern.

### LangGraph pipeline — 11 nodes

```
ops_manager
    │
demand_forecast              ← get_food_orders feeds Prophet (real delivery demand)
    │
    ├── reservation           ← OccupancyEnricher: Dineout competitor slots
    ├── complaint_intel       ← track_food_order: real delivery complaints
    ├── menu_intel            ← CompetitorEnricher: competitor prices via Food MCP
    ├── inventory             ← ProcurementEnricher: Instamart prices + availability
    ├── market_intel_node     ← NEW (10th): CompetitorEnricher + OccupancyEnricher
    └── dineout_manager_node  ← NEW (11th): our own Dineout slot management
            │
aggregator (internal + market context)
            │
EvaluationSanityChecker (5 cross-diffs including 2 new market diffs)
            │
critic (market-aware)
            │
        ┌───┴─────────────┐
action_queue              final_assembler → plan
(approve/execute)
```

### Three product modes

| Mode | Trigger | What runs | Output |
|------|---------|-----------|--------|
| Ops | Owner triggers scenario | Full 11-node pipeline | Operational plan + action queue |
| Brief | APScheduler 7am IST | demand_forecast + market_intel only | Daily morning brief email |
| Live | During service hours (12-14, 19-22 IST) | SSE poll every 30s | Real-time alerts feed |

---

## 6. Non-idempotent tools — critical patterns

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

### `place_food_order` (Food) — NOT used by CortexKitchen (consumer tool)
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

Rate limiting NOT enforced in v1.0 — upstream shedding handles abuse. Wire 429 handler anyway for v1.1 readiness. Honor `Retry-After` header when it arrives.

**CortexKitchen limits per planning run:**
- Max 3 `get_restaurant_menu` calls (CompetitorEnricher)
- Max 3 `get_available_slots` calls (OccupancyEnricher)
- Max 5 `search_products` calls (ProcurementEnricher)

---

## 8. Build plan — task IDs and branches

### Phase S — foundation and sync (Weeks 1-2)

| Task | Branch | What |
|------|--------|------|
| P6-S01 | `feature/swiggy-base-connector` | BaseConnector + SwiggyMCPClient |
| P6-S02 | `feature/swiggy-base-connector` | connectors table + async job queue |
| P6-S03 | `feature/swiggy-sync-orders` | get_food_orders → orders table |
| P6-S04 | `feature/swiggy-sync-reservations` | get_booking_status → reservations table |
| P6-S05 | `feature/swiggy-sync-feedback` | track_food_order → feedback table |

### Phase E — enrichers (Week 3)

| Task | Branch | What |
|------|--------|------|
| P6-S06 | `feature/swiggy-market-intel-enrichers` | CompetitorEnricher (Food MCP) |
| P6-S07 | `feature/swiggy-market-intel-enrichers` | OccupancyEnricher (Dineout MCP) |
| P6-S08 | `feature/swiggy-procurement-l1` | ProcurementEnricher (Instamart read-only) |
| P6-S09 | `feature/swiggy-market-intel-enrichers` | MarketIntelService + 6 state fields |

### Phase N — new nodes (Week 4)

| Task | Branch | What |
|------|--------|------|
| P6-S10 | `feature/swiggy-market-intel-node` | market_intel_node (10th) |
| P6-S11 | `feature/swiggy-dineout-manager-node` | dineout_manager_node (11th) |
| P6-S12 | `feature/swiggy-market-intel-node` | assumption diffs 5 + 6 |

### Phase A — action layer (Week 5)

| Task | Branch | What |
|------|--------|------|
| P6-S13 | `feature/swiggy-action-queue` | ActionQueueService + table |
| P6-S14 | `feature/swiggy-procurement-l2` | ProcurementExecutor + Instamart checkout |
| P6-S15 | `feature/swiggy-action-queue` | Dineout book_table execution |

### Phase M — product modes (Week 6)

| Task | Branch | What |
|------|--------|------|
| P6-S16 | `feature/swiggy-brief-mode` | BriefingService (7am daily) |
| P6-S17 | `feature/swiggy-live-mode` | LiveMonitorService (SSE during service) |
| P6-S18 | `feature/swiggy-mcp-tools` | 3 new MCP server tools |

### Phase R — original P6 tasks (Week 6-7)

| Task | Branch | What |
|------|--------|------|
| P6-R01 | `feature/swiggy-pos-connector` | POSConnector (Square/Toast CSV) |
| P6-R02 | `feature/swiggy-voice-interface` | Voice interface (Whisper) |

### Phase F — frontend (Week 7)

| Task | Branch | What |
|------|--------|------|
| P6-F01 | `feature/swiggy-frontend-market` | Market intel panel on planning results |
| P6-F02 | `feature/swiggy-frontend-actions` | Action queue UI + procurement tracker |
| P6-F03 | `feature/swiggy-frontend-brief` | /brief page |
| P6-F04 | `feature/swiggy-frontend-connectors` | /connectors page |
| P6-F05 | `feature/swiggy-frontend-live` | /live page |
| P6-F06 | `feature/swiggy-frontend-market` | Dashboard enhancements |

### Phase D — docs + merge (Week 8)

| Task | Branch | What |
|------|--------|------|
| P6-D01 | `feature/swiggy-docs` | 5 new doc files |
| P6-D02 | `feature/swiggy-docs` | 8 existing docs updated |
| P6-D03 | `dev -> main` | Phase 6 milestone merge |

---

## 9. New DB tables

```sql
-- connector registry per org
connectors (id, org_id, connector_type, access_token_encrypted,
            token_expires_at, last_sync_at, sync_status, error_count)

-- raw platform data before normalization
platform_orders (id, org_id, external_order_id, source, raw_payload, synced_at)

-- action queue from planning runs
action_queue (id, org_id, action_type, payload, status,
              created_at, approved_by, executed_at, error)
-- action_type: AUTO_EXECUTE | APPROVE_REQUIRED | RECOMMENDATION
-- status: PENDING | APPROVED | EXECUTED | REJECTED | EXPIRED

-- Instamart procurement orders placed
procurement_orders (id, org_id, spin_id, product_name, quantity,
                    price, instamart_order_id, status, delivered_at)

-- periodic market snapshots for trend analysis
market_snapshots (id, org_id, snapshot_type, data, captured_at)

-- daily morning briefs
daily_briefs (id, org_id, brief_date, content, swiggy_signals, generated_at)
```

### Existing tables — columns added
```sql
-- orders: add source, channel columns
ALTER TABLE orders ADD COLUMN source VARCHAR(50) DEFAULT 'internal';
ALTER TABLE orders ADD COLUMN channel VARCHAR(50) DEFAULT 'dine_in';
ALTER TABLE orders ADD COLUMN external_order_id VARCHAR(200);

-- reservations: add source column
ALTER TABLE reservations ADD COLUMN source VARCHAR(50) DEFAULT 'internal';

-- feedback: source column already exists (FeedbackSource enum has swiggy)
```

---

## 10. New OrchestratorState fields

```python
# 6 new fields — all Annotated[Optional[Dict], keep_last]
swiggy_competitor_context: ...   # from CompetitorEnricher
swiggy_occupancy_context: ...    # from OccupancyEnricher
swiggy_procurement_options: ...  # from ProcurementEnricher (includes spinIds)
swiggy_delivery_signal: ...      # from track_food_order sync
market_intel_output: ...         # from market_intel_node
dineout_manager_output: ...      # from dineout_manager_node
```

---

## 11. New assumption diffs (extends P6-00b)

Current: 3 active diffs (Diff 1 dropped as false positive)

**Diff 5 — market vs menu pricing**
```
market_intel assumed_competitor_avg_price
  vs menu_intel items_assumed_available pricing
→ fires when your promoted items are priced significantly above area average
```

**Diff 6 — Dineout slots vs reservation occupancy**
```
dineout_manager assumed_dineout_slots_low
  vs reservation assumed_peak_occupancy_pct > 85
→ fires when high occupancy predicted but your Dineout table availability is also low
  (can't capture the walk-in overflow you expected)
```

---

## 12. New MCP server tools (CortexKitchen's own MCP server)

Adds to `mcp_server.py` alongside existing `run_planning_scenario` and `get_run_history`:

```python
get_market_brief      # calls MarketIntelService live, returns competitor snapshot
get_action_queue      # returns pending actions awaiting approval for org
approve_action        # owner approves action from Claude Desktop, triggers execution
```

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
- **Staging at** `mcp-staging.swiggy.com/{server}` — same shape as production, seeded data, no real orders.
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

## 15. For Claude Code — rules when working on Swiggy integration

```
You have access to Swiggy Builders Club docs. Before writing any Swiggy tool call,
parameter name, or error handling code, verify against:

- Index:     https://mcp.swiggy.com/builders/llms.txt
- Full text: https://mcp.swiggy.com/builders/llms-full.txt
- Per-page:  append .md to any https://mcp.swiggy.com/builders/docs/... URL

Rules:
1. Never invent tool names or parameters. If docs don't cover it, say so.
2. checkout and book_table are NOT idempotent. Always check-then-retry on 5xx.
3. Dineout uses lat/lng, Food/Instamart use addressId — do not mix them.
4. update_cart REPLACES the entire Instamart cart — not additive.
5. Swiggy enricher calls always return None on failure — never raise.
   Nodes must handle None gracefully and fall back to synthetic data.
6. spinId (not product id) is used for Instamart cart operations.
7. All Swiggy tokens stored per org_id in connectors table, never in env vars directly.
```
