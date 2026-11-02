import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { authBridge } from "@/lib/bridge-auth";

/** POST /api/bridge/clip-done — registers an uploaded clip against the event's swing and closes the event. */
export async function POST(req: NextRequest) {
  const bridge = await authBridge(req);
  if (!bridge) return NextResponse.json({ error: "Unknown bridge token" }, { status: 401 });
  const b = await req.json().catch(() => ({})) as { event_id?: string; path?: string; error?: string };
  const admin = createAdminClient();
  if (!b.event_id) return NextResponse.json({ error: "event_id required" }, { status: 400 });
  const { data: ev } = await admin.from("capture_events").select("*").eq("id", b.event_id).eq("coach_id", bridge.coach_id).maybeSingle();
  if (!ev) return NextResponse.json({ error: "Unknown event" }, { status: 404 });
  if (b.error || !b.path) {
    await admin.from("capture_events").update({ done_at: new Date().toISOString(), error: b.error ?? "no file" }).eq("id", ev.id);
    return NextResponse.json({ ok: true, recorded_error: true });
  }
  const { error } = await admin.from("videos").insert({
    kind: "swing", coach_id: bridge.coach_id, student_id: ev.student_id, session_id: ev.session_id, swing_id: ev.swing_id,
    angle: ev.angle_needed, storage_path: b.path, title: `${ev.club || "Swing"} · ${ev.angle_needed}`, recorded_on: new Date().toISOString().slice(0, 10),
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  await admin.from("capture_events").update({ done_at: new Date().toISOString() }).eq("id", ev.id);
  return NextResponse.json({ ok: true });
}
