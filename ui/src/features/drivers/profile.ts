/**
 * What can be said about a driver from the record, as facts and as plain sentences. Everything here is a function of a season's race
 * log and the championship standings in the data: nothing is estimated and nothing comes from outside it. The sentences are written
 * to be read, not to impress: numbers and places, no adjectives that grade a driver, and the surname as the subject throughout
 * because the data says nothing about anyone's pronouns.
 */
import type { SeasonLine } from "../../lib/data";
import { longDate, ordinal } from "../../lib/format.ts";

export type LogRow = SeasonLine["log"][number];

export interface Standing {
  pts: (number | null)[];
  pos: (number | null)[];
  wins: number | null;
}

export interface SeasonStandings {
  rounds: number[];
  drivers: Record<string, Standing>;
  constructors: Record<string, Standing>;
}

/** A race named for a sentence: "Bahrain", not "Bahrain Grand Prix". */
export type RaceName = (raceId: number) => string;

const classified = (row: LogRow): boolean => /^\d+$/.test(row[6]);
const lastOf = (values: (number | null)[]): number | null => {
  for (let i = values.length - 1; i >= 0; i--) if (values[i] !== null) return values[i];
  return null;
};

export interface Moment {
  raceId: number;
  round: number;
  /** The grid slot (null for the pit lane) and the finishing position (null if not classified). */
  from: number | null;
  to: number | null;
}

export interface SeasonFacts {
  season: number;
  starts: number;
  wins: number;
  podiums: number;
  points: number;
  poles: number;
  frontRows: number;
  pitLaneStarts: number;
  classified: number;
  retirements: number;
  /** Disqualified, excluded, withdrawn, did not qualify, not classified. */
  otherNonFinishes: number;
  pointsFinishes: number;
  avgGrid: number | null;
  avgFinish: number | null;
  /** Average grid slot minus average finish: positive is places gained between the lights and the flag. */
  gained: number | null;
  best: { position: number; raceIds: number[] } | null;
  winRaces: number[];
  poleRaces: number[];
  retiredRaces: number[];
  biggestGain: (Moment & { places: number }) | null;
  biggestDrop: (Moment & { places: number }) | null;
  championship: { position: number; points: number } | null;
}

/** The facts of one driver's season, from the season line (the record's own totals) and the log under it. */
export function seasonFacts(season: number, line: SeasonLine, standing?: Standing): SeasonFacts {
  const rows = line.log;
  const positions = rows.map((row) => (classified(row) ? Number(row[6]) : null));
  const finishes = positions.filter((p): p is number => p !== null);
  const best = finishes.length ? Math.min(...finishes) : null;

  let biggestGain: SeasonFacts["biggestGain"] = null;
  let biggestDrop: SeasonFacts["biggestDrop"] = null;
  rows.forEach((row, i) => {
    const to = positions[i];
    const from = row[3];
    if (to === null || from === null) return;
    const moment: Moment = { raceId: row[0], round: row[1], from, to };
    if (from - to > (biggestGain?.places ?? 0)) biggestGain = { ...moment, places: from - to };
    if (to - from > (biggestDrop?.places ?? 0)) biggestDrop = { ...moment, places: to - from };
  });

  const finalPosition = standing ? lastOf(standing.pos) : null;
  const finalPoints = standing ? lastOf(standing.pts) : null;
  return {
    season,
    starts: rows.length,
    wins: positions.filter((p) => p === 1).length,
    podiums: positions.filter((p) => p !== null && p <= 3).length,
    points: line.points ?? 0,
    poles: rows.filter((row) => row[3] === 1).length,
    frontRows: rows.filter((row) => row[3] !== null && row[3] <= 2).length,
    pitLaneStarts: rows.filter((row) => row[3] === null).length,
    classified: finishes.length,
    retirements: rows.filter((row) => row[6] === "R").length,
    otherNonFinishes: rows.filter((row) => !classified(row) && row[6] !== "R").length,
    pointsFinishes: finishes.filter((p) => p <= 10).length,
    avgGrid: line.avgGrid,
    avgFinish: line.avgFinish,
    gained: line.avgGrid !== null && line.avgFinish !== null ? line.avgGrid - line.avgFinish : null,
    best: best === null ? null : { position: best, raceIds: rows.filter((_, i) => positions[i] === best).map((row) => row[0]) },
    winRaces: rows.filter((_, i) => positions[i] === 1).map((row) => row[0]),
    poleRaces: rows.filter((row) => row[3] === 1).map((row) => row[0]),
    retiredRaces: rows.filter((row) => row[6] === "R").map((row) => row[0]),
    biggestGain,
    biggestDrop,
    championship: finalPosition !== null && finalPoints !== null ? { position: finalPosition, points: finalPoints } : null,
  };
}

