# CortexKitchen Roadmap

Status snapshot: April 29, 2026.

## Completed

- Local Docker Compose stack for PostgreSQL, Qdrant, and Redis
- FastAPI application scaffold and health endpoints
- SQLAlchemy models and Alembic migrations
- Seed scripts for demo data and Qdrant memory
- LLM provider abstraction with Gemini and Groq support points
- LangGraph orchestration for service-planning workflows
- Forecast, reservation, complaint, menu, inventory, and critic service layers
- Scenario-aware planning endpoint
- Frontend dashboard, runs page, and data-health page
- Planning run persistence and audit inspection
- Backend unit and integration test structure

## In progress

- Making docs reflect the post-Phase-2 codebase instead of the original build plan
- Expanding scenario coverage beyond the original Friday-only framing
- Tightening the relationship between critic outputs, audit visibility, and operator-facing summaries

## Next

- Production-readiness work such as auth, deployment, and environment hardening
- Stronger run filtering and richer audit exploration in the UI
- More realistic external data ingestion paths
- Shared cross-app contracts in `packages/core`
- Additional planning scenarios and more explicit scenario-specific business rules

## Known gaps

- The repo is still local-first and demo-first
- No cloud deployment path is documented here yet
- Real platform integrations are not part of the current implementation
