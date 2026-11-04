import { createHash } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/server";

export type Bridge = { id: string; coach_id: string; active_student_id: string | null; label: string };

/** Resolves a bridge token from the Authorization header; marks it seen. */
/** Like authBridge, but turns a server misconfiguration into a JSON error response instead of a bare 500. */
export async function bridgeOr401(req: Request): Promise<Bridge | Response> {
  try {
    const b = await authBridge(req);
    return b ?? Response.json({ error: "Unknown bridge token" }, { status: 401 });
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}

export async function authBridge(req: Request): Promise<Bridge | null> {
  const auth = req.headers.get("authorization") ?? "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";
  if (!token) return null;
  const admin = createAdminClient();
  const token_hash = createHash("sha256").update(token).digest("hex");
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) throw new Error("SUPABASE_SERVICE_ROLE_KEY is not set on the server");
  const { data, error } = await admin.from("bridge_tokens").select("id, coach_id, active_student_id, label").eq("token_hash", token_hash).maybeSingle();
  if (error) throw new Error(`bridge_tokens lookup failed (${error.code ?? "no code"}) — check SUPABASE_SERVICE_ROLE_KEY on the server`);
  if (!data) return null;
  await admin.from("bridge_tokens").update({ last_seen_at: new Date().toISOString() }).eq("id", data.id);
  return data as Bridge;
}
