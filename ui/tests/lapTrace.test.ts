import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import {
  MIN_FIELD,
  SLOW_FACTOR,
  buildTrace,
  formatGap,
  gapAt,
  lapRange,
  leadChanges,
  leaders,
  axisTicks,
  orderAt,
  positionAt,
  stopsBy,
  traceStory,
  type Trace,
  type StoryRow,
} from "../src/features/race/lapTrace.ts";

const read = (path: string) => JSON.parse(readFileSync(new URL(path, import.meta.url), "utf8"));
const races = read("../src/data/races.json") as { id: number; year: number; slug: string }[];
const drivers = read("../src/data/drivers.json").drivers as { id: number; last: string }[];
const nameOf = new Map(drivers.map((d) => [d.id, d.last]));

interface RaceFile {
  entries: { d: number; x: (number | null)[]; txt: string; status: string; pos: number | null; time: string | null }[];
  laps: { n: number; d: Record<string, { t: (number | null)[]; p: (number | null)[] }> };
  pits: Record<string, [number, number | null][]>;
}

function load(race: { id: number }) {
  const file = read(`../public/data/races/${race.id}.json`) as RaceFile;
  const entries = file.entries.map((e) => ({ id: e.d, grid: e.x[0] ?? null, classified: /^\d+$/.test(e.txt), txt: e.txt, status: e.status }));
  const trace = buildTrace(file.laps.d, file.pits, entries);
  const rows: StoryRow[] = file.entries.map((e) => ({ id: e.d, name: nameOf.get(e.d) ?? String(e.d), grid: e.x[0] ?? null, finish: e.pos }));
  return { file, trace, rows };
}
const all = races.map((race) => ({ race, ...load(race) }));
const find = (year: number, slug: string) => all.find((r) => r.race.year === year && r.race.slug === slug)!;

test("cumulative times only ever increase and gaps are never negative", () => {
  for (const { race, trace } of all) {
    for (const d of trace.drivers) {
      assert.equal(d.cum[0], 0);
      assert.equal(d.cum.length, d.laps + 1);
      assert.equal(d.pos.length, d.laps + 1);
      for (let k = 1; k <= d.laps; k++) assert.ok(d.cum[k] > d.cum[k - 1], `${race.year} ${race.slug} driver ${d.id} lap ${k}`);
    }
    for (let k = 1; k <= trace.totalLaps; k++) {
      assert.ok(trace.leaderCum[k] > trace.leaderCum[k - 1]);
      let someoneAtZero = false;
      for (const d of trace.drivers) {
        const gap = gapAt(trace, d.id, k);
        if (gap === null) continue;
        assert.ok(gap >= 0, `${race.slug} ${race.year} negative gap`);
        if (gap === 0) someoneAtZero = true;
      }
      assert.ok(someoneAtZero, "the fastest car has a zero gap on every lap");
    }
  }
});

test("the car with the lowest summed time at the end of a lap is the official leader, on every lap of every race", () => {
  let laps = 0;
  for (const { race, trace } of all) {
    const official = leaders(trace);
    assert.equal(official.length, trace.totalLaps, `${race.year} ${race.slug}: a lap has no official leader`);
    for (let k = 1; k <= trace.totalLaps; k++) {
      const byTime = trace.drivers.filter((d) => d.laps >= k).sort((a, b) => a.cum[k] - b.cum[k])[0];
      assert.equal(byTime.id, official[k - 1], `${race.year} ${race.slug} lap ${k}`);
      laps++;
    }
  }
  assert.ok(laps > 4000);
});

test("summed lap times reproduce the official finishing gap, except where a post-race penalty or reclassification applies", () => {
  let compared = 0;
  const off: string[] = [];
  for (const { race, file, trace } of all) {
    const p1 = file.entries.find((e) => e.pos === 1)!;
    const p2 = file.entries.find((e) => e.pos === 2)!;
    const a = trace.byId.get(p1.d)!;
    const b = trace.byId.get(p2.d)!;
    const m = /^\+(?:(\d+):)?(\d+\.\d+)$/.exec(p2.time ?? "");
    if (!a || !b || a.laps !== b.laps || !m) continue;
    const official = Number(m[1] ?? 0) * 60 + Number(m[2]);
    compared++;
    if (Math.abs(b.cum[b.laps] - a.cum[a.laps] - official) > 0.01) off.push(`${race.year} ${race.slug}`);
  }
  assert.ok(compared >= 65, `compared ${compared}`);
  // The only differences are races where the official result was changed after the flag.
  assert.ok(off.length <= 4, `unexpected disagreements: ${off.join(", ")}`);
});

