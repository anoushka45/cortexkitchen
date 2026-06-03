# CortexKitchen

**Multi-agent restaurant operations planning system**

![Status](https://img.shields.io/badge/status-active-success)
![Phase](https://img.shields.io/badge/phase-4_complete-blue)
![Backend](https://img.shields.io/badge/backend-FastAPI-009688)
![Frontend](https://img.shields.io/badge/frontend-Next.js_16-black)
![Orchestration](https://img.shields.io/badge/orchestration-LangGraph-purple)
![Vector DB](https://img.shields.io/badge/vector_db-Qdrant-orange)
![Database](https://img.shields.io/badge/database-PostgreSQL_16-blue)
![License](https://img.shields.io/badge/license-MIT-lightgrey)

---

## What is CortexKitchen?

CortexKitchen is a multi-agent decision system for restaurant operations. It transforms fragmented service data — orders, reservations, complaints, menu performance, and inventory — into a structured pre-shift execution plan.

The system coordinates nine specialised pipeline nodes, validates the output through a critic layer, and persists every run for audit inspection. It ships with multi-tenant auth, LangSmith tracing, structured logging, LLM cost tracking, configurable restaurant profiles, and an MCP server so Claude can trigger planning runs directly.

> Not a chatbot. A structured planning workflow.

![ck dashboard](<docs/images/home page ck.png>)

---

## How it works

One planning run executes the following sequence:

1. Validate scenario and frame operational context
2. Forecast demand and service pressure (Prophet time-series)
3. Analyse reservations and occupancy risk (parallel)
4. Retrieve complaint patterns and SOPs via RAG — Qdrant (parallel)
5. Evaluate menu performance (parallel)
6. Check inventory feasibility and shortage alerts (parallel)
7. Aggregate all domain outputs
8. Critic scores and validates the plan (5-dimension scoring)
9. Return an actionable pre-shift execution plan

---

## Core capabilities

**Multi-scenario planning** — four scenario presets with distinct operational framing:
- `friday_rush` — peak dinner demand, 18:00–22:00
- `weekday_lunch` — midday service, 12:00–15:00
- `holiday_spike` — demand surge, 17:00–22:00
- `low_stock_weekend` — constrained inventory, 18:00–22:00

**Demand forecasting** — Prophet-backed time-series model with peak detection and service-pressure estimation

**Complaint intelligence (RAG)** — Qdrant-backed retrieval of complaint patterns and SOPs matched to the scenario; retrieved context feeds the LLM prompt so recommendations are grounded in real past issues

**Menu guidance** — top vs weak item analysis with promotion strategy aligned to demand

**Inventory risk detection** — shortage and overstock alerts with feasibility-aware planning

**Critic layer** — validates every plan against business rules, scores across five dimensions (safety, feasibility, evidence, actionability, clarity), and provides revision feedback

**Audit trail** — all planning runs are persisted with full critic detail, LLM cost, token count, and node-level latency

**Multi-tenant auth** — JWT-based authentication; org-scoped planning runs and settings

**Configurable restaurant profiles** — per-org restaurant profiles (name, cuisine, capacity, peak hours) injected into every planning prompt

**LLM provider abstraction** — swap between Groq and Gemini via `LLM_PROVIDER` env var; automatic fallback if the primary provider fails

**LLM quality evals** — RAGAS faithfulness eval on the complaint RAG pipeline (threshold ≥ 0.8); DeepEval hallucination and relevancy checks on critic and agent outputs

**MCP server** — expose `run_planning_scenario` and `get_run_history` as MCP tools; works with Claude Code CLI and Claude Desktop out of the box

---

## Product surface

| Page | URL | Purpose |
|------|-----|---------|
| Dashboard | `/` | Scenario selection, run submission, agent output cards, critic verdict |
| Runs | `/runs` | Historical runs with scenario filter, date range, critic score trend, diff view |
| Settings | `/settings` | Tenant config — capacity, peak hours, thresholds |
| Restaurant Profiles | `/restaurant-profiles` | Manage per-org restaurant profiles |
| Login / Register | `/login`, `/register` | JWT auth flow |

---

## System architecture

| Layer | Technology |
|-------|-----------|
| Backend API | FastAPI 0.115, Uvicorn, Pydantic v2 |
| Orchestration | LangGraph (StateGraph, nine nodes) |
| LLM | Groq (default) or Gemini — pluggable via `LLM_PROVIDER`; auto-fallback |
| Database | PostgreSQL 16 via SQLAlchemy + Alembic |
| Vector store | Qdrant (complaints and SOPs) |
| Forecasting | Prophet + Pandas |
| Frontend | Next.js 16.2, React 19, TypeScript, Tailwind CSS 4 |
| Auth | JWT (HS256) + passlib/bcrypt — multi-tenant, org-scoped |
| Observability | LangSmith tracing, structlog JSON logging, per-node latency, LLM cost tracking |
| Evals | RAGAS (complaint RAG faithfulness), DeepEval (critic hallucination + agent relevancy) |
| MCP | Anthropic MCP SDK — `run_planning_scenario` + `get_run_history` tools |
| Local infra | Docker Compose (PostgreSQL, Qdrant, Redis) |

---

## Project status

| Phase | Status | Highlights |
|-------|--------|-----------|
| Phase 0 | Complete | Architecture, PRD, system design |
| Phase 1 | Complete | API, infra, core services, initial planning flow |
| Phase 2 | Complete | Forecasting, inventory, menu intelligence, dashboard |
| Phase 3 | Complete | Runs audit, critic scoring, multi-scenario support |
| Phase 4 | Complete | Auth, observability, evals, LLM swap, restaurant profiles, MCP server |

---

## Repository structure

```
apps/
  api/                    # FastAPI backend (services, orchestration, DB)
    evals/                # RAGAS + DeepEval quality eval suites
    mcp_server.py         # MCP stdio server for Claude integration
  web/cortexkitchen-ui/   # Next.js 16 frontend

data/                     # Raw, processed, and seeded datasets
docs/                     # Architecture, API reference, data model, roadmap
infra/                    # Local infrastructure setup notes
scripts/                  # Seeding and retrieval utility scripts
packages/core/            # Shared contracts (planned)
docker-compose.yml        # Local stack: PostgreSQL, Qdrant, Redis
.mcp.json                 # Claude Code MCP server config (auto-discovered)
```

---

## Local setup

### Prerequisites

- Docker and Docker Compose
- Python 3.11+
- Node.js 18+
- A Groq API key (free at [console.groq.com](https://console.groq.com)) — or a Gemini API key

### 1. Start infrastructure

```bash
docker compose up -d
```

Starts PostgreSQL 16 (port 5432), Qdrant (port 6333), and Redis 7 (port 6379) with persistent volumes.

### 2. Configure the backend

```bash
cd apps/api
cp .env.example .env
```

Edit `.env` with your keys:

```env
LLM_PROVIDER=groq
GROQ_API_KEY=your_groq_key_here

# Optional — used as fallback when primary provider fails
GEMINI_API_KEY=your_gemini_key_here

JWT_SECRET_KEY=change-me-in-production
```

The remaining defaults work with the Docker Compose stack as-is.

### 3. Install and seed the backend

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

API at `http://localhost:8000` · Docs at `http://localhost:8000/docs`

### 5. Start the frontend

```bash
cd apps/web/cortexkitchen-ui
npm install
npm run dev
```

Frontend at `http://localhost:3000`

### 6. Register and log in

Open `http://localhost:3000/register`, create an account, then log in. All planning routes are auth-protected.

---

## MCP integration (Claude Code / Claude Desktop)

The `.mcp.json` in the project root wires up the MCP server automatically when you open this project in Claude Code. On first open you'll be prompted to approve the `cortexkitchen` server.

Set `CORTEX_EMAIL` and `CORTEX_PASSWORD` in `.mcp.json` to match a registered user, then:

```
# From Claude Code CLI
run a friday rush planning scenario
show me the last 5 planning runs filtered to approved verdicts
```

For Claude Desktop, copy `docs/mcp_claude_desktop_config.json` into your `claude_desktop_config.json`.

---

## API surface

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `POST` | `/api/v1/auth/register` | Public | Register a new user and org |
| `POST` | `/api/v1/auth/login` | Public | Get a JWT access token |
| `GET` | `/api/v1/health` | Public | Application liveness |
| `GET` | `/api/v1/health/dependencies` | Public | PostgreSQL, Qdrant, Redis status |
| `GET` | `/api/v1/planning/scenarios` | Public | List scenario presets |
| `POST` | `/api/v1/planning/run` | JWT | Execute a planning scenario |
| `GET` | `/api/v1/runs` | JWT | List persisted planning runs |
| `GET` | `/api/v1/runs/{id}` | JWT | Get planning run detail |
| `GET` | `/api/v1/settings` | JWT | Get org settings |
| `PUT` | `/api/v1/settings` | JWT | Update org settings |
| `GET` | `/api/v1/restaurant-profiles` | JWT | List restaurant profiles |
| `POST` | `/api/v1/restaurant-profiles` | JWT | Create a restaurant profile |
| `PUT` | `/api/v1/restaurant-profiles/{id}` | JWT | Update a restaurant profile |
| `DELETE` | `/api/v1/restaurant-profiles/{id}` | JWT | Delete a restaurant profile |

See [`docs/APIS.md`](docs/APIS.md) for full request/response schemas.

---

## Running tests

```bash
cd apps/api

# Unit + integration tests
pytest tests/ -q --ignore=tests/integration/test_langgraph_flow.py

# LLM quality evals (requires GROQ_API_KEY — live LLM calls)
pytest evals/test_ragas_complaint.py -v -W ignore::DeprecationWarning
pytest evals/test_deepeval_quality.py -v -W ignore::DeprecationWarning
```

---

## Documentation

| Document | Contents |
|----------|---------|
| [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) | System design, graph topology, data flow |
| [`docs/APIS.md`](docs/APIS.md) | Full API reference with request/response schemas |
| [`docs/AGENTS.md`](docs/AGENTS.md) | Orchestration node descriptions and graph wiring |
| [`docs/DATA_MODEL.md`](docs/DATA_MODEL.md) | PostgreSQL schema and Qdrant collections |
| [`docs/ROADMAP.md`](docs/ROADMAP.md) | Project status and planned work |
| [`docs/DECISIONS.md`](docs/DECISIONS.md) | Architecture decision log |
| [`docs/mcp_claude_desktop_config.json`](docs/mcp_claude_desktop_config.json) | Claude Desktop MCP config snippet |

---

## License

MIT — see [LICENSE](LICENSE).
