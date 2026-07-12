"use client";

import { MarketPulseResponse } from "@/lib/api";

const CONDITION_LABEL: Record<string, string> = {
  heavy_rain: "Heavy rain expected",
  light_rain: "Light rain possible",
  very_hot:   "Hot evening",
  clear:      "Clear conditions",
};

const CONDITION_TONE: Record<string, string> = {
  heavy_rain: "border-rose-500/25 bg-rose-500/[0.06] text-rose-300",
  light_rain: "border-amber-500/25 bg-amber-500/[0.06] text-amber-300",
  very_hot:   "border-amber-500/25 bg-amber-500/[0.06] text-amber-300",
  clear:      "border-emerald-500/25 bg-emerald-500/[0.06] text-emerald-300",
};

// "hero" variant renders on the orange gradient banner (TodayIdleState) --
// the default subtle-tinted badges are illegible there, so this uses
// translucent white instead. Same badge for every signal on that background
// (color-coding doesn't read well over a colored gradient either).
const HERO_TONE = "border-white/25 bg-white/10 text-white";

function Badge({ tone, children }: { tone: string; children: React.ReactNode }) {
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] ${tone}`}>
      {children}
    </span>
  );
}

interface Props {
  marketPulse: MarketPulseResponse | null;
  loaded: boolean;
  variant?: "default" | "hero";
}

// P6-A26 — condensed badges for the 4 live signals unified in P6-A24
// (weather/holiday, industry trends, regulatory alerts, plus the existing
// anonymised Swiggy area occupancy signal). Used both on the "Plan your next
// shift" hero banner (variant="hero") and inside PlanShiftModal (default),
// so it's visible whether the owner triggers straight from Today or opens
// the modal to pick a scenario / describe one in natural language (P6-A25)
// -- not tucked away on /market where nobody checks daily. Degrades
// gracefully per-signal: any subset present renders, none present renders
// nothing (never a placeholder for missing data).
export default function TodayContextStrip({ marketPulse, loaded, variant = "default" }: Props) {
  const isHero = variant === "hero";
  const labelColor = isHero ? "text-white/70" : "text-[var(--color-text-faint)]";

  if (!loaded) {
    return (
      <div className={`flex items-center gap-2 text-[11px] ${isHero ? "text-white/70" : "text-[var(--color-text-faint)]"}`}>
        <span className={`h-1.5 w-1.5 animate-pulse rounded-full ${isHero ? "bg-white/50" : "bg-[var(--color-text-ghost)]"}`} />
        Checking today&apos;s context…
      </div>
    );
  }

  const weather    = marketPulse?.weather;
  const holiday    = marketPulse?.upcoming_holiday;
  const trends     = marketPulse?.industry_trends;
  const compliance = marketPulse?.compliance_alerts;
  const occupancy  = marketPulse?.area_occupancy;

  const hasAnything = weather || holiday || (trends && trends.headline_count > 0) ||
    (compliance && compliance.notice_count > 0) || occupancy?.signal;

  if (!hasAnything) return null;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <p className={`mr-1 text-[10px] font-bold uppercase tracking-[0.14em] ${labelColor}`}>
        Today&apos;s context
      </p>

      {weather && (
        <Badge tone={isHero ? HERO_TONE : (CONDITION_TONE[weather.condition] ?? "border-[var(--color-border-default)] bg-[var(--color-surface-raised)] text-[var(--color-text-soft)]")}>
          {CONDITION_LABEL[weather.condition] ?? weather.condition}
        </Badge>
      )}

      {holiday && (
        <Badge tone={isHero ? HERO_TONE : "border-ember-500/25 bg-ember-500/[0.06] text-[var(--color-accent)]"}>
          {holiday.name} {holiday.days_away === 0 ? "today" : holiday.days_away === 1 ? "tomorrow" : `in ${holiday.days_away}d`}
        </Badge>
      )}

      {occupancy?.signal && (
        <Badge tone={isHero ? HERO_TONE : "border-[#fc8019]/25 bg-[#fc8019]/[0.06] text-[#fc8019]"}>
          Area demand {occupancy.signal.toLowerCase()}
        </Badge>
      )}

      {trends && trends.headline_count > 0 && (
        <Badge tone={isHero ? HERO_TONE : "border-[var(--color-border-default)] bg-[var(--color-surface-raised)] text-[var(--color-text-soft)]"}>
          Industry trends noted
        </Badge>
      )}

      {compliance && compliance.notice_count > 0 && (
        <Badge tone={isHero ? HERO_TONE : "border-rose-500/25 bg-rose-500/[0.06] text-rose-300"}>
          {compliance.notice_count} FSSAI notice{compliance.notice_count !== 1 ? "s" : ""}
        </Badge>
      )}
    </div>
  );
}
