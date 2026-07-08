"use client";

import { useEffect, useState } from "react";
import { getActionQueue, approveAction, rejectAction, type ActionQueueItem } from "@/lib/api";

const CATEGORY_LABELS: Record<string, string> = {
  whatsapp_vendor_order: "WhatsApp vendor order",
  restock_alert: "Restock",
};

const TIER_LABELS: Record<string, string> = {
  auto: "Auto",
  approve_required: "Needs approval",
  recommendation: "Recommendation",
};

export default function ActionQueuePanel() {
  const [actions, setActions] = useState<ActionQueueItem[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [previewAction, setPreviewAction] = useState<ActionQueueItem | null>(null);
  const [actionErrors, setActionErrors] = useState<Record<number, string>>({});

  useEffect(() => {
    getActionQueue("pending")
      .then((data) => { setActions(data); setLoadError(null); })
      .catch((err) => { console.error("Action Queue load failed:", err); setLoadError(err instanceof Error ? err.message : "Failed to load."); })
      .finally(() => setLoaded(true));
  }, []);

  const handleApprove = async (action: ActionQueueItem) => {
    setBusyId(action.id);
    try {
      // For whatsapp_vendor_order actions, approving is also what triggers the
      // real Twilio send (P6-A9) -- a 200 response doesn't guarantee the send
      // itself succeeded, so check the returned error field explicitly rather
      // than treating any non-throwing response as success.
      const result = await approveAction(action.id);
      if (result.error) {
        setActionErrors((prev) => ({ ...prev, [action.id]: result.error! }));
      } else {
        setActions((prev) => prev.filter((a) => a.id !== action.id));
        setActionErrors((prev) => {
          const next = { ...prev };
          delete next[action.id];
          return next;
        });
      }
    } catch (err) {
      setActionErrors((prev) => ({ ...prev, [action.id]: err instanceof Error ? err.message : "Approve failed." }));
    } finally {
      setBusyId(null);
      setPreviewAction(null);
    }
  };

  const handleReject = async (action: ActionQueueItem) => {
    setBusyId(action.id);
    try {
      await rejectAction(action.id);
      setActions((prev) => prev.filter((a) => a.id !== action.id));
    } catch {
      // leave the item in the list on failure
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="card p-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-[15px] font-bold text-[var(--color-text-primary)]">Action Queue</p>
          <p className="mt-0.5 text-[11.5px] text-[var(--color-text-faint)]">Recommendations awaiting your approval</p>
        </div>
        {actions.length > 0 && (
          <span
            className="shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold"
            style={{ background: "var(--color-caution-soft)", color: "var(--color-caution)" }}
          >
            {actions.length} pending
          </span>
        )}
      </div>

      {!loaded ? (
        <p className="mt-4 text-[11px] text-[var(--color-text-faint)]">Loading…</p>
      ) : loadError ? (
        <p className="mt-4 text-[11px]" style={{ color: "var(--color-caution)" }}>Couldn&apos;t load the Action Queue ({loadError}).</p>
      ) : actions.length === 0 ? (
        <p className="mt-4 text-[11px] text-[var(--color-text-faint)]">Nothing waiting for approval right now.</p>
      ) : (
        <div className="mt-4 space-y-2.5">
          {actions.map((action) => (
            <div
              key={action.id}
              className="rounded-xl border border-[var(--color-border-default)] bg-[var(--color-surface-raised)] px-4 py-3"
            >
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span
                      className="rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide"
                      style={{ background: "rgba(56,189,248,0.10)", color: "#38bdf8" }}
                    >
                      {CATEGORY_LABELS[action.category] ?? action.category}
                    </span>
                    <span className="text-[10px] text-[var(--color-text-faint)]">{TIER_LABELS[action.tier]}</span>
                    {action.approval_streak > 0 && (
                      <span
                        className="rounded-full px-2 py-0.5 text-[10px] font-semibold"
                        style={{ background: "var(--color-good-soft)", color: "var(--color-good)" }}
                        title={`You've approved ${CATEGORY_LABELS[action.category] ?? action.category} ${action.approval_streak} time${action.approval_streak !== 1 ? "s" : ""} in a row`}
                      >
                        Approved {action.approval_streak}x in a row
                      </span>
                    )}
                  </div>
                  <p className="mt-1 truncate text-[13px] font-medium text-[var(--color-text-primary)]">{action.title}</p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  {action.category === "whatsapp_vendor_order" ? (
                    <button
                      onClick={() => setPreviewAction(action)}
                      disabled={busyId === action.id}
                      className="rounded-lg px-3 py-1.5 text-[12px] font-semibold text-white disabled:opacity-50"
                      style={{ background: "var(--color-good)" }}
                    >
                      Review &amp; approve
                    </button>
                  ) : (
                    <button
                      onClick={() => handleApprove(action)}
                      disabled={busyId === action.id}
                      className="rounded-lg px-3 py-1.5 text-[12px] font-semibold text-white disabled:opacity-50"
                      style={{ background: "var(--color-good)" }}
                    >
                      Approve
                    </button>
                  )}
                  <button
                    onClick={() => handleReject(action)}
                    disabled={busyId === action.id}
                    className="rounded-lg px-3 py-1.5 text-[12px] font-semibold text-[var(--color-text-faint)] disabled:opacity-50"
                    style={{ background: "var(--color-surface-sunken)" }}
                  >
                    Dismiss
                  </button>
                </div>
              </div>
              {actionErrors[action.id] && (
                <p className="mt-2 text-[11px]" style={{ color: "var(--color-caution)" }}>
                  Couldn&apos;t send: {actionErrors[action.id]}
                </p>
              )}
            </div>
          ))}
        </div>
      )}

      {previewAction && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={() => setPreviewAction(null)}
        >
          <div
            className="w-full max-w-md rounded-2xl bg-[var(--color-surface-raised)] p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="text-[14px] font-bold text-[var(--color-text-primary)]">WhatsApp message preview</p>
            <p className="mt-1 text-[11.5px] text-[var(--color-text-faint)]">
              To: {String(previewAction.payload.vendor ?? "Vendor")}
            </p>
            <div className="mt-3 rounded-xl bg-[#dcf8c6] p-3 text-[13px] leading-snug text-[#111]">
              {String(previewAction.payload.message_draft ?? "")}
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button
                onClick={() => setPreviewAction(null)}
                className="rounded-lg px-4 py-2 text-[12px] font-semibold text-[var(--color-text-faint)]"
              >
                Cancel
              </button>
              <button
                onClick={() => handleApprove(previewAction)}
                disabled={busyId === previewAction.id}
                className="rounded-lg px-4 py-2 text-[12px] font-semibold text-white disabled:opacity-50"
                style={{ background: "var(--color-good)" }}
              >
                Approve &amp; send
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
