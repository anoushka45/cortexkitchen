"use client";

import { useState, useRef, useEffect } from "react";
import {
  BarChart, Bar,
  LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, Cell, ReferenceLine,
} from "recharts";
import { CardFooter, ICONS, PriorityGauge, RecommendationBlock, SectionTitle, StatGrid } from "./AgentStatStrip";

interface ForecastRecommendation {
  recommendation?: string;
  reasoning?: string;
  priority?: string;
  risks?: string[];
}

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
  recommendation?: ForecastRecommendation;
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

// Chart data-series color -- kept consistent with every other chart on
// Market/Analytics (CategoryPricingChart, Peak Hours), not the UI-chrome
// accent (--color-accent / #FF5200): this softer amber reads better as a
// large chart fill/line than the vivid brand orange does.
const CHART_COLOR = "#efa345";

const CONFIDENCE_TONE: Record<string, string> = {
  high: "text-emerald-600 dark:text-emerald-300",
  medium: "text-amber-600 dark:text-amber-300",
  low: "text-rose-600 dark:text-rose-300",
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
    // final_assembler.py's _safe_rec() flattens the LLM recommendation
    // object up to the top level (merged with "data"), so recommendation/
    // reasoning/priority/risks are sibling keys on `raw` directly -- never
    // a nested raw.recommendation object.
    recommendation: {
      recommendation: typeof raw.recommendation === "string" ? raw.recommendation : undefined,
      reasoning: typeof raw.reasoning === "string" ? raw.reasoning : undefined,
      priority: typeof raw.priority === "string" ? raw.priority : undefined,
      risks: Array.isArray(raw.risks) ? raw.risks.filter((r): r is string => typeof r === "string") : undefined,
    },
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
    // ResizeObserver fires its callback once immediately after observe(),
    // so no separate synchronous initial measurement is needed here.
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
    avg_friday_orders,
    avg_same_day_orders,
    service_window,
    top_items,
    recommendation,
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

  const avgRef = avg_same_day_orders ?? avg_friday_orders;
  const vsAvgPct = avgRef && avgRef > 0 ? Math.round(((roundedOrders - avgRef) / avgRef) * 100) : null;
  const vsAvgTone = vsAvgPct === null ? "text-[var(--color-text-primary)]"
    : vsAvgPct >= 10 ? "text-emerald-600 dark:text-emerald-300"
    : vsAvgPct <= -10 ? "text-rose-600 dark:text-rose-300"
    : "text-[var(--color-text-primary)]";
  const peakHourLabel = data.find((d) => d.covers === peak)?.hour ?? "--";

  return (
    <div className="@container flex flex-col gap-5">
      {/* Recommendation (left) + stat grid & priority gauge (right) side by side */}
      <div className="grid grid-cols-1 gap-4 @3xl:grid-cols-[1.3fr_1fr] @3xl:items-stretch">
        <RecommendationBlock
          recommendation={recommendation?.recommendation ?? null}
          reasoning={recommendation?.reasoning}
          priority={recommendation?.priority}
          risks={recommendation?.risks}
        />
        <div className="flex flex-col gap-3">
          <StatGrid stats={[
            { icon: <ICONS.chartBar className="h-4 w-4" strokeWidth={1.8} />, iconColor: "#FF5200", value: String(roundedOrders), label: "Predicted orders", caption: rangeText ? `Range ${rangeText}` : "No range available" },
            {
              icon: <ICONS.trendUp className="h-4 w-4" strokeWidth={1.8} />, iconColor: vsAvgPct !== null && vsAvgPct < 0 ? "#F43F5E" : "#10B981",
              value: vsAvgPct !== null ? `${vsAvgPct >= 0 ? "+" : ""}${vsAvgPct}%` : "--", valueClass: vsAvgTone,
              label: "vs your average", caption: avgRef ? `avg ${avgRef} orders` : "no baseline yet",
            },
            { icon: <ICONS.clock className="h-4 w-4" strokeWidth={1.8} />, iconColor: "#8B5CF6", value: peakHourLabel, label: "Peak hour", caption: `${peak} covers expected` },
            {
              icon: <ICONS.shieldCheck className="h-4 w-4" strokeWidth={1.8} />, iconColor: confidence === "high" ? "#10B981" : confidence === "low" ? "#F43F5E" : "#F59E0B",
              value: confidence.charAt(0).toUpperCase() + confidence.slice(1), valueClass: CONFIDENCE_TONE[confidence],
              label: "Confidence", caption: method === "prophet" ? "Prophet AI model" : "Baseline estimate",
            },
          ]} />
          <PriorityGauge priority={recommendation?.priority} />
        </div>
      </div>

      {/* Top items */}
      {top_items && top_items.length > 0 && (
        <div className="grid grid-cols-1 gap-2.5 @lg:grid-cols-2">
          {top_items.slice(0, 2).map((item, index) => (
            <div key={`${item.item}-${index}`}
              className="flex items-center justify-between gap-3 rounded-xl bg-[var(--color-surface-raised)] px-4 py-3 ring-1 ring-[var(--color-border-soft)]">
              <div className="min-w-0">
                <p className="truncate text-[13px] font-semibold text-[var(--color-text-primary)]">{item.item}</p>
                <p className="text-[10.5px] text-[var(--color-text-faint)]">{item.category} &middot; {item.total_ordered} orders</p>
              </div>
              <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-[10px] font-semibold ring-1 ${index === 0 ? "bg-amber-500/10 text-amber-600 dark:text-amber-300 ring-amber-400/25" : "bg-emerald-500/10 text-emerald-600 dark:text-emerald-300 ring-emerald-400/25"}`}>
                {index === 0 ? "ease" : "push"}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Chart */}
      <div>
        <SectionTitle
          title="Demand Pacing"
          right={
            <div className="flex items-center gap-1 rounded-lg bg-[var(--color-surface-raised)] p-0.5 ring-1 ring-[var(--color-border-soft)]">
              {(["bar", "line"] as const).map((type) => (
                <button
                  key={type}
                  onClick={() => setChartType(type)}
                  className={`flex items-center gap-1 rounded-md px-2.5 py-1 text-[10.5px] font-medium capitalize transition-colors ${chartType === type ? "bg-[var(--color-surface)] text-[var(--color-text-primary)] shadow-sm" : "text-[var(--color-text-faint)]"}`}
                >
                  {type}
                </button>
              ))}
            </div>
          }
        />

        <div ref={chartContainerRef} style={{ height: 200 }}>
          {chartType === "bar" ? (
            <BarChart width={chartWidth} height={200} data={data} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border-soft)" vertical={false} />
              <XAxis dataKey="hour" tick={{ fontSize: 10, fill: "var(--color-text-faint)" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 10, fill: "var(--color-text-faint)" }} axisLine={false} tickLine={false} />
              <ReferenceLine y={avg} stroke="var(--color-border-default)" strokeDasharray="4 4"
                label={{ value: "avg", position: "right", fontSize: 10, fill: "var(--color-text-faint)" }} />
              <Tooltip
                contentStyle={{ background: "var(--color-surface-raised)", border: "1px solid var(--color-border-default)", borderRadius: 10, fontSize: 12, color: "var(--color-text-primary)" }}
                labelStyle={{ color: "var(--color-text-faint)" }}
                formatter={(value: unknown) => [`${value} covers`, "Expected"]}
                cursor={{ fill: "rgba(239,163,69,0.08)" }}
              />
              <Bar dataKey="covers" radius={[3, 3, 0, 0]}>
                {data.map((entry) => (
                  <Cell
                    key={entry.hour}
                    fill={entry.covers === peak ? CHART_COLOR : entry.inWindow ? `${CHART_COLOR}90` : `${CHART_COLOR}35`}
                    style={entry.covers === peak ? { filter: "drop-shadow(0 0 10px rgba(239,163,69,0.45))" } : undefined}
                  />
                ))}
              </Bar>
            </BarChart>
          ) : (
            <LineChart width={chartWidth} height={200} data={data} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border-soft)" vertical={false} />
              <XAxis dataKey="hour" tick={{ fontSize: 10, fill: "var(--color-text-faint)" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 10, fill: "var(--color-text-faint)" }} axisLine={false} tickLine={false} />
              <ReferenceLine y={avg} stroke="var(--color-border-default)" strokeDasharray="4 4"
                label={{ value: "avg", position: "right", fontSize: 10, fill: "var(--color-text-faint)" }} />
              <Tooltip
                contentStyle={{ background: "var(--color-surface-raised)", border: "1px solid var(--color-border-default)", borderRadius: 10, fontSize: 12, color: "var(--color-text-primary)" }}
                labelStyle={{ color: "var(--color-text-faint)" }}
                formatter={(value: unknown) => [`${value} covers`, "Expected"]}
              />
              <Line
                type="monotone" dataKey="covers" stroke={CHART_COLOR} strokeWidth={2}
                dot={(props) => {
                  const { cx, cy, payload } = props as { cx: number; cy: number; payload: HourBar };
                  if (payload.covers !== peak) return <g key={props.key} />;
                  return <circle key={props.key} cx={cx} cy={cy} r={4} fill={CHART_COLOR} stroke="var(--color-surface-raised)" strokeWidth={2} style={{ filter: "drop-shadow(0 0 8px rgba(239,163,69,0.5))" }} />;
                }}
                activeDot={{ r: 5, fill: CHART_COLOR, stroke: "var(--color-surface-raised)", strokeWidth: 2 }}
              />
            </LineChart>
          )}
        </div>
      </div>

      <CardFooter label="Service window" value={service_window ?? "18:00-22:00"} />
    </div>
  );
}
