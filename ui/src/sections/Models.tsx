import { useState } from "react";
import type { KeyboardEvent } from "react";
import { num } from "../lib/format";
import { haptic } from "../lib/haptic";
import { metricAt, thresholdAt } from "../lib/metrics";
import { Prose, Section, Takeaway } from "../components/Section";

const MODELS = [
  {
    name: "Logistic regression",
    short: "Weighted straight-line baseline",
    learns: "A coefficient for every input. Positive weights raise the podium score; negative weights lower it.",
    strength: "Transparent, stable, and a strong reference point for every more complex model.",
    caution: "It cannot discover curved rules or feature interactions unless those patterns are explicitly supplied.",
    body: "One weighted sum of the 17 inputs, turned into a probability. Class weights keep the rare podium rows from disappearing. Median imputation and scaling are on. This is also the model the ablation retrains. Its validation cutoff is the number that maximises F1, not a probability we can compare with the other models.",
  },
  {
    name: "Random forest",
    short: "240 branching decision trees",
    learns: "Each tree repeatedly splits the rows, for example by grid position and recent form. Their probabilities are averaged.",
    strength: "Captures nonlinear thresholds and interactions without requiring us to write them by hand.",
    caution: "Left unconstrained it memorises the training years, so its depth and leaf size had to be limited using validation.",
    body: "240 trees, depth capped at 12, at least 30 training rows in every leaf, no scaling. Those limits won a validation search. The first version, with no depth cap and four rows per leaf, memorised 1950-2019. A tree can ask for a strong recent record and a poor grid in the same path. This is the only model we explain with permutation importance and SHAP.",
  },
  {
    name: "Shallow neural network",
    short: "Two compact hidden layers",
    learns: "The 17 inputs pass through 32 hidden units, then 12, before one podium probability is produced.",
    strength: "Learns smooth combinations of grid, form, standings, and context. It leads validation PR-AUC.",
    caution: "Its internal weights are harder to interpret, and its raw probability scale differs from the other models.",
    body: "Two hidden layers, 32 units then 12, with early stopping. We searched one and two hidden layers of 8 to 64 units, with two regularisation strengths, on validation and averaged three random seeds. 32 then 12 was best, so we kept it. Its probabilities sit lower than the other two, which is why the cutoff is near 0.24 rather than 0.65. We selected it because it led validation PR-AUC, by less than the seed-to-seed spread. The case-file probabilities come from this network.",
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
    <Section id="models" title="Inside the ML pipeline">
      <PipelineMap />
      <Prose>
        All three see the same training rows and the same 17 features. Every setting and
        cutoff was chosen on 2020-2021 only. A cutoff of {num(thresholdAt("Shallow neural network"))} on the
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
        className="border-t border-line py-5"
      >
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <h3 className="text-[1.9rem]">{open.name}</h3>
          <p className="font-display text-[0.95rem] tracking-[0.06em] text-steel uppercase">{open.short}</p>
        </div>
        <p className="mt-2 max-w-[68ch] text-steel">{open.body}</p>
        <dl className="mt-6 grid gap-px bg-line md:grid-cols-3">
          <div className="bg-paper p-4">
            <dt className="font-display text-[0.9rem] tracking-[0.06em] text-steel uppercase">How it learns</dt>
            <dd className="mt-2 leading-relaxed">{open.learns}</dd>
          </div>
          <div className="bg-paper p-4">
            <dt className="font-display text-[0.9rem] tracking-[0.06em] text-steel uppercase">Why we used it</dt>
            <dd className="mt-2 leading-relaxed">{open.strength}</dd>
          </div>
          <div className="bg-paper p-4">
            <dt className="font-display text-[0.9rem] tracking-[0.06em] text-steel uppercase">What to watch</dt>
            <dd className="mt-2 leading-relaxed">{open.caution}</dd>
          </div>
        </dl>
        <div className="mt-6 grid gap-4 border-y border-line py-5 sm:grid-cols-4">
          <span>
            <span className="block text-steel">Validation cutoff</span>
            <span className="figure mt-1 block text-[2.2rem]">{num(thresholdAt(open.name))}</span>
          </span>
          {(["train", "validation", "test"] as const).map((split) => (
            <span key={split}>
              <span className="block text-steel">{split === "train" ? "Training" : split[0].toUpperCase() + split.slice(1)} PR-AUC</span>
              <span className="figure mt-1 block text-[2.2rem]">{num(metricAt(open.name, split, "PR-AUC"))}</span>
            </span>
          ))}
        </div>
      </article>
      <Takeaway>
        The network wins model selection on validation PR-AUC, by less than the noise of a 39-race validation set. The forest remains the
        explainability model, so its SHAP and permutation results must not be presented as
        explanations of the selected network.
      </Takeaway>
    </Section>
  );
}

const PIPELINE = [
  {
    name: "Target",
    status: "Binary classification",
    detail: "One driver-race row is labelled 1 when positionOrder is 3 or better, otherwise 0. The positive class is rare: 12.7% overall.",
  },
  {
    name: "Features",
    status: "17 pre-race inputs",
    detail: "Grid, qualifying, recent form, prior standings, and context are known before lights out. Current-race outcomes are excluded.",
  },
  {
    name: "Preprocess",
    status: "Fit on training only",
    detail: "Missing values use the training median. Logistic regression and the neural network also standardise their inputs; the forest does not need scaling.",
  },
  {
    name: "Split",
    status: "Chronological holdout",
    detail: "Train through 2019, select on 2020–2021, and evaluate once on 2022–2024. Future seasons never teach the past.",
  },
  {
    name: "Select",
    status: "Validation PR-AUC",
    detail: "PR-AUC is primary because podiums are uncommon. Each classification cutoff is selected on validation F1, never on the test set.",
  },
  {
    name: "Explain",
    status: "Ablation + SHAP + permutation",
    detail: "Group ablation tests predictive contribution. SHAP and permutation importance describe the random forest, while individual network probabilities remain separate.",
  },
] as const;

function PipelineMap() {
  const [stage, setStage] = useState(0);
  const open = PIPELINE[stage];

  return (
    <div className="border-y border-line py-5">
      <p className="max-w-[68ch] text-steel">
        Follow one prediction from its supervised-learning target to final explanation. Select a stage to inspect the controls that prevent leakage and test-set tuning.
      </p>
      <div className="mt-5 grid grid-cols-2 gap-px bg-line sm:grid-cols-3 lg:grid-cols-6" role="group" aria-label="Machine-learning pipeline">
        {PIPELINE.map((item, index) => (
          <button
            key={item.name}
            type="button"
            aria-pressed={index === stage}
            onClick={() => {
              haptic("select");
              setStage(index);
            }}
            className={`min-h-20 bg-paper p-3 text-left font-display tracking-[0.05em] uppercase ${index === stage ? "text-ink" : "text-steel hover:text-ink"}`}
          >
            <span className={`mb-3 block h-1 ${index === stage ? "bg-signal" : "bg-line"}`} aria-hidden />
            {item.name}
          </button>
        ))}
      </div>
      <div className="grid gap-3 pt-5 md:grid-cols-[13rem_1fr]">
        <p className="font-display text-[1.35rem] leading-tight text-ink">{open.status}</p>
        <p className="max-w-[68ch] leading-relaxed text-steel">{open.detail}</p>
      </div>
    </div>
  );
}

function slug(name: string): string {
  return name.toLowerCase().replace(/\s+/g, "-");
}
