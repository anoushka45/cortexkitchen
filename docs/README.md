# CortexKitchen Documentation

Last updated: June 2026. Phase 6 in progress.

All documents in this folder reflect the implemented codebase.

---

## Documents

| File | Contents |
|------|---------|
| [`ARCHITECTURE.md`](ARCHITECTURE.md) | Full system architecture — graph topology, SSE streaming, Redis caching, multi-tenant isolation, observability stack, Phase 5 additions |
| [`AGENTS.md`](AGENTS.md) | All twelve LangGraph orchestration nodes + the RAG chat agent |
| [`APIS.md`](APIS.md) | Complete API reference — all endpoints including exports, chat, observability, and Prometheus |
| [`DATA_MODEL.md`](DATA_MODEL.md) | PostgreSQL schema and Qdrant collections |
| [`EVALUATION.md`](EVALUATION.md) | LangSmith golden dataset + CI gate, RAGAS, DeepEval, observability |
| [`ROADMAP.md`](ROADMAP.md) | Phase-by-phase delivery history — Phases 0–5 complete |
| [`DECISIONS.md`](DECISIONS.md) | Architecture decision log |
| [`PRD.md`](PRD.md) | Product requirements document |
| [`IMPLEMENTATION_PLAN.md`](IMPLEMENTATION_PLAN.md) | Delivery plan with completed milestones |

---

## What's new (Phase 6 — in progress)

### Graph
- **3 new LangGraph nodes** — `qdrant_enrichment` (retrieves past approved-run insights from `planning_memory` before the fan-out), `phase1_sync` (Pregel barrier to prevent double-aggregator bug), `replan_orchestrator` (injects critic feedback and drives up to 2 revision cycles). Graph is now 12 nodes.

### Intelligence & memory
- **PlanningMemoryService** — stores approved run insights in Qdrant `planning_memory` collection; recency decay scoring (`score × 2^(-age/14days)`, 90-day cutoff) so recent runs rank above older ones
- **SemanticPlanCache (Qdrant)** — Qdrant-backed plan cache (`semantic_cache` collection); 0.92 cosine similarity, 1hr TTL; only `approved` plans written; storage embedding enriched with actual run conditions (demand_ratio, occupancy, shortages) for higher-precision retrieval
- **SemanticChatCache** — Qdrant-backed Q&A cache for the chatbot (`chat_semantic_cache`); 24hr TTL; 0.92 similarity threshold

### Swiggy MCP governance
- **Circuit breaker** (`infrastructure/swiggy/circuit_breaker.py`) — Redis-backed; 3 failures in 5min → open 30min; integrated into `SwiggyMCPClient`; auto-resets via TTL
- **Provider registry** (`infrastructure/swiggy/provider_registry.py`) — maps planning capabilities to ordered provider lists; `get_provider_async()` checks both DB `sync_status` AND live circuit breaker state before routing
- **Tool tracing** — every `SwiggyMCPClient` call appends a trace dict (provider, endpoint, tool, status, duration_ms); `drain_traces()` collects them for run metadata
- **`GET /health/circuits`** — new endpoint returning real-time open/closed state for all three Swiggy MCP endpoints (food / im / dineout)

### Chatbot
- **LLM factory** — `_get_chat_client()` dispatches on `LLM_PROVIDER`: Groq or CometAPI fast tier; no longer hardcoded to Groq
- **Within-session memory** — when history exceeds 8 turns, older turns are compressed by `SessionMemoryService.build_summary_from_messages()` and injected as a single context message; last 8 turns kept verbatim

### SSE streaming
- Now emits `node_start` (with human-readable hint) AND `node_complete` per node — previously only `node_complete` was emitted

---

## What's new (post Phase 5, pre Phase 6)

- **Per-node model tier routing** — CometAPI integration routes each LangGraph node to the right model tier (fast / balanced / strong) via a single key. The critic always gets `claude-sonnet-4-6`; simpler nodes get `deepseek-v4-flash`. Fully opt-in via `COMET_TIERED=true`. See `docs/ARCHITECTURE.md` for the full tier table and fallback chain design.

- **Cross-agent assumption diffing** — Each domain node writes the assumptions it acted on into `OrchestratorState`. `EvaluationSanityChecker` cross-diffs these after the parallel fan-out, surfacing contradictions as `stale_assumptions` injected into the critic prompt and returned in the API response. See D-017 in `docs/DECISIONS.md`.

---

## What Phase 5 added

- **PDF + Excel export** — chef brief and owner workbook per planning run
- **SSE streaming** — status events update the loading screen pipeline diagram in real time; full plan delivered in a single `complete` event
- **Redis caching** — 1hr TTL plan cache; zero LLM cost on repeat runs same day
- **What-if simulator** — instant cover count adjustment without a full re-run
- **OpenTelemetry + Prometheus** — HTTP tracing and `/metrics` scrape endpoint
- **Sentry** — unhandled exception capture with LangGraph node tags
- **LangSmith regression evals** — `cortexkitchen-golden-v1` dataset (50 runs), 90% CI gate
- **Multi-tenant workspace isolation** — Postgres `org_id` scoping + Qdrant payload filter per org
- **RAG chatbot** — `POST /api/v1/chat` SSE; streaming token output; answers from real run data
- **Prelaunch polish** — homepage pipeline redesign, professional footer, prompt refinements
