import type { RaceDetail } from "../../lib/data";
import { buildTrace, gapAt, orderAt, positionAt, stopsBy, type Trace } from "../race/lapTrace.ts";
import type { Row } from "../race/rows";
import { DECISION_SCHEMA_VERSION, type Provenance, type RaceEvent, type RaceState } from "./schema.ts";

const recorded = (lap: number, note?: string): Provenance => ({
  source: "exported historical lap timing",
  kind: "recorded",
  occurredLap: lap,
  availableLap: lap,
  ingestedAt: "build-time",
  revision: 1,
  note,
});

export interface Ledger {
  raceId: number;
  trace: Trace;
  events: RaceEvent[];
}

export function buildLedger(raceId: number, detail: RaceDetail, rows: readonly Row[]): Ledger {
  const trace = buildTrace(
    detail.laps.d,
    detail.pits,
    rows.map((row) => ({ id: row.driver.id, grid: row.grid, classified: /^\d+$/.test(row.entry.txt), txt: row.entry.txt, status: row.entry.status })),
  );
  const events: RaceEvent[] = [{
    id: `${raceId}:start`, raceId, type: "start", lap: 0, driverId: null,
    payload: { order: orderAt(trace, 0).map((d) => d.id) }, provenance: recorded(0, "Starting grid; pit-lane starters have no numbered grid slot."),
  }];

  for (const driver of trace.drivers) {
    for (let lap = 1; lap <= driver.laps; lap++) {
      const before = positionAt(trace, driver.id, lap - 1);
      const after = positionAt(trace, driver.id, lap);
      if (after !== null && before !== after) events.push({
        id: `${raceId}:position:${driver.id}:${lap}`, raceId, type: "position", lap, driverId: driver.id,
        payload: { from: before, to: after }, provenance: recorded(lap, "Official end-of-lap position."),
      });
    }
    for (const pit of driver.pits) events.push({
      id: `${raceId}:pit:${driver.id}:${pit.lap}`, raceId, type: "pit", lap: pit.lap, driverId: driver.id,
      payload: { pitLaneMs: pit.ms }, provenance: recorded(pit.lap, "Recorded pit stop; tyre compound is unavailable in this dataset."),
    });
  }

  let leader: number | null = null;
  for (let lap = 1; lap <= trace.totalLaps; lap++) {
    const next = orderAt(trace, lap)[0]?.id ?? null;
    if (leader !== null && next !== null && next !== leader) events.push({
      id: `${raceId}:lead:${lap}`, raceId, type: "lead-change", lap, driverId: next,
      payload: { from: leader, to: next }, provenance: recorded(lap, "Derived from official end-of-lap positions; pit cycles count."),
    });
    leader = next;
  }
  for (const run of trace.slowRuns) events.push({
    id: `${raceId}:slow:${run.from}`, raceId, type: "slow-field", lap: run.from, driverId: null,
    payload: { through: run.to, severity: run.severity },
    provenance: { ...recorded(run.from), kind: "derived", note: "Field median exceeded the race median; the source does not identify the cause." },
  });
  events.sort((a, b) => a.lap - b.lap || a.id.localeCompare(b.id));
  return { raceId, trace, events };
}

/** Reconstruct only facts available at cutoffLap. Future access is impossible through this return type. */
export function stateAt(ledger: Ledger, cutoffLap: number): RaceState {
  if (!Number.isInteger(cutoffLap) || cutoffLap < 0 || cutoffLap > ledger.trace.totalLaps) throw new RangeError(`cutoff lap ${cutoffLap} is outside 0..${ledger.trace.totalLaps}`);
  const events = ledger.events.filter((event) => event.provenance.availableLap <= cutoffLap);
  if (events.some((event) => event.lap > cutoffLap)) throw new Error("future event crossed the information cutoff");
  return {
    schema: DECISION_SCHEMA_VERSION,
    raceId: ledger.raceId,
    cutoffLap,
    totalLaps: ledger.trace.totalLaps,
    drivers: ledger.trace.drivers.map((driver) => ({
      driverId: driver.id,
      position: positionAt(ledger.trace, driver.id, cutoffLap),
      gapSeconds: gapAt(ledger.trace, driver.id, cutoffLap),
      stops: stopsBy(ledger.trace, driver.id, cutoffLap),
      running: cutoffLap <= driver.laps,
    })),
    events,
    sources: ["Exported historical lap times", "Official end-of-lap positions", "Recorded pit-stop table"],
  };
}
