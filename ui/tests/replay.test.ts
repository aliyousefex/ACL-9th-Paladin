import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { buildReplay, pointAt } from "../src/features/race/replay.ts";

function load(id: number) {
  return JSON.parse(readFileSync(new URL(`../public/data/races/${id}.json`, import.meta.url), "utf8"));
}

function model(id: number, lapLengthM: number) {
  const race = load(id);
  const meta = race.entries.map((e: { d: number; x: (number | null)[]; txt: string }) => ({
    id: e.d,
    slot: e.x[0],
    running: /^\d+$/.test(e.txt),
    pits: (race.pits[String(e.d)] ?? []).map(([lap]: [number]) => lap),
  }));
  return { race, replay: buildReplay(race.laps.d, meta, race.laps.n, lapLengthM) };
}

test("at the end of a normal race the running order is the classification", () => {
  const { race, replay } = model(1121, 5412); // Bahrain 2024
  const states = replay.stateAt(replay.duration);
  const order = [...states].sort((a, b) => b.distance - a.distance).map((s) => s.id);
  const classified = race.entries
    .filter((e: { txt: string }) => /^\d+$/.test(e.txt))
    .sort((a: { pos: number }, b: { pos: number }) => a.pos - b.pos)
    .map((e: { d: number }) => e.d);
  assert.deepEqual(order.slice(0, 10), classified.slice(0, 10));
});

test("cars start behind the line and the lap counter starts at the first lap", () => {
  const { replay } = model(1121, 5412);
  const states = replay.stateAt(0);
  for (const s of states) {
    assert.ok(s.s !== null && s.s > 0.9, "a car on the grid sits just before the start line");
    assert.equal(s.k, 0);
  }
  assert.equal(replay.leaderAt(0).completed, 0);
});

test("a red-flag lap is detected, a normal race has none", () => {
  const monaco = model(1128, 3337); // Monaco 2024: red flag on the first lap
  assert.equal(monaco.replay.stoppageAt(100), true);
  assert.equal(monaco.replay.stoppageAt(monaco.replay.duration - 5), false);
  const bahrain = model(1121, 5412);
  assert.equal(bahrain.replay.stoppageAt(1000), false);
});

test("drivers without lap data are skipped", () => {
  const { race, replay } = model(1128, 3337);
  const noLaps = race.entries.filter((e: { d: number }) => !race.laps.d[String(e.d)]);
  assert.ok(noLaps.length > 0, "Monaco 2024 has drivers who crashed on lap 1 with no lap time");
  for (const e of noLaps) assert.ok(!replay.drivers.some((d) => d.id === e.d));
});

test("a retirement with recorded laps stops being drawn after its last lap", () => {
  const ids = Array.from({ length: 71 }, (_, i) => 1074 + i);
  for (const id of ids) {
    let race;
    try {
      race = load(id);
    } catch {
      continue;
    }
    const retired = race.entries.find((e: { d: number; txt: string }) => e.txt === "R" && race.laps.d[String(e.d)]);
    if (!retired) continue;
    const { replay } = model(id, 5000);
    const state = replay.stateAt(replay.duration).find((s) => s.id === retired.d)!;
    assert.equal(state.out, true);
    assert.equal(state.s, null);
    return;
  }
  assert.fail("no retirement with lap data found in the test seasons");
});

test("points on the track are interpolated between equally spaced samples", () => {
  const square: [number, number][] = [[0, 0], [10, 0], [10, 10], [0, 10]];
  const mid = pointAt(square, 0.125);
  assert.ok(Math.abs(mid.x - 5) < 1e-9 && Math.abs(mid.y) < 1e-9);
  const wrapped = pointAt(square, 1.125);
  assert.ok(Math.abs(wrapped.x - 5) < 1e-9);
});
