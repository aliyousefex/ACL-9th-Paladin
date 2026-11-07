import { Icon } from "../../components/Icon";
import { Note } from "../../components/Bits";
import type { RaceMeta } from "../../lib/data";
import { raceHref } from "../../lib/data";
import { href } from "../../lib/router";
import { ASSISTS, outcomeFor, type Assist, type Classified, type GpRecord, type OutcomeKind } from "./raceEngine";
import { gapText, raceTime } from "./grandPrixView";

const TONE: Record<OutcomeKind, { colour: string; label: string }> = {
  win: { colour: "var(--color-gold)", label: "You won" },
  podium: { colour: "var(--color-silver)", label: "On the podium" },
  points: { colour: "var(--color-hit)", label: "Scored points" },
  outside: { colour: "var(--color-steel)", label: "No points" },
  retired: { colour: "var(--color-signal-text)", label: "Did not finish" },
};

export interface ResultsProps {
  results: Classified[];
  playerId: number;
  race: RaceMeta;
  laps: number;
  assist: Assist;
  auto: boolean;
  seed: number;
  record: GpRecord;
  onAgain: () => void;
  onSetup: () => void;
}

/** After the flag: did you win, where did you finish, and how the whole field ended up. */
export function GrandPrixResults(props: ResultsProps) {
  const { results, playerId, race } = props;
  const me = results.find((c) => c.entrant.id === playerId);
  if (!me) return null;
  const outcome = outcomeFor(me, results.length);
  const tone = TONE[outcome.kind];
  const podium = results.slice(0, 3);
  const best = props.record.best[String(race.id)];

  return (
    <div>
      <div className="border-b border-line p-5 sm:p-7" style={{ borderTop: `4px solid ${tone.colour}` }}>
        <p className="label" style={{ color: tone.colour }}>{tone.label} · {race.name} {race.year}</p>
        <h4 className="display mt-1 text-[3.2rem] leading-none sm:text-[4.6rem]" style={{ color: tone.colour }} aria-live="polite">{outcome.headline}</h4>
        <p className="mt-3 max-w-[60ch] text-[1.05rem] text-steel">{outcome.detail}</p>
        {props.auto && <p className="mt-2 text-[0.88rem] text-mute">Autopilot drove this race, so it is not added to your record.</p>}

        <dl className="mt-6 grid grid-cols-2 gap-px bg-line sm:grid-cols-5">
          <Stat label="Finish" value={me.retired ? "DNF" : `P${me.position}`} note={`of ${results.length}`} />
          <Stat label="Points" value={String(me.points)} note="F1 scoring" />
          <Stat label="Race time" value={me.time === null ? "–" : raceTime(me.time)} note={me.gap && me.gap > 0 ? `${gapText(me.gap)} to the winner` : me.position === 1 ? "fastest" : ""} />
          <Stat label="Off track" value={String(me.incidents)} note={me.incidents === 0 ? "clean race" : me.incidents === 1 ? "time lost" : "times lost"} />
          <Stat label="From the grid" value={me.gained === null ? "Pit" : me.gained > 0 ? `+${me.gained}` : String(me.gained)} note={me.gained === null ? "lane start" : "places"} />
        </dl>

        <div className="mt-6 flex flex-wrap gap-3">
          <button type="button" className="btn min-h-12" onClick={props.onAgain}>
            Race again <Icon name="replay" size={16} />
          </button>
          <button type="button" className="btn btn-ghost min-h-12" onClick={props.onSetup}>
            Change driver or race
          </button>
          <a className="btn btn-ghost min-h-12" href={href(raceHref(race))}>
            See Paladin's prediction <Icon name="arrowRight" size={16} />
          </a>
        </div>
      </div>

      <div className="p-5 sm:p-7">
        <h5 className="label">The podium</h5>
        <ol className="mt-3 grid grid-cols-3 items-end gap-2" aria-label="Podium">
          {[podium[1], podium[0], podium[2]].map((c, slot) => {
            if (!c) return <li key={slot} />;
            const height = c.position === 1 ? "h-28" : c.position === 2 ? "h-20" : "h-14";
            const mine = c.entrant.id === playerId;
            return (
              <li key={c.entrant.id} className="text-center">
                <p className={`font-display text-[1.25rem] leading-none font-bold uppercase ${mine ? "text-ink" : "text-steel"}`}>{c.entrant.code}{mine ? " · you" : ""}</p>
                <p className="mt-1 truncate text-[0.78rem] text-mute">{c.entrant.team}</p>
                <div className={`mt-2 flex items-start justify-center border-t-4 bg-panel2 pt-2 ${height}`} style={{ borderColor: c.entrant.colour }}>
                  <span className="figure text-[2rem]" style={{ color: ["var(--color-gold)", "var(--color-silver)", "var(--color-bronze)"][c.position - 1] }}>{c.position}</span>
                </div>
              </li>
            );
          })}
        </ol>

        <h5 className="label mt-8">Final classification</h5>
        <div className="table-scroll mt-3 w-full min-w-0 overflow-x-auto overscroll-x-contain" role="region" aria-label="Final classification, scrolls sideways on narrow screens" tabIndex={0}>
          <table className="w-full min-w-[34rem] text-left text-[0.95rem]">
            <caption className="sr-only">Final classification of the race</caption>
            <thead>
              <tr className="border-b border-line text-[0.75rem] tracking-[0.1em] text-mute uppercase">
                <th scope="col" className="py-2 pr-3 font-semibold">Pos</th>
                <th scope="col" className="py-2 pr-3 font-semibold">Driver</th>
                <th scope="col" className="py-2 pr-3 font-semibold">Team</th>
                <th scope="col" className="py-2 pr-3 text-right font-semibold">Grid</th>
                <th scope="col" className="py-2 pr-3 text-right font-semibold">Places</th>
                <th scope="col" className="py-2 pr-3 text-right font-semibold">Time / gap</th>
                <th scope="col" className="py-2 text-right font-semibold">Pts</th>
              </tr>
            </thead>
            <tbody>
              {results.map((c) => {
                const mine = c.entrant.id === playerId;
                return (
                  <tr key={c.entrant.id} className={`border-b border-line ${mine ? "bg-panel2 font-semibold text-ink" : "text-steel"}`} aria-current={mine ? "true" : undefined}>
                    <td className="py-1.5 pr-3 font-display text-[1.1rem]">{c.retired ? "DNF" : c.position}</td>
                    <td className="py-1.5 pr-3">
                      <span className="mr-2 inline-block h-4 w-1 align-middle" style={{ background: c.entrant.colour }} aria-hidden />
                      {c.entrant.name}
                      {mine ? <span className="ml-2 text-[0.75rem] tracking-wide text-signal-text uppercase">you</span> : null}
                    </td>
                    <td className="py-1.5 pr-3 text-mute">{c.entrant.team}</td>
                    <td className="py-1.5 pr-3 text-right tabular-nums">{c.entrant.grid ?? "Pit"}</td>
                    <td className={`py-1.5 pr-3 text-right tabular-nums ${c.gained ? (c.gained > 0 ? "text-hit" : "text-signal-text") : ""}`}>{c.gained === null ? "–" : c.gained > 0 ? `+${c.gained}` : c.gained === 0 ? "0" : c.gained}</td>
                    <td className="py-1.5 pr-3 text-right tabular-nums">{c.retired ? "Retired" : c.position === 1 ? raceTime(c.time ?? 0) : c.time !== null ? gapText(c.gap ?? 0) : "–"}</td>
                    <td className="py-1.5 text-right tabular-nums">{c.points || ""}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="mt-5 space-y-2">
          <Note>
            Illustrative game. Each rival's pace was set before the start from the model's podium score and their grid slot for this race, plus a seeded driving error now and then
            (seed {props.seed}). It is not telemetry and it never looked at how the real race went, so a different finish here says nothing about what happened on the day.
            {" "}{props.laps} {props.laps === 1 ? "lap" : "laps"} · {props.auto ? "autopilot" : ASSISTS[props.assist].label.toLowerCase()} driving.
            {best !== undefined ? ` Your best finish in this race: P${best}.` : ""}
          </Note>
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value, note }: { label: string; value: string; note: string }) {
  return (
    <div className="bg-panel px-3 py-3">
      <dt className="label !text-[0.68rem]">{label}</dt>
      <dd className="figure mt-1 text-[1.8rem]">{value}</dd>
      <dd className="mt-0.5 text-[0.75rem] text-mute">{note}</dd>
    </div>
  );
}
