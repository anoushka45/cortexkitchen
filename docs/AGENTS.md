# CortexKitchen Orchestration Nodes

Last updated: May 2026. Reflects the implemented LangGraph graph in `apps/api/app/orchestration/`.

---

## Overview

CortexKitchen's planning pipeline is implemented as a LangGraph `StateGraph`. The graph contains nine nodes wired in a specific topology: a sequential head, a parallel fan-out across four domain nodes, and a sequential tail through aggregation, critic, and final assembly.

The graph is constructed per request by `build_graph(deps)` in `app/orchestration/graph.py`. Dependencies (database session, LLM provider, memory service) are injected at wire time using a `functools.wraps` pattern rather than global singletons.

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
                      final_assembler
                            │
                            ▼
                           END
```

The conditional edge after `ops_manager` short-circuits to `final_assembler` if `state["error"]` is set, allowing the graph to return a structured error response without running the domain pipeline.

---

## Node descriptions

### `ops_manager`

**Role:** Pipeline entry point. Validates the incoming scenario against the scenario registry, frames the operational context, and initialises shared state fields.

**Inputs:** Scenario id, target date, simulation mode, debug flags  
**Outputs:** Populated `OrchestratorState` with scenario metadata, or `state["error"]` on invalid input  
**Implementation:** `app/orchestration/nodes/ops_manager.py`  
**Dependencies:** None (synchronous, no injected deps)

---

### `demand_forecast`

**Role:** Produces the demand and service-pressure signal used by all downstream domain nodes.

**Inputs:** Scenario context from `ops_manager`  
**Outputs:** Forecast output block written to state (`state["forecast"]`)  
**Implementation:** `app/orchestration/nodes/demand_forecast.py`  
**Service:** `ForecastService` — queries historical orders from PostgreSQL and runs Prophet time-series forecasting  
**Dependencies:** `db`, `llm`

---

### `reservation`

**Role:** Analyses booking density and identifies occupancy risk and service-window strain for the target date.

**Inputs:** Scenario context + demand signal from `demand_forecast`  
**Outputs:** Reservation output block written to state (`state["reservation"]`)  
**Implementation:** `app/orchestration/nodes/reservation.py`  
**Service:** `ReservationService`  
**Dependencies:** `db`, `llm`

---

### `complaint_intelligence`

**Role:** Retrieves historically similar complaint patterns and matching SOPs from Qdrant, then converts them into operational risk signals.

**Inputs:** Scenario context + demand signal  
**Outputs:** Complaint output block and RAG context written to state  
**Implementation:** `app/orchestration/nodes/complaint_intelligence.py`  
**Service:** `ComplaintService` + `MemoryService` (Qdrant retrieval)  
**Dependencies:** `db`, `llm`, `memory`

---

### `menu_intelligence`

**Role:** Evaluates menu performance — top items, weak items, and promotion opportunities — in the context of the scenario's demand and operational constraints.

**Inputs:** Scenario context + demand signal  
**Outputs:** Menu output block written to state (`state["menu"]`)  
**Implementation:** `app/orchestration/nodes/menu_intelligence.py`  
**Service:** `MenuService`  
**Dependencies:** `db`, `llm`

---

### `inventory`

**Role:** Identifies shortage and overstock concerns relevant to the selected scenario and flags items at or below their reorder threshold.

**Inputs:** Scenario context + demand signal  
**Outputs:** Inventory output block written to state (`state["inventory"]`)  
**Implementation:** `app/orchestration/nodes/inventory.py`  
**Service:** `InventoryService`  
**Dependencies:** `db`, `llm`

---

### `aggregator`

**Role:** Collects all four domain node outputs and combines them into a single package for the critic to evaluate.

**Inputs:** `state["forecast"]`, `state["reservation"]`, `state["complaint"]`, `state["menu"]`, `state["inventory"]`  
**Outputs:** Aggregated recommendations block in state  
**Implementation:** `app/orchestration/nodes/aggregator.py`  
**Dependencies:** None (synchronous, no injected deps)

---

### `critic`

**Role:** Validates the aggregated plan against business rules, scores it across five dimensions, and adds revision feedback if the plan is weak.

**Scoring dimensions:** safety, feasibility, evidence, actionability, clarity  
**Verdicts:** `approved`, `revision`, `rejected`  
**Inputs:** Aggregated plan from `aggregator`  
**Outputs:** Critic block in state (`state["critic"]`) including verdict, score, dimension scores, revision reasons, actionable feedback, cost analysis, and sanity checks  
**Implementation:** `app/orchestration/nodes/critic.py`  
**Services:** `CriticService`, `CostAwareScoringService`, `EvaluationSanityChecker`  
**Dependencies:** `db`, `llm`

---

### `final_assembler`

**Role:** Formats the complete final response for the API client. Handles both the normal path (full plan with critic output) and the error path (short-circuit from `ops_manager`).

**Inputs:** Full state including all domain outputs, critic block, and error state if present  
**Outputs:** `state["final_response"]` — the API-ready response dict  
**Implementation:** `app/orchestration/nodes/final_assembler.py`  
**Dependencies:** None (synchronous, no injected deps)

---

## State management

The shared state type is `OrchestratorState` (TypedDict) defined in `app/orchestration/state.py`. It carries:

- scenario metadata and runtime flags (`simulation_mode`, `force_critic_decision`, `debug`)
- per-node output fields written progressively as nodes execute
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

Scenario definitions are in `app/domain/scenarios.py`. The `resolve_default_target_date()` function computes the next matching calendar date when no `target_date` is supplied in the request.

---

## Implementation note

The codebase uses "agent" naming (ops manager, demand forecast agent, etc.) for these nodes, even though most behave as deterministic service stages with an LLM-assisted reasoning step rather than as fully autonomous agents. This is a deliberate labelling choice from the original architecture design.
