"use client";

import { ReactNode, useEffect, useState } from "react";
import Badge from "@/components/ui/Badge";
import { CriticResult } from "@/types/planning";

const VERDICT_CONFIG: Record<
  string,
  { glow: string; border: string; bg: string; label: string }
> = {
  approved: {
    glow: "shadow-glow-emerald",
    border: "border-emerald-500/30",
    bg: "from-emerald-950/40 to-navy-900",
    label: "Plan approved for execution",
  },
  rejected: {
    glow: "shadow-glow-rose",
    border: "border-rose-500/30",
    bg: "from-rose-950/40 to-navy-900",
    label: "Plan blocked - requires revision",
  },
  revision: {
    glow: "shadow-glow-amber",
    border: "border-amber-500/30",
    bg: "from-amber-950/30 to-navy-900",
    label: "Plan needs review before execution",
  },
  unknown: {
    glow: "",
    border: "border-slate-700",
    bg: "from-navy-800 to-navy-900",
    label: "Verdict pending",
  },
};

interface Props {
  critic: CriticResult;
  generatedAt: string;
  targetDate: string | null;
  actions?: ReactNode;
}

export default function CriticBanner({
  critic,
  generatedAt,
  targetDate,
  actions,
}: Props) {
  const [animatedScore, setAnimatedScore] = useState(0);
  const config = VERDICT_CONFIG[critic.verdict] ?? VERDICT_CONFIG.unknown;
  const scorePct = Math.round(critic.score * 100);
  const circumference = 2 * Math.PI * 45;

  useEffect(() => {
    setAnimatedScore(0);
    const timer = setTimeout(() => setAnimatedScore(scorePct), 150);
    return () => clearTimeout(timer);
  }, [scorePct, generatedAt]);

  const formattedTime = new Date(generatedAt).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });

  const scoreColor =
    scorePct >= 70 ? "#34d399" : scorePct >= 40 ? "#fbbf24" : "#fb7185";
  const topRevisionReasons = (critic.revision_reasons ?? []).slice(0, 2);

  return (
    <div
      className={`stagger-1 relative overflow-hidden rounded-2xl border bg-gradient-to-br p-6 ${config.bg} ${config.border}`}
    >
      <div
        className="pointer-events-none absolute inset-0 opacity-20"
        style={{
          background: `radial-gradient(ellipse at top left, ${scoreColor}22, transparent 60%)`,
        }}
      />

      <div className="relative flex items-start justify-between gap-6">
        <div className="min-w-0 flex-1">
          <div className="mb-3 flex items-center gap-2">
            <span className="text-xs font-mono uppercase tracking-widest text-slate-500">
              Critic Agent | Verdict
            </span>
            {critic.decision_log_id && (
              <span className="font-mono text-xs text-slate-600">#{critic.decision_log_id}</span>
            )}
          </div>

          <div className="mb-3 flex items-center gap-3">
            <Badge variant={critic.verdict} />
            <span className="text-sm text-slate-400">{config.label}</span>
          </div>

          {critic.notes && (
            <p className="mt-4 border-l-2 border-violet-500/40 pl-4 text-sm leading-relaxed text-slate-300">
              {critic.notes}
            </p>
          )}

          {topRevisionReasons.length ? (
            <div className="mt-4">
              <p className="text-xs font-mono uppercase tracking-widest text-slate-500">
                Needs Attention
              </p>
              <ul className="mt-2 space-y-2 text-sm text-slate-300">
                {topRevisionReasons.map((reason) => (
                  <li key={reason} className="rounded-lg border border-white/10 bg-slate-950/30 px-3 py-2">
                    {reason}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          <div className="mt-4 flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
            <p className="text-xs font-mono text-slate-600">
              Generated {formattedTime}
              {targetDate && (
                <>
                  {" "}
                  | Target <span className="text-slate-400">{targetDate}</span>
                </>
              )}
            </p>
            {actions && <div className="shrink-0">{actions}</div>}
          </div>
        </div>

        <div className="shrink-0">
          <div className="relative h-28 w-28">
            <svg viewBox="0 0 100 100" className="h-28 w-28 -rotate-90">
              <circle
                cx="50"
                cy="50"
                r="45"
                fill="none"
                stroke="rgba(255,255,255,0.05)"
                strokeWidth="6"
              />
              <circle
                cx="50"
                cy="50"
                r="45"
                fill="none"
                stroke={scoreColor}
                strokeWidth="6"
                strokeLinecap="round"
                strokeDasharray={circumference}
                strokeDashoffset={circumference - (animatedScore / 100) * circumference}
                style={{ transition: "stroke-dashoffset 1s cubic-bezier(0.4,0,0.2,1)" }}
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="font-mono text-2xl font-bold tabular-nums" style={{ color: scoreColor }}>
                {animatedScore}
              </span>
              <span className="-mt-1 text-xs text-slate-500">/ 100</span>
            </div>
          </div>
          <p className="mt-1 text-center text-xs font-mono uppercase tracking-widest text-slate-500">
            Quality
          </p>
        </div>
      </div>
    </div>
  );
}
