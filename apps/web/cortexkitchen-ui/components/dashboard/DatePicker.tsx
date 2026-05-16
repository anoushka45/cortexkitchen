"use client";

import { useState } from "react";
import { PlanningScenarioOption } from "@/types/planning";

interface Props {
  onRun: (date?: string) => void;
  loading: boolean;
  scenario?: PlanningScenarioOption;
}

function getUpcomingDates(
  weekday: number,
  scenarioLabel: string,
  count = 6
): { label: string; value: string }[] {
  const dates = [];
  const today = new Date();
  const day = today.getDay();
  const daysAhead = (weekday - ((day + 6) % 7) + 7) % 7;

  const nextDate = new Date(today);
  nextDate.setDate(today.getDate() + (daysAhead === 0 ? 7 : daysAhead));

  for (let index = 0; index < count; index++) {
    const date = new Date(nextDate);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const dayOfMonth = String(date.getDate()).padStart(2, "0");
    const value = `${year}-${month}-${dayOfMonth}`;
    const label =
      index === 0
        ? `Next ${scenarioLabel} (${value})`
        : index === 1
        ? `${scenarioLabel} +1 week (${value})`
        : value;

    dates.push({ label, value });
    nextDate.setDate(nextDate.getDate() + 7);
  }

  return dates;
}

export default function DatePicker({ onRun, loading, scenario }: Props) {
  const scenarioLabel = scenario?.label ?? "Friday Rush";
  const weekday = scenario?.default_weekday ?? 4;
  const dates = getUpcomingDates(weekday, scenarioLabel, 6);
  const [selected, setSelected] = useState<string>("");
  const [custom, setCustom] = useState(false);
  const [customDate, setCustomDate] = useState("");

  const handleRun = () => {
    const date = custom ? customDate : selected;
    onRun(date || undefined);
  };

  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 w-full">
      <div className="flex items-center justify-between mb-2">
        <p className="text-[11px] font-mono uppercase tracking-[0.18em] text-slate-500">
          Planning Window
        </p>
        <div className="inline-flex items-center rounded-full border border-white/10 bg-slate-950/70 p-0.5">
          <button
            onClick={() => { setCustom(false); setCustomDate(""); }}
            disabled={loading}
            className={`px-2.5 py-1 rounded-full text-[11px] font-mono transition-colors ${
              !custom ? "bg-violet-500/20 text-violet-200" : "text-slate-500 hover:text-slate-300"
            }`}
          >
            presets
          </button>
          <button
            onClick={() => { setCustom(true); setSelected(""); }}
            disabled={loading}
            className={`px-2.5 py-1 rounded-full text-[11px] font-mono transition-colors ${
              custom ? "bg-violet-500/20 text-violet-200" : "text-slate-500 hover:text-slate-300"
            }`}
          >
            custom
          </button>
        </div>
      </div>

      <div className="flex gap-2">
        {!custom ? (
          <select
            value={selected}
            onChange={(event) => setSelected(event.target.value)}
            disabled={loading}
            className="flex-1 text-xs font-mono border border-white/10 text-slate-300 rounded-xl px-3 py-2 focus:outline-none focus:border-violet-500/50 disabled:opacity-50"
            style={{ background: "#121a2e" }}
          >
            <option value="">{scenarioLabel} default date</option>
            {dates.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        ) : (
          <input
            type="date"
            value={customDate}
            onChange={(event) => setCustomDate(event.target.value)}
            disabled={loading}
            className="flex-1 text-xs font-mono border border-white/10 text-slate-300 rounded-xl px-3 py-2 focus:outline-none focus:border-violet-500/50 disabled:opacity-50"
            style={{ background: "#121a2e", colorScheme: "dark" }}
          />
        )}
        <button
          onClick={handleRun}
          disabled={loading || (custom && !customDate)}
          className="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl border border-violet-400/30 bg-gradient-to-b from-violet-500 to-violet-700 px-5 py-2 text-xs font-semibold tracking-wide text-white shadow-[0_4px_16px_rgba(139,92,246,0.35)] transition-all duration-200 hover:-translate-y-0.5 hover:from-violet-400 hover:to-violet-600 hover:shadow-[0_6px_22px_rgba(139,92,246,0.45)] active:translate-y-0 active:shadow-[0_2px_8px_rgba(139,92,246,0.25)] disabled:cursor-not-allowed disabled:translate-y-0 disabled:opacity-40 disabled:shadow-none"
        >
          {loading ? (
            <>
              <svg className="h-3.5 w-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
              </svg>
              Running…
            </>
          ) : (
            <>
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              Generate Plan
            </>
          )}
        </button>
      </div>
    </div>
  );
}
