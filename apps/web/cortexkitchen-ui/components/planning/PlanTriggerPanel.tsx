"use client";

import { useState } from "react";
import DatePicker from "@/components/dashboard/DatePicker";
import TodayContextStrip from "@/components/dashboard/TodayContextStrip";
import { useScenarioRecommendation } from "@/hooks/useScenarioRecommendation";
import { deriveScenarioProfile, MarketPulseResponse, RestaurantProfile } from "@/lib/api";
import { PlanningScenarioOption, PlanTriggerHandler, ScenarioProfile } from "@/types/planning";

interface Props {
  onRun: PlanTriggerHandler;
  scenarioOptions: PlanningScenarioOption[];
  selectedScenario: PlanningScenarioOption["id"];
  onScenarioChange: (scenario: PlanningScenarioOption["id"]) => void;
  scenario: PlanningScenarioOption;
  profiles: RestaurantProfile[];
  selectedProfileId: number | null;
  onSelectProfile: (id: number) => void;
  activeProfile: RestaurantProfile | null;
  marketPulse: MarketPulseResponse | null;
  marketLoaded: boolean;
  onAfterRun?: () => void;
  // PlanningIdleState renders its own hero versions of the restaurant-profile
  // and live-signals blocks, so it passes false here to avoid showing both.
  // PlanShiftModal has no surrounding hero, so it keeps the default (true).
  showContext?: boolean;
  // "full" (default, PlanShiftModal) shows the quick-run banner + shift-shape
  // grid + free-text intake + date picker together. PlanningIdleState's
  // 3-card "How would you like to plan?" chooser instead expands just one
  // section at a time to match the reference design's progressive disclosure.
  mode?: "full" | "scenario-only" | "describe-only";
}

