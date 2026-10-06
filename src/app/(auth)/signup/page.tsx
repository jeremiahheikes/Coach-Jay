"use client";
import { useActionState } from "react";
import Link from "next/link";
import { signUp, type AuthState } from "../actions";
import { AuthShell } from "@/components/AuthShell";

export default function SignupPage() {
  const [state, action, pending] = useActionState<AuthState, FormData>(signUp, {});
  return (
    <AuthShell title="Create your account">
      <form action={action} className="flex flex-col gap-4">
        <div className="flex flex-col gap-1">
          <label className="label" htmlFor="full_name">Full name</label>
          <input className="input" id="full_name" name="full_name" autoComplete="name" required />
        </div>
        <div className="flex flex-col gap-1">
          <label className="label" htmlFor="email">Email</label>
          <input className="input" id="email" name="email" type="email" autoComplete="email" required />
          <p className="text-xs text-ink3">Students: use the email your coach has for you, so your lessons link up.</p>
        </div>
        <div className="flex flex-col gap-1">
          <label className="label" htmlFor="password">Password</label>
          <input className="input" id="password" name="password" type="password" autoComplete="new-password" minLength={8} required />
        </div>
        <fieldset className="flex gap-2">
          <legend className="label mb-1">I am a</legend>
          <label className="btn flex-1 has-[:checked]:bg-accent has-[:checked]:text-accent-ink has-[:checked]:border-accent">
            <input type="radio" name="role" value="student" defaultChecked className="sr-only" />Student
          </label>
          <label className="btn flex-1 has-[:checked]:bg-accent has-[:checked]:text-accent-ink has-[:checked]:border-accent">
            <input type="radio" name="role" value="coach" className="sr-only" />Coach
          </label>
        </fieldset>
        {state.error && <p role="alert" className="text-sm text-bad">{state.error}</p>}
        {state.message && <p role="status" className="text-sm text-good">{state.message}</p>}
        <button className="btn btn-primary" disabled={pending}>{pending ? "Creating…" : "Create account"}</button>
        <p className="text-sm text-ink2 text-center">Already have one? <Link className="text-accent font-semibold" href="/login">Sign in</Link></p>
      </form>
    </AuthShell>
  );
}
