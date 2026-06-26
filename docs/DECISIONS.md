# Architecture and Product Decisions
# CortexKitchen

Last updated: June 2026. Phase 5 complete.

---

## Decision Log Format
Each entry records a meaningful architecture, product, or workflow decision.

---

## D-001: CortexKitchen will be built as a multi-agent decision system, not a chatbot
**Status:** Accepted

### Context
The project aims to stand out as a capstone and prototype. A simple chatbot or basic RAG assistant would not adequately demonstrate system design depth.

### Decision
The product will be positioned and implemented as an AI-powered restaurant operations intelligence platform using multiple specialised agents coordinated by LangGraph.

### Consequences
- Stronger architecture complexity and clearer separation of responsibilities
- Higher implementation complexity, controlled phase by phase

---

## D-002: The flagship demo scenario will be Friday Night Rush Optimization
**Status:** Accepted

### Context
The project needs a clear demo story rather than a broad and vague collection of features.

### Decision
The primary use case for design and implementation will be optimising Friday evening operations for a pizza-heavy restaurant. Three additional scenarios (weekday lunch, holiday spike, low-stock weekend) extend the same pipeline.

### Consequences
- Focused development and demo clarity
- All features serve the central scenario logic

---

## D-003: The system will use a hybrid architecture
**Status:** Accepted

### Decision
CortexKitchen combines: structured SQL data (PostgreSQL), vector retrieval (Qdrant), LLM reasoning (Groq/Gemini), time-series forecasting (Prophet), Redis caching, and business-rule validation (critic). No single technology handles all intelligence needs.

### Consequences
- Avoids forcing LLMs into every task
- Produces stronger architecture maturity

---

## D-004: LLM provider will sit behind an abstraction layer; Groq is the default
**Status:** Accepted (updated in D-010)

### Context
The project must stay free-tier friendly while remaining expandable.

### Decision
All LLM calls go through `BaseLLMProvider`. `create_llm_provider()` reads `LLM_PROVIDER` from environment and constructs a `FallbackLLMProvider`. Groq is the default provider; Gemini is the automatic fallback.

### Consequences
- Switching providers requires only a config change
- Provider used is logged and persisted in run metadata

---

## D-005: Qdrant will be used as the vector database
**Status:** Accepted

### Decision
Qdrant stores complaint patterns and SOPs in shared collections with payload filters for org isolation (see D-009). Used for RAG retrieval in the complaint intelligence node and the chat agent.

### Consequences
- Production-grade vector retrieval with metadata-aware filtering
- Requires Docker setup

---

## D-006: PostgreSQL will be the primary operational database
**Status:** Accepted

### Decision
PostgreSQL stores all structured data: reservations, menu items, orders, inventory, feedback, decision logs, planning runs, organizations, users, restaurant profiles.

### Consequences
- Strong relational modelling and migration support (Alembic)
- All run queries are org-scoped via `org_id`

---

## D-007: Redis will handle plan caching from Phase 5
**Status:** Accepted (promoted from "future" in Phase 5)

### Decision
Redis caches planning run results by `(org_id, scenario, target_date)` with a 1-hour TTL. A `cache_hit: true` flag is returned in the response. Zero LLM cost on cache hits.

### Consequences
- Repeat runs same day return immediately
- Cache invalidates automatically on TTL expiry

---

## D-008: Docker Compose for local infrastructure reproducibility
**Status:** Accepted

### Decision
PostgreSQL, Qdrant, and Redis run via Docker Compose with persistent volumes. Data survives container restarts; `docker compose down -v` resets everything.

### Consequences
- Cleaner local setup and demo story
- Portable across developer machines

---

## D-009 — Qdrant collection strategy: shared collection with payload filters
**Date:** 31 May 2026  
**Status:** Accepted

### Decision
Use a single shared Qdrant collection with payload pre-filters instead of per-tenant collections.

Filter pattern:
- `org_id` — tenant isolation
- `doc_type` — semantic separation (`complaint` / `sop`)

