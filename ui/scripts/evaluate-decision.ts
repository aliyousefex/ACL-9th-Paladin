import { readFileSync, readdirSync } from "node:fs";
import { forecast } from "../src/features/decision/forecast.ts";
import { DECISION_SCHEMA_VERSION, type RaceState } from "../src/features/decision/schema.ts";
import type { Row } from "../src/features/race/rows.ts";

const dir = new URL("../public/data/races/", import.meta.url);
const files = readdirSync(dir).filter((file) => file.endsWith(".json")).sort();
let podiumSquared = 0;
let gridSquared = 0;
let positionAbs = 0;
let gridPositionAbs = 0;
let drivers = 0;
let races = 0;

for (const file of files) {
  const detail = JSON.parse(readFileSync(new URL(file, dir), "utf8"));
  const rows = detail.entries.map((entry: { d: number; p: number; x: (number | null)[]; pos: number | null }) => ({
    entry, driver: { id: entry.d }, team: {}, colour: "", ink: "", score: entry.p, rank: 0,
    grid: entry.x[0], finish: entry.pos, podium: entry.pos !== null && entry.pos <= 3,
  })) as unknown as Row[];
  const active = rows.filter((row) => row.grid !== null);
  const state: RaceState = {
    schema: DECISION_SCHEMA_VERSION, raceId: Number(file.replace(".json", "")), cutoffLap: 0, totalLaps: detail.laps.n,
    drivers: active.map((row) => ({ driverId: row.driver.id, position: row.grid, gapSeconds: 0, stops: 0, running: true })),
    events: [], sources: ["starting grid"],
  };
  const result = forecast(rows, state, 903 + state.raceId, 4000);
  for (const predicted of result.drivers) {
    const row = rows.find((candidate) => candidate.driver.id === predicted.driverId)!;
    if (row.finish === null) continue;
    const outcome = Number(row.finish <= 3);
    podiumSquared += (predicted.podium - outcome) ** 2;
    gridSquared += (Number((row.grid ?? 999) <= 3) - outcome) ** 2;
    positionAbs += Math.abs(predicted.expectedPosition - row.finish);
    gridPositionAbs += Math.abs((row.grid ?? active.length) - row.finish);
    drivers++;
  }
  races++;
}

console.log(JSON.stringify({
  model: "plackett-luce-state-baseline-v1",
  scope: "pre-race held-out seasons 2022-2024",
  races,
  classifiedDrivers: drivers,
  samplesPerRace: 4000,
  podiumBrier: podiumSquared / drivers,
  topThreeGridBrier: gridSquared / drivers,
  expectedPositionMAE: positionAbs / drivers,
  gridPositionMAE: gridPositionAbs / drivers,
  warning: "Diagnostic evaluation of an approximate baseline; it is not calibrated for live-race use.",
}, null, 2));
