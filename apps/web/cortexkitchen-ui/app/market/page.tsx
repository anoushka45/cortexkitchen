"use client";

import Image from "next/image";
import Link from "next/link";
import MarketTrendChart from "@/components/dashboard/MarketTrendChart";
import SwiggyLiveMarketPanel from "@/components/dashboard/SwiggyLiveMarketPanel";
import SwiggyStatusWidget from "@/components/dashboard/SwiggyStatusWidget";
import PageHeading from "@/components/ui/PageHeading";

export default function MarketPage() {
  return (
    <div className="min-h-screen page-canvas text-[var(--color-text-primary)]">
      <main className="mx-auto w-full max-w-[1520px] px-6 py-8 xl:px-14">

        <PageHeading
          title="Market Intelligence"
          description="Always-on competitor pricing, deals, area demand, and Instamart procurement from Swiggy — available anytime, independent of running a plan. This is the signal your next plan run injects."
          icon={
            <div className="mt-1 grid h-9 w-9 shrink-0 place-items-center overflow-hidden rounded-lg bg-black ring-1 ring-[var(--color-border-default)]">
              <Image src="/swiggy-logo.png" alt="Swiggy" width={28} height={28} className="h-7 w-7 object-contain" />
            </div>
          }
          action={
            <Link href="/dashboard" className="shrink-0 rounded-lg border border-[var(--color-border-default)] px-3 py-2 text-xs text-[var(--color-text-soft)] hover:bg-[var(--color-surface-raised)] hover:text-[var(--color-text-primary)] transition-colors">
              ← dashboard
            </Link>
          }
        />

        <div className="mt-6">
          <SwiggyStatusWidget />
        </div>

        <div className="mt-6">
          <SwiggyLiveMarketPanel />
        </div>

        <div className="mt-6">
          <MarketTrendChart />
        </div>
      </main>
    </div>
  );
}
