import { curvatureAt } from "./driving.ts";

/**
 * Track Attack: Grand Prix. A small, deterministic race game on a real circuit outline.
 *
 * Illustrative, and labelled so. Rival pace comes from two things known before the start of the chosen race: each
 * driver's podium score from the model and their starting-grid slot. It is a game rule, not telemetry, and it never
 * looks at what happened in the real race. Handling follows the same simple rule as the solo time attack: grip falls
 * with track curvature, so a car has to lift before a tight corner or it loses time.
 *
 * No framework imports: the module is plain TypeScript so it can be tested under Node. Speeds are in laps per second.
 */

/* ------------------------------------------------------------------ constants */

export const TOP = 0.07;
export const ACCEL = 0.036;
export const BRAKE = 0.06;
/** Rivals brake earlier than the physical limit, so a driver who brakes later can gain time and an on-limit driver has margin. */
export const PROFILE_BRAKE = BRAKE * 0.7;
const SAFE_BASE = 0.0725;
const SAFE_SLOPE = 0.0525;
const V_MIN = 0.02;
/** Gap between grid slots, in fractions of a lap. */
export const GRID_GAP = 0.01;
const INCIDENT_CURVE = 0.2;
const INCIDENT_SLOW = 0.5;
const INCIDENT_COOLDOWN = 0.045;
/** After running wide the car crawls back onto the track: capped at this share of top speed for this many seconds. */
const RECOVERY_SECONDS = 1.4;
const RECOVERY_SPEED = 0.4;
/** Chance that a given rival makes a driving error on a given lap, and how much speed it costs. */
export const MISTAKE_RATE = 0.07;
const MISTAKE_SLOW = 0.55;
/** Slipstream: a car this close behind another (in laps) is pulled along. */
export const DRAFT_RANGE = 0.03;
const DRAFT_TOP = 1.03;
const DRAFT_CORNER = 1.015;

export type Assist = "assisted" | "standard" | "hard";

export const ASSISTS: Record<Assist, { label: string; blurb: string; tolerance: number; rivalEdge: number }> = {
  assisted: {
    label: "Assisted",
    blurb: "The car brakes for corners by itself. You only choose when to accelerate.",
    tolerance: Infinity,
    rivalEdge: 1,
  },
  standard: {
    label: "Standard",
    blurb: "You brake. Arrive at a tight corner too fast and the car runs wide and loses speed.",
    tolerance: 1.08,
    rivalEdge: 1,
  },
  hard: {
    label: "Hard",
    blurb: "Less margin for error, and the rivals are a little faster.",
    tolerance: 1.04,
    rivalEdge: 1.01,
  },
};

/** Points by finishing position under the current Formula 1 scoring. A rule of the sport, shown for the finish. */
export const POINTS = [25, 18, 15, 12, 10, 8, 6, 4, 2, 1] as const;
export const pointsFor = (position: number): number => POINTS[position - 1] ?? 0;

/* ------------------------------------------------------------------ entrants and pace */

export interface Entrant {
  id: number;
  code: string;
  name: string;
  last: string;
  team: string;
  colour: string;
  ink: string;
  number: number | null;
  /** Starting-grid slot, null for a pit-lane start. */
  grid: number | null;
  /** Podium score from the model, known before the start. */
  score: number;
  /** Illustrative pace rating, 0 to 1, from score and grid slot only. */
  rating: number;
}

/** What the page's race rows provide. Only pre-race fields are read, so no outcome can reach the game. */
export interface EntrantSource {
  driver: { id: number; code: string; name: string; last: string };
  team: { short: string };
  colour: string;
  ink: string;
  score: number;
  grid: number | null;
  entry: { n: number | null };
}

const clamp = (value: number, low: number, high: number) => Math.min(high, Math.max(low, value));

/** Pace rating: 70% the model's podium score, 30% how near the front the driver starts. A pit-lane start counts as last. */
export function ratingFor(score: number, grid: number | null, field: number): number {
  const front = grid === null ? 0 : 1 - (grid - 1) / Math.max(1, field - 1);
  return clamp(0.7 * clamp(score, 0, 1) + 0.3 * clamp(front, 0, 1), 0, 1);
}

