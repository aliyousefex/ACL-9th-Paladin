import type { Row } from "../race/rows";
import { forecast } from "./forecast.ts";
import { stateAt, type Ledger } from "./ledger.ts";

export interface ForecastEvolutionPoint {
  lap: number;
  podium: number;
  expectedPosition: number | null;
  running: boolean;
}

/** Replays one driver's estimate at declared cutoffs; it never reads a later state. */
export function forecastEvolution(ledger: Ledger, rows: readonly Row[], driverId: number, cutoffs: readonly number[]): ForecastEvolutionPoint[] {
  return [...new Set(cutoffs)].sort((a, b) => a - b).map((lap) => {
    const driver = forecast(rows, stateAt(ledger, lap), 903, 700).drivers.find((item) => item.driverId === driverId);
    return { lap, podium: driver?.podium ?? 0, expectedPosition: driver?.expectedPosition ?? null, running: Boolean(driver) };
  });
}
