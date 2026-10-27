import { notFound } from "next/navigation";
import { PageHeader } from "@/components/AppShell";
import { getLessonDetail, getOpenLesson, getStudent, getStudentBundle } from "@/lib/data";
import { startLesson } from "@/app/coach/actions";
import { SessionReview } from "./SessionReview";

export default async function SessionPage(props: PageProps<"/coach/students/[id]/session">) {
  const { id } = await props.params;
  const student = await getStudent(id);
  if (!student) notFound();
  const open = await getOpenLesson(id);
  if (!open) {
    return (
      <>
        <PageHeader title="Lesson" eyebrow={student.full_name} back={`/coach/students/${id}`} />
        <form action={startLesson} className="card flex flex-col gap-3 items-start">
          <input type="hidden" name="student_id" value={id} />
          <p className="text-ink2 text-sm m-0">No lesson in progress with {student.full_name.split(" ")[0]}. Start one to record swings and see the numbers land under each clip. KIT shots and manual entries go into it until you finish.</p>
          <button className="btn btn-primary">● Start lesson</button>
        </form>
      </>
    );
  }
  const [detail, { swings }] = await Promise.all([getLessonDetail(open.id), getStudentBundle(id)]);
  if (!detail) notFound();
  const earlier = swings.filter((s) => s.session_id !== open.id);
  return (
    <>
      <PageHeader title="Lesson in progress" eyebrow={`${student.full_name} · started ${new Date(open.created_at).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}`} back={`/coach/students/${id}`} />
      <SessionReview studentId={id} studentName={student.full_name} session={detail.session} clips={detail.clips} shots={detail.shots} earlier={earlier} />
    </>
  );
}
