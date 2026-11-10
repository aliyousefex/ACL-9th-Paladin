import assert from "node:assert/strict";
import test from "node:test";

import race from "../public/data/races/1095.json" with { type: "json" };
import { forecastEvolution } from "../src/features/decision/evolution.ts";
import { buildLedger } from "../src/features/decision/ledger.ts";
import type { Row } from "../src/features/race/rows.ts";

test("forecast evolution is ordered, deterministic and cutoff-bounded", () => {
  const rows = race.entries.map((entry) => ({ entry, driver: { id: entry.d, last: `D${entry.d}` }, team: {}, colour: "#fff", ink: "#000", score: entry.p, rank: 0, grid: entry.x[0], finish: entry.pos, podium: entry.pos !== null && entry.pos <= 3 })) as unknown as Row[];
  const ledger = buildLedger(1095, race as never, rows);
  const driverId = rows[0].driver.id;
  const first = forecastEvolution(ledger, rows, driverId, [10, 0, 5, 10]);
  assert.deepEqual(first, forecastEvolution(ledger, rows, driverId, [0, 5, 10]));
  assert.deepEqual(first.map((item) => item.lap), [0, 5, 10]);
  assert.ok(first.every((item) => item.lap <= 10 && item.podium >= 0 && item.podium <= 1));
});
