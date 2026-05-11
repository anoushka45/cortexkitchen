"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  ReferenceLine,
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
  baseline: "text-slate-400",
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
    <div className="card p-6 h-full flex flex-col">
      <div className="mb-6 flex flex-col gap-5">
        <div className="flex items-start justify-between gap-6">
          <div className="min-w-0 flex-1">
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <span className="text-xs font-mono uppercase tracking-widest text-slate-500">
                Demand Forecast
              </span>
              <span
                className={`rounded-full bg-white/5 px-2 py-0.5 text-xs font-mono ${CONFIDENCE_COLORS[confidence]}`}
              >
                {confidence} confidence
              </span>
            </div>
            <h3 className="truncate text-base font-semibold text-slate-200">
              {target_date
                ? `${service_day_label ?? "Service"} ${new Date(target_date).toLocaleDateString()}`
                : "Next planning window"}
            </h3>
            <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-slate-500">
              <span className={`font-mono ${METHOD_COLORS[method]}`}>
                {method === "prophet" ? "Prophet AI" : "Baseline"}
              </span>
              {(avg_same_day_orders ?? avg_friday_orders) !== undefined && (
                <span>
                  Avg last 4 matching days: {avg_same_day_orders ?? avg_friday_orders}
                </span>
              )}
              {avg_peak_orders !== undefined && <span>Avg peak: {avg_peak_orders}</span>}
            </div>
          </div>
          <div className="text-right">
            <p className="text-4xl font-semibold tracking-tight text-violet-400">
              {roundedOrders}
            </p>
            <p className="mt-1 text-xs uppercase tracking-[0.2em] text-slate-500">
              predicted orders
            </p>
            {rangeText && <p className="mt-1 text-xs text-slate-500">range: {rangeText}</p>}
          </div>
        </div>

        {top_items && top_items.length > 0 && (
          <div className="grid grid-cols-2 gap-3 text-xs text-slate-400">
            {top_items.slice(0, 2).map((item, index) => (
              <div
                key={`${item.item}-${index}`}
                className="rounded-2xl border border-white/10 bg-white/5 p-3"
              >
                <p className="truncate font-semibold text-slate-200">{item.item}</p>
                <p className="mt-1 text-[11px] text-slate-500">
                  {item.category} · {item.total_ordered} orders
                </p>
              </div>
            ))}
          </div>
        )}
      </div>

      <ResponsiveContainer width="100%" height={250}>
          <BarChart data={data} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
            <CartesianGrid
              strokeDasharray="3 3"
              stroke="rgba(255,255,255,0.05)"
              vertical={false}
            />
            <XAxis
              dataKey="hour"
              tick={{ fontSize: 10, fill: "#94a3b8", fontFamily: "Space Mono" }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              tick={{ fontSize: 10, fill: "#94a3b8", fontFamily: "Space Mono" }}
              axisLine={false}
              tickLine={false}
            />
            <ReferenceLine
              y={avg}
              stroke="rgba(139,92,246,0.3)"
              strokeDasharray="4 4"
              label={{ value: "avg", position: "right", fontSize: 9, fill: "#94a3b8" }}
            />
            <Tooltip
              contentStyle={{
                background: "#0d1320",
                border: "1px solid rgba(139,92,246,0.2)",
                borderRadius: "10px",
                fontSize: "12px",
                fontFamily: "Space Mono",
                color: "#f8fafc",
              }}
              itemStyle={{ color: "#e2e8f0" }}
              labelStyle={{ color: "#94a3b8" }}
              formatter={(value: unknown) => [`${value} covers`, "Expected"]}
              cursor={{ fill: "rgba(139,92,246,0.08)" }}
            />
            <Bar dataKey="covers" radius={[4, 4, 0, 0]}>
              {data.map((entry) => (
                <Cell
                  key={entry.hour}
                  fill={
                    entry.covers === peak
                      ? "#8b5cf6"
                      : entry.inWindow
                        ? "rgba(139,92,246,0.45)"
                        : "rgba(139,92,246,0.18)"
                  }
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>

      <div className="mt-4 border-t border-white/5 pt-3 grid grid-cols-3 gap-2">
        <div>
          <p className="text-[10px] font-mono uppercase tracking-widest text-slate-500">Peak / hr</p>
          <p className="mt-0.5 text-sm font-semibold text-slate-200">{peak} covers</p>
        </div>
        <div>
          <p className="text-[10px] font-mono uppercase tracking-widest text-slate-500">Avg / hr</p>
          <p className="mt-0.5 text-sm font-semibold text-slate-200">{avg} covers</p>
        </div>
        <div>
          <p className="text-[10px] font-mono uppercase tracking-widest text-slate-500">Window</p>
          <p className="mt-0.5 text-sm font-semibold text-slate-200">{service_window ?? "18:00-22:00"}</p>
        </div>
      </div>
      {rangeText && (
        <p className="mt-2 text-[10px] font-mono text-slate-500">range: {rangeText} covers</p>
      )}
    </div>
  );
}
