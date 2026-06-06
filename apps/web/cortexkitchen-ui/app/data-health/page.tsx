"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { getDataHealth, getObservabilitySummary, ObservabilitySummary } from "@/lib/api";
import { DataHealth } from "@/types/planning";

const SCENARIO_LABELS: Record<string, string> = {
  friday_rush:       "Friday Rush",
  weekday_lunch:     "Weekday Lunch",
  holiday_spike:     "Holiday Spike",
  low_stock_weekend: "Low-Stock Weekend",
};

export default function DataHealthPage() {
  const [data,  setData]  = useState<DataHealth | null>(null);
  const [obs,   setObs]   = useState<ObservabilitySummary | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getDataHealth()
      .then(setData)
      .catch((err) => setError(err instanceof Error ? err.message : "Unable to load data health"));
    getObservabilitySummary(7)
      .then(setObs)
      .catch(() => { /* observability is non-blocking */ });
  }, []);

  return (
    <main className="min-h-screen bg-[#09111f] px-5 py-6 text-slate-100 xl:px-8">
      <div className="mx-auto max-w-[1520px] space-y-6">
        <header className="flex flex-col gap-4 border-b border-white/10 pb-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-mono uppercase tracking-[0.22em] text-ember-300">
              source data
            </p>
            <h1 className="mt-2 text-2xl font-semibold tracking-tight">Data Health</h1>
            <p className="mt-1 max-w-2xl text-sm text-slate-400">
              Current database coverage used by forecasts, reservations, complaint analysis, menu planning, and inventory checks.
            </p>
          </div>
          <nav className="flex gap-2">
            <Link className="rounded-lg border border-white/10 px-3 py-2 text-xs font-mono text-slate-300 hover:bg-white/5" href="/">
              dashboard
            </Link>
            <Link className="rounded-lg border border-ember-400/20 bg-ember-500/10 px-3 py-2 text-xs font-mono text-ember-200" href="/runs">
              runs
            </Link>
          </nav>
        </header>

        {error && (
          <div className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
            {error}
          </div>
        )}

        {!data ? (
          <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-5">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="rounded-lg border border-white/10 bg-white/[0.03] p-5 animate-pulse">
                <div className="h-2.5 w-20 rounded bg-slate-800 mb-4" />
                <div className="h-8 w-16 rounded bg-slate-800 mb-3" />
                <div className="h-2.5 w-32 rounded bg-slate-800" />
              </div>
            ))}
          </section>
        ) : (
          <>
            <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-5">
              <HealthCard title="Orders"       value={data.orders.count}       detail={range(data.orders.date_range)}                                    stagger={1} />
              <HealthCard title="Reservations" value={data.reservations.count} detail={range(data.reservations.date_range)}                              stagger={2} />
              <HealthCard title="Feedback"     value={data.feedback.count}     detail={`${data.feedback.negative} negative (${data.feedback.negative_pct}%)`} stagger={3} />
              <HealthCard title="Inventory"    value={data.inventory.items}    detail={`${data.inventory.critical_shortages} critical shortages`}         stagger={4} />
              <HealthCard title="Menu Items"   value={data.menu.items}         detail="active catalog"                                                   stagger={5} />
            </section>

            <section className="grid grid-cols-1 gap-5 xl:grid-cols-12">
              <div className="rounded-lg border border-white/10 bg-white/[0.03] p-5 xl:col-span-7">
                <h2 className="text-sm font-semibold">Scenario Coverage</h2>
                <p className="mt-1 text-xs text-slate-500">
                  Best upcoming demo dates with reservation pressure already present in the database.
                </p>
                <div className="mt-4 overflow-hidden rounded-lg border border-white/10">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-slate-950/60 text-xs uppercase tracking-[0.14em] text-slate-500">
                      <tr>
                        <th className="px-3 py-3">Scenario</th>
                        <th className="px-3 py-3">Date</th>
                        <th className="px-3 py-3">Bookings</th>
                        <th className="px-3 py-3">Guests</th>
                        <th className="px-3 py-3">Waitlist</th>
                        <th className="px-3 py-3">Load</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/10">
                      {data.scenario_coverage.map((row) => (
                        <tr key={`${row.scenario}-${row.date}`} className="hover:bg-white/[0.03] transition-colors duration-150">
                          <td className="px-3 py-3">
                            <div className="flex flex-col">
                              <span>{row.label}</span>
                              <span className="text-xs font-mono text-slate-500">{row.scenario}</span>
                            </div>
                          </td>
                          <td className="px-3 py-3 font-mono text-xs text-slate-300">{row.date}</td>
                          <td className="px-3 py-3">{row.reservations}</td>
                          <td className="px-3 py-3">{row.guests}</td>
                          <td className="px-3 py-3">{row.waitlist}</td>
                          <td className="px-3 py-3">{row.occupancy_pct}%</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="rounded-lg border border-white/10 bg-white/[0.03] p-5 xl:col-span-5">
                <h2 className="text-sm font-semibold">Operational Signals</h2>
                <div className="mt-4 space-y-3">
                  <Signal label="Shortage alerts" value={data.inventory.shortage_alerts} />
                  <Signal label="Critical shortages" value={data.inventory.critical_shortages} />
                  <Signal label="Overstock alerts" value={data.inventory.overstock_alerts} />
                  <Signal label="Positive feedback" value={data.feedback.positive} />
                  <Signal label="Neutral feedback" value={data.feedback.neutral} />
                </div>
              </div>
            </section>

            {/* Observability panel */}
            {obs && (
              <section>
                <div className="mb-4 flex items-center justify-between">
                  <div>
                    <p className="text-xs font-mono uppercase tracking-[0.22em] text-ember-300">Observability</p>
                    <h2 className="mt-1 text-base font-semibold text-white">Planning runs — last {obs.period_days} days</h2>
                  </div>
                  {obs.latest_run_at && (
                    <span className="font-mono text-[10px] text-white/30">
                      latest {new Date(obs.latest_run_at).toLocaleString()}
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-4 md:grid-cols-4 mb-4">
                  {[
                    { label: "Total runs",     value: obs.total_runs,                          color: "text-white"        },
                    { label: "Success rate",   value: obs.success_rate != null ? `${Math.round(obs.success_rate * 100)}%` : "--", color: obs.success_rate != null && obs.success_rate >= 0.8 ? "text-emerald-300" : "text-ember-300" },
                    { label: "Avg critic score", value: obs.avg_critic_score != null ? `${Math.round(obs.avg_critic_score * 100)}/100` : "--", color: "text-white" },
                    { label: "Avg duration",   value: obs.avg_duration_ms != null ? `${(obs.avg_duration_ms / 1000).toFixed(1)}s` : "--", color: "text-white" },
                  ].map(({ label, value, color }) => (
                    <div key={label} className="rounded-lg bg-ink-900 ring-1 ring-white/[0.07] px-4 py-3">
                      <p className="font-mono text-[9px] uppercase tracking-[0.18em] text-white/40">{label}</p>
                      <p className={`mt-1 text-2xl font-semibold ${color}`}>{String(value)}</p>
                    </div>
                  ))}
                </div>

                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  {/* By verdict */}
                  <div className="rounded-lg bg-ink-900 ring-1 ring-white/[0.07] p-4">
                    <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-white/40 mb-3">Runs by verdict</p>
                    <div className="space-y-2">
                      {(["approved", "revision", "rejected", "unknown"] as const).map(v => {
                        const count = obs.by_verdict[v] ?? 0;
                        const pct   = obs.total_runs > 0 ? Math.round((count / obs.total_runs) * 100) : 0;
                        const color = v === "approved" ? "bg-emerald-400" : v === "rejected" ? "bg-rose-400" : v === "revision" ? "bg-ember-400" : "bg-white/20";
                        const text  = v === "approved" ? "text-emerald-300" : v === "rejected" ? "text-rose-300" : v === "revision" ? "text-ember-300" : "text-white/40";
                        if (count === 0) return null;
                        return (
                          <div key={v}>
                            <div className="flex justify-between text-[11px] text-white/55 mb-1">
                              <span className={`capitalize font-mono ${text}`}>{v}</span>
                              <span className="font-mono">{count} <span className="text-white/30">({pct}%)</span></span>
                            </div>
                            <div className="meter">
                              <span className={color} style={{ width: `${pct}%`, background: undefined }} />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* By scenario */}
                  <div className="rounded-lg bg-ink-900 ring-1 ring-white/[0.07] p-4">
                    <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-white/40 mb-3">Runs by scenario</p>
                    <div className="space-y-2">
                      {Object.entries(obs.by_scenario).sort((a, b) => b[1] - a[1]).map(([scenario, count]) => {
                        const pct = obs.total_runs > 0 ? Math.round((count / obs.total_runs) * 100) : 0;
                        return (
                          <div key={scenario}>
                            <div className="flex justify-between text-[11px] text-white/55 mb-1">
                              <span>{SCENARIO_LABELS[scenario] ?? scenario}</span>
                              <span className="font-mono">{count} <span className="text-white/30">({pct}%)</span></span>
                            </div>
                            <div className="meter">
                              <span style={{ width: `${pct}%` }} />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </section>
            )}
          </>
        )}
      </div>
    </main>
  );
}

function HealthCard({ title, value, detail, stagger }: { title: string; value: number; detail: string; stagger: number }) {
  return (
    <div className={`rounded-lg border border-white/10 bg-white/[0.03] p-5 stagger-${stagger}`}>
      <p className="text-xs font-mono uppercase tracking-[0.16em] text-slate-500">{title}</p>
      <p className="mt-3 text-3xl font-semibold tabular-nums">{value}</p>
      <p className="mt-2 text-xs text-slate-400">{detail}</p>
    </div>
  );
}

function Signal({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center justify-between rounded-lg border border-white/10 bg-slate-950/40 px-3 py-3">
      <span className="text-sm text-slate-400">{label}</span>
      <span className="font-mono text-sm text-slate-100">{value}</span>
    </div>
  );
}

function range(values: Array<string | null>) {
  const [start, end] = values;
  return `${start ?? "-"} to ${end ?? "-"}`;
}
