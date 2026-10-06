import { notFound } from "next/navigation";
import { PageHeader } from "@/components/AppShell";
import { getStudent } from "@/lib/data";
import { LogSessionForm } from "./LogSessionForm";

export default async function LogPage(props: PageProps<"/coach/students/[id]/log">) {
  const { id } = await props.params;
  const student = await getStudent(id);
  if (!student) notFound();
  return (
    <>
      <PageHeader title="Log ball data" eyebrow={student.full_name} back={`/coach/students/${id}?tab=data`} />
      <LogSessionForm studentId={id} />
    </>
  );
}
