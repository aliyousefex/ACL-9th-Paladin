import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import {
  GRID_TURN,
  KERB_TURN,
  MIN_CROSSING_SIN,
  MIN_GRID_ROWS,
  MIN_SAMPLES,
  STRAIGHT_TURN,
  circuitDetail,
  findCrossings,
  gridRows,
  nearestSample,
  offsetPath,
  signedTurnAt,
  turnAt,
  wornLine,
} from "../src/lib/mapDetail.ts";

const read = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8");
const close = (a: number, b: number, eps = 1e-6) => assert.ok(Math.abs(a - b) <= eps, `${a} is not within ${eps} of ${b}`);

/**
 * A stadium: a top straight east, a tight bend, a bottom straight west, a tight bend back to the start. 360 samples, like the
 * real layouts, so the thresholds behave as they do on data.
 */
function stadium(): [number, number][] {
  const points: [number, number][] = [];
  for (let i = 0; i < 150; i++) points.push([(200 * i) / 150, 0]);
  for (let i = 0; i < 30; i++) {
    const a = -Math.PI / 2 + (Math.PI * i) / 30;
    points.push([200 + 50 * Math.cos(a), 50 + 50 * Math.sin(a)]);
  }
  for (let i = 0; i < 150; i++) points.push([200 - (200 * i) / 150, 100]);
  for (let i = 0; i < 30; i++) {
    const a = Math.PI / 2 + (Math.PI * i) / 30;
    points.push([50 * Math.cos(a), 50 + 50 * Math.sin(a)]);
  }
  return points;
}

test("kerbs go on the two bends of a stadium and chevrons only on its straights", () => {
  const { kerbs, chevrons } = circuitDetail(stadium());
  assert.equal(kerbs.length, 2, "one run of kerb per bend");
  for (const k of kerbs) {
    assert.ok(k.points.length >= 3, "a polyline");
    assert.equal(k.side, 1, "the stadium runs clockwise on screen, so both bends turn right and the inside is on the right");
  }
  assert.ok(chevrons.length >= 6, `chevrons on the straights, got ${chevrons.length}`);
  for (const c of chevrons) {
    const top = Math.abs(c.y) < 0.5;
    const bottom = Math.abs(c.y - 100) < 0.5;
    assert.ok(top || bottom, `a chevron at y=${c.y} is not on a straight`);
    // pointing the way the lap runs: east along the top, west along the bottom
    if (top) close(c.angle, 0);
    else close(Math.abs(c.angle), 180);
  }
});

test("a gentle loop with no sharp turn and no straight gets neither kerbs nor chevrons", () => {
  // 120 samples: each turns 4 x 2pi/120 = 0.21 rad over the span, between "straight" (0.1) and "sharp" (0.4)
  const circle: [number, number][] = Array.from({ length: 120 }, (_, i) => [100 * Math.cos((i / 120) * 2 * Math.PI), 100 * Math.sin((i / 120) * 2 * Math.PI)]);
  const turns = turnAt(circle);
  assert.ok(turns.every((t) => t < KERB_TURN && t > STRAIGHT_TURN), "every sample turns a little, never sharply and never straight");
  const { kerbs, chevrons } = circuitDetail(circle);
  assert.deepEqual(kerbs, []);
  assert.deepEqual(chevrons, []);
});

test("an outline too short to read draws no detail, and marks still work", () => {
  for (const n of [0, 1, MIN_SAMPLES - 1]) {
    const samples = stadium().slice(0, n);
    const detail = circuitDetail(samples);
    assert.deepEqual(detail.kerbs, []);
    assert.deepEqual(detail.chevrons, []);
    const mark = detail.at(0.5);
    assert.ok(Number.isFinite(mark.x) && Number.isFinite(mark.y) && Number.isFinite(mark.angle), "a mark is always a real position");
  }
});

test("a position along the lap wraps round the start line and points the way the lap runs", () => {
  const samples = stadium();
  const { at } = circuitDetail(samples);
  const start = at(0);
  close(start.x, samples[0][0]);
  close(start.y, samples[0][1]);
  const lap = at(1);
  close(lap.x, start.x);
  close(lap.y, start.y);
  const back = at(-0.25);
  const same = at(0.75);
  close(back.x, same.x);
  close(back.y, same.y);
  // a quarter of the way is on the top straight, which runs east; three quarters is on the bottom, which runs west
  close(at(0.2).angle, 0);
  close(Math.abs(at(0.65).angle), 180);
});

