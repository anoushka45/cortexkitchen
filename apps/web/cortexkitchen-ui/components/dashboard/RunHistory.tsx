// components/dashboard/RunHistory.tsx
// Session run history — last 5 runs, clickable to reload.

"use client";

import { RunHistoryEntry } from "@/types/planning";

interface Props {
  history:         RunHistoryEntry[];
  activeId?:       string | number;
  onSelect:        (entry: RunHistoryEntry) => void;
}

const VERDICT_COLOR: Record<string, string> = {
  approved: "text-emerald-400 border-emerald-500/30",
  rejected: "text-rose-400    border-rose-500/30",
  revision: "text-amber-400   border-amber-500/30",
  unknown:  "text-slate-400   border-slate-600",
};

const VERDICT_DOT: Record<string, string> = {
  approved: "bg-emerald-400",
  rejected: "bg-rose-400",
  revision: "bg-amber-400",
  unknown:  "bg-slate-500",
};

export default function RunHistory({ history, activeId, onSelect }: Props) {
  if (history.length === 0) return null;

  return (
    <div className="w-56 shrink-0">
      <p className="text-xs font-mono uppercase tracking-widest text-slate-600 mb-3 px-1">
        Run History
      </p>
      <ul className="space-y-2">
        {history.map((entry) => {
          const isActive  = entry.id === activeId;
          const colors    = VERDICT_COLOR[entry.verdict] ?? VERDICT_COLOR.unknown;
          const dot       = VERDICT_DOT[entry.verdict]  ?? VERDICT_DOT.unknown;
          const scorePct  = entry.score == null ? null : Math.round(entry.score * 100);
          const time      = new Date(entry.runAt).toLocaleTimeString([], {
            hour: "2-digit", minute: "2-digit",
          });

          return (
            <li key={entry.id}>
              <button
                onClick={() => onSelect(entry)}
                className={`
                  w-full text-left rounded-xl border px-3 py-3
                  transition-all duration-200
                  ${isActive
                    ? "border-violet-500/50 bg-violet-500/10"
                    : "border-white/5 bg-navy-900 hover:border-violet-500/20 hover:bg-navy-800"
                  }
                `}
              >
                {/* Date */}
                <p className="text-xs font-mono text-slate-300 truncate mb-1.5">
                  {entry.targetDate === "Next Friday"
                    ? "Next Friday"
                    : entry.targetDate}
                </p>

                {/* Verdict + score */}
                <div className={`flex items-center justify-between text-xs font-mono ${colors}`}>
                  <span className="flex items-center gap-1.5">
                    <span className={`w-1.5 h-1.5 rounded-full ${dot}`} />
                    {entry.verdict}
                  </span>
                  <span>{scorePct == null ? "--" : `${scorePct}%`}</span>
                </div>

                {/* Time */}
                <p className="text-xs text-slate-600 mt-1.5 font-mono">{time}</p>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
