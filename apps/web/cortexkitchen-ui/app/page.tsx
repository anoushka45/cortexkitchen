import Image from "next/image";
import Link from "next/link";

// ── Shared data ───────────────────────────────────────────────────────────────

const AGENTS = [
  {
    label: "Demand Forecast",
    capability: "Prophet time-series forecasting — predicts covers, order volume, and peak-hour pressure for the service window.",
    iconPath: "M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z",
    border: "border-violet-500/25", bg: "bg-violet-500/[0.07]", icon: "text-violet-400", dot: "bg-violet-400",
  },
  {
    label: "Reservation Pressure",
    capability: "Maps occupancy %, waitlist risk, and table-turn signals directly from live booking data.",
    iconPath: "M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z",
    border: "border-cyan-500/25", bg: "bg-cyan-500/[0.07]", icon: "text-cyan-400", dot: "bg-cyan-400",
  },
  {
    label: "Complaint Intelligence",
    capability: "RAG-backed analysis over historical guest feedback — surfaces recurring issues and ranked action items.",
    iconPath: "M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z",
    border: "border-rose-500/25", bg: "bg-rose-500/[0.07]", icon: "text-rose-400", dot: "bg-rose-400",
  },
  {
    label: "Menu Intelligence",
    capability: "Cross-signal synthesis from demand, inventory pressure, and guest feedback — what to push, avoid, and promote.",
    iconPath: "M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4",
    border: "border-amber-500/25", bg: "bg-amber-500/[0.07]", icon: "text-amber-400", dot: "bg-amber-400",
  },
  {
    label: "Inventory Status",
    capability: "Shortage and overstock detection with spoilage-aware restock prioritisation and demand-ratio analysis.",
    iconPath: "M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4",
    border: "border-emerald-500/25", bg: "bg-emerald-500/[0.07]", icon: "text-emerald-400", dot: "bg-emerald-400",
  },
];

const TECH_STACK = [
  { name: "LangGraph",     desc: "9-node StateGraph with parallel fan-out and typed shared state" },
  { name: "Prophet",       desc: "Facebook's time-series model for demand forecasting with peak detection" },
  { name: "Qdrant + RAG",  desc: "Vector store for complaint intelligence with semantic retrieval" },
  { name: "Groq / Gemini", desc: "LLM provider abstraction with automatic fallback on failure" },
  { name: "LangSmith",     desc: "Per-node tracing and observability for every planning run" },
  { name: "RAGAS + DeepEval", desc: "Automated evaluation suite — faithfulness, hallucination, relevancy" },
  { name: "Multi-tenant",  desc: "JWT auth, org isolation, role-based access (owner / staff)" },
  { name: "MCP Server",    desc: "Anthropic MCP SDK — fire planning runs directly from Claude Desktop" },
];

const STEPS = [
  {
    num: "01",
    title: "Choose a scenario",
    desc: "Pick from 4 presets: Friday Rush, Weekday Lunch, Holiday Spike, or Low-Stock Weekend. Each frames the agent analysis for that operational context.",
  },
  {
    num: "02",
    title: "5 agents run in parallel",
    desc: "Ops Manager sequences the run. Demand Forecast gates all agents. Then Reservations, Complaints, Menu, and Inventory analyse in parallel — aggregated and verified by the Critic.",
  },
  {
    num: "03",
    title: "Critic-verified plan",
    desc: "Every plan is scored across 5 dimensions before you see it. Export as PDF or Excel. Drill down by agent. Compare runs side by side.",
  },
];

const DIMENSIONS = ["Safety", "Feasibility", "Evidence", "Actionability", "Clarity"];

// ── Header ────────────────────────────────────────────────────────────────────

