import Link from "next/link";
import { ago, type Author, type ClubPost } from "@/lib/club";
import { initials } from "@/lib/types";
import { LikeButton, PostMenu } from "./PostBits";

export function AuthorLine({ author, at, extra }: { author: Author | null; at: string; extra?: React.ReactNode }) {
  const name = author?.full_name || "Member";
  return (
    <div className="flex items-center gap-2.5 min-w-0">
      <span className={`avatar !w-9 !h-9 !text-sm ${author?.role === "coach" ? "!bg-accent !text-accent-ink" : ""}`}>{initials(name) || "?"}</span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5 min-w-0">
          <b className="font-semibold text-sm truncate">{name}</b>
          {author?.role === "coach" && <span className="chip chip-accent !py-0 !text-[11px]">Coach</span>}
        </div>
        <div className="text-xs text-ink3">{ago(at)}{extra}</div>
      </div>
    </div>
  );
}

export function Media({ post }: { post: ClubPost }) {
  if (!post.media_url) return null;
  return post.media_type === "video"
    ? <video src={post.media_url} controls playsInline preload="metadata" className="w-full max-h-[480px] rounded-lg bg-black" />
    // eslint-disable-next-line @next/next/no-img-element
    : <img src={post.media_url} alt="" loading="lazy" className="w-full max-h-[480px] object-contain rounded-lg bg-surface2" />;
}

/** One post in the feed or Ask the Coach list. `full` = on its own page (no "view replies" link, full body). */
export function PostCard({ post, uid, isCoach, full = false, back }: { post: ClubPost; uid: string; isCoach: boolean; full?: boolean; back: string }) {
  const href = `/community/post/${post.id}`;
  const isQ = post.kind === "question";
  return (
    <article className={`card flex flex-col gap-3 ${post.pinned ? "border-accent" : ""}`}>
      <div className="flex items-start gap-2">
        <AuthorLine author={post.author} at={post.created_at} />
        {post.pinned && <span className="chip chip-accent">📌 Pinned</span>}
        {isQ && (post.answered_at ? <span className="chip chip-good">✓ Answered</span> : <span className="chip chip-warn">Waiting on Coach</span>)}
      </div>
      {full
        ? <p className="m-0 whitespace-pre-wrap">{post.body}</p>
        : <Link href={href} className="m-0 whitespace-pre-wrap line-clamp-6 hover:text-ink2">{post.body}</Link>}
      <Media post={post} />
      <div className="flex items-center gap-2 flex-wrap">
        <LikeButton postId={post.id} liked={post.liked_by_me} count={post.like_count} />
        {!full && <Link href={href} className="chip">💬 {post.comment_count > 0 ? `${post.comment_count} ${post.comment_count === 1 ? "reply" : "replies"}` : isQ ? "View" : "Reply"}</Link>}
        <span className="flex-1" />
        <PostMenu postId={post.id} canDelete={post.author_id === uid || isCoach} isCoach={isCoach} pinned={post.pinned} back={back} />
      </div>
    </article>
  );
}
