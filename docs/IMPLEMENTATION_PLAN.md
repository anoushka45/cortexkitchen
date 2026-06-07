# CortexKitchen Implementation Plan

Last updated: June 2026. Phase 5 complete.

---

## Delivered — Phases 0–5

### Phase 0 — Design
- Architecture, PRD, system design, data model, API contracts, evaluation rubric

### Phase 1 — Core system
- Docker Compose stack (PostgreSQL, Qdrant, Redis)
- FastAPI backend with health, planning, runs, and data-health endpoints
- SQLAlchemy ORM models and Alembic migrations
- Seed scripts for demo data and Qdrant memory
- LangGraph nine-node orchestration graph with parallel fan-out
- All domain services (Forecast, Reservation, Complaint, Menu, Inventory, Critic)
- Frontend dashboard, runs page, and data-health page

### Phase 2 — Intelligence
- Prophet time-series demand forecasting with peak detection
- Inventory shortage/overstock alerts
- Menu intelligence with promotion strategy
- Dashboard with scenario framing, agent output cards, critic verdict banner

### Phase 3 — Multi-scenario
- Shared scenario runner (four presets)
- Persisted planning runs with full audit inspection
- CriticService with cost-aware scoring and revision feedback
- Runs page with full audit trail

### Phase 4 — Productisation
- Multi-tenant JWT auth (users, orgs, org-scoped sessions)
- LangSmith per-node tracing
- Real health checks for all dependencies
- structlog JSON logging across all nodes
- LLM cost tracking per call and per run
- Settings and restaurant profiles UI + API
- LLM provider abstraction with Groq↔Gemini auto-fallback
- RAGAS + DeepEval quality evals
- MCP server for Claude Code / Claude Desktop

### Phase 5 — Export, UX, Observability & Intelligence
- PDF export (ReportLab chef brief)
- Excel export (openpyxl multi-sheet owner workbook)
- Design polish — ember accent palette, Instrument Serif display font
- Frontend UX fixes — profile selector, validation, cost aggregates
- Redis plan caching — 1hr TTL, `cache_hit` flag
- SSE streaming — `node_complete` status events drive the loading screen pipeline diagram; full plan delivered in single `complete` event via `/planning/stream`
- What-if simulator — cover count slider, instant score update
- OpenTelemetry + Prometheus — `/metrics` scrape endpoint
- Sentry error capture with LangGraph node tags
- LangSmith regression evals — `cortexkitchen-golden-v1` (50 runs), 90% CI gate
- Multi-tenant workspace isolation — Postgres `org_id` scoping + Qdrant payload filter
- RAG chatbot — `POST /api/v1/chat` SSE, AsyncGroq, ReactMarkdown
- Prelaunch polish — homepage redesign, professional footer, prompt_utils centralisation

---

## Current state

All five phases are complete. The system is production-ready for demo and portfolio use.

Outstanding known gaps:
- All data is synthetic — no live POS, reservation system, or supplier integrations
- `packages/core` is empty — shared types between frontend and backend are not yet extracted
- RAGAS/DeepEval datasets are hand-crafted — should be rebuilt from live runs periodically

---

## Phase 6 — Planned

- Real data connectors — CSV/POS import (Square/Toast); map to existing orders schema
- Live reservation sync — OpenTable/Resy webhook
- Scheduled weekly digest email — PDF attached, APScheduler + SendGrid
- Mobile-responsive dashboard
- Role-based access control — differentiated views for owner vs floor manager
