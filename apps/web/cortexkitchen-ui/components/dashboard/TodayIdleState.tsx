"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ComposedChart, Area, Line, BarChart, Bar,
  PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import { useAuth } from "@/context/AuthContext";
import PlanShiftModal from "@/components/dashboard/PlanShiftModal";
import {
  getDataHealth, getConnectorsStatus, getMarketPulse, getBusinessPerformance,
  listRestaurantProfiles,
  BusinessPerformanceResponse, ConnectorStatus, MarketPulseResponse, RestaurantProfile,
} from "@/lib/api";
import { DataHealth, PlanningScenarioOption } from "@/types/planning";

const SCENARIO_OPTIONS: PlanningScenarioOption[] = [
  {
    id: "friday_rush",
    label: "Friday Rush",
    description: "High-demand dinner rush with table-turn pressure and stock protection.",
    default_weekday: 4,
    service_window: "18:00-22:00",
    operational_focus: "Peak dinner demand and rush execution.",
  },
  {
    id: "weekday_lunch",
    label: "Weekday Lunch",
    description: "Lean midday service focused on pacing, efficiency, and cleaner prep burden.",
    default_weekday: 2,
    service_window: "12:00-15:00",
    operational_focus: "Lunch pacing and staffing efficiency.",
  },
  {
    id: "holiday_spike",
    label: "Holiday Spike",
    description: "Demand-surge planning for unusually heavy service conditions.",
    default_weekday: 5,
    service_window: "17:00-22:00",
    operational_focus: "Queue protection, surge readiness, and quality retention.",
  },
  {
    id: "low_stock_weekend",
    label: "Low-Stock Weekend",
    description: "Weekend planning with tighter ingredient constraints and stricter prioritization.",
    default_weekday: 6,
    service_window: "18:00-22:00",
    operational_focus: "Shortage prioritization and menu restraint.",
  },
];

const AGENT_PIPELINE = [
  {
    label: "Demand Forecast",
    capability: "Predicts how many covers to expect and how tonight compares to the same day last week.",
    iconPath: "M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z",
    tone: "good",
  },
  {
    label: "Reservation Pressure",
    capability: "Reads your live booking list and shows when you're likely to hit capacity.",
    iconPath: "M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z",
    tone: "info",
  },
  {
    label: "Guest Feedback",
    capability: "Scans customer feedback for recurring complaints and surfaces fixes for tonight.",
    iconPath: "M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z",
    tone: "rose",
  },
  {
    label: "Inventory",
    capability: "Flags what's running low or overstocked, with exact reorder quantities.",
    iconPath: "M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4",
    tone: "caution",
  },
  {
    label: "Menu Direction",
    capability: "Only recommends dishes that are actually in stock — runs after inventory.",
    iconPath: "M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4",
    tone: "good",
  },
  {
    label: "Critic",
    capability: "Scores every plan across safety, feasibility, evidence, and clarity before it reaches you.",
    iconPath: "M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z",
    tone: "good",
  },
] as const;

const TONE_CLASS: Record<string, { bg: string; text: string }> = {
  good:    { bg: "var(--color-good-soft)",    text: "var(--color-good)" },
  info:    { bg: "rgba(56,189,248,0.10)",     text: "#38bdf8" },
  rose:    { bg: "rgba(251,113,133,0.10)",    text: "#fb7185" },
  caution: { bg: "var(--color-caution-soft)", text: "var(--color-caution)" },
  swiggy:  { bg: "rgba(252,128,25,0.12)",      text: "#fc8019" },
};

