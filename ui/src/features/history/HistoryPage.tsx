import { useEffect, useMemo, useState } from "react";
import { ErrorNote, LightsLoader, Note, Tabs } from "../../components/Bits";
import { Panel } from "../../components/Panel";
import { RACES, loadGraph, raceHref, useResource } from "../../lib/data";
import { circuitNetwork, driverLabels, driverSeasons, indexGraph, shortestChain, teammatesOf, type GraphIndex, type Hop } from "../../lib/graph";
import { useTitle } from "../../lib/hooks";
import { href, replaceQuery } from "../../lib/router";
import { CypherNote } from "./CypherNote";
import { EgoGraph } from "./EgoGraph";

type Tab = "connections" | "driver" | "circuit";

const TABS: { id: Tab; label: string }[] = [
  { id: "connections", label: "Connections" },
  { id: "driver", label: "Driver history" },
  { id: "circuit", label: "Circuit podiums" },
];

const DATALIST = "graph-drivers";
/** Well-known pairs, found by name so the list never points at a driver the data does not hold. */
const EXAMPLES: [string, string][] = [
  ["Lewis Hamilton", "Max Verstappen"],
  ["Michael Schumacher", "Max Verstappen"],
  ["Ayrton Senna", "Lewis Hamilton"],
  ["Juan Fangio", "Max Verstappen"],
];

export function HistoryPage({ query }: { query: URLSearchParams }) {
  useTitle("History", "Teammate chains, driver careers and circuit podiums, drawn from a knowledge graph of the Formula 1 record.");
  const graph = useResource("graph", loadGraph);
  const index = useMemo(() => (graph.data ? indexGraph(graph.data) : null), [graph.data]);
  const tab = (TABS.some((t) => t.id === query.get("tab")) ? query.get("tab") : "connections") as Tab;
  const go = (patch: Record<string, string | number | undefined>) => {
    const current: Record<string, string> = {};
    query.forEach((value, key) => (current[key] = value));
    replaceQuery({ ...current, ...patch });
  };

  return (
    <div className="page-in">
      <header className="border-b border-line pt-[calc(var(--nav-h)+2rem)] pb-8">
        <div className="mx-auto max-w-[1320px] px-4 sm:px-6 lg:px-10">
          <h1 className="display text-[3rem] sm:text-[4.8rem]">Follow the teammate chain</h1>
          <p className="mt-4 max-w-[66ch] text-[1.1rem] leading-relaxed text-steel">
            {index
              ? `The graph links ${index.drivers.size.toLocaleString("en-GB")} drivers across ${index.file.source.yearFirst}–${index.file.source.yearLast} through the cars they shared. Ask how two drivers are connected, read one driver's career as a path through constructors, or see who has stood on a circuit's podium for the same team.`
              : "The graph links every driver in the dataset through the cars they shared."}
          </p>
        </div>
      </header>

      <div className="mx-auto max-w-[1320px] space-y-6 px-4 pt-8 sm:px-6 lg:px-10">
        {graph.error && <ErrorNote detail="The graph file could not be loaded." />}
        {!index && !graph.error && <LightsLoader label="Loading the graph" />}
        {index && (
          <>
            <datalist id={DATALIST}>
              {[...driverLabels(index).byId.values()].map((label) => (
                <option key={label} value={label} />
              ))}
            </datalist>
            <Tabs<Tab> value={tab} onChange={(next) => go({ tab: next })} idPrefix="hist" label="Question" options={TABS.map((t) => ({ id: t.id, label: t.label }))} />
            {tab === "connections" && <Connections index={index} query={query} go={go} />}
            {tab === "driver" && <DriverHistory index={index} query={query} go={go} />}
            {tab === "circuit" && <CircuitPodiums index={index} query={query} go={go} />}
            <Note>
              Source: {index.file.source.files.length} CSV files from <code>milestone_2/</code> (SHA-256 {index.file.source.sha256.slice(0, 12)}…). A driver at a race counts once, even in the early seasons when a driver could hold two results (a shared drive). Points are race-result points only: the graph does not load sprint results, so a modern season can sit a few points under the official total.
            </Note>
          </>
        )}
      </div>
    </div>
  );
}

