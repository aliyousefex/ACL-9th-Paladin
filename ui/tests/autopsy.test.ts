import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { aftermath, autopsy, didNotFinish, ordinal } from "../src/features/race/autopsyModel.ts";
import { MIN_DELTA, explainMove, explainScore } from "../src/features/race/explain.ts";
import { THRESHOLD, contributions } from "../src/lib/model.ts";

const read = (path: string) => JSON.parse(readFileSync(new URL(path, import.meta.url), "utf8"));
const races = read("../src/data/races.json") as { id: number; year: number; slug: string; predicted: number[]; actual: number[]; baseline: number[]; hits: number; baselineHits: number }[];
const names = new Map((read("../src/data/drivers.json").drivers as { id: number; name: string }[]).map((d) => [d.id, d.name]));

interface Entry { d: number; x: (number | null)[]; p: number; pos: number | null; txt: string; status: string; laps: number | null }

/** Rows in the same shape the page builds from an exported race. */
function rowsFor(race: { id: number }) {
  const file = read(`../public/data/races/${race.id}.json`) as { entries: Entry[] };
  const rows = file.entries
    .map((entry) => ({ entry, driver: { id: entry.d, name: names.get(entry.d) ?? String(entry.d) }, score: entry.p, grid: entry.x[0] ?? null, rank: 0, finish: entry.pos, podium: entry.pos !== null && entry.pos <= 3 }))
    .sort((a, b) => b.score - a.score || a.driver.id - b.driver.id);
  rows.forEach((row, i) => (row.rank = i + 1));
  return { rows, entries: file.entries };
}
const all = races.map((race) => ({ race, ...rowsFor(race) }));
const run = (item: (typeof all)[number]) => autopsy(item.rows as never, item.race.baseline, THRESHOLD);

test("the autopsy agrees with the stored result for every held-out race", () => {
  for (const item of all) {
    const a = run(item);
    assert.equal(a.hits, item.race.hits, `${item.race.year} ${item.race.slug}: hits`);
    assert.equal(a.baselineHits, item.race.baselineHits, `${item.race.year} ${item.race.slug}: baseline hits`);
    assert.deepEqual(a.modelTop.map((c) => c.row.driver.id), item.race.predicted, "the model's top three is the stored prediction, in order");
    assert.deepEqual(a.podium.map((p) => p.row.driver.id).sort(), [...item.race.actual].sort(), "the podium is the stored podium");
    assert.deepEqual(a.podium.map((p) => p.finish), [1, 2, 3]);
  }
});

test("every podium finisher is either a hit or a miss, and every other top-three pick is a false alarm", () => {
  for (const item of all) {
    const a = run(item);
    assert.equal(a.modelTop.length, 3);
    const hits = a.modelTop.filter((c) => c.kind === "hit");
    const alarms = a.modelTop.filter((c) => c.kind === "false-alarm");
    assert.equal(hits.length + alarms.length, 3);
    assert.equal(hits.length + a.misses.length, a.podium.length, `${item.race.slug}: hits + misses cover the podium`);
    for (const c of hits) assert.ok(c.row.podium && c.modelRank <= 3);
    for (const c of alarms) assert.ok(!c.row.podium && c.modelRank <= 3);
    for (const c of a.misses) assert.ok(c.row.podium && c.modelRank > 3 && c.kind === "miss");
    for (let i = 1; i < a.misses.length; i++) assert.ok((a.misses[i - 1].finish ?? 0) < (a.misses[i].finish ?? 0), "misses are in finishing order");
    for (let i = 1; i < a.modelTop.length; i++) assert.ok(a.modelTop[i - 1].modelRank < a.modelTop[i].modelRank);
  }
});

test("the cutoff view counts the same drivers the result table marks as predicted to podium", () => {
  for (const item of all) {
    const a = run(item);
    const above = item.rows.filter((r) => r.score >= THRESHOLD);
    assert.equal(a.cutoff.above, above.length);
    assert.equal(a.cutoff.aboveOnPodium, above.filter((r) => r.podium).length);
    assert.equal(a.cutoff.podium, a.podium.length);
    assert.ok(a.cutoff.aboveOnPodium <= a.cutoff.above && a.cutoff.podiumAbove <= a.cutoff.podium);
    assert.equal(a.cutoff.threshold, THRESHOLD);
    // Both counts are views of the same table: podium finishers above the cutoff are exactly the above-cutoff drivers on the podium.
    assert.equal(a.cutoff.podiumAbove, a.cutoff.aboveOnPodium);
  }
});

test("reasons come from the model's own contributions and point the way the case says", () => {
  for (const item of all.slice(0, 30)) {
    const a = run(item);
    for (const c of [...a.modelTop, ...a.misses]) {
      assert.ok(c.reasons.length <= 2);
      const mine = contributions(c.row.entry.x);
      for (const reason of c.reasons) {
        assert.ok(Math.abs(reason.delta) >= MIN_DELTA);
        assert.ok(c.kind === "miss" ? reason.delta < 0 : reason.delta > 0, `${c.kind} reason points the wrong way`);
        const own = mine.find((m) => m.feature === reason.feature)!;
        const mean = item.rows.reduce((sum, r) => sum + contributions(r.entry.x).find((m) => m.feature === reason.feature)!.contribution, 0) / item.rows.length;
        assert.ok(Math.abs(reason.delta - (own.contribution - mean)) < 1e-12);
      }
      for (let i = 1; i < c.reasons.length; i++) assert.ok(Math.abs(c.reasons[i - 1].delta) >= Math.abs(c.reasons[i].delta));
    }
  }
});

