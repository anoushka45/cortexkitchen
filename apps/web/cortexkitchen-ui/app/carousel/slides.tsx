import type { ReactNode } from "react";

/* ──────────────────────────────────────────────────────────────────────────
   Shared slide primitives — every slide is a 1080×1350 canvas (LinkedIn 4:5).
   Styling reuses the app's ink + ember design language.
   ────────────────────────────────────────────────────────────────────────── */

function Kicker({ children }: { children: ReactNode }) {
  return (
    <div className="font-mono text-[15px] uppercase tracking-[0.26em] text-ember-300/85">
      {children}
    </div>
  );
}

function Mono({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <span className={`font-mono uppercase tracking-[0.18em] ${className}`}>{children}</span>
  );
}

function SlideFrame({
  index,
  total,
  children,
  accentGlow = true,
}: {
  index: number;
  total: number;
  children: ReactNode;
  accentGlow?: boolean;
}) {
  return (
    <div className="relative flex h-full w-full flex-col overflow-hidden bg-ink-950 px-20 py-20 text-slate-100 grid-bg">
      {accentGlow && (
        <div
          className="pointer-events-none absolute -top-48 left-1/2 h-[760px] w-[1200px] -translate-x-1/2 rounded-full"
          style={{ background: "radial-gradient(closest-side, rgba(230,137,42,0.16), transparent 70%)" }}
        />
      )}
      {/* Header rail */}
      <div className="relative z-10 flex items-center justify-between border-b border-white/10 pb-6">
        <div className="flex items-center gap-3">
          <span className="flex h-3 w-3 rounded-full bg-ember-400 shadow-glow-ember" />
          <span className="font-mono text-[16px] font-bold uppercase tracking-[0.22em] text-white">
            CortexKitchen
          </span>
        </div>
        <span className="font-mono text-[15px] uppercase tracking-[0.2em] text-white/35">
          {String(index + 1).padStart(2, "0")} / {String(total).padStart(2, "0")}
        </span>
      </div>

      {/* Body */}
      <div className="relative z-10 flex flex-1 flex-col justify-center py-10">{children}</div>

      {/* Footer rail */}
      <div className="relative z-10 flex items-center justify-between border-t border-white/10 pt-6">
        <span className="font-mono text-[14px] uppercase tracking-[0.2em] text-white/40">
          Multi-agent ops intelligence
        </span>
        <span className="font-mono text-[14px] uppercase tracking-[0.2em] text-ember-300/70">
          {index < total - 1 ? "swipe →" : "the end"}
        </span>
      </div>
    </div>
  );
}

function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div className={`rounded-2xl bg-ink-900 p-6 ring-1 ring-white/[0.08] ${className}`}>{children}</div>
  );
}

/* ──────────────────────────────────────────────────────────────────────────
   Slides
   ────────────────────────────────────────────────────────────────────────── */

const TOTAL = 12;

function Slide01() {
  return (
    <SlideFrame index={0} total={TOTAL}>
      <div className="inline-flex w-fit items-center gap-2 rounded-full bg-ember-500/[0.08] px-4 py-2 ring-1 ring-ember-500/25">
        <span className="flex h-2 w-2 rounded-full bg-ember-400" />
        <Mono className="text-[13px] text-ember-200">A system design teardown</Mono>
      </div>

      <h1 className="mt-10 text-[92px] font-bold leading-[0.94] tracking-[-0.03em] text-white text-balance">
        I built a{" "}
        <span className="display-it font-normal text-ember-300">multi-agent</span> AI
        platform for restaurant operations.
      </h1>

      <p className="mt-10 max-w-[760px] text-[26px] leading-[1.55] text-white/65">
        Nine LangGraph nodes. Five specialist agents in parallel. A critic that can block the
        plan. Streaming, RAG, caching, evals, and full observability.
      </p>

      <div className="mt-12 flex flex-wrap gap-3">
        {["LangGraph", "FastAPI", "Prophet", "Qdrant RAG", "Redis", "LangSmith"].map((t) => (
          <span
            key={t}
            className="rounded-lg bg-white/[0.04] px-4 py-2 font-mono text-[15px] uppercase tracking-wider text-white/60 ring-1 ring-white/10"
          >
            {t}
          </span>
        ))}
      </div>

      <p className="mt-12 text-[20px] text-white/45">
        Here&apos;s how the whole thing fits together{" "}
        <span className="text-ember-300/80">↓</span>
      </p>
    </SlideFrame>
  );
}

