"use client";

import { useEffect, useMemo, useState } from "react";
import { getActionQueue, approveAction, rejectAction, type ActionQueueItem } from "@/lib/api";
import {
  AGENT_LABELS, CATEGORY_LABELS, CATEGORY_TONE, CATEGORY_TONE_SOFT,
  CategoryIcon, ChannelIcon, CheckIcon, InfoIcon, XIcon, channelOf, priorityLabel, shortagesOf,
} from "@/components/actioncenter/actionQueueMeta";

type ChannelTab = "all" | "instamart" | "whatsapp";
const CHANNEL_TABS: { key: ChannelTab; label: string }[] = [
  { key: "all", label: "All channels" },
  { key: "instamart", label: "Instamart" },
  { key: "whatsapp", label: "WhatsApp" },
];

export function ActionDetailsModal({
  action, busy, error, onClose, onApprove,
}: {
  action: ActionQueueItem;
  busy: boolean;
  error?: string;
  onClose: () => void;
  onApprove: (action: ActionQueueItem) => void;
}) {
  const shortages = shortagesOf(action);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div
        className="w-full max-w-md rounded-2xl bg-[var(--color-surface-raised)] p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <p className="text-[14px] font-bold text-[var(--color-text-primary)]">{action.title}</p>

        {action.category === "whatsapp_vendor_order" && (
          <>
            <p className="mt-1 text-[11.5px] text-[var(--color-text-faint)]">
              To: {String(action.payload.vendor ?? "Vendor")}
            </p>
            <div className="mt-3 rounded-xl bg-[#dcf8c6] p-3 text-[13px] leading-snug text-[#111]">
              {String(action.payload.message_draft ?? "")}
            </div>
          </>
        )}

        {action.category === "restock_alert" && shortages.length > 0 && (
          <div className="mt-3 max-h-80 space-y-3 overflow-y-auto">
            {shortages.map((s) => (
              <div key={s.ingredient} className="rounded-xl border border-[var(--color-border-default)] bg-[var(--color-surface-sunken)] p-3">
                <p className="text-[13px] font-semibold text-[var(--color-text-primary)]">{s.ingredient}</p>
                {s.quantity_in_stock !== undefined && (
                  <p className="mt-0.5 text-[11.5px] text-[var(--color-text-faint)]">
                    {s.quantity_in_stock}{s.unit} in stock, vs {s.reorder_threshold}{s.unit} threshold
                  </p>
                )}
                {s.recommended_restock_qty !== undefined && (
                  <p className="mt-1 text-[12px] font-medium" style={{ color: "var(--color-accent)" }}>
                    Restock {s.recommended_restock_qty}{s.unit}{s.whatsapp_vendor ? ` — message ${s.whatsapp_vendor} on WhatsApp, or check Instamart` : ""}
                  </p>
                )}
                {s.reason && <p className="mt-0.5 text-[11px] text-[var(--color-text-soft)]">{s.reason}</p>}
              </div>
            ))}
          </div>
        )}

        {action.category === "pricing_promo_review" && (
          <p className="mt-2 text-[12px] text-[var(--color-text-soft)]">
            {String(action.payload.area_deals_count ?? 0)} area deal(s) live tonight while occupancy is high.
          </p>
        )}

        {error && (
          <p className="mt-2 text-[11px]" style={{ color: "var(--color-caution)" }}>Couldn&apos;t send: {error}</p>
        )}

        <div className="mt-4 flex justify-end gap-2">
          <button onClick={onClose} className="rounded-lg px-4 py-2 text-[12px] font-semibold text-[var(--color-text-faint)]">
            Cancel
          </button>
          <button
            onClick={() => onApprove(action)}
            disabled={busy}
            className="btn-primary rounded-lg px-4 py-2 text-[12px] font-semibold disabled:opacity-50"
          >
            Approve
          </button>
        </div>
      </div>
    </div>
  );
}

