import type { RaceMeta } from "../../lib/data";

export function sprintRaces(races: RaceMeta[], count = 5): RaceMeta[] {
  if (races.length <= count) return races;
  return Array.from({ length: count }, (_, index) => races[Math.round(index * (races.length - 1) / (count - 1))]);
}

/** How many of the picked drivers finished on the podium. Order does not matter. */
export function podiumHits(picks: number[], actual: number[]): number {
  return picks.filter((id) => actual.includes(id)).length;
}

/** The part of a driver record the sprint needs: the season logs hold one row per start. */
export interface FieldSource {
  id: number;
  seasons: Record<string, { log: readonly (readonly [number, number, number, number | null, number, number, string])[] } | undefined>;
}

export interface FieldEntry {
  id: number;
  constructorId: number;
  /** Starting-grid slot, null for a pit-lane start. Known before the race. */
  grid: number | null;
}

/**
 * Everyone who started a race, in starting-grid order. The choice list must be the whole field: building it from the
 * real podium and the model's picks (as an earlier version did) leaves only a handful of names and gives the answer away.
 * Only the driver, team and grid slot are read from each record, never the finishing result.
 */
export function fieldOf(race: { id: number; year: number }, drivers: readonly FieldSource[]): FieldEntry[] {
  const out: FieldEntry[] = [];
  for (const driver of drivers) {
    const row = driver.seasons[String(race.year)]?.log.find((entry) => entry[0] === race.id);
    if (row) out.push({ id: driver.id, constructorId: row[5], grid: row[3] });
  }
  return out.sort((a, b) => (a.grid ?? 99) - (b.grid ?? 99) || a.id - b.id);
}

export type VerdictKind = "win" | "loss" | "tie";

/** Who did better on a set of races, in plain words. Both sides are scored the same way, so equal scores are a tie. */
export function sprintVerdict(player: number, model: number): { kind: VerdictKind; text: string } {
  if (player > model) return { kind: "win", text: `You beat Paladin, ${player} correct to ${model}.` };
  if (player < model) return { kind: "loss", text: `Paladin beat you, ${model} correct to ${player}.` };
  return { kind: "tie", text: `You and Paladin tied, ${player} correct each.` };
}
