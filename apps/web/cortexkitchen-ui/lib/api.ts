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

export interface ObservabilitySummary {
  period_days: number;
  total_runs: number;
  by_verdict: Record<string, number>;
  by_scenario: Record<string, number>;
  success_rate: number | null;
  avg_critic_score: number | null;
  avg_duration_ms: number | null;
  top_scenario: string | null;
  latest_run_at: string | null;
}

export async function getObservabilitySummary(days = 7): Promise<ObservabilitySummary> {
  const res = await fetch(`${BASE_URL}/api/v1/observability/summary?days=${days}`, {
    headers: authHeaders(),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Observability API error ${res.status}`);
  return res.json() as Promise<ObservabilitySummary>;
}

export interface WhatIfRequest  { predicted_covers: number; avg_covers: number; scenario: string; service_window: string }
export interface WhatIfResponse {
  scenario: string; service_window: string;
  predicted_covers: number; avg_covers: number; demand_ratio: number;
  cost_pressure_score: number; benefit_score: number; tradeoff_score: number;
  pressure_components: Record<string, number>;
  tradeoff_notes: string[]; recommended_focus: string[];
}

export async function runWhatIf(body: WhatIfRequest): Promise<WhatIfResponse> {
  const res = await fetch(`${BASE_URL}/api/v1/planning/whatif`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`What-if error ${res.status}`);
  return res.json() as Promise<WhatIfResponse>;
}

export type SSENodeStartEvent = { event: "node_start";    node: string; hint?: string };
export type SSENodeEvent      = { event: "node_complete"; node: string; hint?: string; cached?: boolean };
export type SSECompleteEvent  = { event: "complete" } & FridayRushResponse;
export type SSEErrorEvent     = { event: "error"; message: string };
export type SSEEvent = SSENodeStartEvent | SSENodeEvent | SSECompleteEvent | SSEErrorEvent;

export async function* streamPlanningScenario(
  request: FridayRushRequest = {}
): AsyncGenerator<SSEEvent> {
  const res = await fetch(`${BASE_URL}/api/v1/planning/stream`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(request),
  });

  if (!res.ok || !res.body) {
    throw new Error(`Stream failed: ${res.status}`);
  }

  const reader  = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer    = "";
  let eventType = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";

    for (const line of lines) {
      if (line.startsWith("event:")) {
        eventType = line.slice(6).trim();
      } else if (line.startsWith("data:")) {
        const raw = line.slice(5).trim();
        if (!raw) continue;
        try {
          const parsed = JSON.parse(raw);
          yield { event: eventType, ...parsed } as SSEEvent;
        } catch { /* skip malformed line */ }
        eventType = "";
      }
    }
  }
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

// ── Restaurant Profiles ───────────────────────────────────────────────────────

export interface RestaurantProfile {
  id: number;
  org_id: number;
  name: string;
  cuisine: string;
  capacity: number;
  peak_hours: string;
  timezone: string;
  created_at: string;
  updated_at: string;
}

export interface RestaurantProfileCreate {
  name: string;
  cuisine: string;
  capacity: number;
  peak_hours: string;
  timezone: string;
}

export async function listRestaurantProfiles(): Promise<RestaurantProfile[]> {
  const res = await fetch(`${BASE_URL}/api/v1/restaurant-profiles`, {
    headers: authHeaders(),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Restaurant profiles API error ${res.status}`);
  const payload = await res.json() as { profiles: RestaurantProfile[] };
  return payload.profiles;
}

export async function createRestaurantProfile(body: RestaurantProfileCreate): Promise<RestaurantProfile> {
  const res = await fetch(`${BASE_URL}/api/v1/restaurant-profiles`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const detail = await res.json().catch(() => ({ detail: "Create failed." }));
    throw new Error(detail.detail ?? "Create failed.");
  }
  return res.json() as Promise<RestaurantProfile>;
}

export async function updateRestaurantProfile(id: number, body: Partial<RestaurantProfileCreate>): Promise<RestaurantProfile> {
  const res = await fetch(`${BASE_URL}/api/v1/restaurant-profiles/${id}`, {
    method: "PATCH",
    headers: authHeaders(),
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const detail = await res.json().catch(() => ({ detail: "Update failed." }));
    throw new Error(detail.detail ?? "Update failed.");
  }
  return res.json() as Promise<RestaurantProfile>;
}

export async function deleteRestaurantProfile(id: number): Promise<void> {
  const res = await fetch(`${BASE_URL}/api/v1/restaurant-profiles/${id}`, {
    method: "DELETE",
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error(`Delete failed: ${res.status}`);
}

// ── Connectors ────────────────────────────────────────────────────────────────

export interface ConnectorStatus {
  type: string;
  name: string;
  logo: string;
  connected: boolean;
  last_sync_at: string | null;
  sync_status: string;
  orders_synced: number;
  feedback_synced: number;
  address_configured: boolean;
}

export interface ConnectorsStatusResponse {
  connectors: ConnectorStatus[];
}

export async function getConnectorsStatus(): Promise<ConnectorsStatusResponse> {
  const res = await fetch(`${BASE_URL}/api/v1/connectors/status`, {
    headers: authHeaders(),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Connectors status error ${res.status}`);
  return res.json() as Promise<ConnectorsStatusResponse>;
}

export interface SyncResult {
  status: string;
  message: string;
  results: Record<string, unknown>;
}

export async function triggerSwiggySync(): Promise<SyncResult> {
  const res = await fetch(`${BASE_URL}/api/v1/connectors/swiggy/sync`, {
    method: "POST",
    headers: authHeaders(),
  });
  if (!res.ok) {
    const detail = await res.json().catch(() => ({ detail: "Sync failed." }));
    throw new Error(detail.detail ?? `Sync failed: ${res.status}`);
  }
  return res.json() as Promise<SyncResult>;
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

// ── Business performance (revenue, profit, complaints) ─────────────────────────

export interface BusinessDailyPoint {
  date: string;
  revenue: number;
  profit: number;
  orders: number;
}

export interface BusinessDaySnapshot {
  date: string;
  revenue: number;
  profit: number;
  margin_pct: number | null;
  orders: number;
  avg_order_value: number;
}

export interface BusinessDishPerformance {
  name: string;
  category: string;
  revenue: number;
  quantity: number;
  margin_pct: number | null;
}

export interface BusinessChannelSplit {
  dine_in_revenue: number;
  delivery_revenue: number;
  dine_in_orders: number;
  delivery_orders: number;
}

export interface BusinessComplaintCategory {
  category: string;
  count: number;
}

export interface BusinessHourlyDemand {
  hour: number;
  avg_orders: number;
}

export interface BusinessPerformanceResponse {
  period_days: number;
  yesterday: BusinessDaySnapshot | null;
  today_so_far: BusinessDaySnapshot | null;
  trend: BusinessDailyPoint[];
  top_dishes: BusinessDishPerformance[];
  bottom_dishes: BusinessDishPerformance[];
  channel_split: BusinessChannelSplit;
  complaints_by_category: BusinessComplaintCategory[];
  peak_hours: BusinessHourlyDemand[];
}

export async function getBusinessPerformance(days = 14): Promise<BusinessPerformanceResponse> {
  const res = await fetch(`${BASE_URL}/api/v1/business/performance?days=${days}`, {
    headers: authHeaders(),
    cache: "no-store",
  });

  if (!res.ok) {
    const detail = await res.text();
    throw new Error(`Business performance API error ${res.status}: ${detail}`);
  }

  return res.json() as Promise<BusinessPerformanceResponse>;
}

// ── Market pulse (live, independent of any planning run) ──────────────────────

export interface MarketPricingComparison {
  item: string;
  area_avg: number;
  your_price: number | null;
  diff_pct: number | null;
  direction: "above" | "below" | null;
}

export interface MarketCompetitorDeal {
  restaurant: string;
  deal_title: string;
  discount: number;
  code: string;
}

export interface MarketPricingImpactItem {
  item: string;
  our_price: number;
  area_avg: number;
  gap_pct: number;
  direction: "above" | "below";
  volume_change_pct: number;
  weekly_revenue_impact_inr: number;
}

export interface MarketNamedDish {
  name: string;
  price: number;
  restaurant: string;
}

export interface MarketCategoryPricing {
  category: string;
  your_avg: number;
  area_avg: number;
  diff_pct: number;
  verdict: "above" | "below" | "in line";
  competitor_dishes_sampled: number;
  cheapest_dish: MarketNamedDish;
  priciest_dish: MarketNamedDish;
}

export interface MarketCompetitorLandscapeEntry {
  name: string;
  rating: number;
  total_ratings: string;
  cost_for_two: number;
  distance_km: number;
  delivery_time_range: string;
  cuisines: string[];
  offer: string;
  veg: boolean;
}

export interface MarketPositioningInsight {
  your_cost_for_two_estimate: number;
  rank: number;
  total: number;
  cheaper_than_count: number;
  pricier_than_count: number;
}

export interface MarketMenuBreadth {
  your_item_count: number;
  competitor_avg_item_count: number;
  competitors_sampled: number;
}

export interface MarketCuisineCrowding {
  cuisine: string;
  matching_count: number;
  total_checked: number;
}

export interface MarketVegMix {
  veg_count: number;
  total: number;
}

export interface MarketCompetitorPricing {
  restaurants_checked: string[];
  comparisons: MarketPricingComparison[];
  competitor_deals: MarketCompetitorDeal[];
  pricing_impact: MarketPricingImpactItem[];
  category_pricing: MarketCategoryPricing[];
  competitor_landscape: MarketCompetitorLandscapeEntry[];
  positioning: MarketPositioningInsight | null;
  menu_breadth: MarketMenuBreadth | null;
  cuisine_crowding: MarketCuisineCrowding | null;
  veg_mix: MarketVegMix | null;
  fetched_at: string | null;
}

export interface MarketCompetitorDineoutDeal {
  name: string;
  deals: Array<{ title: string; discount_pct: number; is_free: boolean }>;
  amenities: string[];
  timings: string;
}

export interface MarketSlotDeal {
  time: string;
  deal_title: string;
  discount_pct: number;
  is_free: boolean;
}

export interface MarketSlotAvailability {
  time: string;
  avg_availability: number;
  signal: "HIGH" | "MEDIUM" | "LOW";
}

export interface MarketAreaOccupancy {
  signal: "HIGH" | "MEDIUM" | "LOW" | null;
  tonight_busy: boolean | null;
  competitors_checked: number;
  competitor_dineout_deals: MarketCompetitorDineoutDeal[];
  slot_deals_found: MarketSlotDeal[];
  slot_availability_by_time: MarketSlotAvailability[];
  fetched_at: string | null;
}

export interface MarketProcurementItem {
  name: string;
  price: number;
  unit: string;
  in_stock: boolean;
}

export interface MarketPulseResponse {
  swiggy_connected: boolean;
  competitor_pricing: MarketCompetitorPricing | null;
  area_occupancy: MarketAreaOccupancy | null;
  procurement: MarketProcurementItem[];
}

export async function getMarketPulse(): Promise<MarketPulseResponse> {
  const res = await fetch(`${BASE_URL}/api/v1/market/pulse`, {
    headers: authHeaders(),
    cache: "no-store",
  });

  if (!res.ok) {
    const detail = await res.text();
    throw new Error(`Market pulse API error ${res.status}: ${detail}`);
  }

  return res.json() as Promise<MarketPulseResponse>;
}

// ── Live ingredient price lookup (on-demand, not tied to shortages) ───────────

export interface IngredientSearchResult {
  name: string;
  category: string;
  price: number;
  unit: string;
  in_stock: boolean;
}

export interface IngredientSearchResponse {
  swiggy_connected: boolean;
  query: string;
  results: IngredientSearchResult[];
}

export async function searchIngredient(query: string): Promise<IngredientSearchResponse> {
  const res = await fetch(`${BASE_URL}/api/v1/market/ingredient-search?query=${encodeURIComponent(query)}`, {
    headers: authHeaders(),
    cache: "no-store",
  });

  if (!res.ok) {
    const detail = await res.text();
    throw new Error(`Ingredient search API error ${res.status}: ${detail}`);
  }

  return res.json() as Promise<IngredientSearchResponse>;
}

// ── Market trends (P6-MI11) — pricing/occupancy history across past runs ─────

export interface MarketPricePoint {
  date: string;
  area_avg: number;
}

export interface MarketOccupancyPoint {
  date: string;
  signal: "HIGH" | "MEDIUM" | "LOW";
}

export interface MarketTrendsResponse {
  price_trends: Record<string, MarketPricePoint[]>;
  occupancy_trend: MarketOccupancyPoint[];
  days_returned: number;
  note: string | null;
}

export async function getMarketTrends(days = 7): Promise<MarketTrendsResponse> {
  const res = await fetch(`${BASE_URL}/api/v1/market/trends?days=${days}`, {
    headers: authHeaders(),
    cache: "no-store",
  });

  if (!res.ok) {
    const detail = await res.text();
    throw new Error(`Market trends API error ${res.status}: ${detail}`);
  }

  return res.json() as Promise<MarketTrendsResponse>;
}
