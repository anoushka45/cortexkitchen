# CortexKitchen Documentation

Reflects Phase 6A in progress. All documents in this folder describe the implemented codebase, not aspirational scope.

---

## Documents

| File | Contents |
|------|---------|
| [`ARCHITECTURE.md`](ARCHITECTURE.md) | Full system architecture: graph topology, SSE streaming, caching, multi-tenant isolation, observability stack, frontend structure |
| [`AGENTS.md`](AGENTS.md) | All fourteen LangGraph orchestration nodes plus the chat agent |
| [`APIS.md`](APIS.md) | Complete API reference: every endpoint including planning, market, business, action queue, exports, chat, replay, and observability |
| [`DATA_MODEL.md`](DATA_MODEL.md) | PostgreSQL schema and Qdrant collections |
| [`EVALUATION.md`](EVALUATION.md) | Test suite, LangSmith golden dataset and CI gate, RAGAS, DeepEval, observability |
| [`PRODUCT_MODES.md`](PRODUCT_MODES.md) | Scenario intake modes: presets, natural-language scenario text, and live dynamic composition |
| [`SWIGGY_INTEGRATION.md`](SWIGGY_INTEGRATION.md) | Swiggy MCP tool reference, response schemas, and compliance constraints |
| [`ROADMAP.md`](ROADMAP.md) | Phase-by-phase delivery history |
| [`DECISIONS.md`](DECISIONS.md) | Architecture decision log |
| [`PRD.md`](PRD.md) | Product requirements document |
| [`IMPLEMENTATION_PLAN.md`](IMPLEMENTATION_PLAN.md) | Delivery plan and milestone tracking |

For the current task-level status and the Swiggy Integration Agreement compliance summary, see `CLAUDE.md` at the repository root; it is the source of truth for in-progress work.

---

## Current state summary

- The planning pipeline is a fourteen-node LangGraph graph: `ops_manager`, `live_signals`, `demand_forecast`, `qdrant_enrichment`, a five-way parallel fan-out (`reservation`, `complaint_intelligence`, `inventory`, `market_intel`, `dineout_manager`), `menu_intelligence`, `aggregator`, `critic`, `replan_orchestrator`, `final_assembler`.
- Live intelligence signals (weather and holidays, industry trends, regulatory alerts) are fetched independently of the Swiggy MCP and merged into the planning pipeline alongside anonymised Swiggy market signals.
- Scenario intake supports four presets, free-form natural-language scenario text, and live dynamic composition from current signals.
- The frontend information architecture splits Dashboard (daily overview) and Planning (the flagship trigger-and-watch experience) into separate pages, with a dedicated Action Center, Analytics page, and a merged Data page.
- An Action Queue with a trust-ladder mechanic exists today; the fully wired autonomous procurement loop (shortage detection through real Instamart checkout) is upcoming work, tracked in `CLAUDE.md`.
- Langfuse tracing is wired into every planning run, with a Kindred replay endpoint for single-generation prompt replay debugging.
