"use client";

import { useEffect, useState } from "react";
import { getActionQueue, type ActionQueueItem } from "@/lib/api";
import Badge from "@/components/ui/Badge";

const CATEGORY_LABELS: Record<string, string> = {
  whatsapp_vendor_order: "WhatsApp vendor order",
  restock_alert: "Restock",
};

export default function ActionQueueHistory() {
  const [actions, setActions] = useState<ActionQueueItem[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    // No status filter -- returns every action for the org across all
    // statuses (pending/approved/executed/rejected/expired), newest first.
    getActionQueue()
      .then((data) => { setActions(data); setLoadError(null); })
      .catch((err) => setLoadError(err instanceof Error ? err.message : "Failed to load."))
      .finally(() => setLoaded(true));
  }, []);

  return (
    <div className="card p-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-[15px] font-bold text-[var(--color-text-primary)]">Action Queue History</p>
          <p className="mt-0.5 text-[11.5px] text-[var(--color-text-faint)]">
            Every action approved, rejected, or executed over time -- restocks, WhatsApp messages, pricing reviews.
          </p>
        </div>
        {actions.length > 0 && (
          <span className="shrink-0 rounded-full border border-[var(--color-border-default)] bg-[var(--color-surface-sunken)] px-2.5 py-1 text-[11px] text-[var(--color-text-faint)]">
            {actions.length} total
          </span>
        )}
      </div>

      {!loaded ? (
        <p className="mt-4 text-[11px] text-[var(--color-text-faint)]">Loading…</p>
      ) : loadError ? (
        <p className="mt-4 text-[11px]" style={{ color: "var(--color-caution)" }}>Couldn&apos;t load Action Queue history ({loadError}).</p>
      ) : actions.length === 0 ? (
        <p className="mt-4 text-[11px] text-[var(--color-text-faint)]">No actions recorded yet.</p>
      ) : (
        <div className="mt-4 divide-y divide-[var(--color-border-soft)]">
          {actions.map((action) => (
            <div key={action.id} className="flex items-center justify-between gap-3 py-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide"
                    style={{ background: "rgba(56,189,248,0.10)", color: "#38bdf8" }}>
                    {CATEGORY_LABELS[action.category] ?? action.category}
                  </span>
                  <Badge variant={action.status} />
                </div>
                <p className="mt-1 truncate text-[13px] font-medium text-[var(--color-text-primary)]">{action.title}</p>
                {action.error && (
                  <p className="mt-0.5 text-[11px]" style={{ color: "var(--color-caution)" }}>{action.error}</p>
                )}
              </div>
              <div className="shrink-0 text-right text-[11px] text-[var(--color-text-faint)]">
                {action.executed_at ? (
                  <p>{new Date(action.executed_at).toLocaleString()}</p>
                ) : action.created_at ? (
                  <p>{new Date(action.created_at).toLocaleString()}</p>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
