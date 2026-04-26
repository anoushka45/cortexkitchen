"use client";

import { useState } from "react";

interface Props {
  onRun: (date?: string) => void;
  loading: boolean;
}

function getUpcomingFridays(count = 6): { label: string; value: string }[] {
  const fridays = [];
  const today = new Date();
  const day = today.getDay();
  const daysToFriday = day <= 5 ? 5 - day : 6;

  const nextFriday = new Date(today);
  nextFriday.setDate(today.getDate() + (daysToFriday === 0 ? 7 : daysToFriday));

  for (let index = 0; index < count; index++) {
    const date = new Date(nextFriday);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const dayOfMonth = String(date.getDate()).padStart(2, "0");
    const value = `${year}-${month}-${dayOfMonth}`;
    const label =
      index === 0
        ? `This Friday (${value})`
        : index === 1
        ? `Next Friday (${value})`
        : value;

    fridays.push({ label, value });
    nextFriday.setDate(nextFriday.getDate() + 7);
  }

  return fridays;
}

export default function DatePicker({ onRun, loading }: Props) {
  const fridays = getUpcomingFridays(6);
  const [selected, setSelected] = useState<string>("");
  const [custom, setCustom] = useState(false);
  const [customDate, setCustomDate] = useState("");

  const handleRun = () => {
    const date = custom ? customDate : selected;
    onRun(date || undefined);
  };

  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 px-3 py-3 min-w-[320px] xl:min-w-[540px]">
      <div className="flex flex-col gap-3 xl:flex-row xl:items-end">
        <div className="min-w-0 flex-1">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between mb-2">
            <div>
              <p className="text-[11px] font-mono uppercase tracking-[0.18em] text-slate-500">
                Planning Window
              </p>
              <p className="text-sm text-slate-400 mt-1">
                Choose a Friday preset or run the workflow for a custom date
              </p>
            </div>
            <div className="inline-flex items-center rounded-full border border-white/10 bg-slate-950/70 p-1 self-start">
              <button
                onClick={() => {
                  setCustom(false);
                  setCustomDate("");
                }}
                disabled={loading}
                className={`px-3 py-1.5 rounded-full text-[11px] font-mono transition-colors ${
                  !custom
                    ? "bg-violet-500/20 text-violet-200"
                    : "text-slate-500 hover:text-slate-300"
                }`}
              >
                presets
              </button>
              <button
                onClick={() => {
                  setCustom(true);
                  setSelected("");
                }}
                disabled={loading}
                className={`px-3 py-1.5 rounded-full text-[11px] font-mono transition-colors ${
                  custom
                    ? "bg-violet-500/20 text-violet-200"
                    : "text-slate-500 hover:text-slate-300"
                }`}
              >
                custom
              </button>
            </div>
          </div>

          {!custom ? (
            <select
              value={selected}
              onChange={(event) => setSelected(event.target.value)}
              disabled={loading}
              className="
                w-full text-xs font-mono bg-navy-800 border border-white/10
                text-slate-300 rounded-xl px-3 py-3
                focus:outline-none focus:border-violet-500/50
                disabled:opacity-50
              "
              style={{ background: "#121a2e" }}
            >
              <option value="">Next Friday (default)</option>
              {fridays.map((friday) => (
                <option key={friday.value} value={friday.value}>
                  {friday.label}
                </option>
              ))}
            </select>
          ) : (
            <input
              type="date"
              value={customDate}
              onChange={(event) => setCustomDate(event.target.value)}
              disabled={loading}
              className="
                w-full text-xs font-mono bg-navy-800 border border-white/10
                text-slate-300 rounded-xl px-3 py-3
                focus:outline-none focus:border-violet-500/50
                disabled:opacity-50
              "
              style={{ background: "#121a2e", colorScheme: "dark" }}
            />
          )}
        </div>

        <div className="flex flex-col gap-2 xl:w-44">
          <button
            onClick={handleRun}
            disabled={loading || (custom && !customDate)}
            className="
              inline-flex items-center justify-center gap-2 px-4 py-3
              bg-violet-600 hover:bg-violet-500
              disabled:opacity-40 disabled:cursor-not-allowed
              text-white text-xs font-mono font-semibold rounded-xl
              transition-all duration-200 border border-violet-500/50
            "
          >
            {loading ? "running…" : "⚡ Generate Plan"}
          </button>
          <p className="text-[11px] text-slate-500 font-mono text-center">
            {custom ? "Custom planning run" : "Preset planning run"}
          </p>
        </div>
      </div>
    </div>
  );
}
