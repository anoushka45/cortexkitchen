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
}: {
  label: string;
  description: string;
  tone?: "violet" | "cyan" | "rose" | "emerald" | "amber" | "default";
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
    <div className="px-1 flex items-start gap-3">
      <div className={`mt-1.5 h-10 w-1 rounded-full ${toneStyle.bar}`} />
      <div>
        <p className={`text-xs font-mono uppercase tracking-[0.18em] ${toneStyle.label}`}>
          {label}
        </p>
        <p className="mt-1 text-sm text-slate-400">{description}</p>
      </div>
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
          className="pointer-events-none absolute inset-0 opacity-[0.07]"
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
    <div className="rounded-2xl border border-white/10 bg-white/5 px-3 py-3">
      <p className="text-[11px] font-mono uppercase tracking-[0.18em] text-slate-500">
        scenario
      </p>
      <div className="mt-2 flex flex-wrap gap-2">
        {SCENARIO_OPTIONS.map((option) => {
          const active = option.id === selectedScenario;
          return (
            <button
              key={option.id}
              type="button"
              onClick={() => onScenarioChange(option.id)}
              className={`rounded-xl px-3 py-2 text-xs font-mono uppercase tracking-[0.14em] transition-all ${
                active
                  ? "bg-violet-500/15 text-violet-200"
                  : "border border-white/10 bg-slate-950/40 text-slate-300 hover:bg-slate-900 hover:text-white"
              }`}
            >
              {option.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function LoadingState() {
  const agents = [
    { key: "forecast",    label: "Demand forecast", tone: "violet"  },
    { key: "reservation", label: "Reservations",    tone: "cyan"    },
    { key: "complaint",   label: "Complaints",      tone: "rose"    },
    { key: "menu",        label: "Menu insights",   tone: "amber"   },
    { key: "inventory",   label: "Inventory",       tone: "emerald" },
  ] as const;

  const [doneAgents, setDoneAgents] = useState<Set<number>>(new Set());
  const [criticPhase, setCriticPhase] = useState(false);

  useEffect(() => {
    // Randomised completion in a tight 2–4s window — parallel fan-out, not sequential
    const delays = agents.map(() => 2000 + Math.random() * 2000);
    const timers: ReturnType<typeof setTimeout>[] = [];
    delays.forEach((delay, i) => {
      timers.push(setTimeout(() => setDoneAgents((prev) => new Set([...prev, i])), delay));
    });
    const maxDelay = Math.max(...delays);
    timers.push(setTimeout(() => setCriticPhase(true), maxDelay + 600));
    return () => timers.forEach(clearTimeout);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const dotClass: Record<(typeof agents)[number]["tone"], string> = {
    violet:  "bg-violet-400",
    cyan:    "bg-cyan-300",
    rose:    "bg-rose-400",
    amber:   "bg-amber-300",
    emerald: "bg-emerald-300",
  };

  const barGradient: Record<(typeof agents)[number]["tone"], string> = {
    violet:  "linear-gradient(90deg, rgba(139,92,246,0.10), rgba(139,92,246,0.70), rgba(139,92,246,0.10))",
    cyan:    "linear-gradient(90deg, rgba(34,211,238,0.10), rgba(34,211,238,0.65), rgba(34,211,238,0.10))",
    rose:    "linear-gradient(90deg, rgba(244,63,94,0.10), rgba(244,63,94,0.60), rgba(244,63,94,0.10))",
    amber:   "linear-gradient(90deg, rgba(251,191,36,0.10), rgba(251,191,36,0.65), rgba(251,191,36,0.10))",
    emerald: "linear-gradient(90deg, rgba(52,211,153,0.10), rgba(52,211,153,0.65), rgba(52,211,153,0.10))",
  };

  const solidBar: Record<(typeof agents)[number]["tone"], string> = {
    violet:  "bg-violet-500/50",
    cyan:    "bg-cyan-400/50",
    rose:    "bg-rose-400/50",
    amber:   "bg-amber-300/50",
    emerald: "bg-emerald-400/50",
  };

  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <div className="stagger-1 w-full max-w-3xl rounded-[28px] border border-white/10 bg-[radial-gradient(circle_at_top,rgba(139,92,246,0.10),transparent_48%),rgba(255,255,255,0.04)] px-8 py-10 shadow-[0_28px_110px_rgba(2,8,23,0.45)]">
        <div className="flex flex-col items-center gap-3">
          <div className="inline-flex items-center gap-3 rounded-full border border-white/10 bg-slate-950/40 px-4 py-2">
            <span className="relative inline-flex h-2.5 w-2.5">
              <span className="absolute inline-flex h-full w-full rounded-full bg-violet-400 opacity-50 animate-ping" />
              <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-violet-400" />
            </span>
            <span className="text-[11px] font-mono uppercase tracking-[0.22em] text-slate-400">
              running
            </span>
          </div>

          <h2 className="text-xl font-semibold text-slate-100">Planning pipeline in motion</h2>
          <p className="mt-1 max-w-xl text-sm leading-6 text-slate-400">
            Agents execute in parallel, then results are aggregated and reviewed before the dashboard updates.
          </p>
        </div>

        <div className="mt-8 grid grid-cols-1 gap-3 text-left">
          {agents.map((agent, index) => {
            const isDone = doneAgents.has(index);

            return (
              <div
                key={agent.key}
                className={`rounded-2xl border px-4 py-4 transition-all duration-500 ${
                  isDone
                    ? "border-white/5 bg-slate-950/20 opacity-55"
                    : "border-white/10 bg-slate-950/30"
                }`}
              >
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-2">
                    {isDone ? (
                      <span className="flex h-2 w-2 items-center justify-center">
                        <svg width="8" height="8" viewBox="0 0 8 8" fill="none">
                          <path d="M1 4l2 2 4-4" stroke="#34d399" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                      </span>
                    ) : (
                      <span
                        className={`h-2 w-2 rounded-full ${dotClass[agent.tone]}`}
                        style={{ animation: `ck-dot 1.3s ease-in-out ${index * 0.12}s infinite` }}
                      />
                    )}
                    <p className={`text-sm font-semibold ${isDone ? "text-slate-500" : "text-slate-200"}`}>
                      {agent.label}
                    </p>
                  </div>
                  <span className={`text-[11px] font-mono uppercase tracking-[0.18em] ${
                    isDone ? "text-emerald-600" : "text-slate-500"
                  }`}>
                    {isDone ? "done" : "active"}
                  </span>
                </div>

                <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/5">
                  {isDone ? (
                    <div className={`h-full w-full rounded-full transition-all duration-700 ${solidBar[agent.tone]}`} />
                  ) : (
                    <div
                      className="h-full w-[65%] rounded-full"
                      style={{
                        backgroundImage: barGradient[agent.tone],
                        backgroundSize: "220% 100%",
                        animation: `ck-shimmer 1.35s ease-in-out ${index * 0.1}s infinite`,
                      }}
                    />
                  )}
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-6 flex flex-col items-center gap-1">
          {criticPhase ? (
            <div className="inline-flex items-center gap-2 rounded-full border border-violet-500/20 bg-violet-500/5 px-4 py-2">
              <span className="relative inline-flex h-1.5 w-1.5">
                <span className="absolute inline-flex h-full w-full rounded-full bg-violet-400 opacity-60 animate-ping" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-violet-400" />
              </span>
              <span className="text-[11px] font-mono uppercase tracking-[0.22em] text-violet-400">
                critic reviewing
              </span>
            </div>
          ) : (
            <p className="text-[11px] font-mono uppercase tracking-[0.22em] text-slate-600">
              fan-out | aggregate | critic
            </p>
          )}
        </div>
      </div>

      <style>{`
        @keyframes ck-shimmer {
          0%, 100% { background-position: 0% 50%; opacity: 0.55; }
          50% { background-position: 100% 50%; opacity: 1; }
        }
        @keyframes ck-dot {
          0%, 100% { opacity: 0.45; transform: translateY(0); }
          50% { opacity: 1; transform: translateY(-2px); }
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
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-3">
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
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <SectionHeader
                  label="Menu Direction"
                  description="Commercial and operational guidance synthesized for this planning window."
                  tone="amber"
                />
                <AgentCard
                  agentKey="menu"
                  data={data.recommendations.menu as Record<string, unknown> | null}
                  index={3}
                />
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
