# Implementation Plan
# CortexKitchen

## 1. Purpose

This document defines the practical build order for CortexKitchen.

It exists to answer:
- what gets built first
- what depends on what
- how to avoid overbuilding too early
- how to reach the Friday Night Rush demo efficiently

This is the execution plan after architecture design is locked.

---

## 2. Build Strategy

We will build CortexKitchen in the following order:

1. foundation and contracts
2. infrastructure and app scaffolding
3. data model and seed data
4. core services
5. orchestration skeleton
6. MVP scenario flow
7. dashboard visibility
8. testing and refinement

This ensures we always have a stable path toward the flagship demo.

---

## 3. Phase 0 — Documentation and Design

### Goal
Lock architecture before coding.

### Tasks
- finalize PRD
- finalize roadmap
- finalize decision log
- finalize architecture doc
- finalize agents doc
- finalize data model doc
- finalize API contracts
- finalize evaluation strategy
- finalize implementation plan

### Exit Criteria
- design set is complete
- build order is clear
- scope is controlled

---

## 4. Phase 1 — Engineering Foundation

## 4.1 Backend Scaffold
### Tasks
- initialize FastAPI application structure
- create app modules and package layout
- add config/settings management
- add health endpoint
- add dependency health endpoint
- define shared response/error patterns

### Exit Criteria
- FastAPI app boots locally
- health endpoints work
- basic test setup exists

---

## 4.2 Infrastructure Setup
### Tasks
- add Docker Compose for PostgreSQL, Qdrant, Redis
- verify all services run locally
- add environment variable config
- document startup steps

### Exit Criteria
- infra starts reproducibly
- backend can connect to dependencies

---

## 4.3 Database and Seed Data
### Tasks
- create PostgreSQL schema/models
- create seed scripts for:
  - reservations
  - orders
  - menu items
  - complaints
  - inventory
- create realistic Friday-heavy data patterns

### Exit Criteria
- seed script works
- demo data is believable
- basic data queries succeed

---

## 4.4 Core Service Layer
### Tasks
- reservation analytics service
- forecast service (baseline)
- complaint query service
- vector ingestion/retrieval service
- trace persistence service
- critic rule validation service

### Exit Criteria
- services work independently
- unit tests cover important rules and logic

---

## 4.5 LLM Provider Layer
### Tasks
- define base provider interface
- implement Gemini provider
- centralize prompting utilities
- support deterministic settings for critic where needed

### Exit Criteria
- provider can be called from services/agents
- provider is not hardcoded across the codebase

---

## 4.6 Qdrant Memory Layer
### Tasks
- define collections
- embed and load complaints
- embed and load SOP documents
- optionally embed decision summaries later
- implement retrieval helpers with metadata filters

### Exit Criteria
- complaint retrieval works
- SOP retrieval works
- retrieval test fixtures exist

---

## 4.7 LangGraph Orchestration Skeleton
### Tasks
- define shared state schema
- implement Ops Manager node
- implement stub domain agent nodes
- implement critic node
- define graph edges and execution order

### Exit Criteria
- graph runs with stub outputs
- shared state moves correctly
- orchestrated flow is testable

---

## 4.8 Friday Rush MVP Flow
### Tasks
- connect forecast agent to real service
- connect reservation agent to reservation analytics
- connect complaint agent to retrieval + summarization
- connect critic to validation logic
- aggregate outputs into planning response
- persist decision trace

### Exit Criteria
- flagship planning endpoint works end to end
- trace is stored
- output is coherent enough for demo

---

## 4.9 Frontend MVP Dashboard
### Tasks
- initialize Next.js frontend
- create dashboard shell
- display:
  - forecast summary
  - reservation pressure
  - complaint themes
  - recommendations
  - critic result
- add chart for rush window

### Exit Criteria
- dashboard can render planning response
- demo story is visible and understandable

---

## 4.10 Testing and Stabilization
### Tasks
- add unit tests for validators/services
- add integration tests for API and data access
- add E2E test for Friday rush scenario
- add retrieval sanity tests
- review output quality using evaluation rubric

### Exit Criteria
- core tests pass
- demo flow is stable
- obvious failure cases are handled

---

## 5. Recommended Detailed Build Order

### Step 1
Backend app scaffold

### Step 2
Docker Compose infra

### Step 3
Database models/schema

### Step 4
Seed data generation

### Step 5
Core analytics services

### Step 6
LLM provider layer

### Step 7
Qdrant ingestion and retrieval

### Step 8
LangGraph skeleton

### Step 9
Friday rush endpoint

### Step 10
Decision trace storage

### Step 11
Frontend dashboard

### Step 12
Testing and refinement

---

## 6. Suggested Working Sequence by Branch

Example sequence:
- `feature/phase1-api-scaffold`
- `feature/phase1-infra-docker`
- `feature/phase1-database-schema`
- `feature/phase1-seed-data`
- `feature/phase1-core-services`
- `feature/phase1-llm-provider`
- `feature/phase1-qdrant-memory`
- `feature/phase1-langgraph-flow`
- `feature/phase1-friday-rush-endpoint`
- `feature/phase1-dashboard`
- `feature/phase1-tests`

---

## 7. Scope Control Rules

To avoid losing momentum, follow these rules:

### Do
- prioritize the Friday rush demo
- ship simple versions first
- keep interfaces clean
- write tests for important logic
- improve realism gradually

### Do Not
- overbuild the frontend first
- add too many agents too early
- integrate real external APIs too early
- perfect every feature before demoability exists
- let infrastructure complexity delay core flow

---

## 8. Definition of “MVP Done”

Phase 1 MVP is done when:
- FastAPI app runs locally
- Docker infra works
- seed data exists
- Friday rush endpoint works
- LangGraph orchestration runs
- critic validates outputs
- decision traces are stored
- frontend dashboard displays the result
- tests cover the core flow

---

## 9. Summary

This implementation plan is designed to get CortexKitchen from architecture to a strong flagship demo efficiently, without losing the enterprise-style structure of the project.