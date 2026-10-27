"use server";
import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createHash, randomBytes } from "node:crypto";
import { parseCsv } from "@/lib/csv";
import { lessonTitle } from "@/lib/lesson";

export type ActionState = { error?: string; ok?: boolean; token?: string };

const str = (f: FormData, k: string) => String(f.get(k) ?? "").trim();
const num = (f: FormData, k: string) => { const v = parseFloat(String(f.get(k) ?? "")); return Number.isFinite(v) ? v : null; };

// ---------- Roster ----------
export async function addStudent(_: ActionState, form: FormData): Promise<ActionState> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Signed out." };
  const full_name = str(form, "full_name"), email = str(form, "email");
  if (!full_name || !email) return { error: "Name and email are required." };
  const { error } = await supabase.from("students").insert({
    coach_id: user.id, full_name, email, goal: str(form, "goal"), focus: str(form, "focus"),
    handicap: num(form, "handicap"), next_lesson_at: str(form, "next_lesson_at") || null,
  });
  if (error) return { error: error.code === "23505" ? "You already have a student with that email." : error.message };
  revalidatePath("/coach");
  return { ok: true };
}

export async function updateStudent(_: ActionState, form: FormData): Promise<ActionState> {
  const supabase = await createClient();
  const id = str(form, "id");
  const { error } = await supabase.from("students").update({
    full_name: str(form, "full_name"), goal: str(form, "goal"), focus: str(form, "focus"),
    handicap: num(form, "handicap"), next_lesson_at: str(form, "next_lesson_at") || null,
  }).eq("id", id);
  if (error) return { error: error.message };
  revalidatePath(`/coach/students/${id}`);
  return { ok: true };
}

// ---------- Lessons in progress ----------
/** Opens a lesson for the student (or resumes the one already open) and goes to its page. */
export async function startLesson(form: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const student_id = str(form, "student_id");
  const { data: open } = await supabase.from("sessions").select("id").eq("student_id", student_id).eq("status", "open").order("created_at", { ascending: false }).limit(1).maybeSingle();
  if (!open) {
    const { error } = await supabase.from("sessions").insert({
      student_id, coach_id: user.id, session_date: new Date().toISOString().slice(0, 10), source: "manual", title: "Lesson", status: "open",
    });
    if (error) throw new Error(error.message);
  }
  revalidatePath(`/coach/students/${student_id}`);
  redirect(`/coach/students/${student_id}/session`);
}

/** Closes the lesson with a summary note; it then shows in the lesson log like any session. */
export async function finishLesson(_: ActionState, form: FormData): Promise<ActionState> {
  const supabase = await createClient();
  const session_id = str(form, "session_id"), student_id = str(form, "student_id");
  const [{ count: clips }, { count: shots }] = await Promise.all([
    supabase.from("videos").select("id", { count: "exact", head: true }).eq("session_id", session_id),
    supabase.from("shots").select("id", { count: "exact", head: true }).eq("session_id", session_id),
  ]);
  const { error } = await supabase.from("sessions").update({
    status: "closed", closed_at: new Date().toISOString(), note: str(form, "note"), title: lessonTitle(clips ?? 0, shots ?? 0),
  }).eq("id", session_id).eq("status", "open");
  if (error) return { error: error.message };
  revalidatePath(`/coach/students/${student_id}`);
  redirect(`/coach/students/${student_id}`);
}

// ---------- Manual ball-data session ----------
export async function logSession(_: ActionState, form: FormData): Promise<ActionState> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Signed out." };
  const student_id = str(form, "student_id");
  const club = str(form, "club");
  const club_speed = num(form, "club_speed"), ball_speed = num(form, "ball_speed");
  const launch_angle = num(form, "launch_angle"), spin_rate = num(form, "spin_rate"), carry = num(form, "carry");
  if ([club_speed, ball_speed, launch_angle, spin_rate, carry].some((v) => v == null)) return { error: "Fill in all five numbers." };
  const smash_factor = club_speed! > 0 ? +(ball_speed! / club_speed!).toFixed(2) : null;

  // If a lesson is in progress for this student, the numbers go into it (and show under the latest clip).
  const { data: open } = await supabase.from("sessions").select("id").eq("student_id", student_id).eq("status", "open").order("created_at", { ascending: false }).limit(1).maybeSingle();
  let sessionId = open?.id as string | undefined;
  if (!sessionId) {
    const { data: session, error } = await supabase.from("sessions").insert({
      student_id, coach_id: user.id, session_date: str(form, "session_date") || new Date().toISOString().slice(0, 10),
      source: "manual", title: `${club} session`, note: str(form, "note"),
    }).select("id").single();
    if (error) return { error: error.message };
    sessionId = session.id;
  }
  const { error: e2 } = await supabase.from("shots").insert({
    session_id: sessionId, club, club_speed, ball_speed, smash_factor, launch_angle, spin_rate: Math.round(spin_rate!), carry, total: num(form, "total"),
  });
  if (e2) return { error: e2.message };
  revalidatePath(`/coach/students/${student_id}`);
  redirect(open ? `/coach/students/${student_id}/session` : `/coach/students/${student_id}?tab=data`);
}

