"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import AgentCard from "@/components/dashboard/AgentCard";
import CriticBanner from "@/components/dashboard/CriticBanner";
import DashboardDetailModal from "@/components/dashboard/DashboardDetailModal";
import DashboardSummary from "@/components/dashboard/DashboardSummary";
import DatePicker from "@/components/dashboard/DatePicker";
import ForecastChart from "@/components/dashboard/ForecastChart";
import ManagerActionPanel from "@/components/dashboard/ManagerActionPanel";
import RagContextDrawer from "@/components/dashboard/RagContextDrawer";
import RunHistory from "@/components/dashboard/RunHistory";
import { useAuth } from "@/context/AuthContext";
import { DashStatus, useDashboardCtx } from "@/context/DashboardContext";
import { useFridayRush } from "@/hooks/useFridayRush";
import { listRestaurantProfiles, RestaurantProfile } from "@/lib/api";
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

const LOADING_AGENTS = [
  { key: "reservation", label: "Reservations", tone: "cyan", desc: "Occupancy load & waitlist pressure" },
  { key: "complaint", label: "Complaints", tone: "rose", desc: "Guest issues & experience risk" },
  { key: "menu", label: "Menu insights", tone: "amber", desc: "Push/avoid signals & promo notes" },
  { key: "inventory", label: "Inventory", tone: "emerald", desc: "Shortages, overstock & restock alerts" },
] as const;

