import Link from "next/link";
import { PageHeader } from "@/components/AppShell";
import { TrendChart } from "@/components/Stats";
import { carryTrend, getMyStudentRow, getOpenLesson, getStudentBundle, requireUser } from "@/lib/data";
import { fmtDate, fmtDateTime } from "@/lib/types";
import { NotLinked } from "./NotLinked";

export default async function StudentHome() {
  const { user, profile } = await requireUser();
  const me = await getMyStudentRow();
  const first = profile.full_name.split(" ")[0];
  if (!me) return <><PageHeader title={`Hey ${first}`} /><NotLinked email={user.email ?? ""} /></>;
  const [{ sessions, averages, assignments }, open] = await Promise.all([getStudentBundle(me.id), getOpenLesson(me.id)]);
  const closed = sessions.filter((s) => s.status === "closed");
  const latest = closed.find((s) => s.note) ?? closed[0];
  const trend = carryTrend(averages);
  const unwatched = assignments.filter((a) => !a.watched_at);

  return (
    <>
      <PageHeader title={`Hey ${first}`} eyebrow="Coach Jay · Back Nine" />
      {open && (
        <Link href="/student/lesson" className="card flex items-center gap-3 border-accent hover:bg-surface2">
          <span className="w-2.5 h-2.5 rounded-full bg-good animate-pulse shrink-0" />
          <span className="flex-1 text-sm"><b className="font-semibold">Lesson in progress</b> — your swings and numbers are coming in live.</span>
          <span className="text-accent font-semibold text-sm">Open →</span>
        </Link>
      )}
      {latest ? (
        <div className="rounded-xl bg-accent text-accent-ink p-4 flex flex-col gap-2.5">
          <span className="eyebrow !text-accent-ink opacity-80">From Coach Jay · {fmtDate(latest.session_date)}</span>
          {latest.note ? <h2 className="text-xl font-bold">{latest.note}</h2> : <h2 className="text-xl font-bold">{latest.title}</h2>}
          {unwatched.length > 0 && <Link href="/student/lessons" className="btn self-start !bg-accent-ink !text-accent !border-transparent">▶ Watch: {unwatched[0]!.video.title}</Link>}
        </div>
      ) : (
        <div className="card"><p className="text-ink2 m-0">Your first lesson notes will show up here.</p></div>
      )}
      {trend && trend.count >= 2 && (
        <section className="flex flex-col gap-2">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h3 className="text-lg font-semibold">{trend.club} carry</h3>
            {trend.delta != null && <span className={`chip num ${trend.delta > 0 ? "chip-good" : trend.delta < 0 ? "chip-bad" : ""}`}>{trend.delta > 0 ? "▲" : trend.delta < 0 ? "▼" : "–"} {Math.abs(trend.delta)} yds since last lesson</span>}
          </div>
          <div className="card"><TrendChart rows={averages.filter((a) => a.club === trend.club)} metric="carry" /></div>
        </section>
      )}
      <div className="grid gap-2" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))" }}>
        <div className="card"><div className="eyebrow">Next lesson</div><div className="font-display font-bold text-xl mt-1">{fmtDateTime(me.next_lesson_at)}</div></div>
        <div className="card"><div className="eyebrow">Homework</div><div className="font-display font-bold text-xl mt-1">{assignments.length} lesson{assignments.length === 1 ? "" : "s"}</div><div className="text-xs text-ink3 truncate">{assignments.map((a) => a.video.title).join(" · ")}</div></div>
      </div>
      {me.goal && <div className="card"><div className="eyebrow">My goal</div><h3 className="text-lg font-semibold">{me.goal}</h3></div>}
    </>
  );
}
