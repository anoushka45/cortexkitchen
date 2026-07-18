// Shared category/priority/icon language for Action Center's hero card,
// pending panel, and history timeline -- kept in one place so all three
// surfaces render the same category identical to each other.

import type { ActionQueueItem } from "@/lib/api";

export const CATEGORY_LABELS: Record<string, string> = {
  whatsapp_vendor_order: "WhatsApp vendor order",
  restock_alert: "Restock",
  pricing_promo_review: "Pricing Review",
};

export const AGENT_LABELS: Record<string, string> = {
  whatsapp_vendor_order: "Procurement Agent",
  restock_alert: "Inventory Agent",
  pricing_promo_review: "Market Intel Agent",
};

// Text/icon tone per category -- WhatsApp reads green (brand-consistent),
// Restock reads amber (matches the existing caution/inventory language),
// Pricing Review gets a distinct cyan so all three are never confusable.
export const CATEGORY_TONE: Record<string, string> = {
  whatsapp_vendor_order: "var(--color-good)",
  restock_alert: "var(--color-caution)",
  pricing_promo_review: "#38bdf8",
};

export const CATEGORY_TONE_SOFT: Record<string, string> = {
  whatsapp_vendor_order: "var(--color-good-soft)",
  restock_alert: "var(--color-caution-soft)",
  pricing_promo_review: "rgba(56,189,248,0.10)",
};

export type Shortage = {
  ingredient: string;
  unit?: string;
  quantity_in_stock?: number;
  reorder_threshold?: number;
  shortfall?: number;
  recommended_restock_qty?: number;
  suggested_vendor?: string | null;
  reason?: string | null;
  severity?: string;
};

export function shortagesOf(action: ActionQueueItem): Shortage[] {
  const raw = action.payload?.shortages;
  return Array.isArray(raw) ? (raw as Shortage[]) : [];
}

/** "High Priority" for anything approve-gated or carrying a critical shortage,
 * "Medium Priority" otherwise -- derived from real fields, never fabricated. */
export function priorityLabel(action: ActionQueueItem): "High Priority" | "Medium Priority" {
  const hasCritical = shortagesOf(action).some((s) => s.severity === "critical");
  if (action.tier === "approve_required" || hasCritical) return "High Priority";
  return "Medium Priority";
}

export function CategoryIcon({ category, className = "h-5 w-5" }: { category: string; className?: string }) {
  if (category === "whatsapp_vendor_order") {
    return (
      <svg viewBox="0 0 24 24" fill="none" className={className} stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
      </svg>
    );
  }
  if (category === "pricing_promo_review") {
    return (
      <svg viewBox="0 0 24 24" fill="none" className={className} stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M7 7h.01M7 3h5.586a1 1 0 01.707.293l7.414 7.414a1 1 0 010 1.414l-8.586 8.586a1 1 0 01-1.414 0L3.293 13.293A1 1 0 013 12.586V7a4 4 0 014-4z" />
      </svg>
    );
  }
  // restock_alert / default
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
    </svg>
  );
}

export function CheckIcon({ className = "h-3.5 w-3.5", strokeWidth = 2.4 }: { className?: string; strokeWidth?: number }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} stroke="currentColor" strokeWidth={strokeWidth}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
    </svg>
  );
}

export function XIcon({ className = "h-3.5 w-3.5", strokeWidth = 2.4 }: { className?: string; strokeWidth?: number }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} stroke="currentColor" strokeWidth={strokeWidth}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
    </svg>
  );
}

export function InfoIcon({ className = "h-3.5 w-3.5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M11.25 11.25h.375c.207 0 .375.168.375.375v4.5m-.75-9h.008v.008h-.008V6.75zM21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}

export function EyeIcon({ className = "h-3.5 w-3.5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  );
}

export function HourglassIcon({ className = "h-4 w-4", strokeWidth = 1.8 }: { className?: string; strokeWidth?: number }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} stroke="currentColor" strokeWidth={strokeWidth}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}

export function ThumbUpIcon({ className = "h-4 w-4", strokeWidth = 1.8 }: { className?: string; strokeWidth?: number }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} stroke="currentColor" strokeWidth={strokeWidth}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M6.633 10.5c.806 0 1.533-.446 2.031-1.08a9.041 9.041 0 012.861-2.4c.723-.384 1.35-.956 1.653-1.715a4.498 4.498 0 00.322-1.672V3a.75.75 0 01.75-.75A2.25 2.25 0 0116.5 4.5c0 1.152-.26 2.243-.723 3.218-.266.558.107 1.282.725 1.282h3.126c1.026 0 1.945.694 2.054 1.715.045.422.068.85.068 1.285a11.95 11.95 0 01-2.649 7.521c-.388.482-.987.729-1.605.729H13.48c-.483 0-.964-.078-1.423-.23l-3.114-1.04a4.501 4.501 0 00-1.423-.23H5.904M6.633 10.5H5.904m0 0H3.375A1.125 1.125 0 002.25 11.625v6.75A1.125 1.125 0 003.375 19.5h1.638a.75.75 0 00.75-.75v-7.5a.75.75 0 00-.75-.75z" />
    </svg>
  );
}
