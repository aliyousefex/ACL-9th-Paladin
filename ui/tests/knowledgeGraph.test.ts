import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import {
  DIAGRAM,
  POSITIONS,
  edgeBetween,
  highlightCypher,
  leaveBox,
  nameOfColumn,
  propertiesByType,
  relationshipsBySource,
  share,
  type Milestone2File,
} from "../src/lib/knowledgeGraph.ts";

const read = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8");
const file = JSON.parse(read("../public/data/graph/milestone2.json")) as Milestone2File;
const question = (n: number) => file.questions.find((q) => q.number === n)!;

test("the export carries its contract, its size and its provenance", () => {
  assert.equal(file.contract, "paladin.milestone2.v1");
  assert.equal(file.source.sha256.length, 64);
  assert.equal(file.source.files.length, 10, "nine CSV files and queries.txt");
  assert.equal(file.counts.nodes, 51113);
  assert.equal(file.counts.relationships, 163510);
  assert.equal(file.schema.reduce((n, node) => n + node.count, 0), file.counts.nodes);
  assert.equal(file.relationships.reduce((n, r) => n + r.count, 0), file.counts.relationships);
});

test("the schema is the brief's: nine labels, three of them facts, and eleven relationships between them", () => {
  assert.deepEqual(file.schema.map((n) => n.label), ["Driver", "Constructor", "Circuit", "Season", "Status", "Race", "Result", "Qualifying", "PitStop"]);
  assert.deepEqual(file.schema.filter((n) => n.kind === "fact").map((n) => n.label), ["Result", "Qualifying", "PitStop"]);
  assert.equal(file.relationships.length, 11);
  const labels = new Set(file.schema.map((n) => n.label));
  for (const r of file.relationships) assert.ok(labels.has(r.from) && labels.has(r.to), `${r.type} joins labels that exist`);
  // every fact points at the race it belongs to, and nothing points at a fact
  for (const fact of ["Result", "Qualifying", "PitStop"]) assert.ok(file.relationships.some((r) => r.from === fact && r.to === "Race" && r.type === "FOR_RACE"), `${fact} is FOR_RACE`);
  assert.ok(file.relationships.every((r) => !["Result", "Qualifying", "PitStop"].includes(r.to)));
  // a fact node's count is its relationship count: one link of each kind per row
  const rows = Object.fromEntries(file.schema.map((n) => [n.label, n.count]));
  for (const r of file.relationships) assert.equal(r.count, rows[r.from], `${r.from} ${r.type}: one link for every ${r.from}`);
  const driver = file.schema.find((n) => n.label === "Driver")!;
  assert.deepEqual(driver.properties.map((p) => [p.name, p.type]), [["driverId", "integer"], ["driverRef", "text"], ["number", "integer"], ["code", "text"], ["forename", "text"], ["surname", "text"], ["dob", "date"], ["nationality", "text"]]);
  assert.deepEqual(propertiesByType(driver).map((g) => g.type), ["integer", "date", "text"], "integer, float, date, text: a driver has no float");
});

test("the Cypher is queries.txt exactly as submitted, in order, and the columns are the brief's", () => {
  const text = read("../../milestone_2/queries.txt");
  const blocks = [...text.split(/^\/\/(\d+)\. Query \d+[ \t]*$/m).slice(1)];
  const submitted = new Map<number, string>();
  for (let i = 0; i < blocks.length; i += 2) submitted.set(Number(blocks[i]), blocks[i + 1].split("\n").map((l) => l.trimEnd()).join("\n").replace(/^\n+|\n+$/g, ""));
  assert.deepEqual(file.questions.map((q) => q.number), [1, 2, 3, 4, 5]);
  for (const q of file.questions) assert.equal(q.cypher, submitted.get(q.number), `Query ${q.number}`);
  assert.deepEqual(question(1).columns, ["Driver", "Points", "Wins"]);
  assert.deepEqual(question(2).columns, ["Constructor", "Entries", "Classified", "Reliability"]);
  assert.deepEqual(question(3).columns, ["Constructor", "Shared_Races", "Hamilton_Ahead", "Bottas_Ahead"]);
  assert.deepEqual(question(4).columns, ["Driver", "Starts", "Avg_Finish", "Wins"]);
  assert.deepEqual(question(5).columns, ["Drivers_Changed", "Drivers"]);
  for (const q of file.questions) for (const row of q.rows) assert.deepEqual(Object.keys(row), q.columns, `Query ${q.number} rows have exactly the columns`);
});

