// app/page.tsx
"use client";

import { useState }             from "react";
import { useFridayRush }        from "@/hooks/useFridayRush";
import { RunHistoryEntry }      from "@/types/planning";
import DatePicker               from "@/components/dashboard/DatePicker";
import RunHistory               from "@/components/dashboard/RunHistory";
import CriticBanner             from "@/components/dashboard/CriticBanner";
import AgentCard                from "@/components/dashboard/AgentCard";
import ForecastChart            from "@/components/dashboard/ForecastChart";
import RagContextDrawer         from "@/components/dashboard/RagContextDrawer";
import Spinner                  from "@/components/ui/Spinner";

const AGENT_KEYS = ["forecast", "reservation", "complaint", "menu", "inventory"] as const;

export default function DashboardPage() {
  const { data, status, error, history, trigger, reset, loadFromHistory } = useFridayRush();
  const [activeHistoryId, setActiveHistoryId] = useState<string | undefined>();

  const handleHistorySelect = (entry: RunHistoryEntry) => {
    setActiveHistoryId(entry.id);
    loadFromHistory(entry);
  };

  const handleRun = (date?: string) => {
    setActiveHistoryId(undefined);
    trigger(date);
  };

  return (
    <div className="min-h-screen flex flex-col">

      {/* ── Header ──────────────────────────────────────────── */}
      <header className="sticky top-0 z-10 border-b"
        style={{ background: "#0d1320", borderColor: "rgba(139,92,246,0.15)" }}>
        <div className="max-w-7xl mx-auto px-6 py-3 flex items-center justify-between gap-4">

          {/* Brand */}
          <div className="flex items-center gap-3 shrink-0">
            <div className="w-8 h-8 rounded-lg bg-violet-600 flex items-center justify-center text-sm">
              🍕
            </div>
            <div>
              <h1 className="text-sm font-bold text-slate-100 leading-none">
                CortexKitchen
              </h1>
              <p className="text-xs text-slate-500 mt-0.5 font-mono">
                ops intelligence
              </p>
            </div>
          </div>

          {/* Date picker + run */}
          <DatePicker onRun={handleRun} loading={status === "loading"} />

          {/* Reset */}
          {data && status === "success" && (
            <button
              onClick={reset}
              className="text-xs font-mono text-slate-600 hover:text-slate-400 transition-colors shrink-0"
            >
              reset
            </button>
          )}
        </div>
      </header>

      {/* ── Body ────────────────────────────────────────────── */}
      <div className="flex-1 max-w-7xl mx-auto w-full px-6 py-6 flex gap-6">

        {/* Run history sidebar */}
        {history.length > 0 && (
          <RunHistory
            history={history}
            activeId={activeHistoryId}
            onSelect={handleHistorySelect}
          />
        )}

        {/* Main content */}
        <div className="flex-1 min-w-0 space-y-4">

          {/* Idle */}
          {status === "idle" && (
            <div className="flex flex-col items-center justify-center py-32 text-center">
              <div className="w-16 h-16 rounded-2xl bg-violet-600/20 border border-violet-500/20 flex items-center justify-center text-3xl mb-6">
                🍕
              </div>
              <h2 className="text-lg font-semibold text-slate-300 mb-2">
                Friday Night Rush Intelligence
              </h2>
              <p className="text-sm text-slate-500 max-w-sm mb-8 leading-relaxed">
                Select a date and run the full multi-agent pipeline — demand forecast,
                reservations, complaints, menu, inventory, and critic validation.
              </p>
              <DatePicker onRun={handleRun} loading={false} />
            </div>
          )}

          {/* Loading */}
          {status === "loading" && (
            <div className="flex flex-col items-center justify-center py-32 gap-5">
              <Spinner size={36} />
              <div className="text-center">
                <p className="text-sm font-semibold text-slate-300">Pipeline running</p>
                <p className="text-xs font-mono text-slate-600 mt-1">
                  ops_manager → 5 agents → aggregator → critic → assembler
                </p>
              </div>
            </div>
          )}

          {/* Error */}
          {status === "error" && error && (
            <div className="card border-rose-500/20 px-6 py-5"
              style={{ background: "rgba(244,63,94,0.05)" }}>
              <p className="text-sm font-semibold text-rose-400 mb-1">Pipeline error</p>
              <p className="text-xs font-mono text-rose-500/70">{error}</p>
              <button
                onClick={() => trigger()}
                className="mt-4 text-xs font-mono text-rose-500 hover:text-rose-400 underline"
              >
                retry
              </button>
            </div>
          )}

          {/* Success */}
          {status === "success" && data && (
            <>
              {/* Row 1 — Critic banner */}
              <CriticBanner
                critic={data.critic}
                generatedAt={data.generated_at}
                targetDate={data.target_date}
              />

              {/* Row 2 — Forecast chart (2/3) + Reservation (1/3) */}
              <div className="grid grid-cols-3 gap-4">
                <div className="col-span-2">
                  <ForecastChart forecast={data.recommendations.forecast} />
                </div>
                <div className="col-span-1">
                  <AgentCard
                    agentKey="reservation"
                    data={data.recommendations.reservation as Record<string, unknown> | null}
                    index={0}
                  />
                </div>
              </div>

              {/* Row 3 — Complaint (large) + Menu + Inventory */}
              <div className="grid grid-cols-3 gap-4">
                <div className="col-span-1">
                  <AgentCard
                    agentKey="complaint"
                    data={data.recommendations.complaint as Record<string, unknown> | null}
                    index={1}
                  />
                </div>
                <div className="col-span-1">
                  <AgentCard
                    agentKey="menu"
                    data={data.recommendations.menu as Record<string, unknown> | null}
                    index={2}
                  />
                </div>
                <div className="col-span-1">
                  <AgentCard
                    agentKey="inventory"
                    data={data.recommendations.inventory as Record<string, unknown> | null}
                    index={3}
                  />
                </div>
              </div>

              {/* Row 4 — RAG drawer */}
              <RagContextDrawer ragContext={data.rag_context} />

              {/* Footer */}
              <p className="text-center text-xs font-mono text-slate-700 pb-2">
                scenario: {data.scenario} · status:{" "}
                <span className="text-violet-500">{data.status}</span>
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}