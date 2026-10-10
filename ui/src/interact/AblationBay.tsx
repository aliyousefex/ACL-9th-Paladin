import { useState } from "react";
import site from "../data/site.json";
import { gap, num } from "../lib/format";
import { haptic } from "../lib/haptic";
import { ablationOf } from "../lib/metrics";

const LINKS: { id: string; variant: string }[] = [
  { id: "grid", variant: "without grid" },
  { id: "qualifying", variant: "without qualifying" },
  { id: "form", variant: "without form" },
  { id: "standings", variant: "without standings" },
  { id: "context", variant: "without context" },
];

export function AblationBay() {
  const [removed, setRemoved] = useState<string | null>(null);
  const variant = LINKS.find((item) => item.id === removed)?.variant ?? "all features";
  const row = ablationOf(variant);
  const full = ablationOf("all features");

  return (
    <div>
      <p className="max-w-[68ch] text-steel">
        Remove one group. Nothing is retrained in the browser. Each score is the logistic model already fit without that group, on 2020-2021.
      </p>
      <div className="mt-4 flex flex-wrap gap-2" role="group" aria-label="Remove a feature group">
        <button
          type="button"
          aria-pressed={removed === null}
          onClick={() => {
            haptic("select");
            setRemoved(null);
          }}
          className="switch"
        >
          All 17
        </button>
        {site.groups.map((group) => {
          const on = removed === group.id;
          return (
            <button
              key={group.id}
              type="button"
              aria-pressed={on}
              onClick={() => {
                haptic("select");
                setRemoved(group.id);
              }}
              className="switch"
            >
              {on ? `Without ${group.name.toLowerCase()}` : group.name}
            </button>
          );
        })}
      </div>
      <dl className="mt-6 grid gap-6 border-y border-line py-5 sm:grid-cols-3">
        <div>
          <dt className="text-steel">Validation PR-AUC</dt>
          <dd className="figure mt-2 text-[2.8rem]">{num(row["validation_PR-AUC"])}</dd>
        </div>
        <div>
          <dt className="text-steel">Change from all 17</dt>
          <dd className="figure mt-2 text-[2.8rem]">{gap(row["PR-AUC_change"])}</dd>
        </div>
        <div>
          <dt className="text-steel">Inputs left</dt>
          <dd className="figure mt-2 text-[2.8rem]">{row.features}</dd>
        </div>
      </dl>
      <div className="mt-4" aria-hidden>
        <span className="block h-2 bg-line">
          <span className="block h-2 bg-steel" style={{ width: `${(row["validation_PR-AUC"] / full["validation_PR-AUC"]) * 100}%` }} />
        </span>
      </div>
      {removed === "grid" && (
        <p className="mt-4 max-w-[68ch]">
          Grid is the drop that shows. ROC-AUC only moves from {num(full["validation_ROC-AUC"])} to {num(row["validation_ROC-AUC"])}. The primary score notices. The secondary score barely does.
        </p>
      )}
    </div>
  );
}
