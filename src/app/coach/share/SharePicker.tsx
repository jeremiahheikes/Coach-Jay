"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { importCsvText, registerVideo } from "@/app/coach/actions";
import { parseCsv } from "@/lib/csv";

type Opt = { id: string; name: string; sessionId: string | null };
const CACHE = "cj-share", PENDING = "/share/pending";

/** Reads the clip the service worker parked, lets the coach pick the student, uploads it. */
export function SharePicker({ options, err }: { options: Opt[]; err: string | null }) {
  const router = useRouter();
  const [file, setFile] = useState<File | null | undefined>(undefined); // undefined = still looking
  const [studentId, setStudentId] = useState(options[0]?.id ?? "");
  const [club, setClub] = useState("7 Iron");
  const [angle, setAngle] = useState<"Face-on" | "Down-the-line">("Face-on");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(err === "nosw" ? "The app wasn't ready to receive the share. Open Coach Jay once, then share the clip again." : err === "nofile" ? "No video came through with that share." : err);
  const [preview, setPreview] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const cache = await caches.open(CACHE);
        const res = await cache.match(PENDING);
        if (!res) { if (alive) setFile(null); return; }
        const blob = await res.blob();
        const name = decodeURIComponent(res.headers.get("x-filename") || "shared.mp4");
        const f = new File([blob], name, { type: res.headers.get("content-type") || blob.type || "video/mp4" });
        if (alive) { setFile(f); if (f.type.startsWith("video/")) setPreview(URL.createObjectURL(f)); }
      } catch { if (alive) setFile(null); }
    })();
    return () => { alive = false; };
  }, []);

  const chosen = options.find((o) => o.id === studentId);
  const isCsv = !!file && (/\.csv$/i.test(file.name) || /csv|text\/plain/.test(file.type));
  const [csvText, setCsvText] = useState<string | null>(null);
  const [result, setResult] = useState<{ added: number; skipped: number } | null>(null);
  useEffect(() => { if (file && isCsv) file.text().then(setCsvText); }, [file, isCsv]);
  const csvPreview = csvText ? parseCsv(csvText) : null;

  async function saveCsv() {
    if (!file || !chosen || !csvText) return;
    setBusy(true); setError(null);
    const r = await importCsvText({ student_id: chosen.id, text: csvText, filename: file.name });
    if (r.error) { setError(r.error); setBusy(false); return; }
    try { const cache = await caches.open(CACHE); await cache.delete(PENDING); } catch { /* fine */ }
    setResult({ added: r.added ?? 0, skipped: r.skipped ?? 0 });
    setBusy(false);
    setTimeout(() => router.replace(r.inLesson ? `/coach/students/${chosen.id}/session` : `/coach/students/${chosen.id}?tab=data`), 900);
  }

  async function save() {
    if (!file || !chosen) return;
    setBusy(true); setError(null);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setError("Signed out."); setBusy(false); return; }
    const ext = (file.name.split(".").pop() || "mp4").toLowerCase();
    const path = `${user.id}/${chosen.id}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
    const contentType = file.type || (ext === "webm" ? "video/webm" : ext === "mov" ? "video/quicktime" : "video/mp4");
    const { error: upErr } = await supabase.storage.from("swings").upload(path, file, { contentType });
    if (upErr) { setError(upErr.message); setBusy(false); return; }
    const r = await registerVideo({ kind: "swing", student_id: chosen.id, session_id: chosen.sessionId, storage_path: path, title: `${club} · ${angle}` });
    if (r.error) { setError(r.error); setBusy(false); return; }
    try { const cache = await caches.open(CACHE); await cache.delete(PENDING); } catch { /* fine */ }
    router.replace(chosen.sessionId ? `/coach/students/${chosen.id}/session` : `/coach/students/${chosen.id}?tab=swings`);
  }

  if (file === undefined) return <div className="card text-sm text-ink2">Looking for the shared clip…</div>;
  if (file === null) {
    return (
      <div className="card flex flex-col gap-2">
        {error && <p role="alert" className="text-sm text-bad m-0">{error}</p>}
        <p className="text-sm text-ink2 m-0">Nothing waiting. Share a <b>video</b> from your gallery, or a <b>CSV</b> from a Full Swing session link, to <b>Coach Jay</b> and it lands here.</p>
        <Link href="/coach" className="btn self-start">Back to students</Link>
      </div>
    );
  }
  if (isCsv) {
    return (
      <div className="flex flex-col gap-3">
        <div className="card flex flex-col gap-2">
          <div className="flex items-baseline justify-between"><h3 className="text-lg font-semibold">{file.name}</h3><span className="eyebrow">{csvPreview ? `${csvPreview.shots.length} shots` : "Reading…"}</span></div>
          {csvPreview && csvPreview.shots.length > 0 && (
            <div className="overflow-x-auto">
              <table className="data">
                <thead><tr><th>Club</th><th className="r">Carry</th><th className="r">Ball</th><th className="r">Club</th><th className="r">Spin</th></tr></thead>
                <tbody>{csvPreview.shots.slice(-6).map((s, i) => <tr key={i} className="num"><td>{s.club}</td><td className="r">{s.carry ?? "—"}</td><td className="r">{s.ball_speed ?? "—"}</td><td className="r">{s.club_speed ?? "—"}</td><td className="r">{s.spin_rate ?? "—"}</td></tr>)}</tbody>
              </table>
              {csvPreview.shots.length > 6 && <p className="text-xs text-ink3 mt-2">Last 6 of {csvPreview.shots.length}. Shots already logged are skipped automatically.</p>}
            </div>
          )}
        </div>
        <div className="card flex flex-col gap-3">
          <div className="flex flex-col gap-1">
            <label className="label" htmlFor="share-student">Student</label>
            <select id="share-student" className="input" value={studentId} onChange={(e) => setStudentId(e.target.value)}>
              {options.map((o) => <option key={o.id} value={o.id}>{o.name}{o.sessionId ? " · lesson in progress" : ""}</option>)}
            </select>
            <span className="text-xs text-ink3">{chosen?.sessionId ? "New shots go into the lesson in progress, under the latest clip." : "No lesson open — saved as a bay session on the file's date."}</span>
          </div>
          {error && <p role="alert" className="text-sm text-bad m-0">{error}</p>}
          {result && <p className="text-sm text-good m-0">Added {result.added} new shot{result.added === 1 ? "" : "s"}{result.skipped ? ` · ${result.skipped} already logged` : ""}.</p>}
          <div className="flex gap-2 justify-end">
            <Link href="/coach" className="btn">Cancel</Link>
            <button className="btn btn-primary" disabled={busy || !chosen || !csvPreview || csvPreview.shots.length === 0} onClick={saveCsv}>{busy ? "Importing…" : "Add shots"}</button>
          </div>
        </div>
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-3">
      <div className="card !p-0 overflow-hidden">
        {preview && <video src={preview} playsInline muted controls className="w-full max-h-[50vh] bg-black object-contain" />}
        <div className="px-3 py-2 text-xs text-ink3">{file.name} · {(file.size / 1048576).toFixed(1)} MB</div>
      </div>
      <div className="card flex flex-col gap-3">
        <div className="flex flex-col gap-1">
          <label className="label" htmlFor="share-student">Student</label>
          <select id="share-student" className="input" value={studentId} onChange={(e) => setStudentId(e.target.value)}>
            {options.map((o) => <option key={o.id} value={o.id}>{o.name}{o.sessionId ? " · lesson in progress" : ""}</option>)}
          </select>
          <span className="text-xs text-ink3">{chosen?.sessionId ? "Goes into the lesson in progress, with the numbers underneath." : "No lesson open — it'll be saved to their swing videos."}</span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <label className="label">Club</label>
          <select className="input !w-auto" value={club} onChange={(e) => setClub(e.target.value)}>
            {["Driver", "3 Wood", "Hybrid", "5 Iron", "6 Iron", "7 Iron", "8 Iron", "9 Iron", "PW", "SW", "Putter"].map((c) => <option key={c}>{c}</option>)}
          </select>
          <div className="inline-flex bg-surface2 rounded-lg p-[3px] gap-0.5">
            {(["Face-on", "Down-the-line"] as const).map((a) => (
              <button key={a} onClick={() => setAngle(a)} className={`px-2.5 py-1 rounded-md text-sm font-semibold ${a === angle ? "bg-surface text-ink shadow-sm" : "text-ink2"}`}>{a}</button>
            ))}
          </div>
        </div>
        {error && <p role="alert" className="text-sm text-bad m-0">{error}</p>}
        <div className="flex gap-2 justify-end">
          <Link href="/coach" className="btn">Cancel</Link>
          <button className="btn btn-primary" disabled={busy || !chosen} onClick={save}>{busy ? "Uploading…" : "Add to lesson"}</button>
        </div>
      </div>
    </div>
  );
}
