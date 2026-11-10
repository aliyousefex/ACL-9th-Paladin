import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { buildLedger } from "../src/features/decision/ledger.ts";
import { detectMoments } from "../src/features/decision/moments.ts";
import type { Row } from "../src/features/race/rows.ts";

const detail = JSON.parse(readFileSync(new URL("../public/data/races/1096.json", import.meta.url), "utf8"));
const rows = detail.entries.map((entry: { d: number; p: number; x: (number | null)[]; pos: number | null; txt: string; status: string }) => ({
  entry, driver: { id: entry.d }, team: {}, colour: "", ink: "", score: entry.p,
  rank: 0, grid: entry.x[0], finish: entry.pos, podium: entry.pos !== null && entry.pos <= 3,
})) as unknown as Row[];

test("decision moments are deterministic, evidence-backed and inside the race", () => {
  const ledger = buildLedger(1096, detail, rows);
  const first = detectMoments(ledger, rows);
  const second = detectMoments(ledger, rows);
  assert.deepEqual(first, second);
  assert.ok(first.length > 0 && first.length <= 8);
  for (const moment of first) {
    assert.ok(moment.lap > 0 && moment.lap <= ledger.trace.totalLaps);
    assert.ok(moment.importance >= 0);
    assert.ok(moment.evidence.length > 0);
    assert.ok(ledger.events.some((event) => event.lap === moment.lap));
  }
});
