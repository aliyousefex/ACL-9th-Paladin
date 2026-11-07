import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { test } from "node:test";
import {
  ASSISTS,
  DRAFT_RANGE,
  EMPTY_RECORD,
  MISTAKE_RATE,
  POINTS,
  PROFILE_BRAKE,
  TOP,
  addResult,
  brakeCue,
  buildTrack,
  classify,
  entrantsFrom,
  finishRace,
  gapSeconds,
  gridOrder,
  initialRace,
  isOver,
  mistakeAt,
  orderOf,
  outcomeFor,
  parseRecord,
  playerDone,
  pointsFor,
  ratingFor,
  retirePlayer,
  stepRace,
  tierOf,
  unit,
  type Entrant,
  type RaceConfig,
  type RaceState,
} from "../src/features/games/raceEngine.ts";

const read = (path: string) => JSON.parse(readFileSync(new URL(path, import.meta.url), "utf8"));
const races = read("../src/data/races.json") as { id: number; year: number; slug: string; layout: string | null }[];
const circuits = read("../src/data/circuits.json") as { layouts: { id: string; file: string | null }[] }[];
const drivers = new Map((read("../src/data/drivers.json").drivers as { id: number; code: string; name: string; last: string }[]).map((d) => [d.id, d]));
const samplesOf = (id: string): [number, number][] => read(`../public/data/circuits/${id}.json`).samples;
const layoutIds = circuits.flatMap((c) => c.layouts.filter((l) => l.file).map((l) => l.id)).filter((id) => samplesOf(id).length >= 25);

interface Entry { d: number; c: number; x: (number | null)[]; p: number; n: number | null; pos: number | null; txt: string; status: string }
function rowsFor(race: { id: number }, poison = false) {
  const file = read(`../public/data/races/${race.id}.json`) as { entries: Entry[] };
  return file.entries.map((entry) => ({
    driver: { id: entry.d, code: drivers.get(entry.d)!.code, name: drivers.get(entry.d)!.name, last: drivers.get(entry.d)!.last },
    team: { short: `T${entry.c}` },
    colour: "#fff",
    ink: "#000",
    score: entry.p,
    grid: entry.x[0] ?? null,
    entry: { n: entry.n },
    // Outcome fields the game must never read:
    finish: poison ? 777 : entry.pos,
    podium: poison ? true : entry.pos !== null && entry.pos <= 3,
    status: poison ? "SPOILER" : entry.status,
  }));
}
const playable = races.filter((r) => r.layout && existsSync(new URL(`../public/data/circuits/${r.layout}.json`, import.meta.url)) && samplesOf(r.layout).length >= 25);
const monaco = races.find((r) => r.year === 2023 && r.slug === "monaco")!;
const cfg = (over: Partial<RaceConfig> = {}): RaceConfig => ({ laps: 3, seed: 1, playerId: null, assist: "standard", ...over });
const solo = (rating: number, id = 1): Entrant => ({ id, code: "A", name: "A", last: "A", team: "T", colour: "#fff", ink: "#000", number: id, grid: null, score: rating, rating });
const raceOf = (race: { id: number; layout: string | null }, over: Partial<RaceConfig> = {}) => initialRace(entrantsFrom(rowsFor(race)), buildTrack(samplesOf(race.layout!)), cfg(over));

/* ------------------------------------------------------------------ track */

test("on every real circuit a lap takes between 12 and 30 seconds, and a higher rating is always faster", () => {
  assert.ok(layoutIds.length >= 25);
  for (const id of layoutIds) {
    const track = buildTrack(samplesOf(id));
    const lap = (rating: number) => {
      let s = initialRace([solo(rating)], track, cfg({ laps: 2 }));
      while (!isOver(s) && s.t < 300) s = stepRace(s, false, 0.05);
      return (s.cars[0].finishedAt as number) / 2;
    };
    const fast = lap(1);
    const slow = lap(0);
    assert.ok(fast > 12 && fast < 30 && slow > 12 && slow < 30, `${id}: ${fast.toFixed(1)}s / ${slow.toFixed(1)}s`);
    assert.ok(fast < slow, `${id}: rating does not change pace`);
  }
});

test("the rival speed profile never exceeds what the corners allow and always leaves room to brake", () => {
  for (const id of layoutIds.slice(0, 12)) {
    const track = buildTrack(samplesOf(id));
    const ds = 1 / track.n;
    for (let k = 0; k < track.n; k++) {
      assert.ok(track.profile[k] <= track.safe[k] + 1e-12, `${id}[${k}] above the safe speed`);
      assert.ok(track.safe[k] <= TOP + 1e-12 && track.profile[k] > 0);
      const next = track.profile[(k + 1) % track.n];
      assert.ok(track.profile[k] ** 2 <= next ** 2 + 2 * PROFILE_BRAKE * ds + 1e-9, `${id}[${k}] cannot brake in time for the next point`);
    }
  }
});