// ---------- Bay import (CSV from Full Swing app / any launch monitor export) ----------
export async function importBaySession(_: ActionState, form: FormData): Promise<ActionState> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Signed out." };
  const student_id = str(form, "student_id");
  const file = form.get("file") as File | null;
  if (!file || file.size === 0) return { error: "Choose a CSV file." };
  const { shots } = parseCsv(await file.text());
  if (shots.length === 0) return { error: "No shot rows found. The file needs at least a Carry or Ball Speed column." };
  const defaultClub = str(form, "club");
  const { data: session, error } = await supabase.from("sessions").insert({
    student_id, coach_id: user.id, session_date: str(form, "session_date") || new Date().toISOString().slice(0, 10),
    source: "bay_import", title: `Bay session · ${shots.length} shots`, note: str(form, "note"),
  }).select("id").single();
  if (error) return { error: error.message };
  const rows = shots.map((s) => ({
    session_id: session.id, club: s.club === "Unknown" && defaultClub ? defaultClub : s.club,
    club_speed: s.club_speed, ball_speed: s.ball_speed,
    smash_factor: s.club_speed && s.ball_speed ? +(s.ball_speed / s.club_speed).toFixed(2) : null,
    launch_angle: s.launch_angle, spin_rate: s.spin_rate == null ? null : Math.round(s.spin_rate), carry: s.carry, total: s.total, side: s.side, raw: s.raw,
  }));
  const { error: e2 } = await supabase.from("shots").insert(rows);
  if (e2) return { error: e2.message };
  revalidatePath(`/coach/students/${student_id}`);
  redirect(`/coach/students/${student_id}?tab=data`);
}

// ---------- Videos ----------
/** Called after the browser has uploaded the file straight to Supabase Storage. */
export async function registerVideo(input: { kind: "swing" | "lesson"; student_id?: string; session_id?: string | null; storage_path: string; title: string; category?: string; description?: string; coach_note?: string; recorded_on?: string; duration_seconds?: number | null }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Signed out." };
  const { error } = await supabase.from("videos").insert({
    kind: input.kind, coach_id: user.id, student_id: input.student_id ?? null, storage_path: input.storage_path,
    title: input.title, category: input.category ?? "", description: input.description ?? "", coach_note: input.coach_note ?? "",
    recorded_on: input.recorded_on || new Date().toISOString().slice(0, 10), duration_seconds: input.duration_seconds ?? null,
    session_id: input.session_id ?? null,
  });
  if (error) return { error: error.message };
  revalidatePath(input.student_id ? `/coach/students/${input.student_id}` : "/coach/library");
  return { ok: true };
}

export async function updateVideoNote(video_id: string, coach_note: string) {
  const supabase = await createClient();
  const { data, error } = await supabase.from("videos").update({ coach_note }).eq("id", video_id).select("student_id").single();
  if (data?.student_id) revalidatePath(`/coach/students/${data.student_id}`);
  return error ? { error: error.message } : { ok: true };
}

export async function assignLesson(video_id: string, student_id: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("assignments").upsert({ video_id, student_id }, { onConflict: "video_id,student_id" });
  revalidatePath(`/coach/students/${student_id}`);
  return error ? { error: error.message } : { ok: true };
}

export async function unassignLesson(video_id: string, student_id: string) {
  const supabase = await createClient();
  await supabase.from("assignments").delete().eq("video_id", video_id).eq("student_id", student_id);
  revalidatePath(`/coach/students/${student_id}`);
}

// ---------- KIT bridge tokens ----------
export async function createBridgeToken(_: ActionState, form: FormData): Promise<ActionState> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Signed out." };
  const token = "cj_" + randomBytes(24).toString("base64url");
  const token_hash = createHash("sha256").update(token).digest("hex");
  const { error } = await supabase.from("bridge_tokens").insert({ coach_id: user.id, label: str(form, "label") || "KIT bridge", token_hash });
  if (error) return { error: error.message };
  revalidatePath("/coach/bridge");
  return { ok: true, token };
}

export async function setBridgeTarget(token_id: string, student_id: string | null) {
  const supabase = await createClient();
  // Switching student starts a fresh live session on the next shot.
  await supabase.from("bridge_tokens").update({ active_student_id: student_id, active_session_id: null }).eq("id", token_id);
  revalidatePath("/coach/bridge");
}

export async function deleteBridgeToken(token_id: string) {
  const supabase = await createClient();
  await supabase.from("bridge_tokens").delete().eq("id", token_id);
  revalidatePath("/coach/bridge");
}
