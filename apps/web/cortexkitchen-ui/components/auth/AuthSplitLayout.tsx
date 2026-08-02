import Image from "next/image";
import Link from "next/link";

const STATS = [
  { value: "5×", label: "specialists working in parallel on your data" },
  { value: "<90s", label: "from pressing run to a critic-approved plan" },
  { value: "24/7", label: "guest concierge, powered by Swiggy" },
];

export default function AuthSplitLayout({
  eyebrow,
  title,
  subtitle,
  children,
}: {
  eyebrow: string;
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <div className="grid min-h-screen grid-cols-1 lg:grid-cols-2">
      {/* Left: branded editorial panel, restaurant-OS side only */}
      <div className="relative hidden overflow-hidden bg-[#070a12] lg:flex lg:flex-col lg:justify-between lg:p-14">
        <div className="dot-bg pointer-events-none absolute inset-0 opacity-40" />
        <div
          className="pointer-events-none absolute -top-32 -left-20 h-[520px] w-[520px] rounded-full"
          style={{ background: "radial-gradient(closest-side, rgba(230,137,42,0.22), transparent 72%)" }}
        />

        <Link href="/" className="relative flex items-center gap-3">
          <span className="grid h-10 w-10 place-items-center overflow-hidden rounded-xl bg-black ring-1 ring-white/10">
            <Image src="/ck-logo.png" alt="CortexKitchen" width={32} height={32} className="h-8 w-8 object-contain" priority />
          </span>
          <div className="leading-tight">
            <div className="text-[15px] font-bold tracking-tight text-white">CortexKitchen</div>
            <div className="text-[9px] uppercase tracking-[0.24em] text-ember-300/70">Restaurant OS</div>
          </div>
        </Link>

        <div className="relative max-w-md">
          <h2 className="text-[34px] leading-[1.08] tracking-[-0.02em] text-white">
            The pre-shift<br /><span className="display-it text-ember-300">briefing</span> that runs itself.
          </h2>
          <p className="mt-4 text-[14px] leading-[1.7] text-white/55">
            Five specialists read your demand, bookings, complaints, menu, and stock, together, before every shift.
          </p>

          <div className="mt-10 grid grid-cols-3 gap-6 border-t border-white/10 pt-6">
            {STATS.map(({ value, label }) => (
              <div key={label}>
                <div className="num-display text-2xl leading-none text-white">{value}</div>
                <div className="mt-1.5 text-[11px] leading-snug text-white/45">{label}</div>
              </div>
            ))}
          </div>
        </div>

        <p className="relative text-[11px] text-white/35">
          Planning something as a guest instead?{" "}
          <Link href="/concierge" className="text-ember-300 transition-colors hover:text-ember-200">
            Try the Concierge, no account needed →
          </Link>
        </p>
      </div>

      {/* Right: form */}
      <div className="flex items-center justify-center bg-[var(--color-surface-page)] px-6 py-12">
        <div className="w-full max-w-sm">
          <div className="mb-8 text-center lg:hidden">
            <div className="mx-auto mb-4 grid h-12 w-12 place-items-center overflow-hidden rounded-xl bg-black ring-1 ring-[var(--color-border-default)]">
              <Image src="/ck-logo.png" alt="CortexKitchen" width={40} height={40} className="h-10 w-10 object-contain" priority />
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-[var(--color-text-primary)]">CortexKitchen</h1>
          </div>

          <div className="mb-7">
            <p className="text-[10px] uppercase tracking-[0.22em] text-[var(--color-accent)]/80">{eyebrow}</p>
            <h1 className="mt-2 text-[26px] font-semibold tracking-[-0.01em] text-[var(--color-text-primary)]">{title}</h1>
            <p className="mt-1.5 text-[13.5px] text-[var(--color-text-faint)]">{subtitle}</p>
          </div>

          {children}

          <p className="mt-6 text-center">
            <Link href="/" className="inline-flex items-center gap-1.5 text-xs text-[var(--color-text-ghost)] transition-colors hover:text-[var(--color-text-faint)]">
              <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              Back to home
            </Link>
          </p>

          <p className="mt-3 text-center text-[11px] text-[var(--color-text-ghost)] lg:hidden">
            Planning something as a guest?{" "}
            <Link href="/concierge" className="text-[var(--color-accent)] hover:text-ember-200">
              Try the Concierge →
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
