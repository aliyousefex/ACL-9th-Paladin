import { useEffect, useState } from "react";
import { Icon } from "../../components/Icon";
import { readChallenge, scoreChallenge, type ChallengePick } from "../../lib/challenge";
import type { RaceMeta } from "../../lib/data";
import { fieldStability, scoreEvidence } from "../../lib/uncertainty";
import type { Row } from "./rows";

const STEPS = [
  { id: "grid", label: "Inspect", detail: "What was known" },
  { id: "challenge", label: "Call", detail: "Choose your three" },
  { id: "prediction", label: "Compare", detail: "Read Paladin's call" },
  { id: "result", label: "Reveal", detail: "Open the record" },
  { id: "autopsy", label: "Explain", detail: "Study the errors" },
] as const;

type StepId = (typeof STEPS)[number]["id"];

/** The reader's own call on this race, kept in this browser, and kept current when it is made or cleared. */
function useMyCall(raceId: number | undefined): ChallengePick | null {
  const [pick, setPick] = useState<ChallengePick | null>(null);
  useEffect(() => {
    if (raceId === undefined) return;
    const read = () => setPick(readChallenge(raceId));
    read();
    window.addEventListener("paladin:challenge", read);
    window.addEventListener("storage", read);
    return () => {
      window.removeEventListener("paladin:challenge", read);
      window.removeEventListener("storage", read);
    };
  }, [raceId]);
  return pick;
}

export function GuidedJourney({ race, rows, revealed }: { race: RaceMeta; rows: Row[]; revealed: boolean }) {
  const stability = fieldStability(rows);
  const lead = rows[0] ? scoreEvidence(rows[0].score) : null;
  const agreement = race.predicted.filter((id) => race.baseline.includes(id)).length;
  const mine = useMyCall(race.id);
  const shared = mine ? mine.ids.filter((id) => race.predicted.includes(id)).length : 0;
  const myScore = mine && revealed ? scoreChallenge(mine.ids, race.actual) : 0;

  const jump = (id: string) => (event: React.MouseEvent<HTMLAnchorElement>) => {
    event.preventDefault();
    document.getElementById(id)?.scrollIntoView({ behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "start" });
  };

  /** What each step says for this reader and this race: the generic line until there is something of theirs to say. */
  const detail = (id: StepId): string => {
    switch (id) {
      case "grid":
        return rows.length > 0 ? `${rows.length} drivers, nothing after the flag` : "What was known";
      case "challenge":
        return mine ? "Your three are locked in" : "Choose your three";
      case "prediction":
        return mine ? `You and Paladin share ${shared} of 3 names` : "Read Paladin's call";
      case "result":
        return revealed ? "The record is open" : "Open the record";
      default:
        return mine && revealed ? `You scored ${myScore} of 3, Paladin ${race.hits}` : "Study the errors";
    }
  };

  const locked = (id: StepId) => !revealed && id === "autopsy";
  const done = (id: StepId) => (revealed ? id !== "autopsy" : mine !== null && (id === "grid" || id === "challenge"));
  const next = STEPS.find((step) => !locked(step.id) && !done(step.id))?.id;

  return (
    <section className="journey" aria-labelledby="journey-title">
      <div className="journey-lead">
        <div>
          <h2 id="journey-title">Make the call. Then open the evidence.</h2>
          <p>One guided path keeps the pre-race cutoff intact: inspect the field, lock three names, compare with Paladin, then reveal and diagnose the result.</p>
        </div>
        <p className="journey-state" data-open={revealed ? "true" : undefined}>{revealed ? "Result revealed · every step is open" : "Result hidden until step 4"}</p>
      </div>
      <ol className="journey-steps" aria-label="Race investigation steps">
        {STEPS.map((step, index) => {
          const isLocked = locked(step.id);
          const isDone = done(step.id);
          const isNext = step.id === next;
          return (
            <li key={step.id} data-state={isLocked ? "locked" : isDone ? "done" : isNext ? "next" : "open"}>
              <a href={`#${step.id}`} onClick={isLocked ? undefined : jump(step.id)} aria-disabled={isLocked || undefined} className={isLocked ? "is-locked" : isDone ? "is-done" : ""}>
                <span className="journey-node" aria-hidden>{String(index + 1).padStart(2, "0")}</span>
                <span className="journey-flag" aria-hidden>
                  {isLocked ? <Icon name="lock" size={14} /> : isDone ? <Icon name="check" size={14} strokeWidth={2.4} /> : null}
                  {isLocked ? "Locked" : isDone ? "Done" : isNext ? "Up next" : "Open"}
                </span>
                <span className="journey-text">
                  <strong><span className="sr-only">Step {index + 1}: </span>{step.label}</strong>
                  <small>{isLocked ? "Unlocks after reveal" : detail(step.id)}</small>
                </span>
              </a>
            </li>
          );
        })}
      </ol>
      {rows.length >= 4 && lead && (
        <div className="journey-readout" aria-label="Prediction uncertainty summary">
          <p><span>Field cut</span><strong>{stability.label}</strong><small>{stability.margin.toFixed(3)} separates third from fourth</small></p>
          <p><span>Top score, seen before</span><strong>{Math.round(lead.observedRate * 100)}% reached the podium</strong><small>Similar scores in {lead.source}: 95% interval {Math.round(lead.lower * 100)}–{Math.round(lead.upper * 100)}%, n={lead.sample}</small></p>
          <p><span>Grid agreement</span><strong>{agreement} of 3 names</strong><small>Agreement is context, not independent confirmation</small></p>
        </div>
      )}
    </section>
  );
}
