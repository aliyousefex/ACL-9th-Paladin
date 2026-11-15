import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { entriesByRace } from "../src/lib/atlas.ts";
import { parsePick, type ChallengePick } from "../src/lib/challenge.ts";
import type { Driver, RaceMeta } from "../src/lib/data.ts";
import { MIN_RACES, duel, playsFrom, summariseLeague, verdictFor, type Play } from "../src/lib/league.ts";

const read = (name: string) => JSON.parse(readFileSync(new URL(`../src/data/${name}`, import.meta.url), "utf8"));
const races = read("races.json") as RaceMeta[];
const drivers = read("drivers.json").drivers as Driver[];
const field = entriesByRace(races, drivers);

/** Three drivers who raced but did not reach the podium: a guaranteed zero. */
const offPodium = (race: RaceMeta) => field.get(race.id)!.filter((entry) => entry.finish > 3).slice(0, 3).map((entry) => entry.driverId);

test("only blind picks count, and the rest are reported rather than silently dropped", () => {
  const stored = new Map<number, ChallengePick>([
    [races[0].id, { ids: [1, 2, 3], submittedAt: "2025-01-01T00:00:00Z", blind: true }],
    [races[1].id, { ids: [1, 2, 3], submittedAt: "2025-01-01T00:00:00Z" }], // made after the result was visible
    [races[2].id, { ids: [4, 5, 6], submittedAt: "", blind: true }],
  ]);
  const { plays, notCounted } = playsFrom((id) => stored.get(id) ?? null, races.slice(0, 5));
  assert.deepEqual(plays.map((play) => play.raceId), [races[0].id, races[2].id]);
  assert.equal(notCounted, 1);
  assert.deepEqual(playsFrom(() => null, races), { plays: [], notCounted: 0 });
});

test("a stored pick keeps its blind flag only when it is exactly true", () => {
  assert.deepEqual(parsePick('{"ids":[1,2,3],"submittedAt":"x","blind":true}'), { ids: [1, 2, 3], submittedAt: "x", blind: true });
  assert.equal(parsePick('{"ids":[1,2,3],"submittedAt":"x","blind":"yes"}')?.blind, undefined);
  assert.equal(parsePick('{"ids":[1,2,3],"submittedAt":"x","blind":1}')?.blind, undefined);
  assert.equal(parsePick('{"ids":[1,2,3],"submittedAt":"x"}')?.blind, undefined, "an older pick is not blind");
});

test("copying Paladin ties it on every race and shows up as copying, not skill", () => {
  const plays: Play[] = races.slice(0, 20).map((race) => ({ raceId: race.id, picks: race.predicted }));
  const league = summariseLeague(races, plays);
  assert.equal(league.played, 20);
  assert.equal(league.you, league.paladin);
  assert.deepEqual(league.vsPaladin, { ahead: 0, level: 20, behind: 0 });
  assert.equal(league.copying.paladin, 3, "all three names matched Paladin's");
  assert.equal(league.verdict, "level with Paladin");
});

test("totals are taken over the races played, so picking easy races cannot flatter a score", () => {
  const easy = races.filter((race) => race.hits === 3).slice(0, 5);
  const league = summariseLeague(races, easy.map((race) => ({ raceId: race.id, picks: race.actual })));
  assert.equal(league.paladin, 15, "Paladin is scored on exactly those races, 3 each");
  assert.equal(league.grid, easy.reduce((sum, race) => sum + race.baselineHits, 0));
  assert.equal(league.you, 15);
  const overall = races.reduce((sum, race) => sum + race.hits, 0) / races.length;
  assert.ok(league.paladin / league.played > overall, "the comparison uses the same easy races, not the season average");
});

test("a verdict needs enough races and an interval that excludes zero", () => {
  const best = races.slice(0, MIN_RACES).map((race) => ({ raceId: race.id, picks: race.actual }));
  const few = summariseLeague(races, best.slice(0, MIN_RACES - 1));
  assert.equal(few.interval, null);
  assert.equal(few.verdict, "too few races to say");
  assert.equal(few.you, 3 * (MIN_RACES - 1), "the numbers are still shown");

  const everything = summariseLeague(races, races.map((race) => ({ raceId: race.id, picks: race.actual })));
  assert.equal(everything.verdict, "ahead of Paladin");
  assert.equal(everything.you, 3 * 68);
  assert.ok(everything.interval!.lower > 0);

  const nothing = summariseLeague(races, races.map((race) => ({ raceId: race.id, picks: offPodium(race) })));
  assert.equal(nothing.you, 0);
  assert.equal(nothing.verdict, "behind Paladin");
  assert.ok(nothing.interval!.upper < 0);

  assert.equal(verdictFor(null), "too few races to say");
  assert.equal(verdictFor({ lower: -0.2, upper: 0.3 }), "level with Paladin");
});

test("unknown and repeated races are ignored and the lines read in date order", () => {
  const plays: Play[] = [
    { raceId: races[10].id, picks: races[10].predicted },
    { raceId: races[2].id, picks: races[2].predicted },
    { raceId: races[2].id, picks: races[2].actual },
    { raceId: 999999, picks: [1, 2, 3] },
  ];
  const league = summariseLeague(races, plays);
  assert.equal(league.played, 2);
  assert.deepEqual(league.lines.map((line) => line.race.id), [races[2].id, races[10].id]);
  assert.equal(league.lines[0].you, races[2].hits, "the first of two plays for a race is the one kept");
  assert.deepEqual(summariseLeague(races, []).vsPaladin, { ahead: 0, level: 0, behind: 0 });
  assert.equal(summariseLeague(races, []).copying.paladin, 0);
});

test("a duel compares two players only on the races they both called", () => {
  const mine: Play[] = [0, 1, 2, 3].map((i) => ({ raceId: races[i].id, picks: races[i].actual }));
  const theirs: Play[] = [2, 3, 4, 5].map((i) => ({ raceId: races[i].id, picks: offPodium(races[i]) }));
  const result = duel(races, mine, theirs);
  assert.deepEqual(result.races.map((race) => race.id), [races[2].id, races[3].id]);
  assert.equal(result.you, 6);
  assert.equal(result.them, 0);
  assert.equal(result.paladin, races[2].hits + races[3].hits);
  assert.deepEqual(result.record, { ahead: 2, level: 0, behind: 0 });
  assert.equal(duel(races, mine, []).races.length, 0);
});
