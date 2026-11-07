import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { test } from "node:test";

/**
 * The static data is the source of truth for everything the site draws. These tests check that every file the
 * interface loads exists, is internally consistent, and says nothing the geometry contradicts.
 */

const read = (path: string) => JSON.parse(readFileSync(new URL(path, import.meta.url), "utf8"));
const circuits = read("../src/data/circuits.json") as {
  circuitId: number;
  ref: string;
  layouts: { id: string; file: string | null; years: number[]; lengthM: number | null; turns: number | null; note?: string | null; direction?: string | null }[];
}[];
const races = read("../src/data/races.json") as {
  id: number;
  year: number;
  slug: string;
  circuitId: number;
  layout: string;
  drivers: number;
  predicted: number[];
  actual: number[];
  baseline: number[];
  hits: number;
  baselineHits: number;
  scheduledLaps: number | null;
  lapsRun: number;
}[];

interface Layout {
  id: string;
  viewBox: [number, number];
  path: string;
  samples: [number, number][];
  start: { x: number; y: number; heading: number } | null;
  direction: "clockwise" | "anticlockwise" | null;
  corners: { n: number; x: number; y: number; lx: number; ly: number }[];
  cornersNote?: string | null;
  sectors: [number, number] | null;
  drs: { from: number; to: number; lengthM: number }[] | null;
}
const layouts = circuits.flatMap((c) => c.layouts.filter((l) => l.file).map((l) => ({ circuit: c.ref, meta: l, data: read(`../public/data/${l.file}`) as Layout })));

test("every layout the atlas lists either has a readable outline file or says why it has none", () => {
  const listed = circuits.flatMap((c) => c.layouts);
  assert.ok(listed.length >= 28);
  for (const layout of listed) {
    if (layout.file) assert.ok(existsSync(new URL(`../public/data/${layout.file}`, import.meta.url)), `${layout.id}: ${layout.file} is missing`);
    else assert.ok(layout.note && layout.note.length > 10, `${layout.id} has no outline and no explanation`);
  }
});

test("every outline has usable geometry", () => {
  assert.ok(layouts.length >= 25);
  for (const { meta, data } of layouts) {
    const label = meta.id;
    assert.equal(data.id, meta.id, `${label}: file id differs from the index`);
    const [w, h] = data.viewBox;
    assert.ok(w > 0 && h > 0, `${label}: bad viewBox`);
    assert.match(data.path, /^M/, `${label}: path does not start with a move`);
    // Outline-only layouts have no samples; the map then simply omits the direction arrow (it needs 20).
    if (data.samples.length === 0) assert.equal(data.direction, null, `${label}: a direction is claimed without samples to derive it from`);
    for (const [x, y] of data.samples) assert.ok(Number.isFinite(x) && Number.isFinite(y), `${label}: non-finite sample`);
    if (data.start) assert.ok([data.start.x, data.start.y, data.start.heading].every(Number.isFinite), `${label}: bad start line`);
  }
});

test("corner numbers are unique, finite and sit on the drawn map", () => {
  for (const { meta, data } of layouts) {
    const [w, h] = data.viewBox;
    const seen = new Set<number>();
    for (const c of data.corners) {
      assert.ok(Number.isInteger(c.n) && c.n > 0, `${meta.id}: corner number ${c.n}`);
      assert.ok(!seen.has(c.n), `${meta.id}: duplicate corner ${c.n}`);
      seen.add(c.n);
      assert.ok([c.x, c.y, c.lx, c.ly].every(Number.isFinite), `${meta.id}: corner ${c.n} has a non-finite position`);
      // Labels may sit slightly outside the outline's box but never far from the map.
      assert.ok(c.lx > -80 && c.lx < w + 80 && c.ly > -80 && c.ly < h + 80, `${meta.id}: corner ${c.n} label is off the map`);
    }
    // No corner numbers is acceptable only with a stated reason, because the page tells the viewer why.
    if (data.corners.length === 0) assert.ok(data.cornersNote || meta.note, `${meta.id}: no corner numbers drawn and no reason recorded`);
  }
});

