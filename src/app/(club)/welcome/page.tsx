import Link from "next/link";
import { getMyStudentRow, requireUser } from "@/lib/data";
import { getStartedStatus, listFreeTips, listPosts, ago } from "@/lib/club";
import { VideoGrid } from "@/components/Video";
import { RequestLessonForm } from "@/components/club/Forms";
import { fmtDate } from "@/lib/types";

/** The front door: who Coach Jay is, how the app works, free tips, the Clubhouse, and a way to book. */
export default async function WelcomePage() {
  const { profile } = await requireUser();
  const isCoach = profile.role === "coach";
  const [me, status, tips, posts] = await Promise.all([getMyStudentRow(), getStartedStatus(), listFreeTips(), listPosts("post", 3)]);
  const isStudent = !!me;
  const first = profile.full_name.split(" ")[0] || "golfer";

  const steps = [
    { done: status.agreed, label: "Step into the Clubhouse", sub: "Accept the house rules and look around.", href: "/community" },
    { done: status.profileDone, label: "Set up your profile", sub: "Home course and a line about your game.", href: "/community/profile" },
    { done: status.introduced, label: "Introduce yourself", sub: "Say hi in #introductions — handicap, home course, one thing you'd fix.", href: "/community/chat?c=introductions" },
    isStudent
      ? { done: true, label: "You're on Coach Jay's roster", sub: "Your lessons, numbers and swings are under Home.", href: "/student" }
      : { done: !!status.requestedAt, label: "Book your first lesson", sub: status.requestedAt ? `Requested ${fmtDate(status.requestedAt)} — Coach Jay will be in touch.` : "Your first session sets a baseline: numbers, video and a plan.", href: "#book" },
  ];
  const doneCount = steps.filter((s) => s.done).length;

  return (
    <>
      {isCoach && (
        <div className="card text-sm text-ink2 border-accent">
          <b className="text-ink">Coach preview.</b> This is the first page new members see. Mark lessons as a <i>free tip</i> in{" "}
          <Link href="/coach/library" className="text-accent font-semibold">Video lessons</Link> to show them here.
        </div>
      )}

      <header className="rounded-xl bg-accent text-accent-ink p-5 md:p-6 flex flex-col gap-2">
        <span className="eyebrow !text-accent-ink opacity-80">Coach Jay · Back Nine Golf, North Arlington</span>
        <h1 className="text-3xl md:text-4xl font-bold">Welcome, {first}.</h1>
        <p className="m-0 opacity-90 max-w-xl">
          This is home base for golfers working with Coach Jay — a community to talk shop and find a game, free tips to start on today,
          and, when you&apos;re ready, lessons where every swing and number is saved so you can see yourself improve.
        </p>
        <div className="flex gap-2 flex-wrap mt-1">
          <Link href="/community" className="btn !bg-accent-ink !text-accent !border-transparent">Enter the Clubhouse →</Link>
          {!isStudent && !isCoach && <a href="#book" className="btn !bg-transparent !text-accent-ink !border-accent-ink/40">Book a lesson</a>}
        </div>
      </header>

      {!isCoach && (
        <section className="card flex flex-col gap-3">
          <div className="flex items-baseline justify-between gap-2">
            <h2 className="text-xl font-bold">Getting started</h2>
            <span className="chip num">{doneCount} of {steps.length}</span>
          </div>
          <div className="h-1.5 rounded-full bg-surface2 overflow-hidden"><div className="h-full bg-accent" style={{ width: `${(doneCount / steps.length) * 100}%` }} /></div>
          <ol className="m-0 p-0 list-none flex flex-col">
            {steps.map((s) => (
              <li key={s.label}>
                <Link href={s.href} className="flex items-start gap-3 py-2.5 border-b border-line last:border-0 hover:bg-surface2 -mx-2 px-2 rounded-lg">
                  <span className={`w-6 h-6 rounded-full grid place-items-center text-xs font-bold shrink-0 mt-0.5 ${s.done ? "bg-good text-white" : "border-2 border-line text-ink3"}`}>{s.done ? "✓" : ""}</span>
                  <span className="flex-1 min-w-0">
                    <b className={`block font-semibold text-sm ${s.done ? "text-ink3 line-through" : ""}`}>{s.label}</b>
                    <span className="block text-xs text-ink3">{s.sub}</span>
                  </span>
                  {!s.done && <span className="text-accent text-sm font-semibold">→</span>}
                </Link>
              </li>
            ))}
          </ol>
        </section>
      )}

      <section className="card flex flex-col md:flex-row gap-4">
        <div className="w-16 h-16 rounded-xl bg-accent text-accent-ink grid place-items-center font-display font-bold text-3xl shrink-0">J</div>
        <div className="flex flex-col gap-2">
          <div className="eyebrow">Meet your coach</div>
          <h2 className="text-xl font-bold">Coach Jay — Jeremiah Heikes</h2>
          <p className="m-0 text-sm text-ink2">
            PGA of America Associate (in program), teaching at Back Nine Golf in North Arlington. Coach Jay coaches with modern tools —
            launch monitor data and slow-motion video — and specializes in working adults who want real improvement without overhauling
            their whole swing. He finds the inconsistency, makes the smallest change that fixes it, and still grinds his own game.
          </p>
          <p className="m-0 text-sm text-ink2">
            <b className="text-ink">Your first lesson</b> is mostly about getting to know your swing: your numbers, video from two angles,
            and a plan — plus a fix or two you can feel that day.
          </p>
        </div>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-xl font-bold">How the app works</h2>
        <div className="grid gap-2.5" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))" }}>
          <Link href="/community" className="card hover:border-accent flex flex-col gap-1">
            <span className="chip chip-accent self-start">Free</span>
            <b className="font-display text-lg">The Clubhouse</b>
            <span className="text-sm text-ink2">Post range wins and swing clips, chat by topic, and find a foursome.</span>
          </Link>
          <Link href="/community/ask" className="card hover:border-accent flex flex-col gap-1">
            <span className="chip chip-accent self-start">Free</span>
            <b className="font-display text-lg">Ask the Coach</b>
            <span className="text-sm text-ink2">Ask Coach Jay a question, with a clip if you have one. Answers are public, so everyone learns.</span>
          </Link>
          <div className="card flex flex-col gap-1">
            <span className="chip self-start">With lessons</span>
            <b className="font-display text-lg">Your progress, saved</b>
            <span className="text-sm text-ink2">Every lesson&apos;s numbers and slow-mo swings, Coach&apos;s notes, carry trends and homework videos — on your phone.</span>
          </div>
        </div>
      </section>

      <section id="tips" className="flex flex-col gap-2">
        <h2 className="text-xl font-bold">Free tips</h2>
        <VideoGrid videos={tips} emptyText={isCoach ? "No free tips yet — mark a lesson as free in Video lessons." : "Coach Jay's first free tips are on the way. Check back soon."} />
      </section>

      <section className="flex flex-col gap-2">
        <div className="flex items-baseline justify-between">
          <h2 className="text-xl font-bold">Latest in the Clubhouse</h2>
          <Link href="/community" className="text-sm text-accent font-semibold">See all →</Link>
        </div>
        {posts.length === 0
          ? <div className="card text-sm text-ink2">Quiet so far — be the first to post.</div>
          : posts.map((p) => (
            <Link key={p.id} href={`/community/post/${p.id}`} className="card hover:border-accent flex flex-col gap-1">
              <span className="text-xs text-ink3"><b className="text-ink2">{p.author?.full_name ?? "Member"}</b>{p.author?.role === "coach" ? " · Coach" : ""} · {ago(p.created_at)}</span>
              <span className="text-sm line-clamp-2">{p.body}</span>
            </Link>
          ))}
      </section>

      {!isStudent && !isCoach && (
        <section id="book" className="card flex flex-col gap-3 scroll-mt-4">
          <div>
            <h2 className="text-xl font-bold">Book a lesson with Coach Jay</h2>
            <p className="text-sm text-ink2 m-0 mt-1">Lessons are at Back Nine Golf – North Arlington. Leave your number and what you want to work on, and Coach Jay will reach out to set a time.</p>
          </div>
          {status.requestedAt
            ? <p className="text-sm text-good m-0">Request sent {fmtDate(status.requestedAt)}. Coach Jay will be in touch.</p>
            : <RequestLessonForm />}
        </section>
      )}
    </>
  );
}
