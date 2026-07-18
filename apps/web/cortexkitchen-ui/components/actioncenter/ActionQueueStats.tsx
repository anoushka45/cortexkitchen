"use client";

import { useTheme } from "@/context/ThemeContext";
import { CheckIcon, HourglassIcon, ThumbUpIcon, XIcon } from "./actionQueueMeta";

export type StatusKey = "pending" | "executed" | "approved" | "rejected";

// Solid brand colors for the icon badge + label, and a soft tinted wash for
// the card's own background -- a plain white card with a faint tinted
// circle read as lifeless, so color now carries the whole tile, not just a
// small icon accent.
const STAT_META: Record<StatusKey, { label: string; color: string; wash: string; washDark: string; iconWash: string; iconWashDark: string }> = {
  pending:  { label: "Pending",  color: "var(--color-caution)",  wash: "rgba(180,83,9,0.10)",  washDark: "rgba(245,190,115,0.09)", iconWash: "rgba(180,83,9,0.28)",  iconWashDark: "rgba(245,190,115,0.30)" },
  executed: { label: "Executed", color: "var(--color-good)",     wash: "rgba(14,159,110,0.10)", washDark: "rgba(52,211,153,0.09)", iconWash: "rgba(14,159,110,0.28)", iconWashDark: "rgba(52,211,153,0.30)" },
  approved: { label: "Approved", color: "var(--color-accent)",   wash: "rgba(176,98,26,0.10)",  washDark: "rgba(230,137,42,0.10)", iconWash: "rgba(176,98,26,0.28)",  iconWashDark: "rgba(230,137,42,0.30)" },
  rejected: { label: "Rejected", color: "var(--color-critical)", wash: "rgba(225,29,72,0.09)",  washDark: "rgba(251,113,133,0.09)", iconWash: "rgba(225,29,72,0.26)",  iconWashDark: "rgba(251,113,133,0.28)" },
};

const STAT_ORDER: StatusKey[] = ["pending", "executed", "approved", "rejected"];

function StatIcon({ status }: { status: StatusKey }) {
  const cls = "h-3.5 w-3.5";
  if (status === "pending") return <HourglassIcon className={cls} strokeWidth={2.2} />;
  if (status === "executed") return <CheckIcon className={cls} strokeWidth={2.6} />;
  if (status === "approved") return <ThumbUpIcon className={cls} strokeWidth={2.2} />;
  return <XIcon className={cls} strokeWidth={2.6} />;
}

export default function ActionQueueStats({
  counts,
  activeStatus,
  onSelect,
}: {
  counts: Record<StatusKey, number>;
  activeStatus?: StatusKey | "all";
  onSelect?: (status: StatusKey) => void;
}) {
  const themeCtx = useTheme();
  const isDark = themeCtx?.theme === "dark";

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {STAT_ORDER.map((key) => {
        const meta = STAT_META[key];
        const active = activeStatus === key;
        const wash = isDark ? meta.washDark : meta.wash;
        return (
          <button
            key={key}
            type="button"
            onClick={() => onSelect?.(key)}
            className="card flex items-center justify-between gap-3 px-4 py-4 text-left"
            style={{
              background: `linear-gradient(135deg, ${wash} 0%, transparent 65%), var(--color-surface-raised)`,
              borderColor: active ? meta.color : undefined,
              borderWidth: active ? 1.5 : undefined,
            }}
          >
            <div className="flex min-w-0 items-center gap-3">
              <span
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full"
                style={{ background: isDark ? meta.iconWashDark : meta.iconWash, color: meta.color }}
              >
                <StatIcon status={key} />
              </span>
              <div className="min-w-0">
                <p className="text-[12px] font-medium" style={{ color: meta.color }}>{meta.label}</p>
                <p className="text-[26px] font-bold leading-tight text-[var(--color-text-primary)]">{counts[key]}</p>
              </div>
            </div>
            <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4 shrink-0 text-[var(--color-text-faint)]" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </button>
        );
      })}
    </div>
  );
}
