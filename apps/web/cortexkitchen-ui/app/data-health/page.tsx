"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { getDataHealth } from "@/lib/api";
import { DataHealth } from "@/types/planning";

export default function DataHealthPage() {
  const [data, setData] = useState<DataHealth | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getDataHealth()
      .then(setData)
      .catch((err) => setError(err instanceof Error ? err.message : "Unable to load data health"));
  }, []);

  return (
    <main className="min-h-screen bg-[#09111f] px-5 py-6 text-slate-100 xl:px-8">
      <div className="mx-auto max-w-[1520px] space-y-6">
        <header className="flex flex-col gap-4 border-b border-white/10 pb-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-mono uppercase tracking-[0.22em] text-cyan-300">
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
            <Link className="rounded-lg border border-violet-400/20 bg-violet-500/10 px-3 py-2 text-xs font-mono text-violet-200" href="/runs">
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
          <p className="text-sm text-slate-500">Loading data health...</p>
        ) : (
          <>
            <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-5">
              <HealthCard title="Orders" value={data.orders.count} detail={range(data.orders.date_range)} />
              <HealthCard title="Reservations" value={data.reservations.count} detail={range(data.reservations.date_range)} />
              <HealthCard title="Feedback" value={data.feedback.count} detail={`${data.feedback.negative} negative (${data.feedback.negative_pct}%)`} />
              <HealthCard title="Inventory" value={data.inventory.items} detail={`${data.inventory.critical_shortages} critical shortages`} />
              <HealthCard title="Menu Items" value={data.menu.items} detail="active catalog" />
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
                        <tr key={`${row.scenario}-${row.date}`}>
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
          </>
        )}
      </div>
    </main>
  );
}

function HealthCard({ title, value, detail }: { title: string; value: number; detail: string }) {
  return (
    <div className="rounded-lg border border-white/10 bg-white/[0.03] p-5">
      <p className="text-xs font-mono uppercase tracking-[0.16em] text-slate-500">{title}</p>
      <p className="mt-3 text-3xl font-semibold">{value}</p>
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
