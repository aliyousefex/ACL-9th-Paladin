import type { ReactNode } from "react";

export type Provenance = "model" | "record" | "illustrative" | "simulation" | "user";

const COPY: Record<Provenance, { label: string; title: string; className: string }> = {
  model: {
    label: "Model output",
    title: "Computed by the selected logistic regression from information known before the start.",
    className: "tag tag-model",
  },
  record: {
    label: "Historical record",
    title: "A real result or measurement from the dataset. Not produced by the model.",
    className: "tag tag-record",
  },
  illustrative: {
    label: "Illustrative",
    title: "Motion or styling added to make the data easier to follow. Not model output.",
    className: "tag tag-illus",
  },
  simulation: {
    label: "Simulation",
    title: "A synthetic scenario produced by transparent strategy rules. Not model output or historical fact.",
    className: "tag tag-illus",
  },
  user: {
    label: "Your input",
    title: "Something you chose or changed: a pick, a prediction or a what-if edit. Kept only in your browser. Not model output and not the historical record.",
    className: "tag tag-user",
  },
};

/** Every panel says where its numbers come from: the model, the record, a simulation or illustration, or you. */
export function Tag({ kind, children }: { kind: Provenance; children?: ReactNode }) {
  const copy = COPY[kind];
  return (
    <span className={copy.className} title={copy.title} data-provenance={kind}>
      {children ?? copy.label}
    </span>
  );
}

export function ProvenanceLegend() {
  return (
    <dl className="provenance-key" aria-label="Data source key">
      {(Object.keys(COPY) as Provenance[]).map((kind) => (
        <div key={kind} className="provenance-key-item">
          <dt>
            <Tag kind={kind} />
          </dt>
          <dd>{COPY[kind].title}</dd>
        </div>
      ))}
    </dl>
  );
}
