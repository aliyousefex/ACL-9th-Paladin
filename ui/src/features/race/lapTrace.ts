/**
 * The race trace: gap to the leader and position by lap, built only from the recorded lap times and
 * end-of-lap positions.
 *
 * What is recorded: every lap time, the official position at the end of every lap, and each pit stop
 * (lap and pit-lane time). What is derived here, by arithmetic and nothing else: cumulative race time,
 * the gap to the leader at the end of a lap, and the lead changes. What is inferred and labelled as
 * such: "slow laps", where the whole field's median lap time was well above the race median. The data
 * does not record why (safety car, red flag, rain), so nothing here names a cause.
 *
 * No framework imports: the module is plain TypeScript so it can be tested under Node.
 */

export interface LapSeries {
  /** Lap times in milliseconds; null once the driver's laps end. */
  t: (number | null)[];
  /** Official position at the end of each lap; null once the driver's laps end. */
  p: (number | null)[];
}

export interface TraceEntry {
  id: number;
  grid: number | null;
  /** Classified with a finishing position (not retired, disqualified or withdrawn). */
  classified: boolean;
  /** Classification text from the dataset: "1", "R", "D", "W". */
  txt: string;
  /** Finishing status from the dataset, for example "Engine" or "+1 Lap". */
  status: string;
}

export interface TraceDriver {
  id: number;
  grid: number | null;
  /** Cumulative race time in seconds at the end of lap k; index 0 is lights out. */
  cum: number[];
  /** Official position at the end of lap k; index 0 is the starting grid slot (null for a pit-lane start). */
  pos: (number | null)[];
  /** Laps with a recorded time. */
  laps: number;
  /** Lap time in milliseconds for lap k (index k - 1). */
  lapMs: number[];
  pits: { lap: number; ms: number | null }[];
  classified: boolean;
  txt: string;
  status: string;
}

export interface SlowRun {
  from: number;
  to: number;
  /** "stoppage" when the median lap was at least twice the race median (a red flag looks like this). */
  severity: "slow" | "stoppage";
}

export interface Trace {
  /** Laps in the longest recorded series. */
  totalLaps: number;
  drivers: TraceDriver[];
  byId: Map<number, TraceDriver>;
  /** Cumulative time of the fastest car at the end of lap k (index 0 = 0). */
  leaderCum: number[];
  /** Median lap time of the field on lap k in seconds (index k); null where fewer than MIN_FIELD cars have a lap. */
  fieldMedian: (number | null)[];
  /** Median of the field medians from lap 2 on, in seconds: the "typical" lap of this race. */
  baseline: number;
  slowRuns: SlowRun[];
  /** Entries in the classification with no recorded laps at all (for example a car that never left the pit lane). */
  withoutLaps: number[];
}

/** A lap counts as slow when the field's median lap time exceeds the race median by more than this factor. */
export const SLOW_FACTOR = 1.2;
export const STOPPAGE_FACTOR = 2;
/** Fewer cars than this on a lap and the median is not meaningful. */
export const MIN_FIELD = 3;

const median = (values: number[]): number => {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = sorted.length >> 1;
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
};

