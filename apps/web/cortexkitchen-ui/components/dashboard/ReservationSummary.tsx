// components/dashboard/ReservationSummary.tsx
"use client";

interface ReservationData {
  data?: {
    total_reservations?: number;
    total_guests?: number;
    capacity?: number;
    occupancy_pct?: number;
    overbooking_risk?: boolean;
    busiest_hour?: number | null;
    date?: string;
    waitlist_count?: number;
  };
  recommendation?: {
    reasoning?: string;
    priority?: string;
    [key: string]: unknown;
  };
  [key: string]: unknown;
}

function asNumber(value: unknown, fallback = 0) {
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : fallback;
}

function asString(value: unknown, fallback = "") {
  return typeof value === "string" ? value : fallback;
}

export default function ReservationSummary({ data, compact = false }: { data: ReservationData; compact?: boolean }) {
  // Handle both direct data object and nested structure
  const source = data as Record<string, unknown>;
  const dataObj = (source.data as Record<string, unknown> | undefined) || source;
  const explicitRecommendation =
    source.recommendation && typeof source.recommendation === "object"
      ? (source.recommendation as Record<string, unknown>)
      : null;
  const fallbackRecommendationKeys = Object.fromEntries(
    Object.entries(source).filter(([key]) => ![
      "data",
      "date",
      "total_reservations",
      "total_guests",
      "capacity",
      "occupancy_pct",
      "overbooking_risk",
      "busiest_hour",
      "waitlist_count",
    ].includes(key))
  );
  const recommendation =
    explicitRecommendation ??
    (Object.keys(fallbackRecommendationKeys).length > 0
      ? fallbackRecommendationKeys
      : null);

  if (!dataObj || Object.keys(dataObj).length === 0) {
    return <p className="text-sm text-slate-600 italic">No reservation data available.</p>;
  }

  const total_reservations = asNumber(dataObj.total_reservations);
  const total_guests = asNumber(dataObj.total_guests);
  const capacity = asNumber(dataObj.capacity, 70);
  const occupancy_pct = asNumber(dataObj.occupancy_pct);
  const overbooking_risk = dataObj.overbooking_risk === true;
  const busiest_hour = dataObj.busiest_hour === null || dataObj.busiest_hour === undefined ? null : asNumber(dataObj.busiest_hour);
  const date = asString(dataObj.date);
  const waitlist_count = asNumber(dataObj.waitlist_count);

  return (
    <div className="space-y-4">
      {/* Main metrics — 2×2 grid */}
      <div className="grid grid-cols-2 gap-2.5">
        <div className="rounded-lg bg-white/[0.025] ring-1 ring-white/[0.06] p-3">
          <div className="font-mono text-[9px] uppercase tracking-[0.18em] text-white/45">Reservations</div>
          <div className="mt-1 text-3xl font-semibold text-cyan-300">{total_reservations}</div>
          <div className="text-[10px] text-white/40 mt-0.5">bookings for {date}</div>
        </div>

        <div className="rounded-lg bg-white/[0.025] ring-1 ring-white/[0.06] p-3">
          <div className="font-mono text-[9px] uppercase tracking-[0.18em] text-white/45">Total guests</div>
          <div className="mt-1 text-3xl font-semibold text-cyan-300">{total_guests}</div>
          <div className="text-[10px] text-white/40 mt-0.5">of {capacity} capacity</div>
        </div>

        <div className={`rounded-lg ring-1 p-3 ${
          occupancy_pct > 85 ? "ring-rose-400/25 bg-rose-500/[0.04]"
          : occupancy_pct > 70 ? "ring-ember-400/25 bg-ember-500/[0.04]"
          : "ring-white/[0.06] bg-white/[0.025]"
        }`}>
          <div className="font-mono text-[9px] uppercase tracking-[0.18em] text-white/45">Occupancy</div>
          <div className={`mt-1 text-3xl font-semibold ${
            occupancy_pct > 85 ? "text-rose-300" : occupancy_pct > 70 ? "text-ember-300" : "text-emerald-300"
          }`}>
            {occupancy_pct}<span className="text-xl opacity-60">%</span>
          </div>
          {overbooking_risk
            ? <div className="text-[10px] text-rose-300/80 mt-0.5">above target · overbooking risk</div>
            : occupancy_pct > 85
            ? <div className="text-[10px] text-rose-300/80 mt-0.5">above target 80%</div>
            : null}
        </div>

        <div className="rounded-lg bg-white/[0.025] ring-1 ring-white/[0.06] p-3">
          <div className="font-mono text-[9px] uppercase tracking-[0.18em] text-white/45">Peak hour</div>
          <div className="mt-1 text-3xl font-semibold text-ember-300">
            {busiest_hour !== null && busiest_hour !== undefined
              ? `${String(busiest_hour).padStart(2, "0")}:00`
              : "--"}
          </div>
          {waitlist_count > 0 && <div className="text-[10px] text-ember-300/80 mt-0.5">{waitlist_count} on waitlist</div>}
        </div>
      </div>

      {recommendation && (
        <div className="rounded-lg bg-white/[0.02] ring-1 ring-white/[0.05] p-3.5 space-y-3 w-full">
          {/* String recommendation */}
          {typeof recommendation === "string" && (
            <div className="w-full">
              <div className="font-mono text-[9px] uppercase tracking-[0.18em] text-white/45 mb-1.5">Recommendation</div>
              <p className="text-[12px] leading-[1.65] text-white/65 break-words whitespace-normal">{recommendation}</p>
            </div>
          )}

          {/* Object recommendation */}
          {typeof recommendation === "object" && (
            <>
              {recommendation?.reasoning && typeof recommendation.reasoning === "string" && (
                <div className="w-full">
                  <div className="font-mono text-[9px] uppercase tracking-[0.18em] text-white/45 mb-1.5">Reasoning</div>
                  <p className="text-[12px] leading-[1.65] text-white/65 break-words whitespace-normal">
                    {recommendation.reasoning}
                  </p>
                </div>
              )}

              {recommendation?.priority && typeof recommendation.priority === "string" && (
                <div>
                  <div className="font-mono text-[9px] uppercase tracking-[0.18em] text-white/45 mb-1.5">Priority</div>
                  <span className={`text-[10px] font-mono px-2.5 py-1 rounded-full inline-block ${
                    recommendation.priority === "high"   ? "bg-rose-500/15 text-rose-300 ring-1 ring-rose-400/25"
                    : recommendation.priority === "medium" ? "bg-ember-500/15 text-ember-300 ring-1 ring-ember-400/25"
                    : "bg-emerald-500/15 text-emerald-300 ring-1 ring-emerald-400/25"
                  }`}>
                    {recommendation.priority} priority
                  </span>
                </div>
              )}

              {Object.entries(recommendation)
                .filter(([key]) => !["reasoning", "priority"].includes(key))
                .map(([key, value]) => {
                  if (value === null || value === undefined) return null;
                  const label = key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

                  if (Array.isArray(value) && value.length > 0) {
                    const allItems = value.filter(item => item !== null && item !== undefined);
                    if (allItems.length === 0) return null;
                    const items = compact ? allItems.slice(0, 2) : allItems;
                    return (
                      <div key={key} className="pt-3 border-t border-white/[0.05] w-full">
                        <div className="font-mono text-[9px] uppercase tracking-[0.18em] text-white/45 mb-1.5">{label}</div>
                        <ul className="space-y-1 w-full">
                          {items.map((item, i) => {
                            const itemText = typeof item === "string" ? item
                              : typeof item === "object" && item !== null
                              ? String(Object.values(item).join("  —  "))
                              : String(item);
                            return (
                              <li key={i} className="text-[12px] text-white/65 flex gap-2 w-full break-words">
                                <span className="text-cyan-400/60 shrink-0">·</span>
                                <span className="whitespace-normal">{itemText}</span>
                              </li>
                            );
                          })}
                        </ul>
                        {compact && allItems.length > items.length && (
                          <p className="text-[11px] text-white/30 mt-1.5">+{allItems.length - items.length} more in details</p>
                        )}
                      </div>
                    );
                  }

                  if (typeof value === "object" && value !== null && !Array.isArray(value)) {
                    const entries = Object.entries(value as Record<string, unknown>).filter(([, v]) => v !== null && v !== undefined);
                    if (entries.length === 0) return null;
                    return (
                      <div key={key} className="pt-3 border-t border-white/[0.05] w-full">
                        <div className="font-mono text-[9px] uppercase tracking-[0.18em] text-white/45 mb-1.5">{label}</div>
                        <div className="space-y-1 w-full">
                          {entries.map(([subKey, subValue]) => (
                            <div key={subKey} className="flex gap-3 w-full">
                              <span className="text-[11px] text-white/40 w-24 shrink-0">{subKey.replace(/_/g, " ")}</span>
                              <span className="text-[11px] text-white/65 break-words whitespace-normal flex-1">{String(subValue)}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  }

                  return (
                    <div key={key} className="flex gap-3 w-full">
                      <span className="text-[11px] text-white/40 w-24 shrink-0">{label}</span>
                      <span className="text-[11px] text-white/65 break-words whitespace-normal flex-1">{String(value)}</span>
                    </div>
                  );
                })}
            </>
          )}
        </div>
      )}
    </div>
  );
}
