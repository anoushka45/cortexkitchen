"use client";

import { useActionState } from "react";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";

type FormState = { error?: string } | undefined;

export default function LoginPage() {
  const { login } = useAuth();

  async function handleLogin(_prev: FormState, formData: FormData): Promise<FormState> {
    const email    = formData.get("email") as string;
    const password = formData.get("password") as string;
    try {
      await login({ email, password });
    } catch (e) {
      return { error: e instanceof Error ? e.message : "Login failed." };
    }
  }

  const [state, action, pending] = useActionState(handleLogin, undefined);

  return (
    <div className="min-h-screen bg-[#09111f] flex items-center justify-center p-4">
      <div className="w-full max-w-sm stagger-1">
        <div className="mb-8 text-center stagger-2">
          <h1 className="text-2xl font-bold text-white tracking-tight">CortexKitchen</h1>
          <p className="text-slate-500 text-sm mt-1">Sign in to your workspace</p>
        </div>

        <form action={action} className="bg-[#0d1320] border border-white/10 rounded-xl p-6 space-y-4 stagger-3">
          {state?.error && (
            <div className="text-sm text-rose-400 bg-rose-500/10 border border-rose-500/20 rounded-lg px-3 py-2">
              {state.error}
            </div>
          )}

          <div>
            <label className="block text-sm text-slate-400 mb-1.5" htmlFor="email">Email</label>
            <input
              id="email"
              name="email"
              type="email"
              required
              autoComplete="email"
              className="w-full bg-slate-950/60 border border-white/10 rounded-lg px-3 py-2 text-white text-sm placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-violet-500/50 focus:border-violet-500/60 transition-colors"
              placeholder="you@restaurant.com"
            />
          </div>

          <div>
            <label className="block text-sm text-slate-400 mb-1.5" htmlFor="password">Password</label>
            <input
              id="password"
              name="password"
              type="password"
              required
              autoComplete="current-password"
              className="w-full bg-slate-950/60 border border-white/10 rounded-lg px-3 py-2 text-white text-sm placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-violet-500/50 focus:border-violet-500/60 transition-colors"
              placeholder="••••••••"
            />
          </div>

          <button
            type="submit"
            disabled={pending}
            className="w-full bg-violet-600 hover:bg-violet-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold rounded-lg py-2 text-sm transition-colors"
          >
            {pending ? "Signing in…" : "Sign in"}
          </button>
        </form>

        <p className="text-center text-sm text-slate-500 mt-4">
          No account?{" "}
          <Link href="/register" className="text-violet-400 hover:text-violet-300 transition-colors">
            Create workspace
          </Link>
        </p>
      </div>
    </div>
  );
}
