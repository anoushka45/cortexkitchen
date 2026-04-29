# 🍽️ CortexKitchen

### Multi-agent restaurant operations copilot

![Status](https://img.shields.io/badge/status-active-success)
![Phase](https://img.shields.io/badge/phase-3_complete-blue)
![Backend](https://img.shields.io/badge/backend-FastAPI-009688)
![Frontend](https://img.shields.io/badge/frontend-Next.js-black)
![Orchestration](https://img.shields.io/badge/orchestration-LangGraph-purple)
![Vector DB](https://img.shields.io/badge/vector_db-Qdrant-orange)
![Database](https://img.shields.io/badge/database-PostgreSQL-blue)
![Cache](https://img.shields.io/badge/cache-Redis-red)
![License](https://img.shields.io/badge/license-MIT-lightgrey)

---

## 🧠 What is CortexKitchen?

CortexKitchen is a **multi-agent decision system** for restaurant operations.

It transforms fragmented service data into a **pre-shift execution plan** by coordinating forecasting, reservations, complaints (RAG), menu strategy, and inventory — then validating everything through a critic layer.

> Not a chatbot.
> A structured planning workflow.

---


## ⚡ What happens in one run?

1. Forecast demand and service pressure  
2. Analyze reservations and occupancy risk  
3. Retrieve complaint patterns (RAG)  
4. Evaluate menu performance  
5. Check inventory feasibility  
6. Generate a coordinated plan  
7. Critic scores and validates output  

➡️ Output: **actionable, pre-shift execution plan**


![Dashboard preview](<docs/images/ck dashboard.png>)


## 🚀 Core capabilities

### 📊 Multi-scenario planning

Run workflows for:

* `friday_rush`
* `weekday_lunch`
* `holiday_spike`
* `low_stock_weekend`

---

### 📈 Demand forecasting

* Peak detection
* Service pressure estimation
* Risk signals before shift

---

### 🪑 Reservation intelligence

* Booking density analysis
* Overload window detection

---

### 🧾 Complaint intelligence (RAG)

* Qdrant-backed retrieval
* Pattern-aware recommendations

---

### 🍝 Menu guidance

* Top vs weak items
* Promotion strategy aligned with demand

---

### 📦 Inventory risk detection

* Shortage / overstock alerts
* Feasibility-aware planning

---

### 🧑‍⚖️ Critic layer

* Scores recommendations
* Flags weak outputs
* Adds revision feedback

---

### 🧾 Runs & audit trail

* Persisted planning runs
* Traceable outputs + critic notes

---

## 🖥️ Product surface

### Dashboard (`/`)

* Scenario selection
* Structured planning output
* KPI-style summaries

### Runs (`/runs`)

* Historical runs
* Critic scores
* Full audit trail

### Data health (`/data-health`)

* Scenario coverage
* Data completeness signals

---

## 🏗️ System architecture

* **Backend:** FastAPI
* **Frontend:** Next.js
* **Orchestration:** LangGraph
* **Database:** PostgreSQL
* **Vector DB:** Qdrant
* **Cache / future async:** Redis
* **LLM layer:** provider abstraction (not hardwired)

---

## 🧪 What’s working today

* End-to-end planning pipeline (multi-stage)
* Scenario-aware workflows
* RAG-powered complaint intelligence
* Prophet-backed forecasting
* Critic scoring + validation
* Persisted runs with audit trail
* Dashboard + runs + data-health UI
* Docker-based local stack
* Seeded data for reproducible demos

---

## 📊 Project maturity

| Phase   | Status     | Highlights                               |
| ------- | ---------- | ---------------------------------------- |
| Phase 0 | ✅ Complete | Architecture, PRD, system design         |
| Phase 1 | ✅ Complete | API, infra, core services, Friday flow   |
| Phase 2 | ✅ Complete | Forecasting, inventory, menu, dashboard  |
| Phase 3 | ✅ Complete | Runs, critic, scoring, multi-scenarios   |
| Phase 4 | 🔜 Planned | Auth, integrations, async, observability |

---

## 📁 Project structure

```
apps/
  api/                  # FastAPI backend (services, orchestration, DB)
  web/cortexkitchen-ui # Next.js frontend

data/                   # raw, seed, processed datasets
docs/                   # architecture, roadmap, evaluation
infra/                  # infra setup docs
scripts/                # seeding + retrieval scripts
packages/core/          # shared logic (planned)
```

---

## 🧑‍💻 Local setup

### 1. Start infrastructure

```bash
docker compose up -d
```

### 2. Backend

```bash
cd apps/api
python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt
alembic upgrade head
python ..\..\scripts\seed_demo_data.py
python ..\..\scripts\seed_qdrant_memory.py
uvicorn app.main:app --reload
```

### 3. Frontend

```bash
cd apps/web/cortexkitchen-ui
npm install
npm run dev
```

* Frontend → [http://localhost:3000](http://localhost:3000)
* API → [http://localhost:8000](http://localhost:8000)

---

## 🔌 API surface

* `GET /api/v1/health`
* `GET /api/v1/health/dependencies`
* `GET /api/v1/planning/scenarios`
* `POST /api/v1/planning/run`
* `GET /api/v1/runs`
* `GET /api/v1/runs/{run_id}`
* `GET /api/v1/data-health`

---

## 🧭 Roadmap (next phase)

* Multi-tenant + authentication
* Real-world data integrations (POS, reservations, inventory)
* Async planning runs (Redis queue)
* Observability (latency, cost, traces)
* Configurable restaurant settings