function Slide02() {
  return (
    <SlideFrame index={1} total={TOTAL}>
      <Kicker>The problem</Kicker>
      <h2 className="mt-6 text-[68px] font-bold leading-[1.0] tracking-[-0.02em] text-white text-balance">
        Most kitchens run service{" "}
        <span className="display-it font-normal text-ember-300">half-blind.</span>
      </h2>

      <p className="mt-8 max-w-[780px] text-[24px] leading-[1.6] text-white/65">
        By 4pm Friday the floor manager has a reservation list, a hunch about the weather, and an
        inventory sheet from this morning. The forecast lives in someone&apos;s head.
      </p>

      <div className="mt-12 grid grid-cols-2 gap-5">
        <Card className="ring-rose-400/15">
          <Mono className="text-[14px] text-rose-300/80">Before</Mono>
          <div className="mt-4 space-y-3 text-[20px] text-white/70">
            <div>4 separate dashboards</div>
            <div>1 stale spreadsheet</div>
            <div>A group chat at 7:12pm</div>
            <div>No single source of truth</div>
          </div>
        </Card>
        <Card className="ring-emerald-400/20">
          <Mono className="text-[14px] text-emerald-300/85">After</Mono>
          <div className="mt-4 space-y-3 text-[20px] text-white/85">
            <div>1 verified pre-shift brief</div>
            <div>1 critic verdict</div>
            <div>Evidence behind every call</div>
            <div className="text-emerald-300">&lt; 90 seconds to read</div>
          </div>
        </Card>
      </div>
    </SlideFrame>
  );
}

function Slide03() {
  return (
    <SlideFrame index={2} total={TOTAL}>
      <Kicker>What it actually is</Kicker>
      <h2 className="mt-6 text-[64px] font-bold leading-[1.02] tracking-[-0.02em] text-white text-balance">
        Not a chatbot. Not a{" "}
        <span className="display-it font-normal text-ember-300">RAG demo.</span>
      </h2>

      <p className="mt-8 max-w-[800px] text-[24px] leading-[1.6] text-white/65">
        It&apos;s a multi-agent system that combines time-series forecasting, vector retrieval, LLM
        reasoning, streaming delivery, and business-rule validation into one governed pipeline.
      </p>

      <div className="mt-12 grid grid-cols-3 gap-4">
        {[
          { k: "5", l: "specialist agents working in parallel on your data" },
          { k: "9", l: "node LangGraph pipeline per planning run" },
          { k: "5", l: "dimension critic gate before you see a word" },
        ].map((s) => (
          <Card key={s.l}>
            <div className="num-display text-[80px] leading-none text-ember-300">{s.k}</div>
            <div className="mt-3 text-[18px] leading-snug text-white/55">{s.l}</div>
          </Card>
        ))}
      </div>
    </SlideFrame>
  );
}

function ArrowDown() {
  return (
    <div className="flex justify-center py-1 text-ember-300/70">
      <svg width="20" height="26" viewBox="0 0 20 26" fill="none">
        <line x1="10" y1="1" x2="10" y2="20" stroke="currentColor" strokeWidth="1.6" strokeDasharray="3 2.5" />
        <path d="M4 16 L10 22 L16 16" stroke="currentColor" strokeWidth="1.8" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </div>
  );
}

