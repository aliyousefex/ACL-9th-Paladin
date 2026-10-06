import { useState } from "react";
import site from "../data/site.json";
import { num } from "../lib/format";
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
    score: score(model.name),
  }));

  return (
    <Section id="models" title="Three models, one set of rows">
      <Prose>
        All three see the same training rows and the same 17 features. Nothing was tuned
        except the F1 cutoff on 2020-2021. A cutoff of {num(site.hamilton.threshold)} on the
        network is not automatically more aggressive than {num(cutoff("Logistic regression"))} on
        the logistic model. Precision and recall, in the next section, show what each cutoff
        actually does.
      </Prose>
      <div className="flex flex-wrap gap-2" role="tablist" aria-label="Models">
        {validation.map((model) => {
          const on = model.name === active;
          return (
            <button
              key={model.name}
              type="button"
              role="tab"
              aria-selected={on}
              onClick={() => setActive(model.name)}
              className={`cursor-pointer border px-3 py-2 text-left ${
                on ? "border-signal bg-signal text-ink" : "border-line text-steel hover:border-ink hover:text-ink"
              }`}
            >
              {model.name}
              <span className="figure mt-2 block text-[2.35rem]">{num(model.score)}</span>
            </button>
          );
        })}
      </div>
      <div>
        {validation.map((model) => (
          <article
            key={model.name}
            className={`border-t border-line py-4 ${model.name === active ? "" : "opacity-80"}`}
          >
            <h3 className="text-[1.5rem]">{model.name}</h3>
            <p className="mt-2 text-steel">{model.body}</p>
            <p className="mt-4 flex flex-wrap items-end gap-x-8 gap-y-3">
              <span>
                <span className="block text-steel">Validation cutoff</span>
                <span className="figure mt-1 block text-[2.2rem]">{num(cutoff(model.name))}</span>
              </span>
              <span>
                <span className="block text-steel">PR-AUC</span>
                <span className="figure mt-1 block text-[2.2rem]">{num(model.score)}</span>
              </span>
            </p>
          </article>
        ))}
      </div>
      <Takeaway>
        Explanations of the forest are not explanations of the network. The classification
        that follows keeps those two jobs apart.
      </Takeaway>
    </Section>
  );
}

function cutoff(model: string): number {
  const row = site.metrics.find((item) => item.model === model && item.split === "validation");
  return row?.threshold ?? 0;
}

function score(model: string): number {
  const row = site.metrics.find((item) => item.model === model && item.split === "validation");
  return row?.["PR-AUC"] ?? 0;
}
