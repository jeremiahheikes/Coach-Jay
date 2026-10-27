import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/AppShell";
import { BallData } from "@/components/BallData";
import { TrendChart } from "@/components/Stats";
import { VideoGrid } from "@/components/Video";
import { carryTrend, getLessonDetail, getOpenLesson, getStudent, getStudentBundle, listLessons } from "@/lib/data";
import { LessonFeed } from "@/components/LessonFeed";
import { startLesson } from "@/app/coach/actions";
import { fmtDate, fmtDateTime, SOURCE_LABEL } from "@/lib/types";
import { AssignButtons, EditStudent, SwingUpload } from "./panels";

const TABS = [["progress", "Progress"], ["lesson", "In progress"], ["data", "Ball data"], ["swings", "Swing videos"], ["lessons", "Assigned lessons"]] as const;

export default async function StudentPage(props: PageProps<"/coach/students/[id]">) {
  const { id } = await props.params;
  const { tab: rawTab } = await props.searchParams;
  const tab = (TABS.find((t) => t[0] === rawTab)?.[0] ?? "progress") as (typeof TABS)[number][0];
  const student = await getStudent(id);
  if (!student) notFound();
  const [{ sessions, averages, swings, assignments }, open] = await Promise.all([getStudentBundle(id), getOpenLesson(id)]);
  const trend = carryTrend(averages);
  const startForm = (label: string, cls = "btn btn-sm btn-primary whitespace-nowrap") => (
    <form action={startLesson}><input type="hidden" name="student_id" value={id} /><button className={cls}>{label}</button></form>
  );
  const first = student.full_name.split(" ")[0];

  return (
    <>
      <PageHeader title={student.full_name} eyebrow={`Next lesson · ${fmtDateTime(student.next_lesson_at)}`} back="/coach"
        action={open ? <Link href={`/coach/students/${id}/session`} className="btn btn-sm btn-primary whitespace-nowrap">● Continue lesson</Link> : startForm("● Start lesson")} />
      <nav className="tabs">
        {TABS.map(([k, l]) => <Link key={k} href={`/coach/students/${id}?tab=${k}`} aria-current={k === tab ? "page" : undefined}>{l}</Link>)}
      </nav>

      {tab === "progress" && (
        <>
          <div className="card flex flex-col gap-1.5">
            <div className="eyebrow">Goal</div>
            <h3 className="text-lg font-semibold">{student.goal || "No goal set yet"}</h3>
            <div className="flex flex-wrap gap-1.5 mt-1">
              <span className="chip">Since {fmtDate(student.created_at, { month: "short", year: "numeric" })}</span>
              <span className="chip">{student.handicap != null ? `HCP ${student.handicap}` : "No handicap"}</span>
              {student.focus && <span className="chip chip-accent">Focus: {student.focus}</span>}
              {!student.user_id && <span className="chip chip-warn">Hasn&apos;t signed up yet</span>}
            </div>
          </div>
          {trend && trend.count >= 2 && (
            <section className="flex flex-col gap-2">
              <div className="flex items-baseline justify-between"><h3 className="text-lg font-semibold">{trend.club} carry</h3><span className="eyebrow">Last {trend.count} sessions</span></div>
              <div className="card"><TrendChart rows={averages.filter((a) => a.club === trend.club)} metric="carry" /></div>
            </section>
          )}
          <section className="flex flex-col gap-2">
            <h3 className="text-lg font-semibold">Lesson log</h3>
            {sessions.length === 0 ? <p className="text-sm text-ink3">Nothing logged yet.</p> : (
              <div className="card flex flex-col">
                {sessions.map((s, i) => (
                  <div key={s.id} className="grid grid-cols-[20px_1fr] gap-3">
                    <div className="flex flex-col items-center"><span className="w-2.5 h-2.5 rounded-full bg-accent mt-1.5" />{i < sessions.length - 1 && <span className="w-0.5 flex-1 bg-line mt-1" />}</div>
                    <div className="pb-4">
                      <span className="eyebrow">{fmtDate(s.session_date)} · {s.status === "open" ? <Link href={`/coach/students/${id}/session`} className="text-good">In progress →</Link> : SOURCE_LABEL[s.source]}</span>
                      <b className="block font-semibold">{s.title}</b>
                      {s.note && <p className="text-sm text-ink2 mt-0.5">{s.note}</p>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
          <EditStudent student={student} />
        </>
      )}

      {tab === "lesson" && <InProgressTab studentId={id} first={first} openId={open?.id ?? null} lastClosed={sessions.find((s) => s.status === "closed") ?? null} start={startForm("● Start lesson", "btn btn-primary")} />}

      {tab === "data" && (
        <BallData averages={averages} action={
          <div className="flex gap-2">
            <Link href={`/coach/students/${id}/log`} className="btn btn-sm btn-primary">+ Log session</Link>
            <Link href={`/coach/students/${id}/import`} className="btn btn-sm">Import bay CSV</Link>
          </div>
        } />
      )}

      {tab === "swings" && (
        <>
          <div className="flex flex-wrap gap-2">
            {open ? <Link href={`/coach/students/${id}/session`} className="btn btn-primary">● Continue lesson</Link> : startForm("● Start lesson", "btn btn-primary")}
            <SwingUpload studentId={id} />
          </div>
          <section className="flex flex-col gap-2">
            <h3 className="text-lg font-semibold">{swings.length} swing video{swings.length === 1 ? "" : "s"}</h3>
            <VideoGrid videos={swings} emptyText="No swing videos yet. Upload one from the lesson above." />
          </section>
        </>
      )}

      {tab === "lessons" && (() => {
        const assigned = assignments.map((a) => a.video);
        const assignedIds = new Set(assigned.map((v) => v.id));
        return <LessonsTab studentId={id} first={first} assigned={assigned} assignedIds={assignedIds} />;
      })()}
    </>
  );
}

async function InProgressTab({ studentId, first, openId, lastClosed, start }: { studentId: string; first: string; openId: string | null; lastClosed: { session_date: string; title: string; note: string } | null; start: React.ReactNode }) {
  const detail = openId ? await getLessonDetail(openId) : null;
  if (!detail) {
    return (
      <div className="card flex flex-col gap-3 items-start">
        <p className="text-ink2 text-sm m-0">No lesson in progress with {first}.{lastClosed ? ` Last one: ${fmtDate(lastClosed.session_date)} · ${lastClosed.title}.` : ""}</p>
        {start}
      </div>
    );
  }
  return (
    <>
      <div className="card flex flex-wrap items-center gap-3">
        <span className="flex-1 min-w-0 text-sm text-ink2">Started {new Date(detail.session.created_at).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })} · {detail.clips.length} clip{detail.clips.length === 1 ? "" : "s"} · {detail.shots.length} shot{detail.shots.length === 1 ? "" : "s"}. This is what {first} sees.</span>
        <Link href={`/coach/students/${studentId}/session`} className="btn btn-primary btn-sm">● Continue lesson</Link>
      </div>
      <LessonFeed clips={detail.clips} shots={detail.shots} emptyText="Nothing recorded yet — continue the lesson to add a clip or numbers." />
    </>
  );
}

async function LessonsTab({ studentId, first, assigned, assignedIds }: { studentId: string; first: string; assigned: Awaited<ReturnType<typeof listLessons>>; assignedIds: Set<string> }) {
  const all = await listLessons();
  const rest = all.filter((l) => !assignedIds.has(l.id));
  return (
    <>
      <section className="flex flex-col gap-2">
        <div className="flex items-baseline justify-between"><h3 className="text-lg font-semibold">Assigned to {first}</h3><span className="eyebrow">{assigned.length} lessons</span></div>
        <VideoGrid videos={assigned} emptyText="Nothing assigned yet." extra={Object.fromEntries(assigned.map((v) => [v.id, <AssignButtons key={v.id} videoId={v.id} studentId={studentId} assigned />]))} />
      </section>
      <section className="flex flex-col gap-2">
        <h3 className="text-lg font-semibold">Assign from library</h3>
        {rest.length === 0 ? <p className="text-sm text-ink3">{all.length === 0 ? "Your library is empty. Upload lessons under Video lessons." : "Everything in your library is already assigned."}</p> : (
          <div className="flex flex-col gap-2">
            {rest.map((l) => (
              <div key={l.id} className="card flex items-center gap-3">
                <span className="flex-1 min-w-0"><b className="block font-semibold">{l.title}</b><span className="text-sm text-ink3">{l.category} · {l.description}</span></span>
                <AssignButtons videoId={l.id} studentId={studentId} />
              </div>
            ))}
          </div>
        )}
      </section>
    </>
  );
}
