import type { Shot, Video } from "@/lib/types";

/**
 * A clip's `created_at` is when the upload finished, which is a little after the
 * swing itself was hit. So the shot for the swing in the clip lands a few seconds
 * BEFORE the clip's timestamp. We pull each clip's window back by LEAD_MS so that
 * shot is counted with its clip, and everything hit after it (until the next clip)
 * goes with it too.
 */
export const LEAD_MS = 90_000;

export type ClipGroup = { clip: Video | null; shots: Shot[] };

/** Groups shots under clips, newest clip first. Shots before the first clip come last as a clip-less "warm-up" group. */
export function groupShotsByClip(clips: Video[], shots: Shot[]): ClipGroup[] {
  const ordered = [...clips].sort((a, b) => Date.parse(a.created_at) - Date.parse(b.created_at));
  const starts = ordered.map((c) => Date.parse(c.created_at) - LEAD_MS);
  const groups: ClipGroup[] = ordered.map((clip) => ({ clip, shots: [] }));
  const warmup: ClipGroup = { clip: null, shots: [] };
  for (const s of [...shots].sort((a, b) => Date.parse(a.hit_at) - Date.parse(b.hit_at))) {
    const t = Date.parse(s.hit_at);
    let idx = -1;
    for (let i = 0; i < starts.length; i++) if (t >= starts[i]!) idx = i; else break;
    (idx === -1 ? warmup : groups[idx]!).shots.push(s);
  }
  const out = groups.reverse();
  if (warmup.shots.length) out.push(warmup);
  return out;
}

/** Mean of a numeric field over shots, ignoring nulls. */
export function avg(shots: Shot[], key: keyof Shot): number | null {
  const vals = shots.map((s) => s[key]).filter((v): v is number => typeof v === "number" && Number.isFinite(v));
  return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
}

export function lessonTitle(clips: number, shots: number) {
  const parts = [];
  if (clips) parts.push(`${clips} clip${clips === 1 ? "" : "s"}`);
  if (shots) parts.push(`${shots} shot${shots === 1 ? "" : "s"}`);
  return parts.length ? `Lesson · ${parts.join(" · ")}` : "Lesson";
}

/** Angle from a clip title like "7 Iron · Down-the-line". */
export function clipAngle(v: Video): "Face-on" | "Down-the-line" | null {
  if (/down-the-line/i.test(v.title)) return "Down-the-line";
  if (/face-on/i.test(v.title)) return "Face-on";
  return null;
}

/** The other-angle clip recorded closest in time (within `windowMs`), if any. */
export function suggestPartner(clip: Video, all: Video[], windowMs = 120_000): Video | null {
  const a = clipAngle(clip); if (!a) return null;
  const t = Date.parse(clip.created_at);
  let best: Video | null = null, bestD = Infinity;
  for (const v of all) {
    if (v.id === clip.id) continue;
    const b = clipAngle(v); if (!b || b === a) continue;
    const d = Math.abs(Date.parse(v.created_at) - t);
    if (d <= windowMs && d < bestD) { best = v; bestD = d; }
  }
  return best;
}
