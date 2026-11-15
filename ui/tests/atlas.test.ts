import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { describeFalseAlarm, describeMiss, entriesByRace, gridBand, mulberry32, pairedBootstrap, summarize, tookTheFlag, verdictAgainstGrid, worstFirst } from "../src/lib/atlas.ts";
import type { Driver, RaceMeta } from "../src/lib/data.ts";

const read = (name: string) => JSON.parse(readFileSync(new URL(`../src/data/${name}`, import.meta.url), "utf8"));
const races = read("races.json") as RaceMeta[];
const drivers = read("drivers.json").drivers as Driver[];
const entries = entriesByRace(races, drivers);
const summary = summarize(races, entries);

test("the season logs rebuild every held-out field and reproduce the exported top three and hit count", () => {
  assert.equal(entries.size, 68);
  let total = 0;
  for (const race of races) {
    const field = entries.get(race.id)!;
    total += field.length;
    assert.equal(field.length, race.drivers, `${race.name} ${race.year}: field size`);
    const top = field.filter((entry) => entry.rank <= 3).map((entry) => entry.driverId).sort();
    assert.deepEqual(top, [...race.predicted].sort(), `${race.name} ${race.year}: model top three`);
    const hits = field.filter((entry) => entry.rank <= 3 && entry.finish <= 3).length;
    assert.equal(hits, race.hits, `${race.name} ${race.year}: hits`);
    const ranks = field.map((entry) => entry.rank).sort((a, b) => a - b);
    assert.deepEqual(ranks, field.map((_, i) => i + 1), "ranks are 1..n with no gaps");
  }
  assert.equal(total, 1359);
});

test("the grid decomposition reconciles with the exported totals", () => {
  assert.equal(summary.races, 68);
  assert.equal(summary.modelHits, races.reduce((sum, race) => sum + race.hits, 0));
  assert.equal(summary.gridHits, races.reduce((sum, race) => sum + race.baselineHits, 0));
  // Every podium finisher falls in exactly one grid band, and the model's catches add up to its hits.
  const podium = [...entries.values()].flat().filter((entry) => entry.finish <= 3).length;
  assert.equal(summary.bands.reduce((sum, row) => sum + row.podium, 0), podium);
  assert.equal(summary.bands.reduce((sum, row) => sum + row.modelCaught, 0), summary.modelHits);
  assert.equal(summary.bands.reduce((sum, row) => sum + row.gridCaught, 0), summary.gridHits);
  for (const row of summary.bands) assert.ok(row.modelCaught <= row.podium && row.gridCaught <= row.podium);
  // The grid baseline can only ever catch front-three starters, apart from penalty reshuffles.
  const front = summary.bands.find((row) => row.band === "P1-3")!;
  assert.equal(front.gridCaught, front.podium);
});

test("every pick is accounted for exactly once: hit, false alarm or miss", () => {
  assert.equal(summary.falseAlarms.total, 3 * summary.races - summary.modelHits);
  const podium = summary.bands.reduce((sum, row) => sum + row.podium, 0);
  assert.equal(summary.misses.total, podium - summary.modelHits);
  const { total: faTotal, ...faKinds } = summary.falseAlarms;
  const { total: missTotal, ...missKinds } = summary.misses;
  assert.equal(Object.values(faKinds).reduce((a, b) => a + b, 0), faTotal);
  assert.equal(Object.values(missKinds).reduce((a, b) => a + b, 0), missTotal);
  assert.equal(summary.versusGrid.better + summary.versusGrid.tied + summary.versusGrid.worse, summary.races);
  assert.equal(summary.seasons.reduce((sum, season) => sum + season.races, 0), 68);
  assert.deepEqual(summary.seasons.map((season) => season.year), [2022, 2023, 2024]);
  assert.equal(summary.seasons.reduce((sum, season) => sum + season.modelHits, 0), summary.modelHits);
  assert.equal(summary.seasons.reduce((sum, season) => sum + season.gridHits, 0), summary.gridHits);
});

