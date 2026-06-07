"use client";

import { useEffect, useRef, useState } from "react";
import { runWhatIf, WhatIfResponse } from "@/lib/api";

interface Props {
  baseCovers: number;
  avgCovers: number;
  scenario: string;
  serviceWindow: string;
  defaultOpen?: boolean;
}

function ScoreBar({ label, value, color }: { label: string; value: number; color: string }) {
  const pct = Math.round(value * 100);
  return (
    <div>
      <div className="flex justify-between text-[11px] text-white/55 mb-1">
        <span className="capitalize">{label}</span>
        <span className={`font-mono font-semibold ${color}`}>{pct}</span>
      </div>
      <div className="meter">
        <span style={{
          width: `${pct}%`,
          background: pct >= 75
            ? "linear-gradient(90deg,#6ee7b7,#34d399)"
            : pct >= 50
            ? "linear-gradient(90deg,#f5be73,#efa345)"
            : "linear-gradient(90deg,#fb7185,#f43f5e)",
        }} />
      </div>
    </div>
  );
}

export default function WhatIfPanel({ baseCovers, avgCovers, scenario, serviceWindow, defaultOpen = false }: Props) {
  const [open,    setOpen]    = useState(defaultOpen);
  const [covers,  setCovers]  = useState(baseCovers);
  const [result,  setResult]  = useState<WhatIfResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const min = Math.max(1,   Math.round(baseCovers * 0.4));
  const max = Math.round(baseCovers * 2.2);

  useEffect(() => {
    setCovers(baseCovers);
    setResult(null);
  }, [baseCovers]);

  useEffect(() => {
    if (!open) return;
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await runWhatIf({ predicted_covers: covers, avg_covers: avgCovers, scenario, service_window: serviceWindow });
        setResult(res);
      } catch { /* silent */ }
      finally { setLoading(false); }
    }, 300);
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [covers, open, avgCovers, scenario, serviceWindow]);

  const diffPct = Math.round(((covers - baseCovers) / baseCovers) * 100);
  const diffLabel = diffPct === 0 ? "same as run" : diffPct > 0 ? `+${diffPct}% vs run` : `${diffPct}% vs run`;
  const diffColor = diffPct > 0 ? "text-ember-300" : diffPct < 0 ? "text-cyan-300" : "text-white/35";

  return (
    <div className={defaultOpen ? "" : "rounded-2xl border border-white/10 bg-white/[0.02]"}>
      {/* Header toggle — hidden when used inside modal (defaultOpen) */}
      {!defaultOpen && (
        <button
          onClick={() => setOpen(v => !v)}
          className="w-full flex items-center justify-between px-5 py-4 group"
        >
          <div className="flex items-center gap-3">
            <svg className="h-4 w-4 text-ember-400/70 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
            <div>
              <p className="text-sm font-semibold text-white text-left">What-if simulator</p>
              <p className="text-xs text-slate-500 text-left">Adjust cover count — instant cost &amp; demand re-score, no new run needed</p>
            </div>
          </div>
          <svg className={`h-4 w-4 text-slate-500 transition-transform duration-200 shrink-0 group-hover:text-slate-300 ${open ? "rotate-0" : "-rotate-90"}`}
            fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </button>
      )}

      {open && (
        <div className={`space-y-5 ${defaultOpen ? "" : "px-5 pb-5 border-t border-white/[0.06]"}`}>
          {/* Slider */}
          <div className="pt-4">
            <div className="flex items-baseline justify-between mb-3">
              <p className="text-[10px] font-mono uppercase tracking-[0.22em] text-slate-500">Predicted covers</p>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-semibold text-white leading-none">{covers}</span>
                <span className={`text-[11px] font-mono ${diffColor}`}>{diffLabel}</span>
              </div>
            </div>
            <input
              type="range"
              min={min}
              max={max}
              step={5}
              value={covers}
              onChange={e => setCovers(Number(e.target.value))}
              className="w-full accent-ember-400"
            />
            <div className="flex justify-between mt-1 font-mono text-[10px] text-slate-600">
              <span>{min}</span>
              <span className="text-white/25">baseline {Math.round(avgCovers)}</span>
              <span>{max}</span>
            </div>
          </div>

          {/* Results */}
          {loading && (
            <div className="flex items-center gap-2 text-[12px] text-slate-500">
              <span className="h-1.5 w-1.5 rounded-full bg-ember-400 animate-pulse" />
              Recalculating…
            </div>
          )}

          {!loading && result && (
            <div className="space-y-4">
              {/* Score strip */}
              <div className="grid grid-cols-3 gap-3">
                {[
                  { label: "Cost pressure", value: result.cost_pressure_score, color: result.cost_pressure_score >= 0.75 ? "text-rose-300" : result.cost_pressure_score >= 0.5 ? "text-ember-300" : "text-emerald-300" },
                  { label: "Benefit",       value: result.benefit_score,       color: result.benefit_score >= 0.75 ? "text-emerald-300" : result.benefit_score >= 0.5 ? "text-ember-300" : "text-rose-300" },
                  { label: "Tradeoff",      value: result.tradeoff_score,      color: result.tradeoff_score >= 0.75 ? "text-emerald-300" : result.tradeoff_score >= 0.5 ? "text-ember-300" : "text-rose-300" },
                ].map(({ label, value, color }) => (
                  <div key={label} className="rounded-lg bg-white/[0.025] ring-1 ring-white/[0.06] px-3 py-2.5">
                    <div className="font-mono text-[9px] uppercase tracking-[0.18em] text-white/40">{label}</div>
                    <div className={`mt-1 text-[22px] font-semibold leading-none ${color}`}>{Math.round(value * 100)}</div>
                  </div>
                ))}
              </div>

              {/* Demand ratio */}
              <div className="flex items-center gap-3 rounded-lg bg-white/[0.02] ring-1 ring-white/[0.05] px-4 py-2.5">
                <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-white/35">Demand ratio</span>
                <span className={`ml-auto font-mono text-sm font-semibold ${result.demand_ratio >= 1.2 ? "text-ember-300" : result.demand_ratio >= 0.8 ? "text-white" : "text-cyan-300"}`}>
                  {result.demand_ratio.toFixed(2)}×
                </span>
                <span className="text-[11px] text-white/30">vs historical avg</span>
              </div>

              {/* Score bars */}
              <div className="space-y-2.5">
                {Object.entries(result.pressure_components).map(([key, val]) => (
                  <ScoreBar
                    key={key}
                    label={key.replace(/_/g, " ")}
                    value={val}
                    color={val >= 0.75 ? "text-rose-300" : val >= 0.5 ? "text-ember-300" : "text-emerald-300"}
                  />
                ))}
              </div>

              {/* Focus notes */}
              {result.recommended_focus.length > 0 && (
                <div className="space-y-1.5">
                  <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-white/35">Focus for {covers} covers</p>
                  {result.recommended_focus.map((note, i) => (
                    <div key={i} className="rounded-lg ring-1 ring-ember-400/20 bg-ember-500/[0.04] px-3 py-2 text-[12px] text-white/65 leading-snug">
                      {note}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
