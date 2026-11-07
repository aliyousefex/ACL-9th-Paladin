import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { GROUPS, PRESETS, agreement, canHold, inputsOf, joinList, reshuffle, reshuffleStory, scoreHolding, type Group } from "../src/features/race/reshuffle.ts";
import { FEATURE_GROUP } from "../src/lib/format.ts";
import { FEATURES, INTERCEPT, contributions, logOdds, podiumScore, withFeature } from "../src/lib/model.ts";
import model from "../src/data/model.json" with { type: "json" };

const read = (path: string) => JSON.parse(readFileSync(new URL(path, import.meta.url), "utf8"));
const races = read("../src/data/races.json") as { id: number; year: number; slug: string }[];
const names = new Map((read("../src/data/drivers.json").drivers as { id: number; last: string }[]).map((d) => [d.id, d.last]));

interface Entry { d: number; x: (number | null)[]; p: number; pos: number | null; txt: string; status: string }

function rowsFor(race: { id: number }, poison = false) {
  const file = read(`../public/data/races/${race.id}.json`) as { entries: Entry[] };
  const rows = file.entries
    .map((entry) => ({
      entry: poison ? { ...entry, pos: 777, txt: "SPOILER", status: "SPOILER" } : entry,
      driver: { id: entry.d, last: names.get(entry.d) ?? String(entry.d) },
      score: entry.p,
      grid: entry.x[0] ?? null,
      rank: 0,
      finish: poison ? 777 : entry.pos,
      podium: poison ? true : entry.pos !== null && entry.pos <= 3,
    }))
    .sort((a, b) => b.score - a.score || a.driver.id - b.driver.id);
  rows.forEach((row, i) => (row.rank = i + 1));
  return rows;
}
const all = races.map((race) => ({ race, rows: rowsFor(race) }));
const hold = (...groups: Group[]) => new Set<Group>(groups);
const R = (rows: ReturnType<typeof rowsFor>) => rows as never;

test("the five groups partition the model's sixteen inputs exactly once", () => {
  assert.deepEqual([...GROUPS], ["Grid", "Qualifying", "Form", "Standings", "Context"]);
  const seen = GROUPS.flatMap((g) => inputsOf(g));
  assert.equal(seen.length, 16);
  assert.deepEqual([...seen].sort(), [...FEATURES].sort());
  assert.deepEqual(inputsOf("Grid"), ["grid_position", "pit_lane_start", "front_row", "field_size"]);
  assert.equal(inputsOf("Context").length, 2);
});

test("nothing held is exactly the page's own ranking, so the dial can never contradict the rest of the page", () => {
  for (const { rows } of all) {
    const out = reshuffle(R(rows), hold());
    assert.equal(out.length, rows.length);
    out.forEach((s, i) => {
      assert.equal(s.row.driver.id, rows[i].driver.id);
      assert.equal(s.rank, rows[i].rank);
      assert.equal(s.baseRank, rows[i].rank);
      assert.equal(s.score, rows[i].score);
      assert.equal(s.move, 0);
    });
  }
});

test("the computed path reproduces every exported score when nothing is held", () => {
  let worst = 0;
  for (const { rows } of all) for (const row of rows) worst = Math.max(worst, Math.abs(scoreHolding(row.entry.x, hold()) - row.score));
  assert.ok(worst < 6e-7, `worst ${worst}`);
});

test("holding a group at its average is the same as feeding the model the training mean for each of its inputs", () => {
  const mean = model.mean as number[];
  for (const group of GROUPS) {
    for (const { rows } of all.slice(0, 6)) {
      for (const row of rows) {
        let x = row.entry.x as (number | null)[];
        for (const feature of inputsOf(group)) x = withFeature(x, feature, mean[FEATURES.indexOf(feature)]);
        assert.ok(Math.abs(scoreHolding(row.entry.x, hold(group)) - podiumScore(x)) < 1e-12, `${group}`);
      }
    }
  }
});

test("a held group's contribution is removed from the log-odds and nothing else changes", () => {
  const row = all[5].rows[0];
  const parts = contributions(row.entry.x);
  for (const group of GROUPS) {
    const removed = parts.filter((p) => FEATURE_GROUP[p.feature] === group).reduce((sum, p) => sum + p.contribution, 0);
    const expected = 1 / (1 + Math.exp(-(logOdds(row.entry.x) - removed)));
    assert.ok(Math.abs(scoreHolding(row.entry.x, hold(group)) - expected) < 1e-12);
  }
  // Holding every group leaves only the intercept, so every driver would tie.
  const only = 1 / (1 + Math.exp(-INTERCEPT));
  for (const r of all[5].rows) assert.ok(Math.abs(scoreHolding(r.entry.x, new Set(GROUPS)) - only) < 1e-12);
});

test("ranks are a permutation, ties break by driver id, and moves are measured against the full model", () => {
  for (const { rows } of all) {
    for (const held of [hold("Grid"), hold("Form", "Standings"), hold("Qualifying", "Form", "Standings", "Context")]) {
      const out = reshuffle(R(rows), held);
      assert.deepEqual(out.map((s) => s.rank), rows.map((_, i) => i + 1));
      assert.deepEqual([...out.map((s) => s.baseRank)].sort((a, b) => a - b), rows.map((_, i) => i + 1));
      for (const s of out) assert.equal(s.move, s.baseRank - s.rank);
      assert.equal(out.reduce((sum, s) => sum + s.move, 0), 0, "gains and losses cancel");
      for (let i = 1; i < out.length; i++) assert.ok(out[i - 1].score >= out[i].score);
    }
  }
});

