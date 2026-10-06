import { notFound } from "next/navigation";
import { PageHeader } from "@/components/AppShell";
import { getStudent } from "@/lib/data";
import { ImportForm } from "./ImportForm";

export default async function ImportPage(props: PageProps<"/coach/students/[id]/import">) {
  const { id } = await props.params;
  const student = await getStudent(id);
  if (!student) notFound();
  return (
    <>
      <PageHeader title="Import bay session" eyebrow={student.full_name} back={`/coach/students/${id}?tab=data`} />
      <ImportForm studentId={id} />
    </>
  );
}
