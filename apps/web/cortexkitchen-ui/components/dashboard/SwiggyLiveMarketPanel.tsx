"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { getMarketPulse, MarketPulseResponse } from "@/lib/api";
import CategoryPricingChart from "./CategoryPricingChart";
import PricingImpactChart from "./PricingImpactChart";
import OccupancyBySlotChart from "./OccupancyBySlotChart";
import IngredientPriceLookup from "./IngredientPriceLookup";

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

function Card({ title, source, children, wide }: { title: string; source: string; children: React.ReactNode; wide?: boolean }) {
  return (
    <div className={`rounded-2xl border border-[var(--color-border-default)] bg-[var(--color-surface-raised)] p-5 ${wide ? "lg:col-span-2" : ""}`}>
      <div className="flex items-start justify-between mb-1 flex-wrap gap-2">
        <p className="text-xs uppercase tracking-widest text-[var(--color-text-faint)]">{title}</p>
        <SwiggyBadge />
      </div>
      <p className="mb-3 font-mono text-[9px] text-[var(--color-text-ghost)]">via {source}</p>
      {children}
    </div>
  );
}

type Status = "loading" | "success" | "error";

export default function SwiggyLiveMarketPanel() {
  const [data, setData] = useState<MarketPulseResponse | null>(null);
  const [status, setStatus] = useState<Status>("loading");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    getMarketPulse()
      .then((res) => {
        if (cancelled) return;
        setData(res);
        setStatus("success");
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Failed to load live market data");
        setStatus("error");
      });
    return () => { cancelled = true; };
  }, []);

  if (status === "loading") {
    return (
      <div className="rounded-2xl border border-[var(--color-border-default)] bg-[var(--color-surface-raised)] p-6">
        <p className="text-sm text-[var(--color-text-faint)]">Loading live market intelligence…</p>
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className="rounded-2xl border border-[var(--color-border-default)] bg-[var(--color-surface-raised)] p-6">
        <p className="text-sm text-rose-400">{error}</p>
      </div>
    );
  }

  if (!data) return null;

  if (!data.swiggy_connected) {
    return (
      <div className="rounded-2xl border border-[var(--color-border-default)] bg-[var(--color-surface-raised)] px-6 py-10 text-center">
        <p className="text-sm font-medium text-[var(--color-text-primary)]">Swiggy not connected</p>
        <p className="mt-1 text-sm text-[var(--color-text-faint)]">
          Connect your Swiggy account from Connectors to see live competitor pricing, occupancy, and procurement data.
        </p>
      </div>
    );
  }

  const pricing = data.competitor_pricing;
  const occupancy = data.area_occupancy;
  const procurement = data.procurement ?? [];
  const comparisons = pricing?.comparisons ?? [];
  const foodDeals = pricing?.competitor_deals ?? [];
  const impacts = pricing?.pricing_impact ?? [];
  const categoryPricing = pricing?.category_pricing ?? [];
  const competitorLandscape = pricing?.competitor_landscape ?? [];
  const positioning = pricing?.positioning ?? null;
  const menuBreadth = pricing?.menu_breadth ?? null;
  const cuisineCrowding = pricing?.cuisine_crowding ?? null;
  const vegMix = pricing?.veg_mix ?? null;
  const dineoutDeals = occupancy?.competitor_dineout_deals ?? [];
  const slotDeals = occupancy?.slot_deals_found ?? [];
  const slotAvailability = occupancy?.slot_availability_by_time ?? [];

  const hasAnything =
    categoryPricing.length > 0 || comparisons.length > 0 || occupancy?.signal || procurement.length > 0 ||
    dineoutDeals.length > 0 || slotDeals.length > 0 || foodDeals.length > 0 || competitorLandscape.length > 0;

  if (!hasAnything) {
    return (
      <div className="space-y-4">
        <PanelHeader fetchedAt={pricing?.fetched_at ?? occupancy?.fetched_at} />
        <div className="rounded-2xl border border-[var(--color-border-default)] bg-[var(--color-surface-raised)] px-6 py-10 text-center">
          <p className="text-sm text-[var(--color-text-faint)] italic">No live market data available right now.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <PanelHeader fetchedAt={pricing?.fetched_at ?? occupancy?.fetched_at} />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">

        {/* 1. Category Pricing Intelligence (derived, leads with verdict) */}
        {categoryPricing.length > 0 && (
          <Card title="Category Pricing Intelligence" source="derived analysis (dish-name independent)" wide>
            <div className="space-y-1.5 mb-4">
              {categoryPricing.map((c) => (
                <div
                  key={c.category}
                  className={`rounded-lg border px-3 py-2 ${
                    c.verdict === "above" ? "border-rose-500/25 bg-rose-500/[0.06]"
                    : c.verdict === "below" ? "border-emerald-500/25 bg-emerald-500/[0.06]"
                    : "border-[var(--color-border-soft)] bg-[var(--color-surface-raised)]"
                  }`}
                >
                  <p className="text-xs text-[var(--color-text-primary)]">
                    <span className="font-semibold capitalize">{c.category}</span>
                    {": "}
                    you&apos;re <span className={`font-semibold ${c.verdict === "above" ? "text-rose-300" : c.verdict === "below" ? "text-emerald-300" : ""}`}>
                      {Math.abs(c.diff_pct).toFixed(0)}% {c.verdict === "in line" ? "in line with" : c.verdict}
                    </span>{c.verdict !== "in line" ? " the area" : ""} (₹{c.your_avg} vs ₹{c.area_avg} avg)
                  </p>
                  <p className="mt-0.5 text-[10px] text-[var(--color-text-ghost)]">
                    based on {c.competitor_dishes_sampled} nearby {c.category} dish{c.competitor_dishes_sampled !== 1 ? "es" : ""}
                  </p>
                  <p className="mt-1 text-[10px] text-[var(--color-text-faint)]">
                    cheapest: <span className="text-emerald-300">{c.cheapest_dish.name} ₹{c.cheapest_dish.price}</span> ({c.cheapest_dish.restaurant})
                    {" · "}
                    priciest: <span className="text-rose-300">{c.priciest_dish.name} ₹{c.priciest_dish.price}</span> ({c.priciest_dish.restaurant})
                  </p>
                </div>
              ))}
            </div>
            <CategoryPricingChart data={categoryPricing} />
          </Card>
        )}

        {/* 2. Market Context -- menu breadth, cuisine crowding, veg mix */}
        {(menuBreadth || cuisineCrowding || vegMix) && (
          <Card title="Market Context" source="search_restaurants + get_restaurant_menu (derived)" wide>
            {pricing && pricing.restaurants_checked.length > 0 && (
              <div className="mb-3 flex flex-wrap gap-1.5">
                {pricing.restaurants_checked.map((name) => (
                  <span key={name} className="rounded-full border border-[var(--color-border-soft)] bg-[var(--color-surface-raised)] px-2 py-0.5 text-[10px] text-[var(--color-text-faint)]">
                    {name}
                  </span>
                ))}
              </div>
            )}
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
              {menuBreadth && (
                <div className="rounded-lg border border-[var(--color-border-soft)] bg-[var(--color-surface-raised)] p-3">
                  <p className="text-[9px] uppercase tracking-widest text-[var(--color-text-ghost)]">Menu breadth</p>
                  <p className="mt-1 text-sm text-[var(--color-text-primary)]">
                    <span className="font-mono font-semibold">{menuBreadth.your_item_count}</span> items on your menu
                  </p>
                  <p className="text-[10px] text-[var(--color-text-faint)]">
                    vs {menuBreadth.competitor_avg_item_count} avg across {menuBreadth.competitors_sampled} nearby competitor(s)
                  </p>
                </div>
              )}
              {cuisineCrowding && (
                <div className="rounded-lg border border-[var(--color-border-soft)] bg-[var(--color-surface-raised)] p-3">
                  <p className="text-[9px] uppercase tracking-widest text-[var(--color-text-ghost)]">Cuisine crowding</p>
                  <p className="mt-1 text-sm text-[var(--color-text-primary)]">
                    <span className="font-mono font-semibold">{cuisineCrowding.matching_count}</span> of {cuisineCrowding.total_checked} nearby
                  </p>
                  <p className="text-[10px] text-[var(--color-text-faint)]">
                    also serve <span className="capitalize">{cuisineCrowding.cuisine}</span>
                  </p>
                </div>
              )}
              {vegMix && (
                <div className="rounded-lg border border-[var(--color-border-soft)] bg-[var(--color-surface-raised)] p-3">
                  <p className="text-[9px] uppercase tracking-widest text-[var(--color-text-ghost)]">Veg/non-veg mix</p>
                  <p className="mt-1 text-sm text-[var(--color-text-primary)]">
                    <span className="font-mono font-semibold">{vegMix.veg_count}</span> of {vegMix.total} nearby
                  </p>
                  <p className="text-[10px] text-[var(--color-text-faint)]">are pure-veg only</p>
                </div>
              )}
            </div>
          </Card>
        )}

        {/* 3. Exact Menu Matches (bonus, dish-name matched only) */}
        {impacts.length > 0 && (
          <Card title={`Exact Menu Matches (${impacts.length})`} source="exact dish-name match, bonus detail">
            <PricingImpactChart data={impacts} />
          </Card>
        )}

        {/* 4. Competitor Swiggy Deals -- full coupon detail */}
        {foodDeals.length > 0 && (
          <Card title={`Competitor Swiggy Deals (${foodDeals.length})`} source="fetch_food_coupons">
            <div className="space-y-1.5">
              {foodDeals.map((d, i) => (
                <div key={i} className="rounded-lg border border-amber-500/25 bg-amber-500/[0.06] px-3 py-2 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-amber-200">{d.restaurant}</span>
                    <span className="text-amber-300/90 text-right">{d.deal_title}</span>
                  </div>
                  <p className="mt-0.5 text-[10px] text-[var(--color-text-ghost)]">
                    {d.discount}{d.discount <= 100 ? "% off" : " off"}{d.code ? ` · code ${d.code}` : ""}
                  </p>
                </div>
              ))}
            </div>
          </Card>
        )}

        {/* 5. Competitor Landscape -- full detail per competitor */}
        {competitorLandscape.length > 0 && (
          <Card title={`Competitor Landscape (${competitorLandscape.length})`} source="search_restaurants" wide>
            {positioning && (
              <div className="mb-3 rounded-lg border border-[var(--color-border-soft)] bg-[var(--color-surface-raised)] px-3 py-2.5">
                <p className="text-sm text-[var(--color-text-primary)]">
                  Estimated <span className="font-mono font-semibold">₹{positioning.your_cost_for_two_estimate}</span> for two
                  ranks <span className="font-semibold text-[var(--color-accent)]">#{positioning.rank} of {positioning.total}</span> nearby options
                </p>
                <p className="mt-0.5 text-[10px] text-[var(--color-text-faint)]">
                  cheaper than {positioning.cheaper_than_count} · pricier than {positioning.pricier_than_count}
                </p>
              </div>
            )}
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 max-h-[400px] overflow-y-auto pr-1 scrollbar-thin">
              {[...competitorLandscape].sort((a, b) => a.distance_km - b.distance_km).map((c) => (
                <div key={c.name} className="rounded-lg border border-[var(--color-border-soft)] bg-[var(--color-surface-raised)] px-3 py-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs font-medium text-[var(--color-text-primary)] truncate">{c.name}</p>
                    {c.veg && <span className="shrink-0 rounded border border-emerald-500/30 px-1 text-[9px] text-emerald-300">VEG</span>}
                  </div>
                  <p className="mt-1 text-[10px] text-[var(--color-text-faint)]">
                    {c.rating.toFixed(1)}★{c.total_ratings ? ` (${c.total_ratings})` : ""} · {c.distance_km.toFixed(1)}km · {c.delivery_time_range || "—"}
                  </p>
                  <p className="mt-0.5 font-mono text-xs font-semibold text-[var(--color-text-primary)]">₹{c.cost_for_two} for two</p>
                  {c.cuisines.length > 0 && (
                    <p className="mt-1 text-[9px] text-[var(--color-text-ghost)]">{c.cuisines.join(" · ")}</p>
                  )}
                  {c.offer && (
                    <p className="mt-1 text-[10px] text-amber-300">{c.offer}</p>
                  )}
                </div>
              ))}
            </div>
          </Card>
        )}

        {/* 6. Area Occupancy -- signal + full by-slot detail */}
        <Card title="Area Occupancy" source="search_restaurants_dineout + get_available_slots">
          {occupancy?.signal ? (
            <div className="space-y-2">
              <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium ${
                occupancy.signal === "HIGH" ? "border-rose-500/30 bg-rose-500/10 text-rose-300"
                : occupancy.signal === "MEDIUM" ? "border-amber-500/30 bg-amber-500/10 text-amber-300"
                : "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
              }`}>
                <span className={`h-1.5 w-1.5 rounded-full ${
                  occupancy.signal === "HIGH" ? "bg-rose-400" : occupancy.signal === "MEDIUM" ? "bg-amber-400" : "bg-emerald-400"
                }`} />
                {occupancy.signal} occupancy area
              </span>
              <p className="text-xs text-[var(--color-text-soft)]">
                {occupancy.signal === "HIGH"
                  ? "Nearby competitors are nearly full — expect walk-in overflow tonight."
                  : occupancy.signal === "MEDIUM"
                  ? "Nearby competitors have moderate availability tonight."
                  : "Nearby competitors have ample availability — no unusual demand pressure expected."}
              </p>
              <p className="text-[10px] text-[var(--color-text-ghost)]">{occupancy.competitors_checked} competitor(s) checked</p>
            </div>
          ) : (
            <p className="text-xs text-[var(--color-text-ghost)] italic">Occupancy data unavailable — add a Dineout saved location to your Swiggy account.</p>
          )}

          {slotAvailability.length > 0 && (
            <div className="mt-3 border-t border-[var(--color-border-soft)] pt-3">
              <OccupancyBySlotChart data={slotAvailability} />
              <div className="mt-2 space-y-1">
                {slotAvailability.map((s) => (
                  <div key={s.time} className="flex items-center justify-between text-[10px] text-[var(--color-text-faint)]">
                    <span>{s.time}</span>
                    <span className="font-mono">{s.avg_availability} avg · {s.signal}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </Card>

        {/* 7. Dineout Competitor Deals & Amenities -- ALL deals per restaurant */}
        {dineoutDeals.length > 0 && (
          <Card title={`Dineout Competitor Deals (${dineoutDeals.length})`} source="get_restaurant_details">
            <div className="space-y-2">
              {dineoutDeals.map((d, i) => (
                <div key={i} className="rounded-lg border border-amber-500/25 bg-amber-500/[0.06] px-3 py-2 text-xs">
                  <p className="font-medium text-amber-200">{d.name}</p>
                  <div className="mt-1 space-y-0.5">
                    {d.deals.map((deal, j) => (
                      <p key={j} className="text-amber-300/90">
                        {deal.is_free ? deal.title : `${deal.title} (${deal.discount_pct.toFixed(0)}%)`}
                      </p>
                    ))}
                  </div>
                  {d.amenities.length > 0 && (
                    <p className="mt-1 text-[10px] text-[var(--color-text-ghost)]">{d.amenities.join(" · ")}</p>
                  )}
                  {d.timings && <p className="mt-0.5 text-[10px] text-[var(--color-text-faint)]">{d.timings}</p>}
                </div>
              ))}
            </div>
          </Card>
        )}

        {/* 8. Dineout Slot Deals Tonight -- full list */}
        {slotDeals.length > 0 && (
          <Card title={`Dineout Slot Deals Tonight (${slotDeals.length})`} source="get_available_slots (deals[])">
            <div className="space-y-1">
              {slotDeals.map((s, i) => (
                <div key={i} className="flex items-center justify-between rounded-lg border border-[var(--color-border-soft)] bg-[var(--color-surface-raised)] px-3 py-1.5 text-xs">
                  <span className="text-[var(--color-text-soft)]">{s.time}</span>
                  <span className="text-[var(--color-text-primary)]">{s.deal_title} ({s.discount_pct.toFixed(0)}%)</span>
                </div>
              ))}
            </div>
          </Card>
        )}

        {/* 9. Instamart Shortage Prices -- full list */}
        <Card title={`Instamart Shortage Prices (${procurement.length})`} source="search_products">
          {procurement.length > 0 ? (
            <div className="space-y-1.5 max-h-[300px] overflow-y-auto pr-1 scrollbar-thin">
              {procurement.map((item, i) => (
                <div key={i} className="flex items-center justify-between rounded-lg border border-[var(--color-border-soft)] bg-[var(--color-surface-raised)] px-3 py-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${item.in_stock ? "bg-emerald-400" : "bg-slate-600"}`} />
                    <span className="text-xs text-[var(--color-text-soft)] truncate capitalize">{item.name}</span>
                  </div>
                  <span className="font-mono text-xs font-semibold text-[var(--color-text-primary)] shrink-0">₹{item.price}/{item.unit}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-[var(--color-text-ghost)] italic">No shortage items identified yet — run a plan to compute current shortages.</p>
          )}
        </Card>

        {/* 10. Ingredient Price Lookup -- on-demand */}
        <IngredientPriceLookup />
      </div>
    </div>
  );
}

function PanelHeader({ fetchedAt }: { fetchedAt?: string | null }) {
  return (
    <div className="px-1 flex items-center gap-3">
      <div className="h-10 w-1 rounded-full flex-shrink-0 bg-orange-400/70" />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-3 flex-wrap">
          <p className="text-xs uppercase tracking-[0.18em] text-orange-300/80">Live Market Intelligence</p>
          <SwiggyBadge />
          {fetchedAt && (
            <span className="text-[9px] font-mono text-[var(--color-text-ghost)]">fetched {fetchedAt}</span>
          )}
        </div>
        <p className="mt-1 text-sm text-[var(--color-text-soft)]">
          Always-on Swiggy signal — updates independently of any plan run. This is the same data
          that gets injected into your next plan when you run one.
        </p>
      </div>
    </div>
  );
}