function Slide04() {
  const layers = [
    { tag: "Client", title: "Claude Code / Desktop", sub: "MCP stdio — run_planning_scenario · get_run_history" },
    { tag: "UI", title: "Next.js 16 App Router", sub: "Dashboard · Runs · Ask AI · Data Health — JWT + SSE" },
    { tag: "API", title: "FastAPI + Pydantic v2", sub: "/planning · /chat · /runs · /export — org-scoped JWT" },
    { tag: "Brain", title: "LangGraph StateGraph", sub: "9 nodes · parallel fan-out · conditional routing" },
    { tag: "Data", title: "Postgres · Qdrant · Redis · LLM", sub: "structured · vectors · cache · Groq/Gemini" },
  ];
  return (
    <SlideFrame index={3} total={TOTAL}>
      <Kicker>System shape</Kicker>
      <h2 className="mt-6 text-[56px] font-bold leading-[1.04] tracking-[-0.02em] text-white text-balance">
        Five layers, one{" "}
        <span className="display-it font-normal text-ember-300">request path.</span>
      </h2>

      <div className="mt-10">
        {layers.map((l, i) => (
          <div key={l.title}>
            <div className="flex items-center gap-5 rounded-2xl bg-ink-900 p-5 ring-1 ring-white/[0.08]">
              <span className="w-[88px] shrink-0 font-mono text-[14px] uppercase tracking-[0.16em] text-ember-300/80">
                {l.tag}
              </span>
              <div className="min-w-0">
                <div className="text-[24px] font-semibold text-white">{l.title}</div>
                <div className="mt-1 font-mono text-[15px] tracking-wide text-white/45">{l.sub}</div>
              </div>
            </div>
            {i < layers.length - 1 && <ArrowDown />}
          </div>
        ))}
      </div>
    </SlideFrame>
  );
}

function PipeNode({
  title,
  tone = "default",
  small = false,
}: {
  title: string;
  tone?: "default" | "ember" | "emerald" | "rose";
  small?: boolean;
}) {
  const tones: Record<string, string> = {
    default: "bg-white/[0.04] ring-white/10 text-white/80",
    ember: "bg-ember-500/[0.10] ring-ember-400/30 text-ember-200",
    emerald: "bg-emerald-500/[0.08] ring-emerald-400/25 text-emerald-200",
    rose: "bg-rose-500/[0.08] ring-rose-400/25 text-rose-200",
  };
  return (
    <div
      className={`rounded-xl px-4 py-3 text-center font-mono uppercase tracking-wider ring-1 ${tones[tone]} ${
        small ? "text-[14px]" : "text-[16px]"
      }`}
    >
      {title}
    </div>
  );
}

function Slide05() {
  return (
    <SlideFrame index={4} total={TOTAL}>
      <Kicker>The pipeline · 9 nodes</Kicker>
      <h2 className="mt-6 text-[56px] font-bold leading-[1.02] tracking-[-0.02em] text-white text-balance">
        One run. <span className="display-it font-normal text-ember-300">Nine</span> nodes.
      </h2>

      <div className="mt-10 rounded-3xl bg-ink-900 p-8 ring-1 ring-white/[0.08]">
        <PipeNode title="Ops Manager" tone="default" />
        <ArrowDown />
        <PipeNode title="Demand Forecast · Prophet" tone="ember" />
        <ArrowDown />
        <div className="grid grid-cols-2 gap-3">
          <PipeNode title="Reservations" tone="emerald" small />
          <PipeNode title="Complaints · RAG" tone="emerald" small />
          <PipeNode title="Menu Intel" tone="emerald" small />
          <PipeNode title="Inventory" tone="emerald" small />
        </div>
        <div className="py-1 text-center font-mono text-[13px] uppercase tracking-[0.2em] text-emerald-300/70">
          parallel fan-out
        </div>
        <PipeNode title="Aggregator" tone="default" />
        <ArrowDown />
        <PipeNode title="Critic · quality gate" tone="ember" />
        <ArrowDown />
        <PipeNode title="Final Assembler → response" tone="default" />
      </div>

      <p className="mt-8 text-[19px] leading-relaxed text-white/55">
        Conditional routing skips to the assembler on error. The four domain agents fan out in
        parallel and re-converge at the aggregator.
      </p>
    </SlideFrame>
  );
}

