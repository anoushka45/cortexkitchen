// hooks/useFridayRush.ts
// Manages the full lifecycle of a Friday Rush planning run:
// idle → loading → success | error

import { useState, useCallback } from "react";
import { runFridayRush } from "@/lib/api";
import { FridayRushResponse } from "@/types/planning";

type Status = "idle" | "loading" | "success" | "error";

interface UseFridayRushReturn {
  data:    FridayRushResponse | null;
  status:  Status;
  error:   string | null;
  trigger: (targetDate?: string) => Promise<void>;
  reset:   () => void;
}

export function useFridayRush(): UseFridayRushReturn {
  const [data,   setData]   = useState<FridayRushResponse | null>(null);
  const [status, setStatus] = useState<Status>("idle");
  const [error,  setError]  = useState<string | null>(null);

  const trigger = useCallback(async (targetDate?: string) => {
    setStatus("loading");
    setError(null);

    try {
      const result = await runFridayRush({ target_date: targetDate ?? null });
      setData(result);
      setStatus("success");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
      setStatus("error");
    }
  }, []);

  const reset = useCallback(() => {
    setData(null);
    setStatus("idle");
    setError(null);
  }, []);

  return { data, status, error, trigger, reset };
}