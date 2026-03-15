# Agents
# CortexKitchen

## 1. Purpose

CortexKitchen is designed as a multi-agent decision system. Each agent has a clearly defined responsibility, limited tool access, and structured outputs.

This document defines:
- what each agent does
- what inputs it consumes
- which tools it can use
- what outputs it produces
- how the critic validates recommendations

The goal is to keep orchestration modular, explainable, and controllable.

---

## 2. Agent Design Principles

### 2.1 Single Responsibility
Each agent should focus on one operational domain only.

### 2.2 Tool-Bounded Execution
Agents should only use approved tools rather than directly accessing all infrastructure.

### 2.3 Structured Outputs
Agents should return structured summaries or recommendation objects, not vague free-form text only.

### 2.4 Critic Validation
No major recommendation is final until it passes through the critic layer.

### 2.5 Explainability
Each agent output should be understandable and traceable in logs.

---

## 3. Agent Overview

| Agent | Purpose | Main Inputs | Main Outputs |
|------|---------|-------------|--------------|
| Ops Manager Agent | Orchestrates overall scenario | scenario request, shared state | execution plan, aggregated outputs |
| Reservation Agent | Analyzes reservation pressure and capacity | reservations, capacity config | slot pressure, overbooking risk, reservation actions |
| Demand Forecast Agent | Predicts demand and rush windows | historical orders/reservations | forecast summary, peak windows |
| Complaint Intelligence Agent | Summarizes complaints and retrieves related context | complaints, SOPs, vector retrieval results | issue themes, evidence-backed recommendations |
| Menu Intelligence Agent | Evaluates item performance | sales data, menu metadata | menu insights, promo candidates |
| Inventory & Waste Agent | Detects stock/waste pressure | inventory, ingredients, demand signals | stock alerts, shortage/overstock indicators |
| Critic Agent | Validates recommendations | aggregated outputs, business rules | approval status, issues, score |

---

## 4. Shared Orchestration State

A shared orchestration state should carry information between agents.

### Example state categories
- request metadata
- scenario type
- input parameters
- partial agent outputs
- retrieved context summaries
- critic results
- final recommendation set

### Example state flow
1. request enters
2. Ops Manager sets scenario
3. domain agents populate findings
4. critic reviews findings
5. final response is assembled
6. trace is stored

---

## 5. Ops Manager Agent

## Role
Central controller of the workflow.

## Responsibilities
- interpret incoming scenario request
- determine which agents should run
- sequence execution
- aggregate outputs into a unified recommendation package
- send final package to the critic
- prepare final response structure

## Typical Inputs
- scenario type
- target day/time
- location or restaurant context
- orchestration state

## Allowed Tools
- orchestration router
- shared state tools
- result aggregator

## Outputs
- execution plan
- participating agents list
- aggregated recommendation draft

## Notes
This agent does not perform deep domain analytics itself. It coordinates other agents.

---

## 6. Reservation Agent

## Role
Reservation and seating-capacity intelligence.

## Responsibilities
- analyze reservations by slot
- compare reservation load to capacity
- identify overbooking or pressure windows
- recommend slot balancing actions
- support waitlist decisions

## Typical Inputs
- reservation records
- seating capacity config
- time-slot definitions
- target planning window

## Allowed Tools
- reservation query tools
- capacity rule validator
- reservation analytics service

## Outputs
- slot utilization summary
- overbooking risk indicator
- recommended actions such as:
  - cap bookings for slot
  - shift bookings to adjacent slot
  - activate waitlist strategy

## Example Output Shape
- target_window
- total_bookings
- capacity_limit
- utilization_percent
- pressure_slots
- recommended_reservation_actions

---

## 7. Demand Forecast Agent

## Role
Demand and rush prediction.

## Responsibilities
- estimate daily demand
- estimate hourly peaks
- identify likely rush periods
- provide a planning signal for other agents

## Typical Inputs
- historical order counts
- historical reservations
- day-of-week context
- target date

## Allowed Tools
- forecast service
- historical analytics query tools

## Outputs
- predicted demand summary
- expected peak windows
- optional confidence level
- staffing or prep pressure signals

