/**
 * Error Atlas arithmetic: where the selected model and the starting-grid baseline agree, differ and fail.
 *
 * Everything here is derived from numbers the site already ships: the per-driver season logs in drivers.json
 * (podium score, grid slot, classified order, classification text) and the per-race hit counts in races.json.
 * Nothing is re-estimated. The functions take their data as arguments so the same arithmetic runs under Node
 * in tests and in the page, and a test asserts the log-derived hits equal the exported ones for every race.
 */

import type { Driver, RaceMeta } from "./data";
import { mulberry32 } from "./random.ts";

/** One driver in one held-out race, reduced to what an error audit needs. */
export interface LiteEntry {
  raceId: number;
  driverId: number;
  constructorId: number;
  /** Podium score from the selected model. */
  score: number;
  grid: number | null;
  /** Classified order (positionOrder). */
  finish: number;
  /** Classification text: a number, or R / D / W. */
  txt: string;
  /** 1 = highest podium score in the field. Ties break by driver id, matching the race page. */
  rank: number;
}

type RaceKey = Pick<RaceMeta, "id">;
type DriverLogs = Pick<Driver, "id" | "seasons">;

export function entriesByRace(races: readonly RaceKey[], drivers: readonly DriverLogs[]): Map<number, LiteEntry[]> {
  const wanted = new Set(races.map((race) => race.id));
  const out = new Map<number, LiteEntry[]>();
  for (const driver of drivers) {
    for (const season of Object.values(driver.seasons)) {
      for (const [raceId, , score, grid, finish, constructorId, txt] of season.log) {
        if (!wanted.has(raceId)) continue;
        const list = out.get(raceId) ?? [];
        list.push({ raceId, driverId: driver.id, constructorId, score, grid, finish, txt, rank: 0 });
        out.set(raceId, list);
      }
    }
  }
  for (const list of out.values()) {
    list.sort((a, b) => b.score - a.score || a.driverId - b.driverId);
    list.forEach((entry, i) => (entry.rank = i + 1));
  }
  return out;
}

/** True when the driver is classified by a number rather than R (retired), D (disqualified) or W (withdrew). */
export const tookTheFlag = (entry: Pick<LiteEntry, "txt">): boolean => /^\d+$/.test(entry.txt);

export type GridBand = "P1-3" | "P4-6" | "P7 or lower";

export function gridBand(grid: number | null): GridBand {
  if (grid !== null && grid <= 3) return "P1-3";
  if (grid !== null && grid <= 6) return "P4-6";
  return "P7 or lower";
}

/* ------------------------------------------------------------------ one miss, described from the record */

export type FalseAlarmKind = "in-race event" | "close call" | "faded" | "outside the points";
export type MissKind = "close call" | "visible on the grid" | "against the inputs";

export interface Described<K extends string> {
  kind: K;
  /** One plain sentence. It describes what the record shows and never claims a cause. */
  detail: string;
}

/**
 * Paladin's pick that did not reach the podium. The classification is the only evidence used: a driver who did not
 * take the flag is an in-race event, and the model has no input that could have seen that coming.
 */
export function describeFalseAlarm(entry: Pick<LiteEntry, "txt" | "finish">): Described<FalseAlarmKind> {
  if (!tookTheFlag(entry)) return { kind: "in-race event", detail: "Did not take the flag. None of the model's inputs measures reliability or incidents." };
  if (entry.finish <= 5) return { kind: "close call", detail: `Finished P${entry.finish}, one or two places off the podium.` };
  if (entry.finish <= 10) return { kind: "faded", detail: `Finished P${entry.finish}: in the points, but well behind the podium.` };
  return { kind: "outside the points", detail: `Finished P${entry.finish}, outside the points.` };
}

/**
 * A podium finisher the model left out. "Visible" is a statement about the pre-race record only: how high the model
 * ranked the driver and where the driver started. It is not a claim that the result was avoidable.
 */
export function describeMiss(entry: Pick<LiteEntry, "rank" | "grid">): Described<MissKind> {
  const start = entry.grid === null ? "the pit lane" : `P${entry.grid}`;
  if (entry.rank <= 5) return { kind: "close call", detail: `Ranked ${entry.rank}th, one or two places outside the cut. Started ${start}.` };
  if (entry.grid !== null && entry.grid <= 6) return { kind: "visible on the grid", detail: `Started ${start}, so the grid pointed this way, but the model ranked the driver ${entry.rank}th.` };
  return { kind: "against the inputs", detail: `Started ${start} and ranked ${entry.rank}th. The inputs gave little reason to expect a podium.` };
}

/* ------------------------------------------------------------------ the whole held-out set */

export interface SeasonRow {
  year: number;
  races: number;
  modelHits: number;
  gridHits: number;
  perfect: number;
  zero: number;
}

export interface BandRow {
  band: GridBand;
  /** Podium finishers who started in this band. */
  podium: number;
  modelCaught: number;
  gridCaught: number;
}

