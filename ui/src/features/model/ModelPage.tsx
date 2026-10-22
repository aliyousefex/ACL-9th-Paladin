import { useMemo, useState } from "react";
import { Panel } from "../../components/Panel";
import { Note, Tabs } from "../../components/Bits";
import { ProvenanceLegend } from "../../components/Provenance";
import { PORTRAITS, DRIVERS } from "../../lib/data";
import { FEATURE_GROUP, featureLabel, pct } from "../../lib/format";
import { useScrollSpy, useTitle } from "../../lib/hooks";
import { COEFFICIENTS, INTERCEPT, THRESHOLD } from "../../lib/model";
import { href } from "../../lib/router";
import model from "../../data/model.json";
import site from "../../data/site.json";

const SPY = ["glance", "inputs", "compare", "races", "score", "limits", "sources"];
const MODELS = ["Logistic regression", "Random forest", "Shallow neural network"] as const;

function metric(modelName: string, split: string, key: string): number {
  const row = model.metrics.find((m) => m.model === modelName && m.split === split) as Record<string, number | string> | undefined;
  return row ? Number(row[key]) : 0;
}

export function ModelPage() {
  useTitle("The model");
  const active = useScrollSpy(SPY, 160);
  const test = (k: string) => metric(model.name, "test", k);

  return (
    <div className="page-in">
      <header className="border-b border-line pt-[calc(var(--nav-h)+2rem)] pb-10">
        <div className="mx-auto max-w-[1320px] px-4 sm:px-6 lg:px-10">
          <p className="eyebrow">The model</p>
          <h1 className="display mt-3 max-w-[16ch] text-[3rem] sm:text-[5rem]">What it knows, how it did, and where it fails</h1>
          <p className="mt-5 max-w-[70ch] text-[1.1rem] leading-relaxed text-steel">
            Paladin is an academic machine-learning project. Its claim is narrow: using only information available after qualifying, a model can
            rank who is likely to finish in the top three. This page holds every number behind that claim, including the ones that
            do not flatter it.
          </p>
          <div className="mt-8 max-w-[900px]">
            <ProvenanceLegend />
          </div>
        </div>
      </header>

      <nav aria-label="On this page" className="sticky z-40 border-b border-line bg-tower/95 backdrop-blur-sm" style={{ top: "var(--nav-h)" }}>
        <ul className="no-scrollbar mx-auto flex max-w-[1320px] items-center gap-1 overflow-x-auto px-4 sm:px-6 lg:px-10">
          {[
            ["glance", "At a glance"],
            ["inputs", "Inputs"],
            ["compare", "Three models"],
            ["races", "Race by race"],
            ["score", "Reading a score"],
            ["limits", "Limits"],
            ["sources", "Sources"],
          ].map(([id, label]) => (
            <li key={id} className="shrink-0">
              <a
                href={`#${id}`}
                onClick={(event) => {
                  event.preventDefault();
                  document.getElementById(id)?.scrollIntoView({ behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
                }}
                aria-current={active === id ? "true" : undefined}
                className={`relative block px-3 py-3 font-display text-[0.98rem] leading-none font-semibold tracking-[0.1em] uppercase no-underline transition-colors ${active === id ? "text-ink" : "text-mute hover:text-ink"}`}
              >
                {label}
                <span aria-hidden className={`absolute inset-x-3 bottom-0 h-[2px] bg-signal ${active === id ? "opacity-100" : "opacity-0"}`} />
              </a>
            </li>
          ))}
        </ul>
      </nav>

      <div className="mx-auto max-w-[1320px] space-y-6 px-4 pt-8 sm:px-6 lg:px-10">
        <Panel id="glance" eyebrow="At a glance" title="One question, one model" tag="model">
          <div className="grid gap-8 lg:grid-cols-[1.1fr_1fr]">
            <div className="space-y-4 text-[1.05rem] leading-relaxed text-steel">
              <p>
                <span className="font-semibold text-ink">The question.</span> Will this driver finish in the top three of this race? One row
                is one driver in one race, and the label is 1 when the finishing position is 3 or better. The podium rate is{" "}
                {pct(site.podiumRate)} overall and {pct(site.splits[2].podiumRate)} in the test seasons.
              </p>
              <p>
                <span className="font-semibold text-ink">The cutoff.</span> Every input is known after qualifying and before the start. Nothing from
                the race itself, such as laps, pit stops, status or points scored, is ever an input.
              </p>
              <p>
                <span className="font-semibold text-ink">The model.</span> A logistic regression was selected because it had the best validation PR-AUC (
                {metric("Logistic regression", "validation", "PR-AUC").toFixed(3)}, against {metric("Random forest", "validation", "PR-AUC").toFixed(3)} for the forest
                and {metric("Shallow neural network", "validation", "PR-AUC").toFixed(3)} for the network) and has no random seed to be lucky with. Its podium cutoff of{" "}
                {THRESHOLD.toFixed(3)} was chosen on the same validation seasons and then frozen.
              </p>
            </div>
            <dl className="grid grid-cols-2 gap-x-6 gap-y-6 content-start">
              <Fact label="Rows after cleaning" value={site.diagnostics.clean_rows.toLocaleString("en-GB")} note={`from ${site.diagnostics.raw_result_rows.toLocaleString("en-GB")} raw results`} />
              <Fact label="Inputs" value="16" note="in five groups" />
              <Fact label="Trained on" value="1950–2019" note={`${site.splits[0].races.toLocaleString("en-GB")} races`} />
              <Fact label="Selected on" value="2020–2021" note={`${site.splits[1].races} races`} />
              <Fact label="Scored once on" value="2022–2024" note={`${site.splits[2].races} races, never seen`} />
              <Fact label="Test PR-AUC" value={test("PR-AUC").toFixed(3)} note="a no-skill ranking scores 0.150" />
              <Fact label="Test ROC-AUC" value={test("ROC-AUC").toFixed(3)} note="0.500 is a coin flip" />
              <Fact label="At the cutoff" value={`${test("Precision").toFixed(2)} / ${test("Recall").toFixed(2)}`} note="precision / recall on test" />
            </dl>
          </div>
        </Panel>

        <Weights />
        <Comparison />
        <RaceLevel />
        <Reading />
        <Limits />
        <Sources />
      </div>
    </div>
  );
}

function Fact({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div>
      <dt className="label !text-[0.74rem]">{label}</dt>
      <dd className="figure mt-1 text-[2.2rem]">{value}</dd>
      {note && <dd className="mt-0.5 text-[0.82rem] leading-tight text-mute">{note}</dd>}
    </div>
  );
}

/* ------------------------------------------------------------------ inputs and weights */

function Weights() {
  const rows = [...COEFFICIENTS].sort((a, b) => Math.abs(b.weight) - Math.abs(a.weight));
  const max = Math.max(...rows.map((r) => Math.abs(r.weight)));
  return (
    <Panel id="inputs" eyebrow="Inputs" title="What the logistic regression learned" tag="model">
      <p className="max-w-[78ch] text-[1.02rem] leading-snug text-steel">
        Sixteen inputs in five groups. Each bar is the change in the podium log-odds for a one-standard-deviation rise in that input (per training
        standard deviation), holding the others fixed. Starting position dominates: moving back the grid costs far more than any other
        change, and a pit-lane start costs more again.
      </p>
      <ul className="mt-6 space-y-1.5" aria-label="Standardised coefficients">
        {rows.map((r) => (
          <li key={r.feature} className="grid grid-cols-[minmax(0,10rem)_1fr_3.6rem] items-center gap-3 sm:grid-cols-[15rem_1fr_3.6rem]">
            <div className="min-w-0">
              <p className="truncate text-[0.95rem] leading-tight text-ink">{featureLabel(r.feature)}</p>
              <p className="label !text-[0.66rem]">{FEATURE_GROUP[r.feature]}</p>
            </div>
            <div className="relative h-4 bg-tower">
              <span className="absolute inset-y-0 left-1/2 w-px bg-line2" aria-hidden />
              <span
                className="absolute inset-y-[3px]"
                style={{
                  width: `${(Math.abs(r.weight) / max) * 50}%`,
                  left: r.weight >= 0 ? "50%" : undefined,
                  right: r.weight < 0 ? "50%" : undefined,
                  background: r.weight >= 0 ? "var(--color-hit)" : "var(--color-signal)",
                }}
              />
            </div>
            <span className="text-right font-display text-[1.05rem] font-semibold tabular-nums">{r.weight > 0 ? "+" : "−"}{Math.abs(r.weight).toFixed(2)}</span>
          </li>
        ))}
      </ul>
      <div className="mt-6 grid gap-4 md:grid-cols-2">
        <Note>
          Intercept {INTERCEPT.toFixed(3)}. Green raises the podium score, red lowers it. These weights are associations in 70 seasons of
          history, not causal effects. The sign of year in particular is not meaningful on its own: it absorbs how the other inputs change meaning
          across eras, and it is not a reason a recent season hurts a driver.
        </Note>
        <Note>
          Remove a whole group and refit (validation PR-AUC from {site.ablation[0]["validation_PR-AUC"].toFixed(3)} with all inputs): the grid costs{" "}
          {Math.abs(site.ablation[1]["PR-AUC_change"]).toFixed(3)}, standings {Math.abs(site.ablation[4]["PR-AUC_change"]).toFixed(3)}, form{" "}
          {Math.abs(site.ablation[3]["PR-AUC_change"]).toFixed(3)}, qualifying {Math.abs(site.ablation[2]["PR-AUC_change"]).toFixed(3)}, context{" "}
          {Math.abs(site.ablation[5]["PR-AUC_change"]).toFixed(3)}.
        </Note>
      </div>
    </Panel>
  );
}

/* ------------------------------------------------------------------ three models */

function Comparison() {
  const [split, setSplit] = useState<"test" | "validation" | "train">("test");
  const ci = model.testUncertainty;
  const labels: Record<string, string> = { test: "Test 2022–24", validation: "Validation 2020–21", train: "Training to 2019" };
  const keys = ["PR-AUC", "ROC-AUC", "F1", "Precision", "Recall"] as const;
  return (
    <Panel
      id="compare"
      eyebrow="Three models, one split"
      title="They are tied"
      tag="model"
      actions={
        <Tabs<string>
          value={split}
          onChange={(v) => setSplit(v as typeof split)}
          idPrefix="cmp-split"
          label="Split"
          size="sm"
          options={(["test", "validation", "train"] as const).map((s) => ({ id: s, label: labels[s] }))}
        />
      }
    >
      <div className="overflow-x-auto" role="region" aria-label="Metrics by model, scrolls sideways on narrow screens" tabIndex={0}>
        <table className="w-full min-w-[620px] border-collapse text-left">
          <caption className="sr-only">Metrics by model for the {labels[split]} split</caption>
          <thead>
            <tr className="border-b border-ink text-[0.85rem] text-steel">
              <th className="py-2 pr-4 font-semibold">Model</th>
              {keys.map((k) => (
                <th key={k} className="py-2 pr-4 text-right font-semibold">{k}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {MODELS.map((name) => (
              <tr key={name} className="border-b border-line">
                <th scope="row" className="py-3 pr-4 text-[1rem] font-semibold">
                  {name}
                  {name === model.name && <span className="ml-2 bg-signal px-1.5 py-0.5 align-middle font-display text-[0.7rem] font-bold tracking-wide text-white uppercase">selected</span>}
                </th>
                {keys.map((k) => {
                  const best = Math.max(...MODELS.map((m) => metric(m, split, k)));
                  const v = metric(name, split, k);
                  return (
                    <td key={k} className={`py-3 pr-4 text-right font-display text-[1.5rem] font-semibold tabular-nums ${v === best ? "text-ink" : "text-steel"}`}>
                      {v.toFixed(3)}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h3 className="display mt-8 text-[1.5rem]">How sure are we that one is better?</h3>
      <p className="mt-2 max-w-[78ch] text-[1rem] leading-snug text-steel">
        The 68 test races were resampled with replacement to put an interval around each score. The forest and the network sit slightly above
        logistic regression on test, but the interval of each difference includes zero, and the validation intervals do too. We therefore treat the three as tied
        in ranking quality and keep the simplest, most readable model.
      </p>
      <ul className="mt-5 space-y-3">
        {ci.slice(0, 3).map((row) => {
          const lo = Number(row["ci_low_2.5%"]);
          const hi = Number(row["ci_high_97.5%"]);
          const v = Number(row["test_PR-AUC"]);
          const min = 0.55;
          const maxv = 0.85;
          const pos = (x: number) => `${((x - min) / (maxv - min)) * 100}%`;
          return (
            <li key={row.comparison} className="grid grid-cols-[minmax(0,9rem)_1fr_3.6rem] items-center gap-3 sm:grid-cols-[13rem_1fr_3.6rem]">
              <span className="text-[0.95rem]">{row.comparison}</span>
              <span className="relative block h-5 bg-tower" role="img" aria-label={`${row.comparison}: PR-AUC ${v.toFixed(3)}, interval ${lo.toFixed(3)} to ${hi.toFixed(3)}`}>
                <span className="absolute top-1/2 h-px -translate-y-1/2 bg-steel" style={{ left: pos(lo), width: `calc(${pos(hi)} - ${pos(lo)})` }} />
                <span className="absolute inset-y-1 w-px bg-steel" style={{ left: pos(lo) }} />
                <span className="absolute inset-y-1 w-px bg-steel" style={{ left: pos(hi) }} />
                <span className="absolute top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 bg-signal" style={{ left: pos(v) }} />
              </span>
              <span className="text-right font-display text-[1.1rem] font-semibold tabular-nums">{v.toFixed(3)}</span>
            </li>
          );
        })}
      </ul>
      <p className="mt-2 text-[0.82rem] text-mute">Test PR-AUC with a 95% interval over races, from {Number(ci[0]["ci_low_2.5%"]).toFixed(2)} to {Number(ci[1]["ci_high_97.5%"]).toFixed(2)}. Axis runs 0.55 to 0.85; a no-skill ranking would sit at 0.150, off the left edge.</p>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {ci.slice(3).map((row) => (
          <p key={row.comparison} className="border border-line bg-tower px-4 py-3 text-[0.95rem] text-steel">
            <span className="text-ink">{row.comparison}:</span>{" "}
            <span className="font-display text-[1.2rem] font-semibold tabular-nums">{Number(row["test_PR-AUC"]) >= 0 ? "+" : "−"}{Math.abs(Number(row["test_PR-AUC"])).toFixed(3)}</span>
            , interval {Number(row["ci_low_2.5%"]).toFixed(3)} to {Number(row["ci_high_97.5%"]).toFixed(3)} (includes zero)
          </p>
        ))}
      </div>
      <div className="mt-6">
        <Note>
          Per-race scores on this site come from the logistic regression only. The random forest and the network are reported here at aggregate level;
          their per-driver scores are not exported to the site.
        </Note>
      </div>
    </Panel>
  );
}

/* ------------------------------------------------------------------ race level */

function RaceLevel() {
  const hits = model.raceHits;
  const max = Math.max(...Object.values(hits.model), ...Object.values(hits.grid));
  return (
    <Panel id="races" eyebrow="Race by race" title="Does it beat the starting grid?" tag={["model", "record"]}>
      <p className="max-w-[78ch] text-[1.05rem] leading-snug text-steel">
        The fairest question for a podium page: take the model's three highest scores in each race. How many of them really finished on the
        podium? Compare that with the laziest possible pick, the first three on the starting grid.
      </p>
      <div className="mt-6 grid gap-8 lg:grid-cols-[1.2fr_1fr]">
        <div>
          <ol className="grid grid-cols-4 gap-3" aria-label="Number of races by correct podium drivers">
            {[0, 1, 2, 3].map((k) => (
              <li key={k} className="flex flex-col items-center">
                <div className="flex h-40 w-full items-end justify-center gap-1.5">
                  <Bar value={(hits.model as Record<string, number>)[k]} max={max} colour="var(--color-signal)" label="Model" />
                  <Bar value={(hits.grid as Record<string, number>)[k]} max={max} colour="#7b8491" label="Grid" />
                </div>
                <p className="figure mt-2 text-[1.6rem]">{k}<span className="text-[0.9rem] text-mute"> / 3</span></p>
              </li>
            ))}
          </ol>
          <p className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-[0.88rem] text-steel">
            <span className="flex items-center gap-2"><span className="h-3 w-3 bg-signal" /> Model's top three</span>
            <span className="flex items-center gap-2"><span className="h-3 w-3 bg-[#7b8491]" /> First three on the grid</span>
            <span className="text-mute">Number of races (of {hits.races}) by correct podium drivers.</span>
          </p>
        </div>
        <div className="space-y-4">
          <dl className="grid grid-cols-2 gap-4">
            <Fact label="Model, mean per race" value={hits.meanModel.toFixed(2)} note="of 3" />
            <Fact label="Grid pick, mean per race" value={hits.meanGrid.toFixed(2)} note="of 3" />
          </dl>
          <p className="text-[1rem] leading-snug text-steel">
            <span className="font-semibold text-ink">They are level.</span> The model's value is not a better set of three than the grid gives. What it adds is a
            score for every driver that also reflects team, form and standings (PR-AUC {metric(model.name, "test", "PR-AUC").toFixed(2)} on test against 0.15 for a no-skill ranking).
            The grid carries most of that: remove it and validation PR-AUC falls from {site.ablation[0]["validation_PR-AUC"].toFixed(3)} to {site.ablation[1]["validation_PR-AUC"].toFixed(3)}.
            This page does not claim the model ranks all twenty drivers better than the grid alone would.
          </p>
        </div>
      </div>
    </Panel>
  );
}

function Bar({ value, max, colour, label }: { value: number; max: number; colour: string; label: string }) {
  return (
    <div className="flex h-full flex-1 flex-col justify-end" title={`${label}: ${value} races`}>
      <span className="mb-1 text-center font-display text-[0.95rem] font-semibold tabular-nums">{value}</span>
      <span className="block w-full" style={{ height: `${Math.max(2, (value / max) * 100)}%`, background: colour }} />
    </div>
  );
}

/* ------------------------------------------------------------------ what a score means */

function Reading() {
  const bins = model.reliability;
  return (
    <Panel id="score" eyebrow="Reading a score" title="A score is a ranking signal, not a probability" tag={["model", "record"]}>
      <p className="max-w-[78ch] text-[1.02rem] leading-snug text-steel">
        The classes were weighted to offset how rare podiums are, which pushes scores upward. A score of 0.9 therefore does not mean a 90% chance.
        The honest reading is empirical: of all driver entries whose score fell in a band, what share finished on the podium? Bars show that
        share on the unseen test seasons; the white marker is the same band on the validation seasons. The model was evaluated for ranking and for its
        cutoff, not for calibration.
      </p>
      <div className="mt-6">
        <div className="relative flex h-56 items-end gap-2 border-b border-l border-line2 pl-1" role="img" aria-label="Share of entries that finished on the podium for each score band">
          <svg className="pointer-events-none absolute inset-0 h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden>
            <line x1="0" y1="100" x2="100" y2="0" stroke="#f4f4f2" strokeOpacity="0.35" strokeDasharray="1.5 2" vectorEffect="non-scaling-stroke" />
          </svg>
          {bins.test.map((b, i) => {
            const rate = b.n ? b.podiums / b.n : 0;
            const v = bins.validation[i];
            const vr = v.n ? v.podiums / v.n : null;
            const top = Math.max(rate, vr ?? 0);
            return (
              <div key={b.lo} className="relative h-full min-w-0 flex-1">
                <span className="absolute inset-x-0 bottom-0 bg-signal" style={{ height: `${rate * 86}%`, minHeight: 2 }} />
                {vr !== null && vr > 0 && <span className="absolute inset-x-[-2px] h-[3px] bg-ink" style={{ bottom: `calc(${vr * 86}% - 1px)` }} />}
                <span
                  className="absolute inset-x-0 text-center font-display text-[0.95rem] font-semibold tabular-nums"
                  style={{ bottom: `calc(${top * 86}% + 6px)` }}
                >
                  {Math.round(rate * 100)}%
                </span>
              </div>
            );
          })}
        </div>
        <ol className="mt-1 flex gap-2 pl-1">
          {bins.test.map((b) => (
            <li key={b.lo} className="min-w-0 flex-1 text-center">
              <span className="block font-display text-[0.95rem] text-steel">{b.lo.toFixed(1)}</span>
              <span className="block text-[0.68rem] text-mute">{b.n} rows</span>
            </li>
          ))}
        </ol>
        <p className="mt-3 text-[0.82rem] text-mute">Score band (low edge) on the horizontal axis. The dotted diagonal is what a perfectly calibrated probability would look like.</p>
      </div>
    </Panel>
  );
}

/* ------------------------------------------------------------------ limits */

function Limits() {
  const items = [
    ["It predicts podium or not, not who wins.", "The label is finishing position three or better. There is no win probability and no finishing order, so the podium steps on the race pages follow score rank and say so."],
    ["Scores are not calibrated probabilities.", "Class weights inflate scores. Use them to rank drivers within a race, and use the reading guide above to translate a band into a historical rate."],
    ["68 races is a small test.", "The intervals above show how much that matters: differences between the three models are inside the noise, and a single race tells you almost nothing."],
    ["Teams that renamed start with the wrong history.", "RB F1 Team (2024) begins with no form because it is a new constructor id, and Sauber (2024) inherits form from 2018 because its id was reused. Constructor form and standings for those cars are therefore unreliable, and so are scores that lean on them."],
    ["Seasons differ.", "Field size, reliability, regulations and the share of qualifying data changed across 70 seasons. Year is an input to absorb part of that, but it is a blunt one."],
    ["It sees only what qualifying shows.", "Weather, tyre choice, strategy, reliability and first-lap incidents are not inputs, which is why a front-row start can still miss the podium."],
    ["Explanations are associations.", "Weights and contributions describe what the fitted model relies on. They do not say what would happen if a driver started one place higher; the what-if panel is a counterfactual input, not a forecast."],
    ["The replay moves cars by interpolation.", "Lap times and end-of-lap positions are real. Where a car is inside a lap is interpolated at constant speed, so the animation illustrates the race and is not telemetry."],
  ];
  return (
    <Panel id="limits" eyebrow="Honest limits" title="Where this stops being true" tag="record">
      <ul className="grid gap-4 md:grid-cols-2">
        {items.map(([title, body]) => (
          <li key={title} className="border border-line bg-tower p-4">
            <h3 className="display text-[1.35rem] leading-tight">{title}</h3>
            <p className="mt-2 text-[0.95rem] leading-snug text-steel">{body}</p>
          </li>
        ))}
      </ul>
      <div className="mt-6 border-t border-line pt-5">
        <h3 className="display text-[1.35rem]">What would need a different model</h3>
        <ul className="mt-3 grid gap-x-8 gap-y-2 text-[0.98rem] text-steel md:grid-cols-2">
          <li>Win probability or a full finishing order: needs a ranking or position model, not a podium classifier.</li>
          <li>Predicting a race that has not happened: needs live qualifying data fed into the same pipeline.</li>
          <li>Calibrated percentages: needs a calibration step fitted on validation and checked on test.</li>
          <li>A true lap-by-lap race simulation: needs a model of pace, tyres and incidents the project does not have.</li>
        </ul>
      </div>
    </Panel>
  );
}

/* ------------------------------------------------------------------ sources */

function Sources() {
  const credits = useMemo(
    () => DRIVERS.map((d) => ({ d, c: PORTRAITS[d.ref] })).filter((x) => x.c),
    [],
  );
  const v = model.verification;
  return (
    <Panel id="sources" eyebrow="Reproducibility" title="Data, checks and credits" tag="record">
      <div className="grid gap-8 lg:grid-cols-2">
        <div className="space-y-4 text-[0.98rem] leading-snug text-steel">
          <p>
            <span className="font-semibold text-ink">Results and laps.</span> The Kaggle copy of the Ergast Formula 1 World Championship, fourteen tables
            from 1950 to 2024, left unedited. Cleaning, features, the chronological split and all three models live in <code className="text-ink">src/f1podium/pipeline.py</code> and
            are tested; the notebook and the written report are generated from the same run.
          </p>
          <p>
            <span className="font-semibold text-ink">Scores on this site.</span> The selected model's coefficients and intercept are read from the pipeline's saved
            files, and its imputer and scaler statistics are recomputed from the training rows. Before any data is written, that rebuilt model must
            reproduce the pipeline's own PR-AUC, ROC-AUC, F1, precision and recall on every split. The largest difference seen is{" "}
            <span className="font-display tabular-nums text-ink">{Math.max(v.train.maxAbsDifference, v.validation.maxAbsDifference, v.test.maxAbsDifference).toExponential(1)}</span>, which is
            floating-point noise. Your browser repeats the same arithmetic for the what-if panel.
          </p>
          <p>
            <span className="font-semibold text-ink">Circuits.</span> Outlines, corner numbers and start lines: F1 timing track maps served by the MultiViewer circuit API. Sector boundaries and DRS usage:
            OpenF1 telemetry from three fast laps. Each outline was checked against an independent MIT-licensed GeoJSON outline (shape difference at most
            about 2.5% of track size) and its length against the official figure. Official lap lengths and corner counts were checked against each circuit's Wikipedia infobox.
          </p>
          <p>
            <span className="font-semibold text-ink">Not endorsed.</span> Paladin is a university project, not affiliated with Formula 1, the FIA or any team. Team colours are styling.
          </p>
          <p>
            <a className="underline decoration-line2 underline-offset-2 hover:text-ink" href={href("/method")}>
              Read the full method walkthrough
            </a>
          </p>
        </div>
        <div>
          <details className="border border-line bg-tower p-4">
            <summary className="cursor-pointer font-display text-[1.05rem] tracking-[0.08em] uppercase hover:text-ink">Driver portrait credits ({credits.length})</summary>
            <p className="mt-3 text-[0.85rem] text-mute">Freely licensed photographs from Wikimedia Commons. A photo may be from a different season than the one shown.</p>
            <ul className="mt-3 max-h-96 space-y-1.5 overflow-y-auto pr-2 text-[0.85rem]">
              {credits.map(({ d, c }) => (
                <li key={d.id} className="flex flex-wrap items-baseline gap-x-2">
                  <span className="font-semibold text-ink">{d.name}</span>
                  <span className="text-mute">{c.author.slice(0, 50)}</span>
                  <a className="text-steel underline decoration-line2 underline-offset-2 hover:text-ink" href={c.source}>
                    {c.licence}
                  </a>
                </li>
              ))}
            </ul>
          </details>
          <p className="mt-4 text-[0.85rem] text-mute">Flags: country-flag-icons (MIT). Fonts: Barlow and Barlow Condensed from Google Fonts (SIL Open Font Licence).</p>
        </div>
      </div>
    </Panel>
  );
}
