import { explainScore, type Driver } from "./explain.ts";
import type { Row } from "./rows";

/**
 * After the flag: what the model got right and wrong, grounded in numbers the page already has.
 *
 * Two kinds of information are kept apart on purpose. The reasons for a score come only from the model's
 * pre-race inputs (its own per-feature contributions against the average car on that grid). What happened
 * afterwards comes only from the classification. Nothing here estimates a cause for a result.
 */

export type CaseKind = "hit" | "false-alarm" | "miss";

export interface AutopsyCase {
  row: Row;
  kind: CaseKind;
  /** 1 = highest podium score in the field. */
  modelRank: number;
  score: number;
  aboveCutoff: boolean;
  grid: number | null;
  finish: number | null;
  /** How the race ended for this driver. Known only after the flag. */
  aftermath: string;
  /** Did not take the flag: retired, disqualified or withdrew (see didNotFinish). */
  didNotFinish: boolean;
  /** Pre-race inputs that lifted a high score (hit, false alarm) or held back a low one (miss), against the field average. */
  reasons: Driver[];
}

export interface Autopsy {
  /** Paladin's three highest scores, in rank order. */
  modelTop: AutopsyCase[];
  /** Podium finishers that were not in Paladin's top three, in finishing order. */
  misses: AutopsyCase[];
  /** The podium in finishing order, with where Paladin had ranked each driver. */
  podium: { finish: number; row: Row; modelRank: number; inTop: boolean }[];
  hits: number;
  baselineHits: number;
  /** The classification cutoff applied to every driver in the field. */
  cutoff: { threshold: number; above: number; aboveOnPodium: number; podium: number; podiumAbove: number };
  /** The same statements, kept separate so a page can show only those its own graphics do not already say. */
  statements: { verdict: string; podium: string; cutoff: string; retirements: string | null };
  /** All statements in reading order. */
  lines: string[];
}

export function ordinal(value: number): string {
  const rest = value % 100;
  if (rest >= 11 && rest <= 13) return `${value}th`;
  return `${value}${["th", "st", "nd", "rd"][value % 10 > 3 ? 0 : value % 10]}`;
}

/**
 * True when the driver did not take the flag: retired, disqualified or withdrew. A retiree who completed enough of the
 * distance is still given a finishing position, so the status ("Engine", "Fuel pressure") is what tells them apart
 * from a car that finished ("Finished", "+1 Lap").
 */
export function didNotFinish(entry: { txt: string; status: string }): boolean {
  if (!/^\d+$/.test(entry.txt)) return true;
  return !(entry.status === "Finished" || /^\+\d+ Laps?$/.test(entry.status));
}

/** How a driver's race ended, from the classification text and status ("12", "R", "D", "W"; "Engine", "+1 Lap"). */
export function aftermath(entry: { txt: string; status: string; laps: number | null }): string {
  const { txt, status, laps } = entry;
  if (/^\d+$/.test(txt)) {
    if (status === "Finished") return `Finished P${txt}`;
    const down = /^\+(\d+) Laps?$/.exec(status);
    if (down) return `Finished P${txt}, ${down[1]} ${down[1] === "1" ? "lap" : "laps"} down`;
    return `Retired${laps ? ` after ${laps} ${laps === 1 ? "lap" : "laps"}` : ""}: ${status}. Classified P${txt} for the distance completed`;
  }
  if (txt === "D") return "Disqualified";
  if (txt === "W") return "Withdrew";
  const when = laps !== null && laps > 0 ? ` after ${laps} ${laps === 1 ? "lap" : "laps"}` : " on the opening lap";
  return `Retired${when}${status && status !== "Retired" ? `: ${status}` : ""}`;
}

function caseFor(row: Row, rows: readonly Row[], kind: CaseKind, threshold: number): AutopsyCase {
  return {
    row,
    kind,
    modelRank: row.rank,
    score: row.score,
    aboveCutoff: row.score >= threshold,
    grid: row.grid,
    finish: row.finish,
    aftermath: aftermath(row.entry),
    didNotFinish: didNotFinish(row.entry),
    reasons: explainScore(row, rows, kind === "miss" ? "down" : "up", 2),
  };
}

export function autopsy(rows: readonly Row[], baseline: readonly number[], threshold: number): Autopsy {
  const top = [...rows].filter((r) => r.rank <= 3).sort((a, b) => a.rank - b.rank);
  const onPodium = [...rows].filter((r) => r.podium).sort((a, b) => (a.finish ?? 99) - (b.finish ?? 99));
  const modelTop = top.map((row) => caseFor(row, rows, row.podium ? "hit" : "false-alarm", threshold));
  const misses = onPodium.filter((r) => r.rank > 3).map((row) => caseFor(row, rows, "miss", threshold));
  const hits = modelTop.filter((c) => c.kind === "hit").length;
  const baselineHits = baseline.filter((id) => onPodium.some((r) => r.driver.id === id)).length;
  const above = rows.filter((r) => r.score >= threshold);
  const cutoff = {
    threshold,
    above: above.length,
    aboveOnPodium: above.filter((r) => r.podium).length,
    podium: onPodium.length,
    podiumAbove: onPodium.filter((r) => r.score >= threshold).length,
  };

  const verdictWord = hits > baselineHits ? "Paladin did better than the grid here." : hits < baselineHits ? "The grid did better than Paladin here." : "Paladin and the grid tied.";
  const out = modelTop.filter((c) => c.didNotFinish);
  const statements = {
    verdict: `Paladin's top three put ${hits} of 3 on the podium. The baseline, the first three grid slots, put ${baselineHits} of 3. ${verdictWord}`,
    podium: `The podium, by where Paladin ranked each driver before the start: ${onPodium
      .map((r) => `${r.finish === 1 ? "the winner" : `P${r.finish}`} ${ordinal(r.rank)}`)
      .join(", ")}.`,
    cutoff: `Applying the ${threshold.toFixed(3)} cutoff to the whole field, ${cutoff.above} ${cutoff.above === 1 ? "driver was" : "drivers were"} predicted to podium and ${cutoff.aboveOnPodium} of them did; ${cutoff.podiumAbove} of the ${cutoff.podium} podium finishers scored above it.`,
    retirements:
      out.length > 0
        ? `${out.length === 1 ? "One" : out.length === 2 ? "Two" : "Three"} of Paladin's top three did not take the flag (retired, disqualified or withdrew). None of the 16 inputs measures reliability, incidents or strategy, so that is outside what the model can see.`
        : null,
  };
  const lines = [statements.verdict, ...(onPodium.length > 0 ? [statements.podium] : []), statements.cutoff, ...(statements.retirements ? [statements.retirements] : [])];
  return { modelTop, misses, podium: onPodium.map((row, i) => ({ finish: row.finish ?? i + 1, row, modelRank: row.rank, inTop: row.rank <= 3 })), hits, baselineHits, cutoff, statements, lines };
}
