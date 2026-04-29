# CortexKitchen Architecture

## Overview

CortexKitchen is a local-first restaurant planning system centered on a multi-agent orchestration flow. The backend pulls together structured operational data, vector memory, forecasting logic, and critic validation, then the frontend presents the result as a planning dashboard and audit trail.

This document reflects the implementation as of April 29, 2026.

## System shape

```text
Next.js UI
  |- dashboard
  |- runs audit view
  |- data-health view
        |
        v
FastAPI API
  |- health routes
  |- planning routes
  |- runs routes
        |
        v
LangGraph orchestration
  |- ops manager
  |- demand forecast
  |- reservation
  |- complaint intelligence
  |- menu intelligence
  |- inventory
  |- aggregator
  |- critic
  |- final assembler
        |
        v
Service and data layer
  |- PostgreSQL via SQLAlchemy
  |- Qdrant vector retrieval
  |- Redis connectivity
  |- LLM provider abstraction
  |- seed/demo datasets
```

## Backend architecture

### API layer

The FastAPI app exposes:

- health and dependency health
- scenario listing
- scenario planning execution
- persisted run list and detail
- data-health summaries

Routes are mounted under `/api/v1` through `app.api.routes`.

### Orchestration layer

The orchestration flow is organized under `app/orchestration`. The current graph is no longer just a Friday-only demo path. It supports a shared planning route that can be framed by four scenario presets:

- `friday_rush`
- `weekday_lunch`
- `holiday_spike`
- `low_stock_weekend`

### Domain services

The domain layer currently includes concrete services for:

- forecast generation
- reservations analysis
- complaint analysis
- menu insights
- inventory alerts
- critic scoring and sanity checks
- persisted planning runs
- cost-aware scoring support

### Infrastructure layer

The infrastructure code handles:

- DB models and session setup
- Prophet-backed forecasting support
- Qdrant retrieval and embeddings
- LLM provider abstraction
- dependency health checks

## Frontend architecture

The frontend is a Next.js App Router app in `apps/web/cortexkitchen-ui`.

Current user-facing pages:

- `/` - main planning dashboard
- `/runs` - persisted run audit trail
- `/data-health` - seeded data coverage view

The UI consumes the API through a thin client in `lib/api.ts`.

## Data flow

1. The user selects a scenario and date in the dashboard.
2. The frontend submits a planning request to the API.
3. The backend runs the shared orchestration flow.
4. Agent outputs are aggregated and reviewed by the critic.
5. The final response is returned and a planning run is persisted when possible.
6. The dashboard renders the plan and related context.
7. The runs page can later inspect persisted critic and recommendation details.

## Storage roles

- PostgreSQL - structured operations data and persisted planning runs
- Qdrant - complaint and SOP retrieval context
- Redis - available for cache/state concerns in the local stack

## Current architectural strengths

- Clear separation between route, orchestration, service, and infrastructure layers
- Shared scenario runner instead of one hardcoded demo endpoint
- Audit visibility through persisted runs and critic detail
- Local-first reproducibility with Docker Compose

## Current architectural limitations

- No auth or production security model
- No cloud deployment path documented or implemented here
- Shared cross-app contract package is still empty
- Integrations are synthetic/local rather than live
