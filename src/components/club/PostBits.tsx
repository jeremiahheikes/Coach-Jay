"use client";
import { useOptimistic, useRef, useState, useTransition, useActionState } from "react";
import { addComment, deleteComment, deletePost, report, toggleLike, togglePin, type ClubState } from "@/app/(club)/community/actions";

export function LikeButton({ postId, liked, count }: { postId: string; liked: boolean; count: number }) {
  const [state, setState] = useOptimistic({ liked, count });
  const [, start] = useTransition();
  return (
    <button
      type="button"
      aria-pressed={state.liked}
      onClick={() => start(async () => { setState({ liked: !state.liked, count: state.count + (state.liked ? -1 : 1) }); await toggleLike(postId, state.liked); })}
      className={`chip ${state.liked ? "chip-accent" : ""}`}
    >
      {state.liked ? "♥" : "♡"} {state.count > 0 ? state.count : "Like"}
    </button>
  );
}

/** Report for everyone; delete for the author or coach; pin for the coach. */
export function PostMenu({ postId, canDelete, isCoach, pinned, back }: { postId: string; canDelete: boolean; isCoach: boolean; pinned: boolean; back: string }) {
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, start] = useTransition();
  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      {isCoach && <button type="button" className="chip" disabled={pending} onClick={() => start(() => togglePin(postId, !pinned))}>{pinned ? "Unpin" : "📌 Pin"}</button>}
      {canDelete && (
        <button type="button" className="chip" disabled={pending} onClick={() => { if (confirm("Delete this post?")) start(() => deletePost(postId, back)); }}>Delete</button>
      )}
      {!canDelete && !msg && (
        <button type="button" className="chip" disabled={pending} onClick={() => start(async () => { const r = await report({ post_id: postId }); setMsg(r.error ?? "Reported — thanks."); })}>Report</button>
      )}
      {msg && <span className="text-xs text-ink3">{msg}</span>}
    </div>
  );
}

export function CommentMenu({ id, postId, canDelete }: { id: string; postId: string; canDelete: boolean }) {
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, start] = useTransition();
  if (msg) return <span className="text-xs text-ink3">{msg}</span>;
  return canDelete
    ? <button type="button" className="text-xs text-ink3 hover:text-bad" disabled={pending} onClick={() => { if (confirm("Delete this reply?")) start(() => deleteComment(id, postId)); }}>Delete</button>
    : <button type="button" className="text-xs text-ink3 hover:text-ink" disabled={pending} onClick={() => start(async () => { const r = await report({ comment_id: id }); setMsg(r.error ?? "Reported"); })}>Report</button>;
}

export function CommentForm({ postId, canAnswer, isQuestion }: { postId: string; canAnswer: boolean; isQuestion: boolean }) {
  const formRef = useRef<HTMLFormElement>(null);
  const [state, action, pending] = useActionState<ClubState, FormData>(async (prev, form) => {
    const r = await addComment(prev, form);
    if (r.ok) formRef.current?.reset();
    return r;
  }, {});
  return (
    <form ref={formRef} action={action} className="card flex flex-col gap-2.5">
      <input type="hidden" name="post_id" value={postId} />
      <textarea name="body" className="input min-h-[70px]" placeholder={isQuestion && canAnswer ? "Answer this question…" : "Write a reply…"} maxLength={2000} required />
      <div className="flex items-center gap-3">
        {canAnswer && isQuestion && (
          <label className="flex items-center gap-2 text-sm text-ink2"><input type="checkbox" name="as_answer" defaultChecked /> Mark as Coach&apos;s answer</label>
        )}
        <span className="flex-1" />
        <button className="btn btn-sm btn-primary" disabled={pending}>{pending ? "Sending…" : "Reply"}</button>
      </div>
      {state.error && <p role="alert" className="text-sm text-bad m-0">{state.error}</p>}
    </form>
  );
}