test("a score that is the same under every setting would tie, and ties never reorder drivers at random", () => {
  const rows = all[0].rows;
  const a = reshuffle(R(rows), new Set(GROUPS));
  const b = reshuffle(R(rows), new Set(GROUPS));
  assert.deepEqual(a.map((s) => s.row.driver.id), b.map((s) => s.row.driver.id));
  assert.deepEqual(a.map((s) => s.row.driver.id), [...rows].map((r) => r.driver.id).sort((x, y) => x - y));
});

test("holding the grid lowers the pole-sitter's score in nearly every race, the dial's clearest demonstration", () => {
  let lower = 0;
  for (const { rows } of all) {
    const pole = rows.find((r) => r.grid === 1);
    if (pole && scoreHolding(pole.entry.x, hold("Grid")) < pole.score) lower++;
  }
  assert.ok(lower >= 66, `${lower} of ${all.length}`);
});

test("agreement is a rank correlation", () => {
  const rows = all[0].rows;
  assert.equal(agreement(reshuffle(R(rows), hold())), 1);
  const reversed = reshuffle(R(rows), hold()).map((s, i, list) => ({ ...s, rank: list.length - i }));
  assert.ok(Math.abs(agreement(reversed) - -1) < 1e-12);
  const some = agreement(reshuffle(R(rows), hold("Grid")));
  assert.ok(some < 1 && some > -1);
  assert.equal(agreement([]), 1);
});

test("holding more groups never makes the order agree better with the full model than holding fewer, on average", () => {
  let fewer = 0;
  let more = 0;
  for (const { rows } of all) {
    fewer += agreement(reshuffle(R(rows), hold("Context")));
    more += agreement(reshuffle(R(rows), hold("Context", "Form", "Standings", "Qualifying")));
  }
  assert.ok(more < fewer, `fewer held ${fewer / all.length}, more held ${more / all.length}`);
});

test("a group can be held only while another stays active", () => {
  assert.equal(canHold("Grid", hold()), true);
  assert.equal(canHold("Grid", hold("Form", "Standings", "Context")), true, "one other group stays active");
  assert.equal(canHold("Grid", hold("Qualifying", "Form", "Standings", "Context")), false, "that would hold all five");
  assert.equal(canHold("Qualifying", hold("Qualifying", "Form", "Standings", "Context")), true, "a held group can always be released");
});

test("presets hold what they say and never all five", () => {
  const byId = new Map(PRESETS.map((p) => [p.id, p]));
  assert.deepEqual(byId.get("all")!.hold, []);
  assert.deepEqual([...byId.get("grid-only")!.hold].sort(), ["Context", "Form", "Qualifying", "Standings"]);
  assert.deepEqual(byId.get("no-grid")!.hold, ["Grid"]);
  for (const p of PRESETS) assert.ok(p.hold.length < GROUPS.length);
});

test("the story names what is held, agrees with the numbers, and cannot depend on the result", () => {
  for (const { race, rows } of all) {
    const poisoned = rowsFor(race, true);
    for (const held of [hold(), hold("Grid"), hold("Form", "Standings"), new Set<Group>(PRESETS[1].hold)]) {
      const clean = reshuffleStory(reshuffle(R(rows), held), held);
      const dirty = reshuffleStory(reshuffle(R(poisoned), held), held);
      assert.deepEqual(clean, dirty, `${race.year} ${race.slug}: the story changed when only outcomes changed`);
      for (const line of dirty) assert.ok(!/SPOILER|777/.test(line));
      for (const line of clean) assert.ok(!/undefined|NaN|won|finish|podium finisher|result/i.test(line), line);
    }
  }
  const held = hold("Grid");
  const out = reshuffle(R(all[0].rows), held);
  const story = reshuffleStory(out, held);
  assert.match(story[0], /^With grid held at the training average, the top three would be .+\. The full model's top three is .+; \d of 3 are shared\.$/);
  assert.match(story[1], /^\d+ of 20 drivers change rank, and the order agrees with the full model at -?\d\.\d\d \(Spearman, where 1 is identical\)\.$/);
  // Wording for several held groups, and for the case where only one group is left counting.
  const two = hold("Form", "Standings");
  assert.match(reshuffleStory(reshuffle(R(all[0].rows), two), two)[0], /^With form and standings held at the training average, /);
  const three = hold("Qualifying", "Form", "Standings");
  assert.match(reshuffleStory(reshuffle(R(all[0].rows), three), three)[0], /^With qualifying, form and standings held at the training average, /);
  const gridOnly = new Set<Group>(PRESETS[1].hold);
  assert.match(reshuffleStory(reshuffle(R(all[0].rows), gridOnly), gridOnly)[0], /^With only grid counting and the other four groups held at the training average, the top three would be /);
  assert.deepEqual(reshuffleStory(reshuffle(R(all[0].rows), hold()), hold()), ["All five input groups count, so this is Paladin's full ranking."]);
  assert.deepEqual(reshuffleStory([], hold("Grid")), []);
});

test("lists are joined the way people write them", () => {
  assert.equal(joinList([]), "");
  assert.equal(joinList(["a"]), "a");
  assert.equal(joinList(["a", "b"]), "a and b");
  assert.equal(joinList(["a", "b", "c"]), "a, b and c");
});
