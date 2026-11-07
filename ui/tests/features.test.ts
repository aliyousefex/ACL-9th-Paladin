import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { after, test } from "node:test";
import { closeServer, loadModule, render } from "./helpers/ssr.ts";

after(closeServer);

interface RaceMeta { id: number; year: number; slug: string; baseline: number[]; hits: number; actual: number[]; predicted: number[] }
type Rows = unknown[];

const read = (path: string) => JSON.parse(readFileSync(new URL(path, import.meta.url), "utf8"));
const detailOf = (race: { id: number }) => read(`../public/data/races/${race.id}.json`);
const count = (html: string, pattern: RegExp) => (html.match(pattern) ?? []).length;
const text = (html: string) => html.replace(/<[^>]+>/g, " ").replace(/&#x27;|&#39;/g, "'").replace(/&quot;/g, '"').replace(/\s+/g, " ");

async function setup() {
  const data = await loadModule<{ RACES: RaceMeta[] }>("/src/lib/data.ts");
  const { buildRows } = await loadModule<{ buildRows: (detail: unknown, year: number) => Rows }>("/src/features/race/rows.ts");
  const rowsOf = (race: RaceMeta) => buildRows(detailOf(race), race.year);
  const find = (year: number, slug: string) => data.RACES.find((r) => r.year === year && r.slug === slug)!;
  return { ...data, rowsOf, find };
}

/* ------------------------------------------------------------------ race trace */

test("the race trace renders both views' controls, three highlighted podium drivers and an accessible lap slider", async () => {
  const { find, rowsOf } = await setup();
  const { RaceTrace } = await loadModule<{ RaceTrace: never }>("/src/features/race/RaceTrace.tsx");
  const race = find(2022, "monaco");
  const html = render(RaceTrace, { race, rows: rowsOf(race), detail: detailOf(race) } as never);
  const plain = text(html);

  assert.match(html, /role="radiogroup"[^>]*aria-label="Trace view"/);
  assert.equal(count(html, /role="radio"/g), 2);
  assert.match(plain, /Gap to leader/);
  assert.match(plain, /Positions/);

  // Four presets and one toggle chip per driver; the podium is highlighted to start with.
  for (const label of ["Podium", "Model's picks", "Everyone", "Clear"]) assert.match(plain, new RegExp(label));
  const chips = [...html.matchAll(/<button[^>]*class="chip[^"]*"[^>]*aria-pressed="(true|false)"/g)].map((m) => m[1]);
  assert.equal(chips.length, 20);
  assert.equal(chips.filter((c) => c === "true").length, 3);

  // The slider reads out the lap in words and spans the whole race.
  assert.match(html, /<input[^>]*id="trace-lap"[^>]*type="range"[^>]*min="1"[^>]*max="64"/);
  assert.match(html, /aria-valuetext="Lap 64 of 64"/);
  assert.match(html, /<label[^>]*for="trace-lap"/);

  // The chart has a text alternative and the readout is a real list; the full field is available as a table.
  assert.match(html, /<svg[^>]*role="img"[^>]*aria-label="Gap to the leader by lap for 3 highlighted drivers/);
  assert.match(plain, /At the end of lap 64 \(the flag\)/);
  assert.match(html, /<table[^>]*>.*<caption class="sr-only">Running order at the end of lap 64<\/caption>/s);
  assert.match(plain, /Full order at lap 64/);
});

test("the race trace states what it records, what it derives, and that no cause is shown for slow laps", async () => {
  const { find, rowsOf } = await setup();
  const { RaceTrace } = await loadModule<{ RaceTrace: never }>("/src/features/race/RaceTrace.tsx");
  const race = find(2022, "monaco");
  const plain = text(render(RaceTrace, { race, rows: rowsOf(race), detail: detailOf(race) } as never));
  assert.match(plain, /Record: lap times, end-of-lap positions and pit stops\. Derived: a gap is the sum of a car's lap times/);
  assert.match(plain, /The data does not say why, so no cause is shown\./);
  assert.match(plain, /field-wide slow laps: laps 2–7, laps 26–32/);
  assert.match(plain, /The data does not record the cause\./);
  assert.match(plain, /before any post-race time penalty/);
  assert.ok(!/safety car|red flag/i.test(plain.replace(/Model's picks/g, "")), "no cause is named for the shaded laps");
});

test("the race trace explains drivers with no recorded laps and copes with a race that has none at all", async () => {
  const { RACES, rowsOf } = await setup();
  const { RaceTrace } = await loadModule<{ RaceTrace: never }>("/src/features/race/RaceTrace.tsx");
  const missing = RACES.find((r) => {
    const d = detailOf(r);
    return d.entries.some((e: { d: number }) => !d.laps.d[String(e.d)]);
  })!;
  assert.ok(missing, "the dataset has a race with an entry that has no laps");
  const noted = text(render(RaceTrace, { race: missing, rows: rowsOf(missing), detail: detailOf(missing) } as never));
  assert.match(noted, /No lap times are recorded for .+, so (that driver is|those drivers are) not drawn\./);

  const race = RACES[0];
  const bare = { ...detailOf(race), laps: { n: 0, d: {} }, pits: {} };
  const empty = text(render(RaceTrace, { race, rows: rowsOf(race), detail: bare } as never));
  assert.match(empty, /The dataset has no lap times for this race, so no trace can be drawn\./);
});

/* ------------------------------------------------------------------ autopsy */

test("the autopsy keeps 'before the start' and 'after the flag' apart on every card and tells the truth about a classified retirement", async () => {
  const { find, rowsOf } = await setup();
  const { Autopsy } = await loadModule<{ Autopsy: never }>("/src/features/race/Autopsy.tsx");
  const race = find(2022, "bahrain");
  const html = render(Autopsy, { race, rows: rowsOf(race) } as never);
  const plain = text(html);

  // Three headed sections plus the cutoff view, each reachable by heading.
  assert.equal(count(html, /<h3[ >]/g), 4);
  assert.equal(count(html, /<article/g), 5, "three picks and two misses");
  // One label per card, plus the panel's explanatory note, which names both labels; "After the flag" is also the eyebrow.
  assert.equal(count(plain, /Before the start/g), 5 + 1);
  assert.equal(count(plain, /After the flag/g), 5 + 1 + 1);

  assert.match(plain, /Paladin's top three put 1 of 3 on the podium\. The baseline, the first three grid slots, put 2 of 3\. The grid did better than Paladin here\./);
  assert.match(plain, /Retired after 54 laps: Fuel pressure\. Classified P19 for the distance completed/);
  assert.match(plain, /None of the model's 16 inputs measures reliability/);
  assert.match(plain, /Two of Paladin's top three did not take the flag/);
  for (const label of ["Hit", "False alarm", "Missed"]) assert.match(plain, new RegExp(label));
  assert.match(plain, /Held back by/);
  assert.match(plain, /Lifted by/);
  // Evidence is signed numbers, not prose.
  assert.match(plain, /Grid position \+1\.79/);
  assert.match(plain, /associations in a fitted model, not causes/);
});

test("when every podium finisher was in the top three the autopsy says so instead of showing an empty list", async () => {
  const { RACES, rowsOf } = await setup();
  const { Autopsy } = await loadModule<{ Autopsy: never }>("/src/features/race/Autopsy.tsx");
  const perfect = RACES.find((r) => r.hits === 3)!;
  assert.ok(perfect);
  const plain = text(render(Autopsy, { race: perfect, rows: rowsOf(perfect) } as never));
  assert.match(plain, /None\. Every podium finisher was in Paladin's top three\./);
  assert.match(plain, /put 3 of 3 on the podium/);
  assert.equal(count(plain, /Missed/g), 0);
});

/* ------------------------------------------------------------------ reshuffle */

test("the reshuffle dial renders five real switches, presets, a live summary and a rank statement on every row", async () => {
  const { find, rowsOf } = await setup();
  const { ReshufflePanel } = await loadModule<{ ReshufflePanel: never }>("/src/features/race/ReshufflePanel.tsx");
  const race = find(2023, "monaco");
  const rows = rowsOf(race);
  const html = render(ReshufflePanel, { rows } as never);
  const plain = text(html);

  assert.equal(count(html, /role="switch"/g), 5);
  assert.deepEqual([...html.matchAll(/role="switch"[^>]*aria-checked="(true|false)"/g)].map((m) => m[1]), ["true", "true", "true", "true", "true"]);
  for (const group of ["Grid", "Qualifying", "Form", "Standings", "Context"]) assert.match(plain, new RegExp(group));
  assert.equal(count(plain, /Counts/g), 5);
  assert.match(html, /<button[^>]*aria-pressed="true"[^>]*>All inputs<\/button>/);
  assert.equal(count(html, /aria-pressed="true"/g), 1, "only the active preset is pressed");

  // The summary is a polite live region so a screen reader hears each change.
  assert.match(html, /aria-live="polite" aria-atomic="true"/);
  assert.match(plain, /All five input groups count, so this is Paladin's full ranking\./);

  // Rows: the DOM order is the full model's order, and each row says its rank here in words.
  assert.equal(count(plain, /Rank \d+ under this setting, was \d+/g), 20);
  assert.equal(count(html, /no change/g), 20, "nothing moves with all inputs on");
  assert.match(plain, /Full order under this setting/);
  assert.match(plain, /not retraining/);
  assert.match(plain, /Nothing on this panel is compared with the result of the race\./);
  assert.ok(!/Actual podium|finished/i.test(plain), "no outcome anywhere on the panel");
});

test("the reshuffle panel never contains outcome data, even when the rows carry it", async () => {
  const { find, rowsOf } = await setup();
  const { ReshufflePanel } = await loadModule<{ ReshufflePanel: never }>("/src/features/race/ReshufflePanel.tsx");
  const race = find(2023, "monaco");
  const clean = render(ReshufflePanel, { rows: rowsOf(race) } as never);
  const poisoned = (rowsOf(race) as { entry: object; finish: unknown; podium: boolean }[]).map((r) => ({ ...r, finish: 777, podium: true, entry: { ...r.entry, pos: 777, txt: "SPOILER", status: "SPOILER" } }));
  const dirty = render(ReshufflePanel, { rows: poisoned } as never);
  assert.equal(dirty, clean, "the markup is identical when only outcomes change");
  assert.ok(!/SPOILER/.test(dirty));
});
