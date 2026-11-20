import { requireUser } from "@/lib/data";
import { listPosts } from "@/lib/club";
import { Composer } from "@/components/club/Composer";
import { PostCard } from "@/components/club/PostCard";

export default async function FeedPage() {
  const { user, profile } = await requireUser();
  const isCoach = profile.role === "coach";
  const posts = await listPosts("post");
  return (
    <>
      {!profile.banned_at && <Composer uid={user.id} kind="post" placeholder={isCoach ? "Post an update, a drill or a tip for the Clubhouse…" : "What are you working on? Share a range win, a swing clip or a question for the group…"} />}
      {posts.length === 0 && (
        <div className="card text-sm text-ink2">
          <b className="block text-ink">Nothing here yet.</b>
          {isCoach ? "Kick it off: post a welcome and a drill of the week, then pin it." : "Be the first — introduce yourself: handicap, home course, and the one thing you'd fix in your game."}
        </div>
      )}
      <div className="flex flex-col gap-3">{posts.map((p) => <PostCard key={p.id} post={p} uid={user.id} isCoach={isCoach} back="/community" />)}</div>
    </>
  );
}
