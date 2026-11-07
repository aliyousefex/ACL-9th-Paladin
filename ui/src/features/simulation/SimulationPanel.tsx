import { useEffect, useMemo, useState } from "react";
import { CircuitMap } from "../../components/CircuitMap";
import { Icon } from "../../components/Icon";
import { Note, Tabs } from "../../components/Bits";
import { Panel } from "../../components/Panel";
import { VectorRaceCar } from "../../components/VectorRaceCar";
import type { Layout } from "../../lib/data";
import { usePrefersReducedMotion } from "../../lib/motion";
import { pointAt } from "../race/replay";
import type { Row } from "../race/rows";
import { comparePitWindow, monteCarlo, simulate, type Aggression, type Compound, type Strategy, type Weather } from "./engine";
import { COMPOUNDS, defaultScenario, parseScenario, serializeScenario } from "./scenario";
import { PitWallDuel } from "./PitWallDuel";

export function SimulationPanel({ rows, layout, totalLaps }: { rows: Row[]; layout: Layout | null; totalLaps: number }) {
  const reduce = usePrefersReducedMotion();
  const laps = Math.max(12, Math.min(totalLaps, 30));
  // A shared link is read once, validated and clamped to this race; anything invalid falls back to the default.
  const initial = useMemo(() => {
    const defaults = defaultScenario(laps, rows[0]?.driver.id ?? 0);
    return parseScenario(window.location.hash.split("?")[1] ?? "", laps, rows.map((row) => row.driver.id), defaults);
  }, []);
  const [driverId, setDriverId] = useState(initial.driverId);
  const [compound, setCompound] = useState<Compound>(initial.compound);
  const [secondCompound, setSecondCompound] = useState<Compound>(initial.secondCompound);
  const [aggression, setAggression] = useState<Aggression>(initial.aggression);
  const [pitLap, setPitLap] = useState(initial.pitLap);
  const [safety, setSafety] = useState<number | null>(initial.safetyCarLap);
  const [seed, setSeed] = useState(initial.seed);
  const [weather, setWeather] = useState<Weather>(initial.weather);
  const [reliability, setReliability] = useState(initial.reliability);
  const [lap, setLap] = useState(laps);
  const [playing, setPlaying] = useState(false);
  const [copied, setCopied] = useState(false);

  const entries = useMemo(() => rows.map((row) => ({ id: row.driver.id, grid: row.grid, score: row.score })), [rows]);
  const selected: Strategy = { compound, secondCompound, aggression, pitLap };
  const config = { laps, seed, safetyCarLap: safety, selectedId: driverId, selected, weather, reliabilityRisk: reliability };
  const result = useMemo(() => simulate(entries, config), [entries, laps, seed, safety, driverId, compound, secondCompound, aggression, pitLap, weather, reliability]);
  const cloud = useMemo(() => monteCarlo(entries, config, 160), [entries, laps, seed, safety, driverId, compound, secondCompound, aggression, pitLap, weather, reliability]);
  const pitWindows = useMemo(() => comparePitWindow(entries, config, 100), [entries, laps, seed, safety, driverId, compound, secondCompound, aggression, pitLap, weather, reliability]);
  const state = result.states[lap];
  const selectedRow = rows.find((row) => row.driver.id === driverId) ?? rows[0];
  const leaderTime = state.elapsed[state.order[0]];
  const selectedRetired = Boolean(result.retiredAt[driverId]);
  const event = result.retiredAt[driverId] === lap
    ? `${selectedRow.driver.code} retired on lap ${result.retiredAt[driverId]}`
    : state.pitted.includes(driverId)
      ? `${selectedRow.driver.code} boxed for ${secondCompound} tyres`
      : safety === lap
        ? "Safety car: field compressed"
        : null;
  const events = [
    { lap: 0, label: "Lights out", kind: "start" },
    ...(weather === "mixed" ? [{ lap: Math.ceil(laps * 0.52), label: "Rain arrives", kind: "weather" }] : []),
    ...(safety ? [{ lap: safety, label: "Safety car", kind: "safety" }] : []),
    { lap: pitLap, label: `${selectedRow.driver.code} pits`, kind: "pit" },
    ...(result.retiredAt[driverId] ? [{ lap: result.retiredAt[driverId], label: `${selectedRow.driver.code} retires`, kind: "retirement" }] : []),
    { lap: laps, label: "Chequered flag", kind: "finish" },
  ].sort((a, b) => a.lap - b.lap || a.label.localeCompare(b.label));

  const share = async () => {
    const path = window.location.hash.split("?")[0];
    const query = serializeScenario({ driverId, compound, secondCompound, aggression, pitLap, safetyCarLap: safety, seed, weather, reliability });
    const target = `${window.location.origin}${window.location.pathname}${window.location.search}${path}?${query}`;
    window.history.replaceState(null, "", `${path}?${query}`);
    try {
      await navigator.clipboard.writeText(target);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      window.prompt("Copy this Race Lab scenario", target);
    }
  };

  useEffect(() => {
    if (!playing || reduce) return;
    const timer = window.setInterval(() => {
      setLap((current) => {
        if (current >= laps) {
          setPlaying(false);
          return current;
        }
        return current + 1;
      });
    }, 430);
    return () => window.clearInterval(timer);
  }, [playing, reduce, laps]);

  return (
    <Panel
      eyebrow="Paladin Race Lab"
      title="Run a synthetic strategy scenario"
      tag="simulation"
      actions={<><button type="button" className="btn btn-ghost !min-h-9 !px-3 !text-[0.95rem]" onClick={share}>{copied ? "Scenario copied" : "Share scenario"}</button><button type="button" className="btn !min-h-9 !px-3 !text-[0.95rem]" onClick={() => { setSeed((value) => value + 1); setLap(0); setPlaying(!reduce); }}>Run new seed</button></>}
    >
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1.25fr)_22rem]">
        <div className="min-w-0">
          <div className="relative border border-line bg-tower p-3 sm:p-6">
            {layout ? (
              <CircuitMap layout={layout} className="mx-auto block max-h-[510px] w-full" weight={0.9} label={`Synthetic race positions after lap ${lap}`}>
                {state.order.map((id, index) => {
                  if (state.retired.includes(id)) return null;
                  const row = rows.find((item) => item.driver.id === id)!;
                  const progress = ((lap / laps) + (state.order.length - index) * 0.012) % 1;
                  const point = pointAt(layout.samples, progress);
                  return (
                    <g key={id} transform={`translate(${point.x} ${point.y}) rotate(${point.angle})`}>
                      <VectorRaceCar colour={row.colour} ink={row.ink} number={row.entry.n} scale={id === driverId ? 1.05 : 0.76} selected={id === driverId} />
                    </g>
                  );
                })}
              </CircuitMap>
            ) : <p className="grid min-h-64 place-items-center text-center text-steel">No verified outline is available for this layout. The synthetic timing tower remains available.</p>}
            <div className="absolute top-3 left-3 bg-tower/90 px-3 py-2">
              <p className="label">Synthetic lap</p>
              <p className="figure text-[2rem]">{lap}<span className="text-[1rem] text-mute"> / {laps}</span></p>
            </div>
            {event && <p className={`absolute right-3 bottom-3 px-3 py-2 font-display text-[0.9rem] font-bold tracking-[0.08em] uppercase ${state.retired.includes(driverId) ? "bg-signal text-white" : "bg-amber text-paper"}`} aria-live="polite">{event}</p>}
          </div>
          <div className="mt-4 flex flex-wrap items-end gap-3">
            <button
              type="button"
              className="btn !min-h-11"
              onClick={() => {
                if (reduce) setLap((current) => current >= laps ? 0 : current + 1);
                else {
                  if (lap >= laps) setLap(0);
                  setPlaying((value) => !value);
                }
              }}
              aria-label={reduce ? "Advance one synthetic lap" : playing ? "Pause synthetic race" : "Play synthetic race"}
            >
              <Icon name={reduce ? "skip" : playing ? "pause" : "play"} size={17} /> {reduce ? "Next lap" : playing ? "Pause" : lap >= laps ? "Replay run" : "Play run"}
            </button>
            <div className="min-w-[14rem] flex-1">
              <label className="label block" htmlFor="sim-lap">Inspect the run</label>
              <input id="sim-lap" type="range" min={0} max={laps} value={lap} onChange={(event) => { setPlaying(false); setLap(Number(event.target.value)); }} aria-valuetext={`Synthetic lap ${lap} of ${laps}`} className="mt-2" />
            </div>
          </div>
          <div className="no-scrollbar mt-4 overflow-x-auto border-y border-line py-3">
            <ol className="flex min-w-max items-center gap-1" aria-label="Synthetic race events">
              {events.map((item, index) => (
                <li key={`${item.kind}-${item.lap}`} className="flex items-center">
                  {index > 0 && <span className="mx-1 h-px w-5 bg-line2" aria-hidden />}
                  <button
                    type="button"
                    onClick={() => { setPlaying(false); setLap(item.lap); }}
                    aria-current={lap === item.lap ? "step" : undefined}
                    className={`min-h-10 border px-3 py-1 text-left transition-colors ${lap === item.lap ? "border-amber bg-amber text-paper" : item.kind === "retirement" ? "border-signal text-signal-text hover:bg-panel2" : "border-line2 text-steel hover:border-steel hover:text-ink"}`}
                  >
                    <span className="block font-display text-[0.86rem] font-bold tracking-[0.07em] uppercase">{item.label}</span>
                    <span className={`block text-[0.68rem] ${lap === item.lap ? "text-paper/70" : "text-mute"}`}>Lap {item.lap}</span>
                  </button>
                </li>
              ))}
            </ol>
          </div>

          <div className="mt-6 grid grid-cols-2 gap-px bg-line sm:grid-cols-5">
            <Readout label="Selected finish" value={selectedRetired ? "DNF" : `P${result.order.indexOf(driverId) + 1}`} />
            <Readout label="160-run podium rate" value={`${Math.round(cloud.podiumRate * 100)}%`} />
            <Readout label="Mean finish" value={cloud.meanFinish.toFixed(1)} />
            <Readout label="Range" value={`P${cloud.best}–P${cloud.worst}`} />
            <Readout label="Retirement rate" value={`${Math.round(cloud.retirementRate * 100)}%`} />
          </div>
          <StrategyCompare rows={pitWindows} onChoose={(next) => { setPitLap(next); setLap(laps); setPlaying(false); }} />
          <PitWallDuel key={`${driverId}-${seed}-${compound}-${secondCompound}-${aggression}-${pitLap}-${weather}-${safety}-${reliability}`} entries={entries} config={config} driverName={selectedRow.driver.name} />
        </div>

        <div className="min-w-0 space-y-5">
          <div>
            <label className="label" htmlFor="sim-driver">Driver strategy</label>
            <select id="sim-driver" className="select mt-2 w-full" value={driverId} onChange={(event) => setDriverId(Number(event.target.value))}>
              {rows.map((row) => <option key={row.driver.id} value={row.driver.id}>{row.driver.name} · grid {row.grid ?? "pit"}</option>)}
            </select>
          </div>
          <div>
            <p className="label mb-2">Starting compound</p>
            <Tabs value={compound} onChange={setCompound} options={COMPOUNDS.map((item) => ({ id: item, label: item }))} label="Starting tyre compound" idPrefix="sim-compound" size="sm" className="w-full" />
          </div>
          <div>
            <p className="label mb-2">Compound after the stop</p>
            <Tabs value={secondCompound} onChange={setSecondCompound} options={COMPOUNDS.map((item) => ({ id: item, label: item }))} label="Compound after the pit stop" idPrefix="sim-second-compound" size="sm" className="w-full" />
          </div>
          <div>
            <p className="label mb-2">Synthetic weather</p>
            <Tabs value={weather} onChange={setWeather} options={["dry", "mixed", "wet"].map((item) => ({ id: item as Weather, label: item }))} label="Synthetic weather scenario" idPrefix="sim-weather" size="sm" className="w-full" />
          </div>
          <div>
            <p className="label mb-2">Pace instruction</p>
            <Tabs value={aggression} onChange={setAggression} options={["save", "balanced", "attack"].map((item) => ({ id: item as Aggression, label: item }))} label="Driver pace instruction" idPrefix="sim-aggression" size="sm" className="w-full" />
          </div>
          <div>
            <label className="label" htmlFor="sim-pit">Pit on lap {pitLap}</label>
            <input id="sim-pit" type="range" min={3} max={laps - 2} value={pitLap} onChange={(event) => setPitLap(Number(event.target.value))} className="mt-2" />
          </div>
          <div>
            <label className="label" htmlFor="sim-reliability">Synthetic retirement risk · {Math.round(reliability * 100)}%</label>
            <input id="sim-reliability" type="range" min={0} max={0.5} step={0.01} value={reliability} onChange={(event) => setReliability(Number(event.target.value))} className="mt-2" />
          </div>
          <div>
            <label className="label" htmlFor="sim-safety">Safety car</label>
            <select id="sim-safety" className="select mt-2 w-full" value={safety ?? ""} onChange={(event) => setSafety(event.target.value ? Number(event.target.value) : null)}>
              <option value="">None</option>
              <option value={Math.round(laps * 0.25)}>Early · lap {Math.round(laps * 0.25)}</option>
              <option value={Math.round(laps * 0.55)}>Middle · lap {Math.round(laps * 0.55)}</option>
              <option value={Math.round(laps * 0.82)}>Late · lap {Math.round(laps * 0.82)}</option>
            </select>
          </div>
          <div className="border-y border-line py-4">
            <p className="label">Pit-wall call</p>
            <p className="mt-2 text-[0.9rem] leading-snug text-steel">
              {safety ? `Safety car projected on lap ${safety}. Do you take the compressed pit loss or protect track position?` : "Add a safety car above to unlock a race-engineer decision."}
            </p>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <button type="button" className="btn btn-ghost !min-h-10 !px-2" disabled={!safety} onClick={() => safety && setPitLap(safety)}>Box now</button>
              <button type="button" className="btn btn-ghost !min-h-10 !px-2" disabled={!safety} onClick={() => safety && setPitLap(Math.min(laps - 2, safety + 5))}>Stay out</button>
            </div>
          </div>

          <div className="border-t border-line pt-4">
            <p className="label mb-2">Synthetic timing · lap {lap}</p>
            <ol className="space-y-1" aria-label={`Synthetic order after lap ${lap}`}>
              {state.order.slice(0, 8).map((id, index) => {
                const row = rows.find((item) => item.driver.id === id)!;
                const retired = state.retired.includes(id);
                return <li key={id} className={`flex items-center gap-2 px-2 py-1.5 ${id === driverId ? "bg-panel2" : "bg-panel"} ${retired ? "opacity-45" : ""}`}><span className="figure w-5 text-right text-steel">{index + 1}</span><span className="h-4 w-1" style={{ background: row.colour }} aria-hidden /><span className="font-display font-bold uppercase">{row.driver.code}</span><span className="ml-auto text-[0.78rem] tabular-nums text-mute">{retired ? `OUT L${result.retiredAt[id]}` : index === 0 ? "Leader" : `+${(state.elapsed[id] - leaderTime).toFixed(1)}`}</span></li>;
              })}
            </ol>
          </div>
        </div>
      </div>
      <div className="mt-6"><Note kind="warn">This is a transparent strategy toy, not a physics model or counterfactual fact. It starts from grid rank and Paladin’s pre-race score, then applies illustrative tyre wear, compound changes, aggression, weather suitability, a 20.5-second pit loss, safety-car compression, reliability risk and seeded variation. Historical lap data is not used.</Note></div>
      {selectedRow && <p className="mt-3 text-[0.85rem] text-mute">Current scenario: {selectedRow.driver.name}, {compound} to {secondCompound}, {aggression} pace, {weather} conditions, lap {pitLap} stop, {Math.round(reliability * 100)}% retirement risk{ safety ? `, safety car on lap ${safety}` : ""}. Seed {seed}.</p>}
    </Panel>
  );
}

