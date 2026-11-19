import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { ALONGSIDE_G, createSpotter, sayPosition } from "../src/features/home/racing/callouts.ts";
import { G, brakeDecel, cornerSpeed, dragDecel, driveAccel, gripLat, netAccel, slew, tow, wake } from "../src/features/home/racing/dynamics.ts";
import { createRace, stepRace, type Input, type Race } from "../src/features/home/racing/traffic.ts";
import { circuit, gap, type TrackPoint } from "../src/features/home/racing/track.ts";

const read = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8");
const DT = 1 / 60;
const point = (): TrackPoint => ({ s: 0, x: 0, y: 0, z: 0, tx: 0, tz: 0, rx: 0, rz: 0, curv: 0 });

/* ------------------------------------------------------------------ the car: what it can do */

/** Full throttle from standstill on a straight, in small steps: the time to reach each speed (km/h). */
function launch(targets: number[]): Record<number, number> {
  const times: Record<number, number> = {};
  let v = 0;
  let t = 0;
  while (t < 60 && Object.keys(times).length < targets.length) {
    v += netAccel(v) * 0.002;
    t += 0.002;
    for (const k of targets) if (times[k] === undefined && v * 3.6 >= k) times[k] = t;
  }
  return times;
}

test("the car pulls away like a Formula 1 car: tyre-limited at first, then power-limited, with a top speed set by the air", () => {
  const t = launch([100, 200, 300]);
  assert.ok(t[100] > 2.2 && t[100] < 3.2, `0 to 100 km/h in ${t[100]?.toFixed(2)} s`);
  assert.ok(t[200] > 4.2 && t[200] < 6.4, `0 to 200 km/h in ${t[200]?.toFixed(2)} s`);
  assert.ok(t[300] > 8 && t[300] < 16, `0 to 300 km/h in ${t[300]?.toFixed(2)} s`);
  // acceleration falls with speed: the engine is out of power long before the tyres are out of grip
  assert.equal(driveAccel(10), driveAccel(20), "up to about 60 m/s the tyres are the limit");
  assert.ok(driveAccel(80) < driveAccel(40) * 0.85);
  assert.ok(driveAccel(60, 0.5) < driveAccel(60), "grip used for cornering is not there for driving");
  // terminal speed: where the push equals the drag
  let v = 60;
  for (let i = 0; i < 200_000; i++) v += netAccel(v) * 0.01;
  assert.ok(v * 3.6 > 320 && v * 3.6 < 360, `top speed ${(v * 3.6).toFixed(0)} km/h`);
});

test("downforce is the character of the car: the faster it goes the harder it can brake and corner", () => {
  assert.ok(brakeDecel(80) > brakeDecel(25) * 1.4, "braking improves with speed");
  assert.ok(gripLat(80) > gripLat(25) * 1.4, "so does grip");
  assert.ok(gripLat(25) / G > 2.3 && gripLat(25) / G < 3.2, `a slow corner holds ${(gripLat(25) / G).toFixed(1)} g`);
  assert.ok(gripLat(85) / G > 4 && gripLat(85) / G < 5, `a fast one holds ${(gripLat(85) / G).toFixed(1)} g`);
  // 300 km/h to a slow corner: about 100 m, under 2.5 s, peaking over 4 g
  let v = 83;
  let d = 0;
  let time = 0;
  let peak = 0;
  while (v > 22) {
    const a = brakeDecel(v) + dragDecel(v);
    peak = Math.max(peak, a / G);
    v -= a * 0.002;
    d += v * 0.002;
    time += 0.002;
  }
  assert.ok(d > 80 && d < 135, `braked in ${d.toFixed(0)} m`);
  assert.ok(time > 1.5 && time < 2.6, `braked in ${time.toFixed(2)} s`);
  assert.ok(peak > 4 && peak < 5.6, `peak ${peak.toFixed(1)} g`);
});

test("the corner speed is where sideways load meets grip, and a gentle bend has no limit", () => {
  assert.equal(cornerSpeed(0.001), Infinity);
  assert.ok(cornerSpeed(0.03) < cornerSpeed(0.015) && cornerSpeed(0.015) < cornerSpeed(0.008));
  const v = cornerSpeed(0.02);
  assert.ok(Math.abs(v * v * 0.02 - gripLat(v)) < 0.01, "at that speed the load is exactly the grip");
  assert.equal(cornerSpeed(-0.02), cornerSpeed(0.02), "a left bend is the same as a right");
});

