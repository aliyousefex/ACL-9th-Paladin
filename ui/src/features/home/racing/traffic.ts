/**
 * The race the onboard preview shows, as a small deterministic model in track space.
 *
 * Every car is a distance along the lap (s) and a sideways offset (d). Nothing is ever placed on the screen: the renderer turns
 * (s, d) into a position on the circuit and puts the camera in the player's car, so a car that passes is simply a car whose s
 * grows faster than the player's, in a lane beside it. There is no teleporting inside the view: cars are created far ahead in the
 * fog or behind the camera, and are retired the same way.
 *
 * Speeds are "pace x the circuit's reference speed" (track.limit), so relative speeds shrink in corners and grow on straights the
 * way they do in a race. The choreographer keeps the action coming (a car that comes up from behind and passes, on either side;
 * a slower car ahead that the player catches and passes; cars that settle ahead and separate) without ever repeating on a timer.
 *
 * The race begins as one does: the cars stand on a grid, five red lights come on one after another, they go out after a pause that is
 * never quite the same, and only then does anything move. Nothing can be driven before the lights go out.
 *
 * This is an illustration, not a simulation of any race: the field, the order and the cars are made up.
 */
import { mulberry32 } from "../../../lib/random.ts";
import { ENGINE_BRAKE, brakeDecel, dragDecel, driveAccel, gripLat, slew, tow, wake } from "./dynamics.ts";
import { A_BRAKE, circuit, gap, wrap, type Track, type TrackPoint } from "./track.ts";

/** Metres: a car is this long and wide, and two cars never overlap by more than the margins used below. */
export const CAR_LENGTH = 5.6;
export const CAR_WIDTH = 2;
/** Centre-to-centre sideways distance of a car passing another, so there is a little over a metre between them. */
export const LANE_GAP = 3.3;
/** A car counts as having passed (or been passed) when its centre is this far beyond the other car's. */
export const PASSED_AT = 2.8;
/** Beyond this far ahead the fog hides a car, so one can be created (or retired) out there. */
export const FOG_FAR = 300;
/** Nothing behind the camera is drawn, so a car can be created or retired this far behind (a passer is created less far back than this). */
export const BEHIND = 75;
export const FIELD = 20;
export const LAPS = 57;
export const START_LAP = 1;
/** The grid slot the player starts in (fewer when fewer cars are drawn, so the whole grid in front of the player is on the road). */
export const START_POSITION = 6;
/** The gap between grid slots, and how far behind the line the first slot is. */
export const GRID_GAP = 8;
export const GRID_BACK = 7;
/** When each of the five lights comes on, and the least and most the lights are held before they go out (seconds). */
export const LIGHTS_AT = [0.9, 1.7, 2.5, 3.3, 4.1] as const;
export const HOLD_MIN = 1.0;
export const HOLD_MAX = 2.3;
/** The lights, then this long of green, then the lights are not shown. */
export const GREEN_FOR = 1.5;
/** The furthest the centre of the player's car may go from the centre line: the kerb starts at 7 m. */
export const EDGE = 6.3;
/** The sideways limit for a car the model steers: the whole car stays on the tarmac. */
const LANE_LIMIT = 5.3;

export type Side = -1 | 1;
export type Role = "passMe" | "traffic" | "slow" | "away" | "dropped";
export type Phase = "closing" | "alongside" | "extending" | "cruise" | "approach" | "passed" | "leaving";

export interface Input {
  throttle: number;
  brake: number;
  steer: number;
  boost: boolean;
  /** The person is driving; false is the autopilot. */
  manual: boolean;
}

export interface Car {
  slot: number;
  active: boolean;
  livery: number;
  number: number;
  s: number;
  d: number;
  latV: number;
  v: number;
  a: number;
  /** Pace as a fraction of the circuit's reference speed. */
  pace: number;
  /** This car's own preferred sideways position. */
  lane: number;
  role: Role;
  phase: Phase;
  side: Side;
  duel: number;
  ttl: number;
  /** Metres ahead (+) or behind (-) of the player, centre to centre. */
  g: number;
  /** Counted ahead of the player in the running order. */
  ahead: boolean;
  /** Heading relative to the road, radians, positive turns left (the sign three.js uses for a rotation about up). */
  yaw: number;
}

