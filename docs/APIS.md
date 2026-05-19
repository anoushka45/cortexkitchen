# CortexKitchen API Reference

Base URL: `http://localhost:8000`  
Base prefix: `/api/v1`  
Interactive docs: `http://localhost:8000/docs` (Swagger UI)

All request and response bodies use `application/json`.

---

## Health

### `GET /api/v1/health`

Application liveness check.

**Response `200`**

```json
{
  "status": "ok",
  "service": "CortexKitchen API",
  "environment": "local"
}
```

---

### `GET /api/v1/health/dependencies`

Checks connectivity to PostgreSQL, Qdrant, and Redis.

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

`overall_ok` is `false` if any dependency check fails. Individual entries include a `detail` string when `ok` is `false`.

---

## Planning

### `GET /api/v1/planning/scenarios`

Returns the list of available scenario presets.

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
    },
    {
      "id": "weekday_lunch",
      "label": "Weekday Lunch",
      "description": "Midday service balancing predictable demand, staffing efficiency, and lighter prep plans.",
      "default_weekday": 2,
      "service_window": "12:00-15:00",
      "operational_focus": "Lunch pacing, lean staffing, prep efficiency, and delivery/takeaway smoothness."
    },
    {
      "id": "holiday_spike",
      "label": "Holiday Spike",
      "description": "Exceptionally heavy service window where demand, waitlists, and fulfillment pressure may spike above normal baselines.",
      "default_weekday": 5,
      "service_window": "17:00-22:00",
      "operational_focus": "Demand surge readiness, queue protection, aggressive stock planning, and quality retention under pressure."
    },
    {
      "id": "low_stock_weekend",
      "label": "Low-Stock Weekend",
      "description": "Weekend service planning under tighter ingredient constraints and stricter prioritization of feasible actions.",
      "default_weekday": 6,
      "service_window": "18:00-22:00",
      "operational_focus": "Critical-shortage prioritization, menu restraint, waste avoidance, and service continuity."
    }
  ]
}
```

`default_weekday` is a Python `datetime.weekday()` integer (0 = Monday, 6 = Sunday).

---

### `POST /api/v1/planning/run`

Executes the multi-agent planning workflow for the specified scenario.

**Request body**

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `scenario` | string (enum) | Yes | `"friday_rush"` | One of `friday_rush`, `weekday_lunch`, `holiday_spike`, `low_stock_weekend` |
| `target_date` | string | No | Next matching weekday | ISO date string, e.g. `"2026-05-23"` |
| `simulation_mode` | boolean | No | `false` | Use deterministic mock data instead of live forecasting |
| `force_critic_decision` | string | No | `null` | Override critic verdict for testing: `"approved"`, `"rejected"`, or `"revision"` |
| `debug` | boolean | No | `false` | Include LangGraph execution trace and state snapshots in `meta` |

**Example request**

```json
{
  "scenario": "friday_rush",
  "target_date": "2026-05-23",
  "simulation_mode": false,
  "debug": false
}
```

**Response `200`**

```json
{
  "scenario": "friday_rush",
  "target_date": "2026-05-23",
  "status": "ready",
  "generated_at": "2026-05-23T14:00:00Z",
  "recommendations": {
    "forecast":     { ... },
    "reservation":  { ... },
    "complaint":    { ... },
    "menu":         { ... },
    "inventory":    { ... }
  },
  "rag_context": {
    "complaints": [ ... ],
    "sops":       [ ... ]
  },
  "critic": {
    "verdict": "approved",
    "score": 0.84,
    "notes": "Plan meets operational standards.",
    "dimension_scores": {
      "safety":        0.9,
      "feasibility":   0.85,
      "evidence":      0.8,
      "actionability": 0.82,
      "clarity":       0.83
    },
    "revision_reasons":    [],
    "actionable_feedback": [],
    "cost_analysis": {
      "cost_pressure_score": 0.55,
      "benefit_score":       0.78,
      "tradeoff_score":      0.71,
      "pressure_components": { ... },
      "benefit_components":  { ... },
      "tradeoff_notes":      [ ... ],
      "recommended_focus":   [ ... ],
      "signals":             { ... }
    },
    "sanity_checks":   { ... },
    "decision_log_id": 42
  },
  "meta": {
    "timestamp":      "2026-05-23T14:00:00+00:00",
    "scenario":       "friday_rush",
    "planning_run_id": 17
  }
}
```

**Response fields**

| Field | Description |
|-------|-------------|
| `status` | `ready` — plan approved or passable; `needs_review` — critic flagged issues; `blocked` — critical failures |
| `recommendations` | Per-agent output keyed by `forecast`, `reservation`, `complaint`, `menu`, `inventory` |
| `rag_context` | Complaint patterns and SOPs retrieved from Qdrant and used in planning |
| `critic.verdict` | `approved`, `rejected`, or `revision` |
| `critic.score` | 0.0 – 1.0 composite quality score |
| `critic.dimension_scores` | Breakdown by safety, feasibility, evidence, actionability, and clarity |
| `critic.revision_reasons` | Short descriptions of what weakened the plan (present when verdict is `revision` or `rejected`) |
| `critic.actionable_feedback` | Specific changes the planner should make |
| `critic.sanity_checks` | Automated sanity check results from `EvaluationSanityChecker` |
| `meta.planning_run_id` | ID of the persisted `PlanningRun` row; absent if persistence failed |

**Error responses**

| Status | Condition |
|--------|-----------|
| `422` | Request body validation failed |
| `500` | Orchestration error or empty graph response |

---

### `POST /api/v1/planning/friday-rush`

Backward-compatible alias for `POST /api/v1/planning/run` with `scenario` fixed to `friday_rush`. New clients should use `/planning/run` instead.

**Request body** — same as `/planning/run` minus the `scenario` field.

**Response** — identical to `/planning/run`.

---

## Runs

### `GET /api/v1/runs`

Lists persisted planning runs in reverse-chronological order.

**Query parameters**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `limit` | integer (1–100) | `25` | Maximum number of runs to return |
| `scenario` | string | — | Filter by scenario id |
| `status` | string | — | Filter by status (`ready`, `needs_review`, `blocked`) |
| `verdict` | string | — | Filter by critic verdict (`approved`, `rejected`, `revision`) |

**Response `200`**

```json
{
  "runs": [
    {
      "id": 17,
      "scenario": "friday_rush",
      "target_date": "2026-05-23",
      "status": "ready",
      "critic_verdict": "approved",
      "critic_score": 0.84,
      "generated_at": "2026-05-23T14:00:00"
    }
  ]
}
```

---

### `GET /api/v1/runs/{run_id}`

Returns the full detail for one persisted planning run.

**Path parameters**

| Parameter | Type | Description |
|-----------|------|-------------|
| `run_id` | integer | ID of the planning run |

**Response `200`**

```json
{
  "id": 17,
  "scenario": "friday_rush",
  "target_date": "2026-05-23",
  "status": "ready",
  "critic_verdict": "approved",
  "critic_score": 0.84,
  "generated_at": "2026-05-23T14:00:00",
  "recommendations": { ... },
  "rag_context":     { ... },
  "critic":          { ... },
  "final_response":  { ... }
}
```

**Error responses**

| Status | Condition |
|--------|-----------|
| `404` | Run not found |

---

## Data Health

### `GET /api/v1/data-health`

Returns a coverage summary of the seeded operational data used by the planning system. Useful for verifying the local demo dataset is intact.

**Response `200`**

```json
{
  "orders": {
    "count": 4250,
    "date_range": ["2026-02-18", "2026-05-19"]
  },
  "reservations": {
    "count": 610,
    "date_range": ["2026-02-18", "2026-05-30"]
  },
  "feedback": {
    "count": 320,
    "date_range": ["2026-02-18", "2026-05-19"],
    "negative": 96,
    "positive": 160,
    "neutral":  64,
    "negative_pct": 30.0
  },
  "inventory": {
    "items": 18,
    "shortage_alerts": 3,
    "critical_shortages": 1,
    "overstock_alerts": 2
  },
  "menu": {
    "items": 22
  },
  "scenario_coverage": [
    {
      "scenario":      "friday_rush",
      "label":         "Friday Rush",
      "date":          "2026-05-23",
      "reservations":  42,
      "guests":        98,
      "waitlist":       4,
      "occupancy_pct": 140.0
    }
  ]
}
```

`occupancy_pct` uses a 70-seat baseline. `scenario_coverage` lists the next matching service date for each scenario along with seeded reservation pressure for that date.
