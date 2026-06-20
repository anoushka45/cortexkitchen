# CortexKitchen Evaluation

Last updated: June 2026. Reflects Phase 5 complete — LangSmith golden dataset, regression CI gate, RAGAS, and DeepEval.

---

## Evaluation layers

CortexKitchen is evaluated across five layers: software correctness, LangSmith regression, planning quality, data realism, and audit visibility.

---

### Layer 1 — Software correctness

Standard pytest suite covering service logic, graph nodes, and API routes.

```bash
cd apps/api

# Unit tests
pytest tests/unit -q

# Integration tests (requires running PostgreSQL + Qdrant + Redis)
pytest tests/integration -q --ignore=tests/integration/test_langgraph_flow.py
```

- `tests/unit/` — individual service logic, critic helpers, inventory alerts, forecast signal
- `tests/integration/` — API route responses, DB persistence, auth flow

---

### Layer 2 — LangSmith regression evals  <img src="../screenshots/logos/langsmith.png" height="18" alt="LangSmith">

The primary quality gate. A golden dataset of 50 curated planning runs is stored in LangSmith as `cortexkitchen-golden-v1`. Automated evaluators run against this dataset and the CI gate requires a **90% pass rate**.

![LangSmith Golden Dataset](../screenshots/09_observability_tools/langsmith_golden_dataset.png)

![LangSmith Run Traces](../screenshots/09_observability_tools/langsmith_run_traces.png)

**Building the dataset**

```bash
cd apps/api
python ../../scripts/build_golden_dataset.py
```

`build_golden_dataset.py` (in the root `scripts/` folder) pulls approved planning runs from Postgres (critic_score ≥ 0.7), uploads them to LangSmith as `cortexkitchen-golden-v1`, and saves a local `golden_runs.json` fixture for offline CI use.

**Running the CI gate**

```bash
pytest tests/unit/test_langsmith_evals.py -v
```

The gate runs against the local `golden_runs.json` fixture — no live LangSmith API calls required. Checks:
- Critic score ≥ 0.70 on all golden runs
- When shortage alerts exist, plan must contain restock actions
- Pass rate ≥ 90% — failing this blocks the run

**Requirements:** `LANGSMITH_API_KEY`, `GROQ_API_KEY` (for building the dataset; CI gate uses local fixture only)

---

### Layer 3 — LLM quality evals (RAGAS + DeepEval)  <img src="../screenshots/logos/ragas.png" height="18" alt="RAGAS">

Fine-grained evals on complaint RAG quality and critic/agent output quality.

```bash
pytest evals/test_ragas_complaint.py -v -W ignore::DeprecationWarning
pytest evals/test_deepeval_quality.py -v -W ignore::DeprecationWarning
```

| Suite | File | Metric | Threshold |
|-------|------|--------|-----------|
| RAGAS | `evals/test_ragas_complaint.py` | Faithfulness on complaint RAG pipeline | ≥ 0.8 |
| RAGAS | `evals/test_ragas_complaint.py` | Context precision (`answer_relevancy` excluded — requires embeddings provider) | ≥ 0.7 |
| DeepEval | `test_deepeval_quality.py` | HallucinationMetric on critic output | ≤ 0.5 |
| DeepEval | `test_deepeval_quality.py` | AnswerRelevancyMetric on agent outputs | ≥ 0.7 |

Both suites use Groq `llama-3.3-70b-versatile` as the evaluator LLM.

**RAGAS faithfulness** checks that every claim in the complaint recommendations is supported by retrieved Qdrant context — not hallucinated. This was the primary motivation for fixing the complaint node to pass RAG context into the LLM prompt (Phase 4).

**DeepEval hallucination** checks that the critic output does not make claims contradicted by the aggregated plan. **AnswerRelevancy** checks that agent outputs address the scenario's operational question.

---

### Layer 4 — Planning quality

Manual and automated checks on recommendation quality.

- Recommendations should match the selected scenario's framing (e.g. Friday Rush surfaces high-volume, peak-pressure actions — not low-stock weekend actions)
- Critic notes should clearly explain the verdict with scenario-specific reasoning
- Dimension scores should reflect actual plan strength — safety and feasibility should be the highest-weighted dimensions
- `revision_reasons` and `actionable_feedback` should be non-generic when the verdict is not `approved`
- What-if simulator scores (cost pressure, benefit, tradeoff) should move predictably when cover count changes

---

### Layer 5 — Data realism

Checks that seeded data flows correctly through the pipeline.

- Reservation pressure for the target date should align with the scenario (Friday Rush has high guest counts and waitlist entries)
- Inventory shortage and overstock signals should be reflected in inventory recommendations
- Complaint patterns retrieved from Qdrant should match the operational context — high-volume scenarios surface delay and wait-time complaints
- Prophet forecast should show peak demand in the correct service window for each scenario

**Verify with:**

```bash
GET /api/v1/data-health
```

Expected counts for a fresh seed: ~6500 orders, ~1200 reservations, ~160 feedback records, 18 inventory items, 27 menu items.

---

### Layer 6 — Audit visibility

- Every planning run should be persisted to `planning_runs` with critic verdict, score, recommendation detail, and full metadata
- The `/runs` page should remain usable — scenario filter, date range, critic score trend, run detail side panel, PDF and Excel export all functional
- The `/data-health` endpoint should accurately reflect current seeded data coverage
- The observability panel (`/data-health` → Observability tab) should aggregate the last 7 days of runs correctly

---

## Sentry exception capture  <img src="../screenshots/logos/sentry.png" height="18" alt="Sentry">

All unhandled exceptions are captured by Sentry (`sentry-sdk` with FastAPI integration). LangGraph node failures are wrapped with `capture_exception` so stack traces are tagged by node name.

Smoke test:

```bash
GET /debug/sentry-test
```

![Sentry Error Capture](../screenshots/09_observability_tools/sentry_error_capture.png)

---

## Observability panel

The frontend `/data-health` page includes an Observability section showing 7-day aggregate stats from `GET /api/v1/observability/summary`: total runs, success rate, average critic score, average duration, and breakdown by verdict and scenario.

![Observability Panel](../screenshots/06_data_health/observability_panel.png)

---

## References

- `apps/api/tests/` — backend test suite
- `apps/api/evals/` — RAGAS and DeepEval eval scripts
- `apps/api/tests/unit/test_langsmith_evals.py` — LangSmith regression CI gate (local fixture)
- `scripts/build_golden_dataset.py` — golden dataset builder (root scripts folder)
- `docs/AGENTS.md` — node-level responsibilities used for evaluating per-agent output quality
