/** Deterministic lap-level engine for Race Lab. No React or browser dependencies. */

export type LabModel = "grid" | "coursework" | "research" | "hybrid";
export type LabMode = "simulator" | "strategist" | "battle";
export type Pace = "conserve" | "balanced" | "attack";
export type Tyre = "soft" | "medium" | "hard";

export interface LabEntrant {
  id: number;
  code: string;
  name: string;
  team: string;
  colour: string;
  grid: number;
  coursework: number;
  researchPosition: number | null;
  researchPodium: number | null;
  reliability: number;
}

export interface LabStrategy { pace: Pace; tyre: Tyre; pitLap: number | null }
export interface LabConfig {
  raceId: number;
  raceName: string;
  year: number;
  laps: number;
  seed: number;
  model: LabModel;
  mode: LabMode;
  controlledId: number | null;
  entrants: LabEntrant[];
}

export interface LabCar {
  id: number;
  totalMs: number;
  lastLapMs: number | null;
  bestLapMs: number | null;
  tyre: Tyre;
  tyreAge: number;
  pitStops: number;
  retired: boolean;
  finished: boolean;
  progress: number;
  strategy: LabStrategy;
}

export type LabEventKind = "start" | "pass" | "pit" | "incident" | "retirement" | "finish" | "strategy";
export interface LabEvent { lap: number; kind: LabEventKind; driverId: number | null; message: string; simulated: true }
export interface LabForecast { driverId: number; win: number; podium: number; expectedPosition: number }
export interface LabState {
  config: LabConfig;
  lap: number;
  cars: LabCar[];
  events: LabEvent[];
  forecast: LabForecast[];
  finished: boolean;
}

export const MODELS: Record<LabModel, { name: string; contract: string; limitation: string }> = {
  grid: { name: "Grid baseline", contract: "Starting position sets relative pace.", limitation: "A transparent sporting baseline; it is not trained." },
  coursework: { name: "Coursework logistic model", contract: "The validated pre-race podium score sets relative pace.", limitation: "The classifier does not predict lap times; Race Lab maps its score into an explicit game pace rule." },
  research: { name: "Research finishing order", contract: "Expected position and reliability risk shape pace and retirement probability.", limitation: "Retrospective 2022-2024 research evidence, not a pristine final holdout or live strategy model." },
  hybrid: { name: "Strategy ensemble", contract: "Grid, coursework score, and research order jointly shape the field.", limitation: "An assumption-driven game adapter, not an independently validated model." },
};

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));
export function random01(seed: number, a: number, b: number, salt = 0): number {
  let h = (seed ^ 0x9e3779b9) >>> 0;
  for (const value of [a, b, salt]) {
    h = Math.imul(h ^ value, 0x85ebca6b) >>> 0;
    h ^= h >>> 13;
    h = Math.imul(h, 0xc2b2ae35) >>> 0;
    h ^= h >>> 16;
  }
  return (h >>> 0) / 4294967296;
}

export function strengthOf(entry: LabEntrant, model: LabModel, field: number): number {
  const grid = 1 - (entry.grid - 1) / Math.max(1, field - 1);
  const research = entry.researchPosition === null ? entry.coursework : 1 - (entry.researchPosition - 1) / Math.max(1, field - 1);
  if (model === "grid") return grid;
  if (model === "coursework") return entry.coursework;
  if (model === "research") return research;
  return 0.3 * grid + 0.35 * entry.coursework + 0.35 * research;
}

const defaultStrategy = (entry: LabEntrant, laps: number): LabStrategy => ({
  pace: entry.grid <= 5 ? "balanced" : "attack",
  tyre: entry.grid % 3 === 0 ? "hard" : entry.grid % 2 === 0 ? "soft" : "medium",
  pitLap: laps < 8 ? null : Math.round(laps * (0.46 + (entry.grid % 5) * 0.025)),
});

function forecasts(config: LabConfig, cars: LabCar[]): LabForecast[] {
  const active = cars.filter((car) => !car.retired);
  const raw = active.map((car) => {
    const entry = config.entrants.find((item) => item.id === car.id)!;
    const pace = strengthOf(entry, config.model, config.entrants.length);
    const time = car.totalMs / Math.max(1, config.laps ? Math.max(1, car.progress) : 1);
    return { id: car.id, score: Math.exp(3.4 * pace - time / 100_000) };
  });
  const sum = raw.reduce((total, item) => total + item.score, 0) || 1;
  const ranked = [...raw].sort((a, b) => b.score - a.score);
  return config.entrants.map((entry) => {
    const item = raw.find((row) => row.id === entry.id);
    if (!item) return { driverId: entry.id, win: 0, podium: 0, expectedPosition: config.entrants.length };
    const rank = ranked.findIndex((row) => row.id === entry.id) + 1;
    const win = item.score / sum;
    return { driverId: entry.id, win, podium: clamp(win * 2.6 + (rank <= 3 ? 0.18 : 0), 0, 0.98), expectedPosition: clamp(rank * 0.72 + (1 - win) * 2, 1, config.entrants.length) };
  });
}

export function initialLabRace(config: LabConfig): LabState {
  if (config.entrants.length < 6) throw new Error("Race Lab requires at least six distinct drivers.");
  if (new Set(config.entrants.map((entry) => entry.id)).size !== config.entrants.length) throw new Error("Duplicate drivers are not supported.");
  const cars = config.entrants.map((entry): LabCar => ({
    id: entry.id, totalMs: (entry.grid - 1) * 180, lastLapMs: null, bestLapMs: null, tyre: defaultStrategy(entry, config.laps).tyre,
    tyreAge: 0, pitStops: 0, retired: false, finished: false, progress: 0, strategy: defaultStrategy(entry, config.laps),
  }));
  return { config, lap: 0, cars, events: [{ lap: 0, kind: "start", driverId: null, message: `${config.raceName} simulation armed`, simulated: true }], forecast: forecasts(config, cars), finished: false };
}

