import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { test } from "node:test";
import { TEAM_CODES, logoFor, teamCode, type TeamLogoFile } from "../src/lib/teamMark.ts";
import { gaps, isPlainPrincipal, leadersOf, seasonSpan, tenuresOf, titleInSentence, type PrincipalFile } from "../src/lib/teamLogic.ts";

const read = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8");
const file = JSON.parse(read("../src/data/team-principals.json")) as PrincipalFile;
const teams = (JSON.parse(read("../src/data/drivers.json")) as { constructors: { id: number; ref: string; name: string; years: number[] }[] }).constructors;

test("every team that raced in a season has someone listed as leading it, and nobody is listed for a season it did not race", () => {
  assert.deepEqual(gaps(file, teams), [], "a team-season with nobody listed");
  for (const tenure of file.tenures) {
    const team = teams.find((t) => t.ref === tenure.constructor);
    assert.ok(team, `${tenure.constructor} is a team in the data`);
    for (let year = tenure.firstSeason; year <= tenure.lastSeason; year++) assert.ok(team!.years.includes(year), `${tenure.person} is listed at ${tenure.constructor} in ${year}, when it did not race`);
  }
});

test("the list is well formed: real people, real seasons, a title and a link to a source on every entry", () => {
  assert.equal(file.contract, "paladin.team-principals.v1");
  assert.match(file.checked, /^\d{4}-\d{2}-\d{2}$/);
  assert.match(file.about, /NOT part of the race dataset/);
  const refs = new Set(file.people.map((p) => p.ref));
  assert.equal(refs.size, file.people.length, "no person twice");
  for (const person of file.people) {
    assert.ok(person.name.trim() && person.nationality.trim(), person.ref);
    if (person.flag) assert.ok(existsSync(new URL(`../public/flags/${person.flag}.svg`, import.meta.url)), `${person.ref}: a flag file for ${person.flag}`);
  }
  const used = new Set<string>();
  for (const tenure of file.tenures) {
    assert.ok(refs.has(tenure.person), `${tenure.person} is in the list of people`);
    used.add(tenure.person);
    assert.ok(tenure.title.trim(), "a title");
    assert.ok(tenure.firstSeason >= 2022 && tenure.lastSeason <= 2024 && tenure.firstSeason <= tenure.lastSeason, `${tenure.person}: seasons ${tenure.firstSeason}-${tenure.lastSeason}`);
    assert.ok(tenure.sources.length >= 1, `${tenure.person} at ${tenure.constructor}: a source`);
    for (const source of tenure.sources) assert.match(source, /^https:\/\/[^\s]+$/, `${tenure.person}: ${source}`);
    if (tenure.note) assert.ok(tenure.note.endsWith("."), `${tenure.person}: a note is a sentence`);
  }
  assert.deepEqual([...refs].filter((ref) => !used.has(ref)), [], "nobody is listed who led no team");
});

test("nobody leads two teams in one season, and a season has two leaders at a team only where there was a change", () => {
  const seen = new Map<string, string>();
  for (const tenure of file.tenures) {
    for (let year = tenure.firstSeason; year <= tenure.lastSeason; year++) {
      const key = `${tenure.person} ${year}`;
      assert.ok(!seen.has(key), `${tenure.person} is listed at ${seen.get(key)} and ${tenure.constructor} in ${year}`);
      seen.set(key, tenure.constructor);
    }
  }
  // the changes that happened part-way through a season, each with the date it is told in the note
  const doubled: string[] = [];
  for (const team of teams) {
    for (const year of team.years) if (leadersOf(file, team.ref, year).length > 1) doubled.push(`${team.ref} ${year}`);
  }
  assert.deepEqual(doubled.sort(), ["alpine 2023", "alpine 2024"], "Alpine changed principal in 2023 and again in 2024");
  for (const key of doubled) {
    const [ref, year] = key.split(" ");
    for (const { tenure } of leadersOf(file, ref, Number(year))) assert.ok(tenure.note, `${tenure.person} shares ${key}: the note says when`);
  }
});