test("detail is a pure function of the outline", () => {
  const a = circuitDetail(stadium());
  const b = circuitDetail(stadium());
  assert.deepEqual(a.kerbs, b.kerbs);
  assert.deepEqual(a.chevrons, b.chevrons);
  assert.deepEqual(a.crossings, b.crossings);
  assert.equal(wornLine(stadium(), 4), wornLine(stadium(), 4));
});

// ---- which side a turn is on, and where the kerb, the worn line and the bridge go --------------------------------------------

/** A circle run clockwise on screen (y runs down), or the other way. */
const circle = (clockwise: boolean): [number, number][] =>
  Array.from({ length: 360 }, (_, i) => {
    const a = ((clockwise ? i : -i) / 360) * 2 * Math.PI;
    return [200 + 100 * Math.cos(a), 200 + 100 * Math.sin(a)];
  });

test("a turn to the right is positive and to the left is negative, and shifting a path by a positive amount moves it to the right", () => {
  assert.ok(signedTurnAt(circle(true)).every((t) => t > 0), "clockwise on screen turns right");
  assert.ok(signedTurnAt(circle(false)).every((t) => t < 0), "anticlockwise turns left");
  // heading east, the right-hand side is down the screen
  const east = offsetPath([[0, 0], [10, 0], [20, 0]], 5);
  assert.equal(east, "M0.0 5.0L10.0 5.0L20.0 5.0");
  assert.equal(offsetPath([[0, 0], [10, 0], [20, 0]], -5), "M0.0 -5.0L10.0 -5.0L20.0 -5.0");
  assert.equal(offsetPath([[1, 1]], 3), "", "one point is not a path");
});

/** The points of a path written as `M x y L x y ...`. */
const parse = (d: string): [number, number][] =>
  d
    .replace(/Z$/, "")
    .split(/(?=[ML])/)
    .map((piece) => piece.slice(1).split(" ").map(Number) as [number, number]);

test("kerbs sit on the inside of every bend, whichever way the circuit runs", () => {
  for (const flip of [false, true]) {
    const samples = stadium().map(([x, y]): [number, number] => [x, flip ? 100 - y : y]);
    const { kerbs } = circuitDetail(samples);
    assert.equal(kerbs.length, 2);
    for (const kerb of kerbs) {
      // the bends are half circles about (200, 50) and (0, 50), whichever way up the stadium is
      const right = kerb.points.reduce((sum, p) => sum + p[0], 0) / kerb.points.length > 100;
      const centre: [number, number] = right ? [200, 50] : [0, 50];
      const moved = parse(offsetPath(kerb.points, kerb.side * 4));
      assert.equal(moved.length, kerb.points.length);
      kerb.points.forEach((p, i) => {
        const before = Math.hypot(p[0] - centre[0], p[1] - centre[1]);
        const after = Math.hypot(moved[i][0] - centre[0], moved[i][1] - centre[1]);
        assert.ok(after < before - 2, `flip=${flip}: point ${i} moved from ${before.toFixed(1)} to ${after.toFixed(1)} from its bend's centre, not inwards`);
      });
    }
  }
});

test("a chicane puts a kerb on each side, and every real circuit has kerbs on both", () => {
  for (const { name, data } of layouts.filter((l) => (l.data.samples?.length ?? 0) >= MIN_SAMPLES)) {
    const sides = new Set(circuitDetail(data.samples).kerbs.map((k) => k.side));
    assert.deepEqual([...sides].sort(), [-1, 1], `${name} has left- and right-hand corners`);
  }
});

test("the worn line hugs the inside of a bend and sits in the middle of a straight", () => {
  const samples = stadium();
  const path = wornLine(samples, 4);
  const points = parse(path);
  assert.equal(points.length, samples.length, "one point for each sample");
  // mid-straight: no sideways shift
  close(points[75][1], 0, 0.6);
  close(points[255][1], 100, 0.6);
  // the apex of the right-hand bend (sample 165, on a circle of radius 50 about (200, 50)): nearer the centre than the track's own line
  const apex = Math.hypot(points[165][0] - 200, points[165][1] - 50);
  assert.ok(apex < 49, `the line is ${apex.toFixed(1)} from the bend's centre; the track's own line is 50`);
  assert.ok(apex > 50 - 4.01, "and never further in than its reach");
  assert.equal(wornLine(samples.slice(0, MIN_SAMPLES - 1), 4), "", "an outline too short to read has no line");
});