export function buildTrace(laps: Record<string, LapSeries>, pits: Record<string, [number, number | null][]>, entries: TraceEntry[]): Trace {
  const drivers: TraceDriver[] = [];
  const withoutLaps: number[] = [];
  for (const entry of entries) {
    const series = laps[String(entry.id)];
    const cum = [0];
    const lapMs: number[] = [];
    if (series) {
      for (const value of series.t) {
        if (value === null || value === undefined) break;
        lapMs.push(value);
        cum.push(cum[cum.length - 1] + value / 1000);
      }
    }
    if (cum.length < 2 || !series) {
      withoutLaps.push(entry.id);
      continue;
    }
    drivers.push({
      id: entry.id,
      grid: entry.grid,
      cum,
      pos: [entry.grid, ...series.p.slice(0, cum.length - 1).map((p) => p ?? null)],
      laps: cum.length - 1,
      lapMs,
      pits: (pits[String(entry.id)] ?? []).map(([lap, ms]) => ({ lap, ms })),
      classified: entry.classified,
      txt: entry.txt,
      status: entry.status,
    });
  }

  const totalLaps = drivers.reduce((max, d) => Math.max(max, d.laps), 0);
  const leaderCum = [0];
  const fieldMedian: (number | null)[] = [null];
  for (let k = 1; k <= totalLaps; k++) {
    const times = drivers.filter((d) => d.laps >= k).map((d) => d.cum[k]);
    leaderCum.push(Math.min(...times));
    const lapTimes = drivers.filter((d) => d.laps >= k).map((d) => d.lapMs[k - 1] / 1000);
    fieldMedian.push(lapTimes.length >= MIN_FIELD ? median(lapTimes) : null);
  }

  // Lap 1 is a standing start, so the typical lap is taken from lap 2 on.
  const typical = fieldMedian.slice(2).filter((v): v is number => v !== null);
  const baseline = typical.length ? median(typical) : 0;
  const slowRuns: SlowRun[] = [];
  for (let k = 2; k <= totalLaps; k++) {
    const m = fieldMedian[k];
    if (m === null || baseline <= 0 || m <= SLOW_FACTOR * baseline) continue;
    const severity = m >= STOPPAGE_FACTOR * baseline ? "stoppage" : "slow";
    const last = slowRuns[slowRuns.length - 1];
    if (last && last.to === k - 1) {
      last.to = k;
      if (severity === "stoppage") last.severity = "stoppage";
    } else slowRuns.push({ from: k, to: k, severity });
  }

  return { totalLaps, drivers, byId: new Map(drivers.map((d) => [d.id, d])), leaderCum, fieldMedian, baseline, slowRuns, withoutLaps };
}

/** Seconds behind the fastest car at the end of lap k, or null when the driver has no lap k. */
export function gapAt(trace: Trace, id: number, lap: number): number | null {
  const d = trace.byId.get(id);
  if (!d || lap < 0 || lap > d.laps) return null;
  return d.cum[lap] - trace.leaderCum[lap];
}

/** Official position at the end of lap k (lap 0 = starting grid), or null when the driver has no lap k. */
export function positionAt(trace: Trace, id: number, lap: number): number | null {
  const d = trace.byId.get(id);
  if (!d || lap < 0 || lap > d.laps) return null;
  return d.pos[lap] ?? null;
}

/** Drivers still running at the end of lap k, in official order. Lap 0 is the starting grid. */
export function orderAt(trace: Trace, lap: number): TraceDriver[] {
  return trace.drivers
    .filter((d) => lap <= d.laps && d.pos[lap] !== null && d.pos[lap] !== undefined)
    .sort((a, b) => (a.pos[lap] as number) - (b.pos[lap] as number) || a.id - b.id);
}

/** Pit stops made up to and including lap k. */
export function stopsBy(trace: Trace, id: number, lap: number): number {
  return trace.byId.get(id)?.pits.filter((p) => p.lap <= lap).length ?? 0;
}

/** Who led at the end of each lap (index k - 1), by official position. */
export function leaders(trace: Trace): number[] {
  const out: number[] = [];
  for (let k = 1; k <= trace.totalLaps; k++) {
    const lead = trace.drivers.find((d) => d.laps >= k && d.pos[k] === 1);
    if (lead) out.push(lead.id);
  }
  return out;
}

/** Times the car in front at the end of a lap differs from the car in front at the end of the previous lap. */
export function leadChanges(trace: Trace): number {
  const order = leaders(trace);
  let changes = 0;
  for (let i = 1; i < order.length; i++) if (order[i] !== order[i - 1]) changes++;
  return changes;
}

/** "+12.3 s", or "+1:42.3" once the gap passes a minute and a half. */
export function formatGap(seconds: number): string {
  if (seconds < 0.05) return "Leader";
  if (seconds < 90) return `+${seconds.toFixed(1)} s`;
  const m = Math.floor(seconds / 60);
  return `+${m}:${(seconds - m * 60).toFixed(1).padStart(4, "0")}`;
}

