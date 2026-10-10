import { useState } from "react";
import type { KeyboardEvent } from "react";
import { num } from "../lib/format";
import { haptic } from "../lib/haptic";
import { metricAt, thresholdAt } from "../lib/metrics";
import { Prose, Section, Takeaway } from "../components/Section";

const MODELS = [
  {
    name: "Logistic regression",
    body: "One weighted sum of the 17 inputs, turned into a probability. Class weights keep the rare podium rows from disappearing. Median imputation and scaling are on. This is also the model the ablation retrains. Its validation cutoff is the number that maximises F1, not a probability we can compare with the other models.",
  },
  {
    name: "Random forest",
    body: "240 trees, at least four training rows in every leaf, no scaling. A tree can ask for a strong recent record and a poor grid in the same path. This is the model that memorises 1950-2019, and the only model we explain with permutation importance and SHAP.",
  },
  {
    name: "Shallow neural network",
    body: "Two hidden layers, 32 units then 12, with early stopping. The settings were fixed. We did not search them. Its probabilities sit lower than the other two, which is why the cutoff is near 0.24 rather than 0.65. We selected it because it led validation PR-AUC. The case-file probabilities come from this network.",
  },
];

export function Models() {
  const [active, setActive] = useState("Shallow neural network");
  const validation = MODELS.map((model) => ({
    ...model,
    score: metricAt(model.name, "validation", "PR-AUC"),
  }));
  const open = validation.find((model) => model.name === active) ?? validation[0];

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const names = validation.map((model) => model.name);
    const index = names.indexOf(active);
    if (event.key !== "ArrowRight" && event.key !== "ArrowLeft") return;
    event.preventDefault();
    const next = event.key === "ArrowRight" ? (index + 1) % names.length : (index - 1 + names.length) % names.length;
    haptic("select");
    setActive(names[next]);
    event.currentTarget.querySelector<HTMLButtonElement>(`#model-tab-${slug(names[next])}`)?.focus();
  };

  return (
    <Section id="models" title="Three models, one set of rows">
      <Prose>
        All three see the same training rows and the same 17 features. Nothing was tuned
        except the F1 cutoff on 2020-2021. A cutoff of {num(thresholdAt("Shallow neural network"))} on the
        network is not automatically more aggressive than {num(thresholdAt("Logistic regression"))} on
        the logistic model. Precision and recall, in the next section, show what each cutoff
        actually does.
      </Prose>
      <div className="flex flex-wrap gap-2" role="tablist" aria-label="Models" onKeyDown={onKeyDown}>
        {validation.map((model) => {
          const on = model.name === active;
          return (
            <button
              key={model.name}
              type="button"
              role="tab"
              id={`model-tab-${slug(model.name)}`}
              aria-selected={on}
              aria-controls="model-panel"
              tabIndex={on ? 0 : -1}
              onClick={() => {
                haptic("select");
                setActive(model.name);
              }}
              className="switch min-w-[11rem]"
            >
              {model.name}
              <span className="figure block text-[2.35rem] normal-case tracking-[-0.03em]">{num(model.score)}</span>
            </button>
          );
        })}
      </div>
      <article
        id="model-panel"
        role="tabpanel"
        aria-labelledby={`model-tab-${slug(open.name)}`}
        className="border-t border-line py-4"
      >
        <h3 className="text-[1.7rem]">{open.name}</h3>
        <p className="mt-2 max-w-[68ch] text-steel">{open.body}</p>
        <p className="mt-4 flex flex-wrap items-end gap-x-8 gap-y-3">
          <span>
            <span className="block text-steel">Validation cutoff</span>
            <span className="figure mt-1 block text-[2.2rem]">{num(thresholdAt(open.name))}</span>
          </span>
          <span>
            <span className="block text-steel">Validation PR-AUC</span>
            <span className="figure mt-1 block text-[2.2rem]">{num(open.score)}</span>
          </span>
        </p>
      </article>
      <Takeaway>
        Explanations of the forest are not explanations of the network. The classification
        that follows keeps those two jobs apart.
      </Takeaway>
    </Section>
  );
}

function slug(name: string): string {
  return name.toLowerCase().replace(/\s+/g, "-");
}
