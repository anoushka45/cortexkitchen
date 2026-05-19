# CortexKitchen Roadmap

Status snapshot: May 2026.

---

## Completed

- Local Docker Compose stack for PostgreSQL, Qdrant, and Redis
- FastAPI application with health, planning, runs, and data-health endpoints
- SQLAlchemy ORM models and Alembic migrations
- Seed scripts for demo data (`seed_demo_data.py`) and Qdrant memory (`seed_qdrant_memory.py`)
- LLM provider abstraction with Gemini and Groq backends
- LangGraph nine-node orchestration graph with parallel fan-out
- ForecastService with Prophet time-series forecasting
- ReservationService, ComplaintService, MenuService, and InventoryService
- CriticService with five-dimension scoring, cost analysis, and sanity checks
- Scenario-aware planning endpoint supporting four scenario presets
- Persisted planning runs with full audit inspection via `/runs`
- Frontend dashboard, runs page, and data-health page
- Backend unit and integration test structure
- Documentation rewritten to reflect implemented codebase (all major docs updated May 2026)

---

## Next

- Production-readiness: authentication, environment hardening, secrets management
- Cloud deployment: containerisation, Railway/Fly.io/cloud-run deployment path, CI/CD
- Stronger audit exploration in the UI: filtering, comparison, diff views
- Async planning runs via Redis queue (non-blocking execution)
- Shared cross-app contracts in `packages/core`
- Additional scenario presets and more explicit scenario-specific business rules
- Observability: latency tracking, LLM cost instrumentation, trace export

---

## Known gaps

- No production security model or authentication
- No cloud deployment path documented or implemented
- Real platform integrations (POS, Zomato, Google Reviews) are not part of the current implementation — all data is synthetic
- `packages/core` is empty; types are not yet shared between frontend and backend
- Redis is present but not yet used beyond connectivity health checks
