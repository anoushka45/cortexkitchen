"use client";

import { useState, useRef, useEffect } from "react";
import {
  BarChart, Bar,
  LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, Cell, ReferenceLine,
} from "recharts";

interface ForecastData {
  predicted_orders: number;
  predicted_orders_lower?: number;
  predicted_orders_upper?: number;
  predicted_peak_orders?: number;
  method?: "prophet" | "baseline";
  confidence?: "high" | "medium" | "low";
  target_date?: string;
  avg_friday_orders?: number;
  avg_same_day_orders?: number;
  avg_peak_orders?: number;
  service_day_label?: string;
  service_window?: string;
  hourly_projection?: Array<{ hour: string; covers: number }>;
  top_items?: Array<{ item: string; category: string; total_ordered: number }>;
}

interface Props {
  forecast: Record<string, unknown> | null;
  scenario?: string | null;
}

type HourBar = {
  hour: string;
  covers: number;
  inWindow: boolean;
};

const CONFIDENCE_COLORS: Record<string, string> = {
  high: "text-emerald-400",
  medium: "text-amber-400",
  low: "text-rose-400",
};

const METHOD_COLORS: Record<string, string> = {
  prophet: "text-blue-400",
  baseline: "text-[var(--color-text-soft)]",
};

const FALLBACK_PROFILES: Record<string, number[]> = {
  weekday_lunch: [0.08, 0.16, 0.24, 0.22, 0.16, 0.09, 0.05],
  holiday_spike: [0.03, 0.07, 0.12, 0.2, 0.23, 0.18, 0.11, 0.06],
  low_stock_weekend: [0.04, 0.08, 0.15, 0.21, 0.2, 0.16, 0.1, 0.06],
  friday_rush: [0.03, 0.07, 0.14, 0.21, 0.22, 0.17, 0.1, 0.06],
  default: [0.05, 0.08, 0.12, 0.18, 0.19, 0.15, 0.11, 0.07, 0.05],
};

function toNumber(value: unknown): number | undefined {
  if (value === null || value === undefined) return undefined;
  const num = Number(value);
  return Number.isFinite(num) ? num : undefined;
}

function normalizeForecastData(raw: Record<string, unknown> | null): ForecastData | null {
  if (!raw) return null;

  const nested = raw.data as Record<string, unknown> | undefined;
  const payload = nested && typeof nested === "object" ? nested : raw;

  const predictedOrders = toNumber(
    payload.predicted_orders ??
      payload.predictedOrders ??
      payload.predicted_covers ??
      payload.predictedCovers
  );
  if (predictedOrders === undefined) return null;

  const hourlyProjection = Array.isArray(payload.hourly_projection)
    ? payload.hourly_projection
        .map((entry) => {
          const row = entry as Record<string, unknown>;
          const covers = toNumber(row.covers);
          const hour = row.hour ? String(row.hour) : null;
          if (covers === undefined || !hour) return null;
          return { hour, covers: Math.max(0, Math.round(covers)) };
        })
        .filter((entry): entry is { hour: string; covers: number } => entry !== null)
    : undefined;

  return {
    predicted_orders: predictedOrders,
    predicted_orders_lower: toNumber(payload.predicted_orders_lower ?? payload.predictedOrdersLower),
    predicted_orders_upper: toNumber(payload.predicted_orders_upper ?? payload.predictedOrdersUpper),
    predicted_peak_orders: toNumber(payload.predicted_peak_orders ?? payload.predictedPeakOrders),
    method: String(payload.method ?? payload.model ?? "baseline") as "prophet" | "baseline",
    confidence: String(payload.confidence ?? "medium") as "high" | "medium" | "low",
    target_date: payload.target_date ? String(payload.target_date) : undefined,
    avg_friday_orders: toNumber(payload.avg_friday_orders),
    avg_same_day_orders: toNumber(payload.avg_same_day_orders),
    avg_peak_orders: toNumber(payload.avg_peak_orders),
    service_day_label: payload.service_day_label ? String(payload.service_day_label) : undefined,
    service_window: payload.service_window ? String(payload.service_window) : undefined,
    hourly_projection: hourlyProjection,
    top_items: Array.isArray(payload.top_items)
      ? (payload.top_items as Array<{ item: string; category: string; total_ordered: number }>)
      : undefined,
  };
}

function parseHour(hourText: string): number {
  return Number(hourText.split(":")[0]);
}

function formatHour(hourValue: number): string {
  const normalized = ((hourValue % 24) + 24) % 24;
  return `${String(normalized).padStart(2, "0")}:00`;
}

function parseServiceWindow(serviceWindow?: string): { start: number; end: number } {
  if (!serviceWindow || !serviceWindow.includes("-")) {
    return { start: 18, end: 22 };
  }
  const [startText, endText] = serviceWindow.split("-");
  return {
    start: parseHour(startText),
    end: parseHour(endText),
  };
}

