"use client";

import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Cell, ReferenceLine,
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
  avg_peak_orders?: number;
  top_items?: Array<{ item: string; category: string; total_ordered: number }>;
}

interface Props {
  forecast: Record<string, unknown> | null;
}

function toNumber(value: unknown): number | undefined {
  if (value === null || value === undefined) return undefined;
  const num = Number(value);
  return Number.isFinite(num) ? num : undefined;
}

function normalizeForecastData(raw: Record<string, unknown> | null): ForecastData | null {
  if (!raw) return null;

  const nested = raw.data as Record<string, unknown> | undefined;
  const payload = nested && typeof nested === "object" ? nested : raw;

  const predictedOrders = toNumber(payload.predicted_orders ?? payload.predictedOrders ?? payload.predicted_covers ?? payload.predictedCovers);
  if (predictedOrders === undefined) return null;

  const predictedLower = toNumber(payload.predicted_orders_lower ?? payload.predictedOrdersLower ?? payload.predicted_orders_lower);
  const predictedUpper = toNumber(payload.predicted_orders_upper ?? payload.predictedOrdersUpper ?? payload.predicted_orders_upper);

  return {
    predicted_orders: predictedOrders,
    predicted_orders_lower: predictedLower,
    predicted_orders_upper: predictedUpper,
    predicted_peak_orders: toNumber(payload.predicted_peak_orders ?? payload.predictedPeakOrders),
    method: String(payload.method ?? payload.model ?? "baseline") as "prophet" | "baseline",
    confidence: String(payload.confidence ?? "medium") as "high" | "medium" | "low",
    target_date: payload.target_date ? String(payload.target_date) : undefined,
    avg_friday_orders: toNumber(payload.avg_friday_orders),
    avg_peak_orders: toNumber(payload.avg_peak_orders),
    top_items: Array.isArray(payload.top_items) ? payload.top_items as Array<{ item: string; category: string; total_ordered: number }> : undefined,
  };
}

function generateRushData(dailyOrders: number) {
  const distribution: Record<string, number> = {
    "12:00": 0.06, "13:00": 0.08, "14:00": 0.05,
    "15:00": 0.03, "16:00": 0.04, "17:00": 0.07,
    "18:00": 0.12, "19:00": 0.18, "20:00": 0.16,
    "21:00": 0.11, "22:00": 0.07, "23:00": 0.03,
  };
  return Object.entries(distribution).map(([hour, pct]) => ({
    hour,
    covers: Math.max(1, Math.round(dailyOrders * pct)),
  }));
}

const RUSH_HOURS = ["18:00", "19:00", "20:00", "21:00", "22:00"];
const CONFIDENCE_COLORS: Record<string, string> = {
  high: "text-emerald-400",
  medium: "text-amber-400",
  low: "text-rose-400",
};
const METHOD_COLORS: Record<string, string> = {
  prophet: "text-blue-400",
  baseline: "text-slate-400",
};

export default function ForecastChart({ forecast }: Props) {
  const forecastData = normalizeForecastData(forecast);
  if (!forecastData) return null;

  const {
    predicted_orders,
    predicted_orders_lower,
    predicted_orders_upper,
    predicted_peak_orders,
    method = "baseline",
    confidence = "medium",
    target_date,
    avg_friday_orders,
    avg_peak_orders,
    top_items,
  } = forecastData;

  const roundedOrders = Math.round(predicted_orders);
  const data = generateRushData(roundedOrders);
  const peak = Math.max(...data.map((d) => d.covers));
  const avg = Math.round(data.reduce((sum, d) => sum + d.covers, 0) / data.length);

  const hasRange = predicted_orders_lower !== undefined && predicted_orders_upper !== undefined;
  const rangeText = hasRange ? `${Math.round(predicted_orders_lower)}–${Math.round(predicted_orders_upper)}` : null;

  return (
    <div className="card p-6 h-full">
      <div className="flex flex-col gap-5 mb-6">
        <div className="flex items-start justify-between gap-6">
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2 mb-2">
              <span className="text-xs font-mono uppercase tracking-widest text-slate-500">
                Demand Forecast
              </span>
              <span className={`px-2 py-0.5 rounded-full text-xs font-mono ${CONFIDENCE_COLORS[confidence]} bg-white/5`}>
                {confidence} confidence
              </span>
            </div>
            <h3 className="text-base font-semibold text-slate-200 truncate">
              {target_date ? `Friday ${new Date(target_date).toLocaleDateString()}` : "Next Friday"}
            </h3>
            <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500 mt-2">
              <span className={`font-mono ${METHOD_COLORS[method]}`}>
                {method === "prophet" ? "🤖 Prophet AI" : "📊 Baseline"}
              </span>
              {avg_friday_orders !== undefined && (
                <span>Avg last 4 Fridays: {avg_friday_orders}</span>
              )}
              {avg_peak_orders !== undefined && (
                <span>Avg peak: {avg_peak_orders}</span>
              )}
            </div>
          </div>
          <div className="text-right">
            <p className="text-4xl font-semibold text-violet-400 tracking-tight">{roundedOrders}</p>
            <p className="text-xs text-slate-500 uppercase tracking-[0.2em] mt-1">predicted orders</p>
            {rangeText && (
              <p className="text-xs text-slate-500 mt-1">range: {rangeText}</p>
            )}
          </div>
        </div>

        {top_items && top_items.length > 0 && (
          <div className="grid grid-cols-2 gap-3 text-xs text-slate-400">
            {top_items.slice(0, 2).map((item, index) => (
              <div key={`${item.item}-${index}`} className="rounded-2xl border border-white/10 bg-white/5 p-3">
                <p className="font-semibold text-slate-200 truncate">{item.item}</p>
                <p className="mt-1 text-[11px] text-slate-500">{item.category} · {item.total_ordered} orders</p>
              </div>
            ))}
          </div>
        )}
      </div>

      <ResponsiveContainer width="100%" height={180}>
        <BarChart data={data} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
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
            formatter={(value: unknown) => [`${value} covers`, "Expected"]}
            labelStyle={{ color: "#cbd5e1" }}
          />
          <Bar dataKey="covers" radius={[4, 4, 0, 0]}>
            {data.map((entry) => (
              <Cell
                key={entry.hour}
                fill={entry.covers === peak ? "#8b5cf6" : RUSH_HOURS.includes(entry.hour) ? "rgba(139,92,246,0.45)" : "rgba(139,92,246,0.18)"}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>

      <div className="mt-4 flex items-center justify-between text-xs text-slate-500">
        <span>Rush window: 18:00–22:00</span>
        <span>Peak: {peak} covers</span>
      </div>
    </div>
  );
}