# CortexKitchen Documentation

Last updated: June 2026. Phase 5 complete.

All documents in this folder reflect the implemented codebase.

---

## Documents

| File | Contents |
|------|---------|
| [`ARCHITECTURE.md`](ARCHITECTURE.md) | Full system architecture — graph topology, SSE streaming, Redis caching, multi-tenant isolation, observability stack, Phase 5 additions |
| [`AGENTS.md`](AGENTS.md) | All nine LangGraph orchestration nodes + the RAG chat agent |
| [`APIS.md`](APIS.md) | Complete API reference — all endpoints including exports, chat, observability, and Prometheus |
| [`DATA_MODEL.md`](DATA_MODEL.md) | PostgreSQL schema and Qdrant collections |
| [`EVALUATION.md`](EVALUATION.md) | LangSmith golden dataset + CI gate, RAGAS, DeepEval, observability |
| [`ROADMAP.md`](ROADMAP.md) | Phase-by-phase delivery history — Phases 0–5 complete |
| [`DECISIONS.md`](DECISIONS.md) | Architecture decision log |
| [`PRD.md`](PRD.md) | Product requirements document |
| [`IMPLEMENTATION_PLAN.md`](IMPLEMENTATION_PLAN.md) | Delivery plan with completed milestones |

---

## What's new (post Phase 5)

- **Per-node model tier routing** — CometAPI integration routes each LangGraph node to the right model tier (fast / balanced / strong) via a single key. The critic always gets `claude-sonnet-4-6`; simpler nodes get `deepseek-v4-flash`. Fully opt-in via `COMET_TIERED=true`. See `docs/ARCHITECTURE.md` for the full tier table and fallback chain design.

---

## What Phase 5 added

- **PDF + Excel export** — chef brief and owner workbook per planning run
- **SSE streaming** — `node_complete` status events update the loading screen pipeline diagram in real time; full plan delivered in a single `complete` event
- **Redis caching** — 1hr TTL plan cache; zero LLM cost on repeat runs same day
- **What-if simulator** — instant cover count adjustment without a full re-run
- **OpenTelemetry + Prometheus** — HTTP tracing and `/metrics` scrape endpoint
- **Sentry** — unhandled exception capture with LangGraph node tags
- **LangSmith regression evals** — `cortexkitchen-golden-v1` dataset (50 runs), 90% CI gate
- **Multi-tenant workspace isolation** — Postgres `org_id` scoping + Qdrant payload filter per org
- **RAG chatbot** — `POST /api/v1/chat` SSE; AsyncGroq streaming; answers from real run data
- **Prelaunch polish** — homepage pipeline redesign, professional footer, prompt refinements
