"use client";
import { useActionState, useState } from "react";
import Link from "next/link";
import { logSession, type ActionState } from "../../../actions";
import { CLUBS } from "@/lib/types";

export function LogSessionForm({ studentId }: { studentId: string }) {
  const [state, action, pending] = useActionState<ActionState, FormData>(logSession, {});
  const [cs, setCs] = useState(""), [bs, setBs] = useState("");
  const smash = parseFloat(cs) > 0 && parseFloat(bs) > 0 ? (parseFloat(bs) / parseFloat(cs)).toFixed(2) : "auto";
  return (
    <form action={action} className="card flex flex-col gap-3">
      <input type="hidden" name="student_id" value={studentId} />
      <p className="text-sm text-ink2 m-0">Enter the session averages for one club. For shot-by-shot data, use the KIT bridge or import a bay CSV.</p>
      <div className="grid grid-cols-2 gap-3">
        <F id="club" label="Club"><select className="input" id="club" name="club" defaultValue="7 Iron">{CLUBS.map((c) => <option key={c}>{c}</option>)}</select></F>
        <F id="date" label="Date"><input className="input" id="date" name="session_date" type="date" defaultValue={new Date().toISOString().slice(0, 10)} /></F>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <F id="cs" label="Club speed (mph)"><input className="input num" id="cs" name="club_speed" type="number" step="0.1" inputMode="decimal" value={cs} onChange={(e) => setCs(e.target.value)} placeholder="82" required /></F>
        <F id="bs" label="Ball speed (mph)"><input className="input num" id="bs" name="ball_speed" type="number" step="0.1" inputMode="decimal" value={bs} onChange={(e) => setBs(e.target.value)} placeholder="114" required /></F>
        <F id="la" label="Launch (°)"><input className="input num" id="la" name="launch_angle" type="number" step="0.1" inputMode="decimal" placeholder="17.4" required /></F>
        <F id="sp" label="Spin (rpm)"><input className="input num" id="sp" name="spin_rate" type="number" step="10" inputMode="numeric" placeholder="6600" required /></F>
        <F id="ca" label="Carry (yds)"><input className="input num" id="ca" name="carry" type="number" step="1" inputMode="decimal" placeholder="159" required /></F>
        <F id="sm" label="Smash factor"><input className="input num" id="sm" readOnly value={smash} /></F>
      </div>
      <F id="note" label="Session note (student sees this)"><textarea className="input" id="note" name="note" rows={3} placeholder="What changed, and what to practice before next time" /></F>
      {state.error && <p role="alert" className="text-sm text-bad">{state.error}</p>}
      <div className="flex gap-2 justify-end">
        <Link href={`/coach/students/${studentId}?tab=data`} className="btn">Cancel</Link>
        <button className="btn btn-primary" disabled={pending}>{pending ? "Saving…" : "Save session"}</button>
      </div>
    </form>
  );
}

function F({ id, label, children }: { id: string; label: string; children: React.ReactNode }) {
  return <div className="flex flex-col gap-1"><label className="label" htmlFor={id}>{label}</label>{children}</div>;
}
