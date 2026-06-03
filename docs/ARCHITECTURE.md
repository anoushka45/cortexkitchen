# CortexKitchen Architecture

Last updated: June 2026. Reflects the implemented codebase (Phase 4 complete).

---

## Overview

CortexKitchen is a local-first restaurant operations planning system built around a multi-agent orchestration pipeline. The backend coordinates structured operational data, time-series forecasting, vector retrieval, LLM reasoning, and business-rule validation. The frontend presents the result as a planning dashboard and audit trail.

Phase 4 added multi-tenant authentication, LangSmith tracing, structured logging, LLM cost tracking, configurable restaurant profiles, an LLM provider abstraction with automatic fallback, RAGAS/DeepEval quality evals, and an MCP server for Claude integration.

---

## System shape

```
Claude Code / Claude Desktop
  │  MCP stdio protocol
  ▼
mcp_server.py
  │
  │  HTTP (JWT)
  ▼
Next.js UI (App Router)
  ├── /           — planning dashboard
  ├── /runs       — audit trail with filter, trend, diff
  ├── /settings   — tenant config
  └── /restaurant-profiles
          │
          │  HTTP (JSON) + JWT
          ▼
FastAPI application
  ├── POST /api/v1/auth/register
  ├── POST /api/v1/auth/login
  ├── GET  /api/v1/health
  ├── GET  /api/v1/health/dependencies
  ├── GET  /api/v1/planning/scenarios
  ├── POST /api/v1/planning/run          (JWT)
  ├── GET  /api/v1/runs                  (JWT)
  ├── GET  /api/v1/runs/{id}             (JWT)
  ├── GET/PUT /api/v1/settings           (JWT)
  └── CRUD /api/v1/restaurant-profiles   (JWT)
          │
          ▼
LangGraph orchestration graph
  (see graph topology below)
          │
          ▼
Service and data layer
  ├── PostgreSQL — structured data + planning_runs audit table
  ├── Qdrant — vector retrieval for complaints and SOPs
  ├── Redis — present in local stack; reserved for async queue (Phase 5)
  └── LLM provider abstraction — Groq (default) or Gemini, auto-fallback
```

---

## Backend architecture

### API layer

The FastAPI application (`apps/api`) exposes all routes under the `/api/v1` prefix. Routes are split across modules:

- `app/api/routes/auth.py` — register, login, `/auth/me`
- `app/api/routes/planning.py` — scenario listing and planning execution
- `app/api/routes/runs.py` — audit run list, run detail, data-health
- `app/api/routes/settings.py` — tenant org settings
- `app/api/routes/restaurant_profiles.py` — restaurant profile CRUD

Schemas (request/response Pydantic models) are in `app/api/schemas/`.

### Auth

JWT (HS256) authentication is implemented in `app/core/auth.py`. All planning and data routes are protected via the `get_current_user` dependency. Tokens are org-scoped — every planning run is stamped with `org_id`.

Registration creates a user + org in one step. The `user_organizations` join table tracks membership and roles.

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

**Conditional routing:** after `ops_manager`, if the scenario is invalid or a fatal error is set in state, the graph skips directly to `final_assembler`. Otherwise it proceeds with `demand_forecast`.

**Parallel execution:** the four domain nodes run in parallel where the runtime allows.

**Per-node tracing:** every node is wrapped with structlog instrumentation that emits `node_start` / `node_end` events with `duration_ms`, `llm_provider_used`, and `llm_fallback_used`. Traces are collected into `meta.node_traces` on the planning run response.

The graph is constructed fresh per request via `build_graph(deps)`, which injects the database session, LLM provider, and memory service at wire time.

### Domain services

The domain layer (`app/domain/services/`) contains the business logic called by each node:

| Service | Responsibility |
|---------|----------------|
| `ForecastService` | Queries historical orders, runs Prophet, produces demand signal |
| `ReservationService` | Analyses booking density and occupancy risk |
| `ComplaintService` | Retrieves complaint patterns from Qdrant before LLM call; RAG context feeds the prompt |
| `MenuService` | Evaluates top and weak menu items; surfaces promotion guidance |
| `InventoryService` | Computes shortage and overstock alerts from stock vs threshold |
| `CriticService` | Validates the aggregated plan against business rules; scores output |
| `RunService` | Persists planning runs to `planning_runs`; powers the runs API |
| `CostAwareScoringService` | Computes cost/benefit pressure score used by the critic |
| `EvaluationSanityChecker` | Automated sanity checks run as part of critic evaluation |

### Infrastructure layer

| Module | Responsibility |
|--------|----------------|
| `db/models.py` | SQLAlchemy ORM models — includes `users`, `organizations`, `user_organizations`, `restaurant_profiles` added in Phase 4 |
| `db/session.py` | Session factory and dependency |
| `llm/base.py` | `BaseLLMProvider` ABC — `complete()`, `complete_json()`, thread-safe usage tracking |
| `llm/factory.py` | `FallbackLLMProvider` + `create_llm_provider()` — reads `LLM_PROVIDER`, wires fallback automatically (groq↔gemini) |
| `llm/gemini.py` | `GeminiProvider` — google-genai SDK |
| `llm/groq.py` | `GroqProvider` — groq SDK |
| `forecasting/` | Prophet-backed time-series forecaster |
| `vector/memory_service.py` | `MemoryService` and `EmbeddingService` for Qdrant retrieval |
| `observability/dependency_health.py` | Real PostgreSQL, Qdrant, and Redis connectivity checks |

### LLM provider abstraction

