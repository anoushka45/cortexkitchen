"use client";

import { useActionState } from "react";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";

type FormState = { error?: string } | undefined;

export default function RegisterPage() {
  const { register } = useAuth();

  async function handleRegister(_prev: FormState, formData: FormData): Promise<FormState> {
    const email    = formData.get("email") as string;
    const password = formData.get("password") as string;
    const full_name = (formData.get("full_name") as string) || undefined;
    const org_name = formData.get("org_name") as string;

    if (password.length < 8) return { error: "Password must be at least 8 characters." };

    try {
      await register({ email, password, full_name, org_name });
    } catch (e) {
      return { error: e instanceof Error ? e.message : "Registration failed." };
    }
  }

  const [state, action, pending] = useActionState(handleRegister, undefined);

  return (
    <div className="min-h-screen bg-neutral-950 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-bold text-white tracking-tight">CortexKitchen</h1>
          <p className="text-neutral-400 text-sm mt-1">Create your restaurant workspace</p>
        </div>

        <form action={action} className="bg-neutral-900 border border-neutral-800 rounded-xl p-6 space-y-4">
          {state?.error && (
            <div className="text-sm text-red-400 bg-red-400/10 border border-red-400/20 rounded-lg px-3 py-2">
              {state.error}
            </div>
          )}

          <div>
            <label className="block text-sm text-neutral-300 mb-1.5" htmlFor="org_name">Restaurant / Org name</label>
            <input
              id="org_name"
              name="org_name"
              type="text"
              required
              className="w-full bg-neutral-800 border border-neutral-700 rounded-lg px-3 py-2 text-white text-sm placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500"
              placeholder="Mario's Pizzeria"
            />
          </div>

          <div>
            <label className="block text-sm text-neutral-300 mb-1.5" htmlFor="full_name">Your name <span className="text-neutral-500">(optional)</span></label>
            <input
              id="full_name"
              name="full_name"
              type="text"
              className="w-full bg-neutral-800 border border-neutral-700 rounded-lg px-3 py-2 text-white text-sm placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500"
              placeholder="Mario Rossi"
            />
          </div>

          <div>
            <label className="block text-sm text-neutral-300 mb-1.5" htmlFor="email">Email</label>
            <input
              id="email"
              name="email"
              type="email"
              required
              autoComplete="email"
              className="w-full bg-neutral-800 border border-neutral-700 rounded-lg px-3 py-2 text-white text-sm placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500"
              placeholder="mario@restaurant.com"
            />
          </div>

          <div>
            <label className="block text-sm text-neutral-300 mb-1.5" htmlFor="password">Password</label>
            <input
              id="password"
              name="password"
              type="password"
              required
              autoComplete="new-password"
              minLength={8}
              className="w-full bg-neutral-800 border border-neutral-700 rounded-lg px-3 py-2 text-white text-sm placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500"
              placeholder="Min. 8 characters"
            />
          </div>

          <button
            type="submit"
            disabled={pending}
            className="w-full bg-amber-500 hover:bg-amber-400 disabled:opacity-50 disabled:cursor-not-allowed text-black font-semibold rounded-lg py-2 text-sm transition-colors"
          >
            {pending ? "Creating workspace…" : "Create workspace"}
          </button>
        </form>

        <p className="text-center text-sm text-neutral-500 mt-4">
          Already have an account?{" "}
          <Link href="/login" className="text-amber-400 hover:text-amber-300">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
