import { useMemo, useState } from "react";
import { RACES, SEASONS, constructor as constructorOf, driver as driverOf, teamColour } from "../../lib/data";
import { podiumHits, sprintRaces } from "./podiumScoring";

export function PodiumSprint() {
  const [season, setSeason] = useState<number>(2024);
  const races = useMemo(() => sprintRaces(RACES.filter((race) => race.year === season)), [season]);
  const [round, setRound] = useState(0);
  const [selected, setSelected] = useState<number[]>([]);
  const [revealed, setRevealed] = useState(false);
  const [playerScore, setPlayerScore] = useState(0);
  const [modelScore, setModelScore] = useState(0);
  const race = races[Math.min(round, races.length - 1)];
  const finished = round >= races.length;
  const grid = race ? Object.keys(race.teams).map(Number).map((id) => ({ driver: driverOf(id), team: constructorOf(race.teams[String(id)]), colour: teamColour(race.teams[String(id)], race.year) })) : [];
  const roundPlayer = race ? podiumHits(selected, race.actual) : 0;
  const roundModel = race ? podiumHits(race.predicted, race.actual) : 0;

  const reset = (nextSeason = season) => {
    setSeason(nextSeason); setRound(0); setSelected([]); setRevealed(false); setPlayerScore(0); setModelScore(0);
  };

  if (finished) {
    return <div className="panel mt-6 p-6 sm:p-8"><div className="grid items-end gap-6 lg:grid-cols-[minmax(0,1fr)_auto]"><div><h3 className="display text-[2.2rem]">Podium Sprint complete</h3><p className="mt-3 max-w-[65ch] text-steel">Five held-out {season} races, fifteen possible podium hits. Your selections and Paladin’s were scored against the same historical results.</p><div className="mt-6 flex flex-wrap gap-8"><Score label="Your calls" value={playerScore} /><Score label="Paladin" value={modelScore} /><Score label="Margin" value={playerScore - modelScore} signed /></div></div><button type="button" className="btn min-h-12" onClick={() => reset()}>Run another sprint</button></div></div>;
  }

  const toggle = (id: number) => {
    if (revealed) return;
    setSelected((current) => current.includes(id) ? current.filter((item) => item !== id) : current.length < 3 ? [...current, id] : current);
  };
  const advance = () => {
    setPlayerScore((value) => value + roundPlayer); setModelScore((value) => value + roundModel); setRound((value) => value + 1); setSelected([]); setRevealed(false);
  };

  return (
    <div className="panel mt-6 overflow-hidden"><div className="grid lg:grid-cols-[17rem_minmax(0,1fr)]">
      <div className="border-b border-line bg-tower p-5 lg:border-r lg:border-b-0 sm:p-6">
        <h3 className="display text-[1.9rem]">Podium Sprint</h3><p className="mt-2 text-[0.88rem] leading-snug text-mute">Pick three drivers in five held-out races, then compare every call with Paladin.</p>
        <label className="label mt-6 block" htmlFor="sprint-season">Season</label><select id="sprint-season" className="select mt-2 w-full" value={season} disabled={round > 0 || revealed} onChange={(event) => reset(Number(event.target.value))}>{SEASONS.map((year) => <option key={year} value={year}>{year}</option>)}</select>
        <div className="mt-6 grid grid-cols-5 gap-1" aria-label={`Round ${round + 1} of ${races.length}`}>{races.map((item, index) => <span key={item.id} className={`h-2 ${index < round ? "bg-hit" : index === round ? "bg-signal" : "bg-line2"}`} />)}</div>
        <dl className="mt-6 space-y-4 border-y border-line py-4"><Score label="Your hits" value={playerScore} /><Score label="Model hits" value={modelScore} /></dl><p className="mt-4 text-[0.78rem] leading-relaxed text-mute">Results and model selections remain hidden until your three are locked. Order does not matter.</p>
      </div>
      <div className="p-5 sm:p-7">
        <div className="flex flex-wrap items-start justify-between gap-4"><div><p className="label">Round {round + 1} of {races.length} · {season}</p><h4 className="display mt-1 text-[2rem]">{race.name}</h4></div><span className="tag tag-illus">Held-out prediction game</span></div>
        <div className="mt-6 grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-5" role="group" aria-label="Choose three podium drivers">{grid.map(({ driver, team, colour }) => { const on = selected.includes(driver.id); const actual = revealed && race.actual.includes(driver.id); return <button key={driver.id} type="button" disabled={revealed} aria-pressed={on} onClick={() => toggle(driver.id)} className={`relative min-h-16 border px-3 py-2 text-left transition-colors disabled:cursor-default ${actual ? "border-hit bg-hit text-paper" : on ? "border-ink bg-ink text-paper" : "border-line2 bg-panel text-ink hover:border-steel"}`}><span className="absolute inset-y-0 left-0 w-1" style={{ background: colour }} aria-hidden /><span className="block font-display text-[1.05rem] font-bold uppercase">{driver.code}</span><span className={`block truncate text-[0.72rem] ${actual || on ? "text-paper/75" : "text-mute"}`}>{team.short}</span></button>; })}</div>
        {!revealed ? <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-5"><p className="text-[0.9rem] text-steel">{selected.length} of 3 drivers selected</p><button type="button" className="btn min-h-11" disabled={selected.length !== 3} onClick={() => setRevealed(true)}>Lock and reveal</button></div> : <div className="mt-6 border-t border-line pt-5" aria-live="polite"><div className="grid gap-px bg-line sm:grid-cols-2"><Result label="Your result" hits={roundPlayer} names={selected.map((id) => driverOf(id).code)} actual={race.actual} /><Result label="Paladin’s result" hits={roundModel} names={race.predicted.map((id) => driverOf(id).code)} actual={race.actual} /></div><div className="mt-4 flex justify-end"><button type="button" className="btn min-h-11" onClick={advance}>{round === races.length - 1 ? "See final score" : "Next race"}</button></div></div>}
      </div>
    </div></div>
  );
}

function Score({ label, value, signed = false }: { label: string; value: number; signed?: boolean }) { return <div><dt className="label">{label}</dt><dd className="figure mt-1 text-[2rem]">{signed && value > 0 ? "+" : ""}{value}</dd></div>; }
function Result({ label, hits, names, actual }: { label: string; hits: number; names: string[]; actual: number[] }) { return <div className="bg-panel p-4"><p className="label">{label}</p><p className="figure mt-1 text-[2rem]">{hits}<span className="text-[0.9rem] text-mute"> / 3 hits</span></p><p className="mt-2 text-[0.8rem] text-steel">{names.join(" · ")}</p><p className="mt-2 text-[0.75rem] text-mute">Actual: {actual.map((id) => driverOf(id).code).join(" · ")}</p></div>; }
