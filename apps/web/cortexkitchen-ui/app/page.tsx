// app/page.tsx
// CortexKitchen Dashboard — main page.
// Wires the hook + all components into one cohesive view.

"use client";

import { useFridayRush } from "@/hooks/useFridayRush";
import RunButton from "@/components/dashboard/RunButton";
import CriticBanner from "@/components/dashboard/CriticBanner";
import AgentCard from "@/components/dashboard/AgentCard";
import ForecastChart from "@/components/dashboard/ForecastChart";
import RagContextDrawer from "@/components/dashboard/RagContextDrawer";
import Spinner from "@/components/ui/Spinner";

export default function DashboardPage() {
  const { data, status, error, trigger, reset } = useFridayRush();

  const isCentered = status === "idle" || status === "loading";

  return (
    <main className="min-h-screen flex flex-col bg-gray-950 text-gray-100">
      {/* ── Top Navigation ───────────────────────────────────── */}
      <header className="sticky top-0 z-10 border-b border-gray-800 bg-gray-950/80 backdrop-blur-md">
        <div className="max-w-screen-2xl mx-auto px-6 py-4 flex items-center justify-between">
          {/* Logo & Branding */}
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-gradient-to-br from-orange-500 via-red-500 to-pink-600 shadow-md shadow-orange-500/20">
              <span className="text-lg">🍕</span>
            </div>

            <div>
              <h1 className="text-lg font-bold bg-gradient-to-r from-orange-400 to-red-500 bg-clip-text text-transparent leading-none">
                CortexKitchen
              </h1>
              <p className="text-xs text-gray-400 mt-0.5">
                AI-Powered Restaurant Decision Intelligence
              </p>
            </div>
          </div>

          {/* Scenario Badge + Actions */}
          <div className="flex items-center gap-4">
            <span className="hidden sm:inline-flex items-center rounded-full border border-orange-500/30 bg-orange-500/10 px-3 py-1 text-xs font-medium text-orange-300">
              Friday Night Rush
            </span>

            <RunButton
              onRun={trigger}
              onReset={reset}
              loading={status === "loading"}
              hasData={!!data}
            />
          </div>
        </div>
      </header>

      {/* ── Page Body ───────────────────────────────────────── */}
      <div className="flex-1 flex">
        <div
          className={`w-full mx-auto ${
            isCentered
              ? "max-w-6xl px-6 flex items-center justify-center"
              : "max-w-screen-2xl px-8 xl:px-12 py-6 space-y-6"
          }`}
        >
          {/* ── Idle State ───────────────────────────────────── */}
          {status === "idle" && (
            <div className="flex flex-col items-center text-center max-w-3xl">
              {/* Icon */}
              <div className="mb-6">
                <div className="flex items-center justify-center w-20 h-20 rounded-full bg-gradient-to-br from-orange-500 via-red-500 to-pink-600 shadow-lg shadow-orange-500/20">
                  <span className="text-4xl">🍽️</span>
                </div>
              </div>

              {/* Title */}
              <h1 className="text-3xl font-bold bg-gradient-to-r from-orange-400 via-red-500 to-pink-500 bg-clip-text text-transparent mb-2">
                CortexKitchen
              </h1>

              {/* Tagline */}
              <h2 className="text-lg font-semibold text-gray-200 mb-3">
                AI-Powered Restaurant Decision Intelligence Platform
              </h2>

              {/* Description */}
              <p className="text-sm text-gray-400 max-w-2xl mb-6 leading-relaxed">
                CortexKitchen leverages multi-agent AI to help restaurants
                optimize operations, forecast demand, reduce risks, and make
                data-driven decisions. Powered by LangGraph orchestration, it
                transforms operational data into actionable insights through
                intelligent automation and real-time analysis.
              </p>

              {/* Feature Highlights */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm text-gray-300 mb-8 max-w-xl">
                {[
                  "📈 Demand Forecasting",
                  "🪑 Reservation Intelligence",
                  "💬 Complaint Insights (RAG)",
                  "🍽️ Menu Optimization",
                  "📦 Inventory Intelligence",
                  "🛡️ AI Critic Validation",
                ].map((feature) => (
                  <div
                    key={feature}
                    className="bg-gray-900 border border-gray-800 rounded-lg px-4 py-2"
                  >
                    {feature}
                  </div>
                ))}
              </div>

              {/* CTA */}
              <div className="flex flex-col items-center gap-3">
                <p className="text-sm text-gray-400">
                  Start with the flagship scenario:
                  <span className="text-orange-400 font-medium">
                    {" "}Friday Night Rush Planning
                  </span>
                </p>

                <RunButton
                  onRun={trigger}
                  loading={false}
                  hasData={false}
                />
              </div>

              {/* Tech Stack */}
              <p className="text-xs text-gray-500 mt-6">
                Powered by{" "}
                <span className="text-gray-300">FastAPI</span>,{" "}
                <span className="text-gray-300">LangGraph</span>,{" "}
                <span className="text-gray-300">Qdrant</span>,{" "}
                <span className="text-gray-300">Redis</span>, and{" "}
                <span className="text-gray-300">Next.js</span>.
              </p>
            </div>
          )}

          {/* ── Loading State ────────────────────────────────── */}
          {status === "loading" && (
            <div className="flex flex-col items-center justify-center text-center">
              {/* Animated Orb */}
              <div className="relative mb-6">
                <div className="absolute inset-0 rounded-full blur-2xl opacity-40 bg-gradient-to-r from-orange-500 via-red-500 to-pink-500 animate-pulse"></div>
                <div className="relative flex items-center justify-center w-20 h-20 rounded-full bg-gray-900 border border-gray-800 shadow-lg">
                  <Spinner size={40} />
                </div>
              </div>

              {/* Heading */}
              <h2 className="text-xl font-semibold bg-gradient-to-r from-orange-400 via-red-500 to-pink-500 bg-clip-text text-transparent">
                AI Pipeline in Progress
              </h2>

              {/* Subheading */}
              <p className="text-sm text-gray-400 mt-2 max-w-md">
                CortexKitchen is orchestrating a multi-agent workflow to
                generate operational insights for your restaurant.
              </p>

              {/* Pipeline Stages */}
              <div className="mt-6 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs text-gray-300">
                {[
                  "Forecast",
                  "Reservations",
                  "Complaints",
                  "Menu",
                  "Inventory",
                  "Aggregator",
                  "Critic",
                  "Assembler",
                ].map((stage) => (
                  <div
                    key={stage}
                    className="px-3 py-2 rounded-md bg-gray-900 border border-gray-800 shadow-sm animate-pulse"
                  >
                    {stage}
                  </div>
                ))}
              </div>

              <p className="text-xs text-gray-500 mt-4">
                Running 5 parallel agents · Aggregator · Critic · Final Assembler
              </p>
            </div>
          )}

          {/* ── Error State ─────────────────────────────────── */}
          {status === "error" && error && (
            <div className="w-full rounded-xl border border-red-800 bg-red-900/20 px-6 py-5">
              <p className="text-sm font-semibold text-red-400 mb-1">
                Pipeline error
              </p>
              <p className="text-sm text-red-300">{error}</p>
              <button
                onClick={() => trigger()}
                className="mt-4 text-sm text-red-400 underline hover:text-red-200"
              >
                Try again
              </button>
            </div>
          )}

          {/* ── Success State ───────────────────────────────── */}
          {status === "success" && data && (
            <div className="w-full space-y-6">
              {/* Critic Banner */}
              <CriticBanner
                critic={data.critic}
                generatedAt={data.generated_at}
                targetDate={data.target_date}
              />

              {/* Forecast Chart */}
              <ForecastChart
                forecast={data.recommendations.forecast}
              />

              {/* Professional Dashboard Grid */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                {/* Reservation Intelligence — Large */}
                <div className="md:col-span-2">
                  <AgentCard
                    agentKey="reservation"
                    data={
                      data.recommendations.reservation as
                        | Record<string, unknown>
                        | null
                    }
                  />
                </div>

                {/* Menu Intelligence */}
                <AgentCard
                  agentKey="menu"
                  data={
                    data.recommendations.menu as
                      | Record<string, unknown>
                      | null
                  }
                />

                {/* Inventory Intelligence */}
                <AgentCard
                  agentKey="inventory"
                  data={
                    data.recommendations.inventory as
                      | Record<string, unknown>
                      | null
                  }
                />

                {/* Complaint Intelligence — Full Width */}
                <div className="md:col-span-4">
                  <AgentCard
                    agentKey="complaint"
                    data={
                      data.recommendations.complaint as
                        | Record<string, unknown>
                        | null
                    }
                  />
                </div>
              </div>

              {/* RAG Context Drawer */}
              <RagContextDrawer ragContext={data.rag_context} />

              {/* Footer Meta */}
              <p className="text-center text-xs text-gray-500 pt-2">
                Scenario: {data.scenario} · Status:{" "}
                <span className="font-medium">{data.status}</span>
              </p>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}