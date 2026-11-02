import { createHash } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/server";

export type Bridge = { id: string; coach_id: string; active_student_id: string | null; label: string };

/** Resolves a bridge token from the Authorization header; marks it seen. */
export async function authBridge(req: Request): Promise<Bridge | null> {
  const auth = req.headers.get("authorization") ?? "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";
  if (!token) return null;
  const admin = createAdminClient();
  const token_hash = createHash("sha256").update(token).digest("hex");
  const { data } = await admin.from("bridge_tokens").select("id, coach_id, active_student_id, label").eq("token_hash", token_hash).maybeSingle();
  if (!data) return null;
  await admin.from("bridge_tokens").update({ last_seen_at: new Date().toISOString() }).eq("id", data.id);
  return data as Bridge;
}
