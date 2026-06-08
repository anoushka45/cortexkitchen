"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { slides, SLIDE_W, SLIDE_H } from "./slides";

/* ──────────────────────────────────────────────────────────────────────────
   Self-contained LinkedIn carousel viewer.
   - On screen: one slide at a time, scaled to fit, with prev/next + dots.
   - Print mode (?print=1 or "Print / Save PDF"): every slide at exact
     1080×1350 px, one per page — drop straight into a LinkedIn document post.
   This route does not touch any other part of the app.
   ────────────────────────────────────────────────────────────────────────── */

export default function CarouselPage() {
  const [index, setIndex] = useState(0);
  const [scale, setScale] = useState(1);
  const stageRef = useRef<HTMLDivElement>(null);

  const total = slides.length;
  const go = useCallback(
    (dir: number) => setIndex((i) => Math.min(total - 1, Math.max(0, i + dir))),
    [total]
  );

  // Fit the slide to the available viewport while preserving 4:5 ratio.
  useEffect(() => {
    function fit() {
      const el = stageRef.current;
      if (!el) return;
      const pad = 48;
      const availW = el.clientWidth - pad;
      const availH = el.clientHeight - pad;
      setScale(Math.min(availW / SLIDE_W, availH / SLIDE_H, 1));
    }
    fit();
    window.addEventListener("resize", fit);
    return () => window.removeEventListener("resize", fit);
  }, []);

  // Keyboard nav.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "ArrowRight" || e.key === "ArrowDown") go(1);
      if (e.key === "ArrowLeft" || e.key === "ArrowUp") go(-1);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [go]);

  return (
    <div className="flex h-[calc(100vh-0px)] min-h-screen flex-col bg-ink-950">
      {/* ── Toolbar (hidden in print) ── */}
      <div className="no-print flex items-center justify-between border-b border-white/10 px-6 py-4">
        <div className="flex items-center gap-3">
          <span className="flex h-2.5 w-2.5 rounded-full bg-ember-400" />
          <span className="font-mono text-[13px] font-bold uppercase tracking-[0.22em] text-white">
            CortexKitchen — Carousel
          </span>
          <span className="font-mono text-[12px] uppercase tracking-[0.18em] text-white/35">
            1080 × 1350
          </span>
        </div>
        <button
          onClick={() => window.print()}
          className="btn-primary rounded-lg px-5 py-2.5 text-[14px] font-semibold"
        >
          Print / Save as PDF
        </button>
      </div>

      {/* ── Stage (screen) ── */}
      <div ref={stageRef} className="no-print relative flex flex-1 items-center justify-center overflow-hidden px-6">
        <div
          style={{ width: SLIDE_W, height: SLIDE_H, transform: `scale(${scale})` }}
          className="overflow-hidden rounded-3xl ring-1 ring-white/10 shadow-[0_40px_120px_-30px_rgba(0,0,0,0.8)]"
        >
          {slides[index]}
        </div>

        {/* Prev / Next */}
        <button
          aria-label="Previous slide"
          onClick={() => go(-1)}
          disabled={index === 0}
          className="absolute left-6 flex h-12 w-12 items-center justify-center rounded-full bg-ink-900 text-white ring-1 ring-white/15 transition hover:ring-ember-400/50 disabled:opacity-30"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
            <path d="M15 6l-6 6 6 6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        <button
          aria-label="Next slide"
          onClick={() => go(1)}
          disabled={index === total - 1}
          className="absolute right-6 flex h-12 w-12 items-center justify-center rounded-full bg-ink-900 text-white ring-1 ring-white/15 transition hover:ring-ember-400/50 disabled:opacity-30"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
            <path d="M9 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </div>

      {/* ── Dots ── */}
      <div className="no-print flex items-center justify-center gap-2 border-t border-white/10 py-4">
        {slides.map((_, i) => (
          <button
            key={i}
            aria-label={`Go to slide ${i + 1}`}
            onClick={() => setIndex(i)}
            className={`h-2.5 rounded-full transition-all ${
              i === index ? "w-7 bg-ember-400" : "w-2.5 bg-white/20 hover:bg-white/40"
            }`}
          />
        ))}
      </div>

      {/* ── Print sheet: all slides, exact size, one per page ── */}
      <div className="print-only">
        {slides.map((s, i) => (
          <div key={i} className="print-page">
            {s}
          </div>
        ))}
      </div>

      <style jsx global>{`
        .print-only {
          display: none;
        }
        @media print {
          @page {
            size: ${SLIDE_W}px ${SLIDE_H}px;
            margin: 0;
          }
          html,
          body {
            background: #070a12 !important;
          }
          .no-print {
            display: none !important;
          }
          .print-only {
            display: block !important;
          }
          .print-page {
            width: ${SLIDE_W}px;
            height: ${SLIDE_H}px;
            overflow: hidden;
            break-after: page;
            page-break-after: always;
          }
          /* Force backgrounds/colors to render in the PDF */
          * {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
        }
      `}</style>
    </div>
  );
}