test("sitting behind a car takes air off yours and costs downforce: a tow close in and in line, nothing far or to the side", () => {
  assert.equal(tow(40, 0), 0);
  assert.equal(tow(-1, 0), 0);
  assert.ok(tow(3, 0) > 0.3 && tow(3, 0) <= 0.4);
  assert.ok(tow(10, 0) < tow(3, 0) && tow(20, 0) < tow(10, 0));
  assert.equal(tow(5, 2.2), 0, "a car's width to the side is out of the wake");
  assert.ok(wake(4, 0) > 0.08 && wake(4, 0) <= 0.12);
  assert.equal(wake(30, 0), 0);
  assert.equal(slew(0, 1, 5, 9, 0.1), 0.5, "a foot takes time to go down");
  assert.equal(slew(1, 0, 5, 9, 0.05), 0.55, "and comes off faster");
  assert.equal(slew(0.9, 1, 5, 9, 1), 1, "and never overshoots");
});

/* ------------------------------------------------------------------ the person at the wheel */

/** A race with the lights out, no other cars, and nothing to come: for trying out one thing at a time. */
function quiet(seed = 7): Race {
  const r = createRace(seed, 6);
  r.t = r.outAt + 5;
  r.released = true;
  r.lights = 0;
  for (const c of r.cars) c.active = false;
  r.virtualAhead = 0;
  r.virtualBehind = 19;
  r.timers.passMe = r.timers.slow = r.timers.ambient = 1e9;
  return r;
}
const manual = (over: Partial<Input>): Input => ({ throttle: 0, brake: 0, steer: 0, boost: false, manual: true, ...over });

test("pedals and the wheel are not instant: a key goes down over a fraction of a second", () => {
  const r = quiet();
  r.player.s = 100;
  r.player.v = 40;
  const input = manual({ throttle: 1 });
  for (let i = 0; i < 3; i++) stepRace(r, DT, input);
  assert.ok(r.player.throttle > 0 && r.player.throttle < 0.4, `after 3 steps the throttle is ${r.player.throttle.toFixed(2)}`);
  for (let i = 0; i < 40; i++) stepRace(r, DT, input);
  assert.equal(r.player.throttle, 1);
  const steer = manual({ steer: 1, throttle: 0.3 });
  for (let i = 0; i < 4; i++) stepRace(r, DT, steer);
  assert.ok(r.player.wheel > 0 && r.player.wheel < 0.5, `the wheel is at ${r.player.wheel.toFixed(2)}`);
});

test("too fast into a bend the front lets go: the car runs wide, to the outside, and loses speed", () => {
  const track = circuit();
  const probe = point();
  for (const corner of track.corners) {
    const curv = track.into(corner.apex, probe).curv;
    const run = (input: Input) => {
      const r = quiet();
      r.player.s = corner.apex - 140;
      r.player.v = 80;
      r.player.d = 0;
      let widest = 0;
      let at = 0;
      for (let i = 0; i < 360; i++) {
        stepRace(r, DT, input);
        // the bend and nothing after it: the next one may turn the other way
        const past = gap(corner.apex, r.player.s, track.length);
        if (past > 25) break;
        if (past > -35 && Math.abs(r.player.d) > Math.abs(widest)) {
          widest = r.player.d;
          at = i;
        }
      }
      return { widest, at, v: r.player.v };
    };
    const flat = run(manual({ throttle: 1 }));
    const braked = run(manual({ brake: 1 }));
    assert.ok(Math.abs(flat.widest) > 0.6, `at ${corner.apex.toFixed(0)} m flat out reached only ${flat.widest.toFixed(2)} m from the line`);
    assert.equal(Math.sign(flat.widest), -Math.sign(curv), "the outside of the bend");
    assert.ok(Math.abs(braked.widest) < Math.abs(flat.widest), "braking for it keeps the car near its line");
    assert.ok(Math.abs(flat.widest) <= 6.3 + 1e-9, "never past the barrier");
  }
});

