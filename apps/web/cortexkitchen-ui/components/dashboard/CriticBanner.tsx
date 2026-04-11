// components/dashboard/CriticBanner.tsx
// Hero banner — critic verdict, quality score, and notes.
// This is the first thing the operator sees after a planning run.

import Badge from "@/components/ui/Badge";
import { CriticResult } from "@/types/planning";

const BG: Record<string, string> = {
  approved:    "bg-emerald-50 border-emerald-200",
  rejected:    "bg-red-50     border-red-200",
  revision:    "bg-amber-50   border-amber-200",
  unknown:     "bg-gray-50    border-gray-200",
};

const ICON: Record<string, string> = {
  approved: "✅",
  rejected: "🚫",
  revision: "⚠️",
  unknown:  "❓",
};

interface Props {
  critic:      CriticResult;
  generatedAt: string;
  targetDate:  string | null;
}

export default function CriticBanner({ critic, generatedAt, targetDate }: Props) {
  const bg      = BG[critic.verdict]   ?? BG.unknown;
  const icon    = ICON[critic.verdict] ?? "❓";
  const scorePct = Math.round(critic.score * 100);

  const formattedTime = new Date(generatedAt).toLocaleTimeString([], {
    hour:   "2-digit",
    minute: "2-digit",
  });

  return (
    <div className={`rounded-xl border-2 p-6 ${bg}`}>
      {/* Top row */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="text-3xl">{icon}</span>
          <div>
            <p className="text-xs font-medium uppercase tracking-widest text-gray-500 mb-1">
              Critic Verdict
            </p>
            <div className="flex items-center gap-2">
              <Badge variant={critic.verdict} />
              {critic.decision_log_id && (
                <span className="text-xs text-gray-400">
                  log #{critic.decision_log_id}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Score ring */}
        <div className="flex flex-col items-center">
          <div className="relative w-16 h-16">
            <svg viewBox="0 0 36 36" className="w-16 h-16 -rotate-90">
              <circle
                cx="18" cy="18" r="15.9"
                fill="none"
                stroke="#e5e7eb"
                strokeWidth="3"
              />
              <circle
                cx="18" cy="18" r="15.9"
                fill="none"
                stroke={scorePct >= 70 ? "#10b981" : scorePct >= 40 ? "#f59e0b" : "#ef4444"}
                strokeWidth="3"
                strokeDasharray={`${scorePct} 100`}
                strokeLinecap="round"
              />
            </svg>
            <span className="absolute inset-0 flex items-center justify-center text-sm font-bold text-gray-700">
              {scorePct}%
            </span>
          </div>
          <p className="text-xs text-gray-500 mt-1">Quality</p>
        </div>
      </div>

      {/* Notes */}
      {critic.notes && (
        <p className="mt-4 text-sm text-gray-700 leading-relaxed border-t border-current/10 pt-4">
          {critic.notes}
        </p>
      )}

      {/* Footer */}
      <p className="mt-3 text-xs text-gray-400">
        Generated at {formattedTime}
        {targetDate && <> · Target: <span className="font-medium">{targetDate}</span></>}
      </p>
    </div>
  );
}