test("positions: lap 0 is the grid, retired drivers drop out of the order, and pit-lane starters have no grid slot", () => {
  const { trace } = find(2023, "monaco");
  const grid = orderAt(trace, 0);
  assert.ok(grid.length >= 18);
  grid.forEach((d, i) => assert.equal(positionAt(trace, d.id, 0), i + 1));
  const last = orderAt(trace, trace.totalLaps);
  assert.ok(last.length < trace.drivers.length || trace.drivers.every((d) => d.laps === trace.totalLaps));
  for (const d of trace.drivers) {
    assert.equal(positionAt(trace, d.id, d.laps + 1), null, "no position after the last lap");
    assert.equal(gapAt(trace, d.id, d.laps + 1), null);
  }
  assert.equal(gapAt(trace, -1, 1), null);
  assert.equal(positionAt(trace, -1, 1), null);
});

test("entries with no recorded laps are reported, not drawn", () => {
  const withNone = all.filter(({ trace }) => trace.withoutLaps.length > 0);
  assert.ok(withNone.length > 0, "the dataset has entries with no laps");
  for (const { trace, file } of withNone) {
    for (const id of trace.withoutLaps) {
      assert.ok(!trace.byId.has(id));
      assert.ok(file.entries.some((e) => e.d === id));
    }
  }
});

test("slow-lap runs are ordered, never include lap 1, and are measured against the race's own median", () => {
  for (const { race, trace } of all) {
    let prevEnd = 1;
    for (const run of trace.slowRuns) {
      assert.ok(run.from >= 2, `${race.slug} lap 1 is a standing start and is never flagged`);
      assert.ok(run.from > prevEnd, "runs are separated and in order");
      assert.ok(run.to >= run.from && run.to <= trace.totalLaps);
      for (let k = run.from; k <= run.to; k++) {
        const m = trace.fieldMedian[k];
        assert.ok(m !== null && m > SLOW_FACTOR * trace.baseline, `${race.slug} ${race.year} lap ${k}`);
      }
      prevEnd = run.to;
    }
    // A lap that is not in a run is not slow, so the rule never silently drops one.
    const flagged = new Set(trace.slowRuns.flatMap((r) => Array.from({ length: r.to - r.from + 1 }, (_, i) => r.from + i)));
    for (let k = 2; k <= trace.totalLaps; k++) {
      const m = trace.fieldMedian[k];
      if (m !== null && !flagged.has(k)) assert.ok(m <= SLOW_FACTOR * trace.baseline);
    }
  }
  assert.ok(MIN_FIELD >= 3);
});

test("the 2022 Monaco red flag is found as a stoppage-length run, and a clean race has none", () => {
  const monaco = find(2022, "monaco").trace;
  const stoppage = monaco.slowRuns.filter((r) => r.severity === "stoppage");
  assert.equal(stoppage.length, 1);
  assert.ok(stoppage[0].from >= 25 && stoppage[0].to <= 33, JSON.stringify(stoppage));
  const clean = find(2024, "bahrain").trace;
  assert.equal(clean.slowRuns.length, 0);
});

test("pit stops are counted by lap, from the recorded pit list", () => {
  const { trace, file } = find(2024, "abu-dhabi");
  for (const d of trace.drivers) {
    const recorded = file.pits[String(d.id)] ?? [];
    assert.equal(stopsBy(trace, d.id, 0), 0);
    assert.equal(stopsBy(trace, d.id, trace.totalLaps), recorded.length);
    let prev = 0;
    for (let k = 1; k <= trace.totalLaps; k++) {
      const n = stopsBy(trace, d.id, k);
      assert.ok(n >= prev && n - prev <= 1 + 1, "stops never decrease");
      prev = n;
    }
  }
  assert.equal(stopsBy(trace, -1, 10), 0);
});