### Rationale
Per-tenant collections cause collection sprawl at multi-tenant scale (100 restaurants = 200+ collections). Qdrant payload pre-filtering on a shared collection is the recommended production pattern.

### Impact
Implemented in P5-11. All Qdrant retrieval calls include an `org_id` payload filter.

---

## D-010 — Groq as default LLM provider (replacing Gemini default)
**Date:** June 2026  
**Status:** Accepted

### Decision
`LLM_PROVIDER` defaults to `groq`. Gemini becomes the automatic fallback.

### Rationale
Groq free tier has higher RPM limits than Gemini, making development and demo runs smoother. The `FallbackLLMProvider` retries on Gemini transparently when Groq hits a rate limit.

### Consequences
- Both `GROQ_API_KEY` and `GEMINI_API_KEY` should be set in `.env`
- Cost rates tracked separately per provider in `llm/base.py`

---

## D-011 — RAGAS + DeepEval for LLM output quality gating
**Date:** June 2026  
**Status:** Accepted

### Decision
Use RAGAS for complaint RAG faithfulness evaluation and DeepEval for hallucination and relevancy checks. Both run as separate pytest suites in `apps/api/evals/` outside normal `testpaths`.

### Thresholds
- RAGAS faithfulness: ≥ 0.8
- DeepEval hallucination: ≤ 0.5
- DeepEval relevancy: ≥ 0.7

### Consequences
- Live LLM calls required; evals are not part of standard CI
- Datasets must be updated manually when prompts change significantly

---

## D-012 — MCP server via stdio, not HTTP
**Date:** June 2026  
**Status:** Accepted

### Decision
The MCP server is a standalone stdio subprocess (`mcp_server.py`) rather than an HTTP endpoint embedded in FastAPI. It communicates with the FastAPI backend over HTTP with JWT auth.

### Rationale
stdio is the standard transport for local MCP servers in Claude Code and Claude Desktop. Keeps clear separation between the planning API and the tool interface.

### Consequences
- `mcp_server.py` is spawned as a subprocess by Claude
- JWT obtained on first tool call and reused for the session
- FastAPI has no knowledge of MCP

---

## D-013 — Static eval datasets
**Date:** June 2026  
**Status:** Accepted

### Decision
RAGAS and DeepEval eval datasets are hand-crafted static JSON, not captured from live planning runs.

### Rationale
Live capture requires a full running stack during test collection and produces non-deterministic results. Static datasets are reproducible and version-controlled.

### Consequences
- Datasets must be manually updated when prompts or critic behaviour changes significantly
- For production use, datasets should be rebuilt from live captures periodically

---

## D-014 — LangSmith golden dataset as primary regression quality gate
**Date:** June 2026  
**Status:** Accepted

### Decision
Build `cortexkitchen-golden-v1` (50 curated planning runs) in LangSmith and use a pytest CI gate (`tests/unit/test_langsmith_evals.py`) running against a local JSON fixture, requiring ≥ 90% pass rate.

### Rationale
RAGAS/DeepEval cover individual component quality. The golden dataset gate covers end-to-end plan quality — catching regressions that pass component evals but produce worse plans overall.

### Consequences
- `build_golden_dataset.py` must be re-run when the system changes significantly
- 90% threshold is intentionally strict — allows one or two borderline runs in 50

---

## D-015 — Prompts centralised in `prompt_utils.py`
**Date:** June 2026  
**Status:** Accepted

### Decision
All LLM prompt construction is centralised in `app/infrastructure/llm/prompt_utils.py`. No raw prompt strings exist in service files.

### Rationale
Scattered prompt strings in service files make prompt iteration, testing, and auditing difficult. A single module is the authoritative source for all prompt templates.

### Consequences
- Changing a prompt requires editing one file only
- Easier to review prompt quality and catch regressions

---

## D-017 — Assumption diffing in EvaluationSanityChecker instead of enumerated contradiction pairs
**Date:** June 2026  
**Status:** Accepted

