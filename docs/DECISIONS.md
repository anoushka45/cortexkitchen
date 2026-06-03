# Architecture and Product Decisions
# CortexKitchen

## Decision Log Format
Each entry records a meaningful architecture, product, or workflow decision.

---

## D-001: CortexKitchen will be built as a multi-agent decision system, not a chatbot
**Status:** Accepted

### Context
The project aims to stand out as a capstone and prototype. A simple chatbot or basic RAG assistant would not adequately demonstrate system design depth.

### Decision
The product will be positioned and implemented as an AI-powered restaurant operating system using multiple specialized agents coordinated by LangGraph.

### Consequences
- stronger architecture complexity
- clearer separation of responsibilities
- higher implementation complexity, which must be controlled phase by phase

---

## D-002: The flagship demo scenario will be Friday Night Rush Optimization
**Status:** Accepted

### Context
The project needs a clear demo story rather than a broad and vague collection of features.

### Decision
The primary use case for design and implementation will be optimizing Friday evening operations for a pizza-heavy restaurant.

### Consequences
- allows focused development
- simplifies scope prioritization
- improves demo clarity
- other features can still exist but must support this central scenario

---

## D-003: The system will use a hybrid architecture
**Status:** Accepted

### Context
Restaurant operations involve different kinds of intelligence needs: structured logic, forecasting, retrieval, and reasoning.

### Decision
CortexKitchen will combine:
- structured SQL data
- vector retrieval via Qdrant
- LLM reasoning via Gemini
- forecasting via baseline model and later Prophet
- business-rule validation via critic logic

### Consequences
- avoids forcing LLMs into every task
- produces stronger architecture maturity
- increases implementation planning requirements

---

## D-004: Gemini will be the initial LLM provider, but behind an abstraction layer
**Status:** Accepted

### Context
The project must stay free-tier friendly while remaining expandable.

### Decision
Gemini will be used first, but all LLM calls will go through a provider abstraction so Groq or OpenAI can be added later without rewriting agents.

### Consequences
- lower cost during development
- cleaner architecture
- slightly more work up front

---

## D-005: Qdrant will be used as the vector database
**Status:** Accepted

### Context
The system needs vector memory for complaints, SOPs, and decision summaries with metadata-aware retrieval.

### Decision
Qdrant will be used instead of simpler local vector stores.

### Consequences
- stronger product-grade architecture
- better retrieval flexibility
- requires Docker setup and schema planning

---

## D-006: PostgreSQL will be the primary operational database
**Status:** Accepted

### Context
Most core data in the system is strongly structured and relational.

### Decision
PostgreSQL will store reservations, menu items, orders, inventory, feedback, and decision logs.

### Consequences
- strong relational modeling support
- realistic backend architecture
- requires schema discipline from the beginning

---

## D-007: Redis will be included from the beginning, but used lightly in early phases
**Status:** Accepted

### Context
Caching and short-term runtime state are useful, but the MVP should not become too infrastructure-heavy.

### Decision
Redis will be part of the architecture from Phase 1, initially for lightweight caching and short-lived execution state only.

### Consequences
- project remains enterprise-minded
- MVP remains manageable
- future async expansion is easier

---

## D-008: Docker Compose will be used for local infrastructure reproducibility
**Status:** Accepted

### Context
The project should be easy to run locally and look professionally engineered.

### Decision
PostgreSQL, Qdrant, and Redis will run via Docker Compose.

### Consequences
- cleaner local setup
- stronger demo and collaboration story
- requires initial infrastructure configuration

## D-009 — Qdrant collection strategy at multi-tenant scale

**Date:** 31 May 2026
**Status:** Decided

**Decision:**
At Phase 5 multi-tenant scale, migrate to a single shared Qdrant collection with payload filters
instead of per-tenant or per-type collections.

Filter pattern:
- `restaurant_id` — tenant isolation
- `doc_type` — semantic separation (complaint / sop)

