// Single source of truth for "what will the AI actually do" copy -- used by
// both PlanShiftModal (Dashboard's quick-trigger modal) and PlanningIdleState
// (the dedicated /planning page), so the two surfaces can't drift apart.
// Mirrors the real 11-node pipeline (orchestration/nodes/*.py) -- no
// "Staffing Plan" entry here since no node produces a structured staffing
// recommendation, only a one-line note folded into the forecast's own text.
//
// Copy is written benefit-first, for the restaurant owner reading it, not
// execution-order-first for an engineer -- an owner doesn't care that 5
// nodes run concurrently in a graph, they care what each specialist finds
// or protects for them tonight. Execution topology (what's parallel, what
// waits on what) is deliberately not represented anywhere in this file or
// in AgentPipelineGrid's "full" variant -- it's implementation detail, not
// a selling point.
export interface AgentCapability {
  label: string;
  capability: string;
  // 2-3 short, concrete phrases -- "what this specifically checks/produces",
  // shown as a bullet list under the one-line capability sentence. Grounded
  // in what the real node actually does, not generic marketing phrases.
  capabilities: string[];
  iconPath: string;
  // One distinct tone per agent so the grid doesn't read as monotonous --
  // collapsing everything to one shared accent color (tried earlier) went
  // too far the other way. Kept to a fixed, muted palette (not neon) so it
  // stays a professional feature grid rather than a rainbow. "swiggy" is
  // still its own thing regardless of palette, since that's a real
  // attribution requirement (Swiggy-sourced data must be clearly marked).
  tone: "good" | "info" | "rose" | "purple" | "amber" | "teal" | "swiggy";
  swiggy?: boolean;
  // Live, but not Swiggy MCP -- weather/trends/FSSAI are public/free data.
  // Gets a plain "Live" badge instead of the "Live · Swiggy" one, so the
  // two never look like the same claim.
  live?: boolean;
}

export const AGENT_PIPELINE: AgentCapability[] = [
  {
    label: "Live Signals",
    capability: "Weather, trends & FSSAI notices, checked first.",
    capabilities: ["Live weather forecast", "Industry trend digest", "FSSAI regulatory alerts"],
    iconPath: "M13 10V3L4 14h7v7l9-11h-7z",
    tone: "teal",
    live: true,
  },
  {
    label: "Demand Forecast",
    capability: "Predicts tonight's covers before your first booking.",
    capabilities: ["Prophet-based cover prediction", "Weather & holiday adjusted", "Learns from your order history"],
    iconPath: "M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z",
    tone: "purple",
  },
  {
    label: "Reservation Pressure",
    capability: "Flags overbooking risk from your live bookings.",
    capabilities: ["Live booking analysis", "Overbooking risk detection", "Walk-in estimate"],
    iconPath: "M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z",
    tone: "amber",
  },
  {
    label: "Guest Feedback",
    capability: "Turns recent complaints into tonight's fixes.",
    capabilities: ["Search over past complaints", "Recurring issue detection", "Suggested fixes for tonight"],
    iconPath: "M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z",
    tone: "info",
  },
  {
    label: "Inventory",
    capability: "Exact reorder quantities, so you never run out.",
    capabilities: ["Real-time stock levels", "Exact reorder quantities", "Shortage risk alerts"],
    iconPath: "M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4",
    tone: "good",
  },
  {
    label: "Market Intelligence",
    capability: "Live area pricing and demand, straight from Swiggy.",
    capabilities: ["Area pricing benchmarks", "Competitor deal tracking", "Live occupancy signal"],
    iconPath: "M9.568 3H5.25A2.25 2.25 0 003 5.25v4.318c0 .597.237 1.169.659 1.591l9.581 9.581c.699.699 1.78.872 2.607.33a18.095 18.095 0 005.223-5.223c.542-.827.369-1.908-.33-2.607l-9.581-9.581A2.25 2.25 0 009.568 3zM6 6h.008v.008H6V6z",
    tone: "swiggy",
    swiggy: true,
  },
  {
    label: "Menu Strategy",
    capability: "Only promotes dishes your kitchen can actually make.",
    capabilities: ["Kitchen-feasible picks only", "Promotion recommendations", "Margin-aware suggestions"],
    iconPath: "M8.25 3v18M3 6.75h5.25M3 3v7.5c0 1.243 1.007 2.25 2.25 2.25S7.5 11.743 7.5 10.5V3M16.5 3c-1.657 0-3 2.686-3 6s1.343 6 3 6m0-12v18",
    tone: "rose",
  },
  {
    label: "Critic",
    capability: "A second opinion on safety, feasibility and clarity.",
    capabilities: ["Safety & feasibility scoring", "Evidence-based review", "Triggers a replan if needed"],
    iconPath: "M9 12.75L11.25 15 15 9.75M21 12c0 1.268-.63 2.39-1.593 3.068a3.745 3.745 0 01-1.043 3.296 3.745 3.745 0 01-3.296 1.043A3.745 3.745 0 0112 21c-1.268 0-2.39-.63-3.068-1.593a3.746 3.746 0 01-3.296-1.043 3.745 3.745 0 01-1.043-3.296A3.745 3.745 0 013 12c0-1.268.63-2.39 1.593-3.068a3.745 3.745 0 011.043-3.296 3.746 3.746 0 013.296-1.043A3.746 3.746 0 0112 3c1.268 0 2.39.63 3.068 1.593a3.746 3.746 0 013.296 1.043 3.746 3.746 0 011.043 3.296A3.745 3.745 0 0121 12z",
    tone: "purple",
  },
];

// Not a real specialist -- it's the aggregator+final_assembler's output, not
// a node with its own reasoning -- shown as the last card only so the grid
// ends on the payoff ("here's what all of this adds up to") rather than
// stopping at Critic. AgentPipelineGrid renders this one with an "Output"
// tag instead of "Agent" so it never reads as a 9th specialist.
export const FINAL_PLAN_AGENT: AgentCapability = {
  label: "Your Final Plan",
  capability: "One complete brief, ready for you in the next few lines.",
  capabilities: ["Executive brief", "Full shift plan", "Ready for your Action Queue"],
  iconPath: "M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z",
  tone: "good",
};

// `bg`/`text` tint pills and chip backgrounds (kept pale so body text stays
// readable). `fill` is a solid, deliberately DESATURATED color for the icon
// badge itself -- a full-color square reads as more premium than a
// light-tint-with-border treatment, but the original vivid/neon hues read as
// "playing with colors" rather than a professional palette. Muted, dusty
// versions of the same 7 hues fix that without going back to flat monotone.
// swiggy is the one hue kept true to brand (not muted) -- that's a real
// attribution color, not a design choice.
export const AGENT_TONE_CLASS: Record<AgentCapability["tone"], { bg: string; text: string; fill: string }> = {
  good:    { bg: "var(--color-good-soft)",    text: "var(--color-good)", fill: "#5f9b81" },
  info:    { bg: "rgba(56,189,248,0.10)",     text: "#38bdf8",           fill: "#5f8ba8" },
  rose:    { bg: "rgba(251,113,133,0.10)",    text: "#fb7185",           fill: "#b97676" },
  purple:  { bg: "rgba(139,92,246,0.10)",     text: "#8b5cf6",           fill: "#8577a8" },
  amber:   { bg: "rgba(217,119,6,0.10)",      text: "#d97706",           fill: "#b98548" },
  teal:    { bg: "rgba(20,184,166,0.10)",     text: "#14b8a6",           fill: "#4f8f88" },
  swiggy:  { bg: "rgba(252,128,25,0.10)",     text: "#fc8019",           fill: "#fc8019" },
};
