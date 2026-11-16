import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { ageOn, aOrAn, arc, arcSummary, countWord, highlights, listOf, plural, pointsOf, profileText, seasonFacts, seasonText, weekendsOf, type SeasonStandings } from "../src/features/drivers/profile.ts";
import type { Driver, RaceMeta } from "../src/lib/data.ts";

const read = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8");
const drivers = (JSON.parse(read("../src/data/drivers.json")) as { drivers: Driver[] }).drivers;
const races = JSON.parse(read("../src/data/races.json")) as RaceMeta[];
const standings = JSON.parse(read("../src/data/standings.json")) as Record<string, SeasonStandings>;
const raceById = new Map(races.map((r) => [r.id, r]));
const raceName = (id: number) => (raceById.get(id)?.name ?? `race ${id}`).replace(" Grand Prix", "");
const norris = drivers.find((d) => d.ref === "norris")!;

const everySeason = drivers.flatMap((driver) => Object.entries(driver.seasons).map(([year, line]) => ({ driver, season: Number(year), line })));

test("a season's facts agree with the record's own totals, for every driver and every season in the data", () => {
  assert.ok(everySeason.length > 50);
  for (const { driver, season, line } of everySeason) {
    const facts = seasonFacts(season, line, standings[String(season)].drivers[String(driver.id)]);
    const who = `${driver.ref} ${season}`;
    assert.equal(facts.starts, line.races, `${who}: starts`);
    assert.equal(facts.wins, line.wins, `${who}: wins`);
    assert.equal(facts.podiums, line.podiums, `${who}: podiums`);
    assert.equal(facts.points, line.points ?? 0, `${who}: points`);
    assert.equal(facts.classified + facts.retirements + facts.otherNonFinishes, facts.starts, `${who}: every start ends one way`);
    assert.ok(facts.pointsFinishes <= facts.classified && facts.podiums <= facts.pointsFinishes, `${who}: podiums <= points finishes <= classified`);
    assert.ok(facts.wins <= facts.podiums && facts.poles <= facts.frontRows && facts.frontRows <= facts.starts, who);
    assert.equal(facts.winRaces.length, facts.wins);
    assert.equal(facts.retiredRaces.length, facts.retirements);
  }
});

test("the championship result is the last position and points the standings give, and a season leader leads", () => {
  const facts = seasonFacts(2024, norris.seasons["2024"], standings["2024"].drivers[String(norris.id)]);
  const s = standings["2024"].drivers[String(norris.id)];
  assert.deepEqual(facts.championship, { position: [...s.pos].reverse().find((p) => p !== null), points: [...s.pts].reverse().find((p) => p !== null) });
  assert.equal(seasonFacts(2024, norris.seasons["2024"]).championship, null, "no standings, no championship claim");
  // the 2024 drivers' champion finished first
  const champion = drivers.find((d) => d.ref === "max_verstappen")!;
  assert.equal(seasonFacts(2024, champion.seasons["2024"], standings["2024"].drivers[String(champion.id)]).championship?.position, 1);
});

test("the biggest gain and drop are real moves from a real grid slot to a real finish, and are absent when there was none", () => {
  for (const { driver, season, line } of everySeason) {
    const facts = seasonFacts(season, line);
    for (const move of [facts.biggestGain, facts.biggestDrop]) {
      if (!move) continue;
      const row = line.log.find((r) => r[0] === move.raceId)!;
      assert.equal(row[3], move.from, `${driver.ref} ${season}`);
      assert.equal(Number(row[6]), move.to);
      assert.ok(move.places > 0);
    }
    if (facts.biggestGain) assert.equal(facts.biggestGain.places, facts.biggestGain.from! - facts.biggestGain.to!);
  }
  const none = seasonFacts(2024, { ...norris.seasons["2024"], log: [], races: 0, avgGrid: null, avgFinish: null, points: null });
  assert.equal(none.biggestGain, null);
  assert.equal(none.best, null);
  assert.equal(none.starts, 0);
});

test("the arc is a driver's position after every round, with gaps where they had not started, and it is summarised from its known rounds", () => {
  const year = standings["2024"];
  const points = arc(year.drivers[String(norris.id)], year.rounds);
  assert.equal(points.length, year.rounds.length);
  assert.equal(points[0].round, 1);
  assert.equal(points[points.length - 1].round, year.rounds.length);
  const summary = arcSummary(points)!;
  assert.ok(summary.best.position! <= summary.worst.position!);
  assert.equal(summary.last.position, points[points.length - 1].position);
  assert.deepEqual(arc(undefined, year.rounds), []);
  assert.equal(arcSummary([{ round: 1, raceId: 1, position: null, points: null }]), null);
});

