"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { getPlanningRun, listPlanningRuns } from "@/lib/api";
import { PlanningRunDetail, PlanningRunSummary } from "@/types/planning";

const VERDICT_COLOR: Record<string, string> = {
  approved: "text-emerald-300 border-emerald-500/30 bg-emerald-500/10",
  rejected: "text-rose-300 border-rose-500/30 bg-rose-500/10",
  revision: "text-amber-300 border-amber-500/30 bg-amber-500/10",
  unknown: "text-slate-300 border-slate-600/40 bg-slate-800/50",
};

export default function RunsPage() {
  const [runs, setRuns] = useState<PlanningRunSummary[]>([]);
  const [selected, setSelected] = useState<PlanningRunDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        setLoading(true);
        const rows = await listPlanningRuns(50);
        setRuns(rows);
        if (rows[0]) {
          setSelected(await getPlanningRun(rows[0].id));
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unable to load runs");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const selectedAgents = useMemo(() => {
    const recommendations = selected?.final_response?.recommendations;
    if (!recommendations) return [];
    return Object.entries(recommendations);
  }, [selected]);

  async function openRun(run: PlanningRunSummary) {
    setSelected(await getPlanningRun(run.id));
  }

  return (
    <main className="min-h-screen bg-[#09111f] px-5 py-6 text-slate-100 xl:px-8">
      <div className="mx-auto max-w-[1520px] space-y-6">
        <header className="flex flex-col gap-4 border-b border-white/10 pb-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-mono uppercase tracking-[0.22em] text-violet-300">
              audit trail
            </p>
            <h1 className="mt-2 text-2xl font-semibold tracking-tight">Runs</h1>
            <p className="mt-1 max-w-2xl text-sm text-slate-400">
              Persisted planning runs with critic verdicts, agent outputs, RAG context, and trace metadata.
            </p>
          </div>
          <nav className="flex gap-2">
            <Link className="rounded-lg border border-white/10 px-3 py-2 text-xs font-mono text-slate-300 hover:bg-white/5" href="/">
              dashboard
            </Link>
            <Link className="rounded-lg border border-cyan-400/20 bg-cyan-500/10 px-3 py-2 text-xs font-mono text-cyan-200" href="/data-health">
              data health
            </Link>
          </nav>
        </header>

        {error && (
          <div className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 gap-5 xl:grid-cols-12">
          <section className="xl:col-span-5">
            <div className="overflow-hidden rounded-lg border border-white/10 bg-white/[0.03]">
              <div className="border-b border-white/10 px-4 py-3">
                <h2 className="text-sm font-semibold">Run History</h2>
                <p className="text-xs text-slate-500">Newest planning runs first.</p>
              </div>
              {loading ? (
                <div className="divide-y divide-white/10">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <div key={i} className="px-4 py-4 space-y-2.5 animate-pulse">
                      <div className="h-2 w-10 rounded bg-slate-800" />
                      <div className="h-3.5 w-44 rounded bg-slate-800" />
                      <div className="h-2 w-28 rounded bg-slate-800" />
                    </div>
                  ))}
                </div>
              ) : runs.length === 0 ? (
                <p className="px-4 py-6 text-sm text-slate-500">No persisted runs yet.</p>
              ) : (
                <div className="divide-y divide-white/10">
                  {runs.map((run, idx) => {
                    const isActive = selected?.id === run.id;
                    const verdict = run.critic_verdict ?? "unknown";
                    const stagger = `stagger-${Math.min(idx + 1, 7)}`;
                    return (
                      <button
                        key={run.id}
                        onClick={() => openRun(run)}
                        className={`w-full px-4 py-4 text-left transition-colors hover:bg-white/[0.04] ${stagger} ${isActive ? "bg-violet-500/10" : ""}`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="font-mono text-xs text-slate-500">#{run.id}</p>
                            <p className="mt-1 text-sm font-medium">{run.scenario}</p>
                            <p className="text-xs text-slate-400">target {run.target_date ?? "-"}</p>
                          </div>
                          <span className={`rounded-full border px-2 py-1 text-xs ${VERDICT_COLOR[verdict] ?? VERDICT_COLOR.unknown}`}>
                            {verdict}
                          </span>
                        </div>
                        <div className="mt-3 flex items-center justify-between text-xs text-slate-500">
                          <span>{run.status}</span>
                          <span>{run.critic_score == null ? "--" : `${Math.round(run.critic_score * 100)} / 100`}</span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </section>

          <section className="space-y-5 xl:col-span-7">
            {!selected ? (
              <div className="rounded-lg border border-white/10 bg-white/[0.03] px-5 py-8 text-sm text-slate-500">
                Select a run to inspect its audit detail.
              </div>
            ) : (
              <>
                <div className="rounded-lg border border-white/10 bg-white/[0.03] p-5">
                  <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                    <div>
                      <p className="font-mono text-xs uppercase tracking-[0.18em] text-slate-500">
                        run #{selected.id}
                      </p>
                      <h2 className="mt-2 text-xl font-semibold">{selected.scenario}</h2>
                      <p className="mt-1 text-sm text-slate-400">
                        target {selected.target_date ?? "-"} | generated {selected.generated_at ?? "-"}
                      </p>
                    </div>
                    <span className={`rounded-full border px-3 py-1 text-sm ${VERDICT_COLOR[selected.critic_verdict ?? "unknown"] ?? VERDICT_COLOR.unknown}`}>
                      {selected.critic_verdict ?? "unknown"}
                    </span>
                  </div>
                  <div className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-4">
                    <Metric label="status" value={selected.status} />
                    <Metric label="score" value={selected.critic_score == null ? "--" : `${Math.round(selected.critic_score * 100)} / 100`} />
                    <Metric label="decision log" value={selected.decision_log_id ?? "--"} />
                    <Metric label="run id" value={selected.id} />
                  </div>
                </div>

                <div className="rounded-lg border border-white/10 bg-white/[0.03] p-5">
                  <h3 className="text-sm font-semibold">Critic Notes</h3>
                  <p className="mt-2 text-sm leading-6 text-slate-300">
                    {selected.critic?.notes ?? "No critic notes recorded."}
                  </p>

                  {selected.critic?.cost_analysis && (
                    <div className="mt-4 rounded-lg border border-cyan-400/10 bg-cyan-500/5 p-4">
                      <p className="text-xs font-mono uppercase tracking-[0.16em] text-cyan-200">
                        cost-aware scoring
                      </p>
                      <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-3">
                        <Metric
                          label="cost pressure"
                          value={`${Math.round(selected.critic.cost_analysis.cost_pressure_score * 100)} / 100`}
                        />
                        <Metric
                          label="benefit"
                          value={`${Math.round(selected.critic.cost_analysis.benefit_score * 100)} / 100`}
                        />
                        <Metric
                          label="tradeoff"
                          value={`${Math.round(selected.critic.cost_analysis.tradeoff_score * 100)} / 100`}
                        />
                      </div>

                      {!!Object.keys(selected.critic.cost_analysis.pressure_components ?? {}).length && (
                        <div className="mt-4">
                          <p className="text-xs font-mono uppercase tracking-[0.16em] text-slate-500">
                            pressure components
                          </p>
                          <div className="mt-2 flex flex-wrap gap-2">
                            {Object.entries(selected.critic.cost_analysis.pressure_components ?? {}).map(([label, value]) => (
                              <span
                                key={label}
                                className="rounded-full border border-white/10 bg-slate-950/40 px-3 py-1 text-xs text-slate-300"
                              >
                                {label} {Math.round(value * 100)}/100
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

                      {selected.critic.cost_analysis.tradeoff_notes?.length ? (
                        <div className="mt-4">
                          <p className="text-xs font-mono uppercase tracking-[0.16em] text-slate-500">
                            tradeoff notes
                          </p>
                          <ul className="mt-2 space-y-2 text-sm text-slate-300">
                            {selected.critic.cost_analysis.tradeoff_notes.map((note) => (
                              <li key={note} className="rounded-lg border border-white/10 bg-slate-950/40 px-3 py-2">
                                {note}
                              </li>
                            ))}
                          </ul>
                        </div>
                      ) : null}
                    </div>
                  )}

                  {!!Object.keys(selected.critic?.dimension_scores ?? {}).length && (
                    <div className="mt-4">
                      <p className="text-xs font-mono uppercase tracking-[0.16em] text-slate-500">
                        dimension scores
                      </p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {Object.entries(selected.critic?.dimension_scores ?? {}).map(([label, value]) => (
                          <span
                            key={label}
                            className="rounded-full border border-white/10 bg-slate-950/40 px-3 py-1 text-xs text-slate-300"
                          >
                            {label} {Math.round(value * 100)}/100
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {selected.critic?.revision_reasons?.length ? (
                    <div className="mt-4">
                      <p className="text-xs font-mono uppercase tracking-[0.16em] text-slate-500">
                        revision reasons
                      </p>
                      <ul className="mt-2 space-y-2 text-sm text-slate-300">
                        {selected.critic.revision_reasons.map((reason) => (
                          <li key={reason} className="rounded-lg border border-white/10 bg-slate-950/40 px-3 py-2">
                            {reason}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}

                  {selected.critic?.actionable_feedback?.length ? (
                    <div className="mt-4">
                      <p className="text-xs font-mono uppercase tracking-[0.16em] text-slate-500">
                        actionable feedback
                      </p>
                      <ul className="mt-2 space-y-2 text-sm text-slate-300">
                        {selected.critic.actionable_feedback.map((item) => (
                          <li key={item} className="rounded-lg border border-cyan-400/10 bg-cyan-500/5 px-3 py-2">
                            {item}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}

                  {selected.critic?.sanity_checks && (
                    <div className="mt-4 rounded-lg border border-white/10 bg-slate-950/40 p-3">
                      <p className="text-xs font-mono uppercase tracking-[0.16em] text-slate-500">
                        sanity checks
                      </p>
                      <p className="mt-1 text-sm text-slate-300">
                        {selected.critic.sanity_checks.summary ?? "No summary"}
                      </p>
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  {selectedAgents.map(([name, value]) => (
                    <div key={name} className="rounded-lg border border-white/10 bg-white/[0.03] p-4">
                      <p className="font-mono text-xs uppercase tracking-[0.16em] text-slate-500">
                        {name}
                      </p>
                      <div className="mt-3 rounded-lg border border-white/5 bg-slate-950/60 overflow-hidden">
                        <div className="flex items-center justify-between px-3 py-1.5 border-b border-white/5 bg-slate-900/60">
                          <span className="font-mono text-[10px] uppercase tracking-widest text-slate-600">json</span>
                          <span className="font-mono text-[10px] text-slate-700">{name}</span>
                        </div>
                        <pre className="max-h-48 overflow-y-auto p-3 whitespace-pre-wrap text-xs leading-5 text-slate-300">
                          {JSON.stringify(value, null, 2)}
                        </pre>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="rounded-lg border border-white/10 bg-white/[0.03] p-5">
                  <h3 className="text-sm font-semibold">RAG Context</h3>
                  <div className="mt-3 rounded-lg border border-white/5 bg-slate-950/60 overflow-hidden">
                    <div className="flex items-center justify-between px-3 py-1.5 border-b border-white/5 bg-slate-900/60">
                      <span className="font-mono text-[10px] uppercase tracking-widest text-slate-600">json</span>
                      <span className="font-mono text-[10px] text-slate-700">rag_context</span>
                    </div>
                    <pre className="max-h-48 overflow-y-auto p-3 whitespace-pre-wrap text-xs leading-5 text-slate-300">
                      {JSON.stringify(selected.rag_context ?? {}, null, 2)}
                    </pre>
                  </div>
                </div>
              </>
            )}
          </section>
        </div>
      </div>
    </main>
  );
}

function Metric({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-lg border border-white/10 bg-slate-950/40 p-3">
      <p className="text-[10px] font-mono uppercase tracking-[0.16em] text-slate-500">
        {label}
      </p>
      <p className="mt-1 text-sm font-semibold text-slate-100">{value}</p>
    </div>
  );
}
