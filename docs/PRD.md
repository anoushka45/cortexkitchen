# Product Requirements Document (PRD)
# CortexKitchen

## 1. Project Overview

CortexKitchen is an AI-powered autonomous restaurant operating system focused on helping a  restaurant make better operational decisions.

It is not a chatbot and not a basic RAG demo. It is a multi-agent AI system that combines forecasting, decision intelligence, vector memory, and business-rule validation to support restaurant operations.

The flagship scenario for the project is **Friday Night Rush Optimization**, where the system predicts demand, checks reservation capacity, analyzes complaint trends, and recommends actions that are validated before being shown to the user.

---

## 2. Problem Statement

Restaurants often struggle with:
- unpredictable rush hours
- inefficient reservation handling
- food waste
- recurring customer complaints
- weak visibility into menu performance
- lack of operational decision support

Most small and mid-sized restaurants do not have intelligent systems that combine operational data, historical memory, and AI-driven recommendations.

CortexKitchen aims to fill that gap with a modular AI system that can reason over restaurant data and produce explainable, governed recommendations.

---

## 3. Vision

To build a multi-agent AI operating layer for restaurant operations that is:
- intelligent
- explainable
- extensible
- production-minded
- suitable as both a capstone and a startup-style prototype

---

## 4. Goals

### Primary Goals
- Build a multi-agent AI system using LangGraph
- Combine structured data, vector retrieval, and ML forecasting
- Produce decision recommendations with validation and traceability
- Create a strong flagship demo around Friday night restaurant optimization
- Maintain enterprise-style architecture while using free/local tools

### Secondary Goals
- Keep the system modular enough to swap LLM providers later
- Build documentation as if this were a real product team project
- Make the project presentable to recruiters, startups, and internal seniors

---

## 5. Non-Goals

The following are intentionally out of scope for initial phases:
- live POS integrations
- real-time WhatsApp ordering
- production deployment in cloud
- multi-tenant restaurant management
- payment processing
- mobile app
- full staff scheduling engine
- real supplier integrations

These can be added later if needed.

---

## 6. Target User

### Primary User
Restaurant manager / operations lead of a pizza-focused casual dining restaurant.

### Secondary Users
- founders evaluating vertical AI SaaS ideas
- recruiters reviewing capstone projects
- engineering mentors or seniors reviewing system design maturity

---

## 7. Core Use Cases

1. Forecast expected Friday evening demand
2. Check if reservations exceed safe capacity
3. Analyze recent complaints and identify recurring issues
4. Suggest menu actions for low-performing items
5. Retrieve SOPs or past decision memory when generating recommendations
6. Validate all recommendations through a critic agent
7. Display recommendations and traces in a dashboard

---

## 8. Core Features

### 8.1 Reservation Intelligence
- reservation creation and management
- time-slot capacity validation
- overbooking detection
- waitlist and slot-balancing suggestions

### 8.2 Demand Forecasting
- daily demand forecasting
- hourly rush prediction
- baseline model first
- later upgrade to Prophet

### 8.3 Complaint Intelligence
- summarize customer complaints
- cluster complaint themes
- retrieve similar historical complaints
- retrieve SOP context
- suggest fixes

### 8.4 Menu Intelligence
- identify best-selling items
- identify weak-performing items
- suggest promotions or changes
- support future pricing insights

### 8.5 Inventory and Waste Awareness
- detect overstock and shortage signals
- predict spoilage risk at a simple level
- support future reorder suggestions

### 8.6 Agent Orchestration
- centralized orchestration via LangGraph
- agent-specific task routing
- controlled tool access

### 8.7 Critic Validation
- validate every recommendation
- check business rules
- score safety and compliance
- reject unrealistic actions

### 8.8 Decision Trace Logging
- store each recommendation and its evidence
- support explainability, auditing, and evaluation

---

## 9. Flagship Demo Scenario

### Friday Night Rush Optimization

The system should be able to:
1. forecast Friday demand
2. identify reservation pressure in the 7 PM–9 PM window
3. retrieve recent complaints related to pizza delays or slow service
4. recommend actions such as reservation caps, waitlist activation, prep adjustments, or item promotions
5. pass those recommendations through critic validation
6. display the final plan with explanation and trace logs

---

## 10. Functional Requirements

### Must-Have (Phase 1)
- FastAPI backend scaffold
- LangGraph orchestration flow
- Gemini-based LLM layer with provider abstraction
- PostgreSQL operational schema
- Qdrant vector memory for complaints/SOPs/decision summaries
- Redis for light caching and runtime state
- baseline forecast service
- complaint analysis flow
- basic dashboard for outputs
- decision trace storage
- critic validation flow

### Should-Have (Phase 2)
- Prophet-based forecasting
- inventory alerts
- menu promotion recommendations
- stronger dashboard analytics
- improved evaluator metrics

### Nice-to-Have (Phase 3)
- multi-agent debate loop
- cost-aware recommendations
- continuous learning from decision outcomes
- advanced rule tuning

---

## 11. Non-Functional Requirements

- modular architecture
- local reproducibility with Docker Compose
- clean API contracts
- testable services and rules
- provider abstraction for LLMs
- expandable data model
- documentation-first workflow
- explainable outputs

---

## 12. Success Criteria

The project is successful if:
- it runs locally with reproducible setup
- the Friday rush demo works end-to-end
- recommendations are validated and explainable
- the architecture is clear and extensible
- the project is strong enough to present in interviews and demos

---

## 13. Risks

- over-scoping too early
- excessive agent complexity in MVP
- weak synthetic data quality
- spending too much time on UI before backend intelligence is ready
- trying to make all features perfect instead of shipping the flagship demo

---

## 14. Constraints

- solo developer project
- local-first setup
- free-tier friendly tools only
- limited external integrations initially
- architecture should still look enterprise-grade

---

## 15. Final Statement

CortexKitchen is a multi-agent AI operating system for restaurant operations that uses forecasting, retrieval, structured data, and validated reasoning to optimize decision-making for a pizza-focused restaurant.