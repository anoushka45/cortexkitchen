# CortexKitchen API

FastAPI backend for CortexKitchen. Owns the orchestration entrypoints, domain services, DB models, run persistence, exports, chat, observability, and eval suites.

Last updated: June 2026. Phase 5 complete.

---

## Backend scope

- Multi-tenant JWT authentication (register, login, org-scoped sessions)
- Nine-node LangGraph planning pipeline with SSE streaming
- Redis plan caching — 1hr TTL, zero LLM cost on cache hits
- PDF export (ReportLab chef brief) and Excel export (openpyxl, multi-sheet workbook)
- RAG chatbot (`/chat`) — AsyncGroq streaming over Postgres run history + feedback
- Observability: OpenTelemetry HTTP tracing, Prometheus `/metrics`, Sentry exception capture
- LangSmith per-node traces + `cortexkitchen-golden-v1` golden dataset (50 runs) with 90% CI gate
- RAGAS + DeepEval quality evals on complaint RAG and critic output
- Data-health and observability summary endpoints
- MCP server (`mcp_server.py`) for Claude Code / Claude Desktop integration

---

## Route surface

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `POST` | `/api/v1/auth/register` | Public | Register user + org |
| `POST` | `/api/v1/auth/login` | Public | JWT access token |
| `GET` | `/api/v1/auth/me` | JWT | Current user profile |
| `GET` | `/api/v1/health` | Public | Liveness |
| `GET` | `/api/v1/health/dependencies` | Public | PostgreSQL / Qdrant / Redis |
| `GET` | `/api/v1/planning/scenarios` | Public | Scenario presets |
| `POST` | `/api/v1/planning/run` | JWT | Execute pipeline (SSE stream) |
| `POST` | `/api/v1/planning/friday-rush` | JWT | Legacy alias |
| `GET` | `/api/v1/runs` | JWT | List runs (org-scoped) |
| `GET` | `/api/v1/runs/{id}` | JWT | Run detail |
| `GET` | `/api/v1/runs/{id}/export/pdf` | JWT | PDF chef brief |
| `GET` | `/api/v1/runs/{id}/export/excel` | JWT | Excel workbook |
| `POST` | `/api/v1/chat` | JWT | RAG chatbot (SSE stream) |
| `GET` | `/api/v1/observability/summary` | JWT | 7-day planning stats |
| `GET` | `/api/v1/data-health` | JWT | Database coverage |
| `GET/PUT` | `/api/v1/settings` | JWT | Org workspace settings |
| `GET/POST/PUT/DELETE` | `/api/v1/restaurant-profiles` | JWT | Restaurant profiles |
| `GET` | `/metrics` | Public | Prometheus scrape |
| `GET` | `/api/v1/debug/sentry-test` | Public | Sentry smoke test |

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
| `LANGCHAIN_TRACING_V2` | `false` | Enable LangSmith per-node traces |
| `LANGCHAIN_API_KEY` | — | LangSmith API key |
| `SENTRY_DSN` | — | Sentry DSN — init is skipped if unset |

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
| `CostAwareScoringService` | `services/cost_scoring_service.py` | Cost/benefit analysis for critic |
| `EvaluationSanityChecker` | `services/sanity_checker.py` | Automated sanity checks in critic |

---

## Tests

```bash
# Unit + integration
pytest tests/unit -q
pytest tests/integration -q --ignore=tests/integration/test_langgraph_flow.py

# LangSmith regression evals (requires LANGCHAIN_API_KEY + GROQ_API_KEY)
python scripts/build_golden_dataset.py
pytest evals/test_langsmith_regression.py -v

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