export interface Player {
  s: number;
  /** Total distance driven, so the lap can be counted. */
  travelled: number;
  d: number;
  latV: number;
  v: number;
  a: number;
  yaw: number;
  /** Steering wheel position, -1 to 1, smoothed. */
  steer: number;
  /** The wheel as the driver holds it, -1 to 1 (a key is all or nothing; a hand is not). */
  wheel: number;
  throttle: number;
  brake: number;
  boost: number;
  /** The lane the autopilot is heading for. */
  lane: number;
  /** The slot of the car being passed or just passed, or -1. */
  passing: number;
  /** 0 on the road, up to 1 on the kerb: the camera shakes harder. */
  kerb: number;
}

export type RaceEvent =
  | { kind: "passed-by"; slot: number; side: Side; position: number }
  | { kind: "passed"; slot: number; side: Side; position: number }
  | { kind: "lap"; lap: number };

export interface Race {
  track: Track;
  rng: () => number;
  t: number;
  player: Player;
  cars: Car[];
  /** Cars in the field that are ahead of / behind the player and are not on the road in the model. */
  virtualAhead: number;
  virtualBehind: number;
  /** The player's autopilot pace. */
  pp: number;
  /** Where the player started, so the lap can be counted from the distance driven. */
  startS: number;
  position: number;
  lap: number;
  events: RaceEvent[];
  /** Lights lit, 0 to 5, and whether the lights have gone out and the green is showing. */
  lights: number;
  green: boolean;
  /** The time the lights go out: from here the race is on. */
  outAt: number;
  /** True once the lights are out. */
  released: boolean;
  timers: { passMe: number; slow: number; ambient: number };
  lastSide: Side;
  stats: { contacts: number; spawns: number; passedBy: number; passed: number; left: number; right: number };
  maxCars: number;
  /** Scratch, so stepping allocates nothing. */
  tmp: TrackPoint;
}

const clamp = (v: number, lo: number, hi: number) => (v < lo ? lo : v > hi ? hi : v);

/** The racing line: towards the inside of a bend, ahead of the car so it turns in early. */
export function lineAt(track: Track, s: number, scratch: TrackPoint): number {
  return clamp(track.into(s + 14, scratch).curv * 340, -3.1, 3.1);
}

function newCar(slot: number): Car {
  return {
    slot, active: false, livery: slot % 5, number: 0, s: 0, d: 0, latV: 0, v: 0, a: 0, pace: 1, lane: 0,
    role: "traffic", phase: "cruise", side: 1, duel: 0, ttl: 0, g: 0, ahead: false, yaw: 0,
  };
}

/** The race numbers on the cars. Each number on the road is its own, and a livery is worn by at most two cars: team-mates. */
export const NUMBERS = [1, 4, 11, 14, 16, 18, 22, 23, 27, 31, 33, 44, 55, 63, 77, 81] as const;

/** Where grid slot j sits: staggered left and right, each one a row further back from the line. */
export const gridSlot = (j: number): { s: number; d: number } => ({ s: -(GRID_BACK + GRID_GAP * j), d: j % 2 === 0 ? -2.3 : 2.3 });

export function createRace(seed = 7, maxCars = 6): Race {
  const track = circuit();
  const rng = mulberry32(seed);
  // on the grid: the cars in front of the player are all on the road, so the player starts as far back as the cars drawn allow
  const slot = Math.min(START_POSITION, maxCars) - 1;
  const me = gridSlot(slot);
  const player: Player = {
    s: wrap(me.s, track.length), travelled: 0, d: me.d, latV: 0, v: 0, a: 0, yaw: 0, steer: 0, wheel: 0, throttle: 0, brake: 1, boost: 0, lane: me.d, passing: -1, kerb: 0,
  };
  const race: Race = {
    track, rng, t: 0, player,
    cars: Array.from({ length: maxCars }, (_, i) => newCar(i)),
    virtualAhead: 0, virtualBehind: FIELD - 1 - slot,
    pp: 0.9, startS: player.s, position: slot + 1, lap: START_LAP, events: [],
    lights: 0, green: false, released: false,
    outAt: LIGHTS_AT[4] + HOLD_MIN + rng() * (HOLD_MAX - HOLD_MIN),
    timers: { passMe: 5.5, slow: 9, ambient: 2 },
    lastSide: -1, stats: { contacts: 0, spawns: 0, passedBy: 0, passed: 0, left: 0, right: 0 }, maxCars,
    tmp: { s: 0, x: 0, y: 0, z: 0, tx: 0, tz: 0, rx: 0, rz: 0, curv: 0 },
  };
  // the cars in front, one per slot. Some are quicker and pull away; the two nearest the player are slower, so the player has places to take at once
  const paces = [0.035, 0.02, -0.1, 0.012, -0.15];
  for (let j = 0; j < slot; j++) {
    const g = gridSlot(j);
    const c = race.cars[j];
    activate(race, c, "traffic", "cruise", g.s - me.s, race.pp + (paces[j] ?? 0.01) + (rng() * 2 - 1) * 0.004, g.d, 1);
    c.v = 0;
    c.ahead = true;
    c.ttl = 12 + j * 3 + rng() * 6;
  }
  syncGaps(race);
  return race;
}

