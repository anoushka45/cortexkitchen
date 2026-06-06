"use client";

import { useActionState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";

type FormState = { error?: string } | undefined;

export default function RegisterPage() {
  const { register } = useAuth();

  async function handleRegister(_prev: FormState, formData: FormData): Promise<FormState> {
    const email     = formData.get("email") as string;
    const password  = formData.get("password") as string;
    const full_name = (formData.get("full_name") as string) || undefined;
    const org_name  = formData.get("org_name") as string;

    if (password.length < 8) return { error: "Password must be at least 8 characters." };

    try {
      await register({ email, password, full_name, org_name });
    } catch (e) {
      return { error: e instanceof Error ? e.message : "Registration failed." };
    }
  }

  const [state, action, pending] = useActionState(handleRegister, undefined);

  return (
    <div className="grid-bg relative flex min-h-screen items-center justify-center overflow-hidden bg-ink-950 p-4">
      <div
        className="pointer-events-none absolute -top-48 left-1/2 h-[620px] w-[920px] -translate-x-1/2 rounded-full"
        style={{ background: "radial-gradient(closest-side, rgba(230,137,42,0.20), transparent 72%)" }}
      />
      <div className="w-full max-w-sm stagger-1">
        <div className="mb-8 text-center stagger-2">
          <div className="mx-auto mb-4 grid h-12 w-12 place-items-center overflow-hidden rounded-xl bg-black ring-1 ring-white/10">
            <Image src="/ck-logo.png" alt="CortexKitchen" width={40} height={40} className="h-10 w-10 object-contain" priority />
          </div>
          <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-ember-300/70">ops intelligence</p>
          <h1 className="mt-2 text-2xl font-bold tracking-tight text-white">CortexKitchen</h1>
          <p className="mt-1 text-sm text-white/50">Create your restaurant workspace</p>
        </div>

        <form action={action} className="glass space-y-4 rounded-2xl border border-white/10 bg-ink-900/85 p-6 shadow-[0_32px_90px_rgba(0,0,0,0.45)] stagger-3">
          {state?.error && (
            <div className="text-sm text-rose-400 bg-rose-500/10 border border-rose-500/20 rounded-lg px-3 py-2">
              {state.error}
            </div>
          )}

          <div>
            <label className="block text-sm text-slate-400 mb-1.5" htmlFor="org_name">Restaurant / Org name</label>
            <input
              id="org_name"
              name="org_name"
              type="text"
              required
              className="w-full bg-slate-950/60 border border-white/10 rounded-lg px-3 py-2 text-white text-sm placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-ember-500/50 focus:border-ember-500/60 transition-colors"
              placeholder="Mario's Pizzeria"
            />
          </div>

          <div>
            <label className="block text-sm text-slate-400 mb-1.5" htmlFor="full_name">
              Your name <span className="text-slate-600">(optional)</span>
            </label>
            <input
              id="full_name"
              name="full_name"
              type="text"
              className="w-full bg-slate-950/60 border border-white/10 rounded-lg px-3 py-2 text-white text-sm placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-ember-500/50 focus:border-ember-500/60 transition-colors"
              placeholder="Mario Rossi"
            />
          </div>

          <div>
            <label className="block text-sm text-slate-400 mb-1.5" htmlFor="email">Email</label>
            <input
              id="email"
              name="email"
              type="email"
              required
              autoComplete="email"
              className="w-full bg-slate-950/60 border border-white/10 rounded-lg px-3 py-2 text-white text-sm placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-ember-500/50 focus:border-ember-500/60 transition-colors"
              placeholder="mario@restaurant.com"
            />
          </div>

          <div>
            <label className="block text-sm text-slate-400 mb-1.5" htmlFor="password">Password</label>
            <input
              id="password"
              name="password"
              type="password"
              required
              autoComplete="new-password"
              minLength={8}
              className="w-full bg-slate-950/60 border border-white/10 rounded-lg px-3 py-2 text-white text-sm placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-ember-500/50 focus:border-ember-500/60 transition-colors"
              placeholder="Min. 8 characters"
            />
          </div>

          <button
            type="submit"
            disabled={pending}
            className="btn-primary w-full rounded-lg py-2 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-50"
          >
            {pending ? "Creating workspace..." : "Create workspace"}
          </button>
        </form>

        <p className="text-center text-sm text-slate-500 mt-4">
          Already have an account?{" "}
          <Link href="/login" className="text-ember-300 transition-colors hover:text-ember-200">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
