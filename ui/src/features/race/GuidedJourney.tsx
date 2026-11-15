import { Icon } from "../../components/Icon";
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

export function GuidedJourney({ race, rows, revealed }: { race: RaceMeta; rows: Row[]; revealed: boolean }) {
  const stability = fieldStability(rows);
  const lead = rows[0] ? scoreEvidence(rows[0].score) : null;
  const agreement = race.predicted.filter((id) => race.baseline.includes(id)).length;
  const jump = (id: string) => (event: React.MouseEvent<HTMLAnchorElement>) => {
    event.preventDefault();
    document.getElementById(id)?.scrollIntoView({ behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "start" });
  };

  return (
    <section className="journey" aria-labelledby="journey-title">
      <div className="journey-lead">
        <div>
          <p className="eyebrow">Guided path · five steps</p>
          <h2 id="journey-title">Make the call. Then open the evidence.</h2>
          <p>One guided path keeps the pre-race cutoff intact: inspect the field, lock three names, compare with Paladin, then reveal and diagnose the result.</p>
        </div>
        <p className="journey-state" data-open={revealed ? "true" : undefined}>{revealed ? "Result revealed · every step is open" : "Result hidden until step 4"}</p>
      </div>
      <ol className="journey-steps" aria-label="Race investigation steps">
        {STEPS.map((step, index) => {
          const locked = !revealed && step.id === "autopsy";
          const done = revealed && step.id !== "autopsy";
          return (
            <li key={step.id}>
              <a href={`#${step.id}`} onClick={locked ? undefined : jump(step.id)} aria-disabled={locked || undefined} className={locked ? "is-locked" : done ? "is-done" : ""}>
                <span className="journey-node" aria-hidden>{done ? <Icon name="check" size={16} strokeWidth={2.4} /> : locked ? <Icon name="lock" size={15} /> : index + 1}</span>
                <span className="journey-text"><strong><span className="sr-only">Step {index + 1}: </span>{step.label}</strong><small>{locked ? "Unlocks after reveal" : step.detail}</small></span>
                <Icon name={locked ? "skip" : "arrowRight"} size={16} className="journey-go" />
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
