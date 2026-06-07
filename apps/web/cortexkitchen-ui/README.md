# CortexKitchen UI

Next.js 16 frontend for CortexKitchen. Phase 5 complete.

Last updated: June 2026.

---

## Stack

- Next.js 16 (App Router)
- React 19
- TypeScript
- Tailwind CSS 4
- Recharts
- ReactMarkdown

---

## Pages

| Route | Auth | Purpose |
|-------|------|---------|
| `/` | Public | Marketing homepage — pipeline explainer, features, CTA, footer |
| `/login` | Public | JWT sign-in |
| `/register` | Public | Create restaurant workspace |
| `/dashboard` | JWT | Scenario selection, SSE streaming run, full plan, what-if simulator |
| `/runs` | JWT | Run history, critic score trend, run detail, PDF/Excel export |
| `/chat` | JWT | Ask AI — RAG chatbot over run history and feedback |
| `/data-health` | JWT | Database coverage + 7-day observability panel |
| `/settings` | JWT (owner) | Workspace config — capacity, cuisine, peak hours, thresholds |
| `/restaurant-profiles` | JWT (owner) | Named restaurant profiles |

---

## Homepage

The public marketing page (`/`) has its own `HomeNav` and `Footer` components — not the app NavBar. It does not render when the user is authenticated (redirected to `/dashboard`).

![Homepage Hero](../../../screenshots/01_homepage/hero.png)

![Homepage Pipeline](../../../screenshots/01_homepage/pipeline.png)

![Homepage Features](../../../screenshots/01_homepage/features.png)

![Homepage Footer](../../../screenshots/01_homepage/footer_cta.png)

---

## Auth pages

Standard JWT flow. Login and register pages include a "Back to home" link. Authenticated users landing on `/login` or `/register` are redirected to `/dashboard`.

![Login](../../../screenshots/02_auth/login.png)

![Register](../../../screenshots/02_auth/register.png)

---

## Dashboard

The core of the app. The dashboard has three states:

**Idle** — scenario selector, restaurant profile selector (owner only), four preset cards with scenario descriptions, and the 9-node orchestration list.

![Dashboard — Idle](../../../screenshots/03_dashboard/01_idle_scenario_select.png)

**Running** — SSE stream open. Branded loading screen ("Preparing your brief, [Restaurant Name]!") with a live pipeline diagram showing node status: done / running / waiting.

![Dashboard — Loading Screen](../../../screenshots/03_dashboard/02_loading_screen.png)

**Complete** — full plan rendered. Critic verdict banner (approved / revision / rejected), composite score, and five metric cards at the top. Below: agent output sections for service planning, menu direction, and operational risk.

![Dashboard — Plan Approved (top)](../../../screenshots/03_dashboard/03_plan_approved_top.png)

![Dashboard — Full Scroll](../../../screenshots/03_dashboard/04_full_plan_scroll.png)

![Service Planning Section](../../../screenshots/03_dashboard/05_service_planning.png)

![Menu Direction Section](../../../screenshots/03_dashboard/06_menu_direction.png)

![Operational Risk Section](../../../screenshots/03_dashboard/07_operational_risk.png)

**What-If Simulator** — available after a completed run. Slider to adjust cover count; cost pressure, benefit, and tradeoff scores update instantly via partial LangGraph execution.

![What-If Simulator](../../../screenshots/03_dashboard/08_what_if_simulator.png)

---

## Runs (Plan History)

Full audit trail of all planning runs. Left panel: run list with scenario, date, critic score, and verdict. Right panel: selected run detail with critic dimension scores, agent outputs, RAG context, and export buttons.

Export buttons:
- **Export for your chef** — downloads the PDF chef brief
- **Open Manager Brief** — opens the full plan detail modal
- **Ask the AI a question** — links to the `/chat` page

![Run History Page](../../../screenshots/04_runs/runs_history_page.png)

![Run Detail Panel](../../../screenshots/04_runs/run_detail_panel.png)

---

## Ask AI (Chat)

