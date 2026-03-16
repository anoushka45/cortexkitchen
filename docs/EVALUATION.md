# Evaluation Strategy
# CortexKitchen

## 1. Purpose

This document defines how CortexKitchen will be evaluated as an AI-driven decision system.

The goal is not only to check whether the system runs, but whether it produces:
- useful recommendations
- valid recommendations
- explainable recommendations
- repeatable recommendations
- demo-ready outputs

Because CortexKitchen is a multi-agent system, evaluation must cover both:
- software correctness
- AI decision quality

---

## 2. Evaluation Philosophy

CortexKitchen is not a chatbot benchmark project.

It should be evaluated like a vertical AI operational system.

That means we care about:
- business usefulness
- rule compliance
- evidence-backed reasoning
- orchestration correctness
- system reliability

---

## 3. Evaluation Categories

## 3.1 Functional Correctness
Checks whether features behave as expected.

### Questions
- does the API return correct structures?
- are reservations created and queried correctly?
- does the forecast service return expected values?
- are complaint retrieval and summaries generated?
- are decision traces stored properly?

### Measured via
- unit tests
- integration tests
- API tests
- seed/demo flow verification

---

## 3.2 Orchestration Correctness
Checks whether the right agents are invoked in the right order for a scenario.

### Questions
- does the Friday rush planning flow invoke the expected agents?
- are intermediate results passed through shared state correctly?
- is critic validation always applied before final output?
- are optional agents included/excluded based on flags?

### Measured via
- orchestration tests
- trace inspection
- structured flow assertions

---

## 3.3 Recommendation Quality
Checks whether recommendations are actually useful and sensible.

### Questions
- are recommendations relevant to the Friday rush scenario?
- do they reflect demand, reservation, and complaint inputs?
- are suggested actions realistic for a restaurant manager?
- do outputs avoid vague generic advice?

### Example of strong recommendation
- cap reservations for 7:30 PM slot
- activate waitlist for peak interval
- pre-prep dough before 6 PM
- monitor pizza station throughput

### Example of weak recommendation
- improve service quality
- try to be faster
- manage customers better

### Measured via
- manual review rubric
- seeded scenario evaluation
- critic review outcomes
- side-by-side output review over time

---

## 3.4 Rule Compliance
Checks whether recommendations obey business constraints.

### Questions
- does the system ever exceed seating limits?
- does it propose unsupported or unsafe actions?
- does it suggest pricing or capacity changes outside policy?
- does it make claims without evidence?

### Measured via
- critic logic
- rule tests
- validation failure scenarios

---

## 3.5 Retrieval Quality
Checks whether Qdrant-backed retrieval is actually useful.

### Questions
- are similar complaints being retrieved correctly?
- do retrieved SOPs match the scenario context?
- are irrelevant results avoided?
- does metadata filtering work as expected?

### Measured via
- retrieval test fixtures
- manual relevance inspection
- query-to-result validation
- complaint-theme alignment checks

---

## 3.6 Explainability and Trace Quality
Checks whether outputs are understandable and auditable.

### Questions
- does each major recommendation have a rationale?
- is evidence summarized clearly?
- are agent contributions visible?
- is critic approval status explicit?

### Measured via
- trace object inspection
- dashboard rendering review
- schema validation for trace records

---

## 3.7 Repeatability
Checks whether seeded test scenarios produce stable behavior.

### Questions
- when using the same seed/demo data, are outputs reasonably consistent?
- does the system avoid large unexplained drift?
- do recommendation structures remain stable across runs?

### Measured via
- repeated seeded runs
- evaluation snapshots
- response schema comparison

---

## 4. Core Evaluation Dimensions

For major decision outputs, we will evaluate against these dimensions:

| Dimension | Meaning |
|----------|---------|
| Relevance | recommendation matches the actual scenario |
| Specificity | recommendation is concrete, not generic |
| Evidence Use | recommendation reflects retrieved or queried inputs |
| Rule Safety | recommendation respects constraints |
| Explainability | recommendation can be understood by a manager |
| Actionability | recommendation can realistically be acted on |

---

## 5. Phase-Wise Evaluation Plan

## Phase 0
Focus on design quality, completeness, and readiness.

### Evaluate
- documentation completeness
- architecture consistency
- implementation readiness
- scope clarity

---

## Phase 1
Focus on MVP correctness and Friday rush scenario quality.

### Evaluate
- end-to-end planning flow works
- main agents execute correctly
- critic validation occurs
- recommendation bundle is coherent
- traces are stored and viewable

---

## Phase 2
Focus on stronger optimization quality.

### Evaluate
- inventory/menu insights are more meaningful
- forecasting improves
- dashboard becomes more informative
- retrieval quality improves with richer memory

---

## Phase 3
Focus on sophistication and robustness.

### Evaluate
- advanced critic behavior
- debate/review quality if added
- memory reuse quality
- consistency and maturity of recommendations

---

## 6. Testing Layers

## 6.1 Unit Tests
Tests small components in isolation.

### Examples
- reservation capacity validator
- rule-checking utilities
- forecast helper functions
- response schema formatting
- critic score logic

---

## 6.2 Integration Tests
Tests interactions across services.

### Examples
- API with PostgreSQL
- Qdrant retrieval integration
- Redis cache behavior
- planning service with orchestrator
- trace persistence flow

---

## 6.3 End-to-End Tests
Tests full user scenarios.

### Key E2E Scenario
Friday Night Rush Optimization:
1. seed restaurant data
2. run planning endpoint
3. verify forecast output
4. verify reservation pressure
5. verify complaint summary
6. verify critic result
7. verify decision trace persisted

---

## 6.4 Evaluation Tests
These are domain-quality checks, not just software checks.

### Examples
- complaint-heavy scenario should surface complaint insights
- high-utilization scenario should trigger reservation controls
- evidence-backed outputs should score higher than vague ones
- critic should reject invalid recommendations

---

## 7. Evaluation Rubric for Manual Review

Use this for demo-quality reviews.

| Category | Score 1 | Score 3 | Score 5 |
|---------|---------|---------|---------|
| Relevance | off-topic | partly useful | highly relevant |
| Specificity | vague | somewhat concrete | very actionable |
| Evidence Use | unsupported | partial evidence use | clear evidence-backed |
| Safety | risky / invalid | mostly valid | fully compliant |
| Explainability | unclear | understandable | very clear |
| Demo Quality | weak story | acceptable | impressive |

### Suggested interpretation
- 24–30 = strong
- 18–23 = acceptable but improvable
- below 18 = needs refinement

---

## 8. Example Friday Rush Evaluation Questions

For a Friday rush output, ask:
- did the system identify the correct rush window?
- did it detect reservation pressure correctly?
- did complaint insights mention slow pizza prep if such data existed?
- were recommendations concrete?
- did critic validation clearly approve or reject?
- was the output easy to explain in a demo?

---

## 9. Failure Cases We Intentionally Want to Test

- reservation load exceeds allowed capacity
- complaint retrieval returns irrelevant context
- critic should reject unsupported recommendation
- planning flow should gracefully handle missing complaint data
- dependency health endpoint should show degraded service clearly

These are valuable because they make the project feel realistic.

---

## 10. Success Metrics

The system is considered evaluation-ready when:
- main scenario works reliably
- recommendations are specific and evidence-backed
- critic catches obvious bad outputs
- traces make decisions understandable
- the demo is convincing to technical reviewers

---

## 11. Summary

CortexKitchen evaluation must measure both engineering correctness and AI decision quality. The project should be judged not only on whether it runs, but on whether it produces safe, useful, explainable, and scenario-relevant operational recommendations.