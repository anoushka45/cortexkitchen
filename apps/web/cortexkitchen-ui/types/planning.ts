// types/planning.ts
// Mirrors apps/api/app/api/schemas/planning.py

export interface AgentRecommendations {
  forecast:    Record<string, unknown> | null;
  reservation: Record<string, unknown> | null;
  complaint:   Record<string, unknown> | null;
  menu:        Record<string, unknown> | null;
  inventory:   Record<string, unknown> | null;
}

export interface CriticResult {
  verdict:         "approved" | "rejected" | "revision" | "unknown";
  score:           number;
  notes:           string;
  decision_log_id: number | null;
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
}

export interface FridayRushRequest {
  target_date?: string | null;
}