type Go = (patch: Record<string, string | number | undefined>) => void;

/* ------------------------------------------------------------------ picker */

function DriverPicker({ label, value, onChange, index }: { label: string; value: number | null; onChange: (id: number) => void; index: GraphIndex }) {
  const labels = useMemo(() => driverLabels(index), [index]);
  const [text, setText] = useState(value === null ? "" : (labels.byId.get(value) ?? ""));
  useEffect(() => setText(value === null ? "" : (labels.byId.get(value) ?? "")), [value, labels]);
  const known = labels.byLabel.has(text);
  return (
    <label className="block min-w-[min(100%,15rem)] flex-1">
      <span className="label">{label}</span>
      <input
        list={DATALIST}
        value={text}
        placeholder="Type a driver's name"
        autoComplete="off"
        onChange={(event) => {
          setText(event.target.value);
          const id = labels.byLabel.get(event.target.value);
          if (id !== undefined) onChange(id);
        }}
        aria-invalid={text !== "" && !known}
        className="mt-1 min-h-11 w-full border border-control bg-panel px-3 text-[1rem] text-ink placeholder:text-mute focus:border-ink focus:outline-none"
      />
      {text !== "" && !known && <span className="mt-1 block text-[0.82rem] text-mute">Pick a name from the list that appears as you type.</span>}
    </label>
  );
}

const idFrom = (query: URLSearchParams, key: string, index: GraphIndex): number | null => {
  const value = Number(query.get(key));
  return Number.isInteger(value) && index.drivers.has(value) ? value : null;
};

const years = (a: number, b: number) => (a === b ? String(a) : `${a}–${b}`);
const surname = (index: GraphIndex, id: number) => index.drivers.get(id)?.name.split(" ").slice(-1)[0] ?? `#${id}`;

/* ------------------------------------------------------------------ connections */

function Connections({ index, query, go }: { index: GraphIndex; query: URLSearchParams; go: Go }) {
  const a = idFrom(query, "a", index);
  const b = idFrom(query, "b", index);
  const chain = useMemo(() => (a !== null && b !== null ? shortestChain(index, a, b) : undefined), [index, a, b]);
  const examples = useMemo(() => {
    const byName = new Map([...index.drivers.values()].map((d) => [d.name, d.id]));
    return EXAMPLES.map(([x, y]) => [byName.get(x), byName.get(y), x, y] as const).filter((row): row is readonly [number, number, string, string] => row[0] !== undefined && row[1] !== undefined);
  }, [index]);

  return (
    <Panel context="Two drivers, and the cars that connect them" title="How are these two drivers connected?" tag="record">
      <p className="max-w-[72ch] text-steel">
        Two drivers are linked when they raced for the same constructor in the same race. The chain below is the shortest one, and where several chains are equally short, the one with the most shared races.
      </p>
      <div className="mt-5 flex flex-wrap items-end gap-3">
        <DriverPicker label="From" value={a} onChange={(id) => go({ a: id })} index={index} />
        <button type="button" className="btn btn-ghost !min-h-11 !px-3" onClick={() => go({ a: b ?? undefined, b: a ?? undefined })} aria-label="Swap the two drivers" disabled={a === null && b === null}>
          Swap
        </button>
        <DriverPicker label="To" value={b} onChange={(id) => go({ b: id })} index={index} />
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2" role="group" aria-label="Example pairs">
        <span className="text-[0.88rem] text-mute">Try</span>
        {examples.map(([x, y, nx, ny]) => (
          <button key={`${x}-${y}`} type="button" className="chip" onClick={() => go({ a: x, b: y })}>
            {nx.split(" ").slice(-1)[0]} → {ny.split(" ").slice(-1)[0]}
          </button>
        ))}
      </div>

      <div className="mt-8" aria-live="polite">
        {chain === undefined && <p className="text-mute">Choose two drivers to see how they are connected.</p>}
        {chain === null && a !== null && b !== null && (
          <p className="border-l-2 border-amber py-1 pl-3 text-steel">
            No chain of teammates connects {index.drivers.get(a)!.name} and {index.drivers.get(b)!.name} in this data. That is reported as found: the graph has no path, and none is invented.
          </p>
        )}
        {chain && a !== null && b !== null && <ChainView index={index} from={a} hops={chain.hops} distance={chain.distance} />}
      </div>

      <CypherNote blocks={[index.file.cypher.materialise_teammates, index.file.cypher.teammate_path, index.file.cypher.head_to_head]} values={a !== null && b !== null ? { driverA: a, driverB: b } : {}} />
    </Panel>
  );
}

