import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { FLAG_KINDS, LAB_WORD, RECORDED_KINDS } from "../src/lib/eventMarks.ts";

const read = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8");

/** The quoted words of a union type written `export type Name = "a" | "b";`. */
function union(source: string, name: string): string[] {
  const match = source.match(new RegExp(`export type ${name} = ([^;]+);`));
  assert.ok(match, `${name} is declared`);
  return [...match![1].matchAll(/"([a-z-]+)"/g)].map((m) => m[1]);
}

const marks = read("../src/components/EventMark.tsx");
/** The drawing of one kind: everything between its `case` and the next one. */
function drawing(kind: string): string {
  const start = marks.indexOf(`case "${kind}":`);
  assert.ok(start >= 0, `EventMark draws "${kind}"`);
  const next = marks.indexOf("case ", start + 5);
  return marks.slice(start, next < 0 ? marks.indexOf("default:") : next);
}

test("every event Race Lab can produce has a word and a mark, so a new kind cannot ship without one", () => {
  const kinds = union(read("../src/features/raceLab/engine.ts"), "LabEventKind");
  assert.ok(kinds.length >= 7, `the simulator's events: ${kinds}`);
  assert.deepEqual(Object.keys(LAB_WORD).sort(), [...kinds].sort(), "a word for each kind, and no word for one that does not exist");
  for (const kind of kinds) {
    drawing(kind);
    assert.match(LAB_WORD[kind as keyof typeof LAB_WORD], /^[A-Z][a-z]+( [a-z]+)?$/, `${kind} is a word in sentence case`);
  }
});

test("every recorded event the decision studio shows has a mark, and none of them is a flag", () => {
  const types = union(read("../src/features/decision/schema.ts"), "RaceEventType").filter((type) => type !== "position");
  assert.deepEqual([...RECORDED_KINDS].sort(), [...types].sort(), "the ledger's events, less the position changes that are not shown");
  for (const kind of RECORDED_KINDS) {
    const art = drawing(kind);
    // the record does not say why a field slowed (a safety car, a red flag, rain), so a flag would name a cause the data does not hold
    assert.doesNotMatch(art, /YELLOW|#ffd23f|#f4f4f2|#0b0e12/, `the recorded "${kind}" is drawn as a flag`);
  }
  for (const flag of FLAG_KINDS) assert.ok(!(RECORDED_KINDS as readonly string[]).includes(flag), `${flag} is a simulated event, never a recorded one`);
});

test("only the two flags have colours of their own; the other marks take the colour of their text, so they follow the theme", () => {
  const coloured = ["start", "pit", "pass", "lead-change", "incident", "retirement", "strategy", "finish", "slow-field"].filter((kind) => /fill=\{(YELLOW|LAMP)\}|#0b0e12|#f4f4f2/.test(drawing(kind)));
  assert.deepEqual(coloured.sort(), ["finish", "incident", "start"], "the yellow flag, the chequered flag, and the red lamps of the start gantry");
  assert.match(marks, /stroke: "currentColor"/);
  assert.match(marks, /aria-hidden/, "a mark is never the only thing that says what happened");
});

test("a mark always sits beside its words, and both event lists use it", () => {
  assert.match(read("../src/features/raceLab/RaceLabPage.tsx"), /<EventMark kind=\{event\.kind\} \/>\{LAB_WORD\[event\.kind\]\}/);
  assert.match(read("../src/features/decision/DecisionStudio.tsx"), /<EventMark kind=\{event\.type\} \/>\{eventLabel\(event, names\)\}/);
});

// ---- the timing-screen colour: purple is the best of what is compared, and is always said in words ---------------------------

test("the best value of a comparison is purple, as on a timing screen, and a legend in words says what purple means", () => {
  const model = read("../src/features/model/ModelPage.tsx");
  assert.match(model, /v === best \? "text-fastest" : "text-steel"/, "the highest score of the three on each metric");
  assert.match(model, /<span className="font-semibold text-fastest">Purple<\/span> marks the highest score of the three/, "the legend");
  assert.match(model, /It is not a win: the intervals below show the differences are within noise/, "and it does not claim more than the intervals allow");
  assert.match(model, /<span className="sr-only">Highest: <\/span>/, "a screen reader is told which value is highest, because colour alone does not say it");

  const drivers = read("../src/features/drivers/DriversPage.tsx");
  assert.match(drivers, /row\.best\?\.\[i\] \? "text-fastest" : "text-steel"/);
  assert.match(drivers, /bg-fastest/, "the marker beside the best value is purple too, and is a shape as well as a colour");
  assert.doesNotMatch(drivers, /bg-signal align-middle/, "red is for the model and for action, not for which number is best");
  assert.match(drivers, /<span className="sr-only">Best: <\/span>/);
  assert.match(drivers, /<span className="font-semibold text-fastest">Purple<\/span> marks the best value in each row/);
  assert.match(drivers, /valid\.length < 2 \|\| valid\.every\(\(v\) => v === valid\[0\]\)/, "nothing is best when every value is the same");

  const circuits = read("../src/features/circuits/CircuitsPage.tsx");
  assert.match(circuits, /seasons\.length > 1 \? Math\.min/, "the quickest lap is marked only when there is another season to be quicker than");
  assert.match(circuits, /text-fastest">Quickest<\/span>/, "and it says Quickest in words");
});