test("braking is shared with cornering: the same brake slows the car less in a bend than on a straight", () => {
  const track = circuit();
  const decel = (s: number) => {
    const r = quiet();
    r.player.s = s;
    r.player.v = 60;
    for (let i = 0; i < 20; i++) stepRace(r, DT, manual({ brake: 1 }));
    return -r.player.a;
  };
  const straight = decel(track.straight.from + 100);
  const bend = decel(track.corners[0].apex - 2);
  assert.ok(straight > 28 && straight < 40, `braking on the straight: ${straight.toFixed(1)} m/s^2`);
  assert.ok(bend < straight * 0.9, `in the bend ${bend.toFixed(1)} against ${straight.toFixed(1)}`);
});

test("lifting off at speed slows the car more than the air alone (engine braking), and the barrier takes speed from a car that scrapes it", () => {
  const r = quiet();
  r.player.s = quiet().track.straight.from + 100;
  r.player.v = 80;
  for (let i = 0; i < 12; i++) stepRace(r, DT, manual({}));
  assert.ok(-r.player.a > dragDecel(80) + 1, `coasting at 80 m/s slows at ${(-r.player.a).toFixed(1)}, the air alone ${dragDecel(80).toFixed(1)}`);
  // held against the wall for a while, the car has lost far more speed than it would have to the air
  const wall = quiet();
  wall.player.s = wall.track.straight.from + 20;
  wall.player.v = 70;
  for (let i = 0; i < 120; i++) stepRace(wall, DT, manual({ throttle: 1, steer: 1 }));
  assert.ok(Math.abs(wall.player.d) <= 6.3 + 1e-9);
  assert.ok(wall.player.v < 70, "the wall took speed");
});

test("the autopilot is untouched by all this: it drives as the traffic does", () => {
  const src = read("../src/features/home/racing/traffic.ts");
  assert.match(src, /the autopilot drives as the rest of the traffic does/);
  const r = createRace(7, 6);
  for (let i = 0; i < 60 * 30; i++) stepRace(r, DT, { throttle: 0, brake: 0, steer: 0, boost: false, manual: false });
  assert.ok(r.player.v * 3.6 > 100, "and gets going");
});

/* ------------------------------------------------------------------ the spotter */

/** A race on the move with one car placed where a test wants it. */
function spotterRace(): Race {
  const r = quiet();
  r.t = 50;
  return r;
}
/** A spotter that has already said its lights-out line, so what a test reads is what it is testing. */
function primed(r: Race) {
  const spotter = createSpotter();
  spotter.step(r, []);
  return spotter;
}
const place = (r: Race, slot: number, g: number, d: number) => {
  const c = r.cars[slot];
  c.active = true;
  c.g = g;
  c.d = r.player.d + d;
};

test("a car that comes alongside is called once, on the side it is on", () => {
  const r = spotterRace();
  const spotter = primed(r);
  place(r, 0, -30, -3.3);
  assert.deepEqual(spotter.step(r, []), [], "not yet beside");
  place(r, 0, 2, -3.3);
  const lines = spotter.step(r, []);
  assert.equal(lines.length, 1);
  assert.match(lines[0].text, /on your left/i);
  assert.equal(lines[0].kind, "alongside");
  assert.deepEqual(spotter.step(r, []), [], "said once, not every frame");

  const q = spotterRace();
  const other = primed(q);
  place(q, 1, -3, 3.3);
  const right = other.step(q, []);
  assert.match(right[0].text, /on your right/i);
});

test("the same car is not called again for a while, and it is called clear once it has gone", () => {
  const r = spotterRace();
  const spotter = primed(r);
  place(r, 0, 2, -3.3);
  assert.equal(spotter.step(r, []).length, 1);
  place(r, 0, 40, -3.3);
  r.t += 0.2;
  assert.equal(spotter.step(r, []).filter((l) => l.kind === "clear").length, 1, "clear left");
  // back alongside a second later: too soon for the same car
  place(r, 0, 1, -3.3);
  r.t += 1;
  assert.equal(spotter.step(r, []).filter((l) => l.kind === "alongside").length, 0);
  r.t += 6;
  place(r, 0, 40, -3.3);
  spotter.step(r, []);
  place(r, 0, 1, -3.3);
  r.t += 0.3;
  assert.equal(spotter.step(r, []).filter((l) => l.kind === "alongside").length, 1, "and again after a while");
});

