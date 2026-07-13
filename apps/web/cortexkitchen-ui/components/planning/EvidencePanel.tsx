"use client";

// P6-A30 -- explicit "what fed this plan" section. All of this data was
// already computed (market_intel_output/live_signals_text, rag_context,
// forecast adjustment_reasons) -- it just never had a single place labelling
// it as evidence for the user.

import { FridayRushResponse } from "@/types/planning";

function EvidenceItem({ label, detail }: { label: string; detail?: string }) {
  return (
    <div className="flex items-start gap-2.5 py-1.5">
      <svg className="h-3.5 w-3.5 shrink-0 mt-0.5 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
      </svg>
      <div>
        <p className="text-[13px] text-[var(--color-text-primary)]">{label}</p>
        {detail && <p className="text-[11px] text-[var(--color-text-faint)] mt-0.5">{detail}</p>}
      </div>
    </div>
  );
}

export default function EvidencePanel({ data }: { data: FridayRushResponse }) {
  const forecast = data.recommendations?.forecast as Record<string, unknown> | null;
  const forecastData = (forecast?.data as Record<string, unknown> | undefined) ?? {};
  const adjustmentReasons = forecastData.adjustment_reasons as string[] | undefined;
  const liveSignalsText = data.market_intel?.live_signals_text ?? "";

  const items: { label: string; detail?: string }[] = [
    { label: "Historical order & reservation data", detail: "Demand forecast, top items, occupancy pressure" },
  ];

  if (adjustmentReasons && adjustmentReasons.length > 0) {
    items.push({ label: "Weather & holiday signals", detail: adjustmentReasons.join(", ") });
  }
  if (data.market_intel) {
    items.push({ label: "Swiggy market intelligence", detail: "Area pricing, occupancy, Dineout availability (anonymised, area-level only)" });
  }
  if (liveSignalsText.includes("Industry Trends")) {
    items.push({ label: "Industry trends", detail: "Curated F&B/agri-business RSS digest" });
  }
  if (liveSignalsText.includes("Regulatory Alerts")) {
    items.push({ label: "Regulatory alerts", detail: "FSSAI public notices" });
  }
  const ragCount = (data.rag_context?.complaints?.length ?? 0) + (data.rag_context?.sops?.length ?? 0);
  if (ragCount > 0) {
    items.push({ label: "Retrieved memory", detail: `${ragCount} relevant past complaint(s)/SOP(s) via RAG` });
  }

  return (
    <div className="rounded-lg border border-[var(--color-border-default)] bg-[var(--color-surface-raised)] p-4">
      <h3 className="text-sm font-semibold">Evidence</h3>
      <p className="text-xs text-[var(--color-text-faint)] mb-2">Data sources that fed this plan.</p>
      <div className="divide-y divide-[var(--color-border-soft)]">
        {items.map((item, i) => <EvidenceItem key={i} {...item} />)}
      </div>
    </div>
  );
}
