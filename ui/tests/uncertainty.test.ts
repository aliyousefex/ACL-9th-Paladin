import assert from "node:assert/strict";
import { test } from "node:test";
import model from "../src/data/model.json" with { type: "json" };
import races from "../src/data/races.json" with { type: "json" };
import { binFor, fieldStability, raceErrorClass, raceValueAgainstGrid, scoreEvidence, wilson } from "../src/lib/uncertainty.ts";

test("the Wilson interval is exact at the edges and contains the observed share", () => {
  const none = wilson(0, 40);
  assert.equal(none.lower, 0);
  assert.ok(none.upper > 0 && none.upper < 0.15, "0 of 40 still leaves a little room above zero");
  const all = wilson(40, 40);
  assert.equal(all.upper, 1);
  assert.ok(all.lower < 1 && all.lower > 0.85);
  for (const [k, n] of [[3, 10], [17, 62], [1, 308], [60, 100]] as const) {
    const { lower, upper } = wilson(k, n);
    assert.ok(lower <= k / n && k / n <= upper, `${k}/${n} sits inside its interval`);
    assert.ok(lower >= 0 && upper <= 1);
  }
  assert.deepEqual(wilson(0, 0), { lower: 0, upper: 1 }, "no sample means no information, not certainty");
});

test("a bigger sample gives a narrower interval at the same share", () => {
  const small = wilson(5, 10);
  const large = wilson(500, 1000);
  assert.ok(large.upper - large.lower < small.upper - small.lower);
});

test("pre-race evidence comes only from the validation seasons, never from the race being shown", () => {
  const validation = model.reliability.validation;
  for (const score of [0.01, 0.15, 0.42, 0.66, 0.93, 1]) {
    const evidence = scoreEvidence(score);
    const bin = binFor(score);
    assert.equal(evidence.source, "validation 2020-21");
    assert.ok(validation.some((candidate) => candidate.lo === bin.lo && candidate.n === bin.n), "the bin is a validation bin");
    assert.equal(evidence.sample, bin.n);
    assert.ok(evidence.lower <= evidence.observedRate && evidence.observedRate <= evidence.upper);
  }
  // A score of exactly 1 belongs to the last bin; the bins must tile [0, 1] with no gaps.
  assert.equal(binFor(1).hi, 1);
  for (let i = 1; i < validation.length; i += 1) assert.equal(validation[i].lo, validation[i - 1].hi);
});

test("thin bands are labelled as limited evidence instead of being presented as stable", () => {
  const thin = model.reliability.validation.find((bin) => bin.n < 35);
  if (thin) assert.equal(scoreEvidence((thin.lo + thin.hi) / 2).label, "limited evidence");
  const wide = scoreEvidence(0.55);
  assert.ok(["limited evidence", "contested", "stable band"].includes(wide.label));
  assert.ok(scoreEvidence(0.02).sample > 100, "the low-score band is large");
});

test("field cut stability is the gap between the third and fourth scores", () => {
  const rows = (...scores: number[]) => scores.map((score) => ({ score }));
  assert.equal(fieldStability(rows(0.9, 0.8, 0.5, 0.49)).label, "fragile cut");
  assert.equal(fieldStability(rows(0.9, 0.8, 0.5, 0.45)).label, "contested cut");
  assert.equal(fieldStability(rows(0.9, 0.8, 0.5, 0.2)).label, "clear cut");
  assert.equal(fieldStability(rows(0.9, 0.8)).label, "fragile cut", "a field too small to compare is not called clear");
  assert.ok(Math.abs(fieldStability(rows(0.9, 0.8, 0.5, 0.45)).margin - 0.05) < 1e-12);
});

test("race outcomes are classified from the exported hit counts and cover every held-out race", () => {
  assert.equal(raceErrorClass({ hits: 3 }), "perfect");
  assert.equal(raceErrorClass({ hits: 2 }), "ordinary");
  assert.equal(raceErrorClass({ hits: 1 }), "major miss");
  assert.equal(raceErrorClass({ hits: 0 }), "major miss");
  assert.equal(raceValueAgainstGrid({ hits: 2, baselineHits: 3 }), -1);
  assert.equal(races.length, 68);
  const classes = new Set(races.map((race) => raceErrorClass(race as { hits: number })));
  assert.ok(classes.size >= 2, "the held-out seasons contain both hits and misses");
});
