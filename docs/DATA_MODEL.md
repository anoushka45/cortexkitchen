# CortexKitchen Data Model

Last updated: May 2026. Reflects the implemented schema as defined in `apps/api/app/infrastructure/db/models.py` and the current Alembic migrations.

---

## Overview

CortexKitchen uses three storage systems:

| Store | Role |
|-------|------|
| **PostgreSQL 16** | Structured operational data and persisted planning runs |
| **Qdrant** | Vector embeddings for complaint and SOP retrieval (RAG) |
| **Redis 7** | Available for caching; not yet used as primary state |

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
```

---

### `menu_items`

Stores the restaurant's menu catalog.

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

Stores guest booking records.

| Column | Type | Notes |
|--------|------|-------|
| `id` | Integer PK | Auto-increment |
| `guest_name` | String(100) | NOT NULL |
| `guest_count` | Integer | NOT NULL |
| `reserved_at` | DateTime | Booking slot — used by Reservation node for peak-load analysis |
| `status` | Enum(`ReservationStatus`) | Default `confirmed` |
| `table_number` | Integer | Nullable |
| `notes` | Text | Nullable |
| `created_at` | DateTime | UTC, set on insert |

---

### `orders`

Stores individual order records. The `ordered_at` timestamp is the primary signal for demand forecasting.

| Column | Type | Notes |
|--------|------|-------|
| `id` | Integer PK | Auto-increment |
| `menu_item_id` | Integer FK → `menu_items.id` | NOT NULL |
| `quantity` | Integer | NOT NULL |
| `total_price` | Float | NOT NULL |
| `ordered_at` | DateTime | Default UTC now — drives demand forecasting and Friday-spike detection |
| `is_delivery` | Boolean | Default `false` |

**Relationships:** `Order` belongs to `MenuItem`; one `Order` may have many `Feedback` records.

---

### `inventory`

Stores ingredient stock levels and alerts.

| Column | Type | Notes |
|--------|------|-------|
| `id` | Integer PK | Auto-increment |
| `ingredient_name` | String(100) | NOT NULL |
| `unit` | String(20) | e.g. `kg`, `litres`, `units` |
| `quantity_in_stock` | Float | NOT NULL |
| `reorder_threshold` | Float | Alert threshold — stock below this value triggers a shortage signal |
| `spoilage_risk` | Boolean | Default `false` |
| `updated_at` | DateTime | Auto-updated on write |

---

### `feedback`

Stores customer feedback and complaint text. Optionally linked to an order.

| Column | Type | Notes |
|--------|------|-------|
| `id` | Integer PK | Auto-increment |
| `order_id` | Integer FK → `orders.id` | Nullable — feedback may not be tied to a specific order |
| `raw_text` | Text | NOT NULL — the complaint or review text |
| `sentiment` | Enum(`SentimentType`) | Nullable |
| `source` | Enum(`FeedbackSource`) | Default `in_person` |
| `created_at` | DateTime | UTC, set on insert |

**Relationships:** `Feedback` optionally belongs to `Order`.

---

### `decision_logs`

Stores per-agent decision records for traceability. Each row captures what one agent reasoned, retrieved, and recommended.

| Column | Type | Notes |
|--------|------|-------|
| `id` | Integer PK | Auto-increment |
| `agent` | String(50) | Which node produced this record |
| `input_summary` | Text | Nullable — summary of inputs the agent received |
| `retrieved_context` | Text | Nullable — RAG context used |
| `reasoning_summary` | Text | Nullable — LLM reasoning summary |
| `action_recommended` | Text | NOT NULL — the recommendation produced |
| `critic_verdict` | Enum(`CriticVerdict`) | Nullable |
| `critic_score` | Float | Nullable — 0.0 to 1.0 |
| `critic_notes` | Text | Nullable |
| `metadata_` | JSONB | Nullable — flexible extra data (stored as `metadata` in DB) |
| `created_at` | DateTime | UTC, set on insert |

---

### `planning_runs`

Stores the full output of each planning execution. This is the primary audit table and backs the `/runs` API surface.

| Column | Type | Notes |
|--------|------|-------|
| `id` | Integer PK | Auto-increment |
| `scenario` | String(80) | NOT NULL — scenario id, e.g. `friday_rush` |
| `target_date` | String(20) | Nullable — ISO date the plan targeted |
| `status` | String(40) | NOT NULL — `ready`, `needs_review`, or `blocked` |
| `critic_verdict` | String(40) | Nullable — `approved`, `rejected`, or `revision` |
| `critic_score` | Float | Nullable — 0.0 to 1.0 |
| `decision_log_id` | Integer | Nullable — link to `decision_logs` |
| `final_response` | JSONB | NOT NULL — full planning response payload |
| `recommendations` | JSONB | Nullable — per-agent recommendation blocks |
| `rag_context` | JSONB | Nullable — complaint and SOP context used |
| `critic` | JSONB | Nullable — full critic output block |
| `metadata_` | JSONB | Nullable — stored as `metadata` in DB |
| `generated_at` | DateTime | UTC, set on insert |
| `created_at` | DateTime | UTC, set on insert |

---

## Entity Relationships

```
MenuItem ──< Order >──< Feedback
                           │
                           └── (optional FK to order)

Reservation   (standalone — no FK to other operational tables)
Inventory     (standalone — per-ingredient stock record)
DecisionLog   (standalone — per-agent trace)
PlanningRun   (standalone — full orchestration output, optionally links to DecisionLog)
```

---

## Qdrant Collections

### `complaints_memory`

Stores embedded complaint and review text for RAG retrieval.

**Payload fields per point:**
- `text` — the raw complaint or review
- `complaint_type` — e.g. `slow_service`, `cold_food`, `wrong_order`
- `sentiment` — `positive`, `neutral`, or `negative`
- `source` — platform of origin
- `date` — when the complaint was recorded
- `tags` — list of operational tags

**Used by:** Complaint Intelligence node to retrieve historically similar operational problems before generating recommendations.

---

### `sop_memory`

Stores embedded standard operating procedures and operational guidance.

**Payload fields per point:**
- `text` — the SOP or guideline content
- `category` — operational area, e.g. `kitchen`, `service`, `inventory`
- `title` — short descriptive title
- `applicable_area` — where this SOP applies
- `tags` — list of tags for filtering

**Used by:** Complaint Intelligence node to pair complaint patterns with relevant SOPs as evidence-backed action guidance.

---

## Redis

Redis is present in the local stack and available for use. It is not currently used as primary state by any service. It is reserved for future caching of forecast results and async job coordination.

Connection default: `redis://localhost:6379/0`.

---

## Seed Data

Demo data is populated by two scripts in `scripts/`:

- `seed_demo_data.py` — generates 90+ days of simulated orders, reservations, feedback, inventory, and menu items into PostgreSQL
- `seed_qdrant_memory.py` — embeds and loads complaint patterns and SOPs into Qdrant

These scripts must be run after running `alembic upgrade head`. See the root README for the full setup sequence.
