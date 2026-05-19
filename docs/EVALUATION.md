# CortexKitchen Evaluation

Last updated: May 2026.

---

## Evaluation layers

CortexKitchen is evaluated across four layers: software correctness, planning quality, data realism, and audit visibility.

### Software correctness

- Unit tests cover individual service logic, graph nodes, and critic helpers (`apps/api/tests/unit/`)
- Integration tests cover API routes and infrastructure boundaries (`apps/api/tests/integration/`)
- Run the suite with `pytest tests/unit -q` and `pytest tests/integration -q` from `apps/api/`

### Planning quality

- Recommendations should match the selected scenario's operational framing
- Outputs should be specific enough for an operator to act on without further clarification
- Critic notes should clearly explain the verdict (`approved`, `revision`, or `rejected`)
- Dimension scores (safety, feasibility, evidence, actionability, clarity) should reflect actual plan strength
- `revision_reasons` and `actionable_feedback` should be present and non-generic when the verdict is not `approved`

### Data realism

- Seeded reservation pressure for the target date should align with the scenario (e.g. Friday Rush has high guest counts and waitlist entries)
- Inventory shortage and overstock signals should be reflected in the inventory recommendations
- Complaint patterns retrieved from Qdrant should match the operational context (e.g. high-volume service scenarios surface delay-related complaints)

### Audit visibility

- Every planning run should be persisted to the `planning_runs` table with critic verdict, score, and recommendation detail intact
- The `/runs` page should remain usable for reviewing and comparing prior outputs
- The `/data-health` endpoint should accurately reflect current seeded data coverage

---

## References

- `docs/PHASE2_EVALUATION_REFINEMENT.md` — scenario rubric and sanity-check detail
- `apps/api/tests/` — backend test suite
- `docs/AGENTS.md` — node-level responsibilities used for evaluating per-agent output quality
