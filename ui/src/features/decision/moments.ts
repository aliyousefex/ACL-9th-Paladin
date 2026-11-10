import type { Row } from "../race/rows";
import { forecast } from "./forecast.ts";
import { stateAt, type Ledger } from "./ledger.ts";

export interface DecisionMoment {
  lap: number;
  importance: number;
  kind: "pit" | "lead" | "field-pace" | "forecast-revision";
  driverId: number | null;
  headline: string;
  evidence: string[];
  /** Largest absolute podium-share revision from the previous event cutoff. */
  maxPodiumDelta: number;
}

/** Deterministic event and forecast-revision ranking; it describes association, never cause. */
export function detectMoments(ledger: Ledger, rows: readonly Row[]): DecisionMoment[] {
  const eventLaps = [...new Set([0, ...ledger.events.filter((event) => event.type !== "position").map((event) => event.lap)])].sort((a, b) => a - b);
  const moments: DecisionMoment[] = [];
  let previous = forecast(rows, stateAt(ledger, 0), 903, 500);
  for (const lap of eventLaps.slice(1)) {
    const current = forecast(rows, stateAt(ledger, lap), 903, 500);
    const before = new Map(previous.drivers.map((driver) => [driver.driverId, driver]));
    let changed: { id: number; delta: number } | null = null;
    for (const driver of current.drivers) {
      const delta = driver.podium - (before.get(driver.driverId)?.podium ?? 0);
      if (!changed || Math.abs(delta) > Math.abs(changed.delta)) changed = { id: driver.driverId, delta };
    }
    const events = ledger.events.filter((event) => event.lap === lap && event.type !== "position");
    const pit = events.find((event) => event.type === "pit");
    const lead = events.find((event) => event.type === "lead-change");
    const slow = events.find((event) => event.type === "slow-field");
    const kind = pit ? "pit" : lead ? "lead" : slow ? "field-pace" : "forecast-revision";
    const driverId = pit?.driverId ?? lead?.driverId ?? changed?.id ?? null;
    const delta = Math.abs(changed?.delta ?? 0);
    const evidence = events.map((event) => `${event.type} (${event.provenance.kind})`);
    if (changed) evidence.push(`largest estimated podium revision: ${changed.delta >= 0 ? "+" : ""}${Math.round(changed.delta * 100)} points`);
    moments.push({
      lap, kind, driverId, maxPodiumDelta: delta,
      importance: delta + (pit ? 0.08 : 0) + (lead ? 0.1 : 0) + (slow ? 0.06 : 0),
      headline: pit ? "Recorded pit decision" : lead ? "Recorded lead change" : slow ? "Field-wide pace shift" : "Forecast revision",
      evidence,
    });
    previous = current;
  }
  return moments.sort((a, b) => b.importance - a.importance || a.lap - b.lap).slice(0, 8);
}
