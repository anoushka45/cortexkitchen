# CortexKitchen Roadmap

Status snapshot: June 2026. Phase 4 complete.

---

## Completed

### Phase 0 — Design
- Architecture, PRD, system design, data model, API contracts, evaluation rubric

### Phase 1 — Core system
- Local Docker Compose stack for PostgreSQL, Qdrant, and Redis
- FastAPI application with health, planning, runs, and data-health endpoints
- SQLAlchemy ORM models and Alembic migrations
- Seed scripts for demo data and Qdrant memory
- LangGraph nine-node orchestration graph with parallel fan-out
- ForecastService (baseline), ReservationService, ComplaintService, MenuService, InventoryService
- CriticService with five-dimension scoring
- Frontend dashboard, runs page, and data-health page

### Phase 2 — Intelligence
- Prophet time-series demand forecasting with peak detection
- Inventory shortage/overstock alerts with feasibility-aware planning
- Menu intelligence with promotion strategy
- Dashboard enhancement — scenario framing, agent output cards, critic verdict banner

### Phase 3 — Multi-scenario
- Shared scenario runner supporting four scenario presets (friday_rush, weekday_lunch, holiday_spike, low_stock_weekend)
- Persisted planning runs with full audit inspection
- CriticService with cost-aware scoring, sanity checks, and revision feedback
- Runs page with full audit trail

### Phase 4 — Productisation
- **P4-01** Multi-tenant auth — users, orgs, JWT (HS256), protected routes, login/register UI, NavBar
- **P4-02** LangSmith tracing — `LANGCHAIN_TRACING_V2` enabled, per-node traces
- **P4-03** Real health checks — live PostgreSQL, Qdrant, Redis connectivity pings
- **P4-04** Structured logging — structlog JSON output across all orchestration nodes
- **P4-05** LLM cost tracking — `prompt_tokens`, `completion_tokens`, `cost_usd` per call; aggregated in `planning_runs.metadata`
- **P4-06** Admin + settings UI — tenant config (capacity, peak hours, thresholds)
- **P4-07** Runs UI — scenario filter, date range picker, critic score trend chart, side-by-side diff modal
- **P4-08** Configurable restaurant profiles — `restaurant_profiles` table, CRUD API, profile injected into planning prompts
- **P4-09** LLM provider abstraction — `BaseLLMProvider` ABC, `FallbackLLMProvider`, `create_llm_provider()` factory, Groq↔Gemini auto-fallback, provider metadata in logs and run meta
- **P4-10** RAGAS evals — faithfulness (≥ 0.8) and context precision on complaint RAG pipeline; fixed complaint node to pass RAG context into the LLM prompt
- **P4-11** DeepEval quality tests — HallucinationMetric on critic output (≤ 0.5), AnswerRelevancyMetric on agent outputs (≥ 0.7); custom Groq wrapper for structured output compatibility
- **P4-12** MCP server — `run_planning_scenario` + `get_run_history` tools via Anthropic MCP SDK; `.mcp.json` for Claude Code auto-discovery; verified live in Claude Code CLI

---

## Next — Phase 5 (Production layer)

Phase 5 requires real restaurant data connections. All items below assume a live data source.

- **P5-01** CSV / POS data connectors — ingest real order and reservation exports
- **P5-02** Async planning runs — Redis job queue so long-running plans don't block HTTP
- **P5-03** SSE streaming — stream node outputs to the dashboard as they complete
- **P5-04** Observability trace viewer — per-run node waterfall with LLM cost breakdown
- **P5-05** OpenTelemetry — structured trace export to a backend (Grafana, Datadog, etc.)
- **P5-06** LangSmith regression evals — automated eval runs on every deploy against a pinned dataset
- **P5-07** Multi-tenant workspace isolation — Qdrant migration to shared collection with `restaurant_id` + `doc_type` payload filters (see D-009)
- **P5-08** Sentry error tracking — exception capture with org context

---

## Known gaps

- All data integrations are synthetic — no live POS or platform connections
- `packages/core` is empty; types are not yet shared between frontend and backend
- Redis is present but not yet used beyond connectivity health checks
- RAGAS/DeepEval eval datasets are hand-crafted — should be rebuilt from live captures periodically
- `test_langgraph_flow.py` references a removed module (`app.orchestration.service`) and is excluded from the test run; needs deletion or rewrite
- `test_llm_provider.py` (Gemini integration test) fails on free-tier rate limits; environment-dependent
