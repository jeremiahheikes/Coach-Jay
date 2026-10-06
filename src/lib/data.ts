import { createClient } from "@/lib/supabase/server";
import type { Assignment, ClubAverage, Profile, Session, Shot, Student, Video } from "@/lib/types";
import { redirect } from "next/navigation";

export async function requireUser() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: profile } = await supabase.from("profiles").select("*").eq("id", user.id).single();
  return { supabase, user, profile: profile as Profile };
}

export async function listStudents(): Promise<Student[]> {
  const { supabase } = await requireUser();
  const { data } = await supabase.from("students").select("*").order("full_name");
  return (data ?? []) as Student[];
}

export async function getStudent(id: string): Promise<Student | null> {
  const { supabase } = await requireUser();
  const { data } = await supabase.from("students").select("*").eq("id", id).maybeSingle();
  return (data as Student) ?? null;
}

/** The signed-in student's own roster row (students are linked by email at signup). */
export async function getMyStudentRow(): Promise<Student | null> {
  const { supabase, user } = await requireUser();
  const { data } = await supabase.from("students").select("*").eq("user_id", user.id).limit(1).maybeSingle();
  return (data as Student) ?? null;
}

export async function getStudentBundle(studentId: string) {
  const { supabase } = await requireUser();
  const [sessions, averages, swings, assignments] = await Promise.all([
    supabase.from("sessions").select("*").eq("student_id", studentId).order("session_date", { ascending: false }),
    supabase.from("session_club_averages").select("*").eq("student_id", studentId).order("session_date"),
    supabase.from("videos").select("*").eq("student_id", studentId).eq("kind", "swing").order("recorded_on", { ascending: false }),
    supabase.from("assignments").select("*, video:videos(*)").eq("student_id", studentId).order("assigned_at", { ascending: false }),
  ]);
  return {
    sessions: (sessions.data ?? []) as Session[],
    averages: (averages.data ?? []) as ClubAverage[],
    swings: (swings.data ?? []) as Video[],
    assignments: (assignments.data ?? []) as (Assignment & { video: Video })[],
  };
}

export async function getSessionShots(sessionId: string): Promise<Shot[]> {
  const { supabase } = await requireUser();
  const { data } = await supabase.from("shots").select("*").eq("session_id", sessionId).order("hit_at");
  return (data ?? []) as Shot[];
}

export async function listLessons(): Promise<Video[]> {
  const { supabase } = await requireUser();
  const { data } = await supabase.from("videos").select("*").eq("kind", "lesson").order("category").order("created_at", { ascending: false });
  return (data ?? []) as Video[];
}

/** Latest-vs-previous carry trend for the club with the most sessions. */
export function carryTrend(averages: ClubAverage[]) {
  const byClub = new Map<string, ClubAverage[]>();
  for (const a of averages) byClub.set(a.club, [...(byClub.get(a.club) ?? []), a]);
  let best: ClubAverage[] | null = null;
  for (const rows of byClub.values()) if (!best || rows.length > best.length) best = rows;
  if (!best || best.length === 0) return null;
  const last = best[best.length - 1]!;
  const prev = best.length > 1 ? best[best.length - 2]! : null;
  return { club: last.club, carry: last.carry, delta: prev && last.carry != null && prev.carry != null ? Math.round(last.carry - prev.carry) : null, count: best.length };
}