function activate(r: Race, c: Car, role: Role, phase: Phase, g: number, pace: number, d: number, side: Side) {
  c.active = true;
  c.role = role;
  c.phase = phase;
  c.s = wrap(r.player.s + g, r.track.length);
  c.pace = pace;
  c.d = d;
  c.latV = 0;
  c.lane = d;
  c.side = side;
  c.duel = 0;
  c.ttl = 0;
  c.g = g;
  c.yaw = 0;
  // a passer comes up at its own pace, but never so fast that a slow player is run over
  c.v = Math.min(pace * r.track.limit(c.s), r.player.v + 22);
  c.a = 0;
  c.number = pickNumber(r, c);
  c.livery = pickLivery(r, c);
  r.stats.spawns++;
}

/** A number not already on the road. */
function pickNumber(r: Race, except: Car): number {
  const used = new Set(r.cars.filter((c) => c.active && c !== except).map((c) => c.number));
  const free = NUMBERS.filter((n) => !used.has(n));
  return free[Math.floor(r.rng() * free.length)];
}

/** A livery worn by fewer than two cars: half the time the second car of a team that is already out there (team-mates), else a new team. */
function pickLivery(r: Race, except: Car): number {
  const worn = new Map<number, number>();
  for (const c of r.cars) if (c.active && c !== except) worn.set(c.livery, (worn.get(c.livery) ?? 0) + 1);
  const open = [0, 1, 2, 3, 4].filter((l) => (worn.get(l) ?? 0) < 2);
  const mates = open.filter((l) => worn.get(l) === 1);
  const fresh = open.filter((l) => !worn.has(l));
  const from = mates.length && (fresh.length === 0 || r.rng() < 0.5) ? mates : fresh.length ? fresh : open;
  return from[Math.floor(r.rng() * from.length)];
}

function retire(r: Race, c: Car) {
  c.active = false;
  if (c.ahead) r.virtualAhead++;
  else r.virtualBehind++;
}

function syncGaps(r: Race) {
  for (const c of r.cars) if (c.active) c.g = gap(r.player.s, c.s, r.track.length);
}

/** Bumper-to-bumper distance to o if it is ahead of c and in c's way (within 2.7 m sideways), else Infinity. */
function inTheWay(c: { s: number; d: number }, o: { s: number; d: number }, length: number): number {
  const bumper = gap(c.s, o.s, length) - CAR_LENGTH;
  if (bumper < -CAR_LENGTH * 0.9 || bumper > 90) return Infinity;
  if (Math.abs(c.d - o.d) > 2.7) return Infinity;
  return bumper;
}

/** The fastest a car may go without running into the one in front of it: it settles at a distance that grows with speed. */
function followLimit(r: Race, c: { s: number; d: number }, self: Car | null): number {
  let limit = Infinity;
  const L = r.track.length;
  const consider = (o: { s: number; d: number; v: number }) => {
    const b = inTheWay(c, o, L);
    if (b === Infinity) return;
    limit = Math.min(limit, o.v + (b - (6 + o.v * 0.18)) * 0.8);
  };
  if (self) consider(r.player);
  for (const o of r.cars) if (o.active && o !== self) consider(o);
  return limit;
}

