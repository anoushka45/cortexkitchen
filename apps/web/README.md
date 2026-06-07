# CortexKitchen Web

This folder contains the web application for CortexKitchen. The active frontend lives in `apps/web/cortexkitchen-ui`.

Last updated: June 2026. Phase 5 complete.

## What the frontend includes

- Public marketing homepage with pipeline explainer, features, and footer
- JWT auth flow — login and register with org creation
- Planning dashboard — scenario selection, SSE streaming pipeline, full plan view, what-if simulator
- Run history page — audit trail with score trend chart, run detail panel, PDF/Excel export buttons
- Ask AI chat page — RAG chatbot over run history and guest feedback, streamed responses
- Data Health page — database coverage table and 7-day observability panel
- Workspace settings — capacity, cuisine, peak hours, planning thresholds
- Restaurant profiles — named profiles for per-run capacity and peak-hour overrides
- Multi-tenant isolation — all views scoped to the authenticated org

## Start the app

```bash
cd cortexkitchen-ui
npm install
npm run dev
```

Frontend at `http://localhost:3000`. Expects the API at `http://localhost:8000` by default.

## Environment

Set `NEXT_PUBLIC_API_BASE_URL` in `.env.local` if the backend runs elsewhere.

## More detail

See [`cortexkitchen-ui/README.md`](cortexkitchen-ui/README.md) for the full page-by-page breakdown with screenshots.
