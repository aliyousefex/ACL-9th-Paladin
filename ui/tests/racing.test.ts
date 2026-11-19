import assert from "node:assert/strict";
import { existsSync, readFileSync, statSync } from "node:fs";
import { test } from "node:test";
import { circuit, gap, wrap, V_MAX } from "../src/features/home/racing/track.ts";
import {
  BEHIND,
  CAR_LENGTH,
  CAR_WIDTH,
  EDGE,
  FIELD,
  FOG_FAR,
  GREEN_FOR,
  GRID_GAP,
  HOLD_MAX,
  HOLD_MIN,
  LIGHTS_AT,
  START_LAP,
  START_POSITION,
  createRace,
  gridSlot,
  gearFor,
  revFraction,
  stepRace,
  type Input,
  type Race,
} from "../src/features/home/racing/traffic.ts";

const read = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8");
const auto: Input = { throttle: 0, brake: 0, steer: 0, boost: false, manual: false };
const DT = 1 / 60;

/** Run a race and call back after every step, so a test can watch the whole thing. */
function run(race: Race, seconds: number, input: Input, each?: (r: Race) => void) {
  for (let i = 0; i < seconds * 60; i++) {
    stepRace(race, DT, input);
    each?.(race);
  }
}

/* ------------------------------------------------------------------ the circuit */

test("the circuit is one closed loop, sampled every 2 m, with room round it for scenery", () => {
  const t = circuit();
  assert.equal(t.table.length, t.count);
  assert.equal(t.length, t.count * t.step);
  assert.ok(t.length > 3500 && t.length < 6000, `a ${t.length} m lap`);
  // the last sample runs into the first: no gap in the loop
  const a = t.table[t.count - 1];
  const b = t.table[0];
  assert.ok(Math.hypot(a.x - b.x, a.z - b.z) < t.step * 1.2, "the lap closes");
  // every step along the line is about one step long (no kinks, no jumps)
  for (let i = 0; i < t.count; i++) {
    const p = t.table[i];
    const q = t.table[(i + 1) % t.count];
    const d = Math.hypot(q.x - p.x, q.z - p.z);
    assert.ok(d > t.step * 0.6 && d < t.step * 1.4, `sample ${i} is ${d.toFixed(2)} m from the next`);
  }
  // the tightest corner is a real car's, and two parts of the lap that are far apart along it are far apart on the ground
  let minRadius = Infinity;
  for (const p of t.table) minRadius = Math.min(minRadius, 1 / Math.max(Math.abs(p.curv), 1e-6));
  assert.ok(minRadius >= 25, `a corner of radius ${minRadius.toFixed(1)} m`);
  let clear = Infinity;
  for (let i = 0; i < t.count; i += 4) {
    for (let j = i + 1; j < t.count; j += 4) {
      const along = Math.min(Math.abs(j - i), t.count - Math.abs(j - i)) * t.step;
      if (along < 250) continue;
      clear = Math.min(clear, Math.hypot(t.table[i].x - t.table[j].x, t.table[i].z - t.table[j].z));
    }
  }
  assert.ok(clear > 100, `two parts of the lap come within ${clear.toFixed(0)} m, which is not room for scenery`);
});

test("the tangent, the right-hand vector and the curvature agree about which way the road turns", () => {
  const t = circuit();
  for (const i of [0, 100, 500, 1000, 1500, 2000]) {
    const p = t.table[i];
    assert.ok(Math.abs(Math.hypot(p.tx, p.tz) - 1) < 1e-6);
    assert.ok(Math.abs(p.rx + p.tz) < 1e-9 && Math.abs(p.rz - p.tx) < 1e-9, "right is (-tz, tx)");
    // a right-hander moves the road's heading towards the right: the next tangent has a positive component along right
    const q = t.table[(i + 3) % t.count];
    const turn = (q.tx - p.tx) * p.rx + (q.tz - p.tz) * p.rz;
    if (Math.abs(p.curv) > 0.004) assert.equal(Math.sign(turn), Math.sign(p.curv), `curvature at ${i}`);
  }
  const corners = t.corners;
  assert.ok(corners.some((c) => c.side === 1) && corners.some((c) => c.side === -1), "there are bends in both directions");
});

