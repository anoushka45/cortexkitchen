# CortexKitchen Architecture

Last updated: May 2026. Reflects the implemented codebase.

---

## Overview

CortexKitchen is a local-first restaurant operations planning system built around a multi-agent orchestration pipeline. The backend coordinates structured operational data, time-series forecasting, vector retrieval, LLM reasoning, and business-rule validation. The frontend presents the result as a planning dashboard and audit trail.

---

## System shape

```
Next.js UI (App Router)
  ├── / — planning dashboard
  ├── /runs — audit trail
  └── /data-health — data coverage view
          │
          │  HTTP (JSON)
          ▼
FastAPI application
  ├── GET  /api/v1/health
  ├── GET  /api/v1/health/dependencies
  ├── GET  /api/v1/planning/scenarios
  ├── POST /api/v1/planning/run
  ├── POST /api/v1/planning/friday-rush  (compat alias)
  ├── GET  /api/v1/runs
  ├── GET  /api/v1/runs/{id}
  └── GET  /api/v1/data-health
          │
          ▼
LangGraph orchestration graph
  (see graph topology below)
          │
          ▼
Service and data layer
  ├── PostgreSQL — structured data + planning_runs audit table
  ├── Qdrant — vector retrieval for complaints and SOPs
  ├── Redis — available; reserved for future caching
  └── LLM provider abstraction — Gemini or Groq
```

---

## Backend architecture

### API layer

The FastAPI application (`apps/api`) exposes all routes under the `/api/v1` prefix. Routes are split across three modules:

- `app/api/routes/health.py` — liveness and dependency health
- `app/api/routes/planning.py` — scenario listing and planning execution
- `app/api/routes/runs.py` — audit run list, run detail, and data-health

Schemas (request/response Pydantic models) are in `app/api/schemas/`.

### Orchestration layer

The orchestration flow is implemented as a LangGraph `StateGraph` in `app/orchestration/graph.py`. It runs a nine-node pipeline with a parallel fan-out pattern:

```
ops_manager
    │
    ├── (error path) → final_assembler
    │
    ▼
demand_forecast
    │
    ├──────────────────┬────────────────┬──────────────┐
    ▼                  ▼                ▼              ▼
reservation    complaint_intel    menu_intel       inventory
    │                  │                │              │
    └──────────────────┴────────────────┴──────────────┘
                            │
                            ▼
                        aggregator
                            │
                            ▼
                          critic
                            │
                            ▼
                      final_assembler
                            │
                            ▼
                           END
```

**Conditional routing:** after `ops_manager`, if the scenario is invalid or a fatal error is set in state, the graph skips directly to `final_assembler` and returns an error response. Otherwise it proceeds with `demand_forecast`.

**Parallel execution:** the four domain nodes (`reservation`, `complaint_intelligence`, `menu_intelligence`, `inventory`) all receive edges from `demand_forecast` and all feed into `aggregator`. LangGraph executes these in parallel where the runtime allows.

The graph is constructed fresh per request via `build_graph(deps)`, which injects the database session, LLM provider, and memory service at wire time.

### Domain services

The domain layer (`app/domain/services/`) contains the business logic called by each node:

| Service | Responsibility |
|---------|----------------|
| `ForecastService` | Queries historical orders, runs Prophet, produces demand signal |
| `ReservationService` | Analyses booking density and occupancy risk |
| `ComplaintService` | Retrieves complaint patterns from Qdrant, surfaces risk signals |
| `MenuService` | Evaluates top and weak menu items; surfaces promotion guidance |
| `InventoryService` | Computes shortage and overstock alerts from stock vs threshold |
| `CriticService` | Validates the aggregated plan against business rules; scores output |
| `RunService` | Persists planning runs to `planning_runs`; powers the runs API |
| `CostAwareScoringService` | Computes cost/benefit pressure score used by the critic |
| `EvaluationSanityChecker` | Automated sanity checks run as part of critic evaluation |

### Infrastructure layer

The infrastructure layer (`app/infrastructure/`) handles technical integrations:

| Module | Responsibility |
|--------|----------------|
| `db/models.py` | SQLAlchemy ORM models |
| `db/session.py` | Session factory and dependency |
| `llm/` | `GeminiProvider` and `GroqProvider` behind a `BaseLLMProvider` abstraction |
| `forecasting/` | Prophet-backed time-series forecaster |
| `memory/` | `MemoryService` and `EmbeddingService` for Qdrant retrieval |
| `observability/dependency_health.py` | PostgreSQL, Qdrant, and Redis connectivity checks |

---

## Frontend architecture

The frontend (`apps/web/cortexkitchen-ui`) is a Next.js App Router application.

### Pages

| Route | Purpose |
|-------|---------|
| `/` | Main planning dashboard — scenario selection, run submission, agent output cards, critic banner |
| `/runs` | Audit trail of persisted planning runs |
| `/data-health` | Seeded data coverage view |

### Key components

- Scenario selector (4 presets)
- Planning run submission with loading states
- Result cards for forecast, reservation, complaint, menu, and inventory outputs
- Critic verdict banner with manager brief modal
- RAG context drawer
- Run history drawer

The UI communicates with the backend through a thin client in `lib/api.ts`. The API base URL is controlled by the `NEXT_PUBLIC_API_BASE_URL` environment variable (defaults to `http://localhost:8000`).

---

## Data flow

1. User selects a scenario and submits a planning request from the dashboard.
2. Frontend posts to `POST /api/v1/planning/run`.
3. FastAPI builds the LangGraph graph with injected dependencies and invokes it.
4. `ops_manager` validates the scenario and initialises shared state.
5. `demand_forecast` produces the service-pressure signal.
6. `reservation`, `complaint_intelligence`, `menu_intelligence`, and `inventory` run in parallel, each reading from PostgreSQL and (for complaints) Qdrant.
7. `aggregator` combines all domain outputs into a single package.
8. `critic` validates the plan against business rules, scores it, and adds revision feedback where needed.
9. `final_assembler` shapes the response for the API client.
10. The planning run is persisted to the `planning_runs` table.
11. The frontend renders the plan, critic verdict, and RAG context.
12. The `/runs` page can be used to inspect any persisted run later.

---

## Storage roles

| Store | Role |
|-------|------|
| **PostgreSQL** | `menu_items`, `reservations`, `orders`, `inventory`, `feedback`, `decision_logs`, `planning_runs` |
| **Qdrant** | `complaints_memory` and `sop_memory` collections for RAG retrieval |
| **Redis** | Present in local stack; not yet used as primary state |

---

## Architectural strengths

- Clear separation across route, orchestration, service, and infrastructure layers
- Parallel fan-out in the orchestration graph reduces sequential latency
- Shared scenario runner rather than one hardcoded demo endpoint
- LLM provider abstraction: switching from Gemini to Groq requires only a config change
- Audit visibility through persisted planning runs and critic detail
- Local-first reproducibility via Docker Compose and seed scripts

## Current limitations

- No authentication or production security model
- No cloud deployment path documented or implemented
- Shared cross-app contract package (`packages/core`) is empty
- All data integrations are synthetic; no live POS or platform connections
- Redis is not yet used beyond connectivity health checks
