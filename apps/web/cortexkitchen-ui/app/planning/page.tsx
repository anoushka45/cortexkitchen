"use client";

// P6-A30 -- the flagship "trigger a plan, watch it run, inspect the result"
// experience, split out of /dashboard (which now only shows the overview/
// idle state -- see components/dashboard/TodayIdleState.tsx). This page owns
// the SSE stream (useFridayRush) and the run lifecycle (reset/history/status
// registered into DashboardContext), since useFridayRush's trigger() isn't
// route-bound -- it lives entirely inside whichever component mounts the
// hook, so /dashboard can't keep a stream alive across a navigation to here.
// Instead /dashboard sets DashboardContext.pendingTrigger and navigates;
// this page consumes+clears it on mount.

import { Suspense, useEffect, useState, useRef } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import ActionQueuePanel from "@/components/dashboard/ActionQueuePanel";
import AgentCard from "@/components/dashboard/AgentCard";
import CriticBanner from "@/components/dashboard/CriticBanner";
import DashboardDetailModal from "@/components/dashboard/DashboardDetailModal";
import DashboardSummary from "@/components/dashboard/DashboardSummary";
import DatePicker from "@/components/dashboard/DatePicker";
import ForecastChart from "@/components/dashboard/ForecastChart";
import ManagerActionPanel from "@/components/dashboard/ManagerActionPanel";
import SectionHeader from "@/components/dashboard/SectionHeader";
import WhatIfPanel from "@/components/dashboard/WhatIfPanel";
import RunHistory from "@/components/dashboard/RunHistory";
import ObservabilityStrip from "@/components/planning/ObservabilityStrip";
import EvidencePanel from "@/components/planning/EvidencePanel";
import PlanningIdleState from "@/components/planning/PlanningIdleState";
import { useAuth } from "@/context/AuthContext";
import { DashStatus, useDashboardCtx } from "@/context/DashboardContext";
import { useFridayRush } from "@/hooks/useFridayRush";
import { downloadRunPdf, downloadRunExcel } from "@/lib/exportRun";
import { FridayRushResponse, PlanningRunMetadata, RunHistoryEntry } from "@/types/planning";
import { SCENARIO_OPTIONS } from "@/lib/scenarios";
import { PlanningScenarioOption } from "@/types/planning";

type NodeState = "idle" | "running" | "done" | "skipped";

function reservationSwiggySignal(data: FridayRushResponse | null): string | undefined {
  const occ = data?.swiggy_occupancy_context as Record<string, unknown> | null | undefined;
  const sig = occ?.occupancy_signal as string | undefined;
  return sig ? `area tonight: ${sig}` : undefined;
}

function inventorySwiggySignal(data: FridayRushResponse | null): string | undefined {
  const proc = data?.swiggy_procurement_options as Record<string, unknown> | null | undefined;
  const opts = proc?.procurement_options as unknown[] | undefined;
  return opts && opts.length > 0 ? `${opts.length} Instamart prices live` : undefined;
}

function menuSwiggySignal(data: FridayRushResponse | null): string | undefined {
  const comp = data?.swiggy_competitor_context as Record<string, unknown> | null | undefined;
  const alerts = comp?.alerts as unknown[] | undefined;
  const avgMap = comp?.area_avg as Record<string, number> | undefined;
  const dishCount = avgMap ? Object.keys(avgMap).length : 0;
  if (alerts && alerts.length > 0) return `${alerts.length} pricing alert${alerts.length !== 1 ? "s" : ""} · ${dishCount} dishes`;
  if (dishCount > 0) return `${dishCount} competitor dishes tracked`;
  return undefined;
}

