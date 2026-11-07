import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { autopsy } from "../src/features/race/autopsyModel.ts";
import { PRESENT_TARGETS, advance, buildScript, nextOpen, presentKey, type ScriptInput } from "../src/features/race/present.ts";
import { THRESHOLD } from "../src/lib/model.ts";

const read = (path: string) => JSON.parse(readFileSync(new URL(path, import.meta.url), "utf8"));
const races = read("../src/data/races.json") as { id: number; year: number; round: number; name: string; slug: string; scheduledLaps: number | null; baseline: number[] }[];
const driverData = read("../src/data/drivers.json") as { drivers: { id: number; name: string; last: string; code: string }[]; constructors: { id: number; name: string }[] };
const drivers = new Map(driverData.drivers.map((d) => [d.id, d]));
const teams = new Map(driverData.constructors.map((c) => [c.id, c]));

interface Entry { d: number; c: number; x: (number | null)[]; p: number; pos: number | null; txt: string; status: string; laps: number | null }

/** Rows in the shape the page builds. With `poison`, every outcome field is replaced by a sentinel that must never surface. */
function rowsFor(race: { id: number }, poison = false) {
  const file = read(`../public/data/races/${race.id}.json`) as { entries: Entry[] };
  const rows = file.entries
    .map((entry) => ({
      entry: poison ? { ...entry, pos: 777, txt: "SPOILER", status: "SPOILER", laps: 777 } : entry,
      driver: { id: entry.d, name: drivers.get(entry.d)!.name, last: drivers.get(entry.d)!.last, code: drivers.get(entry.d)!.code },
      team: { name: teams.get(entry.c)?.name ?? "Team" },
      score: entry.p,
      grid: entry.x[0] ?? null,
      rank: 0,
      finish: poison ? 777 : entry.pos,
      podium: poison ? true : entry.pos !== null && entry.pos <= 3,
    }))
    .sort((a, b) => b.score - a.score || a.driver.id - b.driver.id);
  rows.forEach((row, i) => (row.rank = i + 1));
  return rows;
}

function input(race: (typeof races)[number], opts: Partial<ScriptInput> & { poison?: boolean } = {}): ScriptInput {
  const { poison, ...rest } = opts;
  const rows = rowsFor(race, poison);
  return { raceName: race.name, year: race.year, round: race.round, circuitName: "Test Circuit", lengthM: 5412, turns: 15, scheduledLaps: race.scheduledLaps, rows: rows as never, revealed: false, post: null, ...rest };
}
const monaco = races.find((r) => r.year === 2023 && r.slug === "monaco")!;
const post = (race: (typeof races)[number], story = ["The lead changed hands 2 times at the end of a lap.", "Gap line.", "Slow laps line.", "Fourth line not shown."]) => ({
  autopsy: autopsy(input(race).rows, race.baseline, THRESHOLD),
  story,
});

test("the script has one step per page section, in page order", () => {
  const steps = buildScript(input(monaco));
  assert.equal(steps.length, 11);
  assert.deepEqual(steps.map((s) => s.target), [...PRESENT_TARGETS]);
  assert.deepEqual(steps.map((s) => s.id), [...PRESENT_TARGETS]);
  assert.equal(new Set(steps.map((s) => s.id)).size, 11);
  for (const s of steps) {
    assert.ok(s.title.length > 0 && s.say.length > 0, s.id);
    for (const line of s.say) assert.ok(line.length > 0 && !/undefined|NaN|null/.test(line), `${s.id}: ${line}`);
  }
});

test("before the reveal the four post-race steps are locked and say nothing about the race", () => {
  const steps = buildScript(input(monaco));
  const locked = steps.filter((s) => s.locked);
  assert.deepEqual(locked.map((s) => s.id), ["autopsy", "trace", "replay", "lab"]);
  for (const s of locked) {
    assert.equal(s.title, "After the flag");
    assert.deepEqual(s.say, ["Locked until the result is revealed."]);
  }
  const reveal = steps.filter((s) => s.reveal);
  assert.equal(reveal.length, 1);
  assert.equal(reveal[0].id, "result");
  assert.equal(reveal[0].title, "Lights out");
  assert.ok(reveal[0].say.some((l) => /reveal the real result/.test(l)));
  assert.equal(steps.filter((s) => !s.locked).length, 7);
});

test("the pre-reveal script cannot depend on the result: changing only outcomes changes nothing, for all 68 races", () => {
  for (const race of races) {
    const clean = buildScript(input(race));
    const dirty = buildScript(input(race, { poison: true }));
    assert.deepEqual(dirty, clean, `${race.year} ${race.slug}: the script changed when only outcomes changed`);
    for (const step of dirty) for (const line of [step.title, ...step.say]) assert.ok(!/SPOILER|777/.test(line), `${race.slug} ${step.id}: ${line}`);
  }
});

test("a revealed flag without post-race material is still treated as sealed", () => {
  const steps = buildScript(input(monaco, { revealed: true, post: null }));
  assert.equal(steps.filter((s) => s.locked).length, 4);
  assert.equal(steps.find((s) => s.id === "result")!.reveal, true);
});

