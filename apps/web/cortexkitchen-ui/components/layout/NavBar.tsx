"use client";

import Image from "next/image";
import Link from "next/link";
import { useState, useRef, useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { useDashboardCtx } from "@/context/DashboardContext";

const SCENARIO_OPTIONS = [
  { id: "friday_rush",        label: "Friday Rush"        },
  { id: "weekday_lunch",      label: "Weekday Lunch"      },
  { id: "holiday_spike",      label: "Holiday Spike"      },
  { id: "low_stock_weekend",  label: "Low-Stock Weekend"  },
] as const;

const NAV_LINKS = [
  { href: "/dashboard",   label: "Plan",        icon: <svg className="h-3.5 w-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" /></svg> },
  { href: "/runs",        label: "Runs",        icon: <svg className="h-3.5 w-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg> },
  { href: "/data-health", label: "Data",        icon: <svg className="h-3.5 w-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg> },
  { href: "/chat",        label: "Ask AI",      icon: <svg className="h-3.5 w-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg> },
];

export default function NavBar() {
  const { user, logout } = useAuth();
  const pathname         = usePathname();
  const router           = useRouter();
  const dashCtx          = useDashboardCtx();
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setUserMenuOpen(false);
      }
    }
    if (userMenuOpen) document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [userMenuOpen]);

  function handleHistory() {
    if (pathname === "/dashboard") {
      dashCtx?.openHistory();
    } else {
      router.push("/dashboard?openHistory=1");
    }
  }

  if (!user) return null;

  const onDashboard = pathname === "/dashboard";

  return (
    <header className="sticky top-0 z-40 border-b border-white/[0.07] bg-[#09111f]/90 backdrop-blur-md">
      <div className="mx-auto flex h-14 max-w-7xl items-center gap-3 px-4 sm:px-6">

        {/* Brand */}
        <Link
          href="/dashboard"
          onClick={() => { if (onDashboard) dashCtx?.doReset(); }}
          className="flex shrink-0 items-center gap-2.5"
        >
          <div className="grid h-8 w-8 place-items-center overflow-hidden rounded-lg bg-black ring-1 ring-white/10">
            <Image src="/ck-logo.png" alt="CortexKitchen" width={28} height={28} className="h-7 w-7 object-contain" priority />
          </div>
          <div className="leading-tight hidden sm:block">
            <div className="text-[14px] font-bold tracking-tight text-white">CortexKitchen</div>
            {user.org_name && (
              <div className="font-mono text-[9px] uppercase tracking-[0.24em] text-ember-300/70">{user.org_name}</div>
            )}
          </div>
        </Link>

        {/* Nav links */}
        <nav className="flex flex-1 items-center gap-0.5 overflow-x-auto">
          {NAV_LINKS.map(({ href, label, icon }) => {
            const active = pathname === href;
            return (
              <Link
                key={href}
                href={href}
                className={`relative flex shrink-0 items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[13px] transition-colors ${
                  active
                    ? "bg-white/[0.05] text-white"
                    : "text-white/50 hover:bg-white/[0.04] hover:text-white"
                }`}
              >
                {active
                  ? <span className="h-1.5 w-1.5 rounded-full bg-ember-400 shrink-0" />
                  : <span className="text-slate-600 hidden sm:block">{icon}</span>
                }
                <span className="hidden sm:block">{label}</span>
                <span className="sm:hidden">{icon}</span>
              </Link>
            );
          })}
        </nav>

        {/* Dashboard-specific controls */}
        {onDashboard && dashCtx && (
          <div className="hidden sm:flex items-center gap-2 shrink-0">
            <div className="relative">
              <select
                value={dashCtx.selectedScenario}
                onChange={(e) => dashCtx.setSelectedScenario(e.target.value as typeof dashCtx.selectedScenario)}
                className="appearance-none cursor-pointer rounded-lg border border-white/10 bg-slate-950/60 pl-3 pr-7 py-1.5 text-xs font-mono text-slate-300 focus:outline-none focus:ring-1 focus:ring-ember-500/50 transition-colors hover:border-white/20"
              >
                {SCENARIO_OPTIONS.map((s) => (
                  <option key={s.id} value={s.id} className="bg-slate-900">{s.label}</option>
                ))}
              </select>
              <svg className="pointer-events-none absolute right-2 top-1/2 h-3 w-3 -translate-y-1/2 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
            </div>
            {dashCtx.dashStatus !== "idle" && (
              <button
                onClick={dashCtx.doReset}
                className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-1.5 text-xs text-slate-400 transition-colors hover:border-white/20 hover:bg-white/[0.06] hover:text-slate-200"
              >
                <svg className="h-3.5 w-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
                New Run
              </button>
            )}
          </div>
        )}

        {/* History */}
        <button
          onClick={handleHistory}
          className="flex shrink-0 items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.03] px-2.5 py-1.5 text-xs font-mono uppercase tracking-wider text-white/50 transition-colors hover:border-white/20 hover:text-white"
        >
          <svg className="h-3.5 w-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span className="hidden sm:block">History</span>
        </button>

        {/* User dropdown */}
        <div className="relative shrink-0" ref={userMenuRef}>
          <button
            onClick={() => setUserMenuOpen(v => !v)}
            className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.03] px-2.5 py-1.5 text-xs text-slate-400 transition-colors hover:border-white/20 hover:text-slate-200"
          >
            <div className="flex h-5 w-5 items-center justify-center rounded-full bg-ember-500/20 ring-1 ring-ember-400/30 text-[9px] font-bold text-ember-300">
              {(user.full_name ?? user.email).slice(0, 2).toUpperCase()}
            </div>
            <span className="hidden sm:block max-w-[80px] truncate">{user.full_name ?? user.email.split("@")[0]}</span>
            <svg className="h-3 w-3 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {userMenuOpen && (
            <div className="absolute right-0 top-full mt-1.5 w-48 rounded-xl border border-white/10 bg-[#0d1724] py-1.5 shadow-xl z-50">
              <div className="px-3 py-2 border-b border-white/[0.06] mb-1">
                <p className="text-xs font-medium text-white truncate">{user.full_name ?? user.email}</p>
                <p className="text-[10px] text-slate-500 mt-0.5">{user.org_name} · {user.role}</p>
              </div>
              {user.role === "owner" && (
                <>
                  <Link href="/restaurant-profiles" onClick={() => setUserMenuOpen(false)} className="flex items-center gap-2 px-3 py-2 text-xs text-slate-400 hover:text-white hover:bg-white/[0.04] transition-colors">
                    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>
                    Restaurant Profiles
                  </Link>
                  <Link href="/settings" onClick={() => setUserMenuOpen(false)} className="flex items-center gap-2 px-3 py-2 text-xs text-slate-400 hover:text-white hover:bg-white/[0.04] transition-colors">
                    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065zM15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                    Settings
                  </Link>
                  <div className="border-t border-white/[0.06] my-1" />
                </>
              )}
              <button onClick={() => { setUserMenuOpen(false); logout(); }} className="flex w-full items-center gap-2 px-3 py-2 text-xs text-rose-400/80 hover:text-rose-300 hover:bg-white/[0.04] transition-colors">
                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
                Sign out
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
