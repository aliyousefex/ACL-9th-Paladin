/**
 * The selected model, run in the browser.
 *
 * `model.json` holds the fitted logistic-regression pipeline exported by
 * `scripts/export_site_data.py`: imputer medians, scaler mean and scale, coefficients,
 * intercept, and the validation-chosen cutoff. The exporter refuses to write the file unless
 * the same arithmetic reproduces the pipeline's saved PR-AUC, ROC-AUC, F1, precision and recall
 * on every split. This module repeats that arithmetic, so a score computed here equals the
 * score the pipeline would give for the same row.
 *
 * No framework imports: the module also runs under Node for the parity test.
 */

import model from "../data/model.json" with { type: "json" };

export const FEATURES: readonly string[] = model.features;
export const THRESHOLD: number = model.threshold;
export const INTERCEPT: number = model.intercept;
export const MODEL_NAME: string = model.name;

/** One raw feature row in `FEATURES` order. `null` is a missing value, filled by the training median. */
export type FeatureRow = readonly (number | null)[];

export function featureIndex(name: string): number {
  return FEATURES.indexOf(name);
}

/** Standardised value of every feature: (value or training median, minus mean) over scale. */
export function standardize(row: FeatureRow): number[] {
  return FEATURES.map((_, i) => {
    const value = row[i] ?? model.median[i];
    return (value - model.mean[i]) / model.scale[i];
  });
}

export function logOdds(row: FeatureRow): number {
  const z = standardize(row);
  let total = INTERCEPT;
  for (let i = 0; i < z.length; i++) total += z[i] * model.coef[i];
  return total;
}

/** The podium score: the model's predict_proba for the podium class. Not a calibrated probability. */
export function podiumScore(row: FeatureRow): number {
  return 1 / (1 + Math.exp(-logOdds(row)));
}

export interface Contribution {
  feature: string;
  index: number;
  value: number | null;
  standardized: number;
  weight: number;
  /** Standardised value times weight: this feature's share of the log-odds. */
  contribution: number;
}

/** Exact decomposition: the intercept plus every contribution equals the log-odds. */
export function contributions(row: FeatureRow): Contribution[] {
  const z = standardize(row);
  return FEATURES.map((feature, index) => ({
    feature,
    index,
    value: row[index] ?? null,
    standardized: z[index],
    weight: model.coef[index],
    contribution: z[index] * model.coef[index],
  }));
}

/** Copy of a row with the starting grid replaced; the grid flags follow from it. */
export function withGrid(row: FeatureRow, grid: number | "pit"): (number | null)[] {
  const next = [...row];
  const g = featureIndex("grid_position");
  const pit = featureIndex("pit_lane_start");
  const front = featureIndex("front_row");
  if (grid === "pit") {
    next[g] = null;
    next[pit] = 1;
    next[front] = 0;
  } else {
    next[g] = grid;
    next[pit] = 0;
    next[front] = grid <= 2 ? 1 : 0;
  }
  return next;
}

export function withFeature(row: FeatureRow, name: string, value: number | null): (number | null)[] {
  const next = [...row];
  next[featureIndex(name)] = value;
  return next;
}

export const COEFFICIENTS: readonly { feature: string; weight: number }[] = FEATURES.map((feature, i) => ({
  feature,
  weight: model.coef[i],
}));
