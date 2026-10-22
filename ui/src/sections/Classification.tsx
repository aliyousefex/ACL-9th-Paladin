import { useState } from "react";
import { Choice } from "../components/Controls";
import { Prose, Section, Takeaway } from "../components/Section";
import site from "../data/site.json";
import { featureLabel, gap, num } from "../lib/format";
import { haptic } from "../lib/haptic";
import { metricAt } from "../lib/metrics";

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
  const [picked, setPicked] = useState("grid_position");

  const rows = site.metrics
    .filter((row) => row.split === split)
    .slice()
    .sort((a, b) => score(b, metric) - score(a, metric));
  const leader = score(rows[0], metric);
  const testPodium = site.splits.find((row) => row.name === "Test")?.podiumRate ?? 0;

  return (
    <Section id="classification" title="The classification">
      <Prose>
        The order below is the selected score on the selected split. PR-AUC is the one we
        trust. Switch to ROC-AUC and watch the three models stop separating. Validation is{" "}
        {site.splits.find((row) => row.name === "Validation")?.races} races. Read small gaps
        with that in mind.
      </Prose>
      <ScoreTower />
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
            <li key={row.model} className="grid grid-cols-[1.75rem_1fr_auto] items-center gap-4 border-b border-line py-4">
              <span className="text-steel">{index + 1}</span>
              <span>
                <span className="block text-[1.15rem] font-medium">{row.model}</span>
                <span className="mt-2 block h-2 bg-line">
                  <span className="block h-2 bg-steel" style={{ width: `${Math.max(0, Math.min(1, value)) * 100}%` }} />
                </span>
              </span>
              <span className="text-right">
                <span className="figure block text-[2.4rem]">{num(value)}</span>
                <span className="mt-1 block text-steel">{index === 0 ? "leader" : `gap ${num(leader - value)}`}</span>
              </span>
            </li>
          );
        })}
      </ol>
      {split === "train" && metric === "PR-AUC" && (
        <Prose>
          Training scores sit below validation for all three models. The forest is there on
          purpose: its first version memorised 1950-2019, and a validation search capped its
          depth and leaf size. Its training PR-AUC is now {num(metricAt("Random forest", "train", "PR-AUC"))},
          against {num(metricAt("Random forest", "validation", "PR-AUC"))} on validation. The rise is partly the
          higher podium rate and the near-complete qualifying record in recent seasons. We do
          not read it as the model getting better after 2019.
        </Prose>
      )}
      <Prose>
        On the untouched test set, PR-AUC is {num(metricAt("Random forest", "test", "PR-AUC"))} for the forest,{" "}
        {num(metricAt("Shallow neural network", "test", "PR-AUC"))} for the network, and{" "}
        {num(metricAt("Logistic regression", "test", "PR-AUC"))} for logistic regression, the selected model. A useless ranking
        would sit near {num(testPodium)}, the test podium rate. We selected logistic regression before looking at test, because its
        validation PR-AUC of {num(metricAt("Logistic regression", "validation", "PR-AUC"))} was ahead of{" "}
        {num(metricAt("Random forest", "validation", "PR-AUC"))} for the forest and{" "}
        {num(metricAt("Shallow neural network", "validation", "PR-AUC"))} for the network. ROC-AUC on test sits between{" "}
        {num(metricAt("Shallow neural network", "test", "ROC-AUC"))} and {num(metricAt("Random forest", "test", "ROC-AUC"))}: a true podium
        outranks a non-podium about 93 times in 100 for every model, and the models do not separate.
      </Prose>
      <Prose>
        At the frozen cutoffs, logistic regression's test precision is {num(metricAt("Logistic regression", "test", "Precision"))} and its
        recall is {num(metricAt("Logistic regression", "test", "Recall"))}. It catches most podiums and accepts more false alarms. The
        forest sits between: precision {num(metricAt("Random forest", "test", "Precision"))}, recall{" "}
        {num(metricAt("Random forest", "test", "Recall"))}. The network is the most cautious, precision{" "}
        {num(metricAt("Shallow neural network", "test", "Precision"))} and recall{" "}
        {num(metricAt("Shallow neural network", "test", "Recall"))}. Test F1 ends up close, from{" "}
        {num(metricAt("Shallow neural network", "test", "F1"))} to {num(metricAt("Logistic regression", "test", "F1"))}.
      </Prose>
      <Prose>
        Are the differences real? The 68 test races were resampled to put an interval around each gap. The forest minus logistic regression is{" "}
        {gap(site.uncertainty.test[3]["test_PR-AUC"])} with an interval from {gap(site.uncertainty.test[3]["ci_low_2.5%"])} to{" "}
        {gap(site.uncertainty.test[3]["ci_high_97.5%"])}; the network minus logistic regression is{" "}
        {gap(site.uncertainty.test[4]["test_PR-AUC"])} ({gap(site.uncertainty.test[4]["ci_low_2.5%"])} to{" "}
        {gap(site.uncertainty.test[4]["ci_high_97.5%"])}). Both intervals include zero, so we treat the three as tied.
      </Prose>

      <h3 className="pt-4 text-[1.7rem]">Remove one group</h3>
      <Prose>
        The garage removes one group at a time from the logistic model already fit on training.
        Nothing is retrained on this page. Validation PR-AUC is the score.
      </Prose>
      <Prose>
        Dropping the grid costs the most. Dropping qualifying, once the grid is present,
        costs about {num(Math.abs(changeOf("without qualifying")))}. The published grid
        already contains qualifying order, plus any penalty. ROC-AUC moves only from{" "}
        {num(changeRow("all features")["validation_ROC-AUC"])} to{" "}
        {num(changeRow("without grid")["validation_ROC-AUC"])} when the grid is removed.
        The primary score notices. The secondary score barely does.
      </Prose>

      <h3 className="pt-4 text-[1.7rem]">What the selected model weighs</h3>
      <Prose>
        Logistic regression is explained directly. Each bar is the change in podium log-odds for a one-standard-deviation rise in that input,
        holding the others fixed. Grid position outweighs everything, and a pit-lane start costs more again. The weights describe what the
        fitted model relies on. They are not causal effects.
      </Prose>
      <WeightList />

      <h3 className="pt-4 text-[1.2rem] font-semibold tracking-[-0.02em]">Where the two forest explanations disagree</h3>
      <Prose>
        Both lists are the random forest on a validation sample: cross-checks, not explanations of the selected model, which is explained
        directly by its weights in the next section. Permutation shuffles one
        column and records the change in PR-AUC. SHAP averages the size of each feature's
        push. A negative permutation value means the score rose slightly when that column
        was destroyed. We do not read that as a cause.
      </Prose>
      <ExplainPick feature={picked} />
      <div className="grid gap-8 md:grid-cols-2">
        <BarList
          title="Permutation, change in PR-AUC"
          picked={picked}
          onPick={setPicked}
          rows={site.permutation.map((row) => ({ id: row.feature, label: featureLabel(row.feature), value: row.importance }))}
        />
        <BarList
          title="Mean absolute SHAP"
          picked={picked}
          onPick={setPicked}
          rows={site.shapGlobal.map((row) => ({ id: row.feature, label: featureLabel(row.feature), value: row.value }))}
        />
      </div>
      <Prose>
        Both put grid position first, by a wide margin, and both put constructor form second.
        They differ below that. SHAP gives year a sizeable push, while permutation puts it at
        zero, and driver points rank higher under permutation than under SHAP. A reasonable
        reading is that year, form, and the standings overlap with each other and with the
        grid, so destroying one column alone barely moves the score. We treat the shared
        finding as the reliable one.
      </Prose>
      <Takeaway>
        Logistic regression is the selected model. On the test seasons the forest and the network sit slightly ahead of it, but neither the 39
        validation races nor the 68 test races separate the three models. Grid position is the input the weights, the ablation, and both
        forest explanations agree on.
      </Takeaway>
    </Section>
  );
}

