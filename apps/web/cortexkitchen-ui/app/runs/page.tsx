"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Area, AreaChart, CartesianGrid, ResponsiveContainer,
  Tooltip, XAxis, YAxis,
} from "recharts";
import { getPlanningRun, listPlanningRuns } from "@/lib/api";
import { PlanningRunDetail, PlanningRunSummary } from "@/types/planning";

// ── Constants ────────────────────────────────────────────────────────────────

const SCENARIOS = [
  { value: "", label: "All scenarios" },
  { value: "friday_rush",       label: "Friday Rush" },
  { value: "weekday_lunch",     label: "Weekday Lunch" },
  { value: "holiday_spike",     label: "Holiday Spike" },
  { value: "low_stock_weekend", label: "Low-Stock Weekend" },
];

const VERDICTS = [
  { value: "", label: "All verdicts" },
  { value: "approved", label: "Approved" },
  { value: "revision", label: "Revision" },
  { value: "rejected", label: "Rejected" },
];

const VERDICT_STYLE: Record<string, string> = {
  approved: "text-emerald-300 border-emerald-500/30 bg-emerald-500/10",
  rejected: "text-rose-300   border-rose-500/30   bg-rose-500/10",
  revision: "text-amber-300  border-amber-500/30  bg-amber-500/10",
  unknown:  "text-slate-300  border-slate-600/40  bg-slate-800/50",
};

const VERDICT_DOT: Record<string, string> = {
  approved: "#34d399",
  revision: "#fbbf24",
  rejected: "#f87171",
  unknown:  "#94a3b8",
};

const DIMENSIONS = ["safety", "feasibility", "evidence", "actionability", "clarity"];

// ── Trend chart ───────────────────────────────────────────────────────────────

