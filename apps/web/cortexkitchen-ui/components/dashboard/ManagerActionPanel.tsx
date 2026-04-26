"use client";

import { FridayRushResponse } from "@/types/planning";

interface Props {
  data: FridayRushResponse;
  compact?: boolean;
  onOpenDetail?: () => void;
}

interface ManagerSection {
  title: string;
  items: string[];
  tone: "good" | "default" | "warn" | "risk";
}

function asObject(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : null;
}

function takeStrings(value: unknown, limit = 3): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is string => typeof item === "string" && item.trim().length > 0)
    .slice(0, limit);
}

function buildManagerSections(data: FridayRushResponse): ManagerSection[] {
  const inventory = asObject(data.recommendations.inventory);
  const reservation = asObject(data.recommendations.reservation);
  const menu = asObject(data.recommendations.menu);
  const complaint = asObject(data.recommendations.complaint);

  const doNow = [
    ...takeStrings(inventory?.restock_actions, 2),
    ...takeStrings(menu?.highlight_items, 1).map((item) => `Feature ${item} in service brief`),
  ].slice(0, 3);

  const beforeService = [
    ...takeStrings(menu?.operational_notes, 2),
    ...takeStrings(complaint?.action_items, 1),
  ].slice(0, 3);

  const monitor = [
    typeof reservation?.occupancy_pct !== "undefined"
      ? `Watch occupancy pacing at ${Math.round(Number(reservation.occupancy_pct))}%`
      : null,
    typeof reservation?.waitlist_count !== "undefined" && Number(reservation.waitlist_count) > 0
      ? `Track waitlist movement (${reservation.waitlist_count} queued)`
      : null,
    ...takeStrings(menu?.complaint_watchouts, 1),
  ].filter(Boolean) as string[];

  const risks = [
    ...takeStrings(inventory?.risks, 2),
    ...takeStrings(menu?.risks, 1),
  ].slice(0, 3);

  return [
    { title: "Do Now", items: doNow, tone: "good" },
    { title: "Before Service", items: beforeService, tone: "default" },
    { title: "Monitor", items: monitor, tone: "warn" },
    { title: "Watchouts", items: risks, tone: "risk" },
  ];
}

export default function ManagerActionPanel({
  data,
  compact = false,
  onOpenDetail,
}: Props) {
  const sections = buildManagerSections(data);
  const surfacedCount = sections.reduce((count, section) => count + section.items.length, 0);

  if (compact) {
    const previewItems = sections.flatMap((section) =>
      section.items.slice(0, 1).map((item) => ({ label: section.title, item })),
    );

    return (
      <div className="card rounded-2xl p-4 stagger-3">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div className="space-y-1">
            <p className="text-xs font-mono uppercase tracking-[0.18em] text-slate-500">
              Manager Brief
            </p>
            <p className="text-sm text-slate-300">
              {surfacedCount > 0
                ? `${surfacedCount} actionable signals surfaced across inventory, menu, reservations, and complaints.`
                : "No urgent action clusters surfaced in the current planning run."}
            </p>
          </div>
          <button
            onClick={onOpenDetail}
            className="rounded-xl border border-cyan-400/20 bg-cyan-500/10 px-4 py-2 text-xs font-mono uppercase tracking-[0.16em] text-cyan-200 transition-colors hover:bg-cyan-500/15"
          >
            open manager brief
          </button>
        </div>

        {previewItems.length > 0 && (
          <div className="mt-4 grid grid-cols-1 xl:grid-cols-3 gap-3">
            {previewItems.slice(0, 3).map(({ label, item }, index) => (
              <div
                key={`${label}-${index}`}
                className="rounded-xl border border-white/10 bg-white/5 px-4 py-3"
              >
                <p className="text-[11px] font-mono uppercase tracking-[0.14em] text-slate-500 mb-2">
                  {label}
                </p>
                <p className="text-sm text-slate-200 leading-relaxed">{item}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="card rounded-2xl p-5 stagger-3">
      <div className="flex flex-col gap-1 mb-4">
        <p className="text-xs font-mono uppercase tracking-[0.18em] text-slate-500">
          Manager Actions
        </p>
        <p className="text-sm text-slate-400">
          A synthesized action view pulled from the current planning run
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        {sections.map((section) => (
          <ActionColumn
            key={section.title}
            title={section.title}
            items={section.items}
            tone={section.tone}
          />
        ))}
      </div>
    </div>
  );
}

function ActionColumn({
  title,
  items,
  tone,
}: {
  title: string;
  items: string[];
  tone: "good" | "default" | "warn" | "risk";
}) {
  const toneClass =
    tone === "good"
      ? "border-emerald-500/20 bg-emerald-500/5"
      : tone === "warn"
      ? "border-amber-500/20 bg-amber-500/5"
      : tone === "risk"
      ? "border-rose-500/20 bg-rose-500/5"
      : "border-white/5 bg-slate-900/60";

  return (
    <div className={`rounded-xl border p-4 ${toneClass}`}>
      <p className="text-xs font-mono uppercase tracking-widest text-slate-500 mb-3">
        {title}
      </p>
      {items.length > 0 ? (
        <ul className="space-y-2">
          {items.map((item, index) => (
            <li key={`${title}-${index}`} className="text-xs text-slate-200 leading-relaxed">
              {item}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-xs text-slate-500">No urgent items surfaced in this category.</p>
      )}
    </div>
  );
}
