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
