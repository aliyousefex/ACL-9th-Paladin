import racesJson from "../data/races.json";
import driversJson from "../data/drivers.json";
import standingsJson from "../data/standings.json";
import circuitIndex from "../data/circuits.json";
import circuitStatsJson from "../data/circuit-stats.json";
import portraitsJson from "../data/portraits.json";
import { useEffect, useState } from "react";

/* ------------------------------------------------------------------ types */

export interface RaceMeta {
  id: number;
  slug: string;
  year: number;
  round: number;
  name: string;
  date: string;
  circuitId: number;
  layout: string | null;
  scheduledLaps: number | null;
  lapsRun: number;
  winner: { driverId: number; constructorId: number };
  predicted: number[];
  actual: number[];
  baseline: number[];
  /** Constructor each of those drivers raced for in this race. */
  teams: Record<string, number>;
  hits: number;
  baselineHits: number;
  drivers: number;
  flagged: number;
  scoreSum: number;
}

export interface Entry {
  d: number;
  c: number;
  n: number | null;
  grid: number | null;
  /** Raw model inputs, in the order of `FEATURES`. */
  x: (number | null)[];
  /** Podium score from the selected model. */
  p: number;
  pos: number | null;
  txt: string;
  pts: number | null;
  laps: number | null;
  time: string | null;
  status: string;
  fl: number | null;
}

export interface RaceDetail {
  id: number;
  entries: Entry[];
  laps: { n: number; d: Record<string, { p: (number | null)[]; t: (number | null)[] }> };
  pits: Record<string, [number, number | null][]>;
}

export interface SeasonLine {
  constructorId: number;
  constructors: number[];
  number: number | null;
  races: number;
  podiums: number;
  wins: number;
  points: number | null;
  avgGrid: number | null;
  avgFinish: number | null;
  meanScore: number;
  modelTop3: number;
  modelTop3Correct: number;
  flagged: number;
  flaggedCorrect: number;
  /** [raceId, round, podium score, grid slot or null for the pit lane, finishing order, constructorId, positionText] */
  log: [number, number, number, number | null, number, number, string][];
}

export interface Driver {
  id: number;
  ref: string;
  code: string;
  first: string;
  last: string;
  name: string;
  nationality: string;
  flag: string | null;
  dob: string;
  permanentNumber: number | null;
  seasons: Record<string, SeasonLine>;
}

export interface Constructor {
  id: number;
  ref: string;
  name: string;
  short: string;
  colour: Record<string, string>;
  years: number[];
}

export interface Corner {
  n: number;
  s: number;
  x: number;
  y: number;
  lx: number;
  ly: number;
}

export interface Layout {
  id: string;
  circuitId: number;
  ref: string;
  years: number[];
  viewBox: [number, number];
  path: string;
  samples: [number, number][];
  start: { x: number; y: number; heading: number } | null;
  direction: "clockwise" | "anticlockwise" | null;
  corners: Corner[];
  cornersNote?: string | null;
  sectors: [number, number] | null;
  drs: { from: number; to: number; lengthM: number; agree: number }[] | null;
  metersPerUnit?: number;
  source: {
    outline: string;
    mapYear: number | null;
    rotation: number;
    candidateLap: string | null;
    marks: {
      source: string;
      year: number;
      sessionName: string;
      session: number;
      lapsUsed: number;
      sectorSpreadM: number;
      miniSectorCrossCheckM: number | null;
    } | null;
  };
  verification: Record<string, unknown>;
}

export interface LayoutMeta {
  id: string;
  years: number[];
  file: string | null;
  /** Coarse outline path for thumbnails, in the same coordinates as `viewBox`. */
  thumb?: string;
  viewBox?: [number, number];
  lengthM: number | null;
  turns: number | null;
  note?: string | null;
  direction?: string | null;
  hasSectors?: boolean;
  drsZones?: number | null;
  verification?: Record<string, unknown>;
}

export interface CircuitStats {
  races: number;
  firstYear: number;
  lastYear: number;
  recentWinners: { year: number; driver: string; driverId: number; constructor: string }[];
  gridConversion2014: { grid: number; starts: number; podiums: number; wins: number }[];
  frontRow: { starts: number; podiums: number };
  pole: { starts: number; wins: number; podiums: number };
  fastestLap: Record<string, { ms: number; driverId: number }>;
}

export interface Circuit {
  circuitId: number;
  ref: string;
  name: string;
  location: string;
  country: string;
  flag: string | null;
  distanceKm: number;
  outlineOnly: boolean;
  layouts: LayoutMeta[];
  stats: CircuitStats | null;
}

export interface Credit {
  file: string;
  width: number;
  height: number;
  title: string;
  author: string;
  licence: string;
  licenceUrl: string;
  source: string;
  image: string;
}

/* ------------------------------------------------------------------ registries */

export const RACES = racesJson as unknown as RaceMeta[];
export const DRIVERS = driversJson.drivers as unknown as Driver[];
export const CONSTRUCTORS = driversJson.constructors as unknown as Constructor[];
export const PORTRAITS = portraitsJson as Record<string, Credit>;
export const SEASONS = [2022, 2023, 2024] as const;
export type Season = (typeof SEASONS)[number];

const driverById = new Map(DRIVERS.map((d) => [d.id, d]));
const driverByRef = new Map(DRIVERS.map((d) => [d.ref, d]));
const constructorById = new Map(CONSTRUCTORS.map((c) => [c.id, c]));
const raceById = new Map(RACES.map((r) => [r.id, r]));

