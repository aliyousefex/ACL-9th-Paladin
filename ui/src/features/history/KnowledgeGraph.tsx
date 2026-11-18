import { useState, type ReactNode } from "react";
import { ErrorNote, LightsLoader, Note } from "../../components/Bits";
import { Panel } from "../../components/Panel";
import { loadMilestone2, useResource } from "../../lib/data";
import {
  DIAGRAM,
  POSITIONS,
  edgeBetween,
  highlightCypher,
  nameOfColumn,
  propertiesByType,
  relationshipsBySource,
  share,
  type ChangedRow,
  type HeadToHeadRow,
  type Milestone2File,
  type MonacoRow,
  type QuestionBlock,
  type ReliabilityRow,
  type StandingRow,
} from "../../lib/knowledgeGraph";
import { capitalised, countWord, listOf } from "../drivers/profile";

const count = (n: number): string => n.toLocaleString("en-GB");
const points = (v: number): string => (Number.isInteger(v) ? String(v) : v.toFixed(1));

/** The "Knowledge graph" tab of the History page: how the Milestone 2 graph is built, then its five questions with their Cypher and answers. */
export function KnowledgeGraph() {
  const resource = useResource("milestone2", loadMilestone2);
  if (resource.error) return <ErrorNote detail="The knowledge graph file could not be loaded." />;
  if (!resource.data) return <LightsLoader label="Loading the knowledge graph" />;
  const file = resource.data;
  return (
    <>
      <SchemaPanel file={file} />
      {file.questions.map((question) => (
        <QuestionPanel key={question.number} question={question} total={file.questions.length} />
      ))}
      <Note>
        Source: {file.source.files.length} files from <code>milestone_2/</code> (the nine CSV files and <code>queries.txt</code>, SHA-256 {file.source.sha256.slice(0, 12)}…). The answers are worked out from the CSV files the graph is built
        from, by the rules of each question. The Cypher is the text of <code>queries.txt</code>, as submitted.
      </Note>
    </>
  );
}

/* ------------------------------------------------------------------ the schema */

