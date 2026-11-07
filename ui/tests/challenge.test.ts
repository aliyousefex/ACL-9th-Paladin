import assert from "node:assert/strict";
import { test } from "node:test";
import { parsePick, pickUniform, scoreChallenge } from "../src/lib/challenge.ts";

test("a pick scores one point per driver who finished on the podium, in any order", () => {
  const actual = [830, 844, 832];
  assert.equal(scoreChallenge([832, 830, 844], actual), 3);
  assert.equal(scoreChallenge([830, 1, 2], actual), 1);
  assert.equal(scoreChallenge([1, 2, 3], actual), 0);
});

test("finishing order is not scored", () => {
  const actual = [1, 2, 3];
  assert.equal(scoreChallenge([3, 2, 1], actual), scoreChallenge([1, 2, 3], actual));
});

test("a repeated driver can never score twice", () => {
  assert.equal(scoreChallenge([830, 830, 830], [830, 844, 832]), 1);
});

test("stored picks are accepted only when exactly three distinct whole-number ids", () => {
  assert.deepEqual(parsePick('{"ids":[1,2,3],"submittedAt":"2025-01-01T00:00:00.000Z"}'), { ids: [1, 2, 3], submittedAt: "2025-01-01T00:00:00.000Z" });
  assert.equal(parsePick(null), null);
  assert.equal(parsePick(""), null);
  assert.equal(parsePick("not json"), null);
  assert.equal(parsePick('{"ids":[1,2]}'), null);
  assert.equal(parsePick('{"ids":[1,2,3,4]}'), null);
  assert.equal(parsePick('{"ids":[1,1,2]}'), null);
  assert.equal(parsePick('{"ids":["1","2","3"]}'), null);
  assert.equal(parsePick('{"ids":[1.5,2,3]}'), null);
  assert.equal(parsePick("null"), null);
  assert.equal(parsePick("[]"), null);
});

test("surprise me is uniform over every item and never looks at the items themselves", () => {
  const races = Array.from({ length: 68 }, (_, i) => ({ id: i, hits: i % 4 }));
  // Same random draw, same index, whatever the item's contents are.
  assert.equal(pickUniform(races, () => 0)?.id, 0);
  assert.equal(pickUniform(races, () => 0.5)?.id, 34);
  assert.equal(pickUniform(races, () => 0.999999)?.id, 67);
  // Out-of-range draws are clamped rather than returning undefined.
  assert.equal(pickUniform(races, () => 1)?.id, 67);
  assert.equal(pickUniform(races, () => -1)?.id, 0);
  assert.equal(pickUniform([], () => 0.5), undefined);
  // Every race is reachable and equally likely: a deterministic sweep hits each index exactly once.
  const seen = new Set<number>();
  for (let i = 0; i < races.length; i++) seen.add(pickUniform(races, () => (i + 0.5) / races.length)!.id);
  assert.equal(seen.size, 68);
});