test("false alarms are described from the classification alone", () => {
  assert.equal(describeFalseAlarm({ txt: "R", finish: 14 }).kind, "in-race event");
  assert.equal(describeFalseAlarm({ txt: "D", finish: 20 }).kind, "in-race event");
  assert.equal(describeFalseAlarm({ txt: "4", finish: 4 }).kind, "close call");
  assert.equal(describeFalseAlarm({ txt: "5", finish: 5 }).kind, "close call");
  assert.equal(describeFalseAlarm({ txt: "6", finish: 6 }).kind, "faded");
  assert.equal(describeFalseAlarm({ txt: "10", finish: 10 }).kind, "faded");
  assert.equal(describeFalseAlarm({ txt: "11", finish: 11 }).kind, "outside the points");
  // No wording claims a cause.
  for (const sample of [{ txt: "R", finish: 14 }, { txt: "7", finish: 7 }]) assert.ok(!/because|due to|caused/i.test(describeFalseAlarm(sample).detail));
});

test("misses are described from the pre-race record: model rank and starting slot", () => {
  assert.equal(describeMiss({ rank: 4, grid: 9 }).kind, "close call");
  assert.equal(describeMiss({ rank: 5, grid: null }).kind, "close call");
  assert.equal(describeMiss({ rank: 8, grid: 5 }).kind, "visible on the grid");
  assert.equal(describeMiss({ rank: 9, grid: 12 }).kind, "against the inputs");
  assert.equal(describeMiss({ rank: 9, grid: null }).kind, "against the inputs");
  assert.match(describeMiss({ rank: 9, grid: null }).detail, /pit lane/);
});

test("grid bands and the flag test handle pit-lane starts and retirements", () => {
  assert.equal(gridBand(1), "P1-3");
  assert.equal(gridBand(3), "P1-3");
  assert.equal(gridBand(4), "P4-6");
  assert.equal(gridBand(7), "P7 or lower");
  assert.equal(gridBand(null), "P7 or lower");
  assert.equal(tookTheFlag({ txt: "12" }), true);
  assert.equal(tookTheFlag({ txt: "R" }), false);
});

test("the paired bootstrap is deterministic, brackets the mean, and only calls a winner when zero is excluded", () => {
  const differences = races.map((race) => race.hits - race.baselineHits);
  const first = pairedBootstrap(differences);
  const second = pairedBootstrap(differences);
  assert.deepEqual(first, second, "same seed, same interval");
  assert.ok(Math.abs(first.mean - (summary.modelHits - summary.gridHits) / 68) < 1e-12);
  assert.ok(first.lower <= first.mean && first.mean <= first.upper);
  assert.ok(first.upper - first.lower > 0.05, "68 races of whole-number differences cannot give a razor-thin interval");
  assert.equal(verdictAgainstGrid(first), "is level with the grid", "the held-out seasons do not separate the model from the grid");
  assert.equal(verdictAgainstGrid({ lower: 0.1, upper: 0.4 }), "beats the grid");
  assert.equal(verdictAgainstGrid({ lower: -0.4, upper: -0.1 }), "trails the grid");
  assert.equal(verdictAgainstGrid({ lower: -0.1, upper: 0.4 }), "is level with the grid");
  assert.deepEqual(pairedBootstrap([]), { mean: 0, lower: 0, upper: 0, draws: 0 });
  const constant = pairedBootstrap([1, 1, 1, 1]);
  assert.equal(constant.lower, 1);
  assert.equal(constant.upper, 1);
  const random = mulberry32(1);
  for (let i = 0; i < 1000; i += 1) {
    const value = random();
    assert.ok(value >= 0 && value < 1);
  }
});

test("the ledger reads worst races first, then the biggest shortfall against the grid, then the newest", () => {
  const ordered = worstFirst(races);
  assert.equal(ordered.length, 68);
  for (let i = 1; i < ordered.length; i += 1) assert.ok(ordered[i].hits >= ordered[i - 1].hits);
  const a = { id: 1, hits: 1, baselineHits: 1 };
  const b = { id: 2, hits: 1, baselineHits: 3 };
  const c = { id: 3, hits: 1, baselineHits: 3 };
  assert.deepEqual(worstFirst([a, b, c]).map((race) => race.id), [3, 2, 1]);
});