function StepRow({
  label, hint, state, swiggy = false,
}: { label: string; hint?: string; state: NodeState; swiggy?: boolean }) {
  const isDone    = state === "done";
  const isRunning = state === "running";
  const isSkipped = state === "skipped";

  const labelColor = isDone || isRunning ? "text-[var(--color-text-primary)]"
                    : isSkipped          ? "text-amber-300/70"
                    :                       "text-[var(--color-text-ghost)]";
  const hintColor  = isDone    ? "text-[var(--color-text-faint)]"
                    : isRunning ? (swiggy ? "text-orange-300/70" : "text-[var(--color-accent)]/70")
                    :             "text-[var(--color-text-ghost)]";

  return (
    <div className="flex items-start gap-3 py-2">
      <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center">
        {isDone ? (
          <svg className="h-4 w-4 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        ) : isSkipped ? (
          <svg className="h-4 w-4 text-amber-400/60" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        ) : isRunning ? (
          <span className="relative flex h-2.5 w-2.5">
            <span className={`absolute inset-0 animate-ping rounded-full opacity-60 ${swiggy ? "bg-orange-400" : "bg-ember-400"}`} />
            <span className={`relative h-2.5 w-2.5 rounded-full ${swiggy ? "bg-orange-400" : "bg-ember-400"}`} />
          </span>
        ) : (
          <span className="h-2 w-2 rounded-full bg-[var(--color-border-default)]" />
        )}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className={`text-[13px] font-medium transition-colors duration-300 ${labelColor}`}>{label}</p>
          {swiggy && (isDone || isRunning) && (
            <img src="/swiggy-logo.png" alt="Swiggy" className="h-3 w-3 object-contain opacity-70 shrink-0" />
          )}
        </div>
        {hint && (isDone || isRunning) && (
          <p className={`text-[11px] mt-0.5 leading-snug transition-colors duration-300 ${hintColor}`}>{hint}</p>
        )}
        {isSkipped && (
          <p className="text-[11px] mt-0.5 text-amber-300/50">Skipped — stock data unavailable</p>
        )}
      </div>
    </div>
  );
}

