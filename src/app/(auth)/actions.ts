"use server";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export type AuthState = { error?: string; message?: string };

export async function signIn(_: AuthState, form: FormData): Promise<AuthState> {
  const supabase = await createClient();
  const email = String(form.get("email") ?? "").trim();
  const password = String(form.get("password") ?? "");
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return { error: error.message };
  redirect("/");
}

export async function signUp(_: AuthState, form: FormData): Promise<AuthState> {
  const supabase = await createClient();
  const email = String(form.get("email") ?? "").trim();
  const password = String(form.get("password") ?? "");
  const full_name = String(form.get("full_name") ?? "").trim();
  // Everyone signs up as a student/member; coaches are promoted in the database (see migration 0006).
  const role = "student";
  if (!full_name) return { error: "Enter your name." };
  if (form.get("adult") !== "on") return { error: "The Coach Jay app is for golfers 18 and older." };
  if (password.length < 8) return { error: "Password needs at least 8 characters." };
  const { data, error } = await supabase.auth.signUp({ email, password, options: { data: { full_name, role } } });
  if (error) return { error: error.message };
  if (data.session) redirect("/");
  return { message: "Check your email to confirm your account, then sign in." };
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