test("the worn line leaves out the stretches it is told to, and draws the rest as separate pieces", () => {
  const samples = stadium();
  assert.ok(!wornLine(samples, 4).includes("M", 1), "no gaps: one closed line");
  const gapped = wornLine(samples, 4, [[0.1, 0.2]]);
  assert.equal((gapped.match(/M/g) ?? []).length, 1, "a gap opens the loop into one piece");
  const both = wornLine(samples, 4, [[0.1, 0.2], [0.6, 0.7]]);
  assert.equal((both.match(/M/g) ?? []).length, 2, "two gaps leave two pieces");
  const wrap = wornLine(samples, 4, [[0.95, 0.05]]);
  assert.equal((wrap.match(/M/g) ?? []).length, 1, "a gap across the start line is one gap");
  assert.equal(wornLine(samples, 4, [[0, 1]]), "", "all of it left out is nothing");
  // the points in the gap are not in the path
  const drawn = new Set(gapped.split(/[ML]/).filter(Boolean));
  const dropped = samples.slice(36, 71).map(([x, y]) => `${x.toFixed(1)} ${y.toFixed(1)}`);
  assert.ok(dropped.every((p) => !drawn.has(p)), "nothing from inside the gap is drawn");
  assert.ok(drawn.has(`${samples[100][0].toFixed(1)} 0.0`), "and what is outside it still is");
});

test("a lap that crosses itself has one crossing, with the later pass over the earlier, and a plain loop has none", () => {
  assert.deepEqual(findCrossings(stadium()), []);
  assert.deepEqual(findCrossings(circle(true)), []);
  // a figure of eight, crossing square on at the middle
  const eight: [number, number][] = Array.from({ length: 360 }, (_, i) => {
    const t = ((i + 0.37) / 360) * 2 * Math.PI;
    return [100 * Math.cos(t) + 100, 50 * Math.sin(2 * t) + 50];
  });
  const found = findCrossings(eight);
  assert.equal(found.length, 1);
  assert.ok(found[0].under < found[0].over, "the later pass is the one that goes over");
  close(found[0].under, 0.25, 0.02);
  close(found[0].over, 0.75, 0.02);
  assert.ok(found[0].sin > 0.7, `crossing at ${found[0].sin}`);
  assert.deepEqual(circuitDetail(eight).crossings.length, 1);
  // the same figure with the crossing exactly on two samples is still found, once
  const exact: [number, number][] = Array.from({ length: 360 }, (_, i) => [100 * Math.cos((i / 360) * 2 * Math.PI) + 100, 50 * Math.sin((2 * i / 360) * 2 * Math.PI) + 50]);
  assert.equal(findCrossings(exact).length, 1);
});

test("a graze is not a crossing, so a stretch that doubles back on itself gets no bridge", () => {
  const leg = (from: [number, number], to: [number, number], count: number) =>
    Array.from({ length: count }, (_, i): [number, number] => [from[0] + ((to[0] - from[0]) * i) / count, from[1] + ((to[1] - from[1]) * i) / count]);
  // out along y = 0, a hairpin, and back along a line that cuts the way out at a shallow angle (far = 8) or a steep one (far = 60)
  const doubleBack = (far: number) => [...leg([0, 0], [100, 0], 40), ...leg([100, 0], [100, far], 10), ...leg([100, far], [0, -far / 5], 40), ...leg([0, -far / 5], [0, 0], 10)];
  assert.deepEqual(findCrossings(doubleBack(8)), [], "a crossing at about 6 degrees is one stretch doubling back");
  const steep = findCrossings(doubleBack(60));
  assert.equal(steep.length, 1);
  assert.ok(steep[0].sin >= MIN_CROSSING_SIN);
});

test("only Suzuka crosses itself, and there the later pass (the back straight) is the one that goes over", () => {
  for (const { name, data } of layouts.filter((l) => (l.data.samples?.length ?? 0) >= MIN_SAMPLES)) {
    const { crossings } = circuitDetail(data.samples);
    if (name.startsWith("suzuka/")) {
      assert.equal(crossings.length, 1, name);
      assert.ok(crossings[0].over > crossings[0].under && crossings[0].sin > 0.5, name);
    } else assert.equal(crossings.length, 0, `${name} does not cross itself`);
  }
});

test("the starting grid runs back from the line along the straight, row by row, and stops where the track bends", () => {
  const samples = stadium();
  const rows = gridRows(samples, 100, 10, 10);
  assert.equal(rows.length, 10);
  rows.forEach((row, k) => {
    close(row.x, samples[100][0] - (k + 1) * 10, 1e-6);
    close(row.y, 0);
    close(row.angle, 0);
  });
  const short = gridRows(samples, 20, 10, 10);
  assert.ok(short.length >= 2 && short.length < 10, `a short straight holds ${short.length} rows`);
  assert.deepEqual(gridRows(samples, -1, 10, 10), [], "no start, no grid");
  assert.deepEqual(gridRows(samples, 100, 10, 0), [], "rows no distance apart are not rows");
  assert.deepEqual(gridRows(samples.slice(0, MIN_SAMPLES - 1), 10, 10, 10), []);
  // GRID_TURN is a little looser than the chevrons' idea of straight, because a pit straight may bend
  assert.ok(GRID_TURN > STRAIGHT_TURN && GRID_TURN < KERB_TURN);
});