test("a car in the player's own lane, or far off, is not alongside", () => {
  const r = spotterRace();
  const spotter = primed(r);
  place(r, 0, 1, 0.2);
  place(r, 1, ALONGSIDE_G + 4, -3.3);
  place(r, 2, 1, 9);
  assert.deepEqual(spotter.step(r, []), []);
});

test("places taken and lost are said, with the new position, and the most urgent line comes first", () => {
  const r = spotterRace();
  const spotter = primed(r);
  place(r, 0, 2, 3.3);
  const lines = spotter.step(r, [{ kind: "passed", slot: 1, side: -1, position: 5 }]);
  assert.match(lines[0].text, /overtake, overtake/i);
  assert.match(lines[0].text, /position five/i);
  assert.equal(lines[0].kind, "overtake");
  assert.ok(lines[0].priority > lines[1].priority, "the overtake outranks the car alongside");
  r.t += 3;
  const lost = spotter.step(r, [{ kind: "passed-by", slot: 2, side: 1, position: 7 }]);
  assert.match(lost[0].text, /car through\. position seven/i);
  assert.equal(sayPosition(21), "Position twenty", "never off the end of the list");
});

test("lights out at the start, the kerb, and the laps", () => {
  const r = createRace(7, 6);
  const spotter = createSpotter();
  assert.deepEqual(spotter.step(r, []), [], "silence on the grid");
  r.released = true;
  r.t = r.outAt + 0.1;
  const go = spotter.step(r, []);
  assert.match(go[0].text, /lights out/i);
  assert.deepEqual(spotter.step(r, []).filter((l) => l.kind === "start"), [], "once");
  // the kerb, for more than a moment
  r.player.kerb = 0.9;
  r.t += 0.2;
  assert.deepEqual(spotter.step(r, []), []);
  r.t += 0.7;
  assert.match(spotter.step(r, [])[0].text, /off track/i);
  r.t += 1;
  assert.deepEqual(spotter.step(r, []), [], "not nagging");
  r.player.kerb = 0;
  r.t += 10;
  assert.match(spotter.step(r, [{ kind: "lap", lap: 3 }])[0].text, /lap three/i);
  spotter.reset();
  r.released = false;
  assert.deepEqual(spotter.step(r, []), []);
  r.released = true;
  assert.match(spotter.step(r, [])[0].text, /lights out/i, "after a restart it is said again");
});

/* ------------------------------------------------------------------ how the sound is put on the page */

test("sound is synthesised in the browser, made only on request, and never loads a file", () => {
  const audio = read("../src/features/home/racing/audio.ts");
  assert.doesNotMatch(audio, /\.(mp3|wav|ogg|m4a|flac)\b|fetch\(|new Audio\(|decodeAudioData/, "no recordings, nothing fetched");
  // the context is made inside enable(), nowhere else
  const enableAt = audio.indexOf("enable() {");
  assert.ok(enableAt > 0);
  assert.equal(audio.indexOf("new Context()"), audio.lastIndexOf("new Context()"), "one place makes the context");
  assert.ok(audio.indexOf("new Context()") > enableAt, "and it is inside enable()");
  assert.doesNotMatch(audio.slice(0, enableAt), /new (Audio)?Context\(/);
  // nothing happens while it is off
  assert.match(audio, /if \(!on \|\| !ctx \|\| !graph \|\| !running\) return;/);
  // it rests with the picture, and goes with the scene
  const scene = read("../src/features/home/racing/scene.ts");
  assert.match(scene, /audio\.run\(false\)/);
  assert.match(scene, /audio\.run\(true\)/);
  assert.match(scene, /audio\.dispose\(\)/);
  assert.match(scene, /audio\.update\(race, dt\);\s*drain\(\);/, "the spotter sees the events before the page has them");
});

test("the card has a sound button that is off until pressed, and says nothing visible about the picture being illustrative", () => {
  const card = read("../src/features/home/racing/RacingHero.tsx");
  assert.match(card, /label="Sound"/);
  assert.match(card, /useState\(false\)/);
  assert.match(card, /setSound\(s\.setSound\(!s\.sound\)\)/, "the click itself asks for the sound");
  assert.doesNotMatch(card, /An invented circuit and field/, "the caption was taken off");
  assert.doesNotMatch(card, /<Tag kind="illustrative"/);
  // what is there for a screen reader still says what the picture is
  assert.match(card, /not a real race or telemetry/);
});