export function orderLab(state: LabState): LabCar[] {
  return [...state.cars].sort((a, b) => Number(a.retired) - Number(b.retired) || Number(b.finished) - Number(a.finished) || b.progress - a.progress || a.totalMs - b.totalMs || a.id - b.id);
}

export function setPlayerStrategy(state: LabState, strategy: Partial<LabStrategy>): LabState {
  const id = state.config.controlledId;
  if (id === null || state.finished) return state;
  const car = state.cars.find((item) => item.id === id);
  if (!car || car.retired) return state;
  const next = { ...car.strategy, ...strategy };
  return {
    ...state,
    cars: state.cars.map((item) => item.id === id ? { ...item, strategy: next } : item),
    events: [...state.events, { lap: state.lap, kind: "strategy", driverId: id, message: `${state.config.entrants.find((e) => e.id === id)?.code} strategy changed: ${next.pace}, ${next.tyre}${next.pitLap ? `, stop lap ${next.pitLap}` : ""}`, simulated: true }],
  };
}

export function advanceLabLap(state: LabState): LabState {
  if (state.finished) return state;
  const lap = state.lap + 1;
  const previous = orderLab(state).map((car) => car.id);
  const events: LabEvent[] = [];
  const cars = state.cars.map((car): LabCar => {
    if (car.retired || car.finished) return car;
    const entry = state.config.entrants.find((item) => item.id === car.id)!;
    const strategy = car.strategy;
    const pit = strategy.pitLap === lap;
    const reliability = state.config.model === "grid" || state.config.model === "coursework" ? 0.012 : entry.reliability;
    const riskMultiplier = strategy.pace === "attack" ? 1.35 : strategy.pace === "conserve" ? 0.68 : 1;
    if (random01(state.config.seed, car.id, lap, 91) < reliability * riskMultiplier / Math.max(8, state.config.laps)) {
      events.push({ lap, kind: "retirement", driverId: car.id, message: `${entry.code} retires with a simulated reliability event`, simulated: true });
      return { ...car, retired: true, lastLapMs: null, progress: lap - 0.4 };
    }
    const strength = strengthOf(entry, state.config.model, state.config.entrants.length);
    const pace = strategy.pace === "attack" ? -520 : strategy.pace === "conserve" ? 460 : 0;
    const tyreBase = strategy.tyre === "soft" ? -280 : strategy.tyre === "hard" ? 240 : 0;
    const wearRate = strategy.tyre === "soft" ? 46 : strategy.tyre === "hard" ? 17 : 28;
    const wear = car.tyreAge * wearRate;
    const variation = (random01(state.config.seed, car.id, lap, 17) - 0.5) * 900;
    const incident = random01(state.config.seed, car.id, lap, 33) < (strategy.pace === "attack" ? 0.035 : 0.014);
    const incidentLoss = incident ? 3200 + random01(state.config.seed, car.id, lap, 34) * 4800 : 0;
    const pitLoss = pit ? 20_500 : 0;
    const lapMs = Math.round(91_500 - strength * 6_200 + pace + tyreBase + wear + variation + incidentLoss + pitLoss);
    if (pit) events.push({ lap, kind: "pit", driverId: car.id, message: `${entry.code} pits for ${strategy.tyre} tyres (+20.5s assumption)`, simulated: true });
    if (incident) events.push({ lap, kind: "incident", driverId: car.id, message: `${entry.code} loses ${Math.round(incidentLoss / 100) / 10}s in a simulated incident`, simulated: true });
    if (lap === state.config.laps) events.push({ lap, kind: "finish", driverId: car.id, message: `${entry.code} takes the chequered flag`, simulated: true });
    return { ...car, totalMs: car.totalMs + lapMs, lastLapMs: lapMs, bestLapMs: car.bestLapMs === null ? lapMs : Math.min(car.bestLapMs, lapMs), tyreAge: pit ? 0 : car.tyreAge + 1, pitStops: car.pitStops + Number(pit), finished: lap === state.config.laps, progress: lap + clamp((91_500 - lapMs) / 30_000, -0.25, 0.25) };
  });
  const provisional: LabState = { ...state, lap, cars, events: [...state.events, ...events], forecast: [], finished: lap === state.config.laps || cars.every((car) => car.retired || car.finished) };
  const current = orderLab(provisional).map((car) => car.id);
  current.forEach((id, index) => {
    const old = previous.indexOf(id);
    if (old > index && lap > 1) {
      const code = state.config.entrants.find((entry) => entry.id === id)?.code;
      provisional.events.push({ lap, kind: "pass", driverId: id, message: `${code} moves up to P${index + 1}`, simulated: true });
    }
  });
  provisional.forecast = forecasts(state.config, cars);
  return provisional;
}

export function finishLabRace(state: LabState): LabState {
  let next = state;
  while (!next.finished) next = advanceLabLap(next);
  return next;
}

export function modelBattle(config: LabConfig, models: LabModel[] = ["grid", "coursework", "research", "hybrid"]): { model: LabModel; winner: number; podium: number[] }[] {
  return models.map((model) => {
    const result = finishLabRace(initialLabRace({ ...config, model, mode: "battle" }));
    const order = orderLab(result);
    return { model, winner: order[0].id, podium: order.slice(0, 3).map((car) => car.id) };
  });
}

export const labRecord = (state: LabState) => ({ contract: "paladin.race-lab.v1", evidence: "assumption-driven simulation", config: state.config, final: orderLab(state).map((car, index) => ({ position: index + 1, ...car })), events: state.events, forecast: state.forecast });

