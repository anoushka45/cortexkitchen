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

export default function ReservationSummary({ data }: { data: ReservationData }) {
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

  const {
    total_reservations = 0,
    total_guests = 0,
    capacity = 70,
    occupancy_pct = 0,
    overbooking_risk = false,
    busiest_hour = null,
    date = "",
    waitlist_count = 0,
  } = dataObj as Record<string, unknown>;

  return (
    <div className="space-y-4">
      {/* Main metrics — 2x2 grid */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-navy-900 border border-blue-500/20 rounded-lg p-3">
          <p className="text-xs text-slate-500 uppercase tracking-widest mb-1">Reservations</p>
          <p className="text-2xl font-bold text-blue-400">{total_reservations}</p>
          <p className="text-xs text-slate-600 mt-1">bookings for {date}</p>
        </div>

        <div className="bg-navy-900 border border-blue-500/20 rounded-lg p-3">
          <p className="text-xs text-slate-500 uppercase tracking-widest mb-1">Total Guests</p>
          <p className="text-2xl font-bold text-blue-400">{total_guests}</p>
          <p className="text-xs text-slate-600 mt-1">of {capacity} capacity</p>
        </div>

        <div className={`bg-navy-900 border rounded-lg p-3 ${
          occupancy_pct > 85 ? "border-rose-500/30" : occupancy_pct > 70 ? "border-amber-500/30" : "border-emerald-500/30"
        }`}>
          <p className="text-xs text-slate-500 uppercase tracking-widest mb-1">Occupancy</p>
          <p className={`text-2xl font-bold ${
            occupancy_pct > 85 ? "text-rose-400" : occupancy_pct > 70 ? "text-amber-400" : "text-emerald-400"
          }`}>
            {occupancy_pct}%
          </p>
          {overbooking_risk && <p className="text-xs text-rose-400 mt-1">⚠ Overbooking risk</p>}
        </div>

        <div className="bg-navy-900 border border-blue-500/20 rounded-lg p-3">
          <p className="text-xs text-slate-500 uppercase tracking-widest mb-1">Peak Hour</p>
          <p className="text-2xl font-bold text-blue-400">
            {busiest_hour !== null && busiest_hour !== undefined ? `${String(busiest_hour).padStart(2, '0')}:00` : "—"}
          </p>
          {waitlist_count > 0 && <p className="text-xs text-amber-400 mt-1">📋 {waitlist_count} on waitlist</p>}
        </div>
      </div>

      {/* Recommendation section */}
      {recommendation && (
        <div className="bg-navy-900/50 border border-blue-500/10 rounded-lg p-4 space-y-3 w-full">
          {/* If recommendation is a string, display it directly */}
          {typeof recommendation === "string" && (
            <div className="w-full">
              <p className="text-xs font-mono uppercase tracking-widest text-slate-600 mb-2">Recommendation</p>
              <p className="text-sm text-slate-300 leading-relaxed break-words whitespace-normal">
                {recommendation}
              </p>
            </div>
          )}

          {/* If recommendation is an object, render its properties */}
          {typeof recommendation === "object" && (
            <>
              {/* Reasoning */}
              {recommendation?.reasoning && typeof recommendation.reasoning === "string" && (
                <div className="w-full">
                  <p className="text-xs font-mono uppercase tracking-widest text-slate-600 mb-2">Reasoning</p>
                  <p className="text-sm text-slate-300 leading-relaxed break-words whitespace-normal">
                    {recommendation.reasoning}
                  </p>
                </div>
              )}

              {/* Priority */}
              {recommendation?.priority && typeof recommendation.priority === "string" && (
                <div className="w-full">
                  <p className="text-xs font-mono uppercase tracking-widest text-slate-600 mb-2">Priority</p>
                  <span className={`text-xs font-semibold px-3 py-1 rounded inline-block ${
                    recommendation.priority === "high"
                      ? "bg-rose-500/20 text-rose-400"
                      : recommendation.priority === "medium"
                      ? "bg-amber-500/20 text-amber-400"
                      : "bg-emerald-500/20 text-emerald-400"
                  }`}>
                    {recommendation.priority}
                  </span>
                </div>
              )}

              {/* Other recommendation fields as grouped sections */}
              {Object.entries(recommendation)
                .filter(([key]) => !["reasoning", "priority"].includes(key))
                .map(([key, value]) => {
                  if (value === null || value === undefined) return null;

                  const label = key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

                  // Handle arrays of actions/items
                  if (Array.isArray(value) && value.length > 0) {
                    const items = value.filter(item => item !== null && item !== undefined);
                    if (items.length === 0) return null;

                    return (
                      <div key={key} className="mt-3 pt-3 border-t border-blue-500/10 w-full">
                        <p className="text-xs font-mono uppercase tracking-widest text-slate-600 mb-2">
                          {label}
                        </p>
                        <ul className="space-y-1 w-full">
                          {items.map((item, i) => {
                            const itemText = typeof item === "string" 
                              ? item 
                              : typeof item === "object" && item !== null
                              ? String(Object.values(item).join(" · "))
                              : String(item);
                            
                            return (
                              <li key={i} className="text-xs text-slate-300 flex gap-2 w-full break-words">
                                <span className="text-blue-400 shrink-0">•</span>
                                <span className="whitespace-normal">{itemText}</span>
                              </li>
                            );
                          })}
                        </ul>
                      </div>
                    );
                  }

                  // Handle nested objects (not strings, not arrays)
                  if (typeof value === "object" && value !== null && !Array.isArray(value)) {
                    const entries = Object.entries(value as Record<string, unknown>).filter(
                      ([, nestedValue]) => nestedValue !== null && nestedValue !== undefined
                    );
                    if (entries.length === 0) return null;

                    return (
                      <div key={key} className="mt-3 pt-3 border-t border-blue-500/10 w-full">
                        <p className="text-xs font-mono uppercase tracking-widest text-slate-600 mb-2">
                          {label}
                        </p>
                        <div className="space-y-1 w-full">
                          {entries.map(([subKey, subValue]) => (
                            <div key={subKey} className="flex gap-3 w-full">
                              <span className="text-xs text-slate-500 w-24 shrink-0">
                                {subKey.replace(/_/g, " ")}
                              </span>
                              <span className="text-xs text-slate-300 break-words whitespace-normal flex-1">
                                {String(subValue)}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  }

                  // Handle simple string values
                  if (typeof value === "string") {
                    return (
                      <div key={key} className="flex gap-3 w-full text-xs">
                        <span className="text-slate-500 w-24 shrink-0">{label}</span>
                        <span className="text-slate-300 break-words whitespace-normal flex-1">{value}</span>
                      </div>
                    );
                  }

                  // Other scalar types
                  return (
                    <div key={key} className="flex gap-3 text-xs w-full">
                      <span className="text-slate-500 w-24 shrink-0">{label}</span>
                      <span className="text-slate-300 break-words whitespace-normal flex-1">{String(value)}</span>
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
