# CortexKitchen Architecture

Last updated: June 2026. Reflects the implemented codebase (Phase 5 complete).

---

## Overview

CortexKitchen is a multi-agent restaurant operations intelligence platform. The backend coordinates structured operational data, time-series forecasting, vector retrieval, LLM reasoning, and business-rule validation through a nine-node LangGraph pipeline. The frontend presents results as a streaming planning dashboard with exports, a RAG chatbot, run history, and observability tooling.

Phase 5 added: SSE streaming, Redis caching, PDF/Excel export, what-if simulator, OpenTelemetry, Prometheus, Sentry, LangSmith regression evals with a golden dataset, multi-tenant workspace isolation (Postgres + Qdrant), a RAG chatbot (`/chat`), and prelaunch UI polish.

---

## System shape

```
Claude Code / Claude Desktop
  │  MCP stdio protocol
  ▼
mcp_server.py
  │
  │  HTTP (JWT) + SSE
  ▼
Next.js UI (App Router)
  ├── /            — public homepage
  ├── /login       — auth
  ├── /register    — workspace creation
  ├── /dashboard   — planning, streaming, what-if
  ├── /runs        — audit trail, exports
  ├── /chat        — RAG chatbot (Ask AI)
  ├── /data-health — database coverage + observability
  ├── /settings    — tenant config
  └── /restaurant-profiles
          │
          │  HTTP (JSON + SSE) + JWT
          ▼
FastAPI application
  ├── POST /api/v1/auth/register
  ├── POST /api/v1/auth/login
  ├── GET  /api/v1/health
  ├── GET  /api/v1/health/dependencies
  ├── GET  /api/v1/planning/scenarios
  ├── POST /api/v1/planning/run          (JWT, full JSON)
  ├── POST /api/v1/planning/stream       (JWT, SSE — node_complete + complete events)
  ├── GET  /api/v1/runs                  (JWT)
  ├── GET  /api/v1/runs/{id}             (JWT)
  ├── GET  /api/v1/runs/{id}/export       (JWT, PDF)
  ├── GET  /api/v1/runs/{id}/export/excel (JWT, Excel)
  ├── POST /api/v1/chat                  (JWT, SSE stream)
  ├── GET  /api/v1/observability/summary (JWT)
  ├── GET/PATCH /api/v1/settings         (JWT)
  ├── CRUD /api/v1/restaurant-profiles   (JWT)
  ├── GET  /metrics                      (Prometheus)
  └── GET  /api/v1/debug/sentry-test
          │
          ▼
LangGraph orchestration graph (nine nodes)
          │
          ▼
Service and data layer
  ├── PostgreSQL   — structured data + planning_runs audit table (org_id scoped)
  ├── Qdrant       — complaints + SOPs, org payload filter per tenant
  ├── Redis        — 1hr TTL plan cache by scenario + date
  └── LLM provider — Groq llama-3.3-70b (default) or Gemini, auto-fallback
```

---

## Backend architecture

### API layer

The FastAPI application (`apps/api`) exposes all routes under `/api/v1`. Routes are split across modules:

- `app/api/routes/auth.py` — register, login, `/auth/me`
- `app/api/routes/planning.py` — scenario listing, `/run` (JSON), `/stream` (SSE), `/whatif`
- `app/api/routes/runs.py` — audit run list, run detail, PDF export, Excel export, data-health, observability summary
- `app/api/routes/chat.py` — RAG chatbot SSE endpoint
- `app/api/routes/settings.py` — tenant org settings
- `app/api/routes/restaurant_profiles.py` — restaurant profile CRUD

Schemas (Pydantic request/response models) are in `app/api/schemas/`.

### Auth

JWT (HS256) authentication in `app/core/auth.py`. All planning, data, chat, and export routes are protected via `get_current_user`. Every planning run and chat session is stamped with `org_id` for tenant isolation.

Registration creates a user + org in one step. The `user_organizations` join table tracks membership and roles (owner / member).

### Orchestration layer