**Rationale:**
Current separate collections (complaint_memory, sop_memory) are correct for Phase 1–4 with
a single restaurant. At multi-tenant scale, per-tenant collections cause collection sprawl —
100 restaurants = 200+ collections, which Qdrant explicitly discourages operationally.
Shared collection with payload pre-filtering is the recommended production pattern.

**Validated by:**
Qdrant community discussion, May 2026. Confirmed by Shakthi and Srimon that payload
pre-filtering on a shared collection is the more scalable approach.

**Impact:**
P5-07 (Multi-tenant workspace isolation) — Qdrant migration is part of this task.
Technical doc section 4.3 to be updated when P5-07 ships.

---

## D-010 — Groq as default LLM provider (replacing Gemini default)

**Date:** June 2026
**Status:** Accepted

**Decision:**
Change `LLM_PROVIDER` default from `gemini` to `groq`. Gemini becomes the automatic fallback when Groq fails.

**Rationale:**
Groq free tier has higher request-per-minute limits than Gemini free tier, which makes development and demo runs smoother. Gemini is retained in the stack as fallback so the system degrades gracefully rather than failing hard on a rate limit.

**Consequences:**
- `LLM_PROVIDER=groq` is the default; set `LLM_PROVIDER=gemini` to invert
- Both keys should be set in `.env` so fallback is available
- Cost rates are tracked separately per provider in `llm/base.py`

---

## D-011 — RAGAS + DeepEval for LLM output quality gating

**Date:** June 2026
**Status:** Accepted

**Decision:**
Use RAGAS for RAG pipeline faithfulness evaluation and DeepEval for LLM output hallucination and relevancy checks. Both run as separate pytest suites in `apps/api/evals/` outside the normal `testpaths`.

**Rationale:**
Unit tests verify code logic, not LLM output quality. A separate eval layer using LLM-as-judge scoring catches hallucination and relevancy drift that would be invisible in standard tests. Keeping evals outside `testpaths` means normal CI is not slowed by live LLM calls.

**Consequences:**
- RAGAS faithfulness threshold: ≥ 0.8 (hard-gated)
- DeepEval hallucination threshold: ≤ 0.5; relevancy threshold: ≥ 0.7
- Eval datasets are static JSON — meaningful only once the complaint node passes RAG context into the LLM prompt (fixed in P4-10)
- Groq is used as the evaluator LLM for both suites

---

## D-012 — MCP server via stdio, not HTTP

**Date:** June 2026
**Status:** Accepted

**Decision:**
Implement the MCP server as a stdio subprocess (`mcp_server.py`) rather than an HTTP MCP endpoint added to the existing FastAPI app.

**Rationale:**
stdio is the standard transport for local MCP servers in Claude Code and Claude Desktop. Embedding MCP inside FastAPI would complicate the existing app and make it harder to run the MCP server independently. A separate process communicates with the FastAPI backend over HTTP with JWT auth, keeping clear separation between the planning API and the tool interface.

**Consequences:**
- `mcp_server.py` is a standalone script spawned by Claude as a subprocess
- Auth is handled via `CORTEX_EMAIL` / `CORTEX_PASSWORD` env vars in `.mcp.json`
- JWT is obtained on first tool call and reused for the session
- The FastAPI app does not need to know about MCP at all

---

## D-013 — Static eval datasets rather than live capture

**Date:** June 2026
**Status:** Accepted

**Decision:**
RAGAS and DeepEval eval datasets (`complaint_rag_samples.json`, test cases in `test_deepeval_quality.py`) are hand-crafted static JSON rather than captured from live planning runs.

**Rationale:**
Live capture requires a running DB + LLM + Qdrant stack during test collection, which is too heavy for CI and makes evals non-deterministic. Static datasets are reproducible and version-controlled. The trade-off is that datasets can become stale as prompts evolve.

**Consequences:**
- Dataset answers must be manually updated when the complaint prompt or critic behaviour changes significantly
- Faithfulness scores reflect the quality of the eval dataset as much as the system — a score of 1.0 likely means the dataset is too easy (answers are verbatim context)
- For production use, datasets should be rebuilt from captured live outputs periodically