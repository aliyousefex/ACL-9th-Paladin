import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import field from "../src/data/field-model.json" with { type: "json" };
import races from "../src/data/races.json" with { type: "json" };
import {
  FIELD_FEATURES,
  FIELD_META,
  FIELD_PARITY,
  FIELD_RACES,
  actualSetStanding,
  analyseField,
  fieldUtility,
  podiumDistribution,
  podiumSets,
  top3Marginals,
} from "../src/lib/fieldModel.ts";

const detail = (id: number) => JSON.parse(readFileSync(new URL(`../public/data/races/${id}.json`, import.meta.url), "utf8")) as { entries: { d: number; x: (number | null)[]; pos: number | null }[] };

test("the exported field model uses the same 16 inputs, in the same order, as the selected classifier", () => {
  const model = JSON.parse(readFileSync(new URL("../src/data/model.json", import.meta.url), "utf8"));
  assert.deepEqual([...FIELD_FEATURES], model.features);
  assert.equal(field.weights.length, 16);
  assert.deepEqual(field.median, model.median);
  assert.deepEqual(field.mean, model.mean);
  assert.deepEqual(field.scale, model.scale);
  assert.equal(field.status, "experimental");
});

test("inputs that are constant within a race carry no weight, because they cancel from a within-race draw", () => {
  for (const name of FIELD_META.raceConstantFeatures) assert.ok(Math.abs(field.weights[FIELD_FEATURES.indexOf(name)]) < 1e-6, `${name}`);
});

test("the browser reproduces the Python podium probabilities for the races the exporter saved", () => {
  assert.ok(FIELD_PARITY.length >= 3);
  let worst = 0;
  for (const sample of FIELD_PARITY) {
    const entries = detail(sample.raceId).entries;
    // The exporter lists drivers in finishing order; the race file may order them differently, so match by driver id.
    const byDriver = new Map(entries.map((entry) => [entry.d, entry]));
    const ordered = sample.drivers.map((id) => byDriver.get(id)!);
    const analysis = analyseField(ordered.map((entry) => entry.x));
    sample.drivers.forEach((_, i) => (worst = Math.max(worst, Math.abs(analysis.marginal[i] - sample.marginal[i]))));
  }
  assert.ok(worst < 2e-6, `largest difference from Python: ${worst}`);
});

test("the distribution is exact: it sums to one, marginals sum to three, and a better driver is never less likely", () => {
  const utilities = [2.1, 1.3, 0.4, 0, -0.7, -1.5, 0.9];
  const n = utilities.length;
  const distribution = podiumDistribution(utilities);
  assert.ok(Math.abs(distribution.reduce((a, b) => a + b, 0) - 1) < 1e-12);
  const marginal = top3Marginals(distribution, n);
  assert.ok(Math.abs(marginal.reduce((a, b) => a + b, 0) - 3) < 1e-12);
  const order = utilities.map((u, i) => [u, i]).sort((a, b) => b[0] - a[0]).map(([, i]) => i);
  for (let i = 1; i < order.length; i += 1) assert.ok(marginal[order[i - 1]] >= marginal[order[i]]);
  for (let a = 0; a < n; a += 1) assert.equal(distribution[(a * n + a) * n + a], 0);
  const sets = podiumSets(distribution, n);
  assert.equal(sets.length, 35, "7 choose 3");
  assert.ok(Math.abs(sets.reduce((sum, set) => sum + set.probability, 0) - 1) < 1e-12);
  for (let i = 1; i < sets.length; i += 1) assert.ok(sets[i - 1].probability >= sets[i].probability);
});

test("equal drivers give a uniform podium and a three-car field puts everyone on it", () => {
  const uniform = podiumDistribution([0, 0, 0, 0, 0]);
  const marginal = top3Marginals(uniform, 5);
  for (const value of marginal) assert.ok(Math.abs(value - 3 / 5) < 1e-12);
  const three = top3Marginals(podiumDistribution([0.4, -0.2, 1.1]), 3);
  for (const value of three) assert.ok(Math.abs(value - 1) < 1e-12);
  assert.throws(() => podiumDistribution([0, 1]));
});

test("a missing input is filled with the training median, exactly as in the classifier", () => {
  const row = Array.from({ length: 16 }, (_, i) => field.median[i]);
  // Standardisation subtracts the training mean, not the median, so this is not zero; it is the explicit formula.
  const expected = field.weights.reduce((sum, w, i) => sum + ((field.median[i] - field.mean[i]) / field.scale[i]) * w, 0);
  assert.ok(Math.abs(fieldUtility(row) - expected) < 1e-12);
  const holes = row.map((_, i) => (i % 2 ? null : row[i]));
  assert.ok(Math.abs(fieldUtility(holes) - fieldUtility(row)) < 1e-12, "a missing input behaves exactly like the median");
  const first = [...row];
  first[0] = (field.median[0] as number) + 3;
  assert.ok(Math.abs(fieldUtility(first) - fieldUtility(row) - (3 / field.scale[0]) * field.weights[0]) < 1e-12);
});

test("the real podium is located among all possible sets", () => {
  const entries = detail(races[0].id).entries;
  const analysis = analyseField(entries.map((entry) => entry.x));
  const actual = entries.map((entry, i) => [entry, i] as const).filter(([entry]) => entry.pos !== null && entry.pos <= 3).map(([, i]) => i);
  const standing = actualSetStanding(analysis, actual)!;
  assert.equal(standing.of, (entries.length * (entries.length - 1) * (entries.length - 2)) / 6);
  assert.ok(standing.rank >= 1 && standing.rank <= standing.of);
  assert.equal(analysis.sets[standing.rank - 1].probability, standing.probability);
  assert.equal(actualSetStanding(analysis, [999, 998, 997]), null);
  assert.ok(analysis.effectiveSets >= 1 && analysis.effectiveSets <= standing.of);
});

test("the exported per-race hits agree with the races shipped to the site, and the aggregate is honest", () => {
  assert.equal(FIELD_RACES.length, 68);
  for (const race of FIELD_RACES) {
    const meta = races.find((candidate) => candidate.id === race.id)!;
    assert.equal(race.hits, race.top3.filter((id) => meta.actual.includes(id)).length, `race ${race.id}`);
  }
  const total = FIELD_RACES.reduce((sum, race) => sum + race.hits, 0);
  assert.equal(total, FIELD_META.test.totalHits.fieldModel);
  assert.equal(FIELD_META.test.totalHits.logistic, races.reduce((sum, race) => sum + race.hits, 0));
  assert.equal(FIELD_META.test.totalHits.grid, races.reduce((sum, race) => sum + race.baselineHits, 0));
  // The headline claim the page makes must be backed by the intervals, not by the point estimates.
  const { fieldModelMinusLogistic: vsLogistic, fieldModelMinusGrid: vsGrid } = FIELD_META.test.pairedBootstrapHits;
  assert.ok(vsLogistic.lower <= 0 && vsLogistic.upper >= 0, "no detectable difference in names per race against the logistic");
  assert.ok(vsGrid.lower <= 0 && vsGrid.upper >= 0, "no detectable difference in names per race against the grid");
});
