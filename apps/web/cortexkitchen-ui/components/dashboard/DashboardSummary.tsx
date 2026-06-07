"use client";

import { useEffect, useState } from "react";
import { FridayRushResponse } from "@/types/planning";

function useCountUp(target: number | null, duration = 700): number | null {
  const [value, setValue] = useState<number | null>(null);
  useEffect(() => {
    if (target === null) { setValue(null); return; }
    setValue(0);
    const steps = 28;
    const interval = duration / steps;
    let step = 0;
    const timer = setInterval(() => {
      step++;
      setValue(Math.round((target * step) / steps));
      if (step >= steps) clearInterval(timer);
    }, interval);
    return () => clearInterval(timer);
  }, [target, duration]);
  return value;
}

function asObject(v: unknown): Record<string, unknown> | null {
  return v && typeof v === "object" ? (v as Record<string, unknown>) : null;
}

function extractForecastOrders(data: FridayRushResponse): { orders: number | null; lower: number | null; upper: number | null } {
  const forecast = asObject(data.recommendations.forecast);
  const payload  = asObject(forecast?.data) ?? forecast;
  const toNum    = (x: unknown) => { const n = Number(x); return Number.isFinite(n) ? n : null; };
  return {
    orders: toNum(payload?.predicted_orders ?? payload?.predicted_covers),
    lower:  toNum(payload?.predicted_orders_lower),
    upper:  toNum(payload?.predicted_orders_upper),
  };
}

function extractReservation(data: FridayRushResponse): { pct: number | null; bookings: number | null; guests: number | null } {
  const r = asObject(data.recommendations.reservation);
  const p = asObject(r?.data) ?? r;
  const toNum = (x: unknown) => { const n = Number(x); return Number.isFinite(n) ? n : null; };
  return {
    pct:      toNum(p?.occupancy_pct),
    bookings: toNum(p?.reservations ?? p?.reservation_count),
    guests:   toNum(p?.guests ?? p?.guest_count),
  };
}

function extractComplaintIssues(data: FridayRushResponse): number {
  const c = asObject(data.recommendations.complaint);
  const issues = Array.isArray(c?.issues) ? c?.issues : [];
  return issues.length;
}

function extractInventoryCritical(data: FridayRushResponse): number {
  const inv = asObject(data.recommendations.inventory);
  const p   = asObject(inv?.data) ?? inv;
  const shortages = Array.isArray(p?.shortage_alerts) ? p.shortage_alerts as Record<string, unknown>[] : [];
  return shortages.filter(a => a.severity === "critical").length;
}

function extractMenuPush(data: FridayRushResponse): { push: string | null; ease: string | null } {
  const m         = asObject(data.recommendations.menu);
  const highlights = Array.isArray(m?.highlight_items) ? m.highlight_items as string[] : [];
  const blockers   = Array.isArray(m?.inventory_blockers) ? m.inventory_blockers as string[] : [];
  return { push: highlights[0] ?? null, ease: blockers[0] ?? null };
}

interface Props { data: FridayRushResponse; }

