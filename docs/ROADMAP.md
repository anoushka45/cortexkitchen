# CortexKitchen Roadmap

Status snapshot: June 2026. Phase 5 complete. Phase 6 in progress.

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
- ForecastService, ReservationService, ComplaintService, MenuService, InventoryService
- CriticService with five-dimension scoring
- Frontend dashboard, runs page, and data-health page

### Phase 2 — Intelligence
- Prophet time-series demand forecasting with peak detection
- Inventory shortage/overstock alerts with feasibility-aware planning
- Menu intelligence with promotion strategy
- Dashboard enhancement — scenario framing, agent output cards, critic verdict banner

### Phase 3 — Multi-scenario
- Shared scenario runner supporting four scenario presets
- Persisted planning runs with full audit inspection
- CriticService with cost-aware scoring, sanity checks, and revision feedback
- Runs page with full audit trail

### Phase 4 — Productisation
- **P4-01** Multi-tenant auth — users, orgs, JWT (HS256), protected routes, login/register UI
- **P4-02** LangSmith tracing — `LANGSMITH_TRACING` enabled, per-node traces
- **P4-03** Real health checks — live PostgreSQL, Qdrant, Redis connectivity pings
- **P4-04** Structured logging — structlog JSON output across all orchestration nodes
- **P4-05** LLM cost tracking — `prompt_tokens`, `completion_tokens`, `cost_usd` per call; aggregated in run metadata
- **P4-06** Admin + settings UI — tenant config (capacity, peak hours, thresholds)
- **P4-07** Runs UI — scenario filter, date range picker, critic score trend chart, diff modal
- **P4-08** Configurable restaurant profiles — CRUD API, profile injected into planning prompts
- **P4-09** LLM provider abstraction — `BaseLLMProvider` ABC, `FallbackLLMProvider`, Groq↔Gemini auto-fallback
- **P4-10** RAGAS evals — faithfulness (≥ 0.8) and context precision on complaint RAG pipeline
- **P4-11** DeepEval quality tests — HallucinationMetric on critic output, AnswerRelevancyMetric on agent outputs
- **P4-12** MCP server — `run_planning_scenario` + `get_run_history` via Anthropic MCP SDK; Claude Code + Desktop

### Phase 5 — Export, UX, Observability & Intelligence
- **P5-01** PDF export — ReportLab chef brief with plan summary, agent outputs, critic verdict, dimension scores, action items
- **P5-02** Excel export — role-aware `.xlsx`; Inventory & Staffing sheet (chef view), Cost Breakdown sheet (owner view), openpyxl
- **P5-03** Design polish — unified dark theme, ember accent palette, Instrument Serif display font, card hover elevation
- **P5-04** Frontend UX fixes — restaurant profile selector on dashboard, input validation, cost/token aggregate on runs list, back navigation
- **P5-05** Redis caching — 1hr TTL plan cache by scenario + date; `cache_hit` flag in response; zero LLM cost on hits
- **P5-06** SSE streaming — `POST /api/v1/planning/stream` emits `node_complete` status events (node name only) as each LangGraph node finishes; loading screen pipeline diagram updates in real time; full plan delivered in single `complete` event
- **P5-07** What-if simulator — cover count slider; cost pressure, benefit, and tradeoff scores update instantly without a full re-run
- **P5-08** OpenTelemetry + Prometheus — OTel HTTP tracing on every request; `/metrics` Prometheus scrape endpoint; observability summary API and frontend panel
- **P5-09** Sentry error tracking — `sentry-sdk` FastApiIntegration; DSN-gated init; `capture_exception` in LangGraph nodes; `/debug/sentry-test` smoke test
- **P5-10** LangSmith regression evals — `build_golden_dataset.py` builds `cortexkitchen-golden-v1` (50 runs); CI gate pytest with 90% pass rate threshold
- **P5-11** Multi-tenant workspace isolation — PostgreSQL `org_id` scoping on all run queries; Qdrant payload filter per org on complaint/SOP vectors; `org_id` in `OrchestratorState`; branded loading screen (Instrument Serif italic)
- **P5-12** RAG chatbot — `POST /api/v1/chat` SSE endpoint; AsyncGroq llama-3.3-70b streaming; RAG from Postgres runs + Feedback table; ReactMarkdown frontend; Ask AI in NavBar
- **P5-13** Prelaunch polish — homepage pipeline redesign with glowing connectors, plain-language copy; professional Footer; NavBar/dashboard/ForecastChart polish; prompt refinements across all services

