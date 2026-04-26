"use client";

import { FridayRushResponse } from "@/types/planning";

interface Props {
  data: FridayRushResponse;
}

function asObject(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : null;
}

function extractForecastOrders(data: FridayRushResponse): number | null {
  const forecast = asObject(data.recommendations.forecast);
  const payload = asObject(forecast?.data) ?? forecast;
  const predicted = payload?.predicted_orders;
  if (typeof predicted === "number") return predicted;
  if (predicted === null || predicted === undefined) return null;
  const asNumber = Number(predicted);
  return Number.isFinite(asNumber) ? asNumber : null;
}

function extractReservationOccupancy(data: FridayRushResponse): number | null {
  const reservation = asObject(data.recommendations.reservation);
  const payload = asObject(reservation?.data) ?? reservation;
  const occupancy = payload?.occupancy_pct;
  if (typeof occupancy === "number") return occupancy;
  if (occupancy === null || occupancy === undefined) return null;
  const asNumber = Number(occupancy);
  return Number.isFinite(asNumber) ? asNumber : null;
}

function extractComplaintRisk(data: FridayRushResponse): string {
  const complaint = asObject(data.recommendations.complaint);
  const nestedData = asObject(complaint?.data);
  const issues = Array.isArray(complaint?.issues) ? complaint?.issues : [];

  const negativePct =
    nestedData?.sentiment_breakdown && typeof nestedData.sentiment_breakdown === "object"
      ? Number((nestedData.sentiment_breakdown as Record<string, unknown>).negative_pct ?? 0)
      : typeof complaint?.sentiment_breakdown === "object"
        ? Number((complaint?.sentiment_breakdown as Record<string, unknown>).negative_pct ?? 0)
        : 0;

  if (issues.length > 0) return `${issues.length} active issue${issues.length === 1 ? "" : "s"}`;
  if (negativePct >= 35) return "high complaint pressure";
  if (negativePct >= 20) return "moderate complaint pressure";
  return "complaints under control";
}

function extractInventoryRisk(data: FridayRushResponse): string {
  const inventory = asObject(data.recommendations.inventory);
  const nestedData = asObject(inventory?.data) ?? inventory;
  const shortages = Array.isArray(nestedData?.shortage_alerts) ? nestedData?.shortage_alerts : [];
  const critical = shortages.filter(
    (item) =>
      typeof item === "object" &&
      item !== null &&
      (item as Record<string, unknown>).severity === "critical",
  ).length;

  if (critical > 0) return `${critical} critical shortage${critical === 1 ? "" : "s"}`;
  if (shortages.length > 0) return `${shortages.length} shortage alert${shortages.length === 1 ? "" : "s"}`;
  return "stock position stable";
}

function extractMenuFocus(data: FridayRushResponse): string {
  const menu = asObject(data.recommendations.menu);
  const highlights = Array.isArray(menu?.highlight_items) ? menu.highlight_items : [];
  const promos = Array.isArray(menu?.promo_candidates) ? menu.promo_candidates : [];
  if (highlights.length > 0) return `${highlights.length} item focus plan`;
  if (promos.length > 0) return `${promos.length} promo candidate${promos.length === 1 ? "" : "s"}`;
  return "menu guidance ready";
}

const CARD_STYLES = [
  "border-violet-500/20 bg-violet-500/5",
  "border-blue-500/20 bg-blue-500/5",
  "border-rose-500/20 bg-rose-500/5",
  "border-emerald-500/20 bg-emerald-500/5",
  "border-amber-500/20 bg-amber-500/5",
];

export default function DashboardSummary({ data }: Props) {
  const forecastOrders = extractForecastOrders(data);
  const occupancy = extractReservationOccupancy(data);

  const summaryCards = [
    {
      label: "Forecasted Orders",
      value: forecastOrders !== null ? String(Math.round(forecastOrders)) : "--",
      detail: data.target_date ? `target ${data.target_date}` : "next service window",
    },
    {
      label: "Capacity Load",
      value: occupancy !== null ? `${Math.round(occupancy)}%` : "--",
      detail: "reservation pressure snapshot",
    },
    {
      label: "Complaint Signal",
      value: extractComplaintRisk(data),
      detail: "guest experience watch",
    },
    {
      label: "Inventory Risk",
      value: extractInventoryRisk(data),
      detail: "restock urgency",
    },
    {
      label: "Menu Focus",
      value: extractMenuFocus(data),
      detail: "service plan guidance",
    },
  ];

  return (
    <div className="grid grid-cols-1 gap-4 stagger-2 md:grid-cols-2 2xl:grid-cols-5">
      {summaryCards.map((card, index) => (
        <div
          key={card.label}
          className={`rounded-2xl border px-4 py-4 shadow-sm ${CARD_STYLES[index % CARD_STYLES.length]}`}
        >
          <p className="mb-2 text-[11px] font-mono uppercase tracking-[0.18em] text-slate-500">
            {card.label}
          </p>
          <p className="text-lg font-semibold leading-tight text-slate-100">{card.value}</p>
          <p className="mt-2 text-xs text-slate-500">{card.detail}</p>
        </div>
      ))}
    </div>
  );
}

