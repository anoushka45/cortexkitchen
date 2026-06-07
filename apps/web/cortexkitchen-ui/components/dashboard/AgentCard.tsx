// components/dashboard/AgentCard.tsx
"use client";

import { useState } from "react";
import DashboardDetailModal from "./DashboardDetailModal";
import InventoryAlerts from "./InventoryAlerts";
import MenuInsights, { MenuInsightsBody } from "./MenuInsights";
import ReservationSummary from "./ReservationSummary";

const AGENT_ICONS: Record<string, string> = {
  forecast:    "M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z",
  reservation: "M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z",
  complaint:   "M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z",
  menu:        "M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4",
  inventory:   "M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4",
};

const AGENT_META: Record<string, {
  label: string; iconPath: string; headerBg: string; dotColor: string; iconColor: string; glow: string;
}> = {
  forecast:    { label: "Demand Forecast",        iconPath: AGENT_ICONS.forecast,    headerBg: "bg-ember-500/[0.07]  border-b border-ember-500/15",  dotColor: "bg-ember-400",  iconColor: "text-ember-400",  glow: "group-hover:shadow-glow-ember"  },
  reservation: { label: "Reservation Pressure",   iconPath: AGENT_ICONS.reservation, headerBg: "bg-cyan-500/[0.06]    border-b border-cyan-500/15",    dotColor: "bg-cyan-400",    iconColor: "text-cyan-400",    glow: "group-hover:shadow-glow-ember"  },
  complaint:   { label: "Complaint Intelligence", iconPath: AGENT_ICONS.complaint,   headerBg: "bg-rose-500/[0.06]    border-b border-rose-500/15",    dotColor: "bg-rose-400",    iconColor: "text-rose-400",    glow: "group-hover:shadow-glow-rose"    },
  menu:        { label: "Menu Intelligence",      iconPath: AGENT_ICONS.menu,        headerBg: "bg-amber-500/[0.06]   border-b border-amber-500/15",   dotColor: "bg-amber-400",   iconColor: "text-amber-400",   glow: "group-hover:shadow-glow-amber"   },
  inventory:   { label: "Inventory Status",       iconPath: AGENT_ICONS.inventory,   headerBg: "bg-emerald-500/[0.06] border-b border-emerald-500/15", dotColor: "bg-emerald-400", iconColor: "text-emerald-400", glow: "group-hover:shadow-glow-emerald" },
};

interface Props {
  agentKey: string;
  data:     Record<string, unknown> | null;
  index?:   number;
}

function asObject(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : null;
}

function getDetailSubtitle(agentKey: string): string {
  const subtitles: Record<string, string> = {
    forecast: "Demand view, peak pressure, and supporting forecast context",
    reservation: "Reservation load, occupancy pressure, and service timing context",
    complaint: "Guest experience signals, recurring issues, and recommended fixes",
    menu: "What to push, avoid, and operationally support in the current run",
    inventory: "Stock pressure, restock actions, and spoilage-linked operational risk",
  };
  return subtitles[agentKey] ?? "Expanded agent output for deeper review";
}