The planning pipeline is a LangGraph `StateGraph` in `app/orchestration/graph.py`:

```
ops_manager
    │
    ├── (error) → final_assembler → END
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
                      final_assembler → END
```

**Conditional routing:** after `ops_manager`, if `state["error"]` is set the graph skips to `final_assembler`. Otherwise it proceeds through `demand_forecast`.

**Parallel execution:** the four domain nodes (`reservation`, `complaint_intel`, `menu_intel`, `inventory`) fan out in parallel after `demand_forecast` and are gated by `aggregator`.

**SSE streaming:** There are two distinct streaming mechanisms:

- `POST /api/v1/planning/stream` — the planning SSE endpoint. Emits `node_complete` events as each LangGraph node finishes; each event carries only the node name (`{"node": "forecast"}`). The frontend loading screen uses these to update the pipeline diagram in real time. A final `complete` event delivers the entire plan payload — the dashboard renders all sections at once from this single event. `POST /api/v1/planning/run` is the non-streaming equivalent, returning the full JSON response in one go.
- `POST /api/v1/chat` — the chat SSE endpoint. Streams individual tokens word-by-word (`{"token": "..."}`), rendered progressively via ReactMarkdown. Completely separate from the planning SSE.

**Per-node tracing:** every node emits `node_start` / `node_end` structlog events with `duration_ms`, `llm_provider_used`, and `llm_fallback_used`. When LangSmith tracing is enabled (`LANGSMITH_TRACING=true`), each node also sends a trace span.

### Domain services

| Service | Responsibility |
|---------|----------------|
| `ForecastService` | Queries historical orders, runs Prophet time-series, produces demand signal |
| `ReservationService` | Analyses booking density and occupancy risk |
| `ComplaintService` | Retrieves complaint patterns from Qdrant; RAG context feeds the LLM prompt |
| `MenuService` | Evaluates top and weak menu items; surfaces promotion guidance |
| `InventoryService` | Computes shortage and overstock alerts from stock vs threshold |
| `CriticService` | Validates the aggregated plan; scores across 5 dimensions |
| `ChatService` | RAG chatbot — retrieves from Postgres runs + Feedback table; streams via AsyncGroq |
| `RunService` | Persists planning runs to `planning_runs`; powers the runs API |
| `CostAwareScoringService` | Cost/benefit pressure score used by the critic |
| `EvaluationSanityChecker` | Automated sanity checks in critic evaluation |

### Redis caching

Planning runs are cached in Redis by `(org_id, scenario, target_date)` key with a 1-hour TTL. **Only `approved` verdict plans are written to cache** — revision and rejected plans are not stored. On a cache hit, the full plan is returned immediately — zero LLM cost, zero pipeline execution. The response includes a `cache_hit: true` flag. Cache invalidation happens automatically on TTL expiry.

### Export layer

- **PDF** — `apps/api/app/infrastructure/exports/pdf_exporter.py` uses ReportLab to generate a structured chef brief with plan summary, agent outputs, critic verdict, dimension scores bar chart, and action items.
- **Excel** — `apps/api/app/infrastructure/exports/excel_exporter.py` uses openpyxl to produce a multi-sheet workbook: Summary, Inventory & Staffing (chef view), Cost Breakdown (owner view).

### RAG chatbot

`POST /api/v1/chat` accepts a message + conversation history and returns a streamed response via SSE.

- **Retrieval:** queries the last 10 `planning_runs` (org-scoped) and the last 30 `feedback` records (no org filter — shared demo dataset) to build a context window
- **LLM:** AsyncGroq `llama-3.3-70b-versatile` for streaming token output
- **Frontend:** ReactMarkdown renders structured responses; multi-turn memory via message history in request body

### Infrastructure layer

