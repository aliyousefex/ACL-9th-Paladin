import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { after, test } from "node:test";
import { closeServer, loadModule, render } from "./helpers/ssr.ts";

after(closeServer);

const text = (html: string) => html.replace(/<[^>]+>/g, " ").replace(/&#x27;/g, "'").replace(/&quot;/g, '"').replace(/&amp;/g, "&").replace(/\s+/g, " ").trim();
const drivers = (JSON.parse(readFileSync(new URL("../src/data/drivers.json", import.meta.url), "utf8")) as { drivers: { ref: string; name: string; seasons: Record<string, unknown> }[] }).drivers;

type Page = { TeamsPage: never };
const teams = async (reference: string | undefined, query = "season=2024") => {
  const { TeamsPage } = await loadModule<Page>("/src/features/teams/TeamsPage.tsx");
  return render(TeamsPage as never, { reference, query: new URLSearchParams(query) } as never);
};
const driverPage = async (reference: string, query = "season=2024") => {
  const { DriversPage } = await loadModule<{ DriversPage: never }>("/src/features/drivers/DriversPage.tsx");
  return render(DriversPage as never, { reference, query: new URLSearchParams(query) } as never);
};

test("the teams list ranks the 2024 teams as the constructors' championship did, each with the people who ran it and the drivers who raced for it", async () => {
  const html = await teams(undefined);
  const plain = text(html);
  const order = ["McLaren", "Ferrari", "Red Bull", "Mercedes", "Aston Martin", "Alpine F1 Team", "Haas F1 Team", "RB F1 Team", "Williams", "Sauber"];
  const at = order.map((name) => plain.indexOf(name));
  assert.ok(at.every((i) => i >= 0), `every team is on the page: ${at}`);
  assert.deepEqual([...at].sort((a, b) => a - b), at, "in the order they finished");
  for (const person of ["Andrea Stella", "Frédéric Vasseur", "Christian Horner", "Toto Wolff", "Mike Krack", "Bruno Famin", "Oliver Oakes", "Ayao Komatsu", "Laurent Mekies", "James Vowles", "Alessandro Alunni Bravi"]) {
    assert.ok(plain.toLowerCase().includes(person.toLowerCase()), `${person} is listed`);
  }
  assert.match(plain, /Toto Wolff team principal and CEO/i);
  // a team representative is never called a team principal
  assert.match(plain, /Alessandro Alunni Bravi team representative/i);
  assert.doesNotMatch(plain, /Alessandro Alunni Bravi team principal/i);
  assert.match(html, /data-provenance="reference"/, "the list says it is a reference list");
  assert.match(html, /data-provenance="record"/);
  assert.doesNotMatch(plain, /undefined|NaN|\[object/);
  assert.match(plain, /666 points/);
  // each driver is a link to their page
  assert.match(html, /href="#\/drivers\/norris\?season=2024"|href="#\/drivers\/norris"/);
});

test("a team's page says where it finished, who drove, and who ran it, with each person's sources and nothing claimed beyond them", async () => {
  const html = await teams("alpine", "season=2023");
  const plain = text(html);
  assert.match(plain, /In 2023, Alpine F1 Team finished 6th in the constructors' championship with 120 points\./);
  for (const person of ["Otmar Szafnauer", "Bruno Famin", "Oliver Oakes"]) assert.ok(plain.includes(person), person);
  assert.equal((plain.match(/in charge in 2023/g) ?? []).length, 2, "two people shared 2023, and only they are marked as in charge");
  assert.match(plain, /Replaced Famin from the 2024 Dutch Grand Prix onwards\./);
  assert.match(html, /href="https:\/\/en\.wikipedia\.org\/wiki\/Alpine_F1_Team"/, "a source is linked");
  assert.match(plain, /This is not part of the race dataset/);
  assert.match(plain, /they are not always "team principal"/);
  assert.doesNotMatch(plain, /While in charge/, "a person who left mid-season is not credited with the whole season");
  assert.match(plain, /The team's results in (those seasons|that season):/);
  assert.match(html, /data-provenance="reference"/);
  assert.doesNotMatch(plain, /undefined|NaN|\[object/);
});

test("a team with no principal in a season says so with the title it was published under, and a person who led two teams links to the other", async () => {
  const sauber = text(await teams("sauber", "season=2024"));
  assert.match(sauber, /Alessandro Alunni Bravi team representative/i);
  assert.match(sauber, /under CEO Andreas Seidl/);
  const ferrari = text(await teams("ferrari", "season=2023"));
  assert.match(ferrari, /Frédéric Vasseur/i);
  assert.match(ferrari, /Also led Alfa Romeo \(2022, CEO and team principal\)/i);
  const alfa = text(await teams("alfa", "season=2022"));
  assert.match(alfa, /Also led Ferrari \(2023–2024, team principal\)/i);
});

test("an unknown team is said to be unknown, not a blank page", async () => {
  const plain = text(await teams("nobody"));
  assert.match(plain, /Nothing called “nobody”/);
});

test("a driver's page has the person, the season in words, the arc, the weekends, and the team with who ran it", async () => {
  const html = await driverPage("norris");
  const plain = text(html);
  for (const heading of ["About Norris", "Norris in 2024", "Championship, round by round", "Weekends to look at", "McLaren in 2024", "Who ran McLaren"]) assert.ok(plain.includes(heading), heading);
  assert.match(plain, /Norris is a British driver, born 13 November 1999, and was 24 at the start of the 2024 season\./);
  assert.match(plain, /In 2024, Norris drove for McLaren and finished 2nd in the drivers' championship with 374 points\./);
  assert.match(plain, /Norris won 4 races \(Miami, Dutch, Singapore and Abu Dhabi\)/);
  assert.match(html, /role="img" aria-label="Lando Norris: championship position after each round of 2024\./, "the arc has a text description");
  assert.match(plain, /Piastri was Norris's teammate that season\./);
  assert.match(plain, /Andrea Stella team principal/i);
  assert.match(html, /data-provenance="reference"/);
  // the same points wherever they are quoted
  assert.match(plain, /Points 374/, "the season panel quotes the championship's points");
  assert.match(plain, /344 from the race results/, "and says where the other figure comes from");
  // the seasons table links to the other seasons and does not link to the current one
  assert.match(html, /href="#\/drivers\/norris\?season=2023"/);
  assert.doesNotMatch(html, /href="#\/drivers\/norris\?season=2024"[^>]*>2024</);
  assert.doesNotMatch(plain, /undefined|NaN|\[object/);
});

test("every driver's page, in every season they raced, renders whole, with the new sections and no broken values", async () => {
  let pages = 0;
  for (const driver of drivers) {
    for (const season of Object.keys(driver.seasons)) {
      const html = await driverPage(driver.ref, `season=${season}`);
      const plain = text(html);
      const who = `${driver.ref} ${season}`;
      assert.match(plain, /About /, `${who}: the profile`);
      assert.ok(plain.includes(`in ${season}`), `${who}: the season story`);
      assert.doesNotMatch(plain, /undefined|NaN|\[object|Infinity/, `${who}: a broken value`);
      assert.match(html, /data-provenance="reference"/, `${who}: who ran the team`);
      pages++;
    }
  }
  assert.ok(pages >= 60, `${pages} pages rendered`);
});
