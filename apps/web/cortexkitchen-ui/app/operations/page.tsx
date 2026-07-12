"use client";

// P6-A26 — /operations was merged into /dashboard (agent cards, forecast
// chart, critic banner all render inline there now, no separate page
// navigation needed to watch a plan build/complete). This route stays only
// to redirect old bookmarks/links (including ?run=<id> deep links) rather
// than 404ing.

import { Suspense, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";

function OperationsRedirect() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const run = searchParams.get("run");
    router.replace(run ? `/dashboard?run=${run}` : "/dashboard");
  }, [router, searchParams]);

  return null;
}

export default function OperationsPage() {
  return (
    <Suspense fallback={null}>
      <OperationsRedirect />
    </Suspense>
  );
}
