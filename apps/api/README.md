# CortexKitchen API

FastAPI backend for CortexKitchen. This app owns the orchestration entrypoints, domain services, DB models, run persistence, and backend test suite.

## Current backend scope

- Health and dependency health endpoints
- Shared planning endpoint for multiple scenario presets
- Legacy Friday Rush route kept for backward compatibility
- Persisted planning run list and detail endpoints
- Data-health summary endpoint for seeded operational coverage
- LangGraph orchestration with forecast, reservation, complaint, menu, inventory, aggregator, critic, and final-assembly stages

## Active scenario presets

- `friday_rush`
- `weekday_lunch`
- `holiday_spike`
- `low_stock_weekend`

## Main routes

- `GET /`
- `GET /api/v1/health`
- `GET /api/v1/health/dependencies`
- `GET /api/v1/planning/scenarios`
- `POST /api/v1/planning/run`
- `POST /api/v1/planning/friday-rush`
- `GET /api/v1/runs`
- `GET /api/v1/runs/{run_id}`
- `GET /api/v1/data-health`

## Local run flow

```bash
python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt
alembic upgrade head
python ..\..\scripts\seed_demo_data.py
python ..\..\scripts\seed_qdrant_memory.py
uvicorn app.main:app --reload
```

## Configuration

Important settings come from `.env`:

- `APP_NAME`
- `APP_ENV`
- `APP_DEBUG`
- `API_V1_PREFIX`
- `POSTGRES_URL`
- `QDRANT_URL`
- `REDIS_URL`
- `LLM_PROVIDER`
- `GEMINI_API_KEY`
- `GROQ_API_KEY`

## Tests

Backend tests live in `apps/api/tests` and are split into:

- `tests/unit`
- `tests/integration`

Example commands:

```bash
venv\Scripts\python -m pytest tests\unit -q
venv\Scripts\python -m pytest tests\integration -q
```

This README reflects the current route and feature set, but it does not certify that tests were re-run during this doc update.
