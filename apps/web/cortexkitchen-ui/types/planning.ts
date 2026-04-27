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

export interface FridayRushResponse {
  scenario:        string;
  target_date:     string | null;
  status:          "ready" | "needs_review" | "blocked" | "unknown";
  generated_at:    string;
  recommendations: AgentRecommendations;
  rag_context:     RagContext | null;
  critic:          CriticResult;
  meta?:           Record<string, unknown>;
}

export interface FridayRushRequest {
  target_date?: string | null;
  simulation_mode?: boolean;
}

// Run history entry — stored in memory during the session
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
  future_fridays: Array<{
    date: string;
    reservations: number;
    guests: number;
    waitlist: number;
    occupancy_pct: number;
  }>;
  status: "ok";
}