/** How far a car's nose is from the one ahead (bumper to bumper) and how far to one side, for the nearest car it is following. */
function followedClosely(r: Race): { tow: number; wake: number } {
  let t = 0;
  let w = 0;
  const p = r.player;
  for (const c of r.cars) {
    if (!c.active || c.g <= 0) continue;
    const bumper = c.g - CAR_LENGTH;
    const off = c.d - p.d;
    t = Math.max(t, tow(bumper, off));
    w = Math.max(w, wake(bumper, off));
  }
  return { tow: t, wake: w };
}

/** No tow and no wake: the autopilot, and a car with clear air. */
const NO_AIR = { tow: 0, wake: 0 } as const;

/** The sideways motion every steered car shares: a damped spring to the target lane with a cap on the rate, so a lane change is smooth. */
function lateral(c: { d: number; latV: number; v: number }, target: number, dt: number) {
  const k = 3.4;
  const damping = 2 * Math.sqrt(k);
  const maxRate = 2.7 * clamp(c.v / 50, 0.3, 1);
  c.latV += (k * (target - c.d) - damping * c.latV) * dt;
  c.latV = clamp(c.latV, -maxRate, maxRate);
  c.d += c.latV * dt;
}

/* ------------------------------------------------------------------ the player */

function stepPlayer(r: Race, dt: number, input: Input) {
  const p = r.player;
  const track = r.track;
  let throttle: number;
  let brake: number;
  let boost = 0;
  // the air: the tow behind a car, and the downforce lost in its wake (for the person at the wheel)
  const air = input.manual ? followedClosely(r) : NO_AIR;
  // what the tyres can hold across the road now: less in the wake of a car, and less off the tarmac
  const grip = gripLat(p.v) * (1 - air.wake) * (1 - 0.45 * p.kerb);
  const bend = track.into(p.s + 2, r.tmp).curv;
  const aLat = p.v * p.v * Math.abs(bend);
  // too fast for the bend: the front lets go and the car runs wide
  const excess = input.manual ? clamp(aLat / grip - 1, 0, 3.5) : 0;
  // the friction circle: grip used for cornering is not there for braking and driving
  const circle = input.manual ? Math.sqrt(Math.max(0.2, 1 - Math.min(1, aLat / grip) ** 2)) : 1;

  if (!input.manual) {
    const choice = chooseLane(r, p, null, lineAt(track, p.s, r.tmp), r.pp * track.limit(p.s + p.v * 0.3));
    p.lane = choice.lane;
    p.passing = choice.passing;
    // a little ahead of the car, so it brakes in time for the corner
    const reference = track.limit(p.s + p.v * 0.3);
    const target = Math.min(r.pp * reference * (p.passing >= 0 ? 1.02 : 1), followLimit(r, p, null));
    throttle = clamp((target - p.v) * 1.5, 0, 1);
    brake = clamp((p.v - target) * 0.2, 0, 1);
    p.wheel = 0;
    lateral(p, p.lane, dt);
  } else {
    p.passing = -1;
    // a foot on a pedal and a hand on a wheel are not instant, and a key is all or nothing
    throttle = slew(p.throttle, clamp(input.throttle, 0, 1), 4.5, 9, dt);
    brake = slew(p.brake, clamp(input.brake, 0, 1), 7, 12, dt);
    p.wheel = slew(p.wheel, clamp(input.steer, -1, 1), 3.6, 6.5, dt);
    boost = input.boost && p.v > 20 ? 1 : 0;
    // the assist keeps the car on the road, so the wheel sets how fast it moves across it: quicker as speed builds, never faster than the tyres allow
    const want = p.wheel * 5.6 * clamp(p.v / 45, 0.35, 1);
    p.latV += clamp((want - p.latV) * 7, -grip, grip) * dt;
    if (excess > 0) p.latV -= Math.sign(bend) * Math.min(excess, 1.6) * 36 * dt;
    p.d += p.latV * dt;
    if (Math.abs(p.d) > EDGE) {
      p.d = Math.sign(p.d) * EDGE;
      p.latV = 0;
      // the barrier: the car sheds speed against it
      p.v *= 1 - Math.min(1, 0.6 * dt);
    }
  }

  let a: number;
  if (input.manual) {
    // the person at the wheel gets the car as it is: tyre-limited then power-limited, drag and downforce, engine braking, the friction circle
    const coasting = throttle < 0.1 && brake < 0.1;
    a =
      throttle * driveAccel(p.v, circle) * (1 + 0.1 * boost) -
      brake * (brakeDecel(p.v, circle) + dragDecel(p.v)) -
      dragDecel(p.v) * (1 - 0.1 * boost) * (1 - air.tow) -
      (coasting ? ENGINE_BRAKE * clamp(p.v / 45, 0, 1) : 0) -
      excess * 22;
    // the assist: closing speed on a car in the way is capped
    const cap = followLimit(r, p, null);
    if (p.v > cap) a = Math.min(a, (cap - p.v) * 4);
  } else {
    // the autopilot drives as the rest of the traffic does, and the choreography of passes is built on that model
    a = throttle * 14 * (1 - p.v / 110) - brake * A_BRAKE - 0.0006 * p.v * p.v;
  }
  // on the kerb or in the run-off the car is slowed
  const off = Math.max(0, Math.abs(p.d) - 5.6);
  p.kerb += (clamp(off / 0.7, 0, 1) - p.kerb) * Math.min(1, 10 * dt);
  a -= off * 9;

  p.a += (a - p.a) * Math.min(1, 12 * dt);
  p.v = Math.max(0, p.v + p.a * dt);
  p.boost += (boost - p.boost) * Math.min(1, 4 * dt);
  p.throttle = throttle;
  p.brake = brake;

  const moved = p.v * dt;
  p.s = wrap(p.s + moved, track.length);
  p.travelled += moved;
  p.yaw = -Math.atan2(p.latV, Math.max(p.v, 8));
  // the wheel: from the corner being driven and from steering across the road
  const turn = track.into(p.s + 4, r.tmp).curv;
  const wheel = clamp(turn * 36 - p.latV * 0.11, -1, 1);
  p.steer += (wheel - p.steer) * Math.min(1, 9 * dt);
}

