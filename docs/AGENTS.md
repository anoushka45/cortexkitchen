# CortexKitchen Agents

This document describes the active orchestration roles in the current CortexKitchen backend.

## Current graph roles

### Ops Manager

Coordinates scenario framing, sequencing, and shared state flow.

### Demand Forecast

Produces the demand and peak-service signal used by the rest of the workflow.

### Reservation

Evaluates booking pressure, occupancy risk, and service-window strain.

### Complaint Intelligence

Retrieves complaint and SOP context, then turns it into operational risk signals.

### Menu Intelligence

Generates menu-oriented guidance tied to demand and operational constraints.

### Inventory

Flags shortage and overstock concerns relevant to the selected scenario.

### Aggregator

Combines domain outputs into a single package for critic review.

### Critic

Scores and validates the aggregated plan, including sanity-check and cost-aware signals where available.

### Final Assembler

Shapes the final API response returned to the client.

## What changed from the older docs

- The system is no longer documented as a strictly Friday-only flow
- Scenario-aware orchestration is part of the implemented backend
- Persisted planning runs and critic detail are part of the current user experience
- Auditability is visible in the `/runs` flow, not only a future design goal

## Current scenario presets

- `friday_rush`
- `weekday_lunch`
- `holiday_spike`
- `low_stock_weekend`

## Practical note

The codebase still uses the original agent-oriented naming even when a component behaves more like a deterministic service stage than a free-form autonomous agent. That is expected in the current implementation.
