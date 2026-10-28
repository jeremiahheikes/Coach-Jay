import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient, createClient } from "@/lib/supabase/server";

/**
 * GET /api/video?id=<video id>
 * Returns a short-lived signed URL for a video the signed-in user is allowed to see.
 * RLS on the videos table decides "allowed". The coach's own client can sign URLs
 * under their storage folder; for students (no storage policy) the service role signs.
 */
export async function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
  const supabase = await createClient();
  const { data: video, error: vErr } = await supabase.from("videos").select("kind, storage_path").eq("id", id).maybeSingle();
  if (vErr) return NextResponse.json({ error: `Lookup failed: ${vErr.message}` }, { status: 500 });
  if (!video) return NextResponse.json({ error: "Video not found (or not yours to view)." }, { status: 404 });
  const bucket = video.kind === "swing" ? "swings" : "lessons";
  const ttl = 60 * 60;

  // 1. Try with the signed-in user's own rights (works for the coach's own uploads).
  const own = await supabase.storage.from(bucket).createSignedUrl(video.storage_path, ttl);
  if (own.data?.signedUrl) return NextResponse.json({ url: own.data.signedUrl });

  // 2. Fall back to the service role (needed for students).
  let adminMsg = "";
  try {
    const admin = await createAdminClient().storage.from(bucket).createSignedUrl(video.storage_path, ttl);
    if (admin.data?.signedUrl) return NextResponse.json({ url: admin.data.signedUrl });
    adminMsg = admin.error?.message ?? "no url";
  } catch (e) { adminMsg = (e as Error).message; }

  return NextResponse.json({ error: `Could not sign ${bucket}/${video.storage_path}: ${own.error?.message ?? "no url"}; service role: ${adminMsg}` }, { status: 500 });
}