test("every real circuit's start grid lies on the map, and the big ones have room for a proper grid", () => {
  const withStart = layouts.filter((l) => (l.data.samples?.length ?? 0) >= MIN_SAMPLES && l.data.start);
  let full = 0;
  for (const { name, data } of withStart) {
    const start = data.start!;
    const from = nearestSample(data.samples, start.x, start.y);
    assert.ok(Math.hypot(data.samples[from][0] - start.x, data.samples[from][1] - start.y) < 3, `${name}: the start is on the outline`);
    const rows = gridRows(data.samples, from, 10, 11);
    const [w, h] = data.viewBox;
    for (const r of rows) assert.ok(r.x >= 0 && r.x <= w && r.y >= 0 && r.y <= h, `${name}: a grid row is off the map`);
    if (rows.length >= MIN_GRID_ROWS) full++;
  }
  assert.ok(full >= withStart.length * 0.8, `${full} of ${withStart.length} circuits have a grid`);
});

// ---- the real circuits -------------------------------------------------------------------------------------------------------

interface Layout {
  viewBox: [number, number];
  samples: [number, number][];
}
const circuits = JSON.parse(read("../src/data/circuits.json")) as { ref: string; layouts: { id: string; file: string | null; turns: number | null }[] }[];
const layouts = circuits.flatMap((c) => c.layouts.filter((l) => l.file).map((l) => ({ name: `${c.ref}/${l.id}`, turns: l.turns, data: JSON.parse(read(`../public/data/${l.file}`)) as Layout })));

test("every shipped circuit with a sampled outline gets kerbs on a believable number of its corners", () => {
  const sampled = layouts.filter((l) => (l.data.samples?.length ?? 0) >= MIN_SAMPLES);
  assert.ok(sampled.length >= 25, `expected the sampled circuits, got ${sampled.length}`);
  for (const { name, turns, data } of sampled) {
    const { kerbs } = circuitDetail(data.samples);
    assert.ok(kerbs.length >= 5, `${name}: ${kerbs.length} runs of kerb is too few for a circuit`);
    // runs merge where corners are linked (esses), so there are never more runs than corners; this never invents a corner
    if (turns) assert.ok(kerbs.length <= turns, `${name}: ${kerbs.length} runs of kerb for ${turns} corners`);
  }
});

test("chevrons are about a dozen to the lap, inside the map, and never where the line is turning", () => {
  for (const { name, data } of layouts.filter((l) => (l.data.samples?.length ?? 0) >= MIN_SAMPLES)) {
    const { chevrons } = circuitDetail(data.samples);
    assert.ok(chevrons.length >= 8 && chevrons.length <= 12, `${name}: ${chevrons.length} chevrons`);
    const [w, h] = data.viewBox;
    for (const c of chevrons) {
      assert.ok(c.x >= 0 && c.x <= w && c.y >= 0 && c.y <= h, `${name}: a chevron at ${c.x},${c.y} is off the map`);
      assert.ok(c.angle > -180.0001 && c.angle <= 180.0001, `${name}: angle ${c.angle}`);
    }
  }
});

test("outline-only circuits, which have no samples, get no invented kerbs or chevrons", () => {
  const bare = layouts.filter((l) => !l.data.samples || l.data.samples.length < MIN_SAMPLES);
  assert.ok(bare.length >= 1, "the outline-only layouts are still shipped");
  for (const { name, data } of bare) {
    const { kerbs, chevrons } = circuitDetail(data.samples ?? []);
    assert.deepEqual([kerbs, chevrons], [[], []], name);
  }
});

// ---- how the map and the car are drawn ---------------------------------------------------------------------------------------

test("the map's filters cover the whole map, so a blurred or grained stroke is never clipped to the centre line", () => {
  const source = read("../src/components/CircuitMap.tsx");
  const filters = source.match(/<filter\b[^>]*>/g) ?? [];
  assert.ok(filters.length >= 2, "the soft shadow and the asphalt grain");
  for (const f of filters) {
    // a filter region defaults to the bounding box of the path's geometry, which excludes the stroke
    assert.match(f, /filterUnits="userSpaceOnUse"/, f);
  }
});

