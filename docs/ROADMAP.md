# CortexKitchen Roadmap

Phase 5 complete. Phase 6A in progress.

---

## Completed

### Phase 0: Design
- Architecture, PRD, system design, data model, API contracts, evaluation rubric

### Phase 1: Core system
- Local Docker Compose stack for PostgreSQL, Qdrant, and Redis
- FastAPI application with health, planning, runs, and data-health endpoints
- SQLAlchemy ORM models and Alembic migrations
- Seed scripts for demo data and Qdrant memory
- LangGraph nine-node orchestration graph with parallel fan-out
- ForecastService, ReservationService, ComplaintService, MenuService, InventoryService
- CriticService with five-dimension scoring
- Frontend dashboard, runs page, and data-health page

### Phase 2: Intelligence
- Prophet time-series demand forecasting with peak detection
- Inventory shortage/overstock alerts with feasibility-aware planning
- Menu intelligence with promotion strategy
- Dashboard enhancement: scenario framing, agent output cards, critic verdict banner

### Phase 3: Multi-scenario
- Shared scenario runner supporting four scenario presets
- Persisted planning runs with full audit inspection
- CriticService with cost-aware scoring, sanity checks, and revision feedback
- Runs page with full audit trail

### Phase 4: Productisation
- **P4-01** Multi-tenant auth: users, orgs, JWT (HS256), protected routes, login/register UI
- **P4-02** LangSmith tracing: `LANGSMITH_TRACING` enabled, per-node traces
- **P4-03** Real health checks: live PostgreSQL, Qdrant, Redis connectivity pings
- **P4-04** Structured logging: structlog JSON output across all orchestration nodes
- **P4-05** LLM cost tracking: `prompt_tokens`, `completion_tokens`, `cost_usd` per call; aggregated in run metadata
- **P4-06** Admin + settings UI: tenant config (capacity, peak hours, thresholds)
- **P4-07** Runs UI: scenario filter, date range picker, critic score trend chart, diff modal
- **P4-08** Configurable restaurant profiles: CRUD API, profile injected into planning prompts
- **P4-09** LLM provider abstraction: `BaseLLMProvider` ABC, `FallbackLLMProvider`, Groq↔Gemini auto-fallback
- **P4-10** RAGAS evals: faithfulness (≥ 0.8) and context precision on complaint RAG pipeline
- **P4-11** DeepEval quality tests: HallucinationMetric on critic output, AnswerRelevancyMetric on agent outputs
- **P4-12** MCP server: `run_planning_scenario` + `get_run_history` via Anthropic MCP SDK; Claude Code + Desktop

### Phase 5: Export, UX, Observability & Intelligence
- **P5-01** PDF export: ReportLab chef brief with plan summary, agent outputs, critic verdict, dimension scores, action items
- **P5-02** Excel export: role-aware `.xlsx`; Inventory & Staffing sheet (chef view), Cost Breakdown sheet (owner view), openpyxl
- **P5-03** Design polish: unified dark theme, ember accent palette, Instrument Serif display font, card hover elevation
- **P5-04** Frontend UX fixes: restaurant profile selector on dashboard, input validation, cost/token aggregate on runs list, back navigation
- **P5-05** Redis caching: 1hr TTL plan cache by scenario + date; `cache_hit` flag in response; zero LLM cost on hits
- **P5-06** SSE streaming: `POST /api/v1/planning/stream` emits `node_complete` status events (node name only) as each LangGraph node finishes; loading screen pipeline diagram updates in real time; full plan delivered in single `complete` event
- **P5-07** What-if simulator: cover count slider; cost pressure, benefit, and tradeoff scores update instantly without a full re-run
- **P5-08** OpenTelemetry + Prometheus: OTel HTTP tracing on every request; `/metrics` Prometheus scrape endpoint; observability summary API and frontend panel
- **P5-09** Sentry error tracking: `sentry-sdk` FastApiIntegration; DSN-gated init; `capture_exception` in LangGraph nodes; `/debug/sentry-test` smoke test
- **P5-10** LangSmith regression evals: `build_golden_dataset.py` builds `cortexkitchen-golden-v1` (50 runs); CI gate pytest with 90% pass rate threshold
- **P5-11** Multi-tenant workspace isolation: PostgreSQL `org_id` scoping on all run queries; Qdrant payload filter per org on complaint/SOP vectors; `org_id` in `OrchestratorState`; branded loading screen (Instrument Serif italic)
- **P5-12** RAG chatbot: `POST /api/v1/chat` SSE endpoint; AsyncGroq llama-3.3-70b streaming; RAG from Postgres runs + Feedback table; ReactMarkdown frontend; Ask AI in NavBar
- **P5-13** Prelaunch polish: homepage pipeline redesign with glowing connectors, plain-language copy; professional Footer; NavBar/dashboard/ForecastChart polish; prompt refinements across all services

