"use client";

// Action Center -- dedicated primary-nav home for the Action Queue (trust-
// ladder approvals + audit trail). Pending approvals (ActionQueuePanel) and
// history (ActionQueueHistory, moved here from /data -- it never belonged
// under "Data") both live on this one page now.

import ActionQueuePanel from "@/components/dashboard/ActionQueuePanel";
import ActionQueueHistory from "@/components/data/ActionQueueHistory";

export default function ActionCenterPage() {
  return (
    <main className="min-h-screen bg-[var(--color-surface)] px-5 py-6 text-[var(--color-text-primary)] xl:px-8">
      <div className="mx-auto max-w-[1200px] space-y-6">
        <header className="border-b border-[var(--color-border-default)] pb-5">
          <p className="text-xs uppercase tracking-[0.22em] text-[var(--color-accent)]">action center</p>
          <h1 className="display mt-2 text-[32px] text-[var(--color-text-primary)]">Action Center</h1>
          <p className="mt-1 max-w-2xl text-sm text-[var(--color-text-soft)]">
            Every recommendation the agents want to act on, gated by your trust ladder -- approve, dismiss, and see the full history.
          </p>
        </header>

        <ActionQueuePanel />
        <ActionQueueHistory />
      </div>
    </main>
  );
}
