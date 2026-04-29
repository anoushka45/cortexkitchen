# CortexKitchen Evaluation

This document summarizes how the current project should be evaluated as of April 29, 2026.

## What matters now

Evaluation is no longer just "did the Friday route return JSON?" The project should be judged on:

- scenario fit
- critic quality
- operational realism
- auditability of persisted runs
- stability of seeded demo behavior

## Current evaluation layers

### Software correctness

- unit coverage for services, graph logic, and critic helpers
- integration coverage for routes and infrastructure boundaries

### Planning quality

- recommendations should match the selected scenario
- outputs should be specific enough for an operator to act on
- critic notes should explain approval, revision, or rejection clearly

### Data realism

- seeded reservation pressure should line up with the scenario selected
- inventory and complaint signals should affect the plan in visible ways

### Audit visibility

- persisted runs should preserve critic verdict, score, and recommendation detail
- the `/runs` page should remain useful for reviewing prior outputs

## Current evaluation references

- `PHASE2_EVALUATION_REFINEMENT.md` - scenario rubric and sanity-check detail
- backend tests in `apps/api/tests`

## Known limitation for this doc update

This documentation refresh did not include a fresh test execution. Treat the status here as codebase-aligned documentation, not a new verification report.
