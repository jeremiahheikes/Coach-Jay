import { notFound } from "next/navigation";
import { PageHeader } from "@/components/AppShell";
import { getStudent, getStudentBundle } from "@/lib/data";
import { SessionReview } from "./SessionReview";

export default async function SessionPage(props: PageProps<"/coach/students/[id]/session">) {
  const { id } = await props.params;
  const student = await getStudent(id);
  if (!student) notFound();
  const { swings } = await getStudentBundle(id);
  const today = new Date().toISOString().slice(0, 10);
  return (
    <>
      <PageHeader title="Live session" eyebrow={student.full_name} back={`/coach/students/${id}?tab=swings`} />
      <SessionReview studentId={id} studentName={student.full_name} swings={swings} today={today} />
    </>
  );
}
