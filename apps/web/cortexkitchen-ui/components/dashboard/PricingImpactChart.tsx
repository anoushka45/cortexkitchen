"use client";

import type { ReactNode } from "react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Cell, ReferenceLine, LabelList } from "recharts";
import { MarketPricingImpactItem } from "@/lib/api";

export default function PricingImpactChart({ data }: { data: MarketPricingImpactItem[] }) {
  if (data.length === 0) return null;

  const chartData = data.map((p) => ({
    item: p.item.length > 16 ? `${p.item.slice(0, 15)}…` : p.item,
    fullItem: p.item,
    impact: Math.round(p.weekly_revenue_impact_inr),
  }));

  const height = Math.max(120, chartData.length * 34 + 30);

  return (
    <div>
      <p className="mb-1 text-[9px] uppercase tracking-widest text-[var(--color-text-ghost)]">
        Weekly revenue impact — at risk vs upside
      </p>
      <BarChart
        width={480}
        height={height}
        data={chartData}
        layout="vertical"
        margin={{ top: 4, right: 40, left: 8, bottom: 0 }}
      >
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" horizontal={false} />
        <XAxis type="number" tick={{ fontSize: 9, fill: "#6b7280" }} axisLine={false} tickLine={false} />
        <YAxis
          type="category"
          dataKey="item"
          width={90}
          tick={{ fontSize: 9, fill: "#9ca3af" }}
          axisLine={false}
          tickLine={false}
        />
        <ReferenceLine x={0} stroke="#6b7280" />
        <Tooltip
          contentStyle={{ background: "#0b1020", border: "1px solid rgba(230,137,42,0.2)", borderRadius: 10, fontSize: 12, color: "#f8fafc" }}
          labelFormatter={(_, payload) => payload?.[0]?.payload?.fullItem ?? ""}
          formatter={(value: unknown) => [`₹${value}/week`, Number(value) < 0 ? "at risk" : "upside"]}
        />
        <Bar dataKey="impact" radius={[3, 3, 3, 3]}>
          {chartData.map((entry, i) => (
            <Cell key={i} fill={entry.impact < 0 ? "#fb7185" : "#34d399"} />
          ))}
          <LabelList
            dataKey="impact"
            position="right"
            style={{ fontSize: 9, fill: "#9ca3af" }}
            formatter={(v?: ReactNode) => (v != null ? `₹${Math.abs(Number(v))}` : "")}
          />
        </Bar>
      </BarChart>
    </div>
  );
}