function Slide06() {
  const agents = [
    { n: "01", t: "Demand Forecast", d: "Prophet time-series over historical orders → covers, peak hour, confidence band." },
    { n: "02", t: "Reservations", d: "Booking density, occupancy %, and waitlist pressure for the shift." },
    { n: "03", t: "Complaint Intel", d: "Qdrant RAG over real past guest issues — grounds recommendations in evidence." },
    { n: "04", t: "Menu Intelligence", d: "Top / weak items → push, ease-back, or avoid strategy for tonight." },
    { n: "05", t: "Inventory", d: "Shortage + overstock detection with restock priority and spoilage risk." },
  ];
  return (
    <SlideFrame index={5} total={TOTAL}>
      <Kicker>The five specialists</Kicker>
      <h2 className="mt-6 text-[56px] font-bold leading-[1.02] tracking-[-0.02em] text-white text-balance">
        Each agent owns{" "}
        <span className="display-it font-normal text-ember-300">one domain.</span>
      </h2>

      <div className="mt-10 space-y-4">
        {agents.map((a) => (
          <div
            key={a.n}
            className="flex items-start gap-5 rounded-2xl bg-ink-900 p-5 ring-1 ring-white/[0.08]"
          >
            <span className="num-display text-[42px] leading-none text-ember-300/80">{a.n}</span>
            <div>
              <div className="text-[24px] font-semibold text-white">{a.t}</div>
              <div className="mt-1 text-[18px] leading-snug text-white/55">{a.d}</div>
            </div>
          </div>
        ))}
      </div>
    </SlideFrame>
  );
}

function Slide07() {
  const dims = ["Safety", "Feasibility", "Evidence", "Actionability", "Clarity"];
  return (
    <SlideFrame index={6} total={TOTAL}>
      <Kicker>The critic · quality gate</Kicker>
      <h2 className="mt-6 text-[56px] font-bold leading-[1.02] tracking-[-0.02em] text-white text-balance">
        No plan ships{" "}
        <span className="display-it font-normal text-ember-300">unchecked.</span>
      </h2>

      <p className="mt-8 max-w-[780px] text-[23px] leading-[1.6] text-white/65">
        A dedicated critic agent scores every aggregated plan across five dimensions, then gates it
        with a verdict before it ever reaches the manager.
      </p>

      <div className="mt-10 grid grid-cols-5 gap-3">
        {dims.map((d) => (
          <div key={d} className="rounded-xl bg-ink-900 p-4 text-center ring-1 ring-white/[0.08]">
            <div className="num-display text-[34px] text-ember-300">★</div>
            <div className="mt-2 font-mono text-[13px] uppercase tracking-wide text-white/55">{d}</div>
          </div>
        ))}
      </div>

      <div className="mt-10 grid grid-cols-3 gap-4">
        <Card className="ring-emerald-400/25 text-center">
          <Mono className="text-[14px] text-emerald-300">Approved</Mono>
          <div className="mt-2 text-[17px] text-white/55">ships + cached</div>
        </Card>
        <Card className="ring-ember-400/25 text-center">
          <Mono className="text-[14px] text-ember-300">Revision</Mono>
          <div className="mt-2 text-[17px] text-white/55">flagged, not cached</div>
        </Card>
        <Card className="ring-rose-400/25 text-center">
          <Mono className="text-[14px] text-rose-300">Rejected</Mono>
          <div className="mt-2 text-[17px] text-white/55">blocked, explained</div>
        </Card>
      </div>
    </SlideFrame>
  );
}

