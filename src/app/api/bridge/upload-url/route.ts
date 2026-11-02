import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { authBridge } from "@/lib/bridge-auth";

/** POST /api/bridge/upload-url {student_id, ext} → a one-time signed URL the helper PUTs the clip to (bypasses Vercel's body limit). */
export async function POST(req: NextRequest) {
  const bridge = await authBridge(req);
  if (!bridge) return NextResponse.json({ error: "Unknown bridge token" }, { status: 401 });
  const body = await req.json().catch(() => ({})) as { student_id?: string; ext?: string };
  if (!body.student_id) return NextResponse.json({ error: "student_id required" }, { status: 400 });
  const ext = (body.ext || "mp4").replace(/[^a-z0-9]/gi, "").toLowerCase();
  const path = `${bridge.coach_id}/${body.student_id}/${Date.now()}-gopro.${ext}`;
  const { data, error } = await createAdminClient().storage.from("swings").createSignedUploadUrl(path);
  if (error || !data) return NextResponse.json({ error: error?.message ?? "Could not sign" }, { status: 500 });
  return NextResponse.json({ path, url: data.signedUrl, token: data.token });
}
