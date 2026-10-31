import { PageHeader } from "@/components/AppShell";
import { listStudents, requireUser } from "@/lib/data";
import { BayReader } from "./BayReader";

/** Reads shot numbers off the simulator screen via a capture card and posts them into the lesson in progress. */
export default async function BayPage() {
  const { supabase } = await requireUser();
  const [students, { data: open }] = await Promise.all([
    listStudents(),
    supabase.from("sessions").select("id, student_id").eq("status", "open").order("created_at", { ascending: false }),
  ]);
  const openBy = new Map<string, string>();
  for (const s of (open ?? []) as { id: string; student_id: string }[]) if (!openBy.has(s.student_id)) openBy.set(s.student_id, s.id);
  const options = students.map((s) => ({ id: s.id, name: s.full_name, sessionId: openBy.get(s.id) ?? null }))
    .sort((a, b) => Number(!!b.sessionId) - Number(!!a.sessionId) || a.name.localeCompare(b.name));
  return (
    <>
      <PageHeader title="Bay screen" eyebrow="Reads shot numbers off the simulator via a capture card" />
      <BayReader students={options} />
    </>
  );
}
