"use client";

import { ReactNode, useEffect } from "react";

interface Props {
  open: boolean;
  title: string;
  subtitle?: string;
  meta?: Array<{ label: string; value: string }>;
  highlights?: string[];
  onClose: () => void;
  children: ReactNode;
}

export default function DashboardDetailModal({
  open,
  title,
  subtitle,
  meta = [],
  highlights = [],
  onClose,
  children,
}: Props) {
  useEffect(() => {
    if (!open) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[70]">
      <button
        aria-label="Close detail modal"
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="absolute inset-x-4 top-6 bottom-6 xl:inset-x-16 2xl:inset-x-28">
        <div className="card h-full flex flex-col rounded-3xl overflow-hidden border-white/10 shadow-2xl">
          <div className="flex items-start justify-between gap-4 px-6 py-5 border-b border-white/5 bg-white/5">
            <div>
              <p className="text-xs font-mono uppercase tracking-[0.18em] text-slate-500">
                Agent Detail
              </p>
              <h2 className="text-xl font-semibold text-slate-100 mt-1">{title}</h2>
              {subtitle && <p className="text-sm text-slate-400 mt-1">{subtitle}</p>}
              {meta.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-3">
                  {meta.map((item) => (
                    <div
                      key={`${item.label}-${item.value}`}
                      className="rounded-full border border-white/10 bg-slate-900/70 px-3 py-1 text-[11px] font-mono text-slate-300"
                    >
                      <span className="text-slate-500">{item.label}</span>
                      <span className="mx-1 text-slate-600">·</span>
                      <span>{item.value}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <button
              onClick={onClose}
              className="rounded-full border border-white/10 bg-slate-900/80 px-3 py-1.5 text-xs font-mono text-slate-300 hover:bg-slate-800 transition-colors"
            >
              close
            </button>
          </div>
          <div className="flex-1 overflow-y-auto px-6 py-6">
            {highlights.length > 0 && (
              <div className="mb-6">
                <p className="text-xs font-mono uppercase tracking-[0.18em] text-slate-500 mb-3">
                  Key Takeaways
                </p>
                <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
                  {highlights.map((item, index) => (
                    <div
                      key={`${item}-${index}`}
                      className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-200"
                    >
                      {item}
                    </div>
                  ))}
                </div>
              </div>
            )}
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}
