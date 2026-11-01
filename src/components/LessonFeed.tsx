"use client";
import { useRef, useState } from "react";
import { ReviewPlayer } from "./ReviewPlayer";
import { DualPlayer } from "./DualPlayer";
import { groupShotsBySwing, groupSwings, avg, type Swing, type SwingGroup } from "@/lib/lesson";
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
 * The lesson as a scrolling feed: one entry per swing (face-on + down-the-line together when both
 * exist), then the shots hit around it. `openId` is a clip id or swing id to start expanded.
 */
export function LessonFeed({ clips, shots, openId, clipExtra, emptyText, onAddView, busy }: {
  clips: Video[]; shots: Shot[]; openId?: string | null;
  clipExtra?: (v: Video) => React.ReactNode; emptyText?: string;
  /** Coach only: add the missing view of a swing from the gallery. */
  onAddView?: (swingId: string, angle: "Face-on" | "Down-the-line", file: File) => void; busy?: boolean;
}) {
  const swings = groupSwings(clips);
  const groups = groupShotsBySwing(swings, shots);
  const [open, setOpen] = useState<string | null | undefined>(undefined);
  const openSwing = open === undefined ? (openId ? swings.find((s) => s.id === openId || s.clips.some((c) => c.id === openId))?.id ?? null : null) : open;
  if (groups.length === 0) return <div className="card text-ink2 text-sm">{emptyText ?? "Nothing in this lesson yet."}</div>;
  return (
    <div className="flex flex-col gap-3">
      {groups.map((g) => <SwingCard key={g.swing?.id ?? "warmup"} group={g} expanded={!!g.swing && g.swing.id === openSwing} onToggle={() => g.swing && setOpen(g.swing.id === openSwing ? null : g.swing.id)} extra={clipExtra} onAddView={onAddView} busy={busy} />)}
    </div>
  );
}

function SwingCard({ group, expanded, onToggle, extra, onAddView, busy }: { group: SwingGroup; expanded: boolean; onToggle: () => void; extra?: (v: Video) => React.ReactNode; onAddView?: (swingId: string, angle: "Face-on" | "Down-the-line", file: File) => void; busy?: boolean }) {
  const { swing, shots } = group;
  const [view, setView] = useState<"both" | "face" | "dtl">("both");
  const pickRef = useRef<HTMLInputElement>(null);
  if (!swing) {
    return (
      <section className="card !p-0 overflow-hidden flex flex-col">
        <div className="px-3 pt-3 flex items-baseline justify-between"><h3 className="text-base font-semibold">Warm-up shots</h3><span className="eyebrow">{shots.length} before the first swing</span></div>
        {shots.length > 0 && <ShotTable shots={shots} />}
      </section>
    );
  }
  const both = !!(swing.faceOn && swing.dtl);
  const single = swing.faceOn ?? swing.dtl ?? swing.clips[0]!;
  const note = swing.clips.find((c) => c.coach_note)?.coach_note;
  return (
    <section className={`card !p-0 overflow-hidden flex flex-col ${expanded ? "border-accent" : ""}`}>
      {expanded ? (
        <div className="p-3 flex flex-col gap-3">
          {both && (
            <div className="inline-flex bg-surface2 rounded-lg p-[3px] gap-0.5 self-start">
              {([["both", "Both"], ["face", "Face-on"], ["dtl", "Down-the-line"]] as const).map(([k, l]) => (
                <button key={k} onClick={() => setView(k)} className={`px-2.5 py-1 rounded-md text-sm font-semibold ${view === k ? "bg-surface text-ink shadow-sm" : "text-ink2"}`}>{l}</button>
              ))}
            </div>
          )}
          {both && view === "both" ? (
            <DualPlayer left={swing.faceOn!} right={swing.dtl!} key={swing.id} onClose={onToggle} />
          ) : (
            <ReviewPlayer video={view === "dtl" && swing.dtl ? swing.dtl : view === "face" && swing.faceOn ? swing.faceOn : single} key={swing.id + view} onClose={onToggle} />
          )}
          {extra ? extra(single) : note ? <div className="bg-surface2 rounded-lg px-3 py-2.5 text-sm"><div className="eyebrow mb-0.5">Coach note</div>{note}</div> : null}
          {!both && (
            <div className="flex flex-wrap items-center gap-2">
              {onAddView ? (
                <>
                  <button className="btn btn-sm btn-primary" disabled={busy} onClick={() => pickRef.current?.click()}>
                    {busy ? "Uploading…" : `+ Add ${swing.faceOn ? "down-the-line" : "face-on"} from gallery`}
                  </button>
                  <input ref={pickRef} type="file" accept="video/*" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) onAddView(swing.id, swing.faceOn ? "Down-the-line" : "Face-on", f); e.target.value = ""; }} />
                  <span className="text-xs text-ink3">Pick the GoPro clip of this swing.</span>
                </>
              ) : (
                <p className="text-xs text-ink3 m-0">{swing.faceOn ? "Down-the-line view coming." : "Face-on view coming."}</p>
              )}
            </div>
          )}
        </div>
      ) : (
        <button onClick={onToggle} className="flex items-center gap-3 p-3 text-left">
          <span className="w-16 h-11 rounded-md bg-surface2 grid place-items-center shrink-0">
            <span className="w-7 h-7 rounded-full bg-surface text-accent grid place-items-center shadow"><svg viewBox="0 0 24 24" className="w-3 h-3 ml-0.5" fill="currentColor"><path d="M7 5v14l12-7z" /></svg></span>
          </span>
          <span className="min-w-0 flex-1">
            <b className="block font-semibold truncate">{swing.title} <span className="font-normal text-ink3">· {both ? "2 views" : swing.dtl ? "down-the-line" : "face-on"}</span></b>
            <span className="block text-xs text-ink3 truncate">{time(swing.at)} · {note || "No note yet"}</span>
          </span>
          <span className="text-xs text-ink3 whitespace-nowrap">{shots.length ? `${shots.length} shot${shots.length === 1 ? "" : "s"}` : "no shots"}</span>
        </button>
      )}
      {shots.length > 0 && <ShotTable shots={shots} />}
    </section>
  );
}

export function swingLabel(s: Swing) { return `${s.title} · ${time(s.at)}${s.dtl ? " (has down-the-line)" : ""}`; }

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