function TrendChart({ runs }: { runs: PlanningRunSummary[] }) {
  const data = [...runs]
    .reverse()
    .filter(r => r.critic_score != null)
    .map(r => ({
      label: `#${r.id}`,
      score: Math.round((r.critic_score ?? 0) * 100),
      verdict: r.critic_verdict ?? "unknown",
      scenario: r.scenario,
    }));

  if (data.length < 2) return (
    <p className="text-xs text-slate-500 px-1">Need at least 2 runs to show trend.</p>
  );

  return (
    <ResponsiveContainer width="100%" height={140}>
      <AreaChart data={data} margin={{ top: 4, right: 8, bottom: 0, left: -16 }}>
        <defs>
          <linearGradient id="scoreGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%"  stopColor="#818cf8" stopOpacity={0.25} />
            <stop offset="95%" stopColor="#818cf8" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
        <XAxis dataKey="label" tick={{ fontSize: 10, fill: "#64748b" }} />
        <YAxis domain={[0, 100]} tick={{ fontSize: 10, fill: "#64748b" }} />
        <Tooltip
          contentStyle={{ background: "#0f172a", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, fontSize: 12 }}
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          formatter={(v: any, _: any, props: any) => [
            `${v}/100`,
            `${props.payload?.scenario ?? ""} · ${props.payload?.verdict ?? ""}`,
          ]}
          labelStyle={{ color: "#94a3b8" }}
        />
        <Area
          type="monotone"
          dataKey="score"
          stroke="#818cf8"
          strokeWidth={2}
          fill="url(#scoreGrad)"
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          dot={(props: any) => (
            <circle
              key={`dot-${props.cx}-${props.cy}`}
              cx={props.cx ?? 0} cy={props.cy ?? 0} r={4}
              fill={VERDICT_DOT[props.payload?.verdict ?? "unknown"]}
              stroke="#0f172a" strokeWidth={2}
            />
          )}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

// ── Diff modal ────────────────────────────────────────────────────────────────

function DiffModal({
  runA, runB, onClose,
}: {
  runA: PlanningRunDetail;
  runB: PlanningRunDetail;
  onClose: () => void;
}) {
  const dimA = runA.critic?.dimension_scores ?? {};
  const dimB = runB.critic?.dimension_scores ?? {};

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="w-full max-w-3xl rounded-xl border border-white/10 bg-[#0b1628] shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between border-b border-white/10 px-6 py-4">
          <h2 className="text-sm font-semibold">Run Comparison</h2>
          <button onClick={onClose} className="text-slate-500 hover:text-white text-lg leading-none">✕</button>
        </div>

        {/* Summary row */}
        <div className="grid grid-cols-2 gap-px bg-white/5 border-b border-white/10">
          {[runA, runB].map((run, i) => (
            <div key={i} className="bg-[#0b1628] px-6 py-4">
              <p className="font-mono text-xs text-slate-500">Run #{run.id}</p>
              <p className="mt-1 text-sm font-medium">{run.scenario.replace(/_/g, " ")}</p>
              <div className="mt-2 flex items-center gap-3">
                <span className={`rounded-full border px-2 py-0.5 text-xs ${VERDICT_STYLE[run.critic_verdict ?? "unknown"]}`}>
                  {run.critic_verdict ?? "unknown"}
                </span>
                <span className="text-sm font-bold text-white">
                  {run.critic_score != null ? `${Math.round(run.critic_score * 100)}/100` : "--"}
                </span>
              </div>
              <p className="mt-1 text-xs text-slate-500">target {run.target_date ?? "-"}</p>
            </div>
          ))}
        </div>

        {/* Dimension comparison */}
        <div className="px-6 py-5 space-y-4">
          <p className="text-xs font-mono uppercase tracking-[0.16em] text-slate-500">Critic Dimension Scores</p>
          {DIMENSIONS.map(dim => {
            const a = (dimA[dim] ?? 0) * 100;
            const b = (dimB[dim] ?? 0) * 100;
            const diff = a - b;
            return (
              <div key={dim} className="space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="capitalize text-slate-400">{dim}</span>
                  <span className={`font-mono ${diff > 3 ? "text-emerald-400" : diff < -3 ? "text-rose-400" : "text-slate-500"}`}>
                    {diff > 0 ? "+" : ""}{Math.round(diff)}
                  </span>
                </div>
                <div className="flex gap-2 items-center">
                  {/* Run A bar */}
                  <div className="flex-1 h-2 rounded-full bg-slate-800 overflow-hidden">
                    <div className="h-full rounded-full bg-violet-500" style={{ width: `${a}%` }} />
                  </div>
                  <div className="w-16 text-center">
                    <span className="text-xs text-slate-400 font-mono">
                      {Math.round(a)} <span className="text-slate-600">vs</span> {Math.round(b)}
                    </span>
                  </div>
                  {/* Run B bar */}
                  <div className="flex-1 h-2 rounded-full bg-slate-800 overflow-hidden">
                    <div className="h-full rounded-full bg-cyan-500" style={{ width: `${b}%` }} />
                  </div>
                </div>
              </div>
            );
          })}

          <div className="flex items-center gap-4 pt-2 text-xs text-slate-500">
            <span className="flex items-center gap-1.5"><span className="w-3 h-1.5 rounded-full bg-violet-500 inline-block" /> Run #{runA.id}</span>
            <span className="flex items-center gap-1.5"><span className="w-3 h-1.5 rounded-full bg-cyan-500 inline-block" /> Run #{runB.id}</span>
          </div>
        </div>

        {/* Revision reasons diff */}
        {(runA.critic?.revision_reasons?.length || runB.critic?.revision_reasons?.length) ? (
          <div className="grid grid-cols-2 gap-px bg-white/5 border-t border-white/10">
            {[runA, runB].map((run, i) => (
              <div key={i} className="bg-[#0b1628] px-6 py-4">
                <p className="text-xs font-mono uppercase tracking-[0.16em] text-slate-500 mb-2">Revision reasons</p>
                {run.critic?.revision_reasons?.length ? (
                  <ul className="space-y-1.5">
                    {run.critic.revision_reasons.map((r, j) => (
                      <li key={j} className="text-xs text-amber-300/80 bg-amber-500/5 border border-amber-500/10 rounded px-2 py-1.5">{r}</li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-xs text-slate-600">None</p>
                )}
              </div>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function RunsPage() {
  const [runs,     setRuns]     = useState<PlanningRunSummary[]>([]);
  const [selected, setSelected] = useState<PlanningRunDetail | null>(null);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState<string | null>(null);

  // Filter state
  const [filterScenario, setFilterScenario] = useState("");
  const [filterVerdict,  setFilterVerdict]  = useState("");
  const [filterFrom,     setFilterFrom]     = useState("");
  const [filterTo,       setFilterTo]       = useState("");
  const [showChart,      setShowChart]      = useState(true);

  // Compare state
  const [compareIds, setCompareIds]             = useState<number[]>([]);
  const [diffRuns,   setDiffRuns]               = useState<[PlanningRunDetail, PlanningRunDetail] | null>(null);
  const [diffLoading, setDiffLoading]           = useState(false);

  useEffect(() => {
    async function load() {
      try {
        setLoading(true);
        const rows = await listPlanningRuns(50);
        setRuns(rows);
        if (rows[0]) setSelected(await getPlanningRun(rows[0].id));
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unable to load runs");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  // Client-side filtering
  const filteredRuns = useMemo(() => {
    return runs.filter(r => {
      if (filterScenario && r.scenario !== filterScenario) return false;
      if (filterVerdict  && r.critic_verdict !== filterVerdict) return false;
      if (filterFrom && r.created_at && r.created_at < filterFrom) return false;
      if (filterTo   && r.created_at && r.created_at.slice(0, 10) > filterTo) return false;
      return true;
    });
  }, [runs, filterScenario, filterVerdict, filterFrom, filterTo]);

  const selectedAgents = useMemo(() => {
    const recs = selected?.final_response?.recommendations;
    if (!recs) return [];
    return Object.entries(recs);
  }, [selected]);

  function toggleCompare(id: number) {
    setCompareIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : prev.length < 2 ? [...prev, id] : [prev[1], id]
    );
  }

  async function openDiff() {
    if (compareIds.length !== 2) return;
    setDiffLoading(true);
    try {
      const [a, b] = await Promise.all([getPlanningRun(compareIds[0]), getPlanningRun(compareIds[1])]);
      setDiffRuns([a, b]);
    } finally {
      setDiffLoading(false);
    }
  }

  const selectEl = "rounded-lg border border-white/10 bg-slate-950/60 px-2.5 py-1.5 text-xs text-slate-300 focus:outline-none focus:ring-1 focus:ring-violet-500/50";

  return (
    <main className="min-h-screen bg-[#09111f] px-5 py-6 text-slate-100 xl:px-8">
      <div className="mx-auto max-w-[1520px] space-y-5">

        {/* Header */}
        <header className="flex flex-col gap-4 border-b border-white/10 pb-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-mono uppercase tracking-[0.22em] text-violet-300">audit trail</p>
            <h1 className="mt-2 text-2xl font-semibold tracking-tight">Runs</h1>
            <p className="mt-1 max-w-2xl text-sm text-slate-400">
              Persisted planning runs with critic verdicts, agent outputs, RAG context, and trace metadata.
            </p>
          </div>
          <div className="text-sm text-slate-500">
            {filteredRuns.length} of {runs.length} runs
          </div>
        </header>

        {error && (
          <div className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">{error}</div>
        )}

        {/* Filter bar */}
        <div className="flex flex-wrap items-center gap-3">
          <select value={filterScenario} onChange={e => setFilterScenario(e.target.value)} className={selectEl}>
            {SCENARIOS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
          <select value={filterVerdict} onChange={e => setFilterVerdict(e.target.value)} className={selectEl}>
            {VERDICTS.map(v => <option key={v.value} value={v.value}>{v.label}</option>)}
          </select>
          <div className="flex items-center gap-1.5 text-xs text-slate-500">
            <span>from</span>
            <input type="date" value={filterFrom} onChange={e => setFilterFrom(e.target.value)}
              className={selectEl + " w-36"} />
            <span>to</span>
            <input type="date" value={filterTo} onChange={e => setFilterTo(e.target.value)}
              className={selectEl + " w-36"} />
          </div>
          {(filterScenario || filterVerdict || filterFrom || filterTo) && (
            <button onClick={() => { setFilterScenario(""); setFilterVerdict(""); setFilterFrom(""); setFilterTo(""); }}
              className="text-xs text-slate-500 hover:text-white underline">
              clear
            </button>
          )}
          <div className="ml-auto flex items-center gap-2">
            <button onClick={() => setShowChart(v => !v)}
              className="text-xs border border-white/10 rounded-lg px-2.5 py-1.5 text-slate-400 hover:text-white hover:bg-white/5 transition-colors">
              {showChart ? "Hide" : "Show"} trend
            </button>
            {compareIds.length === 2 && (
              <button onClick={openDiff} disabled={diffLoading}
                className="text-xs bg-violet-600 hover:bg-violet-500 disabled:opacity-50 rounded-lg px-3 py-1.5 text-white font-medium transition-colors">
                {diffLoading ? "Loading…" : "Compare (2)"}
              </button>
            )}
            {compareIds.length > 0 && (
              <button onClick={() => setCompareIds([])}
                className="text-xs text-slate-500 hover:text-white underline">
                clear selection
              </button>
            )}
          </div>
        </div>

        {/* Trend chart */}
        {showChart && (
          <div className="rounded-lg border border-white/10 bg-white/[0.03] p-4">
            <p className="text-xs font-mono uppercase tracking-[0.16em] text-slate-500 mb-3">
              Critic Score Trend
              <span className="ml-3 normal-case text-slate-600">
                · <span className="text-emerald-400">●</span> approved
                <span className="text-amber-400"> ●</span> revision
                <span className="text-rose-400"> ●</span> rejected
              </span>
            </p>
            <TrendChart runs={filteredRuns} />
          </div>
        )}

        {/* Main split */}
        <div className="grid grid-cols-1 gap-5 xl:grid-cols-12">

          {/* Run list */}
          <section className="xl:col-span-4">
            <div className="overflow-hidden rounded-lg border border-white/10 bg-white/[0.03]">
              <div className="border-b border-white/10 px-4 py-3 flex items-center justify-between">
                <div>
                  <h2 className="text-sm font-semibold">Run History</h2>
                  <p className="text-xs text-slate-500">Newest first. Check two to compare.</p>
                </div>
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
              ) : filteredRuns.length === 0 ? (
                <p className="px-4 py-6 text-sm text-slate-500">No runs match the current filters.</p>
              ) : (
                <div className="divide-y divide-white/10 max-h-[600px] overflow-y-auto">
                  {filteredRuns.map(run => {
                    const isActive   = selected?.id === run.id;
                    const isCompared = compareIds.includes(run.id);
                    const verdict    = run.critic_verdict ?? "unknown";
                    return (
                      <div key={run.id}
                        className={`flex items-start gap-2 px-3 py-3 transition-colors hover:bg-white/[0.04] ${isActive ? "bg-violet-500/10" : ""}`}>
                        {/* Compare checkbox */}
                        <button
                          onClick={() => toggleCompare(run.id)}
                          className={`mt-0.5 w-4 h-4 rounded border flex-shrink-0 flex items-center justify-center transition-colors ${
                            isCompared
                              ? "bg-violet-500 border-violet-500 text-white"
                              : "border-slate-700 hover:border-violet-500"
                          }`}
                          title="Select to compare"
                        >
                          {isCompared && <span className="text-[10px] leading-none">✓</span>}
                        </button>

                        {/* Run info */}
                        <button onClick={() => getPlanningRun(run.id).then(setSelected)}
                          className="flex-1 text-left min-w-0">
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <p className="font-mono text-xs text-slate-500">#{run.id}</p>
                              <p className="mt-0.5 text-sm font-medium truncate">{run.scenario.replace(/_/g, " ")}</p>
                              <p className="text-xs text-slate-400">target {run.target_date ?? "-"}</p>
                            </div>
                            <span className={`rounded-full border px-2 py-0.5 text-xs shrink-0 ${VERDICT_STYLE[verdict]}`}>
                              {verdict}
                            </span>
                          </div>
                          <div className="mt-2 flex items-center justify-between text-xs text-slate-500">
                            <span>{run.status}</span>
                            <span>{run.critic_score == null ? "--" : `${Math.round(run.critic_score * 100)}/100`}</span>
                          </div>
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </section>

          {/* Run detail */}
          <section className="space-y-5 xl:col-span-8">
            {!selected ? (
              <div className="rounded-lg border border-white/10 bg-white/[0.03] px-5 py-8 text-sm text-slate-500">
                Select a run to inspect its audit detail.
              </div>
            ) : (
              <>
                <div className="rounded-lg border border-white/10 bg-white/[0.03] p-5">
                  <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                    <div>
                      <p className="font-mono text-xs uppercase tracking-[0.18em] text-slate-500">run #{selected.id}</p>
                      <h2 className="mt-2 text-xl font-semibold">{selected.scenario.replace(/_/g, " ")}</h2>
                      <p className="mt-1 text-sm text-slate-400">
                        target {selected.target_date ?? "-"} · generated {selected.generated_at?.slice(0, 10) ?? "-"}
                      </p>
                    </div>
                    <span className={`rounded-full border px-3 py-1 text-sm ${VERDICT_STYLE[selected.critic_verdict ?? "unknown"]}`}>
                      {selected.critic_verdict ?? "unknown"}
                    </span>
                  </div>
                  <div className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-4">
                    <Metric label="status" value={selected.status} />
                    <Metric label="score" value={selected.critic_score == null ? "--" : `${Math.round(selected.critic_score * 100)}/100`} />
                    <Metric label="run id" value={selected.metadata?.run_id as string ?? "--"} />
                    <Metric label="tokens" value={selected.metadata?.total_tokens as number ?? "--"} />
                  </div>
                  {selected.metadata?.total_cost_usd != null && (
                    <p className="mt-2 text-xs text-slate-500">
                      Cost: <span className="text-slate-300">${(selected.metadata.total_cost_usd as number).toFixed(5)}</span>
                      {selected.metadata?.total_duration_ms != null && (
                        <span className="ml-3">Duration: <span className="text-slate-300">{Math.round(selected.metadata.total_duration_ms as number)}ms</span></span>
                      )}
                    </p>
                  )}
                </div>

                <div className="rounded-lg border border-white/10 bg-white/[0.03] p-5">
                  <h3 className="text-sm font-semibold">Critic Notes</h3>
                  <p className="mt-2 text-sm leading-6 text-slate-300">{selected.critic?.notes ?? "No critic notes recorded."}</p>

                  {!!Object.keys(selected.critic?.dimension_scores ?? {}).length && (
                    <div className="mt-5 space-y-3">
                      <p className="text-xs font-mono uppercase tracking-[0.16em] text-slate-500">Dimension Scores</p>
                      {DIMENSIONS.map(dim => {
                        const score = ((selected.critic?.dimension_scores ?? {})[dim] ?? 0) * 100;
                        const color = score >= 75 ? "bg-emerald-500" : score >= 50 ? "bg-amber-500" : "bg-rose-500";
                        return (
                          <div key={dim}>
                            <div className="flex justify-between text-xs mb-1">
                              <span className="capitalize text-slate-400">{dim}</span>
                              <span className="text-slate-300 font-mono">{Math.round(score)}/100</span>
                            </div>
                            <div className="h-1.5 rounded-full bg-slate-800 overflow-hidden">
                              <div className={`h-full rounded-full transition-all ${color}`} style={{ width: `${score}%` }} />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {selected.critic?.revision_reasons?.length ? (
                    <div className="mt-5">
                      <p className="text-xs font-mono uppercase tracking-[0.16em] text-slate-500">Revision Reasons</p>
                      <ul className="mt-2 space-y-2 text-sm text-slate-300">
                        {selected.critic.revision_reasons.map((r, i) => (
                          <li key={i} className="rounded-lg border border-white/10 bg-slate-950/40 px-3 py-2">{r}</li>
                        ))}
                      </ul>
                    </div>
                  ) : null}

                  {selected.critic?.actionable_feedback?.length ? (
                    <div className="mt-5">
                      <p className="text-xs font-mono uppercase tracking-[0.16em] text-slate-500">Actionable Feedback</p>
                      <ul className="mt-2 space-y-2 text-sm text-slate-300">
                        {selected.critic.actionable_feedback.map((item, i) => (
                          <li key={i} className="rounded-lg border border-cyan-400/10 bg-cyan-500/5 px-3 py-2">{item}</li>
                        ))}
                      </ul>
                    </div>
                  ) : null}

                  {selected.critic?.cost_analysis && (
                    <div className="mt-5 rounded-lg border border-cyan-400/10 bg-cyan-500/5 p-4">
                      <p className="text-xs font-mono uppercase tracking-[0.16em] text-cyan-200">Cost-Aware Scoring</p>
                      <div className="mt-3 grid grid-cols-3 gap-3">
                        <Metric label="cost pressure" value={`${Math.round(selected.critic.cost_analysis.cost_pressure_score * 100)}/100`} />
                        <Metric label="benefit"       value={`${Math.round(selected.critic.cost_analysis.benefit_score * 100)}/100`} />
                        <Metric label="tradeoff"      value={`${Math.round(selected.critic.cost_analysis.tradeoff_score * 100)}/100`} />
                      </div>
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  {selectedAgents.map(([name, value]) => (
                    <div key={name} className="rounded-lg border border-white/10 bg-white/[0.03] p-4">
                      <p className="font-mono text-xs uppercase tracking-[0.16em] text-slate-500">{name}</p>
                      <div className="mt-3 rounded-lg border border-white/5 bg-slate-950/60 overflow-hidden">
                        <pre className="max-h-48 overflow-y-auto p-3 whitespace-pre-wrap text-xs leading-5 text-slate-300">
                          {JSON.stringify(value, null, 2)}
                        </pre>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </section>
        </div>
      </div>

      {/* Diff modal */}
      {diffRuns && (
        <DiffModal runA={diffRuns[0]} runB={diffRuns[1]} onClose={() => setDiffRuns(null)} />
      )}
    </main>
  );
}

function Metric({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-lg border border-white/10 bg-slate-950/40 p-3">
      <p className="text-[10px] font-mono uppercase tracking-[0.16em] text-slate-500">{label}</p>
      <p className="mt-1 text-sm font-semibold text-slate-100">{value}</p>
    </div>
  );
}
