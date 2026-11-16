/**
 * The detail drawn along a circuit, worked out from its sampled outline (see CircuitMap).
 *
 * Kerbs go where the line turns by more than about 23 degrees, on the inside of the turn. They match each circuit's corners
 * closely: Suzuka's 18 corners come out as 14 runs of kerb, because its esses merge. Chevrons go on the straightest stretches,
 * about a dozen to the lap. The worn line follows the curvature, and where the outline crosses itself one pass goes over the other.
 * This is styling of real geometry, not a survey: the map does not claim where a circuit's kerbs, rubber or bridges actually are,
 * and nothing here is read from, or written back to, the data.
 */

type Pt = [number, number];

/** How sharply the line turns is measured over this many samples each side. */
export const TURN_SPAN = 4;
/** Radians of turn over that span above which a stretch gets kerbs. */
export const KERB_TURN = 0.4;
/** Radians of turn below which a stretch counts as straight enough to carry a chevron. */
export const STRAIGHT_TURN = 0.1;
/** Fewest samples that make a sensible outline; fewer and no detail is drawn. */
export const MIN_SAMPLES = 60;
/** Fewest consecutive sharp samples that make a kerb (a single wobble is not a corner). */
export const MIN_KERB_RUN = 3;
/** Radians of turn below which the track is still the start straight, for laying out the grid (a pit straight may bend a little). */
export const GRID_TURN = 0.35;
/** Fewest grid rows worth drawing: a grid that stops short on a bend would look like a stub. */
export const MIN_GRID_ROWS = 6;
/** Two stretches that cross at a shallower angle than this (the sine of it) are one stretch doubling back, not a crossing. */
export const MIN_CROSSING_SIN = 0.3;

/** A run of kerb on the inside of one turn: the samples it follows, and which side of the line of travel the inside is. */
export interface Kerb {
  points: Pt[];
  /** 1 when the turn is to the right (clockwise on screen), -1 when it is to the left. */
  side: 1 | -1;
}

/** A place where the lap crosses itself. The later pass goes over the earlier one, as it does on the real bridge at Suzuka. */
export interface Crossing {
  /** The earlier pass and the later one, as fractions of the lap. */
  under: number;
  over: number;
  /** The sine of the angle they cross at: 1 is square on, near 0 is a graze. */
  sin: number;
}

/** A starting-grid row: where it is, and the direction of travel there in degrees. */
export interface GridRow {
  x: number;
  y: number;
  angle: number;
}

export interface MapDetail {
  /** One run per sharp turn (split where a chicane changes sides), for the kerbs. */
  kerbs: Kerb[];
  /** Places on the straights, with the direction of travel in degrees, for the chevrons. */
  chevrons: { x: number; y: number; angle: number }[];
  /** Position and direction at a fraction of the lap, for marks drawn across the track. */
  at: (fraction: number) => { x: number; y: number; angle: number };
  /** The lap's length in map units. */
  length: number;
  /** Where the lap crosses itself, if it does. */
  crossings: Crossing[];
}

const EPS = 1e-9;
const heading = (a: Pt, b: Pt) => (Math.atan2(b[1] - a[1], b[0] - a[0]) * 180) / Math.PI;
const dist = (a: Pt, b: Pt) => Math.hypot(b[0] - a[0], b[1] - a[1]);

/** The signed turn at each sample, in radians, over `TURN_SPAN` samples each side: positive to the right (clockwise on screen). */
export function signedTurnAt(samples: Pt[]): number[] {
  const n = samples.length;
  const turn = new Array<number>(n).fill(0);
  for (let i = 0; i < n; i++) {
    const before = samples[(i - TURN_SPAN + n) % n];
    const here = samples[i];
    const after = samples[(i + TURN_SPAN) % n];
    let d = Math.atan2(after[1] - here[1], after[0] - here[0]) - Math.atan2(here[1] - before[1], here[0] - before[0]);
    while (d > Math.PI) d -= 2 * Math.PI;
    while (d < -Math.PI) d += 2 * Math.PI;
    turn[i] = d;
  }
  return turn;
}

/** The absolute turn at each sample, in radians. The outline is a closed loop. */
export function turnAt(samples: Pt[]): number[] {
  return signedTurnAt(samples).map(Math.abs);
}

/** The unit normal at each sample, pointing to the right of the line of travel (the inside of a right-hand turn). */
export function normalsOf(samples: Pt[]): Pt[] {
  const n = samples.length;
  return samples.map((_, i) => {
    const a = samples[(i - 1 + n) % n];
    const b = samples[(i + 1) % n];
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
    return [-(b[1] - a[1]) / len, (b[0] - a[0]) / len];
  });
}

