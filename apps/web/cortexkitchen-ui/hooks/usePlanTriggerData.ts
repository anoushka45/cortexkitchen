"use client";

import { useEffect, useState } from "react";
import { getMarketPulse, listRestaurantProfiles, MarketPulseResponse, RestaurantProfile } from "@/lib/api";

// Same profile + live-signals fetch TodayIdleState already owns for
// Dashboard's quick-trigger modal -- /planning's idle state needs its own
// copy of this data too, now that it renders the trigger panel inline
// rather than only reachable via that modal.
export function usePlanTriggerData() {
  const [profiles, setProfiles] = useState<RestaurantProfile[]>([]);
  const [selectedProfileId, setSelectedProfileId] = useState<number | null>(null);
  const [marketPulse, setMarketPulse] = useState<MarketPulseResponse | null>(null);
  const [marketLoaded, setMarketLoaded] = useState(false);

  useEffect(() => {
    listRestaurantProfiles()
      .then((list) => { setProfiles(list); if (list.length > 0) setSelectedProfileId(list[0].id); })
      .catch(() => { /* optional context */ });
  }, []);

  useEffect(() => {
    let cancelled = false;
    getMarketPulse()
      .then((pulse) => { if (!cancelled) setMarketPulse(pulse); })
      .catch(() => { if (!cancelled) setMarketPulse(null); })
      .finally(() => { if (!cancelled) setMarketLoaded(true); });
    return () => { cancelled = true; };
  }, []);

  const activeProfile = profiles.find((p) => p.id === selectedProfileId) ?? profiles[0] ?? null;

  return { profiles, selectedProfileId, setSelectedProfileId, activeProfile, marketPulse, marketLoaded };
}
