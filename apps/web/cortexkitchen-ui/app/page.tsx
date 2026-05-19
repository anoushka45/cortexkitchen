"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import AgentCard from "@/components/dashboard/AgentCard";
import CriticBanner from "@/components/dashboard/CriticBanner";
import DashboardDetailModal from "@/components/dashboard/DashboardDetailModal";
import DashboardSummary from "@/components/dashboard/DashboardSummary";
import DatePicker from "@/components/dashboard/DatePicker";
import ForecastChart from "@/components/dashboard/ForecastChart";
import ManagerActionPanel from "@/components/dashboard/ManagerActionPanel";
import RagContextDrawer from "@/components/dashboard/RagContextDrawer";
import RunHistory from "@/components/dashboard/RunHistory";
import { useFridayRush } from "@/hooks/useFridayRush";
import { PlanningScenarioOption, RunHistoryEntry } from "@/types/planning";

const SCENARIO_OPTIONS: PlanningScenarioOption[] = [
  {
    id: "friday_rush",
    label: "Friday Rush",
    description: "High-demand dinner rush with table-turn pressure and stock protection.",
    default_weekday: 4,
    service_window: "18:00-22:00",
    operational_focus: "Peak dinner demand and rush execution.",
  },
  {
    id: "weekday_lunch",
    label: "Weekday Lunch",
    description: "Lean midday service focused on pacing, efficiency, and cleaner prep burden.",
    default_weekday: 2,
    service_window: "12:00-15:00",
    operational_focus: "Lunch pacing and staffing efficiency.",
  },
  {
    id: "holiday_spike",
    label: "Holiday Spike",
    description: "Demand-surge planning for unusually heavy service conditions.",
    default_weekday: 5,
    service_window: "17:00-22:00",
    operational_focus: "Queue protection, surge readiness, and quality retention.",
  },
  {
    id: "low_stock_weekend",
    label: "Low-Stock Weekend",
    description: "Weekend planning with tighter ingredient constraints and stricter prioritization.",
    default_weekday: 6,
    service_window: "18:00-22:00",
    operational_focus: "Shortage prioritization and menu restraint.",
  },
];

function SectionHeader({
  label,
  description,
  tone = "default",
  isOpen,
  onToggle,
  cards,
}: {
  label: string;
  description: string;
  tone?: "violet" | "cyan" | "rose" | "emerald" | "amber" | "default";
  isOpen?: boolean;
  onToggle?: () => void;
  cards?: string[];
}) {
  const toneClass: Record<
    NonNullable<Parameters<typeof SectionHeader>[0]["tone"]>,
    { bar: string; label: string }
  > = {
    violet: { bar: "bg-violet-400/70", label: "text-violet-200/80" },
    cyan: { bar: "bg-cyan-300/70", label: "text-cyan-200/80" },
    rose: { bar: "bg-rose-400/70", label: "text-rose-200/80" },
    emerald: { bar: "bg-emerald-300/70", label: "text-emerald-200/80" },
    amber: { bar: "bg-amber-300/70", label: "text-amber-200/80" },
    default: { bar: "bg-white/10", label: "text-slate-400" },
  };
  const toneStyle = toneClass[tone] ?? toneClass.default;

  return (
    <div
      className={`px-1 flex items-center gap-3 ${onToggle ? "cursor-pointer select-none group" : ""}`}
      onClick={onToggle}
    >
      <div className={`h-10 w-1 rounded-full flex-shrink-0 ${toneStyle.bar}`} />
      <div className="flex-1 min-w-0">
        <p className={`text-xs font-mono uppercase tracking-[0.18em] ${toneStyle.label}`}>
          {label}
        </p>
        <p className="mt-1 text-sm text-slate-400">{description}</p>
        {!isOpen && cards && cards.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {cards.map((card) => (
              <span
                key={card}
                className="inline-flex items-center rounded-full border border-white/10 bg-white/5 px-2.5 py-0.5 text-[10px] font-mono tracking-wide text-slate-500"
              >
                {card}
              </span>
            ))}
          </div>
        )}
      </div>
      {onToggle !== undefined && (
        <svg
          className={`flex-shrink-0 h-4 w-4 text-slate-500 transition-transform duration-200 group-hover:text-slate-300 ${isOpen ? "rotate-0" : "-rotate-90"}`}
          fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      )}
    </div>
  );
}