### Context
The original `EvaluationSanityChecker` caught cross-agent contradictions via hardcoded rule pairs (e.g. "if inventory flags item X as low, the menu shouldn't promote X"). As the menu and agent set grow, enumerating every possible pair becomes a combinatorial explosion that is impossible to maintain exhaustively.

### Decision
Each domain node now declares the assumptions it acted on when producing its output. These assumptions are derived from the node's own computed values — not hardcoded — and written as a small dict to `OrchestratorState` alongside the node's output (`menu_assumptions`, `inventory_assumptions`, `reservation_assumptions`, `complaint_assumptions`). The aggregator collects these into the recommendation bundle. `EvaluationSanityChecker.check_bundle()` then cross-diffs the assumptions: for each assumption in node A, it checks whether it is contradicted by a known fact in node B's output.

The result is a `stale_assumptions` list returned alongside the existing `issues` list. Conflicts surface automatically from structural mismatch — no enumeration of pairs is needed. The critic receives the stale assumptions explicitly in its prompt so it can reason about *why* a contradiction exists rather than detecting it from raw data.

### Rationale
The combinatorial explosion problem: N agents → O(N²) contradiction pairs to enumerate. The assumption-diff approach scales linearly with agent count — adding a new agent requires only that the new node writes its own assumptions dict. No changes to the checker or other nodes.

A secondary benefit: assumptions make node reasoning explicit and auditable. If a node made recommendations based on a stale belief, that belief is now visible in the run output rather than implicit in the LLM's prompt context.

The hardcoded checks are **kept as a secondary layer** — they catch concrete policy violations (capacity limits, impossible inventory quantities, long-horizon actions) that are structural rather than assumption-based.

### Consequences
- Each domain node must derive and write its own `assumptions` dict — this is a new contract for any future domain node added to the pipeline
- Graceful degradation: if a node errored and its assumptions dict is `None`, the checker skips diffing for that node without crashing
- `stale_assumptions` is always present in `check_bundle()` output (may be an empty list) — callers that previously only used `passed`, `issues`, and `summary` are unaffected

### Post-implementation note (June 2026)

**Diff 1 removed.** The original implementation included a fourth diff (`assumed_no_active_stockouts` in `menu_intelligence` vs the inventory node's shortage list). This was dropped after discovering it could never fire: `MenuService.analyse_and_recommend()` contains a self-healing fallback that directly instantiates `InventoryService` and queries the DB whenever `inventory_data=None`. Because the four domain nodes run in parallel, `inventory_output` is never in state when `menu_intelligence` runs — but `MenuService` compensates by fetching inventory itself using the same demand ratio. Both nodes always hit the same DB with the same demand ratio, so they always agree on shortage status. The `assumed_no_active_stockouts` field has been removed from `menu_assumptions`. Three diffs remain active: Diff 2 (menu covers capacity vs reservation occupancy), Diff 3 (high-occupancy planning on weak forecast), and Diff 4 (complaint volume gray zone). The 4-parallel-agent topology is unchanged.

---

## D-016 — SSE streaming for planning runs and chat
**Date:** June 2026  
**Status:** Accepted

### Decision
`POST /api/v1/planning/stream` and `POST /api/v1/chat` return `text/event-stream` responses. `POST /api/v1/planning/run` is a standard JSON endpoint — no streaming.

- **Planning SSE (`/planning/stream`)** — emits `node_complete` events carrying only the node name as each LangGraph node finishes; the loading screen pipeline diagram updates in real time. The full plan arrives in a single final `complete` event and renders all at once.
- **Chat SSE (`/chat`)** — streams individual tokens word-by-word via AsyncGroq. Entirely separate mechanism.

### Rationale
The planning pipeline takes 10–30 seconds. Emitting node status as each completes makes the experience feel interactive — the user sees the pipeline progress rather than a blank loading spinner.

### Consequences
- FastAPI returns a `StreamingResponse` for `/planning/stream` and `/chat`
- Planning `node_complete` events carry `{"node": "nodename"}` only — no output data in the stream
- The full plan renders all at once from the single `complete` event
- Frontend must handle stream teardown and error events
