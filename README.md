# CortexKitchen

**Multi-agent restaurant operations platform, built on the Swiggy MCP.**

![Status](https://img.shields.io/badge/status-active-success)
![Phase](https://img.shields.io/badge/phase-6A_in_progress-blue)
![Backend](https://img.shields.io/badge/backend-FastAPI-009688)
![Frontend](https://img.shields.io/badge/frontend-Next.js_16-black)
![Orchestration](https://img.shields.io/badge/orchestration-LangGraph-purple)
![Vector DB](https://img.shields.io/badge/vector_db-Qdrant-orange)
![Database](https://img.shields.io/badge/database-PostgreSQL_16-blue)
![Cache](https://img.shields.io/badge/cache-Redis-red)
![License](https://img.shields.io/badge/license-MIT-lightgrey)

---

## What is CortexKitchen?

CortexKitchen is a two-sided platform powered by the Swiggy MCP.

**Restaurant OS** is the side that is in active development today. Before every shift, a LangGraph pipeline of specialist nodes reads live weather and holiday data, area market signals from Swiggy, demand history, bookings, guest complaints, menu performance, and inventory, then produces a single verified pre-shift plan. A critic node reviews that plan across several quality dimensions before it reaches the operator; if anything looks unsafe or unrealistic, the plan is sent back for revision (up to two cycles) with the reason stated.

**Guest Concierge** is a planned second side of the platform: a consumer-facing event-planning assistant that would use the Dineout, Food, and Instamart Swiggy MCP servers to plan and book an event end to end. It has not started. It is gated on written consent from Swiggy under clause 2.1(v) of the signed Integration Agreement, and no code for it exists yet.

CortexKitchen is being built and demoed in the context of a real, signed Swiggy Integration Agreement (effective 2026-07-09). Two compliance issues identified against that agreement, a prohibited-competitor-intelligence pattern and an exclusivity conflict with a Zomato stub connector, have already been found and remediated in the codebase; see `CLAUDE.md` for the full record.

---

## How the planning pipeline works

One planning run executes a LangGraph state machine of fourteen registered nodes:

1. **Ops Manager** validates the scenario (a fixed preset, a natural-language-derived profile, or a live-signals-derived profile) and initializes shared state.
2. **Live Signals** fetches weather and holiday context, an industry-trends digest, and FSSAI regulatory notices, all before demand forecasting runs.
3. **Demand Forecast** produces a Prophet-based cover prediction, adjusted by the weather and holiday signals from the previous step.
4. **Qdrant Enrichment** retrieves relevant past approved-run insights and SOP/complaint context from Qdrant ahead of the parallel fan-out.
5. Five nodes run in parallel: **Reservation** (booking pressure and overbooking risk), **Complaint Intelligence** (recurring guest issues via RAG), **Inventory** (shortage and overstock detection), **Market Intelligence** (Swiggy area pricing and demand, merged with the live signals from step 2), and **Dineout Manager** (own-restaurant slot visibility on Swiggy Dineout).
6. **Menu Intelligence** reads all five parallel outputs and forms a menu recommendation.
7. **Aggregator** collects every domain output into one package.
8. **Critic** scores the plan and returns a verdict of approved, revision, or rejected.
9. If revision is requested, **Replan Orchestrator** injects the critic's feedback and loops back into Menu Intelligence, up to two cycles.
10. **Final Assembler** shapes the API response with full metadata and cost tracking.

---

## Platform capabilities

### Planning and intelligence

- Scenario selection is not limited to four fixed presets. A natural-language description of the shift ("we are hosting an event tonight") is turned into a structured scenario profile by an LLM call. A separate "run for today" fast path composes a fresh profile from live signals (weather, holiday, area occupancy, inventory shortages, time of day) instead of forcing today into the nearest of the four presets.
- Demand forecasting: Prophet time-series model, with a real multiplier applied for weather and known Indian holidays, not just narrative text.
- Complaint intelligence: Qdrant RAG retrieval grounds menu and operational recommendations in real past guest feedback.
- Menu guidance: recommendations are constrained to what the kitchen can actually make, given current inventory.
- Inventory risk detection: shortage and overstock alerts with reorder quantities.
- Market intelligence: area-level Swiggy pricing, positioning, menu breadth, cuisine crowding, and competitor deal activity, always reported as area aggregates, never as named competitor restaurants or prices (see the compliance note above).
- Critic quality gate: multi-dimension scoring with three verdicts and up to two replan cycles.
- Cross-agent assumption diffing: each domain node writes the assumptions it acted on into shared state; a sanity checker cross-diffs them after the parallel fan-out and surfaces contradictions to the critic.
- Planning memory: approved-run insights are stored in a Qdrant collection and retrieved for future runs with recency-decayed scoring.
- Semantic plan cache: a Qdrant-backed cache of approved plans, with a similarity threshold and TTL, bypassed for natural-language or live-composed scenarios so a bespoke request is never served a stale cached plan.

### Autonomous procurement and the Action Queue

- An Action Queue holds proposed operational actions (for example, an ingredient reorder) awaiting approval, alongside a trust-ladder indicator that counts consecutive approvals per action category as an informational signal, not an auto-approval mechanism.
- Two built-in workflow triggers (critical shortages; high demand combined with active competitor deals) automatically raise recommendation-tier actions after a run.
- Vendor coordination for procurement runs over WhatsApp today; Instamart cart and checkout execution is scoped and pending staging credentials from Swiggy.

### Financial scorecard

- A per-organization expense ledger (rent, utilities, marketing, and other recurring costs) is prorated into a daily figure and combined with order revenue to produce real net profit, net margin, and a composite health score, not just top-line revenue.

### Chat assistant

- A conversational assistant over real run history, inventory data, and guest feedback, available both as a full page and a floating widget that shares session state with it.
- Routes to Groq or CometAPI depending on configuration, with within-session memory compression after eight turns and a semantic cache for repeated questions.
- Backed by an internal MCP server exposing planning, market, and Action Queue tools to the chatbot itself.

### Observability and evaluation

- Langfuse tracing on every planning run, one span per graph node and one generation per real LLM call, plus a Kindred replay endpoint for single-generation prompt replay and debugging.
- LangSmith regression evals against a golden dataset with a CI pass-rate gate.
- RAGAS and DeepEval quality metrics (faithfulness, context precision, hallucination, answer relevancy) are integrated and running today; promoting newly generated candidate samples into the golden fixtures is tracked as upcoming work, not yet done.
- OpenTelemetry HTTP tracing, a Prometheus metrics endpoint, and Sentry exception capture with LangGraph node tags.

### Exports

- PDF chef brief and a role-aware Excel workbook (an inventory and staffing sheet for the kitchen, a cost-breakdown sheet for the owner) per planning run.

### Multi-tenant isolation

- JWT authentication with organization-scoped planning runs, settings, and profiles; PostgreSQL `org_id` scoping on every query; Qdrant payload filtering per organization on complaint and SOP vectors.

### LLM provider abstraction

Every LLM call goes through `BaseLLMProvider`, never a provider SDK directly.

- Default provider is Groq, with automatic fallback to Gemini on rate limit or failure.
- An optional per-node tiered mode routes simpler nodes to a faster model and the critic to a stronger one, via CometAPI, fully opt-in and inactive by default.
- The provider actually used, and whether fallback fired, is recorded on every planning run.

---

## Product surface

| Page | Route | Purpose |
|------|-------|---------|
| Homepage | `/` | Public marketing page |
| Login | `/login` | Sign in |
| Register | `/register` | Create a workspace and organization |
| Dashboard | `/dashboard` | Daily overview: KPIs, health score, live-intelligence card, revenue and margin trends, signals, risks, Action Queue summary, latest run |
| Planning | `/planning` | The flagship trigger-and-watch experience: agent showcase, live scenario composition, streaming pipeline, forecast chart, critic banner, what-if simulator, exports |
| Action Center | `/action-center` | Pending approvals and full Action Queue history |
| Analytics | `/analytics` | Historical drill-down: menu performance, channel split, peak hours, complaint categories, category pricing |
| Data | `/data` | Merged run history and data-health view, with PDF/Excel export and observability summary |
| Market | `/market` | Live Swiggy market intelligence, one card per capability, plus price and occupancy trend charts |
| AI Assistant | `/chat` | Full-page chat interface |
| Connectors | `/connectors` | Swiggy connector status and sync trigger |
| Restaurant Profiles | `/restaurant-profiles` | Named restaurant profiles that override organization defaults for a run |
| Settings | `/settings` | Workspace configuration and planning thresholds |

`/operations`, `/runs`, `/runs/{id}`, and `/data-health` are kept only as client-side redirects to their current equivalents, so old bookmarks and links do not 404. They are not reachable from navigation.

---

## System architecture

| Layer | Technology |
|-------|-----------|
| Backend API | FastAPI 0.115, Uvicorn, Pydantic v2 |
| Orchestration | LangGraph state machine, fourteen registered nodes, five-way parallel fan-out, a replan loop back into menu intelligence |
| LLM | Groq (default) or Gemini, pluggable via `LLM_PROVIDER`, with automatic fallback; optional CometAPI per-node tier routing |
| Streaming | Server-sent events on `/planning/stream`, one `node_start` and `node_complete` pair per node, final `complete` event with the full plan |
| Caching | Redis, time-boxed plan cache keyed by scenario and date; bypassed for natural-language and live-composed scenarios |
| Database | PostgreSQL 16 via SQLAlchemy and Alembic |
| Vector store | Qdrant, for complaints, SOPs, and planning memory, organization-scoped |
| Forecasting | Prophet and pandas |
| Frontend | Next.js 16, React 19, TypeScript, Tailwind CSS 4, Recharts |
| Auth | JWT (HS256) with passlib and bcrypt, multi-tenant, organization-scoped |
| Observability | Langfuse, LangSmith, OpenTelemetry, Prometheus, Sentry, structlog |
| Evaluation | LangSmith golden dataset with a CI gate, RAGAS, DeepEval |
| Exports | ReportLab for PDF, openpyxl for Excel |
| External integrations | Swiggy MCP (Food, Instamart, Dineout), Open-Meteo (weather), curated RSS (industry trends), FSSAI public notices (regulatory alerts), Twilio (WhatsApp vendor messages) |
| Local infrastructure | Docker Compose: PostgreSQL, Qdrant, Redis |

---

## Compliance note

CortexKitchen operates under a signed Integration Agreement with Swiggy Limited (Individual Developer partner, effective 2026-07-09, one-year term). The full agreement text is not committed to this repository. Two conflicts between the agreement and earlier product decisions were identified and remediated:

- A prohibited competitive-intelligence pattern (named competitor restaurants, prices, and deals surfaced in the market intelligence feature) was replaced with area-level aggregates only.
- An exclusivity conflict (a stub connector referencing a competing platform) was removed entirely, along with all references to it in the provider registry and connector type enum.

The consumer-facing Guest Concierge side of the platform is gated on separate written consent from Swiggy and has not started. `CLAUDE.md` is the authoritative record of this compliance work; it is not duplicated here.

---

## Project status

| Phase | Status | Notes |
|-------|--------|-------|
| Phase 0 | Complete | Architecture, PRD, system design, data model, API contracts |
| Phase 1 | Complete | FastAPI, initial LangGraph pipeline, domain services, dashboard |
| Phase 2 | Complete | Prophet forecasting, inventory alerts, menu intelligence |
| Phase 3 | Complete | Multi-scenario runner, run history, critic scoring |
| Phase 4 | Complete | Auth, LangSmith, health checks, structured logging, cost tracking, evals, MCP server |
| Phase 5 | Complete | PDF/Excel export, SSE streaming, Redis cache, what-if simulator, OpenTelemetry, Sentry, multi-tenant isolation, chat assistant |
| Phase 6A | In progress | Compliance remediation, Action Queue and trust ladder, financial scorecard, live intelligence signals, dynamic scenario composition, Langfuse and Kindred replay, dashboard and planning IA redesign |
| Phase 6A, upcoming | Planned | Autonomous procurement loop end to end, Instamart event supplies in the operator chat assistant, a voice interface (transcription and spoken response), promoting RAGAS/DeepEval candidates into the golden evaluation set |
| Phase 6B | Not started | Guest Concierge, gated on Swiggy's written consent |

---

## Repository structure

```
apps/
  api/                          FastAPI backend
    app/
      api/routes/               auth, planning, market, business, action_queue,
                                 connectors, chat, runs, restaurant_profiles,
                                 settings, health, replay
      domain/services/          forecasting, scenario composition, market
                                 intelligence, action execution, trust ladder,
                                 chat, critic, evaluation sanity checks, and more
      orchestration/            LangGraph graph definition, nodes, shared state
      infrastructure/           database models, LLM providers, Swiggy MCP
                                 client, Qdrant, Redis, PDF, Excel
    evals/                      RAGAS and DeepEval quality eval suites
    mcp_server.py                MCP stdio server for Claude integration
  web/cortexkitchen-ui/         Next.js 16 frontend
    app/                        page routes
    components/                 layout, dashboard, planning, analytics, data,
                                 chat, and shared UI components
    hooks/                      data-fetching and streaming hooks

data/                           raw, processed, and seeded datasets
docs/                           architecture, API reference, agents, roadmap,
                                 evaluation, product modes, decisions
infra/                          local infrastructure setup
scripts/                        seed_demo_data.py, seed_qdrant_memory.py,
                                 build_golden_dataset.py, and dataset-refresh
                                 scripts for evals
docker-compose.yml               local stack: PostgreSQL, Qdrant, Redis
.mcp.json                        Claude Code MCP auto-discovery config
```

---

## Local setup

### Prerequisites

- Docker and Docker Compose
- Python 3.11+
- Node.js 18+
- A Groq API key, free at [console.groq.com](https://console.groq.com)

### 1. Start infrastructure

```bash
docker compose up -d
```

Starts PostgreSQL 16 (port 5432), Qdrant (port 6333), and Redis (port 6379).

### 2. Configure the backend

```bash
cd apps/api
cp .env.example .env
```

Edit `.env`:

```env
LLM_PROVIDER=groq
GROQ_API_KEY=your_groq_key_here

# Optional, used as automatic fallback when Groq fails
GEMINI_API_KEY=your_gemini_key_here

JWT_SECRET_KEY=change-me-in-production

# Optional, enables LangSmith per-node tracing
LANGSMITH_TRACING=true
LANGSMITH_API_KEY=your_langsmith_key

# Optional, enables Langfuse tracing and the Kindred replay endpoint
LANGFUSE_PUBLIC_KEY=your_langfuse_public_key
LANGFUSE_SECRET_KEY=your_langfuse_secret_key
LANGFUSE_HOST=https://cloud.langfuse.com

# Optional, enables Sentry exception capture
SENTRY_DSN=your_sentry_dsn

# Optional, CometAPI per-node model tier routing
COMETAPI_KEY=your_cometapi_key_here
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
python ../../scripts/seed_demo_data.py
python ../../scripts/seed_qdrant_memory.py
```

### 4. Start the backend

```bash
uvicorn app.main:app --reload --reload-exclude "tests/*" --reload-exclude ".pytest_cache/*" --reload-exclude "*.pyc" --reload-exclude ".coverage*" --reload-exclude "htmlcov/*"
```

API at `http://localhost:8000`, Swagger at `http://localhost:8000/docs`.

> Some Swiggy-backed endpoints, for example `/market/pulse`, can take up to
> around fifteen seconds on a cold cache. Editing backend files during that
> window can kill the in-flight request via `--reload`, which the browser
> reports as a misleading CORS error even though CORS is configured
> correctly. The `--reload-exclude` flags above reduce that; still avoid
> saving backend source files while a slow request is in flight.

### 5. Start the frontend

```bash
cd apps/web/cortexkitchen-ui
npm install
npm run dev
```

Frontend at `http://localhost:3000`.

### 6. Register and log in

Go to `http://localhost:3000/register`, create a workspace, then log in. All planning routes are auth-protected and organization-scoped.

---

## API surface

The tables below cover the routes most relevant to getting started. See [`docs/APIS.md`](docs/APIS.md) for the complete reference, including request and response schemas.

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `POST` | `/api/v1/auth/register` | Public | Register user and organization |
| `POST` | `/api/v1/auth/login` | Public | Get a JWT access token |
| `GET` | `/api/v1/health` | Public | Liveness check |
| `GET` | `/api/v1/health/circuits` | Public | Swiggy MCP circuit breaker state |
| `GET` | `/api/v1/planning/scenarios` | JWT | List scenario presets |
| `POST` | `/api/v1/planning/scenario-from-text` | JWT | Turn a free-text description into a structured scenario profile |
| `GET` | `/api/v1/planning/compose-live-scenario` | JWT | Compose a scenario profile from live signals for right now |
| `POST` | `/api/v1/planning/run` | JWT | Execute the planning pipeline, full JSON response |
| `POST` | `/api/v1/planning/stream` | JWT | Execute the planning pipeline over server-sent events |
| `POST` | `/api/v1/planning/whatif` | JWT | Deterministic what-if demand simulator, no LLM call |
| `GET` | `/api/v1/market/pulse` | JWT | Live Swiggy market intelligence plus weather, trends, and compliance signals |
| `GET` | `/api/v1/business/performance` | JWT | Revenue, margin, and health-score analytics |
| `GET` | `/api/v1/action-queue` | JWT | List pending, approved, rejected, and executed actions |
| `POST` | `/api/v1/action-queue/{id}/approve` | JWT | Approve an action, executing it in the same step where applicable |
| `GET` | `/api/v1/runs` | JWT | List persisted planning runs |
| `GET` | `/api/v1/runs/{id}/export` | JWT | Download the PDF chef brief |
| `GET` | `/api/v1/runs/{id}/export/excel` | JWT | Download the Excel workbook |
| `POST` | `/api/v1/chat` | JWT | Chat assistant over run history, server-sent events |
| `GET` | `/api/v1/data-health` | JWT | Data coverage and scenario coverage |
| `GET/PATCH` | `/api/v1/settings` | JWT | Get or update organization settings |
| `POST` | `/replay` | Public, Kindred metadata | Single-generation LLM replay for Kindred debugging, mounted outside `/api/v1` |
| `GET` | `/metrics` | Public | Prometheus scrape endpoint |

---

## MCP integration

The `.mcp.json` in the project root wires up the MCP server automatically in Claude Code, exposing planning, market, and Action Queue tools: `run_planning_scenario`, `get_run_history`, `get_market_brief`, `get_action_queue`, and `approve_action`.

For Claude Desktop, copy `docs/mcp_claude_desktop_config.json` into your `claude_desktop_config.json`.

---

## Running tests

```bash
cd apps/api

# Unit and integration
pytest tests/ -q --ignore=tests/integration/test_langgraph_flow.py

# LangSmith regression evals, requires GROQ_API_KEY
python ../../scripts/build_golden_dataset.py
pytest tests/unit/test_langsmith_evals.py -v

# RAGAS and DeepEval quality evals
pytest evals/test_ragas_complaint.py -v -W ignore::DeprecationWarning
pytest evals/test_deepeval_quality.py -v -W ignore::DeprecationWarning
```

---

## Documentation

| Document | Contents |
|----------|---------|
| [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) | Full system architecture and graph topology |
| [`docs/APIS.md`](docs/APIS.md) | Complete API reference with request and response schemas |
| [`docs/AGENTS.md`](docs/AGENTS.md) | Orchestration node descriptions, including the chat agent |
| [`docs/EVALUATION.md`](docs/EVALUATION.md) | LangSmith evals, RAGAS, DeepEval, and observability |
| [`docs/ROADMAP.md`](docs/ROADMAP.md) | Phase-by-phase delivery history |
| [`docs/DATA_MODEL.md`](docs/DATA_MODEL.md) | PostgreSQL schema and Qdrant collections |
| [`docs/DECISIONS.md`](docs/DECISIONS.md) | Architecture decision log |
| [`docs/PRODUCT_MODES.md`](docs/PRODUCT_MODES.md) | Scenario and product mode specifications |
| [`CLAUDE.md`](CLAUDE.md) | Working reference for the current state of the codebase, including the Swiggy compliance record |

---

## License

MIT, see [LICENSE](LICENSE).