All agents depend on `BaseLLMProvider`, never on a concrete class. `create_llm_provider()` reads `LLM_PROVIDER` from environment (default: `groq`) and constructs a `FallbackLLMProvider` that wraps a primary and fallback provider.

On any LLM exception the wrapper logs `llm_primary_failed_retrying_fallback` and transparently retries on the fallback. The provider used (`llm_provider_used`, `llm_fallback_used`) is surfaced in structlog output and in the planning run metadata.

### Observability

- **LangSmith tracing** — `LANGCHAIN_TRACING_V2=true` enables per-node traces in LangSmith
- **Structured logging** — `structlog` JSON output across all nodes; every log event includes `node`, `run_id`, `scenario`, `duration_ms`, and LLM provider fields
- **LLM cost tracking** — `record_usage()` on every LLM call; aggregated `total_tokens`, `total_cost_usd`, and per-call `llm_usage` persisted in `planning_runs.metadata`

---

## MCP server

`apps/api/mcp_server.py` is a stdio MCP server (Anthropic MCP SDK) that exposes two tools:

| Tool | Description |
|------|-------------|
| `run_planning_scenario` | Triggers the full 9-node planning pipeline |
| `get_run_history` | Fetches recent planning runs with optional scenario/verdict filters |

The server authenticates against the FastAPI backend using `CORTEX_EMAIL` + `CORTEX_PASSWORD` on first call and reuses the JWT for the session.

Claude Code discovers the server automatically via `.mcp.json` in the project root. Claude Desktop uses `docs/mcp_claude_desktop_config.json`.

---

## LLM quality evaluations

Eval scripts live in `apps/api/evals/` and are excluded from the normal `pytest` test path (must be run explicitly).

| Suite | File | Metrics | Threshold |
|-------|------|---------|-----------|
| RAGAS | `test_ragas_complaint.py` | Faithfulness, context precision on complaint RAG pipeline | Faithfulness ≥ 0.8 |
| DeepEval | `test_deepeval_quality.py` | HallucinationMetric on critic output; AnswerRelevancyMetric on agent outputs | Hallucination ≤ 0.5; Relevancy ≥ 0.7 |

Both suites use Groq (`llama-3.3-70b-versatile`) as the evaluator LLM.

---

## Frontend architecture

The frontend (`apps/web/cortexkitchen-ui`) is a Next.js App Router application with JWT cookie-based auth.

### Pages

| Route | Purpose |
|-------|---------|
| `/login`, `/register` | JWT auth flow |
| `/` | Planning dashboard — scenario selection, run submission, agent output cards, critic verdict |
| `/runs` | Audit trail — scenario filter, date range picker, critic score trend chart, side-by-side diff modal |
| `/settings` | Tenant config — capacity, peak hours, thresholds |
| `/restaurant-profiles` | Manage per-org restaurant profiles |

### Auth

`AuthContext` manages the JWT stored in an `cortex_token` cookie. `proxy.ts` (Next.js route guard) redirects unauthenticated users to `/login`. All API calls include the `Authorization: Bearer` header via `lib/api.ts`.

The UI communicates with the backend through `lib/api.ts`. The API base URL is controlled by `NEXT_PUBLIC_API_BASE_URL` (defaults to `http://localhost:8000`).

---

## Data flow

1. User selects a scenario and submits a planning request from the dashboard.
2. Frontend posts to `POST /api/v1/planning/run` with JWT header.
3. FastAPI resolves `get_current_user` (org-scoped), loads org settings and optional restaurant profile, builds the LangGraph graph, and invokes it.
4. `ops_manager` validates the scenario and initialises shared state.
5. `demand_forecast` produces the service-pressure signal.
6. `complaint_intelligence` retrieves similar complaints and SOPs from Qdrant **before** the LLM call, so retrieved context feeds the prompt.
7. `reservation`, `menu_intelligence`, and `inventory` run in parallel with `complaint_intelligence`.
8. `aggregator` combines all domain outputs into a single package.
9. `critic` validates the plan against business rules, scores it across 5 dimensions, and adds revision feedback.
10. `final_assembler` shapes the response; provider metadata, node traces, and LLM usage are attached to `meta`.
11. The planning run is persisted to `planning_runs` with full metadata.
12. The frontend renders the plan, critic verdict, and RAG context.

---

## Storage roles

| Store | Role |
|-------|------|
| **PostgreSQL** | `menu_items`, `reservations`, `orders`, `inventory`, `feedback`, `decision_logs`, `planning_runs`, `organizations`, `users`, `user_organizations`, `restaurant_profiles` |
| **Qdrant** | `complaints_memory` and `sop_memory` collections for RAG retrieval |
| **Redis** | Present in local stack; not yet used as primary state (Phase 5: async job queue) |

---

## Architectural strengths

- Clear separation across route, orchestration, service, and infrastructure layers
- Parallel fan-out in the orchestration graph reduces sequential latency
- LLM provider abstraction with automatic fallback — switching providers requires only a config change
- RAG context feeds the LLM prompt rather than being attached post-generation
- Auth is org-scoped — every planning run is tenant-isolated
- Full observability: LangSmith traces, structlog JSON, per-node latency, LLM cost per run
- MCP integration lets Claude trigger real planning runs from natural language
- RAGAS + DeepEval evals gate LLM output quality on every eval run

## Current limitations

- All data integrations are synthetic — no live POS or platform connections
- Shared cross-app contract package (`packages/core`) is empty
- Redis is not yet used beyond connectivity health checks (async queue is Phase 5)
- RAGAS/DeepEval eval datasets are hand-crafted, not captured from live planning runs
