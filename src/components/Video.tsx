"use client";
import { useState } from "react";
import { ReviewPlayer } from "./ReviewPlayer";
import type { Video } from "@/lib/types";
import { fmtDate } from "@/lib/types";

/** Grid of videos; tapping one opens an inline player with a signed URL fetched on demand. */
/** `extra` maps video id → element rendered under the tile (a map, not a function, so Server Components can pass it). */
export function VideoGrid({ videos, emptyText, extra }: { videos: Video[]; emptyText: string; extra?: Record<string, React.ReactNode> }) {
  const [open, setOpen] = useState<Video | null>(null);
  if (videos.length === 0) return <p className="text-sm text-ink3">{emptyText}</p>;
  return (
    <div className="flex flex-col gap-4">
      {open && <ReviewPlayer video={open} key={open.id} onClose={() => setOpen(null)}>{open.kind === "lesson" && open.description ? <p className="text-ink2 text-sm m-0">{open.description}</p> : open.kind === "swing" && open.coach_note ? <div className="bg-surface2 rounded-lg px-3 py-2.5 text-sm"><div className="eyebrow mb-0.5">Coach note</div>{open.coach_note}</div> : null}</ReviewPlayer>}
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
            {extra?.[v.id] && <div className="px-3 pb-2.5">{extra[v.id]}</div>}
          </div>
        ))}
      </div>
    </div>
  );
}
