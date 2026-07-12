# Scenario intake modes (P6-A25)

CortexKitchen's planning pipeline (`ops_manager_node` onward) always needs a
`scenario_profile` — a `label`/`service_window`/`operational_focus` triple
that shapes every downstream agent's prompt (demand forecast, reservations,
inventory, menu, the critic). There are two ways to get one, and both feed
the exact same pipeline unchanged from that point on.

## Mode 1 — Presets (unchanged, still the default)

Four hardcoded scenarios in `apps/api/app/domain/scenarios.py`
(`SCENARIO_DEFINITIONS`): `friday_rush`, `weekday_lunch`, `holiday_spike`,
`low_stock_weekend`. Each ships a real `label`/`service_window`/
`operational_focus`/`default_weekday`. Picking one via the tile grid in
`PlanShiftModal.tsx` sends `scenario: "friday_rush"` (etc.) with no
`custom_profile` — `ops_manager_node` resolves the profile from
`get_scenario_definition()`, exactly as it always has.

These are one-click shortcuts and are **not replaced** by Mode 2 — that was
an explicit product decision, not a stepping stone to deprecating them.

## Mode 2 — Natural-language intake (new)

For anything that doesn't fit a preset ("we're hosting an event today,
expecting large turnover"), the owner types free text in `PlanShiftModal.tsx`
instead of picking a tile. That text goes to
`POST /planning/scenario-from-text`, which runs it through
`ScenarioProfileService.derive_profile()` (an LLM call, same never-raise +
deterministic-fallback pattern as `ScenarioRecommender`) and returns a
`ScenarioProfilePayload` — `{id: "custom", label, service_window,
operational_focus, cuisine}`.

The frontend then sends `scenario: "custom"` + `custom_profile: {...}` on the
actual `POST /planning/run` (or `/stream`) call. `ops_manager_node` sees a
`scenario` outside the 4 presets, finds `custom_profile` present, and builds
`scenario_profile` directly from it instead of `get_scenario_definition()`.
Every other node reads `scenario_profile` the same way regardless of which
mode produced it.

**Why this is safe by construction:** `ScenarioProfileService` always emits
`label`/`service_window`/`operational_focus` (falling back to a generic
profile grounded in the raw text if the LLM call fails or returns something
malformed), because `complaint_service.py`/`inventory_service.py`/
`reservation_service.py` read those keys via direct dict access
(`scenario_profile["label"]`, not `.get()`) once `scenario_profile` is
truthy — a profile missing any of the three would `KeyError` deep in the
pipeline otherwise.

**Caching:** custom-profile runs skip the semantic cache and the plan-result
cache entirely (`apps/api/app/orchestration/graph.py`,
`apps/api/app/api/routes/planning.py`) — two different free-text
descriptions would otherwise collide on the same `scenario="custom"` cache
key.

## What's explicitly out of scope here (P6-A26)

Where the natural-language input sits in the page layout, the live-signals
context strip, and Action Queue placement all belong to the Today Dashboard
redesign task that follows this one — P6-A25 only owns the backend
(schema relaxation, `ScenarioProfileService`) and the input widget itself
(`PlanShiftModal.tsx`).
