# CortexKitchen API Reference

Last updated: June 2026. Reflects Phase 5 complete.

Base URL: `http://localhost:8000`  
Base prefix: `/api/v1`  
Interactive docs: `http://localhost:8000/docs` (Swagger UI)

All request and response bodies use `application/json` unless noted. Streaming endpoints use `text/event-stream`.

---

## Authentication

### `POST /api/v1/auth/register`

Register a new user and organisation in one step.

**Request body**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `email` | string | Yes | User email |
| `password` | string | Yes | Min 8 characters |
| `full_name` | string | No | Display name |
| `org_name` | string | Yes | Restaurant / org name |

**Response `201`**

```json
{
  "access_token": "eyJ...",
  "token_type": "bearer",
  "user": {
    "id": 1,
    "email": "chef@example.com",
    "full_name": "Mario Rossi",
    "org_id": 1,
    "org_name": "Casa Mia",
    "role": "owner"
  }
}
```

---

### `POST /api/v1/auth/login`

Authenticate an existing user and receive a JWT.

**Request body**

| Field | Type | Required |
|-------|------|----------|
| `email` | string | Yes |
| `password` | string | Yes |

**Response `200`** — same shape as `/register`.

---

### `GET /api/v1/auth/me`

Returns the authenticated user's profile.

**Auth:** JWT required.

**Response `200`**

```json
{
  "id": 1,
  "email": "chef@example.com",
  "full_name": "Mario Rossi",
  "org_id": 1,
  "org_name": "Casa Mia",
  "role": "owner"
}
```

---

## Health

### `GET /api/v1/health`

Application liveness.

**Response `200`**

```json
{ "status": "ok", "service": "CortexKitchen API", "environment": "local" }
```

---

### `GET /api/v1/health/dependencies`

Live connectivity check for PostgreSQL, Qdrant, and Redis.

**Response `200`**

```json
{
  "service": "CortexKitchen API",
  "overall_ok": true,
  "dependencies": [
    { "name": "postgres", "ok": true, "detail": null },
    { "name": "qdrant",   "ok": true, "detail": null },
    { "name": "redis",    "ok": true, "detail": null }
  ]
}
```

`overall_ok` is `false` if any dependency fails. `detail` contains the error string when `ok` is `false`.

---

## Planning

### `GET /api/v1/planning/scenarios`

Returns all available scenario presets.

**Response `200`**

```json
{
  "scenarios": [
    {
      "id": "friday_rush",
      "label": "Friday Rush",
      "description": "High-demand dinner service with reservation pressure, inventory risk, and fast-turn execution needs.",
      "default_weekday": 4,
      "service_window": "18:00-22:00",
      "operational_focus": "Peak dinner demand, table turns, rush execution, and same-day stock protection."
    }
  ]
}
```

---

### `POST /api/v1/planning/run`

Executes the nine-node multi-agent planning pipeline. Returns the **full response as a standard JSON object** once the pipeline completes. No streaming — use `/planning/stream` if you need the live pipeline diagram.

**Auth:** JWT required.

**Request body**

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `scenario` | string | Yes | — | One of `friday_rush`, `weekday_lunch`, `holiday_spike`, `low_stock_weekend` |
| `target_date` | string | No | Next matching weekday | ISO date string, e.g. `"2026-06-12"` |
| `restaurant_id` | integer | No | `null` | Override org defaults with a named profile |
| `simulation_mode` | boolean | No | `false` | Use deterministic mock data |
| `force_critic_decision` | string | No | `null` | Override critic verdict for testing |
| `debug` | boolean | No | `false` | Include LangGraph execution trace in `meta` |

**Response `200`**

```json
{
  "scenario": "friday_rush",
  "target_date": "2026-06-12",
  "status": "ready",
  "cache_hit": false,
  "generated_at": "2026-06-12T16:00:00Z",
  "recommendations": {
    "forecast":     { "predicted_covers": 89, "peak_hour": "21:00", "confidence": "high", ... },
    "reservation":  { "reservations": 15, "occupancy_pct": 81.3, "peak_hour": "19:00", ... },
    "complaint":    { "total": 48, "negative_pct": 35, "top_issues": [...], ... },
    "menu":         { "top_items": [...], "items_to_avoid": [...], "strategy": "...", ... },
    "inventory":    { "shortage_alerts": 10, "critical_items": [...], ... }
  },
  "rag_context": {
    "complaints": [ ... ],
    "sops":       [ ... ]
  },
  "critic": {
    "verdict": "approved",
    "score": 0.92,
    "notes": "Plan addresses critical shortages and prioritises safe menu execution.",
    "dimension_scores": {
      "safety": 1.0, "feasibility": 0.70, "evidence": 0.80,
      "actionability": 0.90, "clarity": 0.90
    },
    "revision_reasons": [],
    "actionable_feedback": [],
    "cost_analysis": {
      "cost_pressure_score": 0.82,
      "benefit_score": 0.64,
      "tradeoff_score": 0.27,
      "recommended_focus": ["Favour low-complexity prep changes over forced execution changes."]
    }
  },
  "meta": {
    "planning_run_id": 42,
    "scenario": "friday_rush",
    "timestamp": "2026-06-12T16:00:00+00:00",
    "llm_usage": { "total_tokens": 6386, "total_cost_usd": 0.00405 },
    "node_traces": [ ... ]
  }
}
```

