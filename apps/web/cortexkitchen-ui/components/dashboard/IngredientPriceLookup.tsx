"use client";

import { useState } from "react";
import Image from "next/image";
import { searchIngredient, IngredientSearchResult } from "@/lib/api";

function SwiggyBadge() {
  return (
    <div className="flex items-center gap-1.5">
      <div className="flex h-4 w-4 items-center justify-center rounded bg-white p-0.5">
        <Image src="/swiggy-logo.png" alt="Swiggy" width={12} height={12} className="h-full w-full object-contain" />
      </div>
      <span className="text-[9px] uppercase tracking-widest text-[var(--color-text-faint)]">via Swiggy MCP</span>
    </div>
  );
}

type Status = "idle" | "loading" | "success" | "error" | "not_connected";

export default function IngredientPriceLookup() {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [results, setResults] = useState<IngredientSearchResult[]>([]);
  const [error, setError] = useState<string | null>(null);

  async function runSearch() {
    const trimmed = query.trim();
    if (!trimmed) return;
    setStatus("loading");
    setError(null);
    try {
      const res = await searchIngredient(trimmed);
      if (!res.swiggy_connected) {
        setStatus("not_connected");
        return;
      }
      setResults(res.results);
      setStatus("success");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Search failed");
      setStatus("error");
    }
  }

  return (
    <div className="rounded-2xl border border-[var(--color-border-default)] bg-[var(--color-surface-raised)] p-5">
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs uppercase tracking-widest text-[var(--color-text-faint)]">Ingredient Price Lookup</p>
        <SwiggyBadge />
      </div>

      <div className="flex gap-2">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && runSearch()}
          placeholder="e.g. paneer, tomatoes, cream"
          className="flex-1 rounded-md border border-[var(--color-border-soft)] bg-[var(--color-surface-page)] px-3 py-1.5 text-xs text-[var(--color-text-primary)] placeholder:text-[var(--color-text-ghost)]"
        />
        <button
          onClick={runSearch}
          disabled={status === "loading" || !query.trim()}
          className="rounded-md bg-[var(--color-accent)] px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50"
        >
          {status === "loading" ? "…" : "Search"}
        </button>
      </div>

      <div className="mt-3">
        {status === "idle" && (
          <p className="text-xs text-[var(--color-text-ghost)] italic">
            Search any ingredient for its live Instamart price — independent of current shortages.
          </p>
        )}
        {status === "not_connected" && (
          <p className="text-xs text-[var(--color-text-ghost)] italic">Connect Swiggy to search live Instamart prices.</p>
        )}
        {status === "error" && <p className="text-xs text-rose-400">{error}</p>}
        {status === "success" && results.length === 0 && (
          <p className="text-xs text-[var(--color-text-ghost)] italic">No products found for &quot;{query}&quot;.</p>
        )}
        {status === "success" && results.length > 0 && (
          <div className="space-y-1.5">
            {results.map((r, i) => (
              <div key={i} className="flex items-center justify-between rounded-lg border border-[var(--color-border-soft)] bg-[var(--color-surface-raised)] px-3 py-2">
                <div className="flex items-center gap-2 min-w-0">
                  <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${r.in_stock ? "bg-emerald-400" : "bg-slate-600"}`} />
                  <span className="text-xs text-[var(--color-text-soft)] truncate">{r.name}</span>
                </div>
                <span className="font-mono text-xs font-semibold text-[var(--color-text-primary)] shrink-0">₹{r.price}/{r.unit}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
