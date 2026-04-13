"use client";

import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Cell, ReferenceLine,
} from "recharts";

interface Props {
  forecast: Record<string, unknown> | null;
}

// Extract predicted order count from the reasoning text or data
function extractPredictedOrders(forecast: Record<string, unknown> | null): number {
  if (!forecast) return 45;
  const reasoning = String(forecast.reasoning ?? "");
  const match = reasoning.match(/predicted orders of ([\d.]+)/i);
  return match ? parseFloat(match[1]) : 45;
}

// Generate realistic hourly rush window data from a daily total
function generateRushData(dailyOrders: number) {
  // Typical restaurant distribution — peaks at 7-8pm Friday
  const distribution: Record<string, number> = {
    "12:00": 0.06, "13:00": 0.08, "14:00": 0.05,
    "15:00": 0.03, "16:00": 0.04, "17:00": 0.07,
    "18:00": 0.12, "19:00": 0.18, "20:00": 0.16,
    "21:00": 0.11, "22:00": 0.07, "23:00": 0.03,
  };
  return Object.entries(distribution).map(([hour, pct]) => ({
    hour,
    covers: Math.round(dailyOrders * pct),
  }));
}

const RUSH_HOURS = ["18:00", "19:00", "20:00", "21:00", "22:00"];

export default function ForecastChart({ forecast }: Props) {
  if (!forecast) return null;

  const predicted = extractPredictedOrders(forecast);
  const data = generateRushData(predicted);
  const peak = Math.max(...data.map((d) => d.covers));
  const avg = Math.round(data.reduce((s, d) => s + d.covers, 0) / data.length);

  return (
    <div className="card p-6 h-full">
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <p className="text-xs font-mono uppercase tracking-widest text-slate-500 mb-1">
            Demand Forecast
          </p>
          <h3 className="text-sm font-semibold text-slate-200">
            Hourly Cover Projection
          </h3>
          <p className="text-xs font-mono text-amber-500/70 mt-0.5">
            ∗ modelled distribution · real hourly data in P2
          </p>
        </div>
        <div className="text-right">
          <p className="font-mono text-2xl font-bold text-violet-400">{predicted}</p>
          <p className="text-xs text-slate-500">predicted orders</p>
        </div>
      </div>

      {/* Chart */}
      <ResponsiveContainer width="100%" height={180}>
        <BarChart data={data} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
          <XAxis
            dataKey="hour"
            tick={{ fontSize: 10, fill: "#475569", fontFamily: "Space Mono" }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            tick={{ fontSize: 10, fill: "#475569", fontFamily: "Space Mono" }}
            axisLine={false}
            tickLine={false}
          />
          <ReferenceLine
            y={avg}
            stroke="rgba(139,92,246,0.3)"
            strokeDasharray="4 4"
            label={{ value: "avg", position: "right", fontSize: 9, fill: "#475569" }}
          />
          <Tooltip
            contentStyle={{
              background: "#0d1320",
              border: "1px solid rgba(139,92,246,0.2)",
              borderRadius: "8px",
              fontSize: "12px",
              fontFamily: "Space Mono",
              color: "#f1f5f9",
            }}
            formatter={(value: unknown) => [`${value} covers`, "Expected"]}
            labelStyle={{ color: "#94a3b8" }}
          />
          <Bar dataKey="covers" radius={[3, 3, 0, 0]}>
            {data.map((entry) => (
              <Cell
                key={entry.hour}
                fill={
                  entry.covers === peak
                    ? "#8b5cf6"
                    : RUSH_HOURS.includes(entry.hour)
                      ? "rgba(139,92,246,0.4)"
                      : "rgba(139,92,246,0.15)"
                }
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>

      <p className="text-xs font-mono text-slate-600 mt-3">
        Peak hour highlighted · Dashed line = hourly avg · Rush window 18:00–22:00
      </p>
    </div>
  );
}