"use client";

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Cell } from "recharts";
import { MarketSlotAvailability } from "@/lib/api";

const SIGNAL_COLOR: Record<string, string> = {
  HIGH: "#fb7185",
  MEDIUM: "#f5be73",
  LOW: "#34d399",
};

export default function OccupancyBySlotChart({ data }: { data: MarketSlotAvailability[] }) {
  if (data.length === 0) return null;

  return (
    <div>
      <p className="mb-1 text-[9px] uppercase tracking-widest text-[var(--color-text-ghost)]">
        Occupancy by dinner slot tonight
      </p>
      <BarChart width={480} height={150} data={data} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
        <XAxis dataKey="time" tick={{ fontSize: 9, fill: "#6b7280" }} axisLine={false} tickLine={false} />
        <YAxis tick={{ fontSize: 9, fill: "#6b7280" }} axisLine={false} tickLine={false} />
        <Tooltip
          contentStyle={{ background: "#0b1020", border: "1px solid rgba(230,137,42,0.2)", borderRadius: 10, fontSize: 12, color: "#f8fafc" }}
          formatter={(value: unknown, _name, payload) => [`${value} seats avg`, payload?.payload?.signal ?? ""]}
        />
        <Bar dataKey="avg_availability" radius={[3, 3, 0, 0]}>
          {data.map((entry, i) => (
            <Cell key={i} fill={SIGNAL_COLOR[entry.signal] ?? "#6b7280"} />
          ))}
        </Bar>
      </BarChart>
      <div className="mt-2 flex items-center gap-3 text-[9px] text-[var(--color-text-ghost)]">
        {(["HIGH", "MEDIUM", "LOW"] as const).map((s) => (
          <span key={s} className="flex items-center gap-1">
            <span className="h-1.5 w-1.5 rounded-full" style={{ background: SIGNAL_COLOR[s] }} />
            {s}
          </span>
        ))}
      </div>
    </div>
  );
}
