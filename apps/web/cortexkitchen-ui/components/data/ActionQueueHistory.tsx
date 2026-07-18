"use client";

import { useEffect, useMemo, useState } from "react";
import { getActionQueue, type ActionQueueItem } from "@/lib/api";
import Badge from "@/components/ui/Badge";
import { relativeTime } from "@/lib/formatters";
import { CATEGORY_LABELS, CATEGORY_TONE, CheckIcon, HourglassIcon, XIcon } from "@/components/actioncenter/actionQueueMeta";

export type StatusTab = "all" | "pending" | "approved" | "executed" | "rejected" | "expired";

const TABS: { key: StatusTab; label: string; dot: string }[] = [
  { key: "all", label: "All", dot: "bg-[var(--color-text-faint)]" },
  { key: "pending", label: "Pending", dot: "bg-amber-400" },
  { key: "approved", label: "Approved", dot: "bg-emerald-400" },
  { key: "executed", label: "Executed", dot: "bg-emerald-400" },
  { key: "rejected", label: "Rejected", dot: "bg-rose-400" },
  { key: "expired", label: "Expired", dot: "bg-rose-400" },
];

const STATUS_TONE: Record<string, string> = {
  pending: "var(--color-caution)",
  approved: "var(--color-good)",
  executed: "var(--color-good)",
  rejected: "var(--color-critical)",
  expired: "var(--color-critical)",
};

function StatusGlyph({ status }: { status: string }) {
  if (status === "approved" || status === "executed") return <CheckIcon className="h-3.5 w-3.5" />;
  if (status === "rejected" || status === "expired") return <XIcon className="h-3.5 w-3.5" />;
  return <HourglassIcon className="h-3.5 w-3.5" />;
}

export default function ActionQueueHistory({
  actions: controlledActions,
  activeTab: controlledTab,
  onTabChange,
}: {
  actions?: ActionQueueItem[];
  activeTab?: StatusTab;
  onTabChange?: (tab: StatusTab) => void;
} = {}) {
  const [actions, setActions] = useState<ActionQueueItem[]>(controlledActions ?? []);
  const [loaded, setLoaded] = useState(!!controlledActions);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [internalTab, setInternalTab] = useState<StatusTab>("all");

  const activeTab = controlledTab ?? internalTab;
  const setActiveTab = onTabChange ?? setInternalTab;

  // Uncontrolled fallback -- self-fetch every status, newest first.
  useEffect(() => {
    if (controlledActions) return;
    getActionQueue()
      .then((data) => { setActions(data); setLoadError(null); })
      .catch((err) => setLoadError(err instanceof Error ? err.message : "Failed to load."))
      .finally(() => setLoaded(true));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (controlledActions) {
      setActions(controlledActions);
      setLoaded(true);
    }
  }, [controlledActions]);

  const counts = useMemo(() => {
    const c: Record<StatusTab, number> = { all: actions.length, pending: 0, approved: 0, executed: 0, rejected: 0, expired: 0 };
    for (const a of actions) {
      if (a.status in c) c[a.status as StatusTab] += 1;
    }
    return c;
  }, [actions]);

  const visible = activeTab === "all" ? actions : actions.filter((a) => a.status === activeTab);

  return (
    <div className="card p-6">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full" style={{ background: "rgba(56,189,248,0.10)", color: "#38bdf8" }}>
            <HourglassIcon className="h-4 w-4" />
          </span>
          <div>
            <p className="text-[15px] font-bold text-[var(--color-text-primary)]">History</p>
            <p className="mt-0.5 text-[11.5px] text-[var(--color-text-faint)]">
              See everything you&apos;ve approved, rejected, or completed. Filter it by status below.
            </p>
          </div>
        </div>
        {actions.length > 0 && (
          <span className="shrink-0 rounded-full border border-[var(--color-border-default)] bg-[var(--color-surface-sunken)] px-2.5 py-1 text-[11px] text-[var(--color-text-faint)]">
            {actions.length} total
          </span>
        )}
      </div>

      {loaded && !loadError && actions.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-1.5">
          {TABS.map((tab) => {
            const active = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[11.5px] font-medium transition-colors ${
                  active
                    ? "border-[var(--color-accent)]/40 bg-[var(--color-accent)]/10 text-[var(--color-text-primary)]"
                    : "border-[var(--color-border-default)] bg-[var(--color-surface-sunken)] text-[var(--color-text-faint)] hover:text-[var(--color-text-soft)]"
                }`}
              >
                <span className={`h-1.5 w-1.5 rounded-full ${tab.dot}`} />
                {tab.label}
                <span className={active ? "text-[var(--color-text-soft)]" : "text-[var(--color-text-ghost)]"}>
                  {counts[tab.key]}
                </span>
              </button>
            );
          })}
        </div>
      )}

      {!loaded ? (
        <p className="mt-4 text-[11px] text-[var(--color-text-faint)]">Loading…</p>
      ) : loadError ? (
        <p className="mt-4 text-[11px]" style={{ color: "var(--color-caution)" }}>Couldn&apos;t load Action Queue history ({loadError}).</p>
      ) : actions.length === 0 ? (
        <p className="mt-4 text-[11px] text-[var(--color-text-faint)]">No actions recorded yet.</p>
      ) : visible.length === 0 ? (
        <p className="mt-4 text-[11px] text-[var(--color-text-faint)]">No {activeTab} actions.</p>
      ) : (
        <div className="mt-4">
          {visible.map((action, idx) => {
            const isLast = idx === visible.length - 1;
            const tone = STATUS_TONE[action.status] ?? "var(--color-text-faint)";
            const timestamp = action.executed_at ?? action.created_at;
            return (
              <div key={action.id} className="relative flex gap-3 pb-5 last:pb-0">
                {!isLast && (
                  <span className="absolute left-[15px] top-8 bottom-0 w-px bg-[var(--color-border-soft)]" />
                )}
                <span
                  className="z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 bg-[var(--color-surface-raised)]"
                  style={{ borderColor: tone, color: tone }}
                >
                  <StatusGlyph status={action.status} />
                </span>
                <div className="min-w-0 flex-1 pt-1">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-[11px] font-semibold" style={{ color: CATEGORY_TONE[action.category] ?? "var(--color-text-faint)" }}>
                        {CATEGORY_LABELS[action.category] ?? action.category}
                      </span>
                      <Badge variant={action.status} />
                    </div>
                    {timestamp && (
                      <span className="shrink-0 text-[11px] text-[var(--color-text-faint)]" title={new Date(timestamp).toLocaleString()}>
                        {relativeTime(timestamp)}
                      </span>
                    )}
                  </div>
                  <p className="mt-1 truncate text-[13px] font-medium text-[var(--color-text-primary)]">{action.title}</p>
                  {action.error && (
                    <p className="mt-0.5 text-[11px]" style={{ color: "var(--color-caution)" }}>{action.error}</p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