/** A polyline path, shifted sideways: positive `by` moves each point to the right of the line of travel. */
export function offsetPath(points: Pt[], by: number, closed = false): string {
  const n = points.length;
  if (n < 2) return "";
  const out: string[] = [];
  for (let i = 0; i < n; i++) {
    const a = points[closed ? (i - 1 + n) % n : Math.max(i - 1, 0)];
    const b = points[closed ? (i + 1) % n : Math.min(i + 1, n - 1)];
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
    const x = points[i][0] - ((b[1] - a[1]) / len) * by;
    const y = points[i][1] + ((b[0] - a[0]) / len) * by;
    out.push(`${i ? "L" : "M"}${x.toFixed(1)} ${y.toFixed(1)}`);
  }
  return out.join("") + (closed ? "Z" : "");
}

/** A moving average round a closed loop, `radius` samples each side. */
function blur(values: number[], radius: number): number[] {
  const n = values.length;
  return values.map((_, i) => {
    let sum = 0;
    for (let d = -radius; d <= radius; d++) sum += values[(i + d + n) % n];
    return sum / (2 * radius + 1);
  });
}

/**
 * The line the cars wear in: hugs the inside at the apex, runs a touch wide before and after, and crosses the middle between
 * corners that turn opposite ways. `reach` is how far from the centre it strays, in map units. It follows the outline's
 * curvature, so it is where a line would go, not a record of where the rubber is.
 */
export function wornLine(samples: Pt[], reach: number, gaps: [number, number][] = []): string {
  const n = samples.length;
  if (n < MIN_SAMPLES) return "";
  const signed = signedTurnAt(samples);
  const clamp = (v: number) => Math.max(-1, Math.min(1, v / 0.5));
  const near = blur(signed, 3).map(clamp);
  const wide = blur(signed, 14).map(clamp);
  const normals = normalsOf(samples);
  const shifted = samples.map((p, i): Pt => {
    const by = reach * (near[i] - 0.45 * wide[i]);
    return [p[0] + normals[i][0] * by, p[1] + normals[i][1] * by];
  });
  // `gaps` are stretches of the lap, as fractions, to leave out: where this line runs under a bridge it must not show on the deck.
  const left = shifted.map((_, i) => gaps.some(([from, to]) => (from <= to ? i / n >= from && i / n <= to : i / n >= from || i / n <= to)));
  if (!left.some(Boolean)) return offsetPath(shifted, 0, true);
  if (left.every(Boolean)) return "";
  const start = left.findIndex(Boolean);
  let d = "";
  let drawing = false;
  for (let k = 1; k <= n; k++) {
    const i = (start + k) % n;
    if (left[i]) {
      drawing = false;
      continue;
    }
    d += `${drawing ? "L" : "M"}${shifted[i][0].toFixed(1)} ${shifted[i][1].toFixed(1)}`;
    drawing = true;
  }
  return d;
}

/** Where the lap crosses itself. Each crossing is found once, with the later pass as `over`. */
export function findCrossings(samples: Pt[]): Crossing[] {
  const n = samples.length;
  if (n < MIN_SAMPLES) return [];
  const at = new Array<number>(n + 1).fill(0);
  for (let i = 0; i < n; i++) at[i + 1] = at[i] + dist(samples[i], samples[(i + 1) % n]);
  const total = at[n] || 1;
  const found: Crossing[] = [];
  for (let i = 0; i < n; i++) {
    const a = samples[i];
    const b = samples[(i + 1) % n];
    const r: Pt = [b[0] - a[0], b[1] - a[1]];
    for (let j = i + 2; j < n; j++) {
      if (i === 0 && j === n - 1) continue; // these two meet at the start line
      const c = samples[j];
      const e = samples[(j + 1) % n];
      const q: Pt = [e[0] - c[0], e[1] - c[1]];
      const den = r[0] * q[1] - r[1] * q[0];
      if (Math.abs(den) < 1e-9) continue;
      const t = ((c[0] - a[0]) * q[1] - (c[1] - a[1]) * q[0]) / den;
      const u = ((c[0] - a[0]) * r[1] - (c[1] - a[1]) * r[0]) / den;
      // a crossing that lands exactly on a sample belongs to the segment that starts there, once, whatever the rounding
      if (t < -EPS || t >= 1 - EPS || u < -EPS || u >= 1 - EPS) continue;
      const sin = Math.abs(den) / (Math.hypot(r[0], r[1]) * Math.hypot(q[0], q[1]));
      if (sin < MIN_CROSSING_SIN) continue;
      found.push({ under: (at[i] + t * (at[i + 1] - at[i])) / total, over: (at[j] + u * (at[j + 1] - at[j])) / total, sin });
    }
  }
  return found;
}

