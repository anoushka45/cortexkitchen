"use client";

import AnalyticsDetail from "@/components/analytics/AnalyticsDetail";

export default function AnalyticsPage() {
  return (
    <main className="min-h-screen bg-[var(--color-surface)] px-5 py-6 text-[var(--color-text-primary)] xl:px-8">
      <div className="mx-auto max-w-[1520px] space-y-6">
        <header className="border-b border-[var(--color-border-default)] pb-5">
          <p className="text-xs uppercase tracking-[0.22em] text-[var(--color-accent)]">analytics</p>
          <h1 className="display mt-2 text-[32px] text-[var(--color-text-primary)]">Analytics</h1>
          <p className="mt-1 max-w-2xl text-sm text-[var(--color-text-soft)]">
            Menu performance, demand patterns, guest sentiment, and market positioning -- historical trends, not a daily trigger-time decision.
          </p>
        </header>

        <AnalyticsDetail />
      </div>
    </main>
  );
}
