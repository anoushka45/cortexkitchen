"use client";

import { ReactNode } from "react";
import { CriticResult } from "@/types/planning";

const VERDICT_CONFIG: Record<string, { chipColor: string; chipBg: string; scoreColor: string; gradientStop: string }> = {
  approved: { chipColor: "text-emerald-300", chipBg: "ring-emerald-400/30 bg-emerald-500/[0.08]", scoreColor: "#34d399", gradientStop: "#6ee7b7" },
  rejected:  { chipColor: "text-rose-300",    chipBg: "ring-rose-400/30 bg-rose-500/[0.08]",       scoreColor: "#fb7185", gradientStop: "#fda4af" },
  revision:  { chipColor: "text-ember-300",   chipBg: "ring-ember-400/30 bg-ember-500/[0.08]",     scoreColor: "#efa345", gradientStop: "#f5be73" },
  unknown:   { chipColor: "text-slate-400",   chipBg: "ring-white/10 bg-white/[0.04]",             scoreColor: "#94a3b8", gradientStop: "#cbd5e1" },
};

const VERDICT_LABEL: Record<string, string> = {
  approved: "Plan approved",
  rejected: "Plan blocked",
  revision: "Needs review",
  unknown:  "Verdict pending",
};

const CHIP_LABEL: Record<string, string> = {
  approved: "ready to brief",
  rejected: "do not execute",
  revision: "review required",
  unknown:  "pending",
};

const DIMENSIONS = ["safety", "feasibility", "evidence", "actionability", "clarity"] as const;

interface Props {
  critic:      CriticResult;
  generatedAt: string;
  targetDate:  string | null;
  actions?:    ReactNode;
}

export default function CriticBanner({ critic, generatedAt, targetDate, actions }: Props) {
  const config     = VERDICT_CONFIG[critic.verdict] ?? VERDICT_CONFIG.unknown;
  const scorePct   = Math.round(critic.score * 100);
  const circumference = 2 * Math.PI * 52;
  const dashOffset    = circumference - (scorePct / 100) * circumference;

  const formattedTime = (() => {
    try { return new Date(generatedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }); }
    catch { return "--:--"; }
  })();

  const dims = critic.dimension_scores ?? {};
  const runCost = (critic as unknown as Record<string, unknown>).total_cost_usd;

  return (
    <div className="stagger-1 relative overflow-hidden rounded-3xl bg-gradient-to-br from-ink-900 to-ink-850 p-7 ring-1 ring-white/[0.07]">
      {/* Top accent line */}
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-emerald-400/40 to-transparent" />

      <div className="grid grid-cols-1 gap-8 xl:grid-cols-12 xl:items-start">

        {/* ── Left: verdict ── */}
        <div className="xl:col-span-5">
          <div className="flex items-center gap-2">
            <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-emerald-300/80">Critic verdict</span>
            {critic.decision_log_id && (
              <span className="font-mono text-[10px] text-white/35">#{critic.decision_log_id}</span>
            )}
          </div>

          <div className="mt-3 flex items-baseline gap-4">
            <h1 className="text-[40px] font-semibold leading-none tracking-[-0.015em] text-white">
              {VERDICT_LABEL[critic.verdict] ?? "Verdict pending"}
            </h1>
            <span className={`rounded-full px-3 py-1 font-mono text-[11px] uppercase tracking-wider ring-1 chip-dot ${config.chipColor} ${config.chipBg}`}>
              {CHIP_LABEL[critic.verdict] ?? "pending"}
            </span>
          </div>

          {critic.notes && (
            <p className="mt-4 max-w-lg text-[14px] leading-[1.7] text-white/65">{critic.notes}</p>
          )}

          <div className="mt-5 flex flex-wrap items-center gap-5 font-mono text-[10px] uppercase tracking-[0.18em] text-white/40">
            <span>Generated <span className="text-white/75">{formattedTime}</span></span>
            {targetDate && <span>Target <span className="text-white/75">{targetDate}</span></span>}
            {typeof runCost === "number" && <span>Run <span className="text-white/75">${runCost.toFixed(3)}</span></span>}
          </div>

          {actions && <div className="mt-5">{actions}</div>}
        </div>

        {/* ── Middle: dimension breakdown ── */}
        <div className="xl:col-span-4">
          <div className="mb-3 font-mono text-[10px] uppercase tracking-[0.22em] text-white/40">Score breakdown</div>
          <div className="space-y-2.5">
            {DIMENSIONS.map((dim) => {
              const raw = typeof dims[dim] === "number" ? dims[dim] : 0;
              const pct = Math.round(raw * 100);
              const scoreColor = pct >= 75 ? "text-emerald-300" : pct >= 50 ? "text-ember-300" : "text-rose-300";
              return (
                <div key={dim}>
                  <div className="flex justify-between text-[11px] text-white/60">
                    <span className="capitalize">{dim}</span>
                    <span className={`font-mono font-semibold ${scoreColor}`}>{pct}</span>
                  </div>
                  <div className="meter mt-1">
                    <span
                      style={{
                        width: `${pct}%`,
                        background: pct < 50
                          ? "linear-gradient(90deg,#fb7185,#f43f5e)"
                          : pct < 75
                          ? "linear-gradient(90deg,#f5be73,#efa345)"
                          : "linear-gradient(90deg,#6ee7b7,#34d399)",
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* ── Right: ring gauge ── */}
        <div className="flex flex-col items-center justify-center xl:col-span-3">
          <div className="relative">
            <svg viewBox="0 0 120 120" className="h-[160px] w-[160px] -rotate-90">
              <defs>
                <linearGradient id="scoreGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor={config.gradientStop} />
                  <stop offset="100%" stopColor={config.scoreColor} />
                </linearGradient>
              </defs>
              <circle cx="60" cy="60" r="52" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={6} />
              <circle
                cx="60" cy="60" r="52"
                fill="none"
                stroke="url(#scoreGrad)"
                strokeWidth={6}
                strokeLinecap="round"
                strokeDasharray={circumference}
                strokeDashoffset={dashOffset}
                style={{ transition: "stroke-dashoffset 1.2s cubic-bezier(0.4,0,0.2,1)" }}
              />
            </svg>
            <div className="absolute inset-0 grid place-items-center">
              <div className="text-center">
                <div className="num-display text-5xl leading-none text-white">{(critic.score).toFixed(2)}</div>
                <div className="mt-1 font-mono text-[9px] uppercase tracking-[0.22em] text-white/45">overall</div>
              </div>
            </div>
          </div>
          <a href="#" className="mt-3 font-mono text-[10px] uppercase tracking-[0.18em] text-emerald-300/80 transition-colors hover:text-emerald-200">
            View reasoning -&gt;
          </a>
        </div>

      </div>
    </div>
  );
}
