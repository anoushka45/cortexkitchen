# CortexKitchen Implementation Plan

Last updated: June 2026. Phase 5 complete. Phase 6 in progress.

---

## Delivered — Phases 0–5

### Phase 0 — Design
- Architecture, PRD, system design, data model, API contracts, evaluation rubric

### Phase 1 — Core system
- Docker Compose stack (PostgreSQL, Qdrant, Redis)
- FastAPI backend with health, planning, runs, and data-health endpoints
- SQLAlchemy ORM models and Alembic migrations
- Seed scripts for demo data and Qdrant memory
- LangGraph nine-node orchestration graph with parallel fan-out
- All domain services (Forecast, Reservation, Complaint, Menu, Inventory, Critic)
- Frontend dashboard, runs page, and data-health page

### Phase 2 — Intelligence
- Prophet time-series demand forecasting with peak detection
- Inventory shortage/overstock alerts
- Menu intelligence with promotion strategy
- Dashboard with scenario framing, agent output cards, critic verdict banner

### Phase 3 — Multi-scenario
- Shared scenario runner (four presets)
- Persisted planning runs with full audit inspection
- CriticService with cost-aware scoring and revision feedback
- Runs page with full audit trail

### Phase 4 — Productisation
- Multi-tenant JWT auth (users, orgs, org-scoped sessions)
- LangSmith per-node tracing
- Real health checks for all dependencies
- structlog JSON logging across all nodes
- LLM cost tracking per call and per run
- Settings and restaurant profiles UI + API
- LLM provider abstraction with Groq↔Gemini auto-fallback
- RAGAS + DeepEval quality evals
- MCP server for Claude Code / Claude Desktop

### Phase 5 — Export, UX, Observability & Intelligence
- PDF export (ReportLab chef brief)
- Excel export (openpyxl multi-sheet owner workbook)
- Design polish — ember accent palette, Instrument Serif display font
- Frontend UX fixes — profile selector, validation, cost aggregates
- Redis plan caching — 1hr TTL, `cache_hit` flag
- SSE streaming — `node_complete` status events drive the loading screen pipeline diagram; full plan delivered in single `complete` event via `/planning/stream`
- What-if simulator — cover count slider, instant score update
- OpenTelemetry + Prometheus — `/metrics` scrape endpoint
- Sentry error capture with LangGraph node tags
- LangSmith regression evals — `cortexkitchen-golden-v1` (50 runs), 90% CI gate
- Multi-tenant workspace isolation — Postgres `org_id` scoping + Qdrant payload filter
- RAG chatbot — `POST /api/v1/chat` SSE, AsyncGroq, ReactMarkdown
- Prelaunch polish — homepage redesign, professional footer, prompt_utils centralisation

### Post Phase 5 — Architectural improvements

- Per-node model tier routing — `COMET_TIERED` activates `llm_registry` in state; critic gets strong tier, domain nodes get fast/balanced
- Cross-agent assumption diffing — each domain node writes assumptions dict to state; `EvaluationSanityChecker` cross-diffs post fan-out; `stale_assumptions` in critic prompt and response (D-017)

---

## Current state

Phases 0–5 are complete. Phase 6 (Swiggy MCP integration) is in progress with P6-S01 to P6-S04 merged to dev.

Outstanding known gaps:
- Core data integrations are synthetic pending Swiggy enricher completion (P6-S05 to S09)
- `packages/core` is empty — shared types between frontend and backend are not yet extracted
- RAGAS/DeepEval datasets are hand-crafted — should be rebuilt from live runs periodically

---

## Phase 6 — Swiggy MCP Integration (in progress)

**P6-S01 to S03** — Foundation and sync (complete, merged to dev):
- `BaseConnector` ABC (`sync()` + `enrich()` pattern)
- `SwiggyMCPClient` — JSON-RPC 2.0 to all three Swiggy MCP servers
- `connectors` table + `ConnectorRepository` (per-org token storage, sync_status)
- Async job queue for planning runs
- `SwiggyConnector.sync()` — `get_food_orders` → orders table

**P6-S04 / agent intelligence** (complete, merged to dev):
- Circuit breaker — Redis-backed, per-endpoint, 3/5min → 30min
- Provider registry — `get_provider_async()` checks DB + circuit state
- Tool tracing — per-call trace in SwiggyMCPClient
- `GET /health/circuits` health endpoint
- `PlanningMemoryService` — Qdrant long-term memory, recency decay
- `SemanticPlanCache` (Qdrant) — approved-only, condition-enriched
- `SemanticChatCache` — chatbot Q&A cache
- Graph expanded to 12 nodes: `qdrant_enrichment`, `phase1_sync`, `replan_orchestrator`
- Chatbot LLM factory + within-session memory (8-turn window + compression)

**Planned:**
- P6-S05: feedback sync (track_food_order → feedback table)
- P6-S06 to S09: CompetitorEnricher, OccupancyEnricher, ProcurementEnricher, MarketIntelService
- P6-S10/S11: market_intel_node + dineout_manager_node
- P6-S13 to S15: Action layer (ActionQueueService, ProcurementExecutor, DineoutExecutor)
- P6-S16/S17: BriefingService (daily) + LiveMonitorService (during service hours)
- P6-F01 to F06: Frontend for market intel, action queue, connectors, live mode