/**
 * The starting grid: `rows` places behind the start line, `spacing` map units apart along the line, for as long as the track
 * stays straight. The start is the sample at index `from`.
 */
export function gridRows(samples: Pt[], from: number, rows: number, spacing: number, limit = GRID_TURN): GridRow[] {
  const n = samples.length;
  if (n < MIN_SAMPLES || spacing <= 0 || from < 0) return [];
  const turn = turnAt(samples);
  const out: GridRow[] = [];
  let walked = 0;
  let want = spacing;
  for (let k = 0; k < n && out.length < rows; k++) {
    const i = (from - k + n * 2) % n;
    const prev = (i - 1 + n) % n;
    if (turn[i] > limit) break;
    const step = dist(samples[prev], samples[i]);
    while (walked + step >= want && out.length < rows) {
      const f = (want - walked) / (step || 1);
      out.push({
        x: samples[i][0] + (samples[prev][0] - samples[i][0]) * f,
        y: samples[i][1] + (samples[prev][1] - samples[i][1]) * f,
        angle: heading(samples[prev], samples[(i + 1) % n]),
      });
      want += spacing;
    }
    walked += step;
  }
  return out;
}

/** The sample nearest to a point, or -1 when there are none. */
export function nearestSample(samples: Pt[], x: number, y: number): number {
  let best = -1;
  let bestD = Infinity;
  samples.forEach((p, i) => {
    const d = (p[0] - x) ** 2 + (p[1] - y) ** 2;
    if (d < bestD) {
      bestD = d;
      best = i;
    }
  });
  return best;
}

export function circuitDetail(samples: Pt[]): MapDetail {
  const n = samples.length;
  const at = (fraction: number) => {
    if (n === 0) return { x: 0, y: 0, angle: 0 };
    const i = ((Math.round(fraction * n) % n) + n) % n;
    return { x: samples[i][0], y: samples[i][1], angle: heading(samples[(i - 1 + n) % n], samples[(i + 1) % n]) };
  };
  if (n < MIN_SAMPLES) return { kerbs: [], chevrons: [], at, length: 0, crossings: [] };

  const signed = signedTurnAt(samples);
  const turn = signed.map(Math.abs);
  let length = 0;
  for (let i = 0; i < n; i++) length += dist(samples[i], samples[(i + 1) % n]);

  // Runs of samples that turn sharply the same way, found starting from a straight one so a run that crosses the start line is
  // whole. A chicane that flips from left to right is two runs, each with its kerb on its own inside.
  const kerbs: Kerb[] = [];
  const first = turn.findIndex((t) => t <= KERB_TURN);
  if (first >= 0) {
    let from = -1;
    let side = 0;
    const close = (j: number) => {
      if (from < 0) return;
      if (j - from >= MIN_KERB_RUN) {
        const points: Pt[] = [];
        for (let k = from - 2; k <= j - 1 + 2; k++) points.push(samples[(first + k + n * 2) % n]);
        kerbs.push({ points, side: side > 0 ? 1 : -1 });
      }
      from = -1;
    };
    for (let j = 1; j <= n; j++) {
      const i = (first + j) % n;
      const sharp = turn[i] > KERB_TURN;
      const way = Math.sign(signed[i]);
      if (sharp && from >= 0 && way !== Math.sign(side)) close(j);
      if (sharp && from < 0) {
        from = j;
        side = 0;
      }
      if (sharp && from >= 0) side += signed[i];
      if (!sharp || j === n) close(j);
    }
  }

  const chevrons: MapDetail["chevrons"] = [];
  const step = Math.round(n / 12);
  for (let base = Math.round(step / 3); base < n; base += step) {
    let best = base % n;
    for (let d = -9; d <= 9; d++) {
      const i = (base + d + n) % n;
      if (turn[i] < turn[best]) best = i;
    }
    if (turn[best] > STRAIGHT_TURN) continue;
    chevrons.push({ x: samples[best][0], y: samples[best][1], angle: heading(samples[(best - 1 + n) % n], samples[(best + 1) % n]) });
  }
  return { kerbs, chevrons, at, length, crossings: findCrossings(samples) };
}