test("a title is kept as published, so a team representative is never called a team principal", () => {
  const titles = new Set(file.tenures.map((t) => t.title));
  assert.deepEqual([...titles].sort(), ["CEO and Team Principal", "Team Principal", "Team Principal and CEO", "Team Representative"]);
  // Sauber had no team principal in 2023 and 2024: its leader was the team representative
  for (const [ref, year] of [["alfa", 2023], ["sauber", 2024]] as const) {
    const leaders = leadersOf(file, ref, year);
    assert.equal(leaders.length, 1, `${ref} ${year}`);
    assert.equal(leaders[0].person.name, "Alessandro Alunni Bravi");
    assert.equal(leaders[0].tenure.title, "Team Representative");
    assert.match(leaders[0].tenure.note ?? "", /Seidl/, "and the note says who was CEO");
  }
  assert.equal(isPlainPrincipal("Team Principal"), true);
  assert.equal(isPlainPrincipal("Team Representative"), false);
  assert.equal(isPlainPrincipal("CEO and Team Principal"), false);
  assert.equal(titleInSentence("Team Representative"), "team representative");
  assert.equal(titleInSentence("Team Principal and CEO"), "team principal and CEO");
  assert.equal(titleInSentence("CEO and Team Principal"), "CEO and team principal");
});

test("the people who led a team in a season come in the order they took over, with their tenures and spans", () => {
  const alpine = leadersOf(file, "alpine", 2024).map((l) => l.person.name);
  assert.deepEqual(alpine, ["Bruno Famin", "Oliver Oakes"]);
  assert.deepEqual(leadersOf(file, "alpine", 2023).map((l) => l.person.name), ["Otmar Szafnauer", "Bruno Famin"]);
  assert.deepEqual(leadersOf(file, "mercedes", 2022).map((l) => l.person.name), ["Toto Wolff"]);
  assert.deepEqual(leadersOf(file, "mercedes", 2025), [], "no season outside the data");
  assert.deepEqual(leadersOf(file, "nobody", 2024), []);
  // one person across two teams: Vasseur ran Alfa Romeo, then Ferrari
  assert.deepEqual(tenuresOf(file, "frederic_vasseur").map((t) => `${t.constructor} ${seasonSpan(t)}`), ["alfa 2022", "ferrari 2023–2024"]);
  assert.equal(seasonSpan({ firstSeason: 2022, lastSeason: 2024 }), "2022–2024");
  assert.equal(seasonSpan({ firstSeason: 2023, lastSeason: 2023 }), "2023");
});

test("the Luxembourg flag exists, because a principal's nationality is shown with its flag", () => {
  assert.ok(existsSync(new URL("../public/flags/LU.svg", import.meta.url)));
});

test("every team has its own three-letter code for the tile on its card, and a listed logo is a real file with its credit", () => {
  const codes = teams.map((t) => teamCode(t.ref));
  assert.equal(new Set(codes).size, teams.length, `codes are unique: ${codes.join(" ")}`);
  for (const team of teams) {
    assert.ok(TEAM_CODES[team.ref], `${team.ref} has a hand-written code, not a guessed one`);
    assert.match(teamCode(team.ref), /^[A-Z]{2,3}$/);
  }
  assert.equal(teamCode("some_new_team"), "SOM", "an unlisted team still gets a code");

  const logos = JSON.parse(read("../src/data/team-logos.json")) as TeamLogoFile;
  assert.equal(logos.contract, "paladin.team-logos.v1");
  assert.match(logos.about, /registered trademarks/);
  for (const logo of logos.logos) {
    assert.ok(teams.some((t) => t.ref === logo.constructor), `${logo.constructor} is a team in the data`);
    assert.ok(existsSync(new URL(`../public/teams/${logo.file}`, import.meta.url)), `${logo.file} exists in public/teams`);
    assert.ok(logo.source.startsWith("https://"), `${logo.file}: a link to where it came from`);
    assert.ok(logo.author.trim() && logo.licence.trim(), `${logo.file}: who made it and on what terms`);
    assert.ok(logo.width > 0 && logo.height > 0);
    assert.equal(logos.logos.filter((l) => l.constructor === logo.constructor).length, 1, `${logo.constructor}: one logo`);
    assert.equal(logoFor(logos, logo.constructor), logo);
  }
});
