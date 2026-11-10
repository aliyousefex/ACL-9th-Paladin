import assert from "node:assert/strict";
import { test } from "node:test";
import { parseSharedDecision, sharedDecisionHash } from "../src/features/decision/share.ts";

test("decision scenarios survive a stable URL round trip", () => {
  const value = { lap: 23, driverId: 1, seconds: -5 };
  const hash = sharedDecisionHash("/race/2022/abu-dhabi", value);
  assert.deepEqual(parseSharedDecision(hash), value);
  assert.equal(hash, "#/race/2022/abu-dhabi?dl=23&dd=1&ds=-5");
});

test("malformed or unsafe scenario parameters are ignored", () => {
  assert.equal(parseSharedDecision("#/race/2022/x"), null);
  assert.equal(parseSharedDecision("#/race/2022/x?dl=-1&dd=1&ds=5"), null);
  assert.equal(parseSharedDecision("#/race/2022/x?dl=1&dd=no&ds=5"), null);
  assert.equal(parseSharedDecision("#/race/2022/x?dl=1&dd=1&ds=999"), null);
});
