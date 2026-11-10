import { useEffect, useMemo, useRef, useState } from "react";
import { CircuitMap, CircuitThumb } from "../../components/CircuitMap";
import { LightsLoader, Note, Tabs } from "../../components/Bits";
import { Tag } from "../../components/Provenance";
import { Icon } from "../../components/Icon";
import { RACES, SEASONS, circuit as circuitOf, layoutFor, loadAdvancedRace, loadLayout, loadRace, useResource, type Layout } from "../../lib/data";
import { href } from "../../lib/router";
import { buildRows } from "../race/rows";
import { pointAt } from "../race/replay";
import { advanceLabLap, initialLabRace, labRecord, MODELS, modelBattle, orderLab, setPlayerStrategy, type LabConfig, type LabEntrant, type LabModel, type LabMode, type LabState, type Pace, type Tyre } from "./engine";
import { decodeLabShare, encodeLabShare } from "./share";

type Phase = "setup" | "race" | "finished";
const SPEEDS = [0.5, 1, 2, 4] as const;
const latest = RACES[RACES.length - 1];

export function RaceLabPage({ query }: { query: URLSearchParams }) {
  const shared = useMemo(() => decodeLabShare(query.toString()), [query]);
  const initialMeta = RACES.find((race) => race.id === shared.raceId) ?? latest;
  const [season, setSeason] = useState(initialMeta.year);
  const [raceId, setRaceId] = useState(initialMeta.id);
  const [mode, setMode] = useState<LabMode>(shared.mode ?? "strategist");
  const [model, setModel] = useState<LabModel>(shared.model ?? "hybrid");
  const [laps, setLaps] = useState(shared.laps && shared.laps >= 5 ? Math.min(60, shared.laps) : 12);
  const [seed, setSeed] = useState(shared.seed && shared.seed > 0 ? Math.min(999_999_999, shared.seed) : 9032024);
  const [selectedIds, setSelectedIds] = useState<number[]>(shared.drivers ?? []);
  const [grid, setGrid] = useState<number[]>(shared.grid ?? []);
  const [controlledId, setControlledId] = useState<number | null>(shared.controlledId ?? null);
  const [phase, setPhase] = useState<Phase>("setup");
  const [state, setState] = useState<LabState | null>(null);
  const [running, setRunning] = useState(false);
  const [speed, setSpeed] = useState<(typeof SPEEDS)[number]>(1);
  const [followId, setFollowId] = useState<number | null>(null);
  const [panel, setPanel] = useState<"strategy" | "forecast" | "events">("strategy");
  const [message, setMessage] = useState("");
  const stateRef = useRef<LabState | null>(null);

  const meta = RACES.find((race) => race.id === raceId) ?? latest;
  const circuit = circuitOf(meta.circuitId);
  const layoutMeta = layoutFor(circuit, meta.year);
  const detail = useResource(String(meta.id), () => loadRace(meta.id));
  const advanced = useResource(String(meta.id), () => loadAdvancedRace(meta.id));
  const layoutRes = useResource(layoutMeta.file ? layoutMeta.id : null, () => loadLayout(layoutMeta.id));
  const layout = layoutRes.data?.id === layoutMeta.id ? layoutRes.data : null;
  const seasonRaces = useMemo(() => RACES.filter((race) => race.year === season), [season]);
  const roster = useMemo(() => {
    if (!detail.data || detail.data.id !== meta.id) return null;
    const advancedById = new Map((advanced.data?.raceId === meta.id ? advanced.data.drivers : []).map((driver) => [driver.d, driver]));
    return buildRows(detail.data, meta.year)
      .map((row): LabEntrant => {
        const research = advancedById.get(row.driver.id);
        return { id: row.driver.id, code: row.driver.code, name: row.driver.name, team: row.team.short, colour: row.colour, grid: row.grid ?? detail.data!.entries.length, coursework: row.score, researchPosition: research?.e ?? null, researchPodium: research?.p ?? null, reliability: research?.r ?? 0.04 };
      })
      .sort((a, b) => a.grid - b.grid || a.id - b.id);
  }, [detail.data, advanced.data, meta.id, meta.year]);

  useEffect(() => {
    if (!roster) return;
    const valid = selectedIds.filter((id) => roster.some((entry) => entry.id === id));
    const next = valid.length >= 6 ? valid : roster.map((entry) => entry.id);
    if (next.join() !== selectedIds.join()) setSelectedIds(next);
    const validGrid = grid.filter((id) => next.includes(id));
    const nextGrid = [...validGrid, ...next.filter((id) => !validGrid.includes(id))];
    if (nextGrid.join() !== grid.join()) setGrid(nextGrid);
    if (controlledId === null || !next.includes(controlledId)) setControlledId(next[0] ?? null);
  }, [roster, selectedIds, grid, controlledId]);

  useEffect(() => {
    if (!running || phase !== "race") return;
    const timer = window.setInterval(() => {
      setState((current) => {
        if (!current) return current;
        const next = advanceLabLap(current);
        stateRef.current = next;
        if (next.finished) { setRunning(false); setPhase("finished"); }
        return next;
      });
    }, 1250 / speed);
    return () => window.clearInterval(timer);
  }, [running, speed, phase]);

  useEffect(() => {
    if (phase === "setup") return;
    const frame = requestAnimationFrame(() => {
      const target = phase === "finished" ? document.getElementById("lab-results")?.closest<HTMLElement>("section") : document.getElementById("lab-live");
      if (target) {
        const navHeight = Number.parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--nav-h")) * 16 || 56;
        const previousScrollBehavior = document.documentElement.style.scrollBehavior;
        document.documentElement.style.scrollBehavior = "auto";
        window.scrollTo(0, Math.max(0, target.getBoundingClientRect().top + window.scrollY - navHeight));
        document.documentElement.style.scrollBehavior = previousScrollBehavior;
        target.tabIndex = -1;
        target.focus({ preventScroll: true });
      }
    });
    return () => cancelAnimationFrame(frame);
  }, [phase]);

  const chooseRace = (id: number) => {
    setRaceId(id); setSelectedIds([]); setGrid([]); setControlledId(null); setPhase("setup"); setState(null);
  };
  const configured = useMemo(() => {
    if (!roster) return [];
    const byId = new Map(roster.map((entry) => [entry.id, entry]));
    return grid.filter((id) => selectedIds.includes(id)).map((id, index) => ({ ...byId.get(id)!, grid: index + 1 })).filter(Boolean);
  }, [roster, grid, selectedIds]);
  const config = (): LabConfig => ({ raceId: meta.id, raceName: meta.name, year: meta.year, laps, seed, model, mode, controlledId: mode === "strategist" ? controlledId : null, entrants: configured });
  const start = () => {
    if (configured.length < 6) { setMessage("Choose at least six distinct drivers."); return; }
    const next = initialLabRace(config());
    stateRef.current = next; setState(next); setFollowId(next.config.controlledId ?? next.config.entrants[0].id); setPhase("race"); setRunning(true); setMessage(""); window.scrollTo({ top: 0, behavior: "smooth" });
  };
  const step = () => setState((current) => {
    if (!current) return current;
    const next = advanceLabLap(current); stateRef.current = next;
    if (next.finished) { setRunning(false); setPhase("finished"); }
    return next;
  });
  const updateStrategy = (change: Parameters<typeof setPlayerStrategy>[1]) => setState((current) => {
    if (!current) return current; const next = setPlayerStrategy(current, change); stateRef.current = next; return next;
  });
  const restart = () => { const next = initialLabRace(config()); stateRef.current = next; setState(next); setPhase("race"); setRunning(true); };
  const exportResult = () => {
    if (!state) return;
    const blob = new Blob([JSON.stringify(labRecord(state), null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob); const anchor = document.createElement("a"); anchor.href = url; anchor.download = `paladin-race-lab-${meta.year}-${meta.slug}-${seed}.json`; anchor.click(); URL.revokeObjectURL(url);
  };
  const share = async () => {
    const queryString = encodeLabShare({ raceId, laps, seed, model, mode, controlledId, drivers: selectedIds, grid });
    const url = `${window.location.origin}${window.location.pathname}#/race-lab?${queryString}`;
    try { await navigator.clipboard.writeText(url); setMessage("Reproducible Race Lab link copied."); } catch { window.prompt("Copy this Race Lab link", url); }
  };

  return (
    <div className="race-lab min-h-[100svh] pt-[var(--nav-h)]">
      <header className="border-b border-line bg-tower">
        <div className="mx-auto flex max-w-[1600px] flex-wrap items-end justify-between gap-5 px-4 py-7 sm:px-6 lg:px-10">
          <div className="max-w-[68ch]">
            <h1 className="display text-[clamp(2.8rem,6vw,4.8rem)] leading-[0.92]">Race Lab</h1>
            <p className="mt-3 text-[1.05rem] leading-relaxed text-steel">Build a reproducible strategy scenario from a historical grid and real circuit geometry.</p>
            <p className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-[0.82rem] text-mute">
              <Tag kind="simulation">Simulation</Tag>
              <span>Deterministic game rules · not recorded history or validated physics.</span>
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <a className="btn btn-ghost" href={href(`/race/${meta.year}/${meta.slug}`)}>Historical race</a>
            <button className="btn btn-ghost" type="button" onClick={share}>Share setup</button>
          </div>
        </div>
      </header>

      {phase === "setup" ? (
        <Setup
          season={season} setSeason={(year) => { setSeason(year); chooseRace(RACES.filter((race) => race.year === year)[0].id); }} races={seasonRaces} raceId={raceId} chooseRace={chooseRace}
          meta={meta} circuitName={circuit.name} layoutMeta={layoutMeta} roster={roster} selectedIds={selectedIds} setSelectedIds={setSelectedIds} grid={grid} setGrid={setGrid}
          mode={mode} setMode={setMode} model={model} setModel={setModel} laps={laps} setLaps={setLaps} seed={seed} setSeed={setSeed} controlledId={controlledId} setControlledId={setControlledId}
          loading={detail.loading || advanced.loading} message={message} start={start}
        />
      ) : state && layout ? (
        <RaceConsole state={state} layout={layout} running={running} setRunning={setRunning} speed={speed} setSpeed={setSpeed} step={step} restart={restart} followId={followId} setFollowId={setFollowId} panel={panel} setPanel={setPanel} updateStrategy={updateStrategy} exportResult={exportResult} setPhase={setPhase} setModel={setModel} />
      ) : <div className="mx-auto max-w-[1600px] p-12"><LightsLoader label="Loading Race Lab" /></div>}
      <p className="sr-only" aria-live="polite">{state ? `Lap ${state.lap} of ${state.config.laps}. ${running ? "Race running" : "Race paused"}.` : message}</p>
    </div>
  );
}

interface SetupProps {
  season: number; setSeason: (value: number) => void; races: typeof RACES; raceId: number; chooseRace: (id: number) => void; meta: (typeof RACES)[number]; circuitName: string; layoutMeta: ReturnType<typeof layoutFor>;
  roster: LabEntrant[] | null; selectedIds: number[]; setSelectedIds: (ids: number[]) => void; grid: number[]; setGrid: (ids: number[]) => void;
  mode: LabMode; setMode: (value: LabMode) => void; model: LabModel; setModel: (value: LabModel) => void; laps: number; setLaps: (value: number) => void; seed: number; setSeed: (value: number) => void; controlledId: number | null; setControlledId: (value: number) => void;
  loading: boolean; message: string; start: () => void;
}

function Setup(props: SetupProps) {
  const toggle = (id: number) => {
    if (props.selectedIds.includes(id)) { if (props.selectedIds.length <= 6) return; props.setSelectedIds(props.selectedIds.filter((value) => value !== id)); props.setGrid(props.grid.filter((value) => value !== id)); }
    else { props.setSelectedIds([...props.selectedIds, id]); props.setGrid([...props.grid, id]); }
  };
  const randomise = () => props.setGrid([...props.selectedIds].sort((a, b) => ((a * 2654435761 + props.seed) >>> 0) - ((b * 2654435761 + props.seed) >>> 0)));
  const reverse = () => props.setGrid([...props.grid].reverse());
  const selected = props.grid.map((id) => props.roster?.find((entry) => entry.id === id)).filter((entry): entry is LabEntrant => Boolean(entry && props.selectedIds.includes(entry.id)));
  return (
    <div className="mx-auto grid max-w-[1600px] gap-px bg-line lg:grid-cols-[minmax(0,1.5fr)_minmax(21rem,0.7fr)]">
      <div className="min-w-0 bg-paper px-4 py-7 sm:px-6 lg:px-10">
        <section aria-labelledby="lab-event"><h2 id="lab-event" className="display text-[2.4rem]">Build the field</h2>
          <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-[10rem_minmax(0,1fr)_13rem]">
            <label className="label">Season<select className="select mt-2 w-full" value={props.season} onChange={(event) => props.setSeason(Number(event.target.value))}>{SEASONS.map((year) => <option key={year}>{year}</option>)}</select></label>
            <label className="label">Circuit and historical roster<select className="select mt-2 w-full" value={props.raceId} onChange={(event) => props.chooseRace(Number(event.target.value))}>{props.races.map((race) => <option key={race.id} value={race.id}>R{race.round} · {race.name}</option>)}</select></label>
            <div className="grid min-h-28 place-items-center border border-line bg-tower p-2" aria-label={`${props.circuitName} outline`}>{props.layoutMeta.file ? <CircuitThumb meta={props.layoutMeta} className="h-24 w-full" stroke="#f4f4f2" width={10} accent="#3a4049" /> : <span className="text-mute">Outline unavailable</span>}</div>
          </div>
          <p className="mt-3 text-[0.86rem] text-mute">{props.meta.year} {props.meta.name} supplies valid entrants and constructors. Mixing grids is hypothetical; regulation and era differences are not normalized.</p>
        </section>

        <section className="mt-9 border-t border-line pt-7" aria-labelledby="lab-drivers">
          <div className="flex flex-wrap items-end justify-between gap-3"><div><h2 id="lab-drivers" className="display text-[2.4rem]">Choose drivers</h2><p className="mt-1 text-steel">{props.selectedIds.length} selected · minimum 6 · duplicates blocked</p></div><div className="flex gap-2"><button type="button" className="btn btn-ghost" onClick={randomise}>Randomise grid</button><button type="button" className="btn btn-ghost" onClick={reverse}>Reverse grid</button></div></div>
          {props.loading && <div className="mt-5"><LightsLoader label="Loading historical field" /></div>}
          {props.roster && <div className="mt-5 grid grid-cols-2 gap-px bg-line sm:grid-cols-3 xl:grid-cols-4" role="group" aria-label="Drivers in the race">
            {props.roster.map((entry) => { const on = props.selectedIds.includes(entry.id); const slot = selected.findIndex((item) => item.id === entry.id) + 1; return <button key={entry.id} type="button" aria-pressed={on} onClick={() => toggle(entry.id)} className={`relative min-h-20 bg-panel p-3 pl-4 text-left ${on ? "!bg-panel2 text-ink" : "text-mute"}`}><span className="absolute inset-y-0 left-0 w-px" style={{ background: entry.colour }} /><span className="flex justify-between gap-2"><strong className="font-display text-[1.35rem] tracking-wide">{entry.code}</strong><span className="figure">{on ? `P${slot}` : "OUT"}</span></span><span className="block truncate text-[0.78rem]">{entry.team}</span></button>; })}
          </div>}
        </section>
      </div>

      <aside className="min-w-0 bg-panel px-4 py-7 sm:px-6 lg:px-8" aria-label="Race Lab configuration">
        <h2 className="display text-[2.4rem]">Command setup</h2>
        <div className="mt-6 space-y-6">
          <Tabs<LabMode> value={props.mode} onChange={props.setMode} idPrefix="lab-mode" label="Play mode" options={[{ id: "simulator", label: "Simulator" }, { id: "strategist", label: "Strategist" }, { id: "battle", label: "Model battle" }]} />
          <div><label className="label" htmlFor="lab-model">Simulation model</label><select id="lab-model" className="select mt-2 w-full" value={props.model} onChange={(event) => props.setModel(event.target.value as LabModel)}>{(Object.keys(MODELS) as LabModel[]).map((id) => <option key={id} value={id}>{MODELS[id].name}</option>)}</select><p className="mt-2 text-[0.82rem] leading-snug text-steel">{MODELS[props.model].contract} {MODELS[props.model].limitation}</p></div>
          {props.mode === "strategist" && <div><label className="label" htmlFor="lab-control">Control driver</label><select id="lab-control" className="select mt-2 w-full" value={props.controlledId ?? ""} onChange={(event) => props.setControlledId(Number(event.target.value))}>{selected.map((entry) => <option key={entry.id} value={entry.id}>{entry.code} · {entry.name}</option>)}</select></div>}
          <div className="grid grid-cols-2 gap-3"><label className="label">Laps<input className="input mt-2 w-full" type="number" min="5" max="60" value={props.laps} onChange={(event) => props.setLaps(Math.max(5, Math.min(60, Number(event.target.value))))} /></label><label className="label">Seed<input className="input mt-2 w-full" type="number" min="1" max="999999999" value={props.seed} onChange={(event) => props.setSeed(Math.max(1, Number(event.target.value) || 1))} /></label></div>
          <button type="button" className="btn min-h-14 w-full !text-[1.2rem]" disabled={props.loading || selected.length < 6} onClick={props.start}>Start {props.mode === "battle" ? "model battle" : "race"} <Icon name="flag" size={18} /></button>
          {props.message && <p role="alert" className="text-[0.86rem] text-signal-text">{props.message}</p>}
          <Note kind="warn">All outcomes are simulated. Tyre wear, pit loss, incidents and in-race forecasts are declared game assumptions. Recorded history is never overwritten.</Note>
        </div>
      </aside>
    </div>
  );
}

interface ConsoleProps { state: LabState; layout: Layout; running: boolean; setRunning: (value: boolean) => void; speed: number; setSpeed: (value: 0.5 | 1 | 2 | 4) => void; step: () => void; restart: () => void; followId: number | null; setFollowId: (id: number) => void; panel: "strategy" | "forecast" | "events"; setPanel: (value: "strategy" | "forecast" | "events") => void; updateStrategy: (change: Parameters<typeof setPlayerStrategy>[1]) => void; exportResult: () => void; setPhase: (value: Phase) => void; setModel: (value: LabModel) => void }

function RaceConsole(props: ConsoleProps) {
  const { state } = props; const order = orderLab(state); const leader = order[0]; const followed = state.cars.find((car) => car.id === props.followId) ?? leader; const controlled = state.cars.find((car) => car.id === state.config.controlledId) ?? null;
  const battle = state.config.mode === "battle" ? modelBattle(state.config) : null;
  const viewBox = undefined;
  return <div className="mx-auto max-w-[1600px] bg-line">
    <div className="grid gap-px xl:grid-cols-[minmax(0,1fr)_19rem]">
      <section id="lab-live" tabIndex={-1} className="min-w-0 scroll-mt-[var(--nav-h)] bg-tower outline-none" aria-label="Live race">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-4 py-3 sm:px-6"><div><p className="label">{state.config.year} · {state.config.raceName} · simulated</p><p className="font-display text-[1.45rem] font-bold tracking-wide">LAP {state.lap} / {state.config.laps} <span className="ml-2 text-mute">{MODELS[state.config.model].name}</span></p></div><div className="flex flex-wrap gap-2"><button className="btn btn-ghost" type="button" onClick={() => props.setRunning(!props.running)} disabled={state.finished}>{props.running ? "Pause" : state.finished ? "Finished" : "Resume"}</button><button className="btn btn-ghost" type="button" onClick={props.step} disabled={props.running || state.finished}>Advance lap</button><select className="select !min-h-10" aria-label="Simulation speed" value={props.speed} onChange={(event) => props.setSpeed(Number(event.target.value) as 0.5 | 1 | 2 | 4)}>{SPEEDS.map((speed) => <option key={speed} value={speed}>{speed}×</option>)}</select></div></div>
        <div className="relative min-h-[25rem] overflow-hidden p-3 sm:p-7">
          <CircuitMap layout={props.layout} className="mx-auto block h-[26rem] w-full" weight={0.8} corners={false} box={viewBox} maxHeight={560} label={`Simulated race at lap ${state.lap} of ${state.config.laps}. ${state.config.entrants.find((entry) => entry.id === leader.id)?.code} leads.`}>
            {state.cars.map((car) => { const entry = state.config.entrants.find((item) => item.id === car.id)!; const point = pointAt(props.layout.samples, ((car.progress / Math.max(1, state.config.laps)) * 7.3) % 1); const on = car.id === followed.id; return <g key={car.id} className="transition-transform duration-700 motion-reduce:transition-none" transform={`translate(${point.x} ${point.y})`} opacity={car.retired ? 0.25 : 1}><circle r={on ? 15 : 10} fill={entry.colour} stroke={on ? "#fff" : "#08090b"} strokeWidth={on ? 4 : 2} /><text y="4" textAnchor="middle" fill="#fff" fontSize={on ? 10 : 8} fontWeight="800">{entry.code}</text></g>; })}
          </CircuitMap>
          <div className="absolute top-4 left-4 bg-tower/95 px-3 py-2"><p className="label">Leader</p><p className="font-display text-[1.6rem] font-bold">{state.config.entrants.find((entry) => entry.id === leader.id)?.code}</p></div>
          <div className="absolute right-4 bottom-4 bg-tower/95 px-3 py-2 text-right"><p className="label">Following</p><select className="select mt-1 !min-h-9" value={followed.id} onChange={(event) => props.setFollowId(Number(event.target.value))}>{order.map((car) => { const entry = state.config.entrants.find((item) => item.id === car.id)!; return <option key={car.id} value={car.id}>{entry.code} · {car.retired ? "Retired" : `P${order.indexOf(car) + 1}`}</option>; })}</select></div>
        </div>
        <div className="grid grid-cols-3 gap-px border-t border-line bg-line"><button className={`min-h-12 bg-panel font-display font-bold uppercase ${props.panel === "strategy" ? "text-ink" : "text-mute"}`} onClick={() => props.setPanel("strategy")}>Strategy</button><button className={`min-h-12 bg-panel font-display font-bold uppercase ${props.panel === "forecast" ? "text-ink" : "text-mute"}`} onClick={() => props.setPanel("forecast")}>Forecast</button><button className={`min-h-12 bg-panel font-display font-bold uppercase ${props.panel === "events" ? "text-ink" : "text-mute"}`} onClick={() => props.setPanel("events")}>Race control</button></div>
        <div className="min-h-64 bg-panel p-4 sm:p-6">
          {props.panel === "strategy" && (controlled ? <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_18rem]"><div><h2 className="display text-[2.1rem]">Call the race for {state.config.entrants.find((entry) => entry.id === controlled.id)?.code}</h2><p className="mt-2 text-steel">Every selection changes the next simulated lap. Attack is quicker but increases incident and retirement risk; conserve trades pace for reliability.</p><div className="mt-5 grid gap-4 sm:grid-cols-3"><label className="label">Pace<select className="select mt-2 w-full" value={controlled.strategy.pace} onChange={(event) => props.updateStrategy({ pace: event.target.value as Pace })}>{["conserve", "balanced", "attack"].map((value) => <option key={value}>{value}</option>)}</select></label><label className="label">Tyre assumption<select className="select mt-2 w-full" value={controlled.strategy.tyre} onChange={(event) => props.updateStrategy({ tyre: event.target.value as Tyre })}>{["soft", "medium", "hard"].map((value) => <option key={value}>{value}</option>)}</select></label><label className="label">Planned stop<input className="input mt-2 w-full" type="number" min={state.lap + 1} max={state.config.laps} value={controlled.strategy.pitLap ?? ""} onChange={(event) => props.updateStrategy({ pitLap: event.target.value ? Number(event.target.value) : null })} /></label></div></div><button type="button" className="btn btn-ghost min-h-16 self-end" disabled={controlled.pitStops > 0 || state.lap >= state.config.laps} onClick={() => props.updateStrategy({ pitLap: state.lap + 1 })}>Pit next lap</button></div> : <p className="text-steel">Simulator mode uses explicit AI policies. Choose Strategist mode in setup to control a driver.</p>)}
          {props.panel === "forecast" && <Forecast state={state} battle={battle} />}
          {props.panel === "events" && <ol className="max-h-64 divide-y divide-line overflow-y-auto">{[...state.events].reverse().slice(0, 30).map((event, index) => <li key={`${event.lap}-${event.kind}-${index}`} className="grid grid-cols-[4rem_7rem_minmax(0,1fr)] gap-3 py-2 text-[0.86rem]"><span className="figure">L{event.lap}</span><span className="label">{event.kind}</span><span className="text-steel">{event.message}</span></li>)}</ol>}
        </div>
      </section>
      <TimingTower state={state} />
    </div>
    {state.finished && <Results state={state} exportResult={props.exportResult} restart={props.restart} setup={() => props.setPhase("setup")} compare={(model) => { props.setModel(model); props.setPhase("setup"); }} />}
  </div>;
}

function TimingTower({ state }: { state: LabState }) { const order = orderLab(state); const leader = order[0]; return <aside className="bg-panel p-3" aria-label="Live timing tower"><div className="flex items-end justify-between px-2 py-3"><h2 className="display text-[2rem]">Timing</h2><span className="label">Live · simulated</span></div><ol className="space-y-px">{order.map((car, index) => { const entry = state.config.entrants.find((item) => item.id === car.id)!; const gap = index === 0 ? null : (car.totalMs - leader.totalMs) / 1000; return <li key={car.id} className={`grid grid-cols-[1.8rem_0.25rem_minmax(0,1fr)_4.5rem] items-center gap-2 px-2 py-2 ${car.id === state.config.controlledId ? "bg-ink text-paper" : "bg-tower"}`}><span className="figure text-right">{index + 1}</span><span className="h-5" style={{ background: entry.colour }} /><span className="truncate font-display text-[1.05rem] font-bold">{entry.code}<small className="ml-1 font-sans text-[0.65rem] font-normal opacity-70">{car.tyre[0].toUpperCase()}{car.tyreAge}</small></span><span className="text-right text-[0.72rem] tabular-nums opacity-75">{car.retired ? "OUT" : gap === null ? "LEADER" : gap > 99 ? `+${Math.round(gap)}s` : `+${Math.max(0, gap).toFixed(1)}`}</span></li>; })}</ol></aside>; }

function Forecast({ state, battle }: { state: LabState; battle: ReturnType<typeof modelBattle> | null }) { const rows = [...state.forecast].sort((a, b) => b.win - a.win).slice(0, 6); return <div className="grid gap-7 lg:grid-cols-2"><div><h2 className="display text-[2.1rem]">In-race estimate</h2><p className="mt-1 text-steel">Approximate update from game state—not the trained pre-race classifier.</p><div className="mt-4 divide-y divide-line">{rows.map((row) => { const entry = state.config.entrants.find((item) => item.id === row.driverId)!; return <div key={row.driverId} className="grid grid-cols-[4rem_minmax(0,1fr)_5rem] items-center gap-3 py-2"><strong className="font-display text-[1.2rem]">{entry.code}</strong><span className="h-2 bg-line"><span className="block h-full bg-signal" style={{ width: `${row.win * 100}%` }} /></span><span className="figure text-right">{Math.round(row.win * 100)}% win</span></div>; })}</div></div><div><h2 className="display text-[2.1rem]">Model contract</h2><p className="mt-2 text-steel">{MODELS[state.config.model].contract}</p><p className="mt-3 text-mute">{MODELS[state.config.model].limitation}</p>{battle && <div className="mt-4 divide-y divide-line">{battle.map((run) => <p key={run.model} className="flex justify-between gap-4 py-2"><span>{MODELS[run.model].name}</span><strong>{state.config.entrants.find((entry) => entry.id === run.winner)?.code}</strong></p>)}</div>}</div></div>; }

function Results({ state, exportResult, restart, setup, compare }: { state: LabState; exportResult: () => void; restart: () => void; setup: () => void; compare: (model: LabModel) => void }) { const order = orderLab(state); const winner = state.config.entrants.find((entry) => entry.id === order[0].id)!; return <section tabIndex={-1} className="scroll-mt-[var(--nav-h)] border-t-2 border-signal bg-paper px-4 py-10 outline-none sm:px-6 lg:px-10" aria-labelledby="lab-results"><div className="mx-auto max-w-[1400px]"><div className="flex flex-wrap items-end justify-between gap-5"><div><p className="label">Simulated result · seed {state.config.seed}</p><h2 id="lab-results" className="display mt-1 text-[clamp(3rem,7vw,5.8rem)] leading-none">{winner.code} wins</h2><p className="mt-2 text-steel">{winner.name} · {winner.team} · powered by {MODELS[state.config.model].name}</p></div><div className="flex flex-wrap gap-2"><button className="btn" type="button" onClick={restart}>Replay same seed</button><button className="btn btn-ghost" type="button" onClick={exportResult}>Export record</button><button className="btn btn-ghost" type="button" onClick={setup}>New race</button></div></div><div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,1.2fr)_minmax(18rem,0.8fr)]"><div><p className="mb-2 text-[0.78rem] text-mute lg:hidden">Swipe or use Shift + wheel to inspect the complete classification.</p><div className="overflow-x-auto" tabIndex={0} role="region" aria-label="Scrollable final classification"><table className="sheet min-w-[48rem]"><thead><tr><th>Pos</th><th>Driver</th><th>Team</th><th>Grid</th><th>Stops</th><th>Best lap</th><th>Points</th></tr></thead><tbody>{order.map((car, index) => { const entry = state.config.entrants.find((item) => item.id === car.id)!; return <tr key={car.id}><td className="figure">{index + 1}</td><td><strong>{entry.code}</strong> <span className="text-mute">{entry.name}</span></td><td>{entry.team}</td><td>P{entry.grid}</td><td>{car.pitStops}</td><td className="figure">{car.bestLapMs ? `${(car.bestLapMs / 1000).toFixed(3)}s` : "—"}</td><td className="figure">{car.retired ? "OUT" : [25,18,15,12,10,8,6,4,2,1][index] ?? 0}</td></tr>; })}</tbody></table></div></div><aside><h3 className="display text-[2rem]">Compare a model</h3><p className="mt-2 text-steel">Keep the race, field and seed; return to setup with a different model adapter.</p><div className="mt-4 grid gap-2">{(Object.keys(MODELS) as LabModel[]).filter((model) => model !== state.config.model).map((model) => <button key={model} className="btn btn-ghost justify-between" type="button" onClick={() => compare(model)}>{MODELS[model].name}<span>→</span></button>)}</div><p className="mt-5 text-[0.82rem] text-mute">This classification is a reproducible game outcome, not a historical fact or scientific cross-era verdict.</p></aside></div></div></section>; }

