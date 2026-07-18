"use client";

import { useState } from "react";
import { approveAction, rejectAction, type ActionQueueItem } from "@/lib/api";
import { relativeTime } from "@/lib/formatters";
import {
  AGENT_LABELS, CATEGORY_LABELS, CategoryIcon, CheckIcon, EyeIcon, XIcon,
  priorityLabel, shortagesOf,
} from "./actionQueueMeta";

export default function ActionAttentionHero({
  action,
  onApproved,
  onDismissed,
  onViewDetails,
}: {
  action: ActionQueueItem;
  onApproved: () => void;
  onDismissed: () => void;
  onViewDetails: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const top = shortagesOf(action)[0];

  const handleApprove = async () => {
    setBusy(true);
    try {
      const result = await approveAction(action.id);
      if (result.error) setError(result.error);
      else onApproved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Approve failed.");
    } finally {
      setBusy(false);
    }
  };

  const handleDismiss = async () => {
    setBusy(true);
    try {
      await rejectAction(action.id);
      onDismissed();
    } catch {
      // leave the item in place on failure
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="card p-6"
      style={{ borderLeftWidth: 6, borderLeftColor: "var(--color-accent)" }}
    >
      <div className="flex items-center gap-2">
        <span
          className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[13px] font-bold leading-none text-white"
          style={{ background: "var(--color-accent)" }}
        >
          !
        </span>
        <p className="text-[15px] font-bold" style={{ color: "var(--color-accent)" }}>
          Needs Your Attention
        </p>
      </div>

      <div className="mt-4 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <span
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full"
            style={{ background: "var(--color-accent-soft)", color: "var(--color-accent)" }}
          >
            <CategoryIcon category={action.category} />
          </span>
          <div className="min-w-0">
            <p className="text-[16px] font-bold text-[var(--color-text-primary)]">{action.title}</p>
            <div className="mt-1.5 flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--color-border-default)] bg-[var(--color-surface-sunken)] px-2.5 py-1 text-[11px] font-medium text-[var(--color-text-soft)]">
                <CategoryIcon category={action.category} className="h-3 w-3" />
                {AGENT_LABELS[action.category] ?? CATEGORY_LABELS[action.category] ?? action.category}
              </span>
              <span
                className="rounded-full px-2.5 py-1 text-[11px] font-semibold"
                style={{ background: "var(--color-caution-soft)", color: "var(--color-caution)" }}
              >
                {priorityLabel(action)}
              </span>
              {action.created_at && (
                <span className="text-[11px] text-[var(--color-text-faint)]">{relativeTime(action.created_at)}</span>
              )}
            </div>
          </div>
        </div>

        {top && (
          <div className="grid grid-cols-2 gap-x-8 gap-y-3 sm:flex sm:flex-wrap sm:items-start sm:gap-8">
            {top.quantity_in_stock !== undefined && (
              <div>
                <p className="text-[11px] uppercase tracking-wide text-[var(--color-text-faint)]">Current</p>
                <p className="mt-0.5 text-[18px] font-bold text-[var(--color-text-primary)]">
                  {top.quantity_in_stock}{top.unit ?? ""}
                </p>
              </div>
            )}
            {top.reorder_threshold !== undefined && (
              <div>
                <p className="text-[11px] uppercase tracking-wide text-[var(--color-text-faint)]">Minimum</p>
                <p className="mt-0.5 text-[18px] font-bold text-[var(--color-text-primary)]">
                  {top.reorder_threshold}{top.unit ?? ""}
                </p>
              </div>
            )}
            {top.recommended_restock_qty !== undefined && (
              <div className="max-w-[180px]">
                <p className="text-[11px] uppercase tracking-wide" style={{ color: "var(--color-accent)" }}>Suggested Action</p>
                <p className="mt-0.5 text-[13px] font-semibold text-[var(--color-text-primary)]">
                  Restock {top.recommended_restock_qty}{top.unit ?? ""}
                  {top.suggested_vendor ? ` from ${top.suggested_vendor}` : ""}
                </p>
              </div>
            )}
            {top.reason && (
              <div className="max-w-[220px]">
                <p className="text-[11px] uppercase tracking-wide text-[var(--color-text-faint)]">Reason</p>
                <p className="mt-0.5 text-[13px] text-[var(--color-text-soft)]">{top.reason}</p>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="mt-5 flex flex-wrap gap-2">
        <button
          onClick={handleApprove}
          disabled={busy}
          className="btn-primary inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-[13px] font-semibold disabled:opacity-50"
        >
          <CheckIcon />
          Approve
        </button>
        <button
          onClick={handleDismiss}
          disabled={busy}
          className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--color-border-default)] px-4 py-2 text-[13px] font-semibold text-[var(--color-text-soft)] transition-colors hover:text-[var(--color-text-primary)] disabled:opacity-50"
        >
          <XIcon />
          Dismiss
        </button>
        <button
          onClick={onViewDetails}
          className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--color-border-default)] px-4 py-2 text-[13px] font-semibold text-[var(--color-text-soft)] transition-colors hover:text-[var(--color-text-primary)]"
        >
          <EyeIcon />
          View Details
        </button>
      </div>
      {error && (
        <p className="mt-2 text-[11px]" style={{ color: "var(--color-caution)" }}>Couldn&apos;t approve: {error}</p>
      )}
    </div>
  );
}