// The actual trigger form -- extracted out of PlanShiftModal (P6-A34) so the
// exact same picker (quick-run banner, restaurant profile, live signals,
// scenario tiles, natural-language intake, date picker) can render either
// inside Dashboard's modal chrome or inline as its own section on the
// /planning idle state, without two copies drifting apart.
export default function PlanTriggerPanel({
  onRun, scenarioOptions, selectedScenario, onScenarioChange, scenario,
  profiles, selectedProfileId, onSelectProfile, activeProfile,
  marketPulse, marketLoaded, onAfterRun, showContext = true, mode = "full",
}: Props) {
  const [customText, setCustomText]       = useState("");
  const [deriving, setDeriving]           = useState(false);
  const [deriveError, setDeriveError]     = useState<string | null>(null);
  const [customProfile, setCustomProfile] = useState<ScenarioProfile | null>(null);

  // Only fetched when the quick-run banner is actually shown (mode="full").
  const { composition } = useScenarioRecommendation(mode === "full");

  async function handleDeriveProfile() {
    if (!customText.trim() || deriving) return;
    setDeriving(true);
    setDeriveError(null);
    try {
      const profile = await deriveScenarioProfile(customText.trim());
      setCustomProfile(profile);
      onScenarioChange(profile.id);
    } catch (err) {
      setDeriveError(err instanceof Error ? err.message : "Couldn't turn that into a plan — try rephrasing.");
    } finally {
      setDeriving(false);
    }
  }

  const customTile: PlanningScenarioOption | null = customProfile ? {
    id: customProfile.id,
    label: customProfile.label,
    description: customProfile.operational_focus,
    default_weekday: new Date().getDay(),
    service_window: customProfile.service_window,
    operational_focus: customProfile.operational_focus,
  } : null;

  const displayedOptions = customTile ? [...scenarioOptions, customTile] : scenarioOptions;
  const usingCustom = customProfile !== null && selectedScenario === customProfile.id;

  function handleRun(date?: string) {
    onRun(
      date,
      activeProfile?.name ?? undefined,
      activeProfile?.id ?? undefined,
      usingCustom ? (customProfile ?? undefined) : undefined,
    );
    onAfterRun?.();
  }

  function todayISO(): string {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }

  // Separate from handleRun (which DatePicker also uses for arbitrary future
  // dates, where auto-recommending today's shape would be wrong) -- this is
  // specifically the "Just run it for today" banner, so it always passes the
  // recommended scenario as an explicit override rather than relying on
  // whatever's currently selected.
  function handleRunToday() {
    if (composition) {
      onScenarioChange(composition.profile.id);
      onRun(
        todayISO(), activeProfile?.name ?? undefined, activeProfile?.id ?? undefined,
        composition.profile, composition.profile.id,
      );
    } else {
      onRun(todayISO(), activeProfile?.name ?? undefined, activeProfile?.id ?? undefined);
    }
    onAfterRun?.();
  }

  return (
    <div>
      {/* Planning is no longer tied to "next Friday" or any fixed weekday --
          any preset (or a described scenario) can run for any date, including
          right now. This is the fast path; the tile grid / date picker below
          are for picking a specific preset, a future date, or describing a
          scenario in detail instead. Skipped in scenario-only/describe-only
          mode -- PlanningIdleState's own hero already has this exact CTA. */}
      {mode === "full" && (
        <div className="flex flex-col gap-2 rounded-2xl border border-[var(--color-accent)]/25 p-4 sm:flex-row sm:items-center sm:justify-between" style={{ background: "var(--color-accent-soft)" }}>
          <div>
            <p className="text-[13px] font-bold text-[var(--color-text-primary)]">Just run it for today</p>
            <p className="mt-0.5 text-[11.5px] text-[var(--color-text-soft)]">
              {composition
                ? <>Recommended: <span className="font-semibold">{composition.profile.label}</span> — {composition.reason}</>
                : <>Uses {scenario.label} as the shift shape, dated today — no need to pick a date.</>}
            </p>
          </div>
          <button
            type="button"
            onClick={handleRunToday}
            className="btn-primary shrink-0 inline-flex items-center justify-center gap-2 rounded-xl px-5 py-2.5 text-[13px] font-semibold transition-transform hover:scale-[1.02]"
          >
            Run for today
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.4}><path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" /></svg>
          </button>
        </div>
      )}

      {showContext && profiles.length > 0 && (
        <div className="mt-6">
          <p className="mb-2 text-[10.5px] font-bold uppercase tracking-[0.14em] text-[var(--color-text-faint)]">Restaurant profile</p>
          {profiles.length === 1 ? (
            <div className="flex items-center gap-2 rounded-lg border border-[var(--color-border-default)] bg-[var(--color-surface-raised)] px-3 py-2">
              <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-ember-400" />
              <span className="text-sm text-[var(--color-text-primary)]">{activeProfile?.name}</span>
              {activeProfile && (
                <span className="mono ml-auto text-[10px] text-[var(--color-text-faint)]">{activeProfile.capacity} covers · {activeProfile.peak_hours}</span>
              )}
            </div>
          ) : (
            <select
              value={selectedProfileId ?? ""}
              onChange={(e) => onSelectProfile(Number(e.target.value))}
              className="w-full rounded-lg border border-[var(--color-border-default)] bg-[var(--color-surface-sunken)] px-3 py-2 text-sm text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-ember-500/50 focus:border-ember-500/60"
            >
              {profiles.map((p) => (
                <option key={p.id} value={p.id}>{p.name} — {p.capacity} covers · {p.peak_hours}</option>
              ))}
            </select>
          )}
        </div>
      )}

      {showContext && (
        <div className="mt-6">
          <TodayContextStrip marketPulse={marketPulse} loaded={marketLoaded} />
        </div>
      )}

      {mode === "full" && (
        <div className="mt-6 border-t border-[var(--color-border-soft)] pt-5">
          <p className="text-[10.5px] font-bold uppercase tracking-[0.14em] text-[var(--color-text-faint)]">Or customize the plan</p>
          <p className="mt-0.5 text-[11px] text-[var(--color-text-faint)]">Pick a specific shift shape, describe tonight in your own words, or choose a different date.</p>
        </div>
      )}

      {(mode === "full" || mode === "scenario-only") && (
        <div className={mode === "full" ? "mt-4" : ""}>
          {mode === "full" && <p className="mb-2 text-[10.5px] font-bold uppercase tracking-[0.14em] text-[var(--color-text-faint)]">Shift shape</p>}
          <div className="grid grid-cols-2 gap-2">
            {displayedOptions.map((option) => {
              const active = option.id === selectedScenario;
              return (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => onScenarioChange(option.id)}
                  className={`rounded-xl border px-3.5 py-2.5 text-left transition-all ${
                    active
                      ? "border-ember-400/40 bg-ember-500/10"
                      : "border-[var(--color-border-default)] bg-[var(--color-surface-sunken)] hover:bg-[var(--color-surface-raised)]"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className={`text-[13px] font-semibold ${active ? "text-[var(--color-accent)]" : "text-[var(--color-text-primary)]"}`}>{option.label}</p>
                    <span className="mono shrink-0 text-[9.5px] text-[var(--color-text-ghost)]">{option.service_window}</span>
                  </div>
                  <p className={`mt-1 text-[11px] leading-relaxed ${active ? "text-[var(--color-text-soft)]" : "text-[var(--color-text-faint)]"}`}>{option.description}</p>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {(mode === "full" || mode === "describe-only") && (
        <div className={mode === "full" ? "mt-6" : ""}>
          {mode === "full" && <p className="mb-2 text-[10.5px] font-bold uppercase tracking-[0.14em] text-[var(--color-text-faint)]">Or describe it instead</p>}
          <div className="flex gap-2">
            <input
              type="text"
              value={customText}
              onChange={(e) => setCustomText(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleDeriveProfile(); } }}
              placeholder="e.g. we're hosting an event today, expecting large turnover"
              className="flex-1 rounded-lg border border-[var(--color-border-default)] bg-[var(--color-surface-sunken)] px-3 py-2 text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-ghost)] focus:outline-none focus:ring-2 focus:ring-ember-500/50 focus:border-ember-500/60"
            />
            <button
              type="button"
              onClick={handleDeriveProfile}
              disabled={!customText.trim() || deriving}
              className="shrink-0 rounded-lg border border-ember-400/40 bg-ember-500/10 px-3.5 py-2 text-xs font-semibold text-[var(--color-accent)] transition-colors hover:bg-ember-500/20 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {deriving ? "Thinking…" : "Use this"}
            </button>
          </div>
          {deriveError && (
            <p className="mt-1.5 text-[11px] text-rose-400">{deriveError}</p>
          )}
          {usingCustom && customProfile && (
            <p className="mt-1.5 text-[11px] text-[var(--color-good)]">
              Using &quot;{customProfile.label}&quot; ({customProfile.service_window}) — selected above.
            </p>
          )}
        </div>
      )}

      {(mode === "full" || mode === "scenario-only") && (
        <div className="mt-6">
          <p className="mb-2 text-[10.5px] font-bold uppercase tracking-[0.14em] text-[var(--color-text-faint)]">Or pick a specific date and run</p>
          <DatePicker onRun={handleRun} loading={false} scenario={scenario} />
        </div>
      )}
    </div>
  );
}
