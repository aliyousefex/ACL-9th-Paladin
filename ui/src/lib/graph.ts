/**
 * Questions about the Milestone 2 knowledge graph, answered in the browser.
 *
 * `public/data/graph/graph.json` is written by `scripts/export_graph_data.py` from the same CSV files that
 * `milestone_2/Create_kg.py` loads into Neo4j, using the rules in `milestone_2/product_queries.cypher`. The
 * site is static, so it cannot reach a database: it answers from this export, and shows the Cypher that asks the
 * same question of the real graph. Pure functions, no framework imports, so they also run under Node in tests.
 */

export type DriverRow = [id: number, code: string, forename: string, surname: string, nationality: string, firstYear: number, lastYear: number, starts: number, wins: number, podiums: number, points: number];
export type ConstructorRow = [id: number, name: string, nationality: string];
export type CircuitRow = [id: number, name: string, country: string];
export type StintRow = [driverId: number, constructorId: number, year: number, races: number, podiums: number, wins: number, points: number];
export type TeammateRow = [driverA: number, driverB: number, constructorId: number, sharedRaces: number, aAhead: number, bAhead: number, firstYear: number, lastYear: number];
export type PodiumRow = [circuitId: number, constructorId: number, driverId: number, podiums: number, wins: number, firstYear: number, lastYear: number];

export interface CypherBlock {
  description: string;
  parameters: string;
  query: string;
}

export interface GraphFile {
  contract: string;
  source: { files: string[]; sha256: string; yearFirst: number; yearLast: number };
  semantics: Record<string, string>;
  cypher: Record<string, CypherBlock>;
  drivers: DriverRow[];
  constructors: ConstructorRow[];
  circuits: CircuitRow[];
  stints: StintRow[];
  teammates: TeammateRow[];
  podiums: PodiumRow[];
}

export interface DriverNode {
  id: number;
  code: string;
  name: string;
  nationality: string;
  firstYear: number;
  lastYear: number;
  starts: number;
  wins: number;
  podiums: number;
  points: number;
}

/** One constructor in which two drivers were teammates, oriented so `ahead` counts are from `from`'s side. */
export interface Link {
  from: number;
  to: number;
  constructorId: number;
  sharedRaces: number;
  fromAhead: number;
  toAhead: number;
  firstYear: number;
  lastYear: number;
}

export interface Hop {
  from: number;
  to: number;
  /** One entry per constructor the pair shared, most shared races first. */
  links: Link[];
  sharedRaces: number;
}

export interface GraphIndex {
  file: GraphFile;
  drivers: Map<number, DriverNode>;
  constructors: Map<number, string>;
  circuits: Map<number, { name: string; country: string }>;
  stints: Map<number, StintRow[]>;
  /** Teammate rows keyed "a-b" with a < b. */
  pairs: Map<string, TeammateRow[]>;
  neighbours: Map<number, number[]>;
  podiumsByCircuit: Map<number, PodiumRow[]>;
}

const pairKey = (a: number, b: number) => (a < b ? `${a}-${b}` : `${b}-${a}`);

export function indexGraph(file: GraphFile): GraphIndex {
  const drivers = new Map<number, DriverNode>();
  for (const [id, code, forename, surname, nationality, firstYear, lastYear, starts, wins, podiums, points] of file.drivers) {
    drivers.set(id, { id, code, name: `${forename} ${surname}`.trim(), nationality, firstYear, lastYear, starts, wins, podiums, points });
  }
  const stints = new Map<number, StintRow[]>();
  for (const row of file.stints) (stints.get(row[0]) ?? stints.set(row[0], []).get(row[0])!).push(row);
  const pairs = new Map<string, TeammateRow[]>();
  const neighbourSets = new Map<number, Set<number>>();
  for (const row of file.teammates) {
    const key = pairKey(row[0], row[1]);
    (pairs.get(key) ?? pairs.set(key, []).get(key)!).push(row);
    (neighbourSets.get(row[0]) ?? neighbourSets.set(row[0], new Set()).get(row[0])!).add(row[1]);
    (neighbourSets.get(row[1]) ?? neighbourSets.set(row[1], new Set()).get(row[1])!).add(row[0]);
  }
  const neighbours = new Map<number, number[]>();
  for (const [id, set] of neighbourSets) neighbours.set(id, [...set].sort((a, b) => a - b));
  const podiumsByCircuit = new Map<number, PodiumRow[]>();
  for (const row of file.podiums) (podiumsByCircuit.get(row[0]) ?? podiumsByCircuit.set(row[0], []).get(row[0])!).push(row);
  return {
    file,
    drivers,
    constructors: new Map(file.constructors.map(([id, name]) => [id, name])),
    circuits: new Map(file.circuits.map(([id, name, country]) => [id, { name, country }])),
    stints,
    pairs,
    neighbours,
    podiumsByCircuit,
  };
}

/** The ways two drivers shared a constructor, oriented from `x` to `y`, most shared races first. */
export function linksBetween(index: GraphIndex, x: number, y: number): Link[] {
  const rows = index.pairs.get(pairKey(x, y)) ?? [];
  return rows
    .map(([a, , constructorId, sharedRaces, aAhead, bAhead, firstYear, lastYear]): Link => {
      const forward = a === x;
      return { from: x, to: y, constructorId, sharedRaces, fromAhead: forward ? aAhead : bAhead, toAhead: forward ? bAhead : aAhead, firstYear, lastYear };
    })
    .sort((p, q) => q.sharedRaces - p.sharedRaces || p.constructorId - q.constructorId);
}

