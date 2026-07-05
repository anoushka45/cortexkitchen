"use client";

import type { ReactNode } from "react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, LabelList } from "recharts";
import { MarketCategoryPricing } from "@/lib/api";

export default function CategoryPricingChart({ data }: { data: MarketCategoryPricing[] }) {
  if (data.length === 0) return null;

  const chartData = data.map((c) => ({
    category: c.category.length > 12 ? `${c.category.slice(0, 11)}…` : c.category,
    fullCategory: c.category,
    "Your avg": c.your_avg,
    "Area avg": c.area_avg,
    diffPct: c.diff_pct,
  }));

  return (
    <div>
      <p className="mb-1 text-[9px] uppercase tracking-widest text-[var(--color-text-ghost)]">
        Category pricing — you vs area
      </p>
      <BarChart width={480} height={180} data={chartData} margin={{ top: 16, right: 4, left: -20, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
        <XAxis dataKey="category" tick={{ fontSize: 9, fill: "#6b7280" }} axisLine={false} tickLine={false} />
        <YAxis tick={{ fontSize: 9, fill: "#6b7280" }} axisLine={false} tickLine={false} />
        <Tooltip
          contentStyle={{ background: "#0b1020", border: "1px solid rgba(230,137,42,0.2)", borderRadius: 10, fontSize: 12, color: "#f8fafc" }}
          labelFormatter={(_, payload) => payload?.[0]?.payload?.fullCategory ?? ""}
          formatter={(value: unknown) => [`₹${value}`, ""]}
        />
        <Legend wrapperStyle={{ fontSize: 10 }} />
        <Bar dataKey="Your avg" fill="#efa345" radius={[3, 3, 0, 0]}>
          <LabelList dataKey="Your avg" position="top" style={{ fontSize: 9, fill: "#efa345" }} formatter={(v?: ReactNode) => (v != null ? `₹${v}` : "")} />
        </Bar>
        <Bar dataKey="Area avg" fill="#64748b" radius={[3, 3, 0, 0]} />
      </BarChart>
    </div>
  );
}
