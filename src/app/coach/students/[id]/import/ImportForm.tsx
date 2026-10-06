"use client";
import { useActionState, useState } from "react";
import Link from "next/link";
import { importBaySession, type ActionState } from "../../../actions";
import { parseCsv, type ParsedShot } from "@/lib/csv";
import { CLUBS } from "@/lib/types";

export function ImportForm({ studentId }: { studentId: string }) {
  const [state, action, pending] = useActionState<ActionState, FormData>(importBaySession, {});
  const [preview, setPreview] = useState<{ shots: ParsedShot[]; unmatched: string[] } | null>(null);
  const needsClub = preview?.shots.some((s) => s.club === "Unknown");

  async function onFile(f: File | null) {
    if (!f) { setPreview(null); return; }
    setPreview(parseCsv(await f.text()));
  }

  return (
    <form action={action} className="flex flex-col gap-4">
      <input type="hidden" name="student_id" value={studentId} />
      <div className="card flex flex-col gap-3">
        <p className="text-sm text-ink2 m-0">
          Export the session from the Full Swing app (or any launch monitor) as CSV and drop it here. Columns are matched by name, so
          <code className="mx-1">Club, Club Speed, Ball Speed, Launch Angle, Spin Rate, Carry, Total, Side</code> all work in any order.
        </p>
        <div className="flex flex-col gap-1"><label className="label" htmlFor="file">CSV file</label><input className="input" id="file" name="file" type="file" accept=".csv,.tsv,text/csv,text/tab-separated-values" onChange={(e) => onFile(e.target.files?.[0] ?? null)} required /></div>
        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1"><label className="label" htmlFor="date">Session date</label><input className="input" id="date" name="session_date" type="date" defaultValue={new Date().toISOString().slice(0, 10)} /></div>
          <div className="flex flex-col gap-1"><label className="label" htmlFor="club">Club{needsClub ? " (file has no club column)" : " (used if file has none)"}</label><select className="input" id="club" name="club" defaultValue="7 Iron">{CLUBS.map((c) => <option key={c}>{c}</option>)}</select></div>
        </div>
        <div className="flex flex-col gap-1"><label className="label" htmlFor="note">Session note (student sees this)</label><textarea className="input" id="note" name="note" rows={2} /></div>
      </div>

      {preview && (
        <div className="card flex flex-col gap-2">
          <div className="flex items-baseline justify-between"><h3 className="text-lg font-semibold">Preview</h3><span className="eyebrow">{preview.shots.length} shots found</span></div>
          {preview.unmatched.length > 0 && <p className="text-sm text-warn m-0">Not found in file: {preview.unmatched.join(", ")}. Those will be blank.</p>}
          {preview.shots.length > 0 && (
            <div className="overflow-x-auto">
              <table className="data">
                <thead><tr><th>Club</th><th className="r">Club spd</th><th className="r">Ball spd</th><th className="r">Launch</th><th className="r">Spin</th><th className="r">Carry</th></tr></thead>
                <tbody>{preview.shots.slice(0, 8).map((s, i) => (
                  <tr key={i} className="num"><td>{s.club}</td><td className="r">{s.club_speed ?? "—"}</td><td className="r">{s.ball_speed ?? "—"}</td><td className="r">{s.launch_angle ?? "—"}</td><td className="r">{s.spin_rate ?? "—"}</td><td className="r">{s.carry ?? "—"}</td></tr>
                ))}</tbody>
              </table>
              {preview.shots.length > 8 && <p className="text-xs text-ink3 mt-2">…and {preview.shots.length - 8} more</p>}
            </div>
          )}
        </div>
      )}

      {state.error && <p role="alert" className="text-sm text-bad">{state.error}</p>}
      <div className="flex gap-2 justify-end">
        <Link href={`/coach/students/${studentId}?tab=data`} className="btn">Cancel</Link>
        <button className="btn btn-primary" disabled={pending || !preview?.shots.length}>{pending ? "Importing…" : `Import ${preview?.shots.length ?? ""} shots`}</button>
      </div>
    </form>
  );
}
