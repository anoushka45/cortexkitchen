// lib/api.ts
// Thin client for the CortexKitchen FastAPI backend.

import {
  DataHealth,
  FridayRushRequest,
  FridayRushResponse,
  PlanningRunDetail,
  PlanningRunSummary,
} from "@/types/planning";

const BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";

export async function runFridayRush(
  request: FridayRushRequest = {}
): Promise<FridayRushResponse> {
  const res = await fetch(`${BASE_URL}/api/v1/planning/friday-rush`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(request),
  });

  if (!res.ok) {
    const detail = await res.text();
    throw new Error(`Planning API error ${res.status}: ${detail}`);
  }

  return res.json() as Promise<FridayRushResponse>;
}

export async function listPlanningRuns(limit = 25): Promise<PlanningRunSummary[]> {
  const res = await fetch(`${BASE_URL}/api/v1/runs?limit=${limit}`, {
    cache: "no-store",
  });

  if (!res.ok) {
    const detail = await res.text();
    throw new Error(`Runs API error ${res.status}: ${detail}`);
  }

  const payload = await res.json() as { runs: PlanningRunSummary[] };
  return payload.runs;
}

export async function getPlanningRun(runId: number): Promise<PlanningRunDetail> {
  const res = await fetch(`${BASE_URL}/api/v1/runs/${runId}`, {
    cache: "no-store",
  });

  if (!res.ok) {
    const detail = await res.text();
    throw new Error(`Run detail API error ${res.status}: ${detail}`);
  }

  return res.json() as Promise<PlanningRunDetail>;
}

export async function getDataHealth(): Promise<DataHealth> {
  const res = await fetch(`${BASE_URL}/api/v1/data-health`, {
    cache: "no-store",
  });

  if (!res.ok) {
    const detail = await res.text();
    throw new Error(`Data health API error ${res.status}: ${detail}`);
  }

  return res.json() as Promise<DataHealth>;
}
