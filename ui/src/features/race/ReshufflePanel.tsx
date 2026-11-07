import { useMemo, useState } from "react";
import { Note } from "../../components/Bits";
import { Panel } from "../../components/Panel";
import { featureLabel } from "../../lib/format";
import { haptic } from "../../lib/haptic";
import { GROUPS, PRESETS, canHold, inputsOf, reshuffle, reshuffleStory, type Group, type Shuffled } from "./reshuffle";
import { PLACE_COLOURS, type Row } from "./rows";

const ROW_H = 40;

const sameSet = (a: ReadonlySet<Group>, b: readonly Group[]) => a.size === b.length && b.every((g) => a.has(g));

/**
 * Hold a group of inputs at the training average and watch the same fitted model re-rank the field.
 *
 * Before the reveal this uses only the model's inputs, so it contains nothing about the result. It is deliberately never
 * scored against the result: picking the setting that best matches a known outcome would be fitting to the answer.
 */
export function ReshufflePanel({ rows }: { rows: Row[] }) {
  const [held, setHeld] = useState<ReadonlySet<Group>>(() => new Set());
  const shuffled = useMemo(() => reshuffle(rows, held), [rows, held]);
  const story = useMemo(() => reshuffleStory(shuffled, held), [shuffled, held]);
  const byId = useMemo(() => new Map(shuffled.map((s) => [s.row.driver.id, s])), [shuffled]);
  const active = GROUPS.length - held.size;

  const toggle = (group: Group) => {
    if (!canHold(group, held)) return;
    haptic("select");
    setHeld((prev) => {
      const next = new Set(prev);
      if (next.has(group)) next.delete(group);
      else next.add(group);
      return next;
    });
  };

  return (
    <Panel eyebrow="Try it · same model, one group at a time" title="Hold an input group at its average" tag={["model", "user"]}>
      <p className="max-w-[74ch] text-steel">
        Paladin's score adds up contributions from five groups of inputs. Hold a group at the training average and it contributes nothing, and the same fitted model
        re-ranks the field. This is not retraining: the model never learned without these inputs, so read it as a way to see what each group is doing, not as another
        model's prediction.
      </p>

      <fieldset className="mt-5">
        <legend className="label">Input groups</legend>
        <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
          {GROUPS.map((group) => {
            const on = !held.has(group);
            const locked = on && !canHold(group, held);
            return (
              <button
                key={group}
                type="button"
                role="switch"
                aria-checked={on}
                disabled={locked}
                onClick={() => toggle(group)}
                className={`flex min-h-14 min-w-0 flex-col items-start justify-center gap-0.5 border px-3 py-2 text-left transition-colors disabled:cursor-not-allowed ${
                  on ? "border-ink/70 bg-panel2 text-ink hover:border-ink" : "border-dashed border-line2 bg-transparent text-steel hover:border-steel hover:text-ink"
                }`}
              >
                <span className="font-display text-[1.05rem] leading-none font-bold tracking-[0.06em] uppercase">{group}</span>
                <span className={`text-[0.72rem] leading-snug font-semibold tracking-[0.08em] uppercase ${on ? "text-ink" : "text-mute"}`}>
                  {on ? "Counts" : "Held at average"}
                  <span className="font-normal tracking-normal text-mute normal-case"> · {inputsOf(group).length} {inputsOf(group).length === 1 ? "input" : "inputs"}</span>
                </span>
              </button>
            );
          })}
        </div>
        {active === 1 && <p className="mt-2 text-[0.85rem] text-mute">One group has to stay on, otherwise every driver would tie.</p>}
        <div className="mt-3 flex flex-wrap items-center gap-2" role="group" aria-label="Presets">
          <span className="label mr-1">Presets</span>
          {PRESETS.map((preset) => (
            <button
              key={preset.id}
              type="button"
              className="chip !min-h-9 !px-3"
              aria-pressed={sameSet(held, preset.hold)}
              onClick={() => {
                haptic("select");
                setHeld(new Set(preset.hold));
              }}
            >
              {preset.label}
            </button>
          ))}
        </div>
        <details className="mt-3">
          <summary className="flex min-h-11 cursor-pointer items-center font-display text-[1rem] tracking-[0.08em] uppercase hover:text-ink">What is in each group</summary>
          <dl className="mt-1 grid gap-x-6 gap-y-2 text-[0.92rem] sm:grid-cols-2">
            {GROUPS.map((group) => (
              <div key={group}>
                <dt className="font-display font-bold tracking-wide text-ink uppercase">{group}</dt>
                <dd className="text-mute">{inputsOf(group).map(featureLabel).join(", ")}</dd>
              </div>
            ))}
          </dl>
        </details>
      </fieldset>

      <div className="mt-5 min-h-[4.5rem] space-y-1 border-l-2 border-signal pl-4 text-[1rem] text-ink" aria-live="polite" aria-atomic="true">
        {story.map((line) => (
          <p key={line}>{line}</p>
        ))}
      </div>

      <div className="mt-5">
        <div className="mb-2 grid grid-cols-[2.2rem_3.6rem_minmax(0,1fr)_minmax(7rem,1.1fr)] items-end gap-3 px-2 sm:grid-cols-[2.2rem_3.6rem_minmax(0,1fr)_3.2rem_minmax(8rem,1.1fr)]" aria-hidden>
          <span className="label">Rank</span>
          <span className="label">Move</span>
          <span className="label">Driver</span>
          <span className="label hidden text-center sm:block">Was</span>
          <span className="label">Score here</span>
        </div>
        <ul className="relative" style={{ height: shuffled.length * ROW_H }} aria-label="Drivers, in the order of the original ranking. Their rank under this setting is stated on each row.">
          {rows.map((row) => {
            const s = byId.get(row.driver.id) as Shuffled;
            return <TowerRow key={row.driver.id} item={s} />;
          })}
          <li aria-hidden className="pointer-events-none absolute inset-x-0 h-px bg-signal/70 transition-transform duration-500 ease-out motion-reduce:transition-none" style={{ transform: `translateY(${3 * ROW_H - 1}px)` }} />
        </ul>
      </div>

      <details className="mt-4 border-t border-line pt-3">
        <summary className="flex min-h-11 cursor-pointer items-center font-display text-[1rem] tracking-[0.08em] uppercase hover:text-ink">Full order under this setting</summary>
        <ol className="mt-2 columns-1 gap-8 text-[0.95rem] sm:columns-2">
          {shuffled.map((s) => (
            <li key={s.row.driver.id} className="flex items-baseline gap-2 break-inside-avoid border-b border-line py-1">
              <span className="figure w-7 text-right text-[1.1rem] text-steel">{s.rank}</span>
              <span className="font-display font-bold uppercase">{s.row.driver.last}</span>
              <span className="ml-auto text-mute tabular-nums">
                {s.score.toFixed(2)} · was {s.baseRank}
              </span>
            </li>
          ))}
        </ol>
      </details>

      <div className="mt-5">
        <Note>
          Held means the group's inputs are set to their training-set average, so each contributes exactly zero to the log-odds. Scores here are on a different footing from the
          full model's, so the 0.625 cutoff is not applied. Nothing on this panel is compared with the result of the race.
        </Note>
      </div>
    </Panel>
  );
}

