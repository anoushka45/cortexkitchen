# CortexKitchen Architecture

Last updated: June 2026. Reflects the implemented codebase (Phase 6 in progress).

---

## Overview

CortexKitchen is a multi-agent restaurant operations intelligence platform. The backend coordinates structured operational data, time-series forecasting, vector retrieval, LLM reasoning, and business-rule validation through an eleven-node LangGraph pipeline. The frontend presents results as a streaming planning dashboard with exports, a RAG chatbot, run history, and observability tooling.

Phase 5 added: SSE streaming, Redis caching, PDF/Excel export, what-if simulator, OpenTelemetry, Prometheus, Sentry, LangSmith regression evals with a golden dataset, multi-tenant workspace isolation (Postgres + Qdrant), a RAG chatbot (`/chat`), and prelaunch UI polish.

Phase 6 (in progress) added: Swiggy MCP integration with BaseConnector pattern, SwiggyMCPClient with circuit breaker and tool tracing, provider registry, PlanningMemoryService (long-term memory with recency decay), SemanticPlanCache (Qdrant-backed, approved-only), within-session chat memory, and per-node model cost attribution.

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
  ├── POST /api/v1/planning/stream       (JWT, SSE — node_start + node_complete + complete events)
  ├── POST /api/v1/planning/whatif       (JWT, deterministic — no LLM)
  ├── GET  /api/v1/runs                  (JWT)
  ├── GET  /api/v1/runs/{id}             (JWT)
  ├── GET  /api/v1/runs/{id}/export       (JWT, PDF)
  ├── GET  /api/v1/runs/{id}/export/excel (JWT, Excel)
  ├── POST /api/v1/chat                  (JWT, SSE stream)
  ├── GET  /api/v1/observability/summary (JWT)
  ├── GET/PATCH /api/v1/settings         (JWT)
  ├── CRUD /api/v1/restaurant-profiles   (JWT)
  ├── GET  /health/circuits              (Swiggy MCP circuit breaker states)
  ├── GET  /metrics                      (Prometheus)
  └── GET  /debug/sentry-test             (not under /api/v1 prefix)
          │
          ▼
LangGraph orchestration graph (eleven nodes)
          │
          ▼
Service and data layer
  ├── PostgreSQL   — structured data + planning_runs audit table (org_id scoped)
  ├── Qdrant       — complaints + SOPs (RAG), planning_memory, semantic_cache, chat_semantic_cache
  ├── Redis        — 1hr TTL plan cache by scenario + date; circuit breaker state per Swiggy endpoint
  └── LLM provider — Groq (default), Gemini (fallback), or CometAPI with per-node tier routing
```

---

## Connector layer (Phase 6)

External platform integrations live in `apps/api/app/infrastructure/swiggy/`. All connectors implement `BaseConnector` (ABC) with two methods:

| Method | When called | DB writes? | On failure |
|--------|------------|------------|------------|
| `sync()` | Nightly APScheduler job | Yes — writes to orders/reservations/feedback | Logged, error_count++ in connectors table |
| `enrich()` | At planning time, before fan-out | No | Returns `None` — node falls back to synthetic data |

**File structure:**
```
infrastructure/swiggy/
  __init__.py
  client.py              — SwiggyMCPClient (JSON-RPC 2.0, httpx, graceful degradation)
  base_connector.py      — BaseConnector ABC (sync + enrich contract)
  swiggy_connector.py    — SwiggyConnector (reference implementation)
  connector_repository.py — ConnectorRepository (DB: token, sync_status, error_count)
  enrichers/             — CompetitorEnricher, OccupancyEnricher, ProcurementEnricher (P6-S06 to S08)
  executor/              — ProcurementExecutor, DineoutExecutor (P6-S14 to S15)

infrastructure/jobs/
  async_runner.py        — Redis-backed async job queue for planning runs (no external job library)
```

**Three Swiggy MCP servers:**
- `https://mcp.swiggy.com/food` — delivery orders, competitor menus
- `https://mcp.swiggy.com/im` — Instamart ingredient procurement
- `https://mcp.swiggy.com/dineout` — table reservations, competitor occupancy

