// Run with: npm test   (Node's built-in test runner; TypeScript is stripped by Node itself)
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { test } from "node:test";
import { FEATURES, INTERCEPT, THRESHOLD, contributions, logOdds, podiumScore, withGrid } from "../src/lib/model.ts";

const dir = new URL("../public/data/races/", import.meta.url);
const files = readdirSync(dir).filter((f) => f.endsWith(".json"));

test("the browser model reproduces every exported podium score", () => {
  let rows = 0;
  let worst = 0;
  for (const file of files) {
    const race = JSON.parse(readFileSync(new URL(file, dir), "utf8"));
    for (const entry of race.entries) {
      worst = Math.max(worst, Math.abs(podiumScore(entry.x) - entry.p));
      rows++;
    }
  }
  assert.equal(files.length, 68);
  assert.equal(rows, 1359);
  assert.ok(worst < 6e-7, `worst difference ${worst}`); // scores are exported to six decimals
});

test("the log-odds decomposition is exact", () => {
  const race = JSON.parse(readFileSync(new URL(files[0], dir), "utf8"));
  for (const entry of race.entries) {
    const sum = INTERCEPT + contributions(entry.x).reduce((a, c) => a + c.contribution, 0);
    assert.ok(Math.abs(sum - logOdds(entry.x)) < 1e-12);
  }
});

test("the model has the documented shape", () => {
  assert.equal(FEATURES.length, 16);
  assert.ok(FEATURES.includes("grid_position") && !FEATURES.includes("round"));
  assert.ok(Math.abs(THRESHOLD - 0.625) < 1e-9);
});

test("a worse grid slot lowers the score and the grid flags follow", () => {
  const race = JSON.parse(readFileSync(new URL(files[0], dir), "utf8"));
  const pole = race.entries.find((e: { x: (number | null)[] }) => e.x[0] === 1);
  const base = podiumScore(pole.x);
  const back = withGrid(pole.x, 15);
  assert.ok(podiumScore(back) < base);
  assert.equal(back[FEATURES.indexOf("front_row")], 0);
  const pit = withGrid(pole.x, "pit");
  assert.equal(pit[FEATURES.indexOf("grid_position")], null);
  assert.equal(pit[FEATURES.indexOf("pit_lane_start")], 1);
});