const pairWeight = (index: GraphIndex, x: number, y: number) => (index.pairs.get(pairKey(x, y)) ?? []).reduce((sum, row) => sum + row[3], 0);

export interface Chain {
  /** Number of teammate links between the two drivers. 0 when they are the same driver. */
  distance: number;
  hops: Hop[];
}

/**
 * The shortest chain of teammates between two drivers: fewest links first, then, among chains of that length, the one
 * with the most shared races (the strongest ties). Deterministic. Null when no chain exists in the data.
 */
export function shortestChain(index: GraphIndex, from: number, to: number): Chain | null {
  if (!index.drivers.has(from) || !index.drivers.has(to)) return null;
  if (from === to) return { distance: 0, hops: [] };
  const dist = new Map<number, number>([[from, 0]]);
  const strength = new Map<number, number>([[from, 0]]);
  const previous = new Map<number, number>();
  let frontier = [from];
  while (frontier.length > 0 && !dist.has(to)) {
    const next: number[] = [];
    for (const u of frontier) {
      for (const v of index.neighbours.get(u) ?? []) {
        const w = pairWeight(index, u, v);
        const through = strength.get(u)! + w;
        if (!dist.has(v)) {
          dist.set(v, dist.get(u)! + 1);
          strength.set(v, through);
          previous.set(v, u);
          next.push(v);
        } else if (dist.get(v) === dist.get(u)! + 1 && through > strength.get(v)!) {
          strength.set(v, through);
          previous.set(v, u);
        }
      }
    }
    frontier = next.sort((a, b) => a - b);
  }
  if (!dist.has(to)) return null;
  const path = [to];
  while (path[0] !== from) path.unshift(previous.get(path[0])!);
  const hops: Hop[] = [];
  for (let i = 0; i + 1 < path.length; i += 1) {
    const links = linksBetween(index, path[i], path[i + 1]);
    hops.push({ from: path[i], to: path[i + 1], links, sharedRaces: links.reduce((sum, link) => sum + link.sharedRaces, 0) });
  }
  return { distance: hops.length, hops };
}

export interface SeasonLine {
  year: number;
  constructorId: number;
  constructor: string;
  races: number;
  podiums: number;
  wins: number;
  points: number;
}

export function driverSeasons(index: GraphIndex, id: number): SeasonLine[] {
  return (index.stints.get(id) ?? [])
    .map(([, constructorId, year, races, podiums, wins, points]) => ({ year, constructorId, constructor: index.constructors.get(constructorId) ?? `#${constructorId}`, races, podiums, wins, points }))
    .sort((a, b) => a.year - b.year || a.constructor.localeCompare(b.constructor));
}

export interface TeammateLine {
  id: number;
  name: string;
  sharedRaces: number;
  firstYear: number;
  lastYear: number;
  constructors: string[];
}

/** A driver's teammates, the most shared races first. */
export function teammatesOf(index: GraphIndex, id: number): TeammateLine[] {
  return (index.neighbours.get(id) ?? [])
    .map((other) => {
      const links = linksBetween(index, id, other);
      return {
        id: other,
        name: index.drivers.get(other)?.name ?? `#${other}`,
        sharedRaces: links.reduce((sum, link) => sum + link.sharedRaces, 0),
        firstYear: Math.min(...links.map((link) => link.firstYear)),
        lastYear: Math.max(...links.map((link) => link.lastYear)),
        constructors: links.map((link) => index.constructors.get(link.constructorId) ?? `#${link.constructorId}`),
      };
    })
    .sort((a, b) => b.sharedRaces - a.sharedRaces || a.name.localeCompare(b.name));
}

export interface NetworkLine {
  constructorId: number;
  constructor: string;
  distinctDrivers: number;
  podiums: number;
  drivers: { id: number; name: string; podiums: number; wins: number }[];
}

/** Constructors with at least `minDrivers` different podium finishers at a circuit (circuit_podium_network.cypher). */
export function circuitNetwork(index: GraphIndex, circuitId: number, minDrivers: number): NetworkLine[] {
  const byConstructor = new Map<number, PodiumRow[]>();
  for (const row of index.podiumsByCircuit.get(circuitId) ?? []) (byConstructor.get(row[1]) ?? byConstructor.set(row[1], []).get(row[1])!).push(row);
  return [...byConstructor.entries()]
    .map(([constructorId, rows]) => ({
      constructorId,
      constructor: index.constructors.get(constructorId) ?? `#${constructorId}`,
      distinctDrivers: rows.length,
      podiums: rows.reduce((sum, row) => sum + row[3], 0),
      drivers: rows
        .map((row) => ({ id: row[2], name: index.drivers.get(row[2])?.name ?? `#${row[2]}`, podiums: row[3], wins: row[4] }))
        .sort((a, b) => b.podiums - a.podiums || a.name.localeCompare(b.name)),
    }))
    .filter((line) => line.distinctDrivers >= minDrivers)
    .sort((a, b) => b.distinctDrivers - a.distinctDrivers || b.podiums - a.podiums || a.constructor.localeCompare(b.constructor));
}

/** Unique picker labels: "Lewis Hamilton (2007-2024)". A repeated label gets its id appended. */
export function driverLabels(index: GraphIndex): { byId: Map<number, string>; byLabel: Map<string, number> } {
  const byId = new Map<number, string>();
  const byLabel = new Map<string, number>();
  for (const node of [...index.drivers.values()].sort((a, b) => a.id - b.id)) {
    let label = `${node.name} (${node.firstYear}-${node.lastYear})`;
    if (byLabel.has(label)) label = `${label} #${node.id}`;
    byId.set(node.id, label);
    byLabel.set(label, node.id);
  }
  return { byId, byLabel };
}
