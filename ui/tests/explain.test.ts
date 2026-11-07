import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { test } from "node:test";
import { MIN_DELTA, biggestMoves, explainMove, gridMoves, gridStory } from "../src/features/race/explain.ts";
import { INTERCEPT, contributions, logOdds } from "../src/lib/model.ts";

const dir = new URL("../public/data/races/", import.meta.url);
const files = readdirSync(dir).filter((f) => f.endsWith(".json"));

/** The same shape the page builds from an exported race: ranked by podium score, with the grid slot. */
function rowsFor(file: string) {
  const race = JSON.parse(readFileSync(new URL(file, dir), "utf8"));
  const rows = race.entries
    .map((entry: { d: number; x: (number | null)[]; p: number }) => ({ entry, driver: { id: entry.d }, score: entry.p, grid: entry.x[0] ?? null, rank: 0 }))
    .sort((a: { score: number; driver: { id: number } }, b: { score: number; driver: { id: number } }) => b.score - a.score || a.driver.id - b.driver.id);
  rows.forEach((row: { rank: number }, i: number) => (row.rank = i + 1));
  return rows;
}

test("grid rank counts pit-lane starters behind every grid slot and moves sum to zero", () => {
  for (const file of files.slice(0, 20)) {
    const rows = rowsFor(file);
    const moves = gridMoves(rows);
    assert.equal(moves.length, rows.length);
    // Both orders are permutations of 1..n, so promotions and demotions cancel exactly.
    assert.equal(moves.reduce((sum, m) => sum + m.move, 0), 0, file);
    assert.deepEqual([...moves.map((m) => m.gridRank)].sort((a, b) => a - b), rows.map((_: unknown, i: number) => i + 1));
    const pit = moves.filter((m) => m.row.grid === null);
    for (const p of pit) assert.ok(p.gridRank > moves.filter((m) => m.row.grid !== null).length, "pit starters rank last");
  }
});

test("biggest moves are signed, ordered, and limited to the requested count", () => {
  const rows = rowsFor(files[0]);
  const up = biggestMoves(rows, "up", 3);
  const down = biggestMoves(rows, "down", 3);
  assert.ok(up.length <= 3 && down.length <= 3);
  assert.ok(up.every((m) => m.move > 0) && down.every((m) => m.move < 0));
  for (let i = 1; i < up.length; i++) assert.ok(up[i - 1].move >= up[i].move);
  for (let i = 1; i < down.length; i++) assert.ok(down[i - 1].move <= down[i].move);
  // Nothing outside the lists moves further than the lists' extreme.
  const all = gridMoves(rows);
  if (up[0]) assert.equal(up[0].move, Math.max(...all.map((m) => m.move)));
  if (down[0]) assert.equal(down[0].move, Math.min(...all.map((m) => m.move)));
});

test("explanations are the model's own contributions measured against the field average", () => {
  for (const file of files.slice(0, 12)) {
    const rows = rowsFor(file);
    const mean = (index: number) => rows.reduce((sum: number, r: { entry: { x: (number | null)[] } }) => sum + contributions(r.entry.x)[index].contribution, 0) / rows.length;
    for (const direction of ["up", "down"] as const) {
      for (const move of biggestMoves(rows, direction, 3)) {
        const reasons = explainMove(move.row, rows, direction, 2);
        assert.ok(reasons.length <= 2);
        const mine = contributions(move.row.entry.x);
        for (const reason of reasons) {
          const index = mine.findIndex((c) => c.feature === reason.feature);
          assert.ok(index >= 0);
          assert.ok(Math.abs(reason.delta - (mine[index].contribution - mean(index))) < 1e-12);
          assert.ok(Math.abs(reason.delta) >= MIN_DELTA);
          assert.ok(direction === "up" ? reason.delta > 0 : reason.delta < 0, "reason points the same way as the move");
          // Spelled out here on purpose: the grid is the baseline, so its own inputs are never offered as the reason.
          assert.ok(!["grid_position", "pit_lane_start", "front_row", "field_size"].includes(reason.feature), `grid input offered as a reason: ${reason.feature}`);
        }
        for (let i = 1; i < reasons.length; i++) assert.ok(Math.abs(reasons[i - 1].delta) >= Math.abs(reasons[i].delta));
      }
    }
  }
});

test("the field-average baseline is consistent with the exact log-odds decomposition", () => {
  const rows = rowsFor(files[3]);
  const meanLogOdds = rows.reduce((sum: number, r: { entry: { x: (number | null)[] } }) => sum + logOdds(r.entry.x), 0) / rows.length;
  const row = rows[0];
  const parts = contributions(row.entry.x);
  const deltas = parts.map((p, i) => p.contribution - rows.reduce((s: number, r: { entry: { x: (number | null)[] } }) => s + contributions(r.entry.x)[i].contribution, 0) / rows.length);
  // Per-feature deltas add up to this driver's log-odds minus the field's mean log-odds (the intercept cancels).
  const total = deltas.reduce((a, b) => a + b, 0);
  assert.ok(Math.abs(total - (logOdds(row.entry.x) - meanLogOdds)) < 1e-9);
  assert.ok(Number.isFinite(INTERCEPT));
});

test("an empty field and a driver with nothing standing out give an empty explanation", () => {
  assert.deepEqual(explainMove({ entry: { x: [] } } as never, [], "up"), []);
  const rows = rowsFor(files[0]);
  // A driver compared with a field made only of themselves has no deviation to report.
  assert.deepEqual(explainMove(rows[0], [rows[0]], "up"), []);
});

test("the grid story names its baseline in every sentence and agrees with the move data", () => {
  for (const file of files.slice(0, 25)) {
    const rows = rowsFor(file);
    const story = gridStory(rows);
    assert.ok(story.length >= 1 && story.length <= 3);
    assert.match(story[0], /^Paladin's top three (is the same three drivers as|shares \d drivers? with) the first three grid slots\.$/);
    // Count the overlap independently of the implementation.
    const gridFront = new Set([...rows].sort((a: { grid: number | null; driver: { id: number } }, b: { grid: number | null; driver: { id: number } }) => (a.grid ?? 99) - (b.grid ?? 99) || a.driver.id - b.driver.id).slice(0, 3).map((r: { driver: { id: number } }) => r.driver.id));
    const shared = rows.filter((r: { rank: number; driver: { id: number } }) => r.rank <= 3 && gridFront.has(r.driver.id)).length;
    assert.ok(shared === 3 ? /same three drivers/.test(story[0]) : story[0].includes(`shares ${shared} `), file);
    for (const line of story.slice(1)) assert.match(line, /against the grid: .+, from grid rank \d+ to model rank \d+ \([+−]\d+\)\.$/);
    // It uses only the two orders: no outcome vocabulary can appear.
    for (const line of story) assert.ok(!/finish|won|win|podium|result|actual|retire/i.test(line), line);
  }
  assert.deepEqual(gridStory([]), []);
});
