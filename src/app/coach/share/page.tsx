import { PageHeader } from "@/components/AppShell";
import { listStudents, requireUser } from "@/lib/data";
import { SharePicker } from "./SharePicker";
import { groupSwings } from "@/lib/lesson";
import { swingLabel } from "@/components/LessonFeed";
import type { Video } from "@/lib/types";

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
  const sessionIds = [...openByStudent.values()];
  const { data: clips } = sessionIds.length ? await supabase.from("videos").select("*").in("session_id", sessionIds).eq("kind", "swing") : { data: [] };
  const bySession = new Map<string, Video[]>();
  for (const c of (clips ?? []) as Video[]) if (c.session_id) bySession.set(c.session_id, [...(bySession.get(c.session_id) ?? []), c]);
  const options = students
    .map((s) => { const sid = openByStudent.get(s.id) ?? null; return { id: s.id, name: s.full_name, sessionId: sid, swings: sid ? groupSwings(bySession.get(sid) ?? []).map((w) => ({ id: w.id, label: swingLabel(w), hasDtl: !!w.dtl, hasFace: !!w.faceOn })) : [] }; })
    .sort((a, b) => Number(!!b.sessionId) - Number(!!a.sessionId) || a.name.localeCompare(b.name));
  return (
    <>
      <PageHeader title="Add shared clip" eyebrow="From your phone's gallery" back="/coach" />
      <SharePicker options={options} err={typeof err === "string" ? err : null} />
    </>
  );
}
