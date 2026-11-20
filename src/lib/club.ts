import { requireUser } from "@/lib/data";
import type { Profile, Video } from "@/lib/types";

/** The Clubhouse: community feed, Ask the Coach, chat channels. Reads go through RLS with the user's client. */

export type Author = Pick<Profile, "id" | "full_name" | "role">;

export type ClubPost = {
  id: string; kind: "post" | "question"; author_id: string; body: string;
  media_path: string | null; media_type: "image" | "video" | null;
  pinned: boolean; answered_at: string | null; created_at: string;
  author: Author | null;
  media_url: string | null;
  like_count: number; liked_by_me: boolean; comment_count: number;
};

export type ClubComment = {
  id: string; post_id: string; author_id: string; body: string; is_coach_answer: boolean; created_at: string;
  author: Author | null;
};

export type ClubChannel = { slug: string; name: string; description: string; sort: number; coach_only: boolean };

export type ClubMessage = { id: string; channel: string; author_id: string; body: string; created_at: string; author: Author | null };

const POST_SELECT = "id, kind, author_id, body, media_path, media_type, pinned, answered_at, created_at, author:profiles!club_posts_author_id_fkey(id, full_name, role), club_likes(user_id), club_comments(count)";

type RawPost = Omit<ClubPost, "author" | "media_url" | "like_count" | "liked_by_me" | "comment_count"> & {
  author: Author | Author[] | null; club_likes: { user_id: string }[]; club_comments: { count: number }[];
};

const one = <T,>(v: T | T[] | null): T | null => (Array.isArray(v) ? v[0] ?? null : v);

async function hydrate(rows: RawPost[]): Promise<ClubPost[]> {
  const { supabase, user } = await requireUser();
  const paths = rows.map((r) => r.media_path).filter((p): p is string => !!p);
  const urls = new Map<string, string>();
  if (paths.length) {
    const { data } = await supabase.storage.from("clubhouse").createSignedUrls(paths, 60 * 60);
    for (const d of data ?? []) if (d.path && d.signedUrl) urls.set(d.path, d.signedUrl);
  }
  return rows.map((r) => ({
    id: r.id, kind: r.kind, author_id: r.author_id, body: r.body, media_path: r.media_path, media_type: r.media_type,
    pinned: r.pinned, answered_at: r.answered_at, created_at: r.created_at,
    author: one(r.author),
    media_url: r.media_path ? urls.get(r.media_path) ?? null : null,
    like_count: r.club_likes?.length ?? 0,
    liked_by_me: (r.club_likes ?? []).some((l) => l.user_id === user.id),
    comment_count: r.club_comments?.[0]?.count ?? 0,
  }));
}

export async function listPosts(kind: "post" | "question", limit = 40): Promise<ClubPost[]> {
  const { supabase } = await requireUser();
  const { data } = await supabase.from("club_posts").select(POST_SELECT).eq("kind", kind)
    .order("pinned", { ascending: false }).order("created_at", { ascending: false }).limit(limit);
  return hydrate((data ?? []) as unknown as RawPost[]);
}

export async function getPost(id: string): Promise<{ post: ClubPost; comments: ClubComment[] } | null> {
  const { supabase } = await requireUser();
  const [{ data: p }, { data: c }] = await Promise.all([
    supabase.from("club_posts").select(POST_SELECT).eq("id", id).maybeSingle(),
    supabase.from("club_comments").select("*, author:profiles!club_comments_author_id_fkey(id, full_name, role)").eq("post_id", id).order("created_at"),
  ]);
  if (!p) return null;
  const [post] = await hydrate([p as unknown as RawPost]);
  const comments = ((c ?? []) as (Omit<ClubComment, "author"> & { author: Author | Author[] | null })[]).map((x) => ({ ...x, author: one(x.author) }));
  // Coach answers first, then the conversation in order.
  comments.sort((a, b) => Number(b.is_coach_answer) - Number(a.is_coach_answer) || a.created_at.localeCompare(b.created_at));
  return { post: post!, comments };
}

export async function listChannels(): Promise<ClubChannel[]> {
  const { supabase } = await requireUser();
  const { data } = await supabase.from("club_channels").select("*").order("sort");
  return (data ?? []) as ClubChannel[];
}

export async function listMessages(channel: string, limit = 100): Promise<ClubMessage[]> {
  const { supabase } = await requireUser();
  const { data } = await supabase.from("club_messages")
    .select("*, author:profiles!club_messages_author_id_fkey(id, full_name, role)")
    .eq("channel", channel).order("created_at", { ascending: false }).limit(limit);
  return ((data ?? []) as (Omit<ClubMessage, "author"> & { author: Author | Author[] | null })[])
    .map((m) => ({ ...m, author: one(m.author) })).reverse();
}

export async function listFreeTips(): Promise<Video[]> {
  const { supabase } = await requireUser();
  const { data } = await supabase.from("videos").select("*").eq("kind", "lesson").eq("is_free", true).order("created_at", { ascending: false });
  return (data ?? []) as Video[];
}

/** What the "Getting started" checklist on the Welcome hub needs to know. */
export async function getStartedStatus() {
  const { supabase, user, profile } = await requireUser();
  const [{ count: posts }, { count: msgs }, { data: req }] = await Promise.all([
    supabase.from("club_posts").select("id", { count: "exact", head: true }).eq("author_id", user.id),
    supabase.from("club_messages").select("id", { count: "exact", head: true }).eq("author_id", user.id),
    supabase.from("lesson_requests").select("id, created_at").eq("user_id", user.id).order("created_at", { ascending: false }).limit(1).maybeSingle(),
  ]);
  return {
    agreed: !!profile.agreed_rules_at,
    profileDone: !!(profile.about?.trim() || profile.home_course?.trim()),
    introduced: (posts ?? 0) + (msgs ?? 0) > 0,
    requestedAt: (req?.created_at as string | undefined) ?? null,
  };
}

/** "3m", "2h", "Mon", "Oct 4" */
export function ago(iso: string) {
  const s = (Date.now() - new Date(iso).getTime()) / 1000;
  if (s < 60) return "now";
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  if (s < 6 * 86400) return new Date(iso).toLocaleDateString("en-US", { weekday: "short" });
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}