function TowerRow({ item }: { item: Shuffled }) {
  const { row, rank, baseRank, move, score } = item;
  return (
    <li
      className="absolute inset-x-0 transition-transform duration-500 ease-out motion-reduce:transition-none"
      style={{ transform: `translateY(${(rank - 1) * ROW_H}px)`, height: ROW_H }}
    >
      <div className="grid h-[36px] grid-cols-[2.2rem_3.6rem_minmax(0,1fr)_minmax(7rem,1.1fr)] items-center gap-3 border border-line bg-panel px-2 sm:grid-cols-[2.2rem_3.6rem_minmax(0,1fr)_3.2rem_minmax(8rem,1.1fr)]">
        <span className="figure text-center text-[1.3rem]" style={{ color: rank <= 3 ? PLACE_COLOURS[rank - 1] : "var(--color-steel)" }}>
          {rank}
        </span>
        <span className={`font-display text-[0.98rem] font-semibold tabular-nums ${move > 0 ? "text-ink" : "text-mute"}`}>
          <span aria-hidden>{move > 0 ? `▲ ${move}` : move < 0 ? `▼ ${-move}` : "–"}</span>
          <span className="sr-only">{move > 0 ? `up ${move} places` : move < 0 ? `down ${-move} places` : "no change"}</span>
        </span>
        <span className="flex min-w-0 items-center gap-2">
          <span className="h-5 w-1.5 shrink-0" style={{ background: row.colour }} aria-hidden />
          <span className="truncate font-display text-[1.05rem] leading-none font-bold uppercase">
            <span className="sm:hidden">{row.driver.code}</span>
            <span className="hidden sm:inline">{row.driver.last}</span>
          </span>
          <span className="sr-only">
            Rank {rank} under this setting, was {baseRank}
          </span>
        </span>
        <span className="hidden text-center font-display text-[0.95rem] font-semibold text-mute sm:block" aria-hidden>
          #{baseRank}
        </span>
        <span className="flex items-center gap-2">
          <span className="relative h-2 flex-1 bg-line" aria-hidden>
            <span className="absolute inset-y-0 left-0 transition-[width] duration-500 ease-out motion-reduce:transition-none" style={{ width: `${Math.min(1, Math.max(0, score)) * 100}%`, background: rank <= 3 ? row.colour : "#4a525d" }} />
          </span>
          <span className="figure w-[2.6rem] text-right text-[1.15rem]">{score.toFixed(2)}</span>
        </span>
      </div>
    </li>
  );
}
