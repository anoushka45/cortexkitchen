# CortexKitchen API

FastAPI backend for CortexKitchen — including all agent orchestration, services, and the Friday Rush planning endpoint.

## What's in here (Phase 1 complete)

- FastAPI app with settings, health endpoints, dependency health checks
- Docker Compose for Postgres, Qdrant, Redis
- SQLAlchemy DB models + Alembic migrations
- Seed data scripts (pizza-heavy, Friday-spike patterns)
- LLM provider layer — Gemini + Groq + base interface + prompt utilities
- Core domain services — forecast, reservations, complaints, critic
- Qdrant vector memory — complaint retrieval + SOP retrieval
- LangGraph orchestration graph — ops manager → fan-out agents → aggregator → critic → assembler
- Friday Rush planning endpoint (`POST /api/v1/planning/friday-rush`)
- Full test suite — unit, integration, and E2E

## Run locally

```bash
# Start infrastructure
docker compose up -d

# Install dependencies
pip install -r requirements.txt

# Run migrations + seed data
alembic upgrade head
python scripts/seed_demo_data.py
python scripts/seed_qdrant_memory.py

# Start API
uvicorn app.main:app --reload
```

## Available endpoints

- `GET /` — root
- `GET /api/v1/health` — health check
- `GET /api/v1/health/dependencies` — dependency health (Postgres, Qdrant, Redis)
- `POST /api/v1/planning/friday-rush` — Friday Rush orchestration (main demo endpoint)

## Running tests

```bash
# Unit + integration tests (no live infra needed)
pytest tests/unit -v

# Integration tests (requires Docker infra + .env)
pytest tests/integration -v
```