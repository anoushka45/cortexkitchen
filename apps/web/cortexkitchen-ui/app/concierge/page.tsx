"use client";

// Phase 6A-34: Guest Concierge -- a completely separate, no-auth, consumer-
// facing experience from the restaurant-operator portal. Sidebar/TopBar/
// FloatingChatWidget (app/layout.tsx) all gate on `user` and render null for
// an anonymous guest, so this page naturally renders with no operator chrome.

import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { deleteConciergeSession, getConciergeSession } from "@/lib/api";
import { ConciergeMessage, ConciergeSessionState } from "@/types/concierge";
import { useTheme } from "@/context/ThemeContext";
import { useAuth } from "@/context/AuthContext";
import { ConciergePlanHistoryEntry, derivePlanTitle, loadPlanHistory, removePlanHistory, upsertPlanHistory } from "@/lib/conciergeHistory";
import ConciergeChatArea from "@/components/concierge/ConciergeChatArea";
import ConciergeSidebar from "@/components/concierge/ConciergeSidebar";
import ConciergePreviousPlans from "@/components/concierge/ConciergePreviousPlans";

const BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";
const SESSION_KEY = "concierge_session_id";

function ConciergeThemeToggle() {
  const ctx = useTheme();
  if (!ctx) return null;
  const { theme, toggleTheme } = ctx;

  return (
    <button
      onClick={toggleTheme}
      aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-[var(--color-border-default)] bg-[var(--color-surface-raised)] text-[var(--color-text-faint)] transition-colors hover:text-[var(--color-accent)]"
    >
      {theme === "dark" ? (
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.36 6.36l-.71-.71M6.34 6.34l-.71-.71m12.73.01l-.71.71M6.34 17.66l-.71.71M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
        </svg>
      ) : (
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
        </svg>
      )}
    </button>
  );
}

// An operator (e.g. previewing the guest flow while still logged in) has no
// other way to sign out on this page since TopBar is deliberately hidden here.
function ConciergeLogoutButton() {
  const { user, logout } = useAuth();
  if (!user) return null;

  return (
    <button
      onClick={logout}
      title={`Log out (${user.full_name ?? user.email})`}
      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-[var(--color-border-default)] bg-[var(--color-surface-raised)] text-[var(--color-text-faint)] transition-colors hover:border-[var(--color-critical)]/40 hover:text-[var(--color-critical)]"
    >
      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
      </svg>
    </button>
  );
}