/* ------------------------------------------------------------------ determinism and variation */

test("the seeded hash is deterministic, in range, and spread out", () => {
  assert.equal(unit(5, 1, 2, 3), unit(5, 1, 2, 3));
  assert.notEqual(unit(5, 1, 2, 3), unit(5, 1, 2, 4));
  assert.notEqual(unit(5, 1, 2, 3), unit(6, 1, 2, 3));
  let sum = 0;
  const n = 20000;
  for (let i = 0; i < n; i++) {
    const u = unit(9, i, i * 7, 1);
    assert.ok(u >= 0 && u < 1);
    sum += u;
  }
  assert.ok(Math.abs(sum / n - 0.5) < 0.01, `mean ${sum / n}`);
});

test("driving errors happen at the stated rate, on a clean part of the lap, and never depend on call order", () => {
  let errors = 0;
  const total = 20 * 20 * 50;
  for (let seed = 1; seed <= 50; seed++) {
    for (let id = 1; id <= 20; id++) {
      for (let lap = 0; lap < 20; lap++) {
        const at = mistakeAt(seed, id, lap);
        if (at !== null) {
          errors++;
          assert.ok(at >= 0.1 && at <= 0.9);
        }
        assert.equal(mistakeAt(seed, id, lap), at);
      }
    }
  }
  assert.ok(Math.abs(errors / total - MISTAKE_RATE) < 0.01, `rate ${errors / total}`);
});

/* ------------------------------------------------------------------ ratings and entrants */

test("pace rating rises with the podium score, rises toward the front of the grid, and a pit-lane start counts as last", () => {
  for (let score = 0; score < 1; score += 0.1) assert.ok(ratingFor(score + 0.05, 5, 20) > ratingFor(score, 5, 20));
  for (let grid = 1; grid < 20; grid++) assert.ok(ratingFor(0.4, grid, 20) > ratingFor(0.4, grid + 1, 20));
  assert.equal(ratingFor(0.4, null, 20), ratingFor(0.4, 20, 20), "a pit-lane start rates the same as the last grid slot");
  assert.ok(ratingFor(0.4, null, 20) < ratingFor(0.4, 19, 20));
  for (const [score, grid] of [[1, 1], [0, 20], [0.5, null], [2, 1], [-1, 5]] as const) {
    const r = ratingFor(score, grid, 20);
    assert.ok(r >= 0 && r <= 1);
  }
  assert.ok(ratingFor(0.97, 1, 20) > 0.95);
  assert.ok(ratingFor(0.02, 20, 20) < 0.05);
});

test("entrants are built from pre-race fields only, so no outcome can reach the game", () => {
  for (const race of playable.slice(0, 20)) {
    const clean = entrantsFrom(rowsFor(race));
    const dirty = entrantsFrom(rowsFor(race, true));
    assert.deepEqual(dirty, clean, `${race.year} ${race.slug}`);
    for (const e of clean) assert.ok(e.rating >= 0 && e.rating <= 1 && Number.isFinite(e.score));
  }
});

test("a field is split into frontrunners, a midfield and backmarkers by rating", () => {
  const field = entrantsFrom(rowsFor(monaco));
  const tiers = field.map((e) => tierOf(e, field));
  const count = (t: string) => tiers.filter((x) => x === t).length;
  assert.equal(field.length, 20);
  assert.equal(count("Frontrunner"), 5);
  assert.equal(count("Backmarker"), 5);
  assert.equal(count("Midfield"), 10);
  const best = [...field].sort((a, b) => b.rating - a.rating)[0];
  assert.equal(tierOf(best, field), "Frontrunner");
});

/* ------------------------------------------------------------------ grid */

test("cars start behind the line in grid order, with pit-lane starters last", () => {
  for (const race of playable) {
    const state = raceOf(race);
    const order = gridOrder(state.entrants);
    assert.equal(new Set(order).size, state.entrants.length);
    const starts = order.map((i) => state.cars[i].s);
    for (let i = 0; i < starts.length; i++) assert.ok(starts[i] < 0, "behind the line");
    for (let i = 1; i < starts.length; i++) assert.ok(starts[i] < starts[i - 1], "each slot is further back");
    const pit = state.entrants.map((e, i) => (e.grid === null ? i : -1)).filter((i) => i >= 0);
    for (const i of pit) assert.ok(order.indexOf(i) >= order.length - pit.length, "pit-lane starters are at the back");
    assert.deepEqual(orderOf(state).map((i) => state.entrants[i].id), order.map((i) => state.entrants[i].id), "the running order at lights out is the grid");
  }
});