test("the answers are the ones the CSV files give", () => {
  const q1 = question(1).rows as { Driver: string; Points: number; Wins: number }[];
  assert.equal(q1.length, 21);
  assert.deepEqual(q1[0], { Driver: "Max Verstappen", Points: 388.5, Wins: 10 });
  assert.deepEqual(q1[1], { Driver: "Lewis Hamilton", Points: 385.5, Wins: 8 });
  for (let i = 1; i < q1.length; i++) assert.ok(q1[i - 1].Points >= q1[i].Points, "most points first");

  const q2 = question(2).rows as { Constructor: string; Entries: number; Classified: number; Reliability: number }[];
  assert.equal(q2.length, 11);
  for (const r of q2) assert.ok(r.Entries >= 100 && Math.abs(r.Reliability - r.Classified / r.Entries) < 1e-12 && r.Reliability <= 1, r.Constructor);
  assert.equal(q2[0].Constructor, "Mercedes");
  assert.equal(share(q2[0].Reliability), "0.931");

  assert.deepEqual(question(3).rows, [{ Constructor: "Mercedes", Shared_Races: 100, Hamilton_Ahead: 75, Bottas_Ahead: 25 }]);
  assert.equal(nameOfColumn("Hamilton_Ahead"), "Hamilton");

  const q4 = question(4).rows as { Driver: string; Starts: number; Avg_Finish: number; Wins: number }[];
  assert.equal(q4.length, 106);
  assert.deepEqual(q4[0], { Driver: "Ayrton Senna", Starts: 10, Avg_Finish: 3.8, Wins: 6 });
  assert.ok(q4.every((r) => r.Starts >= 5));
  assert.equal(question(4).sharedDrives!.length, 6, "six Monaco drivers had two Results in one race");

  const [q5] = question(5).rows as { Drivers_Changed: number; Drivers: string[] }[];
  assert.equal(q5.Drivers_Changed, 6);
  assert.deepEqual(question(5).moves!.map((m) => m.driver), q5.Drivers, "the moves are the names the query returns");
  assert.ok(question(5).moves!.every((m) => m.from !== m.to));
  assert.deepEqual(question(5).moves!.find((m) => m.driver === "Esteban Ocon"), { driver: "Esteban Ocon", from: "Renault", to: "Alpine F1 Team" });
});

/* ------------------------------------------------------------------ the diagram */

const box = (label: string) => {
  const p = POSITIONS[label];
  return { left: p.x - DIAGRAM.nodeWidth / 2, right: p.x + DIAGRAM.nodeWidth / 2, top: p.y - DIAGRAM.nodeHeight / 2, bottom: p.y + DIAGRAM.nodeHeight / 2 };
};

/** Whether the segment a-b passes through the inside of a rectangle, by clipping it (Liang-Barsky). */
function crosses(a: { x: number; y: number }, b: { x: number; y: number }, r: { left: number; right: number; top: number; bottom: number }): boolean {
  let t0 = 0;
  let t1 = 1;
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  for (const [p, q] of [[-dx, a.x - r.left], [dx, r.right - a.x], [-dy, a.y - r.top], [dy, r.bottom - a.y]] as const) {
    if (p === 0) {
      if (q < 0) return false;
    } else {
      const t = q / p;
      if (p < 0) t0 = Math.max(t0, t);
      else t1 = Math.min(t1, t);
    }
  }
  return t1 - t0 > 1e-6;
}

test("every node has a place inside the drawing, and no two boxes touch", () => {
  const labels = file.schema.map((n) => n.label);
  assert.deepEqual(new Set(Object.keys(POSITIONS)), new Set(labels));
  for (const l of labels) {
    const b = box(l);
    assert.ok(b.left >= 0 && b.right <= DIAGRAM.width && b.top >= 0 && b.bottom <= DIAGRAM.height, `${l} is inside the drawing`);
  }
  for (const a of labels) for (const b of labels) if (a < b) {
    const x = box(a), y = box(b);
    assert.ok(x.right + 8 < y.left || y.right + 8 < x.left || x.bottom + 8 < y.top || y.bottom + 8 < x.top, `${a} and ${b} do not touch`);
  }
});

