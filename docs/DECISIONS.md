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