function score(row: MetricRow, metric: Metric): number {
  return row[metric];
}

function changeOf(variant: string): number {
  return changeRow(variant)["PR-AUC_change"];
}

function changeRow(variant: string) {
  return site.ablation.find((row) => row.variant === variant) ?? site.ablation[0];
}

function ScoreTower() {
  const models = ["Logistic regression", "Random forest", "Shallow neural network"];
  const splits = [
    { id: "train", label: "Train" },
    { id: "validation", label: "Validation" },
    { id: "test", label: "Test" },
  ] as const;

  return (
    <div>
      <p className="text-steel">PR-AUC on the locked split. The red bar is the forest on the training years.</p>
      <div className="mt-4 grid gap-8 md:grid-cols-3">
      {models.map((model) => (
        <div key={model}>
          <p className="font-medium">{model}</p>
          <ul className="mt-3 space-y-3">
            {splits.map((item) => {
              const value = metricAt(model, item.id, "PR-AUC");
              return (
                <li key={item.id}>
                  <span className="flex items-baseline justify-between gap-3">
                    <span className="text-steel">{item.label}</span>
                    <span className="figure text-[1.45rem]">{num(value)}</span>
                  </span>
                  <span className="mt-1 block h-1.5 bg-line">
                    <span className={`block h-1.5 ${model === "Random forest" && item.id === "train" ? "bg-signal" : "bg-steel"}`} style={{ width: `${value * 100}%` }} />
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
      </div>
    </div>
  );
}

function WeightList() {
  const rows = site.logistic.weights;
  const max = Math.max(...rows.map((row) => Math.abs(row.coefficient)));
  return (
    <ul className="max-w-[44rem] space-y-1">
      {rows.map((row) => (
        <li key={row.feature} className="grid grid-cols-[11rem_1fr_3.6rem] items-center gap-3 sm:grid-cols-[16rem_1fr_3.6rem]">
          <span className="truncate text-[0.98rem]">{featureLabel(row.feature)}</span>
          <span className="relative block h-3 bg-line">
            <span className="absolute inset-y-0 left-1/2 w-px bg-steel" />
            <span
              className={`absolute inset-y-0 ${row.coefficient < 0 ? "bg-signal" : "bg-ink"}`}
              style={{
                width: `${(Math.abs(row.coefficient) / max) * 50}%`,
                left: row.coefficient >= 0 ? "50%" : undefined,
                right: row.coefficient < 0 ? "50%" : undefined,
              }}
            />
          </span>
          <span className="figure text-right text-[1.2rem]">{gap(row.coefficient, 2)}</span>
        </li>
      ))}
    </ul>
  );
}

function ExplainPick({ feature }: { feature: string }) {
  const perm = site.permutation.find((row) => row.feature === feature);
  const shap = site.shapGlobal.find((row) => row.feature === feature);
  return (
    <p className="max-w-[68ch]">
      <span className="font-medium">{featureLabel(feature)}. </span>
      {perm ? `Permutation ${perm.importance.toFixed(3)}. ` : "Not in the published permutation list. "}
      {shap ? `Mean absolute SHAP ${shap.value.toFixed(3)}.` : "Not in the published SHAP list."}
    </p>
  );
}

function BarList({
  title,
  rows,
  picked,
  onPick,
}: {
  title: string;
  rows: { id: string; label: string; value: number }[];
  picked: string;
  onPick: (id: string) => void;
}) {
  const max = Math.max(...rows.map((row) => Math.abs(row.value)), 0.001);
  return (
    <div>
      <p className="text-[1.05rem] text-steel">{title}</p>
      <ul className="mt-4 space-y-1">
        {rows.map((row) => {
          const on = row.id === picked;
          return (
            <li key={row.id}>
              <button
                type="button"
                aria-pressed={on}
                onClick={() => {
                  haptic("select");
                  onPick(row.id);
                }}
                className={`w-full cursor-pointer px-2 py-2 text-left ${on ? "bg-signal text-ink" : "hover:bg-line"}`}
              >
                <span className="flex items-baseline justify-between gap-4">
                  <span>{row.label}</span>
                  <span className="figure text-[1.45rem]">{row.value.toFixed(3)}</span>
                </span>
                <span className={`mt-1 block h-1.5 ${on ? "bg-tower" : "bg-line"}`}>
                  <span
                    className={`block h-1.5 ${on ? "bg-ink" : row.value < 0 ? "bg-signal" : "bg-steel"}`}
                    style={{ width: `${(Math.abs(row.value) / max) * 100}%` }}
                  />
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
