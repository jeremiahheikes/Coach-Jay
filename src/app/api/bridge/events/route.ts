import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { bridgeOr401 } from "@/lib/bridge-auth";

/**
 * GET /api/bridge/events — the GoPro helper polls this. Returns the coach's unclaimed capture
 * events from the last 90 s and claims them (so a second helper won't double-fire).
 */
export async function GET(req: NextRequest) {
  const bridge = await bridgeOr401(req);
  if (bridge instanceof Response) return bridge;
  const admin = createAdminClient();
  const since = new Date(Date.now() - 90_000).toISOString();
  const { data, error } = await admin.from("capture_events").select("*").eq("coach_id", bridge.coach_id).is("claimed_at", null).gte("created_at", since).order("created_at");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const ids = (data ?? []).map((e) => e.id);
  if (ids.length) await admin.from("capture_events").update({ claimed_at: new Date().toISOString() }).in("id", ids);
  return NextResponse.json({ events: data ?? [] });
}
