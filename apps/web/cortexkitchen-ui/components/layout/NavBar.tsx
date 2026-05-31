"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/context/AuthContext";

const BASE_NAV = [
  { href: "/", label: "Dashboard" },
  { href: "/runs", label: "Runs" },
  { href: "/data-health", label: "Data Health" },
];

export default function NavBar() {
  const { user, logout } = useAuth();
  const pathname = usePathname();

  if (!user) return null;

  const navLinks = user.role === "owner"
    ? [...BASE_NAV, { href: "/settings", label: "Settings" }]
    : BASE_NAV;

  return (
    <header className="border-b border-neutral-800 bg-neutral-950/80 backdrop-blur-sm sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-14 flex items-center gap-6">
        <span className="font-bold text-white text-sm tracking-tight shrink-0">CortexKitchen</span>

        <nav className="flex items-center gap-1 flex-1">
          {navLinks.map(({ href, label }) => (
            <Link
              key={href}
              href={href}
              className={`px-3 py-1.5 rounded-md text-sm transition-colors ${
                pathname === href
                  ? "bg-neutral-800 text-white"
                  : "text-neutral-400 hover:text-white hover:bg-neutral-800/50"
              }`}
            >
              {label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-3 shrink-0">
          <div className="text-right hidden sm:block">
            <p className="text-xs text-white font-medium leading-none">{user.full_name ?? user.email}</p>
            <p className="text-xs text-neutral-500 mt-0.5">{user.org_name} · {user.role}</p>
          </div>
          <button
            onClick={logout}
            className="text-xs text-neutral-400 hover:text-white border border-neutral-700 hover:border-neutral-500 rounded-md px-2.5 py-1.5 transition-colors"
          >
            Sign out
          </button>
        </div>
      </div>
    </header>
  );
}
