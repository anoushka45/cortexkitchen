// app/page.tsx
// CortexKitchen Friday Rush Dashboard — main page.
// Wires the hook + all components into one cohesive view.

"use client";

import { useFridayRush }       from "@/hooks/useFridayRush";
import RunButton               from "@/components/dashboard/RunButton";
import CriticBanner            from "@/components/dashboard/CriticBanner";
import AgentCard               from "@/components/dashboard/AgentCard";
import ForecastChart           from "@/components/dashboard/ForecastChart";
import RagContextDrawer        from "@/components/dashboard/RagContextDrawer";
import Spinner                 from "@/components/ui/Spinner";

const AGENT_KEYS = [
  "forecast",
  "reservation",
  "complaint",
  "menu",
  "inventory",
] as const;

export default function DashboardPage() {
  const { data, status, error, trigger, reset } = useFridayRush();

  return (
    <main className="min-h-screen bg-gray-50">
      {/* ── Top nav ───────────────────────────────────────────── */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-2xl">🍕</span>
            <div>
              <h1 className="text-base font-bold text-gray-900 leading-none">
                CortexKitchen
              </h1>
              <p className="text-xs text-gray-400 mt-0.5">
                Friday Night Rush · Operations Dashboard
              </p>
            </div>
          </div>

          <RunButton
            onRun={trigger}
            onReset={reset}
            loading={status === "loading"}
            hasData={!!data}
          />
        </div>
      </header>

      {/* ── Page body ─────────────────────────────────────────── */}
      <div className="max-w-6xl mx-auto px-6 py-8 space-y-6">

        {/* Idle state */}
        {status === "idle" && (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <span className="text-6xl mb-4">🍕</span>
            <h2 className="text-xl font-semibold text-gray-700 mb-2">
              Ready to plan Friday Night Rush
            </h2>
            <p className="text-sm text-gray-400 max-w-md mb-8">
              Hit <strong>Run Friday Rush</strong> to trigger the full multi-agent
              pipeline — demand forecast, reservations, complaints, menu, inventory,
              and critic validation.
            </p>
            <RunButton
              onRun={trigger}
              loading={false}
              hasData={false}
            />
          </div>
        )}

        {/* Loading state */}
        {status === "loading" && (
          <div className="flex flex-col items-center justify-center py-24 gap-4 text-gray-500">
            <Spinner size={40} />
            <div className="text-center">
              <p className="font-medium">Pipeline running…</p>
              <p className="text-sm text-gray-400 mt-1">
                5 agents · aggregator · critic · assembler
              </p>
            </div>
          </div>
        )}

        {/* Error state */}
        {status === "error" && error && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-6 py-5">
            <p className="text-sm font-semibold text-red-700 mb-1">Pipeline error</p>
            <p className="text-sm text-red-600">{error}</p>
            <button
              onClick={() => trigger()}
              className="mt-4 text-sm text-red-500 underline hover:text-red-700"
            >
              Try again
            </button>
          </div>
        )}

        {/* Success state */}
        {status === "success" && data && (
          <>
            {/* Critic banner — full width */}
            <CriticBanner
              critic={data.critic}
              generatedAt={data.generated_at}
              targetDate={data.target_date}
            />

            {/* Forecast chart — full width */}
            <ForecastChart forecast={data.recommendations.forecast} />

            {/* Agent cards — 2-col grid on md+, 1-col on mobile */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {AGENT_KEYS.map((key) => (
                <AgentCard
                  key={key}
                  agentKey={key}
                  data={
                    data.recommendations[key] as Record<string, unknown> | null
                  }
                />
              ))}
            </div>

            {/* RAG evidence drawer — full width, collapsed by default */}
            <RagContextDrawer ragContext={data.rag_context} />

            {/* Footer meta */}
            <p className="text-center text-xs text-gray-300 pb-4">
              Scenario: {data.scenario} · Status:{" "}
              <span className="font-medium">{data.status}</span>
            </p>
          </>
        )}
      </div>
    </main>
  );
}