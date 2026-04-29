# CortexKitchen Web

This folder contains the web application for CortexKitchen. The active frontend lives in `apps/web/cortexkitchen-ui`.

## What the frontend currently includes

- Planning dashboard for scenario-driven service runs
- Run history and persisted audit view
- Data-health page for seeded operational coverage
- Client-side API helpers for planning, runs, and data-health endpoints

## Start the app

```bash
cd cortexkitchen-ui
npm install
npm run dev
```

By default the frontend expects the API at `http://localhost:8000`.

## Environment

Set `NEXT_PUBLIC_API_BASE_URL` if the backend runs elsewhere.
