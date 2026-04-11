// components/dashboard/CriticBanner.tsx
"use client";

import { useEffect, useState } from "react";
import Badge from "@/components/ui/Badge";
import { CriticResult } from "@/types/planning";

const VERDICT_CONFIG: Record<string, {
  glow: string; border: string; bg: string; label: string;
}> = {
  approved: {
    glow:   "shadow-glow-emerald",
    border: "border-emerald-500/30",
    bg:     "from-emerald-950/40 to-navy-900",
    label:  "Plan approved for execution",
  },
  rejected: {
    glow:   "shadow-glow-rose",
    border: "border-rose-500/30",
    bg:     "from-rose-950/40 to-navy-900",
    label:  "Plan blocked — requires revision",
  },
  revision: {
    glow:   "shadow-glow-amber",
    border: "border-amber-500/30",
    bg:     "from-amber-950/30 to-navy-900",
    label:  "Plan needs review before execution",
  },
  unknown: {
    glow:   "",
    border: "border-slate-700",
    bg:     "from-navy-800 to-navy-900",
    label:  "Verdict pending",
  },
};

interface Props {
  critic:      CriticResult;
  generatedAt: string;
  targetDate:  string | null;
}

export default function CriticBanner({ critic, generatedAt, targetDate }: Props) {
  const [animatedScore, setAnimatedScore] = useState(0);
  const config   = VERDICT_CONFIG[critic.verdict] ?? VERDICT_CONFIG.unknown;
  const scorePct = Math.round(critic.score * 100);
  const circumference = 2 * Math.PI * 45;

  // Animate score ring on mount
  useEffect(() => {
    const timer = setTimeout(() => setAnimatedScore(scorePct), 100);
    return () => clearTimeout(timer);
  }, [scorePct]);

  const formattedTime = new Date(generatedAt).toLocaleTimeString([], {
    hour: "2-digit", minute: "2-digit",
  });

  const scoreColor =
    scorePct >= 70 ? "#34d399" :
    scorePct >= 40 ? "#fbbf24" : "#fb7185";

  return (
    <div className={`stagger-1 relative rounded-2xl border bg-gradient-to-br ${config.bg} ${config.border} p-6 overflow-hidden`}>
      {/* Subtle background glow */}
      <div className="absolute inset-0 opacity-20 pointer-events-none"
        style={{ background: `radial-gradient(ellipse at top left, ${scoreColor}22, transparent 60%)` }}
      />

      <div className="relative flex items-start justify-between gap-6">
        {/* Left — verdict info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-xs font-mono uppercase tracking-widest text-slate-500">
              Critic Agent · Verdict
            </span>
            {critic.decision_log_id && (
              <span className="font-mono text-xs text-slate-600">
                #{critic.decision_log_id}
              </span>
            )}
          </div>

          <div className="flex items-center gap-3 mb-3">
            <Badge variant={critic.verdict} />
            <span className="text-sm text-slate-400">{config.label}</span>
          </div>

          {critic.notes && (
            <p className="text-sm text-slate-300 leading-relaxed border-l-2 border-violet-500/40 pl-4 mt-4">
              {critic.notes}
            </p>
          )}

          <p className="mt-4 text-xs font-mono text-slate-600">
            Generated {formattedTime}
            {targetDate && (
              <> · Target <span className="text-slate-400">{targetDate}</span></>
            )}
          </p>
        </div>

        {/* Right — animated score ring */}
        <div className="flex flex-col items-center gap-1 shrink-0">
          <div className="relative w-28 h-28">
            <svg viewBox="0 0 100 100" className="w-28 h-28 -rotate-90">
              {/* Track */}
              <circle cx="50" cy="50" r="45"
                fill="none"
                stroke="rgba(255,255,255,0.05)"
                strokeWidth="6"
              />
              {/* Fill — animated */}
              <circle cx="50" cy="50" r="45"
                fill="none"
                stroke={scoreColor}
                strokeWidth="6"
                strokeLinecap="round"
                strokeDasharray={circumference}
                strokeDashoffset={circumference - (animatedScore / 100) * circumference}
                style={{ transition: "stroke-dashoffset 1s cubic-bezier(0.4,0,0.2,1)" }}
              />
            </svg>
            {/* Center number */}
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="font-mono text-2xl font-bold" style={{ color: scoreColor }}>
                {scorePct}
              </span>
              <span className="text-xs text-slate-500 -mt-1">/ 100</span>
            </div>
          </div>
          <span className="text-xs text-slate-500 uppercase tracking-widest font-mono">
            Quality
          </span>
        </div>
      </div>
    </div>
  );
}