import { NextResponse, type NextRequest } from "next/server";
import { createHash } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/server";

/**
 * POST /api/ingest/kit
 * Called by the KIT bridge (bridge/ folder) once per shot, or in batches.
 *
 * Headers:  Authorization: Bearer <bridge token>
 * Body:     { shots: [ { club, hitAt?, clubSpeed, ballSpeed, smashFactor, launchAngle, launchDirection,
 *                        spinRate, spinAxis, faceAngle, attackAngle, clubPath, carry, total, side, apex, raw? } ] }
 *
 * Shots land in the session the coach has armed on /coach/bridge (active_student_id).
 * A new session is opened automatically per student per day.
 */
export async function POST(req: NextRequest) {
  const auth = req.headers.get("authorization") ?? "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";
  if (!token) return NextResponse.json({ error: "Missing bridge token" }, { status: 401 });

  const admin = createAdminClient();
  const token_hash = createHash("sha256").update(token).digest("hex");
  const { data: bridge } = await admin.from("bridge_tokens").select("*").eq("token_hash", token_hash).maybeSingle();
  if (!bridge) return NextResponse.json({ error: "Unknown bridge token" }, { status: 401 });

  let body: { shots?: IncomingShot[]; ping?: boolean };
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Body must be JSON" }, { status: 400 }); }

  await admin.from("bridge_tokens").update({ last_seen_at: new Date().toISOString() }).eq("id", bridge.id);
  if (body.ping) return NextResponse.json({ ok: true, armed: !!bridge.active_student_id });

  const shots = (body.shots ?? []).filter((s) => s && typeof s === "object");
  if (shots.length === 0) return NextResponse.json({ error: "No shots" }, { status: 400 });
  if (!bridge.active_student_id) return NextResponse.json({ error: "No student armed. Pick one on the KIT bridge page." }, { status: 409 });

  // Find or open today's live session for the armed student.
  const today = new Date().toISOString().slice(0, 10);
  let sessionId: string | null = bridge.active_session_id;
  if (sessionId) {
    const { data: s } = await admin.from("sessions").select("id, session_date, student_id").eq("id", sessionId).maybeSingle();
    if (!s || s.session_date !== today || s.student_id !== bridge.active_student_id) sessionId = null;
  }
  if (!sessionId) {
    const { data: s, error } = await admin.from("sessions").insert({
      student_id: bridge.active_student_id, coach_id: bridge.coach_id, session_date: today, source: "kit", title: "KIT live session",
    }).select("id").single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    sessionId = s.id;
    await admin.from("bridge_tokens").update({ active_session_id: sessionId }).eq("id", bridge.id);
  }

  const rows = shots.map((s) => ({
    session_id: sessionId, club: s.club || "Unknown", hit_at: s.hitAt ?? new Date().toISOString(),
    club_speed: n(s.clubSpeed), ball_speed: n(s.ballSpeed),
    smash_factor: n(s.smashFactor) ?? (n(s.ballSpeed) && n(s.clubSpeed) ? +(n(s.ballSpeed)! / n(s.clubSpeed)!).toFixed(2) : null),
    launch_angle: n(s.launchAngle), launch_direction: n(s.launchDirection), spin_rate: s.spinRate == null ? null : Math.round(Number(s.spinRate)),
    spin_axis: n(s.spinAxis), face_angle: n(s.faceAngle), attack_angle: n(s.attackAngle), club_path: n(s.clubPath),
    carry: n(s.carry), total: n(s.total), side: n(s.side), apex: n(s.apex), raw: s.raw ?? s,
  }));
  const { error } = await admin.from("shots").insert(rows);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, sessionId, inserted: rows.length });
}

type IncomingShot = {
  club?: string; hitAt?: string; clubSpeed?: number; ballSpeed?: number; smashFactor?: number; launchAngle?: number; launchDirection?: number;
  spinRate?: number; spinAxis?: number; faceAngle?: number; attackAngle?: number; clubPath?: number; carry?: number; total?: number; side?: number; apex?: number; raw?: unknown;
};
const n = (v: unknown) => { const x = Number(v); return v == null || !Number.isFinite(x) ? null : x; };
