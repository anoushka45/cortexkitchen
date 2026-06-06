"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { useDashboardCtx } from "@/context/DashboardContext";

const SCENARIO_OPTIONS = [
  { id: "friday_rush",        label: "Friday Rush"        },
  { id: "weekday_lunch",      label: "Weekday Lunch"      },
  { id: "holiday_spike",      label: "Holiday Spike"      },
  { id: "low_stock_weekend",  label: "Low-Stock Weekend"  },
] as const;

const ICONS: Record<string, React.ReactNode> = {
  "/dashboard": (
    <svg className="h-3.5 w-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
    </svg>
  ),
  "/runs": (
    <svg className="h-3.5 w-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
    </svg>
  ),
  "/data-health": (
    <svg className="h-3.5 w-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
    </svg>
  ),
  "/restaurant-profiles": (
    <svg className="h-3.5 w-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
    </svg>
  ),
  "/settings": (
    <svg className="h-3.5 w-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065zM15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  ),
};

const BASE_NAV = [
  { href: "/dashboard",   label: "Plan"        },
  { href: "/runs",        label: "Runs"        },
  { href: "/data-health", label: "Data health" },
];

export default function NavBar() {
  const { user, logout } = useAuth();
  const pathname         = usePathname();
  const dashCtx          = useDashboardCtx();

  if (!user) return null;

  const navLinks = user.role === "owner"
    ? [...BASE_NAV, { href: "/restaurant-profiles", label: "Profiles" }, { href: "/settings", label: "Settings" }]
    : BASE_NAV;

  const onDashboard = pathname === "/dashboard";

  return (
    <header className="sticky top-0 z-40 border-b border-white/[0.07] bg-[#09111f]/90 backdrop-blur-md">
      <div className="mx-auto flex h-14 max-w-7xl items-center gap-4 px-4 sm:px-6">

        {/* Brand */}
        <Link href="/dashboard" className="flex shrink-0 items-center gap-2.5">
          <div className="grid h-8 w-8 place-items-center overflow-hidden rounded-lg bg-black ring-1 ring-white/10">
            <Image src="/ck-logo.png" alt="CortexKitchen" width={28} height={28} className="h-7 w-7 object-contain" priority />
          </div>
          <div className="leading-tight">
            <div className="text-[14px] font-bold tracking-tight text-white">CortexKitchen</div>
            {user.org_name && (
              <div className="font-mono text-[9px] uppercase tracking-[0.24em] text-ember-300/70">{user.org_name}</div>
            )}
          </div>
        </Link>

        {/* Nav links */}
        <nav className="flex flex-1 items-center gap-0.5">
          {navLinks.map(({ href, label }) => {
            const active = pathname === href;
            return (
              <Link
                key={href}
                href={href}
                className={`relative flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[13px] transition-colors ${
                  active
                    ? "bg-white/[0.05] text-white"
                    : "text-white/55 hover:bg-white/[0.04] hover:text-white"
                }`}
              >
                {active && <span className="h-1.5 w-1.5 rounded-full bg-ember-400 shrink-0" />}
                {!active && <span className={active ? "text-ember-400" : "text-slate-600"}>{ICONS[href]}</span>}
                {label}
              </Link>
            );
          })}
        </nav>

        {/* Dashboard-specific controls */}
        {onDashboard && dashCtx && (
          <div className="flex items-center gap-2 shrink-0">
            {/* Scenario selector */}
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

            {/* New Run -- only when not in idle state */}
            {dashCtx.dashStatus !== "idle" && (
              <button
                onClick={dashCtx.doReset}
                className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-1.5 text-xs text-slate-400 transition-colors hover:border-white/20 hover:bg-white/[0.06] hover:text-slate-200"
              >
                <svg className="h-3.5 w-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v1m6.364 1.636l-.707.707M20 12h-1M17.657 17.657l-.707-.707M12 20v-1m-5.657-1.636l.707-.707M4 12h1m1.636-6.364l.707.707" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
                New Run
              </button>
            )}
          </div>
        )}

        {/* History quick link */}
        <Link
          href="/runs"
          className={`flex shrink-0 items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-mono uppercase tracking-wider transition-colors ${
            pathname === "/runs"
              ? "border-ember-500/30 bg-ember-500/[0.08] text-ember-300"
              : "border-white/10 bg-white/[0.03] text-white/55 hover:border-white/20 hover:text-white"
          }`}
        >
          <svg className="h-3.5 w-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          History
        </Link>

        {/* User + sign out */}
        <div className="flex shrink-0 items-center gap-3">
          <div className="hidden text-right sm:block">
            <p className="text-xs font-medium leading-none text-white">{user.full_name ?? user.email}</p>
            <p className="mt-0.5 text-xs text-slate-500">{user.org_name}  -  {user.role}</p>
          </div>
          <button
            onClick={logout}
            className="rounded-md border border-white/10 px-2.5 py-1.5 text-xs text-slate-400 transition-colors hover:border-white/20 hover:text-slate-200"
          >
            Sign out
          </button>
        </div>
      </div>
    </header>
  );
}