**Token management:** OAuth tokens stored encrypted per `org_id` in the `connectors` table. `SWIGGY_ACCESS_TOKEN` in `.env` is dev-only. Production reads from `ConnectorRepository`.

**Governance layer:**

- **Circuit breaker** (`infrastructure/swiggy/circuit_breaker.py`) — Redis-backed: 3 failures in 5 minutes opens a 30-minute circuit per Swiggy endpoint. `SwiggyMCPClient.call_tool()` checks the circuit before every HTTP call and records failure/success on every result. Endpoint tags: `food`, `im`, `dineout`. Exposed at `GET /health/circuits`.
- **Provider registry** (`infrastructure/swiggy/provider_registry.py`) — routes planning capabilities (`competitor_pricing`, `reservation_data`, `procurement`, `order_history`) to the highest-priority healthy provider. `get_provider_async()` combines DB `sync_status` with live circuit breaker state so a mid-day Swiggy degradation automatically falls through to the next candidate. Currently `swiggy` is the only provider for every capability — the multi-provider architecture stays ready for future connectors (POS systems, review platforms, loyalty/rewards, accounting/inventory tools).
- **Tool tracing** — every `SwiggyMCPClient` call appends a trace dict to `self._traces`; `drain_traces()` returns and clears them for downstream observability. Trace fields: `provider`, `endpoint`, `tool`, `status`, `duration_ms`, `attempt`, `error?`. Status values: `ok`, `circuit_open`, `auth_error`, `http_{code}`, `tool_error`, `exception`.

See D-019 in `docs/DECISIONS.md` for the full design rationale.

---

## Live-intelligence signals (P6-A21+)

Not Swiggy MCP — no consent/compliance gating applies to any of these.
Each is its own independently fail-open service, following the same
graceful-degradation contract as the Swiggy enrichers (`BaseConnector`):
never raise, return `None` on any failure.

- **Weather + holidays** (`infrastructure/external/weather_service.py`) —
  Open-Meteo, free, keyless REST API. `WeatherService.get_forecast(lat, lng,
  target_date)` averages temperature + precipitation probability across the
  target date's 18:00–22:00 dinner window, classifies into
  `heavy_rain`/`light_rain`/`very_hot`/`clear`, and returns a conservative
  `demand_multiplier` alongside descriptive `delivery_impact`/`dinein_impact`
  strings. Holiday lookup (`core/calendar_utils.py`, `get_date_context`) is
  a plain dict scan against `INDIAN_HOLIDAYS_2026` — shared between
  `ScenarioRecommender` and `demand_forecast_node` so the lookup isn't
  duplicated.
- **`demand_forecast_node`** applies both as a deterministic multiplier to
  Prophet's raw `predicted_orders`/`predicted_peak_orders`
  (`ForecastService._apply_signal_adjustments`) — not just narrative prompt
  text. Transparent by construction: `predicted_orders_pre_adjustment`,
  `adjustment_multiplier`, and `adjustment_reasons` are preserved alongside
  the adjusted number.
- **`GET /market/pulse`** returns `weather` and `upcoming_holiday`
  independently of `swiggy_connected` — neither depends on a Swiggy
  connection existing.
- Default coordinates (`core/constants.py`:
  `DEFAULT_RESTAURANT_LAT`/`DEFAULT_RESTAURANT_LNG`, Navi Mumbai) are used
  until `RestaurantProfile` stores real per-restaurant coordinates.
- **Industry trends** (`infrastructure/external/trends_service.py`) —
  `TrendsService.get_digest()` fetches a curated list of Indian F&B/agri-
  business RSS feeds (`feedparser`, free/keyless, zero ToS risk — not
  Google Trends/pytrends, which scrapes a non-public endpoint) and
  summarizes headlines + article summaries into a short digest via the
  existing `create_llm_provider()` factory (no new LLM integration). Cached
  in Redis for 1 hour (news moves slower than Swiggy signals; an LLM call
  isn't free). Prompt is tuned for specificity (a fact + an operational
  implication per bullet) and stays neutral about any named platform rather
  than reading as scrutiny of it.
