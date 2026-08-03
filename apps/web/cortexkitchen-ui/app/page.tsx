import Image from "next/image";
import Link from "next/link";
import HomeNav from "@/components/layout/HomeNav";
import Footer from "@/components/layout/Footer";

// ── Page ──────────────────────────────────────────────────────────────────────

export default function HomePage() {
  return (
    <div className="min-h-screen bg-[var(--color-surface-page)] text-[var(--color-text-primary)]">
      <HomeNav />

      {/* ── Hero ── */}
      <section className="relative overflow-hidden grid-bg">
        <div
          className="pointer-events-none absolute -top-40 left-1/2 h-[640px] w-[1100px] -translate-x-1/2 rounded-full"
          style={{ background: "radial-gradient(closest-side, rgba(230,137,42,0.22), transparent 70%)" }}
        />

        <div className="relative mx-auto grid max-w-[1280px] grid-cols-1 gap-10 px-8 pb-24 pt-24 xl:grid-cols-12">

          {/* Left: editorial headline */}
          <div className="xl:col-span-7">
            <div className="inline-flex items-center gap-2 rounded-full bg-ember-500/[0.08] px-3 py-1.5 ring-1 ring-ember-500/25">
              <span className="pulse flex h-1.5 w-1.5 rounded-full bg-ember-400 text-[var(--color-accent)]" />
              <span className="text-[10px] uppercase tracking-[0.28em] text-ember-200">Pre-shift intelligence platform</span>
            </div>

            <h1 className="mt-7 text-[42px] leading-[0.96] tracking-[-0.025em] text-[var(--color-text-primary)] sm:text-[56px] md:text-[74px]">
              The pre-shift<br />
              <span className="display-it text-[var(--color-accent)]">briefing</span> that<br />
              runs<span className="display-it"> itself.</span>
            </h1>

            <p className="mt-7 max-w-xl text-[17px] leading-[1.6] text-[var(--color-text-soft)]">
              Your kitchen knows more than it shows. Specialist agents read your demand, bookings, complaints, menu, and stock, in parallel, while live weather, trend, and compliance signals and real Swiggy market data feed straight into the plan. A critic checks it for safety before your floor manager ever sees it.
            </p>

            <div className="mt-9 flex flex-wrap items-center gap-4">
              <Link href="/register" className="btn-primary inline-flex items-center gap-2 rounded-xl px-6 py-3.5 text-[15px] font-semibold">
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
                Start free, no card
              </Link>
              <Link href="/concierge" className="inline-flex items-center gap-2 rounded-xl px-6 py-3.5 text-[15px] font-medium text-[var(--color-text-primary)] ring-1 ring-[var(--color-border-default)] transition-colors hover:ring-[var(--color-accent)]/40">
                <span>🎉</span>
                Planning an event instead?
              </Link>
            </div>

            {/* Mini-stats */}
            <div className="mt-12 grid max-w-xl grid-cols-3 gap-8 border-t border-[var(--color-border-default)] pt-7">
              <div>
                <div className="num-display text-[36px] leading-none text-[var(--color-text-primary)]">5<span className="text-2xl text-[var(--color-text-faint)]">×</span></div>
                <div className="mt-1.5 text-xs text-[var(--color-text-soft)]">specialists working in parallel on your data</div>
              </div>
              <div>
                <div className="num-display text-[36px] leading-none text-[var(--color-text-primary)]">&lt;90<span className="text-2xl text-[var(--color-text-faint)]">s</span></div>
                <div className="mt-1.5 text-xs text-[var(--color-text-soft)]">from pressing run to a critic-approved plan</div>
              </div>
              <div>
                <div className="num-display text-[36px] leading-none text-[var(--color-text-primary)]">100<span className="text-2xl text-[var(--color-text-faint)]">%</span></div>
                <div className="mt-1.5 text-xs text-[var(--color-text-soft)]">of actions stay human-approved before they execute</div>
              </div>
            </div>
          </div>

          {/* Right: live brief card */}
          <div className="xl:col-span-5">
            <div className="relative">
              <div className="absolute -inset-6 dot-bg rounded-3xl opacity-60" />
              <div className="relative rounded-3xl bg-[var(--color-surface)] p-5 shadow-[0_40px_80px_-20px_rgba(0,0,0,0.7)] ring-1 ring-[var(--color-border-default)]">
                {/* Window chrome */}
                <div className="flex items-center justify-between border-b border-[var(--color-border-default)] pb-3">
                  <div className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-full bg-rose-400/70" />
                    <span className="h-2.5 w-2.5 rounded-full bg-ember-300/70" />
                    <span className="h-2.5 w-2.5 rounded-full bg-emerald-400/70" />
                    <span className="ml-3 text-[10px] uppercase tracking-[0.2em] text-[var(--color-text-faint)]">cortexkitchen.app/dashboard</span>
                  </div>
                  <span className="font-mono text-[10px] text-[var(--color-text-faint)]">friday, 4:42 pm</span>
                </div>

                {/* Verdict */}
                <div className="mt-4 flex items-start justify-between gap-3">
                  <div>
                    <div className="text-[10px] uppercase tracking-[0.22em] text-emerald-300">Critic verdict</div>
                    <div className="mt-1.5 text-2xl font-semibold text-[var(--color-text-primary)]">Plan approved</div>
                    <div className="mt-1 text-xs text-[var(--color-text-soft)]">Friday rush, 18:00-22:00, 8 staff on floor</div>
                  </div>
                  <div className="text-right">
                    <div className="num-display text-5xl leading-none text-emerald-300">0.91</div>
                    <div className="mt-1 text-[9px] uppercase tracking-[0.2em] text-[var(--color-text-faint)]">score / 1.0</div>
                  </div>
                </div>

                {/* Key metrics */}
                <div className="mt-5 grid grid-cols-3 gap-2">
                  {[
                    { label: "Forecasted orders", value: "52",  sub: "range 33-71",          subColor: "text-emerald-300/80" },
                    { label: "Capacity load",     value: <>33<span className="text-base text-[var(--color-text-faint)]">%</span></>, sub: "reservation pressure", subColor: "text-[var(--color-accent)]/80" },
                    { label: "Inventory risk",    value: <span className="text-rose-300">10</span>, sub: "critical items",  subColor: "text-rose-300/80" },
                  ].map(({ label, value, sub, subColor }) => (
                    <div key={label} className="rounded-xl bg-[var(--color-surface-raised)] px-3 py-3 ring-1 ring-[var(--color-border-soft)]">
                      <div className="text-[9px] uppercase tracking-[0.18em] text-[var(--color-text-faint)]">{label}</div>
                      <div className="mt-1 num-display text-2xl text-[var(--color-text-primary)]">{value}</div>
                      <div className={`text-[10px] ${subColor}`}>{sub}</div>
                    </div>
                  ))}
                </div>

                {/* Sparkline */}
                <div className="mt-4 rounded-xl bg-[var(--color-surface-raised)] px-3 py-3 ring-1 ring-[var(--color-border-soft)]">
                  <div className="flex items-baseline justify-between">
                    <div className="text-[10px] uppercase tracking-[0.2em] text-[var(--color-text-faint)]">Demand forecast, 12-23h</div>
                    <div className="text-[10px] text-[var(--color-text-faint)]">peak <span className="font-mono text-[var(--color-text-primary)]">19:00</span></div>
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
                <div className="mt-4 grid grid-cols-3 gap-1.5 sm:grid-cols-6">
                  {[
                    { label: "demand ✓",   color: "text-emerald-300/90" },
                    { label: "reserv ✓",   color: "text-emerald-300/90" },
                    { label: "market ✓",   color: "text-emerald-300/90" },
                    { label: "menu ✓",     color: "text-emerald-300/90" },
                    { label: "complaints !", color: "text-[var(--color-accent)]" },
                    { label: "stock !",    color: "text-rose-300" },
                  ].map(({ label, color }) => (
                    <div key={label} className={`rounded-md bg-[var(--color-surface-raised)] px-2 py-1.5 text-center text-[9px] uppercase tracking-wider ${color}`}>
                      {label}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Two ways in ── */}
      <section className="border-y border-[var(--color-border-soft)] bg-[var(--color-surface-raised)] px-8 py-14">
        <div className="mx-auto max-w-[1280px]">
          <div className="mb-8 text-center">
            <div className="text-[10px] uppercase tracking-[0.22em] text-[var(--color-accent)]/80">Two sides, one platform</div>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight text-[var(--color-text-primary)]">Which side are you on?</h2>
          </div>
          <div className="mx-auto grid max-w-4xl grid-cols-1 gap-5 md:grid-cols-2">
            <div className="flex items-center gap-4 rounded-2xl bg-[var(--color-surface)] p-5 ring-1 ring-[var(--color-border-default)]">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-ember-500/10 text-xl ring-1 ring-ember-400/25">🍽️</span>
              <div className="min-w-0 flex-1">
                <div className="text-[14px] font-semibold text-[var(--color-text-primary)]">Run a restaurant</div>
                <div className="text-[12.5px] text-[var(--color-text-faint)]">Plan every shift, approve every action</div>
              </div>
              <Link href="/login" className="btn-primary shrink-0 rounded-lg px-4 py-2 text-[13px] font-semibold">Sign in</Link>
            </div>
            <div className="flex items-center gap-4 rounded-2xl bg-[var(--color-surface)] p-5 ring-1 ring-[var(--color-border-default)]">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-ember-500/10 text-xl ring-1 ring-ember-400/25">🎉</span>
              <div className="min-w-0 flex-1">
                <div className="text-[14px] font-semibold text-[var(--color-text-primary)]">Planning something</div>
                <div className="text-[12.5px] text-[var(--color-text-faint)]">Chat with the concierge, no account needed</div>
              </div>
              <Link href="/concierge" className="btn-primary shrink-0 rounded-lg px-4 py-2 text-[13px] font-semibold">Sign in as Guest</Link>
            </div>
          </div>
        </div>
      </section>

      {/* ── Problem section ── */}
      <section className="px-8 py-28">
        <div className="mx-auto grid max-w-[1280px] grid-cols-1 gap-12 xl:grid-cols-12 xl:items-start">
          <div className="xl:col-span-5">
            <div className="text-[10px] uppercase tracking-[0.22em] text-[var(--color-accent)]/80">The shift before the shift</div>
            <h2 className="mt-3 text-[40px] leading-[1.02] tracking-[-0.02em] text-[var(--color-text-primary)] md:text-[54px]">
              Most kitchens run<br />service <span className="display-it text-[var(--color-accent)]">half-blind.</span>
            </h2>
          </div>
          <div className="space-y-7 text-[17px] leading-[1.7] text-[var(--color-text-soft)] xl:col-span-7">
            <p>
              By 4pm Friday your floor manager has a reservation list, a hunch about the weather, and an inventory sheet from this morning. The forecast lives in someone&apos;s head. Last week&apos;s complaint about cold pizza? Not on the briefing. Two cooks down? You&apos;ll find out at 7:12pm.
            </p>
            <p>
              CortexKitchen reads the same data you already have: your POS, reservation system, complaint inbox, and inventory file, plus live weather, industry trends, FSSAI compliance alerts, and real-time Swiggy market data. Specialist agents turn it into <em className="display-it text-ember-200 not-italic">one</em> briefing your manager actually reads. With evidence. With a verdict.
            </p>
            <div className="grid grid-cols-2 gap-x-8 gap-y-5 pt-2">
              <div className="border-t border-[var(--color-border-default)] pt-4">
                <div className="text-[10px] uppercase tracking-[0.18em] text-[var(--color-text-faint)]">Before</div>
                <div className="mt-1 text-[var(--color-text-primary)]">4 dashboards, 1 spreadsheet, group chat</div>
              </div>
              <div className="border-t border-ember-400/30 pt-4">
                <div className="text-[10px] uppercase tracking-[0.18em] text-[var(--color-accent)]">After</div>
                <div className="mt-1 text-[var(--color-text-primary)]">1 brief, 1 verdict, &lt;90 seconds to read</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── How it works ── */}
      <section className="border-y border-[var(--color-border-soft)] bg-[var(--color-surface-raised)] px-8 py-28">
        <div className="mx-auto max-w-[1280px]">
          <div>
            <div className="text-[10px] uppercase tracking-[0.22em] text-[var(--color-accent)]/80">How it works</div>
            <h2 className="mt-3 text-[40px] leading-[1.02] tracking-[-0.02em] text-[var(--color-text-primary)] md:text-[52px]">
              From data to <span className="display-it text-[var(--color-accent)]">brief</span> in 90 seconds.
            </h2>
          </div>

          <div className="mt-14 grid grid-cols-1 gap-6 md:grid-cols-3">
            {[
              {
                num: "01", label: "Frame the service", title: "Pick the shift you're planning.",
                body: "Pick a shift type: Friday rush, weekday lunch, holiday spike, or low-stock weekend. Or describe today in your own words and let the AI build the scenario, by voice or by text.",
                extra: (
                  <div className="mt-6 grid grid-cols-2 gap-2 text-[10px] uppercase tracking-wider">
                    {["Friday rush", "Weekday lunch", "Holiday spike", "Low-stock"].map(s => (
                      <div key={s} className="rounded-md px-2 py-1.5 text-[var(--color-text-soft)] ring-1 ring-[var(--color-border-default)]">{s}</div>
                    ))}
                  </div>
                ),
              },
              {
                num: "02", label: "Run the pipeline", title: "Specialists in parallel. One verdict.",
                body: "Live weather, trend, and compliance signals feed the demand forecast. Reservations, complaints, inventory, menu, market intel, and dine-in occupancy run as parallel specialists. A critic checks the combined plan for safety and feasibility, and can send it back for a rework before you see it.",
                extra: (
                  <div className="mt-6 space-y-1.5">
                    {[
                      { dot: "bg-ember-300",   text: "live signals gate" },
                      { dot: "bg-emerald-400", text: "5 agents in parallel" },
                      { dot: "bg-ember-400",   text: "critic + replan loop" },
                      { dot: "bg-cyan-400",    text: "live progress stream" },
                    ].map(({ dot, text }) => (
                      <div key={text} className="flex items-center gap-2">
                        <span className={`h-1.5 w-1.5 rounded-full ${dot}`} />
                        <span className="text-[11px] uppercase tracking-wider text-[var(--color-text-soft)]">{text}</span>
                      </div>
                    ))}
                  </div>
                ),
              },
              {
                num: "03", label: "Act on it", title: "Brief, export, simulate, ask.",
                body: "Hand the chef a PDF, send the owner an Excel sheet, or read the summary yourself. Change a number with the what-if tool. Ask the AI what went wrong last week, by voice or text. Every action still needs your sign-off before it executes.",
                extra: (
                  <div className="mt-6 flex flex-wrap gap-2 text-[10px] uppercase tracking-wider">
                    {["PDF", "Excel", "What-if", "Ask AI", "Voice input", "Audit trail"].map((s) => (
                      <span key={s} className="rounded-md px-2 py-1 text-[var(--color-text-soft)] ring-1 ring-[var(--color-border-default)]">{s}</span>
                    ))}
                  </div>
                ),
              },
            ].map(({ num, label, title, body, extra }) => (
              <article key={num} className="relative overflow-hidden rounded-2xl bg-[var(--color-surface)] p-7 ring-1 ring-[var(--color-border-soft)]">
                <div className="absolute -right-4 -top-4 num-display text-[140px] leading-none text-[var(--color-text-ghost)]">{num}</div>
                <div className="text-[10px] uppercase tracking-[0.22em] text-[var(--color-accent)]/80">{label}</div>
                <h3 className="mt-4 text-2xl font-semibold text-[var(--color-text-primary)]">{title}</h3>
                <p className="mt-2.5 text-sm leading-[1.7] text-[var(--color-text-soft)]">{body}</p>
                {extra}
              </article>
            ))}
          </div>

          {/* Quality check dimensions */}
          <div className="mt-8 flex flex-wrap items-center justify-between gap-4 rounded-2xl bg-[var(--color-surface)] px-6 py-5 ring-1 ring-[var(--color-border-soft)]">
            <div className="text-[10px] uppercase tracking-[0.22em] text-[var(--color-text-faint)]">What the critic checks before you see it</div>
            <div className="flex flex-wrap items-center gap-2">
              {["Is it safe?", "Is it realistic?", "Is it backed by data?", "Can staff act on it?", "Is it clear?"].map((d) => (
                <span key={d} className="rounded-full bg-emerald-500/[0.07] px-3.5 py-1 font-mono text-[11px] text-emerald-700 dark:text-emerald-200 ring-1 ring-emerald-400/30">{d}</span>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── Platform features ── */}
      <section id="features" className="px-8 py-24">
        <div className="mx-auto max-w-[1280px]">
          <div className="mb-12 text-center">
            <div className="text-[10px] uppercase tracking-[0.22em] text-[var(--color-accent)]/80">Platform capabilities</div>
            <h2 className="mt-3 text-[38px] leading-[1.05] tracking-[-0.02em] text-[var(--color-text-primary)] md:text-[50px]">
              More than a <span className="display-it text-[var(--color-accent)]">plan generator.</span>
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-[15px] leading-[1.7] text-[var(--color-text-soft)]">
              Beyond the plan itself: tools to explore, question, repeat, and trust what the system produces.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[
              {
                icon: "◎",
                title: "No More Staring at a Spinner",
                desc: "You can see exactly where your plan is at every moment. Which specialist has finished, which is still running. No mystery loading screen. Each step checks in as it completes.",
                tag: "live · node-by-node progress",
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
                desc: "Type or speak any question about your restaurant's history. Why was last Friday's plan flagged? What keeps showing up in complaints? You get answers from your actual data, not generic AI.",
                tag: "AI chatbot · voice + text",
                color: "border-ember-400/20 bg-ember-500/[0.04]",
                tagColor: "text-[var(--color-accent)]/60",
              },
              {
                icon: "◉",
                title: "Live Market Intelligence",
                desc: "Real, anonymised area-level pricing, occupancy, and Instamart ingredient prices via Swiggy. No named-competitor data, just what's actually moving in your area right now.",
                tag: "Swiggy MCP · area-level only",
                color: "border-amber-400/20 bg-amber-500/[0.04]",
                tagColor: "text-amber-300/60",
              },
              {
                icon: "◆",
                title: "Track How Your Plans Perform",
                desc: "See your success rate, average quality score, and how long plans take. Broken down by shift type and outcome, plus a menu engineering matrix of what to push and what to cut.",
                tag: "built-in analytics",
                color: "border-emerald-400/20 bg-emerald-500/[0.04]",
                tagColor: "text-emerald-300/60",
              },
              {
                icon: "◐",
                title: "Every Action, Human-Approved",
                desc: "Vendor messages, procurement, and pricing recommendations land in an Action Queue. Nothing sends or executes until someone on your team approves it.",
                tag: "action queue · zero auto-execute",
                color: "border-rose-400/20 bg-rose-500/[0.04]",
                tagColor: "text-rose-300/60",
              },
            ].map(({ icon, title, desc, tag, color, tagColor }) => (
              <div key={title} className={`rounded-2xl border p-6 transition-colors hover:bg-[var(--color-surface-raised)] ${color}`}>
                <div className="text-lg text-[var(--color-text-faint)] mb-3">{icon}</div>
                <div className="text-[15px] font-semibold text-[var(--color-text-primary)]">{title}</div>
                <p className="mt-2 text-[13px] leading-[1.7] text-[var(--color-text-soft)]">{desc}</p>
                <div className={`mt-4 text-[10px] uppercase tracking-[0.18em] ${tagColor}`}>{tag}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Pull quote ── */}
      <section className="bg-gradient-to-b from-transparent via-ember-500/[0.04] to-transparent px-8 py-28">
        <div className="mx-auto max-w-[1100px] text-center">
          <div className="text-[10px] uppercase tracking-[0.22em] text-[var(--color-accent)]/80">What this replaces</div>
          <blockquote className="mt-6 text-[36px] leading-[1.15] tracking-[-0.015em] text-[var(--color-text-primary)] md:text-[44px]">
            &ldquo;The pre-shift brief used to take forty minutes across four tabs.<br />
            <span className="display-it text-ember-200">CortexKitchen produces it</span> in under a minute, critic-verified.&rdquo;
          </blockquote>
          <div className="mt-8 inline-flex items-center gap-4">
            <div className="grid h-10 w-10 place-items-center rounded-full border border-dashed border-ember-400/30 bg-ember-500/[0.06] font-mono text-[10px] text-[var(--color-accent)]">CK</div>
            <div className="text-left">
              <div className="text-sm font-semibold text-[var(--color-text-primary)]">The core problem we solve</div>
              <div className="text-xs text-[var(--color-text-faint)]">Multi-agent intelligence · Critic-verified plans · under a minute before service</div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Output / what you get ── */}
      <section className="border-t border-[var(--color-border-soft)] px-8 py-28">
        <div className="mx-auto grid max-w-[1280px] grid-cols-1 gap-12 xl:grid-cols-12 xl:items-center">
          <div className="xl:col-span-5">
            <div className="text-[10px] uppercase tracking-[0.22em] text-[var(--color-accent)]/80">The output</div>
            <h2 className="mt-3 text-[40px] leading-[1.02] tracking-[-0.02em] text-[var(--color-text-primary)] md:text-[52px]">
              A brief the<br /><span className="display-it text-[var(--color-accent)]">floor</span> actually reads.
            </h2>
            <p className="mt-6 text-[16px] leading-[1.7] text-[var(--color-text-soft)]">
              Three views from one run. Same data, role-aware framing. Built for the messy reality between line cooks, GMs and owners.
            </p>
            <div className="mt-8 space-y-5">
              {[
                { tag: "A", title: "Chef sheet, PDF",      desc: "Pace, prep priorities, complaints to address, items to push tonight." },
                { tag: "B", title: "Owner workbook, Excel", desc: "Cost forecast, LLM spend, scenario diff vs last week." },
                { tag: "C", title: "Run history, audit trail",   desc: "Every plan, every score, every citation. Permanent record." },
              ].map(({ tag, title, desc }) => (
                <div key={tag} className="flex items-start gap-4">
                  <div className="mt-1 grid h-6 w-6 place-items-center rounded-md bg-ember-500/10 font-mono text-xs text-[var(--color-accent)] ring-1 ring-ember-400/40">{tag}</div>
                  <div>
                    <div className="text-[15px] font-semibold text-[var(--color-text-primary)]">{title}</div>
                    <div className="text-[13px] text-[var(--color-text-soft)]">{desc}</div>
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
                      <div className="text-[13px] font-bold tracking-tight text-[#070a12]">Casa Mia, Chef Brief</div>
                      <div className="text-[9px] uppercase tracking-[0.18em] text-[#070a12]/50">Fri 1 May, Friday Rush, 18:00-22:00</div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-[9px] uppercase tracking-[0.2em] text-[#070a12]/45">Critic verdict</div>
                    <div className="text-[15px] font-bold text-emerald-700">Approved, 0.91</div>
                  </div>
                </div>

                {/* Metrics */}
                <div className="mt-5 grid grid-cols-3 gap-3">
                  {[
                    { label: "Covers",     value: "142", sub: "peak 19:00, 38",  vc: "text-[#070a12]"    },
                    { label: "Occupancy",  value: "87%", sub: "3 on waitlist",   vc: "text-[#070a12]"    },
                    { label: "Stock risk", value: "2",   sub: "critical items",  vc: "text-rose-700" },
                  ].map(({ label, value, sub, vc }) => (
                    <div key={label} className="rounded-lg bg-[#0b1020]/[0.05] p-3">
                      <div className="text-[9px] uppercase tracking-wider text-[#070a12]/45">{label}</div>
                      <div className={`num-display text-3xl ${vc}`}>{value}</div>
                      <div className="text-[10px] text-[#070a12]/50">{sub}</div>
                    </div>
                  ))}
                </div>

                {/* Priority actions */}
                <div className="mt-5">
                  <div className="text-[9px] uppercase tracking-[0.18em] text-[#070a12]/45 mb-2.5">Tonight, in priority</div>
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
                <div className="mt-5 flex items-center justify-between border-t border-[#0b1020]/10 pt-3 text-[10px] uppercase tracking-[0.16em] text-[#070a12]/40">
                  <span>Generated 16:42, 1.4s, $0.03</span>
                  <span>plan-019965ce</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Guest Concierge (Side 2 -- fully independent consumer product) ── */}
      <section id="concierge" className="relative overflow-hidden border-t border-[var(--color-border-soft)] bg-[var(--color-surface-raised)] px-8 py-28">
        <div
          className="pointer-events-none absolute -bottom-40 left-1/2 h-[560px] w-[1000px] -translate-x-1/2 rounded-full"
          style={{ background: "radial-gradient(closest-side, rgba(230,137,42,0.14), transparent 70%)" }}
        />
        <div className="relative mx-auto max-w-[920px] text-center">
          <div className="inline-flex items-center gap-2 rounded-full bg-ember-500/[0.08] px-3 py-1.5 ring-1 ring-ember-500/25">
            <span className="pulse flex h-1.5 w-1.5 rounded-full bg-ember-400 text-[var(--color-accent)]" />
            <span className="text-[10px] uppercase tracking-[0.28em] text-ember-200">For Guests</span>
          </div>

          <h2 className="mt-7 text-[40px] leading-[1.02] tracking-[-0.02em] text-[var(--color-text-primary)] md:text-[54px]">
            Plan your perfect<br /><span className="display-it text-[var(--color-accent)]">dining experience.</span>
          </h2>

          <p className="mx-auto mt-6 max-w-xl text-[16px] leading-[1.7] text-[var(--color-text-soft)]">
            Describe what you want. CortexKitchen handles the rest: finding the right venue,
            checking real availability, suggesting supplies, ordering food. All powered by Swiggy.
          </p>

          {/* Example prompts */}
          <div className="mx-auto mt-9 flex max-w-2xl flex-col gap-2.5 text-left">
            {[
              "Plan my best friend's 25th birthday, 14 people, pizza and gaming, budget Rs.10k",
              "Find a romantic restaurant for Saturday evening",
              "Order pizza and get a cake delivered before my guests arrive",
            ].map((prompt) => (
              <div key={prompt} className="rounded-xl bg-[var(--color-surface)] px-4 py-3 text-[13.5px] text-[var(--color-text-soft)] ring-1 ring-[var(--color-border-soft)]">
                &ldquo;{prompt}&rdquo;
              </div>
            ))}
          </div>

          <div className="mt-9">
            <Link href="/concierge" className="btn-primary inline-flex items-center gap-2 rounded-xl px-7 py-4 text-[15px] font-semibold">
              Try the Concierge
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 12h14M13 6l6 6-6 6" />
              </svg>
            </Link>
          </div>

          <div className="mt-8 flex items-center justify-center gap-2">
            <span className="flex h-5 w-5 items-center justify-center rounded bg-white p-0.5 ring-1 ring-[var(--color-border-default)]">
              <Image src="/swiggy-logo.png" alt="Swiggy" width={16} height={16} className="h-full w-full object-contain" />
            </span>
            <span className="text-[10px] uppercase tracking-[0.2em] text-[var(--color-text-faint)]">
              Powered by Swiggy MCP: Food, Instamart &amp; Dineout
            </span>
          </div>
        </div>
      </section>

      {/* ── Final CTA: dual ── */}
      <section className="relative overflow-hidden px-8 py-32">
        <div
          className="pointer-events-none absolute inset-x-0 bottom-0 h-[420px]"
          style={{ background: "radial-gradient(closest-side, rgba(230,137,42,0.22), transparent 70%)" }}
        />
        <div className="relative mx-auto max-w-[920px] text-center">
          <div className="inline-flex items-center gap-2 rounded-full bg-ember-500/[0.08] px-3 py-1.5 ring-1 ring-ember-500/25">
            <span className="pulse flex h-1.5 w-1.5 rounded-full bg-ember-400 text-[var(--color-accent)]" />
            <span className="text-[10px] uppercase tracking-[0.28em] text-ember-200">14-day trial, no card</span>
          </div>
          <h2 className="mt-7 text-[48px] leading-[1.02] tracking-[-0.02em] text-[var(--color-text-primary)] md:text-[64px]">
            Brief your next shift<br /><span className="display-it text-[var(--color-accent)]">before</span> it starts.
          </h2>
          <p className="mx-auto mt-6 max-w-xl text-[16px] leading-[1.7] text-[var(--color-text-soft)]">
            Set up your workspace in under 5 minutes. Plug in your POS and reservation system; we&apos;ll seed sample data so you can ship a brief tonight.
          </p>
          <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
            <Link href="/register" className="btn-primary inline-flex items-center gap-2 rounded-xl px-7 py-4 text-[15px] font-semibold">
              Start free, no card
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 12h14M13 6l6 6-6 6" />
              </svg>
            </Link>
            <Link href="/concierge" className="inline-flex items-center gap-2 rounded-xl px-7 py-4 text-[15px] font-medium text-[var(--color-text-primary)] ring-1 ring-[var(--color-border-default)] transition-colors hover:ring-[var(--color-accent)]/40">
              Or sign in as a Guest
            </Link>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
