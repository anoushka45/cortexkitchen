"use client";

import { useEffect } from "react";
import AgentPipelineGrid from "@/components/planning/AgentPipelineGrid";
import PlanTriggerPanel from "@/components/planning/PlanTriggerPanel";
import { MarketPulseResponse, RestaurantProfile } from "@/lib/api";
import { PlanningScenarioOption, PlanTriggerHandler } from "@/types/planning";

interface Props {
  open: boolean;
  onClose: () => void;
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
}

export default function PlanShiftModal({
  open, onClose, onRun,
  scenarioOptions, selectedScenario, onScenarioChange, scenario,
  profiles, selectedProfileId, onSelectProfile, activeProfile,
  marketPulse, marketLoaded,
}: Props) {
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

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
            <AgentPipelineGrid variant="compact" />

            <div className="mt-6">
              <PlanTriggerPanel
                onRun={onRun}
                scenarioOptions={scenarioOptions}
                selectedScenario={selectedScenario}
                onScenarioChange={onScenarioChange}
                scenario={scenario}
                profiles={profiles}
                selectedProfileId={selectedProfileId}
                onSelectProfile={onSelectProfile}
                activeProfile={activeProfile}
                marketPulse={marketPulse}
                marketLoaded={marketLoaded}
                onAfterRun={onClose}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