function Slide08() {
  return (
    <SlideFrame index={7} total={TOTAL}>
      <Kicker>Streaming · caching · what-if</Kicker>
      <h2 className="mt-6 text-[56px] font-bold leading-[1.02] tracking-[-0.02em] text-white text-balance">
        Every run feels{" "}
        <span className="display-it font-normal text-ember-300">interactive.</span>
      </h2>

      <div className="mt-10 space-y-5">
        <Card>
          <Mono className="text-[14px] text-ember-300/80">SSE streaming</Mono>
          <div className="mt-2 text-[21px] leading-snug text-white/75">
            Each node emits a <span className="font-mono text-ember-200">node_complete</span> event
            — the pipeline diagram lights up live as agents finish. The full plan arrives in one
            final <span className="font-mono text-ember-200">complete</span> event.
          </div>
        </Card>
        <Card>
          <Mono className="text-[14px] text-ember-300/80">Redis plan cache</Mono>
          <div className="mt-2 text-[21px] leading-snug text-white/75">
            Keyed by <span className="font-mono text-ember-200">(org, scenario, date)</span>, 1-hour
            TTL. Only approved plans are cached → repeat runs cost{" "}
            <span className="text-emerald-300">zero LLM tokens.</span>
          </div>
        </Card>
        <Card>
          <Mono className="text-[14px] text-ember-300/80">What-if simulator</Mono>
          <div className="mt-2 text-[21px] leading-snug text-white/75">
            Slide the cover count → cost, benefit, and tradeoff scores update instantly.
            Deterministic scoring, no LLM call, no pipeline re-run.
          </div>
        </Card>
      </div>
    </SlideFrame>
  );
}

function Slide09() {
  return (
    <SlideFrame index={8} total={TOTAL}>
      <Kicker>Retrieval-augmented</Kicker>
      <h2 className="mt-6 text-[56px] font-bold leading-[1.02] tracking-[-0.02em] text-white text-balance">
        Grounded in{" "}
        <span className="display-it font-normal text-ember-300">your</span> data.
      </h2>

      <p className="mt-8 max-w-[800px] text-[23px] leading-[1.6] text-white/65">
        Complaint intelligence retrieves real past guest issues from Qdrant — recommendations cite
        evidence, not generic model output. A separate RAG chatbot answers questions over your run
        history and feedback.
      </p>

      <div className="mt-10 grid grid-cols-2 gap-4">
        <Card>
          <Mono className="text-[14px] text-ember-300/80">Qdrant vector store</Mono>
          <div className="mt-3 space-y-2 text-[19px] text-white/70">
            <div>complaints_memory + sop_memory</div>
            <div>org-scoped payload filter per query</div>
            <div>feeds the complaint agent prompt</div>
          </div>
        </Card>
        <Card>
          <Mono className="text-[14px] text-ember-300/80">Ask AI chatbot</Mono>
          <div className="mt-3 space-y-2 text-[19px] text-white/70">
            <div>last 10 runs + 30 feedback records</div>
            <div>AsyncGroq token-by-token stream</div>
            <div>multi-turn, ReactMarkdown rendered</div>
          </div>
        </Card>
      </div>
    </SlideFrame>
  );
}

function Slide10() {
  const rows = [
    { t: "LangSmith", d: "Per-node traces + cortexkitchen-golden-v1 dataset (50 runs)" },
    { t: "CI quality gate", d: "90% pass rate required on the golden dataset" },
    { t: "RAGAS", d: "Faithfulness ≥ 0.8 on the complaint RAG pipeline" },
    { t: "DeepEval", d: "Hallucination ≤ 0.5 · relevancy ≥ 0.7 on critic + agents" },
    { t: "OTel + Prometheus", d: "HTTP tracing + /metrics latency & error rate" },
    { t: "Sentry + structlog", d: "Exception capture w/ node tags · JSON logs everywhere" },
  ];
  return (
    <SlideFrame index={9} total={TOTAL}>
      <Kicker>Observability & evals</Kicker>
      <h2 className="mt-6 text-[56px] font-bold leading-[1.02] tracking-[-0.02em] text-white text-balance">
        Quality is{" "}
        <span className="display-it font-normal text-ember-300">enforced</span>, not hoped for.
      </h2>

      <div className="mt-10 space-y-3.5">
        {rows.map((r) => (
          <div
            key={r.t}
            className="flex items-center gap-5 rounded-xl bg-ink-900 px-5 py-4 ring-1 ring-white/[0.08]"
          >
            <span className="w-[230px] shrink-0 font-mono text-[16px] uppercase tracking-wide text-ember-300/85">
              {r.t}
            </span>
            <span className="text-[18px] text-white/65">{r.d}</span>
          </div>
        ))}
      </div>
    </SlideFrame>
  );
}