test("sectors and DRS zones are fractions of a lap and never invented for layouts without telemetry", () => {
  for (const { meta, data } of layouts) {
    if (data.sectors) {
      const [a, b] = data.sectors;
      assert.ok(0 < a && a < b && b < 1, `${meta.id}: sector boundaries ${a}, ${b}`);
    }
    for (const zone of data.drs ?? []) {
      assert.ok(zone.from >= 0 && zone.from <= 1 && zone.to >= 0 && zone.to <= 1, `${meta.id}: DRS zone outside the lap`);
      assert.ok(zone.lengthM > 0, `${meta.id}: DRS zone has no length`);
    }
  }
  // Layouts the index marks as having no telemetry must not carry sector or DRS data.
  for (const { meta, data } of layouts.filter((l) => l.meta.note && /Outline only/i.test(l.meta.note))) {
    assert.equal(data.sectors, null, `${meta.id}: sectors drawn on an outline-only layout`);
    assert.ok(!data.drs || data.drs.length === 0, `${meta.id}: DRS drawn on an outline-only layout`);
    assert.equal(data.corners.length, 0, `${meta.id}: corner numbers on an outline-only layout`);
  }
});

test("a stated racing direction agrees with the outline's own geometry", () => {
  // Shoelace area of the ordered samples. SVG's y axis points down, so a positive area is clockwise on screen.
  const signedArea = (pts: [number, number][]) => pts.reduce((sum, [x, y], i) => sum + (x * pts[(i + 1) % pts.length][1] - pts[(i + 1) % pts.length][0] * y), 0) / 2;
  let checked = 0;
  for (const { meta, data } of layouts) {
    if (!data.direction) continue;
    const area = signedArea(data.samples);
    // A figure-eight (Suzuka) has no single direction, so the sign test only applies when the loop is not self-crossing.
    if (Math.abs(area) < 0.02 * data.viewBox[0] * data.viewBox[1]) continue;
    checked++;
    assert.equal(data.direction, area > 0 ? "clockwise" : "anticlockwise", `${meta.id}: says ${data.direction} but the samples run the other way`);
  }
  assert.ok(checked >= 15, `only ${checked} layouts could be checked`);
});

test("races point at circuits and layouts that exist and their stored scores are consistent", () => {
  assert.equal(races.length, 68);
  const byId = new Map(circuits.map((c) => [c.circuitId, c]));
  for (const race of races) {
    const circuit = byId.get(race.circuitId);
    assert.ok(circuit, `${race.slug} ${race.year}: unknown circuit`);
    assert.ok(circuit.layouts.some((l) => l.id === race.layout), `${race.slug} ${race.year}: layout ${race.layout} missing`);
    for (const list of [race.predicted, race.actual, race.baseline]) assert.equal(new Set(list).size, 3);
    assert.equal(race.hits, race.predicted.filter((id) => race.actual.includes(id)).length, `${race.slug} ${race.year}: hits`);
    assert.equal(race.baselineHits, race.baseline.filter((id) => race.actual.includes(id)).length, `${race.slug} ${race.year}: baselineHits`);
    assert.ok(race.scheduledLaps === null || race.lapsRun <= race.scheduledLaps + 0, `${race.slug} ${race.year}: ran more laps than scheduled`);
  }
});

test("every race file the page loads exists, covers its field once, and holds valid scores", () => {
  for (const race of races) {
    const path = new URL(`../public/data/races/${race.id}.json`, import.meta.url);
    assert.ok(existsSync(path), `race ${race.id} file missing`);
    const detail = read(`../public/data/races/${race.id}.json`) as { entries: { d: number; p: number; x: (number | null)[]; pos: number | null }[] };
    assert.equal(detail.entries.length, race.drivers);
    assert.equal(new Set(detail.entries.map((e) => e.d)).size, detail.entries.length, `race ${race.id}: a driver appears twice`);
    for (const entry of detail.entries) {
      assert.ok(entry.p >= 0 && entry.p <= 1, `race ${race.id}: score ${entry.p}`);
      assert.equal(entry.x.length, 16);
    }
    const podium = detail.entries.filter((e) => e.pos !== null && e.pos <= 3).map((e) => e.d).sort();
    assert.deepEqual(podium, [...race.actual].sort(), `race ${race.id}: stored podium differs from the classification`);
  }
});
