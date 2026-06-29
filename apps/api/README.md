# CortexKitchen API

FastAPI backend for CortexKitchen. Owns the orchestration entrypoints, domain services, DB models, run persistence, exports, chat, observability, and eval suites.

Last updated: June 2026. Phase 6 in progress.

---

## Backend scope

- Multi-tenant JWT authentication (register, login, org-scoped sessions)
- Eleven-node LangGraph planning pipeline with SSE streaming
- Redis plan caching — 1hr TTL, zero LLM cost on cache hits
- PDF export (ReportLab chef brief) and Excel export (openpyxl, multi-sheet workbook)
- RAG chatbot (`/chat`) — AsyncGroq streaming over Postgres run history + feedback
- Observability: OpenTelemetry HTTP tracing, Prometheus `/metrics`, Sentry exception capture
- LangSmith per-node traces + `cortexkitchen-golden-v1` golden dataset (50 runs) with 90% CI gate
- RAGAS + DeepEval quality evals on complaint RAG and critic output
- Data-health and observability summary endpoints
- MCP server (`mcp_server.py`) for Claude Code / Claude Desktop integration

### Phase 6 additions (in progress)

- `SwiggyMCPClient` — JSON-RPC 2.0 client to Swiggy Food / Instamart / Dineout MCP servers
- `BaseConnector` ABC — `sync()` + `enrich()` pattern for all external platform connectors
- Circuit breaker — Redis-backed, per-endpoint; 3 failures / 5 min → 30-min open; `GET /health/circuits`
- Provider registry — `get_provider_async()` combines DB connector status + live circuit state
- Tool call tracing — every `SwiggyMCPClient.call_tool()` logged with status, latency, server tag
- `PlanningMemoryService` — Qdrant long-term memory of approved runs with recency decay (½-life 14 days)
- `SemanticPlanCache` — Qdrant-backed, approved-only, condition-enriched asymmetric embedding
- `SemanticChatCache` — chatbot Q&A cache (0.92 cosine, 24hr TTL)
- Within-session chat memory — 8-turn verbatim window + older-turn compression (no LLM call)
- Chatbot LLM factory — dispatches to AsyncGroq or CometAPI based on `LLM_PROVIDER`

---

## Route surface

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `POST` | `/api/v1/auth/register` | Public | Register user + org |
| `POST` | `/api/v1/auth/login` | Public | JWT access token |
| `GET` | `/api/v1/auth/me` | JWT | Current user profile |
| `GET` | `/api/v1/health` | Public | Liveness |
| `GET` | `/api/v1/health/dependencies` | Public | PostgreSQL / Qdrant / Redis |
| `GET` | `/api/v1/health/circuits` | Public | Swiggy circuit breaker state (open/closed, failures, TTL) |
| `GET` | `/api/v1/planning/scenarios` | Public | Scenario presets |
| `POST` | `/api/v1/planning/run` | JWT | Execute pipeline (full JSON response) |
| `POST` | `/api/v1/planning/stream` | JWT | Execute pipeline (SSE — node_complete events + complete) |
| `POST` | `/api/v1/planning/whatif` | JWT | What-if simulator (no LLM, deterministic) |
| `POST` | `/api/v1/planning/friday-rush` | JWT | Legacy alias |
| `GET` | `/api/v1/runs` | JWT | List runs (org-scoped) |
| `GET` | `/api/v1/runs/{id}` | JWT | Run detail |
| `GET` | `/api/v1/runs/{id}/export` | JWT | PDF chef brief |
| `GET` | `/api/v1/runs/{id}/export/excel` | JWT | Excel workbook |
| `POST` | `/api/v1/chat` | JWT | RAG chatbot (SSE stream) |
| `GET` | `/api/v1/observability/summary` | JWT | 7-day planning stats |
| `GET` | `/api/v1/data-health` | JWT | Database coverage |
| `GET/PATCH` | `/api/v1/settings` | JWT | Org workspace settings |
| `GET/POST` | `/api/v1/restaurant-profiles` | JWT | List / create profiles |
| `GET/PATCH/DELETE` | `/api/v1/restaurant-profiles/{id}` | JWT | Get / update / delete profile |
| `GET` | `/metrics` | Public | Prometheus scrape |
| `GET` | `/debug/sentry-test` | Public | Sentry smoke test (not under /api/v1) |

---

## Active scenario presets