/* ------------------------------------------------------------------ whole races */

test("a race is fully deterministic for a seed and different for another", () => {
  const a = classify(finishRace(raceOf(monaco, { seed: 11 })));
  const b = classify(finishRace(raceOf(monaco, { seed: 11 })));
  assert.deepEqual(a.map((c) => [c.entrant.id, c.time]), b.map((c) => [c.entrant.id, c.time]));
  const c = classify(finishRace(raceOf(monaco, { seed: 12 })));
  assert.notDeepEqual(a.map((x) => x.time), c.map((x) => x.time));
});

test("every car finishes, positions are 1 to N once, times only increase, and points follow the scoring table", () => {
  for (const race of playable.filter((_, i) => i % 7 === 0)) {
    const result = classify(finishRace(raceOf(race, { seed: 3 })));
    assert.ok(result.length >= 18 && result.length <= 22);
    assert.deepEqual(result.map((c) => c.position), result.map((_, i) => i + 1));
    assert.ok(result.every((c) => c.finished && c.time !== null && c.lapsDown === 0));
    for (let i = 1; i < result.length; i++) assert.ok((result[i].time as number) >= (result[i - 1].time as number));
    assert.equal(result[0].gap, 0);
    assert.ok(result.every((c) => (c.gap as number) >= 0));
    assert.deepEqual(result.slice(0, 10).map((c) => c.points), [...POINTS]);
    assert.ok(result.slice(10).every((c) => c.points === 0));
  }
  assert.equal(POINTS.reduce((a, b) => a + b, 0), 101);
  assert.equal(pointsFor(1), 25);
  assert.equal(pointsFor(10), 1);
  assert.equal(pointsFor(11), 0);
  assert.equal(pointsFor(0), 0);
});

test("distance only ever increases, and a finished car stays on the line", () => {
  let state = raceOf(monaco, { seed: 5, laps: 2 });
  const before = state.cars.map((c) => c.s);
  for (let step = 0; step < 2000 && !isOver(state); step++) {
    state = stepRace(state, false, 0.05);
    state.cars.forEach((c, i) => {
      assert.ok(c.s >= before[i], "no car goes backwards");
      assert.ok(c.s <= 2 + 1e-12, "no car passes the finish distance");
      before[i] = c.s;
    });
  }
  assert.ok(isOver(state));
});

test("the fastest cars win more often, but not every time: pace is the field's rating, with seeded errors", () => {
  let top5 = 0;
  let spearman = 0;
  let different = new Set<number>();
  for (const race of playable) {
    const result = classify(finishRace(raceOf(race, { seed: 1 })));
    const byRating = [...result].sort((a, b) => b.entrant.rating - a.entrant.rating);
    if (byRating.slice(0, 5).some((c) => c.position === 1)) top5++;
    const n = result.length;
    const d2 = result.reduce((sum, c) => sum + (c.position - (byRating.indexOf(c) + 1)) ** 2, 0);
    spearman += 1 - (6 * d2) / (n * (n * n - 1));
    different.add(result[0].entrant.id);
  }
  assert.ok(top5 / playable.length >= 0.9, `winner among the five fastest in ${top5} of ${playable.length}`);
  assert.ok(spearman / playable.length > 0.7, `rank correlation ${spearman / playable.length}`);
  assert.ok(different.size >= 3, `only ${different.size} different winners across ${playable.length} races`);
});

test("a seed produces real variety: the winner changes between seeds on the same race", () => {
  const winners = new Set<number>();
  for (let seed = 1; seed <= 40; seed++) winners.add(classify(finishRace(raceOf(monaco, { seed })))[0].entrant.id);
  assert.ok(winners.size >= 2, `only ${winners.size} distinct winner over 40 seeds`);
});

/* ------------------------------------------------------------------ slipstream */

test("a car close behind another is pulled along, and one that is alone is not", () => {
  const straight: [number, number][] = Array.from({ length: 300 }, (_, i) => [i * 3, 0]);
  const track = buildTrack(straight);
  const pair = [solo(1, 1), solo(1, 2)];
  let together = initialRace(pair, track, cfg({ laps: 10 }));
  together = { ...together, cars: [{ ...together.cars[0], s: 0.2, v: 0.06 }, { ...together.cars[1], s: 0.2 + DRAFT_RANGE / 3, v: 0.06 }] };
  let alone = initialRace([pair[0]], track, cfg({ laps: 10 }));
  alone = { ...alone, cars: [{ ...alone.cars[0], s: 0.2, v: 0.06 }] };
  for (let i = 0; i < 40; i++) {
    together = stepRace(together, false, 0.05);
    alone = stepRace(alone, false, 0.05);
  }
  assert.ok(together.cars[0].v > alone.cars[0].v + 1e-6, "the follower is faster than the same car alone");
  assert.ok(together.cars[0].v > together.cars[1].v, "and faster than the car it follows");
});