/**
 * Where a car wants to be: its own line, or one lane away from a slower car it is about to reach (so it can pass), or clear of
 * a car it has just passed. Shared by the player's autopilot and every other car, so the whole field can pass one another.
 */
function chooseLane(r: Race, me: { s: number; d: number; v: number }, self: Car | null, line: number, want: number): { lane: number; passing: number } {
  // the launch: everyone keeps the lane they started in until the field has spread out
  if (r.t < r.outAt + 3.5) return { lane: me.d, passing: -1 };
  const track = r.track;
  const L = track.length;
  let lane = line;
  let passing = -1;
  let blocker: { s: number; d: number; v: number; slot: number } | null = null;
  let soonest = Infinity;
  const look = (o: { s: number; d: number; v: number }, slot: number) => {
    const g = gap(me.s, o.s, L);
    // judged on the speed it wants, not the speed it has been held to by the car in front: otherwise it would never decide to pass
    if (g > 0 && g < 220 && Math.abs(o.d - me.d) < 3.1 && want - o.v > 0.8) {
      const time = Math.max(g - CAR_LENGTH, 0.1) / (want - o.v);
      if (time < 5 && time < soonest) {
        blocker = { s: o.s, d: o.d, v: o.v, slot };
        soonest = time;
      }
    }
    // just passed: stay in the clear lane until it is well behind
    if (g <= 0 && g > -12 && o.v < want) {
      passing = slot;
      lane = o.d + (me.d >= o.d ? 1 : -1) * LANE_GAP;
    }
  };
  if (self) look(r.player, -1);
  for (const o of r.cars) if (o.active && o !== self) look(o, o.slot);
  // not into a tight corner: wait behind until the road opens
  const b = blocker as { s: number; d: number; v: number; slot: number } | null;
  if (b && track.limit(b.s) > 0.55 * 86) {
    const fits = (side: Side) => Math.abs(b.d + side * LANE_GAP) <= LANE_LIMIT;
    let side: Side = Math.abs(me.d - b.d) > 0.6 ? (me.d > b.d ? 1 : -1) : line >= b.d ? 1 : -1;
    if (!fits(side)) side = (side * -1) as Side;
    lane = clamp(b.d + side * LANE_GAP, -LANE_LIMIT, LANE_LIMIT);
    passing = b.slot;
  }
  // never towards a car that is alongside
  const keepAway = (o: { s: number; d: number }, slot: number) => {
    if (b && b.slot === slot) return;
    if (Math.abs(gap(me.s, o.s, L)) < 16 && Math.abs(lane - o.d) < LANE_GAP - 0.2) {
      // clear of it on the side I am already on, never by crossing its path
      const wanted = o.d + (me.d >= o.d ? 1 : -1) * (LANE_GAP - 0.1);
      lane = Math.abs(wanted) <= LANE_LIMIT ? wanted : me.d;
    }
  };
  if (self) keepAway(r.player, -1);
  for (const o of r.cars) if (o.active && o !== self) keepAway(o, o.slot);
  return { lane: clamp(lane, -LANE_LIMIT, LANE_LIMIT), passing };
}