test("explaining a score may cite the grid, unlike explaining a move away from it", () => {
  let cited = 0;
  for (const item of all) {
    const poleSitter = item.rows.find((r) => r.grid === 1)!;
    if (explainScore(poleSitter as never, item.rows as never, "up", 3).some((r) => r.feature === "grid_position")) cited++;
    assert.ok(!explainMove(poleSitter as never, item.rows as never, "up", 5).some((r) => r.feature === "grid_position"));
  }
  assert.ok(cited > 50, `grid cited for the pole sitter in ${cited} races`);
});

test("a retiree who was still classified is reported as a retirement, using the status field", () => {
  const bahrain = all.find((i) => i.race.year === 2022 && i.race.slug === "bahrain")!;
  const a = run(bahrain);
  const verstappen = a.modelTop.find((c) => c.row.driver.name === "Max Verstappen")!;
  assert.equal(verstappen.row.entry.txt, "19", "the dataset gives him a classified position");
  assert.equal(verstappen.didNotFinish, true);
  assert.match(verstappen.aftermath, /^Retired after 54 laps: Fuel pressure\. Classified P19 for the distance completed$/);
  assert.match(a.lines.join("\n"), /Two of Paladin's top three did not take the flag/);
  assert.match(a.lines.join("\n"), /None of the 16 inputs measures reliability, incidents or strategy/);
});

test("aftermath and didNotFinish handle every status string in the dataset", () => {
  const seen = new Map<string, number>();
  for (const { entries } of all) {
    for (const e of entries) {
      const text = aftermath(e);
      assert.ok(text.length > 0 && !/undefined|NaN|null/.test(text), `${e.txt}/${e.status}: ${text}`);
      seen.set(`${e.txt === "R" || e.txt === "D" || e.txt === "W" ? e.txt : "#"}|${e.status}`, 1);
      const finished = /^\d+$/.test(e.txt) && (e.status === "Finished" || /^\+\d+ Laps?$/.test(e.status));
      assert.equal(didNotFinish(e), !finished, `${e.txt}/${e.status}`);
    }
  }
  assert.ok(seen.size > 30, "the dataset has many distinct endings");
  assert.equal(aftermath({ txt: "7", status: "Finished", laps: 70 }), "Finished P7");
  assert.equal(aftermath({ txt: "13", status: "+1 Lap", laps: 69 }), "Finished P13, 1 lap down");
  assert.equal(aftermath({ txt: "16", status: "+2 Laps", laps: 68 }), "Finished P16, 2 laps down");
  assert.equal(aftermath({ txt: "R", status: "Engine", laps: 31 }), "Retired after 31 laps: Engine");
  assert.equal(aftermath({ txt: "R", status: "Collision", laps: 1 }), "Retired after 1 lap: Collision");
  assert.equal(aftermath({ txt: "R", status: "Retired", laps: 12 }), "Retired after 12 laps");
  assert.equal(aftermath({ txt: "R", status: "Accident", laps: 0 }), "Retired on the opening lap: Accident");
  assert.equal(aftermath({ txt: "D", status: "Disqualified", laps: 60 }), "Disqualified");
  assert.equal(aftermath({ txt: "W", status: "Withdrew", laps: null }), "Withdrew");
});

test("statements name their baseline, are well formed, and mention a retirement only when one happened", () => {
  for (const item of all) {
    const a = run(item);
    assert.ok(a.lines.length >= 3 && a.lines.length <= 4);
    assert.match(a.lines[0], /^Paladin's top three put \d of 3 on the podium\. The baseline, the first three grid slots, put \d of 3\. (Paladin did better than the grid here|The grid did better than Paladin here|Paladin and the grid tied)\.$/);
    assert.match(a.lines[1], /^The podium, by where Paladin ranked each driver before the start: the winner \d+(st|nd|rd|th), P2 \d+(st|nd|rd|th), P3 \d+(st|nd|rd|th)\.$/);
    assert.match(a.lines[2], /^Applying the 0\.625 cutoff to the whole field, \d+ drivers? (was|were) predicted to podium and \d+ of them did; \d of the 3 podium finishers scored above it\.$/);
    const retired = a.modelTop.filter((c) => c.didNotFinish).length;
    assert.equal(a.lines.some((l) => l.includes("did not take the flag")), retired > 0, `${item.race.year} ${item.race.slug}`);
    for (const line of a.lines) assert.ok(!/undefined|NaN/.test(line));
    // The verdict agrees with the numbers.
    const better = a.hits > a.baselineHits ? "Paladin did better" : a.hits < a.baselineHits ? "The grid did better" : "tied";
    assert.ok(a.lines[0].includes(better));
  }
});

test("ordinals", () => {
  assert.deepEqual([1, 2, 3, 4, 11, 12, 13, 21, 22, 23, 101, 111].map(ordinal), ["1st", "2nd", "3rd", "4th", "11th", "12th", "13th", "21st", "22nd", "23rd", "101st", "111th"]);
});
