export type Compound = "soft" | "medium" | "hard" | "intermediate";
export type Aggression = "save" | "balanced" | "attack";
export type Weather = "dry" | "mixed" | "wet";

export interface SimEntry {
  id: number;
  grid: number | null;
  score: number;
}

export interface Strategy {
  compound: Compound;
  secondCompound?: Compound;
  pitLap: number | null;
  aggression: Aggression;
}

export interface SimConfig {
  laps: number;
  seed: number;
  safetyCarLap: number | null;
  selectedId: number;
  selected: Strategy;
  weather?: Weather;
  /** Synthetic chance that the selected driver retires during this run, from 0 to 1. */
  reliabilityRisk?: number;
}

export interface SimLapState {
  lap: number;
  order: number[];
  elapsed: Record<number, number>;
  pitted: number[];
  retired: number[];
}

export interface SimResult {
  states: SimLapState[];
  order: number[];
  elapsed: Record<number, number>;
  retiredAt: Record<number, number>;
}

const PIT_LOSS = 20.5;

function random(seed: number): () => number {
  let value = seed >>> 0 || 1;
  return () => {
    value = (value * 1664525 + 1013904223) >>> 0;
    return value / 4294967296;
  };
}

function lapTime(entry: SimEntry, strategy: Strategy, lap: number, totalLaps: number, weather: Weather, rnd: () => number): number {
  const grid = entry.grid ?? 22;
  const base = 88 + grid * 0.105 + (1 - entry.score) * 1.8;
  const compoundStart = strategy.compound === "soft" ? -0.65 : strategy.compound === "hard" ? 0.42 : strategy.compound === "intermediate" ? 1.25 : 0;
  const wearRate = strategy.compound === "soft" ? 0.055 : strategy.compound === "hard" ? 0.018 : strategy.compound === "intermediate" ? 0.042 : 0.032;
  const aggression = strategy.aggression === "attack" ? -0.32 : strategy.aggression === "save" ? 0.26 : 0;
  const aggressionWear = strategy.aggression === "attack" ? 0.012 : strategy.aggression === "save" ? -0.006 : 0;
  const stintLap = strategy.pitLap && lap > strategy.pitLap ? lap - strategy.pitLap : lap;
  const noise = (rnd() - 0.5) * 0.72;
  const wetNow = weather === "wet" || (weather === "mixed" && lap > totalLaps * 0.52);
  const weatherPenalty = wetNow
    ? strategy.compound === "intermediate" ? -0.35 : strategy.compound === "hard" ? 3.2 : strategy.compound === "medium" ? 2.7 : 2.35
    : strategy.compound === "intermediate" ? 1.45 : 0;
  return base + compoundStart + aggression + weatherPenalty + stintLap * Math.max(0.008, wearRate + aggressionWear) + noise;
}

/**
 * Transparent strategy toy, not a physics model. Pace starts from grid rank and Paladin's
 * pre-race score, then applies tyre wear, aggression, pit loss and seeded variation.
 */
export function simulate(entries: SimEntry[], config: SimConfig): SimResult {
  const rnd = random(config.seed);
  const weather = config.weather ?? "dry";
  const defaultStrategy: Strategy = { compound: "medium", secondCompound: "hard", pitLap: Math.max(3, Math.round(config.laps * 0.52)), aggression: "balanced" };
  const elapsed: Record<number, number> = Object.fromEntries(entries.map((entry) => [entry.id, Math.max(0, (entry.grid ?? 22) - 1) * 0.18]));
  const risk = Math.max(0, Math.min(1, config.reliabilityRisk ?? 0));
  const failureRoll = rnd();
  const failureLapRoll = rnd();
  const failureLap = failureRoll < risk ? 3 + Math.floor(failureLapRoll * Math.max(1, config.laps - 4)) : null;
  const retiredAt: Record<number, number> = {};
  const states: SimLapState[] = [{ lap: 0, order: [...entries].sort((a, b) => (a.grid ?? 99) - (b.grid ?? 99)).map((entry) => entry.id), elapsed: { ...elapsed }, pitted: [], retired: [] }];

  for (let lap = 1; lap <= config.laps; lap++) {
    const pitted: number[] = [];
    for (const entry of entries) {
      const strategy = entry.id === config.selectedId ? config.selected : defaultStrategy;
      if (entry.id === config.selectedId && failureLap === lap) {
        retiredAt[entry.id] = lap;
        elapsed[entry.id] = Number.POSITIVE_INFINITY;
        continue;
      }
      if (retiredAt[entry.id]) continue;
      const active = strategy.pitLap && lap > strategy.pitLap && strategy.secondCompound
        ? { ...strategy, compound: strategy.secondCompound }
        : strategy;
      elapsed[entry.id] += lapTime(entry, active, lap, config.laps, weather, rnd);
      if (strategy.pitLap === lap) {
        elapsed[entry.id] += PIT_LOSS;
        pitted.push(entry.id);
      }
    }

    let order = entries.map((entry) => entry.id).sort((a, b) => elapsed[a] - elapsed[b]);
    if (config.safetyCarLap === lap) {
      const leader = elapsed[order[0]];
      order.filter((id) => Number.isFinite(elapsed[id])).forEach((id, index) => { elapsed[id] = leader + index * 0.28; });
    }
    order = entries.map((entry) => entry.id).sort((a, b) => elapsed[a] - elapsed[b]);
    states.push({ lap, order, elapsed: { ...elapsed }, pitted, retired: Object.keys(retiredAt).map(Number) });
  }

  const order = entries.map((entry) => entry.id).sort((a, b) => elapsed[a] - elapsed[b]);
  return { states, order, elapsed: { ...elapsed }, retiredAt };
}

export function monteCarlo(entries: SimEntry[], config: SimConfig, runs = 200): { podiumRate: number; meanFinish: number; best: number; worst: number; retirementRate: number } {
  const finishes: number[] = [];
  let retirements = 0;
  for (let i = 0; i < runs; i++) {
    const result = simulate(entries, { ...config, seed: config.seed + i * 7919 });
    finishes.push(result.order.indexOf(config.selectedId) + 1);
    if (result.retiredAt[config.selectedId]) retirements++;
  }
  return {
    podiumRate: finishes.filter((finish) => finish <= 3).length / finishes.length,
    meanFinish: finishes.reduce((sum, finish) => sum + finish, 0) / finishes.length,
    best: Math.min(...finishes),
    worst: Math.max(...finishes),
    retirementRate: retirements / runs,
  };
}

export interface PitWindowResult {
  label: "undercut" | "baseline" | "overcut";
  pitLap: number;
  podiumRate: number;
  meanFinish: number;
}

/** Compare the same strategy four laps early, as configured, and four laps late. */
export function comparePitWindow(entries: SimEntry[], config: SimConfig, runs = 120): PitWindowResult[] {
  const base = config.selected.pitLap ?? Math.round(config.laps * 0.5);
  return ([
    ["undercut", Math.max(3, base - 4)],
    ["baseline", base],
    ["overcut", Math.min(config.laps - 2, base + 4)],
  ] as const).map(([label, pitLap]) => {
    const summary = monteCarlo(entries, { ...config, selected: { ...config.selected, pitLap } }, runs);
    return { label, pitLap, podiumRate: summary.podiumRate, meanFinish: summary.meanFinish };
  });
}
