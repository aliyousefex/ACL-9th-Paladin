import type { ReactNode } from "react";

export type Provenance = "model" | "record" | "illustrative";

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
};

/** Every panel says where its numbers come from: the model, the record, or an illustration. */
export function Tag({ kind, children }: { kind: Provenance; children?: ReactNode }) {
  const copy = COPY[kind];
  return (
    <span className={copy.className} title={copy.title}>
      {children ?? copy.label}
    </span>
  );
}

export function ProvenanceLegend() {
  return (
    <dl className="grid gap-3 sm:grid-cols-3">
      {(Object.keys(COPY) as Provenance[]).map((kind) => (
        <div key={kind} className="flex flex-col items-start gap-2">
          <dt>
            <Tag kind={kind} />
          </dt>
          <dd className="text-[0.95rem] leading-snug text-steel">{COPY[kind].title}</dd>
        </div>
      ))}
    </dl>
  );
}
