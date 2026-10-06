import Link from "next/link";
import { PageHeader } from "@/components/AppShell";
import { carryTrend, listStudents, requireUser } from "@/lib/data";
import { fmtDateTime, initials, type ClubAverage } from "@/lib/types";
import { AddStudentForm } from "./AddStudentForm";

export default async function StudentsPage() {
  const { supabase } = await requireUser();
  const students = await listStudents();
  const { data: avgRows } = await supabase.from("session_club_averages").select("*").order("session_date");
  const byStudent = new Map<string, ClubAverage[]>();
  for (const r of (avgRows ?? []) as ClubAverage[]) byStudent.set(r.student_id, [...(byStudent.get(r.student_id) ?? []), r]);

  return (
    <>
      <PageHeader title="Students" eyebrow={`${students.length} on your roster`} />
      <div className="flex flex-col gap-2">
        {students.map((s) => {
          const t = carryTrend(byStudent.get(s.id) ?? []);
          return (
            <Link key={s.id} href={`/coach/students/${s.id}`} className="card flex items-center gap-3 hover:border-accent">
              <span className="avatar">{initials(s.full_name)}</span>
              <span className="flex-1 min-w-0">
                <b className="block font-semibold">{s.full_name}</b>
                <span className="block text-sm text-ink3 truncate">{s.focus || "No focus set"} · Next: {fmtDateTime(s.next_lesson_at)}</span>
              </span>
              {t?.delta != null ? (
                <span className={`chip num ${t.delta > 0 ? "chip-good" : t.delta < 0 ? "chip-bad" : ""}`}>{t.delta > 0 ? "▲" : t.delta < 0 ? "▼" : "–"} {Math.abs(t.delta)} yds</span>
              ) : (
                <span className="chip">{t ? "1 session" : s.user_id ? "No data" : "Invited"}</span>
              )}
            </Link>
          );
        })}
        {students.length === 0 && <p className="text-ink2">No students yet. Add your first one below.</p>}
      </div>
      <AddStudentForm />
    </>
  );
}
