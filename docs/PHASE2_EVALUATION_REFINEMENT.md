# Phase 2 Evaluation Refinement

## Purpose

P2-05 tightens Friday Rush evaluation so CortexKitchen is judged on operational quality, not only whether the API returns a response.

The evaluation layer now has three parts:
- manual rubric for human review
- scenario checklist for repeatable validation
- automated sanity checks before critic approval

## Manual Rubric

Score each dimension from 1 to 5.

| Dimension | 1 | 3 | 5 |
| --- | --- | --- | --- |
| Scenario Fit | Generic or off-scenario | Mentions Friday Rush but misses key pressure | Clearly addresses May 1 Friday Rush with demand, reservations, menu, complaints, and inventory |
| Specificity | Vague advice | Some concrete actions | Named ingredients/items, quantities, owners, and timing |
| Evidence Use | No visible evidence | Uses one or two signals | Ties actions to forecast, reservations, complaint themes, inventory alerts, and RAG context |
| Rule Safety | Violates capacity, staffing, price, or reservation policy | Mostly safe with minor ambiguity | Fully respects operational constraints |
| Quantity Realism | Restock or staffing quantities are implausible | Quantities are plausible but weakly justified | Quantities are bounded by shortfall/current stock and Friday demand |
| 24h Feasibility | Recommends long-term actions | Mix of immediate and longer-term actions | Every critical action can be completed before service |
| Manager Usability | Hard to act on | Understandable but incomplete | Ready for a manager pre-shift checklist |
| Critic Alignment | Critic misses obvious issues | Critic catches some issues | Critic feedback matches rubric and explains revisions |

Suggested interpretation:
- 34-40: demo-ready
- 27-33: acceptable, tune wording or evidence
- 20-26: needs revision before release
- below 20: blocked

## Friday Rush Scenario Checklist

Run this against the seeded `2026-05-01` Friday planning target.

Preconditions:
- Seed data has history through `2026-04-26`.
- `2026-04-24` is treated as completed historical rush data.
- `2026-05-01` has future reservation pressure.

Functional checks:
- Planning endpoint returns `scenario=friday_rush`.
- `target_date` is `2026-05-01` when requested.
- Response includes forecast, reservation, complaint, menu, and inventory blocks.
- Critic block includes `verdict`, `score`, `notes`, and decision log id when not in simulation.
- RAG context is present or explicitly empty.

Quality checks:
- Forecast references recent Friday history, including the April 24 spike.
- Reservation recommendation recognizes near-capacity risk without cancelling confirmed bookings.
- Inventory recommendation prioritizes critical shortages before overstock.
- Inventory restock quantities do not exceed max actionable quantities.
- Menu recommendation avoids pushing items constrained by shortages or complaint patterns.
- Complaint recommendation names recurring issues, not generic service improvement.
- All urgent recommendations can be executed within 24 hours.

Failure checks:
- A recommendation to seat more than 70 guests is rejected.
- A recommendation to add more than 20 staff is rejected.
- A recommendation to close the restaurant or cancel all reservations is rejected.
- A restock recommendation above the ingredient cap is sent to revision.
- A long-term action such as menu redesign next month fails 24h feasibility.

## Automated Sanity Checks

Implemented in `EvaluationSanityChecker`.

Schema validation:
- aggregated recommendation must be an object
- required top-level keys: `scenario`, `target_date`, `agents`, `summary_for_critic`
- expected agent blocks: forecast, reservation, complaint, menu, inventory
- each agent block should include `data` and `recommendation`

Policy checks:
- max restaurant capacity: 70 guests
- max additional staff: 20
- max price change: 30%
- no closing the restaurant
- no cancelling all reservations

Quantity realism:
- inventory quantities are scanned near ingredient names
- restock quantity must not exceed `max_actionable_restock_qty`
- if no explicit cap exists, max actionable is `max(shortfall, current_stock * 3)`

24h feasibility:
- flags long-term actions such as renovation, menu redesign, permanent hiring, supplier contracts, or next-month work
- warns when inventory restock actions omit immediate, 24-hour, or pre-Friday timing

Critic integration:
- sanity findings are included in the critic prompt
- policy errors force `rejected`
- other sanity errors downgrade `approved` to `revision`
- sanity summary is appended to critic notes

## Critic Calibration Notes

The critic should be strict on hard constraints and practical on recommendation quality.

Approve when:
- recommendations obey all hard rules
- actions are concrete and Friday-specific
- restock/staffing quantities are bounded and feasible
- risks are named but manageable

Request revision when:
- action is directionally useful but too vague
- restock quantity exceeds a realistic cap
- inventory timing is unclear
- menu guidance ignores a shortage or complaint theme
- evidence is present but not tied to the action

Reject when:
- capacity exceeds 70 guests
- more than 20 additional staff are recommended
- confirmed reservations are harmed
- restaurant closure or mass cancellation is proposed
- food safety risk is ignored
- recommendation cannot plausibly be executed before service

Calibration examples:
- "Order 4.5kg Mozzarella Cheese within 24 hours" with 4.5kg shortfall: approve.
- "Order 50kg Mozzarella Cheese within 24 hours" with 3.5kg current stock: revision.
- "Seat 90 guests by increasing dining capacity": reject.
- "Start a full menu redesign next month": reject for Friday Rush planning.
- "Improve service speed": revision because it is not specific enough.
