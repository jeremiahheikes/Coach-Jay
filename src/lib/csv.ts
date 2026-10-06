/** Parses a launch-monitor CSV/TSV export into shot rows. Header names are matched loosely. */
export type ParsedShot = { club: string; club_speed: number | null; ball_speed: number | null; launch_angle: number | null; spin_rate: number | null; carry: number | null; total: number | null; side: number | null; raw: Record<string, string> };

const ALIASES: Record<string, string[]> = {
  club: ["club", "club name", "club type"],
  club_speed: ["club speed", "clubhead speed", "club head speed", "chs"],
  ball_speed: ["ball speed", "bs"],
  launch_angle: ["launch angle", "launch", "vla", "vertical launch"],
  spin_rate: ["spin rate", "spin", "backspin", "total spin"],
  carry: ["carry", "carry distance", "carry (yds)", "carry yards"],
  total: ["total", "total distance", "total (yds)"],
  side: ["side", "offline", "side distance", "lateral"],
};

export function parseCsv(text: string): { shots: ParsedShot[]; unmatched: string[] } {
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) return { shots: [], unmatched: [] };
  const split = (l: string) => l.split(l.includes("\t") ? "\t" : ",").map((c) => c.replace(/^"|"$/g, "").trim());
  const header = split(lines[0]!).map((h) => h.toLowerCase().replace(/\s*\(.*?\)\s*/g, " ").replace(/\s+/g, " ").trim());
  const col = (key: string) => header.findIndex((h) => ALIASES[key]!.some((a) => h === a || h.startsWith(a)));
  const idx = Object.fromEntries(Object.keys(ALIASES).map((k) => [k, col(k)]));
  const unmatched = Object.entries(idx).filter(([, i]) => i < 0).map(([k]) => k);
  const n = (row: string[], k: string) => { const i = idx[k]!; if (i < 0) return null; const v = parseFloat(row[i] ?? ""); return Number.isFinite(v) ? v : null; };
  const shots: ParsedShot[] = [];
  for (const line of lines.slice(1)) {
    const row = split(line);
    const club = idx.club! >= 0 ? row[idx.club!] ?? "" : "";
    const carry = n(row, "carry"), ball_speed = n(row, "ball_speed");
    if (carry == null && ball_speed == null) continue; // skip summary / blank rows
    shots.push({ club: club || "Unknown", club_speed: n(row, "club_speed"), ball_speed, launch_angle: n(row, "launch_angle"), spin_rate: n(row, "spin_rate"), carry, total: n(row, "total"), side: n(row, "side"), raw: Object.fromEntries(header.map((h, i) => [h, row[i] ?? ""])) });
  }
  return { shots, unmatched };
}