/* ------------------------------------------------------------------ the other cars */

function stepCar(r: Race, c: Car, dt: number) {
  const track = r.track;
  const p = r.player;
  const limit = track.limit(c.s);
  let target = c.pace * limit;
  let lane: number;

  if (c.role === "passMe" && (c.phase === "closing" || c.phase === "alongside")) {
    // one lane away from wherever the player is
    lane = clamp(p.d + c.side * LANE_GAP, -LANE_LIMIT, LANE_LIMIT);
    target = Math.min(target, p.v + 22);
    // a wheel-to-wheel moment: the pass slows to a duel for a second or two, then goes
    if (c.duel > 0 && c.phase === "alongside") {
      c.duel -= dt;
      target = Math.min(target, p.v + 1.4);
    }
  } else {
    // everyone else follows the racing line with a lane of their own, and goes round a slower car
    lane = chooseLane(r, c, c, clamp(c.lane * 0.6 + lineAt(track, c.s, r.tmp) * 0.7, -4.6, 4.6), target).lane;
  }

  target = Math.min(target, followLimit(r, c, c));
  c.a = clamp((target - c.v) * 2.2, -A_BRAKE, 14 * (1 - c.v / 130));
  c.v = Math.max(0, c.v + c.a * dt);
  c.s = wrap(c.s + c.v * dt, track.length);
  lateral(c, lane, dt);
  c.yaw = -Math.atan2(c.latV, Math.max(c.v, 8));
}

/* ------------------------------------------------------------------ the choreographer */

/** Nobody in that lane (or near it) between a little behind g and well ahead of it, where something faster would catch up. */
function laneIsFree(r: Race, g: number, d: number, behind: number, ahead: number): boolean {
  for (const c of r.cars) if (c.active && c.g > g - behind && c.g < g + ahead && Math.abs(c.d - d) < 3.4) return false;
  return true;
}

/** Nobody at all within this distance of g: a new car appears out of the fog into clear road. */
function roadIsClear(r: Race, g: number, margin: number): boolean {
  return r.cars.every((c) => !c.active || Math.abs(c.g - g) > margin);
}

const freeCar = (r: Race): Car | null => r.cars.find((c) => !c.active) ?? null;