export const driver = (id: number): Driver => driverById.get(id)!;
export const driverByReference = (ref: string): Driver | undefined => driverByRef.get(ref);
export const constructor = (id: number): Constructor => constructorById.get(id)!;
export const raceMeta = (id: number): RaceMeta | undefined => raceById.get(id);
export const racesIn = (year: number): RaceMeta[] => RACES.filter((r) => r.year === year);
export const findRace = (year: number, slug: string): RaceMeta | undefined =>
  RACES.find((r) => r.year === year && r.slug === slug);
export const raceHref = (race: RaceMeta): string => `/race/${race.year}/${race.slug}`;

export const standings = standingsJson as unknown as Record<
  string,
  {
    rounds: number[];
    drivers: Record<string, { pts: (number | null)[]; pos: (number | null)[]; wins: number | null }>;
    constructors: Record<string, { pts: (number | null)[]; pos: (number | null)[]; wins: number | null }>;
  }
>;

/* ------------------------------------------------------------------ circuits */

type IndexRow = {
  circuitId: number;
  ref: string;
  key: number | null;
  distanceKm: number;
  outlineOnly?: boolean;
  layouts: LayoutMeta[];
};

const statsFile = circuitStatsJson as {
  circuits: { circuitId: number; ref: string; name: string; location: string; country: string; flag: string | null }[];
  stats: Record<string, CircuitStats>;
};

export const CIRCUITS: Circuit[] = (circuitIndex as IndexRow[])
  .map((row) => {
    const info = statsFile.circuits.find((c) => c.circuitId === row.circuitId);
    return {
      circuitId: row.circuitId,
      ref: row.ref,
      name: info?.name ?? row.ref,
      location: info?.location ?? "",
      country: info?.country ?? "",
      flag: info?.flag ?? null,
      distanceKm: row.distanceKm,
      outlineOnly: Boolean(row.outlineOnly),
      layouts: row.layouts,
      stats: statsFile.stats[String(row.circuitId)] ?? null,
    };
  });

const circuitByIdMap = new Map(CIRCUITS.map((c) => [c.circuitId, c]));
const circuitByRefMap = new Map(CIRCUITS.map((c) => [c.ref, c]));
export const circuit = (id: number): Circuit => circuitByIdMap.get(id)!;
export const circuitByRef = (ref: string): Circuit | undefined => circuitByRefMap.get(ref);
/** Circuits that host at least one of the 68 predicted races. */
export const RACE_CIRCUITS = CIRCUITS.filter((c) => RACES.some((r) => r.circuitId === c.circuitId));

export function layoutFor(c: Circuit, year?: number): LayoutMeta {
  if (year !== undefined) {
    const hit = c.layouts.find((l) => l.years.includes(year));
    if (hit) return hit;
  }
  return c.layouts[c.layouts.length - 1];
}

/** The layout with the longest run of seasons, used for cards that show a circuit in general. */
export function currentLayout(c: Circuit): LayoutMeta {
  return c.layouts[c.layouts.length - 1];
}

/* ------------------------------------------------------------------ lazy files */

const cache = new Map<string, Promise<unknown>>();

function getJson<T>(path: string): Promise<T> {
  let hit = cache.get(path) as Promise<T> | undefined;
  if (!hit) {
    hit = fetch(`${import.meta.env.BASE_URL}${path}`).then((response) => {
      if (!response.ok) throw new Error(`${path}: ${response.status}`);
      return response.json() as Promise<T>;
    });
    hit.catch(() => cache.delete(path));
    cache.set(path, hit);
  }
  return hit;
}

export const loadRace = (id: number) => getJson<RaceDetail>(`data/races/${id}.json`);
export const loadLayout = (id: string) => getJson<Layout>(`data/circuits/${id}.json`);

export interface Resource<T> {
  data: T | null;
  error: Error | null;
  loading: boolean;
}

/** Load a file once, keep the previous value while a new one loads, and surface errors. */
export function useResource<T>(key: string | null, loader: () => Promise<T>): Resource<T> {
  const [state, setState] = useState<Resource<T>>({ data: null, error: null, loading: key !== null });

  useEffect(() => {
    if (key === null) {
      setState({ data: null, error: null, loading: false });
      return;
    }
    let live = true;
    setState((prev) => ({ data: prev.data, error: null, loading: true }));
    loader().then(
      (data) => live && setState({ data, error: null, loading: false }),
      (error: Error) => live && setState({ data: null, error, loading: false }),
    );
    return () => {
      live = false;
    };
    // The key identifies the file; the loader is derived from it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return state;
}

/* ------------------------------------------------------------------ helpers */

export function portraitFor(ref: string): Credit | undefined {
  return PORTRAITS[ref];
}

export function teamColour(constructorId: number, year: number): string {
  const c = constructorById.get(constructorId);
  if (!c) return "#98a0ab";
  return c.colour[String(year)] ?? Object.values(c.colour)[0] ?? "#98a0ab";
}

/** Black or white text, whichever reads better on the colour. */
export function onColour(hex: string): string {
  const n = parseInt(hex.slice(1), 16);
  const channel = (v: number) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  const l = 0.2126 * channel((n >> 16) & 255) + 0.7152 * channel((n >> 8) & 255) + 0.0722 * channel(n & 255);
  return l > 0.38 ? "#0a0b0e" : "#ffffff";
}

export function seasonHits(year: number) {
  const rs = racesIn(year);
  const sum = (f: (r: RaceMeta) => number) => rs.reduce((a, r) => a + f(r), 0) / rs.length;
  return { races: rs.length, model: sum((r) => r.hits), grid: sum((r) => r.baselineHits) };
}