function LoadingState({ completedNodes, startedNodes, nodeHints, replanCount, scenarioLabel, restaurantName }: {
  completedNodes: Set<string>;
  startedNodes:   Set<string>;
  nodeHints:      Record<string, string>;
  replanCount: number;
  scenarioLabel?: string;
  restaurantName?: string | null;
}) {
  const ns = (key: string): NodeState => {
    if (completedNodes.has(key)) return "done";
    if (startedNodes.has(key))   return "running";
    return "idle";
  };

  const anyStarted     = startedNodes.size > 0 || completedNodes.size > 0;
  const forecastDone   = completedNodes.has("forecast");
  const enrichmentDone = completedNodes.has("enrichment");
  const menuDone       = completedNodes.has("menu");
  const menuStarted    = startedNodes.has("menu");
  const aggDone        = completedNodes.has("aggregator");
  const criticDone     = completedNodes.has("critic");

  const parallelKeys = ["reservation", "complaint", "inventory", "market_intel", "dineout_manager"] as const;
  const parallelDone = parallelKeys.every(k => completedNodes.has(k));
  const parallelRemaining = parallelKeys.filter(k => !completedNodes.has(k)).length;
  const allAgentsDone = parallelDone && menuDone;

  const menuSkipped = aggDone && !menuDone && !menuStarted;

  const forecastState:   NodeState = ns("forecast");
  const enrichmentState: NodeState = ns("enrichment");
  const menuState:       NodeState = menuSkipped ? "skipped" : ns("menu");
  const aggState:        NodeState = ns("aggregator");
  const criticState:     NodeState = ns("critic");

  const parallelAgents: { key: typeof parallelKeys[number]; label: string; subLabel: string; dot: string; swiggy: boolean }[] = [
    { key: "reservation",     label: "Reservations",     subLabel: "Bookings & capacity",     dot: "bg-cyan-400",    swiggy: false },
    { key: "complaint",       label: "Guest Feedback",   subLabel: "Complaints & sentiment",  dot: "bg-rose-400",    swiggy: false },
    { key: "inventory",       label: "Inventory",        subLabel: "Shortage detection",      dot: "bg-emerald-400", swiggy: false },
    { key: "market_intel",    label: "Competitor Prices",subLabel: "Live Swiggy pricing",     dot: "bg-orange-400",  swiggy: true  },
    { key: "dineout_manager", label: "Area Demand",      subLabel: "Dineout slot signals",    dot: "bg-orange-400",  swiggy: true  },
  ];

  const isReplanning = replanCount > 0 && !allAgentsDone;

  const currentAction =
    isReplanning                               ? `Fixing a few things — attempt ${replanCount} of 2…`
    : replanCount > 0 && criticDone           ? `Re-checked after fixing, attempt ${replanCount} of 2`
    : criticDone                              ? "Plan approved"
    : aggDone                                 ? "Reviewing the plan for mistakes…"
    : allAgentsDone                           ? "Putting your brief together…"
    : menuSkipped                             ? "Finishing up without menu guidance…"
    : menuDone                                ? "Putting your brief together…"
    : menuStarted                             ? "Building your menu guidance…"
    : parallelDone                            ? "Building your menu guidance…"
    : enrichmentDone && parallelRemaining > 0 ? `${parallelRemaining} of 5 checks still running…`
    : forecastDone                            ? "Loading context from past plans…"
    : anyStarted                              ? "Checking tonight's demand…"
    :                                           "Getting started…";

  return (
    <div className="py-10">
      <div className="mx-auto max-w-[560px] text-center mb-8">
        <div className="inline-flex items-center gap-2 rounded-full border border-ember-500/20 bg-ember-500/[0.08] px-3 py-1.5 mb-4">
          <span className="relative flex h-2 w-2">
            {!criticDone && <span className="absolute inset-0 animate-ping rounded-full bg-ember-400 opacity-50" />}
            <span className={`relative rounded-full ${criticDone ? "bg-emerald-400" : "bg-ember-400"}`} />
          </span>
          <span className="text-[10px] uppercase tracking-[0.24em] text-[var(--color-accent)]">
            {criticDone ? "Complete" : "Working"}
          </span>
        </div>
        <h1 className="text-[30px] font-semibold tracking-[-0.015em] text-[var(--color-text-primary)] leading-[1.1]">
          {criticDone ? "Your brief is ready." : (
            <>
              Preparing your brief,{" "}
              <span className="display-it text-[var(--color-accent)]">
                {restaurantName ?? "Chef"}!
              </span>
            </>
          )}
        </h1>
        {!criticDone && scenarioLabel && (
          <p className="mt-2 text-[10px] uppercase tracking-[0.24em] text-[var(--color-text-faint)]">
            for the {scenarioLabel} scenario
          </p>
        )}
        <p className="mt-3 text-[13px] leading-[1.7] text-[var(--color-text-faint)] max-w-sm mx-auto">
          5 specialists analyse your kitchen and market data simultaneously — 3 from your own records, 2 pulling live prices from Swiggy. A critic reviews the plan before you see it.
        </p>
      </div>

      {replanCount > 0 && (
        <div className="mb-5 rounded-xl border border-amber-500/25 bg-amber-500/[0.06] px-4 py-3 flex items-start gap-3">
          <span className="relative flex h-2 w-2 shrink-0 mt-1">
            <span className="absolute inset-0 animate-ping rounded-full bg-amber-400 opacity-60" />
            <span className="relative rounded-full bg-amber-400" />
          </span>
          <div>
            <p className="text-xs font-semibold text-amber-300">
              Auto-replan triggered — attempt {replanCount} of 2
            </p>
            <p className="text-[11px] text-amber-300/60 mt-0.5">
              The critic found issues in the initial plan. Replanning with corrected constraints — this is automatic, no action needed.
            </p>
          </div>
        </div>
      )}

      <div className="mx-auto max-w-[480px] rounded-2xl bg-[var(--color-surface)] ring-1 ring-[var(--color-border-soft)] px-5 py-4 divide-y divide-[var(--color-border-soft)]">
        <StepRow label="Checking tonight's demand" hint={nodeHints["forecast"]} state={forecastState} />
        <StepRow label="Loading context from past plans" hint={nodeHints["enrichment"]} state={enrichmentState} />
        {parallelAgents.map((agent) => (
          <StepRow
            key={agent.key}
            label={agent.label}
            hint={nodeHints[agent.key]}
            state={ns(agent.key)}
            swiggy={agent.swiggy}
          />
        ))}
        <StepRow label="Building your menu guidance" hint={nodeHints["menu"]} state={menuState} />
        <StepRow label="Compiling your brief" hint={nodeHints["aggregator"]} state={aggState} />
        <StepRow
          label="Reviewing the plan for mistakes"
          hint={replanCount > 0 ? `Retry ${replanCount} of 2` : nodeHints["critic"]}
          state={criticState}
        />
      </div>

      <div className="mt-7 text-center">
        {criticDone && replanCount === 0 ? (
          <div className="rounded-xl bg-emerald-500/[0.06] ring-1 ring-emerald-400/25 px-5 py-3.5">
            <p className="text-sm font-semibold text-emerald-300">Plan approved. Loading your brief...</p>
          </div>
        ) : criticDone && replanCount > 0 ? (
          <div className="rounded-xl bg-emerald-500/[0.06] ring-1 ring-emerald-400/25 px-5 py-3.5">
            <p className="text-sm font-semibold text-emerald-300">Plan finalised after {replanCount} replan{replanCount > 1 ? "s" : ""}. Loading your brief...</p>
          </div>
        ) : (
          <p className="text-[11px] uppercase tracking-[0.18em] text-[var(--color-text-faint)]">{currentAction}</p>
        )}
      </div>
    </div>
  );
}

