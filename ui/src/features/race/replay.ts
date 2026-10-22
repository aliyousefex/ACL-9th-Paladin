/**
 * Replay of a real race from lap-by-lap data (lap_times.csv).
 *
 * What is real: every lap time and the position at the end of every lap.
 * What is interpolated: where a car is *within* a lap. A lap time says how long a lap took, not
 * where the car was half-way round, so a car is drawn moving at constant speed from the start
 * line to the start line during its lap. Cars that stop are not drawn after their last recorded
 * lap, because the data does not say where they stopped.
 *
 * No framework imports: the module is plain TypeScript so it can be tested under Node.
 */

export interface LapSeries {
  /** Lap times in milliseconds; null where the dataset has no lap. */
  t: (number | null)[];
  /** Official position at the end of each lap. */
  p: (number | null)[];
}

export interface ReplayDriver {
  id: number;
  /** Cumulative race time in seconds at the end of lap k, index 0 = 0 (lights out). */
  cum: number[];
  /** Laps with a recorded time. */
  laps: number;
  /** Grid slot (1-based), or null for a pit-lane start. */
  slot: number | null;
  /** Classified as a finisher (not retired). */
  running: boolean;
  /** Lap numbers on which the driver pitted. */
  pits: number[];
}

export interface DriverState {
  id: number;
  /** Fraction of a lap from the start line, in [0, 1); null when the car is no longer drawn. */
  s: number | null;
  /** Laps completed. */
  k: number;
  /** Distance in laps, used for ordering. */
  distance: number;
  out: boolean;
  finished: boolean;
  inPit: boolean;
}

export interface ReplayModel {
  drivers: ReplayDriver[];
  totalLaps: number;
  duration: number;
  leaderAt: (t: number) => { id: number; completed: number };
  /** True while the leader is on a lap far longer than normal: a red flag or a long neutralisation. */
  stoppageAt: (t: number) => boolean;
  stateAt: (t: number) => DriverState[];
  /** Gap to the leader in seconds measured at the leader's last completed lap, or a lap deficit. */
  gapAt: (t: number, states: DriverState[]) => Map<number, string>;
}

const GRID_SPACING_M = 8;
const STOPPAGE_FACTOR = 2.2;

export function buildReplay(
  laps: Record<string, LapSeries>,
  meta: { id: number; slot: number | null; running: boolean; pits: number[] }[],
  totalLaps: number,
  lapLengthM: number,
): ReplayModel {
  const drivers: ReplayDriver[] = [];
  for (const m of meta) {
    const series = laps[String(m.id)];
    if (!series) continue;
    const cum = [0];
    for (let i = 0; i < series.t.length; i++) {
      const value = series.t[i];
      if (value === null || value === undefined) break;
      cum.push(cum[cum.length - 1] + value / 1000);
    }
    if (cum.length < 2) continue;
    drivers.push({ id: m.id, cum, laps: cum.length - 1, slot: m.slot, running: m.running, pits: m.pits });
  }

  const duration = Math.max(...drivers.map((d) => d.cum[d.cum.length - 1]));

  const completedAt = (d: ReplayDriver, t: number): number => {
    // number of laps with cum <= t
    let lo = 0;
    let hi = d.cum.length - 1;
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1;
      if (d.cum[mid] <= t) lo = mid;
      else hi = mid - 1;
    }
    return lo;
  };

  const stateOf = (d: ReplayDriver, t: number): DriverState => {
    const k = completedAt(d, t);
    if (k >= d.laps) {
      // the last recorded lap is done: a finisher parks at the line, a retirement disappears
      return {
        id: d.id,
        s: d.running ? 0 : null,
        k,
        distance: k - d.cum[d.laps] * 1e-9,
        out: !d.running,
        finished: d.running,
        inPit: false,
      };
    }
    const span = d.cum[k + 1] - d.cum[k];
    const f = span > 0 ? (t - d.cum[k]) / span : 0;
    let s: number;
    if (k === 0) {
      const start = d.slot ? -(d.slot * GRID_SPACING_M) / lapLengthM : -(22 * GRID_SPACING_M) / lapLengthM;
      s = start + f * (1 - start);
      return { id: d.id, s: ((s % 1) + 1) % 1, k, distance: s, out: false, finished: false, inPit: d.pits.includes(1) };
    }
    s = f;
    return { id: d.id, s, k, distance: k + f, out: false, finished: false, inPit: d.pits.includes(k + 1) };
  };

  const stateAt = (t: number) => drivers.map((d) => stateOf(d, t));

  const leaderAt = (t: number) => {
    let best = drivers[0];
    let bestDistance = -Infinity;
    for (const d of drivers) {
      const state = stateOf(d, t);
      if (state.distance > bestDistance) {
        bestDistance = state.distance;
        best = d;
      }
    }
    return { id: best.id, completed: completedAt(best, t) };
  };

  const byId = new Map(drivers.map((d) => [d.id, d]));

  const medians = new Map<number, number>();
  for (const d of drivers) {
    const laps = d.cum.slice(1).map((c, i) => c - d.cum[i]).sort((a, b) => a - b);
    medians.set(d.id, laps[Math.floor(laps.length / 2)]);
  }
  const stoppageAt = (t: number) => {
    const lead = byId.get(leaderAt(t).id)!;
    const k = completedAt(lead, t);
    if (k >= lead.laps) return false;
    return lead.cum[k + 1] - lead.cum[k] > STOPPAGE_FACTOR * medians.get(lead.id)!;
  };

  const gapAt = (t: number, states: DriverState[]) => {
    const gaps = new Map<number, string>();
    const order = [...states].sort((a, b) => b.distance - a.distance);
    const lead = order[0];
    if (!lead) return gaps;
    const leader = byId.get(lead.id)!;
    const L = Math.min(completedAt(leader, t), leader.laps);
    for (const state of order) {
      const d = byId.get(state.id)!;
      if (state.id === lead.id) {
        gaps.set(state.id, L === 0 ? "" : "Leader");
      } else if (L === 0) {
        gaps.set(state.id, "");
      } else if (d.laps >= L) {
        const gap = d.cum[L] - leader.cum[L];
        gaps.set(state.id, `+${gap.toFixed(1)}`);
      } else {
        const behind = L - d.laps;
        gaps.set(state.id, d.running ? `+${behind} LAP${behind > 1 ? "S" : ""}` : "OUT");
      }
    }
    return gaps;
  };

  return { drivers, totalLaps, duration, leaderAt, stoppageAt, stateAt, gapAt };
}

/** Interpolate a point along the equally spaced samples of the track, for s in [0, 1). */
export function pointAt(samples: [number, number][], s: number): { x: number; y: number; angle: number } {
  const n = samples.length;
  const position = (((s % 1) + 1) % 1) * n;
  const i = Math.floor(position);
  const f = position - i;
  const a = samples[i % n];
  const b = samples[(i + 1) % n];
  return {
    x: a[0] + (b[0] - a[0]) * f,
    y: a[1] + (b[1] - a[1]) * f,
    angle: (Math.atan2(b[1] - a[1], b[0] - a[0]) * 180) / Math.PI,
  };
}
