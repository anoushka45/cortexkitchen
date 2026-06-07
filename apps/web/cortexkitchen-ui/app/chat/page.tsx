"use client";

import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import { getAuthToken } from "@/lib/auth-cookies";
import ReactMarkdown from "react-markdown";

const BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";

const SUGGESTIONS = [
  { category: "Quality",   icon: "◆", q: "Which run had the lowest critic score and why?" },
  { category: "Complaints",icon: "◈", q: "What are the most common complaints recently?" },
  { category: "Inventory", icon: "◉", q: "Which ingredients are flagged as low stock most often?" },
  { category: "Menu",      icon: "◇", q: "Which items are highlighted across multiple runs?" },
  { category: "Demand",    icon: "◎", q: "Which scenario had the highest predicted orders?" },
  { category: "Strategy",  icon: "◐", q: "If I had to focus on one thing to improve our score, what would it be?" },
];

interface Message {
  role: "user" | "assistant";
  content: string;
  streaming?: boolean;
}

export default function ChatPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput]       = useState("");
  const [busy, setBusy]         = useState(false);
  const bottomRef  = useRef<HTMLDivElement>(null);
  const inputRef   = useRef<HTMLTextAreaElement>(null);
  const scrollArea = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!authLoading && !user) router.push("/login");
  }, [user, authLoading, router]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function send(question: string) {
    if (!question.trim() || busy) return;
    const q = question.trim();
    setInput("");
    setBusy(true);

    const history = messages.map(m => ({ role: m.role, content: m.content }));
    setMessages(prev => [
      ...prev,
      { role: "user",      content: q },
      { role: "assistant", content: "", streaming: true },
    ]);

    try {
      const token = getAuthToken();
      const res = await fetch(`${BASE_URL}/api/v1/chat`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ question: q, history }),
      });

      if (!res.ok || !res.body) throw new Error(`API error ${res.status}`);

      const reader  = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer    = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (!line.startsWith("data:")) continue;
          try {
            const payload = JSON.parse(line.slice(5).trim());
            if (payload.token) {
              setMessages(prev => {
                const next = [...prev];
                const last = next[next.length - 1];
                if (last?.role === "assistant")
                  next[next.length - 1] = { ...last, content: last.content + payload.token };
                return next;
              });
            }
            if (payload.done || payload.error) break;
          } catch { /* skip malformed */ }
        }
      }
    } catch (err) {
      setMessages(prev => {
        const next = [...prev];
        next[next.length - 1] = {
          role: "assistant",
          content: `Something went wrong. ${err instanceof Error ? err.message : ""}`,
        };
        return next;
      });
    } finally {
      setMessages(prev => {
        const next = [...prev];
        const last = next[next.length - 1];
        if (last?.role === "assistant") next[next.length - 1] = { ...last, streaming: false };
        return next;
      });
      setBusy(false);
      inputRef.current?.focus();
    }
  }

  function handleKey(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(input); }
  }

  if (authLoading || !user) return null;

  const empty   = messages.length === 0;
  const initials = (user.full_name ?? user.email).slice(0, 2).toUpperCase();

  return (
    <main className="flex h-[calc(100vh-56px)] flex-col bg-[#09111f] relative overflow-hidden">

      {/* Ambient glow */}
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
        <div className="h-[500px] w-[700px] rounded-full opacity-[0.04]"
          style={{ background: "radial-gradient(closest-side, #e6892a, transparent)" }} />
      </div>

      {/* ── Message area ─────────────────────────────────────────── */}
      <div ref={scrollArea} className="relative flex-1 overflow-y-auto">
        <div className="mx-auto max-w-2xl px-4 py-8">

          {/* ── Empty state ─────────────────────────── */}
          {empty && (
            <div className="pt-6 pb-4">
              {/* Header */}
              <div className="text-center mb-10">
                <div className="inline-flex items-center gap-2 rounded-full border border-ember-500/20 bg-ember-500/[0.07] px-4 py-1.5 mb-5">
                  <span className="relative flex h-1.5 w-1.5">
                    <span className="absolute inset-0 animate-ping rounded-full bg-ember-400 opacity-60" />
                    <span className="relative rounded-full bg-ember-400" />
                  </span>
                  <span className="font-mono text-[10px] uppercase tracking-[0.26em] text-ember-300">
                    Your kitchen assistant
                  </span>
                </div>

                <h1 className="text-[34px] font-semibold tracking-[-0.02em] text-white leading-[1.05]">
                  Ask about{" "}
                  <span className="display-it text-ember-300">{user.org_name}</span>
                </h1>
                <p className="mt-3 text-[13px] leading-[1.7] text-white/38 max-w-xs mx-auto">
                  Answers come from your actual run history, inventory data, and customer feedback. Not generic AI.
                </p>
              </div>

              {/* Suggestion grid */}
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {SUGGESTIONS.map(({ category, icon, q }) => (
                  <button
                    key={q}
                    onClick={() => send(q)}
                    className="group relative flex items-start gap-3 rounded-2xl border border-white/[0.07] bg-white/[0.025] px-4 py-3.5 text-left transition-all duration-200 hover:border-ember-500/30 hover:bg-ember-500/[0.04]"
                  >
                    <span className="mt-0.5 text-[11px] text-ember-400/60 group-hover:text-ember-400 transition-colors">{icon}</span>
                    <div className="flex-1 min-w-0">
                      <p className="font-mono text-[9px] uppercase tracking-[0.2em] text-white/25 mb-1 group-hover:text-ember-400/50 transition-colors">{category}</p>
                      <p className="text-[13px] text-white/55 leading-snug group-hover:text-white/85 transition-colors">{q}</p>
                    </div>
                    <svg className="mt-1 h-3.5 w-3.5 shrink-0 text-white/15 group-hover:text-ember-400/50 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 12h14M12 5l7 7-7 7" />
                    </svg>
                  </button>
                ))}
              </div>

              {/* Model badge */}
              <p className="mt-6 text-center font-mono text-[9px] uppercase tracking-[0.22em] text-white/18">
                llama-3.3-70b · RAG over your runs & feedback
              </p>
            </div>
          )}

          {/* ── Messages ────────────────────────────── */}
          <div className="space-y-5">
            {messages.map((msg, i) => (
              <div key={i} className={`flex items-start gap-3 ${msg.role === "user" ? "flex-row-reverse" : ""}`}>

                {/* Avatar */}
                {msg.role === "assistant" ? (
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-gradient-to-b from-ember-500/30 to-ember-700/20 ring-1 ring-ember-400/25 mt-0.5">
                    <span className="font-mono text-[9px] font-bold text-ember-300">CK</span>
                  </div>
                ) : (
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-violet-600/20 ring-1 ring-violet-500/30 mt-0.5">
                    <span className="font-mono text-[9px] font-bold text-violet-300">{initials}</span>
                  </div>
                )}

                {/* Bubble */}
                <div className={`max-w-[82%] rounded-2xl px-4 py-3 text-[13.5px] leading-relaxed ${
                  msg.role === "user"
                    ? "rounded-tr-sm bg-gradient-to-br from-violet-600/25 to-violet-800/15 ring-1 ring-violet-500/20 text-white/90"
                    : "rounded-tl-sm bg-white/[0.04] ring-1 ring-white/[0.07] text-white/80"
                }`}>
                  {/* Thinking dots */}
                  {!msg.content && msg.streaming && (
                    <span className="inline-flex gap-1.5 items-center py-0.5">
                      {[0, 150, 300].map(d => (
                        <span key={d} className="h-1.5 w-1.5 rounded-full bg-white/25 animate-bounce"
                          style={{ animationDelay: `${d}ms` }} />
                      ))}
                    </span>
                  )}

                  {/* User message */}
                  {msg.content && msg.role === "user" && (
                    <span>{msg.content}</span>
                  )}

                  {/* Assistant message with markdown */}
                  {msg.content && msg.role === "assistant" && (
                    <div className="prose-chat">
                      <ReactMarkdown>{msg.content}</ReactMarkdown>
                      {msg.streaming && (
                        <span className="inline-block h-[14px] w-[2px] rounded-full bg-ember-400 animate-pulse ml-0.5 translate-y-[2px]" />
                      )}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>

          <div ref={bottomRef} className="h-4" />
        </div>
      </div>

      {/* ── Input bar ───────────────────────────────────────────── */}
      <div className="relative border-t border-white/[0.06] bg-[#09111f]/95 px-4 pb-5 pt-4 backdrop-blur-md">
        <div className="mx-auto max-w-2xl">

          {/* Input card */}
          <div className="relative rounded-2xl border border-white/10 bg-white/[0.035] transition-all duration-200 focus-within:border-ember-500/35 focus-within:bg-white/[0.05] focus-within:shadow-[0_0_0_3px_rgba(230,137,42,0.06)]">
            <textarea
              ref={inputRef}
              rows={1}
              value={input}
              onChange={(e) => {
                setInput(e.target.value);
                e.target.style.height = "auto";
                e.target.style.height = Math.min(e.target.scrollHeight, 120) + "px";
              }}
              onKeyDown={handleKey}
              placeholder="Ask anything about your restaurant's performance…"
              disabled={busy}
              className="w-full resize-none bg-transparent px-4 pt-3.5 pb-12 text-[13.5px] text-white placeholder-white/22 focus:outline-none disabled:opacity-40"
              style={{ maxHeight: "120px" }}
            />

            {/* Footer row inside card */}
            <div className="absolute bottom-0 left-0 right-0 flex items-center justify-between px-4 pb-3">
              <span className="font-mono text-[9px] uppercase tracking-[0.2em] text-white/18">
                {busy ? "Thinking…" : "Enter ↵ to send"}
              </span>
              <button
                onClick={() => send(input)}
                disabled={busy || !input.trim()}
                className="flex items-center gap-1.5 rounded-xl bg-ember-500 px-3 py-1.5 text-[11px] font-semibold text-white transition-all hover:bg-ember-400 disabled:opacity-25 disabled:cursor-not-allowed"
              >
                {busy ? (
                  <span className="flex gap-1">
                    {[0,100,200].map(d => (
                      <span key={d} className="h-1 w-1 rounded-full bg-white/60 animate-bounce"
                        style={{ animationDelay: `${d}ms` }} />
                    ))}
                  </span>
                ) : (
                  <>
                    Send
                    <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 12h14M12 5l7 7-7 7" />
                    </svg>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Clear chat */}
          {messages.length > 0 && (
            <div className="mt-2.5 flex justify-center">
              <button
                onClick={() => setMessages([])}
                className="font-mono text-[9px] uppercase tracking-[0.2em] text-white/20 transition-colors hover:text-white/40"
              >
                Clear conversation
              </button>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
