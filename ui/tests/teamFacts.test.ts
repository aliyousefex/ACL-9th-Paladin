import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import type { SeasonStandings } from "../src/features/drivers/profile.ts";
import { teamSeason, teamSeasonText } from "../src/features/teams/teamFacts.ts";
import type { Driver } from "../src/lib/data.ts";

const read = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8");
const file = JSON.parse(read("../src/data/drivers.json")) as { drivers: Driver[]; constructors: { id: number; ref: string; name: string; years: number[] }[] };
const standings = JSON.parse(read("../src/data/standings.json")) as Record<string, SeasonStandings>;
const surname = (id: number) => file.drivers.find((d) => d.id === id)!.last;

test("every team that raced in a season has a season, and a team that did not has none", () => {
  for (const team of file.constructors) {
    for (const season of [2022, 2023, 2024]) {
      const facts = teamSeason(file.drivers, team.id, season, standings[String(season)]);
      if (team.years.includes(season)) assert.ok(facts, `${team.ref} ${season}`);
      else assert.equal(facts, null, `${team.ref} ${season}: it did not race`);
    }
  }
});

test("a team's totals are its drivers' totals while they drove for it, and add up across the grid", () => {
  for (const season of [2022, 2023, 2024]) {
    let wins = 0;
    let races = 0;
    for (const team of file.constructors) {
      const facts = teamSeason(file.drivers, team.id, season, standings[String(season)]);
      if (!facts) continue;
      wins += facts.wins;
      assert.equal(facts.starts, facts.drivers.reduce((s, d) => s + d.starts, 0), `${team.ref} ${season}`);
      assert.ok(facts.podiums >= facts.wins, `${team.ref} ${season}: podiums include wins`);
      assert.ok(facts.drivers.length >= 1 && facts.drivers.length <= 5, `${team.ref} ${season}: ${facts.drivers.length} drivers`);
    }
    // every race has exactly one winner, whichever team they drove for
    races = file.drivers.flatMap((d) => d.seasons[String(season)]?.log ?? []).filter((r) => r[4] === 1 && /^1$/.test(r[6])).length;
    assert.equal(wins, races, `${season}: the teams' wins are the season's wins`);
  }
});

test("the constructors' championship result is the last position and points the standings give; the winners of 2024 won it", () => {
  const redBull = file.constructors.find((c) => c.ref === "red_bull")!;
  const mclaren = file.constructors.find((c) => c.ref === "mclaren")!;
  const s = standings["2024"].constructors[String(mclaren.id)];
  const facts = teamSeason(file.drivers, mclaren.id, 2024, standings["2024"])!;
  assert.deepEqual(facts.championship, { position: [...s.pos].reverse().find((p) => p !== null), points: [...s.pts].reverse().find((p) => p !== null) });
  assert.equal(facts.championship?.position, 1, "McLaren won the 2024 constructors' championship");
  assert.equal(teamSeason(file.drivers, redBull.id, 2024, undefined)!.championship, null, "no standings, no claim");
});

test("a driver who changed teams counts for each team only for the races driven there, and their points are not split", () => {
  // someone drove for two teams in one season
  const mover = file.drivers.flatMap((d) => Object.entries(d.seasons).map(([year, line]) => ({ d, year: Number(year), line }))).find((x) => x.line.constructors.length > 1)!;
  assert.ok(mover, "the data has a driver who changed teams in a season");
  let total = 0;
  for (const id of mover.line.constructors) {
    const entry = teamSeason(file.drivers, id, mover.year, standings[String(mover.year)])!.drivers.find((d) => d.driverId === mover.d.id)!;
    assert.ok(entry.starts > 0 && entry.starts < mover.line.races, `${mover.d.ref}: a part of the season`);
    assert.equal(entry.points, null, "a season total is not one team's points");
    total += entry.starts;
  }
  assert.equal(total, mover.line.races);
});

test("the team season text is whole, plain and uses surnames, for every team and season", () => {
  for (const team of file.constructors) {
    for (const season of [2022, 2023, 2024]) {
      const facts = teamSeason(file.drivers, team.id, season, standings[String(season)]);
      if (!facts) continue;
      const previous = teamSeason(file.drivers, team.id, season - 1, standings[String(season - 1)]);
      const text = teamSeasonText(team.name, facts, surname, previous);
      const who = `${team.ref} ${season}`;
      assert.doesNotMatch(text, /undefined|NaN|null|\s{2,}|,,|\.\./, `${who}: ${text}`);
      assert.doesNotMatch(text, /(?<![\d.])1 (races|wins|podiums)\b/, who);
      assert.doesNotMatch(text, /\b(he|she|his|her|him)\b/i, who);
      assert.match(text, new RegExp(`^In ${season}, ${team.name}`));
      assert.match(text, /\.$/);
    }
  }
});
