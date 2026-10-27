"use client";
import { useState } from "react";
import { ReviewPlayer } from "./ReviewPlayer";
import { groupShotsByClip, avg, type ClipGroup } from "@/lib/lesson";
import type { Shot, Video } from "@/lib/types";

const COLS = [
  { key: "carry", label: "Carry", unit: "yds", d: 0 },
  { key: "ball_speed", label: "Ball", unit: "mph", d: 0 },
  { key: "club_speed", label: "Club", unit: "mph", d: 0 },
  { key: "smash_factor", label: "Smash", unit: "", d: 2 },
  { key: "launch_angle", label: "Launch", unit: "°", d: 1 },
  { key: "spin_rate", label: "Spin", unit: "rpm", d: 0 },
  { key: "side", label: "Side", unit: "yds", d: 0 },
] as const satisfies readonly { key: keyof Shot; label: string; unit: string; d: number }[];

const fmt = (v: number | null | undefined, d: number) => (v == null ? "–" : v.toFixed(d));
const time = (iso: string) => new Date(iso).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });

/**
 * The lesson as a scrolling feed: each clip, then the shots hit around it.
 * `openId` (optional) is the clip to start expanded, e.g. the one just recorded.
 * `clipExtra` renders under an expanded clip (the coach's note editor); `noteOf` shows a read-only note.
 */
export function LessonFeed({ clips, shots, openId, clipExtra, emptyText }: {
  clips: Video[]; shots: Shot[]; openId?: string | null;
  clipExtra?: (v: Video) => React.ReactNode; emptyText?: string;
}) {
  const groups = groupShotsByClip(clips, shots);
  const [open, setOpen] = useState<string | null | undefined>(undefined);
  const openClip = open === undefined ? openId ?? null : open;
  if (groups.length === 0) return <div className="card text-ink2 text-sm">{emptyText ?? "Nothing in this lesson yet."}</div>;
  return (
    <div className="flex flex-col gap-3">
      {groups.map((g) => <ClipCard key={g.clip?.id ?? "warmup"} group={g} expanded={!!g.clip && g.clip.id === openClip} onToggle={() => g.clip && setOpen(g.clip.id === openClip ? null : g.clip.id)} extra={clipExtra} />)}
    </div>
  );
}

function ClipCard({ group, expanded, onToggle, extra }: { group: ClipGroup; expanded: boolean; onToggle: () => void; extra?: (v: Video) => React.ReactNode }) {
  const { clip, shots } = group;
  return (
    <section className={`card !p-0 overflow-hidden flex flex-col ${expanded ? "border-accent" : ""}`}>
      {clip ? (
        expanded ? (
          <div className="p-3 flex flex-col gap-3">
            <ReviewPlayer video={clip} key={clip.id} onClose={onToggle}>
              {extra ? extra(clip) : clip.coach_note ? <div className="bg-surface2 rounded-lg px-3 py-2.5 text-sm"><div className="eyebrow mb-0.5">Coach note</div>{clip.coach_note}</div> : null}
            </ReviewPlayer>
          </div>
        ) : (
          <button onClick={onToggle} className="flex items-center gap-3 p-3 text-left">
            <span className="w-16 h-11 rounded-md bg-surface2 grid place-items-center shrink-0">
              <span className="w-7 h-7 rounded-full bg-surface text-accent grid place-items-center shadow"><svg viewBox="0 0 24 24" className="w-3 h-3 ml-0.5" fill="currentColor"><path d="M7 5v14l12-7z" /></svg></span>
            </span>
            <span className="min-w-0 flex-1">
              <b className="block font-semibold truncate">{clip.title}</b>
              <span className="block text-xs text-ink3 truncate">{time(clip.created_at)} · {clip.coach_note || "No note yet"}</span>
            </span>
            <span className="text-xs text-ink3 whitespace-nowrap">{shots.length ? `${shots.length} shot${shots.length === 1 ? "" : "s"}` : "no shots"}</span>
          </button>
        )
      ) : (
        <div className="px-3 pt-3 flex items-baseline justify-between"><h3 className="text-base font-semibold">Warm-up shots</h3><span className="eyebrow">{shots.length} before the first clip</span></div>
      )}
      {shots.length > 0 && <ShotTable shots={shots} />}
    </section>
  );
}

function ShotTable({ shots }: { shots: Shot[] }) {
  const clubs = [...new Set(shots.map((s) => s.club))];
  return (
    <div className="overflow-x-auto border-t border-line">
      <table className="data">
        <thead><tr><th>#</th><th>Club</th>{COLS.map((c) => <th key={c.key} className="r">{c.label}{c.unit ? <span className="normal-case tracking-normal"> {c.unit}</span> : ""}</th>)}</tr></thead>
        <tbody>
          {shots.map((s, i) => (
            <tr key={s.id}><td className="text-ink3">{i + 1}</td><td>{s.club}</td>{COLS.map((c) => <td key={c.key} className="r num">{fmt(s[c.key] as number | null, c.d)}</td>)}</tr>
          ))}
          {shots.length > 1 && (
            <tr className="font-semibold bg-surface2"><td /><td>Avg{clubs.length > 1 ? ` (${clubs.length} clubs)` : ""}</td>{COLS.map((c) => <td key={c.key} className="r num">{fmt(avg(shots, c.key), c.d)}</td>)}</tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