### Post Phase 5 — Architectural improvements

- **Per-node model tier routing** — `COMET_TIERED=true` activates tier-keyed `llm_registry` in `OrchestratorState`; each parallel node reads its assigned tier at runtime; critic always gets the strong tier
- **Cross-agent assumption diffing** — each domain node writes its assumptions to state after its service call; `EvaluationSanityChecker` cross-diffs them post fan-out; `stale_assumptions` injected into critic prompt and returned in `critic.stale_assumptions` in the API response (D-017)

---

## Known gaps

- Core data integrations are synthetic pending Swiggy enricher completion (P6-S05 to S09); Swiggy order sync is live (P6-S01 to S03)
- `packages/core` is empty; types are not yet shared between frontend and backend
- RAGAS/DeepEval eval datasets are hand-crafted — should be rebuilt from live captures periodically
- `test_langgraph_flow.py` references a removed module and is excluded from the test run
- `test_llm_provider.py` (Gemini integration test) fails on free-tier rate limits; environment-dependent

---

## Phase 6 — In Progress (Swiggy MCP Integration)

Phase 6 is the real data connector phase. CortexKitchen integrates with Swiggy's MCP servers (Food, Instamart, Dineout) to replace synthetic data with live platform signals and enable autonomous action execution.

### Completed (merged to dev)

- **P6-S01** BaseConnector ABC (`sync()` + `enrich()` pattern) + `SwiggyMCPClient` (JSON-RPC 2.0, graceful degradation, retry on 5xx)
- **P6-S02** `connectors` table + `ConnectorRepository` (per-org OAuth token storage, sync_status tracking) + async job queue
- **P6-S03** `SwiggyConnector.sync()` — `get_food_orders` → `orders` table (source=swiggy, channel=delivery); external_order_id dedup
- **P6-S04 / agent intelligence** — full MCP governance layer + intelligence improvements:
  - Circuit breaker (Redis-backed, 3 failures/5min → 30min open per endpoint)
  - Provider registry (DB + live circuit health routing)
  - Tool tracing in SwiggyMCPClient
  - `GET /health/circuits` endpoint
  - `PlanningMemoryService` — Qdrant long-term memory with recency decay
  - `SemanticPlanCache` (Qdrant) — approved-only, condition-enriched storage embedding
  - `SemanticChatCache` — chatbot Q&A cache
  - Two new graph nodes: `qdrant_enrichment`, `replan_orchestrator`
  - Chatbot LLM factory (dispatches on LLM_PROVIDER)
  - Within-session chat memory (8-turn window with compression)

### Planned

- **P6-S05** track_food_order → feedback table (delivery latency signals)
- **P6-S06** CompetitorEnricher (Food MCP: search_restaurants + get_restaurant_menu)
- **P6-S07** OccupancyEnricher (Dineout MCP: search_restaurants_dineout + get_available_slots)
- **P6-S08** ProcurementEnricher (Instamart: search_products + your_go_to_items)
- **P6-S09** MarketIntelService + 6 state fields
- **P6-S10/S11** market_intel_node + dineout_manager_node (12th and 13th nodes)
- **P6-S12** 2 new cross-agent assumption diffs (market pricing vs menu, Dineout slots vs occupancy)
- **P6-S13 to S15** Action layer: ActionQueueService, ProcurementExecutor, DineoutExecutor
- **P6-S16/S17** Product modes: BriefingService (7am daily), LiveMonitorService (during service)
- **P6-F01 to F06** Frontend: market intel panel, action queue UI, connectors page, /live page
