import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/AppShell";
import { BallData } from "@/components/BallData";
import { TrendChart } from "@/components/Stats";
import { VideoGrid } from "@/components/Video";
import { carryTrend, getStudent, getStudentBundle, listLessons } from "@/lib/data";
import { fmtDate, fmtDateTime, initials, SOURCE_LABEL } from "@/lib/types";
import { AssignButtons, EditStudent, SwingUpload } from "./panels";

const TABS = [["progress", "Progress"], ["data", "Ball data"], ["swings", "Swing videos"], ["lessons", "Assigned lessons"]] as const;

export default async function StudentPage(props: PageProps<"/coach/students/[id]">) {
  const { id } = await props.params;
  const { tab: rawTab } = await props.searchParams;
  const tab = (TABS.find((t) => t[0] === rawTab)?.[0] ?? "progress") as (typeof TABS)[number][0];
  const student = await getStudent(id);
  if (!student) notFound();
  const { sessions, averages, swings, assignments } = await getStudentBundle(id);
  const trend = carryTrend(averages);
  const first = student.full_name.split(" ")[0];

  return (
    <>
      <PageHeader title={student.full_name} eyebrow={`Next lesson · ${fmtDateTime(student.next_lesson_at)}`} back="/coach"
        action={<span className="avatar w-12 h-12 text-lg">{initials(student.full_name)}</span>} />
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
                      <span className="eyebrow">{fmtDate(s.session_date)} · {SOURCE_LABEL[s.source]}</span>
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
          <SwingUpload studentId={id} />
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

async function LessonsTab({ studentId, first, assigned, assignedIds }: { studentId: string; first: string; assigned: Awaited<ReturnType<typeof listLessons>>; assignedIds: Set<string> }) {
  const all = await listLessons();
  const rest = all.filter((l) => !assignedIds.has(l.id));
  return (
    <>
      <section className="flex flex-col gap-2">
        <div className="flex items-baseline justify-between"><h3 className="text-lg font-semibold">Assigned to {first}</h3><span className="eyebrow">{assigned.length} lessons</span></div>
        <VideoGrid videos={assigned} emptyText="Nothing assigned yet." extra={(v) => <AssignButtons videoId={v.id} studentId={studentId} assigned />} />
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
