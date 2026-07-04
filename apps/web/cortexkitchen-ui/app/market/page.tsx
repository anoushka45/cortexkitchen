"use client";

import { Suspense } from "react";
import Image from "next/image";
import Link from "next/link";
import SwiggyMarketIntelPanel from "@/components/dashboard/SwiggyMarketIntelPanel";
import SwiggyStatusWidget from "@/components/dashboard/SwiggyStatusWidget";
import { useSelectedRun } from "@/hooks/useSelectedRun";

function MarketContent() {
  const { data, status, error } = useSelectedRun();

  return (
    <div className="min-h-screen bg-[var(--color-surface-page)] text-[var(--color-text-primary)]">
      <main className="mx-auto w-full max-w-[1520px] px-6 py-8 xl:px-14">

        <header className="flex flex-col gap-4 border-b border-[var(--color-border-default)] pb-5 sm:flex-row sm:items-end sm:justify-between">
          <div className="flex items-start gap-3">
            <div className="mt-1 grid h-9 w-9 shrink-0 place-items-center overflow-hidden rounded-lg bg-black ring-1 ring-[var(--color-border-default)]">
              <Image src="/swiggy-logo.png" alt="Swiggy" width={28} height={28} className="h-7 w-7 object-contain" />
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.22em] text-[var(--color-accent)]">via swiggy mcp</p>
              <h1 className="display mt-2 text-[32px] text-[var(--color-text-primary)]">Market Intelligence</h1>
              <p className="mt-1 max-w-2xl text-sm text-[var(--color-text-soft)]">
                Live competitor pricing, area demand, and Instamart procurement from Swiggy — used to shape tonight&apos;s menu and pricing strategy.
              </p>
            </div>
          </div>
          <Link href="/dashboard" className="shrink-0 rounded-lg border border-[var(--color-border-default)] px-3 py-2 text-xs text-[var(--color-text-soft)] hover:bg-[var(--color-surface-raised)] hover:text-[var(--color-text-primary)] transition-colors">
            ← dashboard
          </Link>
        </header>

        <div className="mt-6">
          <SwiggyStatusWidget />
        </div>

        <div className="mt-6">
          {status === "loading" && (
            <p className="text-sm text-[var(--color-text-faint)]">Loading the last plan…</p>
          )}

          {status === "empty" && (
            <div className="rounded-xl border border-[var(--color-border-default)] bg-[var(--color-surface-raised)] px-6 py-10 text-center">
              <p className="text-sm font-medium text-[var(--color-text-primary)]">No plans yet</p>
              <p className="mt-1 text-sm text-[var(--color-text-faint)]">
                Run your first plan from the dashboard to see live competitor and Instamart data here.
              </p>
              <Link href="/dashboard" className="mt-4 inline-block text-sm text-[var(--color-accent)] underline underline-offset-4">
                Go to dashboard
              </Link>
            </div>
          )}

          {status === "error" && (
            <p className="text-sm text-rose-400">{error ?? "Could not load this run."}</p>
          )}

          {status === "success" && data && <SwiggyMarketIntelPanel data={data} />}
        </div>
      </main>
    </div>
  );
}

export default function MarketPage() {
  return (
    <Suspense fallback={null}>
      <MarketContent />
    </Suspense>
  );
}
