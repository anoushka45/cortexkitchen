# CortexKitchen UI

Next.js dashboard for CortexKitchen — displays Friday Rush planning results from the API.

## What's in here (Phase 1 complete)

- Dashboard page with date picker and Run button
- Forecast chart (Recharts)
- Agent cards — forecast, reservations, complaints, menu, inventory
- Critic banner — verdict + score + notes
- RAG context drawer — similar complaints + relevant SOPs
- Run history panel
- `useFridayRush` hook wiring to the backend planning endpoint

## Run locally

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Make sure the API is running on port 8000.

## Environment

The API base URL is configured in `lib/api.ts`. Update it if your API runs on a different port.

## Stack

- Next.js 14 (App Router)
- Tailwind CSS
- Recharts
- TypeScript