function Slide11() {
  return (
    <SlideFrame index={10} total={TOTAL}>
      <Kicker>Tenancy & provider abstraction</Kicker>
      <h2 className="mt-6 text-[54px] font-bold leading-[1.04] tracking-[-0.02em] text-white text-balance">
        Production-minded by{" "}
        <span className="display-it font-normal text-ember-300">default.</span>
      </h2>

      <div className="mt-10 grid grid-cols-1 gap-5">
        <Card>
          <Mono className="text-[14px] text-ember-300/80">Multi-tenant isolation — 3 layers</Mono>
          <div className="mt-3 grid grid-cols-3 gap-3 text-[18px] text-white/70">
            <div className="rounded-lg bg-white/[0.03] p-3 ring-1 ring-white/10">
              <span className="font-mono text-[14px] text-white/45">Postgres</span>
              <div className="mt-1">org_id on every run query</div>
            </div>
            <div className="rounded-lg bg-white/[0.03] p-3 ring-1 ring-white/10">
              <span className="font-mono text-[14px] text-white/45">Qdrant</span>
              <div className="mt-1">payload filter per org</div>
            </div>
            <div className="rounded-lg bg-white/[0.03] p-3 ring-1 ring-white/10">
              <span className="font-mono text-[14px] text-white/45">State</span>
              <div className="mt-1">org_id carried node-to-node</div>
            </div>
          </div>
        </Card>
        <Card>
          <Mono className="text-[14px] text-ember-300/80">Swappable LLM layer</Mono>
          <div className="mt-3 text-[20px] leading-snug text-white/75">
            Every agent depends on <span className="font-mono text-ember-200">BaseLLMProvider</span>
            , never a concrete SDK. Groq <span className="font-mono text-ember-200">llama-3.3-70b</span>{" "}
            by default, transparent fallback to Gemini, provider switch via one env var.
          </div>
        </Card>
      </div>
    </SlideFrame>
  );
}

function Slide12() {
  const stack = [
    "LangGraph", "FastAPI", "Next.js 16", "React 19", "PostgreSQL 16", "Qdrant",
    "Redis 7", "Prophet", "Groq", "Gemini", "LangSmith", "OpenTelemetry",
    "Prometheus", "Sentry", "RAGAS", "DeepEval", "ReportLab", "openpyxl",
  ];
  return (
    <SlideFrame index={11} total={TOTAL} accentGlow>
      <Kicker>The stack · let&apos;s talk</Kicker>
      <h2 className="mt-6 text-[60px] font-bold leading-[1.0] tracking-[-0.02em] text-white text-balance">
        From data to a verified brief in{" "}
        <span className="display-it font-normal text-ember-300">90 seconds.</span>
      </h2>

      <div className="mt-10 flex flex-wrap gap-2.5">
        {stack.map((s) => (
          <span
            key={s}
            className="rounded-lg bg-white/[0.04] px-4 py-2 font-mono text-[15px] uppercase tracking-wider text-white/60 ring-1 ring-white/10"
          >
            {s}
          </span>
        ))}
      </div>

      <div className="mt-14 rounded-2xl bg-ember-500/[0.07] p-7 ring-1 ring-ember-400/25">
        <div className="text-[26px] font-semibold text-white">
          If you build vertical AI systems — orchestration, RAG, evals, observability — I&apos;d
          love to compare notes.
        </div>
        <div className="mt-4 font-mono text-[17px] uppercase tracking-[0.18em] text-ember-200">
          Repost if useful · Questions welcome
        </div>
      </div>
    </SlideFrame>
  );
}

export const slides: ReactNode[] = [
  <Slide01 key="1" />,
  <Slide02 key="2" />,
  <Slide03 key="3" />,
  <Slide04 key="4" />,
  <Slide05 key="5" />,
  <Slide06 key="6" />,
  <Slide07 key="7" />,
  <Slide08 key="8" />,
  <Slide09 key="9" />,
  <Slide10 key="10" />,
  <Slide11 key="11" />,
  <Slide12 key="12" />,
];

export const SLIDE_W = 1080;
export const SLIDE_H = 1350;
