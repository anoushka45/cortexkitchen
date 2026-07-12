// types/planning.ts
// Mirrors apps/api/app/api/schemas/planning.py

export interface ForecastData {
  predicted_orders: number;
  predicted_orders_lower?: number;
  predicted_orders_upper?: number;
  predicted_peak_orders?: number;
  method: "prophet" | "baseline";
  confidence: "high" | "medium" | "low";
  target_date?: string;
  avg_friday_orders?: number;
  avg_peak_orders?: number;
  history?: Array<{
    date: string;
    total_orders: number;
    peak_orders_6pm_to_11pm: number;
  }>;
  hourly_projection?: Array<{
    hour: string;
    covers: number;
  }>;
  top_items?: Array<{
    item: string;
    category: string;
    total_ordered: number;
  }>;
}

export interface ReservationData {
  date: string;
  total_reservations: number;
  total_guests: number;
  capacity: number;
  occupancy_pct: number;
  overbooking_risk: boolean;
  busiest_hour?: number;
  peak_hours?: Record<string, number>;
  waitlist_count: number;
}

export interface ComplaintData {
  data?: {
    unique_complaints?: string[];
    unique_positives?: string[];
    total_feedback?: number;
    sentiment_breakdown?: {
      negative: number;
      positive: number;
      neutral: number;
      negative_pct: number;
    };
  };
  issues?: Array<{
    issue: string;
    frequency: string;
    recommendation: string;
    priority: "high" | "medium" | "low";
  }>;
  overall_summary?: string;
  action_items?: string[];
  unique_complaints?: string[];
  unique_positives?: string[];
  total_feedback?: number;
  sentiment_breakdown?: {
    negative: number;
    positive: number;
    neutral: number;
    negative_pct: number;
  };
}

export interface MenuData {
  data?: {
    top_items?: Array<{
      item: string;
      category: string;
      total_ordered: number;
    }>;
    forecast_snapshot?: {
      predicted_orders?: number;
      predicted_peak_orders?: number;
      avg_friday_orders?: number;
      target_date?: string;
    };
    complaint_themes?: string[];
    shortage_ingredients?: string[];
    overstock_ingredients?: string[];
    note?: string;
  };
  top_items?: Array<{
    item: string;
    category: string;
    total_ordered: number;
  }>;
  highlight_items?: string[];
  deprioritize_items?: string[];
  promo_candidates?: string[];
  inventory_blockers?: string[];
  complaint_watchouts?: string[];
  operational_notes?: string[];
  reasoning?: string;
  priority?: string;
  risks?: string[];
  note?: string;
}

export interface InventoryData {
  data?: {
    total_items_checked?: number;
    shortage_alerts?: unknown[];
    overstock_alerts?: unknown[];
    high_demand_week?: boolean;
    demand_ratio?: number;
  };
  restock_actions?: string[];
  waste_reduction_actions?: string[];
  priority?: string;
  reasoning?: string;
  risks?: string[];
  note?: string;
  shortage_alerts?: unknown[];
  overstock_alerts?: unknown[];
}

export interface AgentRecommendations {
  forecast: Record<string, unknown> | null;
  reservation: ReservationData | null;
  complaint: ComplaintData | null;
  menu: MenuData | null;
  inventory: InventoryData | null;
}

export interface CriticResult {
  verdict:         "approved" | "rejected" | "revision" | "unknown";
  score:           number;
  notes:           string;
  cost_analysis?: {
    cost_pressure_score: number;
    benefit_score: number;
    tradeoff_score: number;
    pressure_components?: Record<string, number>;
    benefit_components?: Record<string, number>;
    tradeoff_notes?: string[];
    recommended_focus?: string[];
    signals?: Record<string, unknown>;
  } | null;
  dimension_scores?: Record<string, number> | null;
  revision_reasons?: string[];
  actionable_feedback?: string[];
  decision_log_id: number | null;
  sanity_checks?: {
    passed?: boolean;
    summary?: string;
    issues?: Array<{
      code: string;
      severity: string;
      message: string;
    }>;
  } | null;
}

export interface RagContext {
  complaints?: unknown[];
  sops?:       unknown[];
  [key: string]: unknown;
}

export interface SwiggyCompetitorPricing {
  area_avg_price:    number | null;
  cheapest_price:    number | null;
  most_expensive:    number | null;
  restaurants_found: number;
  dish_query:        string;
  fetched_at:        string;
}

