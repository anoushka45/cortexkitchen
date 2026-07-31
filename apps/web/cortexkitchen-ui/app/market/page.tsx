"use client";

import SwiggyLiveMarketPanel from "@/components/dashboard/SwiggyLiveMarketPanel";
import SwiggyStatusWidget from "@/components/dashboard/SwiggyStatusWidget";
import PageHeading from "@/components/ui/PageHeading";

export default function MarketPage() {
  return (
    <main className="min-h-screen page-canvas px-5 py-6 text-[var(--color-text-primary)] xl:px-8">
      <div className="mx-auto max-w-[1520px]">

        <div className="flex flex-wrap items-start justify-between gap-6">
          <PageHeading
            title="Market Intelligence"
            description={
              <>
                <span className="flex flex-wrap gap-1.5">
                  {["Weather & holidays", "Industry trends", "Regulatory alerts", "Swiggy signals"].map((t) => (
                    <span
                      key={t}
                      className="rounded-full px-2.5 py-1 text-[11.5px] font-semibold"
                      style={{ background: "rgba(255,82,0,0.08)", color: "var(--color-accent)" }}
                    >
                      {t}
                    </span>
                  ))}
                </span>
                <span className="mt-2 block text-[13px] text-[var(--color-text-faint)]">
                  Available anytime — the signal your next plan run injects.
                </span>
              </>
            }
          />
          <SwiggyStatusWidget />
        </div>

        <div className="mt-6">
          <SwiggyLiveMarketPanel />
        </div>
      </div>
    </main>
  );
}