function getDetailMeta(agentKey: string, data: Record<string, unknown> | null): Array<{ label: string; value: string }> {
  if (!data) return [];

  const nestedData = asObject(data.data) ?? data;

  if (agentKey === "forecast") {
    const predicted = nestedData.predicted_orders;
    const method = nestedData.method;
    const confidence = nestedData.confidence;
    return [
      predicted ? { label: "orders", value: String(predicted) } : null,
      method ? { label: "method", value: String(method) } : null,
      confidence ? { label: "confidence", value: String(confidence) } : null,
    ].filter(Boolean) as Array<{ label: string; value: string }>;
  }

  if (agentKey === "reservation") {
    const occupancy = nestedData.occupancy_pct;
    const waitlist = nestedData.waitlist_count;
    return [
      occupancy !== undefined ? { label: "occupancy", value: `${Math.round(Number(occupancy))}%` } : null,
      waitlist !== undefined ? { label: "waitlist", value: String(waitlist) } : null,
    ].filter(Boolean) as Array<{ label: string; value: string }>;
  }

  if (agentKey === "complaint") {
    const issueCount = Array.isArray(data.issues) ? data.issues.length : 0;
    const feedbackTotal = nestedData.total_feedback;
    return [
      feedbackTotal !== undefined ? { label: "feedback", value: String(feedbackTotal) } : null,
      issueCount > 0 ? { label: "issues", value: String(issueCount) } : null,
    ].filter(Boolean) as Array<{ label: string; value: string }>;
  }

  if (agentKey === "menu") {
    const highlights = Array.isArray(data.highlight_items) ? data.highlight_items.length : 0;
    const promos = Array.isArray(data.promo_candidates) ? data.promo_candidates.length : 0;
    return [
      highlights > 0 ? { label: "highlights", value: String(highlights) } : null,
      promos > 0 ? { label: "promos", value: String(promos) } : null,
    ].filter(Boolean) as Array<{ label: string; value: string }>;
  }

  if (agentKey === "inventory") {
    const shortages = Array.isArray(nestedData.shortage_alerts) ? nestedData.shortage_alerts.length : 0;
    const demandRatio = nestedData.demand_ratio;
    return [
      shortages > 0 ? { label: "shortages", value: String(shortages) } : null,
      demandRatio !== undefined ? { label: "demand ratio", value: `${Number(demandRatio).toFixed(2)}x` } : null,
    ].filter(Boolean) as Array<{ label: string; value: string }>;
  }

  return [];
}

function getDetailHighlights(agentKey: string, data: Record<string, unknown> | null): string[] {
  if (!data) return [];

  const nestedData = asObject(data.data) ?? data;

  if (agentKey === "forecast") {
    const predicted = nestedData.predicted_orders;
    const peak = nestedData.predicted_peak_orders;
    return [
      predicted ? `Expected volume is ${predicted} orders for this planning run.` : null,
      peak ? `Peak-hour load is projected around ${peak} orders.` : null,
      data.reasoning && typeof data.reasoning === "string" ? String(data.reasoning) : null,
    ].filter(Boolean) as string[];
  }

  if (agentKey === "reservation") {
    const occupancy = nestedData.occupancy_pct;
    const waitlist = nestedData.waitlist_count;
    return [
      occupancy !== undefined ? `Reservation load is currently ${Math.round(Number(occupancy))}% of capacity.` : null,
      waitlist && Number(waitlist) > 0 ? `${waitlist} guests are already on the waitlist.` : null,
      data.reasoning && typeof data.reasoning === "string" ? String(data.reasoning) : null,
    ].filter(Boolean) as string[];
  }

  if (agentKey === "complaint") {
    const issues = Array.isArray(data.issues) ? data.issues : [];
    const summary = typeof data.overall_summary === "string" ? data.overall_summary : null;
    const topIssue =
      issues.length > 0 && typeof issues[0] === "object" && issues[0] !== null
        ? (issues[0] as Record<string, unknown>).issue
        : null;
    return [
      summary,
      topIssue ? `Primary complaint theme: ${topIssue}.` : null,
      Array.isArray(data.action_items) && data.action_items[0] ? String(data.action_items[0]) : null,
    ].filter(Boolean) as string[];
  }

  if (agentKey === "menu") {
    const highlights = Array.isArray(data.highlight_items) ? data.highlight_items : [];
    const blockers = Array.isArray(data.inventory_blockers) ? data.inventory_blockers : [];
    return [
      highlights[0] ? `Primary menu push: ${highlights[0]}.` : null,
      blockers[0] ? `Key blocker: ${blockers[0]}.` : null,
      data.reasoning && typeof data.reasoning === "string" ? String(data.reasoning) : null,
    ].filter(Boolean) as string[];
  }

  if (agentKey === "inventory") {
    const shortageAlerts = Array.isArray(nestedData.shortage_alerts) ? nestedData.shortage_alerts : [];
    const topShortage =
      shortageAlerts.length > 0 && typeof shortageAlerts[0] === "object" && shortageAlerts[0] !== null
        ? (shortageAlerts[0] as Record<string, unknown>).ingredient
        : null;
    const restockActions = Array.isArray(data.restock_actions) ? data.restock_actions : [];
    return [
      topShortage ? `Top shortage pressure is on ${topShortage}.` : null,
      restockActions[0] ? String(restockActions[0]) : null,
      data.reasoning && typeof data.reasoning === "string" ? String(data.reasoning) : null,
    ].filter(Boolean) as string[];
  }

  return [];
}

