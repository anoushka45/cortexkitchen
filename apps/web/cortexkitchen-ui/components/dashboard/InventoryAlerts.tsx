"use client";

interface Alert {
  ingredient:        string;
  unit:              string;
  quantity_in_stock: number;
  reorder_threshold: number;
  shortfall?:        number;
  excess?:           number;
  spoilage_risk:     boolean;
  severity:          "critical" | "warning" | "info";
}

interface InventoryData {
  total_items_checked: number;
  shortage_alerts:     Alert[];
  overstock_alerts:    Alert[];
  high_demand_week:    boolean;
  demand_ratio:        number;
  recommendation: {
    restock_actions: string[];
    waste_reduction_actions: string[];
    priority?: string;
    reasoning?: string;
    risks: string[];
  } | null;
}

interface Props {
  inventory: Record<string, unknown> | null;
  compact?: boolean;
}

const SEVERITY_STYLES: Record<string, string> = {
  critical: "bg-rose-500/10 border-rose-500/30 text-rose-400",
  warning:  "bg-amber-500/10 border-amber-500/30 text-amber-400",
  info:     "bg-blue-500/10  border-blue-500/30  text-blue-400",
};

const SEVERITY_BADGE: Record<string, string> = {
  critical: "bg-rose-500/20 text-rose-400",
  warning:  "bg-amber-500/20 text-amber-400",
  info:     "bg-blue-500/20  text-blue-400",
};

function normalizeInventoryData(
  raw: Record<string, unknown> | null
): InventoryData | null {
  if (!raw) return null;
  const nested = raw.data as Record<string, unknown> | undefined;
  const payload = nested && typeof nested === "object" ? nested : raw;
  const recommendationSource =
    raw.recommendation && typeof raw.recommendation === "object"
      ? (raw.recommendation as Record<string, unknown>)
      : raw;

  const shortage  = Array.isArray(payload.shortage_alerts)  ? payload.shortage_alerts  : [];
  const overstock = Array.isArray(payload.overstock_alerts) ? payload.overstock_alerts : [];

  return {
    total_items_checked: Number(payload.total_items_checked ?? 0),
    shortage_alerts:     shortage  as Alert[],
    overstock_alerts:    overstock as Alert[],
    high_demand_week:    Boolean(payload.high_demand_week),
    demand_ratio:        Number(payload.demand_ratio ?? 1.0),
    recommendation:
      recommendationSource && typeof recommendationSource === "object"
        ? {
            restock_actions: Array.isArray(recommendationSource.restock_actions)
              ? (recommendationSource.restock_actions as string[])
              : [],
            waste_reduction_actions: Array.isArray(recommendationSource.waste_reduction_actions)
              ? (recommendationSource.waste_reduction_actions as string[])
              : [],
            priority: typeof recommendationSource.priority === "string"
              ? String(recommendationSource.priority)
              : undefined,
            reasoning: typeof recommendationSource.reasoning === "string"
              ? String(recommendationSource.reasoning)
              : undefined,
            risks: Array.isArray(recommendationSource.risks)
              ? (recommendationSource.risks as string[])
              : [],
          }
        : null,
  };
}

function AlertRow({ alert, type }: { alert: Alert; type: "shortage" | "overstock" }) {
  const sev = alert.severity ?? "info";
  return (
    <div className={`rounded-xl border px-4 py-3 ${SEVERITY_STYLES[sev]}`}>
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-sm font-semibold text-slate-200">{alert.ingredient}</span>
        <div className="flex items-center gap-2">
          {alert.spoilage_risk && (
            <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-400">
              spoilage risk
            </span>
          )}
          <span className={`text-[10px] font-mono px-2 py-0.5 rounded-full ${SEVERITY_BADGE[sev]}`}>
            {sev}
          </span>
        </div>
      </div>
      <div className="flex gap-4 text-xs text-slate-400 font-mono">
        <span>stock: {alert.quantity_in_stock} {alert.unit}</span>
        <span>threshold: {alert.reorder_threshold} {alert.unit}</span>
        {type === "shortage"  && alert.shortfall !== undefined && (
          <span className="text-rose-400">shortfall: {alert.shortfall} {alert.unit}</span>
        )}
        {type === "overstock" && alert.excess !== undefined && (
          <span className="text-amber-400">excess: {alert.excess} {alert.unit}</span>
        )}
      </div>
    </div>
  );
}