| Module | Responsibility |
|--------|----------------|
| `db/models.py` | SQLAlchemy ORM — `users`, `organizations`, `user_organizations`, `restaurant_profiles`, `planning_runs`, `decision_logs`, `feedback`, `orders`, `reservations`, `inventory`, `menu_items` |
| `db/session.py` | Session factory and FastAPI dependency |
| `llm/base.py` | `BaseLLMProvider` ABC — `complete()`, `complete_json()`, thread-safe usage tracking |
| `llm/factory.py` | `FallbackLLMProvider` + `create_llm_provider()` — reads `LLM_PROVIDER`, wires fallback |
| `llm/groq.py` | `GroqProvider` — groq SDK |
| `llm/gemini.py` | `GeminiProvider` — google-genai SDK |
| `llm/prompt_utils.py` | Centralised prompt builders for all agents — zero raw prompt strings in service files |
| `forecasting/` | Prophet-backed time-series forecaster |
| `vector/memory_service.py` | `MemoryService` and `EmbeddingService` for Qdrant retrieval with org payload filter |
| `cache/redis_cache.py` | Redis plan cache — get/set/invalidate by composite key |
| `observability/dependency_health.py` | PostgreSQL, Qdrant, Redis connectivity checks |
| `observability/metrics.py` | Prometheus instrumentation — request count, latency histograms |
| `observability/otel.py` | OpenTelemetry HTTP tracing setup |

### LLM provider abstraction

All agents depend on `BaseLLMProvider`, never on a concrete class. On any LLM exception the `FallbackLLMProvider` logs `llm_primary_failed_retrying_fallback` and transparently retries on the secondary provider. The provider used is surfaced in structlog output and in planning run metadata.

---

## Observability stack

| Tool | What it covers |
|------|----------------|
| **LangSmith** | Per-node traces when `LANGSMITH_API_KEY` set; `cortexkitchen-golden-v1` dataset (50 runs); CI gate in `tests/unit/test_langsmith_evals.py` (local fixture, 90% pass rate) |
| **OpenTelemetry** | HTTP request tracing via `ConsoleSpanExporter` (swap for OTLP exporter in production) |
| **Prometheus** | `/metrics` scrape endpoint — request count, latency histograms, error rate |
| **Sentry** | Unhandled exception capture with FastAPI integration; `capture_exception` in LangGraph node wrappers; DSN-gated init |
| **structlog** | JSON log output across all nodes — `node`, `run_id`, `scenario`, `duration_ms`, `llm_provider_used` on every event |
| **LLM cost tracking** | `record_usage()` on every LLM call; aggregated `total_tokens`, `total_cost_usd` persisted in `planning_runs.metadata` |

---

## Multi-tenant isolation

Tenant isolation is enforced at three levels:

1. **PostgreSQL** — all run queries filter by `org_id` from the JWT; restaurant profiles and settings are org-scoped
2. **Qdrant** — complaint and SOP vectors use a payload filter `{"org_id": current_org_id}` on every retrieval call
3. **OrchestratorState** — `org_id` is carried in shared state so every node operates in the correct tenant context

---

## LangSmith regression evals

`scripts/build_golden_dataset.py` builds the `cortexkitchen-golden-v1` dataset from historical planning runs across all four scenarios. The CI gate (`evals/test_langsmith_regression.py`) runs automated evaluators against this dataset and requires a 90% pass rate to succeed.

---

## MCP server

`apps/api/mcp_server.py` is a stdio MCP server (Anthropic MCP SDK) exposing two tools:

| Tool | Description |
|------|-------------|
| `run_planning_scenario` | Triggers the full 9-node planning pipeline |
| `get_run_history` | Fetches recent planning runs with optional scenario/verdict filters |

Claude Code discovers the server automatically via `.mcp.json`. Claude Desktop uses `docs/mcp_claude_desktop_config.json`.

---

## LLM quality evaluations

