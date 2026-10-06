"use client";
import { useActionState, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { assignLesson, unassignLesson, updateStudent, type ActionState } from "../../actions";
import { VideoUploader } from "@/components/VideoUploader";
import type { Student } from "@/lib/types";

export function AssignButtons({ videoId, studentId, assigned }: { videoId: string; studentId: string; assigned?: boolean }) {
  const [pending, start] = useTransition();
  const router = useRouter();
  const act = () => start(async () => { if (assigned) await unassignLesson(videoId, studentId); else await assignLesson(videoId, studentId); router.refresh(); });
  return <button onClick={act} disabled={pending} className={`btn btn-sm ${assigned ? "" : "btn-primary"}`}>{pending ? "…" : assigned ? "Remove" : "Assign"}</button>;
}

export function SwingUpload({ studentId }: { studentId: string }) {
  const [open, setOpen] = useState(false);
  if (!open) return <button className="btn self-start" onClick={() => setOpen(true)}>⬆ Upload swing video from lesson</button>;
  return <VideoUploader kind="swing" studentId={studentId} onDone={() => setOpen(false)} onCancel={() => setOpen(false)} />;
}

export function EditStudent({ student }: { student: Student }) {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState<ActionState, FormData>(async (s, f) => { const r = await updateStudent(s, f); if (r.ok) setOpen(false); return r; }, {});
  if (!open) return <button className="text-sm text-ink3 self-start hover:text-ink" onClick={() => setOpen(true)}>Edit profile</button>;
  const local = student.next_lesson_at ? new Date(new Date(student.next_lesson_at).getTime() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16) : "";
  return (
    <form action={action} className="card flex flex-col gap-3">
      <input type="hidden" name="id" value={student.id} />
      <div className="eyebrow">Edit profile</div>
      <div className="grid sm:grid-cols-2 gap-3">
        <div className="flex flex-col gap-1"><label className="label" htmlFor="e-name">Full name</label><input className="input" id="e-name" name="full_name" defaultValue={student.full_name} required /></div>
        <div className="flex flex-col gap-1"><label className="label" htmlFor="e-hcp">Handicap</label><input className="input" id="e-hcp" name="handicap" type="number" step="0.1" defaultValue={student.handicap ?? ""} /></div>
        <div className="flex flex-col gap-1"><label className="label" htmlFor="e-goal">Goal</label><input className="input" id="e-goal" name="goal" defaultValue={student.goal} /></div>
        <div className="flex flex-col gap-1"><label className="label" htmlFor="e-focus">Current focus</label><input className="input" id="e-focus" name="focus" defaultValue={student.focus} /></div>
        <div className="flex flex-col gap-1"><label className="label" htmlFor="e-next">Next lesson</label><input className="input" id="e-next" name="next_lesson_at" type="datetime-local" defaultValue={local} /></div>
      </div>
      {state.error && <p role="alert" className="text-sm text-bad">{state.error}</p>}
      <div className="flex gap-2 justify-end"><button type="button" className="btn" onClick={() => setOpen(false)}>Cancel</button><button className="btn btn-primary" disabled={pending}>{pending ? "Saving…" : "Save"}</button></div>
    </form>
  );
}
