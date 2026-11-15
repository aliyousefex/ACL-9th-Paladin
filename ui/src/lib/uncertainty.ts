import model from "../data/model.json" with { type: "json" };
import type { RaceMeta } from "./data";
import type { Row } from "../features/race/rows";
import { COEFFICIENTS, FEATURES } from "./model.ts";
import { gaussian, mulberry32 } from "./random.ts";

export interface ScoreEvidence {
  observedRate: number;
  lower: number;
  upper: number;
  sample: number;
  /** Which seasons the band was measured on. Always earlier than the race being shown. */
  source: "validation 2020-21";
  label: "limited evidence" | "contested" | "stable band";
}

interface Bin {
  lo: number;
  hi: number;
  n: number;
  podiums: number;
}

/**
 * Pre-race evidence must come from seasons that finished before the race being shown. The 2020-21
 * validation bins satisfy that for every 2022-24 race; the 2022-24 bins would include the race's own
 * outcome, so they are deliberately not used here.
 */
const BINS = model.reliability.validation as Bin[];

export function binFor(score: number): Bin {
  return BINS.find((bin) => score >= bin.lo && (score < bin.hi || bin.hi === 1)) ?? BINS[BINS.length - 1];
}

/** Wilson 95% interval for a podium share. Exact at the edges (0 of n, n of n), unlike the Wald interval. */
export function wilson(successes: number, n: number, z = 1.96): { lower: number; upper: number } {
  if (!n) return { lower: 0, upper: 1 };
  const p = successes / n;
  const denominator = 1 + (z * z) / n;
  const centre = (p + (z * z) / (2 * n)) / denominator;
  const spread = (z * Math.sqrt((p * (1 - p) + (z * z) / (4 * n)) / n)) / denominator;
  return { lower: Math.max(0, centre - spread), upper: Math.min(1, centre + spread) };
}

/** What happened to drivers with a similar score in the validation seasons, with its sampling interval. */
export function scoreEvidence(score: number): ScoreEvidence {
  const bin = binFor(score);
  const { lower, upper } = wilson(bin.podiums, bin.n);
  const width = upper - lower;
  return {
    observedRate: bin.n ? bin.podiums / bin.n : 0,
    lower,
    upper,
    sample: bin.n,
    source: "validation 2020-21",
    label: bin.n < 35 ? "limited evidence" : width > 0.24 ? "contested" : "stable band",
  };
}

export type CutLabel = "fragile cut" | "contested cut" | "clear cut";

/** How far the third-ranked score is from the fourth: a small gap means one small change reorders the podium. */
export function fieldStability(rows: Pick<Row, "score">[]): { margin: number; label: CutLabel } {
  if (rows.length < 4) return { margin: 0, label: "fragile cut" };
  const margin = rows[2].score - rows[3].score;
  return { margin, label: margin < 0.025 ? "fragile cut" : margin < 0.075 ? "contested cut" : "clear cut" };
}

export type RaceOutcome = "perfect" | "ordinary" | "major miss";

export function raceErrorClass(race: Pick<RaceMeta, "hits">): RaceOutcome {
  if (race.hits === 3) return "perfect";
  if (race.hits <= 1) return "major miss";
  return "ordinary";
}

/** Podium names the model got right minus what the starting-grid top three got right. */
export function raceValueAgainstGrid(race: Pick<RaceMeta, "hits" | "baselineHits">): number {
  return race.hits - race.baselineHits;
}

/* ------------------------------------------------------------------ how firm is a call? */

/**
 * "Would a small change in the inputs change the call?" Every continuous input of every driver is nudged by an
 * independent Gaussian of NUDGE_SD training standard deviations. The classifier is linear in its standardised inputs,
 * so that is exactly the same as adding one Gaussian to each driver's log-odds, with a standard deviation that is
 * NUDGE_SD times the root of the summed squared weights of the nudgeable inputs. Flags (pit-lane start, front row,
 * missing qualifying) and the two inputs that are the same for every car in a race are left alone.
 *
 * The three constants below were fixed before any outcome was looked at, and are not tuned.
 */
export const NUDGE_SD = 0.25;
export const NUDGE_DRAWS = 2000;
export const NUDGE_SEED = 903;
export const HIGH_STABILITY = 0.85;
export const LOW_STABILITY = 0.6;

const NOT_NUDGED = new Set(["pit_lane_start", "front_row", "qualifying_missing", "field_size", "year"]);

export function nudgeLogitSd(sd: number = NUDGE_SD): number {
  return sd * Math.sqrt(COEFFICIENTS.filter((c) => !NOT_NUDGED.has(c.feature)).reduce((sum, c) => sum + c.weight * c.weight, 0));
}

/** For each driver, the share of nudged versions of this field in which they still finish among the top three scores. */
export function topThreeStability(logits: readonly number[], draws: number = NUDGE_DRAWS, seed: number = NUDGE_SEED, sd: number = NUDGE_SD): number[] {
  const n = logits.length;
  const noise = nudgeLogitSd(sd);
  const random = mulberry32(seed);
  const counts = new Array<number>(n).fill(0);
  const order = new Array<number>(n);
  const perturbed = new Array<number>(n);
  for (let d = 0; d < draws; d += 1) {
    for (let i = 0; i < n; i += 1) {
      perturbed[i] = logits[i] + noise * gaussian(random);
      order[i] = i;
    }
    order.sort((a, b) => perturbed[b] - perturbed[a]);
    for (let k = 0; k < Math.min(3, n); k += 1) counts[order[k]] += 1;
  }
  return counts.map((count) => count / draws);
}

export type Firmness = "high confidence" | "contested" | "fragile" | "outside the call";

/**
 * A plain label for one driver. Only the classifier's three names are "in the call". A name is high confidence when it
 * survives small nudges almost always and the field model names the same driver; fragile when it often drops out;
 * contested otherwise, including when the two models disagree about it.
 */
export function firmness(input: { inCall: boolean; stability: number; fieldAgrees: boolean }): Firmness {
  if (!input.inCall) return "outside the call";
  if (input.stability >= HIGH_STABILITY && input.fieldAgrees) return "high confidence";
  if (input.stability < LOW_STABILITY) return "fragile";
  return "contested";
}

/** Names of the inputs that were missing and were filled with the training median. */
export function imputedInputs(x: readonly (number | null | undefined)[]): string[] {
  return FEATURES.filter((_, i) => x[i] === null || x[i] === undefined);
}
