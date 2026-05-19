# CortexKitchen

**Multi-agent restaurant operations planning system**

![Status](https://img.shields.io/badge/status-active-success)
![Phase](https://img.shields.io/badge/phase-3_complete-blue)
![Backend](https://img.shields.io/badge/backend-FastAPI-009688)
![Frontend](https://img.shields.io/badge/frontend-Next.js_16-black)
![Orchestration](https://img.shields.io/badge/orchestration-LangGraph-purple)
![Vector DB](https://img.shields.io/badge/vector_db-Qdrant-orange)
![Database](https://img.shields.io/badge/database-PostgreSQL_16-blue)
![License](https://img.shields.io/badge/license-MIT-lightgrey)

---

## What is CortexKitchen?

CortexKitchen is a multi-agent decision system for restaurant operations. It transforms fragmented service data — orders, reservations, complaints, menu performance, and inventory — into a structured pre-shift execution plan.

The system coordinates nine specialised pipeline nodes, validates the output through a critic layer, and persists every run for audit inspection.

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

**Reservation intelligence** — booking density analysis and overload window detection

**Complaint intelligence (RAG)** — Qdrant-backed retrieval of complaint patterns and SOPs matched to the scenario

**Menu guidance** — top vs weak item analysis with promotion strategy aligned to demand

**Inventory risk detection** — shortage and overstock alerts with feasibility-aware planning

**Critic layer** — validates every plan against business rules, scores across five dimensions (safety, feasibility, evidence, actionability, clarity), and provides revision feedback

**Audit trail** — all planning runs are persisted and queryable with full critic detail

---

## Product surface

| Page | URL | Purpose |
|------|-----|---------|
| Dashboard | `/` | Scenario selection, run submission, agent output cards, critic verdict |
| Runs | `/runs` | Historical runs with critic scores and full audit detail |
| Data health | `/data-health` | Seeded data coverage signals |

---

## System architecture

| Layer | Technology |
|-------|-----------|
| Backend API | FastAPI 0.115, Uvicorn, Pydantic v2 |
| Orchestration | LangGraph (StateGraph, nine nodes) |
| LLM | Google Gemini (default) or Groq — provider abstraction |
| Database | PostgreSQL 16 via SQLAlchemy + Alembic |
| Vector store | Qdrant (complaints and SOPs) |
| Forecasting | Prophet + Pandas |
| Frontend | Next.js 16.2, React 19, TypeScript, Tailwind CSS 4 |
| Local infra | Docker Compose (PostgreSQL, Qdrant, Redis) |

---

## Project status

| Phase | Status | Highlights |
|-------|--------|-----------|
| Phase 0 | Complete | Architecture, PRD, system design |
| Phase 1 | Complete | API, infra, core services, initial planning flow |
| Phase 2 | Complete | Forecasting, inventory, menu intelligence, dashboard |
| Phase 3 | Complete | Runs audit, critic scoring, multi-scenario support |
| Phase 4 | Planned | Auth, cloud deployment, async runs, observability |

---

## Repository structure

```
apps/
  api/                    # FastAPI backend (services, orchestration, DB)
  web/cortexkitchen-ui/   # Next.js 16 frontend

data/                     # Raw, processed, and seeded datasets
docs/                     # Architecture, API reference, data model, roadmap
infra/                    # Local infrastructure setup notes
scripts/                  # Seeding and retrieval utility scripts
packages/core/            # Shared contracts (planned)
docker-compose.yml        # Local stack: PostgreSQL, Qdrant, Redis
```

---

## Local setup

### Prerequisites

- Docker and Docker Compose
- Python 3.11+
- Node.js 18+
- A Gemini API key (free tier at [aistudio.google.com](https://aistudio.google.com)) or a Groq API key

### 1. Start infrastructure

```bash
docker compose up -d
```

This starts PostgreSQL 16 (port 5432), Qdrant (port 6333), and Redis 7 (port 6379) with persistent volumes.

### 2. Configure the backend

```bash
cd apps/api
cp .env.example .env
```

Edit `.env` and set your LLM API key:

```
LLM_PROVIDER=gemini
GEMINI_API_KEY=your_gemini_api_key_here
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

API available at `http://localhost:8000`  
Interactive docs at `http://localhost:8000/docs`

### 5. Start the frontend

```bash
cd apps/web/cortexkitchen-ui
npm install
npm run dev
```

Frontend available at `http://localhost:3000`

The frontend reads `NEXT_PUBLIC_API_BASE_URL` for the backend address. If that variable is not set, it defaults to `http://localhost:8000`.

---

## API surface

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/v1/health` | Application liveness |
| `GET` | `/api/v1/health/dependencies` | PostgreSQL, Qdrant, Redis status |
| `GET` | `/api/v1/planning/scenarios` | List scenario presets |
| `POST` | `/api/v1/planning/run` | Execute a planning scenario |
| `POST` | `/api/v1/planning/friday-rush` | Friday Rush alias (backward compat) |
| `GET` | `/api/v1/runs` | List persisted planning runs |
| `GET` | `/api/v1/runs/{id}` | Get planning run detail |
| `GET` | `/api/v1/data-health` | Seeded data coverage summary |

See [`docs/APIS.md`](docs/APIS.md) for full request/response schemas.

---

## Running tests

```bash
cd apps/api

# Unit tests
pytest tests/unit -q

# Integration tests (requires running Docker stack)
pytest tests/integration -q
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
| [`docs/EVALUATION.md`](docs/EVALUATION.md) | Evaluation criteria |
| [`docs/DECISIONS.md`](docs/DECISIONS.md) | Architecture decision log |

---

## Roadmap (Phase 4)

- Multi-tenant authentication
- Cloud deployment (containerisation, CI/CD)
- Async planning runs via Redis queue
- Real-world data integrations (POS, reservations, inventory platforms)
- Observability (latency tracking, LLM cost instrumentation)
- Configurable restaurant profiles

---

## License

MIT — see [LICENSE](LICENSE).