function shortDate(iso: string | null | undefined): string {
  if (!iso) return "--";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return String(iso).slice(0, 10);
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

function daypartLine(): string {
  const h = new Date().getHours();
  if (h < 11)  return "Prep is underway ahead of lunch service.";
  if (h < 15)  return "Lunch service is live right now.";
  if (h < 18)  return "Lunch has wrapped — dinner prep is ramping up.";
  if (h < 22)  return "Dinner service is live right now.";
  return "Service has wrapped for the day — good time to review tonight's numbers.";
}

interface Props {
  onRun: (date?: string, restaurantName?: string, restaurantId?: number) => void;
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
  const [loaded, setLoaded]             = useState(false);
  const [marketLoaded, setMarketLoaded] = useState(false);
  const [showPlanModal, setShowPlanModal] = useState(false);

  useEffect(() => {
    listRestaurantProfiles()
      .then((list) => { setProfiles(list); if (list.length > 0) setSelectedProfileId(list[0].id); })
      .catch(() => { /* optional context */ });
  }, []);

  // Fast, DB-only calls -- resolve in well under a second, drive the main "loaded" state.
  useEffect(() => {
    let cancelled = false;
    async function load() {
      const [health, connectors, perf] = await Promise.all([
        getDataHealth().catch(() => null),
        getConnectorsStatus().catch(() => null),
        getBusinessPerformance(14).catch(() => null),
      ]);
      if (cancelled) return;
      setDataHealth(health);
      setConnector(connectors?.connectors.find((c) => c.type === "swiggy") ?? null);
      setBusinessPerf(perf);
      setLoaded(true);
    }
    load();
    return () => { cancelled = true; };
  }, []);

  // Market pulse hits live Swiggy MCP tools directly -- on a cold cache this can take
  // several seconds (real external calls). Kept in its own effect/loading flag so a
  // slow Swiggy response never blocks the rest of the page (ops/business KPIs, charts)
  // from rendering as soon as they're ready.
  useEffect(() => {
    let cancelled = false;
    getMarketPulse()
      .then((pulse) => { if (!cancelled) setMarketPulse(pulse); })
      .catch(() => { if (!cancelled) setMarketPulse(null); })
      .finally(() => { if (!cancelled) setMarketLoaded(true); });
    return () => { cancelled = true; };
  }, []);

  const activeProfile = profiles.find((p) => p.id === selectedProfileId) ?? profiles[0] ?? null;

  const today = new Date();

  const coverage = dataHealth?.scenario_coverage.find((s) => s.scenario === selectedScenario) ?? null;
  const criticalShortages = dataHealth?.inventory.critical_shortages ?? 0;
  const shortageAlerts    = dataHealth?.inventory.shortage_alerts ?? 0;
  const feedback = dataHealth?.feedback ?? null;
  const positivePct = feedback && feedback.count > 0 ? Math.round((feedback.positive / feedback.count) * 100) : null;

  const occupancy = marketPulse?.area_occupancy ?? null;
  const pricingAlerts = marketPulse?.competitor_pricing?.comparisons ?? [];
  const abovePricingCount = pricingAlerts.filter((a) => a.direction === "above").length;
  const procurement = marketPulse?.procurement ?? [];
  const cheapestProcurement = procurement.length > 0
    ? [...procurement].filter((p) => p.in_stock).sort((a, b) => a.price - b.price)[0] ?? procurement[0]
    : null;

  const swiggyEmptyMeta = !marketLoaded ? "checking Swiggy…" : marketPulse?.swiggy_connected === false ? "connect Swiggy to see this" : "no data available";

  const yesterday = businessPerf?.yesterday ?? null;
  const revenueTrend = businessPerf?.trend ?? [];
  const dineInShare = yesterday && (yesterday.revenue > 0)
    ? Math.round((businessPerf!.channel_split.dine_in_revenue / yesterday.revenue) * 100)
    : null;
  const topDishes = businessPerf?.top_dishes ?? [];
  const bottomDishes = businessPerf?.bottom_dishes ?? [];
  const complaintCategories = businessPerf?.complaints_by_category ?? [];
  const complaintMax = Math.max(1, ...complaintCategories.map((c) => c.count));
  const revenueDelta = useMemo(() => {
    if (revenueTrend.length < 2) return null;
    const last = revenueTrend[revenueTrend.length - 2]; // yesterday (last complete day)
    const prior = revenueTrend[revenueTrend.length - 9]; // same weekday, one week earlier
    if (!last || !prior || !prior.revenue) return null;
    return Math.round(((last.revenue - prior.revenue) / prior.revenue) * 100);
  }, [revenueTrend]);

  const aovSparkline = useMemo(() => revenueTrend.map((d) => (d.orders > 0 ? d.revenue / d.orders : 0)), [revenueTrend]);

  const channelSplit = businessPerf?.channel_split ?? null;
  const channelData = channelSplit && (channelSplit.dine_in_revenue + channelSplit.delivery_revenue) > 0 ? [
    { name: "Dine-in", value: channelSplit.dine_in_revenue, color: "#efa345" },
    { name: "Delivery", value: channelSplit.delivery_revenue, color: "#38bdf8" },
  ] : [];

  const sentimentData = feedback && feedback.count > 0 ? [
    { name: "Positive", value: feedback.positive, color: "#34d399" },
    { name: "Neutral",  value: feedback.neutral,  color: "#7B7F92" },
    { name: "Negative", value: feedback.negative, color: "#fb7185" },
  ] : [];

  const peakHours = businessPerf?.peak_hours ?? [];
  const peakHoursDisplay = useMemo(() =>
    peakHours
      .filter((h) => h.hour >= 11 && h.hour <= 23)
      .map((h) => ({
        hour: h.hour,
        avg_orders: h.avg_orders,
        label: h.hour === 12 ? "12p" : h.hour > 12 ? `${h.hour - 12}p` : `${h.hour}a`,
      })),
    [peakHours]);
  const peakHourMax = Math.max(0, ...peakHoursDisplay.map((h) => h.avg_orders));

  const inventoryTotal = dataHealth?.inventory.items ?? 0;
  const overstockAlerts = dataHealth?.inventory.overstock_alerts ?? 0;
  const warningShortages = Math.max(0, shortageAlerts - criticalShortages);
  const healthyItems = Math.max(0, inventoryTotal - shortageAlerts - overstockAlerts);
  const reservationGaugePct = coverage ? Math.min(100, Math.round(coverage.occupancy_pct)) : null;

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

  return (
    <div className="py-6 space-y-5">

      {/* Greeting row */}
      <div>
        <p className="text-[10.5px] font-semibold uppercase tracking-[0.16em] text-[var(--color-text-faint)]">
          {today.toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long" })}
        </p>
        <h1 className="display mt-1 text-[32px] leading-tight text-[var(--color-text-primary)]">
          Welcome back, <span className="display-it text-[var(--color-accent)]">{user?.full_name?.split(" ")[0] ?? "there"}.</span>
        </h1>
        <p className="mt-1 text-sm text-[var(--color-text-soft)]">{daypartLine()}</p>
      </div>

      {/* HERO: Plan your next shift — bold banner, first thing after the greeting */}
      <div className="relative overflow-hidden rounded-2xl p-5 sm:p-6" style={{ background: "linear-gradient(120deg, #d9791f 0%, #b0621a 55%, #8a4a10 100%)" }}>
        <div className="pointer-events-none absolute inset-0 opacity-40" style={{ background: "radial-gradient(480px 200px at 100% -30%, rgba(255,255,255,0.35), transparent 65%)" }} />
        <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-white/15 ring-1 ring-white/25">
              <svg className="h-5 w-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
            </div>
            <div>
              <p className="text-[15px] font-bold text-white">Ready when you are</p>
              <p className="mt-0.5 text-[12.5px] text-white/75">5 specialists check your kitchen and the market, then a critic reviews the result — about 45 seconds.</p>
              <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11.5px] text-white/85">
                {coverage && <span>{coverage.reservations} reservations tonight</span>}
                {shortageAlerts > 0 && <span className="font-semibold text-white">{shortageAlerts} inventory alert{shortageAlerts !== 1 ? "s" : ""}</span>}
                {occupancy?.signal && <span>Area demand <b className="capitalize text-white">{occupancy.signal.toLowerCase()}</b></span>}
              </div>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-3">
            {historyCount > 0 && (
              <button onClick={onShowHistory} className="flex items-center gap-1.5 text-[11px] text-white/70 transition-colors hover:text-white">
                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                {historyCount} previous run{historyCount !== 1 ? "s" : ""}
              </button>
            )}
            <button
              onClick={() => setShowPlanModal(true)}
              className="inline-flex items-center gap-2 rounded-xl bg-white px-6 py-3 text-[15px] font-semibold text-[#8a4a10] shadow-[0_10px_24px_-6px_rgba(0,0,0,0.35)] transition-transform hover:scale-[1.02]"
            >
              <svg className="h-4.5 w-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.4}><path strokeLinecap="round" strokeLinejoin="round" d="M5 3l14 9-14 9V3z" /></svg>
              Plan your next shift
            </button>
          </div>
        </div>
      </div>

      {/* HERO: Overall performance + Peak hours, paired so neither sits alone in empty space */}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1.6fr_1fr] items-stretch">
        <div className="card p-6">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[15px] font-bold text-[var(--color-text-primary)]">Overall performance</p>
              <p className="mt-0.5 text-[11.5px] text-[var(--color-text-faint)]">Revenue, profit &amp; orders — last {revenueTrend.length || 14} days</p>
            </div>
            {yesterday?.margin_pct != null && (
              <span className="rounded-full px-2.5 py-1 text-[11px] font-semibold" style={{ background: "var(--color-good-soft)", color: "var(--color-good)" }}>{yesterday.margin_pct}% margin yesterday</span>
            )}
          </div>

          {revenueTrend.length >= 2 ? (
            <div style={{ height: 270 }} className="mt-4">
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
            <div className="mt-4 flex h-[200px] items-center justify-center rounded-xl border border-dashed border-[var(--color-border-default)] text-center">
              <p className="max-w-xs text-xs text-[var(--color-text-faint)]">{loaded ? "Not enough order history yet to show a trend." : "Loading…"}</p>
            </div>
          )}

          <div className="mt-3 flex items-center gap-5 text-[11px] text-[var(--color-text-faint)]">
            <span className="flex items-center gap-1.5"><i className="h-2 w-2 rounded-sm" style={{ background: "#efa345" }} />Revenue</span>
            <span className="flex items-center gap-1.5"><i className="h-2 w-2 rounded-sm" style={{ background: "#34d399" }} />Profit</span>
            <span className="flex items-center gap-1.5"><i className="h-2 w-2 rounded-sm" style={{ background: "#38bdf8" }} />Orders</span>
          </div>
        </div>

        <div className="card flex flex-col p-6">
          <p className="text-[15px] font-bold text-[var(--color-text-primary)]">Tonight at a glance</p>
          <p className="mt-0.5 text-[11.5px] text-[var(--color-text-faint)]">Reservations &amp; inventory, right now</p>

          <div className="mt-4 flex flex-1 flex-col justify-center gap-3">
            <div className="flex items-center justify-between gap-3 rounded-xl border border-[var(--color-border-default)] bg-[var(--color-surface-raised)] px-4 py-3.5">
              <div className="min-w-0">
                <p className="text-[10.5px] font-semibold text-[var(--color-text-faint)]">Reservations tonight</p>
                <p className="num-display mt-0.5 text-[26px] leading-none text-[var(--color-text-primary)]">{coverage ? coverage.reservations : "--"}</p>
              </div>
              <div className="shrink-0 text-right">
                <p className={`text-[12px] font-bold ${coverage && coverage.waitlist > 0 ? "text-[var(--color-caution)]" : "text-[var(--color-text-faint)]"}`}>{coverage ? `${coverage.waitlist} waitlist` : "--"}</p>
                <p className="mt-0.5 text-[11px] text-[var(--color-text-faint)]">{reservationGaugePct !== null ? `${reservationGaugePct}% capacity` : "no data yet"}</p>
              </div>
            </div>

            <div className="flex items-center justify-between gap-3 rounded-xl border border-[var(--color-border-default)] bg-[var(--color-surface-raised)] px-4 py-3.5">
              <div className="min-w-0">
                <p className="text-[10.5px] font-semibold text-[var(--color-text-faint)]">Inventory status</p>
                <p className="num-display mt-0.5 text-[26px] leading-none text-[var(--color-text-primary)]">
                  {inventoryTotal > 0 ? healthyItems : "--"}<span className="ml-1 font-sans text-[11px] font-semibold text-[var(--color-text-faint)]">/{inventoryTotal || "--"} healthy</span>
                </p>
              </div>
              <div className="shrink-0 text-right">
                <p className={`text-[12px] font-bold ${criticalShortages > 0 ? "text-[var(--color-caution)]" : "text-[var(--color-text-faint)]"}`}>{criticalShortages > 0 ? `${criticalShortages} critical` : "all stocked"}</p>
                {warningShortages > 0 && <p className="mt-0.5 text-[11px] text-[var(--color-text-faint)]">{warningShortages} running low</p>}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Yesterday's business — money KPIs + channel split */}
      <div>
        <p className="mb-2 text-[10.5px] font-bold uppercase tracking-[0.14em] text-[var(--color-text-faint)]">Yesterday&apos;s business</p>
        <div className="grid grid-cols-2 gap-3 xl:grid-cols-4 items-stretch">
          <KpiTile
            label="Revenue"
            value={yesterday ? `₹${yesterday.revenue.toLocaleString("en-IN")}` : "--"}
            meta={yesterday ? (revenueDelta !== null ? `${revenueDelta >= 0 ? "↑" : "↓"} ${Math.abs(revenueDelta)}% vs. last week` : `${yesterday.orders} orders`) : "no data yet"}
            metaTone={revenueDelta !== null && revenueDelta < 0 ? "warn" : undefined}
            icon="M12 8c-1.66 0-3 .9-3 2s1.34 2 3 2 3 .9 3 2-1.34 2-3 2m0-8V6m0 10v2m0-14a8 8 0 100 16 8 8 0 000-16z"
            lg
          />
          <KpiTile
            label="Profit & margin"
            value={yesterday ? `₹${yesterday.profit.toLocaleString("en-IN")}` : "--"}
            meta={yesterday?.margin_pct != null ? `${yesterday.margin_pct}% margin` : "no data yet"}
            icon="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
            lg
          />
          <KpiTile
            label="Avg order value"
            value={yesterday ? `₹${yesterday.avg_order_value.toLocaleString("en-IN")}` : "--"}
            meta={dineInShare !== null ? `${dineInShare}% dine-in revenue` : "no data yet"}
            icon="M3 10h18M7 15h1m4 0h1m-7 4h12a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
            sparkline={aovSparkline}
            sparklineColor="#38bdf8"
            lg
          />
          <div className="card p-5">
            <p className="text-[10.5px] font-semibold text-[var(--color-text-faint)]">Channel split</p>
            {channelData.length > 0 ? (
              <div className="mt-1 flex items-center gap-3">
                <div style={{ width: 64, height: 64 }} className="shrink-0">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={channelData} dataKey="value" nameKey="name" innerRadius={20} outerRadius={30} paddingAngle={2} stroke="none">
                        {channelData.map((d) => <Cell key={d.name} fill={d.color} />)}
                      </Pie>
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="min-w-0 space-y-1">
                  {channelData.map((d) => (
                    <div key={d.name} className="flex items-center gap-1.5 text-[11px]">
                      <span className="h-2 w-2 shrink-0 rounded-sm" style={{ background: d.color }} />
                      <span className="truncate text-[var(--color-text-soft)]">{d.name}</span>
                      <span className="mono ml-auto shrink-0 font-semibold text-[var(--color-text-primary)]">{Math.round((d.value / (channelData[0].value + channelData[1].value)) * 100)}%</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <p className="mt-3 text-[11px] text-[var(--color-text-faint)]">{loaded ? "No data yet" : "Loading…"}</p>
            )}
          </div>
        </div>
      </div>

      {/* Menu performance + smart insights */}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1.7fr_1fr] items-stretch">
        <div className="card p-6">
          <p className="text-[13.5px] font-bold text-[var(--color-text-primary)]">Menu performance</p>
          <p className="mt-0.5 text-[11.5px] text-[var(--color-text-faint)]">By revenue, last {revenueTrend.length || 14} days</p>

          {(topDishes.length > 0 || bottomDishes.length > 0) ? (
            <div className="mt-4 grid grid-cols-1 gap-5 sm:grid-cols-2">
              <div>
                <p className="mb-1 flex items-center gap-1.5 text-[11px] font-semibold text-[var(--color-good)]">
                  <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.4}><path strokeLinecap="round" strokeLinejoin="round" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" /></svg>
                  Top sellers
                </p>
                <div style={{ height: 150 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={topDishes.slice(0, 5)} layout="vertical" margin={{ top: 0, right: 12, left: 0, bottom: 0 }}>
                      <XAxis type="number" hide />
                      <YAxis type="category" dataKey="name" width={100} tick={{ fontSize: 10.5, fill: "#6b7280" }} axisLine={false} tickLine={false} />
                      <Tooltip formatter={(v) => `₹${Number(v).toLocaleString("en-IN")}`} contentStyle={{ background: "var(--color-surface-raised)", border: "1px solid var(--color-border-default)", borderRadius: 8, fontSize: 12 }} />
                      <Bar dataKey="revenue" fill="var(--color-good)" radius={[0, 4, 4, 0]} barSize={14} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
              <div>
                <p className="mb-1 flex items-center gap-1.5 text-[11px] font-semibold text-[var(--color-caution)]">
                  <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.4}><path strokeLinecap="round" strokeLinejoin="round" d="M13 17h8m0 0v-8m0 8l-8-8-4 4-6-6" /></svg>
                  Needs attention
                </p>
                <div style={{ height: 150 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={bottomDishes.slice(0, 5)} layout="vertical" margin={{ top: 0, right: 12, left: 0, bottom: 0 }}>
                      <XAxis type="number" hide />
                      <YAxis type="category" dataKey="name" width={100} tick={{ fontSize: 10.5, fill: "#6b7280" }} axisLine={false} tickLine={false} />
                      <Tooltip formatter={(v) => `₹${Number(v).toLocaleString("en-IN")}`} contentStyle={{ background: "var(--color-surface-raised)", border: "1px solid var(--color-border-default)", borderRadius: 8, fontSize: 12 }} />
                      <Bar dataKey="revenue" fill="var(--color-text-ghost)" radius={[0, 4, 4, 0]} barSize={14} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          ) : (
            <div className="mt-3 flex h-[160px] items-center justify-center rounded-xl border border-dashed border-[var(--color-border-default)] text-center">
              <p className="max-w-xs text-xs text-[var(--color-text-faint)]">{loaded ? "Not enough order history yet." : "Loading…"}</p>
            </div>
          )}
        </div>

        <div className="card p-6">
          <p className="text-[13.5px] font-bold text-[var(--color-text-primary)]">Smart insights</p>
          <p className="mt-0.5 text-[11.5px] text-[var(--color-text-faint)]">Your restaurant&apos;s current state, at a glance</p>
          <div className="mt-3">
            {insights.length > 0 ? insights.slice(0, 5).map((item, i) => (
              <div key={i} className={`flex items-start gap-2.5 py-2.5 ${i > 0 ? "border-t border-[var(--color-border-soft)]" : ""}`}>
                <span className="mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: TONE_CLASS[item.tone]?.text ?? "var(--color-text-faint)", marginTop: 6 }} />
                <p className="text-[12.5px] leading-relaxed text-[var(--color-text-soft)] [&_b]:font-bold [&_b]:text-[var(--color-text-primary)]">{item.text}</p>
              </div>
            )) : (
              <p className="py-4 text-xs text-[var(--color-text-faint)]">{loaded ? "Nothing to flag right now." : "Loading…"}</p>
            )}
          </div>
        </div>
      </div>

      {/* Peak hours (relocated from hero) + Guest feedback (sentiment + complaint themes merged) */}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1fr_1.3fr] items-stretch">
        <div className="card p-6">
          <p className="text-[13.5px] font-bold text-[var(--color-text-primary)]">Peak hours</p>
          <p className="mt-0.5 text-[11.5px] text-[var(--color-text-faint)]">Avg orders per hour, last {revenueTrend.length || 14} days</p>

          {peakHours.some((h) => h.avg_orders > 0) ? (
            <div style={{ height: 210 }} className="mt-4">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={peakHoursDisplay} margin={{ top: 8, right: 4, left: -24, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border-soft)" vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 8.5, fill: "#6b7280", fontFamily: "Space Mono" }} axisLine={false} tickLine={false} interval={2} />
                  <YAxis tick={{ fontSize: 9, fill: "#6b7280", fontFamily: "Space Mono" }} axisLine={false} tickLine={false} />
                  <Tooltip
                    formatter={(v) => [`${v} orders/day avg`, ""]}
                    contentStyle={{ background: "var(--color-surface-raised)", border: "1px solid var(--color-border-default)", borderRadius: 8, fontSize: 12 }}
                  />
                  <Bar dataKey="avg_orders" radius={[3, 3, 0, 0]}>
                    {peakHoursDisplay.map((h) => (
                      <Cell key={h.hour} fill={h.avg_orders === peakHourMax ? "#efa345" : "rgba(230,137,42,0.35)"} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="mt-4 flex h-[160px] items-center justify-center rounded-xl border border-dashed border-[var(--color-border-default)] text-center">
              <p className="max-w-xs text-xs text-[var(--color-text-faint)]">{loaded ? "Not enough order history yet." : "Loading…"}</p>
            </div>
          )}
        </div>

        <div className="card p-6">
          <p className="text-[13.5px] font-bold text-[var(--color-text-primary)]">Guest feedback</p>
          <p className="mt-0.5 text-[11.5px] text-[var(--color-text-faint)]">Sentiment &amp; complaint themes, last 28 days</p>

          {sentimentData.length > 0 || complaintCategories.length > 0 ? (
            <div className="mt-4 grid grid-cols-1 gap-5 sm:grid-cols-[auto_1fr]">
              <div className="flex shrink-0 items-center gap-3 sm:flex-col sm:items-start sm:gap-2">
                <div className="relative shrink-0" style={{ width: 76, height: 76 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={sentimentData} dataKey="value" nameKey="name" innerRadius={26} outerRadius={37} paddingAngle={2} stroke="none">
                        {sentimentData.map((d) => <Cell key={d.name} fill={d.color} />)}
                      </Pie>
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="absolute inset-0 grid place-items-center">
                    <span className="num-display text-[14px] text-[var(--color-text-primary)]">{positivePct}%</span>
                  </div>
                </div>
                <div className="min-w-0 space-y-1">
                  {sentimentData.map((d) => (
                    <div key={d.name} className="flex items-center gap-1.5 text-[11px]">
                      <span className="h-2 w-2 shrink-0 rounded-sm" style={{ background: d.color }} />
                      <span className="truncate text-[var(--color-text-soft)]">{d.name}</span>
                      <span className="mono ml-auto shrink-0 font-semibold text-[var(--color-text-primary)] sm:ml-1.5">{d.value}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="min-w-0 border-t border-[var(--color-border-soft)] pt-3 sm:border-t-0 sm:border-l sm:border-[var(--color-border-soft)] sm:pl-5 sm:pt-0">
                <p className="mb-2 text-[10.5px] font-semibold text-[var(--color-text-faint)]">Top complaint themes</p>
                {complaintCategories.length > 0 ? (
                  <div className="space-y-2.5">
                    {complaintCategories.slice(0, 5).map((c) => (
                      <div key={c.category} className="flex items-center gap-2.5">
                        <span className="w-28 shrink-0 truncate text-[12px] font-medium text-[var(--color-text-soft)]">{c.category}</span>
                        <div className="h-2 flex-1 overflow-hidden rounded-full bg-[var(--color-surface-sunken)]">
                          <div className="h-full rounded-full bg-[var(--color-caution)]" style={{ width: `${(c.count / complaintMax) * 100}%` }} />
                        </div>
                        <span className="mono w-6 shrink-0 text-right text-[12px] font-bold text-[var(--color-text-primary)]">{c.count}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-[11px] text-[var(--color-text-faint)]">No complaints in the last 28 days.</p>
                )}
              </div>
            </div>
          ) : (
            <div className="mt-3 flex h-[160px] items-center justify-center rounded-xl border border-dashed border-[var(--color-border-default)] text-center">
              <p className="max-w-xs text-xs text-[var(--color-text-faint)]">{loaded ? "No feedback data yet." : "Loading…"}</p>
            </div>
          )}
        </div>
      </div>

      {/* Market intelligence — one consolidated card, teaser into the dedicated /market page */}
      <div className="card relative overflow-hidden p-6">
        <div className="pointer-events-none absolute inset-0" style={{ background: "radial-gradient(480px 200px at 0% -10%, rgba(252,128,25,0.08), transparent 65%)" }} />
        <div className="relative flex items-start justify-between gap-3">
          <div>
            <p className="flex items-center gap-2 text-[15px] font-bold text-[var(--color-text-primary)]">
              Market intelligence
              <span className="flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide" style={{ background: "rgba(252,128,25,0.10)", color: "#fc8019" }}>
                <span className="h-1 w-1 rounded-full" style={{ background: "#fc8019" }} />
                Swiggy
              </span>
            </p>
            <p className="mt-0.5 text-[11.5px] text-[var(--color-text-faint)]">Live competitor pricing, area demand &amp; Instamart — via Swiggy MCP</p>
          </div>
          <Link href="/market" className="flex shrink-0 items-center gap-1 text-[12.5px] font-bold text-[var(--color-accent)]">
            Full market intelligence
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
          </Link>
        </div>

        <div className="relative mt-5 grid grid-cols-1 gap-5 xl:grid-cols-[1.6fr_1fr]">
          {pricingAlerts.length > 0 ? (
            <div style={{ height: 200 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={pricingAlerts} layout="vertical" margin={{ top: 8, right: 24, left: 8, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border-soft)" horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 9, fill: "#6b7280", fontFamily: "Space Mono" }} axisLine={false} tickLine={false} />
                  <YAxis type="category" dataKey="item" width={110} tick={{ fontSize: 10.5, fill: "#6b7280" }} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={{ background: "var(--color-surface-raised)", border: "1px solid var(--color-border-default)", borderRadius: 8, fontSize: 12 }} />
                  <Bar dataKey="your_price" name="Your price" fill="#efa345" radius={[0, 3, 3, 0]} barSize={10} />
                  <Bar dataKey="area_avg" name="Area avg" fill="#fc8019" fillOpacity={0.4} radius={[0, 3, 3, 0]} barSize={10} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="flex h-[160px] items-center justify-center rounded-xl border border-dashed border-[var(--color-border-default)] text-center">
              <p className="max-w-xs text-xs text-[var(--color-text-faint)]">
                {!marketLoaded ? "Checking Swiggy for live competitor pricing…" : marketPulse?.swiggy_connected === false ? "Connect Swiggy to see live competitor pricing for your menu." : "No competitor pricing data available right now."}
              </p>
            </div>
          )}

          <div className="space-y-2.5">
            <div className="rounded-xl border border-[var(--color-border-default)] bg-[var(--color-surface-raised)] px-4 py-3">
              <p className="text-[10.5px] font-semibold text-[var(--color-text-faint)]">Area demand tonight</p>
              <p className="num-display mt-0.5 text-[19px] text-[var(--color-text-primary)]">{occupancy?.signal ? occupancy.signal.charAt(0) + occupancy.signal.slice(1).toLowerCase() : "--"}</p>
              <p className="mt-0.5 text-[10.5px] text-[var(--color-text-faint)]">{occupancy ? `${occupancy.competitors_checked} nearby kitchens tracked` : swiggyEmptyMeta}</p>
            </div>
            <div className="rounded-xl border border-[var(--color-border-default)] bg-[var(--color-surface-raised)] px-4 py-3">
              <p className="text-[10.5px] font-semibold text-[var(--color-text-faint)]">Instamart price check</p>
              <p className="num-display mt-0.5 text-[19px] text-[var(--color-text-primary)]">{cheapestProcurement ? `₹${cheapestProcurement.price}/${cheapestProcurement.unit}` : "--"}</p>
              <p className="mt-0.5 text-[10.5px] text-[var(--color-text-faint)]">{cheapestProcurement ? `${cheapestProcurement.name}${cheapestProcurement.in_stock ? " · in stock" : ""}` : swiggyEmptyMeta}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Specialist intro band */}
      <div className="card flex flex-wrap items-center gap-x-6 gap-y-3 p-5">
        <p className="shrink-0 text-[10.5px] font-bold uppercase tracking-[0.12em] text-[var(--color-text-faint)]">How CortexKitchen works</p>
        <div className="flex flex-1 flex-wrap items-center gap-x-5 gap-y-2.5">
          {AGENT_PIPELINE.map((agent) => (
            <div key={agent.label} className="flex items-center gap-2" title={agent.capability}>
              <span className="grid h-6 w-6 shrink-0 place-items-center rounded-md" style={{ background: TONE_CLASS[agent.tone].bg, color: TONE_CLASS[agent.tone].text }}>
                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                  <path strokeLinecap="round" strokeLinejoin="round" d={agent.iconPath} />
                </svg>
              </span>
              <span className="text-[12px] font-semibold text-[var(--color-text-soft)]">{agent.label}</span>
            </div>
          ))}
        </div>
        <div className="ml-auto flex shrink-0 items-center gap-1.5 text-[11px] text-[var(--color-text-faint)]">
          <img src="/swiggy-logo.png" alt="Swiggy" className="h-3.5 w-auto object-contain opacity-90" />
          live market data
        </div>
      </div>

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
      />
    </div>
  );
}

function Sparkline({ data, color }: { data: number[]; color: string }) {
  if (data.length < 2 || data.every((v) => v === data[0])) return null;
  const w = 68, h = 26;
  const min = Math.min(...data), max = Math.max(...data);
  const range = max - min || 1;
  const points = data.map((v, i) => `${(i / (data.length - 1)) * w},${h - ((v - min) / range) * h}`).join(" ");
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} className="shrink-0 opacity-90">
      <polyline points={points} fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function KpiTile({
  label, value, unit, meta, metaTone, icon, swiggy, sparkline, sparklineColor, lg,
}: {
  label: string; value: string; unit?: string; meta?: string; metaTone?: "warn"; icon: string; swiggy?: boolean;
  sparkline?: number[]; sparklineColor?: string; lg?: boolean;
}) {
  return (
    <div className={`card relative overflow-hidden ${lg ? "p-5" : "p-4"}`}>
      {swiggy && (
        <span className="absolute right-3 top-3 flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide" style={{ background: "rgba(252,128,25,0.10)", color: "#fc8019" }}>
          <span className="h-1 w-1 rounded-full" style={{ background: "#fc8019" }} />
          Swiggy
        </span>
      )}
      <div className="flex items-center gap-1.5 text-[10.5px] font-semibold text-[var(--color-text-faint)]">
        <svg className="h-3 w-3 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d={icon} />
        </svg>
        {label}
      </div>
      <div className="mt-1.5 flex items-end justify-between gap-2">
        <div className={`num-display leading-none text-[var(--color-text-primary)] ${lg ? "text-[28px]" : "text-2xl"}`}>
          {value}{unit && <span className="ml-1 font-sans text-[11px] font-semibold text-[var(--color-text-faint)]">{unit}</span>}
        </div>
        {sparkline && sparklineColor && <Sparkline data={sparkline} color={sparklineColor} />}
      </div>
      {meta && (
        <div className={`mt-1 text-[10.5px] ${metaTone === "warn" ? "text-[var(--color-caution)]" : "text-[var(--color-text-faint)]"}`}>{meta}</div>
      )}
    </div>
  );
}
