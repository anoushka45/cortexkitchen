# CortexKitchen 🍕

CortexKitchen is an AI-powered multi-agent system designed to bring **decision intelligence to restaurant operations**.

Instead of acting as a chatbot, the system simulates how different operational agents collaborate to analyze data, generate insights, and recommend actions.

---

## 🚀 Core Demo  
### Friday Night Rush Optimization

The system is designed to simulate a real-world operational scenario:

- Predict demand for Friday evening rush  
- Analyze reservations and seating capacity  
- Identify risks from complaints and historical trends  
- Generate actionable recommendations  
- Validate decisions using a critic layer  
- Log decisions for traceability and audit  

---

## 🧠 What Makes It Different

- Multi-agent architecture (not a single LLM call)
- Combines forecasting + RAG + rule-based validation  
- Focuses on **operational decision-making**, not just Q&A  
- Designed with **production-style system architecture**  
- Emphasis on **explainability and traceable decisions**  

---

## 🛠️ Tech Stack

- **Backend:** Python, FastAPI  
- **AI / Agents:** LangGraph, Gemini  
- **Data & Storage:** PostgreSQL, Qdrant, Redis  
- **Analytics:** Pandas, Prophet  
- **Frontend:** Next.js, Tailwind, Recharts  
- **Infra:** Docker Compose  

---

## 🎯 Project Goals

- Build a **multi-agent AI system**, not a basic chatbot  
- Combine ML forecasting, RAG, and business-rule validation  
- Design a **scalable and modular architecture**  
- Create a system that can evolve into a **real-world product prototype**  

---

## 📂 Repository Structure

- `apps/api` → FastAPI backend and agent orchestration  
- `apps/web` → dashboard frontend  
- `packages/core` → shared schemas and utilities  
- `docs` → architecture, PRD, roadmap, and design docs  
- `infra` → Docker and infrastructure setup  
- `data` → synthetic data and seed datasets  
- `tests` → unit, integration, and end-to-end tests  

---

## ⚙️ Engineering Practices

- `main` → stable branch  
- `dev` → active integration branch  
- Feature branches for all new work  
- Docs-first development (Phase 0)  
- Tests added alongside features  
- No direct pushes to `main`  

---

## 📍 Current Status

✅ **Phase 1: Engineering Foundation — Complete**

All Phase 1 milestones are done and tested. `dev` is stable and ready to sync to `main`.

| Area | Status |
|---|---|
| FastAPI scaffold + health endpoints | ✅ Done |
| Docker Compose (Postgres, Qdrant, Redis) | ✅ Done |
| DB schema + Alembic migrations | ✅ Done |
| Seed data (pizza-heavy, Friday-spike patterns) | ✅ Done |
| LLM provider layer (Gemini + Groq + base) | ✅ Done |
| Core services (forecast, reservations, complaints, critic) | ✅ Done |
| Qdrant memory (complaint + SOP retrieval) | ✅ Done |
| LangGraph orchestration skeleton | ✅ Done |
| Friday rush planning endpoint | ✅ Done |
| Frontend dashboard MVP | ✅ Done |
| Unit + integration + E2E tests | ✅ Done |

---

## 🔜 Upcoming Work (Phase 2)

- Prophet-based forecasting upgrade  
- Inventory shortage / overstock alerts  
- Menu intelligence and promo suggestions  
- Dashboard analytics enhancements  
- Evaluation refinement  

---

## 🤝 Build in Public

This project is being developed in public as an exploration of **AI system design and agent-based architectures**.