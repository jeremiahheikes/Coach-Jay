"use client";
import { useActionState } from "react";
import Link from "next/link";
import { signIn, type AuthState } from "../actions";
import { AuthShell } from "@/components/AuthShell";

export default function LoginPage() {
  const [state, action, pending] = useActionState<AuthState, FormData>(signIn, {});
  return (
    <AuthShell title="Sign in">
      <form action={action} className="flex flex-col gap-4">
        <div className="flex flex-col gap-1">
          <label className="label" htmlFor="email">Email</label>
          <input className="input" id="email" name="email" type="email" autoComplete="email" required />
        </div>
        <div className="flex flex-col gap-1">
          <label className="label" htmlFor="password">Password</label>
          <input className="input" id="password" name="password" type="password" autoComplete="current-password" required />
        </div>
        {state.error && <p role="alert" className="text-sm text-bad">{state.error}</p>}
        <button className="btn btn-primary" disabled={pending}>{pending ? "Signing in…" : "Sign in"}</button>
        <p className="text-sm text-ink2 text-center">New here? <Link className="text-accent font-semibold" href="/signup">Create an account</Link></p>
      </form>
    </AuthShell>
  );
}
