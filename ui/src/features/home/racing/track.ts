/**
 * The fictional circuit the onboard preview drives round, as plain numbers.
 *
 * It is a closed centripetal Catmull-Rom spline through hand-placed waypoints, resampled every 2 m so that "distance along the
 * lap" (s) is the one coordinate everything else uses: cars are an (s, d) pair, where d is the sideways offset from the centre
 * line (positive to the driver's right). Nothing here imports three.js, so the traffic model and its tests run in plain Node.
 *
 * The circuit is invented. It is not any real track, and nothing on it is telemetry.
 */

export interface TrackPoint {
  /** Distance along the lap, metres, in [0, length). */
  s: number;
  x: number;
  /** Height of the road surface. */
  y: number;
  z: number;
  /** Unit tangent in the ground plane (the direction of travel). */
  tx: number;
  tz: number;
  /** Unit vector to the driver's right in the ground plane: (-tz, tx). */
  rx: number;
  rz: number;
  /** Signed curvature in 1/m: positive turns right, negative turns left. */
  curv: number;
}

export interface Corner {
  /** Distance of the middle of the corner. */
  apex: number;
  from: number;
  to: number;
  /** +1 right-hander, -1 left-hander. */
  side: 1 | -1;
  /** Tightest radius inside the corner, metres. */
  radius: number;
}

/** Waypoints (metres) of a clockwise circuit: a 1 km main straight, a long back straight, one hairpin and a chicane. */
const WAYPOINTS: readonly (readonly [number, number])[] = [
  [-420, 0], [-200, 0], [60, 0], [330, 0], [560, 0], [700, 4],
  // turn 1 to 3: a braking zone into a quick right, left, right
  [790, 42], [830, 118], [800, 190], [724, 226], [660, 290],
  // turn 4 to 6: a long right-hander that opens onto the back straight
  [680, 382], [640, 470], [540, 512],
  // the back straight, westbound, with a flat-out left-right kink
  [380, 520], [220, 540], [70, 522], [-60, 530],
  // turn 7: the hairpin
  [-190, 548], [-262, 604], [-250, 690], [-170, 716],
  // turn 8 to 10: a fast left-right-left sequence
  [-80, 690], [0, 650], [66, 664], [112, 724], [60, 790],
  [-60, 826], [-250, 836], [-420, 790],
  // turn 11 to 13: the long left that feeds the main straight
  [-560, 690], [-610, 540], [-590, 380], [-520, 250], [-470, 110],
];

/** Gentle undulation: whole numbers of waves per lap keep the height continuous at the line. */
const HILLS = [
  { amp: 2.4, waves: 3, phase: 0.6 },
  { amp: 1.1, waves: 7, phase: 2.1 },
] as const;

/** Reference speeds: top speed on a straight, the grip limit in a corner, and how hard a car can brake or accelerate. */
const V_MAX = 86; // 310 km/h
const A_LAT = 36; // m/s^2, with downforce
const A_BRAKE = 42;
const A_ACCEL = 11;
const STEP = 2;

export const TRACK_HALF_WIDTH = 7;

type V2 = readonly [number, number];

/** Centripetal Catmull-Rom (Barry and Goldman): passes through every waypoint and never loops or cusps. */
function crPoint(p0: V2, p1: V2, p2: V2, p3: V2, t: number): V2 {
  const d = (a: V2, b: V2) => Math.pow(Math.hypot(b[0] - a[0], b[1] - a[1]), 0.5);
  const t0 = 0;
  const t1 = t0 + d(p0, p1);
  const t2 = t1 + d(p1, p2);
  const t3 = t2 + d(p2, p3);
  const tt = t1 + t * (t2 - t1);
  const mix = (a: V2, b: V2, ta: number, tb: number): V2 => {
    const k = tb === ta ? 0 : (tt - ta) / (tb - ta);
    return [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k];
  };
  const a1 = mix(p0, p1, t0, t1);
  const a2 = mix(p1, p2, t1, t2);
  const a3 = mix(p2, p3, t2, t3);
  const b1 = mix(a1, a2, t0, t2);
  const b2 = mix(a2, a3, t1, t3);
  return mix(b1, b2, t1, t2);
}