### Post Phase 5: Architectural improvements

- **Per-node model tier routing**: `COMET_TIERED=true` activates tier-keyed `llm_registry` in `OrchestratorState`; each parallel node reads its assigned tier at runtime; critic always gets the strong tier
- **Cross-agent assumption diffing**: each domain node writes its assumptions to state after its service call; `EvaluationSanityChecker` cross-diffs them post fan-out; `stale_assumptions` injected into critic prompt and returned in `critic.stale_assumptions` in the API response (D-017)

---

## Known gaps

- `executor/` (Instamart checkout, Dineout table booking) is implemented but blocked on Swiggy staging credentials
- `packages/core` is empty; types are not yet shared between frontend and backend
- RAGAS and DeepEval currently evaluate against static hand-written fixtures; candidate-refresh scripts exist but their output has not yet been promoted into the golden fixtures
- `test_langgraph_flow.py` references a removed module and is excluded from the test run
- `test_llm_provider.py` (Gemini integration test) fails on free-tier rate limits; environment-dependent

---

## Phase 6A: in progress (Swiggy MCP integration, live signals, IA redesign)

Phase 6A integrates Swiggy's MCP servers (Food, Instamart, Dineout) to replace synthetic market data with live platform signals, adds intelligence signals independent of Swiggy (weather, industry trends, regulatory alerts), and redesigns the frontend information architecture around a real product shape rather than a single dashboard.

### Completed

- BaseConnector ABC (`sync()` and `enrich()` pattern) and `SwiggyMCPClient` (JSON-RPC 2.0, graceful degradation, circuit breaker, tool tracing)
- `connectors` table, `ConnectorRepository`, async job queue, nightly sync services (orders, feedback, reservation status)
- `CompetitorEnricher`, `OccupancyEnricher`, `ProcurementEnricher`, `MarketIntelService`, and the `market_intel` and `dineout_manager` graph nodes
- Compliance remediation: removal of the competing-platform (Zomato) stub connector for exclusivity; anonymisation of all market intelligence output to area-level aggregates for the competitive-intelligence clause
- `PlanningMemoryService` (Qdrant long-term memory, recency decay), `SemanticPlanCache`, `SemanticChatCache`
- Live intelligence signals independent of Swiggy: `WeatherService` (Open-Meteo, real forecast-adjusting multiplier), `TrendsService` (curated RSS digest), `ComplianceAlertsService` (FSSAI public notices), unified via the `live_signals` node and `market_intel`
- Scenario intake overhaul: natural-language scenario text (`ScenarioProfileService`), live dynamic composition (`LiveScenarioComposer`, `GET /planning/compose-live-scenario`), alongside the four existing presets
- Action Queue with a trust-ladder approval mechanic; financial scorecard with a per-org expense ledger, real net profit and net margin, and a composite health score
- Langfuse tracing on every planning run and a Kindred replay endpoint for single-generation prompt replay debugging
- Graph expanded to fourteen nodes total (`live_signals`, `qdrant_enrichment`, `market_intel`, `dineout_manager`, `replan_orchestrator` added since the original nine-node graph)
- Frontend information architecture redesign: `/dashboard` and `/planning` split into separate pages, `/action-center`, `/analytics`, and a merged `/data` page replacing separate `/runs` and `/data-health` pages, with backward-compatible redirect stubs

### Upcoming

- Autonomous procurement loop wired fully end-to-end (shortage detection through real Instamart checkout), blocked on Swiggy staging credentials for the checkout step
- Instamart event supplies exposed as a capability in the operator chat assistant
- Voice interface: Whisper transcription and TTS response
- Promotion of RAGAS and DeepEval candidate datasets into the golden eval fixtures

Phase 6B (Guest Concierge) is scoped but not started, gated on written Swiggy consent under Integration Agreement clause 2.1(v).
