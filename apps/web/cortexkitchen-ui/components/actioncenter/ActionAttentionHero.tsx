"use client";

import { useState } from "react";
import { rejectAction, searchIngredient, type ActionQueueItem, type IngredientSearchResult } from "@/lib/api";
import {
  ArrowRightIcon, BagIcon, ChannelIcon, ClockIcon, XIcon, shortagesOf,
} from "./actionQueueMeta";

function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

type InstamartStatus = "idle" | "loading" | "done" | "error" | "not_connected";

export default function ActionAttentionHero({
  action,
  linkedWhatsappAction,
  onDismissed,
  onOpenAction,
  onSnoozed,
}: {
  action: ActionQueueItem;
  linkedWhatsappAction?: ActionQueueItem | null;
  onDismissed: () => void;
  onOpenAction: (action: ActionQueueItem) => void;
  onSnoozed: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [instamartStatus, setInstamartStatus] = useState<InstamartStatus>("idle");
  const [instamartResults, setInstamartResults] = useState<IngredientSearchResult[]>([]);

  const shortages = shortagesOf(action);
  const top = shortages[0];

  const headline = top
    ? `${shortages.length} inventory item${shortages.length !== 1 ? "s" : ""} need${shortages.length !== 1 ? "" : "s"} your approval`
    : action.title;

  const detailText = top
    ? "Below threshold"
    : action.category === "pricing_promo_review"
      ? `${String(action.payload.area_deals_count ?? 0)} nearby deals live tonight`
      : null;

  // The ingredient to check on Instamart -- a restock_alert's top shortage,
  // or (when the hero itself IS a WhatsApp order draft) that action's own
  // ingredient, so "Check Instamart Price" still makes sense there too.
  const ingredientForSearch = top?.ingredient
    ?? (action.category === "whatsapp_vendor_order" ? String(action.payload.ingredient ?? "") : null);

  const whatsappVendorName = top?.whatsapp_vendor
    ?? (action.category === "whatsapp_vendor_order" ? String(action.payload.vendor ?? "Vendor") : null);

  const handleCheckInstamart = async () => {
    if (!ingredientForSearch) return;
    setInstamartStatus("loading");
    try {
      const res = await searchIngredient(ingredientForSearch);
      if (!res.swiggy_connected) { setInstamartStatus("not_connected"); return; }
      setInstamartResults(res.results);
      setInstamartStatus("done");
    } catch {
      setInstamartStatus("error");
    }
  };

  const handleMessageVendor = () => {
    if (action.category === "whatsapp_vendor_order") onOpenAction(action);
    else if (linkedWhatsappAction) onOpenAction(linkedWhatsappAction);
  };

  const handleDismiss = async () => {
    setBusy(true);
    try {
      await rejectAction(action.id);
      onDismissed();
    } catch {
      // leave the item in place on failure
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="card relative overflow-hidden p-4 sm:p-5"
      style={{
        borderLeftWidth: 4,
        borderLeftColor: "var(--color-accent)",
        background: "linear-gradient(115deg, var(--color-surface-raised) 0%, var(--color-accent-soft) 145%)",
      }}
    >
      <div className="relative flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span
            className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] font-bold leading-none text-white"
            style={{ background: "var(--color-critical)" }}
          >
            !
          </span>
          <p className="text-[13px] font-bold uppercase tracking-wide" style={{ color: "var(--color-critical)" }}>
            Action Required
          </p>
        </div>

        <h2 className="mt-1.5 text-[20px] font-bold leading-snug text-[var(--color-text-primary)]">
          {headline}
        </h2>

        <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-2">
          {top && (
            <span
              className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[13px] font-medium text-[var(--color-text-primary)]"
              style={{ background: "var(--color-accent-soft)" }}
            >
              <BagIcon className="h-3.5 w-3.5" />
              {capitalize(top.ingredient)}
              {top.quantity_in_stock !== undefined ? ` (${top.quantity_in_stock}${top.unit ?? ""})` : ""}
            </span>
          )}
          {detailText && (
            <span className="text-[13px] font-semibold" style={{ color: "var(--color-accent)" }}>
              {detailText}
            </span>
          )}
          {top?.recommended_restock_qty !== undefined && (
            <span className="text-[13px] font-medium text-[var(--color-text-soft)]">
              Restock {top.recommended_restock_qty}{top.unit ?? ""}
            </span>
          )}
        </div>

        {top?.reason && (
          <p className="mt-2 max-w-[460px] text-[13px] leading-relaxed text-[var(--color-text-faint)]">
            {top.reason}
          </p>
        )}

        {/* Two independent, human-decided options -- the system never picks
            one for the owner. Instamart is a real live price check (no cart/
            checkout yet: blocked on Swiggy staging creds); WhatsApp opens the
            real draft message to whichever local vendor is on file. */}
        {ingredientForSearch && (
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              onClick={handleCheckInstamart}
              disabled={instamartStatus === "loading"}
              className="inline-flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-[13px] font-semibold disabled:opacity-60"
              style={{ background: "var(--color-accent-soft)", color: "var(--color-accent)" }}
            >
              <ChannelIcon channel="instamart" className="h-4 w-4" />
              {instamartStatus === "loading" ? "Checking Instamart…" : "Check Instamart Price"}
            </button>
            {whatsappVendorName && (
              <button
                onClick={handleMessageVendor}
                className="inline-flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-[13px] font-semibold"
                style={{ background: "rgba(37,211,102,0.14)", color: "#1da851" }}
              >
                <ChannelIcon channel="whatsapp" className="h-4 w-4" />
                Message {whatsappVendorName} via WhatsApp
              </button>
            )}
          </div>
        )}

        {instamartStatus !== "idle" && (
          <div className="mt-2 max-w-[460px] rounded-lg border border-[var(--color-border-soft)] bg-[var(--color-surface-raised)] p-3">
            {instamartStatus === "not_connected" && (
              <p className="text-[12px] text-[var(--color-text-faint)]">Connect Swiggy to check live Instamart prices.</p>
            )}
            {instamartStatus === "error" && (
              <p className="text-[12px]" style={{ color: "var(--color-caution)" }}>Couldn&apos;t check Instamart price right now.</p>
            )}
            {instamartStatus === "done" && instamartResults.length === 0 && (
              <p className="text-[12px] text-[var(--color-text-faint)]">No matching products found on Instamart right now.</p>
            )}
            {instamartStatus === "done" && instamartResults.length > 0 && (
              <div className="space-y-1.5">
                {instamartResults.slice(0, 4).map((r, i) => (
                  <div key={i} className="flex items-center justify-between gap-2 text-[12px]">
                    <span className="min-w-0 truncate text-[var(--color-text-soft)]">{r.name}</span>
                    <span className="shrink-0 font-mono font-semibold text-[var(--color-text-primary)]">₹{r.price}/{r.unit}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        <div className="mt-3 flex flex-wrap gap-2 border-t border-[var(--color-border-soft)] pt-3">
          <button
            onClick={() => onOpenAction(action)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--color-border-default)] bg-[var(--color-surface-raised)] px-3.5 py-2 text-[13px] font-semibold text-[var(--color-text-soft)] transition-colors hover:border-[var(--color-text-faint)] hover:text-[var(--color-text-primary)]"
          >
            View Details
            <ArrowRightIcon />
          </button>
          <button
            onClick={handleDismiss}
            disabled={busy}
            className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--color-border-default)] bg-[var(--color-surface-raised)] px-3.5 py-2 text-[13px] font-semibold text-[var(--color-text-soft)] transition-colors hover:border-[var(--color-text-faint)] hover:text-[var(--color-text-primary)] disabled:opacity-50"
          >
            <XIcon />
            Dismiss
          </button>
          <button
            onClick={onSnoozed}
            className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--color-border-default)] bg-[var(--color-surface-raised)] px-3.5 py-2 text-[13px] font-semibold text-[var(--color-text-soft)] transition-colors hover:border-[var(--color-text-faint)] hover:text-[var(--color-text-primary)]"
          >
            <ClockIcon />
            Snooze 1hr
          </button>
        </div>
      </div>

      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/banners/inventory-graphics.png"
        alt=""
        aria-hidden="true"
        className="hidden h-[130px] w-auto shrink-0 self-center sm:block md:h-[150px] lg:h-[170px]"
      />
      </div>
    </div>
  );
}
