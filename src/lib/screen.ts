/**
 * Pure helpers for reading shot numbers off the bay screen.
 * Kept free of browser APIs so they can be unit-tested.
 */

export type BoxKey = "carry" | "total" | "ball_speed" | "club_speed" | "smash_factor" | "launch_angle" | "spin_rate" | "side" | "apex" | "launch_direction" | "spin_axis" | "face_angle" | "attack_angle" | "club_path";
/** A calibration box as fractions of the frame (0–1), so it survives resolution changes. */
export type Box = { key: BoxKey; x: number; y: number; w: number; h: number };
export type Layout = { name: string; boxes: Box[]; trigger: BoxKey };

export const BOX_LABELS: Record<BoxKey, string> = {
  carry: "Carry (yds)", total: "Total (yds)", ball_speed: "Ball speed (mph)", club_speed: "Club speed (mph)",
  smash_factor: "Smash", launch_angle: "Launch angle (°)", spin_rate: "Spin (rpm)", side: "Side carry (yds, L negative)",
  apex: "Apex (ft)", launch_direction: "Launch direction (°)", spin_axis: "Spin axis (°)", face_angle: "Face angle (°)",
  attack_angle: "Attack angle (°)", club_path: "Club path (°)",
};
export const DEFAULT_KEYS: BoxKey[] = ["carry", "total", "ball_speed", "club_speed", "smash_factor", "launch_angle", "spin_rate", "side"];

/** Plausible ranges; a reading outside is treated as a misread and dropped (nulled), not posted. */
export const RANGES: Record<BoxKey, [number, number]> = {
  carry: [5, 400], total: [5, 450], ball_speed: [20, 220], club_speed: [20, 160], smash_factor: [0.5, 1.6],
  launch_angle: [-5, 60], spin_rate: [200, 15000], side: [-120, 120], apex: [0, 250], launch_direction: [-45, 45],
  spin_axis: [-60, 60], face_angle: [-30, 30], attack_angle: [-20, 20], club_path: [-30, 30],
};

/** Turns OCR text into a number, tolerating the usual misreads ("L"/"R" suffixes, stray spaces, commas, degree signs). */
export function parseReading(text: string, key: BoxKey): number | null {
  let t = text.replace(/[,°\s]/g, "").replace(/[oO]/g, "0").replace(/[lI|]/g, "1");
  let sign = 1;
  if (/L$/i.test(t) && (key === "side" || key === "launch_direction" || key === "spin_axis" || key === "face_angle" || key === "club_path")) { sign = -1; t = t.slice(0, -1); }
  if (/R$/i.test(t)) t = t.slice(0, -1);
  const m = t.match(/-?\d+(?:\.\d+)?/);
  if (!m) return null;
  let v = parseFloat(m[0]) * sign;
  const [lo, hi] = RANGES[key];
  if (v < lo || v > hi) {
    // A common OCR slip is a lost decimal point ("2389" for 238.9) — try that once.
    const fixed = v / 10;
    if (!m[0].includes(".") && fixed >= lo && fixed <= hi) v = fixed; else return null;
  }
  return v;
}

/** Tiny grayscale signature of a region, for cheap change detection. */
export function signature(gray: Uint8ClampedArray | number[]): number[] {
  return Array.from(gray);
}
export function signatureDistance(a: number[], b: number[]): number {
  if (a.length !== b.length || a.length === 0) return 1;
  let d = 0;
  for (let i = 0; i < a.length; i++) d += Math.abs(a[i]! - b[i]!);
  return d / (a.length * 255);
}

/** A reading is worth posting if the trigger metric is present and most boxes read something. */
export function readingIsUsable(values: Partial<Record<BoxKey, number | null>>, trigger: BoxKey): boolean {
  if (values[trigger] == null) return false;
  const present = Object.values(values).filter((v) => v != null).length;
  return present >= 2;
}