test("the small writing helpers say what they mean", () => {
  assert.equal(plural(1, "race"), "1 race");
  assert.equal(plural(2, "race"), "2 races");
  assert.equal(plural(0, "win"), "0 wins");
  assert.equal(plural(1, "place"), "1 place");
  assert.equal(listOf([]), "");
  assert.equal(listOf(["Miami"]), "Miami");
  assert.equal(listOf(["Miami", "Monza"]), "Miami and Monza");
  assert.equal(listOf(["Miami", "Monza", "Spa"]), "Miami, Monza and Spa");
  assert.equal(aOrAn("British"), "a");
  assert.equal(aOrAn("American"), "an");
  assert.equal(aOrAn("Italian"), "an");
  assert.equal(aOrAn("Japanese"), "a");
  assert.equal(ageOn("1999-11-13", "2024-03-02"), 24);
  assert.equal(ageOn("1999-11-13", "2024-11-13"), 25);
  assert.equal(ageOn("1999-11-13", "2024-11-12"), 24);
});

/** The sentences must be safe to show for anyone in the data. */
function plainSentences(text: string, who: string) {
  assert.ok(text.length > 40, `${who}: some text`);
  assert.doesNotMatch(text, /undefined|NaN|null|\[object|Infinity|\s{2,}|,,|\.\./, `${who}: a broken value in "${text}"`);
  assert.doesNotMatch(text, /\b(he|she|his|hers|him|her|himself|herself)\b/i, `${who}: a pronoun, which the data cannot support: "${text}"`);
  assert.match(text, /[.)]$/, `${who}: ends as a sentence`);
  assert.doesNotMatch(text, /(^|[.!?] )[a-z]/, `${who}: a sentence starts with a capital`);
}

test("the writing is whole, in plain words and never a pronoun, for every driver and season, and the number words agree", () => {
  for (const driver of drivers) {
    const seasons = Object.keys(driver.seasons).map(Number).sort();
    const inputs = seasons.map((season) => {
      const line = driver.seasons[String(season)];
      return { season, facts: seasonFacts(season, line, standings[String(season)].drivers[String(driver.id)]), teams: ["Team"], number: line.number };
    });
    const first = races.filter((r) => r.year === seasons[seasons.length - 1]).sort((a, b) => a.round - b.round)[0];
    const profile = profileText({ last: driver.last, nationality: driver.nationality, dob: driver.dob, latestStart: first.date.slice(0, 10), seasons: inputs });
    plainSentences(profile, `${driver.ref} profile`);
    assert.match(profile, new RegExp(`^${driver.last} is (a|an) ${driver.nationality.trim()} driver, born `, "i"), "and a surname such as de Vries still opens a sentence in capitals");
    assert.match(profile, /^[A-Z]/);
    assert.doesNotMatch(profile, /(?<![\d.])1 (races|wins|podiums)\b/, `${driver.ref}: 1 is singular`);
    inputs.forEach((input, i) => {
      const text = seasonText({ last: driver.last, season: input.season, facts: input.facts, teams: input.teams, previous: i > 0 ? inputs[i - 1].facts : null, raceName });
      plainSentences(text, `${driver.ref} ${input.season}`);
      assert.doesNotMatch(text, /(?<![\d.])1 (races|wins|starts|podiums|places)\b/, `${driver.ref} ${input.season}: 1 is singular`);
      assert.doesNotMatch(text, /\b(0 wins|0 podiums)\b/, `${driver.ref} ${input.season}: nothing is said of zero wins as a count`);
      assert.match(text, new RegExp(`^In ${input.season}, ${driver.last} drove for`));
    });
  }
});

