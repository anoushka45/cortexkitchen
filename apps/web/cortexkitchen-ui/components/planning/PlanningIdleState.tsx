"use client";

import { useEffect, useState } from "react";
import AgentPipelineGrid from "@/components/planning/AgentPipelineGrid";
import PlanTriggerPanel from "@/components/planning/PlanTriggerPanel";
import { usePlanTriggerData } from "@/hooks/usePlanTriggerData";
import { getDataHealth, getPlanningRun } from "@/lib/api";
import { downloadRunPdf } from "@/lib/exportRun";
import { relativeTime, shortDate, VERDICT_TONE } from "@/lib/formatters";
import { SCENARIO_OPTIONS } from "@/lib/scenarios";
import { DataHealth, PlanningRunMetadata, PlanningScenarioOption, RunHistoryEntry, ScenarioProfile } from "@/types/planning";

interface Props {
  onRun: (date?: string, restaurantName?: string, restaurantId?: number, customProfile?: ScenarioProfile) => void;
  selectedScenario: PlanningScenarioOption["id"];
  onScenarioChange: (scenario: PlanningScenarioOption["id"]) => void;
  history: RunHistoryEntry[];
  onSelectHistory: (entry: RunHistoryEntry) => void;
  onShowAllHistory: () => void;
}

function ContextRow({ hue, icon, text }: { hue: string; icon: string; text: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full" style={{ background: `${hue}1a`, color: hue }}>
        <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2}><path strokeLinecap="round" strokeLinejoin="round" d={icon} /></svg>
      </span>
      <p className="text-[11.5px] text-[var(--color-text-soft)]">{text}</p>
    </div>
  );
}

function AnalyzeChip({ label }: { label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--color-border-soft)] bg-[var(--color-surface-raised)] px-2.5 py-1 text-[11px] text-[var(--color-text-soft)]">
      <svg className="h-3 w-3 shrink-0 text-[var(--color-good)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
      {label}
    </span>
  );
}