test("lead changes are counted from official positions", () => {
  for (const { trace } of all) {
    const order = leaders(trace);
    let manual = 0;
    for (let i = 1; i < order.length; i++) if (order[i] !== order[i - 1]) manual++;
    assert.equal(leadChanges(trace), manual);
    assert.ok(leadChanges(trace) <= order.length - 1);
  }
});

test("the race story is deterministic, names its baselines, and states no cause for slow laps", () => {
  for (const { race, trace, rows } of all.slice(0, 40)) {
    const a = traceStory(trace, rows);
    assert.deepEqual(traceStory(trace, rows), a);
    assert.ok(a.length >= 3 && a.length <= 7, `${race.slug}: ${a.length} lines`);
    assert.match(a[0], /^(The same driver led|The lead changed hands \d+ times? )/);
    for (const line of a) {
      assert.ok(!/safety car|red flag|rain|crash|collision|virtual/i.test(line), `a cause is named: ${line}`);
      assert.ok(!/undefined|NaN|null/.test(line), line);
    }
    const margin = a.find((l) => l.startsWith("Gap between"));
    if (margin) assert.match(margin, /before any post-race time penalty/);
    const climb = a.find((l) => l.startsWith("Biggest climb"));
    if (climb) assert.match(climb, /against the starting grid/);
    const slow = a.find((l) => /slow laps|slower than the race median/.test(l));
    assert.ok(slow, "slow-lap statement always present");
    if (trace.slowRuns.length) assert.match(slow!, /The data does not record the cause\./);
  }
});

test("the 2022 Monaco story matches the record", () => {
  const { trace, rows } = find(2022, "monaco");
  const story = traceStory(trace, rows).join("\n");
  assert.match(story, /Gap between P[ée]rez and Sainz at the flag.*1\.2 s/);
  assert.match(story, /laps 2–7, laps 26–32/);
  assert.match(story, /19 drivers/);
});

test("formatting: gaps, axis ticks and lap ranges", () => {
  assert.equal(formatGap(0), "Leader");
  assert.equal(formatGap(0.04), "Leader");
  assert.equal(formatGap(1.23), "+1.2 s");
  assert.equal(formatGap(89.94), "+89.9 s");
  assert.equal(formatGap(95), "+1:35.0");
  assert.equal(formatGap(125.46), "+2:05.5");
  assert.deepEqual(axisTicks(37), [0, 10, 20, 30, 40]);
  assert.deepEqual(axisTicks(3), [0, 1, 2, 3]);
  assert.deepEqual(axisTicks(60), [0, 10, 20, 30, 40, 50, 60]);
  assert.deepEqual(axisTicks(95), [0, 20, 40, 60, 80, 100]);
  assert.deepEqual(axisTicks(0), [0, 1]);
  assert.deepEqual(axisTicks(Number.NaN), [0, 1]);
  for (const max of [0.4, 7, 19, 44, 91, 250, 999, 4000, 100000]) {
    const ticks = axisTicks(max);
    assert.ok(ticks[ticks.length - 1] >= max, `${max}: top tick ${ticks[ticks.length - 1]}`);
    assert.ok(ticks.length >= 2 && ticks.length <= 8);
    assert.equal(ticks[0], 0);
    const step = ticks[1] - ticks[0];
    ticks.forEach((t, i) => assert.equal(t, i * step), "evenly spaced");
  }
  assert.equal(lapRange(7, 7), "lap 7");
  assert.equal(lapRange(7, 9), "laps 7–9");
});

test("a trace with no usable laps is empty rather than broken", () => {
  const empty: Trace = buildTrace({}, {}, [{ id: 1, grid: 1, classified: false, txt: "R", status: "Retired" }]);
  assert.equal(empty.totalLaps, 0);
  assert.equal(empty.drivers.length, 0);
  assert.deepEqual(empty.withoutLaps, [1]);
  assert.equal(empty.slowRuns.length, 0);
  assert.equal(leadChanges(empty), 0);
  assert.deepEqual(orderAt(empty, 0), []);
  assert.ok(traceStory(empty, []).length >= 1);
});