| Id | Label | Service window |
|----|-------|----------------|
| `friday_rush` | Friday Rush | 18:00 – 22:00 |
| `weekday_lunch` | Weekday Lunch | 12:00 – 15:00 |
| `holiday_spike` | Holiday Spike | 17:00 – 22:00 |
| `low_stock_weekend` | Low-Stock Weekend | 18:00 – 22:00 |

---

## Local run

```bash
cd apps/api
python -m venv venv

# Windows
venv\Scripts\activate
# macOS / Linux
source venv/bin/activate

pip install -r requirements.txt
alembic upgrade head
python ..\..\scripts\seed_demo_data.py
python ..\..\scripts\seed_qdrant_memory.py

uvicorn app.main:app --reload
```

API at `http://localhost:8000` · Swagger at `http://localhost:8000/docs`

---

## Configuration (`.env`)

| Variable | Default | Description |
|----------|---------|-------------|
| `APP_ENV` | `local` | Environment tag |
| `POSTGRES_URL` | — | PostgreSQL connection string |
| `QDRANT_URL` | `http://localhost:6333` | Qdrant endpoint |
| `REDIS_URL` | `redis://localhost:6379` | Redis endpoint |
| `LLM_PROVIDER` | `groq` | Primary LLM — `groq` or `gemini` |
| `GROQ_API_KEY` | — | Required for planning and chat |
| `GEMINI_API_KEY` | — | Optional fallback |
| `JWT_SECRET_KEY` | — | HS256 signing key |
| `LANGSMITH_TRACING` | `false` | Enable LangSmith per-node traces |
| `LANGSMITH_API_KEY` | — | LangSmith API key |
| `SENTRY_DSN` | — | Sentry DSN — init is skipped if unset |
| `COMETAPI_KEY` | — | CometAPI key — enables 500+ models via OpenAI-compat endpoint |
| `COMETAPI_MODEL_FAST` | `deepseek-v4-flash` | Fast tier model (demand forecast, reservation, inventory) |
| `COMETAPI_MODEL_BALANCED` | `gemini-3.5-flash` | Balanced tier (complaint intelligence, menu) |
| `COMETAPI_MODEL_STRONG` | `claude-sonnet-4-6` | Strong tier (aggregator, critic) |
| `COMET_TIERED` | `false` | Enable per-node model tier routing (CometAPI only) |
| `SWIGGY_ACCESS_TOKEN` | — | Dev-only Swiggy OAuth token (prod uses `connectors` table) |
| `SWIGGY_ADDRESS_ID` | — | Dev-only Swiggy address ID for sync |

---

## Domain services

| Service | File | Responsibility |
|---------|------|----------------|
| `ForecastService` | `services/forecast_service.py` | Prophet time-series demand forecasting |
| `ReservationService` | `services/reservation_service.py` | Booking density and occupancy risk |
| `ComplaintService` | `services/complaint_service.py` | Qdrant RAG over guest feedback |
| `MenuService` | `services/menu_service.py` | Menu performance and promotion strategy |
| `InventoryService` | `services/inventory_service.py` | Shortage and overstock alerts |
| `CriticService` | `services/critic_service.py` | 5-dimension plan scoring and verdict |
| `ChatService` | `services/chat_service.py` | RAG chatbot — AsyncGroq streaming |
| `RunService` | `services/run_service.py` | Planning run persistence and retrieval |
| `CostAwareScoringService` | `services/cost_aware_scoring.py` | Cost/benefit analysis for critic |
| `EvaluationSanityChecker` | `services/evaluation_sanity.py` | Automated sanity checks + cross-agent assumption diffing; produces `stale_assumptions` for the critic prompt |

---

## Tests

```bash
# Unit + integration
pytest tests/unit -q
pytest tests/integration -q --ignore=tests/integration/test_langgraph_flow.py

# LangSmith regression evals (requires LANGSMITH_API_KEY + GROQ_API_KEY)
python ../../scripts/build_golden_dataset.py
pytest tests/unit/test_langsmith_evals.py -v

# RAGAS + DeepEval quality evals
pytest evals/test_ragas_complaint.py -v -W ignore::DeprecationWarning
pytest evals/test_deepeval_quality.py -v -W ignore::DeprecationWarning
```

---

## MCP server

```bash
python mcp_server.py
```

Exposes `run_planning_scenario` and `get_run_history` as MCP tools. Auto-discovered by Claude Code via `.mcp.json` in the project root. Set `CORTEX_EMAIL` and `CORTEX_PASSWORD` in `.mcp.json` to a registered user.
