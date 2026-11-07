import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { after, test } from "node:test";
import { fieldOf, sprintVerdict } from "../src/features/games/podiumScoring.ts";
import { durationHint, gapPlain, gapText, lapText, raceTime, towerWindow } from "../src/features/games/grandPrixView.ts";
import { closeServer, loadModule, render } from "./helpers/ssr.ts";

after(closeServer);

const count = (html: string, pattern: RegExp) => (html.match(pattern) ?? []).length;
const text = (html: string) => html.replace(/<[^>]+>/g, " ").replace(/&#x27;|&#39;/g, "'").replace(/\s+/g, " ");
const read = (path: string) => JSON.parse(readFileSync(new URL(path, import.meta.url), "utf8"));

/* ------------------------------------------------------------------ podium sprint */

test("the sprint verdict says plainly who did better, and equal scores are a tie", () => {
  assert.deepEqual(sprintVerdict(3, 1), { kind: "win", text: "You beat Paladin, 3 correct to 1." });
  assert.deepEqual(sprintVerdict(1, 2), { kind: "loss", text: "Paladin beat you, 2 correct to 1." });
  assert.deepEqual(sprintVerdict(2, 2), { kind: "tie", text: "You and Paladin tied, 2 correct each." });
  assert.equal(sprintVerdict(0, 0).kind, "tie");
});

test("Podium Sprint explains itself and shows nothing about the result before the picks are locked", async () => {
  const { PodiumSprint } = await loadModule<{ PodiumSprint: never }>("/src/features/games/PodiumSprint.tsx");
  const html = render(PodiumSprint, {} as never);
  const plain = text(html);
  assert.match(plain, /Call the podium in five real races\./);
  assert.match(plain, /pick the three drivers you think finished in the top three/);
  assert.match(plain, /Who finished in the top three\?/);
  assert.match(plain, /Tap exactly three of the 20 drivers who started/);
  assert.match(plain, /The order does not matter, so the most you can score in a race is 3\./);
  assert.match(plain, /0 of 3 drivers chosen\./);
  assert.match(plain, /Race 1 of 5/);
  assert.match(plain, /Season to play/);
  // The old jargon is gone.
  assert.ok(!/Held-out prediction game|Your hits|Model hits/.test(plain));
  // Sealed: no real podium, no Paladin picks, no result tags, and the lock button is disabled until three are chosen.
  assert.ok(!/The real podium|Real result|of 3 correct/.test(plain));
  assert.match(html, /<button[^>]*disabled=""[^>]*>Lock in my three and see the result<\/button>/);
  // The whole field is offered, not a handful of names built from the answer.
  assert.ok(count(html, /aria-pressed="false"/g) >= 18, "the choice list is the whole starting field");
  assert.match(plain, /of the \d+ drivers who started, shown in starting-grid order/);
  assert.match(html, /tag-user/);
  assert.ok(!/tag-model/.test(html), "no model tag until Paladin's picks are shown");
});

test("the sprint offers every driver who started, never a list built from the result", () => {
  const races = read("../src/data/races.json") as { id: number; year: number; slug: string; drivers: number; predicted: number[]; actual: number[]; baseline: number[] }[];
  const drivers = read("../src/data/drivers.json").drivers as Parameters<typeof fieldOf>[1];
  for (const race of races) {
    const field = fieldOf(race, drivers);
    assert.equal(field.length, race.drivers, `${race.year} ${race.slug}: the field is the ${race.drivers} who started`);
    assert.ok(field.length >= 18);
    const ids = new Set(field.map((f) => f.id));
    assert.equal(ids.size, field.length, "each driver once");
    for (const id of [...race.actual, ...race.predicted, ...race.baseline]) assert.ok(ids.has(id), "the podium and the picks are inside the field, not the whole of it");
    assert.ok(field.length > race.actual.length * 5, "the real podium is a small part of what is offered");
    // Grid order, pit-lane starters last, and no finishing data is carried.
    const slots = field.map((f) => f.grid ?? 99);
    assert.deepEqual(slots, [...slots].sort((a, b) => a - b));
    assert.deepEqual(Object.keys(field[0]).sort(), ["constructorId", "grid", "id"]);
  }
  // The old behaviour, for the record: the union of podium and picks was only 3 to 7 names.
  const old = races.map((r) => new Set([...r.actual, ...r.predicted, ...r.baseline]).size);
  assert.ok(Math.max(...old) <= 9 && Math.min(...old) <= 4);
});

/* ------------------------------------------------------------------ grand prix view helpers */

test("race times and gaps are formatted the way a timing screen shows them", () => {
  assert.equal(raceTime(43.559), "43.559");
  assert.equal(raceTime(65.342), "1:05.342");
  assert.equal(raceTime(125.0), "2:05.000");
  assert.equal(raceTime(-1), "–");
  assert.equal(raceTime(Number.NaN), "–");
  assert.equal(gapText(0.866), "+0.866");
  assert.equal(gapText(12.34), "+12.3");
  assert.equal(gapText(65.2), "+1:05.2");
  assert.equal(gapText(-1), "–");
  assert.equal(gapPlain(0.866), "0.866 s");
  assert.equal(gapPlain(12.34), "12.3 s");
  assert.equal(gapPlain(65.2), "1:05.2");
  assert.equal(gapPlain(Number.NaN), "–");
  assert.equal(lapText(2, 3), "Lap 2 of 3");
  assert.equal(lapText(0, 3), "Lap 1 of 3");
  assert.equal(lapText(9, 3), "Lap 3 of 3");
  assert.match(durationHint(2), /^about \d+ s$/);
  assert.match(durationHint(5), /^about [\d.]+ min$/);
});

test("the timing tower always shows the leader, the player and the cars around them, in at most 9 rows", () => {
  const rows = (position: number, size = 20, max = 9) => towerWindow(size, position, max);
  for (let position = 1; position <= 20; position++) {
    const shown = rows(position);
    const positions = shown.filter((r) => r.kind === "row").map((r) => (r as { position: number }).position);
    assert.ok(shown.length <= 9, `position ${position}: ${shown.length} rows`);
    assert.equal(positions[0], 1, "the leader is always first");
    assert.ok(positions.includes(position), `position ${position} is shown`);
    for (let i = 1; i < positions.length; i++) assert.ok(positions[i] > positions[i - 1], "in order, once each");
    // A gap marker appears exactly where positions are skipped.
    for (let i = 1; i < shown.length; i++) {
      const prev = shown[i - 1];
      const cur = shown[i];
      if (cur.kind === "gap") assert.equal(prev.kind, "row");
      if (cur.kind === "row" && prev.kind === "row") assert.equal(cur.position, prev.position + 1);
    }
    if (position <= 2) assert.ok(!shown.some((r) => r.kind === "gap") || position > 8, "no gap marker needed near the front");
  }
  assert.deepEqual(rows(1, 5), [1, 2, 3, 4, 5].map((position) => ({ kind: "row", position })));
  assert.equal(rows(20).at(-1)?.kind, "row");
  assert.deepEqual(rows(20).filter((r) => r.kind === "row").at(-1), { kind: "row", position: 20 });
  assert.equal(towerWindow(0, 1).length, 0);
});

/* ------------------------------------------------------------------ grand prix setup */

async function setupProps() {
  const data = await loadModule<{ RACES: { id: number; year: number; round: number; name: string; slug: string }[]; layoutFor: unknown; circuit: (id: number) => { name: string } }>("/src/lib/data.ts");
  const engine = await loadModule<{ entrantsFrom: (rows: unknown[]) => unknown[]; EMPTY_RECORD: unknown }>("/src/features/games/raceEngine.ts");
  const { buildRows } = await loadModule<{ buildRows: (detail: unknown, year: number) => unknown[] }>("/src/features/race/rows.ts");
  const race = data.RACES.find((r) => r.year === 2023 && r.slug === "monaco")!;
  const detail = read(`../public/data/races/${race.id}.json`);
  const entrants = engine.entrantsFrom(buildRows(detail, race.year)) as { id: number; grid: number | null; last: string }[];
  const noop = () => {};
  return {
    race,
    entrants,
    props: {
      seasons: [2022, 2023, 2024],
      season: 2023,
      onSeason: noop,
      races: data.RACES.filter((r) => r.year === 2023),
      raceId: race.id,
      onRace: noop,
      layout: null,
      circuitName: "Circuit de Monaco",
      entrants,
      loadError: false,
      driverId: entrants.find((e) => e.grid === 1)!.id,
      onDriver: noop,
      laps: 3,
      onLaps: noop,
      assist: "standard",
      onAssist: noop,
      auto: false,
      onAuto: noop,
      camera: "follow",
      onCamera: noop,
      onStart: noop,
      record: engine.EMPTY_RECORD,
    },
  };
}

test("the setup lets you choose any real driver on the grid, shows what is known before the start, and names the driver you will race as", async () => {
  const { GrandPrixSetup } = await loadModule<{ GrandPrixSetup: never }>("/src/features/games/GrandPrixSetup.tsx");
  const { props, entrants } = await setupProps();
  const html = render(GrandPrixSetup, props as never);
  const plain = text(html);

  // Twenty drivers in a radio group: exactly one is checked and only it is in the tab order.
  assert.match(html, /role="radiogroup"[^>]*aria-label="Choose your driver"/);
  const radios = [...html.matchAll(/<button[^>]*role="radio"[^>]*>/g)].map((m) => m[0]).filter((tag) => /id="gp-driver-/.test(tag));
  assert.equal(radios.length, 20);
  assert.equal(radios.filter((r) => /aria-checked="true"/.test(r)).length, 1);
  assert.equal(radios.filter((r) => /tabindex="0"/.test(r)).length, 1);
  assert.equal(radios.filter((r) => /tabindex="-1"/.test(r)).length, 19);
  // Each card says who, which team, where they start and how fast the car is, in words.
  assert.ok(radios.every((r) => /aria-label="[^"]+, [^"]+, starts (P\d+|from the pit lane), (Frontrunner|Midfield|Backmarker)"/.test(r)));
  assert.match(plain, /20 drivers, in starting-grid order/);
  assert.match(plain, /Frontrunner/);
  assert.match(plain, /Backmarker/);
  assert.match(plain, /Race as /);
  const pole = entrants.find((e) => e.grid === 1)!;
  assert.match(plain, new RegExp(`Race as ${pole.last}`));
  assert.match(plain, /Round 6 · Monaco Grand Prix/);

  // Settings: laps, driving help and camera are real radio groups, and autopilot is a labelled checkbox.
  assert.match(html, /aria-label="Number of laps"/);
  assert.match(html, /aria-label="Driving assistance"/);
  assert.match(html, /aria-label="Camera"/);
  assert.equal(count(html, /id="gp-laps-tab-/g), 3);
  assert.equal(count(html, /id="gp-assist-tab-/g), 3);
  assert.match(html, /<input type="checkbox"[^>]*>.*Autopilot\./s);
  assert.match(plain, /You brake\. Arrive at a tight corner too fast and the car runs wide and loses speed\./);
  assert.match(plain, /not added to your record/);

  // Honest about where the pace comes from, and shows no race outcome.
  assert.match(plain, /The bar under each driver is the car's pace in this game\./);
  assert.ok(!/finished|podium|won/i.test(plain.replace(/Podiums/g, "")), "nothing about how the real race went");
});

test("a block that mounts lazily reserves its space, so mounting it does not push the page down", async () => {
  const { Lazy } = await loadModule<{ Lazy: never }>("/src/components/Lazy.tsx");
  const g = globalThis as { IntersectionObserver?: unknown };
  const original = g.IntersectionObserver;
  g.IntersectionObserver = class {}; // present, so the block starts unmounted as it does in a real browser
  try {
    const fixed = render(Lazy, { id: "x", minHeight: 720, children: "inner" } as never);
    assert.match(fixed, /style="min-height:720px"/);
    assert.ok(!fixed.includes("inner"), "nothing is mounted before the block is near the viewport");

    const responsive = render(Lazy, { id: "x", minHeight: 720, reserve: "min-h-[10px] sm:min-h-[20px]", children: "inner" } as never);
    assert.match(responsive, /min-h-\[10px\] sm:min-h-\[20px\]/);
    assert.ok(!/style=/.test(responsive), "the responsive classes replace the fixed number instead of fighting it");
    assert.ok(!responsive.includes("inner"));
  } finally {
    if (original === undefined) delete g.IntersectionObserver;
    else g.IntersectionObserver = original;
  }
  // Without IntersectionObserver the block mounts at once and reserves nothing.
  const eager = render(Lazy, { id: "x", minHeight: 720, reserve: "min-h-[10px]", children: "inner" } as never);
  assert.ok(eager.includes("inner") && !/min-h-\[10px\]|style=/.test(eager));
});

test("the hub reserves the Grand Prix's real height at every width, for the placeholder and for the loading fallback", () => {
  const hub = readFileSync(new URL("../src/features/games/ChallengeHub.tsx", import.meta.url), "utf8");
  const reserve = hub.match(/const GP_RESERVE = "([^"]+)"/)?.[1];
  assert.ok(reserve, "GP_RESERVE is defined");
  // One minimum height for phones and one for each breakpoint, because the setup screen is 2,650 px tall on a phone and about 1,060 px on a desktop.
  for (const prefix of ["", "sm:", "lg:", "xl:", "2xl:"]) {
    assert.match(reserve, new RegExp(`(^| )${prefix}min-h-\\[\\d+px\\]`), `a ${prefix || "base"} minimum height is reserved`);
  }
  assert.match(hub, /<Lazy id="grand-prix"[^>]*reserve=\{GP_RESERVE\}/, "the lazy placeholder uses it");
  assert.match(hub, /fallback=\{<div className=\{`panel \$\{GP_RESERVE\}`\}>/, "so does the chunk-loading fallback");
});

test("the setup copes with a loading field, a failed load, and a saved record", async () => {
  const { GrandPrixSetup } = await loadModule<{ GrandPrixSetup: never }>("/src/features/games/GrandPrixSetup.tsx");
  const { props, race } = await setupProps();
  const loading = render(GrandPrixSetup, { ...props, entrants: null, driverId: null } as never);
  assert.match(text(loading), /Loading the grid/);
  assert.match(loading, /<button[^>]*disabled=""[^>]*>Choose a driver/);
  assert.equal(count(loading, /role="radio"[^>]*id="gp-driver-/g), 0);

  // While loading, the driver list keeps its footprint: 20 placeholders in the same grid, each as tall as a driver card.
  // A short loader here made the whole block collapse and re-grow (a layout shift of hundreds of pixels at tablet widths).
  assert.equal(count(loading, /animate-pulse/g), 20);
  const loaded = render(GrandPrixSetup, props as never);
  const gridOf = (html: string, marker: RegExp) => html.match(marker)?.[1];
  const skeletonGrid = gridOf(loading, /<div class="(mt-3 grid [^"]*)" aria-hidden="true">/);
  const loadedGrid = gridOf(loaded, /aria-label="Choose your driver" class="(mt-3 grid [^"]*)"/);
  assert.ok(skeletonGrid && loadedGrid, "both the placeholder grid and the real grid are found");
  assert.equal(skeletonGrid, loadedGrid, "placeholders use exactly the grid classes of the real driver list");
  assert.equal(count(loaded, /min-h-\[7\.4rem\]/g) >= 20, true, "driver cards keep the height the placeholders reserve");
  assert.ok(!/animate-pulse/.test(loaded), "no placeholders once the field has loaded");

  const failed = render(GrandPrixSetup, { ...props, entrants: null, driverId: null, loadError: true } as never);
  assert.match(failed, /role="alert"/);
  assert.match(text(failed), /could not be loaded/);

  const record = { races: 4, wins: 1, podiums: 2, points: 61, best: { [String(race.id)]: 2 } };
  const saved = text(render(GrandPrixSetup, { ...props, record } as never));
  assert.match(saved, /Your best finish here: P2\./);
  assert.match(saved, /Races 4 Wins 1 Podiums 2 Points 61/);

  const auto = render(GrandPrixSetup, { ...props, auto: true } as never);
  assert.equal(count(auto, /id="gp-assist-tab-[^"]*"[^>]*disabled=""/g) + count(auto, /disabled=""[^>]*id="gp-assist-tab-/g), 3, "driving assistance is switched off while autopilot is on");
  assert.match(html2text(auto), /The car brakes for corners by itself/);
});
const html2text = text;
