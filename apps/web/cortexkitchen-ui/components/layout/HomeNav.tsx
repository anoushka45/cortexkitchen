"use client";

import Image from "next/image";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";

const NAV_ANCHORS = [
  { label: "Features",  href: "#features"  },
  { label: "For Guests", href: "#concierge" },
];

export default function HomeNav() {
  const { user } = useAuth();

  // App NavBar (layout.tsx) already shows for logged-in users — don't double-render
  if (user) return null;

  return (
    <header className="glass sticky top-0 z-50 border-b border-[var(--color-border-soft)]">
      <div className="mx-auto flex h-16 max-w-[1280px] items-center justify-between px-8">
        <Link href="/" className="flex items-center gap-3">
          <span className="grid h-8 w-8 place-items-center overflow-hidden rounded-lg bg-black ring-1 ring-[var(--color-border-default)]">
            <Image src="/ck-logo.png" alt="CK" width={28} height={28} className="h-7 w-7 object-contain" priority />
          </span>
          <div className="leading-tight">
            <div className="text-[15px] font-bold tracking-tight text-[var(--color-text-primary)]">CortexKitchen</div>
            <div className="text-[9px] uppercase tracking-[0.24em] text-[var(--color-accent)]/70">ops intelligence</div>
          </div>
        </Link>

        <nav className="hidden items-center gap-7 text-sm text-[var(--color-text-soft)] md:flex">
          {NAV_ANCHORS.map(({ label, href }) => (
            <a key={label} href={href} className="transition-colors hover:text-[var(--color-text-primary)]">{label}</a>
          ))}
        </nav>

        <div className="flex items-center gap-3">
          <Link href="/login" className="text-sm text-[var(--color-text-soft)] transition-colors hover:text-[var(--color-text-primary)]">
            Restaurant login
          </Link>
          <Link href="/concierge" className="btn-primary inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold">
            Sign in as Guest
            <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 12h14M13 6l6 6-6 6" />
            </svg>
          </Link>
        </div>
      </div>
    </header>
  );
}
