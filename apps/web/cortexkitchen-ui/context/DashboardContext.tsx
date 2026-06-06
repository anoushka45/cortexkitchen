"use client";

import { createContext, useCallback, useContext, useRef, useState } from "react";

export type DashScenario = "friday_rush" | "weekday_lunch" | "holiday_spike" | "low_stock_weekend";
export type DashStatus   = "idle" | "loading" | "success" | "error";

interface DashboardCtx {
  selectedScenario: DashScenario;
  setSelectedScenario: (s: DashScenario) => void;
  dashStatus: DashStatus;
  setDashStatus: (s: DashStatus) => void;
  doReset: () => void;
  registerReset: (fn: () => void) => void;
}

const Context = createContext<DashboardCtx | null>(null);

export function DashboardProvider({ children }: { children: React.ReactNode }) {
  const [selectedScenario, setSelectedScenario] = useState<DashScenario>("friday_rush");
  const [dashStatus, setDashStatus] = useState<DashStatus>("idle");
  const resetFnRef = useRef<() => void>(() => {});

  const registerReset = useCallback((fn: () => void) => {
    resetFnRef.current = fn;
  }, []);

  const doReset = useCallback(() => {
    resetFnRef.current();
    setDashStatus("idle");
  }, []);

  return (
    <Context.Provider value={{ selectedScenario, setSelectedScenario, dashStatus, setDashStatus, doReset, registerReset }}>
      {children}
    </Context.Provider>
  );
}

export function useDashboardCtx(): DashboardCtx | null {
  return useContext(Context);
}
