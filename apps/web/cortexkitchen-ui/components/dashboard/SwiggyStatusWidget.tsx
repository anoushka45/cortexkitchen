"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { ConnectorStatus, getConnectorsStatus, triggerSwiggySync } from "@/lib/api";

function formatRelativeTime(isoString: string | null): string {
  if (!isoString) return "never";
  const diff = Date.now() - new Date(isoString).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export default function SwiggyStatusWidget() {
  const [connector, setConnector] = useState<ConnectorStatus | null>(null);
  const [syncing,   setSyncing]   = useState(false);
  const [syncOk,    setSyncOk]    = useState(false);

  useEffect(() => {
    getConnectorsStatus()
      .then((d) => setConnector(d.connectors.find((c) => c.type === "swiggy") ?? null))
      .catch(() => { /* non-blocking */ });
  }, []);

  async function handleQuickSync() {
    if (syncing) return;
    setSyncing(true);
    setSyncOk(false);
    try {
      await triggerSwiggySync();
      setSyncOk(true);
      const d = await getConnectorsStatus();
      setConnector(d.connectors.find((c) => c.type === "swiggy") ?? null);
    } catch { /* ignore */ } finally {
      setSyncing(false);
    }
  }

  if (!connector) return null;

  const connected = connector.connected;
  const fresh     = connector.last_sync_at
    ? (Date.now() - new Date(connector.last_sync_at).getTime()) < 2 * 3_600_000
    : false;

  return (
    <div className={`flex flex-wrap items-center gap-3 rounded-xl border px-4 py-2.5 text-xs transition-colors ${
      connected
        ? "border-orange-500/20 bg-orange-500/[0.04]"
        : "border-[var(--color-border-soft)] bg-[var(--color-surface-raised)]"
    }`}>
      {/* Logo + name */}
      <div className="flex shrink-0 items-center gap-2">
        <div className="flex h-5 w-5 items-center justify-center rounded bg-white p-0.5">
          <Image src="/swiggy-logo.png" alt="Swiggy" width={16} height={16} className="h-full w-full object-contain" />
        </div>
        <span className="font-medium text-[var(--color-text-soft)]">Swiggy</span>
        <span className={`h-1.5 w-1.5 rounded-full ${connected ? (fresh ? "bg-emerald-400" : "bg-amber-400") : "bg-slate-600"}`} />
      </div>

      {/* Status text */}
      {connected ? (
        <>
          <span className="text-[var(--color-text-faint)]">·</span>
          <span className="text-[var(--color-text-soft)]">
            last sync{" "}
            <span className={fresh ? "text-emerald-400" : "text-amber-400"}>
              {formatRelativeTime(connector.last_sync_at)}
            </span>
          </span>
          <span className="text-[var(--color-text-faint)]">·</span>
          <span className="text-[var(--color-text-soft)]">
            <span className="font-semibold text-[var(--color-text-primary)]">{connector.orders_synced.toLocaleString()}</span> orders
          </span>
          {connector.feedback_synced > 0 && (
            <>
              <span className="text-[var(--color-text-faint)]">·</span>
              <span className="text-[var(--color-text-soft)]">
                <span className="font-semibold text-[var(--color-text-primary)]">{connector.feedback_synced.toLocaleString()}</span> feedback
              </span>
            </>
          )}
        </>
      ) : (
        <>
          <span className="text-[var(--color-text-faint)]">·</span>
          <span className="text-amber-400">Not connected</span>
        </>
      )}

      {/* Spacer */}
      <div className="flex-1" />

      {/* Actions */}
      <div className="flex shrink-0 items-center gap-2">
        {connected && (
          <button
            onClick={handleQuickSync}
            disabled={syncing}
            title="Sync Swiggy data now"
            className="flex items-center gap-1 rounded-lg border border-[var(--color-border-default)] bg-[var(--color-surface-raised)] px-2.5 py-1 text-[11px] font-mono text-[var(--color-text-soft)] transition-colors hover:border-[var(--color-border-default)] hover:text-[var(--color-text-primary)] disabled:opacity-40"
          >
            {syncing ? (
              <svg className="h-3 w-3 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            ) : syncOk ? (
              <svg className="h-3 w-3 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            ) : (
              <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            )}
            {syncing ? "syncing" : syncOk ? "synced" : "sync"}
          </button>
        )}
        <Link
          href="/connectors"
          className="rounded-lg border border-[var(--color-border-default)] bg-[var(--color-surface-raised)] px-2.5 py-1 text-[11px] font-mono text-[var(--color-text-soft)] transition-colors hover:border-[var(--color-border-default)] hover:text-[var(--color-text-primary)]"
        >
          manage →
        </Link>
      </div>
    </div>
  );
}