/* ------------------------------------------------------------------ the championship arc */

export interface ArcPoint {
  round: number;
  raceId: number;
  position: number | null;
  points: number | null;
}

/** A driver's (or a team's) championship position and points after each round of a season. */
export function arc(standing: Standing | undefined, rounds: number[]): ArcPoint[] {
  if (!standing) return [];
  return rounds.map((raceId, i) => ({ round: i + 1, raceId, position: standing.pos[i] ?? null, points: standing.pts[i] ?? null }));
}

export interface ArcSummary {
  best: ArcPoint;
  worst: ArcPoint;
  first: ArcPoint;
  last: ArcPoint;
  /** How many rounds the person sat in each position, for the sentence about where they spent the season. */
  leaderRounds: number;
}

export function arcSummary(points: ArcPoint[]): ArcSummary | null {
  const known = points.filter((p) => p.position !== null);
  if (known.length === 0) return null;
  const best = known.reduce((a, b) => (b.position! < a.position! ? b : a));
  const worst = known.reduce((a, b) => (b.position! > a.position! ? b : a));
  return { best, worst, first: known[0], last: known[known.length - 1], leaderRounds: known.filter((p) => p.position === 1).length };
}

/* ------------------------------------------------------------------ sentences */

export const plural = (n: number, one: string, many = `${one}s`): string => `${n} ${n === 1 ? one : many}`;

