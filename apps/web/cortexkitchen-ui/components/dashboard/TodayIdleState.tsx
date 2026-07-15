"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ComposedChart, Area, Line, Bar, BarChart,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import { useAuth } from "@/context/AuthContext";
import PlanShiftModal from "@/components/dashboard/PlanShiftModal";
import {
  getDataHealth, getConnectorsStatus, getMarketPulse, getBusinessPerformance, getBusinessSummary,
  listRestaurantProfiles, getActionQueue, listPlanningRuns,
  BusinessPerformanceResponse, BusinessSummaryResponse, ConnectorStatus, MarketPulseResponse,
  RestaurantProfile, ActionQueueItem,
} from "@/lib/api";
import { SCENARIO_OPTIONS } from "@/lib/scenarios";
import { shortDate, relativeTime, VERDICT_TONE } from "@/lib/formatters";
import { DataHealth, PlanningRunSummary, PlanningScenarioOption, ScenarioProfile } from "@/types/planning";

const TONE_CLASS: Record<string, { bg: string; text: string }> = {
  good:    { bg: "var(--color-good-soft)",    text: "var(--color-good)" },
  info:    { bg: "rgba(56,189,248,0.10)",     text: "#38bdf8" },
  rose:    { bg: "rgba(251,113,133,0.10)",    text: "#fb7185" },
  caution: { bg: "var(--color-caution-soft)", text: "var(--color-caution)" },
  swiggy:  { bg: "rgba(252,128,25,0.12)",      text: "#fc8019" },
};

const CONDITION_LABELS: Record<string, string> = {
  heavy_rain: "Heavy Rain",
  light_rain: "Light Rain",
  very_hot:   "Very Hot",
  clear:      "Clear",
};

// TrendsService's digest is a multi-point paragraph/bullet list -- take just
// the first point as a compact row headline instead of dumping the whole
// thing (which overflowed the Live Intelligence row entirely).
function firstDigestSnippet(digest: string): string {
  const first = digest.split(/\n|(?<=[.;])\s*(?=[A-Z*•-])/)[0].replace(/^[*•\-\s]+/, "").trim();
  if (first.length <= 72) return first;
  const cut = first.slice(0, 69);
  const lastSpace = cut.lastIndexOf(" ");
  return `${lastSpace > 40 ? cut.slice(0, lastSpace) : cut}...`;
}

function healthLabel(score: number): string {
  if (score >= 70) return "Excellent";
  if (score >= 40) return "Fair";
  return "Needs attention";
}

function greetingWord(): string {
  const h = new Date().getHours();
  if (h < 12) return "Good Morning";
  if (h < 17) return "Good Afternoon";
  return "Good Evening";
}

interface Props {
  onRun: (date?: string, restaurantName?: string, restaurantId?: number, customProfile?: ScenarioProfile) => void;
  selectedScenario: PlanningScenarioOption["id"];
  onScenarioChange: (scenario: PlanningScenarioOption["id"]) => void;
  historyCount: number;
  onShowHistory: () => void;
}

