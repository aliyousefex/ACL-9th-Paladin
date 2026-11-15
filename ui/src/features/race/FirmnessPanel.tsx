import { useMemo } from "react";
import check from "../../data/firmness.json";
import { Note } from "../../components/Bits";
import { Panel } from "../../components/Panel";
import type { RaceMeta } from "../../lib/data";
import { analyseField } from "../../lib/fieldModel";
import { featureLabel, pct } from "../../lib/format";
import { logOdds } from "../../lib/model";
import { NUDGE_DRAWS, NUDGE_SD, NUDGE_SEED, firmness, imputedInputs, scoreEvidence, topThreeStability, wilson, type Firmness } from "../../lib/uncertainty";
import type { Row } from "./rows";

const TONE: Record<Firmness, string> = {
  "high confidence": "border-hit/60 text-hit",
  contested: "border-amber/60 text-amber",
  fragile: "border-signal-text/60 text-signal-text",
  "outside the call": "border-line2 text-mute",
};

const WHY: Record<Firmness, string> = {
  "high confidence": "Stays in the top three under small nudges, and the field model names the same driver.",
  contested: "Holds up, or not, only part of the time, or the field model does not name this driver.",
  fragile: "Drops out of the top three in many nudged versions of this field.",
  "outside the call": "Not one of the classifier's three names. Shown to mark where the cut falls.",
};

/**
 * Before the start: how firm is each of the classifier's three names? Everything here comes from the pre-race inputs,
 * the model, and seasons that finished before 2022, so it sits above the lights-out line.
 */
export function FirmnessPanel({ race, rows }: { race: RaceMeta; rows: Row[] }) {
  const read = useMemo(() => {
    if (rows.length < 5) return null;
    const logits = rows.map((row) => logOdds(row.entry.x));
    // Same seed rule as scripts/evaluate-firmness.ts, so the figures here are the ones the label check was run on.
    const stability = topThreeStability(logits, NUDGE_DRAWS, NUDGE_SEED + race.id);
    const fieldPicks = new Set(analyseField(rows.map((row) => row.entry.x)).picks);
    return rows.slice(0, 5).map((row, i) => ({
      row,
      stability: stability[i],
      fieldAgrees: fieldPicks.has(i),
      evidence: scoreEvidence(row.score),
      missing: imputedInputs(row.entry.x),
      label: firmness({ inCall: row.rank <= 3, stability: stability[i], fieldAgrees: fieldPicks.has(i) }),
    }));
  }, [rows, race.id]);
  if (!read) return null;

  const labels = check.byLabel as Record<string, { picks: number; podiums: number }>;
  const high = labels["high confidence"];
  const rest = { picks: labels.contested.picks + labels.fragile.picks, podiums: labels.contested.podiums + labels.fragile.podiums };
  const highInterval = wilson(high.podiums, high.picks);

  return (
    <Panel eyebrow="Step 2a · Would a small change move the call?" title="How firm is the call?" tag="model">
      <p className="max-w-[72ch] text-steel">
        A score looks more certain than it is. Each name below is read three ways before the start: how often similar scores reached the podium in earlier seasons, whether the name survives small nudges to the inputs, and whether a second model agrees.
      </p>

      <div className="mt-6 overflow-x-auto">
        <table className="w-full min-w-[46rem] border-collapse text-left">
          <caption className="sr-only">The classifier's three names and the next two drivers, with how firm each call is</caption>
          <thead>
            <tr className="border-b border-line2 text-[0.82rem] text-mute">
              <th scope="col" className="py-2 pr-4 font-semibold">Driver</th>
              <th scope="col" className="py-2 pr-4 font-semibold">Call</th>
              <th scope="col" className="py-2 pr-4 font-semibold">Similar scores, 2020–21</th>
              <th scope="col" className="py-2 pr-4 text-right font-semibold">In top three after a nudge</th>
              <th scope="col" className="py-2 pr-4 font-semibold">Field model</th>
              <th scope="col" className="py-2 font-semibold">Inputs filled in</th>
            </tr>
          </thead>
          <tbody>
            {read.map((item) => (
              <tr key={item.row.driver.id} className={`border-b border-line align-top ${item.row.rank === 3 ? "border-b-line2" : ""}`}>
                <th scope="row" className="py-3 pr-4">
                  <span className="block font-display text-[1.2rem] leading-none font-semibold uppercase">{item.row.driver.last}</span>
                  <span className="mt-1 block text-[0.82rem] font-normal text-mute">{item.row.rank <= 3 ? `Named ${item.row.rank === 1 ? "first" : item.row.rank === 2 ? "second" : "third"}` : `Ranked ${item.row.rank}th`}, score {item.row.score.toFixed(2)}</span>
                </th>
                <td className="py-3 pr-4">
                  <span title={WHY[item.label]} className={`inline-block border px-1.5 py-0.5 font-display text-[0.82rem] font-semibold tracking-wide uppercase ${TONE[item.label]}`}>{item.label}</span>
                </td>
                <td className="py-3 pr-4">
                  <span className="figure text-[1.2rem]">{pct(item.evidence.observedRate, 0)}</span>
                  <span className="block text-[0.82rem] text-mute">
                    95% interval {pct(item.evidence.lower, 0)} to {pct(item.evidence.upper, 0)}, {item.evidence.sample} drivers{item.evidence.label === "limited evidence" ? ", thin evidence" : ""}
                  </span>
                </td>
                <td className="py-3 pr-4 text-right">
                  <span className="figure text-[1.2rem]">{pct(item.stability, 0)}</span>
                  <span className="mt-1 block h-1 bg-line" aria-hidden>
                    <span className="block h-full bg-steel" style={{ width: `${item.stability * 100}%` }} />
                  </span>
                </td>
                <td className="py-3 pr-4 text-steel">{item.fieldAgrees ? "Names this driver" : "Does not name this driver"}</td>
                <td className="py-3 text-[0.92rem] text-steel">
                  {item.missing.length === 0 ? "None" : `${item.missing.length} of 16: ${item.missing.map((name) => featureLabel(name).toLowerCase()).join(", ")}`}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-6 space-y-2">
        <Note>
          Does the label mean anything? Across the {check.picks / 3} held-out races, {high.picks} of the classifier's {check.picks} names were high confidence, and {pct(high.podiums / high.picks, 0)} of those reached the podium ({high.podiums} of {high.picks}; 95% interval {pct(highInterval.lower, 0)} to {pct(highInterval.upper, 0)}). The other {rest.picks} names, contested or fragile, reached it {pct(rest.podiums / rest.picks, 0)} of the time ({rest.podiums} of {rest.picks}). Contested ({labels.contested.podiums} of {labels.contested.picks}) and fragile ({labels.fragile.podiums} of {labels.fragile.picks}) are not separated from each other by that many names, so read both as "not high confidence".
        </Note>
        <Note>
          The nudge: every continuous input of every car is moved by a random {NUDGE_SD} of its training standard deviation, {NUDGE_DRAWS.toLocaleString("en-GB")} times, and the column shows how often the driver is still in the top three. The size, the {check.thresholds.high * 100}% and {check.thresholds.low * 100}% thresholds, and the seed were fixed before any result was looked at. They describe how easily the call changes. They do not say how likely it is to be right.
        </Note>
      </div>
    </Panel>
  );
}
