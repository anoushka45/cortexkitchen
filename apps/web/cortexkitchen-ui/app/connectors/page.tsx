"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { ConnectorStatus, getConnectorsStatus, triggerSwiggySync } from "@/lib/api";

function formatRelativeTime(isoString: string | null): string {
  if (!isoString) return "Never";
  const diff = Date.now() - new Date(isoString).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function freshnessColor(isoString: string | null): string {
  if (!isoString) return "text-[var(--color-text-faint)]";
  const diff = Date.now() - new Date(isoString).getTime();
  const hrs = diff / 3_600_000;
  if (hrs < 2) return "text-emerald-400";
  if (hrs < 12) return "text-amber-400";
  return "text-rose-400";
}

function StatusBadge({ connected, syncStatus }: { connected: boolean; syncStatus: string }) {
  if (!connected) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--color-border-default)] bg-[var(--color-surface-sunken)] px-2.5 py-1 text-xs font-medium text-[var(--color-text-soft)]">
        <span className="h-1.5 w-1.5 rounded-full bg-slate-500" />
        Not connected
      </span>
    );
  }
  if (syncStatus === "error") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-rose-500/30 bg-rose-500/10 px-2.5 py-1 text-xs font-medium text-rose-300">
        <span className="h-1.5 w-1.5 rounded-full bg-rose-400" />
        Sync error
      </span>
    );
  }
  if (syncStatus === "syncing") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/30 bg-amber-500/10 px-2.5 py-1 text-xs font-medium text-amber-300">
        <span className="h-1.5 w-1.5 rounded-full bg-amber-400 animate-pulse" />
        Syncing…
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-xs font-medium text-emerald-300">
      <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
      Connected
    </span>
  );
}