function SchemaPanel({ file }: { file: Milestone2File }) {
  const facts = file.schema.filter((n) => n.kind === "fact").map((n) => n.label);
  return (
    <Panel title="How the graph is built" context={`${count(file.counts.nodes)} nodes and ${count(file.counts.relationships)} relationships, from nine CSV files`} tag="record">
      <p className="max-w-[74ch] text-[1.08rem] leading-relaxed text-ink">
        A driver's name or a circuit's country hardly ever changes, so it lives on an <strong>entity</strong> node. Which constructor a driver raced for, the grid slot and the finishing position change from race to race, so they live
        on a <strong>fact</strong> node ({listOf(facts)}) that links the driver to that one race. Every fact points at the race it belongs to, so a question that crosses a driver and a race passes through a fact.
      </p>

      <div className="mt-6 hidden border border-line bg-tower md:block">
        <SchemaDiagram file={file} />
      </div>
      <ul className="mt-6 grid grid-cols-2 gap-px bg-line md:hidden" aria-label="The nine kinds of node">
        {file.schema.map((node, i) => (
          <li key={node.label} className={`bg-panel px-3 py-2.5 ${i === file.schema.length - 1 && file.schema.length % 2 === 1 ? "col-span-2" : ""}`}>
            <p className="font-display text-[1.15rem] font-bold">{node.label}</p>
            <p className="text-[0.88rem] text-mute">
              {node.kind === "fact" ? "fact" : "entity"} · {count(node.count)} nodes
            </p>
          </li>
        ))}
      </ul>
      <p className="mt-2 hidden flex-wrap items-center gap-x-6 gap-y-1 text-[0.88rem] text-mute md:flex">
        <span className="inline-flex items-center gap-2">
          <span aria-hidden className="inline-block h-3.5 w-6 border border-line2 bg-paper" /> Entity node
        </span>
        <span className="inline-flex items-center gap-2">
          <span aria-hidden className="inline-block h-3.5 w-6 border-2 border-steel bg-panel2" /> Fact node
        </span>
        <span>An arrow points from the node that holds the link to the node it links to.</span>
      </p>

      <h3 className="display mt-8 text-[1.5rem]">Relationships</h3>
      <ul className="mt-3 grid gap-px bg-line sm:grid-cols-2 lg:grid-cols-4">
        {relationshipsBySource(file.relationships).map(({ source, list }) => (
          <li key={source} className="bg-panel px-4 py-3">
            <p className="font-display text-[1.15rem] font-bold uppercase">{source}</p>
            <ul className="mt-1.5 space-y-1">
              {list.map((r) => (
                <li key={`${r.type}-${r.to}`} className="flex items-baseline justify-between gap-3 text-[0.92rem] text-steel">
                  <span>
                    <span className="font-semibold text-ink">{r.type}</span> to {r.to}
                  </span>
                  <span className="figure text-[0.95rem] text-mute">{count(r.count)}</span>
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ul>

      <details className="group mt-6 border border-line bg-tower">
        <summary className="flex min-h-11 cursor-pointer items-center justify-between gap-3 px-4 py-2 font-display text-[1rem] font-semibold text-steel hover:text-ink">
          What each node holds
          <span aria-hidden className="text-mute transition-transform group-open:rotate-45">
            +
          </span>
        </summary>
        <div className="relative overflow-x-auto border-t border-line px-4 py-4">
          <table className="w-full min-w-[560px] border-collapse text-left">
            <caption className="sr-only">The properties of every node label, by type</caption>
            <thead>
              <tr className="border-b border-ink text-[0.85rem] text-steel">
                <th className="py-2 pr-3 font-semibold">Node</th>
                <th className="py-2 pr-3 font-semibold">Unique key</th>
                <th className="py-2 font-semibold">Properties</th>
              </tr>
            </thead>
            <tbody>
              {file.schema.map((node) => (
                <tr key={node.label} className="border-b border-line align-top">
                  <th scope="row" className="py-2.5 pr-3 font-display text-[1.1rem] font-semibold">
                    {node.label}
                    <span className="block text-[0.82rem] font-normal text-mute">{node.kind === "fact" ? "fact" : "entity"}</span>
                  </th>
                  <td className="py-2.5 pr-3 text-steel">{node.key}</td>
                  <td className="py-2.5 text-[0.92rem] text-steel">
                    {propertiesByType(node).map((group) => (
                      <p key={group.type}>
                        <span className="text-mute">{group.type}: </span>
                        {group.names.join(", ")}
                      </p>
                    ))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-3 max-w-[74ch] text-[0.85rem] leading-snug text-mute">A value that is missing in the CSV file (the literal \N, or an empty cell) is left off the node, not stored as null or as empty text.</p>
        </div>
      </details>
    </Panel>
  );
}

function SchemaDiagram({ file }: { file: Milestone2File }) {
  const edges = file.relationships.map((r) => edgeBetween(r));
  const { nodeWidth: w, nodeHeight: h } = DIAGRAM;
  return (
    <svg viewBox={`0 0 ${DIAGRAM.width} ${DIAGRAM.height}`} className="block h-auto w-full" aria-hidden focusable="false">
      <defs>
        <marker id="kg-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto">
          <path d="M0 0 L10 5 L0 10 z" fill="var(--color-mute)" />
        </marker>
      </defs>
      {edges.map((e) => (
        <line key={`${e.from}-${e.type}-${e.to}`} x1={e.start.x} y1={e.start.y} x2={e.end.x} y2={e.end.y} stroke="var(--color-mute)" strokeWidth={1.5} markerEnd="url(#kg-arrow)" />
      ))}
      {file.schema.map((node) => {
        const p = POSITIONS[node.label];
        const fact = node.kind === "fact";
        return (
          <g key={node.label}>
            <rect x={p.x - w / 2} y={p.y - h / 2} width={w} height={h} fill={fact ? "var(--color-panel2)" : "var(--color-paper)"} stroke={fact ? "var(--color-steel)" : "var(--color-line2)"} strokeWidth={fact ? 2 : 1.5} />
            <text x={p.x} y={p.y - 4} textAnchor="middle" className="font-display" fontSize={21} fontWeight={700} fill="var(--color-ink)">
              {node.label}
            </text>
            <text x={p.x} y={p.y + 17} textAnchor="middle" fontSize={15} fill="var(--color-mute)">
              {count(node.count)} nodes
            </text>
          </g>
        );
      })}
      {edges.map((e) => (
        <text
          key={`label-${e.from}-${e.type}-${e.to}`}
          x={e.middle.x}
          y={e.middle.y}
          textAnchor="middle"
          dominantBaseline="central"
          fontSize={15}
          fontWeight={600}
          fill="var(--color-steel)"
          style={{ paintOrder: "stroke", stroke: "var(--color-tower)", strokeWidth: 7, strokeLinejoin: "round" }}
        >
          {e.type}
        </text>
      ))}
    </svg>
  );
}

/* ------------------------------------------------------------------ the five questions */

function QuestionPanel({ question, total }: { question: QuestionBlock; total: number }) {
  return (
    <Panel title={question.title} context={`Question ${question.number} of ${total}`} tag="record">
      <p className="max-w-[74ch] text-[1.05rem] leading-relaxed text-ink">{question.question}</p>
      <div className="mt-5">{answer(question)}</div>
      <p className="mt-4 max-w-[74ch] text-[0.88rem] leading-snug text-mute">{question.note}</p>
      <QueryCode question={question} />
    </Panel>
  );
}

function answer(question: QuestionBlock): ReactNode {
  switch (question.number) {
    case 1:
      return <Standings rows={question.rows as unknown as StandingRow[]} />;
    case 2:
      return <Reliability rows={question.rows as unknown as ReliabilityRow[]} />;
    case 3:
      return <HeadToHead rows={question.rows as unknown as HeadToHeadRow[]} />;
    case 4:
      return <Monaco rows={question.rows as unknown as MonacoRow[]} shared={question.sharedDrives ?? []} />;
    case 5:
      return <Changed row={(question.rows as unknown as ChangedRow[])[0]} moves={question.moves ?? []} />;
    default:
      return null;
  }
}

function Table({ caption, min, children }: { caption: string; min: number; children: ReactNode }) {
  return (
    <div className="relative overflow-x-auto">
      <table className="w-full border-collapse text-left" style={{ minWidth: `${min}px` }}>
        <caption className="sr-only">{caption}</caption>
        {children}
      </table>
    </div>
  );
}

const th = "py-2 pr-3 font-semibold";
const thRight = "py-2 pr-3 text-right font-semibold";
const num = "py-2.5 pr-3 text-right font-display text-[1.1rem] tabular-nums";

function Standings({ rows }: { rows: StandingRow[] }) {
  return (
    <Table caption="2021 drivers, with their Grand Prix points and wins" min={420}>
      <thead>
        <tr className="border-b border-ink text-[0.85rem] text-steel">
          <th className={`${th} w-10`}>
            #<span className="sr-only"> (position in this list)</span>
          </th>
          <th className={th}>Driver</th>
          <th className={thRight}>Points</th>
          <th className="py-2 text-right font-semibold">Wins</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r, i) => (
          <tr key={r.Driver} className="border-b border-line">
            <td className="py-2.5 pr-3 text-mute">{i + 1}</td>
            <td className={`py-2.5 pr-3 font-display text-[1.1rem] font-semibold ${i < 3 ? "text-ink" : "text-steel"}`}>{r.Driver}</td>
            <td className={num}>{points(r.Points)}</td>
            <td className="py-2.5 text-right font-display text-[1.1rem] tabular-nums">{r.Wins}</td>
          </tr>
        ))}
      </tbody>
    </Table>
  );
}

function Reliability({ rows }: { rows: ReliabilityRow[] }) {
  return (
    <Table caption="Constructors with at least 100 race entries from 2014 to 2021, and the share that were classified finishes" min={560}>
      <thead>
        <tr className="border-b border-ink text-[0.85rem] text-steel">
          <th className={th}>Constructor</th>
          <th className={thRight}>Entries</th>
          <th className={thRight}>Classified</th>
          <th className="w-[38%] py-2 pl-6 font-semibold">Reliability</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.Constructor} className="border-b border-line">
            <td className="py-2.5 pr-3 font-display text-[1.1rem] font-semibold">{r.Constructor}</td>
            <td className={num}>{r.Entries}</td>
            <td className={num}>{r.Classified}</td>
            <td className="py-2.5 pl-6">
              <span className="flex items-center gap-3">
                <span className="figure w-[3.4rem] text-[1.05rem]">{share(r.Reliability)}</span>
                <span aria-hidden className="block h-1.5 flex-1 bg-line">
                  <span className="block h-full bg-steel" style={{ width: `${r.Reliability * 100}%` }} />
                </span>
              </span>
            </td>
          </tr>
        ))}
      </tbody>
    </Table>
  );
}

function HeadToHead({ rows }: { rows: HeadToHeadRow[] }) {
  return (
    <ul className="space-y-6">
      {rows.map((r) => {
        const a = r.Hamilton_Ahead;
        const b = r.Bottas_Ahead;
        const [first, second] = ["Hamilton_Ahead", "Bottas_Ahead"].map(nameOfColumn);
        return (
          <li key={r.Constructor}>
            <p className="font-display text-[1.4rem] font-bold uppercase">
              {r.Constructor} <span className="text-steel normal-case">in {r.Shared_Races} shared races</span>
            </p>
            <p className="mt-1 text-[1rem] text-steel">
              {first} finished ahead in {a} of them, {second} in {b}.
            </p>
            <div aria-hidden className="mt-3 flex h-3 max-w-[640px]">
              <span className="block bg-ink" style={{ width: `${(a / r.Shared_Races) * 100}%` }} />
              <span className="block bg-line2" style={{ width: `${(b / r.Shared_Races) * 100}%` }} />
            </div>
            <p className="mt-2 flex max-w-[640px] justify-between text-[0.9rem] text-mute">
              <span>
                {first} {a}
              </span>
              <span>
                {second} {b}
              </span>
            </p>
          </li>
        );
      })}
    </ul>
  );
}

const SHOWN = 10;

function Monaco({ rows, shared }: { rows: MonacoRow[]; shared: { driver: string; year: number }[] }) {
  const [all, setAll] = useState(false);
  const shown = all ? rows : rows.slice(0, SHOWN);
  const years = [...new Set(shared.map((s) => s.year))].sort((x, y) => x - y);
  return (
    <>
      <Table caption="Drivers with at least five starts at Monaco before 2020, by average finishing position" min={480}>
        <thead>
          <tr className="border-b border-ink text-[0.85rem] text-steel">
            <th className={`${th} w-10`}>
              #<span className="sr-only"> (position in this list)</span>
            </th>
            <th className={th}>Driver</th>
            <th className={thRight}>Starts</th>
            <th className={thRight}>Average finish</th>
            <th className="py-2 text-right font-semibold">Wins</th>
          </tr>
        </thead>
        <tbody>
          {shown.map((r, i) => (
            <tr key={r.Driver} className="border-b border-line">
              <td className="py-2.5 pr-3 text-mute">{i + 1}</td>
              <td className="py-2.5 pr-3 font-display text-[1.1rem] font-semibold">{r.Driver}</td>
              <td className={num}>{r.Starts}</td>
              <td className={num}>{r.Avg_Finish.toFixed(2)}</td>
              <td className="py-2.5 text-right font-display text-[1.1rem] tabular-nums">{r.Wins}</td>
            </tr>
          ))}
        </tbody>
      </Table>
      {rows.length > SHOWN && (
        <button type="button" className="chip mt-3" aria-expanded={all} onClick={() => setAll((v) => !v)}>
          {all ? `Show the first ${SHOWN}` : `Show all ${rows.length} drivers`}
        </button>
      )}
      {shared.length > 0 && (
        <p className="mt-5 max-w-[74ch] text-[0.95rem] leading-snug text-steel">
          <strong className="text-ink">Where a start is not a Result.</strong> {capitalised(countWord(shared.length))} {shared.length === 1 ? "driver" : "drivers"} had two Results in one Monaco race, because they shared a car:{" "}
          {listOf(years.map((year) => `${listOf(shared.filter((s) => s.year === year).map((s) => s.driver))} (${year})`))}. Each of those races counts as one start, and both Results count towards the average and the wins.
        </p>
      )}
    </>
  );
}

function Changed({ row, moves }: { row: ChangedRow; moves: { driver: string; from: string; to: string }[] }) {
  return (
    <>
      <p className="mb-4 flex items-baseline gap-3">
        <span className="figure text-[3rem] leading-none">{row.Drivers_Changed}</span>
        <span className="text-[1.05rem] text-steel">drivers changed their primary constructor</span>
      </p>
      <Table caption="Drivers whose primary constructor in 2021 was not their 2020 one" min={420}>
        <thead>
          <tr className="border-b border-ink text-[0.85rem] text-steel">
            <th className={th}>Driver</th>
            <th className={th}>2020</th>
            <th className="py-2 font-semibold">2021</th>
          </tr>
        </thead>
        <tbody>
          {(moves.length > 0 ? moves : row.Drivers.map((driver) => ({ driver, from: "", to: "" }))).map((m) => (
            <tr key={m.driver} className="border-b border-line">
              <td className="py-2.5 pr-3 font-display text-[1.1rem] font-semibold">{m.driver}</td>
              <td className="py-2.5 pr-3 text-steel">{m.from}</td>
              <td className="py-2.5 text-steel">{m.to}</td>
            </tr>
          ))}
        </tbody>
      </Table>
    </>
  );
}

/* ------------------------------------------------------------------ the Cypher */

function QueryCode({ question }: { question: QuestionBlock }) {
  return (
    <details className="group mt-6 border border-line bg-tower">
      <summary className="flex min-h-11 cursor-pointer items-center justify-between gap-3 px-4 py-2 font-display text-[1rem] font-semibold text-steel hover:text-ink">
        The Cypher behind this answer
        <span aria-hidden className="text-mute transition-transform group-open:rotate-45">
          +
        </span>
      </summary>
      <div className="border-t border-line px-4 py-4">
        <p className="text-[0.92rem] text-mute">
          This is Query {question.number} of <code>queries.txt</code>, as submitted. The answer above is worked out from the same CSV files; this is the query that asks the graph the same question.
        </p>
        <pre className="mt-2 overflow-x-auto border border-line bg-paper p-3 text-[0.92rem] leading-relaxed text-steel">
          <code>
            {highlightCypher(question.cypher).map((token, i) =>
              token.kind === "keyword" ? (
                <span key={i} className="font-semibold text-ink">
                  {token.text}
                </span>
              ) : token.kind === "string" ? (
                <span key={i} className="text-mute">
                  {token.text}
                </span>
              ) : (
                token.text
              ),
            )}
          </code>
        </pre>
      </div>
    </details>
  );
}
