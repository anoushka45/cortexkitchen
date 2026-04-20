// components/dashboard/DatePicker.tsx
// Date selector for targeting a specific Friday.

"use client";

import { useState } from "react";

interface Props {
  onRun:   (date?: string) => void;
  loading: boolean;
}

// Get next N Fridays from today
function getUpcomingFridays(count = 6): { label: string; value: string }[] {
  const fridays = [];
  const today   = new Date();
  const day     = today.getDay();
  const daysToFriday = day <= 5 ? 5 - day : 6;
  
  let next = new Date(today);
  next.setDate(today.getDate() + (daysToFriday === 0 ? 7 : daysToFriday));

  for (let i = 0; i < count; i++) {
    const d     = new Date(next);
    const value = d.toISOString().split("T")[0];
    const label = i === 0
      ? `This Friday (${value})`
      : i === 1
      ? `Next Friday (${value})`
      : value;
    fridays.push({ label, value });
    next.setDate(next.getDate() + 7);
  }

  return fridays;
}

export default function DatePicker({ onRun, loading }: Props) {
  const fridays             = getUpcomingFridays(6);
  const [selected, setSelected] = useState<string>("");
  const [custom,   setCustom]   = useState(false);
  const [customDate, setCustomDate] = useState("");

  const handleRun = () => {
    const date = custom ? customDate : selected;
    onRun(date || undefined);
  };

  return (
    <div className="flex items-center gap-2">
      {/* Friday selector */}
      {!custom ? (
        <select
          value={selected}
          onChange={(e) => setSelected(e.target.value)}
          disabled={loading}
          className="
            text-xs font-mono bg-navy-800 border border-white/10
            text-slate-300 rounded-lg px-3 py-2
            focus:outline-none focus:border-violet-500/50
            disabled:opacity-50
          "
          style={{ background: "#121a2e" }}
        >
          <option value="">Next Friday (default)</option>
          {fridays.map((f) => (
            <option key={f.value} value={f.value}>{f.label}</option>
          ))}
        </select>
      ) : (
        <input
          type="date"
          value={customDate}
          onChange={(e) => setCustomDate(e.target.value)}
          disabled={loading}
          className="
            text-xs font-mono bg-navy-800 border border-white/10
            text-slate-300 rounded-lg px-3 py-2
            focus:outline-none focus:border-violet-500/50
            disabled:opacity-50
          "
          style={{ background: "#121a2e", colorScheme: "dark" }}
        />
      )}

      {/* Custom date toggle */}
      <button
        onClick={() => { setCustom((c) => !c); setCustomDate(""); setSelected(""); }}
        className="text-xs font-mono text-slate-600 hover:text-slate-400 transition-colors"
      >
        {custom ? "presets" : "custom"}
      </button>

      {/* Run button */}
      <button
        onClick={handleRun}
        disabled={loading || (custom && !customDate)}
        className="
          inline-flex items-center gap-2 px-4 py-2
          bg-violet-600 hover:bg-violet-500
          disabled:opacity-40 disabled:cursor-not-allowed
          text-white text-xs font-mono font-semibold rounded-lg
          transition-all duration-200 border border-violet-500/50
        "
      >
        {loading ? "running…" : "⚡ run"}
      </button>
    </div>
  );
}