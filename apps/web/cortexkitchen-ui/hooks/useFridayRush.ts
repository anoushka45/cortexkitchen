// hooks/useFridayRush.ts
"use client";

import { useState, useCallback, useEffect } from "react";
import { getPlanningRun, listPlanningRuns, runPlanningScenario } from "@/lib/api";
import { FridayRushResponse, PlanningRunSummary, RunHistoryEntry } from "@/types/planning";

type Status = "idle" | "loading" | "success" | "error";

interface UseFridayRushReturn {
  data:       FridayRushResponse | null;
  status:     Status;
  error:      string | null;
  history:    RunHistoryEntry[];
  trigger:    (targetDate?: string, scenario?: FridayRushResponse["scenario"]) => Promise<void>;
  reset:      () => void;
  loadFromHistory: (entry: RunHistoryEntry) => Promise<void>;
  refreshHistory: () => Promise<void>;
}

function toHistoryEntry(run: PlanningRunSummary): RunHistoryEntry {
  return {
    id: run.id,
    targetDate: run.target_date ?? "Next Friday",
    runAt: run.created_at ?? run.generated_at ?? new Date().toISOString(),
    status: run.status,
    verdict: run.critic_verdict ?? "unknown",
    score: run.critic_score,
  };
}

export function useFridayRush(): UseFridayRushReturn {
  const [data,    setData]    = useState<FridayRushResponse | null>(null);
  const [status,  setStatus]  = useState<Status>("idle");
  const [error,   setError]   = useState<string | null>(null);
  const [history, setHistory] = useState<RunHistoryEntry[]>([]);

  const refreshHistory = useCallback(async () => {
    const runs = await listPlanningRuns(10);
    setHistory(runs.map(toHistoryEntry));
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      refreshHistory().catch(() => {
        // History should not block the main planning experience.
      });
    }, 0);
    return () => window.clearTimeout(timer);
  }, [refreshHistory]);

  const trigger = useCallback(async (targetDate?: string, scenario: FridayRushResponse["scenario"] = "friday_rush") => {
    setStatus("loading");
    setError(null);

    try {
      const result = await runPlanningScenario({
        target_date: targetDate ?? null,
        simulation_mode: false,
        scenario,
      });
      setData(result);
      setStatus("success");
      await refreshHistory();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
      setStatus("error");
    }
  }, [refreshHistory]);

  const reset = useCallback(() => {
    setData(null);
    setStatus("idle");
    setError(null);
  }, []);

  const loadFromHistory = useCallback(async (entry: RunHistoryEntry) => {
    try {
      setStatus("loading");
      setError(null);
      if (entry.data) {
        setData(entry.data);
      } else {
        const detail = await getPlanningRun(Number(entry.id));
        setData(detail.final_response);
      }
      setStatus("success");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown history load error");
      setStatus("error");
    }
  }, []);

  return { data, status, error, history, trigger, reset, loadFromHistory, refreshHistory };
}