export interface Summary {
  races: number;
  modelHits: number;
  gridHits: number;
  perfect: number;
  zero: number;
  /** Races where the model beat the grid, tied it, and lost to it. */
  versusGrid: { better: number; tied: number; worse: number };
  /** Races where both the model and the grid put at most one podium finisher in their top three. */
  sharedFailures: number;
  seasons: SeasonRow[];
  bands: BandRow[];
  /** Paladin's top-three picks that did not reach the podium. */
  falseAlarms: { total: number } & Record<FalseAlarmKind, number>;
  /** Podium finishers Paladin left out. */
  misses: { total: number } & Record<MissKind, number>;
}

const BANDS: GridBand[] = ["P1-3", "P4-6", "P7 or lower"];

export function summarize(races: readonly RaceMeta[], entries: ReadonlyMap<number, readonly LiteEntry[]>): Summary {
  const seasons = new Map<number, SeasonRow>();
  const bands = new Map<GridBand, BandRow>(BANDS.map((band) => [band, { band, podium: 0, modelCaught: 0, gridCaught: 0 }]));
  const falseAlarms = { total: 0, "in-race event": 0, "close call": 0, faded: 0, "outside the points": 0 };
  const misses = { total: 0, "close call": 0, "visible on the grid": 0, "against the inputs": 0 };
  const versusGrid = { better: 0, tied: 0, worse: 0 };
  let perfect = 0;
  let zero = 0;
  let sharedFailures = 0;
  let modelHits = 0;
  let gridHits = 0;

  for (const race of races) {
    modelHits += race.hits;
    gridHits += race.baselineHits;
    if (race.hits === 3) perfect += 1;
    if (race.hits === 0) zero += 1;
    if (race.hits <= 1 && race.baselineHits <= 1) sharedFailures += 1;
    if (race.hits > race.baselineHits) versusGrid.better += 1;
    else if (race.hits < race.baselineHits) versusGrid.worse += 1;
    else versusGrid.tied += 1;

    const season = seasons.get(race.year) ?? { year: race.year, races: 0, modelHits: 0, gridHits: 0, perfect: 0, zero: 0 };
    season.races += 1;
    season.modelHits += race.hits;
    season.gridHits += race.baselineHits;
    if (race.hits === 3) season.perfect += 1;
    if (race.hits === 0) season.zero += 1;
    seasons.set(race.year, season);

    for (const entry of entries.get(race.id) ?? []) {
      const onPodium = entry.finish <= 3;
      const inModelTop = entry.rank <= 3;
      if (onPodium) {
        const row = bands.get(gridBand(entry.grid))!;
        row.podium += 1;
        if (inModelTop) row.modelCaught += 1;
        if (race.baseline.includes(entry.driverId)) row.gridCaught += 1;
        if (!inModelTop) {
          misses.total += 1;
          misses[describeMiss(entry).kind] += 1;
        }
      } else if (inModelTop) {
        falseAlarms.total += 1;
        falseAlarms[describeFalseAlarm(entry).kind] += 1;
      }
    }
  }

  return {
    races: races.length,
    modelHits,
    gridHits,
    perfect,
    zero,
    versusGrid,
    sharedFailures,
    seasons: [...seasons.values()].sort((a, b) => a.year - b.year),
    bands: BANDS.map((band) => bands.get(band)!),
    falseAlarms,
    misses,
  };
}

export { mulberry32 };

export interface PairedInterval {
  mean: number;
  lower: number;
  upper: number;
  draws: number;
}

/** Percentile bootstrap of the mean of paired per-race differences. Resamples whole races, as the evaluation does. */
export function pairedBootstrap(differences: readonly number[], draws = 4000, seed = 903): PairedInterval {
  const n = differences.length;
  const mean = n ? differences.reduce((a, b) => a + b, 0) / n : 0;
  if (!n) return { mean, lower: 0, upper: 0, draws: 0 };
  const random = mulberry32(seed);
  const means = new Float64Array(draws);
  for (let d = 0; d < draws; d += 1) {
    let sum = 0;
    for (let i = 0; i < n; i += 1) sum += differences[Math.floor(random() * n)];
    means[d] = sum / n;
  }
  means.sort();
  return { mean, lower: means[Math.floor(0.025 * draws)], upper: means[Math.min(draws - 1, Math.ceil(0.975 * draws) - 1)], draws };
}

export type GridVerdict = "beats the grid" | "trails the grid" | "is level with the grid";

/** Level unless the whole interval sits on one side of zero. */
export function verdictAgainstGrid(interval: Pick<PairedInterval, "lower" | "upper">): GridVerdict {
  if (interval.lower > 0) return "beats the grid";
  if (interval.upper < 0) return "trails the grid";
  return "is level with the grid";
}

/** The races worth reading first: fewest model hits, then the biggest shortfall against the grid, then the newest. */
export function worstFirst<T extends Pick<RaceMeta, "hits" | "baselineHits" | "id">>(races: readonly T[]): T[] {
  return [...races].sort((a, b) => a.hits - b.hits || a.hits - a.baselineHits - (b.hits - b.baselineHits) || b.id - a.id);
}
