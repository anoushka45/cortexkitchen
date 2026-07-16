"use client";

import { AGENT_PIPELINE, AGENT_TONE_CLASS, FINAL_PLAN_AGENT, type AgentCapability } from "./agentPipeline";

interface Props {
  variant?: "compact" | "full";
  // "full" only -- 3 fills the wide right-hand panel evenly (9 cards -> 3
  // neat rows). Left at 2 as an option for narrower containers.
  columns?: 2 | 3;
}

function CompactCard({ agent }: { agent: AgentCapability }) {
  const tone = AGENT_TONE_CLASS[agent.tone];
  return (
    <div className="flex items-start gap-2.5 rounded-xl border border-[var(--color-border-soft)] bg-[var(--color-surface-raised)] px-3.5 py-2.5">
      <span className="grid h-7 w-7 shrink-0 place-items-center rounded-md text-white" style={{ background: tone.fill }}>
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

// One specialist, as a proper feature card -- not a flowchart node. No step
// number, no "runs after X" chrome: an owner cares what this finds or
// protects for them, not where it sits in a graph. A small status dot
// (top-right) marks live-data agents -- orange for Swiggy-sourced, green for
// everything else -- instead of a text badge, so the claim registers without
// spending card width on it.
function SpecialistCard({ agent, isOutput = false }: { agent: AgentCapability; isOutput?: boolean }) {
  const tone = AGENT_TONE_CLASS[agent.tone];
  const dotColor = agent.swiggy ? "#fc8019" : agent.live ? "#fc8019" : "var(--color-good)";
  return (
    <div className="card flex h-full flex-col gap-1.5 p-3" style={{ borderWidth: "2px" }}>
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <span
            className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-white"
            style={{ background: tone.fill }}
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.9}>
              <path strokeLinecap="round" strokeLinejoin="round" d={agent.iconPath} />
            </svg>
          </span>
          <div className="flex min-w-0 items-center gap-1">
            <p className="truncate text-[13.5px] font-bold text-[var(--color-text-primary)]">{agent.label}</p>
            <span className="shrink-0 rounded-full px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wide" style={{ background: tone.bg, color: tone.text }}>{isOutput ? "Output" : "Agent"}</span>
          </div>
        </div>
        <span className="relative flex h-2 w-2 shrink-0">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-60" style={{ background: dotColor }} />
          <span className="relative inline-flex h-2 w-2 rounded-full" style={{ background: dotColor }} />
        </span>
      </div>
      <p title={agent.capability} className="line-clamp-2 text-[11.5px] font-medium leading-snug text-[var(--color-text-primary)]">{agent.capability}</p>
      <ul className="mt-auto flex flex-col gap-1 border-t border-[var(--color-border-soft)] pt-1.5">
        {agent.capabilities.slice(0, 2).map((item) => (
          <li key={item} className="flex items-center gap-1.5 text-[11px] font-medium leading-snug text-[var(--color-text-soft)]">
            <svg className="h-3 w-3 shrink-0" fill="none" viewBox="0 0 24 24" stroke={tone.text} strokeWidth={3}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
            </svg>
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}

const FLOW_STAGES: { label: string; sub?: string; iconPath: string }[] = [
  { label: "Live Signals",   iconPath: AGENT_PIPELINE[0].iconPath },
  { label: "5 Specialists",  sub: "parallel", iconPath: "M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" },
  { label: "Menu Strategy",  iconPath: AGENT_PIPELINE[6].iconPath },
  { label: "Critic Review",  iconPath: AGENT_PIPELINE[7].iconPath },
  { label: "Your Plan",      iconPath: FINAL_PLAN_AGENT.iconPath },
];

// Slim stepper -- just pills + connecting chevrons, no shared height/width
// track between them (unlike the earlier flowchart attempt that broke on
// overflow). Purely conveys sequence at a glance; the grid below still
// carries all the actual detail per specialist.
export function PipelineFlowStrip() {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {FLOW_STAGES.map((stage, i) => (
        <div key={stage.label} className="flex items-center gap-1.5">
          <div className="flex items-center gap-1.5 rounded-full border border-[var(--color-border-default)] bg-[var(--color-surface-raised)] py-1 pl-1 pr-3">
            <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full" style={{ background: "var(--color-accent-soft)", color: "var(--color-accent)" }}>
              <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2}>
                <path strokeLinecap="round" strokeLinejoin="round" d={stage.iconPath} />
              </svg>
            </span>
            <span className="text-[11.5px] font-semibold text-[var(--color-text-primary)]">{stage.label}</span>
            {stage.sub && <span className="text-[9.5px] text-[var(--color-text-faint)]">({stage.sub})</span>}
          </div>
          {i < FLOW_STAGES.length - 1 && (
            <svg className="h-3 w-3 shrink-0 text-[var(--color-text-ghost)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          )}
        </div>
      ))}
    </div>
  );
}

// Shared "meet your planning team" visual -- compact variant is the flat
// list PlanShiftModal has always shown (limited modal space); full variant
// is a proper feature grid for the /planning idle state, deliberately NOT
// a pipeline flowchart -- no arrows, no step numbers, no "running in
// parallel" callout. An end user doesn't care about execution topology,
// they care what each specialist actually finds or protects for them.
export default function AgentPipelineGrid({ variant = "compact", columns = 3 }: Props) {
  if (variant === "compact") {
    return (
      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
        {AGENT_PIPELINE.map((agent) => <CompactCard key={agent.label} agent={agent} />)}
      </div>
    );
  }

  return (
    <div className={`grid grid-cols-1 gap-2.5 sm:grid-cols-2 ${columns === 3 ? "xl:grid-cols-3" : ""}`}>
      {AGENT_PIPELINE.map((agent) => <SpecialistCard key={agent.label} agent={agent} />)}
      <SpecialistCard agent={FINAL_PLAN_AGENT} isOutput />
    </div>
  );
}
