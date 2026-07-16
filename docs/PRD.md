# Product Requirements Document (PRD)
# CortexKitchen

Phase 6A in progress.

---

## 1. Project Overview

CortexKitchen is a two-sided platform powered by the Swiggy MCP. Side one, Restaurant OS, is the current focus: specialist agents read demand data, bookings, guest complaints, menu performance, inventory, and live external signals in parallel and produce a single critic-verified pre-shift brief before every shift. Side two, Guest Concierge, is a consumer-facing event-planning assistant that has not started, gated on separate written Swiggy consent.

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
- No single verified plan: just four dashboards, a spreadsheet, and a group chat

CortexKitchen fills that gap with a structured multi-agent system that reasons over restaurant data and produces explainable, governed recommendations: before every shift, in under 90 seconds.

---

## 3. Vision

A multi-agent AI operating layer for restaurant operations that is:
- Intelligent: combines forecasting, retrieval, and LLM reasoning
- Explainable: every recommendation is backed by data and a critic verdict
- Streaming: results arrive node by node, not as a single slow response
- Production-minded: Redis caching, OTel tracing, Sentry, LangSmith evals
- Multi-tenant: one platform, isolated per restaurant org
- Integrated: connects to live platforms (Swiggy) for real demand, market, and procurement data
- Governed: circuit breaker, provider registry, and tool tracing protect all external API calls

---

## 4. Goals

### Primary
- Multi-agent planning pipeline (LangGraph, fourteen nodes) across preset and free-form shift scenarios
- Demand forecasting with Prophet time-series, adjusted by real weather and holiday signals
- RAG complaint intelligence over Qdrant
- 5-dimension critic quality gate (safety, feasibility, evidence, actionability, clarity)
- SSE streaming with live pipeline diagram
- PDF and Excel exports (chef view and owner view)
- Chat assistant over run history, feedback, and Swiggy market and Action Queue tools

### Phase 6A: delivered
- Swiggy MCP integration: area-level market signals, occupancy, Instamart procurement enrichment
- Compliance remediation: removal of a competing-platform stub connector, anonymisation of market intelligence to area aggregates
- Long-term planning memory (PlanningMemoryService) with recency decay
- Semantic plan cache (Qdrant-backed, approved-only, condition-enriched embeddings)
- MCP governance: circuit breaker, provider registry, tool tracing
- Live intelligence signals independent of Swiggy: weather and holidays, industry trends, regulatory alerts, unified into the planning pipeline
- Natural-language and dynamically composed scenario intake, alongside the four presets
- Action Queue with a trust-ladder approval mechanic and a financial scorecard (real net profit, net margin, composite health score)
- Langfuse tracing on every planning run, with a Kindred replay endpoint for prompt-level debugging
- Frontend information architecture redesign: separate Dashboard and Planning pages, a merged Data page, a dedicated Action Center and Analytics page

### Phase 6A: upcoming
- Autonomous procurement loop wired fully end-to-end (shortage detection through real Instamart checkout), currently blocked on Swiggy staging credentials for the checkout step
- Instamart event supplies exposed as a capability in the operator chat assistant
- Voice interface: Whisper transcription and TTS response
- Promotion of RAGAS and DeepEval candidate datasets into the golden eval fixtures

### Secondary
- LangSmith golden dataset + 90% CI quality gate
- OpenTelemetry, Prometheus, Sentry observability
- Redis plan caching (1hr TTL, zero LLM cost on hits)
- Multi-tenant workspace isolation (Postgres + Qdrant)
- What-if simulator for instant cover count adjustment
- MCP server for Claude Code / Claude Desktop integration

---

## 5. Non-Goals (current phase)

- Live POS integrations
- Production cloud deployment
- Payment processing
- Mobile app
- Full staff scheduling engine
- Guest Concierge (Phase 6B): scoped but not started, gated on separate written Swiggy consent
- Real Instamart checkout and Dineout table booking: implemented in code but blocked on Swiggy staging credentials, not yet exercised against a live account

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

1. Select a preset scenario (Friday Rush, Weekday Lunch, Holiday Spike, Low-Stock Weekend), describe one in free text, or let the system compose one from current live signals
2. Run the planning pipeline on the `/planning` page: watch agents complete in real time via SSE
3. Review the critic-verified plan (demand, reservations, complaints, menu, inventory, live market signals)
4. Export a PDF chef brief or Excel owner workbook
5. Adjust cover count in the what-if simulator without a full re-run
6. Ask the chat assistant questions about past runs, complaints, performance, live market data, and pending actions
7. Review and approve pending Action Queue items on the Action Center page
8. Review run history with critic score trends and full detail, and monitor data coverage, on the merged Data page
9. Review daily KPIs, health score, and live-intelligence context on the Dashboard page
10. Drill into historical menu, channel, peak-hour, and complaint performance on the Analytics page

