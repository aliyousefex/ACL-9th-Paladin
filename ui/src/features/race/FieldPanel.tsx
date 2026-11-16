import { useMemo } from "react";
import { Note } from "../../components/Bits";
import { Panel } from "../../components/Panel";
import { FIELD_META, actualSetStanding, analyseField } from "../../lib/fieldModel";
import { pct } from "../../lib/format";
import { ordinal } from "./autopsyModel";
import type { Row } from "./rows";

const SET_COUNT = 5;

/** A probability for people: never "0.0%", which reads as impossible when it only means very small. */
function chance(probability: number): string {
  if (probability > 0 && probability < 0.0005) return "under 0.1%";
  return pct(probability, probability < 0.1 ? 1 : 0);
}

/**
 * Pre-race: the field model's view of the whole podium. It uses only the 16 inputs each driver carries
 * (rows[].entry.x), exactly as the classifier does, so it sits above the "lights out" line. The real podium
 * appears only after the reveal.
 */
export function FieldPanel({ rows, revealed }: { rows: Row[]; revealed: boolean }) {
  const analysis = useMemo(() => analyseField(rows.map((row) => row.entry.x)), [rows]);
  if (rows.length < 4) return null;

  const code = (i: number) => rows[i].driver.code;
  const shown = analysis.sets.slice(0, SET_COUNT);
  const covered = shown.reduce((sum, set) => sum + set.probability, 0);
  const fieldTop = analysis.picks;
  const logisticTop = rows.map((_, i) => i).filter((i) => rows[i].rank <= 3);
  const overlap = fieldTop.filter((i) => logisticTop.includes(i)).length;
  const onlyField = fieldTop.filter((i) => !logisticTop.includes(i));
  const onlyLogistic = logisticTop.filter((i) => !fieldTop.includes(i));
  const byChance = rows.map((_, i) => i).sort((a, b) => analysis.marginal[b] - analysis.marginal[a]).slice(0, 8);
  const standing = revealed ? actualSetStanding(analysis, rows.map((row, i) => [row, i] as const).filter(([row]) => row.podium).map(([, i]) => i)) : null;
  const t = FIELD_META.test;

  return (
    <Panel context="Step 2b · The whole podium, not one driver at a time" title="Field model" tag={["experimental", "model"]}>
      <p className="max-w-[72ch] text-steel">
        The classifier scores each driver alone, so its top three need not describe a real podium. This model ranks the whole field at once: each driver gets one utility from the same 16 inputs, and the podium is drawn three times without replacement. That gives a probability for every podium that could happen.
      </p>

      <div className="mt-6 grid gap-8 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
        <section aria-labelledby="field-sets">
          <h3 id="field-sets" className="label">Most likely podiums, in any order</h3>
          <ol className="mt-3 space-y-2">
            {shown.map((set, i) => (
              <li key={set.members.join("-")} className="border border-line bg-tower px-3 py-2.5">
                <div className="flex items-baseline gap-3">
                  <span className="figure w-5 text-[1.1rem] text-mute">{i + 1}</span>
                  <span className="min-w-0 flex-1 truncate font-display text-[1.2rem] leading-none font-semibold uppercase">{set.members.map(code).join(" · ")}</span>
                  <span className="figure text-[1.3rem]">{chance(set.probability)}</span>
                </div>
                <div className="mt-2 h-1 bg-line" aria-hidden>
                  <div className="h-full bg-steel" style={{ width: `${(set.probability / shown[0].probability) * 100}%` }} />
                </div>
              </li>
            ))}
          </ol>
          <p className="mt-3 text-[0.95rem] text-steel">
            The {SET_COUNT} likeliest podiums together hold {pct(covered, 0)} of the probability. The rest is spread over {(analysis.sets.length - SET_COUNT).toLocaleString("en-GB")} other combinations: this field is as uncertain as a choice among about {Math.round(analysis.effectiveSets).toLocaleString("en-GB")} equally likely podiums.
          </p>
        </section>

        <section aria-labelledby="field-marginals">
          <h3 id="field-marginals" className="label">Chance of finishing in the top three</h3>
          <table className="mt-3 w-full border-collapse text-left">
            <caption className="sr-only">Podium chance for each of the eight likeliest drivers, from the field model, beside the classifier's score and rank</caption>
            <thead>
              <tr className="border-b border-line2 text-[0.8rem] text-mute">
                <th scope="col" className="py-1.5 pr-3 font-semibold">Driver</th>
                <th scope="col" className="py-1.5 pr-3 text-right font-semibold">Field model</th>
                <th scope="col" className="py-1.5 text-right font-semibold">Classifier score</th>
              </tr>
            </thead>
            <tbody>
              {byChance.map((i) => (
                <tr key={rows[i].driver.id} className="border-b border-line">
                  <th scope="row" className="py-2 pr-3 font-display text-[1.05rem] font-semibold uppercase">
                    {rows[i].driver.last}
                    {fieldTop.includes(i) && <span className="ml-2 text-[0.75rem] font-semibold tracking-wide text-signal-text normal-case">top three</span>}
                  </th>
                  <td className="py-2 pr-3 text-right figure text-[1.1rem]">{pct(analysis.marginal[i], 0)}</td>
                  <td className="py-2 text-right figure text-[1.1rem] text-steel">
                    {rows[i].score.toFixed(2)} <span className="text-mute">· {ordinal(rows[i].rank)}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-3 text-[0.95rem] text-steel">
            {overlap === 3
              ? "Both models name the same three drivers."
              : `The models share ${overlap} of 3 names. Only the field model picks ${onlyField.map((i) => rows[i].driver.last).join(" and ")}; only the classifier picks ${onlyLogistic.map((i) => rows[i].driver.last).join(" and ")}.`}
          </p>
        </section>
      </div>

      {standing && (
        <p className="mt-6 border-t border-line pt-4 text-ink">
          <span className="label mr-2">After the flag</span>
          The real podium was the field model's {ordinal(standing.rank)} most likely of {standing.of.toLocaleString("en-GB")}, at {chance(standing.probability)}. Its three picks held {rows.filter((row, i) => fieldTop.includes(i) && row.podium).length} of the 3 podium finishers.
        </p>
      )}

      <div className="mt-6 space-y-2">
        <Note>
          What the retrospective benchmark says, on the 68 held-out races: the field model's top three held {t.totalHits.fieldModel} podium finishers, the classifier's held {t.totalHits.logistic} and the starting grid's held {t.totalHits.grid}. Those differences are inside the sampling noise, so this model is not claimed to name more podium finishers. Its advantage is that the probabilities are coherent: they sum to exactly 3 across the field, and the likeliest podium it named actually happened in {t.fieldModelModalSetMatchesActual} of 68 races ({pct(t.fieldModelModalSetMatchesActual / 68, 0)}) against an average stated chance of {pct(t.meanModalSetProbability, 0)}.
        </Note>
        <Note kind="warn">{FIELD_META.evaluationStatus} The inputs that are the same for every car in a race ({FIELD_META.raceConstantFeatures.join(" and ")}) cancel out of this model and have no effect.</Note>
      </div>
    </Panel>
  );
}