export function entrantsFrom(rows: readonly EntrantSource[]): Entrant[] {
  return rows.map((row) => ({
    id: row.driver.id,
    code: row.driver.code,
    name: row.driver.name,
    last: row.driver.last,
    team: row.team.short,
    colour: row.colour,
    ink: row.ink,
    number: row.entry.n,
    grid: row.grid,
    score: row.score,
    rating: ratingFor(row.score, row.grid, rows.length),
  }));
}

/** Frontrunner, midfield or backmarker, by where the rating sits in this field. */
export function tierOf(entrant: Entrant, field: readonly Entrant[]): "Frontrunner" | "Midfield" | "Backmarker" {
  const better = field.filter((e) => e.rating > entrant.rating).length;
  const share = better / Math.max(1, field.length);
  return share < 0.25 ? "Frontrunner" : share >= 0.75 ? "Backmarker" : "Midfield";
}

const topSpeed = (e: Entrant) => TOP * (0.9 + 0.1 * e.rating);
const acceleration = (e: Entrant) => ACCEL * (0.9 + 0.1 * e.rating);
const skill = (e: Entrant, assist: Assist) => Math.min(1, (0.91 + 0.085 * e.rating) * ASSISTS[assist].rivalEdge);

/* ------------------------------------------------------------------ track */

export interface TrackModel {
  n: number;
  curvature: number[];
  /** The fastest a car can take each point without running wide. */
  safe: number[];
  /** The fastest a rival drives each point, after braking early enough for the corners ahead. */
  profile: number[];
}

export function buildTrack(samples: [number, number][]): TrackModel {
  const n = samples.length;
  const curvature = samples.map((_, k) => curvatureAt(samples, n > 1 ? k / (n - 1) : 0));
  const safe = curvature.map((c) => Math.min(TOP, SAFE_BASE - SAFE_SLOPE * c));
  const profile = [...safe];
  const ds = 1 / n;
  // Braking pass: be slow enough here to be able to slow to the next point. Repeat around the loop so the start line wraps.
  for (let pass = 0; pass < 3; pass++) {
    for (let k = n - 1; k >= 0; k--) {
      const next = profile[(k + 1) % n];
      profile[k] = Math.max(V_MIN, Math.min(profile[k], Math.sqrt(next * next + 2 * PROFILE_BRAKE * ds)));
    }
  }
  return { n, curvature, safe, profile };
}

const indexAt = (s: number, n: number) => Math.min(n - 1, Math.floor((s - Math.floor(s)) * n));

/* ------------------------------------------------------------------ deterministic variation */

/** A hash of three integers to [0, 1), so any (seed, car, lap) always gives the same number without carrying state. */
export function unit(seed: number, a: number, b: number, salt = 0): number {
  let h = (seed ^ 0x9e3779b9) >>> 0;
  for (const v of [a, b, salt]) {
    h = Math.imul(h ^ (v | 0), 0x85ebca6b) >>> 0;
    h ^= h >>> 13;
    h = Math.imul(h, 0xc2b2ae35) >>> 0;
    h ^= h >>> 16;
  }
  return (h >>> 0) / 4294967296;
}

const jitter = (seed: number, id: number, lap: number) => 1 + (unit(seed, id, lap, 1) - 0.5) * 0.008;

/** How a driver's whole race goes relative to their rating: a fixed, seeded 3% either way. */
const form = (seed: number, id: number) => 1 + (unit(seed, id, 0, 4) - 0.5) * 0.03;

/** Where on the given lap this rival makes a driving error, as a fraction of the lap, or null for a clean lap. */
export function mistakeAt(seed: number, id: number, lap: number): number | null {
  return unit(seed, id, lap, 2) < MISTAKE_RATE ? 0.1 + 0.8 * unit(seed, id, lap, 3) : null;
}

/* ------------------------------------------------------------------ race state */

export interface Car {
  /** Distance in laps from the start line. Negative on the grid. */
  s: number;
  v: number;
  incidents: number;
  mistakes: number;
  finishedAt: number | null;
  retired: boolean;
  lastIncidentS: number;
  lastMistakeLap: number;
  /** Race time until which the car is still recovering from running wide. */
  recoverUntil: number;
}