---

## 8. Delivered Features

### Planning pipeline
- Fourteen-node LangGraph StateGraph with parallel fan-out across five domain agents (reservation, complaint intelligence, inventory, market intelligence, Dineout management); menu intelligence runs sequentially after with access to all five outputs
- Four scenario presets (`friday_rush`, `weekday_lunch`, `holiday_spike`, `low_stock_weekend`), plus free-text natural-language scenario intake and dynamic composition from current live signals
- Prophet time-series demand forecasting, adjusted by a real weather and holiday multiplier, with peak detection
- Qdrant RAG complaint intelligence, org-scoped payload filter
- Menu performance analysis: push, ease-back, or avoid strategy
- Inventory shortage and overstock detection with restock priority
- Live intelligence signals (weather and holidays, industry trends, FSSAI regulatory alerts) merged with anonymised Swiggy area signals into one market intelligence output
- 5-dimension critic scoring: safety, feasibility, evidence, actionability, clarity
- Verdicts: approved / revision / rejected

### Streaming & UX
- FastAPI SSE streaming (`/planning/stream`): `node_complete` status events update the loading screen pipeline diagram as each node finishes; full plan delivered in a single `complete` event
- Branded loading screen with restaurant name and live pipeline diagram
- Redis 1hr plan cache: `cache_hit` flag in response, zero LLM cost on hits
- What-if simulator: cover count slider, instant cost/benefit/tradeoff update

### Exports
- PDF chef brief: ReportLab, plan summary + action items + dimension scores
- Excel workbook: openpyxl, Inventory & Staffing sheet + Cost Breakdown sheet

### Action Queue and financial scorecard
- Action Queue with approve/reject flows and a trust-ladder mechanic that promotes repeatedly-approved action categories toward auto-execution
- Vendor and vendor-price-quote records backing WhatsApp-based procurement coordination
- Real net profit, net margin, and a composite health score, backed by a per-org expense ledger with cost proration

### Chat assistant
- Chat over Postgres `planning_runs` and `feedback` tables (org-scoped), plus function-calling tools for Swiggy market data and Action Queue actions
- SSE token streaming, ReactMarkdown rendering, full page and floating widget on every page
- Multi-turn conversation with session summarisation for long threads, suggested starter questions

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
- Five tools via the Anthropic MCP SDK: `run_planning_scenario`, `get_run_history`, `get_market_brief`, `get_action_queue`, `approve_action`
- Auto-discovered by Claude Code via `.mcp.json`; Claude Desktop uses `docs/mcp_claude_desktop_config.json`

---

## 9. Non-Functional Requirements

- Modular architecture: route / orchestration / service / infrastructure layers clearly separated
- Local reproducibility with Docker Compose (PostgreSQL, Qdrant, Redis)
- Swappable LLM provider: Groq default, Gemini fallback, config-only switch
- Testable at every layer: unit, integration, LLM quality evals
- Explainable outputs: every recommendation backed by data + critic verdict
- Documentation-first: every capability documented against the actual current implementation, not aspirational scope

---

## 10. Success Criteria

The project is successful if:
- All four presets, plus free-text and dynamically composed scenarios, run end-to-end with critic-verified output
- SSE streaming works: users see results arrive node by node
- PDF and Excel exports are usable by a real chef or owner
- The chat assistant answers questions using the org's actual data and can act on pending Action Queue items
- LangSmith CI gate passes: 90% of golden dataset runs meet the evaluator thresholds (critic score ≥ 0.70)
- Every Swiggy integration is compliant with the signed Integration Agreement and clearly attributed with Swiggy branding
- The system is presentable as a production-grade AI platform in interviews and demos

---

## 11. Constraints

- Solo developer project
- Local-first setup (Docker Compose)
- Free-tier LLM providers (Groq, Gemini), with CometAPI available for tiered model routing
- Operational data (orders, reservations, feedback) is synthetic seed data; Swiggy market signals, weather, industry trends, and regulatory alerts are real live data
- A signed Swiggy Integration Agreement is in effect: exclusivity and competitive-intelligence clauses constrain what the Swiggy integration may do (see `CLAUDE.md` and `docs/DECISIONS.md` D-023/D-024)
- Architecture should look enterprise-grade regardless
