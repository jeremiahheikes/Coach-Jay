import Link from "next/link";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/data";
import { ago } from "@/lib/club";
import { BanButton, HandledButton, ResolveButton } from "@/components/club/ModBits";
import type { Profile } from "@/lib/types";

type Report = {
  id: string; reason: string; created_at: string; post_id: string | null; comment_id: string | null; message_id: string | null;
  reporter: { full_name: string } | null;
  post: { id: string; body: string; author_id: string } | null;
  comment: { post_id: string; body: string; author_id: string } | null;
  message: { channel: string; body: string; author_id: string } | null;
};
type Request = { id: string; phone: string; message: string; created_at: string; handled_at: string | null; user: { full_name: string; about: string; home_course: string } | null };

export default async function ModPage() {
  const { supabase, profile } = await requireUser();
  if (profile.role !== "coach") redirect("/community");
  const [{ data: reports }, { data: requests }, { data: members }] = await Promise.all([
    supabase.from("club_reports").select("id, reason, created_at, post_id, comment_id, message_id, reporter:profiles!club_reports_reporter_id_fkey(full_name), post:club_posts(id, body, author_id), comment:club_comments(post_id, body, author_id), message:club_messages(channel, body, author_id)").is("resolved_at", null).order("created_at", { ascending: false }),
    supabase.from("lesson_requests").select("id, phone, message, created_at, handled_at, user:profiles!lesson_requests_user_id_fkey(full_name, about, home_course)").order("created_at", { ascending: false }).limit(50),
    supabase.from("profiles").select("id, full_name, role, home_course, agreed_rules_at, banned_at, created_at").neq("role", "coach").order("created_at", { ascending: false }).limit(100),
  ]);
  const open = (requests ?? []) as unknown as Request[];
  const pending = open.filter((r) => !r.handled_at);
  const list = (reports ?? []) as unknown as Report[];
  const people = (members ?? []) as Profile[];

  return (
    <>
      <section className="flex flex-col gap-2">
        <h3 className="text-lg font-semibold">Lesson requests <span className="chip">{pending.length} new</span></h3>
        {open.length === 0 && <p className="text-sm text-ink3 m-0">No requests yet. They come from the Welcome page.</p>}
        {open.map((r) => (
          <div key={r.id} className={`card flex flex-col gap-1.5 ${r.handled_at ? "opacity-60" : ""}`}>
            <div className="flex items-center gap-2 flex-wrap">
              <b>{r.user?.full_name ?? "Member"}</b>
              <a className="text-accent font-semibold text-sm" href={`tel:${r.phone}`}>{r.phone}</a>
              <span className="text-xs text-ink3">{ago(r.created_at)}</span>
              <span className="flex-1" />
              {!r.handled_at ? <HandledButton id={r.id} /> : <span className="chip chip-good">Handled</span>}
            </div>
            {r.message && <p className="m-0 text-sm">{r.message}</p>}
            {(r.user?.about || r.user?.home_course) && <p className="m-0 text-xs text-ink3">{[r.user?.home_course, r.user?.about].filter(Boolean).join(" · ")}</p>}
          </div>
        ))}
      </section>

      <section className="flex flex-col gap-2">
        <h3 className="text-lg font-semibold">Reports <span className="chip">{list.length} open</span></h3>
        {list.length === 0 && <p className="text-sm text-ink3 m-0">Nothing flagged. </p>}
        {list.map((r) => {
          const body = r.post?.body ?? r.comment?.body ?? r.message?.body ?? "(already deleted)";
          const href = r.post ? `/community/post/${r.post.id}` : r.comment ? `/community/post/${r.comment.post_id}` : r.message ? `/community/chat?c=${r.message.channel}` : null;
          const authorId = r.post?.author_id ?? r.comment?.author_id ?? r.message?.author_id;
          const author = people.find((p) => p.id === authorId);
          return (
            <div key={r.id} className="card flex flex-col gap-2">
              <div className="text-xs text-ink3">{r.post ? "Post" : r.comment ? "Reply" : "Chat message"} by <b className="text-ink2">{author?.full_name ?? "member"}</b> · reported by {r.reporter?.full_name ?? "member"} · {ago(r.created_at)}</div>
              <p className="m-0 text-sm line-clamp-4 whitespace-pre-wrap">{body}</p>
              <div className="flex gap-2 flex-wrap">
                {href && <Link className="btn btn-sm" href={href}>Open</Link>}
                <ResolveButton id={r.id} />
                {author && <BanButton member={author.id} banned={!!author.banned_at} />}
              </div>
            </div>
          );
        })}
      </section>

      <section className="flex flex-col gap-2">
        <h3 className="text-lg font-semibold">Members <span className="chip">{people.length}</span></h3>
        <div className="card !p-0 overflow-x-auto">
          <table className="data">
            <thead><tr><th>Name</th><th>Joined</th><th>Home course</th><th></th></tr></thead>
            <tbody>
              {people.map((p) => (
                <tr key={p.id}>
                  <td>{p.full_name}{!p.agreed_rules_at && <span className="chip ml-1.5">Not in yet</span>}{p.banned_at && <span className="chip chip-bad ml-1.5">Paused</span>}</td>
                  <td className="text-ink3">{p.created_at ? ago(p.created_at) : ""}</td>
                  <td className="text-ink2">{p.home_course}</td>
                  <td className="r"><BanButton member={p.id} banned={!!p.banned_at} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
