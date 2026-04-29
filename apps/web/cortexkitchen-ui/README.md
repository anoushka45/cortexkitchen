# CortexKitchen UI

Next.js 16 dashboard for CortexKitchen.

## Current UI scope

- Scenario selection for four planning presets
- Planning run submission and loading states
- Forecast, reservation, complaint, menu, and inventory result cards
- Critic verdict banner and manager brief modal
- RAG context drawer
- Run history drawer on the dashboard
- Dedicated `/runs` audit trail page
- Dedicated `/data-health` operational coverage page

## Stack

- Next.js 16
- React 19
- TypeScript
- Tailwind CSS 4
- Recharts

## Local development

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

## API configuration

The client defaults to `http://localhost:8000`.

Override with:

```bash
NEXT_PUBLIC_API_BASE_URL=http://localhost:8000
```

## Notes

This is no longer the default `create-next-app` starter. The README was rewritten to match the actual CortexKitchen dashboard and routes.
