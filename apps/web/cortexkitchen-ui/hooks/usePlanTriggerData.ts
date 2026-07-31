"use client";

import { useEffect, useState } from "react";
import { getMarketPulse, listRestaurantProfiles, MarketPulseResponse, RestaurantProfile } from "@/lib/api";
import { hourCacheKey, readHourCache, writeHourCache } from "@/lib/hourCache";

const CACHE_PREFIX = "ck:market-pulse:";

// Same profile + live-signals fetch TodayIdleState already owns for
// Dashboard's quick-trigger modal -- /planning's idle state needs its own
// copy of this data too, now that it renders the trigger panel inline
// rather than only reachable via that modal. Market pulse is hour-cached
// (weather/trends/FSSAI/occupancy don't change meaningfully faster than
// that) so switching between Dashboard and /planning doesn't re-fetch it
// on every single mount.
export function usePlanTriggerData() {
  const [profiles, setProfiles] = useState<RestaurantProfile[]>([]);
  const [selectedProfileId, setSelectedProfileId] = useState<number | null>(null);

  // Lazy initializers -- a cache hit hydrates state synchronously during the
  // first render, not via a setState call inside the effect below.
  const [marketPulse, setMarketPulse] = useState<MarketPulseResponse | null>(
    () => readHourCache(hourCacheKey(CACHE_PREFIX)),
  );
  const [marketLoaded, setMarketLoaded] = useState(() => readHourCache(hourCacheKey(CACHE_PREFIX)) !== null);
  const [marketRefreshing, setMarketRefreshing] = useState(false);

  useEffect(() => {
    listRestaurantProfiles()
      .then((list) => { setProfiles(list); if (list.length > 0) setSelectedProfileId(list[0].id); })
      .catch(() => { /* optional context */ });
  }, []);

  useEffect(() => {
    if (readHourCache(hourCacheKey(CACHE_PREFIX)) !== null) return;
    let cancelled = false;
    getMarketPulse()
      .then((pulse) => {
        if (cancelled) return;
        setMarketPulse(pulse);
        writeHourCache(CACHE_PREFIX, hourCacheKey(CACHE_PREFIX), pulse);
      })
      .catch(() => { if (!cancelled) setMarketPulse(null); })
      .finally(() => { if (!cancelled) setMarketLoaded(true); });
    return () => { cancelled = true; };
  }, []);

  const activeProfile = profiles.find((p) => p.id === selectedProfileId) ?? profiles[0] ?? null;

  // Manual refresh -- bypasses both this hour-bucketed localStorage cache and
  // the backend's own 1-hour Redis cache (trends/compliance), writing back
  // into the same shared "ck:market-pulse:" key Dashboard's TodayIdleState reads.
  async function refreshMarketPulse() {
    setMarketRefreshing(true);
    try {
      const pulse = await getMarketPulse(true);
      setMarketPulse(pulse);
      writeHourCache(CACHE_PREFIX, hourCacheKey(CACHE_PREFIX), pulse);
    } catch {
      /* keep whatever was already shown -- a failed refresh shouldn't blank the panel */
    } finally {
      setMarketRefreshing(false);
    }
  }

  return {
    profiles, selectedProfileId, setSelectedProfileId, activeProfile,
    marketPulse, marketLoaded, marketRefreshing, refreshMarketPulse,
  };
}