function IdleState({
  onRun,
  selectedScenario,
  onScenarioChange,
}: {
  onRun: (date?: string) => void;
  selectedScenario: PlanningScenarioOption["id"];
  onScenarioChange: (scenario: PlanningScenarioOption["id"]) => void;
}) {
  const scenario = SCENARIO_OPTIONS.find((item) => item.id === selectedScenario) ?? SCENARIO_OPTIONS[0];
  return (
    <div className="py-10">
      <div className="stagger-1 relative overflow-hidden rounded-[34px] border border-white/10 bg-[radial-gradient(circle_at_top,rgba(139,92,246,0.10),transparent_52%),radial-gradient(circle_at_bottom_right,rgba(34,211,238,0.08),transparent_55%),rgba(255,255,255,0.03)] px-6 py-10 shadow-[0_28px_110px_rgba(2,8,23,0.45)] md:px-10 md:py-12">
        {/* Subtle grid texture */}
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.14]"
          style={{
            backgroundImage:
              "linear-gradient(rgba(148,163,184,0.35) 1px, transparent 1px), linear-gradient(90deg, rgba(148,163,184,0.35) 1px, transparent 1px)",
            backgroundSize: "46px 46px",
            maskImage: "radial-gradient(circle at 28% 18%, black 0%, transparent 70%)",
            WebkitMaskImage: "radial-gradient(circle at 28% 18%, black 0%, transparent 70%)",
          }}
        />

        <div className="relative grid grid-cols-1 gap-10 xl:grid-cols-12 xl:items-start">
          <div className="xl:col-span-7">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-slate-950/40 px-3 py-1.5">
              <span className="h-2 w-2 rounded-full bg-violet-400" />
              <span className="text-[11px] font-mono uppercase tracking-[0.22em] text-slate-400">
                planning console
              </span>
            </div>

            <h1 className="mt-5 text-3xl font-semibold tracking-tight text-slate-100 md:text-4xl">
              Plan your next service run with <span className="bg-gradient-to-r from-orange-400 via-orange-300 to-gray-100 bg-clip-text text-transparent">
                CortexKitchen
              </span>
            </h1>
            <p className="mt-4 max-w-xl text-base leading-7 text-slate-400">
              Generate a coordinated view across demand, reservations, complaints, menu direction,
              and inventory pressure in a single run, then drill down by agent when needed.
            </p>

            <div className="mt-7">
              <p className="text-[11px] font-mono uppercase tracking-[0.22em] text-slate-500">
                Scenario preset
              </p>
              <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
                {SCENARIO_OPTIONS.map((option) => {
                  const active = option.id === selectedScenario;
                  return (
                    <button
                      key={option.id}
                      type="button"
                      onClick={() => onScenarioChange(option.id)}
                      className={`rounded-2xl border px-4 py-4 text-left transition-all ${
                        active
                          ? "border-violet-400/30 bg-violet-500/10"
                          : "border-white/10 bg-slate-950/30 hover:bg-white/[0.04]"
                      }`}
                    >
                      <p className="text-sm font-semibold text-slate-100">{option.label}</p>
                      <p className="mt-1 text-sm text-slate-400">{option.description}</p>
                      <p className="mt-3 text-[11px] font-mono uppercase tracking-[0.16em] text-slate-500">
                        {option.service_window}
                      </p>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="mt-7 rounded-2xl border border-white/10 bg-white/5 p-4">
              <p className="text-[11px] font-mono uppercase tracking-[0.22em] text-slate-500">
                How it works
              </p>
              <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-3">
                {[
                  ["1. Choose scenario", "Pick the service pattern you want to frame"],
                  ["2. Run agents", "Parallel analysis across operations signals"],
                  ["3. Review plan", "Critic verdict plus per-card details"],
                ].map(([title, desc]) => (
                  <div
                    key={title}
                    className="rounded-2xl border border-white/10 bg-slate-950/30 px-4 py-4"
                  >
                    <p className="text-sm font-semibold text-slate-200">{title}</p>
                    <p className="mt-1 text-sm text-slate-500">{desc}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-8 flex flex-col items-start gap-3">
              <DatePicker onRun={onRun} loading={false} scenario={scenario} />
              <p className="text-xs text-slate-500">
                Tip: leave the date empty to use the default planning date for {scenario.label}.
              </p>
            </div>
          </div>

          <div className="xl:col-span-5">
            <div className="rounded-3xl border border-white/10 bg-[#0b1220]/80 p-5 shadow-[0_28px_90px_rgba(2,8,23,0.35)]">
              <p className="text-[11px] font-mono uppercase tracking-[0.22em] text-slate-500">
                What you get
              </p>
              <p className="mt-2 text-sm text-slate-400">
                A decision-ready bundle, organized into scannable cards with a &quot;view details&quot;
                drilldown.
              </p>

              <div className="mt-5 grid grid-cols-1 gap-3">
                {[
                  [
                    "Demand forecast",
                  "Predicted orders, peak pressure, and confidence band",
                    "border-violet-500/20 bg-violet-500/5",
                  ],
                  [
                    "Reservations",
                  "Occupancy load, waitlist pressure, and busiest-hour risk",
                    "border-cyan-500/20 bg-cyan-500/5",
                  ],
                  [
                    "Complaints",
                    "Recurring issues, action items, and guest-experience watchouts",
                    "border-rose-500/20 bg-rose-500/5",
                  ],
                  [
                    "Menu insights",
                  "What to push/avoid, promos, and operational notes for the selected service frame",
                    "border-amber-500/20 bg-amber-500/5",
                  ],
                  [
                    "Inventory status",
                    "Shortages, overstock flags, restock actions, and risks",
                    "border-emerald-500/20 bg-emerald-500/5",
                  ],
                ].map(([title, desc, style]) => (
                  <div key={title} className={`rounded-2xl border px-4 py-3 ${style}`}>
                    <p className="text-sm font-semibold text-slate-100">{title}</p>
                    <p className="mt-1 text-sm text-slate-300/80">{desc}</p>
                  </div>
                ))}
              </div>

              <div className="mt-5 rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                <p className="text-xs font-mono uppercase tracking-[0.22em] text-slate-500">
                  Output quality
                </p>
                <p className="mt-1 text-sm text-slate-400">
                  Every run includes a critic verdict and score so recommendations are reviewable,
                  not just generated.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function ScenarioSelector({
  selectedScenario,
  onScenarioChange,
}: {
  selectedScenario: PlanningScenarioOption["id"];
  onScenarioChange: (scenario: PlanningScenarioOption["id"]) => void;
}) {
  return (
    <div className="flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-3 py-3">
      <p className="whitespace-nowrap text-[11px] font-mono uppercase tracking-[0.18em] text-slate-500">
        scenario
      </p>
      <div className="relative">
        <select
          value={selectedScenario}
          onChange={(e) => onScenarioChange(e.target.value as PlanningScenarioOption["id"])}
          className="appearance-none cursor-pointer rounded-xl border border-white/10 bg-slate-950/60 px-3 py-1.5 pr-7 text-xs font-mono uppercase tracking-[0.14em] text-slate-200 focus:outline-none focus:ring-1 focus:ring-violet-500/50"
        >
          {SCENARIO_OPTIONS.map((option) => (
            <option key={option.id} value={option.id} className="bg-slate-900 text-slate-200">
              {option.label}
            </option>
          ))}
        </select>
        <svg
          className="pointer-events-none absolute right-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-500"
          fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </div>
    </div>
  );
}


function LoadingState() {
  const agents = [
    { key: "reservation", label: "Reservations", tone: "cyan", desc: "Occupancy load & waitlist pressure" },
    { key: "complaint",   label: "Complaints",   tone: "rose", desc: "Guest issues & experience risk" },
    { key: "menu",        label: "Menu insights", tone: "amber", desc: "Push/avoid signals & promo notes" },
    { key: "inventory",   label: "Inventory",    tone: "emerald", desc: "Shortages, overstock & restock alerts" },
  ] as const;

  const [opsDone,       setOpsDone]       = useState(false);
  const [forecastDone,  setForecastDone]  = useState(false);
  const [doneAgents,    setDoneAgents]    = useState<Set<number>>(new Set());
  const [aggregateDone, setAggregateDone] = useState(false);
  const [criticDone,    setCriticDone]    = useState(false);

  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = [];
    timers.push(setTimeout(() => setOpsDone(true), 500));
    timers.push(
      setTimeout(() => {
        setForecastDone(true);
        agents.forEach((_, i) => {
          const delay = 400 + Math.random() * 1200;
          timers.push(setTimeout(() => setDoneAgents((prev) => new Set([...prev, i])), delay));
        });
        timers.push(setTimeout(() => setAggregateDone(true), 2200));
        timers.push(setTimeout(() => setCriticDone(true), 3000));
      }, 1200)
    );
    return () => timers.forEach(clearTimeout);
  }, []);

  const dotColor: Record<(typeof agents)[number]["tone"], string> = {
    cyan:    "bg-cyan-300",
    rose:    "bg-rose-400",
    amber:   "bg-amber-300",
    emerald: "bg-emerald-300",
  };

  type NodeState = "idle" | "running" | "done";

  function nodeStyle(state: NodeState) {
    return {
      border:
        state === "done"    ? "border-emerald-400/20 bg-emerald-400/[0.04]" :
        state === "running" ? "border-violet-400/25 bg-violet-500/[0.07]"   :
                              "border-white/10 bg-white/[0.03]",
      tag:
        state === "done"    ? "text-emerald-300/70" :
        state === "running" ? "text-violet-300/70"  :
                              "text-slate-500",
    };
  }

  function ProgressBar({ state }: { state: NodeState }) {
    return (
      <div className="h-1 overflow-hidden rounded-full bg-white/5">
        <div className={`h-full transition-all duration-700 ${
          state === "done"    ? "w-full bg-emerald-400/50" :
          state === "running" ? "w-[50%] bar-shimmer"      :
                                "w-0"
        }`} />
      </div>
    );
  }

  function VCard({ state, tag, title, desc }: { state: NodeState; tag: string; title: string; desc: string }) {
    const s = nodeStyle(state);
    return (
      <div className={`rounded-2xl border px-4 py-3 transition-all duration-500 ${s.border}`}>
        <div className={`text-[9px] font-mono uppercase ${s.tag}`}>{tag}</div>
        <div className="mt-1 text-sm font-semibold text-white">{title}</div>
        <div className="mt-0.5 text-[10px] leading-snug text-slate-500">{desc}</div>
        <div className="mt-2"><ProgressBar state={state} /></div>
      </div>
    );
  }

  function HCard({ state, tag, title, desc, width = "w-[152px]" }: { state: NodeState; tag: string; title: string; desc: string; width?: string }) {
    const s = nodeStyle(state);
    return (
      <div className={`flex h-[116px] flex-shrink-0 flex-col justify-between rounded-2xl border p-4 transition-all duration-500 ${width} ${s.border}`}>
        <div className={`text-[9px] font-mono uppercase ${s.tag}`}>{tag}</div>
        <div>
          <div className="text-sm font-semibold text-white">{title}</div>
          <div className="mt-1 text-[10px] leading-snug text-slate-500">{desc}</div>
        </div>
        <ProgressBar state={state} />
      </div>
    );
  }

  function HArrow({ active }: { active: boolean }) {
    return <div className={`mx-3 h-px w-10 flex-shrink-0 transition-colors duration-700 ${active ? "bg-slate-500" : "bg-slate-700/70"}`} />;
  }

  function VConnector({ active }: { active: boolean }) {
    return (
      <div className="flex justify-center py-1">
        <div className={`h-5 w-px transition-colors duration-500 ${active ? "bg-slate-500" : "bg-slate-700/40"}`} />
      </div>
    );
  }

  const opsState:      NodeState = opsDone       ? "done" : "running";
  const forecastState: NodeState = forecastDone  ? "done" : opsDone ? "running" : "idle";
  const aggState:      NodeState = aggregateDone ? "done" : doneAgents.size === agents.length ? "running" : "idle";
  const criticState:   NodeState = criticDone    ? "done" : aggregateDone ? "running" : "idle";

  return (
    <div className="py-10">
      <div className="relative w-full overflow-hidden rounded-[28px] border border-white/10 bg-[#050816] px-6 py-10 shadow-[0_35px_120px_rgba(0,0,0,0.55)] xl:px-10 xl:py-12">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(139,92,246,0.12),transparent_45%)]" />

        {/* Header */}
        <div className="relative z-10 flex flex-col items-center text-center">
          <div className="inline-flex items-center gap-3 rounded-full border border-white/10 bg-white/[0.03] px-4 py-2">
            <span className="relative flex h-2.5 w-2.5">
              <span className="absolute inset-0 rounded-full bg-violet-400 animate-ping opacity-60" />
              <span className="relative rounded-full bg-violet-400" />
            </span>
            <span className="text-[11px] font-mono uppercase tracking-[0.24em] text-slate-400">orchestration live</span>
          </div>
          <h2 className="mt-4 text-xl font-semibold text-white">Multi-agent execution pipeline</h2>
          <p className="mt-2 max-w-xl text-sm text-slate-400">
            Ops manager sequences the run — forecast gates first, then agents analyze in parallel before synthesis and critique.
          </p>
        </div>

        {/* ── VERTICAL (below xl) ── */}
        <div className="relative z-10 mt-10 xl:hidden">
          <VCard state={opsState}      tag="orchestrator" title="Ops Manager"     desc="Routes and sequences agents" />
          <VConnector active={opsDone} />
          <VCard state={forecastState} tag="prerequisite" title="Demand Forecast" desc="Gates all downstream agents" />
          <VConnector active={forecastDone} />

          <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-3">
            <p className="mb-2 text-[9px] font-mono uppercase tracking-[0.18em] text-slate-600">parallel agents</p>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {agents.map((agent, i) => {
                const isDone = doneAgents.has(i);
                const state: NodeState = isDone ? "done" : forecastDone ? "running" : "idle";
                const s = nodeStyle(state);
                return (
                  <div key={agent.key} className={`rounded-xl border px-3 py-2.5 transition-all duration-500 ${s.border}`}>
                    <div className="flex items-center gap-2">
                      <span className={`h-1.5 w-1.5 flex-shrink-0 rounded-full ${dotColor[agent.tone]} ${isDone ? "" : forecastDone ? "animate-pulse" : "opacity-30"}`} />
                      <span className={`text-[9px] font-mono uppercase ${s.tag}`}>
                        {isDone ? "done" : forecastDone ? "running" : "waiting"}
                      </span>
                    </div>
                    <div className="mt-1 text-sm font-semibold text-white">{agent.label}</div>
                    <div className="mt-0.5 text-[10px] text-slate-500">{agent.desc}</div>
                    <div className="mt-2"><ProgressBar state={state} /></div>
                  </div>
                );
              })}
            </div>
          </div>

          <VConnector active={doneAgents.size === agents.length} />
          <VCard state={aggState}    tag="synthesis"  title="Aggregator" desc="Merges all agent outputs" />
          <VConnector active={aggregateDone} />
          <VCard state={criticState} tag="validation" title="Critic"     desc="Scores and verifies plan" />
        </div>

        {/* ── HORIZONTAL (xl+) ── */}
        <div className="relative z-10 mt-14 hidden xl:block">
          <div className="flex items-center justify-center">
            <div className="flex flex-shrink-0 items-center">
              <HCard state={opsState}      tag="orchestrator" title="Ops Manager"     desc="Routes and sequences agents" />
              <HArrow active={opsDone} />
            </div>
            <div className="flex flex-shrink-0 items-center">
              <HCard state={forecastState} tag="prerequisite" title="Demand Forecast" desc="Gates all downstream agents" width="w-[175px]" />
              <HArrow active={forecastDone} />
            </div>
            <div className="flex flex-shrink-0 items-center">
              <div className="grid grid-cols-2 gap-3">
                {agents.map((agent, i) => {
                  const isDone = doneAgents.has(i);
                  const state: NodeState = isDone ? "done" : forecastDone ? "running" : "idle";
                  const s = nodeStyle(state);
                  return (
                    <div key={agent.key} className={`flex h-[116px] w-[155px] flex-col justify-between rounded-2xl border p-4 transition-all duration-500 ${s.border}`}>
                      <div className="flex items-center gap-2">
                        <span className={`h-2 w-2 flex-shrink-0 rounded-full ${dotColor[agent.tone]} ${isDone ? "" : forecastDone ? "animate-pulse" : "opacity-30"}`} />
                        <span className={`text-[9px] font-mono uppercase ${s.tag}`}>
                          {isDone ? "done" : forecastDone ? "running" : "waiting"}
                        </span>
                      </div>
                      <div>
                        <div className="text-sm font-semibold text-white">{agent.label}</div>
                        <div className="mt-1 text-[10px] leading-snug text-slate-500">{agent.desc}</div>
                      </div>
                      <ProgressBar state={state} />
                    </div>
                  );
                })}
              </div>
              <HArrow active={doneAgents.size === agents.length} />
            </div>
            <div className="flex flex-shrink-0 items-center gap-3">
              <HCard state={aggState}    tag="synthesis"  title="Aggregator" desc="Merges all agent outputs"  width="w-[145px]" />
              <HArrow active={aggregateDone} />
              <HCard state={criticState} tag="validation" title="Critic"     desc="Scores and verifies plan"  width="w-[135px]" />
            </div>
          </div>
        </div>
      </div>

      <style>{`
        .bar-shimmer {
          background: linear-gradient(90deg, rgba(139,92,246,0.1), rgba(139,92,246,0.9), rgba(139,92,246,0.1));
          background-size: 200% 100%;
          animation: shimmer 1.2s linear infinite;
        }
        @keyframes shimmer {
          0%   { background-position: 0% 50%; }
          100% { background-position: 100% 50%; }
        }
      `}</style>
    </div>
  );
}

export default function DashboardPage() {
  const { data, status, error, history, trigger, reset, loadFromHistory } = useFridayRush();
  const [activeHistoryId, setActiveHistoryId] = useState<string | number | undefined>();
  const [showHistoryDrawer, setShowHistoryDrawer] = useState(false);
  const [showManagerBrief, setShowManagerBrief] = useState(false);
  const [selectedScenario, setSelectedScenario] = useState<PlanningScenarioOption["id"]>("friday_rush");
  const [servicePlanningOpen, setServicePlanningOpen] = useState(true);
  const [operationalRiskOpen, setOperationalRiskOpen] = useState(false);
  const [menuDirectionOpen, setMenuDirectionOpen] = useState(false);

  const handleHistorySelect = async (entry: RunHistoryEntry) => {
    setActiveHistoryId(entry.id);
    await loadFromHistory(entry);
    setShowHistoryDrawer(false);
  };

  const handleRun = (date?: string) => {
    setActiveHistoryId(undefined);
    trigger(date, selectedScenario);
  };

  return (
    <div className="min-h-screen bg-[#09111f] text-slate-100">
      <header
        className="sticky top-0 z-10 border-b backdrop-blur-md shadow-[0_14px_55px_rgba(2,8,23,0.45)]"
        style={{
          background:
            "linear-gradient(180deg, rgba(9,17,31,0.92), rgba(9,17,31,0.84))",
          borderColor: "rgba(139,92,246,0.25)",
        }}
      >
        <div className="mx-auto flex max-w-[1520px] items-center justify-between gap-4 px-6 py-4 xl:px-14">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-white/10 bg-slate-950/30 overflow-hidden">
              <Image
                src="/ck-logo.png"
                alt="CortexKitchen"
                width={48}
                height={48}
                className="h-12 w-12 object-contain"
                priority
              />
            </div>
            <div>
              <h1 className="text-base font-semibold tracking-tight text-slate-100 md:text-lg">
                CortexKitchen
              </h1>
              <p className="text-[11px] font-mono uppercase tracking-[0.22em] text-slate-500">
                ops intelligence
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <ScenarioSelector
              selectedScenario={selectedScenario}
              onScenarioChange={setSelectedScenario}
            />

            <nav className="flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-3 py-3">
              <Link
                href="/"
                className="rounded-xl bg-violet-500/15 px-3 py-2 text-xs font-mono uppercase tracking-[0.14em] text-violet-200"
              >
                dashboard
              </Link>
              <Link
                href="/runs"
                className="rounded-xl border border-white/10 bg-slate-950/40 px-3 py-2 text-xs font-mono uppercase tracking-[0.14em] text-slate-300 transition-all hover:bg-slate-900 hover:text-white"
              >
                runs
              </Link>
              <Link
                href="/data-health"
                className="rounded-xl border border-white/10 bg-slate-950/40 px-3 py-2 text-xs font-mono uppercase tracking-[0.14em] text-slate-300 transition-all hover:bg-slate-900 hover:text-white"
              >
                data
              </Link>
            </nav>

            <div className="flex gap-2 rounded-2xl border border-white/10 bg-white/5 px-3 py-3">
              {history.length > 0 && (
                <button
                  onClick={() => setShowHistoryDrawer(true)}
                  className="rounded-xl border border-white/10 bg-slate-950/60 px-3 py-2 text-xs font-mono text-slate-300 transition-all hover:bg-slate-900 hover:text-white hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.99]"
                >
                  history ({history.length})
                </button>
              )}
              {data && status === "success" && (
                <button
                  onClick={reset}
                  className="rounded-xl border border-white/10 bg-transparent px-3 py-2 text-xs font-mono text-slate-400 transition-all hover:bg-white/5 hover:text-slate-200 hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.99]"
                >
                  reset view
                </button>
              )}
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-[1520px] px-6 py-8 xl:px-14">
        <div className="space-y-6">
          {status !== "idle" && (
            <DatePicker
              onRun={handleRun}
              loading={status === "loading"}
              scenario={SCENARIO_OPTIONS.find((item) => item.id === selectedScenario)}
            />
          )}

          {status === "idle" && (
            <IdleState
              onRun={handleRun}
              selectedScenario={selectedScenario}
              onScenarioChange={setSelectedScenario}
            />
          )}

          {status === "loading" && <LoadingState />}

          {status === "error" && error && (
            <div
              className="rounded-3xl border border-rose-500/20 px-6 py-5"
              style={{ background: "rgba(244,63,94,0.06)" }}
            >
              <p className="text-sm font-semibold text-rose-400">Pipeline error</p>
              <p className="mt-1 text-xs font-mono text-rose-300/80">{error}</p>
              <button
                onClick={() => trigger()}
                className="mt-4 text-xs font-mono text-rose-300 underline underline-offset-4"
              >
                retry
              </button>
            </div>
          )}

          {status === "success" && data && (
            <>
              <CriticBanner
                critic={data.critic}
                generatedAt={data.generated_at}
                targetDate={data.target_date}
                actions={
                  <button
                    onClick={() => setShowManagerBrief(true)}
                    className="rounded-xl border border-cyan-400/20 bg-cyan-500/10 px-4 py-2 text-xs font-mono uppercase tracking-[0.16em] text-cyan-200 transition-all hover:bg-cyan-500/15 hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.99]"
                  >
                    open manager brief
                  </button>
                }
              />

              <DashboardSummary data={data} />

              <div className="space-y-3">
                <SectionHeader
                  label="Service Planning"
                  description="Demand pacing and reservation pressure for the current run."
                  tone="violet"
                  isOpen={servicePlanningOpen}
                  onToggle={() => setServicePlanningOpen((v) => !v)}
                  cards={["Demand Forecast", "Reservation Pressure"]}
                />
                {servicePlanningOpen && (
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
                      />
                    </div>
                  </div>
                )}
              </div>

              <div className="space-y-3">
                <SectionHeader
                  label="Operational Risk"
                  description="Customer sentiment and stock pressure shaping service execution."
                  tone="rose"
                  isOpen={operationalRiskOpen}
                  onToggle={() => setOperationalRiskOpen((v) => !v)}
                  cards={["Complaint Intelligence", "Inventory Status"]}
                />
                {operationalRiskOpen && (
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
                      />
                    </div>
                  </div>
                )}
              </div>

              <div className="space-y-3">
                <SectionHeader
                  label="Menu Direction"
                  description="Commercial and operational guidance synthesized for this planning window."
                  tone="amber"
                  isOpen={menuDirectionOpen}
                  onToggle={() => setMenuDirectionOpen((v) => !v)}
                  cards={["Menu Intelligence"]}
                />
                {menuDirectionOpen && (
                  <AgentCard
                    agentKey="menu"
                    data={data.recommendations.menu as Record<string, unknown> | null}
                    index={3}
                  />
                )}
              </div>

              <RagContextDrawer ragContext={data.rag_context} />

              <p className="pb-2 text-center text-xs font-mono text-slate-600">
                scenario: {data.scenario} | status:{" "}
                <span className="text-violet-400">{data.status}</span>
              </p>

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
            </>
          )}
        </div>
      </main>

      {showHistoryDrawer && (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/45"
            onClick={() => setShowHistoryDrawer(false)}
          />
          <div
            className="fixed left-0 top-0 z-50 h-screen w-72 overflow-y-auto border-r p-6"
            style={{
              background: "#0d1320",
              borderColor: "rgba(148,163,184,0.12)",
              animation: "slideIn 0.25s ease-out",
            }}
          >
            <div className="mb-6 flex items-center justify-between">
              <h2 className="text-sm font-mono uppercase tracking-[0.18em] text-slate-400">
                Run History
              </h2>
              <button
                onClick={() => setShowHistoryDrawer(false)}
                className="text-sm text-slate-500 transition-colors hover:text-slate-300"
              >
                close
              </button>
            </div>
            <RunHistory
              history={history}
              activeId={activeHistoryId}
              onSelect={handleHistorySelect}
            />
          </div>

          <style>{`
            @keyframes slideIn {
              from { transform: translateX(-100%); }
              to { transform: translateX(0); }
            }
          `}</style>
        </>
      )}
    </div>
  );
}
