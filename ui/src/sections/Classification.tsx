import { useState } from "react";
import { Choice } from "../components/Controls";
import { Prose, Section, Takeaway } from "../components/Section";
import site from "../data/site.json";
import { featureLabel, num } from "../lib/format";

const METRICS = ["PR-AUC", "ROC-AUC", "F1", "Precision", "Recall"] as const;
const SPLITS = [
  { id: "test", label: "Test 2022-2024" },
  { id: "validation", label: "Validation 2020-2021" },
  { id: "train", label: "Training through 2019" },
] as const;

type Metric = (typeof METRICS)[number];
type Split = (typeof SPLITS)[number]["id"];
type MetricRow = (typeof site.metrics)[number];

export function Classification() {
  const [metric, setMetric] = useState<Metric>("PR-AUC");
  const [split, setSplit] = useState<Split>("test");
  const [variant, setVariant] = useState(site.ablation[0].variant);

  const rows = site.metrics
    .filter((row) => row.split === split)
    .slice()
    .sort((a, b) => score(b, metric) - score(a, metric));
  const leader = score(rows[0], metric);
  const ablation = site.ablation.find((row) => row.variant === variant) ?? site.ablation[0];
  const testPodium = site.splits.find((row) => row.name === "Test")?.podiumRate ?? 0;

  return (
    <Section id="classification" title="The classification">
      <Prose>
        The order below is the selected score on the selected split. PR-AUC is the one we
        trust. Switch to ROC-AUC and watch the three models stop separating. Validation is{" "}
        {site.splits.find((row) => row.name === "Validation")?.races} races. Read small gaps
        with that in mind.
      </Prose>
      <div className="flex flex-wrap gap-2" role="group" aria-label="Metric">
        {METRICS.map((item) => (
          <Choice key={item} pressed={item === metric} onClick={() => setMetric(item)}>
            {item}
          </Choice>
        ))}
      </div>
      <div className="flex flex-wrap gap-2" role="group" aria-label="Split">
        {SPLITS.map((item) => (
          <Choice key={item.id} pressed={item.id === split} onClick={() => setSplit(item.id)}>
            {item.label}
          </Choice>
        ))}
      </div>
      <ol className="border-t border-ink">
        {rows.map((row, index) => {
          const value = score(row, metric);
          return (
            <li key={row.model} className="grid grid-cols-[1.5rem_1fr_auto] items-baseline gap-3 border-b border-line py-3">
              <span className="font-mono text-[13px] text-steel">{index + 1}</span>
              <span>
                <span className="block font-medium">{row.model}</span>
                <span className="mt-2 block h-1.5 bg-line">
                  <span className="block h-1.5 bg-steel" style={{ width: `${Math.max(0, Math.min(1, value)) * 100}%` }} />
                </span>
              </span>
              <span className="text-right font-mono text-[13px]">
                <span className="block">{num(value)}</span>
                <span className="block text-quiet">{index === 0 ? "leader" : `gap ${num(leader - value)}`}</span>
              </span>
            </li>
          );
        })}
      </ol>
      {split === "train" && metric === "PR-AUC" && (
        <Prose>
          This is the warning. The forest's training PR-AUC is {num(metricAt("Random forest", "train", "PR-AUC"))},
          then {num(metricAt("Random forest", "validation", "PR-AUC"))} on validation. Logistic
          regression and the network do not show that collapse. Their training scores sit
          below validation, partly because the training podium rate is lower and qualifying
          is mostly missing. We do not read that rise as the model getting better after 2019.
        </Prose>
      )}
      <Prose>
        On the untouched test set, PR-AUC is {num(metricAt("Shallow neural network", "test", "PR-AUC"))}{" "}
        for the network, {num(metricAt("Logistic regression", "test", "PR-AUC"))} for logistic
        regression, and {num(metricAt("Random forest", "test", "PR-AUC"))} for the forest. A
        useless ranking would sit near {num(testPodium)}, the test podium rate. ROC-AUC for
        the three models sits between {num(metricAt("Random forest", "test", "ROC-AUC"))} and{" "}
        {num(metricAt("Shallow neural network", "test", "ROC-AUC"))}. In that pair reading, a
        true podium outranks a non-podium about 93 to 94 times out of 100, and the models do
        not separate.
      </Prose>
      <Prose>
        At the frozen cutoffs, logistic regression's test precision is{" "}
        {num(metricAt("Logistic regression", "test", "Precision"))} and its recall is{" "}
        {num(metricAt("Logistic regression", "test", "Recall"))}. It catches most podiums and
        accepts more false alarms. The forest is the conservative one: precision{" "}
        {num(metricAt("Random forest", "test", "Precision"))}, recall{" "}
        {num(metricAt("Random forest", "test", "Recall"))}. The network sits between them,
        precision {num(metricAt("Shallow neural network", "test", "Precision"))} and recall{" "}
        {num(metricAt("Shallow neural network", "test", "Recall"))}. Test F1 ends up almost
        tied, from {num(metricAt("Random forest", "test", "F1"))} to{" "}
        {num(metricAt("Shallow neural network", "test", "F1"))}.
      </Prose>

      <h3 className="pt-4 text-[1.2rem] font-semibold tracking-[-0.02em]">Remove one group</h3>
      <Prose>
        Each button retrains nothing. It shows the logistic model we already fit with that
        group removed, scored on validation PR-AUC. One group at a time.
      </Prose>
      <div className="flex flex-wrap gap-2" role="group" aria-label="Ablation">
        {site.ablation.map((row) => (
          <Choice key={row.variant} pressed={row.variant === variant} onClick={() => setVariant(row.variant)}>
            {row.variant}
          </Choice>
        ))}
      </div>
      <p className="font-mono text-[13px]">
        {ablation.variant}: PR-AUC {num(ablation["validation_PR-AUC"])}, change{" "}
        {`${ablation["PR-AUC_change"] >= 0 ? "+" : ""}${num(ablation["PR-AUC_change"])}`}. ROC-AUC
        stays at {num(ablation["validation_ROC-AUC"])}.
      </p>
      <Prose>
        Dropping the grid costs the most. Dropping qualifying, once the grid is present,
        costs about {num(Math.abs(changeOf("without qualifying")))}. The published grid
        already contains qualifying order, plus any penalty. ROC-AUC moves only from{" "}
        {num(changeRow("all features")["validation_ROC-AUC"])} to{" "}
        {num(changeRow("without grid")["validation_ROC-AUC"])} when the grid is removed.
        The primary score notices. The secondary score barely does.
      </Prose>

      <h3 className="pt-4 text-[1.2rem] font-semibold tracking-[-0.02em]">Where the two explanations disagree</h3>
      <Prose>
        Both lists are the random forest on a validation sample. Permutation shuffles one
        column and records the change in PR-AUC. SHAP averages the size of each feature's
        push. A negative permutation value means the score rose slightly when that column
        was destroyed. We do not read that as a cause.
      </Prose>
      <div className="grid gap-8 md:grid-cols-2">
        <BarList
          title="Permutation, change in PR-AUC"
          rows={site.permutation.map((row) => ({ label: featureLabel(row.feature), value: row.importance }))}
          signed
        />
        <BarList
          title="Mean absolute SHAP"
          rows={site.shapGlobal.map((row) => ({ label: featureLabel(row.feature), value: row.value }))}
          signed={false}
        />
      </div>
      <Prose>
        Both put grid position first, by a wide margin. SHAP then ranks recent form. Permutation
        says shuffling driver form does not help, and constructor form barely moves the score.
        A reasonable reading is that form repeats information the grid and the standings already
        carry. We treat the shared finding as the reliable one.
      </Prose>
      <Takeaway>
        The network is slightly ahead on the score we chose, and the test seasons still place
        it first. The forest gives back a large training advantage. Grid position is the input
        both the ablation and the two explanations agree on.
      </Takeaway>
    </Section>
  );
}

