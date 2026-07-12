# CortexKitchen Orchestration Nodes

Last updated: June 2026. Reflects the implemented LangGraph graph and chat agent (Phase 6 in progress).

---

## Overview

CortexKitchen's planning pipeline is implemented as a LangGraph `StateGraph`. The graph contains eleven nodes wired in a specific topology: a sequential head (ops_manager → demand_forecast → qdrant_enrichment), a parallel fan-out across three domain nodes with menu_intelligence sequential after, and a sequential tail through aggregation, replan management, critic, and final assembly.

The graph is constructed per request by `build_graph(deps)` in `app/orchestration/graph.py`. Dependencies (database session, LLM provider, memory service, planning memory service) are injected at wire time.

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
    ▼
qdrant_enrichment       ← retrieves past approved-run insights, injects past_plans into shared_context
    │
    ├─────────────────────┬──────────────────────┐
    ▼                     ▼                      ▼
reservation      complaint_intelligence       inventory
    └──────────────────────┼──────────────────────┘
                           ▼
                   menu_intelligence   ← sequential after all 3; LangGraph fan-in fires exactly once
                           │
                           ▼
                       aggregator
                           │
                           ▼
                         critic
                           │
         ┌─────────────────┴──────────────────────┐
    (approved or                           (revision, replan_count < 2)
     replan_count ≥ 2)                            │
         ▼                                        ▼
   final_assembler                      replan_orchestrator
         │                                        │
        END                              aggregator (loop)
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

**P6-A25:** validation is no longer a closed-set membership check against the
4 presets alone. If `scenario` is one of `SCENARIO_DEFINITIONS`'s keys,
behavior is unchanged (`get_scenario_definition()`). If not, and
`state["custom_profile"]` is present (a natural-language-derived profile
from `ScenarioProfileService`, see `docs/PRODUCT_MODES.md`),
`scenario_profile` is built from that instead — only an unrecognized
scenario with no `custom_profile` still short-circuits to `state["error"]`.

---

### `qdrant_enrichment`

**Role:** Retrieves similar past approved-run insights from Qdrant after `demand_forecast`, before the parallel fan-out. Uses recency decay scoring (`score × 2^(-age/HALF_LIFE_DAYS)`) so recent runs rank higher than old ones. Runs over the `planning_memory` Qdrant collection.

**Inputs:** Scenario context + demand signal from `demand_forecast`, `org_id`  
**Outputs:** `shared_context["past_plans"]` — top-3 similar past plan snippets (empty list on failure or if PlanningMemoryService not configured)  
**Implementation:** `app/orchestration/nodes/qdrant_enrichment.py`  
**Service:** `PlanningMemoryService` (Qdrant ANN search + recency re-ranking)  
**Dependencies:** `memory`, `planning_memory`  
**Model tier:** None — no LLM call; pure vector retrieval

**Failure behaviour:** Any exception returns `past_plans=[]` — the pipeline continues unchanged. The node never blocks a run.

---

### `demand_forecast`

**Role:** Produces the demand and service-pressure signal used by all downstream domain nodes. Acts as the gate — if confidence is too low, the run does not proceed.

**Inputs:** Scenario context from `ops_manager`  
**Outputs:** Forecast output block in `state["forecast"]` — predicted covers, peak hour, confidence band, day-of-week adjustment; also writes `state["weather_signal"]`  
**Implementation:** `app/orchestration/nodes/demand_forecast.py`  
**Service:** `ForecastService` — queries historical orders from PostgreSQL and runs Prophet time-series  
**Dependencies:** `db`, `llm`  
**Model tier:** `fast` (`deepseek-v4-flash` when `COMET_TIERED=true`)

**Live-intelligence signals (P6-A21):** Prophet's `predicted_orders` is purely
historical (90-day window) and structurally can't know about a forward-
looking one-off signal its training data never saw — a holiday, a rain
forecast. `demand_forecast_node` fetches `WeatherService` (Open-Meteo, free,
keyless — `app/infrastructure/external/weather_service.py`) and a holiday
lookup (`app/core/calendar_utils.py`, shared with `ScenarioRecommender`) for
the target date, then `ForecastService._apply_signal_adjustments()` applies
a deterministic multiplier to the raw Prophet output — not just narrative
prompt text an LLM may or may not act on. Transparent by construction:
`predicted_orders_pre_adjustment`, `adjustment_multiplier`, and
`adjustment_reasons` are all preserved in the forecast dict, so the
adjustment is never a silent change to what Prophet actually said. Both
signals fail open — a weather-lookup failure or missing `target_date` just
means no adjustment, the forecast still runs on Prophet's raw output.

