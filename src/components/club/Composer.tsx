"use client";
import { useRef, useState, useTransition } from "react";
import { createClient } from "@/lib/supabase/client";
import { createPost } from "@/app/(club)/community/actions";

const MAX_MB = 100;

/** Write a post (or ask the coach a question), optionally with a photo or a short swing clip. */
export function Composer({ uid, kind, placeholder }: { uid: string; kind: "post" | "question"; placeholder: string }) {
  const [body, setBody] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const input = useRef<HTMLInputElement>(null);

  function pick(f: File | null) {
    setError(null);
    if (preview) URL.revokeObjectURL(preview);
    if (f && f.size > MAX_MB * 1024 * 1024) { setError(`That file is over ${MAX_MB} MB. Trim the clip or send a shorter one.`); f = null; }
    setFile(f);
    setPreview(f ? URL.createObjectURL(f) : null);
  }

  function submit() {
    setError(null);
    start(async () => {
      let media_path: string | null = null, media_type: "image" | "video" | null = null;
      if (file) {
        setStatus("Uploading…");
        media_type = file.type.startsWith("video/") ? "video" : "image";
        const ext = (file.name.split(".").pop() || (media_type === "video" ? "mp4" : "jpg")).toLowerCase().replace(/[^a-z0-9]/g, "");
        media_path = `${uid}/${crypto.randomUUID()}.${ext}`;
        const { error: upErr } = await createClient().storage.from("clubhouse").upload(media_path, file, { contentType: file.type || undefined });
        if (upErr) { setStatus(null); setError(`Upload failed: ${upErr.message}`); return; }
      }
      setStatus("Posting…");
      const r = await createPost({ kind, body, media_path, media_type });
      setStatus(null);
      if (r.error) {
        if (media_path) await createClient().storage.from("clubhouse").remove([media_path]);
        setError(r.error);
        return;
      }
      setBody(""); pick(null);
      if (input.current) input.current.value = "";
    });
  }

  return (
    <div className="card flex flex-col gap-3">
      <textarea className="input min-h-[84px] resize-y" placeholder={placeholder} value={body} onChange={(e) => setBody(e.target.value)} maxLength={4000} />
      {preview && file && (
        <div className="relative self-start">
          {file.type.startsWith("video/")
            ? <video src={preview} className="max-h-56 rounded-lg" muted playsInline controls />
            : (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={preview} alt="" className="max-h-56 rounded-lg" />
            )}
          <button type="button" onClick={() => { pick(null); if (input.current) input.current.value = ""; }} className="absolute top-1.5 right-1.5 chip !bg-surface">✕ Remove</button>
        </div>
      )}
      <div className="flex items-center gap-2 flex-wrap">
        <label className="btn btn-sm cursor-pointer">
          <input ref={input} type="file" accept="image/*,video/*" className="sr-only" onChange={(e) => pick(e.target.files?.[0] ?? null)} />
          📎 Photo or swing clip
        </label>
        <span className="flex-1" />
        {status && <span className="text-xs text-ink3">{status}</span>}
        <button type="button" className="btn btn-sm btn-primary" disabled={pending || !body.trim()} onClick={submit}>
          {kind === "question" ? "Ask Coach Jay" : "Post"}
        </button>
      </div>
      {error && <p role="alert" className="text-sm text-bad m-0">{error}</p>}
    </div>
  );
}