test("a season's text states only what the record holds: Norris 2024", () => {
  const line = norris.seasons["2024"];
  const facts = seasonFacts(2024, line, standings["2024"].drivers[String(norris.id)]);
  const text = seasonText({ last: "Norris", season: 2024, facts, teams: ["McLaren"], previous: seasonFacts(2023, norris.seasons["2023"], standings["2023"].drivers[String(norris.id)]), raceName });
  assert.match(text, /^In 2024, Norris drove for McLaren and finished 2nd in the drivers' championship with \d+ points\./);
  assert.match(text, new RegExp(`over ${line.races} starts`, "i"));
  assert.match(text, /lined up P\d+\.\d on average and finished P\d+\.\d/);
  assert.match(text, /That is \d+ (more|fewer) points than in 2023 \(\d+, when Norris finished \d+(st|nd|rd|th)\)\.$/);
  const wins = facts.winRaces.map(raceName);
  for (const name of wins) assert.ok(text.includes(name), `${name} is named as a win`);
});

test("the highlights are the weekends worth finding, each with its numbers, and every one is a race the driver started", () => {
  for (const { driver, season, line } of everySeason) {
    const facts = seasonFacts(season, line);
    const list = highlights(facts, line.log, raceName);
    const started = new Set(line.log.map((r) => r[0]));
    for (const item of list) {
      assert.ok(started.has(item.raceId), `${driver.ref} ${season}: ${item.headline} was not a start`);
      assert.ok(item.detail.endsWith("."), item.detail);
    }
    assert.equal(list.filter((h) => h.kind === "win").length, facts.wins);
    assert.equal(list.filter((h) => h.kind === "retired").length, facts.retirements);
    if (facts.wins > 0) assert.equal(list.filter((h) => h.kind === "best").length, 0, "a win is the best, so it is not said twice");
  }
});

test("a weekend is one race with every reason it is listed: in calendar order, with the grid and finish from the driver's own log", () => {
  for (const { driver, season, line } of everySeason) {
    const moments = highlights(seasonFacts(season, line), line.log, raceName);
    const list = weekendsOf(moments, line.log);
    const who = `${driver.ref} ${season}`;
    assert.equal(new Set(list.map((w) => w.raceId)).size, list.length, `${who}: a race is listed once`);
    assert.equal(list.reduce((n, w) => n + w.kinds.length, 0), moments.length, `${who}: nothing is dropped or said twice`);
    assert.deepEqual(list.map((w) => w.round), list.map((w) => w.round).sort((a, b) => a - b), `${who}: calendar order`);
    for (const w of list) {
      const row = line.log.find((r) => r[0] === w.raceId)!;
      assert.equal(w.grid, row[3], `${who} round ${w.round}: grid`);
      assert.equal(w.finish, /^\d+$/.test(row[6]) ? Number(row[6]) : null, `${who} round ${w.round}: finish`);
      assert.equal(w.constructorId, row[5]);
      assert.equal(w.retired, w.kinds.includes("retired"), `${who} round ${w.round}: retired matches`);
      if (w.kinds.includes("gain") || w.kinds.includes("drop")) assert.ok((w.places ?? 0) > 0, `${who} round ${w.round}: the places are given`);
      else assert.equal(w.places, null);
      if (w.kinds.includes("win")) assert.equal(w.finish, 1, `${who} round ${w.round}: a win finished first`);
      if (w.kinds.includes("pole")) assert.equal(w.grid, 1, `${who} round ${w.round}: a pole started first`);
    }
  }
  // Norris won the 2024 Dutch Grand Prix from pole: one weekend carrying both, not two lines
  const line = norris.seasons["2024"];
  const list = weekendsOf(highlights(seasonFacts(2024, line), line.log, raceName), line.log);
  const dutch = list.find((w) => raceName(w.raceId) === "Dutch")!;
  assert.deepEqual(dutch.kinds, ["win", "pole"]);
});

test("points mean one thing wherever they are quoted: the championship's when the standings have them, so a sentence and a table never disagree", () => {
  for (const { driver, season, line } of everySeason) {
    const standing = standings[String(season)].drivers[String(driver.id)];
    const facts = seasonFacts(season, line, standing);
    const previousLine = driver.seasons[String(season - 1)];
    const previous = previousLine ? seasonFacts(season - 1, previousLine, standings[String(season - 1)].drivers[String(driver.id)]) : null;
    const text = seasonText({ last: driver.last, season, facts, teams: ["Team"], previous, raceName });
    const quoted = facts.championship?.points ?? facts.points;
    assert.equal(pointsOf(facts), quoted);
    assert.ok(text.includes(`${quoted} points.`), `${driver.ref} ${season}: the text quotes ${quoted}`);
    if (previous && previous.starts > 0) {
      const gap = quoted - pointsOf(previous);
      if (gap !== 0) assert.ok(text.includes(`${Math.abs(gap)} ${gap > 0 ? "more" : "fewer"} points than in ${season - 1} (${pointsOf(previous)}`), `${driver.ref} ${season}: the comparison uses the same points`);
    }
  }
  // the two sources really do differ for some drivers, which is why this matters
  const norris2024 = seasonFacts(2024, norris.seasons["2024"], standings["2024"].drivers[String(norris.id)]);
  assert.notEqual(norris2024.points, norris2024.championship!.points, "race-result points and championship points differ for Norris in 2024");
  assert.equal(pointsOf(norris2024), norris2024.championship!.points);
});

test("a small count is a word in running text, a larger one is a number", () => {
  assert.equal(countWord(3), "three");
  assert.equal(countWord(1), "one");
  assert.equal(countWord(9), "nine");
  assert.equal(countWord(12), "12");
  assert.equal(countWord(0), "no");
});
