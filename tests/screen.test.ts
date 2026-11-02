import { test } from "node:test";
import assert from "node:assert/strict";
import { parseReading, readingIsUsable, signatureDistance } from "../src/lib/screen";

test("parseReading handles clean numbers, suffixes and misreads", () => {
  assert.equal(parseReading("238.9", "carry"), 238.9);
  assert.equal(parseReading("2,240", "spin_rate"), 2240);
  assert.equal(parseReading("-16.9", "side"), -16.9);
  assert.equal(parseReading("16.9 L", "side"), -16.9);
  assert.equal(parseReading("16.9R", "side"), 16.9);
  assert.equal(parseReading("1.47", "smash_factor"), 1.47);
  assert.equal(parseReading("8.3°", "launch_angle"), 8.3);
  assert.equal(parseReading("2389", "carry"), 238.9); // lost decimal point
  assert.equal(parseReading("38.3", "launch_angle"), 38.3); // plausible, kept (confidence handles it)
  assert.equal(parseReading("999", "club_speed"), 99.9); // lost decimal, plausible
  assert.equal(parseReading("9999", "club_speed"), null); // out of range even after the fix
  assert.equal(parseReading("", "carry"), null);
  assert.equal(parseReading("I6I.I", "ball_speed"), 161.1);
});

test("readingIsUsable needs the trigger plus one more", () => {
  assert.equal(readingIsUsable({ carry: 150, ball_speed: 110 }, "carry"), true);
  assert.equal(readingIsUsable({ carry: 150 }, "carry"), false);
  assert.equal(readingIsUsable({ ball_speed: 110, total: 160 }, "carry"), false);
});

test("signatureDistance", () => {
  assert.equal(signatureDistance([0, 0], [0, 0]), 0);
  assert.equal(signatureDistance([0, 0], [255, 255]), 1);
  assert.equal(signatureDistance([], []), 1);
});
