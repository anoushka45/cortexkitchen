// lib/api.ts
// Thin client for the CortexKitchen FastAPI backend.

import { FridayRushRequest, FridayRushResponse } from "@/types/planning";

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