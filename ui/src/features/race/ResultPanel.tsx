import { Icon } from "../../components/Icon";
import { Panel } from "../../components/Panel";
import { Portrait } from "../../components/Portrait";
import { Note } from "../../components/Bits";
import type { RaceMeta } from "../../lib/data";
import { THRESHOLD } from "../../lib/model";
import model from "../../data/model.json";
import { PLACE_COLOURS, classifiedLabel, type Row } from "./rows";

/** After the flag: the prediction against what happened. Locked until the viewer asks for it. */
export function ResultPanel({
  race,
  rows,
  revealed,
  onReveal,
  alwaysShow,
  onAlwaysShow,
}: {
  race: RaceMeta;
  rows: Row[];
  revealed: boolean;
  onReveal: () => void;
  alwaysShow: boolean;
  onAlwaysShow: (next: boolean) => void;
}) {
  if (!revealed) {
    return (
      <Panel eyebrow="Step 3 · Chequered flag" title="Actual result" tag="record">
        <div className="grid gap-6 md:grid-cols-[1fr_auto] md:items-center">
          <div>
            <p className="max-w-[60ch] text-[1.05rem] leading-snug text-steel">
              The prediction above was made without any of this. Reveal the real classification to see how many of the model's three
              drivers reached the podium, and how the starting grid alone would have done.
            </p>
            <label className="mt-4 flex cursor-pointer items-center gap-2 text-[0.95rem] text-steel">
              <input type="checkbox" checked={alwaysShow} onChange={(e) => onAlwaysShow(e.target.checked)} className="h-4 w-4 accent-[var(--color-signal)]" />
              Always show results on race pages
            </label>
          </div>
          <button type="button" className="btn !min-h-14 !text-[1.3rem]" onClick={onReveal}>
            <Icon name="flag" size={20} /> Reveal the result
          </button>
        </div>
      </Panel>
    );
  }

  const byId = new Map(rows.map((r) => [r.driver.id, r]));
  const predicted = race.predicted.map((id) => byId.get(id)!).filter(Boolean);
  const actual = race.actual.map((id) => byId.get(id)!).filter(Boolean);
  const baseline = race.baseline.map((id) => byId.get(id)!).filter(Boolean);
  const classified = [...rows].sort((a, b) => (a.finish ?? 99) - (b.finish ?? 99));

  return (
    <Panel eyebrow="Step 3 · Chequered flag" title="Actual result" tag={["record", "model"]}>
      <div className="grid gap-5 md:grid-cols-3">
        <Summary title="Model's predicted podium" tag="model" rows={predicted} hits={race.hits} reference={race.actual} />
        <Summary title="Actual podium" tag="record" rows={actual} />
        <Summary title="Starting-grid top three" tag="record" rows={baseline} hits={race.baselineHits} reference={race.actual} />
      </div>

      <p className="mt-5 max-w-[78ch] text-[1.05rem] leading-snug">
        <span className="font-semibold">The model's top three contained {race.hits} of the 3 podium finishers.</span> Simply picking the
        first three on the starting grid would have contained {race.baselineHits}.{" "}
        <span className="text-steel">
          Across all {model.raceHits.races} held-out races the model averaged {model.raceHits.meanModel.toFixed(2)} of 3 and the grid
          {" "}{model.raceHits.meanGrid.toFixed(2)} of 3: nearly the same, which is what the model's reliance on the grid predicts.
        </span>
      </p>

      <div className="mt-6 overflow-x-auto">
        <table className="w-full min-w-[640px] border-collapse text-left">
          <caption className="sr-only">Final classification with the model's podium score for each driver</caption>
          <thead>
            <tr className="border-b border-ink text-[0.85rem] text-steel">
              <th className="py-2 pr-3 font-semibold">Pos</th>
              <th className="py-2 pr-3 font-semibold">Driver</th>
              <th className="py-2 pr-3 font-semibold">Grid</th>
              <th className="py-2 pr-3 font-semibold">Podium score</th>
              <th className="py-2 pr-3 font-semibold">Model said</th>
              <th className="py-2 pr-3 font-semibold">How it ended</th>
              <th className="py-2 text-right font-semibold">Pts</th>
            </tr>
          </thead>
          <tbody>
            {classified.map((row) => {
              const flagged = row.score >= THRESHOLD;
              const correct = flagged === row.podium;
              return (
                <tr key={row.driver.id} className="border-b border-line">
                  <td className="py-2 pr-3">
                    <span
                      className="inline-block min-w-[2.6rem] px-1.5 py-1 text-center font-display text-[1rem] leading-none font-bold"
                      style={row.finish && row.finish <= 3 ? { background: PLACE_COLOURS[row.finish - 1], color: "#0a0b0e" } : { background: "#1c2128", color: "#c5cad1" }}
                    >
                      {classifiedLabel(row)}
                    </span>
                  </td>
                  <td className="py-2 pr-3">
                    <span className="flex items-center gap-2.5">
                      <Portrait driver={row.driver} colour={row.colour} number={row.entry.n} className="hidden h-8 w-8 shrink-0 sm:block" rounded />
                      <span className="h-5 w-1 shrink-0 sm:hidden" style={{ background: row.colour }} aria-hidden />
                      <span>
                        <span className="block font-display text-[1.1rem] leading-none font-bold uppercase">{row.driver.last}</span>
                        <span className="block text-[0.8rem] leading-tight text-mute">{row.team.short}</span>
                      </span>
                    </span>
                  </td>
                  <td className="py-2 pr-3 font-display text-[1.05rem] font-semibold">{row.grid ? `P${row.grid}` : "PIT"}</td>
                  <td className="py-2 pr-3 font-display text-[1.15rem] font-semibold tabular-nums">{row.score.toFixed(2)}</td>
                  <td className="py-2 pr-3 text-[0.92rem]">
                    <span className={`inline-flex items-center gap-1.5 ${correct ? "text-hit" : "text-signal-text"}`}>
                      <Icon name={correct ? "check" : "cross"} size={14} strokeWidth={2.6} />
                      {flagged ? "podium" : "not podium"}
                    </span>
                  </td>
                  <td className="py-2 pr-3 text-[0.88rem] text-steel">
                    {row.entry.time ?? row.entry.status}
                  </td>
                  <td className="py-2 text-right font-display text-[1.05rem] font-semibold tabular-nums">{row.entry.pts || ""}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="mt-4">
        <Note>
          "Model said" applies the {THRESHOLD.toFixed(3)} cutoff chosen on 2020–21 validation. A driver who scores above it is predicted to
          reach the podium; with three places, more than three drivers can score above it.
        </Note>
      </div>
    </Panel>
  );
}

function Summary({
  title,
  tag,
  rows,
  hits,
  reference,
}: {
  title: string;
  tag: "model" | "record";
  rows: Row[];
  hits?: number;
  reference?: number[];
}) {
  return (
    <div className="border border-line bg-tower p-4">
      <div className="flex items-start justify-between gap-2">
        <p className="label">{title}</p>
        {hits !== undefined && (
          <p className="figure text-[1.6rem]" aria-label={`${hits} of 3 correct`}>
            {hits}
            <span className="text-[1rem] text-mute">/3</span>
          </p>
        )}
      </div>
      <ol className="mt-3 space-y-1.5">
        {rows.map((row, i) => {
          const ok = reference ? reference.includes(row.driver.id) : null;
          return (
            <li key={row.driver.id} className="flex items-center gap-2.5">
              <span className="figure w-5 text-[1.25rem]" style={{ color: tag === "record" && !reference ? PLACE_COLOURS[i] : "var(--color-steel)" }}>
                {i + 1}
              </span>
              <span className="h-5 w-1" style={{ background: row.colour }} aria-hidden />
              <span className="font-display text-[1.15rem] leading-none font-bold uppercase">{row.driver.last}</span>
              {ok !== null && (
                <Icon name={ok ? "check" : "cross"} size={15} strokeWidth={2.6} className={`ml-auto ${ok ? "text-hit" : "text-signal-text"}`} />
              )}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
