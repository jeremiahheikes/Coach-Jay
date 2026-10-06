"use client";
import { useActionState, useRef, useState } from "react";
import { addStudent, type ActionState } from "./actions";

export function AddStudentForm() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLFormElement>(null);
  const [state, action, pending] = useActionState<ActionState, FormData>(async (prev, form) => {
    const r = await addStudent(prev, form);
    if (r.ok) { ref.current?.reset(); setOpen(false); }
    return r;
  }, {});

  if (!open) return <button className="btn self-start" onClick={() => setOpen(true)}>+ Add student</button>;
  return (
    <form ref={ref} action={action} className="card flex flex-col gap-3">
      <div className="eyebrow">New student</div>
      <div className="grid sm:grid-cols-2 gap-3">
        <div className="flex flex-col gap-1"><label className="label" htmlFor="s-name">Full name</label><input className="input" id="s-name" name="full_name" required /></div>
        <div className="flex flex-col gap-1"><label className="label" htmlFor="s-email">Email</label><input className="input" id="s-email" name="email" type="email" required /></div>
        <div className="flex flex-col gap-1"><label className="label" htmlFor="s-goal">Goal</label><input className="input" id="s-goal" name="goal" placeholder="Break 90 by spring" /></div>
        <div className="flex flex-col gap-1"><label className="label" htmlFor="s-focus">Current focus</label><input className="input" id="s-focus" name="focus" placeholder="Low point control" /></div>
        <div className="flex flex-col gap-1"><label className="label" htmlFor="s-hcp">Handicap</label><input className="input" id="s-hcp" name="handicap" type="number" step="0.1" /></div>
        <div className="flex flex-col gap-1"><label className="label" htmlFor="s-next">Next lesson</label><input className="input" id="s-next" name="next_lesson_at" type="datetime-local" /></div>
      </div>
      <p className="text-xs text-ink3">When they sign up with this email, their account links to this profile automatically.</p>
      {state.error && <p role="alert" className="text-sm text-bad">{state.error}</p>}
      <div className="flex gap-2 justify-end">
        <button type="button" className="btn" onClick={() => setOpen(false)}>Cancel</button>
        <button className="btn btn-primary" disabled={pending}>{pending ? "Adding…" : "Add student"}</button>
      </div>
    </form>
  );
}
