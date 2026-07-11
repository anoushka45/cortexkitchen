"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { getMarketPulse, MarketPulseResponse, MarketWeather, MarketUpcomingHoliday, MarketIndustryTrends } from "@/lib/api";
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

function Card({ title, source, children, wide, swiggy = true }: { title: string; source: string; children: React.ReactNode; wide?: boolean; swiggy?: boolean }) {
  return (
    <div className={`rounded-2xl border border-[var(--color-border-default)] bg-[var(--color-surface-raised)] p-5 ${wide ? "lg:col-span-2" : ""}`}>
      <div className="flex items-start justify-between mb-1 flex-wrap gap-2">
        <p className="text-xs uppercase tracking-widest text-[var(--color-text-faint)]">{title}</p>
        {swiggy && <SwiggyBadge />}
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

  // Weather + holiday + industry trends are independent of Swiggy (Open-Meteo,
  // internal calendar, curated RSS -- no MCP involved) -- must render even
  // when Swiggy isn't connected.
  const weather = data.weather;
  const upcomingHoliday = data.upcoming_holiday;
  const industryTrends = data.industry_trends;

  if (!data.swiggy_connected) {
    return (
      <div className="space-y-4">
        {(weather || upcomingHoliday || industryTrends) && (
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <WeatherHolidayCard weather={weather} upcomingHoliday={upcomingHoliday} />
            {industryTrends && <IndustryTrendsCard trends={industryTrends} />}
          </div>
        )}
        <div className="rounded-2xl border border-[var(--color-border-default)] bg-[var(--color-surface-raised)] px-6 py-10 text-center">
          <p className="text-sm font-medium text-[var(--color-text-primary)]">Swiggy not connected</p>
          <p className="mt-1 text-sm text-[var(--color-text-faint)]">
            Connect your Swiggy account from Connectors to see live competitor pricing, occupancy, and procurement data.
          </p>
        </div>
      </div>
    );
  }

  const pricing = data.competitor_pricing;
  const occupancy = data.area_occupancy;
  const procurement = data.procurement ?? [];
  const comparisons = pricing?.comparisons ?? [];
  const dealsActiveCount = pricing?.deals_active_count ?? 0;
  const impacts = pricing?.pricing_impact ?? [];
  const categoryPricing = pricing?.category_pricing ?? [];
  const landscapeSummary = pricing?.landscape_summary ?? null;
  const positioning = pricing?.positioning ?? null;
  const menuBreadth = pricing?.menu_breadth ?? null;
  const cuisineCrowding = pricing?.cuisine_crowding ?? null;
  const vegMix = pricing?.veg_mix ?? null;
  const dineoutDealsCount = occupancy?.dineout_deals_count ?? 0;
  const slotDeals = occupancy?.slot_deals_found ?? [];
  const slotAvailability = occupancy?.slot_availability_by_time ?? [];

  const hasAnything =
    categoryPricing.length > 0 || comparisons.length > 0 || occupancy?.signal || procurement.length > 0 ||
    dineoutDealsCount > 0 || slotDeals.length > 0 || dealsActiveCount > 0 || landscapeSummary !== null ||
    weather !== null || upcomingHoliday !== null || industryTrends !== null;

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

        {/* 0. Weather & Holidays -- not Swiggy-sourced, shown alongside the rest */}
        {(weather || upcomingHoliday) && (
          <WeatherHolidayCard weather={weather} upcomingHoliday={upcomingHoliday} />
        )}

        {/* 0b. Industry Trends -- curated RSS, not Swiggy-sourced */}
        {industryTrends && <IndustryTrendsCard trends={industryTrends} />}

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
                    cheapest: <span className="text-emerald-300">{c.cheapest_dish.name} ₹{c.cheapest_dish.price}</span>
                    {" · "}
                    priciest: <span className="text-rose-300">{c.priciest_dish.name} ₹{c.priciest_dish.price}</span>
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
            {pricing && pricing.restaurants_checked_count > 0 && (
              <p className="mb-3 text-[10px] text-[var(--color-text-faint)]">
                {pricing.restaurants_checked_count} nearby restaurant{pricing.restaurants_checked_count !== 1 ? "s" : ""} checked
              </p>
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

        {/* 4. Area Deals -- aggregate count/summary, no restaurant names */}
        {dealsActiveCount > 0 && (
          <Card title="Area Deals Tonight" source="fetch_food_coupons (area aggregate)">
            <div className="rounded-lg border border-amber-500/25 bg-amber-500/[0.06] px-3 py-2.5 text-xs">
              <p className="font-medium text-amber-200">{dealsActiveCount} deal{dealsActiveCount !== 1 ? "s" : ""} active nearby</p>
              <p className="mt-1 text-[10px] text-amber-300/90">{pricing?.deals_summary}</p>
            </div>
          </Card>
        )}

        {/* 5. Nearby Market Landscape -- area aggregate, no named restaurants */}
        {landscapeSummary && (
          <Card title="Nearby Market Landscape" source="search_restaurants (area aggregate)" wide>
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
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
              <div className="rounded-lg border border-[var(--color-border-soft)] bg-[var(--color-surface-raised)] p-3">
                <p className="text-[9px] uppercase tracking-widest text-[var(--color-text-ghost)]">Nearby options</p>
                <p className="mt-1 font-mono text-sm font-semibold text-[var(--color-text-primary)]">{landscapeSummary.count}</p>
              </div>
              {landscapeSummary.avg_rating !== null && (
                <div className="rounded-lg border border-[var(--color-border-soft)] bg-[var(--color-surface-raised)] p-3">
                  <p className="text-[9px] uppercase tracking-widest text-[var(--color-text-ghost)]">Avg rating</p>
                  <p className="mt-1 font-mono text-sm font-semibold text-[var(--color-text-primary)]">{landscapeSummary.avg_rating}★</p>
                </div>
              )}
              {landscapeSummary.cost_for_two_min !== null && (
                <div className="rounded-lg border border-[var(--color-border-soft)] bg-[var(--color-surface-raised)] p-3">
                  <p className="text-[9px] uppercase tracking-widest text-[var(--color-text-ghost)]">Cost for two range</p>
                  <p className="mt-1 font-mono text-sm font-semibold text-[var(--color-text-primary)]">
                    ₹{landscapeSummary.cost_for_two_min}–₹{landscapeSummary.cost_for_two_max}
                  </p>
                </div>
              )}
            </div>
            {landscapeSummary.offers_count > 0 && (
              <p className="mt-2 text-[10px] text-amber-300">
                {landscapeSummary.offers_count} nearby option{landscapeSummary.offers_count !== 1 ? "s" : ""} running an active offer
              </p>
            )}
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
                  ? "Nearby restaurants are nearly full — expect walk-in overflow tonight."
                  : occupancy.signal === "MEDIUM"
                  ? "Nearby restaurants have moderate availability tonight."
                  : "Nearby restaurants have ample availability — no unusual demand pressure expected."}
              </p>
              <p className="text-[10px] text-[var(--color-text-ghost)]">{occupancy.competitors_checked} restaurant(s) checked</p>
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

        {/* 7. Dineout Deals -- aggregate count/summary, no restaurant names */}
        {dineoutDealsCount > 0 && (
          <Card title="Dineout Deals Tonight" source="get_restaurant_details (area aggregate)">
            <div className="rounded-lg border border-amber-500/25 bg-amber-500/[0.06] px-3 py-2.5 text-xs">
              <p className="font-medium text-amber-200">{dineoutDealsCount} deal{dineoutDealsCount !== 1 ? "s" : ""} active nearby</p>
              <p className="mt-1 text-[10px] text-amber-300/90">{occupancy?.dineout_deals_summary}</p>
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

const CONDITION_STYLES: Record<MarketWeather["condition"], { label: string; className: string }> = {
  heavy_rain: { label: "Heavy rain expected", className: "border-rose-500/30 bg-rose-500/10 text-rose-300" },
  light_rain: { label: "Light rain possible", className: "border-amber-500/30 bg-amber-500/10 text-amber-300" },
  very_hot:   { label: "Hot evening", className: "border-amber-500/30 bg-amber-500/10 text-amber-300" },
  clear:      { label: "Clear", className: "border-emerald-500/30 bg-emerald-500/10 text-emerald-300" },
};

function WeatherHolidayCard({
  weather,
  upcomingHoliday,
}: {
  weather: MarketWeather | null | undefined;
  upcomingHoliday: MarketUpcomingHoliday | null | undefined;
}) {
  return (
    <Card title="Weather & Holidays" source="Open-Meteo + internal calendar" wide swiggy={false}>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {weather && (
          <div className="rounded-lg border border-[var(--color-border-soft)] bg-[var(--color-surface-raised)] p-3">
            <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium ${CONDITION_STYLES[weather.condition].className}`}>
              {CONDITION_STYLES[weather.condition].label}
            </span>
            <p className="mt-2 text-xs text-[var(--color-text-soft)]">{weather.signal}</p>
            <p className="mt-1 text-[10px] text-[var(--color-text-faint)]">
              Delivery: {weather.delivery_impact} · Dine-in: {weather.dinein_impact}
            </p>
          </div>
        )}
        {upcomingHoliday && (
          <div className="rounded-lg border border-[var(--color-border-soft)] bg-[var(--color-surface-raised)] p-3">
            <p className="text-[9px] uppercase tracking-widest text-[var(--color-text-ghost)]">Upcoming holiday</p>
            <p className="mt-1 text-sm text-[var(--color-text-primary)]">
              <span className="font-semibold">{upcomingHoliday.name}</span>
            </p>
            <p className="mt-0.5 text-[10px] text-[var(--color-text-faint)]">
              {upcomingHoliday.days_away === 0
                ? "Today"
                : upcomingHoliday.days_away === 1
                ? "Tomorrow"
                : `In ${upcomingHoliday.days_away} days`}
              {" "}({upcomingHoliday.date})
            </p>
          </div>
        )}
      </div>
    </Card>
  );
}

function IndustryTrendsCard({ trends }: { trends: MarketIndustryTrends }) {
  const bullets = trends.digest.split("\n").map((line) => line.trim()).filter(Boolean);

  return (
    <Card title="Industry Trends" source="curated RSS trade press" wide swiggy={false}>
      <ul className="space-y-2">
        {bullets.map((line, i) => (
          <li key={i} className="flex gap-2 text-xs text-[var(--color-text-soft)]">
            <span className="mt-1 h-1 w-1 shrink-0 rounded-full bg-[var(--color-text-faint)]" />
            <span>{line.replace(/^[-•*]\s*/, "")}</span>
          </li>
        ))}
      </ul>
      <p className="mt-3 text-[10px] text-[var(--color-text-ghost)]">
        {trends.headline_count} headlines across {trends.sources_used} source{trends.sources_used !== 1 ? "s" : ""}
      </p>
    </Card>
  );
}