export interface Track {
  length: number;
  step: number;
  count: number;
  halfWidth: number;
  /** The road at distance s (wraps round the lap). */
  at(s: number): TrackPoint;
  /** Same, written into a caller-owned object so the per-frame code allocates nothing. */
  into(s: number, out: TrackPoint): TrackPoint;
  /** The speed a car can hold at s, m/s: the top speed on a straight, less where it has to brake or turn. */
  limit(s: number): number;
  /** Metres from s to the next corner that needs real braking (0 inside one). */
  runway(s: number): number;
  corners: Corner[];
  /** The longest flat-out run: where the lap starts, and how long it is. */
  straight: { from: number; length: number };
  /** The raw table, for building geometry. */
  table: readonly TrackPoint[];
}

export const wrap = (s: number, length: number): number => ((s % length) + length) % length;

/** The signed shortest distance from a to b round a lap of this length, in (-length/2, length/2]. */
export const gap = (from: number, to: number, length: number): number => {
  let d = (to - from) % length;
  if (d > length / 2) d -= length;
  else if (d <= -length / 2) d += length;
  return d;
};

function build(): Track {
  // 1. A dense polyline along the spline
  const n = WAYPOINTS.length;
  const dense: V2[] = [];
  const PER = 48;
  for (let i = 0; i < n; i++) {
    const p0 = WAYPOINTS[(i - 1 + n) % n];
    const p1 = WAYPOINTS[i];
    const p2 = WAYPOINTS[(i + 1) % n];
    const p3 = WAYPOINTS[(i + 2) % n];
    for (let k = 0; k < PER; k++) dense.push(crPoint(p0, p1, p2, p3, k / PER));
  }
  // 2. Arc length, then resample every STEP metres. The start of the lap is the point nearest (0, 0) on the main straight.
  const cum: number[] = [0];
  for (let i = 1; i <= dense.length; i++) {
    const a = dense[i - 1];
    const b = dense[i % dense.length];
    cum.push(cum[i - 1] + Math.hypot(b[0] - a[0], b[1] - a[1]));
  }
  const total = cum[cum.length - 1];
  const count = Math.round(total / STEP);
  const length = count * STEP;
  const pts: V2[] = [];
  let j = 0;
  for (let i = 0; i < count; i++) {
    const target = (i / count) * total;
    while (cum[j + 1] < target) j++;
    const k = (target - cum[j]) / (cum[j + 1] - cum[j] || 1);
    const a = dense[j % dense.length];
    const b = dense[(j + 1) % dense.length];
    pts.push([a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k]);
  }
  // rotate so that s = 0 is where the line crosses x = 0 on the main straight
  let start = 0;
  let best = Infinity;
  for (let i = 0; i < count; i++) {
    const [x, z] = pts[i];
    const score = Math.abs(x) + Math.abs(z) * 3;
    if (score < best) {
      best = score;
      start = i;
    }
  }
  const ring: V2[] = Array.from({ length: count }, (_, i) => pts[(i + start) % count]);

  // 3. Tangents from a centred difference over a few samples, curvature from the turn of the tangent, both smoothed a little
  const W = 3;
  const tan: V2[] = ring.map((_, i) => {
    const a = ring[(i - W + count) % count];
    const b = ring[(i + W) % count];
    const dx = b[0] - a[0];
    const dz = b[1] - a[1];
    const m = Math.hypot(dx, dz) || 1;
    return [dx / m, dz / m];
  });
  const rawCurv = ring.map((_, i) => {
    const a = tan[(i - 2 + count) % count];
    const b = tan[(i + 2) % count];
    const dx = b[0] - a[0];
    const dz = b[1] - a[1];
    const t = tan[i];
    // right = (-tz, tx); the tangent moving towards it is a right-hander
    return (dx * -t[1] + dz * t[0]) / (4 * STEP);
  });
  const curv = rawCurv.map((_, i) => {
    let sum = 0;
    let weight = 0;
    for (let k = -3; k <= 3; k++) {
      const w = 4 - Math.abs(k);
      sum += rawCurv[(i + k + count) % count] * w;
      weight += w;
    }
    return sum / weight;
  });

  // 4. The reference speed: what the grip allows, then braking and acceleration limits applied twice round the closed lap
  const lim = curv.map((k) => Math.min(V_MAX, Math.sqrt(A_LAT / Math.max(Math.abs(k), 1e-5))));
  for (let pass = 0; pass < 2; pass++) {
    for (let i = count * 2 - 1; i >= 0; i--) {
      const a = i % count;
      const b = (i + 1) % count;
      lim[a] = Math.min(lim[a], Math.sqrt(lim[b] * lim[b] + 2 * A_BRAKE * STEP));
    }
    for (let i = 0; i < count * 2; i++) {
      const a = i % count;
      const b = (i + 1) % count;
      lim[b] = Math.min(lim[b], Math.sqrt(lim[a] * lim[a] + 2 * A_ACCEL * STEP));
    }
  }

  const table: TrackPoint[] = ring.map(([x, z], i) => {
    const s = i * STEP;
    let y = 0;
    for (const h of HILLS) y += h.amp * Math.sin((2 * Math.PI * h.waves * s) / length + h.phase);
    const [tx, tz] = tan[i];
    return { s, x, y, z, tx, tz, rx: -tz, rz: tx, curv: curv[i] };
  });

  // 5. Corners: runs of the lap that are slower than 78% of top speed
  const corners: Corner[] = [];
  const slow = lim.map((v) => v < V_MAX * 0.78);
  let first = slow.findIndex((v) => !v);
  if (first < 0) first = 0;
  for (let c = 0; c < count; ) {
    const i = (first + c) % count;
    if (!slow[i]) {
      c++;
      continue;
    }
    let len = 0;
    let minR = Infinity;
    let sumK = 0;
    let apexIdx = i;
    let apexK = 0;
    while (len < count && slow[(i + len) % count]) {
      const k = curv[(i + len) % count];
      sumK += k;
      if (Math.abs(k) > apexK) {
        apexK = Math.abs(k);
        apexIdx = (i + len) % count;
      }
      minR = Math.min(minR, 1 / Math.max(Math.abs(k), 1e-6));
      len++;
    }
    corners.push({ apex: apexIdx * STEP, from: i * STEP, to: ((i + len) % count) * STEP, side: sumK >= 0 ? 1 : -1, radius: minR });
    c += len;
  }

  // the longest run at full speed
  let bestFrom = 0;
  let bestLen = 0;
  const fast = lim.map((v) => v >= V_MAX * 0.97);
  const firstSlow = fast.findIndex((f) => !f);
  for (let c = 0; c < count; ) {
    const i = (Math.max(firstSlow, 0) + c) % count;
    if (!fast[i]) {
      c++;
      continue;
    }
    let len = 0;
    while (len < count && fast[(i + len) % count]) len++;
    if (len > bestLen) {
      bestLen = len;
      bestFrom = i;
    }
    c += len;
  }

  // runway: how far to the next real braking zone
  const runwayTable = new Float32Array(count);
  let ahead = 0;
  for (let i = count * 2 - 1; i >= 0; i--) {
    const a = i % count;
    ahead = lim[a] < V_MAX * 0.84 ? 0 : ahead + STEP;
    if (i < count) runwayTable[a] = ahead;
  }

  const at = (s: number, out: TrackPoint): TrackPoint => {
    const f = wrap(s, length) / STEP;
    const i = Math.floor(f);
    const k = f - i;
    const a = table[i % count];
    const b = table[(i + 1) % count];
    out.s = wrap(s, length);
    out.x = a.x + (b.x - a.x) * k;
    out.y = a.y + (b.y - a.y) * k;
    out.z = a.z + (b.z - a.z) * k;
    let tx = a.tx + (b.tx - a.tx) * k;
    let tz = a.tz + (b.tz - a.tz) * k;
    const m = Math.hypot(tx, tz) || 1;
    tx /= m;
    tz /= m;
    out.tx = tx;
    out.tz = tz;
    out.rx = -tz;
    out.rz = tx;
    out.curv = a.curv + (b.curv - a.curv) * k;
    return out;
  };

  return {
    length,
    step: STEP,
    count,
    halfWidth: TRACK_HALF_WIDTH,
    at: (s) => at(s, { s: 0, x: 0, y: 0, z: 0, tx: 0, tz: 0, rx: 0, rz: 0, curv: 0 }),
    into: at,
    limit: (s) => {
      const f = wrap(s, length) / STEP;
      const i = Math.floor(f);
      const k = f - i;
      return lim[i % count] + (lim[(i + 1) % count] - lim[i % count]) * k;
    },
    runway: (s) => runwayTable[Math.floor(wrap(s, length) / STEP) % count],
    corners,
    straight: { from: bestFrom * STEP, length: bestLen * STEP },
    table,
  };
}

let cached: Track | null = null;

/** The one circuit. Built on first use and then shared. */
export function circuit(): Track {
  if (!cached) cached = build();
  return cached;
}

export { V_MAX, A_BRAKE, A_ACCEL, A_LAT };
