import { FEATURE_GROUP } from "../../lib/format.ts";
import { FEATURES, INTERCEPT, contributions } from "../../lib/model.ts";
import type { Row } from "./rows";

/**
 * Hold an input group at its average and re-rank the field with the same fitted model.
 *
 * The logistic regression adds up one contribution per input (its standardised value times its weight), so a
 * group can be switched off exactly: setting its inputs to the training average makes each contribution zero. This
 * is not a retrained model. The model never learned without these inputs, so the result shows what each group is
 * doing inside the fitted model and is not another model's prediction. It is never compared with the result of the
 * race: choosing the setting that best matches a known outcome would be fitting to the answer.
 */

export const GROUPS = ["Grid", "Qualifying", "Form", "Standings", "Context"] as const;
export type Group = (typeof GROUPS)[number];

/** The model's inputs in each group, in model order. */
export function inputsOf(group: Group): string[] {
  return FEATURES.filter((feature) => FEATURE_GROUP[feature] === group);
}

export const PRESETS: { id: string; label: string; hold: readonly Group[] }[] = [
  { id: "all", label: "All inputs", hold: [] },
  { id: "grid-only", label: "Grid only", hold: ["Qualifying", "Form", "Standings", "Context"] },
  { id: "grid-quali", label: "Grid and qualifying", hold: ["Form", "Standings", "Context"] },
  { id: "no-grid", label: "No grid", hold: ["Grid"] },
];

export interface Shuffled {
  row: Row;
  /** Podium score with the held groups at their average. */
  score: number;
  /** 1 = highest score under this setting. */
  rank: number;
  /** Rank under the full model. */
  baseRank: number;
  /** Places gained (positive) or lost (negative) against the full model. */
  move: number;
}

const sigmoid = (value: number) => 1 / (1 + Math.exp(-value));

/** The podium score when every input in a held group is at the training average. */
export function scoreHolding(x: Row["entry"]["x"], held: ReadonlySet<Group>): number {
  let total = INTERCEPT;
  for (const part of contributions(x)) if (!held.has(FEATURE_GROUP[part.feature] as Group)) total += part.contribution;
  return sigmoid(total);
}

/**
 * Every driver re-scored and re-ranked with the held groups at their average. With nothing held this is exactly the
 * page's own ranking (the exported scores), so "all inputs" can never disagree with the rest of the page.
 */
export function reshuffle(rows: readonly Row[], held: ReadonlySet<Group>): Shuffled[] {
  const scored = rows.map((row) => ({ row, score: held.size === 0 ? row.score : scoreHolding(row.entry.x, held) }));
  scored.sort((a, b) => b.score - a.score || a.row.driver.id - b.row.driver.id);
  return scored.map((item, i) => ({ ...item, rank: i + 1, baseRank: item.row.rank, move: item.row.rank - (i + 1) }));
}

/** Spearman rank correlation between the full model's order and the shuffled order: 1 identical, -1 reversed. */
export function agreement(shuffled: readonly Shuffled[]): number {
  const n = shuffled.length;
  if (n < 2) return 1;
  const sumSquares = shuffled.reduce((sum, s) => sum + (s.rank - s.baseRank) ** 2, 0);
  return 1 - (6 * sumSquares) / (n * (n * n - 1));
}

const names = (items: readonly { row: Row }[]) => items.map((s) => s.row.driver.last).join(", ");

/**
 * Plain statements about what a setting does to the ranking. They use only the model's inputs and scores, so they say
 * nothing about the result and are safe to show before the reveal.
 */
export function reshuffleStory(shuffled: readonly Shuffled[], held: ReadonlySet<Group>): string[] {
  if (shuffled.length < 3) return [];
  if (held.size === 0) return ["All five input groups count, so this is Paladin's full ranking."];
  const heldList = GROUPS.filter((g) => held.has(g)).map((g) => g.toLowerCase());
  const counting = GROUPS.filter((g) => !held.has(g)).map((g) => g.toLowerCase());
  const setting =
    counting.length === 1
      ? `With only ${counting[0]} counting and the other four groups held at the training average`
      : `With ${joinList(heldList)} held at the training average`;
  const top = shuffled.slice(0, 3);
  const full = [...shuffled].sort((a, b) => a.baseRank - b.baseRank).slice(0, 3);
  const shared = top.filter((s) => full.some((f) => f.row.driver.id === s.row.driver.id)).length;
  const changed = shuffled.filter((s) => s.move !== 0).length;
  const lines = [
    `${setting}, the top three would be ${names(top)}. The full model's top three is ${names(full)}; ${shared} of 3 are shared.`,
    `${changed} of ${shuffled.length} drivers change rank, and the order agrees with the full model at ${agreement(shuffled).toFixed(2)} (Spearman, where 1 is identical).`,
  ];
  const biggest = [...shuffled].sort((a, b) => Math.abs(b.move) - Math.abs(a.move) || a.row.driver.id - b.row.driver.id)[0];
  if (biggest && biggest.move !== 0) {
    lines.push(`Biggest move: ${biggest.row.driver.last}, from ${ordinalOf(biggest.baseRank)} to ${ordinalOf(biggest.rank)}.`);
  }
  return lines;
}

/** "a", "a and b", "a, b and c". */
export function joinList(items: readonly string[]): string {
  if (items.length <= 1) return items.join("");
  return `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;
}

function ordinalOf(value: number): string {
  const rest = value % 100;
  if (rest >= 11 && rest <= 13) return `${value}th`;
  return `${value}${["th", "st", "nd", "rd"][value % 10 > 3 ? 0 : value % 10]}`;
}

/** A group can only be held while another stays active, otherwise every driver would tie. */
export function canHold(group: Group, held: ReadonlySet<Group>): boolean {
  if (held.has(group)) return true;
  return GROUPS.filter((g) => !held.has(g) && g !== group).length > 0;
}