export default function ActionQueuePanel({
  actions: controlledActions,
  onActionTaken,
  emptyMessage,
}: {
  actions?: ActionQueueItem[];
  onActionTaken?: () => void;
  emptyMessage?: string;
} = {}) {
  const [actions, setActions] = useState<ActionQueueItem[]>(controlledActions ?? []);
  const [loaded, setLoaded] = useState(!!controlledActions);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [detailsAction, setDetailsAction] = useState<ActionQueueItem | null>(null);
  const [actionErrors, setActionErrors] = useState<Record<number, string>>({});
  const [channelTab, setChannelTab] = useState<ChannelTab>("all");

  // Uncontrolled mode (e.g. /planning): self-fetch pending actions once.
  useEffect(() => {
    if (controlledActions) return;
    getActionQueue("pending")
      .then((data) => { setActions(data); setLoadError(null); })
      .catch((err) => { console.error("Action Queue load failed:", err); setLoadError(err instanceof Error ? err.message : "Failed to load."); })
      .finally(() => setLoaded(true));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Controlled mode (Action Center): mirror whatever the parent already fetched.
  useEffect(() => {
    if (controlledActions) {
      setActions(controlledActions);
      setLoaded(true);
    }
  }, [controlledActions]);

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
        onActionTaken?.();
      }
    } catch (err) {
      setActionErrors((prev) => ({ ...prev, [action.id]: err instanceof Error ? err.message : "Approve failed." }));
    } finally {
      setBusyId(null);
      setDetailsAction(null);
    }
  };

  const handleReject = async (action: ActionQueueItem) => {
    setBusyId(action.id);
    try {
      await rejectAction(action.id);
      setActions((prev) => prev.filter((a) => a.id !== action.id));
      onActionTaken?.();
    } catch {
      // leave the item in the list on failure
    } finally {
      setBusyId(null);
    }
  };

  const channelCounts = useMemo(() => {
    const c: Record<ChannelTab, number> = { all: actions.length, instamart: 0, whatsapp: 0 };
    for (const a of actions) {
      const ch = channelOf(a);
      if (ch) c[ch] += 1;
    }
    return c;
  }, [actions]);

  const visibleActions = channelTab === "all" ? actions : actions.filter((a) => channelOf(a) === channelTab);

  return (
    <div className="card p-6">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full" style={{ background: "var(--color-accent-soft)", color: "var(--color-accent)" }}>
            <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4" stroke="currentColor" strokeWidth={1.8}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </span>
          <div>
            <p className="text-[15px] font-bold text-[var(--color-text-primary)]">Action Queue</p>
            <p className="mt-0.5 text-[11.5px] text-[var(--color-text-faint)]">Recommendations awaiting your approval</p>
          </div>
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

      {loaded && !loadError && actions.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-1.5">
          {CHANNEL_TABS.map((tab) => {
            const active = channelTab === tab.key;
            return (
              <button
                key={tab.key}
                onClick={() => setChannelTab(tab.key)}
                className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[11.5px] font-medium transition-colors ${
                  active
                    ? "border-[var(--color-accent)]/40 bg-[var(--color-accent)]/10 text-[var(--color-text-primary)]"
                    : "border-[var(--color-border-default)] bg-[var(--color-surface-sunken)] text-[var(--color-text-faint)] hover:text-[var(--color-text-soft)]"
                }`}
              >
                {tab.key !== "all" && <ChannelIcon channel={tab.key} className="h-3.5 w-3.5" />}
                {tab.label}
                <span className={active ? "text-[var(--color-text-soft)]" : "text-[var(--color-text-ghost)]"}>
                  {channelCounts[tab.key]}
                </span>
              </button>
            );
          })}
        </div>
      )}

      {!loaded ? (
        <p className="mt-4 text-[11px] text-[var(--color-text-faint)]">Loading…</p>
      ) : loadError ? (
        <p className="mt-4 text-[11px]" style={{ color: "var(--color-caution)" }}>Couldn&apos;t load the Action Queue ({loadError}).</p>
      ) : actions.length === 0 ? (
        <p className="mt-4 text-[11px] text-[var(--color-text-faint)]">{emptyMessage ?? "Nothing waiting for approval right now."}</p>
      ) : visibleActions.length === 0 ? (
        <p className="mt-4 text-[11px] text-[var(--color-text-faint)]">
          Nothing via {channelTab === "instamart" ? "Instamart" : "WhatsApp"} right now.
        </p>
      ) : (
        <div className="mt-4 space-y-2.5">
          {visibleActions.map((action) => {
            const shortages = shortagesOf(action);
            const subtitle =
              shortages.length === 1
                ? `${shortages[0].quantity_in_stock ?? "?"}${shortages[0].unit ?? ""} vs ${shortages[0].reorder_threshold ?? "?"}${shortages[0].unit ?? ""} threshold`
                : shortages.length > 1
                ? `${shortages.length} ingredients below threshold`
                : null;

            return (
              <div
                key={action.id}
                className="rounded-2xl border border-[var(--color-border-default)] bg-[var(--color-surface-sunken)] px-4 py-3.5"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 items-start gap-3">
                    <span
                      className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-full"
                      style={{ background: CATEGORY_TONE_SOFT[action.category] ?? "var(--color-surface-sunken)", color: CATEGORY_TONE[action.category] ?? "var(--color-text-faint)" }}
                    >
                      <CategoryIcon category={action.category} className="h-[22px] w-[22px]" />
                    </span>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className="rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide"
                          style={{ background: CATEGORY_TONE_SOFT[action.category] ?? "var(--color-surface-sunken)", color: CATEGORY_TONE[action.category] ?? "var(--color-text-faint)" }}
                        >
                          {CATEGORY_LABELS[action.category] ?? action.category}
                        </span>
                        <ChannelIcon channel={channelOf(action)} className="h-3.5 w-3.5" />
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
                      {subtitle && <p className="mt-0.5 text-[11.5px] text-[var(--color-text-faint)]">{subtitle}</p>}
                      <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                        <span className="rounded-full border border-[var(--color-border-default)] bg-[var(--color-surface-raised)] px-2 py-0.5 text-[10px] font-medium text-[var(--color-text-soft)]">
                          {AGENT_LABELS[action.category] ?? "Agent"}
                        </span>
                        <span
                          className="rounded-full px-2 py-0.5 text-[10px] font-semibold"
                          style={{ background: "var(--color-caution-soft)", color: "var(--color-caution)" }}
                        >
                          {priorityLabel(action)}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <button
                      onClick={() => handleApprove(action)}
                      disabled={busyId === action.id}
                      className="inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-[12px] font-semibold text-white disabled:opacity-50"
                      style={{ background: "var(--color-good)" }}
                    >
                      <CheckIcon className="h-3 w-3" />
                      Approve
                    </button>
                    <button
                      onClick={() => handleReject(action)}
                      disabled={busyId === action.id}
                      className="inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-[12px] font-semibold text-[var(--color-text-faint)] disabled:opacity-50"
                      style={{ background: "var(--color-surface-sunken)" }}
                    >
                      <XIcon className="h-3 w-3" />
                      Dismiss
                    </button>
                    <button
                      onClick={() => setDetailsAction(action)}
                      className="inline-flex items-center gap-1 rounded-lg border border-[var(--color-border-default)] px-3 py-1.5 text-[12px] font-semibold text-[var(--color-text-soft)] transition-colors hover:text-[var(--color-text-primary)]"
                    >
                      <InfoIcon className="h-3 w-3" />
                      Details
                    </button>
                  </div>
                </div>
                {actionErrors[action.id] && (
                  <p className="mt-2 text-[11px]" style={{ color: "var(--color-caution)" }}>
                    Couldn&apos;t send: {actionErrors[action.id]}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}

      {detailsAction && (
        <ActionDetailsModal
          action={detailsAction}
          busy={busyId === detailsAction.id}
          error={actionErrors[detailsAction.id]}
          onClose={() => setDetailsAction(null)}
          onApprove={handleApprove}
        />
      )}
    </div>
  );
}
