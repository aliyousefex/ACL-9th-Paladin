import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { after, test } from "node:test";
import { normalise, prepare, search, type SearchItem } from "../src/lib/search.ts";
import { closeServer, loadModule, render } from "./helpers/ssr.ts";

after(closeServer);

const item = (id: string, kind: SearchItem["kind"], title: string, subtitle = "", keywords = ""): SearchItem => ({ id, kind, title, subtitle, keywords, to: `/${id}` });

test("matching ignores case, accents and punctuation", () => {
  assert.equal(normalise("São Paulo Grand Prix"), "sao paulo grand prix");
  assert.equal(normalise("  Pérez, Sergio "), "perez sergio");
  assert.equal(normalise("Hülkenberg"), "hulkenberg");
  assert.equal(normalise("Kevin Magnussen"), "kevin magnussen");
  assert.equal(normalise(""), "");
});

test("every typed word must match, a title that starts with the query wins, and ties are stable", () => {
  const index = prepare([
    item("a", "race", "Monaco Grand Prix 2024", "Round 8 · Circuit de Monaco"),
    item("b", "circuit", "Circuit de Monaco", "Monte-Carlo, Monaco"),
    item("c", "driver", "Charles Leclerc", "Monégasque · LEC", "lec leclerc monaco"),
    item("d", "page", "Monaco notes", ""),
    item("e", "race", "Italian Grand Prix 2024", "Round 16 · Monza"),
  ]);
  const monaco = search(index, "monaco").map((r) => r.id);
  assert.deepEqual(monaco.slice(0, 2).sort(), ["a", "d"], "titles that start with the query come first");
  assert.ok(monaco.includes("b") && monaco.includes("c"));
  assert.ok(!monaco.includes("e"));
  assert.deepEqual(search(index, "monaco 2024").map((r) => r.id), ["a"], "every word has to match");
  assert.deepEqual(search(index, "MONACO"), search(index, "monaco"));
  assert.deepEqual(search(index, "grand prix 2024").map((r) => r.id).sort(), ["a", "e"]);
  assert.deepEqual(search(index, "zzzz"), []);
  assert.equal(search(index, "circuit de monaco")[0].id, "b", "an exact title beats a longer one");
  assert.deepEqual(search(index, "monaco", 2).length, 2, "the limit is respected");
});

test("an empty query returns the suggestions, not the whole index", () => {
  const index = prepare([item("a", "page", "A"), item("b", "page", "B")]);
  const suggested = [item("s", "page", "Suggested")];
  assert.deepEqual(search(index, "   ", 5, suggested), suggested);
  assert.deepEqual(search(index, "", 5), []);
});

test("the real index covers every race, driver, team and circuit once, and every result opens a real route", async () => {
  const { buildIndex, suggestions } = await loadModule<{ buildIndex: () => SearchItem[]; suggestions: () => SearchItem[] }>("/src/lib/searchIndex.ts");
  const items = buildIndex();
  assert.equal(new Set(items.map((entry) => entry.id)).size, items.length, "ids are unique");
  assert.equal(items.filter((entry) => entry.kind === "race").length, 68);
  // Counts come from the shipped data, not from a number written here.
  const drivers = JSON.parse(readFileSync(new URL("../src/data/drivers.json", import.meta.url), "utf8")).drivers.length;
  const raceCircuits = new Set(JSON.parse(readFileSync(new URL("../src/data/races.json", import.meta.url), "utf8")).map((race: { circuitId: number }) => race.circuitId)).size;
  assert.equal(items.filter((entry) => entry.kind === "driver").length, drivers);
  assert.equal(items.filter((entry) => entry.kind === "circuit").length, raceCircuits);
  const constructors = JSON.parse(readFileSync(new URL("../src/data/drivers.json", import.meta.url), "utf8")).constructors as { ref: string }[];
  const principals = JSON.parse(readFileSync(new URL("../src/data/team-principals.json", import.meta.url), "utf8")) as { people: { ref: string }[] };
  assert.equal(items.filter((entry) => entry.kind === "team").length, constructors.length, "one item for each team");
  assert.equal(items.filter((entry) => entry.kind === "leader").length, principals.people.length, "one item for each person who led one");
  for (const entry of items.filter((e) => e.kind === "team" || e.kind === "leader")) {
    assert.ok(constructors.some((c) => entry.to === `/teams/${c.ref}`), `${entry.id} opens a team page that exists: ${entry.to}`);
  }
  for (const entry of items) {
    assert.match(entry.to, /^\/($|race\/\d{4}\/[a-z0-9-]+$|drivers(\/[a-z0-9_-]+)?$|teams(\/[a-z0-9_]+)?$|circuits(\/[a-z0-9_-]+)?$|analysis$|history(\?tab=kg)?$|league$|race-lab$|model$|method$|guide$)/, `${entry.id} -> ${entry.to}`);
  }
  assert.equal(suggestions().length, 7);
  const index = prepare(items);
  const sao = search(index, "sao paulo").filter((entry) => entry.kind === "race");
  assert.ok(sao.length >= 1 && /S[ãa]o Paulo/.test(sao[0].title), "accents are optional");
  assert.deepEqual(sao.map((entry) => entry.title), [...sao.map((entry) => entry.title)].sort().reverse(), "the newest edition of a Grand Prix comes first");
  assert.ok(search(index, "monaco").some((entry) => entry.kind === "race"));
  assert.ok(search(index, "monaco").some((entry) => entry.kind === "circuit"));
  assert.equal(search(index, "verstappen")[0].kind, "driver");
  assert.ok(search(index, "ver").some((entry) => entry.title.includes("Verstappen")), "a driver's code finds them");
  assert.equal(search(index, "error atlas")[0].to, "/analysis");
  // a team is found by the people who ran it, and each person by name goes to their team
  const toto = search(index, "toto");
  assert.equal(toto[0].title, "Toto Wolff");
  assert.equal(toto[0].kind, "leader");
  assert.equal(toto[0].to, "/teams/mercedes");
  assert.ok(search(index, "wolff").some((entry) => entry.to === "/teams/mercedes"));
  assert.equal(search(index, "mercedes")[0].kind, "team", "the team comes before the people who ran it");
  assert.ok(search(index, "mercedes").some((entry) => entry.kind === "leader" && entry.title === "Toto Wolff"));
  assert.equal(search(index, "horner")[0].to, "/teams/red_bull");
  assert.equal(search(index, "vasseur")[0].to, "/teams/ferrari", "a person who led two teams goes to the one they led most recently");
  assert.equal(search(index, "team archive")[0].to, "/teams");
  assert.equal(search(index, "teammate")[0].to, "/history");
  assert.equal(search(index, "2023 monaco").length >= 1, true);
});

test("the header has a labelled search button with its keyboard shortcut, and the dialog starts closed", async () => {
  const { Shell } = await loadModule<{ Shell: never }>("/src/components/Shell.tsx");
  const html = render(Shell, { section: "", children: "x" });
  assert.match(html, /<button[^>]*aria-label="Search races, drivers and pages"[^>]*aria-keyshortcuts="Control\+K Meta\+K \/"/);
  assert.ok(!/role="dialog"[^>]*aria-label="Search/.test(html), "closed until opened");
});
