import assert from "node:assert/strict";
import { test } from "node:test";
import { simulate, type SimEntry } from "../src/features/simulation/engine.ts";
import {
  DEFAULT_RELIABILITY,
  DEFAULT_SEED,
  MAX_RELIABILITY,
  MAX_SEED,
  defaultScenario,
  parseScenario,
  pitLapRange,
  serializeScenario,
  type Scenario,
} from "../src/features/simulation/scenario.ts";

const LAPS = 30;
const DRIVERS = [830, 844, 832, 1, 815];
const base = defaultScenario(LAPS, 830);
const parse = (query: string) => parseScenario(query, LAPS, DRIVERS, base);

test("the default scenario is a mid-race stop in the dry with the documented seed", () => {
  assert.equal(base.weather, "dry");
  assert.equal(base.seed, DEFAULT_SEED);
  assert.equal(base.reliability, DEFAULT_RELIABILITY);
  assert.equal(base.safetyCarLap, null);
  assert.equal(base.pitLap, Math.round(LAPS * 0.48));
  const range = pitLapRange(LAPS);
  assert.ok(base.pitLap >= range.min && base.pitLap <= range.max);
});

test("a scenario survives a round trip through its URL unchanged", () => {
  const scenarios: Scenario[] = [
    base,
    { driverId: 844, compound: "soft", secondCompound: "intermediate", aggression: "attack", pitLap: 9, safetyCarLap: 17, seed: 12345, weather: "wet", reliability: 0.25 },
    { driverId: 1, compound: "hard", secondCompound: "hard", aggression: "save", pitLap: 3, safetyCarLap: null, seed: 1, weather: "mixed", reliability: 0 },
    { driverId: 815, compound: "medium", secondCompound: "soft", aggression: "balanced", pitLap: 28, safetyCarLap: 29, seed: MAX_SEED, weather: "dry", reliability: MAX_RELIABILITY },
  ];
  for (const scenario of scenarios) {
    assert.deepEqual(parse(serializeScenario(scenario)), scenario);
  }
});

test("the link format is stable: fixed order, the original parameter names, safety only when set", () => {
  assert.equal(
    serializeScenario({ driverId: 844, compound: "soft", secondCompound: "hard", aggression: "attack", pitLap: 12, safetyCarLap: null, seed: 7, weather: "dry", reliability: 0.08 }),
    "simDriver=844&compound=soft&second=hard&pace=attack&pit=12&seed=7&weather=dry&risk=0.08",
  );
  assert.ok(serializeScenario({ ...base, safetyCarLap: 15 }).endsWith("&safety=15"));
  // A link shared before this codec existed still means the same thing.
  const legacy = parse("simDriver=844&compound=soft&second=hard&pace=attack&pit=12&seed=7&weather=wet&risk=0.2&safety=18");
  assert.deepEqual(legacy, { driverId: 844, compound: "soft", secondCompound: "hard", aggression: "attack", pitLap: 12, safetyCarLap: 18, seed: 7, weather: "wet", reliability: 0.2 });
});

test("values that mean zero are kept, not mistaken for missing", () => {
  assert.equal(parse("risk=0").reliability, 0);
  assert.equal(parse("risk=0.0").reliability, 0);
  assert.equal(parse("safety=0").safetyCarLap, null);
});

test("numbers are clamped to what the simulated race can model", () => {
  const range = pitLapRange(LAPS);
  assert.equal(parse("pit=0").pitLap, range.min);
  assert.equal(parse("pit=9999").pitLap, range.max);
  assert.equal(parse("safety=9999").safetyCarLap, LAPS - 1);
  assert.equal(parse("risk=5").reliability, MAX_RELIABILITY);
  assert.equal(parse("seed=0").seed, 1, "seed 0 would alias seed 1 in the generator");
  assert.equal(parse(`seed=${MAX_SEED + 10}`).seed, MAX_SEED);
});

test("anything that is not a plain number is ignored and the default stays", () => {
  for (const bad of ["abc", "", "-5", "1e3", "0x10", "NaN", "Infinity", "12abc", "1.5", "--3", "9".repeat(40)]) {
    assert.equal(parse(`pit=${encodeURIComponent(bad)}`).pitLap, base.pitLap, `pit=${bad}`);
    assert.equal(parse(`seed=${encodeURIComponent(bad)}`).seed, base.seed, `seed=${bad}`);
    assert.equal(parse(`safety=${encodeURIComponent(bad)}`).safetyCarLap, null, `safety=${bad}`);
  }
  for (const bad of ["abc", "-0.1", "NaN", "Infinity", "1e-2", ".", "0.1.2"]) {
    assert.equal(parse(`risk=${encodeURIComponent(bad)}`).reliability, base.reliability, `risk=${bad}`);
  }
});

test("unknown compounds, paces and weather fall back, and a driver not in the race is ignored", () => {
  const out = parse("compound=ultrasoft&second=wets&pace=maximum&weather=snow&simDriver=999999");
  assert.equal(out.compound, base.compound);
  assert.equal(out.secondCompound, base.secondCompound);
  assert.equal(out.aggression, base.aggression);
  assert.equal(out.weather, base.weather);
  assert.equal(out.driverId, base.driverId);
  assert.equal(parse("simDriver=832").driverId, 832);
  assert.equal(parse("simDriver=-3").driverId, base.driverId);
});

test("a leading question mark, a URLSearchParams object, and extra parameters are all handled", () => {
  assert.equal(parse("?seed=77&utm=x").seed, 77);
  assert.equal(parseScenario(new URLSearchParams({ seed: "78" }), LAPS, DRIVERS, base).seed, 78);
});

test("the same link always reproduces the same synthetic run", () => {
  const entries: SimEntry[] = DRIVERS.map((id, i) => ({ id, grid: i + 1, score: 0.9 - i * 0.15 }));
  const link = serializeScenario({ driverId: 832, compound: "soft", secondCompound: "hard", aggression: "attack", pitLap: 11, safetyCarLap: 19, seed: 4242, weather: "mixed", reliability: 0.1 });
  const run = (scenario: Scenario) =>
    simulate(entries, {
      laps: LAPS,
      seed: scenario.seed,
      safetyCarLap: scenario.safetyCarLap,
      selectedId: scenario.driverId,
      selected: { compound: scenario.compound, secondCompound: scenario.secondCompound, aggression: scenario.aggression, pitLap: scenario.pitLap },
      weather: scenario.weather,
      reliabilityRisk: scenario.reliability,
    });
  const first = run(parse(link));
  assert.deepEqual(run(parse(link)), first);
  // A different seed in the link is a different run, so the seed is genuinely the only source of variation.
  assert.notDeepEqual(run(parse(link.replace("seed=4242", "seed=4243"))), first);
});
