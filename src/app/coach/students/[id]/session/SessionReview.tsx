"use client";
import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { registerVideo, updateVideoNote } from "@/app/coach/actions";
import { ReviewPlayer } from "@/components/ReviewPlayer";
import type { Video } from "@/lib/types";
import { fmtDate } from "@/lib/types";

/**
 * In-lesson flow: shoot or pick a clip → it uploads in the background → opens in slow-motion review.
 * Today's clips sit in a strip under the player so you can flip between swings.
 */
export function SessionReview({ studentId, studentName, swings, today }: { studentId: string; studentName: string; swings: Video[]; today: string }) {
  const router = useRouter();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [uploading, setUploading] = useState<{ name: string; pct: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [angle, setAngle] = useState<"Face-on" | "Down-the-line">("Face-on");
  const [club, setClub] = useState("7 Iron");
  const fileRef = useRef<HTMLInputElement>(null);
  const pickRef = useRef<HTMLInputElement>(null);
  const [lastUploadedId, setLastUploadedId] = useState<string | null>(null);

  const todays = swings.filter((s) => s.recorded_on === today);
  const earlier = swings.filter((s) => s.recorded_on !== today);

  // Selection is derived: an explicit pick wins; otherwise the clip just uploaded; otherwise today's latest.
  const selected: Video | null =
    (selectedId && swings.find((s) => s.id === selectedId)) ||
    (lastUploadedId && swings.find((s) => s.storage_path === lastUploadedId)) ||
    todays[0] || null;
  const setSelected = (v: Video) => { setSelectedId(v.id); setLastUploadedId(null); };

  async function handleFile(file: File | null) {
    if (!file) return;
    setError(null);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setError("Signed out."); return; }
    const ext = file.name.split(".").pop()?.toLowerCase() || "mp4";
    const path = `${user.id}/${studentId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
    setUploading({ name: file.name, pct: 0 });
    // Supabase JS doesn't expose upload progress; show an indeterminate bar.
    const { error: upErr } = await supabase.storage.from("swings").upload(path, file, { contentType: file.type || "video/mp4" });
    if (upErr) { setError(upErr.message); setUploading(null); return; }
    setUploading({ name: file.name, pct: 100 });
    const r = await registerVideo({ kind: "swing", student_id: studentId, storage_path: path, title: `${club} · ${angle}`, recorded_on: today });
    if (r.error) { setError(r.error); setUploading(null); return; }
    setLastUploadedId(path); setSelectedId(null);
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
        </div>
        <div className="flex flex-wrap gap-2">
          <button className="btn btn-primary flex-1 min-w-[140px] !py-3" disabled={!!uploading} onClick={() => fileRef.current?.click()}>
            ● Record swing
          </button>
          <button className="btn flex-1 min-w-[140px] !py-3" disabled={!!uploading} onClick={() => pickRef.current?.click()}>
            Pick from camera roll
          </button>
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
        <p className="text-xs text-ink3 m-0">Tip: on iPhone, set the camera to 240 fps slo-mo before recording — the frame-step gets much finer.</p>
      </div>

      {/* Review */}
      {selected ? (
        <ReviewPlayer video={selected} key={selected.id}>
          <NoteEditor video={selected} key={selected.id + selected.coach_note} />
        </ReviewPlayer>
      ) : (
        <div className="card text-ink2 text-sm">Record the first swing and it opens here in slow motion.</div>
      )}

      {/* Today's clips */}
      <section className="flex flex-col gap-2">
        <div className="flex items-baseline justify-between"><h3 className="text-lg font-semibold">Today with {studentName.split(" ")[0]}</h3><span className="eyebrow">{todays.length} clip{todays.length === 1 ? "" : "s"}</span></div>
        {todays.length === 0 ? <p className="text-sm text-ink3">Nothing yet today.</p> : <ClipStrip clips={todays} selected={selected} onPick={setSelected} />}
      </section>
      {earlier.length > 0 && (
        <section className="flex flex-col gap-2">
          <h3 className="text-lg font-semibold">Earlier swings to compare</h3>
          <ClipStrip clips={earlier} selected={selected} onPick={setSelected} showDate />
        </section>
      )}
    </div>
  );
}

function ClipStrip({ clips, selected, onPick, showDate }: { clips: Video[]; selected: Video | null; onPick: (v: Video) => void; showDate?: boolean }) {
  return (
    <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
      {clips.map((v) => (
        <button key={v.id} onClick={() => onPick(v)} className={`card !p-2.5 text-left shrink-0 w-40 ${selected?.id === v.id ? "border-accent" : "hover:border-accent"}`}>
          <div className="aspect-[16/10] rounded-md bg-surface2 grid place-items-center mb-2">
            <span className="w-8 h-8 rounded-full bg-surface text-accent grid place-items-center shadow"><svg viewBox="0 0 24 24" className="w-3.5 h-3.5 ml-0.5" fill="currentColor"><path d="M7 5v14l12-7z" /></svg></span>
          </div>
          <b className="block text-sm font-semibold truncate">{v.title}</b>
          <span className="block text-xs text-ink3 truncate">{showDate ? fmtDate(v.recorded_on) : v.coach_note ? v.coach_note : "No note yet"}</span>
        </button>
      ))}
    </div>
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