test("the reference speed is a car's: flat out on the straight, slower in a corner, never braking harder or accelerating faster than a car can", () => {
  const t = circuit();
  assert.ok(t.straight.length > 700, "a main straight of real length");
  assert.ok(t.limit(t.straight.from + t.straight.length / 2) >= V_MAX * 0.97);
  for (const c of t.corners) assert.ok(t.limit(c.apex) < V_MAX * 0.8, "slower at the apex");
  for (let i = 0; i < t.count; i++) {
    const v0 = t.limit(i * t.step);
    const v1 = t.limit((i + 1) * t.step);
    const decel = (v0 * v0 - v1 * v1) / (2 * t.step);
    const accel = (v1 * v1 - v0 * v0) / (2 * t.step);
    assert.ok(decel < 43.5, `braking at ${decel.toFixed(1)} m/s2 at sample ${i}`);
    assert.ok(accel < 11.5, `accelerating at ${accel.toFixed(1)} m/s2 at sample ${i}`);
  }
  assert.ok(Math.abs(gap(10, 4700, t.length) - -12) < 1e-9, "the gap round the lap is the short way");
  assert.equal(wrap(-1, 100), 99);
});

/* ------------------------------------------------------------------ the race */

test("the race is deterministic: one seed is always the same race, and another seed is another", () => {
  const a = createRace(5, 6);
  const b = createRace(5, 6);
  const c = createRace(6, 6);
  run(a, 40, auto);
  run(b, 40, auto);
  run(c, 40, auto);
  assert.deepEqual(
    a.cars.map((x) => [x.active, x.s, x.d, x.v]),
    b.cars.map((x) => [x.active, x.s, x.d, x.v]),
  );
  assert.equal(a.player.s, b.player.s);
  assert.notEqual(a.player.s, c.player.s);
});

test("what the frame rate is does not change the race: sixty steps a second or thirty gives the same result", () => {
  const a = createRace(3, 6);
  const b = createRace(3, 6);
  for (let i = 0; i < 60 * 20; i++) stepRace(a, 1 / 60, auto);
  for (let i = 0; i < 30 * 20; i++) stepRace(b, 1 / 30, auto);
  assert.ok(Math.abs(a.player.s - b.player.s) < 1e-6, "the player's distance");
  assert.equal(a.position, b.position);
});

test("the race starts on a grid: five red lights come on one after another, are held, go out, and show green", () => {
  for (const seed of [1, 2, 3, 7, 11]) {
    const r = createRace(seed, 6);
    assert.ok(r.outAt >= LIGHTS_AT[4] + HOLD_MIN && r.outAt <= LIGHTS_AT[4] + HOLD_MAX, `seed ${seed}: lights out at ${r.outAt}`);
    const seen: { t: number; lights: number; green: boolean }[] = [];
    let last = -1;
    let lastGreen = false;
    run(r, r.outAt + GREEN_FOR + 1, auto, (x) => {
      if (x.lights !== last || x.green !== lastGreen) seen.push({ t: x.t, lights: x.lights, green: x.green });
      last = x.lights;
      lastGreen = x.green;
    });
    // 0, 1, 2, 3, 4, 5 red, then out and green, then nothing
    assert.deepEqual(seen.map((e) => e.lights), [0, 1, 2, 3, 4, 5, 0, 0], `seed ${seed}`);
    assert.deepEqual(seen.map((e) => e.green), [false, false, false, false, false, false, true, false]);
    seen.slice(1, 6).forEach((e, i) => assert.ok(Math.abs(e.t - LIGHTS_AT[i]) < 0.03, `light ${i + 1} came on at ${e.t.toFixed(2)}`));
    assert.ok(seen[6].t >= r.outAt - 0.03 && seen[6].t <= r.outAt + 0.03, "the lights go out when they are due");
    assert.ok(seen[7].t - seen[6].t >= GREEN_FOR - 0.05 && seen[7].t - seen[6].t <= GREEN_FOR + 0.05, "the green lasts as long as stated");
  }
  // the hold is not always the same, so the start cannot be anticipated
  const holds = new Set([1, 2, 3, 4, 5, 6, 7, 8].map((seed) => createRace(seed, 6).outAt.toFixed(3)));
  assert.ok(holds.size >= 6, "the lights stay on for a different time in different races");
});

