# CortexKitchen Orchestration Nodes

Last updated: June 2026. Reflects the implemented LangGraph graph and chat agent (Phase 5 complete).

---

## Overview

CortexKitchen's planning pipeline is implemented as a LangGraph `StateGraph`. The graph contains nine nodes wired in a specific topology: a sequential head, a parallel fan-out across four domain nodes, and a sequential tail through aggregation, critic, and final assembly.

The graph is constructed per request by `build_graph(deps)` in `app/orchestration/graph.py`. Dependencies (database session, LLM provider, memory service) are injected at wire time.

A separate stateless agent — the **Chat Agent** — powers the `/chat` RAG chatbot and is not part of the LangGraph graph.

---

## Graph topology

```
ops_manager
    │
    ├── (error) → final_assembler → END
    │
    ▼
demand_forecast
    │
    ├──────────────────┬────────────────┬──────────────┐
    ▼                  ▼                ▼              ▼
reservation    complaint_intel    menu_intel       inventory
    │                  │                │              │
    └──────────────────┴────────────────┴──────────────┘
                            │
                            ▼
                        aggregator
                            │
                            ▼
                          critic
                            │
                            ▼
                      final_assembler → END
```

The conditional edge after `ops_manager` short-circuits to `final_assembler` if `state["error"]` is set.

---

## Planning pipeline nodes

### `ops_manager`

**Role:** Pipeline entry point. Validates the incoming scenario, frames the operational context, and initialises shared state.

**Inputs:** Scenario id, target date, simulation mode, restaurant profile, org settings  
**Outputs:** Populated `OrchestratorState` with scenario metadata and `org_id`, or `state["error"]` on invalid input  
**Implementation:** `app/orchestration/nodes/ops_manager.py`  
**Dependencies:** None (synchronous)

**Phase 5 addition:** `org_id` is now written to shared state at this node so all downstream nodes operate in the correct tenant context.

---

### `demand_forecast`

**Role:** Produces the demand and service-pressure signal used by all downstream domain nodes. Acts as the gate — if confidence is too low, the run does not proceed.

**Inputs:** Scenario context from `ops_manager`  
**Outputs:** Forecast output block in `state["forecast"]` — predicted covers, peak hour, confidence band, day-of-week adjustment  
**Implementation:** `app/orchestration/nodes/demand_forecast.py`  
**Service:** `ForecastService` — queries historical orders from PostgreSQL and runs Prophet time-series  
**Dependencies:** `db`, `llm`

---

### `reservation`

**Role:** Analyses booking density, occupancy percentage, waitlist depth, and busiest service window for the target date.

**Inputs:** Scenario context + demand signal  
**Outputs:** Reservation output block in `state["reservation"]` — occupancy %, waitlist count, peak hour, priority level, risks, recommendations  
**Implementation:** `app/orchestration/nodes/reservation.py`  
**Service:** `ReservationService`  
**Dependencies:** `db`, `llm`

---

### `complaint_intelligence`

**Role:** Retrieves historically similar complaint patterns and matching SOPs from Qdrant (org-scoped), then converts them into operational risk signals and action items.

**Inputs:** Scenario context + demand signal  
**Outputs:** Complaint output block and RAG context in state  
**Implementation:** `app/orchestration/nodes/complaint_intelligence.py`  
**Service:** `ComplaintService` + `MemoryService` (Qdrant retrieval with org payload filter)  
**Dependencies:** `db`, `llm`, `memory`

**Note:** RAG context is retrieved **before** the LLM call so retrieved complaints and SOPs feed directly into the prompt — the LLM reasons over real past data, not summaries.

---

### `menu_intelligence`

**Role:** Evaluates menu performance in the context of the scenario's demand and operational constraints — identifies what to push, ease back, and avoid promoting tonight.

**Inputs:** Scenario context + demand signal  
**Outputs:** Menu output block in `state["menu"]` — top items, weak items, promotion strategy, watchouts  
**Implementation:** `app/orchestration/nodes/menu_intelligence.py`  
**Service:** `MenuService`  
**Dependencies:** `db`, `llm`

---

### `inventory`

**Role:** Identifies shortage and overstock concerns for the selected scenario. Flags items at or below their reorder threshold and items at spoilage risk.

**Inputs:** Scenario context + demand signal  
**Outputs:** Inventory output block in `state["inventory"]` — shortage alerts, overstock alerts, restock priority list  
**Implementation:** `app/orchestration/nodes/inventory.py`  
**Service:** `InventoryService`  
**Dependencies:** `db`, `llm`

---

### `aggregator`

