export type Role = "coach" | "student";
export type SessionSource = "manual" | "kit" | "bay_import";

export const CLUBS = [
  "Driver", "3 Wood", "5 Wood", "Hybrid",
  "3 Iron", "4 Iron", "5 Iron", "6 Iron", "7 Iron", "8 Iron", "9 Iron",
  "PW", "GW", "SW", "LW",
] as const;

export const LESSON_CATEGORIES = ["Fundamentals", "Irons", "Driver", "Short game", "Data", "Playing"] as const;

export type Profile = { id: string; role: Role; full_name: string };

export type Student = {
  id: string; coach_id: string; user_id: string | null;
  email: string; full_name: string; goal: string; focus: string;
  handicap: number | null; next_lesson_at: string | null; created_at: string;
};

export type Session = {
  id: string; student_id: string; coach_id: string; session_date: string;
  source: SessionSource; title: string; note: string; created_at: string;
};

export type Shot = {
  id: string; session_id: string; club: string; hit_at: string;
  club_speed: number | null; ball_speed: number | null; smash_factor: number | null;
  launch_angle: number | null; launch_direction: number | null; spin_rate: number | null;
  spin_axis: number | null; face_angle: number | null; attack_angle: number | null;
  club_path: number | null; carry: number | null; total: number | null; side: number | null;
  apex: number | null; raw: unknown;
};

export type ClubAverage = {
  session_id: string; student_id: string; session_date: string; source: SessionSource;
  club: string; shots: number; club_speed: number | null; ball_speed: number | null;
  smash_factor: number | null; launch_angle: number | null; spin_rate: number | null;
  carry: number | null; total: number | null;
};

export type Video = {
  id: string; kind: "swing" | "lesson"; coach_id: string; student_id: string | null;
  storage_path: string; title: string; category: string; description: string;
  coach_note: string; recorded_on: string; duration_seconds: number | null; created_at: string;
};

export type Assignment = { id: string; video_id: string; student_id: string; assigned_at: string; watched_at: string | null };

export const METRICS = [
  { key: "carry", label: "Carry", unit: "yds", decimals: 0 },
  { key: "ball_speed", label: "Ball speed", unit: "mph", decimals: 0 },
  { key: "launch_angle", label: "Launch", unit: "°", decimals: 1 },
  { key: "spin_rate", label: "Spin", unit: "rpm", decimals: 0, lowerIsBetter: true },
  { key: "club_speed", label: "Club speed", unit: "mph", decimals: 0 },
  { key: "smash_factor", label: "Smash", unit: "", decimals: 2 },
] as const;
export type MetricKey = (typeof METRICS)[number]["key"];

export const SOURCE_LABEL: Record<SessionSource, string> = {
  manual: "Entered by coach",
  kit: "Full Swing KIT (live)",
  bay_import: "Simulator bay import",
};

export function initials(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]!.toUpperCase()).join("");
}

export function fmtDate(iso: string | null | undefined, opts: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" }) {
  if (!iso) return "";
  const d = iso.length === 10 ? new Date(iso + "T12:00:00") : new Date(iso);
  return d.toLocaleDateString("en-US", opts);
}

export function fmtDateTime(iso: string | null | undefined) {
  if (!iso) return "Unscheduled";
  return new Date(iso).toLocaleString("en-US", { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}