test("on the grid nothing moves and nothing can be driven; at lights out everything goes", () => {
  const r = createRace(7, 6);
  const before = [r.player.s, ...r.cars.map((c) => c.s)];
  // pressing everything before the lights are out does nothing: no jump start
  run(r, r.outAt - 0.2, { throttle: 1, brake: 0, steer: 1, boost: true, manual: true });
  assert.deepEqual([r.player.s, ...r.cars.map((c) => c.s)], before, "no car moved before the lights went out");
  assert.equal(r.player.v, 0);
  assert.equal(r.released, false);
  run(r, 0.4, { throttle: 1, brake: 0, steer: 0, boost: false, manual: true });
  assert.equal(r.released, true);
  run(r, 3, { throttle: 1, brake: 0, steer: 0, boost: false, manual: true });
  assert.ok(r.player.v * 3.6 > 80, `${(r.player.v * 3.6).toFixed(0)} km/h three seconds after the lights went out`);
  for (const c of r.cars) assert.ok(!c.active || c.v > 15, "and the field has gone too");
});

test("the grid is a grid: slots staggered left and right, eight metres apart, the player among them with the cars they start behind all on the road", () => {
  for (const cars of [3, 4, 6]) {
    const r = createRace(5, cars);
    const mine = Math.min(START_POSITION, cars);
    assert.equal(r.position, mine);
    assert.equal(r.cars.filter((c) => c.active).length, mine - 1, "every car in front is drawn");
    assert.ok(r.cars.every((c) => !c.active || c.ahead));
    assert.equal(r.virtualAhead, 0, "nobody is further up the grid than the cars drawn");
    const slot = mine - 1;
    for (const c of r.cars.filter((x) => x.active)) {
      const j = c.slot;
      assert.ok(Math.abs(c.g - GRID_GAP * (slot - j)) < 1e-6, "slots are eight metres apart");
      assert.equal(Math.sign(c.d), j % 2 === 0 ? -1 : 1, "alternating sides");
    }
    assert.equal(gridSlot(0).d, -gridSlot(1).d);
    assert.ok(r.player.s > r.track.length - 90 && r.player.s < r.track.length, "the grid is behind the line");
  }
});

test("then it races: within seconds of the lights going out the player has passed a slow starter, and within a quarter of a minute a car has come past on the way", () => {
  const r = createRace(7, 6);
  let firstPassed = -1;
  let firstPassedBy = -1;
  run(r, 40, auto, (x) => {
    for (const e of x.events) {
      if (e.kind === "passed" && firstPassed < 0) firstPassed = x.t - x.outAt;
      if (e.kind === "passed-by" && firstPassedBy < 0) firstPassedBy = x.t - x.outAt;
    }
    x.events.length = 0;
  });
  assert.ok(firstPassed > 0 && firstPassed < 14, `the player's first pass came ${firstPassed.toFixed(1)} s after the lights went out`);
  assert.ok(firstPassedBy > 0 && firstPassedBy < 16, `the first car came past ${firstPassedBy.toFixed(1)} s after the lights went out`);
});

