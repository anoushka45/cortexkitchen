"use client";

interface TopItem {
  item: string;
  category?: string;
  total_ordered?: number;
}

interface MenuInsightsData {
  data?: {
    top_items?: TopItem[];
    forecast_snapshot?: {
      predicted_orders?: number;
      predicted_peak_orders?: number;
      avg_friday_orders?: number;
      target_date?: string;
    };
    complaint_themes?: string[];
    shortage_ingredients?: string[];
    overstock_ingredients?: string[];
    note?: string;
  };
  highlight_items?: string[];
  deprioritize_items?: string[];
  promo_candidates?: string[];
  inventory_blockers?: string[];
  complaint_watchouts?: string[];
  operational_notes?: string[];
  reasoning?: string;
  priority?: string;
  risks?: string[];
}

function SectionList({
  title,
  items,
  tone = "default",
}: {
  title: string;
  items: string[];
  tone?: "default" | "good" | "warn" | "risk";
}) {
  if (items.length === 0) return null;

  const toneClass =
    tone === "good"
      ? "border-emerald-500/20 bg-emerald-500/5 text-emerald-200"
      : tone === "warn"
      ? "border-amber-500/20 bg-amber-500/5 text-amber-200"
      : tone === "risk"
      ? "border-rose-500/20 bg-rose-500/5 text-rose-200"
      : "border-white/5 bg-slate-900/60 text-slate-200";

  return (
    <div>
      <p className="text-xs font-mono uppercase tracking-widest text-slate-600 mb-2">
        {title}
      </p>
      <ul className="space-y-1.5">
        {items.map((item, index) => (
          <li key={`${title}-${index}`} className={`rounded-lg border px-3 py-2 text-xs ${toneClass}`}>
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function MenuInsights({ data }: { data: MenuInsightsData }) {
  const detail = data.data ?? {};
  const topItems = detail.top_items ?? data.top_items ?? [];
  const complaintThemes = detail.complaint_themes ?? [];
  const shortageIngredients = detail.shortage_ingredients ?? [];
  const overstockIngredients = detail.overstock_ingredients ?? [];

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 px-4 py-3">
          <p className="text-xs font-mono uppercase tracking-widest text-slate-500 mb-1">Top Items</p>
          <p className="text-2xl font-semibold text-amber-300">{topItems.length}</p>
          <p className="text-xs text-slate-500 mt-1">historically strong Friday sellers</p>
        </div>
        <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 px-4 py-3">
          <p className="text-xs font-mono uppercase tracking-widest text-slate-500 mb-1">Highlight Items</p>
          <p className="text-2xl font-semibold text-emerald-300">{data.highlight_items?.length ?? 0}</p>
          <p className="text-xs text-slate-500 mt-1">recommended to push this Friday</p>
        </div>
        <div className="rounded-xl border border-rose-500/20 bg-rose-500/5 px-4 py-3">
          <p className="text-xs font-mono uppercase tracking-widest text-slate-500 mb-1">Watchouts</p>
          <p className="text-2xl font-semibold text-rose-300">
            {(data.inventory_blockers?.length ?? 0) + (data.complaint_watchouts?.length ?? 0)}
          </p>
          <p className="text-xs text-slate-500 mt-1">inventory and complaint-linked blockers</p>
        </div>
      </div>

      {data.reasoning && (
        <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 px-4 py-4">
          <div className="flex flex-wrap items-center gap-2 mb-2">
            <p className="text-xs font-mono uppercase tracking-widest text-slate-600">
              Strategy
            </p>
            {data.priority && (
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300">
                {data.priority} priority
              </span>
            )}
          </div>
          <p className="text-sm text-slate-200">{data.reasoning}</p>
        </div>
      )}

      {topItems.length > 0 && (
        <div>
          <p className="text-xs font-mono uppercase tracking-widest text-slate-600 mb-2">
            Friday Best Sellers
          </p>
          <div className="space-y-2">
            {topItems.map((item, index) => (
              <div key={`top-item-${index}`} className="rounded-xl border border-white/5 bg-slate-900/50 px-4 py-3">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-sm font-semibold text-slate-200">{item.item}</p>
                    {item.category && <p className="text-xs text-slate-500">{item.category}</p>}
                  </div>
                  {typeof item.total_ordered === "number" && (
                    <span className="text-xs font-mono text-amber-300">{item.total_ordered} ordered</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <SectionList title="Highlight Items" items={data.highlight_items ?? []} tone="good" />
        <SectionList title="Promo Candidates" items={data.promo_candidates ?? []} />
        <SectionList title="Deprioritize Items" items={data.deprioritize_items ?? []} tone="warn" />
        <SectionList title="Operational Notes" items={data.operational_notes ?? []} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <SectionList title="Inventory Blockers" items={data.inventory_blockers ?? shortageIngredients} tone="risk" />
        <SectionList title="Complaint Watchouts" items={data.complaint_watchouts ?? complaintThemes} tone="warn" />
      </div>

      {(overstockIngredients.length > 0 || (data.risks?.length ?? 0) > 0) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <SectionList title="Overstock Opportunities" items={overstockIngredients} />
          <SectionList title="Risks" items={data.risks ?? []} tone="risk" />
        </div>
      )}
    </div>
  );
}