function CompactComplaintView({ data }: { data: Record<string, unknown> }) {
  const nestedData = asObject(data.data) ?? data;

  // Sentiment
  const sentiment    = asObject(data.sentiment_breakdown) ?? asObject(nestedData.sentiment_breakdown);
  const positive     = sentiment ? Number(sentiment.positive ?? 0) : 0;
  const neutral      = sentiment ? Number(sentiment.neutral  ?? 0) : 0;
  const negative     = sentiment ? Number(sentiment.negative ?? 0) : 0;
  const hasSentiment = positive + neutral + negative > 0;
  const total        = positive + neutral + negative;
  const positivePct  = total > 0 ? Math.round((positive / total) * 100) : 0;
  const neutralPct   = total > 0 ? Math.round((neutral  / total) * 100) : 0;
  const negativePct  = total > 0 ? Math.round((negative / total) * 100) : 0;

  // Counts / lists
  const totalFeedback    = Number(data.total_feedback ?? nestedData.total_feedback ?? 0);
  const uniqueComplaints = Array.isArray(data.unique_complaints)  ? data.unique_complaints  as string[]
                         : Array.isArray(nestedData.unique_complaints) ? nestedData.unique_complaints as string[]
                         : [];
  const uniquePositives  = Array.isArray(data.unique_positives)  ? data.unique_positives  as string[]
                         : Array.isArray(nestedData.unique_positives)  ? nestedData.unique_positives  as string[]
                         : [];
  const issues      = Array.isArray(data.issues)       ? data.issues       as Record<string, unknown>[] : [];
  const actionItems = Array.isArray(data.action_items) ? data.action_items as string[]                  : [];
  const overallSummary = typeof data.overall_summary === "string" ? data.overall_summary : null;

  return (
    <div className="space-y-4">
      {/* Sentiment: 3-col big numbers + stacked bar */}
      {hasSentiment && (
        <div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <div className="font-mono text-[9px] uppercase tracking-[0.18em] text-white/45">Positive</div>
              <div className="mt-1 flex items-baseline gap-0.5">
                <span className="text-[26px] font-semibold leading-none text-emerald-300">{positivePct}</span>
                <span className="text-sm text-emerald-300/60">%</span>
              </div>
            </div>
            <div>
              <div className="font-mono text-[9px] uppercase tracking-[0.18em] text-white/45">Neutral</div>
              <div className="mt-1 flex items-baseline gap-0.5">
                <span className="text-[26px] font-semibold leading-none text-white/75">{neutralPct}</span>
                <span className="text-sm text-white/40">%</span>
              </div>
            </div>
            <div>
              <div className="font-mono text-[9px] uppercase tracking-[0.18em] text-white/45">Negative</div>
              <div className="mt-1 flex items-baseline gap-0.5">
                <span className={`text-[26px] font-semibold leading-none ${negativePct > 30 ? "text-rose-300" : negativePct > 15 ? "text-ember-300" : "text-white/75"}`}>{negativePct}</span>
                <span className={`text-sm opacity-60 ${negativePct > 30 ? "text-rose-300" : negativePct > 15 ? "text-ember-300" : "text-white/75"}`}>%</span>
              </div>
            </div>
          </div>
          <div className="mt-3 h-2 rounded-full overflow-hidden flex">
            <div className="bg-emerald-400/70 transition-all" style={{ width: `${positivePct}%` }} />
            <div className="bg-white/15 transition-all"       style={{ width: `${neutralPct}%` }} />
            <div className={`transition-all ${negativePct > 30 ? "bg-rose-400/70" : "bg-amber-400/60"}`} style={{ width: `${negativePct}%` }} />
          </div>
        </div>
      )}

      {/* Signal counts */}
      {(totalFeedback > 0 || uniqueComplaints.length > 0 || uniquePositives.length > 0) && (
        <div className="flex flex-wrap gap-x-3 gap-y-1 font-mono text-[11px] text-white/40">
          {totalFeedback > 0    && <span>{totalFeedback} total feedback</span>}
          {uniqueComplaints.length > 0 && <span className="text-rose-400/70">{uniqueComplaints.length} unique complaint{uniqueComplaints.length !== 1 ? "s" : ""}</span>}
          {uniquePositives.length > 0  && <span className="text-emerald-400/70">{uniquePositives.length} positive signal{uniquePositives.length !== 1 ? "s" : ""}</span>}
        </div>
      )}

      {/* Summary */}
      {overallSummary && (
        <p className="text-[12px] leading-[1.65] text-white/60">{overallSummary}</p>
      )}

      {/* Issues — severity-coded rows */}
      {issues.length > 0 && (
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-white/45 mb-2.5">Recurring issues · RAG-retrieved</p>
          <div className="space-y-1.5">
            {issues.slice(0, 3).map((issue, i) => {
              const priority = String(issue.priority ?? "");
              const rec = typeof issue.recommendation === "string" ? issue.recommendation : null;
              const rowStyle  = priority === "high"   ? "ring-rose-400/20 bg-rose-500/[0.04]"
                              : priority === "medium" ? "ring-ember-400/20 bg-ember-500/[0.04]"
                              :                         "ring-white/[0.07] bg-white/[0.025]";
              const labelColor = priority === "high"   ? "text-rose-300"
                               : priority === "medium" ? "text-ember-300"
                               :                         "text-white/55";
              const sevLabel = priority === "high" ? "High" : priority === "medium" ? "Med" : "Low";
              return (
                <div key={i} className={`rounded-lg ring-1 px-4 py-3 flex items-start justify-between gap-4 ${rowStyle}`}>
                  <div className="min-w-0">
                    <div className="text-[13px] font-semibold text-white">{String(issue.issue ?? "")}</div>
                    {rec && <div className="mt-0.5 text-[11px] leading-relaxed text-white/55">{rec}</div>}
                  </div>
                  <div className="text-right shrink-0">
                    <div className="font-mono text-[10px] uppercase text-white/35">Severity</div>
                    <div className={`text-[13px] font-bold ${labelColor}`}>{sevLabel}</div>
                  </div>
                </div>
              );
            })}
            {issues.length > 3 && (
              <p className="text-[11px] text-white/30 pl-1">+{issues.length - 3} more in details</p>
            )}
          </div>
        </div>
      )}

      {/* What's working */}
      {uniquePositives.length > 0 && (
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-white/45 mb-2">What&apos;s working</p>
          <div className="space-y-1.5">
            {uniquePositives.slice(0, 2).map((p, i) => (
              <div key={i} className="rounded-lg ring-1 ring-emerald-400/20 bg-emerald-500/[0.04] px-3 py-2 text-[12px] text-emerald-300 leading-snug">
                {p}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Actions */}
      {actionItems.length > 0 && (
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-white/45 mb-2">Actions</p>
          <div className="space-y-1.5">
            {actionItems.slice(0, 3).map((action, i) => (
              <div key={i} className="rounded-lg ring-1 ring-cyan-400/20 bg-cyan-500/[0.04] px-3 py-2 text-[12px] text-cyan-200 leading-snug">
                {action}
              </div>
            ))}
            {actionItems.length > 3 && (
              <p className="text-[11px] text-white/30 pl-1">+{actionItems.length - 3} more in details</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default function AgentCard({ agentKey, data, index = 0 }: Props) {
  const [detailOpen, setDetailOpen] = useState(false);
  const meta = AGENT_META[agentKey] ?? { label: agentKey, iconPath: "", headerBg: "bg-slate-500/[0.06] border-b border-slate-500/15", dotColor: "bg-slate-400", iconColor: "text-slate-400", glow: "" };

  const canShowDetails = Boolean(data && !data.error);

  return (
    <>
      <div className={`group card h-full flex flex-col ${meta.glow} transition-all duration-300 stagger-${index + 3}`}>
        {/* Header */}
        <div className={`w-full flex items-center justify-between px-5 py-4 rounded-t-[11px] ${meta.headerBg}`}>
          <div className="flex items-center gap-3">
            <span className={`shrink-0 ${meta.iconColor}`}>
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.7}>
                <path strokeLinecap="round" strokeLinejoin="round" d={meta.iconPath} />
              </svg>
            </span>
            <div className="flex items-center gap-2">
              <span className={`h-1.5 w-1.5 rounded-full ${meta.dotColor}`} />
              <span className="text-sm font-semibold text-slate-200">{meta.label}</span>
            </div>
            {!data && (
              <span className="text-xs font-mono text-slate-600 bg-slate-800 px-2 py-0.5 rounded">
                no data
              </span>
            )}
            {!!data?.error && (
              <span className="text-xs font-mono text-rose-400 bg-rose-950/50 px-2 py-0.5 rounded">
                error
              </span>
            )}
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 px-5 pb-5 border-t border-white/5 pt-4 space-y-4">
          {!data ? (
            <p className="text-sm text-slate-600 italic">Agent did not return output.</p>
          ) : data.error ? (
            <p className="text-sm text-rose-400">! {String(data.error)}</p>
          ) : agentKey === "inventory" ? (
            <InventoryAlerts inventory={data} compact />
          ) : agentKey === "menu" ? (
            <MenuInsightsBody data={data as Record<string, unknown>} compact />
          ) : agentKey === "reservation" ? (
            <ReservationSummary data={data as Record<string, unknown>} compact />
          ) : agentKey === "complaint" ? (
            <CompactComplaintView data={data} />
          ) : (
            <AgentDataRows data={data} />
          )}

          {canShowDetails && (
            <div className="pt-2 border-t border-white/5 flex justify-end">
              <button
                onClick={() => setDetailOpen(true)}
                className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-mono text-slate-300 hover:bg-white/10 transition-colors"
              >
                view details
              </button>
            </div>
          )}
        </div>
      </div>

      <DashboardDetailModal
        open={detailOpen}
        onClose={() => setDetailOpen(false)}
        title={meta.label}
        subtitle={getDetailSubtitle(agentKey)}
        meta={getDetailMeta(agentKey, data)}
        highlights={getDetailHighlights(agentKey, data)}
      >
        {data && agentKey === "inventory" ? (
          <InventoryAlerts inventory={data} />
        ) : data && agentKey === "menu" ? (
          <MenuInsights data={data as Record<string, unknown>} />
        ) : data && agentKey === "reservation" ? (
          <ReservationSummary data={data as Record<string, unknown>} />
        ) : data ? (
          <AgentDataRows data={data} />
        ) : null}
      </DashboardDetailModal>
    </>
  );
}

function AgentDataRows({ data }: { data: Record<string, unknown> }) {
  return (
    <>
      {Object.entries(data).map(([key, value]) => {
        if (value === null || value === undefined) return null;

        const label = key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

        // Handle nested objects (but NOT arrays or strings)
        if (typeof value === "object" && !Array.isArray(value) && typeof value !== "string") {
          return (
            <div key={key} className="mt-3">
              <p className="text-xs font-mono uppercase tracking-widest text-slate-600 mb-2">
                {label}
              </p>
              <div className="pl-3 border-l border-ember-500/20 space-y-1.5">
                <AgentDataRows data={value as Record<string, unknown>} />
              </div>
            </div>
          );
        }

        // Handle arrays (strings explicitly excluded)
        if (Array.isArray(value) && value.length > 0) {
          const items = value.map((item) => {
            if (typeof item === "string") return item;
            if (typeof item === "object" && item !== null) {
              const obj = item as Record<string, unknown>;
              return String(
                obj.text ?? obj.issue ?? obj.complaint ??
                obj.summary ?? obj.content ?? obj.theme ??
                Object.values(obj).join("  -  ")
              );
            }
            return String(item);
          });

          return (
            <div key={key} className="mt-2">
              <p className="text-xs font-mono uppercase tracking-widest text-slate-600 mb-2">
                {label}
              </p>
              <ul className="space-y-1.5">
                {items.map((item, i) => (
                  <li key={i} className="text-xs text-slate-300 bg-navy-800 rounded-lg px-3 py-2 border border-white/5 break-words whitespace-normal">
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          );
        }

        // Handle simple values (strings, numbers, booleans, empty arrays)
        return <Row key={key} label={label} value={String(value)} />;
      })}
    </>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  const isNumber = !isNaN(Number(value)) && value !== "";
  return (
    <div className="flex gap-3">
      <span className="text-xs text-slate-500 shrink-0 w-32 truncate">{label}</span>
      <span className={`text-sm font-medium break-words whitespace-normal flex-1 ${isNumber ? "font-mono text-gold-400" : "text-slate-200"}`}>
        {value}
      </span>
    </div>
  );
}