function buildHours(serviceWindow?: string): string[] {
  const { start, end } = parseServiceWindow(serviceWindow);
  const earliest = Math.max(0, start - 1);
  const latest = Math.min(23, end + 1);
  const hours: string[] = [];
  for (let hour = earliest; hour <= latest; hour += 1) {
    hours.push(formatHour(hour));
  }
  return hours;
}

function allocateByProfile(total: number, weights: number[]): number[] {
  const safeTotal = Math.max(0, Math.round(total));
  if (safeTotal === 0) {
    return weights.map(() => 0);
  }

  const normalizedWeights = weights.map((value) => Math.max(0, value));
  const weightSum = normalizedWeights.reduce((sum, value) => sum + value, 0) || 1;
  const raw = normalizedWeights.map((weight) => (safeTotal * weight) / weightSum);
  const base = raw.map((value) => Math.floor(value));
  let remainder = safeTotal - base.reduce((sum, value) => sum + value, 0);

  const order = raw
    .map((value, index) => ({ index, fraction: value - Math.floor(value) }))
    .sort((a, b) => b.fraction - a.fraction);

  for (let pointer = 0; remainder > 0 && pointer < order.length; pointer += 1) {
    base[order[pointer].index] += 1;
    remainder -= 1;
  }

  return base;
}

function buildFallbackBars(
  predictedOrders: number,
  serviceWindow?: string,
  scenario?: string | null
): HourBar[] {
  const hours = buildHours(serviceWindow);
  const { start, end } = parseServiceWindow(serviceWindow);
  const profile =
    (scenario && FALLBACK_PROFILES[scenario]) ||
    FALLBACK_PROFILES.default;
  const distributed = allocateByProfile(predictedOrders, profile.slice(0, hours.length));

  return hours.map((hour, index) => ({
    hour,
    covers: distributed[index] ?? 0,
    inWindow: parseHour(hour) >= start && parseHour(hour) <= end,
  }));
}

function buildChartData(
  forecastData: ForecastData,
  scenario?: string | null
): HourBar[] {
  const { service_window, hourly_projection, predicted_orders } = forecastData;
  const { start, end } = parseServiceWindow(service_window);

  if (hourly_projection && hourly_projection.length > 0) {
    return hourly_projection.map((entry) => ({
      hour: entry.hour,
      covers: entry.covers,
      inWindow: parseHour(entry.hour) >= start && parseHour(entry.hour) <= end,
    }));
  }

  return buildFallbackBars(Math.round(predicted_orders), service_window, scenario);
}