- **Regulatory alerts** (`infrastructure/external/compliance_alerts_service.py`)
  — `ComplianceAlertsService.get_alerts()` scrapes FSSAI's public
  notifications page (Gazette Notification category — finalized
  regulations, not drafts). Confirmed live: no RSS feed exists, but the page
  is plain server-rendered HTML (a category `<select>` + form reload, no
  JS/AJAX), so a lightweight BeautifulSoup parser is sufficient. Public
  government data — no ToS tension of any kind.
- **`GET /market/pulse`** also returns `industry_trends` and
  `compliance_alerts` independently of `swiggy_connected` — same treatment
  as weather/holidays.

**Unification (P6-A24)** — all four signals merge into one "Area & Live
Signals" text inside the existing `market_intel_node`/`MarketIntelService`
(`MarketIntelService._build_live_signals_text`), rather than a new graph
node. Existing state field names (`swiggy_competitor_context`,
`swiggy_occupancy_context`, `market_intel_output`) are unchanged — only a
new `market_intel_output["live_signals_text"]` key was added — since 5+
files and the frontend already read the old names by string key.
`weather_signal`/`trends_signal`/`compliance_alerts_signal` are fetched once
by `demand_forecast_node` (it runs before the `qdrant_enrichment` fan-out,
so it can't read `market_intel_output`) and injected directly into its own
LLM narrative (`ForecastService.analyse_and_recommend`, text-only for
trends/compliance — only weather shifts the actual number);
`market_intel_node` reads the same three back from state rather than
re-fetching, and merges them with the Swiggy competitor/occupancy prompt
text into `live_signals_text`, which `menu_intelligence` (via
`MenuService.analyse_and_recommend`'s `market_context`) and the critic (via
`aggregator.py`'s `_build_critic_summary`, a condensed `[Live Signals]`
line — the full prose is menu_intelligence's job, not the critic's) both
read. Each of the five sources (competitor, occupancy, weather, trends,
compliance) stays independently optional through this whole chain — any
subset being `None` (simulated per-source failure) never blocks the others
or raises.

---

## Scenario intake modes (P6-A25)

Full detail in `docs/PRODUCT_MODES.md`. Summary: `ops_manager_node` needs a
`scenario_profile` (`label`/`service_window`/`operational_focus`) regardless
of source. Two intake modes feed it, both converging on the same downstream
pipeline:

1. **Presets** (unchanged) — `scenario` is one of the 4
   `SCENARIO_DEFINITIONS` keys, `ops_manager_node` resolves via
   `get_scenario_definition()`.
2. **Natural language** (new) — free text goes to
   `POST /planning/scenario-from-text` (`ScenarioProfileService`, an LLM call
   with a deterministic fallback, same never-raise pattern as
   `ScenarioRecommender`), returning a fully-populated profile the frontend
   sends back as `custom_profile` alongside a non-preset `scenario` id (e.g.
   `"custom"`). `ops_manager_node` builds `scenario_profile` from that
   instead. `custom_profile` is a new `OrchestratorState` field, threaded
   through `make_initial_state`/`run_planning_scenario`/
   `stream_planning_scenario`, and bypasses both the semantic cache and the
   Redis plan cache (two different free-text descriptions would otherwise
   collide on the same cache key).

`ScenarioProfileService` always fills all three profile keys even in its
fallback path, since `complaint_service.py`/`inventory_service.py`/
`reservation_service.py` read them via direct dict-key access (not `.get()`)
once `scenario_profile` is truthy.

Frontend: the 4 preset tiles and the free-text input live side by side in
`PlanShiftModal.tsx` (`SCENARIO_OPTIONS`, previously duplicated verbatim in
`app/dashboard/page.tsx` and `TodayIdleState.tsx`, now a single shared
constant in `lib/scenarios.ts`).

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
    ▼
qdrant_enrichment       ← retrieves past approved-run insights, injects past_plans into shared_context
    │
    ├─────────────────────┬──────────────────────┐
    ▼                     ▼                      ▼
reservation      complaint_intelligence       inventory
    └──────────────────────┼──────────────────────┘
                           ▼
                   menu_intelligence   ← sequential after all 3; LangGraph fan-in fires exactly once
                           │
                           ▼
                       aggregator
                           │
                           ▼
                         critic
                           │
         ┌─────────────────┴──────────────────────┐
    (approved or                           (revision, replan_count < 2)
     replan_count ≥ 2)                            │
         ▼                                        ▼
   final_assembler                      replan_orchestrator ← injects critic feedback, max 2 cycles
         │                                        │
        END                              aggregator (loop)
```

**Conditional routing:** after `ops_manager`, if `state["error"]` is set the graph skips to `final_assembler`. Otherwise it proceeds through `demand_forecast`.

**Parallel execution:** three domain nodes (`reservation`, `complaint_intelligence`, `inventory`) fan out in parallel after `qdrant_enrichment`. `menu_intelligence` runs sequentially after all three complete — via LangGraph's native fan-in — so it can read inventory shortage data and reservation pressure before forming menu recommendations.

**New pipeline nodes (Phase 6):**

- `qdrant_enrichment` — runs after `demand_forecast`. Calls `PlanningMemoryService.retrieve()` to fetch the top-3 similar past approved-run insights from the `planning_memory` Qdrant collection, re-ranked with recency decay (`score × 2^(-age/14days)`), excluding runs older than 90 days. Injects `shared_context["past_plans"]`. Falls back to an empty list on any error — never blocks a run.
- `replan_orchestrator` — sits between `aggregator` and `critic`. If the critic returned a `revision` verdict in a prior cycle, this node injects the critic's structured feedback into `state["replan_context"]`. Enforces a maximum of 2 replan cycles — after that it passes through regardless of verdict to prevent infinite loops.

**SSE streaming:** There are two distinct streaming mechanisms:

- `POST /api/v1/planning/stream` — the planning SSE endpoint. Emits **both `node_start` and `node_complete` events** per node. `node_start` includes a `hint` describing what the node is doing; `node_complete` includes a `hint` with the completion summary. The frontend loading screen uses these to drive a 4-state diagram (idle / running / done / skipped). A final `complete` event delivers the entire plan payload. `POST /api/v1/planning/run` is the non-streaming equivalent.
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
| `ChatService` | RAG chatbot — retrieves from Postgres runs + Feedback table; streams via LLM factory |
| `RunService` | Persists planning runs to `planning_runs`; powers the runs API |
| `CostAwareScoringService` | Cost/benefit pressure score used by the critic |
| `EvaluationSanityChecker` | Automated sanity checks + cross-agent assumption diffing in critic evaluation |
| `PlanningMemoryService` | Stores approved run insights in Qdrant (`planning_memory`) with recency decay; retrieved by `qdrant_enrichment` to enrich planning context with similar past runs |

### Redis caching

Redis serves two purposes in CortexKitchen:

**Plan cache:** planning runs are cached by `(org_id, scenario, target_date)` key with a 1-hour TTL. **Only `approved` verdict plans are written to cache** — revision and rejected plans are not stored. On a cache hit, the full plan is returned immediately — zero LLM cost, zero pipeline execution. The response includes a `cache_hit: true` flag. Cache invalidation happens automatically on TTL expiry.

**Circuit breaker state:** per-Swiggy-endpoint failure counters (`circuit:fail:swiggy:{tag}`, 300s TTL) and open flags (`circuit:open:swiggy:{tag}`, 1800s TTL) are stored in Redis. These auto-expire so circuits reset without any manual intervention. `GET /health/circuits` reads these keys to return real-time state for all three Swiggy endpoints.

In addition, a **Qdrant-backed SemanticPlanCache** (`semantic_cache` collection, 0.92 cosine similarity, 1hr TTL) provides fuzzy plan retrieval for queries where an exact cache key match doesn't exist but a semantically similar approved plan does. The storage embedding is enriched with actual run conditions (demand_ratio, occupancy, shortages) at write time while the query embedding stays lightweight.

### Export layer

- **PDF** — `apps/api/app/infrastructure/pdf/report_generator.py` uses ReportLab to generate a structured chef brief with plan summary, agent outputs, critic verdict, dimension scores bar chart, and action items.
- **Excel** — `apps/api/app/infrastructure/excel/report_generator.py` uses openpyxl to produce a multi-sheet workbook: Summary, Inventory & Staffing (chef view), Cost Breakdown (owner view).

### RAG chatbot

`POST /api/v1/chat` accepts a message + conversation history and returns a streamed response via SSE.

- **Retrieval:** queries the last 10 `planning_runs` (org-scoped) and the last 30 `feedback` records (no org filter — shared demo dataset) to build a context window
- **LLM:** `_get_chat_client(settings)` factory — dispatches on `LLM_PROVIDER`. Routes to `AsyncGroq` (`llama-3.3-70b-versatile`) when `LLM_PROVIDER=groq`, or `AsyncOpenAI` against the CometAPI fast tier otherwise.
- **Within-session memory:** when `len(history) > 8`, older turns are compressed by `SessionMemoryService.build_summary_from_messages()` (no LLM call) and injected as a single `[Earlier in this session: ...]` assistant message. The last 8 turns are included verbatim so long conversations maintain continuity without blowing the token window.
- **Semantic cache:** `SemanticChatCache` (Qdrant collection `chat_semantic_cache`, 0.92 threshold, 24hr TTL) returns cached answers for semantically similar questions asked by the same org.
- **Frontend:** ReactMarkdown renders structured responses; multi-turn memory via message history in request body

### Infrastructure layer

| Module | Responsibility |
|--------|----------------|
| `db/models.py` | SQLAlchemy ORM — `users`, `organizations`, `user_organizations`, `restaurant_profiles`, `planning_runs`, `decision_logs`, `feedback`, `orders`, `reservations`, `inventory`, `menu_items` |
| `db/base.py` | SQLAlchemy `DeclarativeBase` — all ORM models inherit from this; Alembic reads `Base.metadata` |
| `api/dependencies.py` | `get_db()` session factory + FastAPI dependency provider for auth, LLM, memory, and orchestration |
| `llm/base.py` | `BaseLLMProvider` ABC — `complete()`, `complete_json()`, thread-safe usage tracking |
| `llm/factory.py` | `FallbackLLMProvider` + `create_llm_provider()` — reads `LLM_PROVIDER`, wires fallback |
| `llm/groq.py` | `GroqProvider` — groq SDK |
| `llm/gemini.py` | `GeminiProvider` — google-genai SDK |
| `llm/comet.py` | `CometProvider` — AsyncOpenAI SDK pointed at CometAPI (`api.cometapi.com/v1`); supports any of 500+ models via a single key |
| `llm/prompt_utils.py` | Centralised prompt builders for all agents — zero raw prompt strings in service files |
| `forecasting/` | Prophet-backed time-series forecaster |
| `vector/memory_service.py` | `MemoryService` and `EmbeddingService` for Qdrant retrieval with org payload filter |
| `vector/planning_memory.py` | `PlanningMemoryService` — approved run insights in Qdrant `planning_memory` with recency decay scoring |
| `cache/plan_cache.py` | Redis plan cache — `get_cached_plan` / `cache_plan` / `build_cache_key` by composite key |
| `cache/semantic_cache.py` | `SemanticPlanCache` (Qdrant-backed, approved-only, condition-enriched storage embedding) and `SemanticChatCache` (Q&A cache, 24hr TTL) |
| `swiggy/circuit_breaker.py` | Redis-backed circuit breaker — `is_open`, `record_failure`, `record_success`, `get_state` per provider + endpoint |
| `swiggy/provider_registry.py` | `ProviderRegistry` — capability-to-provider routing combining DB `sync_status` and live circuit breaker state |
| `observability/dependency_health.py` | PostgreSQL, Qdrant, Redis connectivity checks; `check_swiggy_circuits()` for circuit breaker health |
| `main.py` (OTel + Prometheus) | OpenTelemetry `ConsoleSpanExporter` and `prometheus_fastapi_instrumentator` wired directly in app startup |

### LLM provider abstraction

All agents depend on `BaseLLMProvider`, never on a concrete class. On any LLM exception the `FallbackLLMProvider` logs `llm_primary_failed_retrying_fallback` and transparently retries on the secondary provider. The provider used is surfaced in structlog output and in planning run metadata.

### Per-node model tier routing

When `LLM_PROVIDER=comet` and `COMET_TIERED=true`, the factory builds a tier-keyed `llm_registry` of `FallbackLLMProvider` instances and injects it into `OrchestratorState`. Each node reads its assigned tier from state and substitutes the tier provider for the default flat provider.

| Tier | Model | Assigned nodes | Fallback |
|------|-------|----------------|---------|
| `fast` | `deepseek-v4-flash` | demand_forecast, inventory, reservation | — |
| `balanced` | `gemini-3.5-flash` | complaint_intelligence, menu_intelligence | fast |
| `strong` | `claude-sonnet-4-6` | critic | balanced |

The lookup pattern used in every node is `(state.get("llm_registry") or {}).get("<tier>") or llm` — if the registry is absent (flat mode or Groq/Gemini), the injected default `llm` is used unchanged. Backward compatibility is total.

All tier provider usage is drained at the end of each run and merged into the `llm_usage` array, so cost tracking across models is accurate and per-model visible in every planning run's metadata.

`create_tiered_llm_providers()` in `factory.py` is the single construction point. Model names are fully configurable via `COMETAPI_MODEL_FAST`, `COMETAPI_MODEL_BALANCED`, and `COMETAPI_MODEL_STRONG` env vars — swapping models requires no code changes.

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

`scripts/build_golden_dataset.py` (root `scripts/` folder) builds the `cortexkitchen-golden-v1` dataset from historical planning runs. The CI gate (`tests/unit/test_langsmith_evals.py`) runs evaluators against a local JSON fixture and requires a 90% pass rate to succeed.

---

## MCP server

`apps/api/mcp_server.py` is a stdio MCP server (Anthropic MCP SDK) exposing five tools:

| Tool | Description |
|------|-------------|
| `run_planning_scenario` | Triggers the full 11-node planning pipeline |
| `get_run_history` | Fetches recent planning runs with optional scenario/verdict filters |
| `get_market_brief` (P6-A13) | Live market snapshot — category pricing, positioning, deals, area occupancy |
| `get_action_queue` (P6-A13) | Lists pending (or other-status) Action Queue items |
| `approve_action` (P6-A13) | Approves an action by ID — for a WhatsApp vendor order, this is the same step that sends the message |

All five call the CortexKitchen API directly (`GET /market/pulse`, `GET /action-queue`, `POST /action-queue/{id}/approve`), so an owner can ask Claude Desktop about their restaurant and approve actions without opening the CortexKitchen app at all — the same 3 capabilities are also exposed as in-app chatbot tools (`app/domain/services/chat_service.py`), sharing the same backend services (`ActionQueueService`, `action_execution_service.approve_and_execute`) so both surfaces behave identically.

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
5. Each node emits `node_start` (with hint) and `node_complete` (with completion hint) as it begins/finishes; loading screen diagram drives 4-state UI per node
6. `ops_manager` → `demand_forecast` → `qdrant_enrichment` → [3 parallel nodes: reservation, complaint_intelligence, inventory] → `menu_intelligence` → `aggregator` → `critic` → [replan_orchestrator loop] → `final_assembler`
7. Final response includes plan, critic verdict, RAG context, cost metadata, and node traces
8. Run is persisted to `planning_runs`; result is stored in Redis cache

---

## Storage roles

| Store | Role |
|-------|------|
| **PostgreSQL** | All structured data: orders, reservations, feedback, inventory, menu_items, planning_runs, organizations, users, restaurant_profiles, connectors |
| **Qdrant** | `complaints_memory` and `sop_memory` — RAG retrieval, org-scoped payload filters |
| **Qdrant** | `planning_memory` — approved run insights with recency decay, used by `qdrant_enrichment` |
| **Qdrant** | `semantic_cache` — plan cache (0.92 cosine threshold, approved-only, 1hr TTL, condition-enriched storage embedding) |
| **Qdrant** | `chat_semantic_cache` — chatbot Q&A cache (0.92 threshold, 24hr TTL) |
| **Redis** | Plan cache — 1hr TTL by `(org_id, scenario, target_date)`; circuit breaker state per Swiggy endpoint |

---

## Cross-agent assumption diffing

Three domain nodes run in parallel (`reservation`, `complaint_intelligence`, `inventory`). `menu_intelligence` runs sequentially after all three via LangGraph fan-in. This means when the parallel nodes execute, they do so without knowledge of each other's results — but menu_intelligence does have access to all three outputs. However, a node can still make recommendations based on assumptions that are silently contradicted by another parallel node's findings.

To catch these contradictions automatically, each domain node writes an `assumptions` dict to shared state after its service call. The aggregator collects these into `bundle["assumptions"]`. When the critic node invokes `EvaluationSanityChecker.check_bundle()`, the checker diffs the assumptions cross-agent and returns a `stale_assumptions` list alongside the existing `issues` list.

**Diffs implemented (3 active):**

| Assumption | Checked against | Conflict |
|------------|-----------------|---------|
| `menu.assumed_covers_within_capacity = True` | `reservation.assumed_peak_occupancy_pct > 90` | Menu recommendations don't account for near-full-house throughput pressure |
| `reservation.assumed_peak_occupancy_pct > 85` | Forecast `confidence` or `confidence_band` indicating weak signal | High-occupancy planning on a weak forecast overstates certainty |
| `complaint.assumed_high_complaint_volume = False` | `complaint.assumed_negative_pct > 25` | Complaint node flagged volume as low but negative feedback is borderline elevated |

Note: an earlier Diff checking `menu.assumed_no_active_stockouts` against `inventory.items_flagged_low` was removed. `MenuService` self-queries `InventoryService` directly when `inventory_data=None` — both nodes use the same demand ratio and DB, so they always agree on shortage status regardless of execution order. See D-017 in DECISIONS.md.

The `stale_assumptions` list is injected into the critic's LLM prompt as a dedicated `## Cross-agent assumption conflicts` section. This gives the LLM concrete *why* reasoning about each inconsistency rather than requiring it to detect contradictions from raw data alone.

If a node errored and its `assumptions` dict is `None`, the checker gracefully skips diffing for that node.

---

## Architectural strengths

- Parallel fan-out across three domain agents (reservation, complaint, inventory) reduces pipeline latency; menu_intelligence runs sequentially after with access to their combined outputs, eliminating menu/inventory contradictions; AsyncOpenAI ensures the fan-out is truly concurrent, not serialised by event-loop blocking
- Per-node model tier routing — simple nodes get fast cheap models, the critic gets the strongest model; all via a single CometAPI key with no code changes to swap models
- SSE streaming makes every planning run feel interactive — results arrive node by node
- Redis cache eliminates repeat LLM cost for the same scenario on the same day
- Prompts centralized in `prompt_utils.py` — zero raw strings in service files
- RAG grounds complaint recommendations in real past guest issues, not generic LLM output
- Full tenant isolation at Postgres, Qdrant, and state levels
- LangSmith golden dataset + CI gate prevents quality regressions from shipping
- Sentry + OTel + Prometheus give three overlapping observability layers
- Cross-agent assumption diffing in `EvaluationSanityChecker` automatically surfaces contradictions between parallel nodes — scales to any number of agent pairs without enumerating every possible contradiction (see D-017)
- PlanningMemoryService provides long-term institutional memory — approved runs accumulate insight vectors in Qdrant; recency decay ensures recent context ranks higher without staling indefinitely
- Circuit breaker + provider registry give the Swiggy integration production-grade resilience — mid-day failures auto-route to fallback providers without operator intervention
- SemanticPlanCache (Qdrant-backed, approved-only) complements the Redis exact-match cache with fuzzy retrieval for scenarios with similar but not identical conditions

## Current limitations

- Live Swiggy MCP integration underway (Phase 6) — BaseConnector, SwiggyMCPClient, CompetitorEnricher, OccupancyEnricher, ProcurementEnricher, ProcurementExecutor, and DineoutExecutor implemented; nightly sync (P6-S01/S02/S03) complete; market intel and dineout management nodes (P6-S10/S11) pending
- `packages/core` shared contract package is empty
- RAGAS/DeepEval datasets are hand-crafted — should be rebuilt from live planning runs periodically