function SwiggyCard({ connector }: { connector: ConnectorStatus }) {
  const [syncing, setSyncing] = useState(false);
  const [syncMsg, setSyncMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  async function handleSync() {
    setSyncing(true);
    setSyncMsg(null);
    try {
      const res = await triggerSwiggySync();
      const r = res.results as Record<string, { synced?: number; error?: string }>;
      const parts = Object.entries(r).map(([k, v]) =>
        v.error ? `${k}: ${v.error}` : `${k}: ${v.synced ?? 0} records`
      );
      setSyncMsg({ type: "success", text: parts.join(" · ") || res.message });
    } catch (err) {
      setSyncMsg({ type: "error", text: err instanceof Error ? err.message : "Sync failed." });
    } finally {
      setSyncing(false);
    }
  }

  return (
    <div className="rounded-2xl border border-[var(--color-border-default)] bg-[var(--color-surface-raised)] p-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-4">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl border border-[var(--color-border-default)] bg-white p-1.5">
            <Image
              src="/swiggy-logo.png"
              alt="Swiggy"
              width={44}
              height={44}
              className="h-full w-full object-contain"
            />
          </div>
          <div>
            <div className="flex items-center gap-2.5">
              <h2 className="text-base font-semibold text-[var(--color-text-primary)]">Swiggy</h2>
              <StatusBadge connected={connector.connected} syncStatus={connector.sync_status} />
            </div>
            <p className="mt-0.5 text-xs text-[var(--color-text-soft)]">
              Food Delivery · Instamart · Dineout
            </p>
            <p className="mt-0.5 text-[10px] text-[var(--color-text-ghost)] uppercase tracking-widest">
              via Swiggy MCP
            </p>
          </div>
        </div>

        {connector.connected ? (
          <button
            onClick={handleSync}
            disabled={syncing}
            className="flex shrink-0 items-center gap-2 rounded-lg border border-[var(--color-border-default)] bg-[var(--color-surface-raised)] px-4 py-2 text-sm font-medium text-[var(--color-text-soft)] transition-colors hover:border-[var(--color-border-default)] hover:bg-[var(--color-surface-raised)] hover:text-[var(--color-text-primary)] disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {syncing ? (
              <>
                <svg className="h-3.5 w-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Syncing…
              </>
            ) : (
              <>
                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                Sync now
              </>
            )}
          </button>
        ) : null}
      </div>

      {/* Sync result message */}
      {syncMsg && (
        <div className={`mt-4 rounded-lg border px-4 py-3 text-xs ${
          syncMsg.type === "success"
            ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
            : "border-rose-500/30 bg-rose-500/10 text-rose-300"
        }`}>
          {syncMsg.text}
        </div>
      )}

      {/* Stats row */}
      <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-xl border border-[var(--color-border-soft)] bg-[var(--color-surface-raised)] px-4 py-3">
          <p className="text-[10px] uppercase tracking-widest text-[var(--color-text-faint)]">Orders synced</p>
          <p className="mt-1 text-xl font-bold tabular-nums text-[var(--color-text-primary)]">
            {connector.orders_synced.toLocaleString()}
          </p>
        </div>
        <div className="rounded-xl border border-[var(--color-border-soft)] bg-[var(--color-surface-raised)] px-4 py-3">
          <p className="text-[10px] uppercase tracking-widest text-[var(--color-text-faint)]">Feedback synced</p>
          <p className="mt-1 text-xl font-bold tabular-nums text-[var(--color-text-primary)]">
            {connector.feedback_synced.toLocaleString()}
          </p>
        </div>
        <div className="rounded-xl border border-[var(--color-border-soft)] bg-[var(--color-surface-raised)] px-4 py-3">
          <p className="text-[10px] uppercase tracking-widest text-[var(--color-text-faint)]">Last sync</p>
          <p className={`mt-1 text-sm font-semibold ${freshnessColor(connector.last_sync_at)}`}>
            {formatRelativeTime(connector.last_sync_at)}
          </p>
          {connector.last_sync_at && (
            <p className="text-[9px] text-[var(--color-text-ghost)] mt-0.5">
              {new Date(connector.last_sync_at).toLocaleString("en-IN", { dateStyle: "short", timeStyle: "short" })}
            </p>
          )}
        </div>
        <div className="rounded-xl border border-[var(--color-border-soft)] bg-[var(--color-surface-raised)] px-4 py-3">
          <p className="text-[10px] uppercase tracking-widest text-[var(--color-text-faint)]">Address</p>
          <p className={`mt-1 text-sm font-semibold ${connector.address_configured ? "text-emerald-400" : "text-amber-400"}`}>
            {connector.address_configured ? "Configured" : "Not set"}
          </p>
        </div>
      </div>

      {/* Data source labels */}
      <div className="mt-4 flex flex-wrap gap-2">
        {[
          { label: "Food Delivery", color: "text-orange-300 border-orange-500/30 bg-orange-500/10" },
          { label: "Instamart", color: "text-emerald-300 border-emerald-500/30 bg-emerald-500/10" },
          { label: "Dineout", color: "text-sky-300 border-sky-500/30 bg-sky-500/10" },
        ].map(({ label, color }) => (
          <span key={label} className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[10px] font-mono tracking-wide ${color}`}>
            {label}
          </span>
        ))}
      </div>

      {/* Connection instructions */}
      {!connector.connected && (
        <div className="mt-5 rounded-xl border border-amber-500/20 bg-amber-500/[0.06] p-4 text-sm">
          <p className="font-medium text-amber-200">Set up your Swiggy connection</p>
          <p className="mt-1 text-xs text-amber-300/70">
            Run the OAuth flow to get your access token and address ID, then add them to your <code className="font-mono text-amber-200">.env</code> file.
          </p>
          <pre className="mt-3 overflow-x-auto rounded-lg border border-[var(--color-border-default)] bg-[var(--color-surface-sunken)] p-3 text-[11px] font-mono text-[var(--color-text-soft)]">
{`npx mcp-remote https://mcp.swiggy.com/food
# complete phone + OTP in browser
# copy access_token → SWIGGY_ACCESS_TOKEN in .env
# call get_addresses once → SWIGGY_ADDRESS_ID in .env`}
          </pre>
        </div>
      )}
    </div>
  );
}