function score(row: MetricRow, metric: Metric): number {
  return row[metric];
}

function metricAt(model: string, split: string, metric: Metric): number {
  const row = site.metrics.find((item) => item.model === model && item.split === split);
  return row ? row[metric] : 0;
}

function changeOf(variant: string): number {
  return changeRow(variant)["PR-AUC_change"];
}

function changeRow(variant: string) {
  return site.ablation.find((row) => row.variant === variant) ?? site.ablation[0];
}

function BarList({
  title,
  rows,
  signed,
}: {
  title: string;
  rows: { label: string; value: number }[];
  signed: boolean;
}) {
  const max = Math.max(...rows.map((row) => Math.abs(row.value)), 0.001);
  return (
    <div>
      <p className="font-mono text-[12px] text-steel">{title}</p>
      <ul className="mt-3 space-y-2">
        {rows.map((row) => (
          <li key={row.label}>
            <div className="flex justify-between gap-3 font-mono text-[12px]">
              <span>{row.label}</span>
              <span>{signed ? row.value.toFixed(3) : row.value.toFixed(3)}</span>
            </div>
            <span className="mt-1 block h-1.5 bg-line">
              <span
                className={`block h-1.5 ${row.value < 0 ? "bg-signal" : "bg-steel"}`}
                style={{ width: `${(Math.abs(row.value) / max) * 100}%` }}
              />
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
