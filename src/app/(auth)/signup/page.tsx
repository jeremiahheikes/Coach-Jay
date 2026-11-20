"use client";
import { useActionState } from "react";
import Link from "next/link";
import { signUp, type AuthState } from "../actions";
import { AuthShell } from "@/components/AuthShell";

export default function SignupPage() {
  const [state, action, pending] = useActionState<AuthState, FormData>(signUp, {});
  return (
    <AuthShell title="Join free">
      <p className="text-sm text-ink2 -mt-2 mb-0">Get into the Clubhouse, free tips from Coach Jay, and a direct line to book lessons.</p>
      <form action={action} className="flex flex-col gap-4">
        <div className="flex flex-col gap-1">
          <label className="label" htmlFor="full_name">Full name</label>
          <input className="input" id="full_name" name="full_name" autoComplete="name" required />
        </div>
        <div className="flex flex-col gap-1">
          <label className="label" htmlFor="email">Email</label>
          <input className="input" id="email" name="email" type="email" autoComplete="email" required />
          <p className="text-xs text-ink3">Already taking lessons? Use the email Coach Jay has for you so your lessons link up.</p>
        </div>
        <div className="flex flex-col gap-1">
          <label className="label" htmlFor="password">Password</label>
          <input className="input" id="password" name="password" type="password" autoComplete="new-password" minLength={8} required />
        </div>
        <label className="flex items-start gap-2 text-sm text-ink2">
          <input type="checkbox" name="adult" required className="mt-0.5" />
          I&apos;m 18 or older.
        </label>
        {state.error && <p role="alert" className="text-sm text-bad">{state.error}</p>}
        {state.message && <p role="status" className="text-sm text-good">{state.message}</p>}
        <button className="btn btn-primary" disabled={pending}>{pending ? "Creating…" : "Join free"}</button>
        <p className="text-sm text-ink2 text-center">Already have one? <Link className="text-accent font-semibold" href="/login">Sign in</Link></p>
      </form>
    </AuthShell>
  );
}
