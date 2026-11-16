import { useEffect, useMemo, useState } from "react";
import { Panel } from "../../components/Panel";
import { Note } from "../../components/Bits";
import type { RaceMeta } from "../../lib/data";
import { hasBeenRevealed, readChallenge, removeChallenge, saveChallenge, scoreChallenge, type ChallengePick } from "../../lib/challenge";
import { href } from "../../lib/router";
import { ShareRace } from "./ShareRace";
import type { Row } from "./rows";

export function RaceChallenge({ race, rows, revealed }: { race: RaceMeta; rows: Row[]; revealed: boolean }) {
  const [saved, setSaved] = useState<ChallengePick | null>(() => readChallenge(race.id));
  const [selected, setSelected] = useState<number[]>(() => saved?.ids ?? []);
  const [message, setMessage] = useState("");

  useEffect(() => {
    const next = readChallenge(race.id);
    setSaved(next);
    setSelected(next?.ids ?? []);
    setMessage("");
  }, [race.id]);

  const gridOrder = useMemo(
    () => [...rows].sort((a, b) => (a.grid ?? 99) - (b.grid ?? 99)),
    [rows],
  );
  const hits = saved ? scoreChallenge(saved.ids, race.actual) : 0;
  // A pick counts in the season league only if it was locked while the result was hidden, in a browser that had never
  // seen this race's result. Once a counted pick has been revealed it is final.
  const resultSeen = revealed || hasBeenRevealed(race.id);
  const counts = saved?.blind === true;
  const canReset = !(counts && revealed);

  const toggle = (id: number) => {
    if (saved) return;
    setSelected((current) => current.includes(id) ? current.filter((item) => item !== id) : current.length < 3 ? [...current, id] : current);
  };

  const submit = () => {
    if (selected.length !== 3) return;
    const blind = !revealed && !hasBeenRevealed(race.id);
    const next: ChallengePick = { ids: selected, submittedAt: new Date().toISOString(), ...(blind ? { blind: true as const } : {}) };
    setSaved(next);
    if (!saveChallenge(race.id, next)) {
      setMessage("Pick locked for this visit. Browser storage is unavailable.");
    }
  };

  const reset = () => {
    setSaved(null);
    setSelected([]);
    setMessage("");
    removeChallenge(race.id);
  };

  return (
    <Panel
      title="Call the podium before the reveal"
      tag="user"
      actions={saved && canReset ? <button type="button" className="btn btn-ghost !min-h-11 !px-3 !text-[0.95rem]" onClick={reset}>New pick</button> : undefined}
    >
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_18rem]">
        <div>
          <p className="max-w-[68ch] text-steel">Choose exactly three drivers. This game scores podium membership, not finishing order—the same question Paladin was trained to answer.</p>
          <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-5" role="group" aria-label="Choose three podium drivers">
            {gridOrder.map((row) => {
              const on = selected.includes(row.driver.id);
              return (
                <button
                  key={row.driver.id}
                  type="button"
                  disabled={Boolean(saved)}
                  aria-pressed={on}
                  onClick={() => toggle(row.driver.id)}
                  className={`relative min-h-14 border px-3 py-2 text-left transition-colors disabled:cursor-default ${on ? "border-ink bg-ink text-paper" : "border-control bg-tower text-ink hover:border-steel"}`}
                >
                  <span className="absolute inset-y-0 left-0 w-1" style={{ background: row.colour }} aria-hidden />
                  <span className="block font-display text-[1.05rem] font-bold tracking-[0.08em] uppercase">{row.driver.code}</span>
                  <span className={`block text-[0.76rem] ${on ? "text-paper/70" : "text-mute"}`}>Grid {row.grid ?? "pit"}</span>
                </button>
              );
            })}
          </div>
        </div>
        <div className="border-t border-line pt-4 lg:border-t-0 lg:border-l lg:pt-0 lg:pl-6">
          <p className="label">Your ticket</p>
          <ol className="mt-3 space-y-2">
            {[0, 1, 2].map((slot) => {
              const row = rows.find((item) => item.driver.id === selected[slot]);
              const hit = row && saved && revealed && race.actual.includes(row.driver.id);
              return (
                <li key={slot} className="flex min-h-11 items-center gap-3 border-b border-line pb-2">
                  <span className="figure w-5 text-[1.25rem] text-mute">{slot + 1}</span>
                  {row ? <><span className="h-6 w-1" style={{ background: row.colour }} aria-hidden /><span className="font-display text-[1.2rem] font-bold uppercase">{row.driver.name}</span>{hit && <span className="ml-auto text-hit">Hit</span>}</> : <span className="text-mute">Open slot</span>}
                </li>
              );
            })}
          </ol>
          {!saved ? (
            <button type="button" className="btn mt-4 w-full" disabled={selected.length !== 3} onClick={submit}>Lock my three</button>
          ) : revealed ? (
            <p className="figure mt-4 text-[2.3rem]" aria-live="polite">{hits}<span className="text-[1.1rem] text-mute"> / 3 correct</span></p>
          ) : (
            <p className="mt-4 text-[0.9rem] text-steel" aria-live="polite">Locked. Your score appears when you reveal the result.</p>
          )}
          {message && <p className="mt-2 text-[0.82rem] text-amber">{message}</p>}
          <p className="mt-3 text-[0.85rem] leading-snug text-mute" aria-live="polite">
            {!saved && resultSeen && "The result has already been shown for this race, so a pick made now is practice and will not count in your league."}
            {saved && !counts && "This pick was locked after the result was visible, or before the league existed, so it does not count in your league."}
            {saved && counts && !revealed && "Locked blind. It counts in your league once you reveal the result, and it is final from then on."}
            {saved && counts && revealed && (
              <>
                Counted in your league. <a className="text-steel underline decoration-line2 underline-offset-2 hover:text-ink" href={href("/league")}>See your season</a>
              </>
            )}
          </p>
        </div>
      </div>
      {saved?.blind === true && revealed && <ShareRace race={race} picks={saved.ids} />}
      <div className="mt-5"><Note>Your selection is stored only in this browser and does not change the model or the historical record. Paladin’s own top three is already visible on this page, so this is not a blind test: only the actual result stays hidden until you reveal it.</Note></div>
    </Panel>
  );
}
