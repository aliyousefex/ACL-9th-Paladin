import assert from "node:assert/strict";
import { test } from "node:test";
import { comparePitWindow, monteCarlo, simulate, type SimEntry } from "../src/features/simulation/engine.ts";
import { winningOption } from "../src/features/simulation/pitWallScore.ts";
import { advanceAttack, curvatureAt, ghostProgressAt, ghostTimeAt, initialAttackState } from "../src/features/games/driving.ts";
import { podiumHits, sprintRaces } from "../src/features/games/podiumScoring.ts";

const entries: SimEntry[] = [
  { id: 1, grid: 1, score: 0.9 },
  { id: 2, grid: 2, score: 0.8 },
  { id: 3, grid: 8, score: 0.7 },
  { id: 4, grid: 12, score: 0.2 },
];

test("simulation is deterministic for a seed", () => {
  const config = { laps: 20, seed: 42, safetyCarLap: null, selectedId: 3, selected: { compound: "medium", pitLap: 10, aggression: "balanced" } as const };
  assert.deepEqual(simulate(entries, config), simulate(entries, config));
});

test("a pit stop is recorded and costs time", () => {
  const base = { laps: 12, seed: 9, safetyCarLap: null, selectedId: 1 };
  const noStop = simulate(entries, { ...base, selected: { compound: "medium", pitLap: null, aggression: "balanced" } });
  const stop = simulate(entries, { ...base, selected: { compound: "medium", pitLap: 6, aggression: "balanced" } });
  assert.ok(stop.elapsed[1] > noStop.elapsed[1] + 15);
  assert.ok(stop.states[6].pitted.includes(1));
});

test("monte carlo summary stays within valid finish positions", () => {
  const summary = monteCarlo(entries, { laps: 15, seed: 7, safetyCarLap: 8, selectedId: 3, selected: { compound: "soft", pitLap: 7, aggression: "attack" } }, 40);
  assert.ok(summary.podiumRate >= 0 && summary.podiumRate <= 1);
  assert.ok(summary.best >= 1 && summary.worst <= entries.length);
});

test("pit window comparison keeps the seed and changes only the stop lap", () => {
  const compared = comparePitWindow(entries, { laps: 24, seed: 12, safetyCarLap: null, selectedId: 3, selected: { compound: "medium", pitLap: 12, aggression: "balanced" } }, 25);
  assert.deepEqual(compared.map((item) => item.pitLap), [8, 12, 16]);
  assert.deepEqual(compared.map((item) => item.label), ["undercut", "baseline", "overcut"]);
  assert.ok(compared.every((item) => item.meanFinish >= 1 && item.meanFinish <= entries.length));
});

test("intermediates outperform slicks in a wet synthetic scenario", () => {
  const base = { laps: 16, seed: 88, safetyCarLap: null, selectedId: 1, weather: "wet" as const };
  const slick = simulate(entries, { ...base, selected: { compound: "soft", pitLap: 8, aggression: "balanced" } });
  const intermediate = simulate(entries, { ...base, selected: { compound: "intermediate", pitLap: 8, aggression: "balanced" } });
  assert.ok(intermediate.elapsed[1] < slick.elapsed[1]);
});

test("a second compound takes effect after the selected pit lap", () => {
  const base = { laps: 20, seed: 44, safetyCarLap: null, selectedId: 1, weather: "mixed" as const };
  const slicks = simulate(entries, { ...base, selected: { compound: "soft", secondCompound: "soft", pitLap: 10, aggression: "balanced" } });
  const crossover = simulate(entries, { ...base, selected: { compound: "soft", secondCompound: "intermediate", pitLap: 10, aggression: "balanced" } });
  assert.ok(crossover.elapsed[1] < slicks.elapsed[1]);
});

test("reliability risk can produce a deterministic synthetic retirement", () => {
  const result = simulate(entries, { laps: 20, seed: 21, safetyCarLap: null, selectedId: 2, reliabilityRisk: 1, selected: { compound: "medium", secondCompound: "hard", pitLap: 10, aggression: "balanced" } });
  assert.ok(result.retiredAt[2] >= 3);
  assert.equal(result.order.at(-1), 2);
  assert.ok(result.states.at(-1)!.retired.includes(2));
});

test("pit wall scoring prefers mean finish and uses podium rate as its tiebreak", () => {
  assert.equal(winningOption([{ id: "box", meanFinish: 5.2, podiumRate: 0.2 }, { id: "stay", meanFinish: 6.1, podiumRate: 0.4 }]), "box");
  assert.equal(winningOption([{ id: "box", meanFinish: 5.2, podiumRate: 0.3 }, { id: "stay", meanFinish: 5.2, podiumRate: 0.4 }]), "stay");
});

test("track attack advances deterministically and penalizes excess corner speed", () => {
  const straight = Array.from({ length: 100 }, (_, index) => [index, 0] as [number, number]);
  const advanced = advanceAttack({ ...initialAttackState(), progress: 0.5 }, true, straight, 0.2);
  assert.ok(advanced.progress > 0);
  assert.equal(advanced.incidents, 0);

  const corner = Array.from({ length: 100 }, (_, index) => index < 50 ? [index, 0] as [number, number] : [49, index - 49] as [number, number]);
  const fast = { ...initialAttackState(), speed: 0.14, progress: 0.5 };
  const penalized = advanceAttack(fast, true, corner, 0.05);
  assert.ok(curvatureAt(corner, 0.5) > 0.5);
  assert.equal(penalized.penalty, 1.5);
});

test("personal ghost interpolates progress and time", () => {
  const trace = [{ time: 0, progress: 0 }, { time: 5, progress: 0.4 }, { time: 10, progress: 1 }];
  assert.equal(ghostProgressAt(trace, 2.5), 0.2);
  assert.equal(ghostTimeAt(trace, 0.7), 7.5);
  assert.equal(ghostProgressAt(trace, 20), 1);
});

test("podium sprint samples the season evenly and scores membership", () => {
  const races = Array.from({ length: 21 }, (_, index) => ({ id: index })) as unknown as Parameters<typeof sprintRaces>[0];
  assert.deepEqual(sprintRaces(races).map((race) => race.id), [0, 5, 10, 15, 20]);
  assert.equal(podiumHits([1, 2, 7], [2, 3, 7]), 2);
});
