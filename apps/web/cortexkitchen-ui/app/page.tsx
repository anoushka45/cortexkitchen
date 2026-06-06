import Image from "next/image";
import Link from "next/link";

// ── Nav ───────────────────────────────────────────────────────────────────────

function HomeNav() {
  return (
    <header className="glass sticky top-0 z-50 border-b border-white/[0.06]">
      <div className="mx-auto flex h-16 max-w-[1280px] items-center justify-between px-8">
        <Link href="/" className="flex items-center gap-3">
          <span className="grid h-8 w-8 place-items-center overflow-hidden rounded-lg bg-black ring-1 ring-white/10">
            <Image src="/ck-logo.png" alt="CK" width={28} height={28} className="h-7 w-7 object-contain" priority />
          </span>
          <div className="leading-tight">
            <div className="text-[15px] font-bold tracking-tight text-white">CortexKitchen</div>
            <div className="font-mono text-[9px] uppercase tracking-[0.24em] text-ember-300/70">ops intelligence</div>
          </div>
        </Link>

        <nav className="hidden items-center gap-7 text-sm text-white/65 md:flex">
          {["Platform", "Pipeline", "Case studies", "Pricing", "Docs"].map((l) => (
            <Link key={l} href="#" className="transition-colors hover:text-white">{l}</Link>
          ))}
        </nav>

        <div className="flex items-center gap-3">
          <Link href="/login" className="text-sm text-white/70 transition-colors hover:text-white">Sign in</Link>
          <Link href="/register" className="btn-primary inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold">
            Start free trial
            <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 12h14M13 6l6 6-6 6" />
            </svg>
          </Link>
        </div>
      </div>
    </header>
  );
}

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

            <h1 className="mt-7 text-[64px] leading-[0.96] tracking-[-0.025em] text-white md:text-[78px]">
              The pre-shift<br />
              <span className="display-it text-ember-300">briefing</span> that<br />
              runs<span className="display-it"> itself.</span>
            </h1>

            <p className="mt-7 max-w-xl text-[17px] leading-[1.6] text-white/65">
              Five specialist agents read your demand, reservations, complaints, menu and inventory -- together -- and hand your floor manager a critic-verified plan, 30 minutes before service.
            </p>

            <div className="mt-9 flex flex-wrap items-center gap-4">
              <Link href="/register" className="btn-primary inline-flex items-center gap-2 rounded-xl px-6 py-3.5 text-[15px] font-semibold">
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
                Start free -- no card
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
                <div className="num-display text-[36px] leading-none text-white">93<span className="text-ember-300">%</span></div>
                <div className="mt-1.5 text-xs text-white/55">forecast accuracy on covers, p50</div>
              </div>
              <div>
                <div className="num-display text-[36px] leading-none text-white">18<span className="text-2xl text-white/40">m</span></div>
                <div className="mt-1.5 text-xs text-white/55">avg saved per service vs spreadsheets</div>
              </div>
              <div>
                <div className="num-display text-[36px] leading-none text-white">5<span className="text-2xl text-white/40">×</span></div>
                <div className="mt-1.5 text-xs text-white/55">domain agents in parallel, one verdict</div>
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
                    { label: "covers",    value: "142", sub: "+18 vs avg",          subColor: "text-emerald-300/80" },
                    { label: "occupancy", value: <>87<span className="text-base text-white/40">%</span></>, sub: "3 on waitlist", subColor: "text-ember-300/80" },
                    { label: "risk",      value: <span className="text-rose-300">2</span>,  sub: "critical shortages", subColor: "text-rose-300/80" },
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
                    { label: "forecast done", color: "text-emerald-300/90" },
                    { label: "reserv done",   color: "text-emerald-300/90" },
                    { label: "menu done",     color: "text-emerald-300/90" },
                    { label: "comp !",    color: "text-ember-300" },
                    { label: "inv !",      color: "text-rose-300" },
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

      {/* ── Logo marquee ── */}
      <section className="overflow-hidden border-y border-white/[0.06] bg-white/[0.01]">
        <div className="mx-auto flex max-w-[1280px] items-center gap-10 px-8 py-7">
          <div className="font-mono text-[10px] uppercase leading-relaxed tracking-[0.22em] text-white/40 max-w-[160px] shrink-0">
            Trusted by ops<br />teams running
          </div>
          <div className="relative flex-1 overflow-hidden">
            <div className="marquee-track flex shrink-0 items-center gap-14 whitespace-nowrap text-white/40">
              {["Foursquare Hospitality", "Maison Auber", "North & Co.", "SAVOR /// group", "Petite Marche", "KETTLE&FORK",
                "Foursquare Hospitality", "Maison Auber", "North & Co.", "SAVOR /// group", "Petite Marche", "KETTLE&FORK"].map((name, i) => (
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
              CortexKitchen reads the same data sources you already have -- POS, reservation system, complaint inbox, inventory file -- and pulls them through five specialist agents into <em className="display-it text-ember-200 not-italic">one</em> briefing your manager actually reads. With evidence. With a verdict.
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
                body: "Four presets -- Friday rush, weekday lunch, holiday spike, low-stock weekend -- or set a custom date. Each frames the agents around the right operational pressure.",
                extra: (
                  <div className="mt-6 grid grid-cols-2 gap-2 font-mono text-[10px] uppercase tracking-wider">
                    {["Friday rush", "Weekday lunch", "Holiday spike", "Low-stock"].map(s => (
                      <div key={s} className="rounded-md px-2 py-1.5 text-white/55 ring-1 ring-white/10">{s}</div>
                    ))}
                  </div>
                ),
              },
              {
                num: "02", label: "Run the pipeline", title: "Five agents work in parallel.",
                body: "A demand forecast gates the run. Reservations, complaints, menu and inventory agents analyse in parallel, then an aggregator synthesises a coherent plan.",
                extra: (
                  <div className="mt-6 space-y-1.5">
                    {[
                      { dot: "bg-ember-300",   text: "forecast -> gate" },
                      { dot: "bg-emerald-400", text: "4 agents parallel" },
                      { dot: "bg-ember-400",  text: "aggregate -> critic" },
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
                num: "03", label: "Brief the floor", title: "Critic-scored plan, exportable.",
                body: "Every plan is scored on safety, feasibility, evidence, actionability and clarity before you see it. PDF for the chef. Excel for the owner. Side-by-side diff for the next run.",
                extra: (
                  <div className="mt-6 flex flex-wrap items-center gap-4 font-mono text-[11px] uppercase tracking-wider text-white/55">
                    {["PDF", "Excel", "Side-by-side"].map((s, i, arr) => (
                      <span key={s} className="flex items-center gap-4">
                        {s}{i < arr.length - 1 && <span className="text-white/20"> - </span>}
                      </span>
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
            <div className="grid grid-cols-12 items-stretch gap-4">
              {/* Ops manager */}
              <div className="col-span-2 flex flex-col">
                <div className="mb-3 font-mono text-[9px] uppercase tracking-[0.22em] text-white/40">Orchestrator</div>
                <div className="flex flex-1 flex-col justify-between rounded-2xl bg-white/[0.02] p-4 ring-1 ring-white/10">
                  <div>
                    <div className="text-sm font-semibold text-white">Ops Manager</div>
                    <div className="mt-1 text-[11px] leading-relaxed text-white/50">Sequences run, fans out work, holds shared state.</div>
                  </div>
                  <div className="mt-3 font-mono text-[9px] uppercase tracking-wider text-ember-300/80">LangGraph</div>
                </div>
              </div>

              {/* Arrow */}
              <div className="col-span-1 flex items-center justify-center">
                <svg className="h-5 w-full text-white/25" viewBox="0 0 60 20" fill="none" stroke="currentColor" strokeWidth={1}>
                  <path d="M0 10 H50 M44 4 L50 10 L44 16" />
                </svg>
              </div>

              {/* Forecast gate */}
              <div className="col-span-2 flex flex-col">
                <div className="mb-3 font-mono text-[9px] uppercase tracking-[0.22em] text-ember-300/80">Gate</div>
                <div className="flex flex-1 flex-col justify-between rounded-2xl bg-ember-500/[0.06] p-4 ring-1 ring-ember-400/30">
                  <div>
                    <div className="text-sm font-semibold text-white">Demand Forecast</div>
                    <div className="mt-1 text-[11px] leading-relaxed text-white/55">Prophet time-series -&gt; covers, peak hour, confidence.</div>
                  </div>
                  <div className="mt-3 font-mono text-[9px] uppercase tracking-wider text-white/40">Prophet</div>
                </div>
              </div>

              {/* Fan-out arrow */}
              <div className="col-span-1 flex items-center justify-center">
                <svg className="h-20 w-full text-white/25" viewBox="0 0 60 80" fill="none" stroke="currentColor" strokeWidth={1}>
                  <path d="M0 40 H30 M30 40 V12 H56 M30 40 V28 H56 M30 40 V52 H56 M30 40 V68 H56 M50 6 L56 12 L50 18 M50 22 L56 28 L50 34 M50 46 L56 52 L50 58 M50 62 L56 68 L50 74" />
                </svg>
              </div>

              {/* Parallel agents */}
              <div className="col-span-4 grid grid-cols-1 gap-2.5">
                {[
                  { color: "ring-cyan-400/20 bg-cyan-500/[0.05]",    dot: "bg-cyan-300",    name: "Reservation Pressure",   sub: "Occupancy %, waitlist, busiest-hour",  tag: "REST API"     },
                  { color: "ring-rose-400/20 bg-rose-500/[0.05]",    dot: "bg-rose-300",    name: "Complaint Intelligence", sub: "RAG over guest feedback, action items", tag: "Qdrant"       },
                  { color: "ring-amber-400/20 bg-amber-500/[0.05]",  dot: "bg-amber-300",   name: "Menu Intelligence",      sub: "What to push, avoid, promote",          tag: "Cross-signal" },
                  { color: "ring-emerald-400/20 bg-emerald-500/[0.05]", dot: "bg-emerald-300", name: "Inventory Status",   sub: "Shortages, spoilage, restock priority",  tag: "Live stock"   },
                ].map(({ color, dot, name, sub, tag }) => (
                  <div key={name} className={`flex items-center gap-3 rounded-xl px-3 py-2.5 ring-1 ${color}`}>
                    <div className={`h-2 w-2 rounded-full ${dot}`} />
                    <div className="flex-1">
                      <div className="text-[13px] font-semibold text-white">{name}</div>
                      <div className="text-[10px] text-white/50">{sub}</div>
                    </div>
                    <div className="font-mono text-[9px] text-white/35">{tag}</div>
                  </div>
                ))}
              </div>

              {/* Merge arrow */}
              <div className="col-span-1 flex items-center justify-center">
                <svg className="h-20 w-full text-white/25" viewBox="0 0 60 80" fill="none" stroke="currentColor" strokeWidth={1}>
                  <path d="M0 12 H30 V40 H56 M0 28 H30 M0 52 H30 M0 68 H30 V40 M50 34 L56 40 L50 46" />
                </svg>
              </div>

              {/* Critic */}
              <div className="col-span-1 flex flex-col">
                <div className="mb-3 font-mono text-[9px] uppercase tracking-[0.22em] text-emerald-300/80">Verify</div>
                <div className="flex flex-1 flex-col justify-between rounded-2xl bg-emerald-500/[0.06] p-3 ring-1 ring-emerald-400/30">
                  <div>
                    <div className="text-sm font-semibold text-white">Critic</div>
                    <div className="mt-1 text-[10px] leading-relaxed text-white/55">Scores 5 dims, gates output.</div>
                  </div>
                  <div className="mt-2 font-mono text-[8px] uppercase tracking-wider text-emerald-300/80">LLM eval</div>
                </div>
              </div>
            </div>

            {/* Dimension pills */}
            <div className="mt-7 flex items-center justify-between border-t border-white/[0.06] pt-5">
              <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-white/40">Critic scoring dimensions</div>
              <div className="flex flex-wrap items-center gap-2">
                {["Safety", "Feasibility", "Evidence", "Actionability", "Clarity"].map((d) => (
                  <span key={d} className="rounded-full bg-emerald-500/[0.06] px-3 py-1 font-mono text-[11px] text-emerald-200 ring-1 ring-emerald-400/30">{d}</span>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Pull quote ── */}
      <section className="bg-gradient-to-b from-transparent via-ember-500/[0.04] to-transparent px-8 py-28">
        <div className="mx-auto max-w-[1100px] text-center">
          <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-ember-300/80">Case  -  3-venue group, Brooklyn</div>
          <blockquote className="mt-6 text-[36px] leading-[1.15] tracking-[-0.015em] text-white md:text-[44px]">
            &ldquo;The brief used to take my GM forty minutes to assemble from four tabs.<br />
            <span className="display-it text-ember-200">Now it&apos;s on her phone</span> with the verdict already on it.&rdquo;
          </blockquote>
          <div className="mt-8 inline-flex items-center gap-4">
            <div className="grid h-10 w-10 place-items-center rounded-full border border-dashed border-ember-400/30 bg-ember-500/[0.06] font-mono text-[10px] text-ember-400">AV</div>
            <div className="text-left">
              <div className="text-sm font-semibold text-white">Adelina V.</div>
              <div className="text-xs text-white/50">Director of Operations, North &amp; Co.</div>
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

          {/* Paper brief preview */}
          <div className="xl:col-span-7">
            <div className="relative">
              <div className="absolute -inset-3 rounded-3xl bg-gradient-to-br from-ember-400/15 to-transparent blur-xl" />
              <div className="relative rounded-2xl bg-[#f7efe2] p-8 shadow-[0_50px_100px_-20px_rgba(0,0,0,0.6)] ring-1 ring-ember-300/40">
                <div className="flex items-center justify-between border-b border-[#0b1020]/15 pb-4">
                  <div className="flex items-center gap-2.5">
                    <span className="grid h-7 w-7 place-items-center overflow-hidden rounded-md bg-[#070a12]">
                      <Image src="/ck-logo.png" alt="CK" width={24} height={24} className="h-6 w-6 object-contain" />
                    </span>
                    <div className="leading-tight">
                      <div className="text-[13px] font-bold tracking-tight text-[#070a12]">CHEF BRIEF</div>
                      <div className="font-mono text-[9px] uppercase tracking-[0.18em] text-[#070a12]/60">Fri 1 may  -  18:00-22:00</div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-mono text-[9px] uppercase tracking-[0.2em] text-[#070a12]/55">Critic</div>
                    <div className="text-[15px] font-bold text-emerald-700">Approved  -  0.91</div>
                  </div>
                </div>

                <div className="mt-5 grid grid-cols-3 gap-3">
                  {[
                    { label: "Covers",    value: "142", sub: "peak 19:00 (38)",   vc: "" },
                    { label: "Occupancy", value: "87%", sub: "3 waitlist",         vc: "" },
                    { label: "Stock risk",value: "2",   sub: "critical",           vc: "text-rose-700" },
                  ].map(({ label, value, sub, vc }) => (
                    <div key={label} className="rounded-lg bg-[#0b1020]/[0.06] p-3">
                      <div className="font-mono text-[9px] uppercase tracking-wider text-[#070a12]/55">{label}</div>
                      <div className={`num-display text-3xl text-[#070a12] ${vc}`}>{value}</div>
                      <div className="text-[10px] text-[#070a12]/55">{sub}</div>
                    </div>
                  ))}
                </div>

                <div className="mt-5">
                  <div className="font-mono text-[9px] uppercase tracking-[0.18em] text-[#070a12]/55">Tonight, in priority</div>
                  <ol className="mt-2.5 space-y-2.5 text-[13px] text-[#070a12]/85">
                    {[
                      { n: "1.", text: <><b className="font-semibold">Push the Margherita.</b> Tikka pizza outsells but we have 4 doughs left vs forecast 7. Last week&apos;s complaint: &ldquo;too long for pizza.&rdquo;</> },
                      { n: "2.", text: <><b className="font-semibold">Pre-portion mushroom by 17:30.</b> Forecast +18% on rigatoni; mushroom on the critical list.</> },
                      { n: "3.", text: <><b className="font-semibold">Stagger 19:00 seatings to 19:00 / 19:15.</b> 3 waitlist parties, occupancy 87%.</> },
                    ].map(({ n, text }) => (
                      <li key={n} className="flex gap-3">
                        <span className="num-display w-5 shrink-0 text-right text-ember-600">{n}</span>
                        <span>{text}</span>
                      </li>
                    ))}
                  </ol>
                </div>

                <div className="mt-5 flex items-center justify-between border-t border-[#0b1020]/15 pt-3 font-mono text-[10px] uppercase tracking-[0.18em] text-[#070a12]/55">
                  <span>Generated 16:42  -  1.4s  -  $0.03</span>
                  <span>v158  -  plan-019965ce</span>
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
              { name: "LangGraph",        desc: "9-node StateGraph with parallel fan-out and typed shared state." },
              { name: "Prophet",          desc: "Time-series forecasting with peak-hour detection." },
              { name: "Qdrant + RAG",     desc: "Vector store for complaint intelligence with citations." },
              { name: "Groq / Gemini",    desc: "LLM provider abstraction with automatic fallback." },
              { name: "LangSmith",        desc: "Per-node tracing for every planning run." },
              { name: "RAGAS + DeepEval", desc: "Automated faithfulness, hallucination, relevancy." },
              { name: "Multi-tenant",     desc: "JWT auth, org isolation, role-based access." },
              { name: "MCP Server",       desc: "Anthropic MCP SDK -- fire runs from Claude Desktop." },
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
              Start free -- no card
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

      {/* ── Footer ── */}
      <footer className="border-t border-white/[0.06] bg-white/[0.01]">
        <div className="mx-auto grid max-w-[1280px] grid-cols-1 gap-10 px-8 py-14 md:grid-cols-12">
          <div className="md:col-span-4">
            <div className="flex items-center gap-3">
              <span className="grid h-8 w-8 place-items-center overflow-hidden rounded-lg bg-black ring-1 ring-white/10">
                <Image src="/ck-logo.png" alt="CK" width={28} height={28} className="h-7 w-7 object-contain" />
              </span>
              <div className="leading-tight">
                <div className="text-[15px] font-bold tracking-tight text-white">CortexKitchen</div>
                <div className="font-mono text-[9px] uppercase tracking-[0.24em] text-ember-300/70">ops intelligence</div>
              </div>
            </div>
            <p className="mt-5 max-w-[280px] text-[13px] leading-relaxed text-white/55">
              Multi-agent restaurant operations planning. Built for the shift before the shift.
            </p>
          </div>
          {[
            { heading: "Product",   links: ["Platform", "Pipeline", "Pricing", "Changelog"] },
            { heading: "Resources", links: ["Docs", "API reference", "MCP server", "Status"] },
            { heading: "Company",   links: ["About", "Customers", "Careers", "Contact"] },
            { heading: "Legal",     links: ["Privacy", "Terms", "Security", "DPA"] },
          ].map(({ heading, links }) => (
            <div key={heading} className="md:col-span-2">
              <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-white/45">{heading}</div>
              <ul className="mt-4 space-y-2.5">
                {links.map((l) => (
                  <li key={l}><Link href="#" className="text-[13px] text-white/65 transition-colors hover:text-white">{l}</Link></li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="border-t border-white/[0.06]">
          <div className="mx-auto flex max-w-[1280px] items-center justify-between px-8 py-5 font-mono text-[10px] uppercase tracking-[0.22em] text-white/40">
            <span>(c) 2026 CortexKitchen, Inc.</span>
            <span>Made for kitchens  -  Not for engineers</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
