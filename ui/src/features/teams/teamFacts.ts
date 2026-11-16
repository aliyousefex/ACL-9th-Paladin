/**
 * A team's season as the record gives it: where it finished in the constructors' championship, who drove for it, and how many races and
 * podiums they won while they drove for it. A driver who moved teams part-way through a season counts only for the races they did
 * for this one, so the team's totals are its own. Pure, like the driver profile it sits beside.
 */
import type { Driver } from "../../lib/data";
import { ordinal } from "../../lib/format.ts";
import { listOf, plural, type SeasonStandings } from "../drivers/profile.ts";

export interface TeamDriver {
  driverId: number;
  starts: number;
  wins: number;
  podiums: number;
  /** The driver's points for the season, only when every race of theirs was for this team (otherwise the season total is not this team's). */
  points: number | null;
}

export interface TeamSeason {
  season: number;
  constructorId: number;
  championship: { position: number; points: number } | null;
  /** Race starts by the team's drivers: two cars, so about twice the number of races. */
  starts: number;
  wins: number;
  podiums: number;
  drivers: TeamDriver[];
}

const lastOf = (values: (number | null)[]): number | null => {
  for (let i = values.length - 1; i >= 0; i--) if (values[i] !== null) return values[i];
  return null;
};
const classifiedAs = (text: string): number | null => (/^\d+$/.test(text) ? Number(text) : null);

/** The team's season, or null when it did not race that year. */
export function teamSeason(drivers: Driver[], constructorId: number, season: number, standings: SeasonStandings | undefined): TeamSeason | null {
  const mine: TeamDriver[] = [];
  for (const driver of drivers) {
    const line = driver.seasons[String(season)];
    if (!line) continue;
    const rows = line.log.filter((row) => row[5] === constructorId);
    if (rows.length === 0) continue;
    const positions = rows.map((row) => classifiedAs(row[6]));
    mine.push({
      driverId: driver.id,
      starts: rows.length,
      wins: positions.filter((p) => p === 1).length,
      podiums: positions.filter((p) => p !== null && p <= 3).length,
      points: rows.length === line.log.length ? (line.points ?? 0) : null,
    });
  }
  if (mine.length === 0) return null;
  mine.sort((a, b) => b.starts - a.starts || b.wins - a.wins || a.driverId - b.driverId);
  const standing = standings?.constructors[String(constructorId)];
  const position = standing ? lastOf(standing.pos) : null;
  const points = standing ? lastOf(standing.pts) : null;
  return {
    season,
    constructorId,
    championship: position !== null && points !== null ? { position, points } : null,
    starts: mine.reduce((sum, d) => sum + d.starts, 0),
    wins: mine.reduce((sum, d) => sum + d.wins, 0),
    podiums: mine.reduce((sum, d) => sum + d.podiums, 0),
    drivers: mine,
  };
}

/** A team's season in a paragraph. `driverName` gives a driver's surname. */
export function teamSeasonText(team: string, facts: TeamSeason, driverName: (id: number) => string, previous: TeamSeason | null): string {
  const s: string[] = [];
  s.push(
    facts.championship
      ? `In ${facts.season}, ${team} finished ${ordinal(facts.championship.position)} in the constructors' championship with ${facts.championship.points} points.`
      : `In ${facts.season}, ${team} raced in the championship.`,
  );
  const names = facts.drivers.map((d) => driverName(d.driverId));
  s.push(`${listOf(names)} drove for the team${facts.drivers.length > 1 ? "" : ", the only driver in the data"}.`);
  if (facts.wins > 0) s.push(`The team's drivers won ${plural(facts.wins, "race")} and finished on the podium ${facts.podiums === 1 ? "once" : `${facts.podiums} times`} in all.`);
  else if (facts.podiums > 0) s.push(`The team's drivers finished on the podium ${facts.podiums === 1 ? "once" : `${facts.podiums} times`}, without a win.`);
  else s.push("No driver of the team finished on the podium.");
  if (previous?.championship && facts.championship) {
    const diff = facts.championship.points - previous.championship.points;
    const how = diff === 0 ? "the same number of points as" : diff > 0 ? `${diff} more points than` : `${-diff} fewer points than`;
    s.push(`That is ${how} in ${previous.season} (${previous.championship.points}, when the team finished ${ordinal(previous.championship.position)}).`);
  }
  return s.join(" ");
}
