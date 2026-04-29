# CortexKitchen

CortexKitchen is a local-first restaurant operations planning system built around a multi-agent workflow. It combines forecasting, reservation pressure analysis, complaint retrieval, menu guidance, inventory checks, and a critic layer that reviews recommendations before they are presented in the UI.

Status snapshot: April 29, 2026.

## What is implemented today

- FastAPI backend with health, planning, runs, and data-health endpoints
- LangGraph-based orchestration for multiple service-planning scenarios
- Scenario presets for `friday_rush`, `weekday_lunch`, `holiday_spike`, and `low_stock_weekend`
- Persisted planning runs with critic verdicts and audit detail
- Next.js dashboard with run history and data-health views
- Local Docker Compose stack for PostgreSQL, Qdrant, and Redis
- Synthetic seed data, Qdrant memory seeding, and backend unit/integration coverage

## What is not finished yet

- Production deployment and hardening
- Authentication and multi-tenant access control
- Real POS, reservations, or review-platform integrations
- Shared runtime code in `packages/core`
- Broader scenario coverage beyond the current four presets

## Repository layout

- `apps/api` - FastAPI backend, orchestration, services, DB models, tests
- `apps/web/cortexkitchen-ui` - Next.js frontend
- `data` - raw, seed, and processed dataset folders
- `docs` - architecture, API, roadmap, evaluation, and implementation notes
- `infra` - local infrastructure documentation
- `scripts` - local seed and retrieval scripts
- `tests` - cross-project test documentation
- `packages/core` - reserved shared package, currently a placeholder

## Local setup

### 1. Start infrastructure

```bash
docker compose up -d
```

### 2. Start the API

```bash
cd apps/api
python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt
alembic upgrade head
python ..\..\scripts\seed_demo_data.py
python ..\..\scripts\seed_qdrant_memory.py
uvicorn app.main:app --reload
```

### 3. Start the frontend

```bash
cd apps/web/cortexkitchen-ui
npm install
npm run dev
```

Frontend default URL: `http://localhost:3000`

API default URL: `http://localhost:8000`

## Current API surface

- `GET /api/v1/health`
- `GET /api/v1/health/dependencies`
- `GET /api/v1/planning/scenarios`
- `POST /api/v1/planning/run`
- `POST /api/v1/planning/friday-rush`
- `GET /api/v1/runs`
- `GET /api/v1/runs/{run_id}`
- `GET /api/v1/data-health`

## Frontend views

- `/` - main planning dashboard
- `/runs` - persisted run inspection and critic audit trail
- `/data-health` - seeded data coverage and operational signal summary

## Notes on this doc refresh

This README was updated to match the codebase as it exists on April 29, 2026. It does not claim a fresh test run as part of this documentation-only update.