function choreograph(r: Race, dt: number) {
  const t = r.timers;
  t.passMe -= dt;
  t.slow -= dt;
  t.ambient -= dt;
  const p = r.player;

  // 1. a car comes up from behind and passes, either side
  if (t.passMe <= 0) {
    const c = freeCar(r);
    const busy = r.cars.some((x) => x.active && x.role === "passMe" && (x.phase === "closing" || (x.phase === "alongside" && x.g < 12)));
    const aboutToPass = r.cars.some((x) => x.active && x.role === "slow" && x.g > 0 && x.g < 75);
    if (c && !busy && !aboutToPass && r.virtualBehind > 0 && r.position < 12) {
      const first: Side = r.rng() < 0.7 ? ((r.lastSide * -1) as Side) : r.lastSide;
      let done = false;
      for (const side of [first, (first * -1) as Side]) {
        const lane = p.d + side * LANE_GAP;
        const g = -(28 + r.rng() * 30);
        if (Math.abs(lane) > 5.2 || !laneIsFree(r, g, lane, 24, 80)) continue;
        activate(r, c, "passMe", "closing", g, Math.min(1.07, r.pp + 0.1 + r.rng() * 0.07), lane, side);
        c.duel = r.rng() < 0.4 ? 1.1 + r.rng() * 0.7 : 0;
        c.ahead = false;
        r.virtualBehind--;
        r.lastSide = side;
        done = true;
        break;
      }
      // a place lost soon after another is a rarer thing when the player is already far down the order
      t.passMe = done ? 2.4 + r.rng() * 3.8 + Math.max(0, r.position - 9) * 1.2 : 0.6;
    } else t.passMe = 0.8;
  }

  // 2. a slower car far up the road, which the player will catch
  if (t.slow <= 0) {
    const c = freeCar(r);
    const crowded = r.cars.some((x) => x.active && x.role === "slow" && x.g > 0);
    const gSlow = FOG_FAR + 5 + r.rng() * 25;
    if (c && !crowded && r.virtualAhead > 0 && r.position > 4 && roadIsClear(r, gSlow, 70)) {
      activate(r, c, "slow", "approach", gSlow, 0.64 + r.rng() * 0.07, (r.rng() * 2 - 1) * 2.4, 1);
      c.ahead = true;
      r.virtualAhead--;
      t.slow = 6 + r.rng() * 7 - Math.min(3, Math.max(0, r.position - 9));
    } else t.slow = 1;
  }

  // 3. cars in the distance, so the road ahead is never empty
  if (t.ambient <= 0) {
    const c = freeCar(r);
    const far = r.cars.filter((x) => x.active && x.ahead && x.g > 90).length;
    const gAmbient = FOG_FAR + 20 + r.rng() * 60;
    if (c && far < 2 && r.virtualAhead > 0 && roadIsClear(r, gAmbient, 70)) {
      activate(r, c, "traffic", "cruise", gAmbient, r.pp + (r.rng() * 2 - 1) * 0.012, (r.rng() * 2 - 1) * 3, 1);
      c.ahead = true;
      c.ttl = 6 + r.rng() * 10;
      r.virtualAhead--;
    }
    t.ambient = 3 + r.rng() * 4;
  }

  // 4. the story of each car on the road
  for (const c of r.cars) {
    if (!c.active) continue;
    if (c.role === "passMe") {
      if (c.phase === "closing" && c.g > -9) c.phase = "alongside";
      else if (c.phase === "alongside" && c.g > 15) {
        // clear of the player's nose: pull back onto the line and keep a little extra pace until there is room
        c.phase = "extending";
        c.lane = clamp(lineAt(r.track, c.s, r.tmp) + (r.rng() * 2 - 1) * 1.6, -3.4, 3.4);
        c.pace = Math.min(1.05, r.pp + 0.055);
      } else if (c.phase === "extending" && c.g > 55 + c.slot * 6) {
        // far enough ahead: either settle in at the field's pace, or fall off the pace so the player may take the place back
        if (r.rng() < 0.4 && !r.cars.some((x) => x.active && x.role === "slow" && x.g > 0)) {
          c.role = "slow";
          c.phase = "approach";
          c.pace = r.pp - 0.12 - r.rng() * 0.05;
        } else {
          c.role = "traffic";
          c.phase = "cruise";
          c.pace = r.pp + (r.rng() * 2 - 1) * 0.006;
          c.ttl = 6 + r.rng() * 8;
        }
      }
    } else if (c.role === "slow") {
      if (c.g < -PASSED_AT) c.phase = "passed";
      if (c.phase === "passed" && c.g < -12) {
        c.role = "dropped";
        c.phase = "leaving";
      }
    } else if (c.role === "traffic") {
      c.ttl -= dt;
      if (c.ttl <= 0) {
        c.role = "away";
        c.phase = "leaving";
        c.pace = r.pp + 0.12 + r.rng() * 0.05;
      }
    }
  }
}

/* ------------------------------------------------------------------ keeping cars apart, counting positions, retiring cars */

