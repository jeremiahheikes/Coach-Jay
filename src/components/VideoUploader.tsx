"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { registerVideo } from "@/app/coach/actions";
import { LESSON_CATEGORIES } from "@/lib/types";

/**
 * Uploads straight from the browser to Supabase Storage (so big files never pass through the Next server),
 * then registers the row via a server action.
 */
export function VideoUploader({ kind, studentId, onDone, onCancel }: { kind: "swing" | "lesson"; studentId?: string; onDone: () => void; onCancel: () => void }) {
  const [file, setFile] = useState<File | null>(null);
  const [progress, setProgress] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!file) { setError("Choose a video file."); return; }
    const form = new FormData(e.currentTarget);
    setError(null); setProgress("Uploading…");
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setError("Signed out."); return; }
    const ext = file.name.split(".").pop()?.toLowerCase() || "mp4";
    const path = `${user.id}/${studentId ?? "library"}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
    const bucket = kind === "swing" ? "swings" : "lessons";
    const { error: upErr } = await supabase.storage.from(bucket).upload(path, file, { contentType: file.type || "video/mp4", upsert: false });
    if (upErr) { setError(upErr.message); setProgress(null); return; }
    setProgress("Saving…");
    const duration = await readDuration(file);
    const r = await registerVideo({
      kind, student_id: studentId, storage_path: path,
      title: String(form.get("title") || file.name.replace(/\.[^.]+$/, "")),
      category: String(form.get("category") || ""), description: String(form.get("description") || ""),
      coach_note: String(form.get("coach_note") || ""), recorded_on: String(form.get("recorded_on") || ""), duration_seconds: duration,
    });
    if (r.error) { setError(r.error); setProgress(null); return; }
    setProgress(null); onDone(); router.refresh();
  }

  return (
    <form onSubmit={submit} className="card flex flex-col gap-3">
      <div className="eyebrow">{kind === "swing" ? "Upload swing video" : "Upload lesson"}</div>
      <div className="flex flex-col gap-1">
        <label className="label" htmlFor="v-file">Video file</label>
        <input id="v-file" type="file" accept="video/*" capture={kind === "swing" ? "environment" : undefined} className="input" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
        <p className="text-xs text-ink3">{kind === "swing" ? "Up to 500 MB. On a phone this opens the camera." : "Up to 2 GB."}</p>
      </div>
      <div className="grid sm:grid-cols-2 gap-3">
        <div className="flex flex-col gap-1"><label className="label" htmlFor="v-title">Title</label><input className="input" id="v-title" name="title" placeholder={kind === "swing" ? "7 Iron · Face-on" : "Towel drill for low point"} /></div>
        {kind === "swing" ? (
          <div className="flex flex-col gap-1"><label className="label" htmlFor="v-date">Recorded on</label><input className="input" id="v-date" name="recorded_on" type="date" defaultValue={new Date().toISOString().slice(0, 10)} /></div>
        ) : (
          <div className="flex flex-col gap-1"><label className="label" htmlFor="v-cat">Category</label><select className="input" id="v-cat" name="category" defaultValue="Fundamentals">{LESSON_CATEGORIES.map((c) => <option key={c}>{c}</option>)}</select></div>
        )}
      </div>
      {kind === "swing" ? (
        <div className="flex flex-col gap-1"><label className="label" htmlFor="v-note">Coach note (student sees this)</label><textarea className="input" id="v-note" name="coach_note" rows={2} placeholder="What to look at, and what changed" /></div>
      ) : (
        <div className="flex flex-col gap-1"><label className="label" htmlFor="v-desc">Description</label><textarea className="input" id="v-desc" name="description" rows={2} /></div>
      )}
      {error && <p role="alert" className="text-sm text-bad">{error}</p>}
      <div className="flex gap-2 justify-end">
        <button type="button" className="btn" onClick={onCancel} disabled={!!progress}>Cancel</button>
        <button className="btn btn-primary" disabled={!!progress}>{progress ?? "Upload"}</button>
      </div>
    </form>
  );
}

function readDuration(file: File): Promise<number | null> {
  return new Promise((resolve) => {
    const v = document.createElement("video");
    v.preload = "metadata";
    v.onloadedmetadata = () => { URL.revokeObjectURL(v.src); resolve(Number.isFinite(v.duration) ? Math.round(v.duration) : null); };
    v.onerror = () => resolve(null);
    v.src = URL.createObjectURL(file);
  });
}
