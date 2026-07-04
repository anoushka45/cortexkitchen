"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import AgentCard from "@/components/dashboard/AgentCard";
import CriticBanner from "@/components/dashboard/CriticBanner";
import DashboardDetailModal from "@/components/dashboard/DashboardDetailModal";
import ForecastChart from "@/components/dashboard/ForecastChart";
import ManagerActionPanel from "@/components/dashboard/ManagerActionPanel";
import SectionHeader from "@/components/dashboard/SectionHeader";
import { useSelectedRun } from "@/hooks/useSelectedRun";

function reservationSwiggySignal(data: ReturnType<typeof useSelectedRun>["data"]): string | undefined {
  const occ = data?.swiggy_occupancy_context as Record<string, unknown> | null | undefined;
  const sig = occ?.occupancy_signal as string | undefined;
  return sig ? `area tonight: ${sig}` : undefined;
}

function inventorySwiggySignal(data: ReturnType<typeof useSelectedRun>["data"]): string | undefined {
  const proc = data?.swiggy_procurement_options as Record<string, unknown> | null | undefined;
  const opts = proc?.procurement_options as unknown[] | undefined;
  return opts && opts.length > 0 ? `${opts.length} Instamart prices live` : undefined;
}

function menuSwiggySignal(data: ReturnType<typeof useSelectedRun>["data"]): string | undefined {
  const comp = data?.swiggy_competitor_context as Record<string, unknown> | null | undefined;
  const alerts = comp?.alerts as unknown[] | undefined;
  const avgMap = comp?.area_avg as Record<string, number> | undefined;
  const dishCount = avgMap ? Object.keys(avgMap).length : 0;
  if (alerts && alerts.length > 0) return `${alerts.length} pricing alert${alerts.length !== 1 ? "s" : ""} · ${dishCount} dishes`;
  if (dishCount > 0) return `${dishCount} competitor dishes tracked`;
  return undefined;
}

function OperationsContent() {
  const { data, status, error } = useSelectedRun();
  const [showManagerBrief, setShowManagerBrief] = useState(false);

  return (
    <div className="min-h-screen bg-[var(--color-surface-page)] text-[var(--color-text-primary)]">
      <main className="mx-auto w-full max-w-[1520px] px-6 py-8 xl:px-14">

        <header className="flex flex-col gap-4 border-b border-[var(--color-border-default)] pb-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.22em] text-[var(--color-accent)]">the 5 specialists</p>
            <h1 className="display mt-2 text-[32px] text-[var(--color-text-primary)]">Operations</h1>
            <p className="mt-1 max-w-2xl text-sm text-[var(--color-text-soft)]">
              What each specialist found for {data?.scenario ? data.scenario.replace(/_/g, " ") : "the current run"}
              {data?.target_date ? ` — ${data.target_date}` : ""}.
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {status === "success" && (
              <button
                onClick={() => setShowManagerBrief(true)}
                className="btn-primary inline-flex items-center gap-1.5 rounded-lg px-4 py-1.5 text-xs font-semibold"
              >
                Open manager brief
              </button>
            )}
            <Link href="/dashboard" className="rounded-lg border border-[var(--color-border-default)] px-3 py-2 text-xs text-[var(--color-text-soft)] hover:bg-[var(--color-surface-raised)] hover:text-[var(--color-text-primary)] transition-colors">
              ← dashboard
            </Link>
          </div>
        </header>

        <div className="mt-8">
          {status === "loading" && (
            <p className="text-sm text-[var(--color-text-faint)]">Loading the last plan…</p>
          )}

          {status === "empty" && (
            <div className="rounded-xl border border-[var(--color-border-default)] bg-[var(--color-surface-raised)] px-6 py-10 text-center">
              <p className="text-sm font-medium text-[var(--color-text-primary)]">No plans yet</p>
              <p className="mt-1 text-sm text-[var(--color-text-faint)]">
                Run your first plan from the dashboard to see what each specialist finds.
              </p>
              <Link href="/dashboard" className="mt-4 inline-block text-sm text-[var(--color-accent)] underline underline-offset-4">
                Go to dashboard
              </Link>
            </div>
          )}

          {status === "error" && (
            <p className="text-sm text-rose-400">{error ?? "Could not load this run."}</p>
          )}

          {status === "success" && data && (
            <div className="space-y-4">
              <CriticBanner
                critic={data.critic}
                generatedAt={data.generated_at}
                targetDate={data.target_date}
              />

              <div className="space-y-4">
                <SectionHeader
                  label="Service Planning"
                  description="Demand pacing and reservation pressure for the current run."
                  tone="ember"
                />
                <div className="grid grid-cols-1 gap-5 xl:grid-cols-12">
                  <div className="xl:col-span-8">
                    <ForecastChart
                      forecast={data.recommendations.forecast}
                      scenario={data.scenario}
                    />
                  </div>
                  <div className="xl:col-span-4">
                    <AgentCard
                      agentKey="reservation"
                      data={data.recommendations.reservation as Record<string, unknown> | null}
                      index={0}
                      swiggySignal={reservationSwiggySignal(data)}
                    />
                  </div>
                </div>
              </div>

              <div className="mt-10 space-y-4">
                <SectionHeader
                  label="Operational Risk"
                  description="Customer sentiment and stock pressure shaping service execution."
                  tone="rose"
                />
                <div className="grid grid-cols-1 items-stretch gap-5 xl:grid-cols-12">
                  <div className="xl:col-span-7">
                    <AgentCard
                      agentKey="complaint"
                      data={data.recommendations.complaint as Record<string, unknown> | null}
                      index={1}
                    />
                  </div>
                  <div className="xl:col-span-5">
                    <AgentCard
                      agentKey="inventory"
                      data={data.recommendations.inventory as Record<string, unknown> | null}
                      index={2}
                      swiggySignal={inventorySwiggySignal(data)}
                    />
                  </div>
                </div>
              </div>

              <div className="mt-10 space-y-4">
                <SectionHeader
                  label="Menu Direction"
                  description="Commercial and operational guidance synthesised for this planning window."
                  tone="amber"
                />
                <AgentCard
                  agentKey="menu"
                  data={data.recommendations.menu as Record<string, unknown> | null}
                  index={3}
                  swiggySignal={menuSwiggySignal(data)}
                />
              </div>

              <DashboardDetailModal
                open={showManagerBrief}
                title="Manager Brief"
                subtitle="A synthesized action view grouped by urgency and service timing."
                meta={[
                  { label: "scenario", value: data.scenario ?? "-" },
                  { label: "target", value: data.target_date ?? "-" },
                  { label: "critic", value: data.critic.verdict ?? "-" },
                ]}
                highlights={[
                  "Use this brief as the handoff layer for pre-shift alignment and live service coordination.",
                  "The recommendations are synthesized from forecast, reservation, complaint, menu, and inventory signals.",
                ]}
                onClose={() => setShowManagerBrief(false)}
              >
                <ManagerActionPanel data={data} />
              </DashboardDetailModal>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

export default function OperationsPage() {
  return (
    <Suspense fallback={null}>
      <OperationsContent />
    </Suspense>
  );
}
