"use client";
import { useActionState, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { finishLesson, registerVideo, updateVideoNote, type ActionState } from "@/app/coach/actions";
import { LessonFeed } from "@/components/LessonFeed";
import { ReviewPlayer } from "@/components/ReviewPlayer";
import type { Session, Shot, Video } from "@/lib/types";
import { fmtDate } from "@/lib/types";

/**
 * The lesson in progress, from the coach's side:
 * capture bar (record / pick a clip) → the clip opens in slow-mo at the top of the feed,
 * with the shots hit around it underneath → Finish lesson closes it with a summary note.
 */
export function SessionReview({ studentId, studentName, session, clips, shots, earlier }: {
  studentId: string; studentName: string; session: Session; clips: Video[]; shots: Shot[]; earlier: Video[];
}) {
  const router = useRouter();
  const [uploading, setUploading] = useState<{ name: string; pct: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [angle, setAngle] = useState<"Face-on" | "Down-the-line">("Face-on");
  const [club, setClub] = useState("7 Iron");
  const fileRef = useRef<HTMLInputElement>(null);
  const pickRef = useRef<HTMLInputElement>(null);
  const [lastPath, setLastPath] = useState<string | null>(null);
  const [compare, setCompare] = useState<Video | null>(null);
  const first = studentName.split(" ")[0];

  // The clip just uploaded opens expanded; otherwise the newest one.
  const openId = (lastPath && clips.find((c) => c.storage_path === lastPath)?.id) || clips[0]?.id || null;

  async function handleFile(file: File | null) {
    if (!file) return;
    setError(null);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setError("Signed out."); return; }
    const ext = file.name.split(".").pop()?.toLowerCase() || "mp4";
    const path = `${user.id}/${studentId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
    setUploading({ name: file.name, pct: 0 });
    const { error: upErr } = await supabase.storage.from("swings").upload(path, file, { contentType: file.type || "video/mp4" });
    if (upErr) { setError(upErr.message); setUploading(null); return; }
    setUploading({ name: file.name, pct: 100 });
    const r = await registerVideo({ kind: "swing", student_id: studentId, session_id: session.id, storage_path: path, title: `${club} · ${angle}`, recorded_on: session.session_date });
    if (r.error) { setError(r.error); setUploading(null); return; }
    setLastPath(path);
    setUploading(null);
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Capture bar */}
      <div className="card flex flex-col gap-3">
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
          <Link href={`/coach/students/${studentId}/log`} className="btn btn-sm ml-auto">+ Enter numbers</Link>
        </div>
        <div className="flex flex-wrap gap-2">
          <button className="btn btn-primary flex-1 min-w-[140px] !py-3" disabled={!!uploading} onClick={() => fileRef.current?.click()}>● Record swing</button>
          <button className="btn flex-1 min-w-[140px] !py-3" disabled={!!uploading} onClick={() => pickRef.current?.click()}>Pick from camera roll</button>
          <input ref={fileRef} type="file" accept="video/*" capture="environment" hidden onChange={(e) => { handleFile(e.target.files?.[0] ?? null); e.target.value = ""; }} />
          <input ref={pickRef} type="file" accept="video/*" hidden onChange={(e) => { handleFile(e.target.files?.[0] ?? null); e.target.value = ""; }} />
        </div>
        {uploading && (
          <div className="flex flex-col gap-1">
            <div className="h-1.5 rounded bg-surface2 overflow-hidden"><div className={`h-full bg-accent ${uploading.pct < 100 ? "animate-pulse w-2/3" : "w-full"}`} /></div>
            <span className="text-xs text-ink3">{uploading.pct < 100 ? `Uploading ${uploading.name}…` : "Saving…"}</span>
          </div>
        )}
        {error && <p role="alert" className="text-sm text-bad m-0">{error}</p>}
        <p className="text-xs text-ink3 m-0">KIT shots and numbers you enter land under the latest clip. Tip: on the phone, set the camera to 240 fps slo-mo first.</p>
      </div>

      {/* The lesson so far */}
      <section className="flex flex-col gap-2">
        <div className="flex items-baseline justify-between">
          <h3 className="text-lg font-semibold">This lesson with {first}</h3>
          <span className="eyebrow">{clips.length} clip{clips.length === 1 ? "" : "s"} · {shots.length} shot{shots.length === 1 ? "" : "s"}</span>
        </div>
        <LessonFeed clips={clips} shots={shots} openId={openId} key={openId} emptyText="Record the first swing and it opens here in slow motion, with the numbers underneath."
          clipExtra={(v) => <NoteEditor video={v} key={v.id + v.coach_note} />} />
      </section>

      {/* Compare with an earlier swing */}
      {earlier.length > 0 && (
        <section className="flex flex-col gap-2">
          <h3 className="text-lg font-semibold">Compare with an earlier swing</h3>
          {compare && <ReviewPlayer video={compare} key={compare.id} onClose={() => setCompare(null)}>{compare.coach_note && <div className="bg-surface2 rounded-lg px-3 py-2.5 text-sm"><div className="eyebrow mb-0.5">Coach note</div>{compare.coach_note}</div>}</ReviewPlayer>}
          <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
            {earlier.map((v) => (
              <button key={v.id} onClick={() => setCompare(v)} className={`card !p-2.5 text-left shrink-0 w-40 ${compare?.id === v.id ? "border-accent" : "hover:border-accent"}`}>
                <b className="block text-sm font-semibold truncate">{v.title}</b>
                <span className="block text-xs text-ink3 truncate">{fmtDate(v.recorded_on)}</span>
              </button>
            ))}
          </div>
        </section>
      )}

      <FinishLesson sessionId={session.id} studentId={studentId} first={first} />
    </div>
  );
}

function FinishLesson({ sessionId, studentId, first }: { sessionId: string; studentId: string; first: string }) {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState<ActionState, FormData>(finishLesson, {});
  if (!open) return <button className="btn self-start" onClick={() => setOpen(true)}>Finish lesson</button>;
  return (
    <form action={action} className="card flex flex-col gap-3 border-accent">
      <input type="hidden" name="session_id" value={sessionId} />
      <input type="hidden" name="student_id" value={studentId} />
      <div className="eyebrow">Finish lesson</div>
      <div className="flex flex-col gap-1">
        <label className="label" htmlFor="finish-note">Summary for {first} (shows at the top of their home page)</label>
        <textarea id="finish-note" name="note" className="input" rows={3} placeholder="What we worked on, and what to practice before next time" />
      </div>
      {state.error && <p role="alert" className="text-sm text-bad m-0">{state.error}</p>}
      <div className="flex gap-2 justify-end">
        <button type="button" className="btn" onClick={() => setOpen(false)}>Not yet</button>
        <button className="btn btn-primary" disabled={pending}>{pending ? "Finishing…" : "Finish lesson"}</button>
      </div>
    </form>
  );
}

function NoteEditor({ video }: { video: Video }) {
  const [note, setNote] = useState(video.coach_note);
  const [saved, setSaved] = useState(true);
  const [pending, start] = useTransition();
  const router = useRouter();
  return (
    <div className="flex flex-col gap-1.5">
      <label className="label" htmlFor={`note-${video.id}`}>Coach note (student sees this)</label>
      <textarea id={`note-${video.id}`} className="input" rows={2} value={note} placeholder="What to look at in this swing" onChange={(e) => { setNote(e.target.value); setSaved(false); }} />
      <div className="flex items-center justify-end gap-2">
        <span className="text-xs text-ink3">{pending ? "Saving…" : saved ? "Saved" : "Unsaved"}</span>
        <button className="btn btn-sm btn-primary" disabled={pending || saved} onClick={() => start(async () => { await updateVideoNote(video.id, note); setSaved(true); router.refresh(); })}>Save note</button>
      </div>
    </div>
  );
}
