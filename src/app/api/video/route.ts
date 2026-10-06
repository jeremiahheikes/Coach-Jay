import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient, createClient } from "@/lib/supabase/server";

/**
 * GET /api/video?id=<video id>
 * Returns a short-lived signed URL for a video the signed-in user is allowed to see.
 * RLS on the videos table decides "allowed"; the service role only mints the URL.
 */
export async function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
  const supabase = await createClient();
  const { data: video } = await supabase.from("videos").select("kind, storage_path").eq("id", id).maybeSingle();
  if (!video) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const bucket = video.kind === "swing" ? "swings" : "lessons";
  const { data, error } = await createAdminClient().storage.from(bucket).createSignedUrl(video.storage_path, 60 * 60);
  if (error || !data) return NextResponse.json({ error: error?.message ?? "Could not sign" }, { status: 500 });
  return NextResponse.json({ url: data.signedUrl });
}