/* ------------------------------------------------------------------ the player */

function drive(race: { id: number; layout: string | null }, assist: "assisted" | "standard" | "hard", control: (s: RaceState) => boolean, playerId: number, seed = 1) {
  let state = raceOf(race, { assist, playerId, seed });
  let guard = 0;
  while (!playerDone(state) && guard++ < 20000) state = stepRace(state, control(state), 0.05);
  const i = state.entrants.findIndex((e) => e.id === playerId);
  return { state, car: state.cars[i], time: state.cars[i].finishedAt as number };
}
const always = () => true;
/** A near-perfect driver: accelerates only while below the speed the rivals' own braking profile allows at this point. */
const careful = (state: RaceState) => {
  const i = state.entrants.findIndex((e) => e.id === state.config.playerId);
  const car = state.cars[i];
  const track = state.track;
  const idx = Math.min(track.n - 1, Math.floor((car.s - Math.floor(car.s)) * track.n));
  // Looks a few samples ahead, because the braking has to start before the corner does.
  const limit = Math.min(...[0, 1, 2, 3].map((k) => track.profile[(idx + k) % track.n]));
  return car.v < limit * 0.985 || car.s < 0.02;
};

test("assisted driving never runs wide, and flat out through the corners is only possible with the assist", () => {
  const player = entrantsFrom(rowsFor(monaco))[3].id;
  const assisted = drive(monaco, "assisted", always, player);
  assert.equal(assisted.car.incidents, 0);
  assert.ok(Number.isFinite(assisted.time));
  const standard = drive(monaco, "standard", always, player);
  assert.ok(standard.car.incidents > 5, `${standard.car.incidents} incidents flat out on Monaco`);
  assert.ok(standard.time > assisted.time, "running wide costs time");
  const hard = drive(monaco, "hard", always, player);
  assert.ok(hard.car.incidents >= standard.car.incidents, "less margin, at least as many incidents");
});

test("a careful driver without the assist is clean and quicker than flat out", () => {
  const player = entrantsFrom(rowsFor(monaco))[3].id;
  const flat = drive(monaco, "standard", always, player);
  const clean = drive(monaco, "standard", careful, player);
  assert.ok(clean.car.incidents <= 1, `${clean.car.incidents} incidents`);
  assert.ok(clean.time < flat.time, "braking for corners beats not braking");
});

test("incidents are spaced out by the cooldown and announced once each", () => {
  const player = entrantsFrom(rowsFor(monaco))[0].id;
  let state = raceOf(monaco, { assist: "standard", playerId: player, seed: 2 });
  const incidentAt: number[] = [];
  let announced = 0;
  const i = state.entrants.findIndex((e) => e.id === player);
  for (let k = 0; k < 20000 && !playerDone(state); k++) {
    state = stepRace(state, true, 0.05);
    for (const e of state.events) if (e.kind === "incident") { announced++; incidentAt.push(state.cars[i].s); }
  }
  assert.equal(announced, state.cars[i].incidents);
  for (let k = 1; k < incidentAt.length; k++) assert.ok(incidentAt[k] - incidentAt[k - 1] > 0.04, "cooldown respected");
});

test("holding no throttle leaves the player last, and retiring classifies them last without points", () => {
  const field = entrantsFrom(rowsFor(monaco));
  const player = field[0].id;
  let state = raceOf(monaco, { playerId: player, seed: 4 });
  for (let k = 0; k < 400; k++) state = stepRace(state, false, 0.05);
  assert.equal(orderOf(state).at(-1), state.entrants.findIndex((e) => e.id === player));
  const retired = classify(finishRace(retirePlayer(state)));
  const me = retired.find((c) => c.entrant.id === player)!;
  assert.equal(me.retired, true);
  assert.equal(me.position, 20);
  assert.equal(me.points, 0);
  assert.equal(me.finished, false);
  assert.equal(retired.filter((c) => c.finished).length, 19);
  assert.deepEqual(retired.slice(0, 10).map((c) => c.points), [...POINTS], "the rest of the field is still scored");
});

/* ------------------------------------------------------------------ outcomes, readouts, record */

