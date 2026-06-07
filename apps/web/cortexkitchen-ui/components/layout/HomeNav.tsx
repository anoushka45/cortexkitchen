"use client";

import Image from "next/image";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";

const NAV_ANCHORS = [
  { label: "Pipeline",  href: "#pipeline"  },
  { label: "Features",  href: "#features"  },
  { label: "Scenarios", href: "#scenarios" },
];

export default function HomeNav() {
  const { user } = useAuth();

  // App NavBar (layout.tsx) already shows for logged-in users — don't double-render
  if (user) return null;

  return (
    <header className="glass sticky top-0 z-50 border-b border-white/[0.06]">
      <div className="mx-auto flex h-16 max-w-[1280px] items-center justify-between px-8">
        <Link href="/" className="flex items-center gap-3">
          <span className="grid h-8 w-8 place-items-center overflow-hidden rounded-lg bg-black ring-1 ring-white/10">
            <Image src="/ck-logo.png" alt="CK" width={28} height={28} className="h-7 w-7 object-contain" priority />
          </span>
          <div className="leading-tight">
            <div className="text-[15px] font-bold tracking-tight text-white">CortexKitchen</div>
            <div className="font-mono text-[9px] uppercase tracking-[0.24em] text-ember-300/70">ops intelligence</div>
          </div>
        </Link>

        <nav className="hidden items-center gap-7 text-sm text-white/60 md:flex">
          {NAV_ANCHORS.map(({ label, href }) => (
            <a key={label} href={href} className="transition-colors hover:text-white">{label}</a>
          ))}
        </nav>

        <div className="flex items-center gap-3">
          <Link href="/login" className="text-sm text-white/70 transition-colors hover:text-white">
            Sign in
          </Link>
          <Link href="/register" className="btn-primary inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold">
            Get started
            <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 12h14M13 6l6 6-6 6" />
            </svg>
          </Link>
        </div>
      </div>
    </header>
  );
}