**Role:** Collects all four domain node outputs and combines them into a single package for the critic to evaluate.

**Inputs:** `state["forecast"]`, `state["reservation"]`, `state["complaint"]`, `state["menu"]`, `state["inventory"]`  
**Outputs:** Aggregated recommendations block in state  
**Implementation:** `app/orchestration/nodes/aggregator.py`  
**Dependencies:** None (synchronous)

---

### `critic`

**Role:** Validates the aggregated plan against business rules and scores it across five quality dimensions. No plan ships without a passing verdict.

**Scoring dimensions:**

| Dimension | What it checks |
|-----------|----------------|
| Safety | Are all recommendations safe for staff and guests? |
| Feasibility | Is the plan realistic given current stock and staffing? |
| Evidence | Are recommendations backed by data from the domain agents? |
| Actionability | Can staff act on this without further clarification? |
| Clarity | Is the plan clearly and unambiguously stated? |

**Verdicts:** `approved`, `revision`, `rejected`  
**Inputs:** Aggregated plan from `aggregator`  
**Outputs:** Critic block in `state["critic"]` — verdict, composite score (0–1), dimension scores, revision reasons, actionable feedback, cost analysis, sanity check results  
**Implementation:** `app/orchestration/nodes/critic.py`  
**Services:** `CriticService`, `CostAwareScoringService`, `EvaluationSanityChecker`  
**Dependencies:** `db`, `llm`

---

### `final_assembler`

**Role:** Formats the complete final response for the API client. Handles both the normal path (full plan) and the error path (short-circuit from `ops_manager`).

**Inputs:** Full state including all domain outputs, critic block, node traces, LLM usage metadata  
**Outputs:** `state["final_response"]` — the API-ready response dict  
**Implementation:** `app/orchestration/nodes/final_assembler.py`  
**Dependencies:** None (synchronous)

---

## Chat agent (RAG chatbot)

The chat agent is a stateless, streaming agent outside the LangGraph graph. It powers the `/chat` page and `POST /api/v1/chat` endpoint.

**Role:** Answers natural language questions about a restaurant's planning history, inventory status, and guest feedback. Answers come from the operator's own data — not generic AI.

**Implementation:** `app/domain/services/chat_service.py`

**How it works:**

1. Receives the user's message and conversation history (last 3 turns kept)
2. Retrieves context from two Postgres sources:
   - `planning_runs` — last 10 runs for the org (`org_id` scoped), with critic notes and agent outputs
   - `feedback` — last 30 feedback records (no `org_id` filter in current implementation)
3. Builds a system prompt grounding the LLM in the retrieved context via `PromptUtils.format_chat_system_prompt`
4. Streams tokens via `AsyncGroq` (`llama-3.3-70b-versatile`, max 1024 tokens) through the SSE endpoint
5. Frontend renders the response with ReactMarkdown

**Suggested questions (shown on first load):**

- Which run had the lowest critic score and why?
- What are the most common complaints recently?
- Which ingredients are flagged as low stock most often?
- Which items are highlighted across multiple runs?
- Which scenario had the highest predicted orders?
- If I had to focus on one thing to improve our score, what would it be?

**Dependencies:** `db` (Postgres), `AsyncGroq`

---

## State management

The shared state type is `OrchestratorState` (TypedDict) in `app/orchestration/state.py`. It carries:

- Scenario metadata, runtime flags (`simulation_mode`, `debug`), and `org_id` (Phase 5)
- Per-node output fields written progressively as nodes execute
- `error` field checked by the conditional edge after `ops_manager`
- `execution_trace` list populated when `debug=True`

Initial state is created by `make_initial_state()` in the same module.

---

## Scenario presets

| Id | Label | Default weekday | Service window |
|----|-------|-----------------|----------------|
| `friday_rush` | Friday Rush | Friday | 18:00 – 22:00 |
| `weekday_lunch` | Weekday Lunch | Wednesday | 12:00 – 15:00 |
| `holiday_spike` | Holiday Spike | Saturday | 17:00 – 22:00 |
| `low_stock_weekend` | Low-Stock Weekend | Sunday | 18:00 – 22:00 |

Scenario definitions are in `app/domain/scenarios.py`. `resolve_default_target_date()` computes the next matching calendar date when no `target_date` is supplied.

---

## Implementation note

Most pipeline nodes behave as deterministic service stages with an LLM-assisted reasoning step rather than as fully autonomous agents. The "agent" label is a deliberate choice from the original architecture design — each node owns a single domain, with its own data adapter, model configuration, and evaluation criteria.
