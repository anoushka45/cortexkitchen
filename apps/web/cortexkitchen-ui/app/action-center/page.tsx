"use client";

// Action Center -- dedicated primary-nav home for the Action Queue (trust-
// ladder approvals + audit trail). Pending approvals (ActionQueuePanel) and
// history (ActionQueueHistory, moved here from /data -- it never belonged
// under "Data") both live on this one page now.
//
// P6-A31 (visual redesign pass): a single "Needs Your Attention" hero
// featuring the most urgent pending item, a 4-way status stat strip that
// jumps into History pre-filtered, and one shared fetch of the full action
// list -- Panel/Stats/History all render off the same data instead of each
// hitting GET /action-queue separately.

import { useCallback, useEffect, useRef, useState } from "react";
import ActionQueuePanel, { ActionDetailsModal } from "@/components/dashboard/ActionQueuePanel";
import ActionQueueHistory, { type StatusTab } from "@/components/data/ActionQueueHistory";
import ActionQueueStats, { type StatusKey } from "@/components/actioncenter/ActionQueueStats";
import ActionAttentionHero from "@/components/actioncenter/ActionAttentionHero";
import { approveAction, getActionQueue, type ActionQueueItem } from "@/lib/api";

export default function ActionCenterPage() {
  const [allActions, setAllActions] = useState<ActionQueueItem[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [historyTab, setHistoryTab] = useState<StatusTab>("all");
  const [detailsAction, setDetailsAction] = useState<ActionQueueItem | null>(null);
  const [detailsBusy, setDetailsBusy] = useState(false);
  const [detailsError, setDetailsError] = useState<string | undefined>(undefined);
  const historyRef = useRef<HTMLDivElement | null>(null);

  const refetch = useCallback(() => {
    getActionQueue()
      .then((data) => setAllActions(data))
      .catch(() => {})
      .finally(() => setLoaded(true));
  }, []);

  useEffect(() => { refetch(); }, [refetch]);

  const pendingActions = allActions.filter((a) => a.status === "pending");
  const heroAction = pendingActions[0];
  // The hero already gives the top item full-detail treatment -- don't show
  // it a second time in the list right below it.
  const queueActions = pendingActions.filter((a) => a.id !== heroAction?.id);
  const queueEmptyMessage = heroAction && queueActions.length === 0
    ? "The one item that needs a decision is featured above."
    : undefined;

  const counts: Record<StatusKey, number> = {
    pending: pendingActions.length,
    executed: allActions.filter((a) => a.status === "executed").length,
    approved: allActions.filter((a) => a.status === "approved").length,
    rejected: allActions.filter((a) => a.status === "rejected").length,
  };

  const handleStatSelect = (status: StatusKey) => {
    setHistoryTab(status);
    historyRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const handleHeroApprove = async (action: ActionQueueItem) => {
    setDetailsBusy(true);
    try {
      const result = await approveAction(action.id);
      if (result.error) setDetailsError(result.error);
      else { setDetailsAction(null); refetch(); }
    } catch (err) {
      setDetailsError(err instanceof Error ? err.message : "Approve failed.");
    } finally {
      setDetailsBusy(false);
    }
  };

  return (
    <main className="min-h-screen bg-[var(--color-surface-sunken)] px-5 py-6 text-[var(--color-text-primary)] xl:px-8">
      <div className="mx-auto max-w-[1200px] space-y-6">
        <header className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-[34px] font-bold text-[var(--color-text-primary)]">Action Center</h1>
            <div className="mt-2 h-1 w-12 rounded-full" style={{ background: "var(--color-accent)" }} />
            <p className="mt-3 max-w-2xl text-sm text-[var(--color-text-soft)]">
              Everything waiting on your approval, in one place. Approve it, dismiss it, or look back at what you&apos;ve already decided.
            </p>
          </div>
          {loaded && pendingActions.length > 0 && (
            <span
              className="inline-flex shrink-0 items-center gap-1.5 rounded-full px-3.5 py-1.5 text-[12px] font-semibold"
              style={{ background: "var(--color-accent-soft)", color: "var(--color-accent)" }}
            >
              <svg viewBox="0 0 24 24" fill="currentColor" className="h-3.5 w-3.5">
                <path d="M11.983 1.5a.75.75 0 01.75.75v.06a8.25 8.25 0 016.75 8.108v3.05l1.2 2.4a.75.75 0 01-.67 1.087H4.987a.75.75 0 01-.67-1.087l1.2-2.4v-3.05a8.25 8.25 0 016.75-8.109v-.06a.75.75 0 01.716-.75zM12 21a2.25 2.25 0 002.236-2h-4.472A2.25 2.25 0 0012 21z" />
              </svg>
              {pendingActions.length} Pending Approval{pendingActions.length !== 1 ? "s" : ""}
            </span>
          )}
        </header>

        {loaded && heroAction && (
          <ActionAttentionHero
            action={heroAction}
            onApproved={refetch}
            onDismissed={refetch}
            onViewDetails={() => { setDetailsError(undefined); setDetailsAction(heroAction); }}
          />
        )}

        {loaded && allActions.length > 0 && (
          <ActionQueueStats
            counts={counts}
            activeStatus={
              historyTab === "pending" || historyTab === "approved" || historyTab === "executed" || historyTab === "rejected"
                ? historyTab
                : undefined
            }
            onSelect={handleStatSelect}
          />
        )}

        <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
          {loaded ? (
            <ActionQueuePanel actions={queueActions} onActionTaken={refetch} emptyMessage={queueEmptyMessage} />
          ) : (
            <div className="card p-6"><p className="text-[11px] text-[var(--color-text-faint)]">Loading…</p></div>
          )}

          <div ref={historyRef} className="scroll-mt-6">
            {loaded ? (
              <ActionQueueHistory actions={allActions} activeTab={historyTab} onTabChange={setHistoryTab} />
            ) : (
              <div className="card p-6"><p className="text-[11px] text-[var(--color-text-faint)]">Loading…</p></div>
            )}
          </div>
        </div>
      </div>

      {detailsAction && (
        <ActionDetailsModal
          action={detailsAction}
          busy={detailsBusy}
          error={detailsError}
          onClose={() => setDetailsAction(null)}
          onApprove={handleHeroApprove}
        />
      )}
    </main>
  );
}
