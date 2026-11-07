import { FEATURE_GROUP } from "../../lib/format.ts";
import { contributions } from "../../lib/model.ts";
import type { Row } from "./rows";

/**
 * Where Paladin's ranking and the starting grid disagree, and which inputs account for it.
 *
 * Everything here is computed from numbers the browser already has: the grid slot of each driver and the
 * logistic regression's own per-feature contributions (standardised input times weight, in log-odds).
 * Nothing is estimated. A contribution is only meaningful against a baseline, so every explanation is
 * measured against the *average car on this grid* for the same feature, and the interface says so.
 */

export type Direction = "up" | "down";

export interface GridMove {
  row: Row;
  /** 1 = pole. Pit-lane starters sit behind everyone who has a grid slot. */
  gridRank: number;
  /** 1 = highest podium score in the field. */
  modelRank: number;
  /** Positive: the model ranks the driver above their grid rank. Negative: below. */
  move: number;
}

export interface Driver {
  feature: string;
  /** This driver's contribution to the log-odds minus the field average for the same feature. */
  delta: number;
}

/** Contributions smaller than this (in log-odds) are noise, not an explanation. */
export const MIN_DELTA = 0.05;

/**
 * The grid is the baseline each move is measured against, so the inputs that describe the grid itself
 * (position, pit-lane start, front row, field size) are not offered as the reason for leaving it.
 */
export const BASELINE_GROUP = "Grid";

export function gridMoves(rows: readonly Row[]): GridMove[] {
  const byGrid = [...rows].sort((a, b) => (a.grid ?? 99) - (b.grid ?? 99) || a.driver.id - b.driver.id);
  const gridRank = new Map(byGrid.map((row, index) => [row.driver.id, index + 1]));
  return rows.map((row) => {
    const start = gridRank.get(row.driver.id) ?? rows.length;
    return { row, gridRank: start, modelRank: row.rank, move: start - row.rank };
  });
}

/** The drivers the model moves furthest in one direction, largest move first, ties broken by score then id. */
export function biggestMoves(rows: readonly Row[], direction: Direction, count = 3): GridMove[] {
  const sign = direction === "up" ? 1 : -1;
  return gridMoves(rows)
    .filter((item) => item.move * sign > 0)
    .sort((a, b) => b.move * sign - a.move * sign || (direction === "up" ? b.row.score - a.row.score : a.row.score - b.row.score) || a.row.driver.id - b.row.driver.id)
    .slice(0, count);
}

function rankDeltas(row: Row, rows: readonly Row[], direction: Direction, count: number, skip: (feature: string) => boolean): Driver[] {
  if (rows.length === 0) return [];
  const all = rows.map((item) => contributions(item.entry.x));
  const mine = contributions(row.entry.x);
  const sign = direction === "up" ? 1 : -1;
  return mine
    .map((item, index) => ({ feature: item.feature, delta: item.contribution - all.reduce((sum, parts) => sum + parts[index].contribution, 0) / all.length }))
    .filter((item) => !skip(item.feature) && item.delta * sign >= MIN_DELTA)
    .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta) || a.feature.localeCompare(b.feature))
    .slice(0, count);
}

/**
 * The inputs that push this driver's podium score furthest in the stated direction relative to the field.
 * Grid inputs are excluded (see BASELINE_GROUP), because a move is measured against the grid. Returns an empty list
 * when nothing clears MIN_DELTA, so the page can say that no single input stands out.
 */
export function explainMove(row: Row, rows: readonly Row[], direction: Direction, count = 2): Driver[] {
  return rankDeltas(row, rows, direction, count, (feature) => FEATURE_GROUP[feature] === BASELINE_GROUP);
}

/**
 * The same, for a score level rather than a move: every input is eligible, grid included. Used to say what lifted a
 * high score or held back a low one, measured against the average car on the same grid.
 */
export function explainScore(row: Row, rows: readonly Row[], direction: Direction, count = 2): Driver[] {
  return rankDeltas(row, rows, direction, count, () => false);
}

/**
 * Plain-language statements about how Paladin's order compares with the starting grid. Each is computed from the two
 * orders alone and names its baseline, so none can be read as a claim about the result. Nothing here uses an outcome.
 */
export function gridStory(rows: readonly Row[]): string[] {
  if (rows.length < 3) return [];
  const moves = gridMoves(rows);
  const front = new Set(moves.filter((m) => m.gridRank <= 3).map((m) => m.row.driver.id));
  const top = moves.filter((m) => m.modelRank <= 3);
  const shared = top.filter((m) => front.has(m.row.driver.id)).length;
  const lines = [
    shared === 3
      ? "Paladin's top three is the same three drivers as the first three grid slots."
      : `Paladin's top three shares ${shared} ${shared === 1 ? "driver" : "drivers"} with the first three grid slots.`,
  ];
  const [up] = biggestMoves(rows, "up", 1);
  const [down] = biggestMoves(rows, "down", 1);
  if (up) lines.push(`Largest promotion against the grid: ${up.row.driver.name}, from grid rank ${up.gridRank} to model rank ${up.modelRank} (+${up.move}).`);
  if (down) lines.push(`Largest demotion against the grid: ${down.row.driver.name}, from grid rank ${down.gridRank} to model rank ${down.modelRank} (−${-down.move}).`);
  return lines;
}