export default function ForecastChart({ forecast, scenario }: Props) {
  const [chartType, setChartType] = useState<"bar" | "line">("bar");
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const [chartWidth, setChartWidth] = useState(800);

  useEffect(() => {
    const el = chartContainerRef.current;
    if (!el) return;
    setChartWidth(el.getBoundingClientRect().width || el.offsetWidth);
    const ro = new ResizeObserver(entries => setChartWidth(entries[0].contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const forecastData = normalizeForecastData(forecast);
  if (!forecastData) return null;

  const {
    predicted_orders,
    predicted_orders_lower,
    predicted_orders_upper,
    method = "baseline",
    confidence = "medium",
    target_date,
    avg_friday_orders,
    avg_same_day_orders,
    avg_peak_orders,
    service_day_label,
    service_window,
    top_items,
  } = forecastData;

  const roundedOrders = Math.round(predicted_orders);
  const data = buildChartData(forecastData, scenario);
  const peak = Math.max(...data.map((d) => d.covers), 0);
  const avg = data.length
    ? Math.round(data.reduce((sum, d) => sum + d.covers, 0) / data.length)
    : 0;
  const hasRange =
    predicted_orders_lower !== undefined && predicted_orders_upper !== undefined;
  const rangeText = hasRange
    ? `${Math.round(predicted_orders_lower)}-${Math.round(predicted_orders_upper)}`
    : null;

  return (
    <div className="rounded-2xl bg-[var(--color-surface)] p-6 ring-1 ring-[var(--color-border-soft)] h-full flex flex-col">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 mb-5">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[10px] uppercase tracking-[0.22em] text-[var(--color-accent)]/80">Demand forecast</span>
            <span className={`rounded-full bg-[var(--color-surface-raised)] px-2 py-0.5 text-[9px] uppercase tracking-wider ${CONFIDENCE_COLORS[confidence]}`}>
              {confidence} confidence
            </span>
          </div>
          <h3 className="mt-1.5 text-xl font-semibold text-[var(--color-text-primary)]">
            {target_date
              ? `${service_day_label ?? "Service"}  -  ${target_date}`
              : "Next planning window"}
          </h3>
          <div className="mt-1 flex flex-wrap items-center gap-3 text-[11px] text-[var(--color-text-faint)]">
            <span className={METHOD_COLORS[method]}>{method === "prophet" ? "Prophet  -  AI" : "Baseline"}</span>
            {(avg_same_day_orders ?? avg_friday_orders) !== undefined && (
              <span>Avg last 4 {service_day_label ?? "days"} <b className="text-[var(--color-text-soft)]">{avg_same_day_orders ?? avg_friday_orders}</b></span>
            )}
            {avg_peak_orders !== undefined && (
              <span>Avg peak <b className="text-[var(--color-text-soft)]">{avg_peak_orders}</b></span>
            )}
          </div>
        </div>
        <div className="text-right shrink-0">
          <div className="num-display text-5xl leading-none text-[var(--color-text-primary)]">{roundedOrders}</div>
          <div className="mt-1 text-[9px] uppercase tracking-[0.18em] text-[var(--color-text-faint)]">
            predicted orders{rangeText ? `  -  ${rangeText}` : ""}
          </div>
        </div>
      </div>

      {/* Top items */}
      {top_items && top_items.length > 0 && (
        <div className="mb-5 grid grid-cols-2 gap-2.5">
          {top_items.slice(0, 2).map((item, index) => (
            <div key={`${item.item}-${index}`}
              className="rounded-lg bg-[var(--color-surface-raised)] px-4 py-3 ring-1 ring-[var(--color-border-soft)] flex items-center justify-between">
              <div>
                <div className="text-[13px] font-semibold text-[var(--color-text-primary)] truncate">{item.item}</div>
                <div className="text-[10px] uppercase tracking-wider text-[var(--color-text-faint)]">
                  {item.category}  -  {item.total_ordered} orders
                </div>
              </div>
              <span className={`rounded-full px-2 py-0.5 text-[10px] uppercase tracking-wider ring-1 ${ index === 0 ? "bg-ember-500/[0.06] text-[var(--color-accent)] ring-ember-400/25" : "bg-emerald-500/[0.06] text-emerald-300 ring-emerald-400/25" }`}>{index === 0 ? "ease" : "push"}</span>
            </div>
          ))}
        </div>
      )}

      {/* Chart toggle + chart */}
      <div className="flex-1 min-h-[180px]">
        <div className="flex items-center justify-end gap-1 mb-2">
          {(["bar", "line"] as const).map((type) => (
            <button
              key={type}
              onClick={() => setChartType(type)}
              className={`flex items-center gap-1 rounded-md px-2 py-1 text-[9px] uppercase tracking-wider transition-colors ${ chartType === type ? "bg-ember-500/15 text-[var(--color-accent)]" : "text-[var(--color-text-faint)] hover:text-[var(--color-text-faint)]" }`}
            >
              {type === "bar" ? (
                <svg className="h-3 w-3" viewBox="0 0 12 12" fill="currentColor">
                  <rect x="0" y="4" width="3" height="8" rx="0.5" />
                  <rect x="4.5" y="1" width="3" height="11" rx="0.5" />
                  <rect x="9" y="6" width="3" height="6" rx="0.5" />
                </svg>
              ) : (
                <svg className="h-3 w-3" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <polyline points="0,10 3,5 6,2 9,6 12,3" />
                </svg>
              )}
              {type}
            </button>
          ))}
        </div>

        <div ref={chartContainerRef} style={{ height: 210 }}>
          {chartType === "bar" ? (
            <BarChart width={chartWidth} height={210} data={data} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
              <XAxis dataKey="hour" tick={{ fontSize: 9, fill: "#6b7280", fontFamily: "Space Mono" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 9, fill: "#6b7280", fontFamily: "Space Mono" }} axisLine={false} tickLine={false} />
              <ReferenceLine y={avg} stroke="rgba(230,137,42,0.25)" strokeDasharray="4 4"
                label={{ value: "avg", position: "right", fontSize: 9, fill: "#6b7280" }} />
              <Tooltip
                contentStyle={{ background: "#0b1020", border: "1px solid rgba(230,137,42,0.2)", borderRadius: 10, fontSize: 12, fontFamily: "Space Mono", color: "#f8fafc" }}
                itemStyle={{ color: "#e2e8f0" }} labelStyle={{ color: "#9ca3af" }}
                formatter={(value: unknown) => [`${value} covers`, "Expected"]}
                cursor={{ fill: "rgba(230,137,42,0.06)" }}
              />
              <Bar dataKey="covers" radius={[3, 3, 0, 0]}>
                {data.map((entry) => (
                  <Cell
                    key={entry.hour}
                    fill={entry.covers === peak ? "#efa345" : entry.inWindow ? "rgba(230,137,42,0.45)" : "rgba(230,137,42,0.20)"}
                    style={entry.covers === peak ? { filter: "drop-shadow(0 0 12px rgba(230,137,42,0.5))" } : undefined}
                  />
                ))}
              </Bar>
            </BarChart>
          ) : (
            <LineChart width={chartWidth} height={210} data={data} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
              <XAxis dataKey="hour" tick={{ fontSize: 9, fill: "#6b7280", fontFamily: "Space Mono" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 9, fill: "#6b7280", fontFamily: "Space Mono" }} axisLine={false} tickLine={false} />
              <ReferenceLine y={avg} stroke="rgba(230,137,42,0.25)" strokeDasharray="4 4"
                label={{ value: "avg", position: "right", fontSize: 9, fill: "#6b7280" }} />
              <Tooltip
                contentStyle={{ background: "#0b1020", border: "1px solid rgba(230,137,42,0.2)", borderRadius: 10, fontSize: 12, fontFamily: "Space Mono", color: "#f8fafc" }}
                itemStyle={{ color: "#e2e8f0" }} labelStyle={{ color: "#9ca3af" }}
                formatter={(value: unknown) => [`${value} covers`, "Expected"]}
              />
              <Line
                type="monotone" dataKey="covers" stroke="#efa345" strokeWidth={2}
                dot={(props) => {
                  const { cx, cy, payload } = props as { cx: number; cy: number; payload: HourBar };
                  if (payload.covers !== peak) return <g key={props.key} />;
                  return <circle key={props.key} cx={cx} cy={cy} r={4} fill="#efa345" stroke="#0b1020" strokeWidth={2} style={{ filter: "drop-shadow(0 0 8px rgba(230,137,42,0.7))" }} />;
                }}
                activeDot={{ r: 5, fill: "#efa345", stroke: "#0b1020", strokeWidth: 2 }}
              />
            </LineChart>
          )}
        </div>
      </div>

      {/* Forecast context strip */}
      <div className="mt-4 grid grid-cols-3 gap-2">
        {(() => {
          const avg_ref = avg_same_day_orders ?? avg_friday_orders;
          const vsAvg = avg_ref && avg_ref > 0
            ? Math.round(((roundedOrders - avg_ref) / avg_ref) * 100)
            : null;
          const direction = vsAvg !== null ? (vsAvg >= 0 ? "↑" : "↓") : null;
          const vsColor = vsAvg === null ? "text-[var(--color-text-faint)]"
            : vsAvg >= 10 ? "text-emerald-300" : vsAvg <= -10 ? "text-rose-300" : "text-[var(--color-accent)]";

          return (
            <>
              <div className="rounded-lg bg-[var(--color-surface-raised)] px-3 py-2.5 ring-1 ring-[var(--color-border-soft)]">
                <div className="text-[9px] uppercase tracking-wider text-[var(--color-text-faint)] mb-1">vs your average</div>
                <div className={`text-[15px] font-semibold ${vsColor}`}>
                  {vsAvg !== null ? `${direction} ${Math.abs(vsAvg)}%` : "—"}
                </div>
                <div className="font-mono text-[9px] text-[var(--color-text-ghost)] mt-0.5">
                  {avg_ref ? `avg ${avg_ref} orders` : "no baseline yet"}
                </div>
              </div>

              <div className="rounded-lg bg-[var(--color-surface-raised)] px-3 py-2.5 ring-1 ring-[var(--color-border-soft)]">
                <div className="text-[9px] uppercase tracking-wider text-[var(--color-text-faint)] mb-1">peak hour</div>
                <div className="text-[15px] font-semibold text-[var(--color-text-primary)]">
                  {data.find(d => d.covers === peak)?.hour ?? "—"}
                </div>
                <div className="font-mono text-[9px] text-[var(--color-text-ghost)] mt-0.5">{peak} covers expected</div>
              </div>

              <div className="rounded-lg bg-[var(--color-surface-raised)] px-3 py-2.5 ring-1 ring-[var(--color-border-soft)]">
                <div className="text-[9px] uppercase tracking-wider text-[var(--color-text-faint)] mb-1">confidence</div>
                <div className={`text-[15px] font-semibold ${CONFIDENCE_COLORS[confidence]}`}>
                  {confidence.charAt(0).toUpperCase() + confidence.slice(1)}
                </div>
                <div className="font-mono text-[9px] text-[var(--color-text-ghost)] mt-0.5">
                  {method === "prophet" ? "Prophet AI model" : "Baseline estimate"}
                </div>
              </div>
            </>
          );
        })()}
      </div>

      {/* Footer */}
      <div className="mt-3 flex items-center justify-between border-t border-[var(--color-border-soft)] pt-3 text-[11px] text-[var(--color-text-faint)]">
        <span>Service window: <span className="font-mono text-[var(--color-accent)]/70">{service_window ?? "18:00-22:00"}</span></span>
        {hasRange && <span className="font-mono">Range: {rangeText}</span>}
      </div>
    </div>
  );
}