export default function ConciergePage() {
  const [messages, setMessages] = useState<ConciergeMessage[]>([]);
  const [busy, setBusy] = useState(false);
  const [sessionState, setSessionState] = useState<ConciergeSessionState | null>(null);
  const [planHistory, setPlanHistory] = useState<ConciergePlanHistoryEntry[]>([]);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const sessionIdRef = useRef<string | null>(null);

  useEffect(() => {
    setPlanHistory(loadPlanHistory());
    sessionIdRef.current = localStorage.getItem(SESSION_KEY);
    setActiveSessionId(sessionIdRef.current);
    if (sessionIdRef.current) {
      getConciergeSession(sessionIdRef.current).then(setSessionState).catch(() => {
        localStorage.removeItem(SESSION_KEY);
        sessionIdRef.current = null;
        setActiveSessionId(null);
      });
    }
  }, []);

  const send = useCallback(async (text: string) => {
    if (busy) return;
    setBusy(true);
    setMessages((prev) => [
      ...prev,
      { role: "user", text, toolResults: [] },
      { role: "assistant", text: "", toolResults: [], streaming: true },
    ]);

    try {
      const res = await fetch(`${BASE_URL}/api/v1/concierge/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ session_id: sessionIdRef.current, message: text }),
      });
      if (!res.ok || !res.body) throw new Error(`API error ${res.status}`);

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (!line.startsWith("data:")) continue;
          let payload: Record<string, unknown>;
          try {
            payload = JSON.parse(line.slice(5).trim());
          } catch {
            continue;
          }

          if (typeof payload.session_id === "string" && sessionIdRef.current !== payload.session_id) {
            sessionIdRef.current = payload.session_id;
            localStorage.setItem(SESSION_KEY, payload.session_id);
            setActiveSessionId(payload.session_id);
          }

          if (payload.type === "status" && typeof payload.content === "string") {
            const statusText = payload.content;
            setMessages((prev) => {
              const next = [...prev];
              const last = next[next.length - 1];
              if (last?.role === "assistant") next[next.length - 1] = { ...last, statusText };
              return next;
            });
          }

          if (payload.type === "text" && typeof payload.content === "string") {
            const content = payload.content;
            setMessages((prev) => {
              const next = [...prev];
              const last = next[next.length - 1];
              if (last?.role === "assistant") next[next.length - 1] = { ...last, text: last.text + content, statusText: undefined };
              return next;
            });
          }

          if (payload.type === "tool_result" && typeof payload.tool === "string") {
            const tool = payload.tool;
            const data = payload.data;
            setMessages((prev) => {
              const next = [...prev];
              const last = next[next.length - 1];
              if (last?.role === "assistant") {
                next[next.length - 1] = { ...last, toolResults: [...last.toolResults, { tool, data }], statusText: undefined };
              }
              return next;
            });
          }

          if (payload.type === "error") {
            // Hard rule: never surface raw exception/log text to a guest --
            // the real error is already logged server-side.
            setMessages((prev) => {
              const next = [...prev];
              const last = next[next.length - 1];
              if (last?.role === "assistant" && !last.text) {
                next[next.length - 1] = { ...last, text: "Sorry, something went wrong on my end. Let's try that again.", statusText: undefined };
              }
              return next;
            });
          }

          if (payload.done) break;
        }
      }
    } catch {
      setMessages((prev) => {
        const next = [...prev];
        next[next.length - 1] = {
          role: "assistant",
          text: "Sorry, something went wrong on my end. Let's try that again.",
          toolResults: [],
        };
        return next;
      });
    } finally {
      setMessages((prev) => {
        const next = [...prev];
        const last = next[next.length - 1];
        if (last?.role === "assistant") next[next.length - 1] = { ...last, streaming: false };
        return next;
      });
      setBusy(false);
      if (sessionIdRef.current) {
        try {
          const latest = await getConciergeSession(sessionIdRef.current);
          setSessionState(latest);
          setPlanHistory(upsertPlanHistory(sessionIdRef.current, derivePlanTitle(latest.occasion, latest.headcount, text)));
        } catch {
          // non-fatal -- sidebar and history just stay stale until the next turn
        }
      }
    }
  }, [busy]);

  async function handleReset() {
    if (sessionIdRef.current) {
      try { await deleteConciergeSession(sessionIdRef.current); } catch { /* best effort */ }
      setPlanHistory(removePlanHistory(sessionIdRef.current));
    }
    localStorage.removeItem(SESSION_KEY);
    sessionIdRef.current = null;
    setActiveSessionId(null);
    setMessages([]);
    setSessionState(null);
  }

  async function handleSelectPlan(sessionId: string) {
    if (sessionId === sessionIdRef.current) return;
    sessionIdRef.current = sessionId;
    setActiveSessionId(sessionId);
    localStorage.setItem(SESSION_KEY, sessionId);
    setMessages([]);
    try {
      setSessionState(await getConciergeSession(sessionId));
    } catch {
      setSessionState(null);
    }
  }

  function handleNewPlan() {
    sessionIdRef.current = null;
    setActiveSessionId(null);
    localStorage.removeItem(SESSION_KEY);
    setMessages([]);
    setSessionState(null);
  }

  return (
    <main className="flex h-screen flex-col page-canvas">
      <header className="relative z-10 flex shrink-0 items-center justify-between border-b border-[var(--color-border-default)] bg-[var(--color-surface-raised)]/80 px-5 py-3 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setHistoryOpen((o) => !o)}
            title={historyOpen ? "Hide previous plans" : "Show previous plans"}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-[var(--color-text-faint)] transition-colors hover:bg-[var(--color-surface-sunken)] hover:text-[var(--color-text-primary)]"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h7" />
            </svg>
          </button>
          <Link href="/" className="flex items-center gap-2.5">
            <span className="grid h-8 w-8 place-items-center overflow-hidden rounded-lg bg-black ring-1 ring-[var(--color-border-default)]">
              <Image src="/ck-logo.png" alt="CK" width={26} height={26} className="h-6.5 w-6.5 object-contain" />
            </span>
            <div className="leading-tight">
              <div className="text-[13.5px] font-bold tracking-tight text-[var(--color-text-primary)]">Guest Concierge</div>
              <div className="text-[9px] uppercase tracking-[0.2em] text-[var(--color-accent)]/70">CortexKitchen</div>
            </div>
          </Link>
        </div>
        <div className="flex items-center gap-2.5">
          <div className="flex items-center gap-2 rounded-full bg-white px-3 py-1.5 shadow-[0_1px_4px_rgba(20,15,5,0.12)]">
            <Image src="/swiggy-logo.png" alt="Swiggy" width={16} height={16} className="h-4 w-4 object-contain" />
            <span className="text-[10px] font-semibold text-[#1a1a1a]">Powered by Swiggy</span>
          </div>
          <ConciergeThemeToggle />
          <ConciergeLogoutButton />
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        <ConciergePreviousPlans
          open={historyOpen}
          entries={planHistory}
          activeSessionId={activeSessionId}
          onSelect={handleSelectPlan}
          onNew={handleNewPlan}
        />
        <ConciergeChatArea messages={messages} busy={busy} headcount={sessionState?.headcount} onSend={send} />
        <ConciergeSidebar session={sessionState} onReset={handleReset} />
      </div>
    </main>
  );
}
