import { test } from "node:test";
import assert from "node:assert/strict";
import { parseCsv } from "../src/lib/csv";

test("parses a launch-monitor style CSV with loose headers", () => {
  const csv = `Shot,Club,Club Speed (mph),Ball Speed (mph),Smash,Launch Angle (deg),Spin Rate (rpm),Carry (yds),Total (yds),Side (yds)
1,7 Iron,82.1,114.3,1.39,17.4,6610,159.2,168.0,-3.1
2,7 Iron,81.6,113.0,1.38,16.9,6820,156.8,165.1,2.4
Average,,81.9,113.7,,17.2,6715,158.0,166.6,`;
  const { shots, unmatched } = parseCsv(csv);
  assert.equal(shots.length, 3); // the Average row has carry, so it's kept — coach sees it in preview
  assert.equal(shots[0]!.club, "7 Iron");
  assert.equal(shots[0]!.carry, 159.2);
  assert.equal(shots[0]!.spin_rate, 6610);
  assert.equal(shots[1]!.side, 2.4);
  assert.deepEqual(unmatched, []);
});

test("tab-separated, missing club column, skips blank rows", () => {
  const tsv = "Ball Speed\tCarry\n110\t150\n\n112\t154\n";
  const { shots, unmatched } = parseCsv(tsv);
  assert.equal(shots.length, 2);
  assert.equal(shots[0]!.club, "Unknown");
  assert.ok(unmatched.includes("club"));
  assert.ok(unmatched.includes("spin_rate"));
});

test("rows with neither carry nor ball speed are dropped", () => {
  const { shots } = parseCsv("Club,Carry\nDriver,\n7 Iron,150");
  assert.equal(shots.length, 1);
});

test("Full Swing session export: all columns, degree signs, '---', club names, time order", () => {
  const { readFileSync } = require("node:fs");
  const { shots, unmatched } = parseCsv(readFileSync(__dirname + "/fixtures/fullswing-share.csv", "utf8"));
  assert.equal(shots.length, 6);
  assert.ok(!unmatched.includes("club_path") && !unmatched.includes("face_angle") && !unmatched.includes("apex"), `unmatched: ${unmatched}`);
  // sorted oldest first: PW 11:34… no — fixture order by time: PW 11:38, 7i 11:45, hybrid 11:47, Dr 11:51:57, Dr 11:52:22, SW 11:56
  assert.deepEqual(shots.map((s) => s.club), ["PW", "7 Iron", "Hybrid", "Driver", "Driver", "SW"]);
  const d = shots[4]!;
  assert.equal(d.carry, 257.7); assert.equal(d.total, 287.1); assert.equal(d.ball_speed, 166.6); assert.equal(d.club_speed, 112.2);
  assert.equal(d.smash_factor, 1.49); assert.equal(d.launch_angle, 8.7); assert.equal(d.launch_direction, -3.7);
  assert.equal(d.spin_rate, 2297); assert.equal(d.spin_axis, -4.6); assert.equal(d.face_angle, -2.2); assert.equal(d.club_path, 1.8);
  assert.equal(d.attack_angle, null); // "---"
  assert.equal(d.side, -10.1); // side carry, not side total or normalized
  assert.equal(d.apex, 66.8);
  assert.ok(d.hit_at && d.hit_at.startsWith("2026-10-25"));
});

test("normalizeClub", () => {
  const { normalizeClub } = require("../src/lib/csv");
  assert.equal(normalizeClub("7 iron"), "7 Iron");
  assert.equal(normalizeClub("3 hybrid"), "Hybrid");
  assert.equal(normalizeClub("Pitching Wedge"), "PW");
  assert.equal(normalizeClub("3 wood"), "3 Wood");
  assert.equal(normalizeClub("putter"), "Putter");
});
