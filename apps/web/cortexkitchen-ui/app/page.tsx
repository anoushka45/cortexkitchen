import Image from "next/image";
import Link from "next/link";
import HomeNav from "@/components/layout/HomeNav";
import Footer from "@/components/layout/Footer";

// ── Page ──────────────────────────────────────────────────────────────────────

export default function HomePage() {
  return (
    <div className="min-h-screen bg-ink-950 text-slate-100">
      <HomeNav />

      {/* ── Hero ── */}
      <section className="relative overflow-hidden grid-bg">
        <div
          className="pointer-events-none absolute -top-40 left-1/2 h-[640px] w-[1100px] -translate-x-1/2 rounded-full"
          style={{ background: "radial-gradient(closest-side, rgba(230,137,42,0.22), transparent 70%)" }}
        />

        <div className="relative mx-auto grid max-w-[1280px] grid-cols-1 gap-10 px-8 pb-28 pt-24 xl:grid-cols-12">

          {/* Left: editorial headline */}
          <div className="xl:col-span-7">
            <div className="inline-flex items-center gap-2 rounded-full bg-ember-500/[0.08] px-3 py-1.5 ring-1 ring-ember-500/25">
              <span className="pulse flex h-1.5 w-1.5 rounded-full bg-ember-400 text-ember-400" />
              <span className="font-mono text-[10px] uppercase tracking-[0.28em] text-ember-200">Pre-shift intelligence platform</span>
            </div>

            <h1 className="mt-7 text-[42px] leading-[0.96] tracking-[-0.025em] text-white sm:text-[56px] md:text-[78px]">
              The pre-shift<br />
              <span className="display-it text-ember-300">briefing</span> that<br />
              runs<span className="display-it"> itself.</span>
            </h1>

            <p className="mt-7 max-w-xl text-[17px] leading-[1.6] text-white/65">
              Your kitchen knows more than it shows. Five specialists read your demand, bookings, complaints, menu, and stock — together, in parallel, before every shift. A critic checks the plan for safety and feasibility. Your floor manager gets a verified brief, with clear priorities, before the first table turns.
            </p>

            <div className="mt-9 flex flex-wrap items-center gap-4">
              <Link href="/register" className="btn-primary inline-flex items-center gap-2 rounded-xl px-6 py-3.5 text-[15px] font-semibold">
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
                Start free, no card
              </Link>
              <Link href="#pipeline" className="inline-flex items-center gap-2 rounded-xl px-6 py-3.5 text-[15px] font-medium text-white/85 ring-1 ring-white/15 transition-colors hover:ring-white/30">
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                  <circle cx="12" cy="12" r="10" />
                  <path d="M10 8l6 4-6 4V8z" fill="currentColor" />
                </svg>
                Watch 90-sec tour
              </Link>
            </div>

            {/* Mini-stats */}
            <div className="mt-12 grid max-w-xl grid-cols-3 gap-8 border-t border-white/10 pt-7">
              <div>
                <div className="num-display text-[36px] leading-none text-white">5<span className="text-2xl text-white/40">×</span></div>
                <div className="mt-1.5 text-xs text-white/55">specialists working in parallel on your data</div>
              </div>
              <div>
                <div className="num-display text-[36px] leading-none text-white">&lt;90<span className="text-2xl text-white/40">s</span></div>
                <div className="mt-1.5 text-xs text-white/55">from pressing run to a critic-approved plan</div>
              </div>
              <div>
                <div className="num-display text-[36px] leading-none text-white">5<span className="text-2xl text-white/40">×</span></div>
                <div className="mt-1.5 text-xs text-white/55">point quality check on every plan before you see it</div>
              </div>
            </div>
          </div>

          {/* Right: live brief card */}
          <div className="xl:col-span-5">
            <div className="relative">
              <div className="absolute -inset-6 dot-bg rounded-3xl opacity-60" />
              <div className="relative rounded-3xl bg-ink-900 p-5 shadow-[0_40px_80px_-20px_rgba(0,0,0,0.7)] ring-1 ring-white/10">
                {/* Window chrome */}
                <div className="flex items-center justify-between border-b border-white/[0.07] pb-3">
                  <div className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-full bg-rose-400/70" />
                    <span className="h-2.5 w-2.5 rounded-full bg-ember-300/70" />
                    <span className="h-2.5 w-2.5 rounded-full bg-emerald-400/70" />
                    <span className="ml-3 font-mono text-[10px] uppercase tracking-[0.2em] text-white/35">cortexkitchen.app/dashboard</span>
                  </div>
                  <span className="font-mono text-[10px] text-white/35">friday  -  4:42 pm</span>
                </div>

                {/* Verdict */}
                <div className="mt-4 flex items-start justify-between gap-3">
                  <div>
                    <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-emerald-300">Critic verdict</div>
                    <div className="mt-1.5 text-2xl font-semibold text-white">Plan approved</div>
                    <div className="mt-1 text-xs text-white/55">Friday rush  -  18:00-22:00  -  8 staff on floor</div>
                  </div>
                  <div className="text-right">
                    <div className="num-display text-5xl leading-none text-emerald-300">0.91</div>
                    <div className="mt-1 font-mono text-[9px] uppercase tracking-[0.2em] text-white/40">score / 1.0</div>
                  </div>
                </div>

                {/* Key metrics */}
                <div className="mt-5 grid grid-cols-3 gap-2">
                  {[
                    { label: "Forecasted orders", value: "52",  sub: "range 33-71",          subColor: "text-emerald-300/80" },
                    { label: "Capacity load",     value: <>33<span className="text-base text-white/40">%</span></>, sub: "reservation pressure", subColor: "text-ember-300/80" },
                    { label: "Inventory risk",    value: <span className="text-rose-300">10</span>, sub: "critical items",  subColor: "text-rose-300/80" },
                  ].map(({ label, value, sub, subColor }) => (
                    <div key={label} className="rounded-xl bg-white/[0.03] px-3 py-3 ring-1 ring-white/[0.06]">
                      <div className="font-mono text-[9px] uppercase tracking-[0.18em] text-white/40">{label}</div>
                      <div className="mt-1 num-display text-2xl text-white">{value}</div>
                      <div className={`text-[10px] ${subColor}`}>{sub}</div>
                    </div>
                  ))}
                </div>

                {/* Sparkline */}
                <div className="mt-4 rounded-xl bg-white/[0.02] px-3 py-3 ring-1 ring-white/[0.05]">
                  <div className="flex items-baseline justify-between">
                    <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-white/45">Demand forecast  -  12-23h</div>
                    <div className="text-[10px] text-white/40">peak <span className="font-mono text-white/80">19:00</span></div>
                  </div>
                  <svg viewBox="0 0 320 70" className="mt-2 h-[70px] w-full">
                    <defs>
                      <linearGradient id="sg" x1="0" x2="0" y1="0" y2="1">
                        <stop offset="0%" stopColor="#efa345" stopOpacity={0.5} />
                        <stop offset="100%" stopColor="#efa345" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <path d="M0 55 L30 50 L60 45 L90 40 L120 32 L150 24 L180 12 L210 18 L240 28 L270 38 L300 46 L320 50"
                      fill="none" stroke="#efa345" strokeWidth={1.8} className="sparkline" />
                    <path d="M0 55 L30 50 L60 45 L90 40 L120 32 L150 24 L180 12 L210 18 L240 28 L270 38 L300 46 L320 50 L320 70 L0 70 Z"
                      fill="url(#sg)" opacity={0.6} />
                  </svg>
                </div>

                {/* Agent strip */}
                <div className="mt-4 grid grid-cols-5 gap-1.5">
                  {[
                    { label: "demand ✓",  color: "text-emerald-300/90" },
                    { label: "reserv ✓",  color: "text-emerald-300/90" },
                    { label: "menu ✓",    color: "text-emerald-300/90" },
                    { label: "complaints !",  color: "text-ember-300" },
                    { label: "stock !",   color: "text-rose-300" },
                  ].map(({ label, color }) => (
                    <div key={label} className={`rounded-md bg-white/[0.04] px-2 py-1.5 text-center font-mono text-[9px] uppercase tracking-wider ${color}`}>
                      {label}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Tech stack marquee ── */}
      <section className="overflow-hidden border-y border-white/[0.06] bg-white/[0.01]">
        <div className="mx-auto flex max-w-[1280px] items-center gap-10 px-8 py-7">
          <div className="font-mono text-[10px] uppercase leading-relaxed tracking-[0.22em] text-white/40 max-w-[160px] shrink-0">
            Built on<br />production stack
          </div>
          <div className="relative flex-1 overflow-hidden">
            <div className="marquee-track flex shrink-0 items-center gap-14 whitespace-nowrap text-white/40">
              {["LangGraph", "FastAPI", "Next.js 16", "PostgreSQL", "Qdrant", "Groq · llama-3.3-70b", "LangSmith", "OpenTelemetry", "Sentry",
                "LangGraph", "FastAPI", "Next.js 16", "PostgreSQL", "Qdrant", "Groq · llama-3.3-70b", "LangSmith", "OpenTelemetry", "Sentry"].map((name, i) => (
                <span key={i} className={i % 2 === 0 ? "display text-3xl" : "display-it text-2xl"}>{name}</span>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── Problem section ── */}
      <section className="px-8 py-28">
        <div className="mx-auto grid max-w-[1280px] grid-cols-1 gap-12 xl:grid-cols-12 xl:items-start">
          <div className="xl:col-span-5">
            <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-ember-300/80">The shift before the shift</div>
            <h2 className="mt-3 text-[40px] leading-[1.02] tracking-[-0.02em] text-white md:text-[54px]">
              Most kitchens run<br />service <span className="display-it text-ember-300">half-blind.</span>
            </h2>
          </div>
          <div className="space-y-7 text-[17px] leading-[1.7] text-white/70 xl:col-span-7">
            <p>
              By 4pm Friday your floor manager has a reservation list, a hunch about the weather, and an inventory sheet from this morning. The forecast lives in someone&apos;s head. Last week&apos;s complaint about cold pizza? Not on the briefing. Two cooks down? You&apos;ll find out at 7:12pm.
            </p>
            <p>
              CortexKitchen reads the same data you already have: your POS, reservation system, complaint inbox, and inventory file. Five specialist agents turn it into <em className="display-it text-ember-200 not-italic">one</em> briefing your manager actually reads. With evidence. With a verdict.
            </p>
            <div className="grid grid-cols-2 gap-x-8 gap-y-5 pt-2">
              <div className="border-t border-white/10 pt-4">
                <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-white/40">Before</div>
                <div className="mt-1 text-white/85">4 dashboards, 1 spreadsheet, group chat</div>
              </div>
              <div className="border-t border-ember-400/30 pt-4">
                <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-ember-300">After</div>
                <div className="mt-1 text-white">1 brief, 1 verdict, &lt;90 seconds to read</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── How it works ── */}
      <section className="border-y border-white/[0.06] bg-white/[0.015] px-8 py-28">
        <div className="mx-auto max-w-[1280px]">
          <div className="flex items-end justify-between gap-10">
            <div>
              <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-ember-300/80">How it works</div>
              <h2 className="mt-3 text-[40px] leading-[1.02] tracking-[-0.02em] text-white md:text-[52px]">
                From data to <span className="display-it text-ember-300">brief</span> in 90 seconds.
              </h2>
            </div>
            <Link href="#" className="hidden font-mono text-[11px] uppercase tracking-[0.22em] text-white/50 transition-colors hover:text-white md:block">
              See architecture -&gt;
            </Link>
          </div>

          <div className="mt-14 grid grid-cols-1 gap-6 md:grid-cols-3">
            {[
              {
                num: "01", label: "Frame the service", title: "Pick the shift you're planning.",
                body: "Pick a shift type: Friday rush, weekday lunch, holiday spike, or low-stock weekend. Or set a custom date. Each one primes the specialists for the right kind of service pressure.",
                extra: (
                  <div className="mt-6 grid grid-cols-2 gap-2 font-mono text-[10px] uppercase tracking-wider">
                    {["Friday rush", "Weekday lunch", "Holiday spike", "Low-stock"].map(s => (
                      <div key={s} className="rounded-md px-2 py-1.5 text-white/55 ring-1 ring-white/10">{s}</div>
                    ))}
                  </div>
                ),
              },
              {
                num: "02", label: "Run the pipeline", title: "Five specialists. One verdict.",
                body: "Demand, reservations, complaints, menu, and inventory are each handled by a dedicated specialist running in parallel. An aggregator pulls it together, then a critic checks the plan for safety and feasibility before you see a word of it.",
                extra: (
                  <div className="mt-6 space-y-1.5">
                    {[
                      { dot: "bg-ember-300",   text: "forecast gate" },
                      { dot: "bg-emerald-400", text: "4 agents parallel" },
                      { dot: "bg-ember-400",   text: "aggregate → critic" },
                      { dot: "bg-cyan-400",    text: "SSE node-by-node stream" },
                    ].map(({ dot, text }) => (
                      <div key={text} className="flex items-center gap-2">
                        <span className={`h-1.5 w-1.5 rounded-full ${dot}`} />
                        <span className="font-mono text-[11px] uppercase tracking-wider text-white/55">{text}</span>
                      </div>
                    ))}
                  </div>
                ),
              },
              {
                num: "03", label: "Act on it", title: "Brief, export, simulate, ask.",
                body: "The plan is scored and ready. Hand the chef a PDF, send the owner an Excel sheet, or just read the summary yourself. Change a number with the what-if tool. Ask the AI what went wrong last week. Everything stays in the run history.",
                extra: (
                  <div className="mt-6 flex flex-wrap gap-2 font-mono text-[10px] uppercase tracking-wider">
                    {["PDF", "Excel", "What-if", "Ask AI", "Audit trail"].map((s) => (
                      <span key={s} className="rounded-md px-2 py-1 text-white/55 ring-1 ring-white/10">{s}</span>
                    ))}
                  </div>
                ),
              },
            ].map(({ num, label, title, body, extra }) => (
              <article key={num} className="relative overflow-hidden rounded-2xl bg-ink-900 p-7 ring-1 ring-white/[0.06]">
                <div className="absolute -right-4 -top-4 num-display text-[140px] leading-none text-white/[0.04]">{num}</div>
                <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-ember-300/80">{label}</div>
                <h3 className="mt-4 text-2xl font-semibold text-white">{title}</h3>
                <p className="mt-2.5 text-sm leading-[1.7] text-white/60">{body}</p>
                {extra}
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* ── Pipeline showcase ── */}
      <section id="pipeline" className="relative overflow-hidden px-8 py-32">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-ember-400/40 to-transparent" />
        <div className="mx-auto max-w-[1280px]">
          <div className="mb-16 grid grid-cols-1 items-end gap-8 xl:grid-cols-12">
            <div className="xl:col-span-7">
              <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-ember-300/80">The pipeline</div>
              <h2 className="mt-3 text-[40px] leading-[1.02] tracking-[-0.02em] text-white md:text-[58px]">
                Five specialists.<br /><span className="display-it text-ember-300">One</span> coherent verdict.
              </h2>
            </div>
            <p className="text-[15px] leading-[1.7] text-white/60 xl:col-span-5">
              We don&apos;t ship a single oracle pretending to know your business. Each agent owns one domain, with its own data adapter, its own model choice, and its own evaluation. The critic only ships a plan if all five agree it&apos;s safe.
            </p>
          </div>

          <div className="rounded-3xl bg-ink-900 p-10 ring-1 ring-white/[0.08]">
            <div className="grid grid-cols-12 items-stretch gap-3">

              {/* Orchestrator */}
              <div className="col-span-2 flex flex-col gap-2.5 justify-center">
                <div className="font-mono text-[9px] uppercase tracking-[0.22em] text-white/35">Orchestrator</div>
                <div className="rounded-2xl bg-white/[0.03] p-5 ring-1 ring-white/[0.09]">
                  <div className="text-[14px] font-semibold text-white">Ops Manager</div>
                  <div className="mt-2 text-[11px] leading-relaxed text-white/50">Kicks off the run, assigns each specialist their task, and keeps everything in sync.</div>
                  <span className="mt-4 inline-block rounded-md bg-ember-500/[0.10] px-2 py-0.5 font-mono text-[9px] uppercase tracking-wider text-ember-300/80 ring-1 ring-ember-400/20">LangGraph</span>
                </div>
              </div>

              {/* → */}
              <div className="col-span-1 flex items-center justify-center">
                <svg className="w-full" viewBox="0 0 48 14" fill="none" style={{ filter: "drop-shadow(0 0 4px rgba(239,163,69,0.55))" }}>
                  <line x1="1" y1="7" x2="36" y2="7" stroke="#efa345" strokeWidth="1.4" strokeDasharray="3 2.5" strokeOpacity="0.7"/>
                  <path d="M30 2.5 L37 7 L30 11.5" stroke="#efa345" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" strokeOpacity="0.9"/>
                </svg>
              </div>

              {/* Demand Gate */}
              <div className="col-span-2 flex flex-col gap-2.5 justify-center">
                <div className="font-mono text-[9px] uppercase tracking-[0.22em] text-ember-300/70">Gate</div>
                <div className="rounded-2xl bg-ember-500/[0.07] p-5 ring-1 ring-ember-400/25">
                  <div className="text-[14px] font-semibold text-white">Demand Forecast</div>
                  <div className="mt-2 text-[11px] leading-relaxed text-white/55">Predicts how busy the shift will be — expected covers, when it peaks, and how confident the model is.</div>
                  <span className="mt-4 inline-block rounded-md bg-white/[0.05] px-2 py-0.5 font-mono text-[9px] uppercase tracking-wider text-white/40 ring-1 ring-white/[0.08]">Prophet</span>
                </div>
              </div>

              {/* fan-out */}
              <div className="col-span-1 flex items-center justify-center">
                <svg className="h-full w-full" viewBox="0 0 44 200" fill="none" preserveAspectRatio="none" style={{ filter: "drop-shadow(0 0 5px rgba(239,163,69,0.5))" }}>
                  <line x1="0"  y1="100" x2="22"  y2="100" stroke="#efa345" strokeWidth="1.3" strokeDasharray="3 2.5" strokeOpacity="0.7"/>
                  <line x1="22" y1="24"  x2="22"  y2="176" stroke="#efa345" strokeWidth="1.3" strokeOpacity="0.4"/>
                  <line x1="22" y1="24"  x2="40"  y2="24"  stroke="#efa345" strokeWidth="1.3" strokeDasharray="3 2.5" strokeOpacity="0.7"/>
                  <line x1="22" y1="74"  x2="40"  y2="74"  stroke="#efa345" strokeWidth="1.3" strokeDasharray="3 2.5" strokeOpacity="0.7"/>
                  <line x1="22" y1="126" x2="40"  y2="126" stroke="#efa345" strokeWidth="1.3" strokeDasharray="3 2.5" strokeOpacity="0.7"/>
                  <line x1="22" y1="176" x2="40"  y2="176" stroke="#efa345" strokeWidth="1.3" strokeDasharray="3 2.5" strokeOpacity="0.7"/>
                  <path d="M35 20 L40 24 L35 28"    stroke="#efa345" strokeWidth="1.4" fill="none" strokeLinecap="round" strokeLinejoin="round" strokeOpacity="0.9"/>
                  <path d="M35 70 L40 74 L35 78"    stroke="#efa345" strokeWidth="1.4" fill="none" strokeLinecap="round" strokeLinejoin="round" strokeOpacity="0.9"/>
                  <path d="M35 122 L40 126 L35 130" stroke="#efa345" strokeWidth="1.4" fill="none" strokeLinecap="round" strokeLinejoin="round" strokeOpacity="0.9"/>
                  <path d="M35 172 L40 176 L35 180" stroke="#efa345" strokeWidth="1.4" fill="none" strokeLinecap="round" strokeLinejoin="round" strokeOpacity="0.9"/>
                </svg>
              </div>

              {/* Parallel agents */}
              <div className="col-span-3 grid grid-cols-1 gap-2.5">
                {[
                  { color: "ring-cyan-400/25 bg-cyan-500/[0.06]",       dot: "bg-cyan-400",    name: "Bookings & Tables",      sub: "Checks reservations, waitlist, and when the floor will be at capacity.", tag: "Reservations", tagColor: "text-cyan-300/60"    },
                  { color: "ring-rose-400/25 bg-rose-500/[0.06]",       dot: "bg-rose-400",    name: "Guest Feedback",         sub: "Reads recent reviews and complaints, surfaces what to fix tonight.",      tag: "Complaints",   tagColor: "text-rose-300/60"    },
                  { color: "ring-amber-400/25 bg-amber-500/[0.06]",     dot: "bg-amber-400",   name: "Menu & Promotions",      sub: "Recommends what to feature, what to 86, and what to upsell.",            tag: "Menu",         tagColor: "text-amber-300/60"   },
                  { color: "ring-emerald-400/25 bg-emerald-500/[0.06]", dot: "bg-emerald-400", name: "Stock & Inventory",      sub: "Flags what's running low, at risk of spoiling, or needs reordering.",    tag: "Inventory",    tagColor: "text-emerald-300/60" },
                ].map(({ color, dot, name, sub, tag, tagColor }) => (
                  <div key={name} className={`flex items-center gap-3.5 rounded-xl px-4 py-3.5 ring-1 ${color}`}>
                    <div className={`h-2 w-2 shrink-0 rounded-full ${dot}`} />
                    <div className="flex-1 min-w-0">
                      <div className="text-[13px] font-semibold text-white leading-tight">{name}</div>
                      <div className="mt-0.5 text-[10px] text-white/50 leading-relaxed">{sub}</div>
                    </div>
                    <div className={`shrink-0 font-mono text-[9px] ${tagColor}`}>{tag}</div>
                  </div>
                ))}
              </div>

              {/* merge */}
              <div className="col-span-1 flex items-center justify-center">
                <svg className="h-full w-full" viewBox="0 0 44 200" fill="none" preserveAspectRatio="none" style={{ filter: "drop-shadow(0 0 5px rgba(239,163,69,0.5))" }}>
                  <line x1="0"  y1="24"  x2="22" y2="24"  stroke="#efa345" strokeWidth="1.3" strokeDasharray="3 2.5" strokeOpacity="0.7"/>
                  <line x1="0"  y1="74"  x2="22" y2="74"  stroke="#efa345" strokeWidth="1.3" strokeDasharray="3 2.5" strokeOpacity="0.7"/>
                  <line x1="0"  y1="126" x2="22" y2="126" stroke="#efa345" strokeWidth="1.3" strokeDasharray="3 2.5" strokeOpacity="0.7"/>
                  <line x1="0"  y1="176" x2="22" y2="176" stroke="#efa345" strokeWidth="1.3" strokeDasharray="3 2.5" strokeOpacity="0.7"/>
                  <line x1="22" y1="24"  x2="22" y2="176" stroke="#efa345" strokeWidth="1.3" strokeOpacity="0.4"/>
                  <line x1="22" y1="100" x2="44" y2="100" stroke="#efa345" strokeWidth="1.3" strokeDasharray="3 2.5" strokeOpacity="0.7"/>
                  <path d="M38 96 L44 100 L38 104" stroke="#efa345" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" strokeOpacity="0.9"/>
                </svg>
              </div>

              {/* Critic */}
              <div className="col-span-2 flex flex-col gap-2.5 justify-center">
                <div className="font-mono text-[9px] uppercase tracking-[0.22em] text-emerald-300/70">Verify</div>
                <div className="rounded-2xl bg-emerald-500/[0.07] p-5 ring-1 ring-emerald-400/25">
                  <div className="text-[14px] font-semibold text-white">Quality Check</div>
                  <div className="mt-2 text-[11px] leading-relaxed text-white/55">Reviews the full plan before you see it. If anything looks unsafe or unrealistic, it blocks the plan and explains why.</div>
                  <span className="mt-4 inline-block rounded-md bg-emerald-500/[0.10] px-2 py-0.5 font-mono text-[9px] uppercase tracking-wider text-emerald-300/70 ring-1 ring-emerald-400/20">Auto-review</span>
                </div>
              </div>

            </div>

            {/* Quality check dimensions */}
            <div className="mt-8 flex items-center justify-between border-t border-white/[0.06] pt-6">
              <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-white/35">What the quality check looks for</div>
              <div className="flex flex-wrap items-center gap-2">
                {["Is it safe?", "Is it realistic?", "Is it backed by data?", "Can staff act on it?", "Is it clear?"].map((d) => (
                  <span key={d} className="rounded-full bg-emerald-500/[0.07] px-3.5 py-1 font-mono text-[11px] text-emerald-200 ring-1 ring-emerald-400/30">{d}</span>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Platform features ── */}
      <section id="features" className="border-t border-white/[0.06] px-8 py-24">
        <div className="mx-auto max-w-[1280px]">
          <div className="mb-12 text-center">
            <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-ember-300/80">Platform capabilities</div>
            <h2 className="mt-3 text-[38px] leading-[1.05] tracking-[-0.02em] text-white md:text-[50px]">
              More than a <span className="display-it text-ember-300">plan generator.</span>
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-[15px] leading-[1.7] text-white/55">
              Beyond the plan itself — tools to explore, question, repeat, and trust what the system produces.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[
              {
                icon: "◎",
                title: "No More Staring at a Spinner",
                desc: "You can see exactly where your plan is at every moment. Which specialist has finished, which is still running. No mystery loading screen. Each step checks in as it completes.",
                tag: "SSE · real-time pipeline",
                color: "border-cyan-400/20 bg-cyan-500/[0.04]",
                tagColor: "text-cyan-300/60",
              },
              {
                icon: "◈",
                title: "What-if Simulator",
                desc: "Expected 80 covers but now thinking 110? Slide the number and the cost pressure, demand score, and risk indicators update instantly. No need to run the full plan again.",
                tag: "instant · no extra cost",
                color: "border-violet-400/20 bg-violet-500/[0.04]",
                tagColor: "text-violet-300/60",
              },
              {
                icon: "◇",
                title: "Ask Your Operations AI",
                desc: "Type any question about your restaurant's history. Why was last Friday's plan flagged? What keeps showing up in complaints? Which scenario performs best? You get answers from your actual data, not generic AI.",
                tag: "AI chatbot · your data only",
                color: "border-ember-400/20 bg-ember-500/[0.04]",
                tagColor: "text-ember-300/60",
              },
              {
                icon: "◉",
                title: "Same Plan, Instant on Repeat",
                desc: "Running the same scenario twice in one day? The second run returns in under a second. Same approved plan, zero repeat cost. Every cached result is clearly labelled in your run history.",
                tag: "smart caching · 1hr window",
                color: "border-rose-400/20 bg-rose-500/[0.04]",
                tagColor: "text-rose-300/60",
              },
              {
                icon: "◆",
                title: "Track How Your Plans Perform",
                desc: "See your success rate, average quality score, and how long plans take. Broken down by shift type and outcome. You'll quickly spot which scenarios your kitchen handles well and which ones need work.",
                tag: "built-in analytics",
                color: "border-emerald-400/20 bg-emerald-500/[0.04]",
                tagColor: "text-emerald-300/60",
              },
              {
                icon: "◐",
                title: "Plans That Don't Drift",
                desc: "Every change to the system is checked against a set of known-good plans before it ships. If a tweak makes the plans worse, it gets caught automatically — not after your manager notices.",
                tag: "automated quality gate",
                color: "border-amber-400/20 bg-amber-500/[0.04]",
                tagColor: "text-amber-300/60",
              },
            ].map(({ icon, title, desc, tag, color, tagColor }) => (
              <div key={title} className={`rounded-2xl border p-6 transition-colors hover:bg-white/[0.03] ${color}`}>
                <div className="text-lg text-white/30 mb-3">{icon}</div>
                <div className="text-[15px] font-semibold text-white">{title}</div>
                <p className="mt-2 text-[13px] leading-[1.7] text-white/55">{desc}</p>
                <div className={`mt-4 font-mono text-[10px] uppercase tracking-[0.18em] ${tagColor}`}>{tag}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Pull quote ── */}
      <section className="bg-gradient-to-b from-transparent via-ember-500/[0.04] to-transparent px-8 py-28">
        <div className="mx-auto max-w-[1100px] text-center">
          <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-ember-300/80">What this replaces</div>
          <blockquote className="mt-6 text-[36px] leading-[1.15] tracking-[-0.015em] text-white md:text-[44px]">
            &ldquo;The pre-shift brief used to take forty minutes across four tabs.<br />
            <span className="display-it text-ember-200">CortexKitchen produces it</span> in under a minute — critic-verified.&rdquo;
          </blockquote>
          <div className="mt-8 inline-flex items-center gap-4">
            <div className="grid h-10 w-10 place-items-center rounded-full border border-dashed border-ember-400/30 bg-ember-500/[0.06] font-mono text-[10px] text-ember-400">CK</div>
            <div className="text-left">
              <div className="text-sm font-semibold text-white">The core problem we solve</div>
              <div className="text-xs text-white/50">Multi-agent intelligence · Critic-verified plans · 30s before service</div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Output / what you get ── */}
      <section className="border-t border-white/[0.06] px-8 py-28">
        <div className="mx-auto grid max-w-[1280px] grid-cols-1 gap-12 xl:grid-cols-12 xl:items-center">
          <div className="xl:col-span-5">
            <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-ember-300/80">The output</div>
            <h2 className="mt-3 text-[40px] leading-[1.02] tracking-[-0.02em] text-white md:text-[52px]">
              A brief the<br /><span className="display-it text-ember-300">floor</span> actually reads.
            </h2>
            <p className="mt-6 text-[16px] leading-[1.7] text-white/65">
              Three views from one run. Same data, role-aware framing. Built for the messy reality between line cooks, GMs and owners.
            </p>
            <div className="mt-8 space-y-5">
              {[
                { tag: "A", title: "Chef sheet  -  PDF",      desc: "Pace, prep priorities, complaints to address, items to push tonight." },
                { tag: "B", title: "Owner workbook  -  Excel", desc: "Cost forecast, LLM spend, scenario diff vs last week." },
                { tag: "C", title: "Run history  -  Audit",   desc: "Every plan, every score, every RAG citation. Permanent record." },
              ].map(({ tag, title, desc }) => (
                <div key={tag} className="flex items-start gap-4">
                  <div className="mt-1 grid h-6 w-6 place-items-center rounded-md bg-ember-500/10 font-mono text-xs text-ember-300 ring-1 ring-ember-400/40">{tag}</div>
                  <div>
                    <div className="text-[15px] font-semibold text-white">{title}</div>
                    <div className="text-[13px] text-white/55">{desc}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Light mode brief preview */}
          <div className="xl:col-span-7">
            <div className="relative">
              <div className="absolute -inset-3 rounded-3xl bg-gradient-to-br from-ember-400/15 to-transparent blur-xl" />
              <div className="relative rounded-2xl bg-[#f7efe2] p-8 shadow-[0_50px_100px_-20px_rgba(0,0,0,0.6)] ring-1 ring-ember-300/40">

                {/* Header */}
                <div className="flex items-center justify-between border-b border-[#0b1020]/10 pb-4">
                  <div className="flex items-center gap-2.5">
                    <span className="grid h-7 w-7 place-items-center overflow-hidden rounded-md bg-[#070a12]">
                      <Image src="/ck-logo.png" alt="CK" width={24} height={24} className="h-6 w-6 object-contain" />
                    </span>
                    <div className="leading-tight">
                      <div className="text-[13px] font-bold tracking-tight text-[#070a12]">Casa Mia · Chef Brief</div>
                      <div className="font-mono text-[9px] uppercase tracking-[0.18em] text-[#070a12]/50">Fri 1 May · Friday Rush · 18:00-22:00</div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-mono text-[9px] uppercase tracking-[0.2em] text-[#070a12]/45">Critic verdict</div>
                    <div className="text-[15px] font-bold text-emerald-700">Approved · 0.91</div>
                  </div>
                </div>

                {/* Metrics */}
                <div className="mt-5 grid grid-cols-3 gap-3">
                  {[
                    { label: "Covers",     value: "142", sub: "peak 19:00 · 38", vc: "text-[#070a12]"    },
                    { label: "Occupancy",  value: "87%", sub: "3 on waitlist",   vc: "text-[#070a12]"    },
                    { label: "Stock risk", value: "2",   sub: "critical items",  vc: "text-rose-700" },
                  ].map(({ label, value, sub, vc }) => (
                    <div key={label} className="rounded-lg bg-[#0b1020]/[0.05] p-3">
                      <div className="font-mono text-[9px] uppercase tracking-wider text-[#070a12]/45">{label}</div>
                      <div className={`num-display text-3xl ${vc}`}>{value}</div>
                      <div className="text-[10px] text-[#070a12]/50">{sub}</div>
                    </div>
                  ))}
                </div>

                {/* Priority actions */}
                <div className="mt-5">
                  <div className="font-mono text-[9px] uppercase tracking-[0.18em] text-[#070a12]/45 mb-2.5">Tonight, in priority</div>
                  <ol className="space-y-2.5 text-[13px] text-[#070a12]/80">
                    {[
                      { n: "1.", text: <><b className="font-semibold text-[#070a12]">Push the Margherita.</b> Tikka outsells but only 4 doughs left vs forecast 7. Last week&apos;s complaint: &ldquo;too long for the pizza.&rdquo;</> },
                      { n: "2.", text: <><b className="font-semibold text-[#070a12]">Pre-portion mushroom by 17:30.</b> Forecast +18% on rigatoni. Mushroom is on the critical shortage list.</> },
                      { n: "3.", text: <><b className="font-semibold text-[#070a12]">Stagger 19:00 seatings to 19:00 and 19:15.</b> 3 waitlist parties, occupancy at 87%.</> },
                    ].map(({ n, text }) => (
                      <li key={n} className="flex gap-3">
                        <span className="num-display w-5 shrink-0 text-right text-[#c47a2b]">{n}</span>
                        <span>{text}</span>
                      </li>
                    ))}
                  </ol>
                </div>

                {/* Footer */}
                <div className="mt-5 flex items-center justify-between border-t border-[#0b1020]/10 pt-3 font-mono text-[10px] uppercase tracking-[0.16em] text-[#070a12]/40">
                  <span>Generated 16:42 · 1.4s · $0.03</span>
                  <span>plan-019965ce</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Tech stack ── */}
      <section className="border-y border-white/[0.06] bg-white/[0.015] px-8 py-20">
        <div className="mx-auto max-w-[1280px]">
          <div className="mb-10 flex items-end justify-between">
            <div>
              <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-ember-300/80">Built on serious infrastructure</div>
              <h2 className="mt-2 text-3xl font-semibold tracking-tight text-white">Production-grade from day one.</h2>
            </div>
            <Link href="#" className="hidden font-mono text-[11px] uppercase tracking-[0.22em] text-white/50 transition-colors hover:text-white md:block">
              Read the architecture -&gt;
            </Link>
          </div>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            {[
              { name: "LangGraph",          desc: "9-node StateGraph — parallel fan-out, typed shared state, SSE streaming." },
              { name: "Prophet + Pandas",   desc: "Time-series demand forecasting with peak-hour and day-of-week detection." },
              { name: "Qdrant + RAG",       desc: "Vector store for complaint intelligence — org-scoped payload filters." },
              { name: "Groq / Gemini",      desc: "Swappable LLM provider abstraction — llama-3.3-70b in production." },
              { name: "Redis Caching",      desc: "1hr TTL plan cache by scenario + date. Zero LLM cost on cache hits." },
              { name: "OpenTelemetry",      desc: "HTTP tracing on every request. Prometheus /metrics scrape endpoint." },
              { name: "Sentry",             desc: "Unhandled exception capture with LangGraph node tags for fast debugging." },
              { name: "LangSmith",          desc: "Per-node traces + 50-run golden dataset with 90% CI pass-rate gate." },
              { name: "RAGAS + DeepEval",   desc: "Automated faithfulness, hallucination, and relevancy evals." },
              { name: "Multi-tenant auth",  desc: "JWT, Postgres org_id scoping, Qdrant payload isolation per org." },
              { name: "FastAPI + SSE",      desc: "Async streaming endpoint — node-by-node results via fetch ReadableStream." },
              { name: "MCP Server",         desc: "Anthropic MCP SDK — trigger planning runs directly from Claude Desktop." },
            ].map(({ name, desc }) => (
              <div key={name} className="rounded-xl bg-white/[0.02] p-5 ring-1 ring-white/[0.07] transition-colors hover:bg-white/[0.04]">
                <div className="text-[13px] font-bold text-ember-300">{name}</div>
                <div className="mt-1.5 text-[12px] leading-relaxed text-white/55">{desc}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Final CTA ── */}
      <section className="relative overflow-hidden px-8 py-32">
        <div
          className="pointer-events-none absolute inset-x-0 bottom-0 h-[420px]"
          style={{ background: "radial-gradient(closest-side, rgba(230,137,42,0.22), transparent 70%)" }}
        />
        <div className="relative mx-auto max-w-[920px] text-center">
          <div className="inline-flex items-center gap-2 rounded-full bg-ember-500/[0.08] px-3 py-1.5 ring-1 ring-ember-500/25">
            <span className="pulse flex h-1.5 w-1.5 rounded-full bg-ember-400 text-ember-400" />
            <span className="font-mono text-[10px] uppercase tracking-[0.28em] text-ember-200">14-day trial  -  no card</span>
          </div>
          <h2 className="mt-7 text-[48px] leading-[1.02] tracking-[-0.02em] text-white md:text-[64px]">
            Brief your next shift<br /><span className="display-it text-ember-300">before</span> it starts.
          </h2>
          <p className="mx-auto mt-6 max-w-xl text-[16px] leading-[1.7] text-white/65">
            Set up your workspace in under 5 minutes. Plug in your POS and reservation system; we&apos;ll seed sample data so you can ship a brief tonight.
          </p>
          <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
            <Link href="/register" className="btn-primary inline-flex items-center gap-2 rounded-xl px-7 py-4 text-[15px] font-semibold">
              Start free, no card
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 12h14M13 6l6 6-6 6" />
              </svg>
            </Link>
            <Link href="/login" className="inline-flex items-center gap-2 rounded-xl px-7 py-4 text-[15px] font-medium text-white/85 ring-1 ring-white/15 transition-colors hover:ring-white/30">
              Book a demo
            </Link>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