export interface RaceConfig {
  laps: number;
  seed: number;
  playerId: number | null;
  assist: Assist;
}

export interface RaceState {
  t: number;
  entrants: readonly Entrant[];
  cars: readonly Car[];
  config: RaceConfig;
  track: TrackModel;
  /** Events since the last step, for the interface to announce. */
  events: RaceEvent[];
}

export type RaceEvent =
  | { kind: "incident"; id: number }
  | { kind: "mistake"; id: number }
  | { kind: "finish"; id: number; position: number };

/** Grid order: slot 1 is nearest the line, pit-lane starters last, ties by driver id. */
export function gridOrder(entrants: readonly Entrant[]): number[] {
  return entrants.map((_, i) => i).sort((a, b) => (entrants[a].grid ?? 99) - (entrants[b].grid ?? 99) || entrants[a].id - entrants[b].id);
}

export function initialRace(entrants: readonly Entrant[], track: TrackModel, config: RaceConfig): RaceState {
  const slot = new Map(gridOrder(entrants).map((index, i) => [index, i + 1]));
  return {
    t: 0,
    entrants,
    track,
    config,
    events: [],
    cars: entrants.map((_, i) => ({ s: -(slot.get(i) ?? 1) * GRID_GAP, v: 0, incidents: 0, mistakes: 0, finishedAt: null, retired: false, lastIncidentS: -1, lastMistakeLap: -1, recoverUntil: 0 })),
  };
}

/** Indices into entrants, in running order: finishers by time, then everyone else by distance covered. */
export function orderOf(state: RaceState): number[] {
  const { cars, entrants } = state;
  return cars
    .map((_, i) => i)
    .sort((a, b) => {
      const ca = cars[a];
      const cb = cars[b];
      if (ca.retired !== cb.retired) return ca.retired ? 1 : -1;
      if (ca.finishedAt !== null && cb.finishedAt !== null) return ca.finishedAt - cb.finishedAt || entrants[a].id - entrants[b].id;
      if (ca.finishedAt !== null) return -1;
      if (cb.finishedAt !== null) return 1;
      return cb.s - ca.s || entrants[a].id - entrants[b].id;
    });
}

export const lapOf = (car: Car, laps: number): number => Math.min(laps, Math.max(1, Math.floor(car.s) + 1));

/**
 * Advance the race by dt seconds. `throttle` is the player's input and is ignored for everyone else. Pure: returns a
 * new state and lists what happened in `events`.
 */
