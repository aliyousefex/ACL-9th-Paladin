/**
 * The Milestone 2 knowledge graph as the "Knowledge graph" tab shows it: its schema and size, and the five questions of the
 * brief with the Cypher as submitted and the answer to each.
 *
 * `public/data/graph/milestone2.json` is written by `scripts/export_graph_data.py`. The answers are worked out from the same
 * CSV files `milestone_2/Create_kg.py` loads (plain pandas, no database), and the Cypher is the text of `queries.txt`. Pure
 * functions with no framework imports, so they also run under Node in tests.
 */

export type PropertyType = "integer" | "float" | "date" | "text";

export interface SchemaNode {
  label: string;
  kind: "entity" | "fact";
  key: string;
  count: number;
  properties: { name: string; type: PropertyType }[];
}

export interface SchemaRelationship {
  type: string;
  from: string;
  to: string;
  count: number;
}

export interface QuestionBlock {
  number: number;
  title: string;
  question: string;
  note: string;
  cypher: string;
  columns: string[];
  rows: Record<string, unknown>[];
  /** Question 4: drivers with two Results in one Monaco race. */
  sharedDrives?: { driver: string; year: number }[];
  /** Question 5: where each driver who changed went from and to. */
  moves?: { driver: string; from: string; to: string }[];
}

export interface Milestone2File {
  contract: string;
  source: { files: string[]; sha256: string };
  counts: { nodes: number; relationships: number };
  schema: SchemaNode[];
  relationships: SchemaRelationship[];
  questions: QuestionBlock[];
}

export interface StandingRow { Driver: string; Points: number; Wins: number }
export interface ReliabilityRow { Constructor: string; Entries: number; Classified: number; Reliability: number }
export interface HeadToHeadRow { Constructor: string; Shared_Races: number; Hamilton_Ahead: number; Bottas_Ahead: number }
export interface MonacoRow { Driver: string; Starts: number; Avg_Finish: number; Wins: number }
export interface ChangedRow { Drivers_Changed: number; Drivers: string[] }

/* ------------------------------------------------------------------ the schema diagram */

export const DIAGRAM = { width: 900, height: 490, nodeWidth: 156, nodeHeight: 56 } as const;

/**
 * Where each node sits. The three facts and the constructor stand in a column down the middle, the driver and the race at
 * either side of them, so that the four-sided figure driver, result, race and qualifying has the constructor inside it and
 * the pit stop outside it, and no line has to cross another.
 */
export const POSITIONS: Record<string, { x: number; y: number }> = {
  Status: { x: 450, y: 40 },
  Result: { x: 450, y: 140 },
  Constructor: { x: 450, y: 245 },
  Qualifying: { x: 450, y: 350 },
  PitStop: { x: 450, y: 450 },
  Driver: { x: 110, y: 245 },
  Race: { x: 790, y: 245 },
  Circuit: { x: 790, y: 115 },
  Season: { x: 790, y: 375 },
};

export interface Point {
  x: number;
  y: number;
}

/** Where the line from the centre of a box to a point outside it leaves the box. */
export function leaveBox(centre: Point, to: Point, width: number = DIAGRAM.nodeWidth, height: number = DIAGRAM.nodeHeight): Point {
  const dx = to.x - centre.x;
  const dy = to.y - centre.y;
  if (dx === 0 && dy === 0) return centre;
  const scale = Math.min(dx === 0 ? Infinity : width / 2 / Math.abs(dx), dy === 0 ? Infinity : height / 2 / Math.abs(dy));
  return { x: centre.x + dx * scale, y: centre.y + dy * scale };
}

export interface Edge {
  type: string;
  from: string;
  to: string;
  start: Point;
  end: Point;
  middle: Point;
}

/** A relationship as a line from the edge of one box to the edge of the other, with its middle for the label. */
export function edgeBetween(relationship: Pick<SchemaRelationship, "type" | "from" | "to">, gap = 6): Edge {
  const a = POSITIONS[relationship.from];
  const b = POSITIONS[relationship.to];
  if (!a || !b) throw new Error(`no place on the diagram for ${relationship.from} or ${relationship.to}`);
  const start = leaveBox(a, b);
  const end = leaveBox(b, a);
  // stop a little short of the target so the arrowhead does not sit on its border
  const length = Math.hypot(end.x - start.x, end.y - start.y) || 1;
  const pulled = { x: end.x - ((end.x - start.x) / length) * gap, y: end.y - ((end.y - start.y) / length) * gap };
  return { type: relationship.type, from: relationship.from, to: relationship.to, start, end: pulled, middle: { x: (start.x + pulled.x) / 2, y: (start.y + pulled.y) / 2 } };
}

/** The relationships of each source node, in the order the sources are drawn, for the list under the diagram. */
export function relationshipsBySource(relationships: SchemaRelationship[]): { source: string; list: SchemaRelationship[] }[] {
  const order = ["Race", "Result", "Qualifying", "PitStop"];
  const sources = [...new Set(relationships.map((r) => r.from))].sort((a, b) => (order.indexOf(a) + 1 || 99) - (order.indexOf(b) + 1 || 99));
  return sources.map((source) => ({ source, list: relationships.filter((r) => r.from === source) }));
}

/** The properties of a node grouped by type, in the order a reader looks for them. */
export function propertiesByType(node: SchemaNode): { type: PropertyType; names: string[] }[] {
  const order: PropertyType[] = ["integer", "float", "date", "text"];
  return order.map((type) => ({ type, names: node.properties.filter((p) => p.type === type).map((p) => p.name) })).filter((g) => g.names.length > 0);
}

/* ------------------------------------------------------------------ reading a Cypher query */

export interface Token {
  text: string;
  kind: "keyword" | "string" | "plain";
}

const KEYWORDS = [
  "MATCH", "OPTIONAL MATCH", "WHERE", "WITH", "RETURN", "ORDER BY", "LIMIT", "SKIP", "UNWIND", "DISTINCT", "AS", "AND", "OR", "NOT", "IN", "IS NULL", "IS NOT NULL",
  "STARTS WITH", "ENDS WITH", "CONTAINS", "CASE", "WHEN", "THEN", "ELSE", "END", "ASC", "DESC",
];
const TOKEN = new RegExp(`('[^']*'|\\b(?:${KEYWORDS.map((k) => k.replace(/ /g, "\\s+")).join("|")})\\b)`, "g");

/** A query split into plain text, keywords and strings, so the page can give the keywords weight. Joining the tokens gives the text back. */
export function highlightCypher(code: string): Token[] {
  const tokens: Token[] = [];
  let last = 0;
  for (const match of code.matchAll(TOKEN)) {
    const at = match.index ?? 0;
    if (at > last) tokens.push({ text: code.slice(last, at), kind: "plain" });
    tokens.push({ text: match[0], kind: match[0].startsWith("'") ? "string" : "keyword" });
    last = at + match[0].length;
  }
  if (last < code.length) tokens.push({ text: code.slice(last), kind: "plain" });
  return tokens;
}

/** "Hamilton_Ahead" -> "Hamilton": the name in a column of question 3. */
export const nameOfColumn = (column: string): string => column.replace(/_Ahead$/, "");

/** 0.931 for 298 of 320, to three places. */
export const share = (value: number): string => value.toFixed(3);
