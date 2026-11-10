/** Versioned, series-neutral contracts for historical race state and evidence. */
export const DECISION_SCHEMA_VERSION = "paladin.race-state.v1" as const;

export type EvidenceKind = "recorded" | "derived" | "estimated" | "simulated";

export interface Provenance {
  source: string;
  kind: EvidenceKind;
  /** Lap on which the fact occurred. Zero is the pre-race grid. */
  occurredLap: number;
  /** First lap at which the product may expose the fact. */
  availableLap: number;
  /** Static exports are ingested at build time; no false wall-clock timestamp is invented. */
  ingestedAt: "build-time";
  revision: number;
  note?: string;
}

export type RaceEventType = "start" | "position" | "pit" | "lead-change" | "slow-field";

export interface RaceEvent<T = Record<string, unknown>> {
  id: string;
  raceId: number;
  type: RaceEventType;
  lap: number;
  driverId: number | null;
  payload: T;
  provenance: Provenance;
}

export interface DriverState {
  driverId: number;
  position: number | null;
  gapSeconds: number | null;
  stops: number;
  running: boolean;
}

export interface RaceState {
  schema: typeof DECISION_SCHEMA_VERSION;
  raceId: number;
  cutoffLap: number;
  totalLaps: number;
  drivers: DriverState[];
  events: RaceEvent[];
  sources: string[];
}

export interface ForecastDriver {
  driverId: number;
  win: number;
  podium: number;
  expectedPosition: number;
  expectedPoints: number;
  positions: number[];
}

export interface OutcomeForecast {
  model: "plackett-luce-state-baseline-v1";
  samples: number;
  seed: number;
  cutoffLap: number;
  drivers: ForecastDriver[];
  assumptions: string[];
  provenance: Provenance;
}

export interface ScenarioComparison {
  kind: "pit-loss-stress-test-v1";
  driverId: number;
  cutoffLap: number;
  seed: number;
  samples: number;
  reference: ForecastDriver;
  alternative: ForecastDriver;
  assumedSeconds: number;
  assumptions: string[];
}