export default function TodayIdleState({
  onRun, selectedScenario, onScenarioChange, historyCount, onShowHistory,
}: Props) {
  const { user } = useAuth();
  const scenario = SCENARIO_OPTIONS.find((s) => s.id === selectedScenario) ?? SCENARIO_OPTIONS[0];

  const [profiles, setProfiles] = useState<RestaurantProfile[]>([]);
  const [selectedProfileId, setSelectedProfileId] = useState<number | null>(null);

  const [dataHealth, setDataHealth]     = useState<DataHealth | null>(null);
  const [connector, setConnector]       = useState<ConnectorStatus | null>(null);
  const [marketPulse, setMarketPulse]   = useState<MarketPulseResponse | null>(null);
  const [businessPerf, setBusinessPerf] = useState<BusinessPerformanceResponse | null>(null);
  const [perfDays, setPerfDays]         = useState(14);
  const [loaded, setLoaded]             = useState(false);
  const [marketLoaded, setMarketLoaded] = useState(false);
  const [showPlanModal, setShowPlanModal] = useState(false);

  const [summary, setSummary]           = useState<BusinessSummaryResponse | null>(null);
  const [pendingActions, setPendingActions] = useState<ActionQueueItem[]>([]);
  const [latestRun, setLatestRun]       = useState<PlanningRunSummary | null>(null);
  const [latestRunLoaded, setLatestRunLoaded] = useState(false);

  useEffect(() => {
    listRestaurantProfiles()
      .then((list) => { setProfiles(list); if (list.length > 0) setSelectedProfileId(list[0].id); })
      .catch(() => { /* optional context */ });
  }, []);

  // Fast, DB-only calls -- resolve in well under a second.
  useEffect(() => {
    let cancelled = false;
    Promise.all([
      getDataHealth().catch(() => null),
      getConnectorsStatus().catch(() => null),
    ]).then(([health, connectors]) => {
      if (cancelled) return;
      setDataHealth(health);
      setConnector(connectors?.connectors.find((c) => c.type === "swiggy") ?? null);
    });
    return () => { cancelled = true; };
  }, []);

  // Business performance drives most of the page -- re-fetched whenever the
  // trend window toggle changes (Overall Performance's 7d/14d/30d control).
  useEffect(() => {
    let cancelled = false;
    getBusinessPerformance(perfDays)
      .then((perf) => { if (!cancelled) setBusinessPerf(perf); })
      .catch(() => { if (!cancelled) setBusinessPerf(null); })
      .finally(() => { if (!cancelled) setLoaded(true); });
    return () => { cancelled = true; };
  }, [perfDays]);

  // AI executive summary -- its own LLM call, cached server-side, never
  // blocks the KPIs/charts above from rendering.
  useEffect(() => {
    let cancelled = false;
    getBusinessSummary()
      .then((s) => { if (!cancelled) setSummary(s); })
      .catch(() => { if (!cancelled) setSummary(null); });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    let cancelled = false;
    getActionQueue("pending").then((rows) => { if (!cancelled) setPendingActions(rows); }).catch(() => {});
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    let cancelled = false;
    listPlanningRuns({ limit: 1 })
      .then((rows) => { if (!cancelled) setLatestRun(rows[0] ?? null); })
      .catch(() => { if (!cancelled) setLatestRun(null); })
      .finally(() => { if (!cancelled) setLatestRunLoaded(true); });
    return () => { cancelled = true; };
  }, []);

  // Market pulse hits live Swiggy MCP tools directly -- on a cold cache this can take
  // several seconds (real external calls). Kept in its own effect/loading flag so a
  // slow Swiggy response never blocks the rest of the page from rendering as soon as
  // it's ready.
  useEffect(() => {
    let cancelled = false;
    getMarketPulse()
      .then((pulse) => { if (!cancelled) setMarketPulse(pulse); })
      .catch(() => { if (!cancelled) setMarketPulse(null); })
      .finally(() => { if (!cancelled) setMarketLoaded(true); });
    return () => { cancelled = true; };
  }, []);

  const activeProfile = profiles.find((p) => p.id === selectedProfileId) ?? profiles[0] ?? null;

  const coverage = dataHealth?.scenario_coverage.find((s) => s.scenario === selectedScenario) ?? null;
  const criticalShortages = dataHealth?.inventory.critical_shortages ?? 0;
  const shortageAlerts    = dataHealth?.inventory.shortage_alerts ?? 0;
  const feedback = dataHealth?.feedback ?? null;
  const positivePct = feedback && feedback.count > 0 ? Math.round((feedback.positive / feedback.count) * 100) : null;

  const occupancy = marketPulse?.area_occupancy ?? null;
  const pricingAlerts = (marketPulse?.competitor_pricing?.comparisons ?? []).filter(
    (a): a is typeof a & { diff_pct: number; direction: "above" | "below" } => a.your_price != null
  );
  const abovePricingCount = pricingAlerts.filter((a) => a.direction === "above").length;
  const procurement = marketPulse?.procurement ?? [];
  const cheapestProcurement = procurement.length > 0
    ? [...procurement].filter((p) => p.in_stock).sort((a, b) => a.price - b.price)[0] ?? procurement[0]
    : null;

  const yesterday = businessPerf?.yesterday ?? null;
  const revenueTrend = businessPerf?.trend ?? [];
  // Gross margin % by day -- a distinct profitability lens on the same
  // already-fetched trend data, so "Business Performance" isn't just a bar
  // version of "Overall Performance" repeating revenue/orders.
  const marginTrend = useMemo(
    () => revenueTrend.map((d) => ({
      date: d.date,
      margin_pct: d.revenue > 0 ? Math.round((d.profit / d.revenue) * 1000) / 10 : 0,
    })),
    [revenueTrend]
  );
  const healthScore = businessPerf?.health_score ?? 0;
  // Dark, saturated tones -- the hero card is now a light orange, so the
  // ring needs colors dark enough to read against a LIGHT background (a pale
  // cream barely showed up at all here, unlike on the previous dark-brown card).
  const healthRingColor = healthScore >= 70 ? "#34d399" : healthScore >= 40 ? "#FBBF24" : "#FB7185";
  const topDishes = businessPerf?.top_dishes ?? [];
  const foodCostPct = yesterday && yesterday.revenue > 0
    ? Math.round(((yesterday.revenue - yesterday.profit) / yesterday.revenue) * 100)
    : null;
  const complaintCategories = businessPerf?.complaints_by_category ?? [];
  const revenueDelta = useMemo(() => {
    if (revenueTrend.length < 2) return null;
    const last = revenueTrend[revenueTrend.length - 2]; // yesterday (last complete day)
    const prior = revenueTrend[revenueTrend.length - 9]; // same weekday, one week earlier
    if (!last || !prior || !prior.revenue) return null;
    return Math.round(((last.revenue - prior.revenue) / prior.revenue) * 100);
  }, [revenueTrend]);
  const ordersDelta = useMemo(() => {
    if (revenueTrend.length < 9) return null;
    const last = revenueTrend[revenueTrend.length - 2];
    const prior = revenueTrend[revenueTrend.length - 9];
    if (!last || !prior || !prior.orders) return null;
    return Math.round(((last.orders - prior.orders) / prior.orders) * 100);
  }, [revenueTrend]);
  const aovDelta = useMemo(() => {
    if (revenueTrend.length < 9) return null;
    const last = revenueTrend[revenueTrend.length - 2];
    const prior = revenueTrend[revenueTrend.length - 9];
    if (!last || !prior || !last.orders || !prior.orders) return null;
    const lastAov = last.revenue / last.orders;
    const priorAov = prior.revenue / prior.orders;
    if (!priorAov) return null;
    return Math.round(((lastAov - priorAov) / priorAov) * 100);
  }, [revenueTrend]);

  const inventoryTotal = dataHealth?.inventory.items ?? 0;
  const overstockAlerts = dataHealth?.inventory.overstock_alerts ?? 0;
  const healthyItems = Math.max(0, inventoryTotal - shortageAlerts - overstockAlerts);
  const reservationGaugePct = coverage ? Math.min(100, Math.round(coverage.occupancy_pct)) : null;

  const risks = businessPerf?.risks ?? [];

  const insights: Array<{ tone: string; text: React.ReactNode }> = [];
  if (yesterday && revenueDelta !== null && revenueDelta !== 0) {
    insights.push({
      tone: revenueDelta > 0 ? "good" : "caution",
      text: <><b>Revenue was {revenueDelta > 0 ? "up" : "down"} {Math.abs(revenueDelta)}%</b> yesterday vs. the same day last week (₹{yesterday.revenue.toLocaleString("en-IN")}).</>,
    });
  }
  if (complaintCategories.length > 0) {
    const top = complaintCategories[0];
    insights.push({
      tone: "caution",
      text: <><b>{top.category} is your top complaint driver</b> — {top.count} of the last 28 days&apos; negative reviews.</>,
    });
  }
  if (criticalShortages > 0) {
    insights.push({ tone: "caution", text: <><b>{criticalShortages} ingredient{criticalShortages !== 1 ? "s are" : " is"} critically low</b> — check inventory before tonight&apos;s service.</> });
  } else if (shortageAlerts > 0) {
    insights.push({ tone: "caution", text: <><b>{shortageAlerts} ingredient{shortageAlerts !== 1 ? "s" : ""} running low</b> — worth a look before you plan tonight.</> });
  }
  if (coverage && coverage.waitlist > 0) {
    insights.push({ tone: "info", text: <><b>{coverage.waitlist} guest{coverage.waitlist !== 1 ? "s" : ""} on the waitlist</b> for a {coverage.label.toLowerCase()} shift — plan for extra turnover.</> });
  }
  if (positivePct !== null) {
    insights.push({
      tone: positivePct >= 75 ? "good" : "caution",
      text: <><b>Guest sentiment is {positivePct}% positive</b> across {feedback?.count} pieces of feedback on record.</>,
    });
  }
  if (pricingAlerts.length > 0) {
    const top = pricingAlerts[0];
    insights.push({
      tone: "swiggy",
      text: <><b>{top.item} is priced {Math.abs(top.diff_pct)}% {top.direction} area average</b> on Swiggy — {abovePricingCount} dish{abovePricingCount !== 1 ? "es" : ""} above average overall.</>,
    });
  }
  if (occupancy?.signal) {
    insights.push({
      tone: "swiggy",
      text: <><b>Area demand is {occupancy.signal.toLowerCase()} tonight</b> — {occupancy.competitors_checked} nearby kitchens tracked on Swiggy.</>,
    });
  }
  if (cheapestProcurement) {
    insights.push({
      tone: "swiggy",
      text: <><b>{cheapestProcurement.name} is ₹{cheapestProcurement.price}/{cheapestProcurement.unit} on Instamart</b>{cheapestProcurement.in_stock ? ", in stock right now" : ""} — worth reordering before tonight.</>,
    });
  }
  if (connector && !connector.connected) {
    insights.push({ tone: "swiggy", text: <><b>Swiggy isn&apos;t connected yet</b> — connect it to unlock live competitor pricing and area demand.</> });
  }

  // "Today's Top Priorities" -- built entirely from real risk/demand data
  // (BusinessAnalyticsService.get_upcoming_risks + the Swiggy area-occupancy
  // signal), not a separate fabricated list.
  type Priority = { title: string; detail: string; pill: string; pillTone: "critical" | "caution" | "good"; icon: string };
  const priorities: Priority[] = [];
  const inventoryNames: string[] = [];
  for (const r of risks) {
    if (r.kind === "inventory") {
      const m = r.text.match(/^(.+?) below threshold/);
      const name = m ? m[1] : null;
      if (name) inventoryNames.push(name);
      priorities.push({
        title: name ? `${name} stock is ${r.severity === "critical" ? "critically low" : "running low"}` : r.text,
        detail: r.text,
        pill: r.severity === "critical" ? "Critical" : "High",
        pillTone: r.severity === "critical" ? "critical" : "caution",
        icon: "M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z",
      });
    } else if (r.kind === "occupancy") {
      // Only surface here if the forecasted date is today/tomorrow -- these
      // risks are computed for the next occurrence of each scenario (up to
      // 7 days out), and labeling a 5-day-out forecast as a "Today" priority
      // is misleading. Further-out dates still show in the Upcoming Risks
      // card elsewhere, which is honestly framed as upcoming, not today's.
      const dateMatch = r.text.match(/\((\d{4}-\d{2}-\d{2})\)/);
      const daysUntil = dateMatch
        ? Math.round((new Date(dateMatch[1]).getTime() - new Date().setHours(0, 0, 0, 0)) / 86400000)
        : null;
      if (daysUntil !== null && daysUntil <= 1) {
        const m = r.text.match(/^(.+?) forecasted/);
        priorities.push({
          title: m ? `${m[1]} demand forecasted high` : r.text,
          detail: r.text,
          pill: "High",
          pillTone: "caution",
          icon: "M13 7h8m0 0v8m0-8l-8 8-4-4-6 6",
        });
      }
    }
  }
  if (occupancy?.signal === "HIGH") {
    priorities.push({
      title: "Area demand expected to increase tonight",
      detail: `${occupancy.competitors_checked} nearby kitchens tracked on Swiggy`,
      pill: "Opportunity",
      pillTone: "good",
      icon: "M13 7h8m0 0v8m0-8l-8 8-4-4-6 6",
    });
  }

  function highlightNames(text: string, names: string[]): React.ReactNode {
    if (names.length === 0) return text;
    const escaped = names.map((n) => n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
    const pattern = new RegExp(`(${escaped.join("|")})`, "gi");
    const parts = text.split(pattern);
    return parts.map((part, i) =>
      names.some((n) => n.toLowerCase() === part.toLowerCase())
        ? <b key={i} style={{ color: "var(--color-accent)" }}>{part}</b>
        : <span key={i}>{part}</span>
    );
  }

  return (
    <div className="py-6 space-y-5">

      {/* Greeting row */}
      <div>
        <h1 className="text-[26px] font-bold leading-tight text-[var(--color-text-primary)]">
          {greetingWord()}, {user?.full_name?.split(" ")[0] ?? "Chef"}! 
        </h1>
        <p className="mt-1 text-sm text-[var(--color-text-soft)]">Here&apos;s how your restaurant is performing today.</p>
      </div>

      {/* ═══ The numbers, at a glance: 8-tile KPI strip ═══ */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 xl:grid-cols-8">
        <MiniKpi
          label="Revenue" hue="#efa345" icon="M12 8c-1.66 0-3 .9-3 2s1.34 2 3 2 3 .9 3 2-1.34 2-3 2m0-8V6m0 10v2m0-14a8 8 0 100 16 8 8 0 000-16z"
          value={yesterday ? `₹${yesterday.revenue.toLocaleString("en-IN")}` : "--"}
          delta={revenueDelta !== null ? `${revenueDelta >= 0 ? "↑" : "↓"} ${Math.abs(revenueDelta)}% vs yesterday` : undefined}
          tone={revenueDelta !== null && revenueDelta < 0 ? "caution" : "good"}
          hero
        />
        <MiniKpi
          label="Orders" hue="#38bdf8" icon="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"
          value={yesterday ? yesterday.orders.toLocaleString("en-IN") : "--"}
          delta={ordersDelta !== null ? `${ordersDelta >= 0 ? "↑" : "↓"} ${Math.abs(ordersDelta)}% vs yesterday` : undefined}
          tone={ordersDelta !== null && ordersDelta < 0 ? "caution" : "good"}
        />
        <MiniKpi
          label="Average Order Value" hue="#818cf8" icon="M3 10h18M7 15h1m4 0h1m-7 4h12a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
          value={yesterday ? `₹${Math.round(yesterday.avg_order_value)}` : "--"}
          delta={aovDelta !== null ? `${aovDelta >= 0 ? "↑" : "↓"} ${Math.abs(aovDelta)}% vs yesterday` : undefined}
          tone={aovDelta !== null && aovDelta < 0 ? "caution" : "good"}
        />
        <MiniKpi
          label="Occupancy" hue="#fb7185" icon="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"
          value={reservationGaugePct !== null ? `${reservationGaugePct}%` : "--"}
          delta={coverage ? `${coverage.waitlist} on waitlist` : undefined}
          tone={reservationGaugePct !== null && reservationGaugePct >= 90 ? "caution" : undefined}
        />
        <MiniKpi
          label="Sentiment" hue="#34d399" icon="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
          value={positivePct !== null ? `${positivePct}%` : "--"} delta="28-day positive"
          tone={positivePct !== null && positivePct < 60 ? "caution" : undefined}
        />
        <MiniKpi
          label="Food Cost" hue="#fbbf24" icon="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4"
          value={foodCostPct !== null ? `${foodCostPct}%` : "--"} delta="of revenue, yesterday"
        />
        <MiniKpi
          label="Stock Health" hue="#B0621A" icon="M20 12V8H6a2 2 0 01-2-2c0-1.1.9-2 2-2h12v4M4 6v12a2 2 0 002 2h14v-4M18 12a2 2 0 00-2 2c0 1.1.9 2 2 2h4v-4h-4z"
          value={inventoryTotal > 0 ? `${healthyItems}/${inventoryTotal}` : "--"}
          delta={criticalShortages > 0 ? `${criticalShortages} critical` : "healthy"}
          tone={criticalShortages > 0 ? "caution" : undefined}
        />
        <MiniKpi
          label="Complaint Rate" hue="#f472b6" icon="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
          value={feedback && feedback.count > 0 ? `${feedback.negative_pct}%` : "--"}
          delta="of feedback, 28d"
          tone={feedback && feedback.negative_pct > 25 ? "caution" : undefined}
        />
      </div>

      {/* ═══ HERO — health score + AI executive summary, paired with Live Intelligence ═══ */}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1.4fr_1fr] items-stretch">
        <div className="card min-w-0 p-5 sm:p-6">
          <p className="flex items-center gap-1.5 text-[15px] font-bold" style={{ color: "var(--color-accent)" }}>
            <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2l1.5 5.5L19 9l-5.5 1.5L12 16l-1.5-5.5L5 9l5.5-1.5z" /></svg>
            AI Executive Summary
          </p>

          <div className="mt-4 grid grid-cols-1 gap-5 sm:grid-cols-[auto_1fr]">
            <div className="flex shrink-0 flex-col items-center gap-1 text-center">
              <div className="relative shrink-0" style={{ width: 108, height: 108 }}>
                <svg width={108} height={108} viewBox="0 0 92 92">
                  <defs>
                    <linearGradient id="healthGauge" x1="0%" y1="0%" x2="0%" y2="100%">
                      <stop offset="0%" stopColor="#34d399" />
                      <stop offset="50%" stopColor="#fbbf24" />
                      <stop offset="100%" stopColor="#fb7185" />
                    </linearGradient>
                  </defs>
                  <circle cx={46} cy={46} r={40} fill="none" stroke="var(--color-surface-sunken)" strokeWidth={7} />
                  <circle
                    cx={46} cy={46} r={40} fill="none" stroke="url(#healthGauge)" strokeWidth={7} strokeLinecap="round"
                    strokeDasharray={2 * Math.PI * 40}
                    strokeDashoffset={loaded ? 2 * Math.PI * 40 * (1 - Math.min(100, Math.max(0, healthScore)) / 100) : 2 * Math.PI * 40}
                    transform="rotate(-90 46 46)" style={{ transition: "stroke-dashoffset 0.6s ease" }}
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="font-bold leading-none text-[var(--color-text-primary)]" style={{ fontSize: 38 }}>{loaded ? healthScore : "--"}</span>
                  <span className="mt-1 text-[10px] leading-none uppercase tracking-wide text-[var(--color-text-faint)]">/100</span>
                </div>
              </div>
              <p className="mt-1.5 text-[10.5px] font-semibold uppercase tracking-[0.12em] text-[var(--color-text-faint)]">Overall Health</p>
              <p className="text-[16px] font-bold leading-tight" style={{ color: healthRingColor }}>{loaded ? healthLabel(healthScore) : "Loading…"}</p>
            </div>

            <div className="min-w-0">
              <p className="text-[13.5px] leading-relaxed text-[var(--color-text-soft)]">
                {summary?.summary
                  ? highlightNames(summary.summary, inventoryNames)
                  : (loaded
                    ? "Executive summary isn't available right now — the KPIs below are still live and accurate."
                    : "Reading today's numbers…")}
              </p>
            </div>
          </div>

          {priorities.length > 0 && (
            <div className="mt-5 border-t border-[var(--color-border-soft)] pt-4">
              <p className="text-[10.5px] font-bold uppercase tracking-[0.14em] text-[var(--color-text-faint)]">Today&apos;s Top Priorities</p>
              <div className="mt-2.5 space-y-2">
                {priorities.slice(0, 3).map((p, i) => (
                  <div key={i} className="flex items-center gap-3 rounded-xl border border-[var(--color-border-soft)] px-3.5 py-2.5">
                    <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full" style={{ background: TONE_CLASS[p.pillTone === "critical" ? "caution" : p.pillTone]?.bg ?? "var(--color-surface-sunken)", color: p.pillTone === "critical" ? "var(--color-critical)" : p.pillTone === "caution" ? "var(--color-caution)" : "var(--color-good)" }}>
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d={p.icon} /></svg>
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[13px] font-semibold text-[var(--color-text-primary)]">{p.title}</p>
                      <p className="truncate text-[11px] text-[var(--color-text-faint)]">{p.detail}</p>
                    </div>
                    <span
                      className="shrink-0 rounded-full px-2.5 py-1 text-[10.5px] font-bold"
                      style={{
                        background: p.pillTone === "critical" ? "var(--color-critical-soft)" : p.pillTone === "caution" ? "var(--color-caution-soft)" : "var(--color-good-soft)",
                        color: p.pillTone === "critical" ? "var(--color-critical)" : p.pillTone === "caution" ? "var(--color-caution)" : "var(--color-good)",
                      }}
                    >
                      {p.pill}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="mt-4 flex items-center justify-between border-t border-[var(--color-border-soft)] pt-4">
            <Link
              href="/analytics"
              className="inline-flex items-center gap-1.5 rounded-lg border px-3.5 py-1.5 text-[12px] font-bold transition-colors"
              style={{ borderColor: "var(--color-accent)", color: "var(--color-accent)" }}
            >
              View Full Brief
              <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.6}><path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" /></svg>
            </Link>
            <p className="flex items-center gap-1 text-[11px] text-[var(--color-text-faint)]">
              <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><circle cx="12" cy="12" r="9" /><path strokeLinecap="round" d="M12 7v5l3 3" /></svg>
              Refreshes hourly
            </p>
          </div>
        </div>

        <div className="card min-w-0 p-5">
          <div className="flex items-center justify-between">
            <p className="flex items-center gap-1.5 text-[15px] font-bold text-[var(--color-text-primary)]">
              <span className="h-2 w-2 rounded-full" style={{ background: "var(--color-good)" }} />
              Live Intelligence
            </p>
            <Link href="/market" className="text-[11px] font-semibold text-[var(--color-accent)]">View all insights →</Link>
          </div>
          <p className="mt-0.5 text-[11.5px] text-[var(--color-text-faint)]">Real-time insights that matter</p>

          <div className="mt-3 space-y-2.5">
            {marketPulse?.weather && (
              <LiveIntelRow
                hue="#38bdf8" icon="M17.5 19H6a4 4 0 01-1-7.87A5.5 5.5 0 0116 8.5a4.5 4.5 0 011.5 10.5z"
                title="Weather"
                headline={marketPulse.weather.condition === "clear" ? "No operational impact today" : marketPulse.weather.signal}
                detail={`${marketPulse.weather.avg_temp_celsius != null ? Math.round(marketPulse.weather.avg_temp_celsius) + "°C" : "--"} · ${CONDITION_LABELS[marketPulse.weather.condition] ?? marketPulse.weather.condition}${marketPulse.weather.avg_precipitation_pct != null ? ` · ${Math.round(marketPulse.weather.avg_precipitation_pct)}% chance of rain` : ""}`}
                pill={marketPulse.weather.condition === "clear" ? "Good" : "Caution"}
                pillTone={marketPulse.weather.condition === "clear" ? "good" : "caution"}
                headlineTone={marketPulse.weather.condition === "clear" ? "good" : "caution"}
              />
            )}
            {marketPulse?.area_occupancy?.signal && (
              <LiveIntelRow
                hue="#fc8019" icon="M13 10V3L4 14h7v7l9-11h-7z"
                title="Demand Pulse (Swiggy)"
                headline={`${marketPulse.area_occupancy.signal[0]}${marketPulse.area_occupancy.signal.slice(1).toLowerCase()} dinner demand expected`}
                detail={`on Swiggy · ${marketPulse.area_occupancy.competitors_checked} nearby kitchens tracked`}
                pill={marketPulse.area_occupancy.signal[0] + marketPulse.area_occupancy.signal.slice(1).toLowerCase()}
                pillTone={marketPulse.area_occupancy.signal === "HIGH" ? "caution" : "good"}
                headlineTone={marketPulse.area_occupancy.signal === "HIGH" ? "caution" : "good"}
              />
            )}
            {marketPulse?.industry_trends && marketPulse.industry_trends.headline_count > 0 && (
              <LiveIntelRow
                hue="#818cf8" icon="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
                title="Market Watch"
                headline={firstDigestSnippet(marketPulse.industry_trends.digest)}
                detail={`${marketPulse.industry_trends.headline_count} headlines · ${marketPulse.industry_trends.sources_used} sources tracked`}
                pill="Watch"
                pillTone="swiggy"
                headlineTone="swiggy"
              />
            )}
            <LiveIntelRow
              hue="#34d399" icon="M12 3l7 4v5c0 5-3.5 8-7 9-3.5-1-7-4-7-9V7l7-4z"
              title="Regulatory Updates"
              headline={marketPulse?.compliance_alerts?.notice_count ? `${marketPulse.compliance_alerts.notice_count} new FSSAI notice${marketPulse.compliance_alerts.notice_count !== 1 ? "s" : ""} published` : "No action required"}
              detail={marketPulse?.compliance_alerts?.notices[0]?.title ?? "No critical notices right now"}
              pill={marketPulse?.compliance_alerts?.notice_count ? "Review" : "Clear"}
              pillTone={marketPulse?.compliance_alerts?.notice_count ? "caution" : "good"}
              headlineTone={marketPulse?.compliance_alerts?.notice_count ? "caution" : "good"}
            />
            {marketPulse?.upcoming_holiday && (
              <LiveIntelRow
                hue="#efa345" icon="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                title="Holiday Watch"
                headline={marketPulse.upcoming_holiday.days_away === 0 ? `${marketPulse.upcoming_holiday.name} — today` : `No holiday today`}
                detail={marketPulse.upcoming_holiday.days_away === 0 ? "Expect holiday demand patterns" : `Next: ${marketPulse.upcoming_holiday.name} · ${shortDate(marketPulse.upcoming_holiday.date)}`}
                pill={marketPulse.upcoming_holiday.days_away === 0 ? "Today" : "Upcoming"}
                pillTone={marketPulse.upcoming_holiday.days_away === 0 ? "caution" : "good"}
                headlineTone={marketPulse.upcoming_holiday.days_away === 0 ? "caution" : "good"}
              />
            )}
          </div>
          {!marketLoaded && <p className="mt-3 text-[11px] text-[var(--color-text-faint)]">Checking live signals…</p>}
        </div>
      </div>

      {/* ═══ ZONE 4 — Trend + what fed it ═══ */}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3 items-stretch">
        <div className="card p-6">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[15px] font-bold text-[var(--color-text-primary)]">Overall Performance</p>
              <p className="mt-0.5 text-[11.5px] text-[var(--color-text-faint)]">Revenue, profit &amp; orders</p>
            </div>
            <div className="flex shrink-0 items-center gap-1 rounded-lg bg-[var(--color-surface-sunken)] p-1">
              {[7, 14, 30].map((d) => (
                <button
                  key={d}
                  onClick={() => setPerfDays(d)}
                  className="rounded-md px-2.5 py-1 text-[10.5px] font-semibold transition-colors"
                  style={perfDays === d ? { background: "var(--color-surface-raised)", color: "var(--color-accent)" } : { color: "var(--color-text-faint)" }}
                >
                  {d}d
                </button>
              ))}
            </div>
          </div>

          {revenueTrend.length >= 2 ? (
            <div style={{ height: 220 }} className="mt-4">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={revenueTrend} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="revenueFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#efa345" stopOpacity={0.32} />
                      <stop offset="100%" stopColor="#efa345" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="profitFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#34d399" stopOpacity={0.22} />
                      <stop offset="100%" stopColor="#34d399" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border-soft)" vertical={false} />
                  <XAxis dataKey="date" tickFormatter={(d: string) => shortDate(d)} tick={{ fontSize: 9, fill: "#6b7280", fontFamily: "Space Mono" }} axisLine={false} tickLine={false} />
                  <YAxis yAxisId="money" tick={{ fontSize: 9, fill: "#6b7280", fontFamily: "Space Mono" }} axisLine={false} tickLine={false} tickFormatter={(v: number) => `₹${Math.round(v / 1000)}k`} />
                  <YAxis yAxisId="orders" orientation="right" tick={{ fontSize: 9, fill: "#6b7280", fontFamily: "Space Mono" }} axisLine={false} tickLine={false} />
                  <Tooltip
                    labelFormatter={(d) => shortDate(d as string)}
                    formatter={(value, name) => [name === "Orders" ? `${value}` : `₹${Number(value).toLocaleString("en-IN")}`, String(name)]}
                    contentStyle={{ background: "var(--color-surface-raised)", border: "1px solid var(--color-border-default)", borderRadius: 8, fontSize: 12 }}
                  />
                  <Area yAxisId="money" type="monotone" dataKey="revenue" name="Revenue" stroke="#efa345" strokeWidth={2.5} fill="url(#revenueFill)" dot={false} activeDot={{ r: 4 }} />
                  <Area yAxisId="money" type="monotone" dataKey="profit" name="Profit" stroke="#34d399" strokeWidth={2} fill="url(#profitFill)" dot={false} activeDot={{ r: 4 }} />
                  <Line yAxisId="orders" type="monotone" dataKey="orders" name="Orders" stroke="#38bdf8" strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="mt-4 flex h-[180px] items-center justify-center rounded-xl border border-dashed border-[var(--color-border-default)] text-center">
              <p className="max-w-xs text-xs text-[var(--color-text-faint)]">{loaded ? "Not enough order history yet to show a trend." : "Loading…"}</p>
            </div>
          )}

          <div className="mt-3 flex items-center gap-5 text-[11px] text-[var(--color-text-faint)]">
            <span className="flex items-center gap-1.5"><i className="h-2 w-2 rounded-sm" style={{ background: "#efa345" }} />Revenue</span>
            <span className="flex items-center gap-1.5"><i className="h-2 w-2 rounded-sm" style={{ background: "#34d399" }} />Profit</span>
            <span className="flex items-center gap-1.5"><i className="h-2 w-2 rounded-sm" style={{ background: "#38bdf8" }} />Orders</span>
          </div>
        </div>

        <div className="card p-6">
          <p className="text-[15px] font-bold text-[var(--color-text-primary)]">Profit Margin</p>
          <p className="mt-0.5 text-[11.5px] text-[var(--color-text-faint)]">Gross margin %, by day -- how much of each day&apos;s revenue is actually profit</p>
          {marginTrend.length >= 2 ? (
            <div style={{ height: 240 }} className="mt-4">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={marginTrend} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                  <defs>
                    <linearGradient id="marginFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#0E9F6E" stopOpacity={0.3} />
                      <stop offset="100%" stopColor="#0E9F6E" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border-soft)" vertical={false} />
                  <XAxis dataKey="date" tickFormatter={(d: string) => shortDate(d)} tick={{ fontSize: 9, fill: "#6b7280", fontFamily: "Space Mono" }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 9, fill: "#6b7280", fontFamily: "Space Mono" }} axisLine={false} tickLine={false} tickFormatter={(v: number) => `${v}%`} />
                  <Tooltip
                    labelFormatter={(d) => shortDate(d as string)}
                    formatter={(value) => [`${value}%`, "Gross margin"]}
                    contentStyle={{ background: "var(--color-surface-raised)", border: "1px solid var(--color-border-default)", borderRadius: 8, fontSize: 12 }}
                  />
                  <Area type="monotone" dataKey="margin_pct" name="Gross margin" stroke="#0E9F6E" strokeWidth={2.5} fill="url(#marginFill)" dot={false} activeDot={{ r: 4 }} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="mt-4 flex h-[200px] items-center justify-center rounded-xl border border-dashed border-[var(--color-border-default)] text-center">
              <p className="max-w-xs text-xs text-[var(--color-text-faint)]">{loaded ? "Not enough order history yet to show a trend." : "Loading…"}</p>
            </div>
          )}
        </div>

        <div className="card p-6">
          <p className="text-[15px] font-bold text-[var(--color-text-primary)]">Top Dishes by Revenue</p>
          <p className="mt-0.5 text-[11.5px] text-[var(--color-text-faint)]">Last {revenueTrend.length || perfDays} days -- what to push tonight</p>
          {topDishes.length > 0 ? (
            <div style={{ height: 240 }} className="mt-4">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={topDishes.slice(0, 6)} layout="vertical" margin={{ top: 4, right: 12, left: 0, bottom: 0 }}>
                  <XAxis type="number" hide />
                  <YAxis type="category" dataKey="name" width={110} tick={{ fontSize: 10.5, fill: "#6b7280" }} axisLine={false} tickLine={false} />
                  <Tooltip
                    formatter={(v) => `₹${Number(v).toLocaleString("en-IN")}`}
                    contentStyle={{ background: "var(--color-surface-raised)", border: "1px solid var(--color-border-default)", borderRadius: 8, fontSize: 12 }}
                  />
                  <Bar dataKey="revenue" name="Revenue" fill="var(--color-accent)" radius={[0, 4, 4, 0]} barSize={16} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="mt-4 flex h-[200px] items-center justify-center rounded-xl border border-dashed border-[var(--color-border-default)] text-center">
              <p className="max-w-xs text-xs text-[var(--color-text-faint)]">{loaded ? "Not enough order history yet." : "Loading…"}</p>
            </div>
          )}
        </div>
      </div>

      {/* ═══ What to do about it: Signals / Upcoming Risks / Action Queue / Latest Run ═══ */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4 items-stretch">
        <div className="card p-5">
          <div className="flex items-center justify-between">
            {/* Rule-based (revenueDelta/complaint/inventory/etc. thresholds), not
                LLM-generated -- unlike the hero's AI Executive Summary. Named
                "Signals" rather than "AI Insights" so that distinction is honest. */}
            <p className="flex items-center gap-1.5 text-[12.5px] font-bold text-[var(--color-text-primary)]">
              <svg className="h-3.5 w-3.5" fill="var(--color-accent)" viewBox="0 0 24 24"><path d="M12 2l1.5 5.5L19 9l-5.5 1.5L12 16l-1.5-5.5L5 9l5.5-1.5z" /></svg>
              Signals
            </p>
            <Link href="/analytics" className="text-[10.5px] font-semibold text-[var(--color-accent)]">View All →</Link>
          </div>
          <div className="mt-2.5">
            {insights.length > 0 ? insights.slice(0, 5).map((item, i) => (
              <div key={i} className="flex items-start gap-2.5 border-t border-[var(--color-border-soft)] py-2 first:border-t-0 first:pt-0">
                <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full" style={{ background: TONE_CLASS[item.tone]?.bg ?? "var(--color-surface-sunken)", color: TONE_CLASS[item.tone]?.text ?? "var(--color-text-faint)" }}>
                  <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                </span>
                <p className="text-[11.5px] leading-relaxed text-[var(--color-text-soft)] [&_b]:font-bold [&_b]:text-[var(--color-text-primary)]">{item.text}</p>
              </div>
            )) : (
              <p className="py-3 text-[11px] text-[var(--color-text-faint)]">{loaded ? "Nothing to flag right now." : "Loading…"}</p>
            )}
          </div>
        </div>

        <div className="card p-5">
          <div className="flex items-center justify-between">
            <p className="flex items-center gap-1.5 text-[12.5px] font-bold text-[var(--color-text-primary)]">
              <svg className="h-3.5 w-3.5" fill="var(--color-caution)" viewBox="0 0 24 24"><path d="M12 2L1 21h22L12 2zm0 6v6m0 3h.01" stroke="var(--color-surface)" strokeWidth={1.5} /></svg>
              Upcoming Risks
            </p>
            <Link href="/data" className="text-[10.5px] font-semibold text-[var(--color-accent)]">View All →</Link>
          </div>
          <div className="mt-2.5">
            {risks.length > 0 ? risks.slice(0, 4).map((r, i) => (
              <div key={i} className="flex items-start gap-2.5 border-t border-[var(--color-border-soft)] py-2 first:border-t-0 first:pt-0">
                <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full" style={{ background: "var(--color-caution-soft)", color: "var(--color-caution)" }}>
                  <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" /></svg>
                </span>
                <p className="text-[11.5px] leading-relaxed text-[var(--color-text-soft)]">{r.text}</p>
              </div>
            )) : (
              <p className="py-3 text-[11px] text-[var(--color-text-faint)]">{loaded ? "Nothing on the horizon." : "Loading…"}</p>
            )}
          </div>
        </div>

        <div className="card p-5">
          <div className="flex items-center justify-between">
            <p className="flex items-center gap-1.5 text-[12.5px] font-bold text-[var(--color-text-primary)]">
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="#38bdf8" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>
              Action Queue
            </p>
            <Link href="/action-center" className="text-[10.5px] font-semibold text-[var(--color-accent)]">View All →</Link>
          </div>
          <div className="mt-2.5">
            {pendingActions.length > 0 ? pendingActions.slice(0, 3).map((a) => (
              <div key={a.id} className="flex items-center gap-2.5 border-t border-[var(--color-border-soft)] py-2 first:border-t-0 first:pt-0">
                <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full" style={{ background: "rgba(56,189,248,0.12)", color: "#38bdf8" }}>
                  <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2" /></svg>
                </span>
                <p className="min-w-0 flex-1 truncate text-[11.5px] text-[var(--color-text-soft)]">{a.title}</p>
                <span className="shrink-0 rounded-full px-1.5 py-0.5 text-[9px] font-bold uppercase" style={{ background: a.tier === "approve_required" ? "var(--color-caution-soft)" : "var(--color-surface-sunken)", color: a.tier === "approve_required" ? "var(--color-caution)" : "var(--color-text-faint)" }}>
                  {a.tier === "approve_required" ? "needs approval" : a.tier === "auto" ? "auto" : "recommendation"}
                </span>
              </div>
            )) : (
              <p className="py-3 text-[11px] text-[var(--color-text-faint)]">Nothing waiting for approval.</p>
            )}
          </div>
        </div>

        <div className="card p-5">
          <div className="flex items-center justify-between">
            <p className="flex items-center gap-1.5 text-[12.5px] font-bold text-[var(--color-text-primary)]">
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="var(--color-accent)" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" /></svg>
              Latest Planning Run
            </p>
            {latestRun && (VERDICT_TONE[latestRun.critic_verdict ?? "unknown"] ?? VERDICT_TONE.unknown) && (
              <span className="rounded-full px-2 py-0.5 text-[10px] font-bold uppercase" style={{ background: (VERDICT_TONE[latestRun.critic_verdict ?? "unknown"] ?? VERDICT_TONE.unknown).bg, color: (VERDICT_TONE[latestRun.critic_verdict ?? "unknown"] ?? VERDICT_TONE.unknown).text }}>
                {(VERDICT_TONE[latestRun.critic_verdict ?? "unknown"] ?? VERDICT_TONE.unknown).label}
              </span>
            )}
          </div>
          {latestRun ? (
            <div className="mt-2.5">
              <p className="text-[11.5px] text-[var(--color-text-soft)]">
                {SCENARIO_OPTIONS.find((s) => s.id === latestRun.scenario)?.label ?? latestRun.scenario}
                {latestRun.target_date ? ` · ${shortDate(latestRun.target_date)}` : ""} · generated {relativeTime(latestRun.generated_at ?? latestRun.created_at)}
              </p>
              <div className="mt-2.5 grid grid-cols-2 gap-2">
                <div className="rounded-lg bg-[var(--color-surface-sunken)] px-2.5 py-2">
                  <p className="text-[9.5px] uppercase tracking-wide text-[var(--color-text-faint)]">Health Score</p>
                  <p className="mt-0.5 text-[15px] font-bold text-[var(--color-text-primary)]">{loaded ? `${healthScore}/100` : "--"}</p>
                </div>
                <div className="rounded-lg bg-[var(--color-surface-sunken)] px-2.5 py-2">
                  <p className="text-[9.5px] uppercase tracking-wide text-[var(--color-text-faint)]">Confidence</p>
                  <p className="mt-0.5 text-[15px] font-bold text-[var(--color-text-primary)]">{latestRun.critic_score != null ? `${latestRun.critic_score}%` : "--"}</p>
                </div>
              </div>
              <Link href={`/planning?run=${latestRun.id}`} className="mt-2.5 inline-flex items-center gap-1 text-[11.5px] font-semibold text-[var(--color-accent)]">
                View Full Plan
                <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
              </Link>
            </div>
          ) : (
            <p className="mt-2.5 text-[11px] text-[var(--color-text-faint)]">{latestRunLoaded ? "No planning runs yet." : "Loading…"}</p>
          )}
        </div>
      </div>

      {/* ═══ One tap to act: quick-action band ═══ */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <button
          onClick={() => setShowPlanModal(true)}
          className="card flex items-center gap-3 p-4 text-left transition-transform hover:scale-[1.01]"
        >
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg" style={{ background: "var(--color-accent-soft)", color: "var(--color-accent)" }}>
            <svg className="h-4.5 w-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
          </span>
          <div className="min-w-0">
            <p className="text-[13px] font-bold text-[var(--color-text-primary)]">Run New Planning</p>
            <p className="text-[11px] text-[var(--color-text-faint)]">Generate today&apos;s AI operational plan</p>
          </div>
          <svg className="ml-auto h-4 w-4 shrink-0 text-[var(--color-text-ghost)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
        </button>
        <Link href="/action-center" className="card flex items-center gap-3 p-4 transition-transform hover:scale-[1.01]">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg" style={{ background: "rgba(56,189,248,0.12)", color: "#38bdf8" }}>
            <svg className="h-4.5 w-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" /></svg>
          </span>
          <div className="min-w-0">
            <p className="text-[13px] font-bold text-[var(--color-text-primary)]">Go to Action Center</p>
            <p className="text-[11px] text-[var(--color-text-faint)]">Review and approve pending actions</p>
          </div>
          <svg className="ml-auto h-4 w-4 shrink-0 text-[var(--color-text-ghost)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
        </Link>
        <Link href="/chat" className="card flex items-center gap-3 p-4 transition-transform hover:scale-[1.01]">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg" style={{ background: "rgba(52,211,153,0.12)", color: "#34d399" }}>
            <svg className="h-4.5 w-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>
          </span>
          <div className="min-w-0">
            <p className="text-[13px] font-bold text-[var(--color-text-primary)]">Ask AI Assistant</p>
            <p className="text-[11px] text-[var(--color-text-faint)]">Get insights from your data</p>
          </div>
          <svg className="ml-auto h-4 w-4 shrink-0 text-[var(--color-text-ghost)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
        </Link>
      </div>

      {historyCount > 0 && (
        <button onClick={onShowHistory} className="flex items-center gap-1.5 text-[11px] text-[var(--color-text-faint)] transition-colors hover:text-[var(--color-text-primary)]">
          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          {historyCount} previous run{historyCount !== 1 ? "s" : ""}
        </button>
      )}
      <PlanShiftModal
        open={showPlanModal}
        onClose={() => setShowPlanModal(false)}
        onRun={onRun}
        scenarioOptions={SCENARIO_OPTIONS}
        selectedScenario={selectedScenario}
        onScenarioChange={onScenarioChange}
        scenario={scenario}
        profiles={profiles}
        selectedProfileId={selectedProfileId}
        onSelectProfile={setSelectedProfileId}
        activeProfile={activeProfile}
        marketPulse={marketPulse}
        marketLoaded={marketLoaded}
      />
    </div>
  );
}

function MiniKpi({ label, value, delta, tone, icon, hue, hero }: {
  label: string; value: string; delta?: string; tone?: "caution" | "good"; icon: string; hue: string; hero?: boolean;
}) {
  const deltaColor = tone === "caution" ? "var(--color-caution)" : tone === "good" ? "var(--color-good)" : "var(--color-text-faint)";
  return (
    <div className={`card p-4 ${hero ? "ring-1 ring-[var(--color-accent)]/25" : ""}`}>
      <div className="flex items-center gap-2">
        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg" style={{ background: hue, color: "#fff" }}>
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d={icon} />
          </svg>
        </span>
        <p className="min-w-0 truncate text-[11.5px] font-medium text-[var(--color-text-faint)]">{label}</p>
      </div>
      <p
        className={`mt-2 font-bold leading-none ${hero ? "text-[30px]" : "text-[22px] text-[var(--color-text-primary)]"}`}
        style={hero ? { color: "var(--color-accent)" } : undefined}
      >
        {value}
      </p>
      {delta && <p className="mt-1.5 text-[11px] font-semibold" style={{ color: deltaColor }}>{delta}</p>}
    </div>
  );
}

function LiveIntelRow({ hue, icon, title, headline, detail, pill, pillTone, headlineTone }: {
  hue: string; icon: string; title: string; headline: string; detail: string; pill: string;
  pillTone: "good" | "caution" | "swiggy"; headlineTone: "good" | "caution" | "swiggy";
}) {
  const pillColors = TONE_CLASS[pillTone] ?? TONE_CLASS.good;
  const headlineColor = TONE_CLASS[headlineTone]?.text ?? "var(--color-text-primary)";
  return (
    <div className="flex items-center gap-3 rounded-xl border border-[var(--color-border-soft)] p-3">
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full" style={{ background: `${hue}1a`, color: hue }}>
        <svg className="h-4.5 w-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d={icon} />
        </svg>
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[10.5px] font-semibold uppercase tracking-[0.1em] text-[var(--color-text-faint)]">{title}</p>
        <p className="mt-0.5 truncate text-[13px] font-bold" style={{ color: headlineColor }}>{headline}</p>
        <p className="mt-0.5 truncate text-[11px] text-[var(--color-text-faint)]">{detail}</p>
      </div>
      <span className="shrink-0 rounded-full px-2.5 py-1 text-[10.5px] font-bold" style={{ background: pillColors.bg, color: pillColors.text }}>
        {pill}
      </span>
    </div>
  );
}
