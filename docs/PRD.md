# Product Requirements Document (PRD)
# CortexKitchen

Last updated: June 2026. Phase 5 complete.

---

## 1. Project Overview

CortexKitchen is an AI-powered restaurant operations intelligence platform. Five specialist agents read your demand data, bookings, guest complaints, menu performance, and inventory — in parallel — and produce a single verified pre-shift brief before every shift.

It is not a chatbot and not a basic RAG demo. It is a multi-agent AI system combining time-series forecasting, vector retrieval, LLM reasoning, streaming delivery, and business-rule validation to support restaurant operations.

A critic agent reviews the plan across five quality dimensions before it reaches the manager. If anything looks unsafe or unrealistic, the plan is blocked and the reason is explained.

---

## 2. Problem Statement

Restaurants often struggle with:
- Unpredictable rush hours with no data-driven demand signal
- Inefficient reservation handling and occupancy blind spots
- Recurring guest complaints that never make it into the pre-shift brief
- Weak visibility into menu performance and what to push tonight
- Inventory shortages discovered mid-service instead of before the shift
- No single verified plan — just four dashboards, a spreadsheet, and a group chat

CortexKitchen fills that gap with a structured multi-agent system that reasons over restaurant data and produces explainable, governed recommendations — before every shift, in under 90 seconds.

---

## 3. Vision

A multi-agent AI operating layer for restaurant operations that is:
- Intelligent — combines forecasting, retrieval, and LLM reasoning
- Explainable — every recommendation is backed by data and a critic verdict
- Streaming — results arrive node by node, not as a single slow response
- Production-minded — Redis caching, OTel tracing, Sentry, LangSmith evals
- Multi-tenant — one platform, isolated per restaurant org

---

## 4. Goals

### Primary
- Multi-agent planning pipeline (LangGraph, 9 nodes) across 4 shift scenarios
- Demand forecasting with Prophet time-series
- RAG complaint intelligence over Qdrant
- 5-dimension critic quality gate (safety, feasibility, evidence, actionability, clarity)
- SSE streaming with live pipeline diagram
- PDF and Excel exports (chef view and owner view)
- RAG chatbot over run history and feedback

### Secondary
- LangSmith golden dataset + 90% CI quality gate
- OpenTelemetry, Prometheus, Sentry observability
- Redis plan caching (1hr TTL, zero LLM cost on hits)
- Multi-tenant workspace isolation (Postgres + Qdrant)
- What-if simulator for instant cover count adjustment
- MCP server for Claude Code / Claude Desktop integration

---

## 5. Non-Goals (initial phases)

- Live POS integrations
- Production cloud deployment
- Payment processing
- Mobile app
- Real supplier integrations
- Full staff scheduling engine

---

## 6. Target Users

### Primary
Restaurant manager / ops lead planning a shift for a casual dining restaurant.

### Secondary
- Restaurant owners reviewing cost and quality trends
- Founders evaluating vertical AI SaaS ideas
- Engineers and recruiters reviewing system design maturity

---

## 7. Core Use Cases

1. Select a shift scenario (Friday Rush, Weekday Lunch, Holiday Spike, Low-Stock Weekend)
2. Run the nine-node pipeline — watch agents complete in real time via SSE
3. Review the critic-verified plan (demand, reservations, complaints, menu, inventory)
4. Export a PDF chef brief or Excel owner workbook
5. Adjust cover count in the what-if simulator without a full re-run
6. Ask the AI chatbot questions about past runs, complaints, and performance
7. Review run history with critic score trends and full detail
8. Monitor data health — database coverage and 7-day observability stats

---

## 8. Delivered Features (Phase 5 complete)

### Planning pipeline
- Nine-node LangGraph StateGraph with parallel fan-out across four domain agents
- Four scenario presets: `friday_rush`, `weekday_lunch`, `holiday_spike`, `low_stock_weekend`
- Prophet time-series demand forecasting with peak detection
- Qdrant RAG complaint intelligence — org-scoped payload filter
- Menu performance analysis — push / ease-back / avoid strategy
- Inventory shortage and overstock detection with restock priority
- 5-dimension critic scoring: safety, feasibility, evidence, actionability, clarity
- Verdicts: approved / revision / rejected

### Streaming & UX
- FastAPI SSE streaming (`/planning/stream`) — `node_complete` status events update the loading screen pipeline diagram as each node finishes; full plan delivered in a single `complete` event
- Branded loading screen with restaurant name and live pipeline diagram
- Redis 1hr plan cache — `cache_hit` flag in response, zero LLM cost on hits
- What-if simulator — cover count slider, instant cost/benefit/tradeoff update

### Exports
- PDF chef brief — ReportLab, plan summary + action items + dimension scores
- Excel workbook — openpyxl, Inventory & Staffing sheet + Cost Breakdown sheet

### Ask AI
- RAG chatbot over Postgres `planning_runs` + `feedback` tables (org-scoped)
- AsyncGroq llama-3.3-70b SSE streaming, ReactMarkdown rendering
- Multi-turn conversation, suggested starter questions

### Observability & quality
- OpenTelemetry HTTP tracing on every route
- Prometheus `/metrics` scrape endpoint
- Sentry unhandled exception capture with LangGraph node tags
- LangSmith per-node traces + `cortexkitchen-golden-v1` dataset (50 runs)
- CI quality gate: 90% pass rate on golden dataset
- RAGAS faithfulness ≥ 0.8 on complaint RAG pipeline
- DeepEval hallucination ≤ 0.5, relevancy ≥ 0.7 on critic and agent outputs

### Multi-tenant isolation
- JWT org-scoped sessions; all run queries filter by `org_id`
- Qdrant payload filter per org on complaint and SOP vectors
- `org_id` in `OrchestratorState` for end-to-end isolation

### Auth & config
- JWT (HS256) register + login with org creation
- Workspace settings: capacity, cuisine, peak hours, thresholds
- Restaurant profiles: named overrides per planning run (owner only)

### MCP integration
- `run_planning_scenario` + `get_run_history` tools via Anthropic MCP SDK
- Auto-discovered by Claude Code via `.mcp.json`

---

## 9. Non-Functional Requirements

- Modular architecture — route / orchestration / service / infrastructure layers clearly separated
- Local reproducibility with Docker Compose (PostgreSQL, Qdrant, Redis)
- Swappable LLM provider — Groq default, Gemini fallback, config-only switch
- Testable at every layer — unit, integration, LLM quality evals
- Explainable outputs — every recommendation backed by data + critic verdict
- Documentation-first — all capabilities documented with screenshots

---

## 10. Success Criteria

The project is successful if:
- All four scenarios run end-to-end with critic-verified output
- SSE streaming works — users see results arrive node by node
- PDF and Excel exports are usable by a real chef or owner
- The chatbot answers questions using the org's actual data
- LangSmith CI gate passes — 90% of golden dataset runs meet the evaluator thresholds (critic score ≥ 0.70)
- The system is presentable as a production-grade AI platform in interviews and demos

---

## 11. Constraints

- Solo developer project
- Local-first setup (Docker Compose)
- Free-tier LLM providers (Groq, Gemini)
- No live data integrations — synthetic seed data
- Architecture should look enterprise-grade regardless
