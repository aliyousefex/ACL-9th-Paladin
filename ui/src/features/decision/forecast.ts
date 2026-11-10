import type { Row } from "../race/rows";
import type { DriverState, ForecastDriver, OutcomeForecast, RaceState, ScenarioComparison } from "./schema";

const POINTS = [25, 18, 15, 12, 10, 8, 6, 4, 2, 1];

function rng(seed: number): () => number {
  let x = seed >>> 0 || 1;
  return () => {
    x ^= x << 13; x ^= x >>> 17; x ^= x << 5;
    return (x >>> 0) / 4294967296;
  };
}

/** Weighted random order without replacement: a Plackett-Luce baseline. */
function sampleOrder(ids: number[], weights: Map<number, number>, random: () => number): number[] {
  const remaining = [...ids];
  const out: number[] = [];
  while (remaining.length) {
    const total = remaining.reduce((sum, id) => sum + (weights.get(id) ?? 0), 0);
    let pick = random() * total;
    let index = 0;
    for (; index < remaining.length - 1; index++) {
      pick -= weights.get(remaining[index]) ?? 0;
      if (pick <= 0) break;
    }
    out.push(remaining.splice(index, 1)[0]);
  }
  return out;
}

function weight(row: Row, state?: DriverState): number {
  const odds = Math.max(0.01, row.score) / Math.max(0.01, 1 - row.score);
  if (!state || state.position === null) return Math.max(0.001, odds);
  // Current running position is evidence, not an outcome: its influence rises as the race progresses.
  const positionSignal = Math.exp(-(state.position - 1) / 5);
  return Math.max(0.001, odds * positionSignal);
}

/** Keep scenario controls valid when the investigated driver is no longer running. */
export function resolveScenarioDriverId(state: RaceState, requestedDriverId: number): number | null {
  if (state.drivers.some((driver) => driver.driverId === requestedDriverId && driver.running)) return requestedDriverId;
  return state.drivers.find((driver) => driver.running)?.driverId ?? null;
}

export function forecast(rows: readonly Row[], state: RaceState, seed = 903, samples = 2000, weightMultiplier: ReadonlyMap<number, number> = new Map()): OutcomeForecast {
  if (!Number.isInteger(samples) || samples < 100 || samples > 100_000) throw new RangeError("samples must be an integer from 100 to 100000");
  const active = state.drivers.filter((driver) => driver.running && driver.position !== null);
  const ids = active.map((driver) => driver.driverId);
  const byState = new Map(active.map((driver) => [driver.driverId, driver]));
  const byRow = new Map(rows.map((row) => [row.driver.id, row]));
  const weights = new Map(ids.map((id) => [id, weight(byRow.get(id)!, byState.get(id)) * (weightMultiplier.get(id) ?? 1)]));
  const counts = new Map(ids.map((id) => [id, Array(ids.length).fill(0) as number[]]));
  const random = rng(seed);
  for (let i = 0; i < samples; i++) sampleOrder(ids, weights, random).forEach((id, position) => counts.get(id)![position]++);
  const drivers: ForecastDriver[] = ids.map((driverId) => {
    const positions = counts.get(driverId)!.map((count) => count / samples);
    return {
      driverId,
      win: positions[0] ?? 0,
      podium: positions.slice(0, 3).reduce((a, b) => a + b, 0),
      expectedPosition: positions.reduce((sum, p, i) => sum + p * (i + 1), 0),
      expectedPoints: positions.reduce((sum, p, i) => sum + p * (POINTS[i] ?? 0), 0),
      positions,
    };
  }).sort((a, b) => a.expectedPosition - b.expectedPosition || a.driverId - b.driverId);
  return {
    model: "plackett-luce-state-baseline-v1", samples, seed, cutoffLap: state.cutoffLap, drivers,
    assumptions: [
      "Approximate ranking distribution, not a calibrated live strategy model.",
      "Uses pre-race podium score and the official running position available at the selected lap.",
      "Does not model tyre compound, weather, damage, traffic or future safety cars.",
    ],
    provenance: { source: "Paladin state baseline", kind: "estimated", occurredLap: state.cutoffLap, availableLap: state.cutoffLap, ingestedAt: "build-time", revision: 1 },
  };
}

/** Common-random-number stress test: an assumed pit-loss delta changes one driver's latent strength. */
export function comparePitLoss(rows: readonly Row[], state: RaceState, driverId: number, assumedSeconds: number, seed = 903, samples = 2000): ScenarioComparison {
  if (!state.drivers.some((driver) => driver.driverId === driverId && driver.running)) throw new RangeError("driver is not running at this cutoff");
  if (!Number.isFinite(assumedSeconds) || Math.abs(assumedSeconds) > 20) throw new RangeError("assumed seconds must be between -20 and 20");
  const reference = forecast(rows, state, seed, samples).drivers.find((driver) => driver.driverId === driverId)!;
  // Eight seconds per e-fold is declared as a sensitivity assumption, not learned tyre physics.
  const alternative = forecast(rows, state, seed, samples, new Map([[driverId, Math.exp(-assumedSeconds / 8)]])).drivers.find((driver) => driver.driverId === driverId)!;
  return {
    kind: "pit-loss-stress-test-v1", driverId, cutoffLap: state.cutoffLap, seed, samples, reference, alternative, assumedSeconds,
    assumptions: ["The same random draws are used for both alternatives.", "The time-to-strength mapping is a sensitivity assumption, not an estimated tyre or traffic model.", "All other drivers and future conditions are held unchanged."],
  };
}

export function brierScore(probabilities: readonly number[], outcomes: readonly boolean[]): number {
  if (probabilities.length !== outcomes.length || probabilities.length === 0) throw new RangeError("probabilities and outcomes must have equal non-zero length");
  return probabilities.reduce((sum, p, i) => {
    if (!Number.isFinite(p) || p < 0 || p > 1) throw new RangeError("probability outside 0..1");
    return sum + (p - Number(outcomes[i])) ** 2;
  }, 0) / probabilities.length;
}