test("over several races and several minutes: overtakes on both sides, nobody touches, nobody appears or vanishes in view, the order moves one place at a time", () => {
  for (const seed of [1, 2, 3, 7, 11]) {
    const r = createRace(seed, 6);
    const last = r.cars.map((c) => ({ active: c.active, s: c.s, g: c.g }));
    let lastPosition = r.position;
    let minPosition = r.position;
    let maxPosition = r.position;
    let contacts = 0;
    let lateralWorst = 0;
    run(r, 360, auto, (x) => {
      // the order changes by one, and only when an overtake is reported
      const flips = x.events.filter((e) => e.kind === "passed" || e.kind === "passed-by").length;
      assert.ok(Math.abs(x.position - lastPosition) <= Math.max(1, flips), `seed ${seed}: the order moved by ${x.position - lastPosition}`);
      lastPosition = x.position;
      minPosition = Math.min(minPosition, x.position);
      maxPosition = Math.max(maxPosition, x.position);
      x.events.length = 0;
      // the field is accounted for
      const active = x.cars.filter((c) => c.active).length;
      assert.equal(x.virtualAhead + x.virtualBehind + active, FIELD - 1, "every car in the field is somewhere");
      x.cars.forEach((c, i) => {
        const before = last[i];
        if (c.active && before.active) {
          // a car that stays on the road never jumps
          assert.ok(Math.abs(gap(before.s, c.s, x.track.length)) < 100 * DT, `seed ${seed}: car ${i} jumped`);
          lateralWorst = Math.max(lateralWorst, Math.abs(c.latV));
        }
        if (c.active && !before.active) {
          // created: far ahead in the fog, or behind the camera. Never in view.
          assert.ok(c.g >= FOG_FAR || c.g < -CAR_LENGTH * 2, `seed ${seed}: a car appeared ${c.g.toFixed(0)} m from the player, in view`);
        }
        if (!c.active && before.active) {
          // (the gap printed is from the step before, so allow the one step it takes to cross the line)
          assert.ok(before.g <= -BEHIND + 1 || before.g >= FOG_FAR + 190 - 1 || c.g <= -BEHIND || c.g >= FOG_FAR, `seed ${seed}: a car vanished ${before.g.toFixed(0)} m from the player, in view`);
        }
        last[i] = { active: c.active, s: c.s, g: c.g };
      });
      // cars never overlap
      const L = x.track.length;
      const bodies = [{ s: x.player.s, d: x.player.d }, ...x.cars.filter((c) => c.active)];
      for (let i = 0; i < bodies.length; i++) {
        for (let j = i + 1; j < bodies.length; j++) {
          if (Math.abs(gap(bodies[i].s, bodies[j].s, L)) < CAR_LENGTH - 0.5 && Math.abs(bodies[i].d - bodies[j].d) < CAR_WIDTH - 0.1) contacts++;
        }
      }
    });
    assert.equal(contacts, 0, `seed ${seed}: cars overlapped`);
    assert.ok(r.stats.left >= 4 && r.stats.right >= 4, `seed ${seed}: overtakes on the left ${r.stats.left} and the right ${r.stats.right}`);
    assert.ok(r.stats.passed >= 8, `seed ${seed}: the player passed ${r.stats.passed} cars`);
    assert.ok(minPosition >= 3 && maxPosition <= 14, `seed ${seed}: the order ranged P${minPosition} to P${maxPosition}`);
    assert.ok(lateralWorst < 3.6, `seed ${seed}: sideways speed reached ${lateralWorst.toFixed(1)} m/s`);
    // the guard's own count is in steps, not events: a near miss of a fraction of a second is a few steps. Two cars actually overlapping is the assertion above.
    assert.ok(r.stats.contacts <= 15, `seed ${seed}: the guard against overlap fired ${r.stats.contacts} steps`);
  }
});

test("a pass is made through coherent space: the passer is a lane away, and the lap counts at the line (lap 1 runs from the grid)", () => {
  const r = createRace(2, 6);
  const seen = new Set<number>();
  let laps = 0;
  run(r, 200, auto, (x) => {
    for (const c of x.cars) {
      if (!c.active || c.role !== "passMe" || c.phase !== "alongside") continue;
      seen.add(c.slot);
      // alongside means beside, not in the player's lane
      if (Math.abs(c.g) < CAR_LENGTH) assert.ok(Math.abs(c.d - x.player.d) > 2.4, `the passer is ${Math.abs(c.d - x.player.d).toFixed(2)} m to the side`);
    }
    for (const e of x.events) if (e.kind === "lap") laps++;
    x.events.length = 0;
  });
  assert.ok(seen.size >= 3, "several passes were made");
  assert.ok(laps >= 1, "the player completed a lap");
  assert.equal(r.lap, START_LAP + laps);
});

/* ------------------------------------------------------------------ driving by hand */