// The idle state for the flagship /planning page (P6-A34) -- everything
// needed to decide what to run and see what's run before, without
// repeating anything that lives on Dashboard (health score, priorities,
// live-signal cards), Action Center (action management), Analytics (menu/
// complaint deep dives), or /market (competitor pricing detail).
export default function PlanningIdleState({
  onRun, selectedScenario, onScenarioChange, history, onSelectHistory, onShowAllHistory,
}: Props) {
  const { profiles, selectedProfileId, setSelectedProfileId, activeProfile, marketPulse, marketLoaded } = usePlanTriggerData();
  const scenario = SCENARIO_OPTIONS.find((s) => s.id === selectedScenario) ?? SCENARIO_OPTIONS[0];

  const [dataHealth, setDataHealth] = useState<DataHealth | null>(null);
  useEffect(() => {
    getDataHealth().then(setDataHealth).catch(() => {});
  }, []);

  // Honest expectation-setter -- averaged from the last few real runs
  // (duration_ms/cost_usd from each run's stored metadata), not a fabricated
  // pre-run guess. A bounded fan-out (at most 5 detail fetches, once) rather
  // than one call per historical run.
  const [estimate, setEstimate] = useState<{ seconds: number; cost: number } | null>(null);
  useEffect(() => {
    if (history.length === 0) return;
    let cancelled = false;
    Promise.all(history.slice(0, 5).map((h) => getPlanningRun(Number(h.id)).catch(() => null)))
      .then((details) => {
        if (cancelled) return;
        const durations: number[] = [];
        const costs: number[] = [];
        for (const d of details) {
          const meta = d?.metadata as PlanningRunMetadata | undefined;
          if (typeof meta?.total_duration_ms === "number") durations.push(meta.total_duration_ms);
          if (typeof meta?.total_cost_usd === "number") costs.push(meta.total_cost_usd);
        }
        if (durations.length > 0 && costs.length > 0) {
          setEstimate({
            seconds: Math.round(durations.reduce((a, b) => a + b, 0) / durations.length / 1000),
            cost: costs.reduce((a, b) => a + b, 0) / costs.length,
          });
        }
      });
    return () => { cancelled = true; };
  }, [history]);

  async function handleExportRow(entry: RunHistoryEntry) {
    try { await downloadRunPdf(Number(entry.id), entry.scenario); } catch { /* best-effort */ }
  }

  return (
    <div className="space-y-6 py-2">
      <div>
        <h1 className="display text-[28px] text-[var(--color-text-primary)]">Planning</h1>
        <p className="mt-1 text-sm text-[var(--color-text-soft)]">
          5 specialists analyse your kitchen and market data, then a critic checks the plan before you see it.
        </p>
      </div>

      {/* Hero -- quick-run CTA, paired with the context that's actually
          feeding it (live signals + restaurant profile) so the decision and
          the data behind it sit side by side. */}
      <div className="card overflow-hidden p-0">
        <div className="grid grid-cols-1 gap-5 p-5 sm:p-6 xl:grid-cols-[1.5fr_1fr]">
          <div>
            <p className="flex items-center gap-1.5 text-[17px] font-bold text-[var(--color-text-primary)]">
              Plan your next shift
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="var(--color-accent)" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
            </p>
            <p className="mt-1 text-[12.5px] leading-relaxed text-[var(--color-text-soft)] max-w-md">
              Generate an AI-powered operational plan using your restaurant data, live market intelligence, weather, customer feedback and inventory.
            </p>
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() => onRun(undefined, activeProfile?.name ?? undefined, activeProfile?.id ?? undefined)}
                className="btn-primary inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-[13px] font-semibold transition-transform hover:scale-[1.02]"
              >
                Run for today
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.4}><path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" /></svg>
              </button>
              {estimate && (
                <div className="flex items-center gap-3 text-[11px] text-[var(--color-text-faint)]">
                  <span className="flex items-center gap-1"><svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><circle cx="12" cy="12" r="9" /><path strokeLinecap="round" d="M12 7v5l3 3" /></svg>~{estimate.seconds}s</span>
                  <span className="flex items-center gap-1"><svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.66 0-3 .9-3 2s1.34 2 3 2 3 .9 3 2-1.34 2-3 2m0-8V6m0 10v2m0-14a8 8 0 100 16 8 8 0 000-16z" /></svg>~${estimate.cost.toFixed(2)}</span>
                </div>
              )}
            </div>
            <p className="mt-2 text-[11px] text-[var(--color-text-faint)]">
              Uses {scenario.label} as the shift shape, dated today — no need to pick a date.
            </p>
          </div>

          <div className="flex flex-col gap-3">
            <div className="rounded-xl border border-[var(--color-border-soft)] bg-[var(--color-surface-raised)] p-3.5">
              <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--color-text-faint)]">Today&apos;s context</p>
              {!marketLoaded ? (
                <p className="text-[11px] text-[var(--color-text-faint)]">Checking live signals…</p>
              ) : (
                <div className="space-y-1.5">
                  {marketPulse?.weather && (
                    <ContextRow hue="#38bdf8" icon="M17.5 19H6a4 4 0 01-1-7.87A5.5 5.5 0 0116 8.5a4.5 4.5 0 011.5 10.5z" text={marketPulse.weather.condition === "clear" ? "Clear conditions" : marketPulse.weather.signal} />
                  )}
                  {marketPulse?.area_occupancy?.signal && (
                    <ContextRow hue="#fc8019" icon="M13 10V3L4 14h7v7l9-11h-7z" text={`Area demand ${marketPulse.area_occupancy.signal.toLowerCase()}`} />
                  )}
                  {marketPulse?.industry_trends && marketPulse.industry_trends.headline_count > 0 && (
                    <ContextRow hue="#818cf8" icon="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10" text="Industry trends noted" />
                  )}
                  {marketPulse?.compliance_alerts?.notice_count ? (
                    <ContextRow hue="#fb7185" icon="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" text={`${marketPulse.compliance_alerts.notice_count} FSSAI notice${marketPulse.compliance_alerts.notice_count !== 1 ? "s" : ""}`} />
                  ) : null}
                  {!marketPulse?.weather && !marketPulse?.area_occupancy?.signal && (
                    <p className="text-[11px] text-[var(--color-text-faint)]">Nothing unusual today.</p>
                  )}
                </div>
              )}
            </div>

            {activeProfile && (
              <div className="rounded-xl border border-[var(--color-border-soft)] bg-[var(--color-surface-raised)] p-3.5">
                <p className="mb-1.5 text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--color-text-faint)]">Restaurant profile</p>
                <div className="flex items-center gap-2">
                  <span className="grid h-7 w-7 shrink-0 place-items-center rounded-md" style={{ background: "var(--color-accent-soft)", color: "var(--color-accent)" }}>
                    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3" /></svg>
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-[12.5px] font-semibold text-[var(--color-text-primary)]">{activeProfile.name}</p>
                    <p className="text-[10.5px] text-[var(--color-text-faint)]">{activeProfile.capacity} covers · {activeProfile.peak_hours}</p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 border-t border-[var(--color-border-soft)] bg-[var(--color-surface-sunken)] px-5 py-3 sm:px-6">
          <p className="mr-1 text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--color-text-faint)]">Today&apos;s plan will analyze</p>
          {dataHealth && <AnalyzeChip label={`${dataHealth.orders.count.toLocaleString("en-IN")} historical orders`} />}
          <AnalyzeChip label="Live weather" />
          <AnalyzeChip label="Swiggy market signals" />
          <AnalyzeChip label="Inventory" />
          <AnalyzeChip label="Reservations" />
          <AnalyzeChip label="Customer feedback" />
          <AnalyzeChip label="Industry trends" />
          <AnalyzeChip label="FSSAI advisories" />
        </div>
      </div>

      {/* Choose how you want to plan -- the full trigger form (shift-shape
          tiles, natural-language intake, date picker). Restaurant profile /
          live signals are suppressed here since the hero above already
          shows them. */}
      <div>
        <p className="text-[15px] font-bold text-[var(--color-text-primary)]">Choose how you want to plan</p>
        <div className="card mt-3 p-5 sm:p-6">
          <PlanTriggerPanel
            onRun={onRun}
            scenarioOptions={SCENARIO_OPTIONS}
            selectedScenario={selectedScenario}
            onScenarioChange={onScenarioChange}
            scenario={scenario}
            profiles={profiles}
            selectedProfileId={selectedProfileId}
            onSelectProfile={setSelectedProfileId}
            activeProfile={activeProfile}
            marketPulse={marketPulse}
            marketLoaded={marketLoaded}
            showContext={false}
          />
        </div>
      </div>

      <div>
        <p className="text-[15px] font-bold text-[var(--color-text-primary)]">Meet your planning team</p>
        <p className="mt-0.5 text-[12.5px] text-[var(--color-text-faint)]">What each specialist actually checks before the plan reaches you.</p>
        <div className="mt-3">
          <AgentPipelineGrid variant="full" />
        </div>
      </div>

      <div>
        <p className="text-[15px] font-bold text-[var(--color-text-primary)]">What you&apos;ll receive</p>
        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {[
            { label: "Operational Plan", desc: "Complete shift strategy with demand, staffing and menu recommendations.", hue: "#38bdf8", icon: "M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" },
            { label: "Demand & Inventory Guidance", desc: "Exact reorder quantities and shortage alerts against tonight's forecast.", hue: "#34d399", icon: "M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" },
            { label: "Risk Flags", desc: "Capacity, overbooking, and demand-absorption risks the critic caught.", hue: "#fb7185", icon: "M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" },
            { label: "Action Queue", desc: "Ready-to-approve actions for you and your team to execute.", hue: "#fbbf24", icon: "M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" },
          ].map((item) => (
            <div key={item.label} className="card p-4">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg" style={{ background: `${item.hue}1a`, color: item.hue }}>
                <svg className="h-4.5 w-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d={item.icon} /></svg>
              </span>
              <p className="mt-2.5 text-[13px] font-bold text-[var(--color-text-primary)]">{item.label}</p>
              <p className="mt-1 text-[11.5px] leading-relaxed text-[var(--color-text-faint)]">{item.desc}</p>
            </div>
          ))}
        </div>
      </div>

      {history.length > 0 && (
        <div>
          <div className="flex items-center justify-between">
            <p className="text-[15px] font-bold text-[var(--color-text-primary)]">Recent planning runs</p>
            <button onClick={onShowAllHistory} className="text-[11.5px] font-semibold text-[var(--color-accent)]">View all →</button>
          </div>
          <div className="card mt-3 overflow-x-auto p-0">
            <table className="w-full min-w-[720px] text-left text-[12.5px]">
              <thead>
                <tr className="border-b border-[var(--color-border-soft)] text-[10.5px] uppercase tracking-wide text-[var(--color-text-faint)]">
                  <th className="px-4 py-3 font-semibold">Date &amp; Time</th>
                  <th className="px-4 py-3 font-semibold">Scenario</th>
                  <th className="px-4 py-3 font-semibold">Shift Shape</th>
                  <th className="px-4 py-3 font-semibold">Critic Score</th>
                  <th className="px-4 py-3 font-semibold">Status</th>
                  <th className="px-4 py-3 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {history.slice(0, 6).map((entry) => {
                  const opt = SCENARIO_OPTIONS.find((s) => s.id === entry.scenario);
                  const tone = VERDICT_TONE[entry.verdict ?? "unknown"] ?? VERDICT_TONE.unknown;
                  return (
                    <tr key={entry.id} className="border-b border-[var(--color-border-soft)] last:border-0 hover:bg-[var(--color-surface-sunken)]">
                      <td className="px-4 py-3 text-[var(--color-text-soft)]">{shortDate(entry.runAt)} · {relativeTime(entry.runAt)}</td>
                      <td className="px-4 py-3 font-medium text-[var(--color-text-primary)]">{opt?.label ?? entry.scenario}</td>
                      <td className="px-4 py-3 font-mono text-[11px] text-[var(--color-text-faint)]">{opt?.service_window ?? "--"}</td>
                      <td className="px-4 py-3 font-mono text-[var(--color-text-soft)]">{entry.score != null ? `${entry.score}%` : "--"}</td>
                      <td className="px-4 py-3">
                        <span className="rounded-full px-2 py-0.5 text-[10px] font-bold uppercase" style={{ background: tone.bg, color: tone.text }}>{tone.label}</span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1.5">
                          <button onClick={() => onSelectHistory(entry)} title="View" className="rounded-md p-1.5 text-[var(--color-text-faint)] transition-colors hover:bg-[var(--color-surface-sunken)] hover:text-[var(--color-accent)]">
                            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                          </button>
                          <button onClick={() => handleExportRow(entry)} title="Export PDF" className="rounded-md p-1.5 text-[var(--color-text-faint)] transition-colors hover:bg-[var(--color-surface-sunken)] hover:text-[var(--color-accent)]">
                            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M7 10l5 5 5-5M12 15V3" /></svg>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
