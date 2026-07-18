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
import { shortagesOf } from "@/components/actioncenter/actionQueueMeta";
import PageHeading from "@/components/ui/PageHeading";
import { approveAction, getActionQueue, type ActionQueueItem } from "@/lib/api";

const SNOOZE_KEY = "ck_snoozed_actions";
const SNOOZE_MS = 60 * 60 * 1000;

function loadSnoozed(): Record<number, number> {
  if (typeof window === "undefined") return {};
  try {
    const raw = JSON.parse(window.localStorage.getItem(SNOOZE_KEY) ?? "{}");
    const now = Date.now();
    const fresh: Record<number, number> = {};
    for (const [id, expiry] of Object.entries(raw)) {
      if (typeof expiry === "number" && expiry > now) fresh[Number(id)] = expiry;
    }
    return fresh;
  } catch {
    return {};
  }
}

export default function ActionCenterPage() {
  const [allActions, setAllActions] = useState<ActionQueueItem[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [historyTab, setHistoryTab] = useState<StatusTab>("all");
  const [detailsAction, setDetailsAction] = useState<ActionQueueItem | null>(null);
  const [detailsBusy, setDetailsBusy] = useState(false);
  const [detailsError, setDetailsError] = useState<string | undefined>(undefined);
  const [snoozed, setSnoozed] = useState<Record<number, number>>({});
  const historyRef = useRef<HTMLDivElement | null>(null);

  const refetch = useCallback(() => {
    getActionQueue()
      .then((data) => setAllActions(data))
      .catch(() => {})
      .finally(() => setLoaded(true));
  }, []);

  useEffect(() => { refetch(); setSnoozed(loadSnoozed()); }, [refetch]);

  const handleSnooze = (id: number) => {
    const next = { ...snoozed, [id]: Date.now() + SNOOZE_MS };
    setSnoozed(next);
    window.localStorage.setItem(SNOOZE_KEY, JSON.stringify(next));
  };

  const pendingActions = allActions.filter((a) => a.status === "pending");
  const featurable = pendingActions.filter((a) => !snoozed[a.id]);
  // The hero is for the most critical thing right now -- a critical-shortage
  // restock alert -- not just whichever pending item is newest or highest-tier.
  const heroAction = featurable.find((a) => a.category === "restock_alert") ?? featurable[0];
  // A restock_alert's top shortage may already have a linked WhatsApp draft
  // (same ingredient, created alongside it) -- the hero's "message vendor"
  // button opens that exact pending action instead of inventing a new one.
  const heroTopIngredient = heroAction ? shortagesOf(heroAction)[0]?.ingredient : undefined;
  const linkedWhatsappAction = heroTopIngredient
    ? pendingActions.find((a) => a.category === "whatsapp_vendor_order" && a.payload.ingredient === heroTopIngredient)
    : undefined;
  // The hero already gives the top item full-detail treatment -- don't show
  // it (or its linked WhatsApp draft) a second time in the list right below it.
  const queueActions = pendingActions.filter((a) => a.id !== heroAction?.id && a.id !== linkedWhatsappAction?.id);
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
    <main className="min-h-screen page-canvas px-5 py-6 text-[var(--color-text-primary)] xl:px-8">
      <div className="mx-auto max-w-[1200px] space-y-6">
        <PageHeading
          title="Action Center"
          description="Everything waiting on your approval, in one place. Approve it, dismiss it, or look back at what you've already decided."
          action={
            loaded && pendingActions.length > 0 && (
              <span
                className="inline-flex shrink-0 items-center gap-1.5 rounded-full px-3.5 py-1.5 text-[12px] font-semibold"
                style={{ background: "var(--color-accent-soft)", color: "var(--color-accent)" }}
              >
                <svg viewBox="0 0 24 24" fill="currentColor" className="h-3.5 w-3.5">
                  <path d="M11.983 1.5a.75.75 0 01.75.75v.06a8.25 8.25 0 016.75 8.108v3.05l1.2 2.4a.75.75 0 01-.67 1.087H4.987a.75.75 0 01-.67-1.087l1.2-2.4v-3.05a8.25 8.25 0 016.75-8.109v-.06a.75.75 0 01.716-.75zM12 21a2.25 2.25 0 002.236-2h-4.472A2.25 2.25 0 0012 21z" />
                </svg>
                {pendingActions.length} Pending Approval{pendingActions.length !== 1 ? "s" : ""}
              </span>
            )
          }
        />

        {loaded && heroAction && (
          <ActionAttentionHero
            action={heroAction}
            linkedWhatsappAction={linkedWhatsappAction}
            onDismissed={refetch}
            onOpenAction={(a) => { setDetailsError(undefined); setDetailsAction(a); }}
            onSnoozed={() => handleSnooze(heroAction.id)}
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
