// components/dashboard/AgentCard.tsx
"use client";

import { useState } from "react";
import DashboardDetailModal from "./DashboardDetailModal";
import InventoryAlerts from "./InventoryAlerts";
import MenuInsights, { MenuInsightsBody } from "./MenuInsights";
import ReservationSummary from "./ReservationSummary";

const AGENT_META: Record<string, {
  label: string; icon: string; accent: string; glow: string;
}> = {
  forecast:    { label: "Demand Forecast",        icon: "📈", accent: "border-t-violet-500",  glow: "group-hover:shadow-glow-violet"  },
  reservation: { label: "Reservation Pressure",   icon: "🪑", accent: "border-t-blue-500",    glow: "group-hover:shadow-glow-violet"  },
  complaint:   { label: "Complaint Intelligence", icon: "💬", accent: "border-t-rose-500",    glow: "group-hover:shadow-glow-rose"    },
  menu:        { label: "Menu Intelligence",      icon: "🍕", accent: "border-t-amber-500",   glow: "group-hover:shadow-glow-amber"   },
  inventory:   { label: "Inventory Status",       icon: "📦", accent: "border-t-emerald-500", glow: "group-hover:shadow-glow-emerald" },
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
  const sentiment = asObject(data.sentiment_breakdown) ?? asObject(nestedData.sentiment_breakdown);
  const positive   = sentiment ? Number(sentiment.positive  ?? 0) : 0;
  const neutral    = sentiment ? Number(sentiment.neutral   ?? 0) : 0;
  const negative   = sentiment ? Number(sentiment.negative  ?? 0) : 0;
  const negativePct = sentiment ? Number(sentiment.negative_pct ?? 0) : 0;
  const hasSentiment = positive + neutral + negative > 0;

  // Counts
  const totalFeedback     = Number(data.total_feedback ?? nestedData.total_feedback ?? 0);
  const uniqueComplaints  = Array.isArray(data.unique_complaints)  ? data.unique_complaints  as string[]
                          : Array.isArray(nestedData.unique_complaints) ? nestedData.unique_complaints as string[]
                          : [];
  const uniquePositives   = Array.isArray(data.unique_positives)   ? data.unique_positives   as string[]
                          : Array.isArray(nestedData.unique_positives)  ? nestedData.unique_positives  as string[]
                          : [];

  const issues      = Array.isArray(data.issues)       ? data.issues       as Record<string, unknown>[] : [];
  const actionItems = Array.isArray(data.action_items) ? data.action_items as string[]                  : [];
  const overallSummary = typeof data.overall_summary === "string" ? data.overall_summary : null;

  return (
    <div className="space-y-4">
      {/* Sentiment breakdown */}
      {hasSentiment && (
        <div className="space-y-2">
          <p className="text-[11px] font-mono uppercase tracking-widest text-slate-600">Sentiment</p>
          <div className="flex gap-2 flex-wrap">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/20 bg-emerald-500/8 px-2.5 py-1 text-xs font-mono text-emerald-400">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
              {positive} positive
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-500/20 bg-slate-500/8 px-2.5 py-1 text-xs font-mono text-slate-400">
              <span className="h-1.5 w-1.5 rounded-full bg-slate-400" />
              {neutral} neutral
            </span>
            <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-mono ${
              negativePct > 30 ? "border-rose-500/30 bg-rose-500/8 text-rose-400"
              : negativePct > 15 ? "border-amber-500/30 bg-amber-500/8 text-amber-400"
              : "border-slate-500/20 bg-slate-500/8 text-slate-400"
            }`}>
              <span className={`h-1.5 w-1.5 rounded-full ${negativePct > 30 ? "bg-rose-400" : negativePct > 15 ? "bg-amber-400" : "bg-slate-400"}`} />
              {negative} negative{negativePct > 0 ? ` · ${negativePct}%` : ""}
            </span>
          </div>

          {/* Sentiment bar */}
          {(positive + neutral + negative) > 0 && (
            <div className="flex h-1.5 overflow-hidden rounded-full bg-white/5">
              <div className="bg-emerald-500/50 transition-all" style={{ width: `${(positive / (positive + neutral + negative)) * 100}%` }} />
              <div className="bg-slate-500/40 transition-all"  style={{ width: `${(neutral  / (positive + neutral + negative)) * 100}%` }} />
              <div className={`transition-all ${negativePct > 30 ? "bg-rose-500/60" : "bg-amber-500/50"}`} style={{ width: `${(negative / (positive + neutral + negative)) * 100}%` }} />
            </div>
          )}
        </div>
      )}

      {/* Unique signals row */}
      {(uniqueComplaints.length > 0 || uniquePositives.length > 0 || totalFeedback > 0) && (
        <div className="flex flex-wrap gap-3 text-xs font-mono text-slate-500">
          {totalFeedback > 0 && <span>{totalFeedback} total feedback</span>}
          {uniqueComplaints.length > 0 && (
            <><span>·</span><span className="text-rose-400/80">{uniqueComplaints.length} unique complaint{uniqueComplaints.length !== 1 ? "s" : ""}</span></>
          )}
          {uniquePositives.length > 0 && (
            <><span>·</span><span className="text-emerald-400/80">{uniquePositives.length} positive signal{uniquePositives.length !== 1 ? "s" : ""}</span></>
          )}
        </div>
      )}

      {/* Summary */}
      {overallSummary && (
        <p className="text-xs text-slate-400 leading-relaxed">{overallSummary}</p>
      )}

      {/* Issues with per-issue recommendation */}
      {issues.length > 0 && (
        <div className="space-y-2">
          <p className="text-[11px] font-mono uppercase tracking-widest text-slate-600">Issues</p>
          {issues.slice(0, 3).map((issue, i) => {
            const priority = String(issue.priority ?? "");
            const rec = typeof issue.recommendation === "string" ? issue.recommendation : null;
            return (
              <div key={i} className="rounded-xl border border-white/5 bg-white/[0.03] px-3 py-2.5 space-y-1">
                <div className="flex items-start gap-2">
                  <span className={`mt-0.5 h-1.5 w-1.5 rounded-full shrink-0 ${
                    priority === "high" ? "bg-rose-400" : priority === "medium" ? "bg-amber-400" : "bg-slate-500"
                  }`} />
                  <span className="text-xs font-medium text-slate-200 leading-snug">{String(issue.issue ?? "")}</span>
                </div>
                {rec && (
                  <p className="text-[11px] text-slate-400 leading-relaxed pl-3.5">{rec}</p>
                )}
              </div>
            );
          })}
          {issues.length > 3 && (
            <p className="text-xs text-slate-600 pl-1">+{issues.length - 3} more in details</p>
          )}
        </div>
      )}

      {/* What's working — unique positives */}
      {uniquePositives.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-[11px] font-mono uppercase tracking-widest text-slate-600">What's working</p>
          {uniquePositives.slice(0, 2).map((p, i) => (
            <div key={i} className="rounded-xl border border-emerald-500/15 bg-emerald-500/5 px-3 py-2 text-xs text-emerald-300 leading-snug">
              {p}
            </div>
          ))}
        </div>
      )}

      {/* Actions */}
      {actionItems.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-[11px] font-mono uppercase tracking-widest text-slate-600">Actions</p>
          {actionItems.slice(0, 3).map((action, i) => (
            <div key={i} className="rounded-xl border border-cyan-500/15 bg-cyan-500/5 px-3 py-2 text-xs text-cyan-200 leading-snug">
              {action}
            </div>
          ))}
          {actionItems.length > 3 && (
            <p className="text-xs text-slate-600 pl-1">+{actionItems.length - 3} more in details</p>
          )}
        </div>
      )}
    </div>
  );
}

export default function AgentCard({ agentKey, data, index = 0 }: Props) {
  const [expanded, setExpanded] = useState(true);
  const [detailOpen, setDetailOpen] = useState(false);
  const meta = AGENT_META[agentKey] ?? { label: agentKey, icon: "🤖", accent: "border-t-slate-500", glow: "" };

  const canShowDetails = Boolean(data && !data.error);

  return (
    <>
      <div className={`group card h-full flex flex-col border-t-2 ${meta.accent} ${meta.glow} transition-all duration-300 stagger-${index + 3}`}>
        {/* Header */}
        <button
          onClick={() => setExpanded((e) => !e)}
          className="w-full flex items-center justify-between px-5 py-4 text-left"
        >
          <div className="flex items-center gap-3">
            <span className="text-lg">{meta.icon}</span>
            <span className="text-sm font-semibold text-slate-200">{meta.label}</span>
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
          <span className="text-slate-600 text-xs font-mono">
            {expanded ? "▲" : "▼"}
          </span>
        </button>

        {/* Body */}
        {expanded && (
          <div className="flex-1 px-5 pb-5 border-t border-white/5 pt-4 space-y-4">
            {!data ? (
              <p className="text-sm text-slate-600 italic">Agent did not return output.</p>
            ) : data.error ? (
              <p className="text-sm text-rose-400">⚠ {String(data.error)}</p>
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
        )}
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
              <div className="pl-3 border-l border-violet-500/20 space-y-1.5">
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
                Object.values(obj).join(" · ")
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
