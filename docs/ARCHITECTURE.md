
## 1. Overview

CortexKitchen is a multi-agent AI operating system for restaurant operations. It is designed to support decision-making for a pizza-focused restaurant by combining structured data, vector memory, forecasting, and governed LLM reasoning.

The architecture is intentionally designed to be:
- modular
- explainable
- local-first
- enterprise-minded
- free-tier friendly
- easy to expand later

The flagship scenario is **Friday Night Rush Optimization**.

---

## 2. High-Level Architecture

```text
┌─────────────────────────────────────────────────────────────┐
│                        Frontend (Next.js)                  │
│  Dashboard: forecasts, recommendations, complaints, logs   │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                       API Layer (FastAPI)                  │
│   Request handling, validation, orchestration entrypoint   │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│              Agent Orchestration Layer (LangGraph)         │
│ Ops Manager → specialized agents → critic → final result   │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                         Tools Layer                        │
│  SQL tools | vector retrieval | forecast | rules | cache   │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                         Data Layer                         │
│ PostgreSQL | Qdrant | Redis | seed/synthetic datasets      │
└─────────────────────────────────────────────────────────────┘
````

---

## 3. Architectural Principles

### 3.1 Multi-Agent, Not Monolithic Prompting

The system will not rely on a single giant prompt. Instead, it will use specialized agents with limited responsibilities and controlled tool access.

### 3.2 Hybrid Intelligence

Different tasks require different computation modes:

* SQL for structured operational logic
* ML/statistical forecasting for demand prediction
* vector retrieval for memory and context
* LLM reasoning for explanation and recommendation generation
* rule validation for governance and safety

### 3.3 Explainability by Design

All major recommendations must be traceable. The system should store:

* what inputs were used
* what evidence was retrieved
* which agent proposed the action
* whether the critic approved it
* final confidence or score

### 3.4 Documentation-First Development

The architecture should be explicit before implementation. This project is intended to read like a real product/system design effort.

### 3.5 Expandable but Controlled Scope

The system should be expandable toward external review sources, reservation platforms, and future integrations, but the MVP remains focused on the Friday rush scenario.

---

## 4. Core System Layers

## 4.1 Frontend Layer

### Stack

* Next.js
* TypeScript
* Tailwind CSS
* Recharts

### Responsibilities

* display demand forecast charts
* display reservation pressure
* show complaint themes
* show AI-generated recommendations
* display decision trace logs
* surface critic validation results

### MVP Scope

The frontend will initially act as a dashboard for observing outputs rather than a full operational restaurant portal.

---

## 4.2 API Layer

### Stack

* FastAPI
* Pydantic schemas

### Responsibilities

* receive requests from frontend or test client
* validate payloads
* invoke orchestration flows
* return structured responses
* expose health and debug endpoints
* separate API contracts from domain logic

### Initial Endpoints (planned)

* health check
* run Friday rush planning flow
* reservation data endpoints
* complaint analysis endpoint
* decision logs endpoint
* seed/debug endpoints for local testing

---

## 4.3 Agent Orchestration Layer

### Stack

* LangGraph
* minimal LangChain usage where helpful

### Purpose

This is the core intelligence layer. It coordinates how requests move through the system.

### Planned Flow

1. request enters system
2. Ops Manager Agent classifies scenario and routes tasks
3. relevant agents gather findings using tools
4. outputs are aggregated
5. Critic Agent validates proposed actions
6. final response is assembled
7. decision trace is stored

### Why LangGraph

LangGraph is chosen because the system needs:

* stateful orchestration
* branching logic
* clear agent sequencing
* controlled execution flow
* future support for review/retry or debate loops

---

## 5. Agent Architecture

The system uses specialized agents instead of one general agent.

### 5.1 Ops Manager Agent

**Role:** central controller

**Responsibilities:**

* receives scenario request
* determines which agents should run
* aggregates intermediate outputs
* prepares final package for critic review

**Why it exists:**
Keeps orchestration centralized and avoids every route manually hardcoding agent logic.

---

### 5.2 Reservation Agent

**Role:** reservation and capacity intelligence

**Responsibilities:**

* analyze reservations by time slot
* check capacity utilization
* detect overbooking risk
* recommend slot balancing / waitlist actions

**Primary data source:**
PostgreSQL

---

### 5.3 Demand Forecast Agent

**Role:** demand prediction

**Responsibilities:**

* generate demand estimate for a given day/time window
* identify likely rush periods
* support staffing and prep recommendations

**Primary tools:**
forecast service + historical sales/order/reservation data

---

### 5.4 Complaint Intelligence Agent

**Role:** complaint analysis and retrieval-based insight generation

**Responsibilities:**

* summarize recent complaints
* identify recurring complaint themes
* retrieve similar historical complaints
* retrieve SOP or operational guidance
* propose likely operational issues

**Primary tools:**
Qdrant retrieval + LLM summarization

---

### 5.5 Menu Intelligence Agent

**Role:** menu performance insight generation

**Responsibilities:**

* identify best/worst performing items
* identify candidates for promotion
* support future pricing recommendations

**Primary data source:**
PostgreSQL analytics queries

---

### 5.6 Inventory & Waste Agent

**Role:** stock and spoilage awareness

**Responsibilities:**

* identify shortage or overstock signals
* support future reorder recommendations
* connect forecast demand to ingredient pressure

**Primary data source:**
inventory and ingredient data from PostgreSQL

---

### 5.7 Critic Agent

**Role:** governance and validation

**Responsibilities:**

* validate all proposed actions
* check business rules
* reject unrealistic or unsafe recommendations
* assign approval status and score

**Examples of rules it may check:**

* do not exceed seating capacity
* do not suggest extreme price changes
* do not recommend unsupported operational actions
* recommendations must align with retrieved evidence

---

## 6. Tools Layer

Agents should not directly manipulate infrastructure in an unstructured way. They will use explicit tools/services.

### Planned Tool Categories

#### 6.1 SQL Tools

* reservation analytics query
* menu performance query
* complaint history lookup
* decision log writer
* inventory lookup

#### 6.2 Vector Retrieval Tools

* retrieve similar complaints
* retrieve SOP context
* retrieve past decision summaries

#### 6.3 Forecast Tools

* baseline forecast generation
* future Prophet-based forecast service

#### 6.4 Rules/Policy Tools

* seating capacity validation
* reservation constraints
* pricing boundaries
* critic rule checks

#### 6.5 Cache Tools

* recent forecast cache
* complaint summary cache
* temporary orchestration state

---

## 7. Data Layer

## 7.1 PostgreSQL

### Purpose

Primary operational database.

### Planned data domains

* reservations
* orders
* menu items
* ingredients
* inventory levels
* customer feedback metadata
* decision logs
* critic evaluation results

### Why PostgreSQL

* relational data fits restaurant operations
* strong query capability
* realistic backend design
* supports analytics and trace storage well

---

## 7.2 Qdrant

### Purpose

Vector memory layer.

### Planned stored content

* complaint texts
* SOP documents
* decision summaries
* operational guidance notes

### Why Qdrant

* better product-grade perception than simpler prototype stores
* strong metadata filtering
* good expansion path for later use

### Example metadata filters

* complaints only
* last 30 days
* Friday only
* pizza-related issues
* dining service SOPs only

---

## 7.3 Redis

### Purpose

Short-term state and caching.

### Planned uses

* cache repeated planning results
* cache complaint summaries
* temporary orchestration/session state
* future background processing support

### Why only light usage initially

Redis is part of the architecture, but the MVP should remain manageable.

---

## 8. LLM Strategy

## 8.1 Initial Provider

Gemini

### Why

* accessible/free-tier friendly
* strong enough for MVP reasoning tasks
* acceptable quality for summarization and recommendations

## 8.2 Abstraction Requirement

The system must not hardcode Gemini-specific logic everywhere.

Planned interface:

* `BaseLLMProvider`
* `GeminiProvider`
* future `GroqProvider`
* future `OpenAIProvider`

### Why abstraction matters

* lower lock-in
* easier experimentation later
* cleaner architecture story

## 8.3 LLM Responsibilities

The LLM will be used for:

* complaint summarization
* reasoning over retrieved context
* recommendation generation
* explanation generation
* critic reasoning support

### Not ideal for

* raw analytics
* capacity arithmetic
* deterministic business constraints
* forecasting math

Those belong elsewhere.

---

## 9. RAG Strategy

CortexKitchen uses RAG selectively, not universally.

### Use cases for RAG

* complaint intelligence
* SOP retrieval
* decision memory retrieval

### Non-use cases for RAG

* reservation arithmetic
* forecasting calculations
* strict business constraints
* menu sales aggregation

This selective approach avoids turning the entire project into a generic RAG demo.

---

## 10. Forecasting Strategy

## Phase 1

Use a simple baseline forecasting service:

* based on historical reservations/orders by day and hour
* enough to support the Friday rush story

## Phase 2

Upgrade to Prophet for:

* trend-aware forecasting
* improved day/time estimates
* richer analytics

The forecast output will be treated as an input signal for other agents rather than as a standalone system.

---

## 11. Decision Trace and Observability

Every important system recommendation should generate a trace record.

### Trace fields (planned)

* decision_id
* scenario_type
* request_timestamp
* participating_agents
* structured_inputs
* retrieved_context_summary
* proposed_actions
* critic_result
* final_output
* confidence or score

### Why this matters

* explainability
* debugging
* evaluation
* recruiter/demo value
* future auditability

---

## 12. Friday Rush Flow (Detailed)

### Input

Manager asks the system to plan for Friday night rush.

### Step-by-step flow

1. request hits FastAPI endpoint
2. orchestration starts in LangGraph
3. Ops Manager invokes:

   * Demand Forecast Agent
   * Reservation Agent
   * Complaint Intelligence Agent
   * optionally Menu/Inventory Agents
4. agents gather signals using DB, retrieval, and forecast tools
5. Ops Manager aggregates recommendations
6. Critic Agent reviews them
7. approved result is returned
8. decision trace is stored
9. frontend dashboard displays final outcome

### Example output

* expected rush window: 7 PM–9 PM
* reservation pressure high at 7:30 PM
* repeated complaint theme: slow pizza prep
* recommendation: cap new bookings between 7:30–8:00, prep dough earlier, activate waitlist handling
* critic status: approved with medium-high confidence

---

## 13. Future Expansion Path

The architecture is intentionally ready to support future additions such as:

* Google Reviews ingestion
* simulated or real third-party reservation sources
* POS integrations
* WhatsApp/order channels
* richer staffing optimization
* multi-location restaurant support

These are not part of MVP but are compatible with the design.

---

## 14. Testing Strategy (Architecture-Level)

Testing must exist at multiple levels:

### Unit Tests

* services
* business rules
* utility logic
* validators

### Integration Tests

* API + database interactions
* Qdrant retrieval integration
* Redis cache behavior
* orchestration service integration

### End-to-End Tests

* Friday rush planning scenario
* complaint analysis scenario
* reservation validation scenario

### Evaluation Tests

* recommendation quality checks
* critic approval/rejection behavior
* consistency across repeated seeded runs

---

## 15. Deployment and Infrastructure Approach

## Local Development

Use Docker Compose for:

* PostgreSQL
* Qdrant
* Redis

Backend and frontend can initially run locally outside containers for easier development.

## Future Option

Containerize backend/frontend later if needed for demo or deployment.

---

## 16. Why This Architecture Fits the Project

This architecture is appropriate because it:

* supports the Friday rush demo strongly
* uses the right tool for each type of problem
* remains feasible for a solo developer
* looks and behaves like a real product system
* stays expandable for future pitching

---

## 17. Summary

CortexKitchen is built as a modular, hybrid, multi-agent AI system that combines:

* FastAPI for services
* LangGraph for orchestration
* PostgreSQL for structured operations data
* Qdrant for vector memory
* Redis for cache/state
* Gemini for reasoning
* forecasting for demand intelligence
* critic validation for governance
