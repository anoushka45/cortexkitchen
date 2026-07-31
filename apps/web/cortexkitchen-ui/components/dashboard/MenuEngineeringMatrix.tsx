"use client";

// Menu Engineering -- groups dishes by volume (how many sold) and margin
// (profit per dish) into the classic Stars/Plowhorses/Puzzles/Dogs buckets,
// but a scatter-plot rendering of that never landed for a non-technical
// audience (empty-looking chart, unreadable axes) no matter how it was
// polished. The classification logic is real and worth keeping -- it just
// needed to surface as a plain "here's what to do" action list instead of
// a chart, which is what this renders now.

import { useMemo } from "react";
import type { BusinessDishPerformance } from "@/lib/api";

type Quadrant = "star" | "plowhorse" | "puzzle" | "dog";

// Plain titles, not the classic "menu engineering" jargon (Stars/Plowhorses/
// Puzzles/Dogs) -- that never landed for a non-technical owner even with an
// explanatory sentence underneath. Every card shares the same white/gold
// background (color only lives in the label text), and all four label
// colors stay within one warm family (Swiggy orange / gold / brown) --
// no green/red/grey semantic colors here, this isn't a status indicator.
const QUADRANT_META: Record<Quadrant, { label: string; color: string; action: string }> = {
  star:      { label: "Top Performers",      color: "#FF5200",  action: "Doing great — keep them exactly as they are." },
  plowhorse: { label: "Popular, Low Profit", color: "#D97706",  action: "Popular but thin margins — try a small price increase." },
  puzzle:    { label: "Hidden Gems",         color: "#92400E",  action: "Very profitable but underexposed — promote these more." },
  dog:       { label: "Underperforming",     color: "#C2410C",  action: "Low sales and thin margins — consider reworking or removing." },
};

const ORDER: Quadrant[] = ["puzzle", "dog", "star", "plowhorse"];

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

export default function MenuEngineeringMatrix({ dishes }: { dishes: BusinessDishPerformance[] }) {
  const { groups, excludedCount } = useMemo(() => {
    const plottable = dishes.filter((d) => d.margin_pct !== null);
    const medianQty = median(plottable.map((d) => d.quantity));
    const medianMargin = median(plottable.map((d) => d.margin_pct as number));
    const groups: Record<Quadrant, BusinessDishPerformance[]> = { star: [], plowhorse: [], puzzle: [], dog: [] };
    for (const d of plottable) {
      const margin = d.margin_pct as number;
      const q: Quadrant =
        d.quantity >= medianQty
          ? (margin >= medianMargin ? "star" : "plowhorse")
          : (margin >= medianMargin ? "puzzle" : "dog");
      groups[q].push(d);
    }
    return { groups, excludedCount: dishes.length - plottable.length };
  }, [dishes]);

  const total = Object.values(groups).reduce((sum, g) => sum + g.length, 0);
  if (total === 0) return null;

  return (
    <div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {ORDER.map((q) => {
          const meta = QUADRANT_META[q];
          const items = groups[q];
          if (items.length === 0) return null;
          return (
            <div
              key={q}
              className="relative overflow-hidden rounded-xl border border-[var(--color-border-soft)] bg-[var(--color-surface-raised)] py-3 pl-4 pr-3.5 shadow-sm"
            >
              <span className="absolute inset-y-0 left-0 w-[3px]" style={{ background: meta.color }} />
              <div className="flex items-start justify-between gap-2">
                <p className="text-[12.5px] font-bold" style={{ color: meta.color }}>{meta.label}</p>
                <span
                  className="shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold"
                  style={{ background: `color-mix(in srgb, ${meta.color} 14%, transparent)`, color: meta.color }}
                >
                  {items.length}
                </span>
              </div>
              <p className="mt-0.5 text-[11px] leading-snug text-[var(--color-text-soft)]">{meta.action}</p>
              <div className="mt-2.5 flex flex-wrap gap-1.5">
                {items.map((d) => (
                  <span
                    key={d.name}
                    className="rounded-full border px-2.5 py-1 text-[11px] font-medium text-[var(--color-text-primary)]"
                    style={{ borderColor: "rgba(255,82,0,0.2)", background: "rgba(255,82,0,0.05)" }}
                  >
                    {d.name}
                  </span>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      <p className="mt-3 text-[10px] leading-snug text-[var(--color-text-faint)]">
        Based on how each dish sells and earns compared to the rest of <em>your own</em> menu, not an industry average.
        {excludedCount > 0 && ` ${excludedCount} dish${excludedCount !== 1 ? "es" : ""} excluded — no cost price set.`}
      </p>
    </div>
  );
}