export function stepRace(state: RaceState, throttle: boolean, dt: number): RaceState {
  const { config, track, entrants } = state;
  const events: RaceEvent[] = [];
  let finishedSoFar = state.cars.filter((c) => c.finishedAt !== null).length;
  // Distance to the nearest car in front, from the positions at the start of the step, for the slipstream.
  const ahead = state.cars.map((car) => {
    let nearest = Infinity;
    for (const other of state.cars) if (other !== car && !other.retired && other.s > car.s) nearest = Math.min(nearest, other.s - car.s);
    return nearest;
  });
  const cars = state.cars.map((car, i): Car => {
    if (car.finishedAt !== null || car.retired) return car;
    const e = entrants[i];
    const idx = indexAt(car.s, track.n);
    const lap = Math.max(0, Math.floor(car.s));
    const drafting = car.s > 0 && ahead[i] < DRAFT_RANGE;
    let v = car.v;
    let incidents = car.incidents;
    let mistakes = car.mistakes;
    let lastIncidentS = car.lastIncidentS;
    let lastMistakeLap = car.lastMistakeLap;
    let recoverUntil = car.recoverUntil;

    if (e.id === config.playerId) {
      if (config.assist === "assisted") {
        const cap = Math.min(topSpeed(e) * (drafting ? DRAFT_TOP : 1), track.profile[idx] * (drafting ? DRAFT_CORNER : 1));
        v = Math.min(cap, Math.max(V_MIN, v + (throttle ? acceleration(e) : -BRAKE) * dt));
      } else {
        v = Math.min(topSpeed(e) * (drafting ? DRAFT_TOP : 1), Math.max(V_MIN, v + (throttle ? acceleration(e) : -BRAKE) * dt));
        const tolerance = ASSISTS[config.assist].tolerance;
        const cooled = lastIncidentS < 0 || car.s - lastIncidentS > INCIDENT_COOLDOWN;
        if (track.curvature[idx] > INCIDENT_CURVE && v > track.safe[idx] * tolerance && cooled && car.s > 0) {
          v *= INCIDENT_SLOW;
          incidents++;
          lastIncidentS = car.s;
          recoverUntil = state.t + RECOVERY_SECONDS;
          events.push({ kind: "incident", id: e.id });
        }
      }
    } else {
      const pace = jitter(config.seed, e.id, lap) * form(config.seed, e.id);
      const target = Math.min(topSpeed(e) * pace * (drafting ? DRAFT_TOP : 1), track.profile[idx] * skill(e, config.assist) * pace * (drafting ? DRAFT_CORNER : 1));
      v = v + clamp(target - v, -BRAKE * dt, acceleration(e) * dt);
      const at = lap > lastMistakeLap && car.s > 0 ? mistakeAt(config.seed, e.id, lap) : null;
      if (at !== null && car.s - lap >= at) {
        v *= MISTAKE_SLOW;
        mistakes++;
        lastMistakeLap = lap;
        events.push({ kind: "mistake", id: e.id });
      }
    }

    if (state.t < recoverUntil) v = Math.min(v, TOP * RECOVERY_SPEED);
    const next = car.s + v * dt;
    if (next >= config.laps) {
      const crossed = state.t + dt * ((config.laps - car.s) / Math.max(1e-9, next - car.s));
      finishedSoFar++;
      events.push({ kind: "finish", id: e.id, position: finishedSoFar });
      return { ...car, s: config.laps, v, incidents, mistakes, finishedAt: crossed, lastIncidentS, lastMistakeLap, recoverUntil };
    }
    return { ...car, s: next, v, incidents, mistakes, lastIncidentS, lastMistakeLap, recoverUntil };
  });
  return { ...state, t: state.t + dt, cars, events };
}

export const isOver = (state: RaceState): boolean => state.cars.every((c) => c.finishedAt !== null || c.retired);
export const playerIndex = (state: RaceState): number => state.entrants.findIndex((e) => e.id === state.config.playerId);
export const playerDone = (state: RaceState): boolean => {
  const i = playerIndex(state);
  return i < 0 || state.cars[i].finishedAt !== null || state.cars[i].retired;
};

/** The player leaves the race. They are classified last. */
export function retirePlayer(state: RaceState): RaceState {
  const i = playerIndex(state);
  if (i < 0) return state;
  return { ...state, cars: state.cars.map((c, j) => (j === i ? { ...c, retired: true } : c)) };
}

/** Run the rest of the race for the rivals, with the player already finished or retired. Capped so it always ends. */
export function finishRace(state: RaceState, dt = 0.1, capSeconds = 900): RaceState {
  let s = state;
  while (!isOver(s) && s.t < capSeconds) s = stepRace(s, false, dt);
  return s;
}

/* ------------------------------------------------------------------ results */

export interface Classified {
  entrant: Entrant;
  position: number;
  finished: boolean;
  retired: boolean;
  time: number | null;
  /** Seconds behind the winner for a finisher. */
  gap: number | null;
  lapsDown: number;
  /** Places gained against the grid (positive) or lost (negative); null for a pit-lane start. */
  gained: number | null;
  points: number;
  incidents: number;
}

export function classify(state: RaceState): Classified[] {
  const order = orderOf(state);
  const winner = state.cars[order[0]];
  const gridPos = new Map(gridOrder(state.entrants).map((index, i) => [index, i + 1]));
  return order.map((index, i) => {
    const car = state.cars[index];
    const entrant = state.entrants[index];
    const finished = car.finishedAt !== null;
    const position = i + 1;
    return {
      entrant,
      position,
      finished,
      retired: car.retired,
      time: car.finishedAt,
      gap: finished && winner.finishedAt !== null ? (car.finishedAt as number) - winner.finishedAt : null,
      lapsDown: finished ? 0 : Math.max(0, Math.ceil(state.config.laps - car.s)),
      gained: entrant.grid === null ? null : (gridPos.get(index) ?? position) - position,
      points: finished ? pointsFor(position) : 0,
      incidents: car.incidents,
    };
  });
}