**Key response fields**

| Field | Description |
|-------|-------------|
| `status` | `ready` — plan approved or passable; `needs_review` — critic flagged issues; `blocked` — critical failure |
| `cache_hit` | `true` if the result was returned from Redis cache; `false` if the pipeline ran |
| `critic.verdict` | `approved`, `revision`, or `rejected` |
| `critic.score` | 0.0 – 1.0 composite quality score |
| `meta.planning_run_id` | ID of the persisted `planning_runs` row |
| `meta.llm_usage.total_cost_usd` | Total LLM spend for this run |

---

### `POST /api/v1/planning/stream`  *(SSE)*

Identical request body to `/planning/run`. Returns a `text/event-stream` response so the frontend can power the live pipeline diagram during the run.

**Auth:** JWT required.

**How it works**

As each LangGraph node completes, a `node_complete` event is emitted carrying **only the node name** — no output data. The frontend loading screen uses these events to update the pipeline diagram (waiting → running → done). When the full pipeline finishes, a single `complete` event delivers the entire plan payload. The dashboard renders all sections at once from this final event.

Only plans with `critic.verdict == "approved"` are written to cache. On a cache hit: all `node_complete` events are emitted instantly with `{"node": "...", "cached": true}`, followed by the `complete` event.

**SSE event format**

```
event: node_complete
data: {"node": "forecast"}

event: node_complete
data: {"node": "reservation"}

event: node_complete
data: {"node": "complaint"}

event: node_complete
data: {"node": "menu"}

event: node_complete
data: {"node": "inventory"}

event: node_complete
data: {"node": "aggregator"}

event: node_complete
data: {"node": "critic"}

event: complete
data: { ... full response payload — same shape as /planning/run ... }
```

Note: `ops_manager` and `final_assembler` do not emit `node_complete` events — they are not in the SSE node map.

**Error event**

```
event: error
data: {"message": "Stream error: ..."}
```

---

### `POST /api/v1/planning/whatif`

What-if demand simulator. Recalculates cost/benefit scoring for a user-supplied cover count without running the LangGraph pipeline — no LLM calls, instant response.

**Auth:** JWT required.

**Request body**

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `predicted_covers` | integer (1–1000) | Yes | — | Hypothetical cover count to evaluate |
| `avg_covers` | float | Yes | — | Historical baseline average covers from the existing run |
| `scenario` | string | No | `friday_rush` | Scenario label for context |
| `service_window` | string | No | `18:00-22:00` | Service window label for context |

**Response `200`**

```json
{
  "scenario": "friday_rush",
  "service_window": "18:00-22:00",
  "predicted_covers": 135,
  "avg_covers": 89.0,
  "demand_ratio": 1.52,
  "cost_pressure_score": 0.78,
  "benefit_score": 0.65,
  "tradeoff_score": 0.83,
  "pressure_components": { "demand": 0.8, "occupancy": 0.0, "inventory": 0.0 },
  "tradeoff_notes": ["High demand ratio suggests elevated operational pressure."],
  "recommended_focus": ["Prioritise staffing and prep capacity for the higher-than-baseline cover count."]
}
```

---

## Runs

### `GET /api/v1/runs`

Lists persisted planning runs in reverse-chronological order, org-scoped.

**Auth:** JWT required.

**Query parameters**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `limit` | integer (1–200) | `50` | Max runs to return |
| `scenario` | string | — | Filter by scenario id |
| `status` | string | — | Filter by status |
| `verdict` | string | — | Filter by critic verdict |
| `date_from` | string | — | ISO date — return runs on or after this date |
| `date_to` | string | — | ISO date — return runs on or before this date |

**Response `200`**

```json
{
  "runs": [
    {
      "id": 42,
      "scenario": "friday_rush",
      "target_date": "2026-06-12",
      "status": "ready",
      "critic_verdict": "approved",
      "critic_score": 0.92,
      "generated_at": "2026-06-12T16:00:00",
      "cache_hit": false
    }
  ]
}
```

---

### `GET /api/v1/runs/{run_id}`

Full detail for one persisted planning run.

**Auth:** JWT required.

**Response `200`** — includes full `recommendations`, `rag_context`, `critic`, and `meta` blocks (same shape as planning run response).

**Error `404`** — run not found or belongs to a different org.

---

### `GET /api/v1/runs/{run_id}/export`

Downloads a ReportLab-generated PDF chef brief for the run.

**Auth:** JWT required.  
**Response:** `application/pdf` file download.

The PDF includes: run summary, scenario, target date, critic verdict and score, dimension scores, agent recommendations, action items.

---

### `GET /api/v1/runs/{run_id}/export/excel`

Downloads a multi-sheet Excel workbook for the run.

**Auth:** JWT required.  
**Response:** `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet` file download.