export interface SwiggyPricingAlert {
  item:         string;
  your_price:   number;
  area_avg:     number;
  diff_pct:     number;
  direction:    "above" | "below";
}

export interface SwiggyOccupancyContext {
  signal:       "HIGH" | "MEDIUM" | "LOW";
  tonight_busy: boolean;
  restaurants_found: number;
  fetched_at:   string;
}

export interface SwiggyProcurementOption {
  name:     string;
  price:    number;
  unit:     string;
  in_stock: boolean;
  spin_id:  string;
}

export interface MarketIntelOutput {
  competitor_pricing: SwiggyCompetitorPricing | null;
  area_occupancy:     SwiggyOccupancyContext | null;
  pricing_alerts:     SwiggyPricingAlert[];
  tonight_busy:       boolean | null;
  fetched_at:         string | null;
}

export interface FridayRushResponse {
  scenario:        string;
  target_date:     string | null;
  status:          "ready" | "needs_review" | "blocked" | "unknown";
  generated_at:    string;
  recommendations: AgentRecommendations;
  rag_context:     RagContext | null;
  critic:          CriticResult;
  meta?:           Record<string, unknown>;
  // Swiggy enricher outputs (P6-S11/S12)
  market_intel?:              MarketIntelOutput | null;
  swiggy_competitor_context?: Record<string, unknown> | null;
  swiggy_occupancy_context?:  SwiggyOccupancyContext | null;
  swiggy_procurement_options?: SwiggyProcurementOption[] | null;
  dineout_manager?:           Record<string, unknown> | null;
}

// P6-A25 -- ad-hoc scenario profile derived from natural language, carried
// alongside a non-preset `scenario` id. Mirrors the backend's
// ScenarioProfilePayload (apps/api/app/api/schemas/planning.py).
export interface ScenarioProfile {
  id: string;
  label: string;
  description?: string;
  service_window: string;
  operational_focus: string;
  cuisine?: string | null;
}

export interface FridayRushRequest {
  target_date?: string | null;
  simulation_mode?: boolean;
  // Widened from the 4-literal union (P6-A25) -- a custom id (e.g. "custom")
  // is valid when custom_profile is also supplied. The 4 presets still work
  // unchanged when scenario is one of them and custom_profile is omitted.
  scenario?: string;
  restaurant_id?: number;
  custom_profile?: ScenarioProfile | null;
}

export interface PlanningScenarioOption {
  // Widened from the 4-literal union (P6-A25) so a synthesized "custom" tile
  // (built from ScenarioProfile) can be passed through the same picker props
  // as the 4 presets.
  id: string;
  label: string;
  description: string;
  default_weekday: number;
  service_window: string;
  operational_focus: string;
}

// Run history entry -- stored in memory during the session
export interface RunHistoryEntry {
  id:          string | number;
  targetDate:  string;
  runAt:       string;
  status:      FridayRushResponse["status"];
  verdict:     CriticResult["verdict"];
  score:       number | null;
  data?:       FridayRushResponse;
}

export interface PlanningRunSummary {
  id: number;
  scenario: string;
  target_date: string | null;
  status: FridayRushResponse["status"];
  critic_verdict: CriticResult["verdict"] | null;
  critic_score: number | null;
  decision_log_id: number | null;
  generated_at: string | null;
  created_at: string | null;
}

export interface PlanningRunDetail extends PlanningRunSummary {
  final_response: FridayRushResponse;
  recommendations: AgentRecommendations | null;
  rag_context: RagContext | null;
  critic: CriticResult | null;
  metadata: Record<string, unknown> | null;
}

export interface DataHealth {
  orders: { count: number; date_range: Array<string | null> };
  reservations: { count: number; date_range: Array<string | null> };
  feedback: {
    count: number;
    date_range: Array<string | null>;
    negative: number;
    positive: number;
    neutral: number;
    negative_pct: number;
  };
  inventory: {
    items: number;
    shortage_alerts: number;
    critical_shortages: number;
    overstock_alerts: number;
  };
  menu: { items: number };
  scenario_coverage: Array<{
    scenario: "friday_rush" | "weekday_lunch" | "holiday_spike" | "low_stock_weekend";
    label: string;
    date: string;
    reservations: number;
    guests: number;
    waitlist: number;
    occupancy_pct: number;
  }>;
  status: "ok";
}
