import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { brierScore, comparePitLoss, forecast, resolveScenarioDriverId } from "../src/features/decision/forecast.ts";
import { buildLedger, stateAt } from "../src/features/decision/ledger.ts";
import type { Row } from "../src/features/race/rows.ts";

const detail = JSON.parse(readFileSync(new URL("../public/data/races/1096.json", import.meta.url), "utf8"));
const rows = detail.entries.map((entry: { d: number; p: number; x: (number | null)[]; pos: number | null; txt: string; status: string }) => ({
  entry,
  driver: { id: entry.d, last: `D${entry.d}` },
  team: {}, colour: "#fff", ink: "#000", score: entry.p, rank: 0,
  grid: entry.x[0], finish: entry.pos, podium: entry.pos !== null && entry.pos <= 3,
})) as unknown as Row[];

test("the temporal ledger never exposes an event after its information cutoff", () => {
  const ledger = buildLedger(1096, detail, rows);
  for (let cutoff = 0; cutoff <= ledger.trace.totalLaps; cutoff++) {
    const state = stateAt(ledger, cutoff);
    assert.ok(state.events.every((event) => event.lap <= cutoff && event.provenance.availableLap <= cutoff));
    assert.equal(state.cutoffLap, cutoff);
  }
  assert.throws(() => stateAt(ledger, -1), /outside/);
  assert.throws(() => stateAt(ledger, ledger.trace.totalLaps + 1), /outside/);
});

test("state reconstruction is monotonic and keeps provenance on every fact", () => {
  const ledger = buildLedger(1096, detail, rows);
  let count = 0;
  for (let lap = 0; lap <= ledger.trace.totalLaps; lap++) {
    const state = stateAt(ledger, lap);
    assert.ok(state.events.length >= count);
    count = state.events.length;
    for (const event of state.events) {
      assert.equal(event.provenance.ingestedAt, "build-time");
      assert.ok(["recorded", "derived"].includes(event.provenance.kind));
    }
  }
});

test("the outcome baseline produces coherent ranking distributions", () => {
  const state = stateAt(buildLedger(1096, detail, rows), 0);
  const result = forecast(rows, state, 42, 1000);
  assert.equal(result.drivers.length, rows.filter((row) => row.grid !== null).length);
  for (const driver of result.drivers) {
    assert.ok(Math.abs(driver.positions.reduce((a, b) => a + b, 0) - 1) < 1e-12);
    assert.ok(driver.win >= 0 && driver.win <= driver.podium && driver.podium <= 1);
    assert.ok(driver.expectedPosition >= 1 && driver.expectedPosition <= result.drivers.length);
  }
  for (let position = 0; position < result.drivers.length; position++) {
    assert.ok(Math.abs(result.drivers.reduce((sum, driver) => sum + driver.positions[position], 0) - 1) < 1e-12);
  }
});

test("scenario comparison is reproducible and a larger assumed loss cannot help", () => {
  const state = stateAt(buildLedger(1096, detail, rows), 10);
  const driverId = state.drivers.find((driver) => driver.running && driver.position !== null)!.driverId;
  const a = comparePitLoss(rows, state, driverId, 5, 99, 1200);
  const b = comparePitLoss(rows, state, driverId, 5, 99, 1200);
  assert.deepEqual(a, b);
  assert.ok(a.alternative.expectedPosition >= a.reference.expectedPosition);
  assert.ok(a.alternative.podium <= a.reference.podium);
});

test("proper scoring rejects malformed probabilities and computes known values", () => {
  assert.equal(brierScore([0, 1, 0.5], [false, true, true]), 1 / 12);
  assert.throws(() => brierScore([1.2], [true]), /outside/);
  assert.throws(() => brierScore([], []), /non-zero/);
});

test("scenario controls fall back safely after the investigated driver retires", () => {
  const state = stateAt(buildLedger(1096, detail, rows), 20);
  const retired = state.drivers.find((driver) => !driver.running);
  if (!retired) return;
  const resolved = resolveScenarioDriverId(state, retired.driverId);
  assert.notEqual(resolved, retired.driverId);
  assert.ok(state.drivers.some((driver) => driver.driverId === resolved && driver.running));
});
