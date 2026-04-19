// components/dashboard/AgentCard.tsx
"use client";

import { useState } from "react";
import InventoryAlerts from "./InventoryAlerts";
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

export default function AgentCard({ agentKey, data, index = 0 }: Props) {
  const [expanded, setExpanded] = useState(true);
  const meta = AGENT_META[agentKey] ?? { label: agentKey, icon: "🤖", accent: "border-t-slate-500", glow: "" };

  return (
    <div className={`group card border-t-2 ${meta.accent} ${meta.glow} transition-all duration-300 stagger-${index + 3}`}>
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
        <div className="px-5 pb-5 border-t border-white/5 pt-4 space-y-2">
          {!data ? (
            <p className="text-sm text-slate-600 italic">Agent did not return output.</p>
          ) : data.error ? (
            <p className="text-sm text-rose-400">⚠ {String(data.error)}</p>
          ) : agentKey === "inventory" ? (
            <InventoryAlerts inventory={data} />
          ) : agentKey === "reservation" ? (
            <ReservationSummary data={data as Record<string, unknown>} />
          ) : (
            <AgentDataRows data={data} />
          )}
        </div>
      )}
    </div>
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