// lib/api.ts
// Thin client for the CortexKitchen FastAPI backend.

import {
  DataHealth,
  FridayRushRequest,
  FridayRushResponse,
  PlanningScenarioOption,
  PlanningRunDetail,
  PlanningRunSummary,
} from "@/types/planning";
import { getAuthToken } from "@/lib/auth-cookies";

const BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";

function authHeaders(extra?: Record<string, string>): Record<string, string> {
  const token = getAuthToken();
  return {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...extra,
  };
}

// ── Auth ─────────────────────────────────────────────────────────────────────

export interface LoginRequest { email: string; password: string }
export interface RegisterRequest { email: string; password: string; full_name?: string; org_name: string }
export interface TokenResponse { access_token: string; token_type: string }
export interface UserMe { id: number; email: string; full_name: string | null; org_id: number; org_name: string; org_slug: string; role: string }

export async function apiLogin(body: LoginRequest): Promise<TokenResponse> {
  const res = await fetch(`${BASE_URL}/api/v1/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const detail = await res.json().catch(() => ({ detail: "Login failed." }));
    throw new Error(detail.detail ?? "Login failed.");
  }
  return res.json() as Promise<TokenResponse>;
}

export async function apiRegister(body: RegisterRequest): Promise<TokenResponse> {
  const res = await fetch(`${BASE_URL}/api/v1/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const detail = await res.json().catch(() => ({ detail: "Registration failed." }));
    throw new Error(detail.detail ?? "Registration failed.");
  }
  return res.json() as Promise<TokenResponse>;
}

export async function apiGetMe(): Promise<UserMe> {
  const res = await fetch(`${BASE_URL}/api/v1/auth/me`, {
    headers: authHeaders(),
    cache: "no-store",
  });
  if (!res.ok) throw new Error("Failed to fetch user.");
  return res.json() as Promise<UserMe>;
}

// ── Planning ─────────────────────────────────────────────────────────────────

export async function runFridayRush(
  request: FridayRushRequest = {}
): Promise<FridayRushResponse> {
  if (request.scenario && request.scenario !== "friday_rush") {
    return runPlanningScenario(request);
  }

  const res = await fetch(`${BASE_URL}/api/v1/planning/friday-rush`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(request),
  });

  if (!res.ok) {
    const detail = await res.text();
    throw new Error(`Planning API error ${res.status}: ${detail}`);
  }

  return res.json() as Promise<FridayRushResponse>;
}

export async function runPlanningScenario(
  request: FridayRushRequest = {}
): Promise<FridayRushResponse> {
  const res = await fetch(`${BASE_URL}/api/v1/planning/run`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(request),
  });

  if (!res.ok) {
    const detail = await res.text();
    throw new Error(`Planning API error ${res.status}: ${detail}`);
  }

  return res.json() as Promise<FridayRushResponse>;
}

export async function getPlanningScenarios(): Promise<PlanningScenarioOption[]> {
  const res = await fetch(`${BASE_URL}/api/v1/planning/scenarios`, {
    headers: authHeaders(),
    cache: "no-store",
  });

  if (!res.ok) {
    const detail = await res.text();
    throw new Error(`Scenario API error ${res.status}: ${detail}`);
  }

  const payload = await res.json() as { scenarios: PlanningScenarioOption[] };
  return payload.scenarios;
}

export interface RunsFilter {
  limit?: number;
  scenario?: string;
  verdict?: string;
  date_from?: string;
  date_to?: string;
}

export async function listPlanningRuns(limitOrFilter: number | RunsFilter = 50): Promise<PlanningRunSummary[]> {
  const params = new URLSearchParams();
  if (typeof limitOrFilter === "number") {
    params.set("limit", String(limitOrFilter));
  } else {
    if (limitOrFilter.limit)     params.set("limit",     String(limitOrFilter.limit));
    if (limitOrFilter.scenario)  params.set("scenario",  limitOrFilter.scenario);
    if (limitOrFilter.verdict)   params.set("verdict",   limitOrFilter.verdict);
    if (limitOrFilter.date_from) params.set("date_from", limitOrFilter.date_from);
    if (limitOrFilter.date_to)   params.set("date_to",   limitOrFilter.date_to);
  }

  const res = await fetch(`${BASE_URL}/api/v1/runs?${params.toString()}`, {
    headers: authHeaders(),
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
    headers: authHeaders(),
    cache: "no-store",
  });

  if (!res.ok) {
    const detail = await res.text();
    throw new Error(`Run detail API error ${res.status}: ${detail}`);
  }

  return res.json() as Promise<PlanningRunDetail>;
}

// ── Settings ──────────────────────────────────────────────────────────────────

export interface OrgSettings {
  capacity: number;
  timezone: string;
  cuisine_type: string;
  peak_hours: string;
  critic_threshold: number;
  low_stock_threshold_pct: number;
  overstock_threshold_pct: number;
}

export interface OrgSettingsResponse {
  org_id: number;
  org_name: string;
  settings: OrgSettings;
}

export async function getOrgSettings(): Promise<OrgSettingsResponse> {
  const res = await fetch(`${BASE_URL}/api/v1/settings`, {
    headers: authHeaders(),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Settings API error ${res.status}`);
  return res.json() as Promise<OrgSettingsResponse>;
}

export async function updateOrgSettings(body: OrgSettings): Promise<OrgSettingsResponse> {
  const res = await fetch(`${BASE_URL}/api/v1/settings`, {
    method: "PATCH",
    headers: authHeaders(),
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const detail = await res.json().catch(() => ({ detail: "Update failed." }));
    throw new Error(detail.detail ?? "Update failed.");
  }
  return res.json() as Promise<OrgSettingsResponse>;
}

export async function getDataHealth(): Promise<DataHealth> {
  const res = await fetch(`${BASE_URL}/api/v1/data-health`, {
    headers: authHeaders(),
    cache: "no-store",
  });

  if (!res.ok) {
    const detail = await res.text();
    throw new Error(`Data health API error ${res.status}: ${detail}`);
  }

  return res.json() as Promise<DataHealth>;
}
