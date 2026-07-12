"use client";

import { createContext, useCallback, useContext, useRef, useState } from "react";

// Widened from the 4-literal union (P6-A25) so a custom natural-language-
// derived scenario id can be selected the same way a preset is.
export type DashScenario = string;
export type DashStatus   = "idle" | "loading" | "success" | "error";

interface DashboardCtx {
  selectedScenario: DashScenario;
  setSelectedScenario: (s: DashScenario) => void;
  dashStatus: DashStatus;
  setDashStatus: (s: DashStatus) => void;
  doReset: () => void;
  registerReset: (fn: () => void) => void;
  openHistory: () => void;
  registerOpenHistory: (fn: () => void) => void;
}

const Context = createContext<DashboardCtx | null>(null);

export function DashboardProvider({ children }: { children: React.ReactNode }) {
  const [selectedScenario, setSelectedScenario] = useState<DashScenario>("friday_rush");
  const [dashStatus, setDashStatus] = useState<DashStatus>("idle");
  const resetFnRef       = useRef<() => void>(() => {});
  const openHistoryFnRef = useRef<() => void>(() => {});

  const registerReset = useCallback((fn: () => void) => {
    resetFnRef.current = fn;
  }, []);

  const doReset = useCallback(() => {
    resetFnRef.current();
    setDashStatus("idle");
  }, []);

  const registerOpenHistory = useCallback((fn: () => void) => {
    openHistoryFnRef.current = fn;
  }, []);

  const openHistory = useCallback(() => {
    openHistoryFnRef.current();
  }, []);

  return (
    <Context.Provider value={{
      selectedScenario, setSelectedScenario,
      dashStatus, setDashStatus,
      doReset, registerReset,
      openHistory, registerOpenHistory,
    }}>
      {children}
    </Context.Provider>
  );
}

export function useDashboardCtx(): DashboardCtx | null {
  return useContext(Context);
}
