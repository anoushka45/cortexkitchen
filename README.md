# CortexKitchen

**Multi-agent restaurant operations intelligence platform**

![Status](https://img.shields.io/badge/status-active-success)
![Phase](https://img.shields.io/badge/phase-5_complete-blue)
![Backend](https://img.shields.io/badge/backend-FastAPI-009688)
![Frontend](https://img.shields.io/badge/frontend-Next.js_16-black)
![Orchestration](https://img.shields.io/badge/orchestration-LangGraph-purple)
![Vector DB](https://img.shields.io/badge/vector_db-Qdrant-orange)
![Database](https://img.shields.io/badge/database-PostgreSQL_16-blue)
![Cache](https://img.shields.io/badge/cache-Redis-red)
![LLM Routing](https://img.shields.io/badge/LLM_routing-per--node_tier-8B5CF6)
![License](https://img.shields.io/badge/license-MIT-lightgrey)

---

## What is CortexKitchen?

CortexKitchen is a multi-agent AI platform for restaurant operations. Before every shift, five specialist agents read your demand data, bookings, guest complaints, menu performance, and inventory in parallel ,  and produce a single verified pre-shift brief.

A critic agent reviews the plan across five quality dimensions before it reaches the manager. If anything looks unsafe or unrealistic, the plan is blocked and the reason is explained.

The result: one brief, one verdict, under 90 seconds.

![Dashboard — Plan Approved](screenshots/03_dashboard/03_plan_approved_top.png)
*Completed dashboard — Plan Approved, critic score 0.92, with five agent metric cards across demand, capacity, complaints, inventory risk, and menu signals.*

---

## How it works

One planning run executes a nine-node LangGraph pipeline:

1. **Ops Manager** — validates the scenario, initialises shared state, fans out work
2. **Demand Forecast** — Prophet time-series model produces covers, peak hour, and confidence band
3. **Bookings & Tables** — analyses reservation density, occupancy %, and waitlist pressure *(parallel)*
4. **Guest Feedback** — RAG retrieval over Qdrant surfaces complaint patterns and SOPs *(parallel)*
5. **Menu Intelligence** — evaluates top items, weak items, and promotion opportunities *(parallel)*
6. **Stock & Inventory** — detects shortages, spoilage risk, and restock priorities *(parallel)*
7. **Aggregator** — collects all domain outputs into a single package
8. **Quality Check (Critic)** — scores the plan across 5 dimensions, gates it with a verdict
9. **Final Assembler** — shapes the API response with full metadata and cost tracking

![Dashboard — Pipeline Running](screenshots/03_dashboard/02_loading_screen.png)
*Live pipeline diagram mid-run — Ops Manager and Demand Forecast complete (green), four parallel specialists running simultaneously, Aggregator and Critic waiting.*

![Full Plan - Dashboard](screenshots/03_dashboard/04_full_plan_scroll.png)
*Full plan view after pipeline completes — critic verdict banner at top, followed by service planning, menu direction, and operational risk sections.*

---

## Platform capabilities

### Planning & Intelligence
- **Multi-scenario planning** — four presets: `friday_rush`, `weekday_lunch`, `holiday_spike`, `low_stock_weekend`
- **Demand forecasting** — Prophet-backed time-series with peak detection and day-of-week adjustment
- **Complaint intelligence (RAG)** — Qdrant retrieval grounds recommendations in real past guest issues
- **Menu guidance** — push / ease-back / avoid strategy aligned to demand and stock signals
- **Inventory risk detection** — shortage and overstock alerts with feasibility-aware planning
- **Critic quality gate** — 5-dimension scoring (safety, feasibility, evidence, actionability, clarity); three verdicts: approved / revision / rejected

![Service Planning & Reservation Pressure](screenshots/03_dashboard/05_service_planning.png)
*Service Planning section — Prophet demand forecast bar chart by hour with peak detection, alongside the Reservation Pressure panel showing occupancy %, waitlist, and priority.*

![Menu Direction](screenshots/03_dashboard/06_menu_direction.png)
*Menu Direction section — Menu Intelligence output showing items to push tonight, ease back on, and avoid, with a high-priority strategy recommendation.*

![Operational Risk](screenshots/03_dashboard/07_operational_risk.png)
*Operational Risk section — Complaint Intelligence (top issues, action items) alongside Inventory Status (shortage alerts with severity ratings and restock quantities).*

### Streaming & Real-time
- **Planning SSE** (`POST /api/v1/planning/stream`) — as each LangGraph node completes, a `node_complete` event is emitted carrying the node name; the loading screen pipeline diagram updates in real time so you see exactly which agents are done, running, or waiting. A final `complete` event delivers the full plan payload — the dashboard renders all at once from that single event.
- **Chat token streaming** (`POST /api/v1/chat`) — the Ask AI chatbot streams individual tokens word-by-word via AsyncGroq; each `{"token": "..."}` event renders progressively via ReactMarkdown. An entirely separate mechanism from the planning SSE.
- **Non-streaming planning** (`POST /api/v1/planning/run`) — standard JSON endpoint; returns the full response in one go. Used when the frontend doesn't need the live pipeline diagram.
- **Redis caching** — 1-hour TTL cache by scenario + date; only `approved` plans are cached; zero LLM cost on cache hits; `cache_hit` flag in response

### Exports
- **PDF chef brief** — ReportLab-generated report with plan summary, agent outputs, critic verdict, dimension scores, and action items
- **Excel workbook** — role-aware `.xlsx` with an Inventory & Staffing sheet (chef view) and a Cost Breakdown sheet (owner view)

![PDF Chef Brief](screenshots/08_exports/pdf_chef_brief.png)
*PDF chef brief — APPROVED verdict, 0.90/1.00 score, critic dimension scores table, prioritised action items, and full agent recommendations.*

![Excel — Inventory & Staffing](screenshots/08_exports/excel_inventory_chef_view.png)
*Excel workbook, Inventory & Staffing sheet (chef view) — shortage alerts with severity and spoilage risk, overstock alerts, and itemised restock actions.*

![Excel — Cost Breakdown](screenshots/08_exports/excel_cost_breakdown_owner_view.png)
*Excel workbook, Cost Breakdown sheet (owner view) — LLM provider, token count, total cost ($0.004), critic dimension scores per 100, and cost-aware analysis scores.*

### Ask AI (RAG Chatbot)
- **Conversational interface** over your actual run history, inventory data, and guest feedback — not generic AI
- **Groq llama-3.3-70b** with SSE streaming responses
- **Multi-turn memory** — follow-up questions understand prior context
- Suggested questions surface on first load; answers cite your own data

![Ask AI — Empty State](screenshots/05_chat/01_empty_state.png)
*Ask AI empty state — "Ask about Casa Mia" with six suggested question cards covering quality, complaints, inventory, menu, demand, and strategy.*

![Ask AI — Conversation](screenshots/05_chat/02_conversation_complaints.png)
*Active conversation — the chatbot answers a complaint question with structured markdown: top issues, specific incidents, and improvement steps drawn from real feedback records.*

![Ask AI — Performance Overview](screenshots/05_chat/03_conversation_performance.png)
*Multi-turn conversation — "How is my restaurant performing?" returns a structured breakdown of feedback counts, average demand, occupancy range, and plan quality scores.*

### What-If Simulator
- Slide covers and the cost pressure, benefit, and tradeoff scores update instantly
- No LLM calls, no LangGraph execution — purely deterministic scoring via `CostAwareScoringService`

![What-If Simulator](screenshots/03_dashboard/08_what_if_simulator.png)
*What-If Simulator modal — cover count slider at 135, with cost pressure, benefit, and tradeoff scores updating instantly without triggering a new LLM call.*

### Run History & Audit Trail
- Full run history with critic score trend chart, scenario filter, and date range picker
- Side-by-side run detail with critic dimension scores, RAG context, and full agent outputs
- Every run persisted permanently with token count, LLM cost, and node-level latency

![Run History](screenshots/04_runs/runs_history_audit.png)
*Run History audit page — full run list with scenario, target date, critic score and verdict on the left; selected run showing critic notes, dimension scores, and revision reasons on the right.*

![Run Detail](screenshots/04_runs/run_detail_history_panel.png)
*Run detail history panel — selected run's critic notes, dimension score bars, and revision reasons; export to PDF/Excel from the top-right.*

### Data Health & Observability
- **Data Health page** — live database coverage: orders, reservations, feedback, inventory, menu items, scenario coverage
- **Observability panel** — 7-day planning summary: total runs, success rate, avg critic score, avg duration, breakdown by verdict and scenario
- **OpenTelemetry** — HTTP request tracing via console exporter (swap for OTLP in production)
- **Prometheus** — `/metrics` scrape endpoint for latency, throughput, and error rate
- **Sentry** — unhandled exception capture with LangGraph node tags; DSN-gated init

![Data Health](screenshots/06_data_health/data_health.png)
*Data Health page — live database coverage showing 6,495 orders, 1,201 reservations, 160 feedback records, 18 inventory items, and 27 menu items with scenario coverage table.*

![Observability Panel](screenshots/06_data_health/observability_panel.png)
*Observability panel — last 7 days: 59 total runs, 81% success rate, 81/100 avg critic score, 16.6s avg duration, breakdown by verdict (approved/revision/rejected) and scenario.*

### LangSmith Regression Evals
- **Golden dataset** — `cortexkitchen-golden-v1` with 50 curated planning runs; built by `scripts/build_golden_dataset.py`
- **CI quality gate** — `tests/unit/test_langsmith_evals.py` runs evaluators against a local fixture (`golden_runs.json`); requires 90% pass rate
- **Per-node traces** in LangSmith for every planning run when `LANGSMITH_API_KEY` is set

![LangSmith Golden Dataset](screenshots/09_observability_tools/langsmith_golden_dataset.png)
*LangSmith — `cortexkitchen-golden-v1` dataset with 50 curated planning runs across all four scenarios, used as the CI regression quality gate.*

![LangSmith Run Traces](screenshots/09_observability_tools/langsmith_run_traces.png)
*LangSmith run traces — per-run tracing with latency breakdown per node, scenario labels, and linked evaluation datasets.*

![Sentry Error Capture](screenshots/09_observability_tools/sentry_error_capture.png)
*Sentry error capture — RuntimeError caught from a LangGraph node, with full stack trace, transaction ID, and issue tracking linked to the FastAPI integration.*

### Multi-Tenant Workspace Isolation
- JWT authentication with org-scoped planning runs, settings, and profiles
- PostgreSQL `org_id` scoping on all run queries
- Qdrant payload filter per org on complaint and SOP vectors
- `org_id` carried through `OrchestratorState` for end-to-end isolation

### LLM Provider Abstraction

CortexKitchen never calls an LLM provider directly from a service. All agents depend on `BaseLLMProvider`, a provider-agnostic abstraction layer.

- **Current default:** Groq (`llama-3.3-70b-versatile`) — chosen for its high free-tier RPM limits and fast inference
- **Automatic fallback:** Gemini — if Groq hits a rate limit or fails, the `FallbackLLMProvider` retries transparently on Gemini with no user-facing error
- **Swappable:** switching providers requires only a one-line change in `.env` (`LLM_PROVIDER=gemini`); no service code changes
- **Extensible:** adding a new provider (OpenAI, Claude, Mistral, etc.) means implementing `BaseLLMProvider` — the rest of the system picks it up automatically
- **Tracked:** the provider used (`llm_provider_used`, `llm_fallback_used`) is logged in structlog output and persisted in every planning run's metadata

### Per-Node Model Tier Routing

When `LLM_PROVIDER=comet` and `COMET_TIERED=true`, each node in the LangGraph pipeline is routed to a different model tier based on the complexity of its task — rather than using a single model for everything.

| Tier | Model | &nbsp; | Nodes |
|------|-------|--------|-------|
| **fast** | `deepseek-v4-flash` | <img src="screenshots/logos/deepseek.png" height="16"> | Demand Forecast, Inventory, Reservation |
| **balanced** | `gemini-3.5-flash` | <img src="screenshots/logos/gemini.png" height="16"> | Complaint Intelligence, Menu Intelligence |
| **strong** | `claude-sonnet-4-6` | <img src="screenshots/logos/claude.png" height="16"> | Critic |

Powered by [CometAPI](https://cometapi.com) — a unified proxy that exposes 500+ models through a single key and OpenAI-compatible endpoint. Each tier has a fallback chain (strong → balanced → fast) so if a primary model fails, the node degrades gracefully rather than erroring.

LangSmith traces show exactly which model hit which node in real time, with per-model cost visible in every run's `llm_usage` breakdown. All tier usage is drained and aggregated at the end of each run for accurate cost tracking.

This mode is fully opt-in — Groq and Gemini behaviour is completely unchanged when `COMET_TIERED` is not set.

### Configuration
- **Workspace settings** — seating capacity, cuisine type, peak service hours, timezone, plan approval threshold, stock warning levels
- **Restaurant profiles** — named profiles override org-level capacity and peak hours per run

![Settings](screenshots/07_config/settings.png)
*Workspace Settings — seating capacity, cuisine type, peak service hours, timezone, minimum critic approval score, and low/overstock warning thresholds.*

![Restaurant Profiles](screenshots/07_config/restaurant_profiles.png)
*Restaurant Profiles — named profile (Casa Mia Rooftop) with cuisine, capacity, peak hours, and timezone; selected from the dashboard to override org defaults for a run.*

### MCP Server
- `run_planning_scenario` and `get_run_history` tools via Anthropic MCP SDK
- Auto-discovered by Claude Code via `.mcp.json` in the project root
- Trigger real planning runs from natural language in Claude Code CLI or Claude Desktop

---

## Product surface

| Page | URL | Purpose |
|------|-----|---------|
| Homepage | `/` | Public marketing page — pipeline explainer, features, CTA |
| Login | `/login` | JWT sign-in |
| Register | `/register` | Create workspace + org |
| Dashboard | `/dashboard` | Scenario selection, run submission, streaming pipeline, full plan, what-if |
| Runs | `/runs` | Run history, critic score trend, run detail, PDF/Excel export |
| Ask AI | `/chat` | RAG chatbot over run history and feedback |
| Data Health | `/data-health` | Database coverage + observability panel |
| Settings | `/settings` | Workspace configuration and planning thresholds |
| Restaurant Profiles | `/restaurant-profiles` | Named restaurant profiles |

![Homepage Hero](screenshots/01_homepage/hero.png)
*Public homepage hero — headline, live dashboard mockup with a critic-approved brief, and CTAs to start free or watch the 90-second tour.*

![Homepage Pipeline](screenshots/01_homepage/pipeline.png)
*Homepage pipeline section — "Five specialists. One coherent verdict." with the horizontal flow diagram showing Orchestrator → Gate → four parallel agents → Quality Check.*

![Login](screenshots/02_auth/login.png)
*Login page — email and password sign-in with a link to create a new workspace.*

![Register](screenshots/02_auth/register.png)
*Register page — create a restaurant workspace with org name, user name, email, and password in a single step.*

---

## System architecture

| Layer | Technology |
|-------|-----------|
| Backend API | FastAPI 0.115, Uvicorn, Pydantic v2 |
| Orchestration | LangGraph (StateGraph, nine nodes, parallel fan-out) |
| LLM | Groq llama-3.3-70b (default) or Gemini — pluggable via `LLM_PROVIDER`; auto-fallback. Optional per-node tier routing via CometAPI (`COMET_TIERED=true`) |
| Streaming | FastAPI SSE (`/planning/stream`) — `node_complete` status events drive the loading screen; full plan delivered in one `complete` event |
| Caching | Redis 7 — 1hr TTL plan cache by scenario + date |
| Database | PostgreSQL 16 via SQLAlchemy + Alembic |
| Vector store | Qdrant — complaints and SOPs, org-scoped payload filters |
| Forecasting | Prophet + Pandas |
| Frontend | Next.js 16, React 19, TypeScript, Tailwind CSS 4, Recharts |
| Auth | JWT (HS256) + passlib/bcrypt — multi-tenant, org-scoped |
| Observability | LangSmith tracing, OTel HTTP tracing, Prometheus /metrics, Sentry, structlog JSON |
| Evals | LangSmith golden dataset (50 runs, 90% CI gate), RAGAS, DeepEval |
| Exports | ReportLab (PDF), openpyxl (Excel) |
| MCP | Anthropic MCP SDK — `run_planning_scenario` + `get_run_history` |
| Local infra | Docker Compose (PostgreSQL, Qdrant, Redis) |

### Integrations

<p>
  <img src="screenshots/logos/langgraph.png" height="24" alt="LangGraph">&nbsp;&nbsp;
  <img src="screenshots/logos/langsmith.png" height="24" alt="LangSmith">&nbsp;&nbsp;
  <img src="screenshots/logos/groq.png" height="24" alt="Groq">&nbsp;&nbsp;
  <img src="screenshots/logos/gemini.png" height="24" alt="Gemini">&nbsp;&nbsp;
  <img src="screenshots/logos/deepseek.png" height="24" alt="DeepSeek">&nbsp;&nbsp;
  <img src="screenshots/logos/claude.png" height="24" alt="Claude">&nbsp;&nbsp;
  <img src="screenshots/logos/redis.png" height="24" alt="Redis">&nbsp;&nbsp;
  <img src="screenshots/logos/sentry.png" height="24" alt="Sentry">&nbsp;&nbsp;
  <img src="screenshots/logos/otel.png" height="24" alt="OpenTelemetry">&nbsp;&nbsp;
  <img src="screenshots/logos/ragas.png" height="24" alt="RAGAS">&nbsp;&nbsp;
  <img src="screenshots/logos/mcp.png" height="24" alt="MCP">&nbsp;&nbsp;
  <img src="screenshots/logos/github.png" height="24" alt="GitHub">
</p>

---

## Project status

| Phase | Status | Highlights |
|-------|--------|-----------|
| Phase 0 | Complete | Architecture, PRD, system design, data model, API contracts |
| Phase 1 | Complete | FastAPI, LangGraph 9-node graph, all domain services, dashboard |
| Phase 2 | Complete | Prophet forecasting, inventory alerts, menu intelligence |
| Phase 3 | Complete | Multi-scenario runner, runs audit trail, critic scoring |
| Phase 4 | Complete | Auth, LangSmith, health checks, structlog, cost tracking, evals, MCP |
| Phase 5 | **Complete** | PDF/Excel export, SSE streaming, Redis cache, what-if simulator, OTel, Sentry, LangSmith evals, multi-tenant isolation, RAG chatbot, prelaunch polish |

---

## Repository structure

```
apps/
  api/                          # FastAPI backend
    app/
      api/routes/               # Auth, planning, runs, settings, exports, chat, observability
      domain/services/          # ForecastService, ComplaintService, MenuService, etc.
      orchestration/            # LangGraph graph, nodes, state
      infrastructure/           # DB, LLM providers, Qdrant, Redis, PDF, Excel
    evals/                      # RAGAS + DeepEval quality eval suites
    mcp_server.py               # MCP stdio server for Claude integration
  web/cortexkitchen-ui/         # Next.js 16 frontend
    app/                        # Pages: dashboard, runs, chat, data-health, settings, etc.
    components/                 # NavBar, Footer, ForecastChart, layout
    hooks/                      # useFridayRush, streaming hooks

data/                           # Raw, processed, and seeded datasets
docs/                           # Architecture, API reference, agents, roadmap, evaluation
infra/                          # Local infrastructure setup
scripts/                        # seed_demo_data.py, seed_qdrant_memory.py, build_golden_dataset.py
screenshots/                    # Feature screenshots organized by section
docker-compose.yml              # Local stack: PostgreSQL, Qdrant, Redis
.mcp.json                       # Claude Code MCP auto-discovery config
```

---

## Local setup

### Prerequisites

- Docker and Docker Compose
- Python 3.11+
- Node.js 18+
- Groq API key — free at [console.groq.com](https://console.groq.com)

### 1. Start infrastructure

```bash
docker compose up -d
```

Starts PostgreSQL 16 (port 5432), Qdrant (port 6333), and Redis 7 (port 6379).

### 2. Configure the backend

```bash
cd apps/api
cp .env.example .env
```

Edit `.env`:

```env
LLM_PROVIDER=groq
GROQ_API_KEY=your_groq_key_here

# Optional — Gemini used as fallback when Groq fails
GEMINI_API_KEY=your_gemini_key_here

JWT_SECRET_KEY=change-me-in-production

# Optional — enables LangSmith per-node tracing
LANGSMITH_TRACING=true
LANGSMITH_API_KEY=your_langsmith_key

# Optional — enables Sentry exception capture
SENTRY_DSN=your_sentry_dsn

# Optional — CometAPI per-node model tier routing
# Set LLM_PROVIDER=comet and COMET_TIERED=true to activate
# Get your key at https://cometapi.com
COMETAPI_KEY=your_cometapi_key_here
COMETAPI_MODEL_FAST=deepseek-v4-flash
COMETAPI_MODEL_BALANCED=gemini-3.5-flash
COMETAPI_MODEL_STRONG=claude-sonnet-4-6
COMET_TIERED=false
```

### 3. Install and seed

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
```

### 4. Start the backend

```bash
uvicorn app.main:app --reload
```

API at `http://localhost:8000` · Swagger at `http://localhost:8000/docs`

### 5. Start the frontend

```bash
cd apps/web/cortexkitchen-ui
npm install
npm run dev
```

Frontend at `http://localhost:3000`

### 6. Register and log in

Go to `http://localhost:3000/register`, create your workspace, then log in. All planning routes are auth-protected and org-scoped.

---

## API surface

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `POST` | `/api/v1/auth/register` | Public | Register user + org |
| `POST` | `/api/v1/auth/login` | Public | Get JWT access token |
| `GET` | `/api/v1/health` | Public | Liveness check |
| `GET` | `/api/v1/health/dependencies` | Public | PostgreSQL, Qdrant, Redis status |
| `GET` | `/api/v1/planning/scenarios` | Public | List scenario presets |
| `POST` | `/api/v1/planning/run` | JWT | Execute planning pipeline (full JSON response) |
| `POST` | `/api/v1/planning/stream` | JWT | Execute planning pipeline (SSE — node_complete events + final complete) |
| `POST` | `/api/v1/planning/whatif` | JWT | What-if demand simulator (no LLM, instant) |
| `GET` | `/api/v1/runs` | JWT | List persisted runs |
| `GET` | `/api/v1/runs/{id}` | JWT | Run detail |
| `GET` | `/api/v1/runs/{id}/export` | JWT | Download PDF chef brief |
| `GET` | `/api/v1/runs/{id}/export/excel` | JWT | Download Excel workbook |
| `POST` | `/api/v1/chat` | JWT | RAG chatbot over run history (SSE token stream) |
| `GET` | `/api/v1/observability/summary` | JWT | 7-day planning summary stats |
| `GET` | `/api/v1/settings` | JWT | Get org settings |
| `PATCH` | `/api/v1/settings` | JWT | Update org settings |
| `GET/POST` | `/api/v1/restaurant-profiles` | JWT | List / create profiles |
| `GET/PATCH/DELETE` | `/api/v1/restaurant-profiles/{id}` | JWT | Get / update / delete profile |
| `GET` | `/metrics` | Public | Prometheus scrape endpoint |
| `GET` | `/debug/sentry-test` | Public | Sentry smoke test (not under /api/v1) |

See [`docs/APIS.md`](docs/APIS.md) for full request/response schemas.

---

## MCP integration

The `.mcp.json` in the project root wires up the MCP server automatically in Claude Code.

Set `CORTEX_EMAIL` and `CORTEX_PASSWORD` in `.mcp.json` to a registered user, then:

```
run a friday rush planning scenario
show me the last 5 planning runs filtered to approved verdicts
```

For Claude Desktop, copy `docs/mcp_claude_desktop_config.json` into your `claude_desktop_config.json`.

---

## Running tests

```bash
cd apps/api

# Unit + integration
pytest tests/ -q --ignore=tests/integration/test_langgraph_flow.py

# LangSmith regression evals (requires GROQ_API_KEY)
python ../../scripts/build_golden_dataset.py
pytest tests/unit/test_langsmith_evals.py -v

# RAGAS + DeepEval quality evals
pytest evals/test_ragas_complaint.py -v -W ignore::DeprecationWarning
pytest evals/test_deepeval_quality.py -v -W ignore::DeprecationWarning
```

---

## Documentation

| Document | Contents |
|----------|---------|
| [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) | Full system architecture, graph topology, Phase 5 additions |
| [`docs/APIS.md`](docs/APIS.md) | Complete API reference with request/response schemas |
| [`docs/AGENTS.md`](docs/AGENTS.md) | Orchestration node descriptions including chat agent |
| [`docs/EVALUATION.md`](docs/EVALUATION.md) | LangSmith evals, RAGAS, DeepEval, quality gates |
| [`docs/ROADMAP.md`](docs/ROADMAP.md) | Phase-by-phase delivery history |
| [`docs/DATA_MODEL.md`](docs/DATA_MODEL.md) | PostgreSQL schema and Qdrant collections |
| [`docs/DECISIONS.md`](docs/DECISIONS.md) | Architecture decision log |

---

## License

MIT — see [LICENSE](LICENSE).
