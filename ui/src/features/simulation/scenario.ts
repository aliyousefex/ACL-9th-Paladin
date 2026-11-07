import type { Aggression, Compound, Weather } from "./engine.ts";

/**
 * Race Lab scenarios as shareable URLs.
 *
 * A scenario is every input the simulation takes, so the same link always reproduces the same synthetic run. The
 * link is read from user-editable text, so each field is validated and clamped to what the engine can model;
 * anything missing or invalid falls back to the default instead of being passed on. Parameter names are the ones
 * links were first shared with, so existing links keep working.
 */

export const COMPOUNDS: readonly Compound[] = ["soft", "medium", "hard", "intermediate"];
export const PACES: readonly Aggression[] = ["save", "balanced", "attack"];
export const WEATHERS: readonly Weather[] = ["dry", "mixed", "wet"];

export const DEFAULT_SEED = 903;
/** The generator treats seed 0 as 1, so seeds start at 1 and every shown seed is a distinct run. */
export const MIN_SEED = 1;
export const MAX_SEED = 2_147_483_647;
export const MAX_RELIABILITY = 0.5;
export const DEFAULT_RELIABILITY = 0.08;
/** The earliest stop and how far from the flag the last stop may be, in laps. */
export const MIN_PIT_LAP = 3;
export const PIT_LAPS_FROM_END = 2;

export interface Scenario {
  driverId: number;
  compound: Compound;
  secondCompound: Compound;
  aggression: Aggression;
  pitLap: number;
  /** Lap of a synthetic safety car, or null for none. */
  safetyCarLap: number | null;
  seed: number;
  weather: Weather;
  /** Chance of a synthetic retirement over the run, 0 to MAX_RELIABILITY. */
  reliability: number;
}

const clamp = (value: number, low: number, high: number) => Math.min(high, Math.max(low, value));

function whole(value: string | null): number | null {
  if (value === null || !/^\s*\d+\s*$/.test(value)) return null;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) ? parsed : null;
}

function fraction(value: string | null): number | null {
  if (value === null || !/^\s*(\d+\.?\d*|\.\d+)\s*$/.test(value)) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function oneOf<T extends string>(value: string | null, allowed: readonly T[]): T | null {
  return value !== null && (allowed as readonly string[]).includes(value) ? (value as T) : null;
}

export function pitLapRange(laps: number): { min: number; max: number } {
  return { min: MIN_PIT_LAP, max: Math.max(MIN_PIT_LAP, laps - PIT_LAPS_FROM_END) };
}

export function defaultScenario(laps: number, driverId: number): Scenario {
  const range = pitLapRange(laps);
  return {
    driverId,
    compound: "medium",
    secondCompound: "hard",
    aggression: "balanced",
    pitLap: clamp(Math.round(laps * 0.48), range.min, range.max),
    safetyCarLap: null,
    seed: DEFAULT_SEED,
    weather: "dry",
    reliability: DEFAULT_RELIABILITY,
  };
}

/**
 * Read a scenario from a query string such as `simDriver=830&pit=14&seed=7`. Unknown or invalid values are ignored
 * (the fallback's value is kept), numbers are clamped to the simulated race, and a driver who is not in this race
 * is ignored.
 */
export function parseScenario(query: string | URLSearchParams, laps: number, drivers: readonly number[], fallback: Scenario): Scenario {
  const params = typeof query === "string" ? new URLSearchParams(query.replace(/^\?/, "")) : query;
  const driver = whole(params.get("simDriver"));
  const pit = whole(params.get("pit"));
  const safety = whole(params.get("safety"));
  const seed = whole(params.get("seed"));
  const risk = fraction(params.get("risk"));
  const range = pitLapRange(laps);
  return {
    driverId: driver !== null && drivers.includes(driver) ? driver : fallback.driverId,
    compound: oneOf(params.get("compound"), COMPOUNDS) ?? fallback.compound,
    secondCompound: oneOf(params.get("second"), COMPOUNDS) ?? fallback.secondCompound,
    aggression: oneOf(params.get("pace"), PACES) ?? fallback.aggression,
    pitLap: pit !== null ? clamp(pit, range.min, range.max) : fallback.pitLap,
    safetyCarLap: safety !== null && safety >= 1 ? clamp(safety, 1, Math.max(1, laps - 1)) : fallback.safetyCarLap,
    seed: seed !== null ? clamp(seed, MIN_SEED, MAX_SEED) : fallback.seed,
    weather: oneOf(params.get("weather"), WEATHERS) ?? fallback.weather,
    reliability: risk !== null ? clamp(risk, 0, MAX_RELIABILITY) : fallback.reliability,
  };
}

/** The query string for a scenario, in a fixed order so the same scenario always gives the same link. */
export function serializeScenario(scenario: Scenario): string {
  const params = new URLSearchParams();
  params.set("simDriver", String(scenario.driverId));
  params.set("compound", scenario.compound);
  params.set("second", scenario.secondCompound);
  params.set("pace", scenario.aggression);
  params.set("pit", String(scenario.pitLap));
  params.set("seed", String(scenario.seed));
  params.set("weather", scenario.weather);
  params.set("risk", String(scenario.reliability));
  if (scenario.safetyCarLap) params.set("safety", String(scenario.safetyCarLap));
  return params.toString();
}
