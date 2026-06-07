# packages/core

Placeholder for shared contracts between the frontend and backend.

Last updated: June 2026.

## Current status

No shared runtime code is checked in here yet. Backend and frontend types live independently inside their respective app folders.

## Intended purpose

As the surface area between `apps/api` and `apps/web/cortexkitchen-ui` grows, this package is the right place to consolidate:
- Shared API response types (TypeScript + Python Pydantic models)
- Scenario preset definitions
- Critic dimension score schemas
- Planning run summary shapes

## Phase 6 candidate

Extracting shared types into this package is on the Phase 6 list — triggered when type drift between frontend and backend becomes a maintenance problem.
