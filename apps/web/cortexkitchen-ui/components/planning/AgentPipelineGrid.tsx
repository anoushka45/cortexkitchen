"use client";

import { AGENT_PIPELINE, AGENT_TONE_CLASS, PIPELINE_STAGES, type AgentCapability } from "./agentPipeline";

interface Props {
  variant?: "compact" | "full";
}

function CompactCard({ agent }: { agent: AgentCapability }) {
  const tone = AGENT_TONE_CLASS[agent.tone];
  return (
    <div className="flex items-start gap-2.5 rounded-xl border border-[var(--color-border-soft)] bg-[var(--color-surface-raised)] px-3.5 py-2.5">
      <span className="grid h-7 w-7 shrink-0 place-items-center rounded-md" style={{ background: tone.bg, color: tone.text }}>
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.7}>
          <path strokeLinecap="round" strokeLinejoin="round" d={agent.iconPath} />
        </svg>
      </span>
      <div className="min-w-0">
        <div className="flex items-center gap-1.5">
          <p className="text-[12.5px] font-semibold text-[var(--color-text-primary)]">{agent.label}</p>
          {agent.swiggy && <img src="/swiggy-logo.png" alt="Swiggy" className="h-3 w-3 shrink-0 object-contain opacity-70" />}
        </div>
        <p className="mt-0.5 text-[11px] leading-relaxed text-[var(--color-text-faint)]">{agent.capability}</p>
      </div>
    </div>
  );
}

function StepArrow() {
  return (
    <div className="hidden shrink-0 items-center justify-center px-1 text-[var(--color-border-default)] xl:flex">
      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
      </svg>
    </div>
  );
}

function StepHeader({ step, label, done }: { step: number; label: string; done?: boolean }) {
  return (
    <div className="flex items-center gap-1.5">
      <span
        className="grid h-5 w-5 shrink-0 place-items-center rounded-full text-[10px] font-bold"
        style={done ? { background: "var(--color-good-soft)", color: "var(--color-good)" } : { background: "var(--color-accent-soft)", color: "var(--color-accent)" }}
      >
        {done ? (
          <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
        ) : step}
      </span>
      <p className="truncate text-[11.5px] font-bold text-[var(--color-text-primary)]">{label}</p>
    </div>
  );
}

// One horizontal node for a solo-agent stage (Forecast / Menu / Critic).
function SoloNode({ step, stageLabel, agent }: { step: number; stageLabel: string; agent: AgentCapability }) {
  const tone = AGENT_TONE_CLASS[agent.tone];
  return (
    <div className="card flex w-full flex-col gap-2.5 p-4 xl:w-[190px]">
      <StepHeader step={step} label={stageLabel} />
      <div className="flex items-start gap-2.5">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg" style={{ background: tone.bg, color: tone.text }}>
          <svg className="h-4.5 w-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.7}>
            <path strokeLinecap="round" strokeLinejoin="round" d={agent.iconPath} />
          </svg>
        </span>
        <p className="text-[11px] leading-relaxed text-[var(--color-text-faint)]">{agent.capability}</p>
      </div>
    </div>
  );
}

// The "5 specialists in parallel" node -- a cluster of small icon chips
// rather than 5 full cards, so it reads as one pipeline step, not 5.
function SpecialistsNode({ step, stageLabel, agents }: { step: number; stageLabel: string; agents: AgentCapability[] }) {
  return (
    <div className="card flex w-full flex-col gap-2.5 p-4 xl:w-[230px]">
      <StepHeader step={step} label={stageLabel} />
      <div className="grid grid-cols-5 gap-1.5 xl:grid-cols-3">
        {agents.map((agent) => {
          const tone = AGENT_TONE_CLASS[agent.tone];
          return (
            <div key={agent.label} className="group relative flex flex-col items-center gap-1">
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg" style={{ background: tone.bg, color: tone.text }}>
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.7}>
                  <path strokeLinecap="round" strokeLinejoin="round" d={agent.iconPath} />
                </svg>
              </span>
              <p className="text-center text-[9px] leading-tight text-[var(--color-text-faint)]">{agent.label.split(" ")[0]}</p>
              {/* Tooltip-style detail on hover -- keeps the node compact by default */}
              <div className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-1.5 w-40 -translate-x-1/2 rounded-lg border border-[var(--color-border-default)] bg-[var(--color-surface-raised)] p-2 text-[10px] leading-snug text-[var(--color-text-soft)] opacity-0 shadow-xl transition-opacity group-hover:opacity-100">
                <p className="font-bold text-[var(--color-text-primary)]">{agent.label}</p>
                {agent.capability}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function FinalPlanNode() {
  return (
    <div className="card flex w-full flex-col gap-2.5 border-[var(--color-good)]/25 p-4 xl:w-[190px]" style={{ background: "var(--color-good-soft)" }}>
      <StepHeader step={0} label="Final Plan" done />
      <div className="flex items-start gap-2.5">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg" style={{ background: "rgba(255,255,255,0.5)", color: "var(--color-good)" }}>
          <svg className="h-4.5 w-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </span>
        <p className="text-[11px] leading-relaxed text-[var(--color-text-soft)]">Your operational plan — actionable and ready for tonight.</p>
      </div>
    </div>
  );
}

// Shared "meet your planning team" visual -- compact variant is the flat
// list PlanShiftModal has always shown (limited modal space); full variant
// lays the same data out as the real horizontal pipeline (forecast -> 5
// parallel specialists -> menu synthesis -> critic -> final plan), used as
// its own section on the /planning idle state.
export default function AgentPipelineGrid({ variant = "compact" }: Props) {
  if (variant === "compact") {
    return (
      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
        {AGENT_PIPELINE.map((agent) => <CompactCard key={agent.label} agent={agent} />)}
      </div>
    );
  }

  return (
    <div className="flex flex-col items-stretch gap-2 xl:flex-row xl:items-start xl:overflow-x-auto xl:pb-2">
      {PIPELINE_STAGES.map((stage, i) => (
        <div key={stage.id} className="flex flex-col items-stretch gap-2 xl:flex-row xl:items-center">
          {stage.agents.length > 1 ? (
            <SpecialistsNode step={stage.step} stageLabel={stage.label} agents={stage.agents} />
          ) : (
            <SoloNode step={stage.step} stageLabel={stage.label} agent={stage.agents[0]} />
          )}
          <StepArrow />
        </div>
      ))}
      <FinalPlanNode />
    </div>
  );
}
