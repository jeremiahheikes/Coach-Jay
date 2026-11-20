import { requireUser } from "@/lib/data";
import { listPosts } from "@/lib/club";
import { Composer } from "@/components/club/Composer";
import { PostCard } from "@/components/club/PostCard";

export default async function AskPage() {
  const { user, profile } = await requireUser();
  const isCoach = profile.role === "coach";
  const questions = await listPosts("question", 60);
  const waiting = questions.filter((q) => !q.answered_at);
  return (
    <>
      <p className="text-sm text-ink2 m-0">
        {isCoach
          ? `${waiting.length} question${waiting.length === 1 ? "" : "s"} waiting on you. Answers are public, so everyone learns from them.`
          : "Ask Coach Jay anything about your swing, your numbers or your game. Attach a clip for swing questions — down-the-line or face-on works best. Answers are public so the whole Clubhouse learns."}
      </p>
      {!isCoach && !profile.banned_at && <Composer uid={user.id} kind="question" placeholder="e.g. My driver keeps starting right and curving more right. Clip attached — what should I check first?" />}
      {questions.length === 0 && <div className="card text-sm text-ink2">No questions yet.</div>}
      <div className="flex flex-col gap-3">
        {(isCoach ? [...waiting, ...questions.filter((q) => q.answered_at)] : questions).map((q) => <PostCard key={q.id} post={q} uid={user.id} isCoach={isCoach} back="/community/ask" />)}
      </div>
    </>
  );
}
