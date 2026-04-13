// hooks/useFridayRush.ts
"use client";

import { useState, useCallback } from "react";
import { runFridayRush } from "@/lib/api";
import { FridayRushResponse, RunHistoryEntry } from "@/types/planning";

type Status = "idle" | "loading" | "success" | "error";

interface UseFridayRushReturn {
  data:       FridayRushResponse | null;
  status:     Status;
  error:      string | null;
  history:    RunHistoryEntry[];
  trigger:    (targetDate?: string) => Promise<void>;
  reset:      () => void;
  loadFromHistory: (entry: RunHistoryEntry) => void;
}

export function useFridayRush(): UseFridayRushReturn {
  const [data,    setData]    = useState<FridayRushResponse | null>(null);
  const [status,  setStatus]  = useState<Status>("idle");
  const [error,   setError]   = useState<string | null>(null);
  const [history, setHistory] = useState<RunHistoryEntry[]>([]);

  const trigger = useCallback(async (targetDate?: string) => {
    setStatus("loading");
    setError(null);

    try {
      const result = await runFridayRush({ target_date: targetDate ?? null });
      setData(result);
      setStatus("success");

      // Add to history (keep last 5)
      const entry: RunHistoryEntry = {
        id:         crypto.randomUUID(),
        targetDate: targetDate ?? result.target_date ?? "Next Friday",
        runAt:      new Date().toISOString(),
        status:     result.status,
        verdict:    result.critic.verdict,
        score:      result.critic.score,
        data:       result,
      };

      setHistory((prev) => [entry, ...prev].slice(0, 5));
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

  const loadFromHistory = useCallback((entry: RunHistoryEntry) => {
    setData(entry.data);
    setStatus("success");
    setError(null);
  }, []);

  return { data, status, error, history, trigger, reset, loadFromHistory };
}