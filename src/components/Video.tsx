"use client";
import { useEffect, useState } from "react";
import type { Video } from "@/lib/types";
import { fmtDate } from "@/lib/types";

/** Grid of videos; tapping one opens an inline player with a signed URL fetched on demand. */
export function VideoGrid({ videos, emptyText, extra }: { videos: Video[]; emptyText: string; extra?: (v: Video) => React.ReactNode }) {
  const [open, setOpen] = useState<Video | null>(null);
  if (videos.length === 0) return <p className="text-sm text-ink3">{emptyText}</p>;
  return (
    <div className="flex flex-col gap-4">
      {open && <Player video={open} onClose={() => setOpen(null)} />}
      <div className="grid gap-2.5" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))" }}>
        {videos.map((v) => (
          <div key={v.id} className={`card !p-0 overflow-hidden flex flex-col ${open?.id === v.id ? "border-accent" : ""}`}>
            <button onClick={() => setOpen(v)} className="text-left">
              <div className={`aspect-[16/10] relative grid place-items-center ${v.kind === "lesson" ? "bg-accent" : "bg-surface2"}`}>
                <span className="w-9 h-9 rounded-full bg-surface text-accent grid place-items-center shadow">
                  <svg viewBox="0 0 24 24" className="w-4 h-4 ml-0.5" fill="currentColor"><path d="M7 5v14l12-7z" /></svg>
                </span>
                {v.category && <span className="chip absolute left-2 top-2 !bg-surface">{v.category}</span>}
              </div>
              <div className="px-3 py-2.5">
                <b className="block text-sm font-semibold">{v.title}</b>
                <span className="block text-xs text-ink3">{v.kind === "lesson" ? v.description : fmtDate(v.recorded_on)}</span>
              </div>
            </button>
            {extra && <div className="px-3 pb-2.5">{extra(v)}</div>}
          </div>
        ))}
      </div>
    </div>
  );
}

export function Player({ video, onClose }: { video: Video; onClose?: () => void }) {
  // Keyed by video id so switching videos shows "Loading…" without a synchronous reset.
  const [loaded, setLoaded] = useState<{ id: string; src: string | null; err: string | null } | null>(null);
  useEffect(() => {
    let alive = true;
    fetch(`/api/video?id=${video.id}`).then(async (r) => {
      if (!alive) return;
      if (!r.ok) { setLoaded({ id: video.id, src: null, err: "Couldn't load this video." }); return; }
      const j = await r.json();
      setLoaded({ id: video.id, src: j.url, err: null });
    }).catch(() => alive && setLoaded({ id: video.id, src: null, err: "Couldn't load this video." }));
    return () => { alive = false; };
  }, [video.id]);
  const src = loaded?.id === video.id ? loaded.src : null;
  const err = loaded?.id === video.id ? loaded.err : null;
  return (
    <div className="card !p-0 overflow-hidden">
      <div className="aspect-video bg-black grid place-items-center text-white/70 text-sm">
        {src ? <video src={src} controls playsInline className="w-full h-full" /> : err ?? "Loading…"}
      </div>
      <div className="p-3.5 flex flex-col gap-2">
        <div className="flex items-baseline justify-between gap-2">
          <h3 className="text-lg font-semibold">{video.title}</h3>
          <div className="flex items-center gap-3">
            {video.kind === "swing" && <span className="eyebrow">{fmtDate(video.recorded_on)}</span>}
            {onClose && <button onClick={onClose} className="text-sm text-ink3 hover:text-ink">Close</button>}
          </div>
        </div>
        {video.kind === "lesson" && video.description && <p className="text-ink2 text-sm m-0">{video.description}</p>}
        {video.kind === "swing" && video.coach_note && (
          <div className="bg-surface2 rounded-lg px-3 py-2.5 text-sm">
            <div className="eyebrow mb-0.5">Coach note</div>{video.coach_note}
          </div>
        )}
      </div>
    </div>
  );
}