function ChainView({ index, from, hops, distance }: { index: GraphIndex; from: number; hops: Hop[]; distance: number }) {
  const nodes = [from, ...hops.map((hop) => hop.to)];
  const start = index.drivers.get(from)!;
  const end = index.drivers.get(nodes[nodes.length - 1])!;
  return (
    <div>
      <p className="font-display text-[1.6rem] leading-tight font-semibold">
        {distance === 0 ? "That is the same driver." : distance === 1 ? `${start.name} and ${end.name} were teammates.` : `${start.name} and ${end.name} are ${distance} links apart.`}
      </p>
      <ol className="mt-5">
        {nodes.map((id, i) => {
          const node = index.drivers.get(id)!;
          const hop = hops[i];
          return (
            <li key={`${id}-${i}`} className="relative pl-10">
              <span aria-hidden className="absolute top-2 left-0 grid h-7 w-7 place-items-center border border-line2 bg-panel font-display text-[0.95rem] font-semibold">{i + 1}</span>
              {hop && <span aria-hidden className="absolute top-9 bottom-0 left-[13px] w-px bg-line2" />}
              <div className="pb-4">
                <a className="font-display text-[1.35rem] leading-none font-semibold uppercase text-ink no-underline hover:underline" href={href("/history", { tab: "driver", d: id })}>{node.name}</a>
                <p className="mt-1 text-[0.9rem] text-mute">
                  {node.nationality} · raced {years(node.firstYear, node.lastYear)} · {node.starts} starts, {node.wins} {node.wins === 1 ? "win" : "wins"}, {node.podiums} podiums
                </p>
              </div>
              {hop && (
                <div className="mb-4 border-l-2 border-line2 bg-tower py-3 pr-3 pl-4">
                  <p className="label">Teammates{hop.links.length > 1 ? ` at ${hop.links.length} constructors` : ""}</p>
                  <ul className="mt-1 space-y-1.5">
                    {hop.links.map((link) => (
                      <li key={link.constructorId} className="text-[0.98rem] text-steel">
                        <span className="font-semibold text-ink">{index.constructors.get(link.constructorId)}</span>, {years(link.firstYear, link.lastYear)}: {link.sharedRaces} shared {link.sharedRaces === 1 ? "race" : "races"}.{" "}
                        {surname(index, link.from)} finished ahead in {link.fromAhead}, {surname(index, link.to)} in {link.toAhead}
                        {link.sharedRaces - link.fromAhead - link.toAhead > 0 ? `, ${link.sharedRaces - link.fromAhead - link.toAhead} level or unclassified` : ""}.
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </li>
          );
        })}
      </ol>
    </div>
  );
}

/* ------------------------------------------------------------------ one driver */

function DriverHistory({ index, query, go }: { index: GraphIndex; query: URLSearchParams; go: Go }) {
  const d = idFrom(query, "d", index) ?? index.drivers.get(1)?.id ?? null;
  const node = d !== null ? index.drivers.get(d) : undefined;
  const seasons = useMemo(() => (d !== null ? driverSeasons(index, d) : []), [index, d]);
  const mates = useMemo(() => (d !== null ? teammatesOf(index, d) : []), [index, d]);
  const linkFor = (id: number) => href("/history", { tab: "driver", d: id });

  return (
    <Panel context="One driver, as a path through constructors" title="Driver history" tag="record">
      <div className="flex flex-wrap items-end gap-3">
        <DriverPicker label="Driver" value={d} onChange={(id) => go({ d: id })} index={index} />
        {d !== null && (
          <a className="btn btn-ghost !min-h-11 !px-3" href={href("/history", { tab: "connections", a: d })}>
            Connect to another driver
          </a>
        )}
      </div>

      {node && d !== null && (
        <>
          <dl className="mt-6 grid grid-cols-2 gap-px border border-line bg-line sm:grid-cols-4">
            {[
              ["Raced", years(node.firstYear, node.lastYear)],
              ["Starts", String(node.starts)],
              ["Wins · podiums", `${node.wins} · ${node.podiums}`],
              ["Race points", node.points.toLocaleString("en-GB", { maximumFractionDigits: 1 })],
            ].map(([label, value]) => (
              <div key={label} className="bg-tower px-4 py-3">
                <dt className="label">{label}</dt>
                <dd className="figure mt-1 text-[1.7rem]">{value}</dd>
              </div>
            ))}
          </dl>

          <div className="mt-8 grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
            <section aria-labelledby="hist-seasons" className="min-w-0">
              <h3 id="hist-seasons" className="label">Season by season</h3>
              <div className="mt-2 max-h-[34rem] overflow-auto border border-line">
                <table className="w-full min-w-[30rem] border-collapse text-left">
                  <caption className="sr-only">{node.name}: constructor, races, podiums, wins and points in each season</caption>
                  <thead className="sticky top-0 bg-tower">
                    <tr className="border-b border-line2 text-[0.8rem] text-mute">
                      <th scope="col" className="px-3 py-2 font-semibold">Season</th>
                      <th scope="col" className="px-3 py-2 font-semibold">Constructor</th>
                      <th scope="col" className="px-3 py-2 text-right font-semibold">Races</th>
                      <th scope="col" className="px-3 py-2 text-right font-semibold">Podiums</th>
                      <th scope="col" className="px-3 py-2 text-right font-semibold">Wins</th>
                      <th scope="col" className="px-3 py-2 text-right font-semibold">Points</th>
                    </tr>
                  </thead>
                  <tbody>
                    {seasons.map((line) => (
                      <tr key={`${line.year}-${line.constructorId}`} className="border-b border-line">
                        <th scope="row" className="px-3 py-2 font-display text-[1.05rem] font-semibold">{line.year}</th>
                        <td className="px-3 py-2 text-steel">{line.constructor}</td>
                        <td className="px-3 py-2 text-right figure text-[1rem]">{line.races}</td>
                        <td className="px-3 py-2 text-right figure text-[1rem]">{line.podiums}</td>
                        <td className="px-3 py-2 text-right figure text-[1rem]">{line.wins}</td>
                        <td className="px-3 py-2 text-right figure text-[1rem]">{line.points.toLocaleString("en-GB", { maximumFractionDigits: 1 })}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            <section aria-labelledby="hist-mates" className="min-w-0">
              <h3 id="hist-mates" className="label">Teammates, most shared races first</h3>
              {mates.length === 0 ? (
                <p className="mt-3 text-steel">No teammates in the data: this driver never shared a constructor in a race with anyone else.</p>
              ) : (
                <>
                  <EgoGraph centre={node.name} mates={mates.slice(0, 14)} hrefFor={linkFor} />
                  <ul className="mt-2 max-h-72 overflow-auto border border-line">
                    {mates.map((mate) => (
                      <li key={mate.id} className="flex items-center justify-between gap-3 border-b border-line px-3">
                        <a className="inline-flex min-h-11 min-w-0 items-center truncate text-ink" href={linkFor(mate.id)}>{mate.name}</a>
                        <span className="shrink-0 text-[0.88rem] text-mute">
                          {mate.constructors.join(", ")} · {years(mate.firstYear, mate.lastYear)} · <span className="figure text-steel">{mate.sharedRaces}</span> races
                        </span>
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </section>
          </div>
          <CypherNote blocks={[index.file.cypher.driver_history]} values={{ driverId: d }} />
        </>
      )}
    </Panel>
  );
}

/* ------------------------------------------------------------------ circuits */

function CircuitPodiums({ index, query, go }: { index: GraphIndex; query: URLSearchParams; go: Go }) {
  const circuits = useMemo(() => [...index.circuits.entries()].filter(([id]) => index.podiumsByCircuit.has(id)).sort((x, y) => x[1].name.localeCompare(y[1].name)), [index]);
  const wanted = Number(query.get("c"));
  const monaco = circuits.find(([, c]) => c.name.includes("Monaco"))?.[0] ?? circuits[0][0];
  const circuitId = circuits.some(([id]) => id === wanted) ? wanted : monaco;
  const min = [1, 2, 3, 4, 5].includes(Number(query.get("n"))) ? Number(query.get("n")) : 3;
  const lines = useMemo(() => circuitNetwork(index, circuitId, min), [index, circuitId, min]);
  const circuit = index.circuits.get(circuitId)!;
  const heldOut = RACES.filter((race) => race.circuitId === circuitId);

  return (
    <Panel context="Constructors, and the different drivers who gave them podiums" title="Circuit podium network" tag="record">
      <div className="flex flex-wrap items-end gap-3">
        <label className="block min-w-[min(100%,15rem)] flex-1">
          <span className="label">Circuit</span>
          <select className="select mt-1 w-full" value={circuitId} onChange={(event) => go({ c: event.target.value })}>
            {circuits.map(([id, c]) => (
              <option key={id} value={id}>{c.name}, {c.country}</option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="label">At least this many different drivers</span>
          <select className="select mt-1 w-full" value={min} onChange={(event) => go({ n: event.target.value })}>
            {[1, 2, 3, 4, 5].map((n) => (
              <option key={n} value={n}>{n}</option>
            ))}
          </select>
        </label>
      </div>

      <div className="mt-6" aria-live="polite">
        <p className="font-display text-[1.5rem] leading-tight font-semibold">
          {lines.length === 0
            ? `No constructor has had ${min} different drivers on the podium at ${circuit.name}.`
            : `${lines.length} ${lines.length === 1 ? "constructor has" : "constructors have"} had at least ${min} different ${min === 1 ? "driver" : "drivers"} on the podium at ${circuit.name}.`}
        </p>
        {lines.length > 0 && (
          <ul className="mt-4 divide-y divide-line border-y border-line">
            {lines.map((line) => (
              <li key={line.constructorId} className="grid grid-cols-1 gap-2 py-4 md:grid-cols-[14rem_minmax(0,1fr)] md:gap-6">
                <div>
                  <p className="font-display text-[1.3rem] leading-none font-semibold uppercase">{line.constructor}</p>
                  <p className="mt-1 text-[0.9rem] text-mute">{line.distinctDrivers} drivers · {line.podiums} podiums</p>
                </div>
                <ul className="flex flex-wrap gap-2">
                  {line.drivers.map((driver) => (
                    <li key={driver.id}>
                      <a className="inline-flex items-baseline gap-2 border border-control px-2.5 py-1 text-steel no-underline hover:border-ink hover:text-ink" href={href("/history", { tab: "driver", d: driver.id })}>
                        {driver.name}
                        <span className="figure text-[0.95rem] text-ink">{driver.podiums}</span>
                        {driver.wins > 0 && <span className="text-[0.78rem] text-mute">{driver.wins} {driver.wins === 1 ? "win" : "wins"}</span>}
                      </a>
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        )}
        {heldOut.length > 0 && (
          <p className="mt-5 text-steel">
            Paladin predicted this circuit in the held-out seasons:{" "}
            {heldOut.map((race, i) => (
              <span key={race.id}>
                {i > 0 && ", "}
                <a className="text-ink" href={href(raceHref(race))}>{race.year}</a>
              </span>
            ))}
            .
          </p>
        )}
      </div>
      <CypherNote blocks={[index.file.cypher.circuit_podium_network]} values={{ circuitId, minDrivers: min }} />
    </Panel>
  );
}

