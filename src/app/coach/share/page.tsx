import { PageHeader } from "@/components/AppShell";
import { listStudents, requireUser } from "@/lib/data";
import { SharePicker } from "./SharePicker";

/** Landing page for a clip shared from the phone's gallery (Share → Coach Jay). */
export default async function SharePage(props: PageProps<"/coach/share">) {
  const { err } = await props.searchParams;
  const { supabase } = await requireUser();
  const [students, { data: open }] = await Promise.all([
    listStudents(),
    supabase.from("sessions").select("id, student_id, created_at").eq("status", "open").order("created_at", { ascending: false }),
  ]);
  const openByStudent = new Map<string, string>();
  for (const s of (open ?? []) as { id: string; student_id: string }[]) if (!openByStudent.has(s.student_id)) openByStudent.set(s.student_id, s.id);
  const options = students
    .map((s) => ({ id: s.id, name: s.full_name, sessionId: openByStudent.get(s.id) ?? null }))
    .sort((a, b) => Number(!!b.sessionId) - Number(!!a.sessionId) || a.name.localeCompare(b.name));
  return (
    <>
      <PageHeader title="Add shared clip" eyebrow="From your phone's gallery" back="/coach" />
      <SharePicker options={options} err={typeof err === "string" ? err : null} />
    </>
  );
}