export default function DashboardSummary({ data }: Props) {
  const { orders, lower, upper } = extractForecastOrders(data);
  const { pct, bookings, guests } = extractReservation(data);
  const animatedOrders  = useCountUp(orders !== null ? Math.round(orders) : null);
  const animatedOccupancy = useCountUp(pct !== null ? Math.round(pct) : null);
  const complaints      = extractComplaintIssues(data);
  const criticalInv     = extractInventoryCritical(data);
  const { push, ease }  = extractMenuPush(data);

  const rangeText = lower !== null && upper !== null
    ? `range ${Math.round(lower)}-${Math.round(upper)}`
    : null;

  return (
    <div className="stagger-2 mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-5">

      {/* Forecasted orders */}
      <article className="rounded-2xl bg-ink-900 p-5 ring-1 ring-white/[0.07]">
        <div className="font-mono text-[9px] uppercase tracking-[0.22em] text-ember-300/80">Forecasted orders</div>
        <div className="mt-2 flex items-baseline gap-2">
          <div className="num-display text-5xl leading-none text-white">{animatedOrders ?? "--"}</div>
          {orders !== null && data.target_date && (
            <div className="text-xs text-emerald-300/80">target</div>
          )}
        </div>
        <div className="mt-3 text-[11px] text-white/45">
          {data.target_date
            ? <>target <span className="font-mono text-white/65">{data.target_date}</span></>
            : "next service window"}
          {rangeText && <>  -  {rangeText}</>}
        </div>
        <div className="mt-3 h-1.5 rounded bg-white/[0.04] overflow-hidden">
          <div className="h-full bg-gradient-to-r from-ember-400 to-ember-600 transition-all duration-700"
            style={{ width: orders ? `${Math.min(100, Math.round((orders / 150) * 100))}%` : "0%" }} />
        </div>
      </article>

      {/* Capacity load */}
      <article className="rounded-2xl bg-ink-900 p-5 ring-1 ring-white/[0.07]">
        <div className="font-mono text-[9px] uppercase tracking-[0.22em] text-cyan-300/80">Capacity load</div>
        <div className="mt-2 flex items-baseline gap-2">
          <div className="num-display text-5xl leading-none text-white">
            {animatedOccupancy ?? "--"}<span className="text-2xl text-white/40">%</span>
          </div>
        </div>
        <div className="mt-3 text-[11px] text-white/45">
          reservation pressure
          {bookings !== null && guests !== null && <>  -  {bookings} bookings  -  {guests} guests</>}
        </div>
        <div className="mt-3 h-1.5 rounded bg-white/[0.04] overflow-hidden">
          <div className="h-full bg-gradient-to-r from-cyan-400 to-cyan-600 transition-all duration-700"
            style={{ width: pct ? `${Math.min(100, Math.round(pct))}%` : "0%" }} />
        </div>
      </article>

      {/* Complaint signal */}
      <article className="rounded-2xl bg-ink-900 p-5 ring-1 ring-white/[0.07]">
        <div className="font-mono text-[9px] uppercase tracking-[0.22em] text-rose-300/80">Complaint signal</div>
        <div className="mt-2 flex items-baseline gap-2">
          <div className="num-display text-5xl leading-none text-white">{complaints}</div>
          {complaints > 0 && <div className="text-xs text-rose-300/80">active</div>}
        </div>
        <div className="mt-3 text-[11px] text-white/45">guest experience watch</div>
        <div className="mt-3 flex gap-1">
          {[...Array(Math.max(3, complaints))].map((_, i) => (
            <div key={i} className={`h-1.5 flex-1 rounded ${
              i < complaints ? `bg-rose-400/${i === 0 ? "60" : i === 1 ? "40" : "30"}` : "bg-white/[0.04]"
            }`} />
          ))}
        </div>
      </article>

      {/* Inventory risk */}
      <article className="rounded-2xl bg-ink-900 p-5 ring-1 ring-white/[0.07]">
        <div className="font-mono text-[9px] uppercase tracking-[0.22em] text-emerald-300/80">Inventory risk</div>
        <div className="mt-2 flex items-baseline gap-2">
          <div className="num-display text-5xl leading-none text-white">{criticalInv}</div>
          {criticalInv > 0 && <div className="text-xs text-rose-300/80">critical</div>}
        </div>
        <div className="mt-3 text-[11px] text-white/45">restock urgency</div>
        <div className="mt-3 flex gap-1">
          {[...Array(Math.max(5, criticalInv))].map((_, i) => (
            <div key={i} className={`h-1.5 flex-1 rounded ${
              i < criticalInv
                ? i < 2 ? "bg-rose-400/60" : i < 4 ? "bg-ember-400/40" : "bg-emerald-400/30"
                : "bg-white/[0.04]"
            }`} />
          ))}
        </div>
      </article>

      {/* Menu focus */}
      <article className="rounded-2xl bg-ink-900 p-5 ring-1 ring-white/[0.07]">
        <div className="font-mono text-[9px] uppercase tracking-[0.22em] text-amber-300/80">Menu focus</div>
        <div className="mt-2 flex items-baseline gap-2">
          <div className="num-display text-5xl leading-none text-white">{push ? "2" : "0"}</div>
          <div className="text-xs text-amber-300/80">items tonight</div>
        </div>
        <div className="mt-3 text-[11px] text-white/45 truncate">
          {push ? `push ${push.slice(0, 18)}` : "service plan guidance"}
        </div>
        <div className="mt-3 flex gap-1.5">
          {push && (
            <span className="rounded bg-emerald-500/10 px-2 py-0.5 font-mono text-[10px] text-emerald-300 ring-1 ring-emerald-400/20">PUSH</span>
          )}
          {ease && (
            <span className="rounded bg-ember-500/10 px-2 py-0.5 font-mono text-[10px] text-ember-300 ring-1 ring-ember-400/20">EASE</span>
          )}
        </div>
      </article>

    </div>
  );
}
