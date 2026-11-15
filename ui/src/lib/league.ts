/**
 * The season league: a person against Paladin and against the starting grid, on the same races.
 *
 * Rules, stated once:
 *  - A pick scores one point for each of its three drivers who finished on the podium, whatever the order. This is how
 *    Paladin and the grid are scored too (`scoreChallenge`).
 *  - Only blind picks count: locked while the result was hidden, in a browser that had never seen that race's result.
 *  - Everyone is compared on the races they actually played, so choosing easy races cannot flatter a score.
 *  - A verdict ("ahead of", "behind") is given only with enough races and when a resampled interval excludes zero.
 *
 * This is an honor system. Paladin's own call is on the race page, so a player can copy it, and nothing stops a
 * determined player looking up a result elsewhere. The league measures independence (how often a pick matched
 * Paladin's) so a copied score is visible as one. Pure functions, no framework imports.
 */

import { pairedBootstrap, type PairedInterval } from "./atlas.ts";
import { scoreChallenge, type ChallengePick } from "./challenge.ts";
import type { RaceMeta } from "./data";

/** One race a player has called, with the three drivers they locked. */
export interface Play {
  raceId: number;
  picks: number[];
}

/** Races needed before the league will say "ahead" or "behind". Fewer is shown as numbers only. */
export const MIN_RACES = 10;

export type Standing = "ahead" | "level" | "behind";

export interface RaceLine {
  race: RaceMeta;
  picks: number[];
  you: number;
  paladin: number;
  grid: number;
  /** How many of the three names are also in Paladin's top three, and in the grid's. */
  sameAsPaladin: number;
  sameAsGrid: number;
  vsPaladin: Standing;
  vsGrid: Standing;
}

export interface Record3 {
  ahead: number;
  level: number;
  behind: number;
}

export type Verdict = "ahead of Paladin" | "behind Paladin" | "level with Paladin" | "too few races to say";

export interface League {
  lines: RaceLine[];
  played: number;
  you: number;
  paladin: number;
  grid: number;
  vsPaladin: Record3;
  vsGrid: Record3;
  /** Mean number of your three names that were also Paladin's three (0 to 3), and the grid's. */
  copying: { paladin: number; grid: number };
  /** Interval for (your names per race) minus (Paladin's), or null with fewer than MIN_RACES races. */
  interval: PairedInterval | null;
  verdict: Verdict;
}

const stand = (a: number, b: number): Standing => (a > b ? "ahead" : a < b ? "behind" : "level");

/** The league counts a pick only if it was blind. Returns the counted plays and how many stored picks were left out. */
export function playsFrom(read: (raceId: number) => ChallengePick | null, races: readonly Pick<RaceMeta, "id">[]): { plays: Play[]; notCounted: number } {
  const plays: Play[] = [];
  let notCounted = 0;
  for (const race of races) {
    const pick = read(race.id);
    if (!pick) continue;
    if (pick.blind === true) plays.push({ raceId: race.id, picks: [...pick.ids] });
    else notCounted += 1;
  }
  return { plays, notCounted };
}

export function verdictFor(interval: Pick<PairedInterval, "lower" | "upper"> | null): Verdict {
  if (!interval) return "too few races to say";
  if (interval.lower > 0) return "ahead of Paladin";
  if (interval.upper < 0) return "behind Paladin";
  return "level with Paladin";
}

export function summariseLeague(races: readonly RaceMeta[], plays: readonly Play[]): League {
  const byId = new Map(races.map((race) => [race.id, race]));
  const lines: RaceLine[] = [];
  const seen = new Set<number>();
  for (const play of plays) {
    const race = byId.get(play.raceId);
    if (!race || seen.has(play.raceId)) continue;
    seen.add(play.raceId);
    const you = scoreChallenge(play.picks, race.actual);
    lines.push({
      race,
      picks: play.picks,
      you,
      paladin: race.hits,
      grid: race.baselineHits,
      sameAsPaladin: play.picks.filter((id) => race.predicted.includes(id)).length,
      sameAsGrid: play.picks.filter((id) => race.baseline.includes(id)).length,
      vsPaladin: stand(you, race.hits),
      vsGrid: stand(you, race.baselineHits),
    });
  }
  lines.sort((a, b) => a.race.date.localeCompare(b.race.date) || a.race.id - b.race.id);

  const sum = (pick: (line: RaceLine) => number) => lines.reduce((total, line) => total + pick(line), 0);
  const record = (pick: (line: RaceLine) => Standing): Record3 => ({
    ahead: lines.filter((line) => pick(line) === "ahead").length,
    level: lines.filter((line) => pick(line) === "level").length,
    behind: lines.filter((line) => pick(line) === "behind").length,
  });
  const interval = lines.length >= MIN_RACES ? pairedBootstrap(lines.map((line) => line.you - line.paladin)) : null;
  return {
    lines,
    played: lines.length,
    you: sum((line) => line.you),
    paladin: sum((line) => line.paladin),
    grid: sum((line) => line.grid),
    vsPaladin: record((line) => line.vsPaladin),
    vsGrid: record((line) => line.vsGrid),
    copying: { paladin: lines.length ? sum((line) => line.sameAsPaladin) / lines.length : 0, grid: lines.length ? sum((line) => line.sameAsGrid) / lines.length : 0 },
    interval,
    verdict: verdictFor(interval),
  };
}

export interface Duel {
  /** The races both players called. */
  races: RaceMeta[];
  you: number;
  them: number;
  paladin: number;
  grid: number;
  record: Record3;
}

/** You against another player's shared result, on the races you both played. */
export function duel(races: readonly RaceMeta[], mine: readonly Play[], theirs: readonly Play[]): Duel {
  const theirById = new Map(theirs.map((play) => [play.raceId, play]));
  const common: { race: RaceMeta; you: number; them: number }[] = [];
  const seen = new Set<number>();
  for (const play of mine) {
    const other = theirById.get(play.raceId);
    const race = races.find((candidate) => candidate.id === play.raceId);
    if (!other || !race || seen.has(race.id)) continue;
    seen.add(race.id);
    common.push({ race, you: scoreChallenge(play.picks, race.actual), them: scoreChallenge(other.picks, race.actual) });
  }
  common.sort((a, b) => a.race.date.localeCompare(b.race.date));
  const count = (standing: Standing) => common.filter((row) => stand(row.you, row.them) === standing).length;
  return {
    races: common.map((row) => row.race),
    you: common.reduce((sum, row) => sum + row.you, 0),
    them: common.reduce((sum, row) => sum + row.them, 0),
    paladin: common.reduce((sum, row) => sum + row.race.hits, 0),
    grid: common.reduce((sum, row) => sum + row.race.baselineHits, 0),
    record: { ahead: count("ahead"), level: count("level"), behind: count("behind") },
  };
}