type NodeState = "idle" | "running" | "done";

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
  tone?: "ember" | "cyan" | "rose" | "emerald" | "amber" | "default";
  isOpen?: boolean;
  onToggle?: () => void;
  cards?: string[];
}) {
  const toneClass: Record<
    NonNullable<Parameters<typeof SectionHeader>[0]["tone"]>,
    { bar: string; label: string }
  > = {
    ember: { bar: "bg-ember-400/70", label: "text-ember-300/80" },
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

const AGENT_PIPELINE = [
  {
    label: "Demand Forecast",
    capability: "Prophet time-series -- predicts covers, order volume, and peak-hour pressure",
    iconPath: "M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z",
    border: "border-ember-500/20", bg: "bg-ember-500/[0.06]", dot: "bg-ember-400", icon: "text-ember-400",
  },
  {
    label: "Reservation Pressure",
    capability: "Live bookings -> occupancy %, waitlist risk, busiest-hour signal",
    iconPath: "M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z",
    border: "border-cyan-500/20", bg: "bg-cyan-500/[0.06]", dot: "bg-cyan-400", icon: "text-cyan-400",
  },
  {
    label: "Complaint Intelligence",
    capability: "RAG over historical feedback -- recurring issues, action items, experience risk",
    iconPath: "M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z",
    border: "border-rose-500/20", bg: "bg-rose-500/[0.06]", dot: "bg-rose-400", icon: "text-rose-400",
  },
  {
    label: "Menu Intelligence",
    capability: "Cross-signals from demand, inventory, and complaints -- what to push, avoid, promote",
    iconPath: "M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4",
    border: "border-amber-500/20", bg: "bg-amber-500/[0.06]", dot: "bg-amber-400", icon: "text-amber-400",
  },
  {
    label: "Inventory Status",
    capability: "Shortage and overstock detection with spoilage-aware restock prioritisation",
    iconPath: "M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4",
    border: "border-emerald-500/20", bg: "bg-emerald-500/[0.06]", dot: "bg-emerald-400", icon: "text-emerald-400",
  },
] as const;

function IdleState({
  onRun,
  selectedScenario,
  onScenarioChange,
  historyCount,
  onShowHistory,
}: {
  onRun: (date?: string) => void;
  selectedScenario: PlanningScenarioOption["id"];
  onScenarioChange: (scenario: PlanningScenarioOption["id"]) => void;
  historyCount: number;
  onShowHistory: () => void;
}) {
  const scenario = SCENARIO_OPTIONS.find((item) => item.id === selectedScenario) ?? SCENARIO_OPTIONS[0];

  const [profiles,          setProfiles]          = useState<RestaurantProfile[]>([]);
  const [selectedProfileId, setSelectedProfileId] = useState<number | null>(null);

  useEffect(() => {
    listRestaurantProfiles()
      .then((list) => {
        setProfiles(list);
        if (list.length > 0) setSelectedProfileId(list[0].id);
      })
      .catch(() => { /* profiles are optional context — don't block the form */ });
  }, []);

  const activeProfile = profiles.find((p) => p.id === selectedProfileId) ?? profiles[0] ?? null;

  return (
    <div className="py-6">
      <div className="relative overflow-hidden rounded-[34px] border border-white/10 bg-[radial-gradient(ellipse_at_top_left,rgba(230,137,42,0.12),transparent_55%),rgba(255,255,255,0.015)] px-6 py-10 shadow-[0_32px_120px_rgba(2,8,23,0.5)] md:px-10 md:py-12">

        {/* Subtle grid */}
        <div className="pointer-events-none absolute inset-0 opacity-[0.08]" style={{
          backgroundImage: "linear-gradient(rgba(148,163,184,0.4) 1px,transparent 1px),linear-gradient(90deg,rgba(148,163,184,0.4) 1px,transparent 1px)",
          backgroundSize: "44px 44px",
          maskImage: "radial-gradient(ellipse at 20% 20%,black 0%,transparent 65%)",
          WebkitMaskImage: "radial-gradient(ellipse at 20% 20%,black 0%,transparent 65%)",
        }} />

        <div className="relative grid grid-cols-1 gap-10 xl:grid-cols-2 xl:items-start">

          {/* ── Left: action column ── */}
          <div className="space-y-7">

            {/* Badge + headline */}
            <div className="stagger-1">
              <div className="inline-flex items-center gap-2 rounded-full border border-ember-500/20 bg-ember-500/8 px-3 py-1.5">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inset-0 animate-ping rounded-full bg-ember-400 opacity-50" />
                  <span className="relative rounded-full bg-ember-400" />
                </span>
                <span className="text-[10px] font-mono uppercase tracking-[0.24em] text-ember-300">
                  planning console
                </span>
              </div>

              <h1 className="mt-5 text-4xl font-bold tracking-tight text-white md:text-5xl">
                Multi-agent intelligence.<br />
                <span className="bg-gradient-to-r from-ember-400 via-ember-300 to-slate-300 bg-clip-text text-transparent">
                  One coordinated plan.
                </span>
              </h1>
              <p className="mt-4 max-w-lg text-[15px] leading-7 text-slate-400">
                5 parallel agents analyse demand, reservations, complaints, menu direction, and inventory -- then a critic verifies the plan before you see it.
              </p>
            </div>

            {/* Restaurant profile selector */}
            {profiles.length > 0 && (
              <div className="stagger-2">
                <p className="text-[10px] font-mono uppercase tracking-[0.22em] text-slate-600 mb-2">Restaurant profile</p>
                {profiles.length === 1 ? (
                  <div className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.025] px-3 py-2">
                    <span className="h-1.5 w-1.5 rounded-full bg-ember-400 shrink-0" />
                    <span className="text-sm text-white">{activeProfile?.name}</span>
                    {activeProfile && (
                      <span className="ml-auto font-mono text-[10px] text-slate-500">
                        {activeProfile.capacity} covers · {activeProfile.peak_hours}
                      </span>
                    )}
                  </div>
                ) : (
                  <select
                    value={selectedProfileId ?? ""}
                    onChange={(e) => setSelectedProfileId(Number(e.target.value))}
                    className="w-full rounded-lg border border-white/10 bg-slate-950/60 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-ember-500/50 focus:border-ember-500/60"
                  >
                    {profiles.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} — {p.capacity} covers · {p.peak_hours}
                      </option>
                    ))}
                  </select>
                )}
              </div>
            )}

            {/* Scenario selection */}
            <div className="stagger-2 space-y-2.5">
              <p className="text-[10px] font-mono uppercase tracking-[0.22em] text-slate-600">Choose a scenario</p>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {SCENARIO_OPTIONS.map((option) => {
                  const active = option.id === selectedScenario;
                  return (
                    <button
                      key={option.id}
                      type="button"
                      onClick={() => onScenarioChange(option.id)}
                      className={`rounded-xl border px-4 py-3 text-left transition-all ${
                        active
                          ? "border-ember-400/40 bg-ember-500/10 shadow-[0_0_0_1px_rgba(230,137,42,0.15)]"
                          : "border-white/10 bg-slate-950/30 hover:border-white/20 hover:bg-white/[0.04]"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <p className={`text-sm font-semibold ${active ? "text-ember-100" : "text-slate-200"}`}>
                          {option.label}
                        </p>
                        <span className="shrink-0 font-mono text-[10px] text-slate-600">{option.service_window}</span>
                      </div>
                      <p className={`mt-1 text-xs leading-relaxed ${active ? "text-slate-300" : "text-slate-500"}`}>
                        {option.description}
                      </p>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* CTA */}
            <div className="stagger-3">
              <DatePicker onRun={onRun} loading={false} scenario={scenario} />
            </div>

            {/* Footer row: step chips + history */}
            <div className="stagger-4 flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                {(["Choose scenario", "Run 5 agents", "Review critic-scored plan"] as const).map((label, i) => (
                  <div key={label} className="flex items-center gap-1.5 text-xs text-slate-600">
                    <span className="flex h-4 w-4 items-center justify-center rounded-full border border-white/8 bg-white/[0.03] font-mono text-[10px] text-slate-600">{i + 1}</span>
                    {label}
                  </div>
                ))}
              </div>
              {historyCount > 0 && (
                <button
                  onClick={onShowHistory}
                  className="flex items-center gap-1.5 text-xs text-slate-500 transition-colors hover:text-slate-300"
                >
                  <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  {historyCount} previous run{historyCount !== 1 ? "s" : ""}
                </button>
              )}
            </div>
          </div>

          {/* ── Right: agent pipeline showcase ── */}
          <div className="stagger-2">
            <div className="rounded-3xl border border-white/10 bg-[#0d1320]/95 p-6 shadow-[0_24px_80px_rgba(2,8,23,0.4)]">

              <div className="flex items-start justify-between gap-4 mb-5">
                <div>
                  <p className="text-[10px] font-mono uppercase tracking-[0.22em] text-slate-600">Agent pipeline</p>
                  <p className="mt-1 text-base font-semibold text-white">9-node orchestration</p>
                  <p className="mt-0.5 text-xs text-slate-500">Parallel execution  -  aggregation  -  critic verification</p>
                </div>
                <div className="shrink-0 rounded-xl border border-ember-500/20 bg-ember-500/10 px-2.5 py-1">
                  <p className="font-mono text-xs font-bold text-ember-300">LangGraph</p>
                </div>
              </div>

              <div className="space-y-2">
                {AGENT_PIPELINE.map((agent) => (
                  <div key={agent.label} className={`flex items-start gap-3 rounded-xl border px-4 py-3 ${agent.border} ${agent.bg}`}>
                    <span className={`mt-0.5 shrink-0 ${agent.icon}`}>
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.7}>
                        <path strokeLinecap="round" strokeLinejoin="round" d={agent.iconPath} />
                      </svg>
                    </span>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-slate-100">{agent.label}</p>
                      <p className="mt-0.5 text-xs leading-relaxed text-slate-400">{agent.capability}</p>
                    </div>
                  </div>
                ))}
              </div>

              {/* Critic callout */}
              <div className="mt-4 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3">
                <div className="flex items-center gap-2 mb-2">
                  <svg className="h-3.5 w-3.5 text-emerald-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <p className="text-xs font-semibold text-slate-300">Critic-verified output</p>
                </div>
                <p className="text-xs text-slate-500 leading-relaxed">
                  Every plan is scored across <span className="text-slate-400">safety, feasibility, evidence, actionability, and clarity</span> before reaching you.
                </p>
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}

function LoadingState() {
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
        LOADING_AGENTS.forEach((_, i) => {
          const delay = 400 + Math.random() * 1200;
          timers.push(setTimeout(() => setDoneAgents((prev) => new Set([...prev, i])), delay));
        });
        timers.push(setTimeout(() => setAggregateDone(true), 2200));
        timers.push(setTimeout(() => setCriticDone(true), 3000));
      }, 1200)
    );
    return () => timers.forEach(clearTimeout);
  }, []);

  const allAgentsDone = doneAgents.size === LOADING_AGENTS.length;
  const aggState: NodeState = aggregateDone ? "done" : allAgentsDone ? "running" : "idle";

  // Pipeline nodes — each has a state, a "running" hint, and a "done" result
  const pipelineNodes = [
    {
      key: "forecast",
      label: "Demand Forecast",
      dot: "bg-ember-400",   valueColor: "text-ember-300",
      state: (forecastDone ? "done" : opsDone ? "running" : "idle") as NodeState,
      runningText: "Running time-series forecast…",
      doneText:    "99 predicted orders · peak 19:00",
    },
    {
      key: "reservation",
      label: "Reservation Pressure",
      dot: "bg-cyan-400",    valueColor: "text-cyan-300",
      state: (doneAgents.has(0) ? "done" : forecastDone ? "running" : "idle") as NodeState,
      runningText: "Checking bookings & occupancy…",
      doneText:    "87% occupancy · 3 on waitlist",
    },
    {
      key: "complaint",
      label: "Complaint Intelligence",
      dot: "bg-rose-400",    valueColor: "text-rose-300",
      state: (doneAgents.has(1) ? "done" : forecastDone ? "running" : "idle") as NodeState,
      runningText: "Retrieving from complaint history…",
      doneText:    "3 issues retrieved · sentiment 0.78",
    },
    {
      key: "menu",
      label: "Menu Intelligence",
      dot: "bg-amber-400",   valueColor: "text-amber-300",
      state: (doneAgents.has(2) ? "done" : forecastDone ? "running" : "idle") as NodeState,
      runningText: "Cross-referencing demand & stock…",
      doneText:    "2 items flagged · push margherita",
    },
    {
      key: "inventory",
      label: "Inventory Status",
      dot: "bg-emerald-400", valueColor: "text-emerald-300",
      state: (doneAgents.has(3) ? "done" : forecastDone ? "running" : "idle") as NodeState,
      runningText: "Scoring 24 SKUs against demand…",
      doneText:    "6 critical shortages · restock HIGH",
    },
    {
      key: "aggregator",
      label: "Aggregator",
      dot: "bg-violet-400",  valueColor: "text-violet-300",
      state: aggState,
      runningText: "Synthesising 5 agent outputs…",
      doneText:    "Plan synthesised",
    },
    {
      key: "critic",
      label: "Critic",
      dot: "bg-emerald-300", valueColor: "text-emerald-200",
      state: (criticDone ? "done" : aggregateDone ? "running" : "idle") as NodeState,
      runningText: "Scoring across 5 dimensions…",
      doneText:    "Plan approved · score 0.91",
    },
  ];

  // 3-phase strip — user-facing language
  const phases = [
    { label: "Setting up",    done: opsDone,       active: !opsDone },
    { label: "Reading data",  done: allAgentsDone, active: opsDone && !allAgentsDone },
    { label: "Writing brief", done: criticDone,    active: allAgentsDone && !criticDone },
  ];

  const currentAction = criticDone
    ? "Critic has reviewed the plan"
    : aggregateDone
    ? "Critic is scoring the plan…"
    : allAgentsDone
    ? "Aggregating all results…"
    : forecastDone
    ? `${LOADING_AGENTS.length - doneAgents.size} agent${LOADING_AGENTS.length - doneAgents.size !== 1 ? "s" : ""} still running…`
    : opsDone
    ? "Running demand forecast…"
    : "Sequencing the pipeline…";

  return (
    <div className="py-12">
      <div className="mx-auto max-w-[620px]">

        {/* Header */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center gap-2 rounded-full border border-ember-500/20 bg-ember-500/[0.08] px-3 py-1.5 mb-5">
            <span className="relative flex h-2 w-2">
              {!criticDone && <span className="absolute inset-0 animate-ping rounded-full bg-ember-400 opacity-50" />}
              <span className={`relative rounded-full ${criticDone ? "bg-emerald-400" : "bg-ember-400"}`} />
            </span>
            <span className="font-mono text-[10px] uppercase tracking-[0.24em] text-ember-300">
              {criticDone ? "Complete" : "Pipeline live"}
            </span>
          </div>
          <h1 className="text-[36px] font-semibold tracking-[-0.015em] text-white leading-[1.05]">
            {criticDone ? "Your brief is ready." : "Preparing your brief…"}
          </h1>
          <p className="mt-3 text-[14px] leading-[1.7] text-white/50 max-w-sm mx-auto">
            Five specialist agents read your kitchen data in parallel. A critic verifies the plan before you see it.
          </p>
        </div>

        {/* 3-phase strip */}
        <div className="flex items-center justify-center mb-10">
          {phases.map((phase, i) => (
            <div key={phase.label} className="flex items-center">
              <div className="flex items-center gap-2">
                <div className={`h-2 w-2 rounded-full transition-colors duration-500 ${
                  phase.done   ? "bg-emerald-400"
                  : phase.active ? "bg-ember-400 animate-pulse"
                  :                "bg-white/15"
                }`} />
                <span className={`font-mono text-[10px] uppercase tracking-[0.18em] transition-colors duration-500 ${
                  phase.done   ? "text-emerald-300/80"
                  : phase.active ? "text-ember-300/80"
                  :                "text-white/25"
                }`}>
                  {phase.label}
                </span>
              </div>
              {i < phases.length - 1 && (
                <div className={`mx-5 h-px w-10 transition-colors duration-500 ${phases[i].done ? "bg-emerald-400/40" : "bg-white/10"}`} />
              )}
            </div>
          ))}
        </div>

        {/* Agent status list */}
        <div className="rounded-2xl bg-ink-900 ring-1 ring-white/[0.07] overflow-hidden">
          <div className="px-5 pt-4 pb-3 border-b border-white/[0.06]">
            <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-white/35">What&apos;s happening</p>
          </div>
          <div className="divide-y divide-white/[0.05]">
            {pipelineNodes.map((node) => {
              const isDone    = node.state === "done";
              const isRunning = node.state === "running";
              return (
                <div
                  key={node.key}
                  className={`flex items-center gap-4 px-5 py-3 transition-colors duration-300 ${isRunning ? "bg-white/[0.025]" : ""}`}
                >
                  {/* Status indicator */}
                  <div className="w-4 shrink-0 flex justify-center">
                    {isDone ? (
                      <svg className="h-3.5 w-3.5 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    ) : isRunning ? (
                      <span className={`h-2 w-2 rounded-full animate-pulse ${node.dot}`} />
                    ) : (
                      <span className="h-2 w-2 rounded-full bg-white/12" />
                    )}
                  </div>

                  {/* Agent name */}
                  <span className={`text-[13px] font-medium flex-1 min-w-0 transition-colors duration-300 ${
                    isDone ? "text-white" : isRunning ? "text-white/75" : "text-white/25"
                  }`}>
                    {node.label}
                  </span>

                  {/* Status / result */}
                  <span className={`text-[11px] font-mono text-right shrink-0 transition-colors duration-300 ${
                    isDone    ? node.valueColor
                    : isRunning ? "text-white/40"
                    :             "text-white/18"
                  }`}>
                    {isDone ? node.doneText : isRunning ? node.runningText : "waiting"}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Footer */}
        <div className="mt-5 text-center">
          {criticDone ? (
            <div className="rounded-xl bg-emerald-500/[0.06] ring-1 ring-emerald-400/25 px-5 py-4">
              <p className="text-sm font-semibold text-emerald-300">Plan approved — loading your dashboard</p>
            </div>
          ) : (
            <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-white/30">{currentAction}</p>
          )}
        </div>

      </div>
    </div>
  );
}

export default function DashboardPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const dashCtx = useDashboardCtx();

  const { data, status, error, history, trigger, reset, loadFromHistory } = useFridayRush();
  const [activeHistoryId, setActiveHistoryId] = useState<string | number | undefined>();
  const [showHistoryDrawer, setShowHistoryDrawer] = useState(false);
  const [showManagerBrief, setShowManagerBrief] = useState(false);
  const [servicePlanningOpen, setServicePlanningOpen] = useState(true);
  const [operationalRiskOpen, setOperationalRiskOpen] = useState(true);
  const [menuDirectionOpen, setMenuDirectionOpen] = useState(true);

  // Auth guard
  useEffect(() => {
    if (!authLoading && !user) router.push("/login");
  }, [user, authLoading, router]);

  // Sync run status and reset fn to NavBar context
  useEffect(() => {
    dashCtx?.setDashStatus(status as DashStatus);
  }, [status, dashCtx]);

  useEffect(() => {
    dashCtx?.registerReset(reset);
  }, [reset, dashCtx]);

  useEffect(() => {
    dashCtx?.registerOpenHistory(() => setShowHistoryDrawer(true));
  }, [dashCtx]);

  const selectedScenario    = (dashCtx?.selectedScenario ?? "friday_rush") as PlanningScenarioOption["id"];
  const setSelectedScenario = (s: PlanningScenarioOption["id"]) => dashCtx?.setSelectedScenario(s as typeof dashCtx.selectedScenario);

  const handleHistorySelect = async (entry: RunHistoryEntry) => {
    setActiveHistoryId(entry.id);
    await loadFromHistory(entry);
    setShowHistoryDrawer(false);
  };

  const handleRun = (date?: string) => {
    setActiveHistoryId(undefined);
    trigger(date, selectedScenario);
  };

  if (authLoading || !user) return null;

  return (
    <div className="min-h-screen bg-ink-950 text-slate-100">
      <main className="mx-auto w-full max-w-[1520px] px-6 py-8 xl:px-14">
        <div className="space-y-6">
          {status === "idle" && (
            <IdleState
              onRun={handleRun}
              selectedScenario={selectedScenario}
              onScenarioChange={setSelectedScenario}
              historyCount={history.length}
              onShowHistory={() => setShowHistoryDrawer(true)}
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
              {/* ── Breadcrumb + action bar ── */}
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-3 text-[13px]">
                  <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-white/40">workspace</span>
                  <span className="text-white/30">/</span>
                  <span className="text-white capitalize">{data.scenario?.replace(/_/g, " ") ?? "Run"}</span>
                  {data.target_date && (
                    <><span className="text-white/30">/</span><span className="font-mono text-white/65">{data.target_date}</span></>
                  )}
                  <span className="rounded-full bg-emerald-500/[0.08] px-2.5 py-0.5 font-mono text-[10px] uppercase tracking-wider text-emerald-300 ring-1 ring-emerald-400/30">
                    Run complete
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    onClick={() => handleRun()}
                    className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs text-white/70 ring-1 ring-white/10 transition-colors hover:text-white"
                  >
                    <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                    </svg>
                    New run
                  </button>
                  <a href={`/api/v1/runs/${(data as unknown as Record<string,unknown>).id}/export`}
                    className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs text-white/70 ring-1 ring-white/10 transition-colors hover:text-white">
                    <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M7 10l5 5 5-5M12 15V3" />
                    </svg>
                    Export PDF
                  </a>
                  <button
                    onClick={() => setShowManagerBrief(true)}
                    className="btn-primary inline-flex items-center gap-1.5 rounded-lg px-4 py-1.5 text-xs font-semibold"
                  >
                    Open manager brief
                    <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 12h14M13 6l6 6-6 6" />
                    </svg>
                  </button>
                </div>
              </div>

              <CriticBanner
                critic={data.critic}
                generatedAt={data.generated_at}
                targetDate={data.target_date}
              />

              <DashboardSummary data={data} />

              <div className="mt-10 space-y-4">
                <SectionHeader
                  label="Service Planning"
                  description="Demand pacing and reservation pressure for the current run."
                  tone="ember"
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

              <div className="mt-10 space-y-4">
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

              <div className="mt-10 space-y-4">
                <SectionHeader
                  label="Menu Direction"
                  description="Commercial and operational guidance synthesised for this planning window."
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

              {/* Re-run bar */}
              <div className="rounded-2xl border border-white/10 bg-white/[0.02] px-5 py-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-xs font-mono uppercase tracking-[0.18em] text-slate-600">Run complete</p>
                  <p className="mt-0.5 text-sm text-slate-400">
                    Scenario: <span className="text-slate-200">{data.scenario?.replace(/_/g, " ")}</span>
                    {data.target_date && <>  -  Target: <span className="text-slate-200">{data.target_date}</span></>}
                  </p>
                </div>
                <DatePicker onRun={handleRun} loading={false} scenario={SCENARIO_OPTIONS.find((item) => item.id === selectedScenario)} compact />
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