function Readout({ label, value }: { label: string; value: string }) {
  return <div className="bg-panel p-4"><p className="label !text-[0.7rem]">{label}</p><p className="figure mt-1 text-[1.9rem]">{value}</p></div>;
}

function StrategyCompare({ rows, onChoose }: { rows: ReturnType<typeof comparePitWindow>; onChoose: (lap: number) => void }) {
  const best = [...rows].sort((a, b) => b.podiumRate - a.podiumRate || a.meanFinish - b.meanFinish)[0];
  return (
    <section className="mt-6 border-t border-line pt-5" aria-labelledby="pit-window-title">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h3 id="pit-window-title" className="display text-[1.55rem]">Undercut or overcut?</h3>
          <p className="mt-1 text-[0.85rem] text-mute">Same driver, seed range and pace; only the stop lap changes.</p>
        </div>
        <p className="text-[0.82rem] text-amber">Synthetic comparison</p>
      </div>
      <div className="mt-4 grid gap-px bg-line sm:grid-cols-3">
        {rows.map((item) => (
          <button key={item.label} type="button" onClick={() => onChoose(item.pitLap)} className={`min-h-28 bg-panel p-4 text-left transition-colors hover:bg-panel2 ${item === best ? "outline outline-1 outline-amber -outline-offset-1" : ""}`}>
            <span className="font-display text-[1.05rem] font-bold tracking-[0.08em] uppercase">{item.label}</span>
            <span className="mt-1 block text-[0.8rem] text-mute">Pit lap {item.pitLap}</span>
            <span className="figure mt-3 block text-[1.8rem]">{Math.round(item.podiumRate * 100)}%</span>
            <span className="block text-[0.76rem] text-mute">podiums · mean P{item.meanFinish.toFixed(1)}</span>
          </button>
        ))}
      </div>
    </section>
  );
}