function HomeHeader() {
  return (
    <header className="sticky top-0 z-50 border-b border-white/[0.06] bg-[#09111f]/90 backdrop-blur-md">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-4 px-5 sm:px-8">
        <Link href="/" className="flex items-center gap-2.5">
          <div className="flex h-7 w-7 items-center justify-center overflow-hidden rounded-lg border border-white/10 bg-slate-950/40">
            <Image src="/ck-logo.png" alt="CortexKitchen" width={28} height={28} className="h-7 w-7 object-contain" />
          </div>
          <span className="text-sm font-bold tracking-tight text-white">CortexKitchen</span>
        </Link>
        <div className="flex items-center gap-3">
          <Link href="/login"
            className="text-sm text-slate-400 transition-colors hover:text-white">
            Sign in
          </Link>
          <Link href="/register"
            className="rounded-lg bg-violet-600 px-4 py-1.5 text-sm font-semibold text-white transition-colors hover:bg-violet-500">
            Get started
          </Link>
        </div>
      </div>
    </header>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function HomePage() {
  return (
    <div className="min-h-screen bg-[#09111f] text-slate-100">
      <HomeHeader />

      {/* ── Hero ── */}
      <section className="relative overflow-hidden px-5 pt-24 pb-20 sm:px-8 lg:pt-32 lg:pb-28">
        {/* Radial glow */}
        <div className="pointer-events-none absolute inset-0 flex items-start justify-center">
          <div className="h-[600px] w-[900px] rounded-full bg-violet-600/10 blur-[120px]" />
        </div>
        {/* Grid texture */}
        <div className="pointer-events-none absolute inset-0 opacity-[0.06]" style={{
          backgroundImage: "linear-gradient(rgba(148,163,184,0.5) 1px,transparent 1px),linear-gradient(90deg,rgba(148,163,184,0.5) 1px,transparent 1px)",
          backgroundSize: "40px 40px",
        }} />

        <div className="relative mx-auto max-w-4xl text-center">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-violet-500/20 bg-violet-500/8 px-4 py-1.5">
            <span className="relative flex h-2 w-2">
              <span className="absolute inset-0 animate-ping rounded-full bg-violet-400 opacity-60" />
              <span className="relative rounded-full bg-violet-400" />
            </span>
            <span className="text-xs font-mono uppercase tracking-[0.22em] text-violet-300">
              9-node agentic pipeline
            </span>
          </div>

          <h1 className="text-5xl font-bold tracking-tight text-white sm:text-6xl lg:text-7xl">
            Restaurant ops intelligence<br />
            <span className="bg-gradient-to-r from-violet-400 via-violet-300 to-slate-200 bg-clip-text text-transparent">
              for the shift before it happens.
            </span>
          </h1>

          <p className="mx-auto mt-6 max-w-2xl text-lg leading-8 text-slate-400">
            Parallel multi-agent analysis across demand, reservations, complaints, menu direction,
            and inventory — synthesized by LangGraph, verified by a critic, ready before your team briefs.
          </p>

          <div className="mt-10 flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
            <Link href="/register"
              className="inline-flex items-center gap-2 rounded-xl bg-violet-600 px-6 py-3 text-sm font-semibold text-white shadow-[0_4px_20px_rgba(139,92,246,0.4)] transition-all hover:-translate-y-0.5 hover:bg-violet-500 hover:shadow-[0_6px_24px_rgba(139,92,246,0.5)]">
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              Start planning free
            </Link>
            <Link href="/login"
              className="inline-flex items-center gap-2 rounded-xl border border-white/10 px-6 py-3 text-sm font-semibold text-slate-300 transition-all hover:border-white/20 hover:bg-white/[0.04] hover:text-white">
              Sign in to your workspace
            </Link>
          </div>
        </div>
      </section>

      {/* ── Stats strip ── */}
      <section className="border-y border-white/[0.06] bg-white/[0.015]">
        <div className="mx-auto max-w-5xl px-5 py-8 sm:px-8">
          <div className="grid grid-cols-2 gap-6 sm:grid-cols-4">
            {[
              ["9", "orchestration nodes"],
              ["5", "parallel domain agents"],
              ["4", "scenario presets"],
              ["5", "critic scoring dimensions"],
            ].map(([num, label]) => (
              <div key={label} className="text-center">
                <p className="text-3xl font-bold text-white">{num}</p>
                <p className="mt-1 text-xs font-mono uppercase tracking-[0.16em] text-slate-500">{label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── How it works ── */}
      <section className="px-5 py-24 sm:px-8">
        <div className="mx-auto max-w-5xl">
          <div className="mb-14 text-center">
            <p className="text-xs font-mono uppercase tracking-[0.22em] text-violet-300">How it works</p>
            <h2 className="mt-3 text-3xl font-bold text-white sm:text-4xl">From scenario to plan in seconds.</h2>
          </div>
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            {STEPS.map((step) => (
              <div key={step.num} className="rounded-2xl border border-white/10 bg-white/[0.02] p-6">
                <p className="font-mono text-4xl font-bold text-violet-500/30">{step.num}</p>
                <h3 className="mt-4 text-lg font-semibold text-white">{step.title}</h3>
                <p className="mt-2 text-sm leading-7 text-slate-400">{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Agent capabilities ── */}
      <section className="px-5 py-24 sm:px-8 bg-white/[0.01] border-y border-white/[0.05]">
        <div className="mx-auto max-w-5xl">
          <div className="mb-14 text-center">
            <p className="text-xs font-mono uppercase tracking-[0.22em] text-violet-300">Agent pipeline</p>
            <h2 className="mt-3 text-3xl font-bold text-white sm:text-4xl">5 agents. One coordinated view.</h2>
            <p className="mx-auto mt-4 max-w-xl text-sm leading-7 text-slate-400">
              Each agent specialises in one operational domain. They run in parallel after the demand forecast gates the pipeline — then an aggregator and critic synthesise and score the result.
            </p>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {AGENTS.map((agent) => (
              <div key={agent.label} className={`rounded-2xl border p-5 ${agent.border} ${agent.bg}`}>
                <div className="flex items-center gap-3 mb-3">
                  <span className={`shrink-0 ${agent.icon}`}>
                    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.7}>
                      <path strokeLinecap="round" strokeLinejoin="round" d={agent.iconPath} />
                    </svg>
                  </span>
                  <span className={`h-1.5 w-1.5 rounded-full ${agent.dot}`} />
                  <p className="text-sm font-semibold text-white">{agent.label}</p>
                </div>
                <p className="text-xs leading-relaxed text-slate-400">{agent.capability}</p>
              </div>
            ))}
            {/* Critic callout — 6th card */}
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 sm:col-span-2 lg:col-span-1">
              <div className="flex items-center gap-3 mb-3">
                <svg className="h-5 w-5 text-emerald-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.7}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                <p className="text-sm font-semibold text-white">Critic Verification</p>
              </div>
              <p className="text-xs leading-relaxed text-slate-400 mb-3">
                Every plan is scored before it reaches you — across {DIMENSIONS.length} dimensions.
              </p>
              <div className="flex flex-wrap gap-1.5">
                {DIMENSIONS.map((d) => (
                  <span key={d} className="rounded-full border border-emerald-500/20 bg-emerald-500/8 px-2 py-0.5 text-[10px] font-mono text-emerald-300">{d}</span>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Tech stack ── */}
      <section className="px-5 py-24 sm:px-8">
        <div className="mx-auto max-w-5xl">
          <div className="mb-14 text-center">
            <p className="text-xs font-mono uppercase tracking-[0.22em] text-violet-300">Built on serious infrastructure</p>
            <h2 className="mt-3 text-3xl font-bold text-white sm:text-4xl">Production-grade from day one.</h2>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {TECH_STACK.map((tech) => (
              <div key={tech.name} className="rounded-xl border border-white/10 bg-white/[0.02] p-4 transition-all hover:border-white/20 hover:bg-white/[0.04]">
                <p className="text-sm font-semibold text-violet-300">{tech.name}</p>
                <p className="mt-1.5 text-xs leading-relaxed text-slate-500">{tech.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Export & output ── */}
      <section className="px-5 py-24 sm:px-8 bg-white/[0.01] border-y border-white/[0.05]">
        <div className="mx-auto max-w-5xl">
          <div className="grid grid-cols-1 gap-12 lg:grid-cols-2 lg:items-center">
            <div>
              <p className="text-xs font-mono uppercase tracking-[0.22em] text-violet-300">Output</p>
              <h2 className="mt-3 text-3xl font-bold text-white sm:text-4xl">Plans you can act on immediately.</h2>
              <p className="mt-4 text-sm leading-7 text-slate-400">
                Every run produces a critic-verified plan with a score and verdict. Drill down into any agent output. Export as a branded PDF summary or a role-aware Excel workbook — chef sheet, owner cost breakdown, full summary.
              </p>
              <div className="mt-8 space-y-3">
                {[
                  ["PDF export", "One-page manager summary — verdict, scores, action items, LLM cost"],
                  ["Excel export", "3-sheet role-aware workbook — chef, owner, and summary views"],
                  ["Run history",  "Full audit trail with critic scores, agent outputs, and RAG context"],
                  ["Side-by-side diff", "Compare any two runs across all 5 critic dimensions"],
                ].map(([title, desc]) => (
                  <div key={title as string} className="flex items-start gap-3">
                    <svg className="mt-0.5 h-4 w-4 shrink-0 text-violet-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                    <div>
                      <p className="text-sm font-medium text-slate-200">{title}</p>
                      <p className="text-xs text-slate-500">{desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="rounded-3xl border border-white/10 bg-[#0d1320]/80 p-6">
              <p className="text-xs font-mono uppercase tracking-[0.20em] text-slate-600 mb-4">Critic scorecard</p>
              <div className="space-y-4">
                {[
                  { dim: "Safety",         score: 95, color: "bg-emerald-500" },
                  { dim: "Feasibility",    score: 88, color: "bg-emerald-500" },
                  { dim: "Evidence",       score: 82, color: "bg-emerald-500" },
                  { dim: "Actionability",  score: 90, color: "bg-emerald-500" },
                  { dim: "Clarity",        score: 78, color: "bg-amber-500"   },
                ].map(({ dim, score, color }) => (
                  <div key={dim}>
                    <div className="flex justify-between text-xs mb-1.5">
                      <span className="text-slate-400">{dim}</span>
                      <span className="font-mono text-slate-300">{score}/100</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-slate-800 overflow-hidden">
                      <div className={`h-full rounded-full ${color}`} style={{ width: `${score}%` }} />
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-5 flex items-center justify-between rounded-xl border border-emerald-500/20 bg-emerald-500/8 px-4 py-3">
                <div>
                  <p className="text-xs font-mono uppercase tracking-[0.14em] text-emerald-300">Verdict</p>
                  <p className="mt-0.5 text-lg font-bold text-emerald-400">APPROVED</p>
                </div>
                <p className="text-2xl font-bold text-white">0.87</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Final CTA ── */}
      <section className="px-5 py-28 sm:px-8">
        <div className="mx-auto max-w-3xl text-center">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-violet-500/20 bg-violet-500/8 px-4 py-1.5">
            <span className="relative flex h-2 w-2">
              <span className="absolute inset-0 animate-ping rounded-full bg-violet-400 opacity-60" />
              <span className="relative rounded-full bg-violet-400" />
            </span>
            <span className="text-xs font-mono uppercase tracking-[0.22em] text-violet-300">Ready to plan</span>
          </div>
          <h2 className="text-4xl font-bold text-white sm:text-5xl">
            Plan your next service run<br />
            <span className="bg-gradient-to-r from-violet-400 to-slate-300 bg-clip-text text-transparent">
              before it starts.
            </span>
          </h2>
          <p className="mx-auto mt-5 max-w-xl text-base leading-7 text-slate-400">
            Create a workspace, pick a scenario, and get a critic-verified plan in seconds. No real data required to start.
          </p>
          <div className="mt-10 flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
            <Link href="/register"
              className="inline-flex items-center gap-2 rounded-xl bg-violet-600 px-8 py-3.5 text-sm font-semibold text-white shadow-[0_4px_20px_rgba(139,92,246,0.4)] transition-all hover:-translate-y-0.5 hover:bg-violet-500">
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              Create workspace — free
            </Link>
            <Link href="/login"
              className="inline-flex items-center gap-2 rounded-xl border border-white/10 px-8 py-3.5 text-sm font-semibold text-slate-300 transition-all hover:border-white/20 hover:text-white">
              Sign in
            </Link>
          </div>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="border-t border-white/[0.06] px-5 py-8 sm:px-8">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <Image src="/ck-logo.png" alt="CortexKitchen" width={20} height={20} className="h-5 w-5 object-contain opacity-60" />
            <span className="text-xs text-slate-600 font-medium">CortexKitchen</span>
          </div>
          <p className="text-xs text-slate-700">Multi-agent restaurant ops intelligence</p>
          <div className="flex items-center gap-4">
            <Link href="/login"    className="text-xs text-slate-600 hover:text-slate-400">Sign in</Link>
            <Link href="/register" className="text-xs text-slate-600 hover:text-slate-400">Get started</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
