# CortexKitchen Data Model

Last updated: June 2026. Reflects the implemented schema in `apps/api/app/infrastructure/db/models.py` and current Alembic migrations. Phase 5 complete.

---

## Overview

CortexKitchen uses three storage systems:

| Store | Role |
|-------|------|
| **PostgreSQL 16** | All structured operational data, auth, planning runs, settings |
| **Qdrant** | Vector embeddings for complaint and SOP retrieval (RAG), org-scoped payload filters |
| **Redis 7** | Plan cache — 1hr TTL by `(org_id, scenario, target_date)` |

---

## PostgreSQL Schema

### Enumerations

```python
class ReservationStatus(str, Enum):
    confirmed = "confirmed"
    cancelled = "cancelled"
    waitlist  = "waitlist"
    completed = "completed"

class SentimentType(str, Enum):
    positive = "positive"
    neutral  = "neutral"
    negative = "negative"

class FeedbackSource(str, Enum):
    google    = "google"
    in_person = "in_person"
    zomato    = "zomato"
    swiggy    = "swiggy"

class CriticVerdict(str, Enum):
    approved = "approved"
    rejected = "rejected"
    revision = "revision"

class UserRole(str, Enum):
    owner  = "owner"
    member = "member"
```

---

### `organizations`

One row per restaurant workspace. All planning runs, settings, and profiles are scoped to an org.

| Column | Type | Notes |
|--------|------|-------|
| `id` | Integer PK | Auto-increment |
| `name` | String(100) | NOT NULL — display name |
| `slug` | String(100) | NOT NULL, unique — URL-safe identifier |
| `settings` | JSONB | Nullable — workspace config (capacity, timezone, peak hours, thresholds) |
| `created_at` | DateTime | UTC, set on insert |

**Default settings stored in JSONB:**
```json
{
  "capacity": 70,
  "timezone": "Asia/Kolkata",
  "cuisine_type": "pizza",
  "peak_hours": "18:00-22:00",
  "critic_threshold": 0.7,
  "low_stock_threshold_pct": 20.0,
  "overstock_threshold_pct": 150.0
}
```

**Relationships:** one org has many `UserOrganization`, `PlanningRun`, `RestaurantProfile`.

---

### `users`

One row per registered user.

| Column | Type | Notes |
|--------|------|-------|
| `id` | Integer PK | Auto-increment |
| `email` | String(255) | NOT NULL, unique |
| `hashed_password` | String(255) | NOT NULL — bcrypt hash |
| `full_name` | String(100) | Nullable — display name |
| `is_active` | Boolean | Default `true` |
| `created_at` | DateTime | UTC, set on insert |

**Relationships:** one user has many `UserOrganization` (a user can belong to multiple orgs, though the current registration flow creates one).

---

### `user_organizations`

Join table linking users to orgs with a role. Unique constraint on `(user_id, org_id)`.

| Column | Type | Notes |
|--------|------|-------|
| `id` | Integer PK | Auto-increment |
| `user_id` | Integer FK → `users.id` | NOT NULL |
| `org_id` | Integer FK → `organizations.id` | NOT NULL |
| `role` | Enum(`UserRole`) | Default `member` — `owner` or `member` |
| `created_at` | DateTime | UTC, set on insert |

Registration creates a user + org + `user_organizations` row (role = `owner`) in one step.

---

### `restaurant_profiles`

Named restaurant profiles owned by an org. Overrides org-level capacity and peak hours for a specific planning run.

| Column | Type | Notes |
|--------|------|-------|
| `id` | Integer PK | Auto-increment |
| `org_id` | Integer FK → `organizations.id` | NOT NULL |
| `name` | String(100) | NOT NULL — e.g. `Casa Mia Rooftop` |
| `cuisine` | String(100) | Default `pizza` |
| `capacity` | Integer | Default `70` — seat count override |
| `peak_hours` | String(50) | Default `18:00-22:00` |
| `timezone` | String(50) | Default `Asia/Kolkata` |
| `created_at` | DateTime | UTC, set on insert |
| `updated_at` | DateTime | Auto-updated on write |

**Relationships:** belongs to `Organization`.

---

### `menu_items`

The restaurant's menu catalog.

| Column | Type | Notes |
|--------|------|-------|
| `id` | Integer PK | Auto-increment |
| `name` | String(100) | NOT NULL |
| `category` | String(50) | e.g. `pizza`, `beverage`, `dessert` |
| `price` | Float | NOT NULL |
| `is_available` | Boolean | Default `true` |
| `created_at` | DateTime | UTC, set on insert |

**Relationships:** one `MenuItem` has many `Order` records.

---

### `reservations`

Guest booking records.

| Column | Type | Notes |
|--------|------|-------|
| `id` | Integer PK | Auto-increment |
| `guest_name` | String(100) | NOT NULL |
| `guest_count` | Integer | NOT NULL |
| `reserved_at` | DateTime | NOT NULL — booking slot; used by Reservation node for peak-load analysis |
| `status` | Enum(`ReservationStatus`) | Default `confirmed` |
| `table_number` | Integer | Nullable |
| `notes` | Text | Nullable |
| `created_at` | DateTime | UTC, set on insert |

---

### `orders`

Individual order records. `ordered_at` is the primary signal for demand forecasting.

| Column | Type | Notes |
|--------|------|-------|
| `id` | Integer PK | Auto-increment |
| `menu_item_id` | Integer FK → `menu_items.id` | NOT NULL |
| `quantity` | Integer | NOT NULL |
| `total_price` | Float | NOT NULL |
| `ordered_at` | DateTime | Default UTC now — drives Prophet time-series forecasting |
| `is_delivery` | Boolean | Default `false` |

**Relationships:** belongs to `MenuItem`; one `Order` may have many `Feedback` records.