test("driving: the throttle builds speed to about 290 km/h, the brake takes it away, steering stays on the road, and handing back keeps the car moving smoothly", () => {
  const r = createRace(4, 6);
  run(r, r.outAt + 0.1, auto);
  let peak = 0;
  run(r, 14, { ...auto, manual: true, throttle: 1 }, (x) => (peak = Math.max(peak, x.player.v * 3.6)));
  assert.ok(peak > 215 && peak < 330, `full throttle along the straight reached ${peak.toFixed(0)} km/h`);
  run(r, 16, { ...auto, manual: true, throttle: 1 });
  const kmh = r.player.v * 3.6;
  run(r, 4, { ...auto, manual: true, brake: 1 });
  assert.ok(r.player.v * 3.6 < kmh - 60 || r.player.v * 3.6 < 120, "the brake takes a lot of speed away");
  run(r, 20, { ...auto, manual: true, throttle: 1, steer: 1 });
  assert.ok(Math.abs(r.player.d) <= EDGE + 1e-9, `steered right to ${r.player.d.toFixed(2)} m`);
  run(r, 10, { ...auto, manual: true, throttle: 1, steer: -1 });
  assert.ok(Math.abs(r.player.d) <= EDGE + 1e-9);
  // the autopilot takes over without a jump in speed or position
  const v = r.player.v;
  const s = r.player.s;
  stepRace(r, DT, auto);
  assert.ok(Math.abs(r.player.v - v) < 1.5 && Math.abs(gap(s, r.player.s, r.track.length)) < v * DT * 1.5);
  // and drives back to the racing line, smoothly
  let worst = 0;
  run(r, 10, auto, (x) => (worst = Math.max(worst, Math.abs(x.player.latV))));
  assert.ok(worst < 3.2, `sideways speed ${worst.toFixed(1)} m/s after the hand-over`);
});

test("the gear follows the speed, in order, and does not flicker on a boundary", () => {
  let g = 1;
  const seen: number[] = [];
  for (let kmh = 0; kmh <= 340; kmh += 2) {
    g = gearFor(kmh, g);
    seen.push(g);
  }
  assert.equal(seen[0], 1);
  assert.equal(seen[seen.length - 1], 8);
  for (let i = 1; i < seen.length; i++) assert.ok(seen[i] >= seen[i - 1] && seen[i] - seen[i - 1] <= 1);
  assert.equal(gearFor(290), 7, "around 290 km/h a car is in seventh");
  // hysteresis: just under a boundary after coming from above stays in the higher gear
  assert.equal(gearFor(104, 3), 3);
  assert.equal(gearFor(104, 2), 2);
  for (let kmh = 0; kmh <= 340; kmh += 10) {
    const f = revFraction(kmh, gearFor(kmh));
    assert.ok(f >= 0 && f <= 1);
  }
});

test("the race starts as it says: sixth of twenty, on the first lap", () => {
  const r = createRace(1, 6);
  assert.equal(r.position, START_POSITION);
  assert.equal(r.lap, 1);
  assert.equal(START_LAP, 1);
  assert.equal(r.cars.filter((c) => c.active).length, 5);
});

/* ------------------------------------------------------------------ how it is put on the page */