**P6-A22/A23/A24:** `demand_forecast_node` also fetches `TrendsService`
(curated RSS) and `ComplianceAlertsService` (FSSAI notices) here — narrative
context only for this node's own LLM recommendation
(`ForecastService.analyse_and_recommend`'s `signal_line`), never touching
the multiplier. All three signals are written to state
(`weather_signal`/`trends_signal`/`compliance_alerts_signal`) and read back
(not re-fetched) by `market_intel_node`, which merges them with the Swiggy
competitor/occupancy prompt text into one `market_intel_output
["live_signals_text"]` (`MarketIntelService._build_live_signals_text`) —
read by `menu_intelligence` (`MenuService`'s `market_context`) and
condensed into a `[Live Signals]` line in the critic's summary
(`aggregator.py`'s `_build_critic_summary`). Existing state field names
(`swiggy_competitor_context`, `swiggy_occupancy_context`,
`market_intel_output`) are unchanged.

---

### `reservation`

**Role:** Analyses booking density, occupancy percentage, waitlist depth, and busiest service window for the target date.

**Inputs:** Scenario context + demand signal  
**Outputs:** Reservation output block in `state["reservation_output"]` — occupancy %, waitlist count, peak hour, priority level, risks, recommendations  
**Assumptions written to state (`reservation_assumptions`):**
- `assumed_peak_occupancy_pct` — occupancy percentage computed by `ReservationService` for the target date
- `assumed_waitlist_active` — True if at least one reservation is on the waitlist

**Implementation:** `app/orchestration/nodes/reservation.py`  
**Service:** `ReservationService`  
**Dependencies:** `db`, `llm`  
**Model tier:** `fast` (`deepseek-v4-flash` when `COMET_TIERED=true`)

---

### `complaint_intelligence`

**Role:** Retrieves historically similar complaint patterns and matching SOPs from Qdrant (org-scoped), then converts them into operational risk signals and action items.

**Inputs:** Scenario context + demand signal  
**Outputs:** Complaint output block and RAG context in state  
**Assumptions written to state (`complaint_assumptions`):**
- `assumed_complaint_categories` — up to 5 unique complaint texts from the last 28 days
- `assumed_high_complaint_volume` — True when `negative_pct` of recent feedback exceeds 30%
- `assumed_negative_pct` — the raw negative feedback percentage used for both the flag and cross-agent diffing

**Implementation:** `app/orchestration/nodes/complaint_intelligence.py`  
**Service:** `ComplaintService` + `MemoryService` (Qdrant retrieval with org payload filter)  
**Dependencies:** `db`, `llm`, `memory`  
**Model tier:** `balanced` (`gemini-3.5-flash` when `COMET_TIERED=true`)

**Note:** RAG context is retrieved **before** the LLM call so retrieved complaints and SOPs feed directly into the prompt — the LLM reasons over real past data, not summaries.

---

### `menu_intelligence`

**Role:** Evaluates menu performance in the context of the scenario's demand and operational constraints — identifies what to push, ease back, and avoid promoting tonight.

**Inputs:** Scenario context + demand signal  
**Outputs:** Menu output block in `state["menu_output"]` — top items, weak items, promotion strategy, watchouts  
**Assumptions written to state (`menu_assumptions`):**
- `items_assumed_available` — top-performing items that are **not** in the shortage list; these are what the node implicitly assumes it can promote
- `assumed_covers_within_capacity` — always `True`; at runtime, `menu_intelligence` fires after `reservation`, `complaint_intelligence`, and `inventory` all complete (LangGraph fan-in). However, `MenuService` does not consume reservation_output from state — it self-queries its own data sources. The cross-agent assumption diff (Diff 2) detects when reservation shows >90% occupancy that menu's implicit capacity assumption doesn't account for.

**Implementation:** `app/orchestration/nodes/menu_intelligence.py`  
**Service:** `MenuService`  
**Dependencies:** `db`, `llm`  
**Model tier:** `balanced` (`gemini-3.5-flash` when `COMET_TIERED=true`)

---

### `inventory`

**Role:** Identifies shortage and overstock concerns for the selected scenario. Flags items at or below their reorder threshold and items at spoilage risk.

**Inputs:** Scenario context + demand signal  
**Outputs:** Inventory output block in `state["inventory_output"]` — shortage alerts, overstock alerts, restock priority list  
**Assumptions written to state (`inventory_assumptions`):**
- `items_flagged_low` — ingredient names from all shortage alerts produced by `InventoryService`
- `items_flagged_overstock` — ingredient names from all overstock alerts

**Implementation:** `app/orchestration/nodes/inventory.py`  
**Service:** `InventoryService`  
**Dependencies:** `db`, `llm`  
**Model tier:** `fast` (`deepseek-v4-flash` when `COMET_TIERED=true`)

---

### `aggregator`

**Role:** Collects all four domain node outputs and combines them into a single package for the critic to evaluate.

**Inputs:** `state["forecast"]`, `state["reservation"]`, `state["complaint"]`, `state["menu"]`, `state["inventory"]`  
**Outputs:** Aggregated recommendations block in state  
**Implementation:** `app/orchestration/nodes/aggregator.py`  
**Dependencies:** None (synchronous)

---

### `replan_orchestrator`

**Role:** Manages the replan loop between `aggregator` and `critic`. If the critic returned a `revision` verdict in a prior cycle, this node injects the critic's feedback into `state["replan_context"]` so downstream nodes (if the graph cycles back) receive concrete correction guidance. Enforces a maximum of 2 replan cycles to prevent infinite loops.

**Inputs:** Aggregated plan + `critic` block from prior cycle (if any)  
**Outputs:** `state["replan_context"]` populated with structured critic feedback  
**Implementation:** `app/orchestration/nodes/replan_orchestrator.py`  
**Dependencies:** None (synchronous)  
**Model tier:** None — no LLM call; pure state management

**Replan limit:** After 2 failed revision cycles, the node lets the run proceed to `final_assembler` with whatever verdict the critic gave most recently — it never blocks indefinitely.

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
**Model tier:** `strong` (`claude-sonnet-4-6` when `COMET_TIERED=true`) — the highest-capability model is reserved for the node that gates every plan

**Diff 7 (P6-MI08 — added this phase):** `EvaluationSanityChecker._diff_assumptions()` cross-checks
`market_intel_assumptions.tonight_busy` against `market_intel_assumptions.dineout_deals_count`
(sum of `competitor_dineout_deals` from `get_restaurant_details` + `slot_deals_found` parsed from
`get_available_slots`, both populated by `OccupancyEnricher`). If `tonight_busy=True` and 2+
competitor Dineout deals are live, the diff fires: the area occupancy signal may overstate real
walk-in demand at our own restaurant, since some of that "full" demand is being captured by
competitors' promotional bookings rather than organic overflow. Same shape as Diffs 5/6 — no
hardcoded pair, derived from each node's own computed assumptions.

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

1. Receives the user's message and conversation history
2. Checks `SemanticChatCache` — returns cached answer if a similar question was asked by the same org within 24 hours (0.92 cosine threshold)
3. Retrieves context from two Postgres sources:
   - `planning_runs` — last 10 runs for the org (`org_id` scoped), with critic notes and agent outputs
   - `feedback` — last 30 feedback records (no `org_id` filter in current implementation)
4. Builds a system prompt grounding the LLM in the retrieved context via `PromptUtils.format_chat_system_prompt`
5. **Within-session memory:** if `len(history) > 8`, older turns are compressed by `SessionMemoryService.build_summary_from_messages()` (no LLM call) and injected as a single `[Earlier in this session: ...]` assistant message; the last 8 turns are kept verbatim
6. Streams tokens via `_get_chat_client(settings)` factory — dispatches on `LLM_PROVIDER`: routes to `AsyncGroq` (`llama-3.3-70b-versatile`) when `LLM_PROVIDER=groq`, or `AsyncOpenAI` (CometAPI fast tier) otherwise
7. Frontend renders the response with ReactMarkdown

**Suggested questions (shown on first load):**

- Which run had the lowest critic score and why?
- What are the most common complaints recently?
- Which ingredients are flagged as low stock most often?
- Which items are highlighted across multiple runs?
- Which scenario had the highest predicted orders?
- If I had to focus on one thing to improve our score, what would it be?

**Dependencies:** `db` (Postgres), `_get_chat_client` (LLM factory), `SemanticChatCache` (Qdrant)

---

## State management

The shared state type is `OrchestratorState` (TypedDict) in `app/orchestration/state.py`. It carries:

- Scenario metadata, runtime flags (`simulation_mode`, `debug`), and `org_id` (Phase 5)
- Per-node output fields written progressively as nodes execute
- Per-node assumption dicts (`menu_assumptions`, `inventory_assumptions`, `reservation_assumptions`, `complaint_assumptions`, `market_intel_assumptions`, `dineout_manager_assumptions`) — each domain node writes one after its service call completes; used by `EvaluationSanityChecker` for cross-agent assumption diffing (see D-017)
- `shared_context["past_plans"]` — list of similar past plan snippets from `PlanningMemoryService`, injected by `qdrant_enrichment`; available to all downstream nodes
- `replan_context` — structured critic feedback injected by `replan_orchestrator` when a revision cycle is in progress; consumed by domain nodes on replan
- `error` field checked by the conditional edge after `ops_manager`
- `execution_trace` list populated when `debug=True`
- `llm_registry` — tier-keyed dict of `FallbackLLMProvider` instances, populated when `COMET_TIERED=true`; each parallel node reads its assigned tier from this dict at runtime

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