/** "A", "A and B", "A, B and C". */
export function listOf(items: string[]): string {
  if (items.length <= 1) return items.join("");
  return `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;
}

/** A capital at the start of every sentence: a surname such as "de Vries" begins in lower case, and still opens a sentence as "De Vries". */
export const capitalised = (text: string): string => text.replace(/(^|[.!?] )([a-z])/g, (_, before: string, letter: string) => before + letter.toUpperCase());

/**
 * The points to quote for a season. The championship's, when the standings have them, because that is the total a driver is known
 * by (it includes any points from sprint races); otherwise the points in the race results. Never one in one sentence and the other in the next.
 */
export const pointsOf = (facts: SeasonFacts): number => facts.championship?.points ?? facts.points;

const WORDS = ["no", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine"];
/** A small count as a word in running text: "three seasons", but "12 races". */
export const countWord = (n: number): string => (n >= 0 && n < WORDS.length ? WORDS[n] : String(n));

export const aOrAn = (word: string): "a" | "an" => (/^[aeiou]/i.test(word) ? "an" : "a");

/** Whole years of age on a date: both are ISO dates. */
export function ageOn(birth: string, on: string): number {
  const b = new Date(`${birth}T00:00:00Z`);
  const d = new Date(`${on}T00:00:00Z`);
  let age = d.getUTCFullYear() - b.getUTCFullYear();
  if (d.getUTCMonth() < b.getUTCMonth() || (d.getUTCMonth() === b.getUTCMonth() && d.getUTCDate() < b.getUTCDate())) age -= 1;
  return age;
}

const places = (n: number): string => (Math.abs(n) % 1 === 0 ? String(Math.abs(n)) : Math.abs(n).toFixed(1));

export interface ProfileInput {
  last: string;
  nationality: string;
  dob: string;
  /** The first race date of the latest season the driver raced in, for the age. */
  latestStart: string;
  seasons: { season: number; facts: SeasonFacts; teams: string[]; number: number | null }[];
}

/** Two or three sentences about who the driver is and what the three seasons add up to. */
export function profileText(input: ProfileInput): string {
  const { last, dob, latestStart, seasons } = input;
  // the data has stray whitespace in some nationalities ("Argentinian "), so it is trimmed where it is written out
  const nationality = input.nationality.trim();
  if (seasons.length === 0) return "";
  const latest = seasons[seasons.length - 1];
  const first = seasons[0];
  const span = first.season === latest.season ? `the ${first.season} season` : `the ${countWord(seasons.length)} seasons from ${first.season} to ${latest.season}`;
  const starts = seasons.reduce((sum, s) => sum + s.facts.starts, 0);
  const wins = seasons.reduce((sum, s) => sum + s.facts.wins, 0);
  const podiums = seasons.reduce((sum, s) => sum + s.facts.podiums, 0);
  const points = seasons.reduce((sum, s) => sum + pointsOf(s.facts), 0);
  const teams = [...new Set(seasons.flatMap((s) => s.teams))];
  const numbers = [...new Set(seasons.map((s) => s.number).filter((n): n is number => n !== null))];

  const sentences: string[] = [];
  sentences.push(`${last} is ${aOrAn(nationality)} ${nationality} driver, born ${longDate(dob)}, and was ${ageOn(dob, latestStart)} at the start of the ${latest.season} season.`);

  let record: string;
  if (wins === 0 && podiums === 0) record = "without a win or a podium";
  else if (wins === 0) record = `with ${plural(podiums, "podium")} and no wins`;
  else record = `with ${plural(wins, "win")} and ${plural(podiums, "podium")} in all`;
  sentences.push(`In ${span} that this site covers, ${last} started ${plural(starts, "race")} for ${listOf(teams)} and scored ${points} points, ${record}.`);

  const finished = seasons.filter((s) => s.facts.championship);
  if (finished.length) {
    const bestSeason = finished.reduce((a, b) => (b.facts.championship!.position < a.facts.championship!.position ? b : a));
    const where = finished.length === 1 ? `${ordinal(bestSeason.facts.championship!.position)} in the drivers' championship in ${bestSeason.season}` : `${ordinal(bestSeason.facts.championship!.position)} in the drivers' championship, in ${bestSeason.season}`;
    sentences.push(`The best championship finish in these seasons was ${where}.`);
  }
  if (numbers.length === 1) sentences.push(`${last} raced as number ${numbers[0]}.`);
  return capitalised(sentences.join(" "));
}

export interface SeasonInput {
  last: string;
  season: number;
  facts: SeasonFacts;
  teams: string[];
  previous: SeasonFacts | null;
  raceName: RaceName;
}

/** The season in a paragraph: where it ended, what was won, how the grid turned into the finish, how often the car got to the flag. */
export function seasonText(input: SeasonInput): string {
  const { last, season, facts, teams, previous, raceName } = input;
  const s: string[] = [];

  const drove = `In ${season}, ${last} drove for ${listOf(teams)}`;
  s.push(
    facts.championship
      ? `${drove} and finished ${ordinal(facts.championship.position)} in the drivers' championship with ${facts.championship.points} points.`
      : `${drove} and scored ${pointsOf(facts)} points.`,
  );

  const poles = facts.poles > 0 ? ` and started from pole ${facts.poles === 1 ? "once" : `${facts.poles} times`}` : "";
  if (facts.wins > 0) {
    const where = facts.wins <= 4 ? ` (${listOf(facts.winRaces.map(raceName))})` : "";
    s.push(`${last} won ${plural(facts.wins, "race")}${where} and finished on the podium ${facts.podiums === 1 ? "once" : `${facts.podiums} times`} in all${poles}.`);
  } else if (facts.podiums > 0) {
    s.push(`${last} finished on the podium ${facts.podiums === 1 ? "once" : `${facts.podiums} times`}, without a win${poles}.`);
  } else {
    const bestText = facts.best ? ` The best finish was ${ordinal(facts.best.position)}, at ${listOf(facts.best.raceIds.map(raceName))}.` : "";
    s.push(`${last} did not finish on the podium${poles}.${bestText}`);
  }

  if (facts.avgGrid !== null && facts.avgFinish !== null && facts.gained !== null) {
    const amount = places(facts.gained);
    const unit = amount === "1" ? "place" : "places";
    const change = Math.abs(facts.gained) < 0.05 ? "so no places were gained or lost on average" : facts.gained > 0 ? `a gain of ${amount} ${unit} a race` : `a loss of ${amount} ${unit} a race`;
    s.push(`Over ${plural(facts.starts, "start")}, ${last} lined up P${facts.avgGrid.toFixed(1)} on average and finished P${facts.avgFinish.toFixed(1)}, ${change}.`);
  }

  const flag = `${last} was classified in ${facts.classified} of ${plural(facts.starts, "race")} and finished in the points in ${facts.pointsFinishes}`;
  if (facts.retirements > 0) {
    const named = facts.retiredRaces.length <= 3 ? ` (${listOf(facts.retiredRaces.map(raceName))})` : "";
    s.push(`${flag}; ${facts.retirements === 1 ? "one race ended" : `${facts.retirements} races ended`} in retirement${named}.`);
  } else if (facts.otherNonFinishes > 0) {
    s.push(`${flag}; ${plural(facts.otherNonFinishes, "race")} did not end in a classified finish.`);
  } else {
    s.push(`${flag}, and no race ended in retirement.`);
  }

  if (previous && previous.starts > 0) {
    const diff = pointsOf(facts) - pointsOf(previous);
    const how = diff === 0 ? "the same number of points as" : diff > 0 ? `${diff} more points than` : `${-diff} fewer points than`;
    const rank = previous.championship ? `, when ${last} finished ${ordinal(previous.championship.position)}` : "";
    s.push(`That is ${how} in ${previous.season} (${pointsOf(previous)}${rank}).`);
  }
  return capitalised(s.join(" "));
}

