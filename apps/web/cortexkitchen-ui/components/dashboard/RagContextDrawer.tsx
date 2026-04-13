// components/dashboard/RagContextDrawer.tsx
// Shows RAG-retrieved complaint evidence from Qdrant.
// Collapsible — hidden by default so it doesn't crowd the dashboard.

"use client";

import { useState } from "react";
import { RagContext } from "@/types/planning";

interface Props {
  ragContext: RagContext | null;
}

export default function RagContextDrawer({ ragContext }: Props) {
  const [open, setOpen] = useState(false);

  if (!ragContext) return null;

  const complaints = extractList(ragContext.complaints ?? ragContext);
  const sops       = extractList(ragContext.sops);

  if (complaints.length === 0 && sops.length === 0) return null;

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
      {/* Toggle header */}
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-6 py-4 text-left hover:bg-gray-50 transition-colors"
      >
        <div className="flex items-center gap-2">
          <span className="text-xl">🔍</span>
          <div>
            <p className="text-sm font-semibold text-gray-800">RAG Evidence</p>
            <p className="text-xs text-gray-400">
              {complaints.length} complaint{complaints.length !== 1 ? "s" : ""} retrieved
              {sops.length > 0 && ` · ${sops.length} SOP${sops.length !== 1 ? "s" : ""}`}
            </p>
          </div>
        </div>
        <span className="text-gray-400 text-lg">{open ? "▲" : "▼"}</span>
      </button>

      {/* Drawer body */}
      {open && (
        <div className="px-6 pb-6 space-y-4 border-t border-gray-100">
          {complaints.length > 0 && (
            <Section title="Past Complaints" items={complaints} accent="rose" />
          )}
          {sops.length > 0 && (
            <Section title="Relevant SOPs" items={sops} accent="blue" />
          )}
        </div>
      )}
    </div>
  );
}

function Section({
  title,
  items,
  accent,
}: {
  title:  string;
  items:  string[];
  accent: "rose" | "blue";
}) {
  const border = accent === "rose" ? "border-rose-200"  : "border-blue-200";
  const bg     = accent === "rose" ? "bg-rose-50"       : "bg-blue-50";
  const text   = accent === "rose" ? "text-rose-800"    : "text-blue-800";

  return (
    <div className="mt-4">
      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
        {title}
      </p>
      <ul className="space-y-2">
        {items.map((item, i) => (
          <li
            key={i}
            className={`text-xs leading-relaxed px-3 py-2 rounded-lg border ${border} ${bg} ${text}`}
          >
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}

// Safely extract a list of strings from whatever shape the RAG context comes in
function extractList(value: unknown): string[] {
  if (!value) return [];
  if (Array.isArray(value)) {
    return value.map((item) => {
      if (typeof item === "string") return item;
      if (typeof item === "object" && item !== null) {
        const obj = item as Record<string, unknown>;
        return String(
          obj.text ?? obj.content ?? obj.complaint ?? obj.summary ?? JSON.stringify(item)
        );
      }
      return String(item);
    });
  }
  return [];
}