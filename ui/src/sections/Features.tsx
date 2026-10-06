import { useEffect, useRef } from "react";
import site from "../data/site.json";
import { Prose, Section, Takeaway } from "../components/Section";

export function Features() {
  return (
    <Section id="features" title="Seventeen inputs, five groups">
      <Prose>
        Open a group. The list is what the model receives. The sentence under it is why that
        information exists before the start. There are 17 inputs in all.
      </Prose>
      <div>
        {site.groups.map((group) => (
          <FeatureGroup key={group.id} group={group} />
        ))}
      </div>
      <Prose>
        Median imputation fills what is missing, using training rows only. Scaling is on for
        logistic regression and the network. The forest does not use it, because a tree split
        does not care about units. On validation, the three preprocessing settings we tried
        sit within {preprocessingGap()} PR-AUC. Median imputation with scaling is the best of
        them on the score we care about. Zero-filling is slightly higher on ROC-AUC. We follow
        PR-AUC, and we do not treat this gap as the main lever.
      </Prose>
      <ul>
        {site.preprocessing.map((row) => (
          <li key={row.preprocessing} className="flex items-baseline justify-between gap-4 border-b border-line py-3">
            <span>{row.preprocessing}</span>
            <span className="figure text-[2rem]">{row["validation_PR-AUC"].toFixed(3)}</span>
          </li>
        ))}
      </ul>
      <Takeaway>
        How we fill missing values matters less, on this window, than which group we hand the
        model. The grid is the group the later ablation cannot drop quietly.
      </Takeaway>
    </Section>
  );
}

function FeatureGroup({ group }: { group: (typeof site.groups)[number] }) {
  const ref = useRef<HTMLDetailsElement>(null);

  useEffect(() => {
    if (group.id === "grid" && ref.current) ref.current.open = true;
  }, [group.id]);

  return (
    <details ref={ref} className="border-b border-line py-3">
      <summary className="cursor-pointer font-medium">{group.name}</summary>
      <p className="mt-2 text-quiet">{group.why}</p>
      <ul className="mt-3 space-y-1.5 text-[1.05rem]">
        {group.inputs.map((input) => (
          <li key={input}>{input}</li>
        ))}
      </ul>
    </details>
  );
}

function preprocessingGap(): string {
  const scores = site.preprocessing.map((row) => row["validation_PR-AUC"]);
  return (Math.max(...scores) - Math.min(...scores)).toFixed(3);
}