test("a line leaves a box at its border, and an arrow stops short of the box it points at", () => {
  const out = leaveBox({ x: 0, y: 0 }, { x: 100, y: 0 }, 40, 20);
  assert.deepEqual(out, { x: 20, y: 0 });
  const slanted = leaveBox({ x: 0, y: 0 }, { x: 100, y: 100 }, 40, 20);
  assert.deepEqual(slanted, { x: 10, y: 10 }, "a shallow box is left through its long side only when the line is shallow");
  assert.deepEqual(leaveBox({ x: 5, y: 5 }, { x: 5, y: 5 }), { x: 5, y: 5 });
  for (const r of file.relationships) {
    const e = edgeBetween(r);
    const target = box(r.to);
    assert.ok(!(e.end.x > target.left && e.end.x < target.right && e.end.y > target.top && e.end.y < target.bottom), `${r.type} ends outside ${r.to}`);
    assert.ok(Math.hypot(e.end.x - e.start.x, e.end.y - e.start.y) > 30, `${r.type} is long enough to be seen`);
  }
});

test("no line passes through a box it does not belong to, and no two lines cross: the drawing is planar", () => {
  const edges = file.relationships.map((r) => edgeBetween(r, 0));
  for (const e of edges) {
    for (const l of file.schema.map((n) => n.label)) {
      if (l === e.from || l === e.to) continue;
      assert.ok(!crosses(e.start, e.end, box(l)), `${e.from} ${e.type} ${e.to} runs through ${l}`);
    }
  }
  const ccw = (a: { x: number; y: number }, b: { x: number; y: number }, c: { x: number; y: number }) => (c.y - a.y) * (b.x - a.x) - (b.y - a.y) * (c.x - a.x);
  for (let i = 0; i < edges.length; i++) for (let j = i + 1; j < edges.length; j++) {
    const a = edges[i], b = edges[j];
    if ([a.from, a.to].some((n) => n === b.from || n === b.to)) continue; // lines that share a node meet there
    const proper = ccw(a.start, a.end, b.start) * ccw(a.start, a.end, b.end) < 0 && ccw(b.start, b.end, a.start) * ccw(b.start, b.end, a.end) < 0;
    assert.ok(!proper, `${a.from} ${a.type} ${a.to} crosses ${b.from} ${b.type} ${b.to}`);
  }
});

test("the labels on the lines do not run into each other", () => {
  const edges = file.relationships.map((r) => edgeBetween(r));
  for (let i = 0; i < edges.length; i++) for (let j = i + 1; j < edges.length; j++) {
    const a = edges[i].middle, b = edges[j].middle;
    // each label is about 15 units high and 8 units a letter: two labels at one height must be a word apart, and two at one place a line apart
    const wide = Math.abs(a.x - b.x) < (edges[i].type.length + edges[j].type.length) * 4;
    const near = Math.abs(a.y - b.y) < 18;
    assert.ok(!(wide && near), `${edges[i].type} and ${edges[j].type} overlap`);
  }
});

test("the relationships are listed by the node that holds the link, facts after the race", () => {
  assert.deepEqual(relationshipsBySource(file.relationships).map((g) => g.source), ["Race", "Result", "Qualifying", "PitStop"]);
  assert.deepEqual(relationshipsBySource(file.relationships).map((g) => g.list.length), [2, 4, 3, 2]);
});

/* ------------------------------------------------------------------ reading the Cypher */

test("highlighting never changes the text, marks keywords and strings, and leaves names alone", () => {
  for (const q of file.questions) assert.equal(highlightCypher(q.cypher).map((t) => t.text).join(""), q.cypher, `Query ${q.number} comes back whole`);
  const tokens = highlightCypher("MATCH (r:Race)-[:IN_SEASON]->(s) WHERE s.status STARTS WITH '+' AND NOT s.year IN [1] RETURN s ORDER BY s DESC");
  const keywords = tokens.filter((t) => t.kind === "keyword").map((t) => t.text);
  assert.deepEqual(keywords, ["MATCH", "WHERE", "STARTS WITH", "AND", "NOT", "IN", "RETURN", "ORDER BY", "DESC"]);
  assert.deepEqual(tokens.filter((t) => t.kind === "string").map((t) => t.text), ["'+'"]);
  assert.equal(tokens.filter((t) => t.text.includes("IN_SEASON") && t.kind !== "plain").length, 0);
});

/* ------------------------------------------------------------------ what the page may say */

test("the page does not claim a check it cannot show: no 'verified' anywhere in what it displays", () => {
  const source = [read("../src/features/history/KnowledgeGraph.tsx"), read("../src/lib/knowledgeGraph.ts"), JSON.stringify(file.questions.map((q) => [q.title, q.question, q.note]))].join("\n");
  assert.doesNotMatch(source, /verif/i);
  const shown = read("../src/features/history/KnowledgeGraph.tsx");
  assert.doesNotMatch(shown, /className="[^"]*\beyebrow\b/, "no small label above a title");
  assert.match(shown, /tag="record"/, "its numbers are labelled as the historical record");
});