| Suite | File | Metrics | Threshold |
|-------|------|---------|-----------|
| LangSmith regression | `tests/unit/test_langsmith_evals.py` | Pass rate against local fixture (`golden_runs.json`) | ≥ 90% |
| RAGAS | `evals/test_ragas_complaint.py` | Faithfulness, context precision on complaint RAG (answer_relevancy excluded — requires embeddings) | Faithfulness ≥ 0.8 |
| DeepEval | `evals/test_deepeval_quality.py` | HallucinationMetric on critic, AnswerRelevancyMetric on agents | Hallucination ≤ 0.5; Relevancy ≥ 0.7 |

---

## Frontend architecture

The frontend (`apps/web/cortexkitchen-ui`) is a Next.js App Router application with JWT cookie auth.

### Pages

| Route | Purpose |
|-------|---------|
| `/` | Public marketing homepage — pipeline explainer, features, footer |
| `/login`, `/register` | JWT auth flow |
| `/dashboard` | Scenario selection, SSE streaming run, full plan, what-if simulator |
| `/runs` | Audit trail — scenario filter, date range, critic score trend, run detail, PDF/Excel export |
| `/chat` | Ask AI — RAG chatbot with suggested questions and streamed responses |
| `/data-health` | Database coverage table + observability panel (7-day stats) |
| `/settings` | Workspace config — capacity, cuisine, peak hours, thresholds |
| `/restaurant-profiles` | Named restaurant profiles (owner only) |

### Key components

| Component | Purpose |
|-----------|---------|
| `NavBar` | Sticky app nav with scenario selector, History button, Ask AI link, user dropdown |
| `Footer` | Public marketing footer — Product / Resources / Company / Legal columns; homepage only |
| `HomeNav` | Public nav for the marketing homepage |
| `ForecastChart` | Demand forecast bar/line chart with Recharts |
| `DashboardContext` | Shared state for scenario, run status, history drawer |

### Streaming

The dashboard uses `fetch` with a `ReadableStream` reader against `/api/v1/planning/stream`. Each `node_complete` event carries only the node name — the loading screen pipeline diagram updates in real time. The full plan renders all at once when the final `complete` event arrives.

The chat page streams against `/api/v1/chat` — individual tokens arrive word-by-word and render progressively via ReactMarkdown. A separate mechanism from the planning SSE.

---

## Data flow — planning run

1. User selects scenario and submits from the dashboard
2. Frontend opens an SSE connection to `POST /api/v1/planning/stream` with JWT
3. FastAPI resolves `get_current_user`, checks Redis cache — emits all node events instantly and returns on hit
4. On cache miss: loads org settings + restaurant profile, builds LangGraph graph, invokes it
5. Each node emits a `node_complete` event (node name only) as it finishes; loading screen diagram updates
6. `ops_manager` → `demand_forecast` → [4 parallel nodes] → `aggregator` → `critic` → `final_assembler`
7. Final response includes plan, critic verdict, RAG context, cost metadata, and node traces
8. Run is persisted to `planning_runs`; result is stored in Redis cache

---

## Storage roles

| Store | Role |
|-------|------|
| **PostgreSQL** | All structured data: orders, reservations, feedback, inventory, menu_items, planning_runs, organizations, users, restaurant_profiles |
| **Qdrant** | `complaints_memory` and `sop_memory` collections for RAG retrieval, org-scoped payload filters |
| **Redis** | Plan cache — 1hr TTL by `(org_id, scenario, target_date)` |

---

## Architectural strengths

- Parallel fan-out across four domain agents reduces pipeline latency
- SSE streaming makes every planning run feel interactive — results arrive node by node
- Redis cache eliminates repeat LLM cost for the same scenario on the same day
- Prompts centralized in `prompt_utils.py` — zero raw strings in service files
- RAG grounds complaint recommendations in real past guest issues, not generic LLM output
- Full tenant isolation at Postgres, Qdrant, and state levels
- LangSmith golden dataset + CI gate prevents quality regressions from shipping
- Sentry + OTel + Prometheus give three overlapping observability layers

## Current limitations

- All data integrations are synthetic — no live POS or platform connections
- `packages/core` shared contract package is empty
- RAGAS/DeepEval datasets are hand-crafted — should be rebuilt from live planning runs periodically
