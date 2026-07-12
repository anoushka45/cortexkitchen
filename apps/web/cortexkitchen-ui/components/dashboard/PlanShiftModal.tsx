"use client";

import { useEffect, useState } from "react";
import DatePicker from "@/components/dashboard/DatePicker";
import { deriveScenarioProfile, RestaurantProfile } from "@/lib/api";
import { PlanningScenarioOption, ScenarioProfile } from "@/types/planning";

const AGENT_PIPELINE = [
  {
    label: "Demand Forecast",
    capability: "Predicts how many covers to expect and how tonight compares to the same day last week.",
    iconPath: "M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z",
    tone: "good",
  },
  {
    label: "Reservation Pressure",
    capability: "Reads your live booking list and shows when you're likely to hit capacity.",
    iconPath: "M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z",
    tone: "info",
  },
  {
    label: "Guest Feedback",
    capability: "Scans customer feedback for recurring complaints and surfaces fixes for tonight.",
    iconPath: "M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z",
    tone: "rose",
  },
  {
    label: "Inventory",
    capability: "Flags what's running low or overstocked, with exact reorder quantities.",
    iconPath: "M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4",
    tone: "caution",
  },
  {
    label: "Menu Direction",
    capability: "Only recommends dishes that are actually in stock — runs after inventory.",
    iconPath: "M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4",
    tone: "good",
  },
  {
    label: "Critic",
    capability: "Scores every plan across safety, feasibility, evidence, and clarity before it reaches you.",
    iconPath: "M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z",
    tone: "good",
  },
] as const;

const TONE_CLASS: Record<string, { bg: string; text: string }> = {
  good:    { bg: "var(--color-good-soft)",    text: "var(--color-good)" },
  info:    { bg: "rgba(56,189,248,0.10)",     text: "#38bdf8" },
  rose:    { bg: "rgba(251,113,133,0.10)",    text: "#fb7185" },
  caution: { bg: "var(--color-caution-soft)", text: "var(--color-caution)" },
};

interface Props {
  open: boolean;
  onClose: () => void;
  onRun: (date?: string, restaurantName?: string, restaurantId?: number, customProfile?: ScenarioProfile) => void;
  scenarioOptions: PlanningScenarioOption[];
  selectedScenario: PlanningScenarioOption["id"];
  onScenarioChange: (scenario: PlanningScenarioOption["id"]) => void;
  scenario: PlanningScenarioOption;
  profiles: RestaurantProfile[];
  selectedProfileId: number | null;
  onSelectProfile: (id: number) => void;
  activeProfile: RestaurantProfile | null;
}

export default function PlanShiftModal({
  open, onClose, onRun,
  scenarioOptions, selectedScenario, onScenarioChange, scenario,
  profiles, selectedProfileId, onSelectProfile, activeProfile,
}: Props) {
  // P6-A25 — natural-language intake alongside the preset tiles above, not a
  // replacement of them. Deriving a profile synthesizes a 5th "custom" tile
  // and selects it; the full ScenarioProfile is threaded through onRun so the
  // backend gets the real label/service_window/operational_focus, not just
  // an id.
  const [customText, setCustomText]         = useState("");
  const [deriving, setDeriving]             = useState(false);
  const [deriveError, setDeriveError]       = useState<string | null>(null);
  const [customProfile, setCustomProfile]   = useState<ScenarioProfile | null>(null);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

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
    onClose();
  }

  return (
    <div className="fixed inset-0 z-[70]">
      <button
        aria-label="Close plan-your-shift dialog"
        className="absolute inset-0 bg-black/70 backdrop-blur-sm animate-[backdropIn_0.15s_ease_both]"
        onClick={onClose}
      />
      <div className="absolute inset-x-4 top-8 bottom-8 mx-auto max-w-2xl xl:top-14 xl:bottom-14">
        <div className="card flex h-full flex-col overflow-hidden rounded-3xl border-[var(--color-border-default)] shadow-2xl animate-[modalIn_0.2s_ease-out_both]">
          <div className="flex items-start justify-between gap-4 border-b border-[var(--color-border-soft)] bg-[var(--color-surface-raised)] px-6 py-5">
            <div>
              <p className="text-[10.5px] font-bold uppercase tracking-[0.18em] text-[var(--color-accent)]">Plan your next shift</p>
              <h2 className="display mt-1 text-2xl text-[var(--color-text-primary)]">5 specialists, one plan</h2>
              <p className="mt-1 text-[13px] text-[var(--color-text-soft)]">They work through your kitchen and market data, then a critic checks the result before you see it.</p>
            </div>
            <button
              onClick={onClose}
              className="shrink-0 rounded-full border border-[var(--color-border-default)] bg-[var(--color-surface-sunken)] px-3 py-1.5 text-xs text-[var(--color-text-soft)] transition-colors hover:bg-[var(--color-surface-sunken)]"
            >
              close
            </button>
          </div>

          <div className="flex-1 overflow-y-auto px-6 py-6">
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {AGENT_PIPELINE.map((agent) => (
                <div key={agent.label} className="flex items-start gap-2.5 rounded-xl border border-[var(--color-border-soft)] bg-[var(--color-surface-raised)] px-3.5 py-2.5">
                  <span className="grid h-7 w-7 shrink-0 place-items-center rounded-md" style={{ background: TONE_CLASS[agent.tone].bg, color: TONE_CLASS[agent.tone].text }}>
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.7}>
                      <path strokeLinecap="round" strokeLinejoin="round" d={agent.iconPath} />
                    </svg>
                  </span>
                  <div className="min-w-0">
                    <p className="text-[12.5px] font-semibold text-[var(--color-text-primary)]">{agent.label}</p>
                    <p className="mt-0.5 text-[11px] leading-relaxed text-[var(--color-text-faint)]">{agent.capability}</p>
                  </div>
                </div>
              ))}
            </div>

            {profiles.length > 0 && (
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

            <div className="mt-6">
              <p className="mb-2 text-[10.5px] font-bold uppercase tracking-[0.14em] text-[var(--color-text-faint)]">Choose a shift</p>
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

            <div className="mt-6">
              <p className="mb-2 text-[10.5px] font-bold uppercase tracking-[0.14em] text-[var(--color-text-faint)]">Or describe it instead</p>
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

            <div className="mt-6">
              <p className="mb-2 text-[10.5px] font-bold uppercase tracking-[0.14em] text-[var(--color-text-faint)]">Pick a date and run</p>
              <DatePicker onRun={handleRun} loading={false} scenario={scenario} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