export default function InventoryAlerts({ inventory, compact = false }: Props) {
  const data = normalizeInventoryData(inventory);
  if (!data) return null;

  const hasShortage  = data.shortage_alerts.length  > 0;
  const hasOverstock = data.overstock_alerts.length > 0;
  const allClear     = !hasShortage && !hasOverstock;
  const recommendation = data.recommendation;

  const shortageSorted = [...data.shortage_alerts].sort((a, b) => {
    const score = (sev: Alert["severity"]) =>
      sev === "critical" ? 2 : sev === "warning" ? 1 : 0;
    return score(b.severity) - score(a.severity);
  });

  const shortagePreview = compact ? shortageSorted.slice(0, 3) : shortageSorted;
  const overstockPreview = compact ? data.overstock_alerts.slice(0, 2) : data.overstock_alerts;

  const restockPreview =
    recommendation?.restock_actions
      ? (compact ? recommendation.restock_actions.slice(0, 2) : recommendation.restock_actions)
      : [];
  const wastePreview =
    recommendation?.waste_reduction_actions
      ? (compact ? recommendation.waste_reduction_actions.slice(0, 1) : recommendation.waste_reduction_actions)
      : [];
  const riskPreview =
    recommendation?.risks ? (compact ? recommendation.risks.slice(0, 1) : recommendation.risks) : [];

  return (
    <div className={compact ? "space-y-4" : "space-y-5"}>
      {/* Summary bar */}
      <div className="flex flex-wrap items-center gap-3 text-xs font-mono text-slate-500">
        <span>{data.total_items_checked} ingredients checked</span>
        <span>·</span>
        <span>demand ratio: {data.demand_ratio.toFixed(2)}x</span>
        {data.high_demand_week && (
          <>
            <span>·</span>
            <span className="text-amber-400">high demand week</span>
          </>
        )}
      </div>

      {/* All clear */}
      {allClear && (
        <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 px-4 py-3">
          <p className="text-sm text-emerald-400 font-medium">
            All stock levels are within safe range.
          </p>
          <p className="text-xs text-slate-500 mt-1">
            No restocking or waste-reduction actions required before Friday.
          </p>
        </div>
      )}

      {recommendation && (
        <div className={`rounded-xl border border-emerald-500/20 bg-emerald-500/5 px-4 py-4 ${compact ? "space-y-2" : "space-y-3"}`}>
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-xs font-mono uppercase tracking-widest text-slate-500">
              Recommendation
            </p>
            {recommendation.priority && (
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400">
                {recommendation.priority} priority
              </span>
            )}
          </div>
          {recommendation.reasoning && (
            <p className="text-sm text-slate-200">{recommendation.reasoning}</p>
          )}
          {restockPreview.length > 0 && (
            <div>
              <p className="text-xs font-mono uppercase tracking-widest text-slate-600 mb-2">
                Restock Actions
              </p>
              <ul className="space-y-1.5">
                {restockPreview.map((action, index) => (
                  <li key={`restock-${index}`} className="text-xs text-slate-200 bg-slate-900/60 rounded-lg px-3 py-2 border border-white/5">
                    {action}
                  </li>
                ))}
              </ul>
              {compact && recommendation.restock_actions.length > restockPreview.length && (
                <p className="text-xs text-slate-500 mt-2">
                  {recommendation.restock_actions.length - restockPreview.length} more restock actions in details.
                </p>
              )}
            </div>
          )}
          {wastePreview.length > 0 && (
            <div>
              <p className="text-xs font-mono uppercase tracking-widest text-slate-600 mb-2">
                Waste Reduction
              </p>
              <ul className="space-y-1.5">
                {wastePreview.map((action, index) => (
                  <li key={`waste-${index}`} className="text-xs text-slate-200 bg-slate-900/60 rounded-lg px-3 py-2 border border-white/5">
                    {action}
                  </li>
                ))}
              </ul>
              {compact && recommendation.waste_reduction_actions.length > wastePreview.length && (
                <p className="text-xs text-slate-500 mt-2">
                  {recommendation.waste_reduction_actions.length - wastePreview.length} more waste actions in details.
                </p>
              )}
            </div>
          )}
          {riskPreview.length > 0 && (
            <div>
              <p className="text-xs font-mono uppercase tracking-widest text-slate-600 mb-2">
                Risks
              </p>
              <ul className="space-y-1.5">
                {riskPreview.map((risk, index) => (
                  <li key={`risk-${index}`} className="text-xs text-rose-300 bg-rose-500/10 rounded-lg px-3 py-2 border border-rose-500/20">
                    {risk}
                  </li>
                ))}
              </ul>
              {compact && recommendation.risks.length > riskPreview.length && (
                <p className="text-xs text-slate-500 mt-2">
                  {recommendation.risks.length - riskPreview.length} more risks in details.
                </p>
              )}
            </div>
          )}
        </div>
      )}

      {/* Shortage alerts */}
      {hasShortage && (
        <div>
          <p className="text-xs font-mono uppercase tracking-widest text-slate-600 mb-2">
            Shortage alerts — {data.shortage_alerts.length}
          </p>
          <div className="space-y-2">
            {shortagePreview.map((a, i) => (
              <AlertRow key={`shortage-${i}`} alert={a} type="shortage" />
            ))}
          </div>
          {compact && data.shortage_alerts.length > shortagePreview.length && (
            <p className="text-xs text-slate-500 mt-2">
              {data.shortage_alerts.length - shortagePreview.length} more shortage alerts in details.
            </p>
          )}
        </div>
      )}

      {/* Overstock alerts */}
      {hasOverstock && (
        <div>
          <p className="text-xs font-mono uppercase tracking-widest text-slate-600 mb-2">
            Overstock alerts — {data.overstock_alerts.length}
          </p>
          <div className="space-y-2">
            {overstockPreview.map((a, i) => (
              <AlertRow key={`overstock-${i}`} alert={a} type="overstock" />
            ))}
          </div>
          {compact && data.overstock_alerts.length > overstockPreview.length && (
            <p className="text-xs text-slate-500 mt-2">
              {data.overstock_alerts.length - overstockPreview.length} more overstock alerts in details.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
