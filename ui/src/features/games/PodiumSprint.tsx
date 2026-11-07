import { useMemo, useState } from "react";
import { Icon } from "../../components/Icon";
import { Tag } from "../../components/Provenance";
import { DRIVERS, RACES, SEASONS, constructor as constructorOf, driver as driverOf, teamColour } from "../../lib/data";
import { fieldOf, podiumHits, sprintRaces, sprintVerdict } from "./podiumScoring";

const PLACE = ["var(--color-gold)", "var(--color-silver)", "var(--color-bronze)"];

/**
 * Podium Sprint: call the podium in five real races, then see the real podium and how Paladin's picks compare.
 * Both sides are scored the same way: one point for each of three picks that finished in the top three, in any order.
 */
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
  // The whole field that started this race, in grid order, so the real podium is not hidden among a few names.
  const grid = useMemo(() => (race ? fieldOf(race, DRIVERS as never).map((entry) => ({ driver: driverOf(entry.id), team: constructorOf(entry.constructorId), colour: teamColour(entry.constructorId, race.year), slot: entry.grid })) : []), [race]);
  const roundPlayer = race ? podiumHits(selected, race.actual) : 0;
  const roundModel = race ? podiumHits(race.predicted, race.actual) : 0;
  const possible = round * 3;

  const reset = (nextSeason = season) => {
    setSeason(nextSeason);
    setRound(0);
    setSelected([]);
    setRevealed(false);
    setPlayerScore(0);
    setModelScore(0);
  };

  if (finished) {
    const verdict = sprintVerdict(playerScore, modelScore);
    const total = races.length * 3;
    return (
      <div className="panel mt-6 p-6 sm:p-8">
        <div className="grid items-end gap-6 lg:grid-cols-[minmax(0,1fr)_auto]">
          <div>
            <h3 className="display text-[2.2rem]">Podium Sprint complete</h3>
            <p className="mt-3 max-w-[65ch] text-steel">
              You called the podium in five real {season} races. For each one you picked three drivers, and Paladin picked its own three, before either of you saw the result. Every race was
              worth up to 3 points, one for each pick that finished in the top three, so {total} points were available in total.
            </p>
            <dl className="mt-6 flex flex-wrap gap-8">
              <Score label="You" value={`${playerScore} of ${total}`} />
              <Score label="Paladin" value={`${modelScore} of ${total}`} />
            </dl>
            <p className="mt-5 border-l-2 pl-3 font-display text-[1.4rem] font-bold uppercase" style={{ borderColor: verdict.kind === "win" ? "var(--color-hit)" : verdict.kind === "loss" ? "var(--color-signal)" : "var(--color-steel)" }}>
              {verdict.text}
            </p>
          </div>
          <button type="button" className="btn min-h-12" onClick={() => reset()}>
            Play another sprint
          </button>
        </div>
      </div>
    );
  }

  const toggle = (id: number) => {
    if (revealed) return;
    setSelected((current) => (current.includes(id) ? current.filter((item) => item !== id) : current.length < 3 ? [...current, id] : current));
  };
  const advance = () => {
    setPlayerScore((value) => value + roundPlayer);
    setModelScore((value) => value + roundModel);
    setRound((value) => value + 1);
    setSelected([]);
    setRevealed(false);
  };
  const verdict = sprintVerdict(roundPlayer, roundModel);

  return (
    <div className="panel mt-6 overflow-hidden">
      <div className="grid lg:grid-cols-[18rem_minmax(0,1fr)]">
        <div className="border-b border-line bg-tower p-5 sm:p-6 lg:border-r lg:border-b-0">
          <h3 className="display text-[1.9rem]">Podium Sprint</h3>
          <p className="mt-2 text-[0.92rem] leading-snug text-steel">
            Call the podium in five real races. In each one, pick the three drivers you think finished in the top three. Then see the real podium and how Paladin's picks compare.
          </p>
          <label className="label mt-6 block" htmlFor="sprint-season">
            Season to play
          </label>
          <select id="sprint-season" className="select mt-2 w-full" value={season} disabled={round > 0 || revealed} onChange={(event) => reset(Number(event.target.value))}>
            {SEASONS.map((year) => (
              <option key={year} value={year}>
                {year}
              </option>
            ))}
          </select>
          <p className="label mt-6">
            Race {round + 1} of {races.length}
          </p>
          <div className="mt-2 grid grid-cols-5 gap-1" aria-hidden>
            {races.map((item, index) => (
              <span key={item.id} className={`h-2 ${index < round ? "bg-hit" : index === round ? "bg-signal" : "bg-line2"}`} />
            ))}
          </div>
          <dl className="mt-6 space-y-4 border-y border-line py-4" aria-label="Score so far">
            <Score label="You" value={possible === 0 ? "–" : `${playerScore} of ${possible}`} />
            <Score label="Paladin" value={possible === 0 ? "–" : `${modelScore} of ${possible}`} />
          </dl>
          <p className="mt-3 text-[0.8rem] leading-relaxed text-mute">
            Correct picks so far, out of the points available. One point for each pick that finished on the podium. The order does not matter, so the most you can score in a race is 3.
            Paladin is scored the same way on its own top three.
          </p>
        </div>

        <div className="p-5 sm:p-7">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="label">
                Race {round + 1} of {races.length} · {season}
              </p>
              <h4 className="display mt-1 text-[2rem]">{race.name}</h4>
            </div>
            <div className="flex flex-wrap gap-2">
              <Tag kind="user">Your picks</Tag>
              {revealed && (
                <>
                  <Tag kind="model">Paladin's picks</Tag>
                  <Tag kind="record">Real result</Tag>
                </>
              )}
            </div>
          </div>

          {!revealed && (
            <p className="mt-4 max-w-[62ch] text-[1rem] leading-snug text-steel">
              <strong className="font-semibold text-ink">Who finished in the top three?</strong> Tap exactly three of the {grid.length} drivers who started, shown in starting-grid order (P1 is pole). This was a real race, but its result and Paladin's picks stay hidden until you lock in your three.
            </p>
          )}

          <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-5" role="group" aria-label="Choose three podium drivers">
            {grid.map(({ driver, team, colour, slot }) => {
              const on = selected.includes(driver.id);
              const actual = revealed && race.actual.includes(driver.id);
              return (
                <button
                  key={driver.id}
                  type="button"
                  disabled={revealed}
                  aria-pressed={on}
                  onClick={() => toggle(driver.id)}
                  className={`relative min-h-16 border px-3 py-2 text-left transition-colors disabled:cursor-default ${actual ? "border-hit bg-hit text-paper" : on ? "border-ink bg-ink text-paper" : "border-line2 bg-panel text-ink hover:border-steel"}`}
                >
                  <span className="absolute inset-y-0 left-0 w-1" style={{ background: colour }} aria-hidden />
                  <span className="block font-display text-[1.05rem] font-bold uppercase">{driver.code}</span>
                  <span className={`block truncate text-[0.72rem] ${actual || on ? "text-paper/75" : "text-mute"}`}>{team.short} · {slot ? `P${slot}` : "pit"}</span>
                </button>
              );
            })}
          </div>

          {!revealed ? (
            <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-5">
              <p className="text-[0.95rem] text-steel" aria-live="polite">
                {selected.length} of 3 drivers chosen{selected.length === 3 ? ". Ready to lock in." : "."}
              </p>
              <button type="button" className="btn min-h-11" disabled={selected.length !== 3} onClick={() => setRevealed(true)}>
                Lock in my three and see the result
              </button>
            </div>
          ) : (
            <div className="mt-6 border-t border-line pt-5" aria-live="polite">
              <p className="label">The real podium, in finishing order</p>
              <ol className="mt-2 flex flex-wrap gap-2" aria-label="Real podium">
                {race.actual.map((id, index) => (
                  <li key={id} className="flex items-center gap-2 border border-line bg-tower px-3 py-2">
                    <span className="figure text-[1.3rem]" style={{ color: PLACE[index] }}>
                      {index + 1}
                    </span>
                    <span className="font-display text-[1.15rem] font-bold uppercase">{driverOf(id).code}</span>
                  </li>
                ))}
              </ol>
              <div className="mt-4 grid gap-px bg-line sm:grid-cols-2">
                <Result label="Your picks" correct={roundPlayer} picks={selected} actual={race.actual} />
                <Result label="Paladin's picks" correct={roundModel} picks={race.predicted} actual={race.actual} />
              </div>
              <p className="mt-4 font-display text-[1.25rem] font-bold uppercase">{verdict.text}</p>
              <div className="mt-4 flex justify-end">
                <button type="button" className="btn min-h-11" onClick={advance}>
                  {round === races.length - 1 ? "See the final score" : "Next race"}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Score({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="label">{label}</dt>
      <dd className="figure mt-1 text-[2rem]">{value}</dd>
    </div>
  );
}

function Result({ label, correct, picks, actual }: { label: string; correct: number; picks: number[]; actual: number[] }) {
  return (
    <div className="bg-panel p-4">
      <p className="label">{label}</p>
      <p className="figure mt-1 text-[2rem]">
        {correct}
        <span className="text-[0.95rem] text-mute"> of 3 correct</span>
      </p>
      <ul className="mt-2 flex flex-wrap gap-2">
        {picks.map((id) => {
          const ok = actual.includes(id);
          return (
            <li key={id} className={`flex items-center gap-1.5 border px-2 py-1 ${ok ? "border-hit text-hit" : "border-line2 text-steel"}`}>
              <Icon name={ok ? "check" : "cross"} size={14} strokeWidth={2.6} />
              <span className="font-display text-[1.05rem] font-bold uppercase">{driverOf(id).code}</span>
              <span className="sr-only">{ok ? "finished on the podium" : "did not finish on the podium"}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
