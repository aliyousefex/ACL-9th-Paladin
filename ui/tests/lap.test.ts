import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { MIN_SAMPLES } from "../src/lib/mapDetail.ts";
import { frameAt, lapFrames, lapLength, launchDistance, launchFrames, sampleTrack, smoothHeadings, unwrap } from "../src/lib/lap.ts";

const read = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8");
const close = (a: number, b: number, eps = 1e-6) => assert.ok(Math.abs(a - b) <= eps, `${a} is not within ${eps} of ${b}`);

/** A circle of equally spaced points, run clockwise on screen (y runs down) or the other way. */
const circle = (clockwise: boolean, count = 360): [number, number][] =>
  Array.from({ length: count }, (_, i) => {
    const a = ((clockwise ? i : -i) / count) * 2 * Math.PI;
    return [200 + 100 * Math.cos(a), 200 + 100 * Math.sin(a)];
  });

test("angles are unwrapped so they never jump by more than half a turn", () => {
  assert.deepEqual(unwrap([170, -170, -150]), [170, 190, 210]);
  assert.deepEqual(unwrap([-170, 170, 150]), [-170, -190, -210]);
  assert.deepEqual(unwrap([10, 20, 30]), [10, 20, 30]);
  assert.deepEqual(unwrap([]), []);
});

test("a lap round a circle turns the car steadily through one whole turn, whichever way it goes", () => {
  for (const clockwise of [true, false]) {
    const frames = lapFrames(circle(clockwise));
    assert.equal(frames.length, 361, "one frame more than there are points: the start is repeated at the end");
    close(frames[0].x, frames[360].x);
    close(frames[0].y, frames[360].y);
    close(Math.abs(frames[360].angle - frames[0].angle), 360, 1e-6);
    const sign = clockwise ? 1 : -1;
    for (let i = 1; i < frames.length; i++) {
      const step = (frames[i].angle - frames[i - 1].angle) * sign;
      assert.ok(step > 0.9 && step < 1.1, `frame ${i} turns the car ${step.toFixed(3)} degrees, not the steady 1`);
    }
  }
});

test("the heading follows the line: east along a straight, and a turn is a gradual one", () => {
  const stadium: [number, number][] = [];
  for (let i = 0; i < 100; i++) stadium.push([(200 * i) / 100, 0]);
  for (let i = 0; i < 40; i++) {
    const a = -Math.PI / 2 + (Math.PI * i) / 40;
    stadium.push([200 + 50 * Math.cos(a), 50 + 50 * Math.sin(a)]);
  }
  for (let i = 0; i < 100; i++) stadium.push([200 - (200 * i) / 100, 100]);
  for (let i = 0; i < 40; i++) {
    const a = Math.PI / 2 + (Math.PI * i) / 40;
    stadium.push([50 * Math.cos(a), 50 + 50 * Math.sin(a)]);
  }
  const frames = lapFrames(stadium);
  close(frames[50].angle, 0, 0.01); // the middle of the top straight runs east
  close(frames[190].angle, 180, 0.01); // and the middle of the bottom one west, the angle having turned on through the bend rather than flipped
  // a raw heading is a step from 0 to 4.5 degrees at the first sample of the bend; this one has eased in over the samples before it
  const headings = smoothHeadings(stadium);
  assert.ok(headings[98] > 0.1 && headings[98] < headings[101], "the heading starts turning before the bend, as a chord across it does");
});

test("a place a fraction of the way round the lap wraps, interpolates, and keeps the heading continuous", () => {
  const frames = lapFrames(circle(true));
  const half = frameAt(frames, 0.5);
  close(half.x, 100, 1e-6);
  close(half.y, 200, 1e-6);
  const a = frameAt(frames, 0.25);
  const b = frameAt(frames, 1.25);
  const c = frameAt(frames, -0.75);
  close(a.x, b.x);
  close(a.y, c.y);
  // between two points, the place and the heading are between theirs
  const mid = frameAt(frames, 0.5 / 360);
  close(mid.x, (frames[0].x + frames[1].x) / 2);
  close(mid.angle, (frames[0].angle + frames[1].angle) / 2);
  assert.deepEqual(frameAt([], 0.3), { x: 0, y: 0, angle: 0 });
  assert.deepEqual(lapFrames([[0, 0], [1, 1]]), [], "two points are not a lap");
});