test("post-race material handed over before the reveal is ignored, so a caller mistake cannot spoil the result", () => {
  const sealed = buildScript(input(monaco, { revealed: false, post: post(monaco) }));
  assert.deepEqual(sealed, buildScript(input(monaco)));
  assert.equal(sealed.filter((s) => s.locked).length, 4);
  assert.ok(!sealed.some((s) => s.say.some((l) => /Paladin's top three put \d of 3/.test(l))));
});

test("after the reveal every step is open and the result and autopsy come from the post-race statements", () => {
  const material = post(monaco);
  const steps = buildScript(input(monaco, { revealed: true, post: material }));
  assert.equal(steps.filter((s) => s.locked).length, 0);
  assert.equal(steps.filter((s) => s.reveal).length, 0);
  const byId = new Map(steps.map((s) => [s.id, s]));
  assert.deepEqual(byId.get("result")!.say, [material.autopsy.statements.verdict]);
  assert.equal(byId.get("result")!.title, "The result");
  assert.ok(byId.get("autopsy")!.say.includes(material.autopsy.statements.podium));
  assert.ok(byId.get("autopsy")!.say.includes(material.autopsy.statements.cutoff));
  assert.deepEqual(byId.get("trace")!.say, material.story.slice(0, 3));
  assert.match(byId.get("replay")!.say.join(" "), /interpolated/);
  assert.match(byId.get("lab")!.say.join(" "), /not a historical result and not a forecast/);
});

test("the script states the real numbers for the race", () => {
  const steps = buildScript(input(monaco));
  const text = (id: string) => steps.find((s) => s.id === id)!.say.join(" ");
  assert.match(text("circuit"), /Monaco Grand Prix 2023, round 6\./);
  assert.match(text("circuit"), /5\.412 km a lap, 15 corners, 78 scheduled laps/);
  assert.match(text("grid"), /^Pole position: .+ for .+\./);
  assert.match(text("prediction"), /^Top three by podium score: .+ \(\d\.\d\d\), .+ \(\d\.\d\d\), .+ \(\d\.\d\d\)\./);
  assert.match(text("prediction"), /at or above the 0\.625 cutoff/);
  assert.match(text("prediction"), /not a calibrated probability/);
  assert.match(text("rebels"), /top three (is the same|shares)/);
  assert.match(text("reshuffle"), /not retraining/);
  assert.match(text("reshuffle"), /counting/);
  assert.match(text("challenge"), /not a blind test/);
});

test("missing circuit facts are left out rather than guessed", () => {
  const steps = buildScript(input(monaco, { lengthM: null, turns: null, scheduledLaps: null }));
  assert.deepEqual(steps[0].say, ["Monaco Grand Prix 2023, round 6.", "Test Circuit"]);
});

test("moving through the script skips locked steps and never walks off either end", () => {
  const sealed = buildScript(input(monaco));
  assert.equal(nextOpen(sealed, 0, 1), 1);
  assert.equal(nextOpen(sealed, 5, 1), 6);
  assert.equal(nextOpen(sealed, 6, 1), 6, "everything after the reveal step is locked");
  assert.equal(nextOpen(sealed, 0, -1), 0);
  assert.equal(nextOpen(sealed, 3, -1), 2);
  const open = buildScript(input(monaco, { revealed: true, post: post(monaco) }));
  assert.equal(nextOpen(open, 6, 1), 7);
  assert.equal(nextOpen(open, 10, 1), 10);
  assert.equal(nextOpen(open, 10, -1), 9);
});

test("next on the reveal step reveals and stays; anywhere else it just moves on", () => {
  const sealed = buildScript(input(monaco));
  assert.deepEqual(advance(sealed, 2), { index: 3, reveal: false });
  assert.deepEqual(advance(sealed, 6), { index: 6, reveal: true });
  const open = buildScript(input(monaco, { revealed: true, post: post(monaco) }));
  assert.deepEqual(advance(open, 6), { index: 7, reveal: false });
});

test("keyboard contract: arrows, Page keys, Home, Escape and F act; form controls and modifiers are left alone", () => {
  const free = { inField: false, native: false, modifier: false };
  assert.equal(presentKey("ArrowRight", free), "next");
  assert.equal(presentKey("PageDown", free), "next");
  assert.equal(presentKey(" ", free), "next");
  assert.equal(presentKey("Enter", free), "next");
  assert.equal(presentKey("ArrowLeft", free), "prev");
  assert.equal(presentKey("PageUp", free), "prev");
  assert.equal(presentKey("Home", free), "first");
  assert.equal(presentKey("Escape", free), "close");
  assert.equal(presentKey("f", free), "fullscreen");
  assert.equal(presentKey("F", free), "fullscreen");
  for (const key of ["a", "Tab", "ArrowUp", "ArrowDown", "End", "x", "1"]) assert.equal(presentKey(key, free), null, key);
});

test("Space and Enter keep their normal job on a focused button, link or disclosure", () => {
  const onButton = { inField: false, native: true, modifier: false };
  assert.equal(presentKey(" ", onButton), null);
  assert.equal(presentKey("Enter", onButton), null);
  assert.equal(presentKey("f", onButton), null, "typing F on a control is not a shortcut");
  // Arrows and Escape still work from a focused button, so a keyboard user is never stuck on the bar.
  assert.equal(presentKey("ArrowRight", onButton), "next");
  assert.equal(presentKey("ArrowLeft", onButton), "prev");
  assert.equal(presentKey("Escape", onButton), "close");
});

test("the presenter never takes keys from form controls, radio groups or sliders, or any key with a modifier", () => {
  const inField = { inField: true, native: false, modifier: false };
  for (const key of ["ArrowRight", "ArrowLeft", " ", "Enter", "Home", "Escape", "f", "PageDown"]) assert.equal(presentKey(key, inField), null, key);
  const modified = { inField: false, native: false, modifier: true };
  for (const key of ["ArrowRight", "ArrowLeft", " ", "f", "Escape", "Home"]) assert.equal(presentKey(key, modified), null, key);
});
