/**
 * Parses a launch-monitor CSV/TSV export into shot rows. Header names are matched loosely.
 * Tuned on the Full Swing session export (myfullswinggolf.com/lm/share/… → CSV), which has
 * 24 columns, "°" suffixes on angles, "---" for missing values, and one row per shot with a timestamp.
 */
export type ParsedShot = {
  club: string; hit_at: string | null;
  club_speed: number | null; ball_speed: number | null; smash_factor: number | null;
  launch_angle: number | null; launch_direction: number | null; spin_rate: number | null; spin_axis: number | null;
  face_angle: number | null; attack_angle: number | null; club_path: number | null;
  carry: number | null; total: number | null; side: number | null; apex: number | null;
  raw: Record<string, string>;
};

// First match wins, so put exact names before looser ones. "normalized …" columns are skipped on purpose.
const ALIASES: Record<string, string[]> = {
  hit_at: ["shot time", "time", "date", "timestamp"],
  club: ["club name", "club type", "club"],
  club_speed: ["club speed", "clubhead speed", "club head speed", "chs"],
  ball_speed: ["ball speed", "bs"],
  smash_factor: ["smash factor", "smash"],
  launch_angle: ["launch angle", "vertical launch", "vla", "launch"],
  launch_direction: ["horizontal launch angle", "launch direction", "hla", "horizontal launch"],
  spin_rate: ["spin rate", "backspin", "total spin", "spin"],
  spin_axis: ["spin axis", "axis"],
  face_angle: ["face angle", "face"],
  attack_angle: ["attack angle", "angle of attack", "aoa"],
  club_path: ["club path", "path"],
  carry: ["carry distance", "carry yards", "carry"],
  total: ["total distance", "total"],
  side: ["side carry", "side distance", "offline", "lateral", "side"],
  apex: ["apex", "peak height", "max height"],
};

/** Full Swing's club names → the app's. Anything unknown is kept as typed (title-cased). */
export function normalizeClub(name: string): string {
  const s = name.trim().toLowerCase();
  if (!s) return "Unknown";
  if (s === "driver" || s === "dr") return "Driver";
  if (s === "pitching wedge" || s === "pw") return "PW";
  if (s === "gap wedge" || s === "gw" || s === "approach wedge" || s === "aw") return "GW";
  if (s === "sand wedge" || s === "sw") return "SW";
  if (s === "lob wedge" || s === "lw") return "LW";
  let m = s.match(/^(\d)\s*(iron|i)$/); if (m) return `${m[1]} Iron`;
  m = s.match(/^(\d)\s*(wood|w)$/); if (m) return `${m[1]} Wood`;
  m = s.match(/^(\d)?\s*(hybrid|h|rescue)$/); if (m) return "Hybrid";
  return s.replace(/\b\w/g, (c) => c.toUpperCase());
}

export function parseCsv(text: string): { shots: ParsedShot[]; unmatched: string[] } {
  const lines = text.replace(/^﻿/, "").split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) return { shots: [], unmatched: [] };
  const split = (l: string) => l.split(l.includes("\t") ? "\t" : ",").map((c) => c.replace(/^"|"$/g, "").trim());
  const header = split(lines[0]!).map((h) => h.toLowerCase().replace(/\s*\(.*?\)\s*/g, " ").replace(/\s+/g, " ").trim());
  const col = (key: string) => {
    for (const a of ALIASES[key]!) {
      const i = header.findIndex((h) => !h.startsWith("normalized") && (h === a || h.startsWith(a + " ")));
      if (i >= 0) return i;
    }
    return -1;
  };
  const idx = Object.fromEntries(Object.keys(ALIASES).map((k) => [k, col(k)]));
  // Only the columns the charts depend on are worth warning about; the rest are nice-to-have.
  const CORE = ["club", "club_speed", "ball_speed", "launch_angle", "spin_rate", "carry", "total", "side"];
  const unmatched = CORE.filter((k) => idx[k]! < 0);
  const n = (row: string[], k: string) => { const i = idx[k]!; if (i < 0) return null; const v = parseFloat((row[i] ?? "").replace(/[°%,]/g, "")); return Number.isFinite(v) ? v : null; };
  const shots: ParsedShot[] = [];
  for (const line of lines.slice(1)) {
    const row = split(line);
    const carry = n(row, "carry"), ball_speed = n(row, "ball_speed");
    if (carry == null && ball_speed == null) continue; // skip summary / blank rows
    const t = idx.hit_at! >= 0 ? Date.parse(row[idx.hit_at!] ?? "") : NaN;
    const club_speed = n(row, "club_speed");
    shots.push({
      club: normalizeClub(idx.club! >= 0 ? row[idx.club!] ?? "" : ""), hit_at: Number.isFinite(t) ? new Date(t).toISOString() : null,
      club_speed, ball_speed, smash_factor: n(row, "smash_factor") ?? (club_speed && ball_speed ? +(ball_speed / club_speed).toFixed(2) : null),
      launch_angle: n(row, "launch_angle"), launch_direction: n(row, "launch_direction"), spin_rate: n(row, "spin_rate"), spin_axis: n(row, "spin_axis"),
      face_angle: n(row, "face_angle"), attack_angle: n(row, "attack_angle"), club_path: n(row, "club_path"),
      carry, total: n(row, "total"), side: n(row, "side"), apex: n(row, "apex"),
      raw: Object.fromEntries(header.map((h, i) => [h, row[i] ?? ""])),
    });
  }
  // Oldest first, so the session reads in the order it was hit.
  shots.sort((a, b) => (a.hit_at && b.hit_at ? Date.parse(a.hit_at) - Date.parse(b.hit_at) : 0));
  return { shots, unmatched };
}
