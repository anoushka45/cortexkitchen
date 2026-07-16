"use client";

import { useEffect, useState } from "react";
import { composeLiveScenario, LiveScenarioComposition } from "@/lib/api";
import { hourCacheKey, readHourCache, writeHourCache } from "@/lib/hourCache";

function todayISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

const CACHE_PREFIX = "ck:live-scenario-composition:";

// Backs the "Run for today" fast path -- fetches a scenario profile composed
// fresh from live signals (real time-of-day, weather, holiday, occupancy,
// inventory shortage count, recent runs), instead of "Run for today" silently
// reusing whatever scenario was last manually selected.
// Uses LiveScenarioComposer (not the older, preset-forcing ScenarioRecommender)
// specifically so the label/reasoning shown can never mismatch reality --
// e.g. recommending "Weekday Lunch" during a rainy dinner service because
// that was the closest of only 4 fixed buckets.
// Hour-cached -- live signals genuinely change through the day, but not
// minute to minute, so an hour-old composition is still an honest
// recommendation. Without this, every single page refresh fired a real LLM
// call (LiveScenarioComposer) just to populate a hero caption nobody had
// asked to run yet.
// enabled=false skips the fetch entirely -- used by PlanTriggerPanel's
// scenario-only/describe-only modes, where the quick-run banner (the only
// consumer of this) isn't even rendered.
export function useScenarioRecommendation(enabled: boolean = true) {
  // Lazy initializers -- a cache hit hydrates state synchronously during the
  // first render, not via a setState call inside the effect below (which
  // would trigger an avoidable extra render).
  const [composition, setComposition] = useState<LiveScenarioComposition | null>(
    () => (enabled ? readHourCache(hourCacheKey(CACHE_PREFIX)) : null),
  );
  const [loaded, setLoaded] = useState(() => enabled && readHourCache(hourCacheKey(CACHE_PREFIX)) !== null);

  useEffect(() => {
    if (!enabled || readHourCache(hourCacheKey(CACHE_PREFIX)) !== null) return;
    let cancelled = false;

    composeLiveScenario(todayISO())
      .then((comp) => {
        if (cancelled) return;
        setComposition(comp);
        writeHourCache(CACHE_PREFIX, hourCacheKey(CACHE_PREFIX), comp);
      })
      .catch(() => { if (!cancelled) setComposition(null); })
      .finally(() => { if (!cancelled) setLoaded(true); });

    return () => { cancelled = true; };
  }, [enabled]);

  return { composition, loaded };
}
