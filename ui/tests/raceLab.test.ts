import assert from "node:assert/strict";
import test from "node:test";
import { advanceLabLap, finishLabRace, initialLabRace, modelBattle, orderLab, setPlayerStrategy, strengthOf, type LabConfig, type LabEntrant } from "../src/features/raceLab/engine.ts";
import { decodeLabShare, encodeLabShare } from "../src/features/raceLab/share.ts";

const entrants: LabEntrant[] = Array.from({ length: 10 }, (_, index) => ({
  id: 100 + index, code: `D${index}`, name: `Driver ${index}`, team: `Team ${index % 5}`, colour: "#cc0000", grid: index + 1,
  coursework: 0.92 - index * 0.075, researchPosition: index % 2 ? 10 - index : index + 1, researchPodium: 0.8 - index * 0.07, reliability: index === 9 ? 0.9 : 0.03,
}));
const config: LabConfig = { raceId: 1, raceName: "Test Grand Prix", year: 2024, laps: 12, seed: 903, model: "hybrid", mode: "strategist", controlledId: 100, entrants };

test("Race Lab rejects duplicate or undersized fields", () => {
  assert.throws(() => initialLabRace({ ...config, entrants: entrants.slice(0, 5) }), /at least six/);
  assert.throws(() => initialLabRace({ ...config, entrants: [...entrants.slice(0, 9), entrants[0]] }), /Duplicate/);
});

test("the same configuration and seed always produce the same complete race", () => {
  assert.deepEqual(finishLabRace(initialLabRace(config)), finishLabRace(initialLabRace(config)));
});

test("every completed classification is unique and internally consistent", () => {
  const result = finishLabRace(initialLabRace(config));
  const order = orderLab(result);
  assert.equal(result.lap, config.laps);
  assert.equal(new Set(order.map((car) => car.id)).size, entrants.length);
  assert.ok(order.every((car) => car.retired || car.finished));
  assert.ok(result.events.every((event) => event.lap >= 0 && event.lap <= config.laps && event.simulated));
});

test("pit calls cost time and are represented as structured events", () => {
  let pitted = initialLabRace(config);
  pitted = setPlayerStrategy(pitted, { pitLap: 1 });
  const noPit = setPlayerStrategy(initialLabRace(config), { pitLap: null });
  const pittedLap = advanceLabLap(pitted);
  const cleanLap = advanceLabLap(noPit);
  assert.ok(pittedLap.cars[0].totalMs - cleanLap.cars[0].totalMs > 20_000);
  assert.ok(pittedLap.events.some((event) => event.kind === "pit" && event.driverId === 100));
});

test("strategy actions have measurable pace and risk effects", () => {
  const attack = advanceLabLap(setPlayerStrategy(initialLabRace(config), { pace: "attack", pitLap: null }));
  const conserve = advanceLabLap(setPlayerStrategy(initialLabRace(config), { pace: "conserve", pitLap: null }));
  assert.ok((attack.cars[0].lastLapMs ?? Infinity) < (conserve.cars[0].lastLapMs ?? 0));
});

test("model adapters genuinely use different supported inputs", () => {
  const driver = entrants[1];
  const values = [strengthOf(driver, "grid", entrants.length), strengthOf(driver, "coursework", entrants.length), strengthOf(driver, "research", entrants.length), strengthOf(driver, "hybrid", entrants.length)];
  assert.ok(new Set(values.map((value) => value.toFixed(6))).size >= 3);
  const battle = modelBattle(config);
  assert.equal(battle.length, 4);
  assert.ok(battle.every((run) => run.podium.length === 3));
});

test("Race Lab scenario links round-trip without outcome data", () => {
  const value = { raceId: 1144, laps: 18, seed: 42, model: "research" as const, mode: "strategist" as const, controlledId: 815, drivers: [1, 4, 815], grid: [815, 1, 4] };
  assert.deepEqual(decodeLabShare(encodeLabShare(value)), value);
  assert.ok(!encodeLabShare(value).includes("winner"));
});

test("malformed shared fields are bounded before setup uses them", () => {
  const parsed = decodeLabShare("?r=x&l=999999999&s=-4&m=magic&o=wrong&d=1.1.-2.nope.3&g=3.3.1");
  assert.equal(parsed.raceId, undefined);
  assert.equal(parsed.model, undefined);
  assert.equal(parsed.mode, undefined);
  assert.deepEqual(parsed.drivers, [1, 3]);
  assert.deepEqual(parsed.grid, [3, 1]);
});

test("full grids finish within a bounded runtime", () => {
  const field = Array.from({ length: 20 }, (_, index) => ({ ...entrants[index % entrants.length], id: 200 + index, grid: index + 1 }));
  const start = performance.now();
  finishLabRace(initialLabRace({ ...config, entrants: field, laps: 60 }));
  assert.ok(performance.now() - start < 1000);
});
