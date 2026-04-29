# CortexKitchen Implementation Plan

This document is the current delivery plan after the initial architecture and Phase 1/2 build-out.

## Already delivered

- Backend scaffold, infra setup, schema work, and seed path
- Shared scenario orchestration route
- Four scenario presets
- Planning run persistence and inspection routes
- Dashboard, run audit view, and data-health view
- Critic scoring, sanity-check support, and richer evaluation notes

## Current priorities

### 1. Keep docs aligned with the actual app

The repo grew beyond the original "Friday-only MVP" docs. Keeping architecture, API, and status docs current is now a real maintenance task.

### 2. Strengthen the operator workflow

Focus areas:

- clearer scenario framing
- better run audit filtering
- stronger manager-facing summaries

### 3. Consolidate shared contracts

`packages/core` is still empty, so shared models and contracts are a likely next cleanup area.

### 4. Prepare for non-demo use

Future work includes:

- auth
- deployment strategy
- environment hardening
- live integrations

## Suggested next sequence

1. Stabilize documentation and current workflow language
2. Improve run audit filtering and scenario-specific visibility
3. Move shared contracts into `packages/core`
4. Add deployment/auth groundwork
5. Expand scenarios and integration realism

## Scope guardrails

- Keep the local-first demo experience working
- Do not overbuild cloud or auth flows before core planning quality is solid
- Prefer shared abstractions only where duplication is already painful