RAG chatbot over the org's actual planning data. Answers come from Postgres `planning_runs` and `feedback` tables — not generic AI.

**Empty state** — suggested question cards covering quality, complaints, inventory, menu, demand, and strategy.

**Active conversation** — streamed token-by-token, rendered with ReactMarkdown for formatted responses.

![Ask AI — Empty State](../../../screenshots/05_chat/01_empty_state.png)

![Ask AI — Complaints Conversation](../../../screenshots/05_chat/02_conversation_complaints.png)

![Ask AI — Performance Overview](../../../screenshots/05_chat/03_conversation_performance.png)

![Ask AI — Multi-turn Responses](../../../screenshots/05_chat/04_conversation_responses.png)

![Ask AI — Full App View](../../../screenshots/05_chat/05_full_app_conversation.png)

---

## Data Health

Two tabs — database coverage and observability.

**Database coverage:** live counts for orders, reservations, feedback, inventory items, and menu items. Scenario coverage table shows the next matching date per scenario with reservation pressure.

**Observability panel:** 7-day aggregate from `/api/v1/observability/summary` — total runs, success rate, average critic score, average duration, breakdown by verdict and scenario.

![Data Health](../../../screenshots/06_data_health/data_health.png)

![Observability Panel](../../../screenshots/06_data_health/observability_panel.png)

---

## Settings

Workspace configuration for owners. Sections:

- **Restaurant** — seating capacity, cuisine type, peak service hours, timezone
- **Planning thresholds** — minimum critic score for approval, low stock warning %, overstock warning %

![Settings](../../../screenshots/07_config/settings.png)

---

## Restaurant Profiles

Named profiles that override org-level capacity and peak hours for a specific planning run. Managed by the owner. Selected from the dashboard scenario picker.

![Restaurant Profiles](../../../screenshots/07_config/restaurant_profiles.png)

---

## Exports

**PDF chef brief** — generated by ReportLab. Includes: run summary, scenario, date, critic verdict and score, dimension scores, action items, agent recommendations.

**Excel workbook** — three sheets: Summary, Inventory & Staffing (chef view), Cost Breakdown (owner view). Generated by openpyxl.

![PDF Chef Brief](../../../screenshots/08_exports/pdf_chef_brief.png)

![Excel — Inventory & Staffing](../../../screenshots/08_exports/excel_inventory_chef_view.png)

![Excel — Cost Breakdown](../../../screenshots/08_exports/excel_cost_breakdown_owner_view.png)

---

## Components

| Component | Location | Purpose |
|-----------|----------|---------|
| `NavBar` | `components/layout/NavBar.tsx` | Sticky app nav — scenario dropdown, History, Ask AI, user dropdown |
| `Footer` | `components/layout/Footer.tsx` | Public footer — Product/Resources/Company/Legal; homepage only |
| `HomeNav` | `components/layout/HomeNav.tsx` | Public homepage navigation |
| `ForecastChart` | `components/dashboard/ForecastChart.tsx` | Demand forecast bar/line chart |
| `AuthContext` | `context/AuthContext.tsx` | JWT state, login, logout |
| `DashboardContext` | `context/DashboardContext.tsx` | Scenario, run status, history drawer |

---

## Streaming

The dashboard uses `fetch` with a `ReadableStream` reader to consume the SSE stream from `/api/v1/planning/run`. Each `data:` event carries a node name and partial output. Agent cards render progressively — no waiting for the full pipeline to complete.

The `/chat` page uses the same pattern against `/api/v1/chat` — tokens stream in and are rendered via ReactMarkdown.

---

## Local development

```bash
npm install
npm run dev
```

Frontend at `http://localhost:3000`.

```bash
# Point at a non-local backend
NEXT_PUBLIC_API_BASE_URL=http://your-backend-url
```

Set this in `.env.local` in this directory.

---

## Environment variables

| Variable | Default | Description |
|----------|---------|-------------|
| `NEXT_PUBLIC_API_BASE_URL` | `http://localhost:8000` | Backend API base URL |