test("the home page loads none of three.js up front, and what the card is is said for those who cannot see it", () => {
  const home = read("../src/features/home/Home.tsx");
  assert.match(home, /RacingHero/);
  assert.doesNotMatch(home, /from "three"|racing\/scene/, "the page itself does not import the scene");
  const card = read("../src/features/home/racing/RacingHero.tsx");
  assert.match(card, /import\("\.\/scene\.ts"\)/, "the scene is a separate chunk, loaded on demand");
  assert.doesNotMatch(card, /^import .* from "three/m, "the card does not import three");
  assert.match(card, /not a real race|invented circuit/i, "the description for a screen reader says it is not a real race");
  assert.doesNotMatch(card, /Suzuka/, "no claim about Suzuka telemetry");
});

test("full screen the picture keeps the whole window: the instruments and notes become small panels over its corners, with the same readouts", () => {
  const card = read("../src/features/home/racing/RacingHero.tsx");
  assert.match(card, /\{!filled && \(/, "the strips under the picture are only there beside the page");
  assert.match(card, /ready && filled && \(/, "and the corner panels only when the card fills the window");
  assert.match(card, /data-racing-overlay/);
  // one set of readout elements, used by both layouts, so what is written to them keeps working across the change
  for (const node of ["speedNode", "gearNode", "posNode", "lapNode", "pedalNodes", "gNode"]) {
    assert.equal((card.match(new RegExp(`\\{${node}\\}`, "g")) ?? []).length, 2, `${node} is placed once in each layout`);
  }
  assert.match(card, /stopPropagation/, "a button over the picture does not also step into the car");
});

test("while the scene loads the card shows a photograph of it, not a drawn illustration, and shows no loader at all unless loading is slow", () => {
  const card = read("../src/features/home/racing/RacingHero.tsx");
  assert.match(card, /\/racing\/poster\.jpg/);
  assert.doesNotMatch(card, /function Poster|<linearGradient|<polygon/, "no hand-drawn SVG picture");
  assert.match(card, /setSlow\(true\)/, "the start lights are shown only after a delay");
  assert.match(card, /opacity: posterReady \? 1 : 0/, "and the picture fades in once it has loaded, so nothing flashes");
});

test("it is polite: it waits for an idle moment, runs only while seen, pauses with the tab, rests under reduced motion, and falls back when there is no WebGL", () => {
  const card = read("../src/features/home/racing/RacingHero.tsx");
  assert.match(card, /requestIdleCallback/);
  assert.match(card, /new IntersectionObserver/);
  assert.match(card, /visibilitychange/);
  assert.match(card, /usePrefersReducedMotion/);
  assert.match(card, /reduced && !userPlay/, "no motion until it is asked for");
  assert.match(card, /hasWebGL\(\)/);
  assert.match(card, /status === "fallback"|setStatus\("fallback"\)/);
  assert.match(card, /webglcontextlost|onContextLost/);
  const scene = read("../src/features/home/racing/scene.ts");
  assert.match(scene, /dispose\(\)/);
  assert.match(scene, /forceContextLoss/);
  assert.match(scene, /cancelAnimationFrame/);
  assert.match(scene, /Math\.min\(typeof window === "undefined" \? 1 : window\.devicePixelRatio \|\| 1, DPR_CAP\[quality\]\)/, "the pixel ratio is capped");
  assert.doesNotMatch(card + scene, /new Audio|new AudioContext/, "the card and the scene never make sound themselves: only audio.ts, on request (see racing-sound.test.ts)");
});

test("keys are read only while the card has focus, arrows keep scrolling until the wheel is taken, and Escape gives the car back", () => {
  const card = read("../src/features/home/racing/RacingHero.tsx");
  assert.doesNotMatch(card, /window\.addEventListener\("key(down|up)"/, "no global key listener");
  assert.doesNotMatch(card, /document\.addEventListener\("key(down|up)"/);
  assert.match(card, /onKeyDown=\{onKeyDown\}/);
  assert.match(card, /e\.key === "Escape"/);
  assert.match(card, /DRIVE_KEYS\.has\(e\.code\) && !arrow/, "an arrow key alone does not take the wheel");
  assert.match(card, /IDLE_MS/, "the autopilot comes back after a quiet spell");
  assert.match(card, /touchAction: manual \? "none" : "pan-y"/, "a finger can still scroll the page");
  assert.match(card, /e\.pointerType === "touch"/, "a touch is not a take-over");
});

test("the scene frees what it makes, and does not make objects every frame", () => {
  const scene = read("../src/features/home/racing/scene.ts");
  const update = scene.slice(scene.indexOf("const update = "), scene.indexOf("const kmh = "));
  assert.doesNotMatch(update, /new THREE\./, "no allocation in the per-frame update");
  assert.match(scene, /composer\?\.dispose\(\)/);
  assert.match(scene, /renderer\.dispose\(\)/);
  assert.match(scene, /world\.dispose\(\)/);
});

test("the photographs and scans are the project's own copies, with their licence and source stated", () => {
  const dir = "../public/racing/";
  for (const file of ["sky.jpg", "poster.jpg", "asphalt-diff.jpg", "asphalt-nor.jpg", "asphalt-rough.jpg", "grass-diff.jpg", "grass-nor.jpg", "grass-rough.jpg", "tree-fir-a.webp", "tree-fir-b.webp", "tree-broad-a.webp", "tree-broad-b.webp", "bush-a.webp", "bush-b.webp"]) {
    const path = new URL(dir + file, import.meta.url);
    assert.ok(existsSync(path), `${file} is missing`);
    assert.ok(statSync(path).size < 400_000, `${file} is ${statSync(path).size} bytes: keep every file small`);
  }
  const licence = read(dir + "LICENSE.txt");
  assert.match(licence, /CC0/);
  for (const name of ["kloofendal_48d_partly_cloudy_puresky", "asphalt_track", "aerial_grass_rock", "fir_sapling", "island_tree_01", "shrub_02", "Poly Haven"]) assert.match(licence, new RegExp(name));
  assert.match(read("../package.json"), /"three":/);
});

test("the replay offers 5x and 10x as well as the fast speeds", () => {
  assert.match(read("../src/features/race/ReplayPanel.tsx"), /const SPEEDS = \["5", "10", "45", "90", "180", "360"\] as const;/);
});
