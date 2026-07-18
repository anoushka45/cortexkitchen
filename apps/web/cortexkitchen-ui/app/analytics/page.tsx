"use client";

import AnalyticsDetail from "@/components/analytics/AnalyticsDetail";
import PageHeading from "@/components/ui/PageHeading";

export default function AnalyticsPage() {
  return (
    <main className="min-h-screen page-canvas px-5 py-6 text-[var(--color-text-primary)] xl:px-8">
      <div className="mx-auto max-w-[1520px] space-y-6">
        <PageHeading
          title="Analytics"
          description="Menu performance, demand patterns, guest sentiment, and market positioning -- historical trends, not a daily trigger-time decision."
        />

        <AnalyticsDetail />
      </div>
    </main>
  );
}
