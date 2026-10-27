import Link from "next/link";
import { PageHeader } from "@/components/AppShell";
import { LessonFeed } from "@/components/LessonFeed";
import { getLessonDetail, getMyStudentRow, getOpenLesson, getStudentBundle, requireUser } from "@/lib/data";
import { fmtDate } from "@/lib/types";
import { NotLinked } from "../NotLinked";

/** The student's view of the lesson in progress: each clip with the numbers underneath, read-only. */
export default async function StudentLessonPage() {
  const { user } = await requireUser();
  const me = await getMyStudentRow();
  if (!me) return <><PageHeader title="Live lesson" /><NotLinked email={user.email ?? ""} /></>;
  const open = await getOpenLesson(me.id);
  const detail = open ? await getLessonDetail(open.id) : null;
  if (!detail) {
    const { sessions } = await getStudentBundle(me.id);
    const last = sessions.find((s) => s.status === "closed");
    return (
      <>
        <PageHeader title="Live lesson" eyebrow="Nothing in progress" />
        <div className="card flex flex-col gap-2">
          <p className="text-ink2 text-sm m-0">When Coach Jay starts your lesson, every swing he records shows up here in slow motion with your numbers underneath — scroll down as the lesson goes.</p>
          {last && <p className="text-sm m-0">Last lesson: <b>{fmtDate(last.session_date)}</b>{last.note ? ` — ${last.note}` : ""} · <Link href="/student/swings" className="text-accent font-semibold">see your swings</Link></p>}
        </div>
      </>
    );
  }
  return (
    <>
      <PageHeader title="Live lesson" eyebrow={`Started ${new Date(detail.session.created_at).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })} · ${detail.clips.length} clip${detail.clips.length === 1 ? "" : "s"} · ${detail.shots.length} shot${detail.shots.length === 1 ? "" : "s"}`} />
      <LessonFeed clips={detail.clips} shots={detail.shots} emptyText="Coach Jay hasn't recorded a swing yet — this fills in as the lesson goes." />
    </>
  );
}
