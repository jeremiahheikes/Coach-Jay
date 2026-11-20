"use server";
import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

export type ClubState = { error?: string; ok?: boolean };

const str = (f: FormData, k: string) => String(f.get(k) ?? "").trim();

async function me() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const uid = data?.claims?.sub as string | undefined;
  return { supabase, uid };
}

const friendly = (msg: string) =>
  /row-level security|violates/i.test(msg) ? "You can't post right now. If you think that's a mistake, ask Coach Jay." : msg;

// ---------- Rules / profile ----------
export async function agreeToRules(form: FormData) {
  const { supabase, uid } = await me();
  if (!uid) redirect("/login");
  if (form.get("adult") !== "on" || form.get("rules") !== "on") return;
  await supabase.from("profiles").update({ agreed_rules_at: new Date().toISOString() }).eq("id", uid);
  revalidatePath("/", "layout");
}

export async function updateClubProfile(_: ClubState, form: FormData): Promise<ClubState> {
  const { supabase, uid } = await me();
  if (!uid) return { error: "Signed out." };
  const full_name = str(form, "full_name");
  if (!full_name) return { error: "Enter your name." };
  const { error } = await supabase.from("profiles").update({
    full_name: full_name.slice(0, 80), about: str(form, "about").slice(0, 500), home_course: str(form, "home_course").slice(0, 80),
  }).eq("id", uid);
  if (error) return { error: error.message };
  revalidatePath("/", "layout");
  return { ok: true };
}

// ---------- Posts & questions ----------
export async function createPost(input: { kind: "post" | "question"; body: string; media_path?: string | null; media_type?: "image" | "video" | null }): Promise<ClubState> {
  const { supabase, uid } = await me();
  if (!uid) return { error: "Signed out." };
  const body = input.body.trim();
  if (!body) return { error: input.kind === "question" ? "Type your question." : "Write something first." };
  if (body.length > 4000) return { error: "That's a bit long — keep it under 4,000 characters." };
  if (input.media_path && !input.media_path.startsWith(`${uid}/`)) return { error: "Upload problem — try attaching again." };
  const { error } = await supabase.from("club_posts").insert({
    kind: input.kind, author_id: uid, body,
    media_path: input.media_path || null, media_type: input.media_path ? input.media_type ?? null : null,
  });
  if (error) return { error: friendly(error.message) };
  revalidatePath("/community", "layout");
  revalidatePath("/welcome");
  return { ok: true };
}

export async function deletePost(id: string, back: string) {
  const { supabase } = await me();
  const { data: post } = await supabase.from("club_posts").select("media_path").eq("id", id).maybeSingle();
  const { error } = await supabase.from("club_posts").delete().eq("id", id);
  if (!error && post?.media_path) await supabase.storage.from("clubhouse").remove([post.media_path]);
  revalidatePath("/community", "layout");
  redirect(back);
}

export async function togglePin(id: string, pinned: boolean) {
  const { supabase } = await me();
  await supabase.from("club_posts").update({ pinned }).eq("id", id);
  revalidatePath("/community", "layout");
}

export async function toggleLike(post_id: string, liked: boolean) {
  const { supabase, uid } = await me();
  if (!uid) return;
  if (liked) await supabase.from("club_likes").delete().eq("post_id", post_id).eq("user_id", uid);
  else await supabase.from("club_likes").insert({ post_id, user_id: uid });
  revalidatePath("/community", "layout");
}

export async function addComment(_: ClubState, form: FormData): Promise<ClubState> {
  const { supabase, uid } = await me();
  if (!uid) return { error: "Signed out." };
  const post_id = str(form, "post_id"), body = str(form, "body");
  if (!body) return { error: "Write a reply first." };
  const { error } = await supabase.from("club_comments").insert({
    post_id, author_id: uid, body: body.slice(0, 2000), is_coach_answer: form.get("as_answer") === "on",
  });
  if (error) return { error: friendly(error.message) };
  revalidatePath(`/community/post/${post_id}`);
  revalidatePath("/community", "layout");
  return { ok: true };
}

export async function deleteComment(id: string, post_id: string) {
  const { supabase } = await me();
  await supabase.from("club_comments").delete().eq("id", id);
  revalidatePath(`/community/post/${post_id}`);
}

// ---------- Chat ----------
export async function sendMessage(channel: string, body: string): Promise<ClubState & { id?: string }> {
  const { supabase, uid } = await me();
  if (!uid) return { error: "Signed out." };
  const text = body.trim();
  if (!text) return {};
  if (text.length > 1000) return { error: "Keep chat messages under 1,000 characters." };
  const { data, error } = await supabase.from("club_messages").insert({ channel, author_id: uid, body: text }).select("id").single();
  if (error) return { error: friendly(error.message) };
  return { ok: true, id: data.id as string };
}

export async function deleteMessage(id: string) {
  const { supabase } = await me();
  await supabase.from("club_messages").delete().eq("id", id);
}

// ---------- Reports & moderation ----------
export async function report(target: { post_id?: string; comment_id?: string; message_id?: string }, reason = ""): Promise<ClubState> {
  const { supabase, uid } = await me();
  if (!uid) return { error: "Signed out." };
  const { error } = await supabase.from("club_reports").insert({ reporter_id: uid, ...target, reason: reason.slice(0, 500) });
  if (error) return { error: error.message };
  return { ok: true };
}

export async function resolveReport(id: string) {
  const { supabase } = await me();
  await supabase.from("club_reports").update({ resolved_at: new Date().toISOString() }).eq("id", id);
  revalidatePath("/community/mod");
}

export async function setBan(member: string, banned: boolean) {
  const { supabase } = await me();
  await supabase.rpc("set_member_ban", { member, banned });
  revalidatePath("/community/mod");
}

// ---------- Lesson requests ----------
export async function requestLesson(_: ClubState, form: FormData): Promise<ClubState> {
  const { supabase, uid } = await me();
  if (!uid) return { error: "Signed out." };
  const phone = str(form, "phone"), message = str(form, "message");
  if (!phone) return { error: "Add a phone number so Coach Jay can reach you." };
  const { error } = await supabase.from("lesson_requests").insert({ user_id: uid, phone: phone.slice(0, 40), message: message.slice(0, 1000) });
  if (error) return { error: error.message };
  revalidatePath("/welcome");
  revalidatePath("/community/mod");
  return { ok: true };
}

export async function markRequestHandled(id: string) {
  const { supabase } = await me();
  await supabase.from("lesson_requests").update({ handled_at: new Date().toISOString() }).eq("id", id);
  revalidatePath("/community/mod");
}

// ---------- Free tips (coach) ----------
export async function setFreeTip(video_id: string, is_free: boolean) {
  const { supabase } = await me();
  await supabase.from("videos").update({ is_free }).eq("id", video_id);
  revalidatePath("/coach/library");
  revalidatePath("/welcome");
}