function bookkeeping(r: Race) {
  const L = r.track.length;
  const p = r.player;
  syncGaps(r);

  // the last line of defence: two cars never overlap, whatever happened above
  const cars = r.cars.filter((c) => c.active);
  const overlaps = (a: { s: number; d: number }, b: { s: number; d: number }) =>
    Math.abs(gap(a.s, b.s, L)) < CAR_LENGTH - 0.3 && Math.abs(b.d - a.d) < CAR_WIDTH + 0.25;
  for (const o of cars) {
    if (overlaps(p, o)) {
      r.stats.contacts++;
      if (Math.abs(gap(p.s, o.s, L)) < 3.5) {
        // alongside: the player is moved aside, towards the road, and never through the barrier
        const away = p.d >= o.d ? 1 : -1;
        let wanted = o.d + away * (CAR_WIDTH + 0.3);
        if (Math.abs(wanted) > EDGE) wanted = o.d - away * (CAR_WIDTH + 0.3);
        p.d = clamp(wanted, -EDGE, EDGE);
        p.latV = 0;
      } else if (gap(p.s, o.s, L) > 0) {
        p.v = Math.min(p.v, o.v * 0.97);
      } else {
        o.v = Math.max(o.v, p.v * 1.03);
      }
    }
  }
  for (let i = 0; i < cars.length; i++) {
    for (let j = i + 1; j < cars.length; j++) {
      if (!overlaps(cars[i], cars[j])) continue;
      r.stats.contacts++;
      const b = cars[j];
      b.d = cars[i].d + (b.d >= cars[i].d ? 1 : -1) * (CAR_WIDTH + 0.3);
      b.latV = 0;
    }
  }

  // the running order changes only when a car's centre goes past the player's
  for (const c of cars) {
    c.g = gap(p.s, c.s, L);
    if (!c.ahead && c.g > PASSED_AT) {
      c.ahead = true;
      const side: Side = c.d >= p.d ? 1 : -1;
      r.stats.passedBy++;
      if (side > 0) r.stats.right++;
      else r.stats.left++;
      r.events.push({ kind: "passed-by", slot: c.slot, side, position: 0 });
    } else if (c.ahead && c.g < -PASSED_AT) {
      c.ahead = false;
      r.stats.passed++;
      r.events.push({ kind: "passed", slot: c.slot, side: c.d >= p.d ? 1 : -1, position: 0 });
    }
  }
  // the order is the field's order, so the cars that are not simulated count too
  r.position = 1 + r.virtualAhead + cars.filter((c) => c.ahead).length;
  for (const e of r.events) if (e.kind !== "lap" && e.position === 0) e.position = r.position;

  // retire cars nobody can see
  for (const c of cars) {
    if ((c.g < -BEHIND && !c.ahead) || c.g > FOG_FAR + (c.role === "away" ? 60 : 190)) retire(r, c);
  }

  const lap = START_LAP + Math.max(0, Math.floor((p.travelled + r.startS) / L) - 1);
  if (lap !== r.lap) {
    r.lap = lap;
    r.events.push({ kind: "lap", lap });
  }
}

/** Advance the race by dt seconds, in steps of at most 1/60 s so the result does not depend on the frame rate. */
export function stepRace(r: Race, dt: number, input: Input): void {
  let left = Math.min(dt, 0.25);
  while (left > 1e-9) {
    const h = Math.min(left, 1 / 60);
    left -= h;
    r.t += h;
    syncGaps(r);
    // the lights: one more every 0.8 s, held, then out, then a moment of green
    let lit = 0;
    for (const at of LIGHTS_AT) if (r.t >= at) lit++;
    r.lights = r.t >= r.outAt ? 0 : lit;
    r.green = r.t >= r.outAt && r.t < r.outAt + GREEN_FOR;
    if (!r.released && r.t >= r.outAt) r.released = true;
    // nothing moves, and nothing can be driven, until the lights go out
    if (r.released) {
      choreograph(r, h);
      stepPlayer(r, h, input);
      for (const c of r.cars) if (c.active) stepCar(r, c, h);
    }
    bookkeeping(r);
  }
}

const GEARS = [0, 70, 105, 145, 190, 232, 272, 306, 340];

/** Gear, 1 to 8, from road speed, with a little hysteresis so it does not flicker on a boundary. */
export function gearFor(kmh: number, previous = 1): number {
  let g = clamp(previous, 1, 8);
  while (g < 8 && kmh > GEARS[g] + 4) g++;
  while (g > 1 && kmh < GEARS[g - 1] - 4) g--;
  return g;
}

/** 0 to 1 through the current gear's range: the rev lights. */
export function revFraction(kmh: number, gear: number): number {
  const lo = GEARS[gear - 1];
  const hi = GEARS[gear];
  return clamp((kmh - lo) / Math.max(hi - lo, 1), 0, 1);
}
