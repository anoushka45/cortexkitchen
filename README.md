#  CortexKitchen - Capstone🍕

CortexKitchen is an AI-powered autonomous restaurant operating system focused on operational decision intelligence for a pizza-heavy restaurant.

It is not a chatbot. It is a multi-agent AI system that helps optimize restaurant operations through forecasting, reservation intelligence, complaint analysis, menu insights, and decision governance.

## Core Demo
**Friday Night Rush Optimization**

The system will:
- predict demand for Friday evening rush
- analyze reservations and seating capacity
- identify operational risks from complaints and trends
- recommend actions
- validate recommendations with a critic layer
- log decisions for traceability

## Tech Stack
- Python
- FastAPI
- LangGraph
- Gemini
- PostgreSQL
- Qdrant
- Redis
- Pandas
- Prophet
- Next.js
- Tailwind
- Recharts
- Docker Compose

## Project Goals
- Build a multi-agent AI system, not a basic chatbot
- Combine ML forecasting, RAG, and business-rule validation
- Create production-style architecture with explainable decisions
- Make the system expandable enough to pitch as a capstone and prototype

## Repository Structure
- `apps/api` → FastAPI backend and agent orchestration
- `apps/web` → dashboard frontend
- `packages/core` → shared schemas and utilities
- `docs` → architecture, PRD, roadmap, and design docs
- `infra` → docker and local infrastructure config
- `data` → synthetic data and seeds
- `tests` → unit, integration, and end-to-end tests

## Engineering Practices
- `main` = stable
- `dev` = active integration branch
- feature branches for all new work
- docs-first development for Phase 0
- tests added alongside features
- no direct pushes to `main`

## Status
Currently in **Phase 0: Foundation and Documentation**