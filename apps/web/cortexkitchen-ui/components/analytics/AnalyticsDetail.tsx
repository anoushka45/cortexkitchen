"use client";

// Analytics -- moved out of the Dashboard (P6-A30 v2 reference redesign):
// menu performance, channel split, peak hours, guest feedback, and the
// market-intelligence teaser are historical/analytical, not daily
// trigger-time decisions, so they get their own primary-nav page instead of
// stretching the Dashboard. Self-fetching, same pattern as every other page
// (getDataHealth is independently called on both Dashboard and /data too).

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Bar, BarChart, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import CategoryPricingChart from "@/components/dashboard/CategoryPricingChart";
import { getBusinessPerformance, getMarketPulse, BusinessPerformanceResponse, MarketPulseResponse } from "@/lib/api";

export default function AnalyticsDetail() {
  const [businessPerf, setBusinessPerf] = useState<BusinessPerformanceResponse | null>(null);
  const [marketPulse, setMarketPulse]   = useState<MarketPulseResponse | null>(null);
  const [marketLoaded, setMarketLoaded] = useState(false);
  const [perfDays, setPerfDays]         = useState(14);
  const [loaded, setLoaded]             = useState(false);

  useEffect(() => {
    let cancelled = false;
    getBusinessPerformance(perfDays)
      .then((perf) => { if (!cancelled) setBusinessPerf(perf); })
      .catch(() => { if (!cancelled) setBusinessPerf(null); })
      .finally(() => { if (!cancelled) setLoaded(true); });
    return () => { cancelled = true; };
  }, [perfDays]);

  useEffect(() => {
    let cancelled = false;
    getMarketPulse()
      .then((pulse) => { if (!cancelled) setMarketPulse(pulse); })
      .catch(() => { if (!cancelled) setMarketPulse(null); })
      .finally(() => { if (!cancelled) setMarketLoaded(true); });
    return () => { cancelled = true; };
  }, []);

  const revenueTrend = businessPerf?.trend ?? [];
  const topDishes = businessPerf?.top_dishes ?? [];
  const bottomDishes = businessPerf?.bottom_dishes ?? [];
  const complaintCategories = businessPerf?.complaints_by_category ?? [];
  const complaintMax = Math.max(1, ...complaintCategories.map((c) => c.count));

  const channelSplit = businessPerf?.channel_split ?? null;
  const channelData = channelSplit && (channelSplit.dine_in_revenue + channelSplit.delivery_revenue) > 0 ? [
    { name: "Dine-in", value: channelSplit.dine_in_revenue, color: "#efa345" },
    { name: "Delivery", value: channelSplit.delivery_revenue, color: "#38bdf8" },
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

  const categoryPricing = marketPulse?.competitor_pricing?.category_pricing ?? [];
  const procurement = marketPulse?.procurement ?? [];
  const cheapestProcurement = procurement.length > 0
    ? [...procurement].filter((p) => p.in_stock).sort((a, b) => a.price - b.price)[0] ?? procurement[0]
    : null;
  const swiggyEmptyMeta = !marketLoaded ? "checking Swiggy…" : marketPulse?.swiggy_connected === false ? "connect Swiggy to see this" : "no data available";

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1.7fr_1fr] items-stretch">
        <div className="card p-6">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[13.5px] font-bold text-[var(--color-text-primary)]">Menu performance</p>
              <p className="mt-0.5 text-[11.5px] text-[var(--color-text-faint)]">By revenue, last {revenueTrend.length || perfDays} days</p>
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
          <p className="text-[13.5px] font-bold text-[var(--color-text-primary)]">Channel split</p>
          <p className="mt-0.5 text-[11.5px] text-[var(--color-text-faint)]">Yesterday&apos;s revenue by channel</p>
          {channelData.length > 0 ? (
            <div className="mt-4 flex items-center gap-4">
              <div style={{ width: 84, height: 84 }} className="shrink-0">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={channelData} dataKey="value" nameKey="name" innerRadius={26} outerRadius={38} paddingAngle={2} stroke="none">
                      {channelData.map((d) => <Cell key={d.name} fill={d.color} />)}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="min-w-0 space-y-1.5">
                {channelData.map((d) => (
                  <div key={d.name} className="flex items-center gap-1.5 text-[12px]">
                    <span className="h-2 w-2 shrink-0 rounded-sm" style={{ background: d.color }} />
                    <span className="truncate text-[var(--color-text-soft)]">{d.name}</span>
                    <span className="mono ml-auto shrink-0 font-semibold text-[var(--color-text-primary)]">{Math.round((d.value / (channelData[0].value + channelData[1].value)) * 100)}%</span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <p className="mt-4 text-[11px] text-[var(--color-text-faint)]">{loaded ? "No data yet" : "Loading…"}</p>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1fr_1.3fr] items-stretch">
        <div className="card p-6">
          <p className="text-[13.5px] font-bold text-[var(--color-text-primary)]">Peak hours</p>
          <p className="mt-0.5 text-[11.5px] text-[var(--color-text-faint)]">Avg orders per hour, last {revenueTrend.length || perfDays} days</p>

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
          <p className="text-[13.5px] font-bold text-[var(--color-text-primary)]">Complaint themes</p>
          <p className="mt-0.5 text-[11.5px] text-[var(--color-text-faint)]">Last 28 days</p>
          {complaintCategories.length > 0 ? (
            <div className="mt-4 space-y-2.5">
              {complaintCategories.slice(0, 6).map((c) => (
                <div key={c.category} className="flex items-center gap-2.5">
                  <span className="w-32 shrink-0 truncate text-[12px] font-medium text-[var(--color-text-soft)]">{c.category}</span>
                  <div className="h-2 flex-1 overflow-hidden rounded-full bg-[var(--color-surface-sunken)]">
                    <div className="h-full rounded-full bg-[var(--color-caution)]" style={{ width: `${(c.count / complaintMax) * 100}%` }} />
                  </div>
                  <span className="mono w-6 shrink-0 text-right text-[12px] font-bold text-[var(--color-text-primary)]">{c.count}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="mt-4 text-[11px] text-[var(--color-text-faint)]">{loaded ? "No complaints in the last 28 days." : "Loading…"}</p>
          )}
        </div>
      </div>

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
            <p className="mt-0.5 text-[11.5px] text-[var(--color-text-faint)]">Live category pricing &amp; Instamart — via Swiggy MCP</p>
          </div>
          <Link href="/market" className="flex shrink-0 items-center gap-1 text-[12.5px] font-bold text-[var(--color-accent)]">
            Full market intelligence
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
          </Link>
        </div>

        <div className="relative mt-5 grid grid-cols-1 gap-5 xl:grid-cols-[1.6fr_1fr]">
          {categoryPricing.length > 0 ? (
            <div>
              <div className="mb-3 space-y-1.5">
                {categoryPricing.slice(0, 3).map((c) => (
                  <div
                    key={c.category}
                    className={`rounded-lg border px-3 py-2 ${
                      c.verdict === "above" ? "border-rose-500/30 bg-rose-500/[0.12]"
                      : c.verdict === "below" ? "border-emerald-500/30 bg-emerald-500/[0.12]"
                      : "border-[var(--color-border-soft)] bg-[var(--color-surface-raised)]"
                    }`}
                  >
                    <p className="text-xs text-[var(--color-text-primary)]">
                      <span className="font-semibold capitalize">{c.category}</span>
                      {": you're "}
                      <span className={`font-semibold ${c.verdict === "above" ? "text-rose-600 dark:text-rose-300" : c.verdict === "below" ? "text-emerald-600 dark:text-emerald-300" : ""}`}>
                        {Math.abs(c.diff_pct).toFixed(0)}% {c.verdict === "in line" ? "in line with" : c.verdict}
                      </span>{c.verdict !== "in line" ? " the area" : ""} (₹{c.your_avg} vs ₹{c.area_avg} avg)
                    </p>
                  </div>
                ))}
              </div>
              <CategoryPricingChart data={categoryPricing} />
            </div>
          ) : (
            <div className="flex h-[160px] items-center justify-center rounded-xl border border-dashed border-[var(--color-border-default)] text-center">
              <p className="max-w-xs text-xs text-[var(--color-text-faint)]">
                {!marketLoaded ? "Checking Swiggy for live category pricing…" : marketPulse?.swiggy_connected === false ? "Connect Swiggy to see live category pricing for your menu." : "No category pricing data available right now."}
              </p>
            </div>
          )}

          <div className="space-y-2.5">
            <div className="rounded-xl border border-[var(--color-border-default)] bg-[var(--color-surface-raised)] px-4 py-3">
              <p className="text-[10.5px] font-semibold text-[var(--color-text-faint)]">Instamart price check</p>
              <p className="num-display mt-0.5 text-[19px] text-[var(--color-text-primary)]">{cheapestProcurement ? `₹${cheapestProcurement.price}/${cheapestProcurement.unit}` : "--"}</p>
              <p className="mt-0.5 text-[10.5px] text-[var(--color-text-faint)]">{cheapestProcurement ? `${cheapestProcurement.name}${cheapestProcurement.in_stock ? " · in stock" : ""}` : swiggyEmptyMeta}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