test("the finish is described from the classification: win, podium, points, outside, retired", () => {
  const result = classify(finishRace(raceOf(monaco, { seed: 6 })));
  const at = (p: number) => result[p - 1];
  assert.equal(outcomeFor(at(1), 20).kind, "win");
  assert.match(outcomeFor(at(1), 20).headline, /Victory/);
  assert.equal(outcomeFor(at(3), 20).kind, "podium");
  assert.equal(outcomeFor(at(7), 20).kind, "points");
  assert.match(outcomeFor(at(7), 20).detail, /worth 6 points/);
  assert.equal(outcomeFor(at(15), 20).kind, "outside");
  assert.equal(outcomeFor({ ...at(5), retired: true }, 20).kind, "retired");
  assert.match(outcomeFor({ ...at(4), gained: 3, points: 12 }, 20).detail, /gained 3 places/);
  assert.match(outcomeFor({ ...at(4), gained: 1, points: 12 }, 20).detail, /gained 1 place from/);
  assert.match(outcomeFor({ ...at(4), gained: -2, points: 12 }, 20).detail, /lost 2 places/);
  assert.match(outcomeFor({ ...at(4), gained: 0, points: 12 }, 20).detail, /finished where you started/);
  assert.match(outcomeFor({ ...at(4), gained: null, points: 12 }, 20).detail, /pit lane/);
});

test("places gained are measured against the grid slot, and the grid leader cannot gain", () => {
  const result = classify(finishRace(raceOf(monaco, { seed: 6 })));
  for (const c of result) if (c.gained !== null) assert.equal(c.gained, (gridOrder(entrantsFrom(rowsFor(monaco))).findIndex((i) => entrantsFrom(rowsFor(monaco))[i].id === c.entrant.id) + 1) - c.position);
  assert.equal(result.reduce((sum, c) => sum + (c.gained ?? 0), 0), 0, "places gained and lost cancel");
});

test("gap readout and the braking cue follow speed and the corners ahead", () => {
  const state = raceOf(monaco, { seed: 1 });
  const fast = { ...state, cars: state.cars.map((c, i) => (i === 0 ? { ...c, s: 0.5, v: 0.06 } : i === 1 ? { ...c, s: 0.53, v: 0.06 } : c)) };
  assert.ok(Math.abs(gapSeconds(fast, 0, 1) - 0.03 / 0.06) < 1e-9);
  assert.equal(brakeCue(state.track, 0.3, 0), false, "standing still is never too fast");
  const hot = state.track.safe.findIndex((v, k) => state.track.curvature[k] > 0.5 && v < 0.05);
  assert.ok(hot > 0);
  assert.equal(brakeCue(state.track, hot / state.track.n - 0.03, 0.07), true, "arriving at a tight corner flat out calls for braking");
  assert.equal(brakeCue(state.track, hot / state.track.n - 0.03, 0.01), false, "slow enough: no cue");
  assert.ok(ASSISTS.assisted.tolerance === Infinity && ASSISTS.standard.tolerance > ASSISTS.hard.tolerance);
});

test("the saved record only trusts well-formed numbers and keeps the best finish per race", () => {
  assert.deepEqual(parseRecord(null), EMPTY_RECORD);
  assert.deepEqual(parseRecord("not json"), EMPTY_RECORD);
  assert.deepEqual(parseRecord('{"races":-1,"wins":0,"podiums":0,"points":0,"best":{}}'), EMPTY_RECORD);
  assert.deepEqual(parseRecord('{"races":1.5,"wins":0,"podiums":0,"points":0,"best":{}}'), EMPTY_RECORD);
  assert.deepEqual(parseRecord('{"races":1,"wins":0,"podiums":0,"points":0,"best":null}'), EMPTY_RECORD);
  assert.deepEqual(parseRecord('{"races":2,"wins":1,"podiums":2,"points":43,"best":{"1074":1,"x":3,"1075":0,"1076":"2"}}'), { races: 2, wins: 1, podiums: 2, points: 43, best: { "1074": 1 } });
  let r = addResult(EMPTY_RECORD, 1074, 5, 10);
  assert.deepEqual(r, { races: 1, wins: 0, podiums: 0, points: 10, best: { "1074": 5 } });
  r = addResult(r, 1074, 2, 18);
  r = addResult(r, 1074, 9, 2);
  r = addResult(r, 1080, 1, 25);
  assert.deepEqual(r, { races: 4, wins: 1, podiums: 2, points: 55, best: { "1074": 2, "1080": 1 } });
  assert.equal(EMPTY_RECORD.races, 0, "the shared empty record is never modified");
});