## Notes
Phase 1 will use a baseline forecast.
Phase 2 may upgrade to Prophet.

---

## 8. Complaint Intelligence Agent

## Role
Complaint and review intelligence.

## Responsibilities
- summarize recent complaints
- identify recurring issue themes
- retrieve similar historical complaints
- retrieve relevant SOPs or operational notes
- convert complaints into operational insights

## Typical Inputs
- recent complaint texts
- vector retrieval results
- date filters
- scenario context

## Allowed Tools
- vector retrieval tool
- complaint query tool
- LLM summarization tool
- theme extraction logic

## Outputs
- complaint summary
- recurring issues list
- evidence snippets or references
- suggested operational fixes

## Example Themes
- slow pizza preparation
- delayed table service
- cold food complaints
- incorrect order handling

## Notes
This agent is a major consumer of RAG functionality.

---

## 9. Menu Intelligence Agent

## Role
Menu performance analysis.

## Responsibilities
- identify best sellers
- identify low-performing items
- surface items with promotion potential
- connect sales trends to recommendations

## Typical Inputs
- menu catalog
- sales counts
- revenue or margin metadata
- date range

## Allowed Tools
- sales analytics query tools
- menu metadata query tools
- optional recommendation formatter

## Outputs
- top-performing items
- weak-performing items
- candidate promotions
- menu insight summary

## Notes
Phase 1 can keep this simple and insight-oriented.
Pricing optimization can remain limited initially.

---

## 10. Inventory & Waste Agent

## Role
Inventory pressure and waste-awareness agent.

## Responsibilities
- detect shortage risk
- detect overstock risk
- connect forecasted demand to ingredient stress
- support future reorder recommendations

## Typical Inputs
- ingredient inventory levels
- reorder thresholds
- spoilage metadata
- demand forecast signal

## Allowed Tools
- inventory query tools
- threshold rule checker
- demand-to-ingredient mapping logic

## Outputs
- shortage alerts
- overstock alerts
- ingredient pressure summary
- suggested next action

## Notes
This agent may remain lighter in Phase 1 and grow in Phase 2.

---

## 11. Critic Agent

## Role
Validation, governance, and safety layer.

## Responsibilities
- review aggregated recommendations
- check if recommendations violate business constraints
- verify recommendations are evidence-backed
- reject unsupported or unsafe outputs
- assign approval result and quality score

## Typical Inputs
- aggregated recommendations
- retrieved context summary
- reservation limits
- rule definitions
- scenario metadata

## Allowed Tools
- business rule validator
- evidence checker
- optional LLM reasoning support
- critic scoring logic

## Outputs
- approval status
- violations or concerns
- score/confidence
- revision notes if needed

## Example Rules
- no reservation recommendation can exceed seating capacity
- do not suggest pricing changes outside defined bounds
- recommendations should align with observed complaint evidence
- do not claim unsupported operational certainty

## Importance
The critic is one of the most important agents in the system because it makes the architecture feel governed and enterprise-like.

---

## 12. Planned Agent Execution for Friday Rush Scenario

### Likely flow
1. Ops Manager receives Friday rush planning request
2. Demand Forecast Agent predicts rush window
3. Reservation Agent checks slot pressure
4. Complaint Intelligence Agent summarizes recent issues
5. Menu and Inventory agents may contribute secondary signals
6. Ops Manager aggregates proposals
7. Critic Agent validates final package
8. final output is returned and logged

---

## 13. Example Recommendation Bundle

A final recommendation bundle may include:
- expected rush window
- high-pressure reservation slot
- complaint-derived operational concern
- recommended reservation adjustment
- recommended prep/staff action
- critic approval result

---

## 14. Future Agent Expansion

The architecture can later support:
- staffing optimization agent
- promotion campaign agent
- supplier coordination agent
- voice operations assistant
- multi-location performance agent

These are not required for MVP.

---

## 15. Summary

CortexKitchen uses a specialized multi-agent design so that each domain of restaurant operations can be analyzed independently, combined coherently, and validated before output. This makes the system more modular, explainable, and realistic than a single-agent or chatbot-style design.