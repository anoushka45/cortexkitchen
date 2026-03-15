# API Contracts
# CortexKitchen

## 1. Purpose

This document outlines the planned API surface for CortexKitchen.

The API will be implemented in FastAPI and will expose a small, clean set of endpoints for:
- health and debug
- planning flows
- reservations
- complaints
- decision traces

The MVP focuses on enabling the Friday Night Rush Optimization scenario.

---

## 2. API Design Principles

- keep endpoints simple and task-oriented
- use typed request/response schemas
- separate orchestration endpoints from raw CRUD endpoints
- ensure responses are structured enough for frontend and testing
- favor clarity over too many endpoints in MVP

---

## 3. Planned Endpoint Groups

## 3.1 Health and System

### `GET /health`
Basic liveness endpoint.

**Response**
- status
- service name
- timestamp

---

### `GET /health/dependencies`
Checks DB/vector/cache availability.

**Response**
- postgres status
- qdrant status
- redis status
- llm provider status

---

## 3.2 Planning / Orchestration

### `POST /api/v1/planning/friday-rush`
Runs the main flagship planning flow.

**Purpose**
Generate a validated Friday night operational plan.

**Request (planned)**
- target_date
- target_service_window
- include_menu_insights
- include_inventory_signals
- include_complaint_analysis

**Response (planned)**
- scenario_type
- forecast_summary
- reservation_summary
- complaint_summary
- menu_summary
- inventory_summary
- recommended_actions
- critic_result
- decision_trace_id

---

### `POST /api/v1/planning/complaints-analysis`
Runs complaint intelligence independently.

**Request (planned)**
- date_from
- date_to
- platform_filters
- complaint_type_filters

**Response (planned)**
- total_complaints
- issue_themes
- summary
- retrieved_context
- suggested_actions

---

## 3.3 Reservations

### `GET /api/v1/reservations`
Returns reservations for filtering/debug/dashboard.

**Query params (planned)**
- date
- slot_label
- source
- status

**Response**
- list of reservations
- count

---

### `POST /api/v1/reservations`
Creates a reservation.

**Request (planned)**
- source
- customer_name
- party_size
- reservation_date
- reservation_time
- notes

**Response**
- created reservation object
- validation summary

---

### `GET /api/v1/reservations/capacity-summary`
Returns slot-level reservation pressure.

**Query params (planned)**
- date
- service_window

**Response**
- slot summaries
- utilization percentages
- pressure flags

---

## 3.4 Complaints

### `GET /api/v1/complaints`
Returns complaint records for a date range.

**Query params (planned)**
- date_from
- date_to
- platform
- complaint_type

**Response**
- list of complaints
- count

---

### `POST /api/v1/complaints/ingest-simulated`
Loads simulated complaint data for local development.

**Purpose**
Support local testing without external review APIs.

**Response**
- inserted_count
- dataset_status

---

## 3.5 Decision Traces

### `GET /api/v1/decision-traces`
Returns recent AI decision traces.

**Query params (planned)**
- scenario_type
- date_from
- date_to
- critic_status

**Response**
- list of traces
- count

---

### `GET /api/v1/decision-traces/{decision_trace_id}`
Returns a single detailed decision trace.

**Response**
- full decision trace object
- critic evaluation details

---

## 3.6 Seed / Debug Endpoints

### `POST /api/v1/debug/seed-data`
Seeds synthetic restaurant data.

**Purpose**
Make local demos easy.

**Response**
- inserted table counts
- seed version
- success status

---

### `POST /api/v1/debug/reset-demo-state`
Resets the database to a clean demo state.

**Response**
- reset summary
- success status

---

## 4. Planned Response Design

MVP responses should be structured enough for:
- frontend rendering
- testing assertions
- future logging and evaluation

Responses should generally prefer:
- explicit summaries
- nested domain sections
- IDs for traceability
- status/score fields where relevant

---

## 5. Example Friday Rush Response Shape

A planning response may conceptually include:

- scenario_type
- target_date
- demand_forecast
  - predicted_total_orders
  - peak_window
  - confidence
- reservations
  - total_bookings
  - pressure_slots
  - utilization_summary
- complaints
  - total_recent
  - issue_themes
  - complaint_summary
- menu
  - top_items
  - weak_items
- inventory
  - shortage_alerts
- recommendations
  - action
  - rationale
  - evidence_summary
- critic
  - status
  - score
  - notes
- decision_trace_id

---

## 6. Schema Expectations

Pydantic request and response schemas should be:
- versioned by domain where useful
- small and composable
- reusable across routes
- separated from domain services

Examples of schema categories:
- health schemas
- reservation schemas
- planning schemas
- complaint schemas
- decision trace schemas

---

## 7. Error Handling Approach

Errors should be structured and predictable.

### Planned error response fields
- error_code
- message
- details
- timestamp
- request_id

### Error categories
- validation error
- dependency unavailable
- orchestration failure
- seed/reset failure
- not found

---

## 8. Authentication

Authentication is not required for the earliest local MVP.

### Future option
The API can later be extended with:
- simple token auth
- role-based access
- tenant-aware identity

Authentication is intentionally deferred to keep the MVP focused.

---

## 9. Versioning

The API should start under:

`/api/v1/`

This keeps the project extensible and more production-like.

---

## 10. Summary

The CortexKitchen API is designed to support both orchestration-driven intelligence flows and a small set of foundational CRUD/debug endpoints. The MVP API is intentionally narrow, structured, and strongly aligned with the Friday Night Rush Optimization demo.