import indexJson from "../../data/advanced-index.json" with { type: "json" };

export interface RaceSignature {
  id: number;
  year: number;
  circuitId: number;
  field: number;
  meanDnf: number;
  frontier: number;
  uncertainty: number;
  expectedSpread: number;
}

const INDEX = indexJson as RaceSignature[];
const KEYS = ["field", "meanDnf", "frontier", "uncertainty", "expectedSpread"] as const;
const stats = new Map(KEYS.map((key) => {
  const values = INDEX.map((row) => row[key]);
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const scale = Math.sqrt(values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / values.length) || 1;
  return [key, { mean, scale }];
}));

/** Similarity uses pre-race distribution shape only; same-circuit races receive a modest, declared bonus. */
export function historicalAnalogues(raceId: number, limit = 3): { raceId: number; distance: number; sameCircuit: boolean; reasons: string[] }[] {
  const target = INDEX.find((row) => row.id === raceId);
  if (!target) return [];
  return INDEX.filter((row) => row.id !== raceId).map((row) => {
    const contributions = KEYS.map((key) => {
      const stat = stats.get(key)!;
      return { key, value: Math.abs((row[key] - target[key]) / stat.scale) };
    });
    const sameCircuit = row.circuitId === target.circuitId;
    const distance = Math.sqrt(contributions.reduce((sum, item) => sum + item.value ** 2, 0)) * (sameCircuit ? 0.82 : 1);
    const reasons = contributions.sort((a, b) => a.value - b.value).slice(0, 2).map((item) => ({
      field: "field size", meanDnf: "reliability risk", frontier: "front-runner concentration", uncertainty: "outcome uncertainty", expectedSpread: "field spread",
    })[item.key]);
    if (sameCircuit) reasons.unshift("same circuit");
    return { raceId: row.id, distance, sameCircuit, reasons: reasons.slice(0, 3) };
  }).sort((a, b) => a.distance - b.distance || a.raceId - b.raceId).slice(0, limit);
}
