import assert from "node:assert/strict";
import test from "node:test";

import advancedIndex from "../src/data/advanced-index.json" with { type: "json" };
import { historicalAnalogues } from "../src/features/decision/analogues.ts";

test("historical analogues are stable, distinct and self-excluding", () => {
  const raceId = advancedIndex[0].id;
  const first = historicalAnalogues(raceId);
  const second = historicalAnalogues(raceId);

  assert.deepEqual(first, second);
  assert.equal(first.length, 3);
  assert.equal(new Set(first.map((item) => item.raceId)).size, 3);
  assert.ok(first.every((item) => item.raceId !== raceId));
  assert.ok(first.every((item) => Number.isFinite(item.distance) && item.distance >= 0));
  assert.ok(first.every((item) => item.reasons.length >= 2));
});

test("every held-out race can be compared without using an outcome field", () => {
  const forbidden = ["winner", "podium", "result", "position"];
  for (const race of advancedIndex) {
    assert.equal(forbidden.some((key) => key in race), false);
    assert.equal(historicalAnalogues(race.id).length, 3);
  }
});
