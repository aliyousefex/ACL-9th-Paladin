/**
 * The experimental field model, run in the browser.
 *
 * `field-model.json` is written by `scripts/run_field_ranking.py`. It holds the weights of a Plackett-Luce model:
 * every driver gets one utility from the same 16 pre-race inputs the coursework classifier uses, and a race's
 * podium is drawn without replacement with probability proportional to exp(utility). This file repeats that
 * arithmetic exactly (no sampling), so a probability shown on the site equals the Python one for the same inputs.
 * A test compares them for races the exporter saved.
 *
 * It is an experiment beside the frozen logistic regression, not a replacement for it. No framework imports, so
 * it also runs under Node.
 */

import field from "../data/field-model.json" with { type: "json" };

export const FIELD_FEATURES: readonly string[] = field.features;
export type FeatureRow = readonly (number | null)[];

/** One driver's utility: weights times standardised inputs. Missing inputs take the training median, as in the logistic model. */
export function fieldUtility(row: FeatureRow): number {
  let total = 0;
  for (let i = 0; i < field.weights.length; i += 1) {
    const value = row[i] ?? field.median[i];
    total += ((value - field.mean[i]) / field.scale[i]) * field.weights[i];
  }
  return total;
}

/** P(a first, b second, c third) for every ordered triple, as a flat array indexed a*n*n + b*n + c. */
export function podiumDistribution(utilities: readonly number[]): Float64Array {
  const n = utilities.length;
  if (n < 3) throw new Error("a podium needs at least three drivers");
  const top = Math.max(...utilities);
  const e = utilities.map((u) => Math.exp(u - top));
  const total = e.reduce((a, b) => a + b, 0);
  const out = new Float64Array(n * n * n);
  for (let a = 0; a < n; a += 1) {
    const afterA = total - e[a];
    for (let b = 0; b < n; b += 1) {
      if (b === a) continue;
      const pab = (e[a] / total) * (e[b] / afterA);
      const afterB = afterA - e[b];
      for (let c = 0; c < n; c += 1) {
        if (c === a || c === b) continue;
        out[(a * n + b) * n + c] = pab * (e[c] / afterB);
      }
    }
  }
  return out;
}

/** Chance of finishing in the top three: first, second or third. Sums to exactly 3 over the field. */
export function top3Marginals(distribution: Float64Array, n: number): number[] {
  const out = new Array<number>(n).fill(0);
  for (let a = 0; a < n; a += 1) {
    for (let b = 0; b < n; b += 1) {
      for (let c = 0; c < n; c += 1) {
        const p = distribution[(a * n + b) * n + c];
        if (p === 0) continue;
        out[a] += p;
        out[b] += p;
        out[c] += p;
      }
    }
  }
  return out;
}

export interface PodiumSet {
  /** Indices into the field, ascending. */
  members: [number, number, number];
  /** Chance that exactly these three finish on the podium, in any order. */
  probability: number;
}

/** Every unordered podium set with its probability, most likely first. */
export function podiumSets(distribution: Float64Array, n: number): PodiumSet[] {
  const sets: PodiumSet[] = [];
  const at = (a: number, b: number, c: number) => distribution[(a * n + b) * n + c];
  for (let a = 0; a < n; a += 1) {
    for (let b = a + 1; b < n; b += 1) {
      for (let c = b + 1; c < n; c += 1) {
        sets.push({ members: [a, b, c], probability: at(a, b, c) + at(a, c, b) + at(b, a, c) + at(b, c, a) + at(c, a, b) + at(c, b, a) });
      }
    }
  }
  return sets.sort((x, y) => y.probability - x.probability || x.members[0] - y.members[0] || x.members[1] - y.members[1] || x.members[2] - y.members[2]);
}

export interface FieldAnalysis {
  utility: number[];
  /** Chance of a top-three finish, per driver, in input order. */
  marginal: number[];
  /** Chance of winning, per driver. */
  winner: number[];
  /** All podium sets, most likely first. */
  sets: PodiumSet[];
  /** The field model's own top three by utility (indices). */
  picks: number[];
  /** How many equally-weighted podium sets it would take to be as uncertain: exp of the set entropy. */
  effectiveSets: number;
}

export function analyseField(rows: readonly FeatureRow[]): FieldAnalysis {
  const n = rows.length;
  const utility = rows.map(fieldUtility);
  const distribution = podiumDistribution(utility);
  const sets = podiumSets(distribution, n);
  let entropy = 0;
  for (const set of sets) if (set.probability > 0) entropy -= set.probability * Math.log(set.probability);
  const winner = new Array<number>(n).fill(0);
  for (let a = 0; a < n; a += 1) for (let b = 0; b < n; b += 1) for (let c = 0; c < n; c += 1) winner[a] += distribution[(a * n + b) * n + c];
  const picks = utility.map((u, i) => [u, i] as const).sort((x, y) => y[0] - x[0] || x[1] - y[1]).slice(0, 3).map(([, i]) => i);
  return { utility, marginal: top3Marginals(distribution, n), winner, sets, picks, effectiveSets: Math.exp(entropy) };
}

/** Where the real podium sat among all possible sets: its rank (1 = most likely) and probability. */
export function actualSetStanding(analysis: Pick<FieldAnalysis, "sets">, actual: readonly number[]): { rank: number; probability: number; of: number } | null {
  const wanted = [...actual].sort((a, b) => a - b).join(",");
  const index = analysis.sets.findIndex((set) => set.members.join(",") === wanted);
  return index < 0 ? null : { rank: index + 1, probability: analysis.sets[index].probability, of: analysis.sets.length };
}

/** Retrospective results the exporter measured on the 2022-2024 seasons, for captions. */
export const FIELD_META = {
  name: field.name,
  evaluationStatus: field.evaluationStatus,
  raceConstantFeatures: field.raceConstantFeatures as readonly string[],
  test: field.test,
  bySeason: field.bySeason,
  nll: field.nll,
};

/** The exporter's per-race result for one held-out race: its top three and the hits they scored. */
export function fieldRaceResult(raceId: number): { hits: number; top3: number[]; modalSet: number[]; modalSetProbability: number; actualSetProbability: number } | undefined {
  return field.races.find((race) => race.id === raceId);
}

export const FIELD_PARITY = field.parity;
export const FIELD_RACES = field.races;
