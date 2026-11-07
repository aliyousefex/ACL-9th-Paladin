import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { after, test } from "node:test";
import { closeServer, loadModule, render } from "./helpers/ssr.ts";

/**
 * The cutoff between what is known before lights out and what the race reveals is the product. These tests render
 * the real race panels for every held-out Grand Prix before and after the reveal and check what each state contains.
 */

after(closeServer);

interface Race { id: number; year: number; slug: string; circuitId: number; scheduledLaps: number | null; lapsRun: number; actual: number[]; predicted: number[] }
interface Data {
  RACES: Race[];
  circuit: (id: number) => { stats?: { fastestLap: Record<string, { ms: number }> } };
}
const text = (html: string) => html.replace(/<[^>]+>/g, " ").replace(/&#x27;|&#39;/g, "'").replace(/\s+/g, " ");

async function load() {
  const data = await loadModule<Data>("/src/lib/data.ts");
  const panel = await loadModule<{ CircuitPanel: never }>("/src/features/race/CircuitPanel.tsx");
  return { ...data, CircuitPanel: panel.CircuitPanel };
}

test("circuit facts never reveal that a race was shortened or who set its fastest lap before the reveal", async () => {
  const { RACES, circuit, CircuitPanel } = await load();
  assert.equal(RACES.length, 68);
  for (const race of RACES) {
    const before = text(render(CircuitPanel, { race, circuit: circuit(race.circuitId), revealed: false } as never));
    assert.ok(!/shortened|Laps run/i.test(before), `${race.year} ${race.slug} leaks a shortened race`);
    assert.ok(!new RegExp(`Fastest lap ${race.year}\\b`).test(before), `${race.year} ${race.slug} leaks its own fastest lap`);
    assert.match(before, /Scheduled laps/);
    assert.match(before, new RegExp(`\\b${race.scheduledLaps}\\b`));
  }
});

test("before the reveal the fastest-lap fact is the previous season's, labelled with its year, or absent", async () => {
  const { RACES, circuit, CircuitPanel } = await load();
  const race = RACES.find((r) => r.year === 2023 && r.slug === "bahrain")!;
  const before = text(render(CircuitPanel, { race, circuit: circuit(race.circuitId), revealed: false } as never));
  assert.match(before, /Fastest lap 2022 .*previous season/);
  const first = RACES.find((r) => r.year === 2022 && r.slug === "bahrain")!;
  const none = text(render(CircuitPanel, { race: first, circuit: circuit(first.circuitId), revealed: false } as never));
  assert.match(none, /Fastest lap 2021 n\/a no earlier season in the data/);
});

test("after the reveal the shortened distance and this race's own fastest lap appear", async () => {
  const { RACES, circuit, CircuitPanel } = await load();
  const shortened = RACES.filter((r) => r.scheduledLaps !== null && r.lapsRun < r.scheduledLaps);
  assert.equal(shortened.length, 5, "the dataset has five shortened races");
  for (const race of shortened) {
    const after = text(render(CircuitPanel, { race, circuit: circuit(race.circuitId), revealed: true } as never));
    assert.match(after, new RegExp(`Laps run ${race.lapsRun}\\b.*shortened from ${race.scheduledLaps}`), `${race.year} ${race.slug}`);
  }
  const race = RACES.find((r) => r.year === 2023 && r.slug === "bahrain")!;
  const after = text(render(CircuitPanel, { race, circuit: circuit(race.circuitId), revealed: true } as never));
  assert.match(after, /Fastest lap 2023/);
  assert.ok(!/previous season/.test(after));
});

test("the result panel is sealed until asked for and then names the real podium", async () => {
  const data = await loadModule<Data>("/src/lib/data.ts");
  const { ResultPanel } = await loadModule<{ ResultPanel: never }>("/src/features/race/ResultPanel.tsx");
  const { buildRows } = await loadModule<{ buildRows: (detail: unknown, year: number) => unknown[] }>("/src/features/race/rows.ts");
  for (const race of data.RACES.filter((_, i) => i % 6 === 0)) {
    const detail = JSON.parse(readFileSync(new URL(`../public/data/races/${race.id}.json`, import.meta.url), "utf8"));
    const rows = buildRows(detail, race.year);
    const props = { race, rows, onReveal: () => {}, alwaysShow: false, onAlwaysShow: () => {} };
    const sealed = text(render(ResultPanel, { ...props, revealed: false } as never));
    assert.match(sealed, /Reveal the result/);
    assert.ok(!/Actual podium|Starting-grid top three|Model's predicted podium/.test(sealed), `${race.slug} shows results while sealed`);
    // No finishing position of any driver appears while sealed.
    assert.equal((sealed.match(/\bP\d{1,2}\b/g) ?? []).length, 0);
    const open = text(render(ResultPanel, { ...props, revealed: true } as never));
    assert.match(open, /Actual podium/);
    assert.match(open, /Starting-grid top three/);
    assert.ok(!/Reveal the result/.test(open));
  }
});

test("grid rebels explain moves from model contributions and hold the outcome back until the reveal", async () => {
  const data = await loadModule<Data>("/src/lib/data.ts");
  const { GridRebels } = await loadModule<{ GridRebels: never }>("/src/features/race/GridRebels.tsx");
  const { buildRows } = await loadModule<{ buildRows: (detail: unknown, year: number) => unknown[] }>("/src/features/race/rows.ts");
  const race = data.RACES.find((r) => r.year === 2023 && r.slug === "monaco")!;
  const detail = JSON.parse(readFileSync(new URL(`../public/data/races/${race.id}.json`, import.meta.url), "utf8"));
  const rows = buildRows(detail, race.year);
  const before = text(render(GridRebels, { rows, revealed: false } as never));
  assert.match(before, /Promoted/);
  assert.match(before, /Demoted/);
  assert.match(before, /Lifted by/);
  assert.match(before, /Held back by/);
  assert.match(before, /minus the average for the same input across every car on this grid/);
  assert.match(before, /associations, not a forecast/);
  assert.ok(!/Result:|finished on the podium|finished \d/.test(before), "outcome stays hidden");
  assert.match(before, /Outcomes stay hidden until you reveal the result/);
  // Reasons are signed numbers taken from the model, not prose.
  assert.ok(/[+−]\d\.\d{2}/.test(before));
  const after = text(render(GridRebels, { rows, revealed: true } as never));
  assert.match(after, /Result:/);
  assert.ok(!/Outcomes stay hidden/.test(after));
});

test("the podium challenge is honest that the model's call is visible and only the result is hidden", async () => {
  const data = await loadModule<Data>("/src/lib/data.ts");
  const { RaceChallenge } = await loadModule<{ RaceChallenge: never }>("/src/features/race/RaceChallenge.tsx");
  const { buildRows } = await loadModule<{ buildRows: (detail: unknown, year: number) => unknown[] }>("/src/features/race/rows.ts");
  const race = data.RACES[10];
  const detail = JSON.parse(readFileSync(new URL(`../public/data/races/${race.id}.json`, import.meta.url), "utf8"));
  const html = render(RaceChallenge, { race, rows: buildRows(detail, race.year), revealed: false } as never);
  const plain = text(html);
  assert.match(plain, /this is not a blind test: only the actual result stays hidden until you reveal it/);
  assert.match(html, /tag-user/, "labelled as the viewer's own input");
  // Lock requires exactly three picks.
  assert.match(html, /disabled=""[^>]*>Lock my three/);
  assert.match(plain, /podium membership, not finishing order/);
});
