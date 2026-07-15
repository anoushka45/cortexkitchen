// Single source of truth for "what will the AI actually do" copy -- used by
// both PlanShiftModal (Dashboard's quick-trigger modal) and PlanningIdleState
// (the dedicated /planning page), so the two surfaces can't drift apart.
// Mirrors the real 11-node pipeline (orchestration/nodes/*.py) -- no
// "Staffing Plan" entry here since no node produces a structured staffing
// recommendation, only a one-line note folded into the forecast's own text.
export interface AgentCapability {
  label: string;
  capability: string;
  iconPath: string;
  tone: "good" | "info" | "rose" | "caution" | "swiggy";
  swiggy?: boolean;
}

export const AGENT_PIPELINE: AgentCapability[] = [
  {
    label: "Demand Forecast",
    capability: "Predicts how many covers to expect tonight, adjusted for weather and holidays -- not just a label, a real multiplier on the number.",
    iconPath: "M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z",
    tone: "good",
  },
  {
    label: "Reservation Pressure",
    capability: "Reads your live booking list and flags when you're likely to hit capacity or overbook.",
    iconPath: "M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z",
    tone: "info",
  },
  {
    label: "Guest Feedback",
    capability: "Scans recent customer feedback for recurring complaints and surfaces fixes for tonight.",
    iconPath: "M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z",
    tone: "rose",
  },
  {
    label: "Inventory",
    capability: "Flags what's running low or overstocked, with exact reorder quantities against tonight's forecast.",
    iconPath: "M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4",
    tone: "caution",
  },
  {
    label: "Market Intelligence",
    capability: "Checks area-level pricing and demand on Swiggy -- never named competitors, just the aggregate picture.",
    iconPath: "M13 10V3L4 14h7v7l9-11h-7z",
    tone: "swiggy",
    swiggy: true,
  },
  {
    label: "Area Demand",
    capability: "Reads live Dineout slot availability nearby to tell if tonight's demand is being absorbed elsewhere.",
    iconPath: "M17.657 16.657L13.414 20.9a2 2 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z",
    tone: "swiggy",
    swiggy: true,
  },
  {
    label: "Menu Direction",
    capability: "Only recommends dishes that are actually in stock -- runs after inventory, not before.",
    iconPath: "M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4",
    tone: "good",
  },
  {
    label: "Critic",
    capability: "Scores every plan across safety, feasibility, evidence, and clarity before it ever reaches you.",
    iconPath: "M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z",
    tone: "good",
  },
];

export const AGENT_TONE_CLASS: Record<AgentCapability["tone"], { bg: string; text: string }> = {
  good:    { bg: "var(--color-good-soft)",    text: "var(--color-good)" },
  info:    { bg: "rgba(56,189,248,0.10)",     text: "#38bdf8" },
  rose:    { bg: "rgba(251,113,133,0.10)",    text: "#fb7185" },
  caution: { bg: "var(--color-caution-soft)", text: "var(--color-caution)" },
  swiggy:  { bg: "rgba(252,128,25,0.10)",     text: "#fc8019" },
};

// Groups AGENT_PIPELINE by real execution order (graph.py: demand_forecast ->
// [5 parallel enrichers] -> menu_intelligence -> critic) -- used by the
// "full" grid variant to tell the actual pipeline story instead of one flat
// undifferentiated list of 8 cards.
export interface PipelineStage {
  id: string;
  step: number;
  label: string;
  description: string;
  agents: AgentCapability[];
}

export const PIPELINE_STAGES: PipelineStage[] = [
  {
    id: "read", step: 1,
    label: "Reads the room first",
    description: "Tonight's forecast has to exist before anything else can react to it.",
    agents: [AGENT_PIPELINE[0]],
  },
  {
    id: "specialists", step: 2,
    label: "5 specialists, running in parallel",
    description: "3 from your own records, 2 pulling live data from Swiggy — all at once, not in sequence.",
    agents: AGENT_PIPELINE.slice(1, 6),
  },
  {
    id: "synthesize", step: 3,
    label: "Turns signals into a plan",
    description: "Waits for inventory to finish, so it never recommends a dish you can't actually make.",
    agents: [AGENT_PIPELINE[6]],
  },
  {
    id: "check", step: 4,
    label: "Checked before it reaches you",
    description: "Nothing ships without a passing score.",
    agents: [AGENT_PIPELINE[7]],
  },
];
