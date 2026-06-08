import type { ReactNode } from "react";

/* ──────────────────────────────────────────────────────────────────────────
   Shared slide primitives — every slide is a 1080×1350 canvas (LinkedIn 4:5).
   Styling reuses the app's ink + ember design language.
   Audience: CTOs · technical architects · AI startup founders.
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
    <div className="relative flex h-full w-full flex-col overflow-hidden bg-ink-950 px-16 py-14 text-slate-100 grid-bg">
      {accentGlow && (
        <div
          className="pointer-events-none absolute -top-48 left-1/2 h-[760px] w-[1200px] -translate-x-1/2 rounded-full"
          style={{ background: "radial-gradient(closest-side, rgba(230,137,42,0.16), transparent 70%)" }}
        />
      )}
      {/* Header rail */}
      <div className="relative z-10 flex items-center justify-between border-b border-white/10 pb-5">
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
      <div className="relative z-10 flex flex-1 flex-col justify-center py-8">{children}</div>

      {/* Footer rail */}
      <div className="relative z-10 flex items-center justify-between border-t border-white/10 pt-5">
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

/* Browser-chrome framed screenshot with a technical caption. */
function Shot({
  src,
  alt,
  caption,
  tall = false,
}: {
  src: string;
  alt: string;
  caption?: ReactNode;
  tall?: boolean;
}) {
  return (
    <figure className="overflow-hidden rounded-2xl bg-ink-900 ring-1 ring-white/[0.10] shadow-2xl">
      <div className="flex items-center gap-2 border-b border-white/10 bg-white/[0.03] px-4 py-3">
        <span className="h-3 w-3 rounded-full bg-rose-400/70" />
        <span className="h-3 w-3 rounded-full bg-ember-400/70" />
        <span className="h-3 w-3 rounded-full bg-emerald-400/70" />
        <span className="ml-3 font-mono text-[13px] tracking-wide text-white/35">{alt}</span>
      </div>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt={alt}
        className={`w-full ${tall ? "object-contain" : "object-cover object-top"}`}
        style={tall ? {} : { maxHeight: 560 }}
      />
      {caption && (
        <figcaption className="border-t border-white/10 px-6 py-5 text-[19px] leading-snug text-white/65">
          {caption}
        </figcaption>
      )}
    </figure>
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

/* ──────────────────────────────────────────────────────────────────────────
   Slides
   ────────────────────────────────────────────────────────────────────────── */

const TOTAL = 16;
const SHOT = "/carousel-shots";

function Slide01() {
  return (
    <SlideFrame index={0} total={TOTAL}>
      <div className="inline-flex w-fit items-center gap-2 rounded-full bg-ember-500/[0.08] px-4 py-2 ring-1 ring-ember-500/25">
        <span className="flex h-2 w-2 rounded-full bg-ember-400" />
        <Mono className="text-[13px] text-ember-200">A system design teardown</Mono>
      </div>

      <h1 className="mt-10 text-[88px] font-bold leading-[0.94] tracking-[-0.03em] text-white text-balance">
        I built a{" "}
        <span className="display-it font-normal text-ember-300">multi-agent</span> AI
        platform for restaurant operations.
      </h1>

      <p className="mt-10 max-w-[820px] text-[26px] leading-[1.55] text-white/65">
        Nine LangGraph nodes. Five specialist agents in parallel. A critic that can block the
        plan. Streaming, RAG, caching, evals, full observability — and real screenshots ahead.
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
        Built for the engineers who&apos;ll ask &quot;but how does it actually work?&quot;{" "}
        <span className="text-ember-300/80">↓</span>
      </p>
    </SlideFrame>
  );
}

function Slide02() {
  return (
    <SlideFrame index={1} total={TOTAL}>
      <Kicker>The problem</Kicker>
      <h2 className="mt-6 text-[64px] font-bold leading-[1.0] tracking-[-0.02em] text-white text-balance">
        Operators run service{" "}
        <span className="display-it font-normal text-ember-300">half-blind.</span>
      </h2>

      <p className="mt-8 max-w-[820px] text-[24px] leading-[1.6] text-white/65">
        Demand, reservations, complaints, menu, and inventory each live in a different tool. The
        synthesis happens in a manager&apos;s head at 4pm — unverifiable and unrepeatable.
      </p>

      <div className="mt-12 grid grid-cols-2 gap-5">
        <Card className="ring-rose-400/15">
          <Mono className="text-[14px] text-rose-300/80">Today</Mono>
          <div className="mt-4 space-y-3 text-[20px] text-white/70">
            <div>5 disconnected data sources</div>
            <div>Gut-feel synthesis</div>
            <div>No audit trail</div>
            <div>No quality bar</div>
          </div>
        </Card>
        <Card className="ring-emerald-400/20">
          <Mono className="text-[14px] text-emerald-300/85">CortexKitchen</Mono>
          <div className="mt-4 space-y-3 text-[20px] text-white/85">
            <div>1 governed pipeline</div>
            <div>Critic-scored output</div>
            <div>Evidence per recommendation</div>
            <div className="text-emerald-300">Verified brief in ~90s</div>
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
      <h2 className="mt-6 text-[60px] font-bold leading-[1.02] tracking-[-0.02em] text-white text-balance">
        Not a chatbot. Not a{" "}
        <span className="display-it font-normal text-ember-300">RAG demo.</span>
      </h2>

      <p className="mt-8 max-w-[820px] text-[24px] leading-[1.6] text-white/65">
        A governed multi-agent system that fuses time-series forecasting, vector retrieval, LLM
        reasoning, streaming delivery, and business-rule validation into one orchestrated run.
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

function Slide04() {
  const layers = [
    { tag: "Client", title: "Claude / MCP clients", sub: "MCP stdio — run_planning_scenario · get_run_history" },
    { tag: "UI", title: "Next.js 16 App Router", sub: "Dashboard · Runs · Ask AI · Data Health — JWT + SSE" },
    { tag: "API", title: "FastAPI + Pydantic v2", sub: "/planning · /chat · /runs · /export — org-scoped JWT" },
    { tag: "Brain", title: "LangGraph StateGraph", sub: "9 nodes · parallel fan-out · conditional routing" },
    { tag: "Data", title: "Postgres · Qdrant · Redis · LLM", sub: "structured · vectors · cache · Groq/Gemini" },
  ];
  return (
    <SlideFrame index={3} total={TOTAL}>
      <Kicker>System shape</Kicker>
      <h2 className="mt-6 text-[54px] font-bold leading-[1.04] tracking-[-0.02em] text-white text-balance">
        Five layers, one{" "}
        <span className="display-it font-normal text-ember-300">request path.</span>
      </h2>

      <div className="mt-9">
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

function Slide05() {
  return (
    <SlideFrame index={4} total={TOTAL}>
      <Kicker>The pipeline · 9 nodes</Kicker>
      <h2 className="mt-5 text-[52px] font-bold leading-[1.02] tracking-[-0.02em] text-white text-balance">
        One run. <span className="display-it font-normal text-ember-300">Nine</span> nodes.
      </h2>

      <div className="mt-7 rounded-3xl bg-ink-900 p-7 ring-1 ring-white/[0.08]">
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

      <p className="mt-6 text-[19px] leading-relaxed text-white/55">
        Conditional edges skip straight to the assembler on error. The four domain agents fan out
        in parallel and re-converge at the aggregator before the critic ever sees the plan.
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
      <h2 className="mt-5 text-[52px] font-bold leading-[1.02] tracking-[-0.02em] text-white text-balance">
        Each agent owns{" "}
        <span className="display-it font-normal text-ember-300">one domain.</span>
      </h2>

      <div className="mt-8 space-y-3.5">
        {agents.map((a) => (
          <div
            key={a.n}
            className="flex items-start gap-5 rounded-2xl bg-ink-900 p-5 ring-1 ring-white/[0.08]"
          >
            <span className="num-display text-[42px] leading-none text-ember-300/80">{a.n}</span>
            <div>
              <div className="text-[23px] font-semibold text-white">{a.t}</div>
              <div className="mt-1 text-[18px] leading-snug text-white/55">{a.d}</div>
            </div>
          </div>
        ))}
      </div>
    </SlideFrame>
  );
}

function Slide07() {
  return (
    <SlideFrame index={6} total={TOTAL}>
      <Kicker>The critic · quality gate</Kicker>
      <h2 className="mt-5 text-[50px] font-bold leading-[1.02] tracking-[-0.02em] text-white text-balance">
        No plan ships{" "}
        <span className="display-it font-normal text-ember-300">unchecked.</span>
      </h2>

      <div className="mt-7">
        <Shot
          src={`${SHOT}/critic_verdict.png`}
          alt="dashboard · critic verdict"
          caption={
            <>
              A dedicated critic agent scores every aggregated plan on{" "}
              <span className="text-white">Safety, Feasibility, Evidence, Actionability, Clarity</span>,
              emits an overall <span className="font-mono text-ember-200">0.92</span> verdict, and
              gates the run. Below the bar it&apos;s flagged for revision — never silently shipped.
            </>
          }
        />
      </div>
    </SlideFrame>
  );
}

function Slide08() {
  return (
    <SlideFrame index={7} total={TOTAL}>
      <Kicker>Determinism & caching</Kicker>
      <h2 className="mt-5 text-[50px] font-bold leading-[1.02] tracking-[-0.02em] text-white text-balance">
        Every run is{" "}
        <span className="display-it font-normal text-ember-300">replayable.</span>
      </h2>

      <div className="mt-7">
        <Shot
          src={`${SHOT}/run_history.png`}
          alt="runs · history + scores"
          caption={
            <>
              Each run is persisted with its scenario, timestamp, and critic score. Approved plans
              are cached in Redis keyed by{" "}
              <span className="font-mono text-ember-200">(org, scenario, date)</span> with a 1-hour
              TTL — so a repeat run costs <span className="text-emerald-300">zero LLM tokens</span>{" "}
              and stays auditable.
            </>
          }
        />
      </div>
    </SlideFrame>
  );
}

function Slide09() {
  return (
    <SlideFrame index={8} total={TOTAL}>
      <Kicker>Interactive · no rerun</Kicker>
      <h2 className="mt-5 text-[50px] font-bold leading-[1.02] tracking-[-0.02em] text-white text-balance">
        What-if, scored{" "}
        <span className="display-it font-normal text-ember-300">instantly.</span>
      </h2>

      <div className="mt-7">
        <Shot
          src={`${SHOT}/what_if.png`}
          alt="dashboard · what-if simulator"
          tall
          caption={
            <>
              Slide the predicted cover count and cost / benefit / tradeoff, prep burden, staffing,
              and stock-risk scores recompute live. It&apos;s{" "}
              <span className="text-white">deterministic scoring</span> — no LLM call, no pipeline
              re-run — so managers explore scenarios in real time.
            </>
          }
        />
      </div>
    </SlideFrame>
  );
}

function Slide10() {
  return (
    <SlideFrame index={9} total={TOTAL}>
      <Kicker>Streaming UX</Kicker>
      <h2 className="mt-5 text-[50px] font-bold leading-[1.02] tracking-[-0.02em] text-white text-balance">
        The pipeline lights up{" "}
        <span className="display-it font-normal text-ember-300">live.</span>
      </h2>

      <div className="mt-9 space-y-5">
        <Card>
          <Mono className="text-[14px] text-ember-300/80">Server-sent events</Mono>
          <div className="mt-2 text-[21px] leading-snug text-white/75">
            Each node emits a <span className="font-mono text-ember-200">node_complete</span> event
            over SSE — the dashboard&apos;s pipeline diagram fills in as agents finish, then the full
            plan arrives in one final <span className="font-mono text-ember-200">complete</span> event.
          </div>
        </Card>
        <Card>
          <Mono className="text-[14px] text-ember-300/80">Why it matters</Mono>
          <div className="mt-2 text-[21px] leading-snug text-white/75">
            A 90-second multi-agent run never feels like a frozen spinner. The operator watches
            forecasting → retrieval → critic resolve in order, which also makes failures{" "}
            <span className="text-white">legible</span> exactly where they happen.
          </div>
        </Card>
        <Card>
          <Mono className="text-[14px] text-ember-300/80">Transport</Mono>
          <div className="mt-2 text-[21px] leading-snug text-white/75">
            FastAPI <span className="font-mono text-ember-200">StreamingResponse</span> →{" "}
            <span className="font-mono text-ember-200">EventSource</span> on the client. Backpressure
            and reconnection handled at the edge.
          </div>
        </Card>
      </div>
    </SlideFrame>
  );
}

function Slide11() {
  return (
    <SlideFrame index={10} total={TOTAL}>
      <Kicker>Retrieval-augmented</Kicker>
      <h2 className="mt-5 text-[50px] font-bold leading-[1.02] tracking-[-0.02em] text-white text-balance">
        Grounded in{" "}
        <span className="display-it font-normal text-ember-300">your</span> data.
      </h2>

      <div className="mt-7">
        <Shot
          src={`${SHOT}/ask_ai.png`}
          alt="ask ai · grounded chatbot"
          caption={
            <>
              A separate RAG chatbot answers over your last 10 runs + 30 feedback records — note it
              cites <span className="text-white">real numbers</span> (77 avg demand, 0.85–0.92 plan
              quality), not generic model output. Complaint intelligence retrieves past guest issues
              from Qdrant, org-scoped per query.
            </>
          }
        />
      </div>
    </SlideFrame>
  );
}

function Slide12() {
  return (
    <SlideFrame index={11} total={TOTAL}>
      <Kicker>Source data · transparency</Kicker>
      <h2 className="mt-5 text-[50px] font-bold leading-[1.02] tracking-[-0.02em] text-white text-balance">
        Every number is{" "}
        <span className="display-it font-normal text-ember-300">traceable.</span>
      </h2>

      <div className="mt-7">
        <Shot
          src={`${SHOT}/data_health.png`}
          alt="data · health & coverage"
          caption={
            <>
              The Data Health view exposes exactly what the agents read:{" "}
              <span className="text-white">6,495 orders, 1,201 reservations, 160 feedback,
              18 inventory items</span>, plus live operational signals. No black box — the inputs
              behind every plan are inspectable.
            </>
          }
        />
      </div>
    </SlideFrame>
  );
}

function Slide13() {
  return (
    <SlideFrame index={12} total={TOTAL}>
      <Kicker>Exports · last mile</Kicker>
      <h2 className="mt-5 text-[50px] font-bold leading-[1.02] tracking-[-0.02em] text-white text-balance">
        From run to{" "}
        <span className="display-it font-normal text-ember-300">paper.</span>
      </h2>

      <div className="mt-7 grid grid-cols-2 gap-4">
        <Shot
          src={`${SHOT}/pdf_brief.png`}
          alt="export · pdf brief"
          tall
          caption={
            <span className="text-[16px]">
              ReportLab manager brief — verdict, dimension scores, action items, per-agent
              recommendations with priority.
            </span>
          }
        />
        <Shot
          src={`${SHOT}/excel.png`}
          alt="export · excel workbook"
          tall
          caption={
            <span className="text-[16px]">
              openpyxl workbook with role-based tabs — owner cost view incl. LLM token cost
              (<span className="font-mono text-ember-200">$0.004 / run</span>).
            </span>
          }
        />
      </div>
    </SlideFrame>
  );
}

function Slide14() {
  return (
    <SlideFrame index={13} total={TOTAL}>
      <Kicker>Observability & evals</Kicker>
      <h2 className="mt-5 text-[48px] font-bold leading-[1.02] tracking-[-0.02em] text-white text-balance">
        Quality is{" "}
        <span className="display-it font-normal text-ember-300">enforced</span>, not hoped for.
      </h2>

      <div className="mt-7">
        <Shot
          src={`${SHOT}/langsmith.png`}
          alt="langsmith · run traces"
          caption={
            <>
              Every run is traced in LangSmith with per-node latency (6–11s end-to-end). A{" "}
              <span className="text-white">golden dataset</span> gates CI at a 90% pass rate, with
              RAGAS faithfulness ≥ 0.8 and DeepEval hallucination ≤ 0.5 on the critic + RAG agents.
            </>
          }
        />
      </div>

      <div className="mt-5 flex flex-wrap gap-2.5">
        {["LangSmith traces", "Golden dataset CI", "RAGAS", "DeepEval", "OTel + Prometheus", "Sentry + structlog"].map(
          (t) => (
            <span
              key={t}
              className="rounded-lg bg-white/[0.04] px-3.5 py-2 font-mono text-[14px] uppercase tracking-wide text-white/55 ring-1 ring-white/10"
            >
              {t}
            </span>
          )
        )}
      </div>
    </SlideFrame>
  );
}

function Slide15() {
  return (
    <SlideFrame index={14} total={TOTAL}>
      <Kicker>Tenancy & provider abstraction</Kicker>
      <h2 className="mt-5 text-[50px] font-bold leading-[1.04] tracking-[-0.02em] text-white text-balance">
        Production-minded by{" "}
        <span className="display-it font-normal text-ember-300">default.</span>
      </h2>

      <div className="mt-8 grid grid-cols-1 gap-5">
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

function Slide16() {
  const stack = [
    "LangGraph", "FastAPI", "Next.js 16", "React 19", "PostgreSQL 16", "Qdrant",
    "Redis 7", "Prophet", "Groq", "Gemini", "LangSmith", "OpenTelemetry",
    "Prometheus", "Sentry", "RAGAS", "DeepEval", "ReportLab", "openpyxl",
  ];
  return (
    <SlideFrame index={15} total={TOTAL} accentGlow>
      <Kicker>The stack · let&apos;s talk</Kicker>
      <h2 className="mt-6 text-[58px] font-bold leading-[1.0] tracking-[-0.02em] text-white text-balance">
        From raw data to a verified brief in{" "}
        <span className="display-it font-normal text-ember-300">90 seconds.</span>
      </h2>

      <div className="mt-9 flex flex-wrap gap-2.5">
        {stack.map((s) => (
          <span
            key={s}
            className="rounded-lg bg-white/[0.04] px-4 py-2 font-mono text-[15px] uppercase tracking-wider text-white/60 ring-1 ring-white/10"
          >
            {s}
          </span>
        ))}
      </div>

      <div className="mt-12 rounded-2xl bg-ember-500/[0.07] p-7 ring-1 ring-ember-400/25">
        <div className="text-[26px] font-semibold leading-snug text-white">
          If you&apos;re building vertical AI systems — orchestration, RAG, evals, observability —
          I&apos;d love to compare notes.
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
  <Slide13 key="13" />,
  <Slide14 key="14" />,
  <Slide15 key="15" />,
  <Slide16 key="16" />,
];

export const SLIDE_W = 1080;
export const SLIDE_H = 1350;
