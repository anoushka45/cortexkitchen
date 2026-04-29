# CortexKitchen API Contracts

This document describes the current API surface implemented in the FastAPI app as of April 29, 2026.

Base prefix: `/api/v1`

## Health

### `GET /api/v1/health`

Basic application health response.

### `GET /api/v1/health/dependencies`

Dependency-level health response for PostgreSQL, Qdrant, and Redis connectivity.

## Planning

### `GET /api/v1/planning/scenarios`

Returns the scenario presets the UI can run.

Current scenarios:

- `friday_rush`
- `weekday_lunch`
- `holiday_spike`
- `low_stock_weekend`

### `POST /api/v1/planning/run`

Runs the shared scenario-aware orchestration flow.

Typical request fields:

- `scenario`
- `target_date`
- `simulation_mode`
- `force_critic_decision`
- `debug`

Typical response sections:

- `scenario`
- `target_date`
- `status`
- `generated_at`
- `recommendations`
- `rag_context`
- `critic`
- `meta`

### `POST /api/v1/planning/friday-rush`

Backward-compatible Friday-specific route. New clients should prefer `POST /api/v1/planning/run`.

## Runs

### `GET /api/v1/runs`

Lists persisted planning runs.

Supported query params:

- `limit`
- `scenario`
- `status`
- `verdict`

### `GET /api/v1/runs/{run_id}`

Returns detail for one persisted planning run, including critic output, final response, and RAG context.

## Data health

### `GET /api/v1/data-health`

Returns a summary of seeded data coverage used by the planning system, including:

- order coverage
- reservation coverage
- feedback counts and sentiment mix
- inventory signals
- menu count
- scenario coverage for upcoming demo dates

## Notes

- The older planning-only docs that described many future CRUD and debug endpoints are no longer accurate for the current implementation.
- The live route surface is intentionally narrower than the earlier design docs.