export type OutcomeKind = "win" | "podium" | "points" | "outside" | "retired";

export function outcomeFor(c: Classified, field: number): { kind: OutcomeKind; headline: string; detail: string } {
  if (c.retired) return { kind: "retired", headline: "You retired", detail: "You left the race before the flag." };
  const moved =
    c.gained === null
      ? "You started from the pit lane."
      : c.gained > 0
        ? `You gained ${c.gained} ${c.gained === 1 ? "place" : "places"} from the grid.`
        : c.gained < 0
          ? `You lost ${-c.gained} ${c.gained === -1 ? "place" : "places"} from the grid.`
          : "You finished where you started.";
  if (c.position === 1) return { kind: "win", headline: "Victory", detail: `You won the Grand Prix. ${moved}` };
  if (c.position <= 3) return { kind: "podium", headline: "Podium", detail: `You finished P${c.position} of ${field}. ${moved}` };
  if (c.points > 0) return { kind: "points", headline: "In the points", detail: `P${c.position} of ${field}, worth ${c.points} ${c.points === 1 ? "point" : "points"}. ${moved}` };
  return { kind: "outside", headline: "Outside the points", detail: `P${c.position} of ${field}. ${moved}` };
}

/* ------------------------------------------------------------------ live readouts */

/** Rough time gap in seconds from one car to another, at the first car's current speed. */
export function gapSeconds(state: RaceState, from: number, to: number): number {
  const a = state.cars[from];
  const b = state.cars[to];
  return Math.abs(b.s - a.s) / Math.max(V_MIN, a.v);
}

/**
 * Should the player be braking now? True when, with the car's own maximum braking, there is only just enough road left to
 * slow to the tight corner ahead (with a margin for reaction time). Used for the on-screen braking cue.
 */
export function brakeCue(track: TrackModel, s: number, v: number): boolean {
  const reach = 0.08;
  const steps = 16;
  for (let k = 1; k <= steps; k++) {
    const d = (reach * k) / steps;
    const idx = indexAt(s + d, track.n);
    if (track.curvature[idx] <= INCIDENT_CURVE) continue;
    const limit = track.safe[idx] * 1.04;
    if (v * v > limit * limit + 2 * BRAKE * d * 0.8) return true;
  }
  return false;
}

/* ------------------------------------------------------------------ saved record */

export interface GpRecord {
  races: number;
  wins: number;
  podiums: number;
  points: number;
  /** Best finishing position per race id. */
  best: Record<string, number>;
}

export const EMPTY_RECORD: GpRecord = { races: 0, wins: 0, podiums: 0, points: 0, best: {} };

/** A stored record is trusted only if every field is a whole non-negative number; anything else is treated as empty. */
export function parseRecord(value: string | null): GpRecord {
  if (!value) return { ...EMPTY_RECORD, best: {} };
  try {
    const parsed = JSON.parse(value) as Partial<GpRecord> | null;
    const whole = (n: unknown) => typeof n === "number" && Number.isInteger(n) && n >= 0;
    if (!parsed || !whole(parsed.races) || !whole(parsed.wins) || !whole(parsed.podiums) || !whole(parsed.points) || typeof parsed.best !== "object" || parsed.best === null) return { ...EMPTY_RECORD, best: {} };
    const best: Record<string, number> = {};
    for (const [key, v] of Object.entries(parsed.best)) if (/^\d+$/.test(key) && typeof v === "number" && Number.isInteger(v) && v >= 1) best[key] = v;
    return { races: parsed.races as number, wins: parsed.wins as number, podiums: parsed.podiums as number, points: parsed.points as number, best };
  } catch {
    return { ...EMPTY_RECORD, best: {} };
  }
}

export function addResult(record: GpRecord, raceId: number, position: number, points: number): GpRecord {
  const key = String(raceId);
  const previous = record.best[key];
  return {
    races: record.races + 1,
    wins: record.wins + (position === 1 ? 1 : 0),
    podiums: record.podiums + (position <= 3 ? 1 : 0),
    points: record.points + points,
    best: { ...record.best, [key]: previous === undefined ? position : Math.min(previous, position) },
  };
}
