"use client";

import { useEffect, useState } from "react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip } from "recharts";
import { getMarketTrends, MarketTrendsResponse } from "@/lib/api";

const OCCUPANCY_Y: Record<string, number> = { LOW: 1, MEDIUM: 2, HIGH: 3 };
const OCCUPANCY_LABEL: Record<number, string> = { 1: "LOW", 2: "MEDIUM", 3: "HIGH" };

export default function MarketTrendChart() {
  const [data, setData] = useState<MarketTrendsResponse | null>(null);
  const [dish, setDish] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    getMarketTrends(14)
      .then((res) => {
        if (cancelled) return;
        setData(res);
        const dishes = Object.keys(res.price_trends);
        if (dishes.length) setDish(dishes[0]);
      })
      .catch((err) => !cancelled && setError(err instanceof Error ? err.message : "Failed to load trends"))
      .finally(() => !cancelled && setLoading(false));
    return () => { cancelled = true; };
  }, []);

  if (loading) {
    return (
      <div className="rounded-2xl border border-[var(--color-border-default)] bg-[var(--color-surface-raised)] p-5">
        <p className="text-sm text-[var(--color-text-faint)]">Loading price trends…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-2xl border border-[var(--color-border-default)] bg-[var(--color-surface-raised)] p-5">
        <p className="text-sm text-rose-400">{error}</p>
      </div>
    );
  }

  if (!data || data.days_returned < 3) {
    return (
      <div className="rounded-2xl border border-[var(--color-border-default)] bg-[var(--color-surface-raised)] p-5 text-center">
        <p className="text-sm font-medium text-[var(--color-text-primary)]">Not enough history yet</p>
        <p className="mt-1 text-xs text-[var(--color-text-faint)]">
          {data?.note ?? "Run 3+ plans to see pricing trends."}
        </p>
      </div>
    );
  }

  const dishes = Object.keys(data.price_trends);
  const priceSeries = dish ? data.price_trends[dish] ?? [] : [];
  const occSeries = data.occupancy_trend.map((p) => ({
    date: p.date,
    occupancy: OCCUPANCY_Y[p.signal] ?? 2,
  }));

  return (
    <div className="rounded-2xl border border-[var(--color-border-default)] bg-[var(--color-surface-raised)] p-5">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <p className="text-xs uppercase tracking-widest text-[var(--color-text-faint)]">
          Price &amp; Occupancy Trend
        </p>
        {dishes.length > 0 && (
          <select
            value={dish ?? ""}
            onChange={(e) => setDish(e.target.value)}
            className="rounded-md border border-[var(--color-border-soft)] bg-[var(--color-surface-page)] px-2 py-1 text-xs text-[var(--color-text-primary)] capitalize"
          >
            {dishes.map((d) => (
              <option key={d} value={d} className="capitalize">{d}</option>
            ))}
          </select>
        )}
      </div>

      {priceSeries.length > 0 && (
        <div className="mb-4">
          <p className="mb-1 text-[9px] uppercase tracking-widest text-[var(--color-text-ghost)]">
            Area avg price — {dish}
          </p>
          <LineChart width={480} height={160} data={priceSeries} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
            <XAxis dataKey="date" tick={{ fontSize: 9, fill: "#6b7280" }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 9, fill: "#6b7280" }} axisLine={false} tickLine={false} />
            <Tooltip
              contentStyle={{ background: "#0b1020", border: "1px solid rgba(230,137,42,0.2)", borderRadius: 10, fontSize: 12, color: "#f8fafc" }}
              formatter={(value: unknown) => [`₹${value}`, "Area avg"]}
            />
            <Line type="monotone" dataKey="area_avg" stroke="#efa345" strokeWidth={2} dot={{ r: 3, fill: "#efa345" }} />
          </LineChart>
        </div>
      )}

      {occSeries.length > 0 && (
        <div>
          <p className="mb-1 text-[9px] uppercase tracking-widest text-[var(--color-text-ghost)]">
            Area occupancy signal
          </p>
          <LineChart width={480} height={120} data={occSeries} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
            <XAxis dataKey="date" tick={{ fontSize: 9, fill: "#6b7280" }} axisLine={false} tickLine={false} />
            <YAxis
              domain={[1, 3]}
              ticks={[1, 2, 3]}
              tickFormatter={(v: number) => OCCUPANCY_LABEL[v] ?? ""}
              tick={{ fontSize: 9, fill: "#6b7280" }}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip
              contentStyle={{ background: "#0b1020", border: "1px solid rgba(230,137,42,0.2)", borderRadius: 10, fontSize: 12, color: "#f8fafc" }}
              formatter={(value: unknown) => [OCCUPANCY_LABEL[Number(value)] ?? value, "Occupancy"]}
            />
            <Line type="stepAfter" dataKey="occupancy" stroke="#f97373" strokeWidth={2} dot={{ r: 3, fill: "#f97373" }} />
          </LineChart>
        </div>
      )}
    </div>
  );
}