Sheets:
- **Summary** — scenario, date, verdict, critic score
- **Inventory & Staffing** — shortage alerts, overstock alerts, restock actions (chef view)
- **Cost Breakdown** — LLM usage, critic dimension scores, cost-aware analysis (owner view)

---

## Chat

### `POST /api/v1/chat`  *(SSE stream)*

RAG chatbot over the org's planning history and guest feedback. Streams token-by-token via SSE.

**Auth:** JWT required.

**Request body**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `question` | string | Yes | User's question (1–1000 chars) |
| `history` | array | No | Prior turns: `[{"role": "user"/"assistant", "content": "..."}]` |

**SSE event format**

```
data: {"token": "Based"}
data: {"token": " on"}
data: {"token": " your"}
...
data: {"done": true}
```

**Data sources:** the last 10 `planning_runs` for the org (org-scoped) and the last 30 `feedback` records (not org-filtered — shared across the demo dataset).

**Example questions the chatbot handles**

- "What were the most common complaints recently?"
- "Which run had the lowest critic score and why?"
- "Which ingredients keep showing up as low stock?"
- "How is my restaurant performing overall?"
- "If I had to focus on one thing to improve our score, what would it be?"

---

## Observability

### `GET /api/v1/observability/summary`

Returns a 7-day planning summary for the org.

**Auth:** JWT required.

**Response `200`**

```json
{
  "period_days": 7,
  "total_runs": 59,
  "success_rate": 0.81,
  "avg_critic_score": 0.81,
  "avg_duration_ms": 16600,
  "by_verdict": {
    "approved": 48,
    "revision": 10,
    "rejected": 1
  },
  "by_scenario": {
    "friday_rush": 39,
    "low_stock_weekend": 7,
    "weekday_lunch": 7,
    "holiday_spike": 6
  },
  "top_scenario": "friday_rush",
  "latest_run_at": "2026-06-07T10:39:57"
}
```

---

### `GET /metrics`

Prometheus scrape endpoint. Returns OpenMetrics-format metrics including HTTP request count, latency histograms, and error rate by route and method.

**Auth:** None (public scrape endpoint).

---

### `GET /debug/sentry-test`

Intentionally raises a `RuntimeError` to verify Sentry exception capture is working. Only useful during setup. Note: registered directly on the main app — not under the `/api/v1` prefix.

**Auth:** None.

---

## Data Health

### `GET /api/v1/data-health`

Returns database coverage summary for the seeded operational data.

**Auth:** JWT required.

**Response `200`**

```json
{
  "orders":       { "count": 6495, "date_range": ["2026-01-16", "2026-05-31"] },
  "reservations": { "count": 1201, "date_range": ["2026-01-16", "2026-06-28"] },
  "feedback":     { "count": 160, "negative": 55, "positive": 75, "neutral": 30, "negative_pct": 34.4 },
  "inventory":    { "items": 18, "shortage_alerts": 11, "critical_shortages": 10, "overstock_alerts": 2 },
  "menu":         { "items": 27 },
  "scenario_coverage": [
    {
      "scenario": "friday_rush",
      "date": "2026-08-12",
      "reservations": 15,
      "guests": 61,
      "waitlist": 3,
      "occupancy_pct": 55.5
    }
  ]
}
```

---

## Settings

### `GET /api/v1/settings`

Returns the authenticated org's workspace settings.

**Auth:** JWT required.

**Response `200`**

```json
{
  "org_id": 1,
  "org_name": "Casa Mia",
  "settings": {
    "capacity": 110,
    "cuisine_type": "Italian",
    "peak_hours": "19:00-23:00",
    "timezone": "Asia/Kolkata",
    "critic_threshold": 0.75,
    "low_stock_threshold_pct": 25.0,
    "overstock_threshold_pct": 160.0
  }
}
```

---

### `PATCH /api/v1/settings`

Updates org settings. All fields are optional — only supplied fields are updated.

**Auth:** JWT required (owner role).

---

## Restaurant Profiles

### `GET /api/v1/restaurant-profiles`

Lists all restaurant profiles for the org.

**Auth:** JWT required.

**Response `200`**

```json
{
  "profiles": [
    {
      "id": 3,
      "name": "Casa Mia Rooftop",
      "cuisine": "Italian",
      "capacity": 75,
      "peak_hours": "18:00-22:00",
      "timezone": "Asia/Kolkata"
    }
  ]
}
```

---

### `POST /api/v1/restaurant-profiles`

Creates a new restaurant profile. Profile overrides org-level capacity and peak hours for a planning run when `restaurant_id` is supplied in the planning request.

**Auth:** JWT required (owner role).

---

### `PATCH /api/v1/restaurant-profiles/{id}`

Updates an existing profile.

---

### `DELETE /api/v1/restaurant-profiles/{id}`

Deletes a profile.

---

## Error responses

| Status | Meaning |
|--------|---------|
| `401` | Missing or invalid JWT |
| `403` | Action requires owner role |
| `404` | Resource not found or belongs to a different org |
| `422` | Request body validation failed (Pydantic) |
| `500` | Internal server error — check Sentry and structlog output |
