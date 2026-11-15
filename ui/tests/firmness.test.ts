import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import firmnessCheck from "../src/data/firmness.json" with { type: "json" };
import model from "../src/data/model.json" with { type: "json" };
import races from "../src/data/races.json" with { type: "json" };
import { evaluate } from "../scripts/evaluate-firmness.ts";
import { gaussian, mulberry32 } from "../src/lib/random.ts";
import { HIGH_STABILITY, LOW_STABILITY, NUDGE_SD, firmness, imputedInputs, nudgeLogitSd, topThreeStability, wilson } from "../src/lib/uncertainty.ts";

const NOT_NUDGED = ["pit_lane_start", "front_row", "qualifying_missing", "field_size", "year"];

test("the nudge size is a quarter of a training standard deviation on the inputs that can sensibly move", () => {
  const nudgeable = model.features.map((name, i) => ({ name, w: model.coef[i] })).filter((c) => !NOT_NUDGED.includes(c.name));
  assert.equal(nudgeable.length, 11);
  const expected = NUDGE_SD * Math.sqrt(nudgeable.reduce((sum, c) => sum + c.w * c.w, 0));
  assert.ok(Math.abs(nudgeLogitSd() - expected) < 1e-12);
  assert.ok(nudgeLogitSd() > 0.2 && nudgeLogitSd() < 0.8, `a small nudge, not a rewrite: ${nudgeLogitSd().toFixed(3)} log-odds`);
  assert.equal(nudgeLogitSd(0), 0);
});

test("stability is seeded, shares exactly three places per draw, and follows the order of the scores", () => {
  const logits = [3.1, 2.4, 1.9, 1.7, 0.2, -1, -2];
  const a = topThreeStability(logits);
  assert.deepEqual(a, topThreeStability(logits));
  assert.ok(Math.abs(a.reduce((x, y) => x + y, 0) - 3) < 1e-9, "three names are in the top three in every nudged field");
  for (let i = 1; i < a.length; i += 1) assert.ok(a[i - 1] >= a[i] - 0.02, "a higher score is not less stable");
  assert.ok(a[0] > 0.95 && a[6] < 0.01);
  assert.ok(a[2] > a[3] && a[2] < 0.75, "the third and fourth names are close, so neither is stable");
  const flat = topThreeStability([0, 0, 0, 0, 0, 0], 6000);
  for (const value of flat) assert.ok(Math.abs(value - 0.5) < 0.04);
  assert.deepEqual(topThreeStability([1, 2], 10), [1, 1], "a field of two always has both names in a top three");
});

test("adding one Gaussian to each log-odds is the same as nudging every input, which is the claim the page makes", () => {
  // Independent check: nudge each standardised input of each driver separately and recompute the log-odds.
  const weights = model.coef.map((w, i) => (NOT_NUDGED.includes(model.features[i]) ? 0 : w));
  const base = [2.6, 2.1, 1.8, 1.5, 0.4, -0.9];
  const random = mulberry32(12345);
  const draws = 40000;
  const counts = base.map(() => 0);
  for (let d = 0; d < draws; d += 1) {
    const moved = base.map((logit) => logit + weights.reduce((sum, w) => sum + w * NUDGE_SD * gaussian(random), 0));
    [...moved.keys()].sort((x, y) => moved[y] - moved[x]).slice(0, 3).forEach((i) => (counts[i] += 1));
  }
  const viaInputs = counts.map((c) => c / draws);
  const viaLogit = topThreeStability(base, 40000, 777);
  viaInputs.forEach((value, i) => assert.ok(Math.abs(value - viaLogit[i]) < 0.015, `driver ${i}: ${value.toFixed(3)} vs ${viaLogit[i].toFixed(3)}`));
});

test("the label follows stability and agreement, and only the call is labelled", () => {
  assert.equal(firmness({ inCall: false, stability: 1, fieldAgrees: true }), "outside the call");
  assert.equal(firmness({ inCall: true, stability: HIGH_STABILITY, fieldAgrees: true }), "high confidence");
  assert.equal(firmness({ inCall: true, stability: 0.99, fieldAgrees: false }), "contested", "stable, but the other model does not name them");
  assert.equal(firmness({ inCall: true, stability: HIGH_STABILITY - 0.01, fieldAgrees: true }), "contested");
  assert.equal(firmness({ inCall: true, stability: LOW_STABILITY, fieldAgrees: true }), "contested");
  assert.equal(firmness({ inCall: true, stability: LOW_STABILITY - 0.01, fieldAgrees: true }), "fragile");
  assert.ok(HIGH_STABILITY > LOW_STABILITY);
});

test("missing inputs are named, in the model's own order", () => {
  const row = model.features.map(() => 1) as (number | null)[];
  assert.deepEqual(imputedInputs(row), []);
  row[4] = null;
  row[5] = null;
  assert.deepEqual(imputedInputs(row), ["qualifying_position", "qualifying_time_seconds"]);
  assert.deepEqual(imputedInputs([]), [...model.features], "an empty row has every input missing");
});

test("the saved label check is current and accounts for every pick", () => {
  assert.deepEqual(evaluate(), firmnessCheck, "run `npm run evaluate:firmness` after changing the thresholds, the nudge, or the models");
  const rows = Object.values(firmnessCheck.byLabel);
  assert.equal(rows.reduce((sum, row) => sum + row.picks, 0), 3 * races.length);
  assert.equal(firmnessCheck.picks, 204);
  assert.equal(rows.reduce((sum, row) => sum + row.podiums, 0), races.reduce((sum, race) => sum + race.hits, 0), "podium hits equal the classifier's exported hits");
  assert.equal(firmnessCheck.thresholds.high, HIGH_STABILITY);
  assert.equal(firmnessCheck.thresholds.low, LOW_STABILITY);
});

test("the page may say high-confidence names do better, but must not claim an order between the other two labels", () => {
  const { byLabel } = firmnessCheck as unknown as { byLabel: Record<string, { picks: number; podiums: number }> };
  const high = byLabel["high confidence"];
  const others = { picks: byLabel.contested.picks + byLabel.fragile.picks, podiums: byLabel.contested.podiums + byLabel.fragile.podiums };
  const p1 = high.podiums / high.picks;
  const p2 = others.podiums / others.picks;
  const standardError = Math.sqrt((p1 * (1 - p1)) / high.picks + (p2 * (1 - p2)) / others.picks);
  assert.ok(p1 - p2 - 1.96 * standardError > 0, `the 95% interval for the difference (${(p1 - p2).toFixed(3)} ± ${(1.96 * standardError).toFixed(3)}) excludes zero`);
  const contested = wilson(byLabel.contested.podiums, byLabel.contested.picks);
  const fragile = wilson(byLabel.fragile.podiums, byLabel.fragile.picks);
  assert.ok(contested.lower < fragile.upper && fragile.lower < contested.upper, "contested and fragile intervals overlap, so no order between them is claimed");
});

test("the evaluation script reads only the files the site already ships", () => {
  const text = readFileSync(new URL("../scripts/evaluate-firmness.ts", import.meta.url), "utf8");
  assert.ok(!/fetch\(|https?:\/\//.test(text.replace(/\/\*[\s\S]*?\*\//g, "")), "no network access");
});
