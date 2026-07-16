"use client";

// P6-A28 -- merges the old /runs (plan run history) and /data-health (sync
// status, freshness) pages into one Data page, and adds an Action Queue
// history section that had no home anywhere before. Also fixes the /runs/{id}
// deep-link 404: there was never a dynamic route for it, so this page reads
// the id from ?run=<id> instead (same convention /dashboard already uses).

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import SectionHeader from "@/components/dashboard/SectionHeader";
import RunHistorySection from "@/components/data/RunHistorySection";
import DataHealthSection from "@/components/data/DataHealthSection";

function DataPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [initialRunId, setInitialRunId] = useState<number | undefined>(undefined);

  useEffect(() => {
    const runId = searchParams.get("run");
    if (runId) {
      setInitialRunId(Number(runId));
      router.replace("/data");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  return (
    <main className="min-h-screen bg-[var(--color-surface)] px-5 py-6 text-[var(--color-text-primary)] xl:px-8">
      <div className="mx-auto max-w-[1520px] space-y-8">

        <header className="flex flex-col gap-4 border-b border-[var(--color-border-default)] pb-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.22em] text-[var(--color-accent)]">data</p>
            <h1 className="display mt-2 text-[32px] text-[var(--color-text-primary)]">Data</h1>
            <p className="mt-1 max-w-2xl text-sm text-[var(--color-text-soft)]">
              Every plan your kitchen has run and the source data behind it.
            </p>
          </div>
        </header>

        <div className="space-y-4">
          <SectionHeader
            label="Run History"
            description="Every plan run -- verdict, scores, agent findings, and exports. Select any run to inspect or compare."
            tone="ember"
          />
          <RunHistorySection initialRunId={initialRunId} />
        </div>

        <div className="space-y-4">
          <SectionHeader
            label="Data Health"
            description="Current database coverage used by forecasts, reservations, complaint analysis, menu planning, and inventory checks."
            tone="cyan"
          />
          <DataHealthSection />
        </div>

      </div>
    </main>
  );
}

export default function DataPage() {
  return (
    <Suspense fallback={null}>
      <DataPageContent />
    </Suspense>
  );
}