function PlanningPageContent() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const dashCtx = useDashboardCtx();

  const { data, status, error, history, completedNodes, startedNodes, nodeHints, replanCount, trigger, reset, loadFromHistory } = useFridayRush();
  const [activeHistoryId, setActiveHistoryId] = useState<string | number | undefined>();
  const [showHistoryDrawer, setShowHistoryDrawer] = useState(false);
  const [showManagerBrief, setShowManagerBrief] = useState(false);
  const [showWhatIf,       setShowWhatIf]       = useState(false);
  const [exportMenuOpen,   setExportMenuOpen]   = useState(false);
  const [exportingPdf,     setExportingPdf]     = useState(false);
  const [exportingExcel,   setExportingExcel]   = useState(false);
  const exportMenuRef = useRef<HTMLDivElement>(null);
  const [runMeta, setRunMeta] = useState<{ scenarioLabel: string; restaurantName: string | null }>({ scenarioLabel: "", restaurantName: null });

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (exportMenuRef.current && !exportMenuRef.current.contains(e.target as Node))
        setExportMenuOpen(false);
    }
    if (exportMenuOpen) document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [exportMenuOpen]);

  async function handleExportPdf() {
    const runId   = data?.meta?.planning_run_id as number | undefined;
    const scenario = data?.scenario ?? "run";
    if (!runId) return;
    setExportingPdf(true);
    setExportMenuOpen(false);
    try { await downloadRunPdf(runId, scenario); } catch (e) { console.error(e); }
    finally { setExportingPdf(false); }
  }

  async function handleExportExcel() {
    const runId   = data?.meta?.planning_run_id as number | undefined;
    const scenario = data?.scenario ?? "run";
    if (!runId) return;
    setExportingExcel(true);
    setExportMenuOpen(false);
    try { await downloadRunExcel(runId, scenario); } catch (e) { console.error(e); }
    finally { setExportingExcel(false); }
  }

  // Auth guard
  useEffect(() => {
    if (!authLoading && !user) router.push("/login");
  }, [user, authLoading, router]);

  // Sync run status and reset fn to NavBar context -- /planning now owns
  // the run lifecycle (moved from /dashboard, P6-A30).
  useEffect(() => {
    dashCtx?.setDashStatus(status as DashStatus);
  }, [status, dashCtx]);

  useEffect(() => {
    dashCtx?.registerReset(reset);
  }, [reset, dashCtx]);

  useEffect(() => {
    dashCtx?.registerOpenHistory(() => setShowHistoryDrawer(true));
  }, [dashCtx]);

  // Consume a trigger request handed off from /dashboard (which no longer
  // owns the SSE stream -- see DashboardContext.pendingTrigger).
  useEffect(() => {
    const pending = dashCtx?.pendingTrigger;
    if (pending) {
      setRunMeta({
        scenarioLabel: pending.customProfile?.label ?? SCENARIO_OPTIONS.find(s => s.id === pending.scenario)?.label ?? pending.scenario,
        restaurantName: pending.restaurantName ?? user?.org_name ?? null,
      });
      trigger(pending.targetDate, pending.scenario, pending.restaurantId, pending.customProfile);
      dashCtx?.setPendingTrigger(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dashCtx?.pendingTrigger]);

  useEffect(() => {
    if (searchParams.get("openHistory") === "1") {
      setShowHistoryDrawer(true);
      router.replace("/planning");
    }
  }, [searchParams, router]);

  // Deep-link a specific past run via ?run=<id> -- relocated from /dashboard
  // (P6-A30), preserves old /dashboard?run=<id> and /operations?run=<id>
  // bookmarks via their redirect shims.
  useEffect(() => {
    const runId = searchParams.get("run");
    if (runId) {
      loadFromHistory({ id: Number(runId) } as RunHistoryEntry);
      router.replace("/planning");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  const selectedScenario = (dashCtx?.selectedScenario ?? "friday_rush") as PlanningScenarioOption["id"];

  const handleHistorySelect = async (entry: RunHistoryEntry) => {
    setActiveHistoryId(entry.id);
    await loadFromHistory(entry);
    setShowHistoryDrawer(false);
  };

  const handleRun = (date?: string, restaurantName?: string, restaurantId?: number, customProfile?: import("@/types/planning").ScenarioProfile) => {
    setActiveHistoryId(undefined);
    setRunMeta({
      scenarioLabel: customProfile?.label ?? SCENARIO_OPTIONS.find(s => s.id === selectedScenario)?.label ?? selectedScenario,
      restaurantName: restaurantName ?? user?.org_name ?? null,
    });
    trigger(date, selectedScenario, restaurantId, customProfile);
  };

  if (authLoading || !user) return null;

  const metadata = data?.meta as PlanningRunMetadata | undefined;

  return (
    <div className="min-h-screen bg-[var(--color-surface-page)] text-[var(--color-text-primary)]">
      <main className="mx-auto w-full max-w-[1520px] px-6 py-8 xl:px-14">
        <div className="space-y-6">
          {status === "idle" && (
            <PlanningIdleState
              onRun={handleRun}
              selectedScenario={selectedScenario}
              onScenarioChange={(s) => dashCtx?.setSelectedScenario(s)}
              history={history}
              onSelectHistory={handleHistorySelect}
              onShowAllHistory={() => setShowHistoryDrawer(true)}
            />
          )}

          {status === "loading" && <LoadingState completedNodes={completedNodes} startedNodes={startedNodes} nodeHints={nodeHints} replanCount={replanCount} scenarioLabel={runMeta.scenarioLabel} restaurantName={runMeta.restaurantName} />}

          {status === "error" && error && (
            <div
              className="rounded-3xl border border-rose-500/20 px-6 py-5"
              style={{ background: "rgba(244,63,94,0.06)" }}
            >
              <p className="text-sm font-semibold text-rose-400">Something went wrong</p>
              <p className="mt-1 text-xs text-rose-300/80">{error}</p>
              <button
                onClick={() => trigger()}
                className="mt-4 text-xs text-rose-300 underline underline-offset-4"
              >
                retry
              </button>
            </div>
          )}

          {status === "success" && data && (
            <>
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-3 text-[13px]">
                  <span className="text-[10px] uppercase tracking-[0.22em] text-[var(--color-text-faint)]">workspace</span>
                  <span className="text-[var(--color-text-faint)]">/</span>
                  <span className="text-[var(--color-text-primary)] capitalize">{data.scenario?.replace(/_/g, " ") ?? "Run"}</span>
                  {data.target_date && (
                    <><span className="text-[var(--color-text-faint)]">/</span><span className="font-mono text-[var(--color-text-soft)]">{data.target_date}</span></>
                  )}
                  <span className="rounded-full bg-emerald-500/[0.08] px-2.5 py-0.5 text-[10px] uppercase tracking-wider text-emerald-300 ring-1 ring-emerald-400/30">
                    Run complete
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    onClick={() => handleRun()}
                    className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs text-[var(--color-text-soft)] ring-1 ring-[var(--color-border-default)] transition-colors hover:text-[var(--color-text-primary)]"
                  >
                    <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                    </svg>
                    New run
                  </button>
                  <div className="relative" ref={exportMenuRef}>
                    <button
                      onClick={() => setExportMenuOpen(v => !v)}
                      disabled={exportingPdf || exportingExcel}
                      className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs text-[var(--color-text-soft)] ring-1 ring-[var(--color-border-default)] transition-colors hover:text-[var(--color-text-primary)] disabled:opacity-40"
                    >
                      <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M7 10l5 5 5-5M12 15V3" />
                      </svg>
                      {exportingPdf ? "Exporting PDF…" : exportingExcel ? "Exporting Excel…" : "Export"}
                      <svg className="h-3 w-3 text-[var(--color-text-faint)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>
                    {exportMenuOpen && (
                      <div className="absolute left-0 top-full mt-1.5 w-44 rounded-xl border border-[var(--color-border-default)] bg-[var(--color-surface-raised)] py-1.5 shadow-xl z-50">
                        <button onClick={handleExportPdf} className="flex w-full items-center gap-2.5 px-3 py-2 text-xs text-[var(--color-text-soft)] hover:bg-[var(--color-surface-raised)] hover:text-[var(--color-text-primary)] transition-colors">
                          <svg className="h-3.5 w-3.5 text-rose-300/70" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                          </svg>
                          Chef brief — PDF
                        </button>
                        <button onClick={handleExportExcel} className="flex w-full items-center gap-2.5 px-3 py-2 text-xs text-[var(--color-text-soft)] hover:bg-[var(--color-surface-raised)] hover:text-[var(--color-text-primary)] transition-colors">
                          <svg className="h-3.5 w-3.5 text-emerald-300/70" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                          </svg>
                          Owner workbook — Excel
                        </button>
                      </div>
                    )}
                  </div>
                  <button
                    onClick={() => setShowWhatIf(true)}
                    className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs text-[var(--color-text-soft)] ring-1 ring-[var(--color-border-default)] transition-colors hover:text-[var(--color-text-primary)]"
                  >
                    <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                    What-if
                  </button>
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

              <ActionQueuePanel />

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                {[
                  { label: "Export for your chef", desc: "Download a PDF brief or Excel workbook", icon: <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M7 10l5 5 5-5M12 15V3" /></svg>, action: handleExportPdf },
                  { label: "Try a different cover count", desc: "Instant what-if, no rerun needed", icon: <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>, action: () => setShowWhatIf(true) },
                  { label: "Ask the AI a question", desc: "Dig into why the plan said what it said", icon: <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>, action: () => window.location.href = "/chat" },
                ].map(({ label, desc, icon, action }) => (
                  <button key={label} onClick={action} className="flex items-start gap-3 rounded-xl border border-[var(--color-border-default)] bg-[var(--color-surface-raised)] px-4 py-3.5 text-left transition-colors hover:border-ember-500/30 hover:bg-ember-500/[0.04] group">
                    <span className="mt-0.5 text-[var(--color-text-faint)] group-hover:text-[var(--color-accent)] transition-colors">{icon}</span>
                    <div>
                      <p className="text-[13px] font-medium text-[var(--color-text-primary)] group-hover:text-[var(--color-text-primary)] transition-colors">{label}</p>
                      <p className="text-[11px] text-[var(--color-text-faint)] mt-0.5">{desc}</p>
                    </div>
                  </button>
                ))}
              </div>

              <DashboardSummary data={data} />

              {/* P6-A30 -- new observability + evidence sections */}
              <div className="grid grid-cols-1 gap-5 xl:grid-cols-12">
                <div className="xl:col-span-7"><ObservabilityStrip metadata={metadata} /></div>
                <div className="xl:col-span-5"><EvidencePanel data={data} /></div>
              </div>

              <div className="mt-6 space-y-4">
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

              <Link
                href={`/market${data.meta?.planning_run_id ? `?run=${data.meta.planning_run_id}` : ""}`}
                className="group mt-6 flex items-center justify-between gap-4 rounded-2xl border border-[var(--color-border-default)] bg-[var(--color-surface-raised)] px-5 py-4 transition-colors hover:border-[#fc8019]/30 hover:bg-[#fc8019]/[0.04]"
              >
                <div>
                  <p className="text-xs uppercase tracking-[0.18em] text-[var(--color-text-faint)]">Via Swiggy MCP</p>
                  <p className="mt-1 text-sm font-semibold text-[var(--color-text-primary)]">See market intelligence</p>
                  <p className="mt-0.5 text-xs text-[var(--color-text-faint)]">Competitor pricing, area demand, Instamart prices</p>
                </div>
                <svg className="h-4 w-4 shrink-0 text-[var(--color-text-faint)] transition-transform group-hover:translate-x-0.5 group-hover:text-[#fc8019]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>
              </Link>

              <div className="rounded-2xl border border-[var(--color-border-default)] bg-[var(--color-surface-raised)] px-5 py-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-xs uppercase tracking-[0.18em] text-[var(--color-text-ghost)]">Run complete</p>
                  <p className="mt-0.5 text-sm text-[var(--color-text-soft)]">
                    Scenario: <span className="text-[var(--color-text-primary)]">{data.scenario?.replace(/_/g, " ")}</span>
                    {data.target_date && <>  -  Target: <span className="text-[var(--color-text-primary)]">{data.target_date}</span></>}
                  </p>
                </div>
                <DatePicker onRun={handleRun} loading={false} scenario={SCENARIO_OPTIONS.find((item) => item.id === selectedScenario)} compact />
              </div>

              {showWhatIf && (() => {
                const fc      = data.recommendations?.forecast as Record<string, unknown> | null;
                const fcData  = (fc?.data as Record<string, unknown> | null) ?? fc;
                const baseCovers = Number(fcData?.predicted_orders ?? 0);
                const avgCovers  = Number(fcData?.avg_same_day_orders ?? fcData?.avg_friday_orders ?? baseCovers);
                const svcWindow  = (fcData?.service_window as string) ?? "18:00-22:00";
                return baseCovers > 0 ? (
                  <>
                    <div
                      className="fixed inset-0 z-40 bg-black/55 backdrop-blur-sm"
                      onClick={() => setShowWhatIf(false)}
                    />
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
                      <div
                        className="relative w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl bg-[var(--color-surface)] ring-1 ring-[var(--color-border-default)] shadow-[0_40px_80px_rgba(0,0,0,0.6)] pointer-events-auto"
                        style={{ animation: "fadeUp 0.2s ease-out" }}
                      >
                        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--color-border-default)]">
                          <div>
                            <p className="text-[10px] uppercase tracking-[0.22em] text-[var(--color-accent)]/80">Simulator</p>
                            <h2 className="mt-0.5 text-base font-semibold text-[var(--color-text-primary)]">What-if Simulator</h2>
                          </div>
                          <button
                            onClick={() => setShowWhatIf(false)}
                            className="text-[var(--color-text-faint)] hover:text-[var(--color-text-soft)] transition-colors"
                          >
                            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        </div>
                        <div className="px-6 py-5">
                          <WhatIfPanel
                            baseCovers={baseCovers}
                            avgCovers={avgCovers}
                            scenario={data.scenario ?? "friday_rush"}
                            serviceWindow={svcWindow}
                            defaultOpen
                          />
                        </div>
                      </div>
                    </div>
                    <style>{`@keyframes fadeUp { from { opacity:0; transform:translateY(12px); } to { opacity:1; transform:translateY(0); } }`}</style>
                  </>
                ) : null;
              })()}

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
            className="fixed left-0 top-0 z-50 h-screen w-72 overflow-y-auto border-r border-[var(--color-border-default)] bg-[var(--color-surface)] p-6"
            style={{ animation: "slideIn 0.25s ease-out" }}
          >
            <div className="mb-6 flex items-center justify-between">
              <h2 className="text-sm uppercase tracking-[0.18em] text-[var(--color-text-soft)]">
                Run History
              </h2>
              <button
                onClick={() => setShowHistoryDrawer(false)}
                className="text-sm text-[var(--color-text-faint)] transition-colors hover:text-[var(--color-text-soft)]"
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

export default function PlanningPage() {
  return (
    <Suspense fallback={null}>
      <PlanningPageContent />
    </Suspense>
  );
}
