"use client";

import { useEffect, useState } from "react";
import { composeLiveScenario, LiveScenarioComposition } from "@/lib/api";

function todayISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

const CACHE_PREFIX = "ck:live-scenario-composition:";

// Bucketed to the current hour -- live signals (weather, occupancy, shortage
// count) genuinely change through the day, but not minute to minute, so an
// hour-old composition is still an honest recommendation. Without this,
// every single page refresh fired a real LLM call (LiveScenarioComposer)
// just to populate a hero caption nobody had asked to run yet.
function hourCacheKey(): string {
  const d = new Date();
  return `${CACHE_PREFIX}${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}-${String(d.getHours()).padStart(2, "0")}`;
}

function readCache(key: string): LiveScenarioComposition | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as LiveScenarioComposition) : null;
  } catch {
    return null; // storage unavailable/corrupt -- just refetch
  }
}

function writeCache(key: string, value: LiveScenarioComposition): void {
  try {
    // Drop stale hour-buckets from earlier so this never grows unbounded.
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const k = localStorage.key(i);
      if (k && k.startsWith(CACHE_PREFIX) && k !== key) localStorage.removeItem(k);
    }
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage full/unavailable -- non-fatal, just means no caching this time */
  }
}

// Backs the "Run for today" fast path -- fetches a scenario profile composed
// fresh from live signals (real time-of-day, weather, holiday, occupancy,
// inventory shortage count, recent runs), instead of "Run for today" silently
// reusing whatever scenario was last manually selected.
// Uses LiveScenarioComposer (not the older, preset-forcing ScenarioRecommender)
// specifically so the label/reasoning shown can never mismatch reality --
// e.g. recommending "Weekday Lunch" during a rainy dinner service because
// that was the closest of only 4 fixed buckets.
// enabled=false skips the fetch entirely -- used by PlanTriggerPanel's
// scenario-only/describe-only modes, where the quick-run banner (the only
// consumer of this) isn't even rendered.
export function useScenarioRecommendation(enabled: boolean = true) {
  // Lazy initializers -- a cache hit hydrates state synchronously during the
  // first render, not via a setState call inside the effect below (which
  // would trigger an avoidable extra render).
  const [composition, setComposition] = useState<LiveScenarioComposition | null>(
    () => (enabled ? readCache(hourCacheKey()) : null),
  );
  const [loaded, setLoaded] = useState(() => enabled && readCache(hourCacheKey()) !== null);

  useEffect(() => {
    if (!enabled || readCache(hourCacheKey()) !== null) return;
    let cancelled = false;

    composeLiveScenario(todayISO())
      .then((comp) => {
        if (cancelled) return;
        setComposition(comp);
        writeCache(hourCacheKey(), comp);
      })
      .catch(() => { if (!cancelled) setComposition(null); })
      .finally(() => { if (!cancelled) setLoaded(true); });

    return () => { cancelled = true; };
  }, [enabled]);

  return { composition, loaded };
}
