"use client";

import { FridayRushResponse } from "@/types/planning";

// "Why is the AI saying this?" -- six fixed, always-rendered cards (unlike
// the old buildInternalConditions/buildExternalConditions helpers in
// PlanBriefing, which only ever rendered as a fallback when the LLM
// narrative failed). These are deterministic on purpose: this section must
// stay populated even on a run where the situation_summary LLM call failed
// open, so a manager always has a structured "why" to read, narrative or not.

function asObject(v: unknown): Record<string, unknown> | null {
  return v && typeof v === "object" ? (v as Record<string, unknown>) : null;
}

function toNum(v: unknown): number | null {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function parseSignalSections(text: string): Record<string, string> {
  if (!text) return {};
  const sections: Record<string, string> = {};
  for (const part of text.split(/\n(?=## )/g)) {
    const match = part.match(/^## (.+?)\n([\s\S]*)$/);
    if (match) sections[match[1].trim()] = match[2].trim();
  }
  return sections;
}

function firstLine(text: string | undefined): string | null {
  if (!text) return null;
  const line = text.split("\n").map((l) => l.trim()).find((l) => l.length > 0 && !l.startsWith("#"));
  return line ? line.replace(/\*\*/g, "") : null;
}

interface DriverCard {
  key: string;
  label: string;
  icon: string;
  status: string;
  takeaway: string;
  tone?: "rose" | "amber" | "emerald";
}

function buildDrivers(data: FridayRushResponse): DriverCard[] {
  const drivers: DriverCard[] = [];

  // Demand
  const forecast = asObject(data.recommendations.forecast);
  const forecastData = asObject(forecast?.data) ?? forecast;
  const predicted = toNum(forecastData?.predicted_orders ?? forecastData?.predicted_covers);
  const avgOrders = toNum(forecastData?.avg_friday_orders ?? forecastData?.avg_same_day_orders);
  if (predicted !== null) {
    const diffPct = avgOrders && avgOrders > 0 ? Math.round(((predicted - avgOrders) / avgOrders) * 100) : null;
    drivers.push({
      key: "demand", label: "Demand", icon: "M13 7h8m0 0v8m0-8l-8 8-4-4-6 6",
      status: `${Math.round(predicted)} orders${diffPct !== null ? ` (${diffPct >= 0 ? "+" : ""}${diffPct}% vs avg)` : ""}`,
      takeaway: diffPct === null ? "No baseline yet to compare against."
        : diffPct >= 15 ? "Expect a busier night than usual -- pace the kitchen accordingly."
        : diffPct <= -15 ? "Expect quieter service than usual."
        : "Expect a steady service, not a rush.",
    });
  }

  // Reservations
  const reservation = asObject(data.recommendations.reservation);
  const reservationData = asObject(reservation?.data) ?? reservation;
  const occupancyPct = toNum(reservationData?.occupancy_pct);
  const bookings = toNum(reservationData?.total_reservations);
  const overbooking = reservationData?.overbooking_risk === true;
  if (occupancyPct !== null) {
    drivers.push({
      key: "reservations", label: "Reservations", icon: "M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1z",
      status: `${bookings ?? 0} bookings, ${Math.round(occupancyPct)}% occupancy`,
      takeaway: overbooking ? "Above target -- watch for overbooking pressure tonight."
        : occupancyPct > 85 ? "Running hot -- keep table turns tight."
        : occupancyPct < 20 ? "Quiet booking load -- guests can enjoy a relaxed pace."
        : "Comfortable, manageable booking load.",
      tone: overbooking || occupancyPct > 85 ? "amber" : undefined,
    });
  }

  // Inventory
  const inventory = asObject(data.recommendations.inventory);
  const inventoryData = asObject(inventory?.data) ?? inventory;
  const shortageAlerts = Array.isArray(inventoryData?.shortage_alerts) ? inventoryData.shortage_alerts as Record<string, unknown>[] : [];
  const criticalNames = shortageAlerts.filter((a) => a.severity === "critical").map((a) => String(a.ingredient ?? "")).filter(Boolean);
  drivers.push({
    key: "inventory", label: "Inventory", icon: "M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4",
    status: criticalNames.length > 0 ? `${criticalNames[0]} critically low` : "Stock levels healthy",
    takeaway: criticalNames.length > 0 ? "Restock before service to avoid limiting production." : "No restock action needed before service.",
    tone: criticalNames.length > 0 ? "rose" : undefined,
  });

  // Weather (external)
  const sections = parseSignalSections(data.market_intel?.live_signals_text ?? "");
  const weather = firstLine(sections["Weather Forecast"]);
  if (weather) {
    const lower = weather.toLowerCase();
    drivers.push({
      key: "weather", label: "Weather", icon: "M3 15a4 4 0 004 4h9a5 5 0 001-9.9A6 6 0 006 9.1 4 4 0 003 15z",
      status: weather,
      takeaway: lower.includes("rain") ? "Delivery demand is likely to increase as the evening goes on."
        : lower.includes("hot") || lower.includes("heat") ? "Guests may prefer indoor/AC seating over outdoor tables."
        : lower.includes("clear") || lower.includes("pleasant") ? "No weather-driven shift expected in walk-in vs delivery mix."
        : "Monitor for any weather-driven shift in order channel mix.",
    });
  }

  // Market (competitor pricing/positioning)
  const alerts = data.market_intel?.pricing_alerts ?? [];
  const occupancySignal = firstLine(sections["Occupancy Signal"]);
  if (alerts.length > 0) {
    const above = alerts.filter((a) => a.direction === "above").length;
    drivers.push({
      key: "market", label: "Market", icon: "M3 3v18h18M9 17V9m4 8V5m4 12v-6",
      status: above > 0 ? "Higher priced than area average" : "Priced below area average",
      takeaway: above > 0 ? "Walk-ins may be more price-sensitive than usual." : "Pricing position is competitive for walk-in traffic.",
    });
  } else if (occupancySignal) {
    drivers.push({
      key: "market", label: "Market", icon: "M3 3v18h18M9 17V9m4 8V5m4 12v-6",
      status: occupancySignal,
      takeaway: "Area demand signal factored into tonight's walk-in expectations.",
    });
  }

  // Guest Experience
  const complaint = asObject(data.recommendations.complaint);
  const complaintData = asObject(complaint?.data) ?? complaint;
  const sentiment = asObject(complaintData?.sentiment_breakdown);
  const negativePct = toNum(sentiment?.negative_pct);
  const topIssue = Array.isArray(complaint?.issues) && complaint.issues.length > 0 && typeof complaint.issues[0] === "object"
    ? String((complaint.issues[0] as Record<string, unknown>).issue ?? "")
    : null;
  if (negativePct !== null) {
    drivers.push({
      key: "guest_experience", label: "Guest Experience", icon: "M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z",
      status: `${Math.round(negativePct)}% negative`,
      takeaway: topIssue ? `Focus on ${topIssue.toLowerCase()}.` : negativePct > 25 ? "Focus on service consistency tonight." : "Sentiment is trending healthy.",
      tone: negativePct > 25 ? "rose" : negativePct > 15 ? "amber" : "emerald",
    });
  }

  return drivers;
}

const TONE_CLASS: Record<string, string> = {
  rose: "text-rose-500",
  amber: "text-amber-500",
  emerald: "text-emerald-500",
};

// Decorative identity color per card (badge gradient) -- one warm family
// only, same literal-hex convention as Market/Analytics' SECTION_COLOR.
// Separate from `tone` above, which is genuine severity (rose/amber/
// emerald) applied to the status/takeaway text, not the badge.
const DRIVER_COLOR: Record<string, string> = {
  demand: "#FF5200",
  reservations: "#D97706",
  inventory: "#C2410C",
  weather: "#92400E",
  market: "#A16207",
  guest_experience: "#B45309",
};

export default function SituationDrivers({ data }: { data: FridayRushResponse }) {
  const drivers = buildDrivers(data);
  if (drivers.length === 0) return null;

  return (
    <div>
      <div className="flex items-center gap-1.5">
        <svg className="h-3.5 w-3.5 shrink-0 text-[var(--color-accent)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
        </svg>
        <p className="text-[10.5px] font-bold uppercase tracking-[0.18em] text-[var(--color-accent)]">Situation drivers</p>
      </div>
      <p className="mt-1 text-[19px] font-bold text-[var(--color-text-primary)]">Why the AI is planning tonight this way</p>
      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {drivers.map((d) => {
          const color = DRIVER_COLOR[d.key] ?? "#FF5200";
          return (
            <div key={d.key} className="card card-lift rounded-2xl p-4">
              <div className="flex items-center gap-2.5">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-white shadow-sm" style={{ background: `linear-gradient(135deg, ${color}, ${color}cc)` }}>
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                    <path strokeLinecap="round" strokeLinejoin="round" d={d.icon} />
                  </svg>
                </span>
                <p className="text-[13px] font-bold text-[var(--color-text-primary)]">{d.label}</p>
              </div>
              <p className={`mt-2.5 text-[13px] font-medium ${d.tone ? TONE_CLASS[d.tone] : "text-[var(--color-text-primary)]"}`}>{d.status}</p>
              <p className="mt-1.5 text-[11.5px] leading-relaxed text-[var(--color-text-faint)]">{d.takeaway}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