/**
 * Gridlines for a seconds axis: evenly spaced round numbers from zero, at most six intervals, ending at or above
 * the largest value so every point sits on the chart. For example 37 gives 0, 10, 20, 30, 40.
 */
export function axisTicks(max: number): number[] {
  const steps = [1, 2, 5, 10, 15, 20, 30, 60, 120, 180, 300, 600, 1200, 1800, 3600];
  const safe = Number.isFinite(max) && max > 0 ? max : 1;
  const step = steps.find((s) => Math.ceil(safe / s) <= 6) ?? Math.ceil(safe / 6 / 600) * 600;
  const count = Math.max(1, Math.ceil(safe / step));
  return Array.from({ length: count + 1 }, (_, i) => i * step);
}

/** "lap 49", "laps 49–54". */
export function lapRange(from: number, to: number): string {
  return from === to ? `lap ${from}` : `laps ${from}–${to}`;
}

export interface StoryRow {
  id: number;
  name: string;
  grid: number | null;
  /** Finishing position, null when not classified. */
  finish: number | null;
}

/**
 * Plain statements about how the race unfolded, each computed from lap times, positions and the
 * classification, and each naming its baseline. They describe the record and make no claim about cause.
 */
export function traceStory(trace: Trace, rows: readonly StoryRow[]): string[] {
  const lines: string[] = [];
  const name = new Map(rows.map((r) => [r.id, r.name]));
  const label = (id: number) => name.get(id) ?? `Driver ${id}`;

  const changes = leadChanges(trace);
  lines.push(
    changes === 0
      ? "The same driver led at the end of every lap (official positions)."
      : `The lead changed hands ${changes} ${changes === 1 ? "time" : "times"} at the end of a lap (official positions, so pit-stop cycles count).`,
  );

  const winner = rows.find((r) => r.finish === 1);
  const second = rows.find((r) => r.finish === 2);
  const w = winner && trace.byId.get(winner.id);
  const s = second && trace.byId.get(second.id);
  if (w && s && w.laps === s.laps) {
    lines.push(`Gap between ${label(w.id)} and ${label(s.id)} at the flag, from summed lap times: ${(s.cum[s.laps] - w.cum[w.laps]).toFixed(1)} s. This is the gap on the road, before any post-race time penalty.`);
  }

  let best: { row: StoryRow; gain: number } | null = null;
  for (const r of rows) {
    if (r.finish === null || r.grid === null) continue;
    const gain = r.grid - r.finish;
    if (!best || gain > best.gain) best = { row: r, gain };
  }
  if (best && best.gain >= 3) lines.push(`Biggest climb against the starting grid: ${best.row.name}, from grid P${best.row.grid} to P${best.row.finish} (+${best.gain}).`);

  const stops = trace.drivers.reduce((sum, d) => sum + d.pits.length, 0);
  const stoppers = trace.drivers.filter((d) => d.pits.length > 0).length;
  lines.push(`${stops} pit ${stops === 1 ? "stop" : "stops"} recorded across ${stoppers} ${stoppers === 1 ? "driver" : "drivers"}.`);

  if (trace.slowRuns.length === 0) {
    lines.push(`No stretch of laps had a field median more than ${Math.round((SLOW_FACTOR - 1) * 100)}% slower than the race median.`);
  } else {
    lines.push(
      `Field-wide slow laps (median lap more than ${Math.round((SLOW_FACTOR - 1) * 100)}% above the race median): ${trace.slowRuns.map((r) => lapRange(r.from, r.to)).join(", ")}. The data does not record the cause.`,
    );
  }

  const out = rows.filter((r) => r.finish === null).length;
  if (out > 0) lines.push(`${out} ${out === 1 ? "driver was" : "drivers were"} not classified: retired, disqualified or withdrawn.`);
  return lines;
}
