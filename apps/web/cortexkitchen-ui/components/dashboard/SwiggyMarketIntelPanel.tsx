"use client";

import Image from "next/image";
import { FridayRushResponse } from "@/types/planning";

function SwiggyBadge() {
  return (
    <div className="flex items-center gap-1.5">
      <div className="flex h-4 w-4 items-center justify-center rounded bg-white p-0.5">
        <Image src="/swiggy-logo.png" alt="Swiggy" width={12} height={12} className="h-full w-full object-contain" />
      </div>
      <span className="text-[9px] font-mono uppercase tracking-widest text-slate-500">via Swiggy MCP</span>
    </div>
  );
}

function priceStats(priceMap: Record<string, number>) {
  const vals = Object.values(priceMap).filter((v) => typeof v === "number" && v > 0);
  if (!vals.length) return null;
  return {
    avg:   Math.round(vals.reduce((a, b) => a + b, 0) / vals.length),
    min:   Math.round(Math.min(...vals)),
    max:   Math.round(Math.max(...vals)),
    count: vals.length,
  };
}

export default function SwiggyMarketIntelPanel({ data }: { data: FridayRushResponse }) {
  const mi = data.market_intel as Record<string, unknown> | null | undefined;
  if (!mi) return null;

  const competitorPricing = mi.competitor_pricing as Record<string, number> | null | undefined;
  const procurement       = mi.procurement_options as Array<Record<string, unknown>> | null | undefined;
  const occupancy         = (data.swiggy_occupancy_context ?? mi.area_occupancy) as Record<string, unknown> | null | undefined;
  const pricingAlerts     = (mi.pricing_alerts as unknown[]) ?? [];
  const fetchedAt         = mi.fetched_at as string | null;

  const stats = competitorPricing ? priceStats(competitorPricing) : null;
  const topDishes = competitorPricing
    ? Object.entries(competitorPricing)
        .sort(([, a], [, b]) => (b as number) - (a as number))
        .slice(0, 8)
    : [];

  const hasAny = stats || occupancy || (procurement && procurement.length > 0);
  if (!hasAny) return null;

  return (
    <div className="mt-10 space-y-4">
      {/* Section header */}
      <div className="px-1 flex items-center gap-3">
        <div className="h-10 w-1 rounded-full flex-shrink-0 bg-orange-400/70" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 flex-wrap">
            <p className="text-xs font-mono uppercase tracking-[0.18em] text-orange-300/80">Market Intelligence</p>
            <SwiggyBadge />
            {fetchedAt && (
              <span className="text-[9px] font-mono text-slate-600">fetched {fetchedAt}</span>
            )}
          </div>
          <p className="mt-1 text-sm text-slate-400">
            Live competitor pricing and area data from Swiggy MCP — used to shape tonight&rsquo;s menu and pricing strategy.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">

        {/* Competitor Pricing */}
        <div className="xl:col-span-2 rounded-2xl border border-white/[0.07] bg-white/[0.02] p-5">
          <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
            <p className="text-xs font-mono uppercase tracking-widest text-slate-500">Competitor Pricing</p>
            <SwiggyBadge />
          </div>

          {stats ? (
            <>
              {/* Stats row */}
              <div className="grid grid-cols-3 gap-2 mb-4">
                {[
                  { label: "Area avg",  value: `₹${stats.avg}`,   color: "text-white" },
                  { label: "Cheapest",  value: `₹${stats.min}`,   color: "text-emerald-400" },
                  { label: "Highest",   value: `₹${stats.max}`,   color: "text-rose-400" },
                ].map(({ label, value, color }) => (
                  <div key={label} className="rounded-xl border border-white/[0.06] bg-white/[0.03] p-3 text-center">
                    <p className="text-[9px] font-mono uppercase tracking-widest text-slate-600">{label}</p>
                    <p className={`mt-1 text-lg font-bold tabular-nums ${color}`}>{value}</p>
                  </div>
                ))}
              </div>

              {/* Top dishes table */}
              <p className="text-[9px] font-mono uppercase tracking-widest text-slate-600 mb-2">
                Top priced items nearby ({stats.count} dishes tracked)
              </p>
              <div className="space-y-1 max-h-[200px] overflow-y-auto pr-1 scrollbar-thin">
                {topDishes.map(([dish, price]) => (
                  <div key={dish} className="flex items-center justify-between rounded-lg border border-white/[0.04] bg-white/[0.02] px-3 py-1.5">
                    <span className="text-xs text-slate-300 capitalize truncate mr-3">{dish}</span>
                    <span className="font-mono text-xs font-semibold text-white shrink-0">₹{price}</span>
                  </div>
                ))}
                {Object.keys(competitorPricing!).length > 8 && (
                  <p className="text-[10px] text-slate-600 text-center py-1">
                    +{Object.keys(competitorPricing!).length - 8} more dishes tracked
                  </p>
                )}
              </div>

              {pricingAlerts.length > 0 && (
                <div className="mt-3 space-y-1.5">
                  <p className="text-[9px] font-mono uppercase tracking-widest text-slate-600">Pricing alerts</p>
                  {(pricingAlerts as Record<string, unknown>[]).map((a, i) => (
                    <div key={i} className={`flex items-center justify-between rounded-lg border px-3 py-2 text-xs ${
                      a.direction === "above"
                        ? "border-rose-500/25 bg-rose-500/[0.06] text-rose-300"
                        : "border-emerald-500/25 bg-emerald-500/[0.06] text-emerald-300"
                    }`}>
                      <span className="font-medium">{a.item as string}</span>
                      <span className="font-mono">
                        ₹{a.your_price as number} vs ₹{Math.round(a.area_avg as number)} avg
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </>
          ) : (
            <p className="text-sm text-slate-600 italic">No competitor pricing data for this area.</p>
          )}
        </div>

        {/* Right column: Occupancy + Procurement */}
        <div className="space-y-4">

          {/* Area Occupancy */}
          <div className="rounded-2xl border border-white/[0.07] bg-white/[0.02] p-5">
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-mono uppercase tracking-widest text-slate-500">Area Occupancy</p>
              <SwiggyBadge />
            </div>
            {occupancy ? (
              <div className="space-y-2">
                <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium ${
                  occupancy.signal === "HIGH"
                    ? "border-rose-500/30 bg-rose-500/10 text-rose-300"
                    : occupancy.signal === "MEDIUM"
                    ? "border-amber-500/30 bg-amber-500/10 text-amber-300"
                    : "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
                }`}>
                  <span className={`h-1.5 w-1.5 rounded-full ${
                    occupancy.signal === "HIGH" ? "bg-rose-400" : occupancy.signal === "MEDIUM" ? "bg-amber-400" : "bg-emerald-400"
                  }`} />
                  {String(occupancy.signal)} occupancy area
                </span>
                <p className="text-xs text-slate-400">
                  Tonight busy: <span className={occupancy.tonight_busy ? "text-rose-300 font-medium" : "text-emerald-300 font-medium"}>
                    {occupancy.tonight_busy ? "Yes" : "No"}
                  </span>
                </p>
              </div>
            ) : (
              <p className="text-xs text-slate-600 italic">Occupancy data unavailable.</p>
            )}
          </div>

          {/* Instamart Procurement */}
          <div className="rounded-2xl border border-white/[0.07] bg-white/[0.02] p-5">
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-mono uppercase tracking-widest text-slate-500">Instamart Prices</p>
              <SwiggyBadge />
            </div>
            {procurement && procurement.length > 0 ? (
              <div className="space-y-1.5">
                {procurement.slice(0, 5).map((item, i) => (
                  <div key={i} className="flex items-center justify-between rounded-lg border border-white/[0.05] bg-white/[0.02] px-3 py-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${item.in_stock ? "bg-emerald-400" : "bg-slate-600"}`} />
                      <span className="text-xs text-slate-300 truncate">{item.name as string}</span>
                    </div>
                    <span className="font-mono text-xs font-semibold text-white shrink-0">₹{item.price as number}/{item.unit as string}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-slate-600 italic">No shortage items identified yet.</p>
            )}
          </div>

        </div>
      </div>
    </div>
  );
}