---

### `inventory`

Ingredient stock levels and shortage/overstock alerts.

| Column | Type | Notes |
|--------|------|-------|
| `id` | Integer PK | Auto-increment |
| `ingredient_name` | String(100) | NOT NULL |
| `unit` | String(20) | e.g. `kg`, `litres`, `units` |
| `quantity_in_stock` | Float | NOT NULL |
| `reorder_threshold` | Float | NOT NULL — shortage alert triggered when stock drops below this |
| `spoilage_risk` | Boolean | Default `false` |
| `updated_at` | DateTime | Auto-updated on write |

---

### `feedback`

Customer feedback and complaint text. Optionally linked to an order.

| Column | Type | Notes |
|--------|------|-------|
| `id` | Integer PK | Auto-increment |
| `order_id` | Integer FK → `orders.id` | Nullable |
| `raw_text` | Text | NOT NULL — complaint or review text |
| `sentiment` | Enum(`SentimentType`) | Nullable |
| `source` | Enum(`FeedbackSource`) | Default `in_person` |
| `created_at` | DateTime | UTC, set on insert |

**Relationships:** optionally belongs to `Order`. Also used by the RAG chatbot — queried directly from Postgres by `ChatService`.

---

### `decision_logs`

Per-agent decision records for traceability.

| Column | Type | Notes |
|--------|------|-------|
| `id` | Integer PK | Auto-increment |
| `agent` | String(50) | NOT NULL — which node produced this |
| `input_summary` | Text | Nullable |
| `retrieved_context` | Text | Nullable — RAG context used |
| `reasoning_summary` | Text | Nullable |
| `action_recommended` | Text | NOT NULL |
| `critic_verdict` | Enum(`CriticVerdict`) | Nullable |
| `critic_score` | Float | Nullable — 0.0 to 1.0 |
| `critic_notes` | Text | Nullable |
| `metadata_` | JSONB | Nullable — stored as `metadata` in DB |
| `created_at` | DateTime | UTC, set on insert |

---

### `planning_runs`

Full output of each planning execution. Primary audit table; backs the `/runs` API.

| Column | Type | Notes |
|--------|------|-------|
| `id` | Integer PK | Auto-increment |
| `org_id` | Integer FK → `organizations.id` | Nullable — tenant scoping (Phase 5) |
| `scenario` | String(80) | NOT NULL — e.g. `friday_rush` |
| `target_date` | String(20) | Nullable — ISO date |
| `status` | String(40) | NOT NULL — `ready`, `needs_review`, or `blocked` |
| `critic_verdict` | String(40) | Nullable — `approved`, `revision`, or `rejected` |
| `critic_score` | Float | Nullable — 0.0 to 1.0 |
| `decision_log_id` | Integer | Nullable — link to `decision_logs` |
| `final_response` | JSONB | NOT NULL — full planning response payload |
| `recommendations` | JSONB | Nullable — per-agent blocks |
| `rag_context` | JSONB | Nullable — complaint and SOP context |
| `critic` | JSONB | Nullable — full critic output block |
| `metadata_` | JSONB | Nullable — stored as `metadata` in DB; includes `llm_usage`, `node_traces`, `cache_hit` |
| `generated_at` | DateTime | UTC, set on insert |
| `created_at` | DateTime | UTC, set on insert |

**Relationships:** belongs to `Organization`. All run queries filter by `org_id` for tenant isolation.

---

## Entity Relationships

```
Organization ──< UserOrganization >── User
Organization ──< RestaurantProfile
Organization ──< PlanningRun

MenuItem ──< Order >──< Feedback

Reservation   (standalone — no FK to other operational tables)
Inventory     (standalone — per-ingredient stock record)
DecisionLog   (standalone — optionally linked from PlanningRun)
```

---

## Qdrant Collections

### `complaints_memory`

Stores embedded complaint and review text for RAG retrieval. Org-scoped via `org_id` payload filter.

**Payload fields per point:**

| Field | Description |
|-------|-------------|
| `text` | Raw complaint or review text |
| `org_id` | Tenant isolation — all retrieval calls filter by this |
| `complaint_type` | e.g. `slow_service`, `cold_food`, `wrong_order` |
| `sentiment` | `positive`, `neutral`, or `negative` |
| `source` | Platform of origin |
| `date` | When the complaint was recorded |
| `tags` | List of operational tags |

**Used by:** Complaint Intelligence node (planning pipeline) and ChatService (RAG chatbot).

---

### `sop_memory`

Stores embedded standard operating procedures and operational guidance.

**Payload fields per point:**

| Field | Description |
|-------|-------------|
| `text` | SOP or guideline content |
| `org_id` | Tenant isolation |
| `category` | Operational area — e.g. `kitchen`, `service`, `inventory` |
| `title` | Short descriptive title |
| `applicable_area` | Where this SOP applies |
| `tags` | List of tags for filtering |

**Used by:** Complaint Intelligence node to pair complaint patterns with relevant SOPs as evidence-backed action guidance.

---

## Redis

Redis 7 is used for plan caching.

**Cache key:** `plan:{org_id}:{scenario}:{target_date}`  
**TTL:** 1 hour  
**On hit:** full planning response returned immediately; `cache_hit: true` in response  
**On miss:** pipeline executes; result stored in Redis after completion  
**Invalidation:** automatic TTL expiry only

Connection default: `redis://localhost:6379/0`

---

## Seed Data

Demo data is populated by scripts in `scripts/`:

- `seed_demo_data.py` — generates ~6500 orders, ~1200 reservations, ~160 feedback records, 18 inventory items, and 27 menu items into PostgreSQL
- `seed_qdrant_memory.py` — embeds and loads complaint patterns and SOPs into Qdrant

Run after `alembic upgrade head`. See the root README for the full setup sequence.
