import { notFound } from "next/navigation";
import Link from "next/link";
import { requireUser } from "@/lib/data";
import { getPost } from "@/lib/club";
import { AuthorLine, PostCard } from "@/components/club/PostCard";
import { CommentForm, CommentMenu } from "@/components/club/PostBits";

export default async function PostPage(props: PageProps<"/community/post/[id]">) {
  const { id } = await props.params;
  const { user, profile } = await requireUser();
  const isCoach = profile.role === "coach";
  const found = await getPost(id);
  if (!found) notFound();
  const { post, comments } = found;
  const back = post.kind === "question" ? "/community/ask" : "/community";
  return (
    <>
      <Link href={back} className="text-sm text-accent font-semibold">← {post.kind === "question" ? "All questions" : "Back to the feed"}</Link>
      <PostCard post={post} uid={user.id} isCoach={isCoach} full back={back} />
      <section className="flex flex-col gap-2.5">
        <h3 className="text-lg font-semibold">{comments.length === 0 ? "No replies yet" : `${comments.length} ${comments.length === 1 ? "reply" : "replies"}`}</h3>
        {comments.map((c) => (
          <div key={c.id} className={`card flex flex-col gap-2 ${c.is_coach_answer ? "border-accent bg-accent-soft" : ""}`}>
            <div className="flex items-start gap-2">
              <AuthorLine author={c.author} at={c.created_at} />
              {c.is_coach_answer && <span className="chip chip-accent">Coach&apos;s answer</span>}
            </div>
            <p className="m-0 text-sm whitespace-pre-wrap">{c.body}</p>
            <div className="self-end"><CommentMenu id={c.id} postId={post.id} canDelete={c.author_id === user.id || isCoach} /></div>
          </div>
        ))}
        {!profile.banned_at && <CommentForm postId={post.id} canAnswer={isCoach} isQuestion={post.kind === "question"} />}
      </section>
    </>
  );
}
