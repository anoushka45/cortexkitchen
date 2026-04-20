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

export default function DashboardPage() {
  const { data, status, error, history, trigger, reset, loadFromHistory } = useFridayRush();
  const [activeHistoryId, setActiveHistoryId] = useState<string | undefined>();
  const [showHistoryDrawer, setShowHistoryDrawer] = useState(false);

  const handleHistorySelect = (entry: RunHistoryEntry) => {
    setActiveHistoryId(entry.id);
    loadFromHistory(entry);
    setShowHistoryDrawer(false);
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
        <div className="max-w-[1500px] mx-auto px-5 xl:px-8 py-3 flex items-center justify-between gap-4">

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

          {/* History + Reset */}
          <div className="flex items-center gap-3 shrink-0">
            {history.length > 0 && (
              <button
                onClick={() => setShowHistoryDrawer(true)}
                className="text-xs font-mono text-slate-600 hover:text-slate-400 transition-colors px-2 py-1 rounded border border-slate-600/30 hover:border-slate-500/50"
                title="View run history"
              >
                history ({history.length})
              </button>
            )}
            {data && status === "success" && (
              <button
                onClick={reset}
                className="text-xs font-mono text-slate-600 hover:text-slate-400 transition-colors"
              >
                reset
              </button>
            )}
          </div>
        </div>
      </header>

      {/* ── Body ────────────────────────────────────────────── */}
      <div className="flex-1 max-w-[1500px] mx-auto w-full px-5 xl:px-8 py-6">

        {/* Main content */}
        <div className="w-full space-y-4">

          {/* Idle */}
          {status === "idle" && (
            <div className="flex flex-col items-center justify-center py-24 text-center space-y-12">
              {/* Hero Section */}
              <div className="space-y-6 max-w-2xl mx-auto">
                {/* Logo + Brand */}
                <div className="flex flex-col items-center gap-4">
                  <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-violet-600 to-violet-500 flex items-center justify-center text-5xl shadow-lg shadow-violet-500/20 border border-violet-400/30">
                    🍕
                  </div>
                  <div>
                    <h1 className="text-4xl font-bold bg-gradient-to-r from-violet-400 to-cyan-400 bg-clip-text text-transparent mb-1">
                      CortexKitchen
                    </h1>
                    <p className="text-sm font-mono uppercase tracking-widest text-violet-400/60">
                      AI-Powered Operations Intelligence
                    </p>
                  </div>
                </div>

                {/* Description */}
                <div className="space-y-3 px-4">
                  <p className="text-lg text-slate-200 leading-relaxed font-medium">
                    Predict demand, manage reservations, optimize inventory, and deliver exceptional service
                    during your Friday night rush.
                  </p>
                  <p className="text-sm text-slate-400 leading-relaxed">
                    Our multi-agent AI system analyzes demand patterns, reservation pressure, customer sentiment,
                    menu performance, and stock levels — then provides actionable recommendations reviewed by an
                    intelligent critic for safety and quality.
                  </p>
                </div>

                {/* Features Grid */}
                <div className="grid grid-cols-2 gap-3 mt-8 pt-8 border-t border-slate-700/50">
                  <div className="bg-slate-900/40 border border-slate-700/30 rounded-lg p-4 hover:border-violet-500/30 transition-colors">
                    <div className="text-2xl mb-2">📊</div>
                    <p className="text-xs font-mono uppercase tracking-wide text-slate-400 mb-1">Demand Forecast</p>
                    <p className="text-xs text-slate-500">ML-powered prediction with confidence intervals</p>
                  </div>
                  <div className="bg-slate-900/40 border border-slate-700/30 rounded-lg p-4 hover:border-emerald-500/30 transition-colors">
                    <div className="text-2xl mb-2">📅</div>
                    <p className="text-xs font-mono uppercase tracking-wide text-slate-400 mb-1">Reservations</p>
                    <p className="text-xs text-slate-500">Real-time capacity and occupancy analysis</p>
                  </div>
                  <div className="bg-slate-900/40 border border-slate-700/30 rounded-lg p-4 hover:border-rose-500/30 transition-colors">
                    <div className="text-2xl mb-2">💬</div>
                    <p className="text-xs font-mono uppercase tracking-wide text-slate-400 mb-1">Complaints</p>
                    <p className="text-xs text-slate-500">Sentiment analysis & pattern detection</p>
                  </div>
                  <div className="bg-slate-900/40 border border-slate-700/30 rounded-lg p-4 hover:border-amber-500/30 transition-colors">
                    <div className="text-2xl mb-2">🍽️</div>
                    <p className="text-xs font-mono uppercase tracking-wide text-slate-400 mb-1">Menu & Inventory</p>
                    <p className="text-xs text-slate-500">Stock optimization & promo recommendations</p>
                  </div>
                </div>
              </div>

              {/* CTA */}
              <div className="space-y-4 pt-4">
                <p className="text-sm text-slate-500 font-mono">Select a date to begin analysis</p>
                <DatePicker onRun={handleRun} loading={false} />
              </div>
            </div>
          )}

          {/* Loading */}
          {status === "loading" && (
            <div className="flex flex-col items-center justify-center py-24 gap-12">
              {/* Animated Pipeline Visualization */}
              <div className="relative w-80 h-80">
                {/* Background circle */}
                <div className="absolute inset-0 rounded-full border border-violet-500/20"></div>
                <div className="absolute inset-4 rounded-full border border-violet-500/10"></div>
                
                {/* Center circle */}
                <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-20 h-20 rounded-full bg-gradient-to-br from-violet-600 to-violet-500 border border-violet-400/50 flex items-center justify-center shadow-lg shadow-violet-500/50"
                  style={{ animation: "spin-slow 3s linear infinite" }}>
                  <div className="text-2xl">⚙️</div>
                </div>

                {/* Agent nodes in circular layout */}
                {[
                  { label: "📊 Forecast", angle: 0, icon: "📊" },
                  { label: "📅 Reservation", angle: 72, icon: "📅" },
                  { label: "💬 Complaints", angle: 144, icon: "💬" },
                  { label: "🍽️ Menu", angle: 216, icon: "🍽️" },
                  { label: "📦 Inventory", angle: 288, icon: "📦" },
                ].map((agent, i) => {
                  const rad = (agent.angle * Math.PI) / 180;
                  const x = 140 * Math.cos(rad);
                  const y = 140 * Math.sin(rad);
                  return (
                    <div
                      key={i}
                      className="absolute w-16 h-16 rounded-full bg-slate-900 border-2 border-violet-500/60 flex items-center justify-center cursor-default transition-all hover:scale-110"
                      style={{
                        left: "50%",
                        top: "50%",
                        transform: `translate(calc(-50% + ${x}px), calc(-50% + ${y}px))`,
                        animation: `pulse-glow 2s ease-in-out ${i * 0.2}s infinite`,
                      }}
                    >
                      <div className="text-2xl">{agent.icon}</div>
                    </div>
                  );
                })}

                {/* Animated connecting lines */}
                <svg className="absolute inset-0 w-full h-full" style={{ pointerEvents: "none" }}>
                  <circle
                    cx="50%"
                    cy="50%"
                    r="140"
                    fill="none"
                    stroke="url(#gradient)"
                    strokeWidth="2"
                    opacity="0.3"
                    style={{
                      strokeDasharray: "500",
                      strokeDashoffset: "0",
                      animation: "flow 20s linear infinite",
                    }}
                  />
                  <defs>
                    <linearGradient id="gradient" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor="#a78bfa" />
                      <stop offset="50%" stopColor="#06b6d4" />
                      <stop offset="100%" stopColor="#a78bfa" />
                    </linearGradient>
                  </defs>
                </svg>
              </div>

              {/* Status Text */}
              <div className="text-center space-y-3">
                <p className="text-base font-semibold text-slate-200">
                  <span className="inline-block animate-pulse">●</span> Pipeline Running
                </p>
                <p className="text-sm font-mono text-slate-400">
                  Aggregating insights from all agents...
                </p>
                <div className="flex items-center justify-center gap-2 mt-6">
                  <div className="flex gap-1.5">
                    {["forecast", "reservation", "complaint", "menu", "inventory"].map((agent, i) => (
                      <div
                        key={i}
                        className="w-2 h-2 rounded-full bg-violet-500"
                        style={{
                          animation: `step 3s ease-in-out ${i * 0.6}s infinite`,
                          opacity: 0.5,
                        }}
                      />
                    ))}
                  </div>
                </div>
              </div>

              <style>{`
                @keyframes pulse-glow {
                  0%, 100% {
                    box-shadow: 0 0 0 0 rgba(168, 85, 247, 0.4), inset 0 0 10px rgba(168, 85, 247, 0.1);
                  }
                  50% {
                    box-shadow: 0 0 0 8px rgba(168, 85, 247, 0), inset 0 0 20px rgba(168, 85, 247, 0.2);
                  }
                }
                
                @keyframes flow {
                  from {
                    stroke-dashoffset: 0;
                  }
                  to {
                    stroke-dashoffset: -500;
                  }
                }
                
                @keyframes step {
                  0% {
                    opacity: 0.3;
                    transform: scale(0.8);
                  }
                  50% {
                    opacity: 1;
                    transform: scale(1.2);
                  }
                  100% {
                    opacity: 0.3;
                    transform: scale(0.8);
                  }
                }
                
                @keyframes spin-slow {
                  from {
                    transform: rotate(0deg);
                  }
                  to {
                    transform: rotate(360deg);
                  }
                }
              `}</style>
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

              {/* Row 2 — Forecast chart + Reservation */}
              <div className="grid grid-cols-1 xl:grid-cols-12 gap-5">
                <div className="xl:col-span-8">
                  <ForecastChart forecast={data.recommendations.forecast} />
                </div>
                <div className="xl:col-span-4">
                  <AgentCard
                    agentKey="reservation"
                    data={data.recommendations.reservation as Record<string, unknown> | null}
                    index={0}
                  />
                </div>
              </div>

              {/* Row 3 — Complaint + Inventory */}
              <div className="grid grid-cols-1 xl:grid-cols-12 gap-5 items-stretch">
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

              {/* Row 4 — Menu */}
              <div className="grid grid-cols-1 gap-5">
                <div className="w-full">
                  <AgentCard
                    agentKey="menu"
                    data={data.recommendations.menu as Record<string, unknown> | null}
                    index={3}
                  />
                </div>
              </div>

              {/* Row 5 — RAG drawer */}
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

      {/* ── Run History Drawer ──────────────────────────────── */}
      {showHistoryDrawer && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/40 z-40"
            onClick={() => setShowHistoryDrawer(false)}
          />

          {/* Drawer */}
          <div
            className="fixed left-0 top-0 h-screen w-64 z-50 overflow-y-auto p-6 border-r"
            style={{
              background: "#0d1320",
              borderColor: "rgba(139,92,246,0.15)",
              animation: "slideIn 0.3s ease-out",
            }}
          >
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-sm font-mono uppercase tracking-widest text-slate-400">
                Run History
              </h2>
              <button
                onClick={() => setShowHistoryDrawer(false)}
                className="text-slate-500 hover:text-slate-300 transition-colors"
                title="Close drawer"
              >
                ✕
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
              from {
                transform: translateX(-100%);
              }
              to {
                transform: translateX(0);
              }
            }
          `}</style>
        </>
      )}
    </div>
  );
}
