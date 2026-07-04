"use client";

import Image from "next/image";
import { FridayRushResponse } from "@/types/planning";

function SwiggyBadge() {
  return (
    <div className="flex items-center gap-1.5">
      <div className="flex h-4 w-4 items-center justify-center rounded bg-white p-0.5">
        <Image src="/swiggy-logo.png" alt="Swiggy" width={12} height={12} className="h-full w-full object-contain" />
      </div>
      <span className="text-[9px] uppercase tracking-widest text-[var(--color-text-faint)]">via Swiggy MCP</span>
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
  const pricingAlerts     = (mi.pricing_alerts as unknown[]) ?? [];
  const fetchedAt         = mi.fetched_at as string | null;

  // Set by MarketIntelService when competitor_pricing is null, so the panel can
  // tell "temporarily degraded — Swiggy's Food API circuit breaker is open,
  // will retry automatically" apart from "no competitor data exists here."
  const competitorStatus = mi.competitor_status as { state?: string; resets_in_seconds?: number | null } | null | undefined;
  const isDegraded = competitorStatus?.state === "degraded_circuit_open";
  const degradedMinutes = isDegraded && competitorStatus?.resets_in_seconds
    ? Math.max(1, Math.round(competitorStatus.resets_in_seconds / 60))
    : null;

  // Occupancy: swiggy_occupancy_context has { occupancy_signal, tonight_busy, ... }
  // mi.area_occupancy is the raw signal string ("HIGH"/"MEDIUM"/"LOW")
  const occCtx         = data.swiggy_occupancy_context as Record<string, unknown> | null | undefined;
  const occupancySignal = (occCtx?.occupancy_signal ?? mi.area_occupancy) as string | null | undefined;
  const tonightBusy    = (occCtx?.tonight_busy ?? mi.tonight_busy) as boolean | null | undefined;

  // Procurement: populated by inventory_node after shortage analysis (correct architecture)
  const procCtx    = data.swiggy_procurement_options as Record<string, unknown> | null | undefined;
  const procurement = procCtx?.procurement_options as Array<Record<string, unknown>> | null | undefined;

  const stats = competitorPricing ? priceStats(competitorPricing) : null;
  const topDishes = competitorPricing
    ? Object.entries(competitorPricing)
        .sort(([, a], [, b]) => (b as number) - (a as number))
        .slice(0, 8)
    : [];

  const hasAny = stats || occupancySignal || (procurement && procurement.length > 0) || competitorStatus;
  if (!hasAny) return null;

  return (
    <div className="mt-10 space-y-4">
      {/* Section header */}
      <div className="px-1 flex items-center gap-3">
        <div className="h-10 w-1 rounded-full flex-shrink-0 bg-orange-400/70" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 flex-wrap">
            <p className="text-xs uppercase tracking-[0.18em] text-orange-300/80">Market Intelligence</p>
            <SwiggyBadge />
            {fetchedAt && (
              <span className="text-[9px] font-mono text-[var(--color-text-ghost)]">fetched {fetchedAt}</span>
            )}
          </div>
          <p className="mt-1 text-sm text-[var(--color-text-soft)]">
            Live competitor pricing and area data from Swiggy MCP — used to shape tonight&rsquo;s menu and pricing strategy.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">

        {/* Competitor Pricing */}
        <div className="xl:col-span-2 rounded-2xl border border-[var(--color-border-default)] bg-[var(--color-surface-raised)] p-5">
          <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
            <p className="text-xs uppercase tracking-widest text-[var(--color-text-faint)]">Competitor Pricing</p>
            <SwiggyBadge />
          </div>

          {stats ? (
            <>
              {/* Stats row */}
              <div className="grid grid-cols-3 gap-2 mb-4">
                {[
                  { label: "Area avg",  value: `₹${stats.avg}`,   color: "text-[var(--color-text-primary)]" },
                  { label: "Cheapest",  value: `₹${stats.min}`,   color: "text-emerald-400" },
                  { label: "Highest",   value: `₹${stats.max}`,   color: "text-rose-400" },
                ].map(({ label, value, color }) => (
                  <div key={label} className="rounded-xl border border-[var(--color-border-soft)] bg-[var(--color-surface-raised)] p-3 text-center">
                    <p className="text-[9px] uppercase tracking-widest text-[var(--color-text-ghost)]">{label}</p>
                    <p className={`mt-1 text-lg font-bold tabular-nums ${color}`}>{value}</p>
                  </div>
                ))}
              </div>

              {/* Top dishes table */}
              <p className="text-[9px] uppercase tracking-widest text-[var(--color-text-ghost)] mb-2">
                Top priced items nearby ({stats.count} dishes tracked)
              </p>
              <div className="space-y-1 max-h-[200px] overflow-y-auto pr-1 scrollbar-thin">
                {topDishes.map(([dish, price]) => (
                  <div key={dish} className="flex items-center justify-between rounded-lg border border-[var(--color-border-soft)] bg-[var(--color-surface-raised)] px-3 py-1.5">
                    <span className="text-xs text-[var(--color-text-soft)] capitalize truncate mr-3">{dish}</span>
                    <span className="font-mono text-xs font-semibold text-[var(--color-text-primary)] shrink-0">₹{price}</span>
                  </div>
                ))}
                {Object.keys(competitorPricing!).length > 8 && (
                  <p className="text-[10px] text-[var(--color-text-ghost)] text-center py-1">
                    +{Object.keys(competitorPricing!).length - 8} more dishes tracked
                  </p>
                )}
              </div>

              {pricingAlerts.length > 0 && (
                <div className="mt-3 space-y-1.5">
                  <p className="text-[9px] uppercase tracking-widest text-[var(--color-text-ghost)]">Pricing alerts</p>
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
          ) : isDegraded ? (
            <div className="flex items-start gap-2 rounded-xl border border-amber-500/25 bg-amber-500/[0.06] px-3 py-2.5">
              <span className="mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-400 animate-pulse" />
              <p className="text-sm text-amber-300/90">
                Competitor pricing temporarily unavailable — Swiggy is recovering, retrying
                automatically{degradedMinutes ? ` in ~${degradedMinutes} min` : ""}.
              </p>
            </div>
          ) : (
            <p className="text-sm text-[var(--color-text-ghost)] italic">No competitor pricing data for this area.</p>
          )}
        </div>

        {/* Right column: Occupancy + Procurement */}
        <div className="space-y-4">

          {/* Area Occupancy */}
          <div className="rounded-2xl border border-[var(--color-border-default)] bg-[var(--color-surface-raised)] p-5">
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs uppercase tracking-widest text-[var(--color-text-faint)]">Area Occupancy</p>
              <SwiggyBadge />
            </div>
            {occupancySignal ? (
              <div className="space-y-2">
                <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium ${
                  occupancySignal === "HIGH"
                    ? "border-rose-500/30 bg-rose-500/10 text-rose-300"
                    : occupancySignal === "MEDIUM"
                    ? "border-amber-500/30 bg-amber-500/10 text-amber-300"
                    : "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
                }`}>
                  <span className={`h-1.5 w-1.5 rounded-full ${
                    occupancySignal === "HIGH" ? "bg-rose-400" : occupancySignal === "MEDIUM" ? "bg-amber-400" : "bg-emerald-400"
                  }`} />
                  {occupancySignal} occupancy area
                </span>
                {tonightBusy != null && (
                  <p className="text-xs text-[var(--color-text-soft)]">
                    Tonight busy: <span className={tonightBusy ? "text-rose-300 font-medium" : "text-emerald-300 font-medium"}>
                      {tonightBusy ? "Yes" : "No"}
                    </span>
                  </p>
                )}
              </div>
            ) : (
              <p className="text-xs text-[var(--color-text-ghost)] italic">Occupancy data unavailable — add a Dineout saved location to your Swiggy account.</p>
            )}
          </div>

          {/* Instamart Procurement */}
          <div className="rounded-2xl border border-[var(--color-border-default)] bg-[var(--color-surface-raised)] p-5">
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs uppercase tracking-widest text-[var(--color-text-faint)]">Instamart Prices</p>
              <SwiggyBadge />
            </div>
            {procurement && procurement.length > 0 ? (
              <div className="space-y-1.5">
                {procurement.slice(0, 5).map((item, i) => (
                  <div key={i} className="flex items-center justify-between rounded-lg border border-[var(--color-border-soft)] bg-[var(--color-surface-raised)] px-3 py-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${item.inStock ? "bg-emerald-400" : "bg-slate-600"}`} />
                      <span className="text-xs text-[var(--color-text-soft)] truncate capitalize">{item.ingredient as string}</span>
                    </div>
                    <span className="font-mono text-xs font-semibold text-[var(--color-text-primary)] shrink-0">₹{item.price as number}/{item.unit as string}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-[var(--color-text-ghost)] italic">No shortage items identified yet.</p>
            )}
          </div>

        </div>
      </div>
    </div>
  );
}