function ComingSoonCard({ name, description, icon }: { name: string; description: string; icon: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-dashed border-[var(--color-border-default)] bg-[var(--color-surface-raised)] p-5 flex items-center gap-4 opacity-60">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[var(--color-border-default)] bg-[var(--color-surface-raised)] text-[var(--color-text-faint)]">
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="text-sm font-medium text-[var(--color-text-soft)]">{name}</p>
          <span className="rounded-full border border-[var(--color-border-default)] bg-[var(--color-surface-sunken)] px-2 py-0.5 text-[9px] uppercase tracking-wider text-[var(--color-text-faint)]">
            Coming soon
          </span>
        </div>
        <p className="mt-0.5 text-xs text-[var(--color-text-faint)]">{description}</p>
      </div>
    </div>
  );
}

export default function ConnectorsPage() {
  const [data,    setData]    = useState<{ connectors: ConnectorStatus[] } | null>(null);
  const [error,   setError]   = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getConnectorsStatus()
      .then(setData)
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load connector status."))
      .finally(() => setLoading(false));
  }, []);

  const swiggy = data?.connectors.find((c) => c.type === "swiggy");

  return (
    <main className="min-h-screen bg-[var(--color-surface)] px-5 py-6 text-[var(--color-text-primary)] xl:px-8">
      <div className="mx-auto max-w-3xl space-y-8">

        {/* Page header */}
        <header className="flex flex-col gap-4 border-b border-[var(--color-border-default)] pb-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.22em] text-[var(--color-accent)]">
              platform integrations
            </p>
            <h1 className="mt-2 text-2xl font-semibold tracking-tight">Connectors</h1>
            <p className="mt-1 max-w-xl text-sm text-[var(--color-text-soft)]">
              Live data from Swiggy powers your planning pipeline — real orders, delivery feedback, competitor pricing, and Instamart procurement.
            </p>
          </div>
          <Link
            href="/dashboard"
            className="shrink-0 rounded-lg border border-[var(--color-border-default)] px-3 py-2 text-xs font-mono text-[var(--color-text-soft)] hover:bg-[var(--color-surface-raised)] hover:text-[var(--color-text-primary)] transition-colors"
          >
            ← dashboard
          </Link>
        </header>

        {/* Error */}
        {error && (
          <div className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
            {error}
          </div>
        )}

        {/* Active integrations */}
        <section className="space-y-3">
          <p className="text-xs uppercase tracking-[0.18em] text-[var(--color-text-faint)] px-0.5">
            Active
          </p>

          {loading ? (
            <div className="rounded-2xl border border-[var(--color-border-default)] bg-[var(--color-surface-raised)] p-6 animate-pulse">
              <div className="flex items-start gap-4">
                <div className="h-14 w-14 rounded-xl bg-[var(--color-surface-raised)] shrink-0" />
                <div className="flex-1 space-y-2 pt-1">
                  <div className="h-4 w-32 rounded bg-[var(--color-surface-raised)]" />
                  <div className="h-3 w-56 rounded bg-[var(--color-surface-raised)]" />
                </div>
              </div>
              <div className="mt-5 grid grid-cols-4 gap-3">
                {[...Array(4)].map((_, i) => (
                  <div key={i} className="h-16 rounded-xl bg-[var(--color-surface-raised)]" />
                ))}
              </div>
            </div>
          ) : swiggy ? (
            <SwiggyCard connector={swiggy} />
          ) : (
            <p className="text-sm text-[var(--color-text-faint)] px-1">No connectors found.</p>
          )}
        </section>

        {/* Coming soon */}
        <section className="space-y-3">
          <p className="text-xs uppercase tracking-[0.18em] text-[var(--color-text-faint)] px-0.5">
            Coming soon
          </p>
          <div className="space-y-2">
            <ComingSoonCard
              name="Zomato"
              description="Import orders and customer reviews from Zomato."
              icon={
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
              }
            />
            <ComingSoonCard
              name="Google Reviews"
              description="Pull customer sentiment directly from your Google Business profile."
              icon={
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                </svg>
              }
            />
            <ComingSoonCard
              name="POS — Square"
              description="Sync in-store sales, table billing, and shift-level data."
              icon={
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                </svg>
              }
            />
          </div>
        </section>

        {/* Footer note */}
        <p className="text-center text-[10px] text-[var(--color-text-ghost)] uppercase tracking-widest pb-4">
          Powered by Swiggy MCP · read-only live data
        </p>
      </div>
    </main>
  );
}