/* ------------------------------------------------------------------ highlights */

export interface Highlight {
  kind: "win" | "pole" | "best" | "gain" | "drop" | "retired";
  raceId: number;
  headline: string;
  detail: string;
  /** For a gain or a drop: how many places it was. */
  places?: number;
}

/** The weekends worth finding: each win, the best finish if there was no win, the biggest gain and drop on the grid-to-flag line, each retirement. */
export function highlights(facts: SeasonFacts, rows: LogRow[], raceName: RaceName): Highlight[] {
  const row = new Map(rows.map((r) => [r[0], r]));
  const gridText = (id: number) => (row.get(id)?.[3] ? `P${row.get(id)![3]}` : "the pit lane");
  const out: Highlight[] = [];
  for (const id of facts.winRaces) out.push({ kind: "win", raceId: id, headline: raceName(id), detail: `Won, from ${gridText(id)} on the grid.` });
  if (facts.wins === 0 && facts.best) {
    for (const id of facts.best.raceIds.slice(0, 2)) out.push({ kind: "best", raceId: id, headline: raceName(id), detail: `Best finish of the season: ${ordinal(facts.best.position)}, from ${gridText(id)}.` });
  }
  for (const id of facts.poleRaces) out.push({ kind: "pole", raceId: id, headline: raceName(id), detail: `Started from pole.` });
  if (facts.biggestGain) {
    const g = facts.biggestGain;
    out.push({ kind: "gain", raceId: g.raceId, places: g.places, headline: raceName(g.raceId), detail: `Gained ${plural(g.places, "place")}: from P${g.from} on the grid to ${ordinal(g.to!)}.` });
  }
  if (facts.biggestDrop) {
    const d = facts.biggestDrop;
    out.push({ kind: "drop", raceId: d.raceId, places: d.places, headline: raceName(d.raceId), detail: `Lost ${plural(d.places, "place")}: from P${d.from} on the grid to ${ordinal(d.to!)}.` });
  }
  for (const id of facts.retiredRaces) out.push({ kind: "retired", raceId: id, headline: raceName(id), detail: `Retired, from ${gridText(id)} on the grid.` });
  return out;
}

/** One race that earned a mention, with everything said about it in one place: a win from pole is one weekend, not two lines. */
export interface Weekend {
  raceId: number;
  round: number;
  /** The grid slot, or null for the pit lane. */
  grid: number | null;
  /** The classified finishing position, or null when the driver was not classified. */
  finish: number | null;
  /** The constructor the driver raced for that weekend. */
  constructorId: number;
  /** Why it is listed, in the order a reader wants it: win, best finish, pole, biggest gain, biggest drop, retirement. */
  kinds: Highlight["kind"][];
  /** The places gained or lost, when the weekend is the biggest gain or drop. */
  places: number | null;
  /** Whether the driver retired. */
  retired: boolean;
}

const KIND_ORDER: Highlight["kind"][] = ["win", "best", "pole", "gain", "drop", "retired"];

/** The highlights grouped by race and put in calendar order, each with the grid slot and finish from the driver's own log. */
export function weekendsOf(moments: Highlight[], rows: LogRow[]): Weekend[] {
  const row = new Map(rows.map((r) => [r[0], r]));
  const byRace = new Map<number, Weekend>();
  for (const moment of moments) {
    const entry = row.get(moment.raceId);
    if (!entry) continue;
    let weekend = byRace.get(moment.raceId);
    if (!weekend) {
      weekend = { raceId: moment.raceId, round: entry[1], grid: entry[3], finish: classified(entry) ? Number(entry[6]) : null, constructorId: entry[5], kinds: [], places: null, retired: entry[6] === "R" };
      byRace.set(moment.raceId, weekend);
    }
    weekend.kinds.push(moment.kind);
    if (moment.places !== undefined) weekend.places = moment.places;
  }
  return [...byRace.values()]
    .map((w) => ({ ...w, kinds: [...w.kinds].sort((a, b) => KIND_ORDER.indexOf(a) - KIND_ORDER.indexOf(b)) }))
    .sort((a, b) => a.round - b.round);
}
