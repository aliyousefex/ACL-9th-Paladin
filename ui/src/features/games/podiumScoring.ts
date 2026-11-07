import type { RaceMeta } from "../../lib/data";

export function sprintRaces(races: RaceMeta[], count = 5): RaceMeta[] {
  if (races.length <= count) return races;
  return Array.from({ length: count }, (_, index) => races[Math.round(index * (races.length - 1) / (count - 1))]);
}

export function podiumHits(picks: number[], actual: number[]): number {
  return picks.filter((id) => actual.includes(id)).length;
}