test("kerbs, chevrons, the grid and grain are for the detailed map only; thumbnails stay plain", () => {
  const source = read("../src/components/CircuitMap.tsx");
  assert.match(source, /const fine = weight < 1\.6/, "thumbnails (a heavier weight) are the plain map");
  assert.match(source, /\{fine &&\s*\(\s*<g[^>]*data-map-kerbs/, "kerbs are on the detailed map, and sit on the inside edge so the sector colours around them still read");
  assert.match(source, /kerb\.side \* kerbAt/, "each kerb is shifted to the inside of its own turn");
  assert.match(source, /startLine && fine &&\s*\(\s*<g[^>]*data-map-chevrons/);
  assert.match(source, /fine \? `url\(#\$\{uid\}-grain\)`/, "grain only on the detailed map");
  assert.match(source, /useId\(\)/, "filter ids are unique per map, so two maps on a page never share one");
});

test("the map is a track, not a road: no painted centre line, and the kerbs, bridge, worn line and grid are all drawn", () => {
  const source = read("../src/components/CircuitMap.tsx");
  assert.doesNotMatch(source, /faint racing line/, "a circuit has no dashed centre line");
  assert.doesNotMatch(source, /strokeDasharray=\{`\$\{7 \* weight\} \$\{9 \* weight\}`\}/, "the old dashed line is gone");
  for (const part of ["data-map-kerbs", "data-map-bridge", "data-map-worn", "data-map-grid", "data-map-chevrons"]) assert.match(source, new RegExp(part), part);
  assert.match(source, /<mask\b[^>]*maskUnits="userSpaceOnUse"/, "a mask, like a filter, defaults to the path's own box and would clip a wide track");
  assert.match(source, /mask=\{`url\(#\$\{uid\}-under-\$\{i\}\)`\}/, "the bridge's shadow is masked to the track beneath it, so it never smudges the ground beside it");
  assert.match(source, /MIN_GRID_ROWS/, "a grid too short to be a grid is not drawn");
});

test("layers go down in an order that keeps a bridge honest: kerbs under the deck, the worn line and DRS over it", () => {
  const source = read("../src/components/CircuitMap.tsx");
  const order = ["{road()}", "data-map-kerbs", "data-map-bridge", "data-map-worn", "{drs &&", "data-map-chevrons"].map((marker) => source.indexOf(marker));
  assert.ok(order.every((at) => at >= 0), `a layer is missing: ${order}`);
  assert.deepEqual([...order].sort((a, b) => a - b), order, "the kerb of the track beneath must be covered by the deck, and the worn line must be left off the deck where it runs under it");
  assert.match(source, /wornLine\(layout\.samples, asphalt \* 0\.46, bridges\.map\(\(b\) => b\.under\)\)/, "the worn line is left out where the deck covers it");
});

test("each car gets its own gradient ids, so many cars on one map never share one", () => {
  const source = read("../src/components/VectorRaceCar.tsx");
  assert.match(source, /useId\(\)/);
  assert.match(source, /fill=\{`url\(#\$\{id\}-body\)`\}/, "the body is shaded with its own gradient");
  assert.doesNotMatch(source, /id="[a-z-]+"/, "no fixed gradient id that two cars would share");
});

test("the detail fades in after the track draws, and not at all with reduced motion", () => {
  const css = read("../src/index.css");
  assert.match(css, /\.map-in\s*\{[^}]*animation:\s*map-in\b/);
  const reduced = css.match(/@media \(prefers-reduced-motion: reduce\)\s*\{[\s\S]*?animation: none !important;/g)?.join("\n") ?? "";
  assert.match(reduced, /\.map-in\b/, "the fade is in the reduced-motion list");
});

test("the race car keeps its marker and its props, is hidden from assistive tech, and draws every part of a car", () => {
  const source = read("../src/components/VectorRaceCar.tsx");
  assert.match(source, /<g data-race-car\b[^>]*aria-hidden/);
  for (const prop of ["colour", "ink", "number", "angle", "scale", "selected"]) assert.match(source, new RegExp(`\\b${prop}\\b`), prop);
  for (const part of ["rear wing", "front wing", "suspension", "tyres", "cockpit", "sidepod", "shark fin", "halo"]) {
    assert.match(source, new RegExp(part, "i"), `the car draws its ${part}`);
  }
  assert.match(source, /number !== null/, "the number only shows when there is one");
  assert.match(source, /<text\b[^>]*fill=\{ink\}/, "the number is in the team's ink colour");
});