test("a standing start builds speed in a straight line, and ends at exactly the cruising speed", () => {
  const frames = lapFrames(circle(true, 720));
  const length = lapLength(frames);
  close(length, 2 * Math.PI * 100, 0.5);
  // 3 s of launch into a 24 s lap covers one sixteenth of the lap
  close(launchDistance(3000, 24000), 0.0625);
  const steps = 40;
  const launch = launchFrames(frames, 0, launchDistance(3000, 24000), steps);
  assert.equal(launch.length, steps + 1);
  const moves = launch.slice(1).map((p, i) => Math.hypot(p.x - launch[i].x, p.y - launch[i].y));
  for (let i = 1; i < moves.length; i++) assert.ok(moves[i] > moves[i - 1], `step ${i} is not faster than the one before it`);
  // evenly spaced in time, so the speed rises by the same amount every step (the circle's chord is a hair shorter than its arc)
  const rise = moves[1] - moves[0];
  for (let i = 2; i < moves.length; i++) close(moves[i] - moves[i - 1], rise, rise * 0.05);
  // the last step is at the cruising speed: a lap in 24 s, so a step of 3 s / 40 covers (length / 24000) * (3000 / 40) of the way
  const cruiseStep = (length / 24000) * (3000 / steps);
  close(moves[moves.length - 1] / cruiseStep, 1, 0.03);
  close(launch[0].x, frames[0].x);
  close(launch[steps].x, frameAt(frames, launchDistance(3000, 24000)).x, 1e-6);
});

test("a launch from just before the start line crosses the seam of the lap without the car spinning", () => {
  const frames = lapFrames(circle(true, 720));
  const launch = launchFrames(frames, 0.99, 0.0625, 60);
  for (let i = 1; i < launch.length; i++) {
    const step = launch[i].angle - launch[i - 1].angle;
    assert.ok(Math.abs(step) < 10, `the heading jumps ${step.toFixed(1)} degrees at step ${i}`);
  }
  assert.ok(launch[launch.length - 1].angle - launch[0].angle > 0, "and it carries on turning the same way");
});

test("a path cannot be measured without a browser, and the lap then comes from the outline's samples", () => {
  assert.equal(sampleTrack("M0 0L10 0L10 10Z"), null);
  const home = read("../src/features/home/Home.tsx");
  assert.match(home, /sampleTrack\(layout\.path\) \?\? layout\.samples/);
});

// ---- the real circuits -------------------------------------------------------------------------------------------------------

const circuits = JSON.parse(read("../src/data/circuits.json")) as { ref: string; layouts: { id: string; file: string | null }[] }[];
const layouts = circuits.flatMap((c) => c.layouts.filter((l) => l.file).map((l) => ({ name: `${c.ref}/${l.id}`, samples: (JSON.parse(read(`../public/data/${l.file}`)) as { samples?: [number, number][] }).samples ?? [] })));

test("every shipped circuit gives a closed lap whose heading turns more gently than the straight-segment heading it replaces", () => {
  const sampled = layouts.filter((l) => l.samples.length >= MIN_SAMPLES);
  assert.ok(sampled.length >= 25);
  for (const { name, samples } of sampled) {
    const frames = lapFrames(samples);
    assert.equal(frames.length, samples.length + 1, name);
    const turns = (frames[frames.length - 1].angle - frames[0].angle) / 360;
    close(turns, Math.round(turns), 1e-9);
    // the heading as `pointAt` gives it: that of the segment the car is on
    const raw = samples.map((p, i) => (Math.atan2(samples[(i + 1) % samples.length][1] - p[1], samples[(i + 1) % samples.length][0] - p[0]) * 180) / Math.PI);
    let worstRaw = 0;
    let worstSmooth = 0;
    for (let i = 0; i < samples.length; i++) {
      let d = raw[(i + 1) % samples.length] - raw[i];
      while (d > 180) d -= 360;
      while (d < -180) d += 360;
      worstRaw = Math.max(worstRaw, Math.abs(d));
      worstSmooth = Math.max(worstSmooth, Math.abs(frames[i + 1].angle - frames[i].angle));
    }
    assert.ok(worstSmooth <= worstRaw + 1e-9, `${name}: the heading steps by up to ${worstSmooth.toFixed(1)} degrees, no better than ${worstRaw.toFixed(1)}`);
    assert.ok(worstSmooth < 60, `${name}: a ${worstSmooth.toFixed(1)} degree step in the heading`);
  }
});

// ---- how the home car is put together ----------------------------------------------------------------------------------------

test("the home car is moved by the browser's animation engine, not by script every frame, and is smaller than the track is wide", () => {
  const source = read("../src/features/home/Home.tsx");
  assert.doesNotMatch(source, /requestAnimationFrame/, "no per-frame script on the home page's map");
  assert.doesNotMatch(source, /setAttribute\("transform"/, "the car is not moved by setting an attribute");
  assert.match(source, /node\.animate\(/, "its movement is a Web Animation, which the browser can run off the main thread");
  assert.match(source, /iterations: Infinity/);
  assert.match(source, /new IntersectionObserver/, "it waits while its map is off screen");
  assert.match(source, /data-lapping-car/);
  // the front wing's end plates and footplates reach 7.5 units from the car's middle at scale 1; the asphalt is 20 wide, so 10 each side
  const scale = Number(source.match(/CAR_SCALE = ([\d.]+)/)?.[1]);
  assert.ok(scale > 0 && 7.5 * scale <= 9, `the car, at ${scale}, is wider than the track allows`);
  // nothing in the car's timing overshoots or bounces: the launch is a straight build of speed
  assert.match(source, /easing: "linear"/);
});
