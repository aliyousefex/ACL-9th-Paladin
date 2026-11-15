import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { CARD_FOOTER, CARD_HEIGHT, CARD_WIDTH, leagueCardSpec, leagueShareText, raceCardSpec, raceShareText, type RaceCardInput } from "../src/lib/card.ts";
import type { RaceMeta } from "../src/lib/data.ts";
import { summariseLeague } from "../src/lib/league.ts";

const races = JSON.parse(readFileSync(new URL("../src/data/races.json", import.meta.url), "utf8")) as RaceMeta[];

const input = (mine: boolean[], paladin: boolean[], grid: boolean[]): RaceCardInput => ({
  raceName: "Abu Dhabi Grand Prix",
  year: 2024,
  slug: "abu-dhabi",
  picks: mine.map((onPodium, i) => ({ code: ["VER", "NOR", "SAI"][i], onPodium })),
  paladin: paladin.map((onPodium, i) => ({ code: ["VER", "NOR", "LEC"][i], onPodium })),
  grid: grid.map((onPodium, i) => ({ code: ["NOR", "PIA", "LEC"][i], onPodium })),
  actual: ["NOR", "LEC", "SAI"],
});

test("the race card says exactly what the three scores are, and who won the duel in words", () => {
  const ahead = raceCardSpec(input([false, true, true], [false, true, true], [true, false, true]));
  assert.deepEqual(ahead.columns.map((column) => column.value), ["2", "2", "2"]);
  assert.match(ahead.line, /tied/);
  assert.match(raceCardSpec(input([true, true, true], [false, true, false], [false, false, false])).line, /I beat Paladin/);
  assert.match(raceCardSpec(input([false, false, false], [true, true, true], [true, false, false])).line, /Paladin beat me/);
  assert.equal(ahead.title, "Abu Dhabi Grand Prix 2024");
  assert.equal(ahead.fileName, "paladin-2024-abu-dhabi-my-call.png");
  assert.match(ahead.line, /NOR · LEC · SAI/, "the podium is stated");
  for (const column of ahead.columns) assert.equal(column.items.length, 3);
  assert.equal(ahead.footer, CARD_FOOTER);
  assert.match(ahead.footer, /not affiliated with Formula 1/);
});

test("every marker on the card is also written in words for a reader who cannot see colour", () => {
  const spec = raceCardSpec(input([true, false, true], [true, true, false], [false, false, false]));
  assert.match(spec.alt, /I named 2 of the 3 podium finishers, Paladin 2, the starting grid 0/);
  assert.match(spec.alt, /NOR, LEC, SAI/);
  assert.deepEqual(spec.columns[0].items.map((item) => item.mark), ["hit", "miss", "hit"]);
});

test("the season card shows per-race averages over the races played, and refuses to call a verdict on too few", () => {
  const few = summariseLeague(races, races.slice(0, 3).map((race) => ({ raceId: race.id, picks: race.actual })));
  const spec = leagueCardSpec(few, "Sam", "all seasons");
  assert.equal(spec.title, "Sam's season");
  assert.equal(spec.subtitle, "3 races called before the result");
  assert.equal(spec.columns[0].value, "3.00");
  assert.match(spec.line, /Too few races yet/);
  assert.equal(spec.columns[0].heading, "Sam");
  assert.doesNotMatch(spec.line, /ahead of Paladin\.$/);

  const many = summariseLeague(races, races.map((race) => ({ raceId: race.id, picks: race.actual })));
  const full = leagueCardSpec(many, "", "all seasons");
  assert.equal(full.title, "My season");
  assert.match(full.line, /I am ahead of Paladin/);
  assert.equal(full.columns[1].value, (many.paladin / 68).toFixed(2));
  assert.equal(leagueCardSpec(summariseLeague(races, [races[0]].map((race) => ({ raceId: race.id, picks: race.actual }))), "", "x").subtitle, "1 race called before the result");
  assert.equal(leagueCardSpec(summariseLeague(races, []), "", "x").columns[0].value, "–", "no races, no average");
});

test("counts read as English: one race, two races", () => {
  const one = summariseLeague(races, [{ raceId: races[0].id, picks: races[0].predicted }]);
  assert.match(leagueCardSpec(one, "", "x").line, /Ahead of Paladin in 0 races, level in 1 race, behind in 0 races\./);
  const several = summariseLeague(races, races.slice(0, 3).map((race) => ({ raceId: race.id, picks: race.predicted })));
  assert.match(leagueCardSpec(several, "", "x").line, /level in 3 races/);
});

test("share text states the facts once and carries the link", () => {
  const text = raceShareText(input([false, true, true], [false, true, true], [true, false, true]), "https://example.test/#/race/2024/abu-dhabi");
  assert.match(text, /named 2 of 3 podium finishers/);
  assert.match(text, /Paladin named 2, the starting grid 2/);
  assert.ok(text.endsWith("https://example.test/#/race/2024/abu-dhabi"));
  const league = summariseLeague(races, races.slice(0, 12).map((race) => ({ raceId: race.id, picks: race.predicted })));
  const share = leagueShareText(league, "Sam", "https://example.test/#/league");
  assert.match(share, /^Sam: 12 Grands Prix called before the result\./);
  assert.match(share, /me \d\.\d\d, Paladin \d\.\d\d, the starting grid \d\.\d\d/);
});

test("the card is the standard link-preview size", () => {
  assert.equal(CARD_WIDTH, 1200);
  assert.equal(CARD_HEIGHT, 630);
});
