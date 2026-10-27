import { test } from "node:test";
import assert from "node:assert/strict";
import { groupShotsByClip, LEAD_MS, avg } from "../src/lib/lesson";
import type { Shot, Video } from "../src/lib/types";

const clip = (id: string, at: string): Video => ({ id, kind: "swing", coach_id: "c", student_id: "s", storage_path: id, title: id, category: "", description: "", coach_note: "", recorded_on: at.slice(0, 10), duration_seconds: null, created_at: at, session_id: "x" });
const shot = (id: string, at: string, carry: number | null = 150): Shot => ({ id, session_id: "x", club: "7 Iron", hit_at: at, club_speed: null, ball_speed: null, smash_factor: null, launch_angle: null, launch_direction: null, spin_rate: null, spin_axis: null, face_angle: null, attack_angle: null, club_path: null, carry, total: null, side: null, apex: null, raw: null });

const T = (s: number) => new Date(Date.UTC(2026, 9, 27, 17, 0, s)).toISOString();

test("shots go with the clip they were hit around, newest clip first", () => {
  const clips = [clip("a", T(60)), clip("b", T(300))];
  const shots = [shot("warm", T(-200)), shot("a1", T(50)), shot("a2", T(120)), shot("b1", T(290)), shot("b2", T(400))];
  const g = groupShotsByClip(clips, shots);
  assert.equal(g.length, 3);
  assert.equal(g[0]!.clip!.id, "b");
  assert.deepEqual(g[0]!.shots.map((s) => s.id), ["b1", "b2"]);
  assert.equal(g[1]!.clip!.id, "a");
  assert.deepEqual(g[1]!.shots.map((s) => s.id), ["a1", "a2"]);
  assert.equal(g[2]!.clip, null);
  assert.deepEqual(g[2]!.shots.map((s) => s.id), ["warm"]);
});

test("lead window is applied", () => {
  const clips = [clip("a", T(100))];
  const g = groupShotsByClip(clips, [shot("x", new Date(Date.parse(T(100)) - LEAD_MS + 1000).toISOString())]);
  assert.equal(g[0]!.shots.length, 1);
});

test("no clips → one warm-up group; no warm-up shots → none", () => {
  assert.equal(groupShotsByClip([], [shot("s", T(0))])[0]!.clip, null);
  assert.equal(groupShotsByClip([clip("a", T(0))], []).length, 1);
});

test("avg ignores nulls", () => {
  assert.equal(avg([shot("a", T(0), 100), shot("b", T(1), null), shot("c", T(2), 200)], "carry"), 150);
  assert.equal(avg([], "carry"), null);
});
