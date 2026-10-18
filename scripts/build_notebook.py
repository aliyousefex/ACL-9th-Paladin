"""Build the fully self-contained Kaggle submission notebook.

The code cells are slices of ``src/f1podium/pipeline.py``. The commentary quotes numbers
from ``artifacts/``, so run ``scripts/run_analysis.py`` first. That way the text cannot
drift from the tables the notebook prints, and a claim that stops being true fails the
build instead of surviving as stale prose.
"""

import json
from pathlib import Path

import nbformat as nbf
import pandas as pd

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "notebooks" / "milestone_1_f1_podium_prediction.ipynb"
PIPELINE = ROOT / "src" / "f1podium" / "pipeline.py"
ART = ROOT / "artifacts"


def artifact(name: str) -> Path:
    """Path of one saved artifact, with a clear message if the analysis has not been run."""
    path = ART / name
    if not path.exists():
        raise SystemExit(f"{path} is missing. Run scripts/run_analysis.py first: the notebook text quotes artifacts.")
    return path


def load(name: str) -> pd.DataFrame:
    """Read one saved artifact table."""
    return pd.read_csv(artifact(name))


def pc(value, digits: int = 1) -> str:
    """Format a share as a percentage."""
    return f"{100 * float(value):.{digits}f}%"


def f2(value) -> str:
    """Two decimals."""
    return f"{float(value):.2f}"


def f3(value) -> str:
    """Three decimals."""
    return f"{float(value):.3f}"


def f4(value) -> str:
    """Four decimals."""
    return f"{float(value):.4f}"


def sg(value, digits: int = 3) -> str:
    """Signed decimal."""
    return f"{float(value):+.{digits}f}"


def n(value) -> str:
    """Integer with thousands separators."""
    return f"{int(round(float(value))):,}"


def ordinal(value: int) -> str:
    """1st, 2nd, 3rd, 4th, and so on."""
    suffix = "th" if 10 <= value % 100 <= 20 else {1: "st", 2: "nd", 3: "rd"}.get(value % 10, "th")
    return f"{value}{suffix}"


LR, RF, NN = "Logistic regression", "Random forest", "Shallow neural network"

summary = json.loads(artifact("summary.json").read_text(encoding="utf-8"))
diag = summary["diagnostics"]
cleaning = load("cleaning_eda.csv")
c_raw, c_shared, c_final = (cleaning.iloc[i] for i in range(3))
audit = load("non_starter_audit.csv").set_index("group")
runs = load("non_starter_experiment.csv")
split = load("split_summary.csv").set_index("split")
windows = load("split_window_experiment.csv")
unc = load("validation_uncertainty.csv")
fe = load("feature_eda.csv").set_index("feature")
eng = load("feature_engineering_effects.csv").set_index("column")
eff = load("preprocessing_effects.csv").set_index("feature")
order = load("preprocessing_order_experiments.csv")
missing = load("missing_value_experiments.csv")
tuning = load("hyperparameter_search.csv")
metrics = load("model_metrics.csv")
ablation = load("ablation_results.csv").set_index("variant")
context = load("context_feature_experiment.csv")
history = load("constructor_history_audit.csv")


def mget(model: str, which: str, col: str) -> float:
    """One cell of the model-metrics table."""
    return float(metrics[metrics.model.eq(model) & metrics.split.eq(which)][col].iloc[0])


def abl_loss(variant: str) -> float:
    """Size of the validation PR-AUC loss when one feature group is removed."""
    return abs(float(ablation.loc[variant, "PR-AUC_change"]))


def miss_change(prefix: str, model: str) -> float:
    """Validation PR-AUC change of one missing-value variant against median imputation."""
    hit = missing[missing.variant.str.startswith(prefix) & missing.model.eq(model)]
    return float(hit["PR-AUC_change_vs_used"].iloc[0])


def run_change(prefix: str, model: str) -> float:
    """Validation PR-AUC change of one non-starter variant against the used table."""
    hit = runs[runs.variant.str.startswith(prefix) & runs.model.eq(model)]
    return float(hit["PR-AUC_change_vs_used"].iloc[0])


def oget(experiment: str, order_name: str, model: str, col: str, fitted: str = "train") -> float:
    """One value of the preprocessing-order experiments."""
    hit = order[order.experiment.str.startswith(experiment) & order.order.eq(order_name)
                & order.model.eq(model) & order.preprocessing_fitted_on.str.startswith(fitted[:3])]
    return float(hit[col].iloc[0])


def tuned(model: str, which: str) -> pd.Series:
    """The initial, adopted, or top-ranked row of one model's settings search."""
    column = {"initial": "is_initial", "current": "is_current", "best": "selected"}[which]
    return tuning[tuning.model.eq(model) & tuning[column]].iloc[0]


def auc(feature: str, col: str = "auc_train") -> str:
    """One-feature AUC from the feature evidence table."""
    return f2(fe.loc[feature, col])

def ctx(variant: str, model: str, col: str = "validation_PR-AUC") -> float:
    """One value of the calendar-feature (year / round) experiment."""
    return float(context[context.variant.eq(variant) & context.model.eq(model)][col].iloc[0])

# How far one network seed can sit from its own three-seed average. The old 17-feature
# network (with `round`) is the clearest example, so it is the yardstick for single-seed changes.
SEED_GAP = abs(ctx("put round back", NN, "seed_42_PR-AUC") - ctx("put round back", NN))

nb = nbf.v4.new_notebook()
nb["metadata"] = {
    "kernelspec": {"display_name": "Python 3", "language": "python", "name": "python3"},
    "language_info": {"name": "python", "version": "3.12"},
    "kaggle": {"accelerator": "none", "dataSources": []},
}
cells = []

def md(text: str) -> None:
    """Append a stripped Markdown cell."""
    cells.append(nbf.v4.new_markdown_cell(text.strip()))

def code(text: str) -> None:
    """Append a stripped code cell."""
    cells.append(nbf.v4.new_code_cell(text.strip()))

def source_section(source: str, start: str, end: str | None = None) -> str:
    """Copy one section of pipeline.py into a notebook cell."""
    begin = source.index(start)
    finish = source.index(end, begin) if end else len(source)
    return source[begin:finish].rstrip()

source = PIPELINE.read_text(encoding="utf-8")
implementation_sections = [
    ("## 1. Imports, analytical contract, and relational schema",
     "The constants define the features, primary keys, and foreign-key relationships used throughout the analysis.",
     source_section(source, "from __future__ import annotations", "def load_raw_tables")),
    ("## 2. Loading, auditing, cleaning, and feature engineering",
     "Literal `\\N` values become missing values. Dates and qualifying durations receive semantic types. Shared-drive duplicates are resolved deterministically before leakage-safe historical features are constructed.",
     source_section(source, "def load_raw_tables", "def split_by_time")),
    ("## 3. EDA, chronological splitting, preprocessing, and models",
     "Training covers 1950-2019, validation 2020-2021, and test 2022-2024. Preprocessing is fitted on training rows only, and all three models use identical rows and features.",
     source_section(source, "def split_by_time", "MECHANICAL_TERMS =")),
    ("## 4. Data-engineering questions",
     "These functions answer the three required multi-hop relational questions and document the status and nationality mappings used by them.",
     source_section(source, "MECHANICAL_TERMS =", "def create_plots")),
    ("## 5. Visual evidence and explainability",
     "The figures cover cleaning, missingness, all analytical questions, model comparison, ablation, permutation importance, global SHAP, local LIME, and a local SHAP cross-check.",
     source_section(source, "def create_plots", "def predict_podium")),
    ("## 6. Inference and end-to-end execution",
     "The inference function accepts complete and partial records. The runner rebuilds every table, experiment, metric, explanation, and figure used below.",
     source_section(source, "def predict_podium")),
]

md("""
# Milestone 1: Formula 1 Podium Prediction Companion

This is the complete, self-contained Kaggle submission notebook. Every function used for loading, auditing, cleaning, joining, feature engineering, modeling, evaluation, experimentation, explainability, plotting, and inference appears in visible cells below. The notebook does **not** import project code from `pipeline.py`.

The prediction cutoff is after qualifying and before the race starts. The unit of analysis is one driver entering one race, and the binary target is `positionOrder <= 3`. PR-AUC is primary because podiums are rare; ROC-AUC is secondary. F1, precision, and recall are calculated at thresholds selected from validation data only.
""")

md("""
## 0. Kaggle setup

Attach the public **Formula 1 World Championship (1950-2024)** Kaggle dataset containing the 14 CSV files, then choose **Run All**. No source ZIP or repository module is needed. The raw CSV files are read only and never modified.
""")
code("""
from pathlib import Path

ROOT = Path.cwd().resolve()
if ROOT.name == "notebooks":
    ROOT = ROOT.parent

def locate_data() -> Path:
    '''Find the raw CSV directory locally or in Kaggle's attached inputs.'''
    # Use the repository data locally. On Kaggle, find the folder containing
    # results.csv instead of relying on the generated dataset path.
    local = ROOT / "data" / "raw"
    if (local / "results.csv").exists():
        return local
    kaggle_root = Path("/kaggle/input")
    matches = sorted(kaggle_root.rglob("results.csv")) if kaggle_root.exists() else []
    if not matches:
        raise FileNotFoundError("Attach the Formula 1 dataset containing results.csv.")
    return matches[0].parent

DATA = locate_data()
OUT = Path("/kaggle/working/artifacts") if Path("/kaggle/working").exists() else ROOT / "artifacts"
OUT.mkdir(parents=True, exist_ok=True)
print(f"Raw data: {DATA}")
print(f"Generated artifacts: {OUT}")
""")

for heading, explanation, implementation in implementation_sections:
    md(f"{heading}\n\n{explanation}")
    code(implementation)

md("""
## 7. Run the complete pipeline

This call rebuilds all evidence from the attached raw data. There are no hidden manual cells and no imported project implementation.
""")
code("""
from IPython.display import Image, display

results = run_analysis(DATA, OUT)
display(results["summary"])
""")

md("""
## 8. Audit, cleaning, and before/after EDA

The audit checks key uniqueness, null keys, and orphan references. The cleaning comparison quantifies the modeling grain, duplicate participation, target rate, pit-lane share, missing finishing classifications, and median grid before and after shared-drive resolution.
""")
code("""
display(results["pk_audit"])
display(results["fk_audit"])
display(results["summary"]["diagnostics"])
display(results["cleaning_eda"])
display(Image(filename=str(OUT / "figures" / "cleaning_before_after.png")))
display(Image(filename=str(OUT / "figures" / "qualifying_coverage.png")))
""")
md(f"""
Cleaning has two steps. The first fixes the grain: resolving {n(diag['duplicate_driver_race_groups'])} shared-drive groups removes {n(c_raw.rows - c_shared.rows)} rows and leaves exactly one row per `(raceId, driverId)`, without moving the target ({pc(c_raw.podium_rate, 2)} to {pc(c_shared.podium_rate, 2)}) or the median grid ({c_shared.median_grid:g}). The second step removes the {n(diag['did_not_enter_rows_removed'])} rows of drivers who did not enter the race (section 8.1). None of them is a podium, so the podium rate rises to {pc(c_final.podium_rate, 2)} by arithmetic alone, and the grid-0 share falls from {pc(c_shared.pit_lane_share)} to {pc(c_final.pit_lane_share)}. Qualifying coverage is sparse in older seasons, so we retain an explicit missingness flag and use final grid as the historically broader pre-race signal rather than discarding early history.
""")

md("""
### 8.1 Who has grid 0? Drivers who did not enter, withdrawals, and the pit-lane flag
""")
code("""
display(results["non_starters"].round(3))
display(results["non_starter_experiment"].round(4))
""")
_f, _w, _r = (audit.loc[audit.index.str.startswith(p)].iloc[0] for p in ("F:", "W:", "grid 0 but raced"))
_f_zero, _w_zero = round(_f.rows * _f.grid_zero_share), round(_w.rows * _w.grid_zero_share)
_keep, _tail, _both = ("keep F rows in the history and", "keep F rows in the history, drop", "also drop W rows")
_lr_small = max(abs(run_change(p, LR)) for p in (_keep, _tail))
_nn_small = max(abs(run_change(p, NN)) for p in (_keep, _tail))
assert _lr_small < 0.002, "keeping the F rows now moves logistic regression noticeably; rewrite 8.1"
assert _nn_small < 1.5 * SEED_GAP, "the network change is now well beyond single-seed noise; rewrite 8.1"
_fs = runs.groupby("variant").train_field_size.first()
md(f"""
**What the audit shows.** Before the `F` rows are removed, {pc(c_shared.pit_lane_share)} of rows have grid 0, and the flag name `pit_lane_start` makes them sound like pit-lane starts. They are mostly not. Of the {n(_f_zero + _w_zero + _r.rows)} grid-0 rows, {n(_f_zero)} are drivers who never raced (positionText `F`: did not qualify, did not prequalify, or failed the 107% rule), {n(_w_zero)} are withdrawals, and only {n(_r.rows)} are real pit-lane or exceptional starts. All {n(_f.rows)} `F` rows are in {int(_f.first_year)}-{int(_f.last_year)}, all are in training, and none finished on the podium. Validation and test contain no `F` rows.

**Decision: remove the `F` rows, keep everything else (instructor ruling).** The instructor ruled that `F` rows are known before the race starts and may be removed, and that withdrawals (`W`) may not, because that code is only known after the race. A driver who did not qualify did not enter the race, so the row does not belong in a table of one driver entering one race. We remove the `F` rows *before* any feature is built. A skipped weekend therefore no longer counts as a race in `driver_podium_rate_5` or `driver_races_before`, and it no longer inflates `field_size` (training mean {f2(_fs['keep F rows in the history and in training'])} with them, {f2(_fs['drop F rows before features (used)'])} without).

**Evidence that the choice is safe.** The experiment scores four variants on the same 2020-2021 validation rows. Keeping the `F` rows instead changes validation PR-AUC by {sg(run_change(_keep, LR), 4)} for logistic regression and {sg(run_change(_keep, NN), 4)} for the network. Keeping them in the history but dropping them from the training rows only changes it by {sg(run_change(_tail, LR), 4)} and {sg(run_change(_tail, NN), 4)}. Logistic regression, which has no random seed, moves by at most {f4(_lr_small)}. The network moves by up to {f4(_nn_small)}, but a single network seed can sit {f3(SEED_GAP)} away from its own three-seed average (section 10.3), so the network cannot separate these options. The choice rests on the ruling and on what a row means, not on a score. Removing the `W` rows as well, which the ruling does not allow, would change the network by {sg(run_change(_both, NN), 4)}.

**What changes.** `pit_lane_start` now marks {n(_w_zero + _r.rows)} rows: {n(_w_zero)} withdrawals with grid 0 and {n(_r.rows)} drivers who raced from the pit lane or an exceptional start. It is no longer a did-not-qualify marker, but it is still not a pure pit-lane flag.
""")

md("## 9. Answers to the three data-engineering questions")
code("""
for key, table in results["answers"].items():
    print(f"\\n{key}")
    display(table.groupby("era").head(10) if "era" in table else table)

print("Statuses counted as mechanical:")
display(results["summary"]["mechanical_statuses"])
print("Statuses excluded as non-starts:")
display(results["summary"]["non_start_statuses"])

for figure in ["front_row_conversion", "home_effect", "mechanical_retirements"]:
    display(Image(filename=str(OUT / "figures" / f"{figure}.png")))
""")
md("""
**Front-row conversion.** Rankings are separated at the 2014 hybrid-era boundary and require at least ten front-row starts per circuit-era. Final grid positions 1-2 define the front row because penalties can make qualifying order differ from the actual start.

**Home-country effect.** Home and away rates are compared inside the same grid bands. This controls the dominant starting-position pattern transparently, but the result remains descriptive rather than causal.

**Mechanical retirements.** Rates use recorded race starters as the denominator and documented component-status labels as the numerator, with at least twenty starts per constructor-era. Ambiguous status coding remains a limitation. Engine fire and engine misfire are counted as mechanical because they are engine failures; heat shield fire is not counted, following TA feedback. None of these statuses occur in 2014-2024, so this choice does not change the rates.
""")

md("## 10. Leakage-safe features")
code('display(FEATURE_GROUPS)')
md("""
Every selected feature is known after qualifying and before the start. Driver form shifts before rolling, constructor outcomes are aggregated by race before shifting, and standings attach only to the following race. Current-race position, points, status, laps, pit stops, and fastest-lap information never enter `FEATURES`.
""")


md("""
### Standings before the first race of a season

Before a driver's or team's first race of a season there are no standings yet. Earlier these cells were empty, and the median imputer filled them with about 3 points and rank 13, which invents points nobody has scored. We now set them to 0 points and rank 0 when the features are built, so the imputer no longer touches the standings columns.
""")
code("""
mt = results["modeling_table"]
cols = ["driver_points_before", "driver_rank_before", "constructor_points_before", "constructor_rank_before"]
r1 = mt[mt["round"] == 1]
print("Round-1 driver points values:", r1["driver_points_before"].unique())
print("Round-1 driver rank values:", r1["driver_rank_before"].unique())
print("Empty standings cells left (should be 0):", mt[cols].isna().sum().sum())
""")
md("""
**Result:** Every round-1 row now has 0 points and rank 0, and no standings cell is left empty. We also tested adding flags to mark these rows, since rank 0 could look better than first place. They gave no validation gain (logistic regression unchanged, forest and network lower), so no flags were added.
""")



md("""
### 10.1 Sprint races: a leakage judgement call
""")
code('display(results["sprint_check"].round(3))')
md("""
**Question.** Does the sprint create a leakage problem? A sprint is a separate short race on the same weekend, with its own result in `sprint_results`.

**Timing.** Every sprint ends one day before the main race (`sprint_ends_before_race_share` is 1.0 in every season), so a sprint result is known before the lights go out. It is not post-race information, and using it would not break the cutoff by time.

**Why we still do not use it.** First, sprints exist only from 2021, so there are 0 sprint rows in training (1950-2019). A sprint feature would be empty for every row the model learns from. Second, in 2021-2022 the sprint set the main-race grid: the rank correlation between grid and sprint finish is 0.89 and 0.99, against 0.83 and 0.72 with qualifying. The grid features already carry that information. In 2023-2024 the sprint stopped setting the grid (grid follows qualifying at 0.99 and 0.96) and adds a separate signal for only 12 weekends. We therefore exclude sprint columns from `FEATURES` by design, not because they leak.

**The real hazard.** Sprint finishing position and sprint points sit under the same `raceId` as the main race. Joining them by `raceId` would look harmless, but their meaning is a different race's result. Standings are already moved to the following race, so sprint points reach the features only through the previous round, never the current one.
""")

md("""
### 10.2 Exploratory evidence for every individual feature
""")
code("""
display(results["feature_eda"].drop(columns=["bins"]).round(3))
display(Image(filename=str(OUT / "figures" / "feature_eda.png")))
""")
_strong = ["qualifying_position", "grid_position", "driver_rank_before", "constructor_rank_before",
           "driver_podium_rate_5", "constructor_podium_rate_5", "driver_points_before",
           "constructor_points_before", "front_row", "driver_races_before"]
_weak = ["field_size", "driver_age", "qualifying_time_seconds", "pit_lane_start", "qualifying_missing"]
assert fe.loc[_strong, "same_direction_in_validation"].all(), "a strong feature changed direction on validation"
assert fe.loc[_weak, "auc_train"].between(0.4, 0.6).all(), "a 'weak' feature is no longer close to 0.5"
assert fe.loc["grid_position", "podium_rate_when_missing"] == 0, "rows without a grid position now podium"
_losses = ablation.drop(index="all features")["PR-AUC_change"].abs()
assert _losses.idxmin() == "without context", "context is no longer the smallest ablation loss"
md(f"""
The table and figure use **training seasons only**. For each of the {len(fe)} features they show the share of missing cells, the podium rate in its lowest and highest bin, and a one-feature ROC-AUC (above 0.5 means a higher value goes with more podiums, below 0.5 the reverse). The same AUC on validation checks that the pattern still holds in later seasons. Missing cells are left out of the AUC and the bins, and the orange bar in the figure shows the podium rate of the rows where the feature is missing.

**Strong single signals.** Position features carry the most: `qualifying_position` (AUC {auc('qualifying_position')}, so lower is better, measured on the {pc(1 - fe.loc['qualifying_position', 'missing_share_train'], 0)} of rows that have it) and `grid_position` ({auc('grid_position')}). The podium rate falls from {pc(fe.loc['grid_position', 'podium_rate_lowest_bin'], 0)} (grid) and {pc(fe.loc['qualifying_position', 'podium_rate_lowest_bin'], 0)} (qualifying) in the best bin to {pc(fe.loc['grid_position', 'podium_rate_highest_bin'])} and {pc(fe.loc['qualifying_position', 'podium_rate_highest_bin'])} in the worst. The standings ranks ({auc('driver_rank_before')} and {auc('constructor_rank_before')}), form rates ({auc('driver_podium_rate_5')} and {auc('constructor_podium_rate_5')}), and points ({auc('driver_points_before')} and {auc('constructor_points_before')}) are next, and `front_row` ({auc('front_row')}) and `driver_races_before` ({auc('driver_races_before')}) are clear but smaller. All of these keep the same direction on validation (for example {auc('grid_position', 'auc_validation')} for grid and {auc('driver_podium_rate_5', 'auc_validation')} and {auc('constructor_podium_rate_5', 'auc_validation')} for form).

**Weak single signals, kept for a different reason.** `field_size` ({auc('field_size')}), `driver_age` ({auc('driver_age')}), `qualifying_time_seconds` ({auc('qualifying_time_seconds')}), `pit_lane_start` ({auc('pit_lane_start')}), and `qualifying_missing` ({auc('qualifying_missing')}) are close to 0.5 on their own. The qualifying time is not comparable across circuits and eras, so a raw time says little without the rest of the row. The two flags are indicators: removing `qualifying_missing` changes validation PR-AUC only slightly (section 13.1), but the flag records which rows were imputed, and rows with no grid position (withdrawals and pit-lane starts) never podium, while rows with no qualifying record podium at about the average rate ({pc(fe.loc['qualifying_position', 'podium_rate_when_missing'])} against {pc(split.loc['train', 'podium_rate'])}). `year` ({auc('year')}) has essentially no single-feature signal, and `field_size` and `year` are flat or constant on validation (every 2020-2021 race has 20 starters). The ablation shows the whole context group adds the least of the five ({f3(abl_loss('without context'))} PR-AUC). Section 10.3 tests the two calendar features one at a time: `year` is kept and `round` was removed.

**What this evidence does and does not show.** A one-feature AUC ignores the other {len(fe) - 1} features, so a feature that looks weak here can still help in combination, and a strong feature can add little once the grid is present (the ablation shows qualifying adds only {f3(abl_loss('without qualifying'))} on top of the grid). The AUCs describe association in past races and are not causal effects.
""")


md("""
### 10.3 Calendar features: keep `year`, remove `round`
""")
code('''
context = results["context_experiment"]
display(context.round(4))
display(context.pivot_table(index="variant", columns="model", values="PR-AUC_change_vs_used", sort=False).round(4))
''')
_round = {m: ctx("put round back", m, "PR-AUC_change_vs_used") for m in (LR, RF, NN)}
_year = {m: ctx("also remove year", m, "PR-AUC_change_vs_used") for m in (LR, RF, NN)}
# The same test inside the old 17-feature model: remove year while round is still there.
_year_old = {m: ctx("round back, year removed", m) - ctx("put round back", m) for m in (LR, RF, NN)}
assert _year_old[NN] < 0 and _year_old[RF] < 0, "removing year from the old model no longer hurts the nonlinear models; rewrite 10.3"
_nn_sd = max(ctx("used (no round)", NN, "validation_PR-AUC_std"), ctx("put round back", NN, "validation_PR-AUC_std"))
_avg_noise = _nn_sd / 3 ** 0.5  # a three-seed average is steadier than one seed
assert max(abs(v) for v in _round.values()) < 0.005, "putting round back now changes a model noticeably; rewrite 10.3"
assert _year[NN] < -1.5 * _avg_noise and _year[NN] == min(_year.values()), "removing year no longer clearly hurts the network; rewrite 10.3"
md(f"""
**Question.** `year` and `round` were added as context: the era and the point in the season. On their own neither separates podiums from the rest (single-feature AUC {auc('year')} for `year`, and about 0.50 for `round` in the earlier run), so we tested each one inside the full models. Every variant is trained on 1950-2019 and scored on 2020-2021 only. The network is averaged over three seeds, the same as the settings search in section 14.1.

**`round` adds nothing, so we removed it.** Putting `round` back changes validation PR-AUC by {sg(_round[LR], 4)} for logistic regression, which has no random seed, by {sg(_round[RF], 4)} for the forest, and by {sg(_round[NN], 4)} for the network, far inside the noise of a three-seed average (about {f3(_avg_noise)}). None of these comes close to a real effect such as removing `year` ({sg(_year[NN], 4)} for the network), and they do not even agree in direction. The information is also already in the standings: points and rank build up race by race, so they tell the model how far into the season it is. Finally, `round` does not mean the same thing across eras. A season had about 8 races in the 1950s and 24 in 2024, so round 8 was a season finale then and an early race now. With no measurable gain and an unstable meaning, the simpler model wins.

**`year` helps, so we kept it.** Removing `year` changes the score by {sg(_year[LR], 4)} for logistic regression, {sg(_year[RF], 4)} for the forest and {sg(_year[NN], 4)} for the network. The network loses the most of the three models, about {abs(_year[NN]) / _avg_noise:.0f} times the noise of a three-seed average (about {f3(_avg_noise)}, the seed spread divided by the square root of 3). On its own `year` says nothing, but together with grid and form it lets the nonlinear models adjust for the era: larger fields, worse reliability, and missing qualifying in the older seasons. The same test inside the old 17-feature model, with `round` still there, gives {sg(_year_old[LR], 4)}, {sg(_year_old[RF], 4)} and {sg(_year_old[NN], 4)}, so `year` helps the nonlinear models with or without `round`. That old model without `year` is also unstable: its network seed spread is {f3(ctx('round back, year removed', NN, 'validation_PR-AUC_std'))}. One caveat: the test seasons (2022-2024) lie outside the training years (1950-2019), so the models must extrapolate `year`. A tree cannot extrapolate, so the forest treats 2022 like 2019.

**Why one seed is not enough.** The main results table trains each model once, with seed 42. With `round`, the network's seed-42 score was {f4(ctx('put round back', NN, 'seed_42_PR-AUC'))}, {f3(SEED_GAP)} above its own three-seed average of {f4(ctx('put round back', NN))}. Without `round`, seed 42 scores {f4(ctx('used (no round)', NN, 'seed_42_PR-AUC'))} and the average is {f4(ctx('used (no round)', NN))}. The average barely moved, but the single seed fell, and that alone changes which model looks best in section 14. This is why we read single-seed network differences of about {f3(SEED_GAP)} as noise throughout the notebook.
""")

md("""
### 10.4 Team renames and reused constructor ids
""")
code('display(results["constructor_history"])')
_late = history[history.split.ne("train")]
_n_val, _n_test = (int(_late[_late.split.eq(s)].rows_in_first_5_races.sum()) for s in ("validation", "test"))
_form_fill = float(eff.loc["constructor_podium_rate_5", "fill_value"])
assert (_late.podiums == 0).all() and (_late.max_constructor_form.fillna(0) == 0).all(), \
    "an affected validation or test row now has a podium or a non-zero constructor form; rewrite 10.4"
assert _form_fill == 0, "the training median of constructor form is no longer 0; rewrite 10.4"
_named = {("AlphaTauri", 2020), ("Alpine F1 Team", 2021), ("RB F1 Team", 2024), ("Aston Martin", 2021), ("Sauber", 2024)}
assert _named <= set(zip(history.constructor_name, history.year)), "a team named in the 10.4 text is no longer in the table"
md(f"""
**What happens.** Constructor form (`constructor_podium_rate_5`, the team's podium rate over its last five races) is computed per `constructorId`. When a team is renamed, the dataset usually gives it a new id, so its form starts empty: Toro Rosso became AlphaTauri in 2020, Renault became Alpine in 2021, and AlphaTauri became RB in 2024. The opposite also happens. Some old ids are used again years later, so a team inherits an earlier history: Aston Martin in 2021 reuses the id of the unrelated 1959-1960 Aston Martin, and Sauber in 2024 continues the Sauber id last used in 2018 (the same team, which raced as Alfa Romeo in between). The table lists every such team-season since 2014.

**How much it matters.** Only constructor form is affected. Standings restart every season, so a rename never carries over into them, and driver form follows the driver from team to team. Because the form window is five races, only the first five races of each listed season are touched: {_n_val} of {n(split.loc['validation', 'rows'])} validation rows and {_n_test} of {n(split.loc['test', 'rows'])} test rows. None of these rows is a podium, and their constructor form is 0 or empty. An empty value is filled with the training median, which is {_form_fill:g}, so a reset team and a team with no recent podiums look the same to the model.

**Decision.** We keep the ids as they are in the data and document the reset. Linking renamed teams would need a judgement for every case: Toro Rosso to AlphaTauri was a rebrand of the same team, but Force India to Racing Point followed a sale out of administration, and a merged history would also join eras with different owners, budgets and engines. With {_n_val + _n_test} affected validation and test rows, no podiums among them, and a feature that is already 0 for them, a hand-made mapping would add assumptions for very little effect on the evaluation. The reset stays listed as a limitation in section 18.
""")


md("## 11. Proper train / validation / test split")
code("""
display(results["split_summary"])
display(results["split_integrity"])
display(Image(filename=str(OUT / "figures" / "chronological_split.png")))
display(results["split_strategies"])
""")
md("""
**Choice.** Training is 1950-2019, validation 2020-2021, and the unseen test set 2022-2024. The split is by season, so every race belongs to exactly one split and every training race happens before every validation race, which happens before every test race (all integrity checks pass). This matches deployment: on race morning the model only knows earlier seasons.

**Roles.** Training fits the imputer, scaler, and model weights. Validation is used for every decision: preprocessing variant and order, feature-group ablation, model choice, and the probability threshold. The test seasons are scored once, after those choices are frozen.

**Why not random.** The strategy experiment holds out the same number of rows three ways. A random-row split puts the teammates and rivals from the same race in training for almost every held-out row, and nearly all held-out rows have later seasons in training. That would let the model learn from the future and from the same race. A random-race split removes same-race leakage but still trains on later seasons. Random splits also mix every era into the held-out set, so their score answers a different question from "how well do we predict the next seasons?". Only the chronological split has zero same-race and zero future leakage.

**Shift between splits.** Training has far more missing qualifying and larger fields, so its podium rate is lower. That shift is real and is the reason for a separate recent validation period rather than validating on old seasons.
""")

md("""
### 11.1 Is 2019 the right boundary? Other validation windows and uncertainty
""")
code("""
display(results["split_windows"].round(4))
display(results["validation_uncertainty"].round(4))
""")
_lr_w, _nn_w = windows["Logistic regression PR-AUC"], windows["Shallow neural network PR-AUC"]
_used = windows.validation_window.str.contains("used")
_lr_rank = int(_lr_w.rank(ascending=False)[_used].iloc[0])
_nn_rank = int(_nn_w.rank(ascending=False)[_used].iloc[0])
assert mget(LR, "test", "PR-AUC") < mget(LR, "validation", "PR-AUC") and mget(NN, "test", "PR-AUC") < mget(NN, "validation", "PR-AUC")
_ci = unc.set_index("comparison")
_rf_d, _nn_d = _ci.loc[f"{RF} minus {LR}"], _ci.loc[f"{NN} minus {LR}"]
assert all(r["ci_low_2.5%"] <= 0 <= r["ci_high_97.5%"] for r in (_rf_d, _nn_d)), "a model-minus-baseline interval excludes zero"
_lr_ci = _ci.loc[LR]
_width = float((unc.iloc[:3]["ci_high_97.5%"] - unc.iloc[:3]["ci_low_2.5%"]).mean())
md(f"""
The first table keeps the same two models and scores four validation windows, each training on all earlier seasons and each ending before the test seasons, so the test set is never used. The score depends on the window: logistic regression ranges from {f3(_lr_w.min())} to {f3(_lr_w.max())} PR-AUC and the network from {f3(_nn_w.min())} to {f3(_nn_w.max())}. The 2020-2021 window we use ranks {ordinal(_lr_rank)} of {len(windows)} for logistic regression and {ordinal(_nn_rank)} of {len(windows)} for the network. The score moves by a few hundredths depending on which two seasons are held out, so a validation score should not be read as the expected test score. The test seasons, which were never used for a decision, score lower for both models ({f3(mget(LR, 'test', 'PR-AUC'))} and {f3(mget(NN, 'test', 'PR-AUC'))}).

The second table bootstraps whole validation races. With only {int(unc.races.iloc[0])} races, each model's PR-AUC has a 95% interval about {_width:.1f} wide (for example {f2(_lr_ci['ci_low_2.5%'])}-{f2(_lr_ci['ci_high_97.5%'])} for logistic regression). The difference between the network and logistic regression is {sg(_nn_d['validation_PR-AUC'])} with an interval of {sg(_nn_d['ci_low_2.5%'])} to {sg(_nn_d['ci_high_97.5%'])}, and for the forest it is {sg(_rf_d['validation_PR-AUC'])} with an interval of {sg(_rf_d['ci_low_2.5%'])} to {sg(_rf_d['ci_high_97.5%'])}. Both intervals include zero, so the data do not show that any model is better than the baseline. We keep the chronological split because it is the only one with no same-race or future leakage, but we report the model ranking as a tie within validation uncertainty.
""")

md("""
## 12. Effect of feature engineering and preprocessing on distributions, ranges, and values

### 12.1 Feature-engineering steps
""")
code('display(results["feature_engineering_effects"])')
md(f"""
The table compares each raw source column with the feature built from it (all 1950-2024 rows of the modeling table). Raw `grid` still contains {pc(eng.loc['grid (raw)', 'zero_share'])} zeros (withdrawals and pit-lane or exceptional starts), which would sit numerically *ahead* of pole. In `grid_position` those zeros become missing, the minimum becomes 1, and the information moves to the binary `pit_lane_start` flag. Qualifying strings such as `1:23.456` become numeric seconds; the left join to every driver-race row then exposes the missing qualifying history of older seasons ({pc(eng.loc['qualifying_time_seconds (joined)', 'missing_share'], 0)} of rows have no qualifying time). Shifted form is missing on a driver's first race, because no earlier result exists, and the imputer fills that gap in the next step. Previous-race standings have no earlier value before a driver's or team's first race of a season, but nothing has been scored yet, so they are set to 0 rather than imputed.

### 12.2 Imputation and scaling
""")
code("""
effects = results["preprocessing_effects"]
display(effects[["feature", "missing_share", "fill_value", "raw_min", "raw_max", "raw_mean", "raw_std",
                 "imputed_std", "std_change_from_imputation", "scaled_min", "scaled_max",
                 "scaled_mean", "scaled_std", "validation_scaled_mean", "test_scaled_mean"]].round(3))
display(Image(filename=str(OUT / "figures" / "preprocessing_distributions.png")))
display(Image(filename=str(OUT / "figures" / "preprocessing_ranges.png")))
""")
_partial = eff[(eff.missing_share > 0) & (eff.missing_share < 0.5)]
_points = ["driver_points_before", "constructor_points_before"]
md(f"""
**Median imputation** writes the training median into every missing cell. Qualifying position and time are missing in {pc(eff.loc['qualifying_position', 'missing_share'], 0)} of training rows, so they get a tall spike at the median and their standard deviation falls by about {pc(-eff.loc['qualifying_position', 'std_change_from_imputation'], 0)}. The other features with gaps (grid position and form) lose between {pc(-_partial.std_change_from_imputation.max(), 0)} and {pc(-_partial.std_change_from_imputation.min(), 0)}. Ranges do not change, because the median is inside the observed range. The `qualifying_missing` flag keeps the information that a value was filled.

**Standardization** moves every training feature to mean 0 and standard deviation 1. Raw ranges differ by orders of magnitude (`constructor_points_before` spans 0-{n(eff.loc['constructor_points_before', 'raw_max'])}, the flags 0-1). After scaling they share one scale, so neither logistic regression's penalty nor the MLP's gradient steps are dominated by large-unit features. Scaling is linear, so the shape of each distribution and the order of values are unchanged. Long right tails stay long: one recorded qualifying time of {eff.loc['qualifying_time_seconds', 'raw_max']:.1f} s lands about {eff.loc['qualifying_time_seconds', 'scaled_max']:.0f} standard deviations out, and the points features reach about {eff.loc[_points, 'scaled_max'].max():.0f}.

**Fitted on training only.** Validation and test pass through the training-fitted transform, so their means are *not* zero. `year` sits about {eff.loc['year', 'validation_scaled_mean']:+.1f} standard deviations from the training mean, prior points about {eff.loc['driver_points_before', 'validation_scaled_mean']:+.1f}, `field_size` about {eff.loc['field_size', 'validation_scaled_mean']:+.1f} (smaller modern grids), and `qualifying_missing` about {eff.loc['qualifying_missing', 'validation_scaled_mean']:+.1f} (qualifying is almost always recorded now). This is the honest view of period shift, and it is what the model sees at deployment.
""")

md("## 13. Preprocessing experiments: strategy and order")
code("""
display(results["preprocessing"])
order = results["preprocessing_order"]
display(order.round(4))
display(order.pivot_table(index=["experiment", "order", "preprocessing_fitted_on"], columns="model",
                          values="validation_PR-AUC").round(4))
""")
md(f"""
The first table compares preprocessing **strategies** (median with and without scaling, zero with scaling). The second reports three preprocessing-**order** experiments, each scored on validation with logistic regression and the shallow neural network:

- **A: impute → scale vs scale → impute.** Median imputation commutes with a linear rescale, so the missing value maps to the same raw median either way. The difference is the scaler's statistics: scaling first computes mean and spread from observed values only, so after imputation qualifying time has a training standard deviation of {f2(oget('A', 'scale -> impute', NN, 'train_std_qualifying_time'))} instead of 1. Logistic regression moves by {sg(oget('A', 'scale -> impute', LR, 'PR-AUC_change_vs_reference'), 4)}; the MLP, which depends on input scale, moves by {sg(oget('A', 'scale -> impute', NN, 'PR-AUC_change_vs_reference'))} validation PR-AUC.
- **B: zero-fill → scale vs scale → zero-fill.** Here the order changes the value. Filling zero *before* scaling writes a literal 0, which means "grid 0, ahead of pole" and "a 0-second qualifying lap". Filling zero *after* scaling writes the training mean (grid ≈ {oget('B', 'scale -> zero-fill', LR, 'missing_grid_position_becomes'):.1f}, qualifying ≈ {oget('B', 'scale -> zero-fill', LR, 'missing_qualifying_time_becomes'):.1f} s). The `missing_..._becomes` columns show the fill in original units. Moving from the impossible raw zeros to the training mean changes the MLP by {sg(oget('B', 'scale -> zero-fill', NN, 'PR-AUC_change_vs_reference'))} PR-AUC and logistic regression by {sg(oget('B', 'scale -> zero-fill', LR, 'PR-AUC_change_vs_reference'), 4)}.
- **C: preprocess before vs after the split.** Fitting the imputer and scaler on all seasons lets 2020-2024 set the medians and scaling used in training. Here it moved the MLP by {sg(oget('C', 'impute -> scale', NN, 'PR-AUC_change_vs_reference', 'all'))} PR-AUC and logistic regression by {sg(oget('C', 'impute -> scale', LR, 'PR-AUC_change_vs_reference', 'all'), 4)}. Whatever the score, it uses future seasons, so the pipeline fits preprocessing inside the scikit-learn `Pipeline` on training rows only.

We keep split → median imputation → scaling for the linear model and the MLP, and median imputation without scaling for the forest.
""")

md("""
### 13.1 Missing values: impute, drop columns, or drop rows?

About two thirds of training rows have no qualifying record, and form is missing on a driver's first race (standings are set to 0 before a driver's first race of a season, so they are not imputed). Instead of choosing by preference, each approach below is scored on the same 2020-2021 validation rows.
""")
code("""
missing = results["missing_experiments"]
display(missing.round(4))
display(missing.pivot_table(index=["approach", "variant"], columns="model", values="PR-AUC_change_vs_used").round(4))
""")
_rows = {p: int(missing[missing.variant.str.startswith(p)].train_rows.iloc[0])
         for p in ("drop training rows with no qualifying", "drop training rows with any missing")}
_full = int(missing[missing.variant.str.endswith("(used)")].train_rows.iloc[0])
_lr_alt = missing[missing.model.eq(LR) & ~missing.variant.str.endswith("(used)")]["PR-AUC_change_vs_used"].abs().max()
_alts = missing[~missing.variant.str.endswith("(used)")]
_nn_alts = _alts[_alts.model.eq(NN)]["PR-AUC_change_vs_used"]
assert _lr_alt < 0.01, "an alternative now moves logistic regression by 0.01 or more; rewrite the decision text"
assert _nn_alts.max() < 1.5 * SEED_GAP, "a network gain is now well beyond single-seed noise; rewrite the decision text"
assert _nn_alts.idxmin() == _alts[_alts.model.eq(NN) & _alts.approach.eq("drop columns")].index[0], \
    "dropping the sparse columns is no longer the network's largest loss; rewrite the decision text"
md(f"""
**Imputers.** Mean, k-nearest-neighbour, and iterative regression imputation change logistic regression's validation PR-AUC by {sg(miss_change('mean imputation', LR), 4)}, {sg(miss_change('KNN', LR), 4)}, and {sg(miss_change('iterative', LR), 4)} against median imputation. For the network the changes are {sg(miss_change('mean imputation', NN))}, {sg(miss_change('KNN', NN))}, and {sg(miss_change('iterative', NN))}. These network numbers come from a single seed, and a single seed can sit {f3(SEED_GAP)} away from its own average (section 10.3), so changes of this size are within noise.

**Dropping columns.** Removing the two columns with more than 50% missing values (`qualifying_position` and `qualifying_time_seconds`) changes the score by {sg(miss_change('drop the sparse', LR))} for logistic regression and {sg(miss_change('drop the sparse', NN))} for the network. Removing the `qualifying_missing` flag instead changes logistic regression by {sg(miss_change('median, without', LR), 4)} and the network by {sg(miss_change('median, without', NN))}.

**Dropping rows.** Keeping only training rows with qualifying data (1994 onward) leaves {n(_rows['drop training rows with no qualifying'])} of {n(_full)} rows and changes the score by {sg(miss_change('drop training rows with no qualifying', LR))} (logistic regression) and {sg(miss_change('drop training rows with no qualifying', NN))} (network). Keeping only complete rows leaves {n(_rows['drop training rows with any missing'])} and changes it by {sg(miss_change('drop training rows with any missing', LR))} and {sg(miss_change('drop training rows with any missing', NN))}. Dropping rows throws away about two thirds of the history, including most of the long driver and team form.

**Decision.** Median imputation plus the missing-indicator flag, fitted on training rows only, keeps all {n(_full)} training rows and is never meaningfully beaten. We judge it on logistic regression, the selected model, because it has no random seed: every alternative is within {f4(_lr_alt)} of median imputation. The network's single-seed changes run from {sg(_nn_alts.min())} to {sg(_nn_alts.max())}. One seed can move by {f3(SEED_GAP)} on its own, so these numbers cannot rank the imputers. Only the {sg(_nn_alts.min())} from dropping the qualifying columns stands out, and it argues against dropping them. We keep median imputation. Leaving the nulls, dropping columns, and dropping rows were all tested against it, and none of them helped enough to justify what it throws away, such as the two thirds of training history lost when rows are dropped.
""")

md("## 14. Model comparison: train, validation, and unseen test")
code("""
display(results["metrics"])
display(Image(filename=str(OUT / "figures" / "model_comparison.png")))
validation_ranking = (results["metrics"].query("split == 'validation'")
                      .sort_values("PR-AUC", ascending=False))
print("Validation-only model selection ranking:")
display(validation_ranking)
""")
assert all(mget(m, "train", "PR-AUC") < mget(m, "validation", "PR-AUC") for m in (LR, RF, NN)), \
    "a model now scores higher on training than on validation; rewrite the paragraph below"
md(f"""
Logistic regression is the statistical baseline, random forest captures nonlinear interactions, and the two-hidden-layer MLP is the shallow neural network. PR-AUC is the selection metric because the positive class is uncommon. Model-specific thresholds ({f3(summary['thresholds'][LR])}, {f3(summary['thresholds'][RF])}, and {f3(summary['thresholds'][NN])}) maximize validation F1 and are frozen before test scoring. All three models score lower on training than on validation, which reflects historical distribution shift (a lower podium rate, {pc(split.loc['train', 'podium_rate'])} against {pc(split.loc['validation', 'podium_rate'])}, and far more missing qualifying in the training years). The forest only behaves this way because its depth and leaf size were limited by the validation search in section 14.1; its first settings memorized the training seasons.
""")

md("""
### 14.1 Hyperparameter search and an honest improvement attempt for each model

Every setting was trained on 1950-2019 and scored on 2020-2021 only; the test seasons were not touched. The network is averaged over three random seeds, because its score changes with the initialization.
""")
code("""
tuning = results["tuning"]
display(tuning[["model", "settings", "is_initial", "is_current", "validation_PR-AUC", "validation_PR-AUC_std",
                "validation_ROC-AUC", "train_PR-AUC", "rank_within_model"]].round(4))
""")
_sizes = tuning.groupby("model").size()
_rf0, _rf1 = tuned(RF, "initial"), tuned(RF, "current")
_nn0, _nn1 = tuned(NN, "initial"), tuned(NN, "current")
_lr_all, _lr1, _lrb = tuning[tuning.model.eq(LR)], tuned(LR, "current"), tuned(LR, "best")
_nn_others = tuning[tuning.model.eq(NN) & ~tuning.settings.str.contains(r"\(32, 12\)")]
_rf_best = tuning[tuning.model.eq(RF) & tuning.rank_within_model.eq(1)].iloc[0]
_nn_best = tuning[tuning.model.eq(NN) & tuning.rank_within_model.eq(1)].iloc[0]
_nn_gap = float(_nn_best["validation_PR-AUC"] - _nn1["validation_PR-AUC"])
_nn_sds = tuning[tuning.model.eq(NN)]["validation_PR-AUC_std"]
assert _nn_gap < _nn_sds.max(), "the best network setting now beats the adopted one by more than the largest seed spread; rewrite 14.1"
_val = pd.Series({m: mget(m, "validation", "PR-AUC") for m in (LR, RF, NN)})
_lr_gap_value = float(_lrb["validation_PR-AUC"] - _lr1["validation_PR-AUC"])
_lr_gap = "ties for best (within 0.0005)" if _lr_gap_value < 5e-4 else f"is within {_lr_gap_value:.4f} of the best"
_vs_lr = "above" if _nn1["validation_PR-AUC"] > mget(LR, "validation", "PR-AUC") else "below"
assert _val.idxmax() == LR and _vs_lr == "below", "logistic regression no longer leads validation; rewrite 14.1 and 14.2"
md(f"""
**Random forest: improved.** The starting forest (unlimited depth, leaf size 4) scored {f3(_rf0['validation_PR-AUC'])} on validation but {f3(_rf0['train_PR-AUC'])} on training, a memorized fit. The search ranked it {ordinal(int(_rf0.rank_within_model))} of {int(_sizes[RF])}. Depth 12 with leaf size 30 scores {f3(_rf1['validation_PR-AUC'])} on validation and ranks {ordinal(int(_rf1.rank_within_model))} of {int(_sizes[RF])}. The best setting ({_rf_best.settings}) is only {f3(_rf_best['validation_PR-AUC'] - _rf1['validation_PR-AUC'])} higher, far inside the validation noise shown in section 11.1, so we keep the depth limit as the more constrained model. Its training PR-AUC falls from {f3(_rf0['train_PR-AUC'])} to {f3(_rf1['train_PR-AUC'])}, so it no longer memorizes the training seasons. The test set did not influence the choice.

**Shallow neural network: a noisy search.** We tried one hidden layer of 8, 16, 32, and 64 units and two layers (32, 12) and (64, 32), each with two regularization strengths, every one averaged over three seeds. The adopted two-layer (32, 12) network with alpha 0.02 scores {f4(_nn1['validation_PR-AUC'])} and ranks {ordinal(int(_nn1.rank_within_model))} of {int(_sizes[NN])}, against {f4(_nn0['validation_PR-AUC'])} for the starting alpha of 0.002. The best setting ({_nn_best.settings}) scores {f4(_nn_best['validation_PR-AUC'])}, only {f3(_nn_gap)} higher, while the seed spread of a single setting reaches {f3(_nn_sds.max())} in this search. The ranking is also unstable: with `round` in the features, the adopted setting ranked first. Chasing the top of a ranking that moves with one input and one seed would be selecting noise, so we keep the adopted network. Small networks with 8 units are clearly worse, so the network is not a deliberately weak model.

**Logistic regression: insensitive.** L1 and L2 penalties and C from 0.01 to 10 all fall between {f3(_lr_all['validation_PR-AUC'].min())} and {f3(_lr_all['validation_PR-AUC'].max())}. The starting C = 1 with L2 {_lr_gap}, so we keep it.

**A caution about the headline number.** The network's {f4(mget(NN, 'validation', 'PR-AUC'))} validation score in section 14 comes from seed 42. Averaged over three seeds the same setting scores {f4(_nn1['validation_PR-AUC'])}, with a seed standard deviation of {f3(_nn1['validation_PR-AUC_std'])}, which is {_vs_lr} logistic regression's {f4(mget(LR, 'validation', 'PR-AUC'))}. Logistic regression is highest on validation by the seed-42 table and by the three-seed average, so the selection does not depend on the seed. The validation gaps between the three models are at most {f3(_val.max() - _val.min())}, and the bootstrap in section 11.1 shows they sit inside the race-to-race noise.
""")

md("""
### 14.2 Does the added complexity earn its place?
""")
code("""
display(results["test_uncertainty"].round(4))
""")
_ut = load("test_uncertainty.csv").set_index("comparison")
_t_rf, _t_nn = _ut.loc[f"{RF} minus {LR}"], _ut.loc[f"{NN} minus {LR}"]
_tp = {m: mget(m, "test", "PR-AUC") for m in (LR, RF, NN)}
assert all(r["ci_low_2.5%"] <= 0 <= r["ci_high_97.5%"] for r in (_t_rf, _t_nn)), "a test-season interval excludes zero; rewrite 14.2"
assert _tp[LR] < min(_tp[RF], _tp[NN]) and abs(_tp[RF] - _tp[NN]) < 0.005, "the test ranking changed; rewrite 14.2"
md(f"""
On unseen test seasons (2022-2024) PR-AUC is {f3(_tp[LR])} for logistic regression, {f3(_tp[RF])} for the random forest and {f3(_tp[NN])} for the network; ROC-AUC is {f3(mget(LR, 'test', 'ROC-AUC'))}, {f3(mget(RF, 'test', 'ROC-AUC'))} and {f3(mget(NN, 'test', 'ROC-AUC'))}. The forest and the network are level at the top, and logistic regression is about {f3(min(_tp[RF], _tp[NN]) - _tp[LR])} behind. To see whether that gap is real we bootstrapped the {int(_ut.races.iloc[0])} test races (table above). The bootstrap resamples predictions we already had and chooses nothing, and we ran it after every choice was frozen. The forest minus logistic regression difference is {sg(_t_rf['test_PR-AUC'], 4)} with an interval of {sg(_t_rf['ci_low_2.5%'])} to {sg(_t_rf['ci_high_97.5%'])}, and for the network it is {sg(_t_nn['test_PR-AUC'], 4)} with an interval of {sg(_t_nn['ci_low_2.5%'])} to {sg(_t_nn['ci_high_97.5%'])}. Both intervals include zero, and so do the validation intervals in section 11.1. **The data do not support claiming that a more complex model is better.**

We therefore treat the three models as equivalent in ranking quality and use the other properties to decide. Logistic regression is the baseline and the easiest to defend and explain: its coefficients are directly readable, it is stable across seeds, and it needs no tuning to behave. It is also nominally highest on validation PR-AUC, the score we select on, so logistic regression is the selected model and the one used for the inference demo. On test the forest and the network are slightly higher, but the bootstrap shows that edge is within noise, and the test seasons are never used to choose. The reason a nonlinear model gains so little is that the strongest signals (grid, qualifying position, and recent form) act close to monotonically on podium odds, which a linear model already captures. PR-AUC is primary because only about one in eight entrants finishes on the podium, so ROC-AUC rewards correctly ranking the many easy non-podium rows; ROC-AUC stays as the secondary metric.
""")

md("## 15. Feature-group ablation")
code("""
display(results["ablations"])
display(Image(filename=str(OUT / "figures" / "ablation.png")))
""")
md("""
Each experiment removes one complete feature group and retrains the logistic baseline. The change from full-model validation PR-AUC measures the group's incremental predictive contribution after training and complements the earlier exploratory motivation.
""")

md("## 16. Global and local explainability")
code("""
for figure in ["permutation_importance", "shap_global", "lime_local", "shap_local"]:
    display(Image(filename=str(OUT / "figures" / f"{figure}.png")))
display(results["shap_global"].head(12))
display(results["lime_local"].head(12))
display(results["shap_local"].head(12))
""")
md("""
Permutation importance measures the validation PR-AUC change after shuffling one feature, and global SHAP summarizes average contribution magnitude. Local LIME explains one fixed validation prediction with 5,000 perturbations around that row and a distance-weighted ridge surrogate; its weighted R² reports local fidelity. Positive LIME weights push the surrogate toward a podium and negative weights push it away. Local SHAP is retained as a supplementary cross-check. Correlated predictors can divide importance differently across methods. These values describe fitted-model reliance and are **not causal effects**.
""")
md("### 16.1 Explaining the selected model directly: logistic regression weights")
code("""
# The selected model is logistic regression, which is intrinsically interpretable (Lab 4),
# so we read the explanation straight from its weights instead of only from the forest.
lr_model = results["models"]["Logistic regression"]
lr = lr_model.named_steps["model"]

# Global explanation: one weight per standardized feature.
weights = pd.Series(lr.coef_[0], index=FEATURES).sort_values()
fig, ax = plt.subplots(figsize=(8, 6))
ax.barh(weights.index, weights.values, color=["#2a9d8f" if w > 0 else "#e76f51" for w in weights])
ax.axvline(0, color="black", lw=1)
ax.set_xlabel("Weight (effect of +1 standard deviation on log-odds of a podium)")
ax.set_title("Logistic regression: what the selected model relies on")
fig.tight_layout(); fig.savefig(OUT / "figures" / "logistic_weights.png", dpi=150, bbox_inches="tight"); plt.close(fig)
display(Image(filename=str(OUT / "figures" / "logistic_weights.png")))

# Local explanation: the same validation row that LIME and SHAP explain.
val = split_by_time(results["modeling_table"])["validation"]
driver = val.sample(1, random_state=42)
display(driver[["year", "name", "grid_position", "driver_podium_rate_5", "podium"]])
print("Podium probability:", round(lr_model.predict_proba(driver[FEATURES])[0, 1], 3),
      "| threshold:", round(results["thresholds"]["Logistic regression"], 3))

# Each feature's push = its weight x the driver's standardized value (relative to the average training driver).
scaled_values = lr_model.named_steps["preprocess"].transform(driver[FEATURES])[0]
push = pd.Series(scaled_values * lr.coef_[0], index=FEATURES).sort_values()
fig, ax = plt.subplots(figsize=(8, 6))
ax.barh(push.index, push.values, color=["#2a9d8f" if v > 0 else "#e76f51" for v in push])
ax.axvline(0, color="black", lw=1)
ax.set_xlabel("Contribution to log-odds of a podium for this driver")
ax.set_title("Logistic regression: one prediction (2021 Dutch GP, grid P11)")
fig.tight_layout(); fig.savefig(OUT / "figures" / "logistic_local.png", dpi=150, bbox_inches="tight"); plt.close(fig)
display(Image(filename=str(OUT / "figures" / "logistic_local.png")))
""")
md("""
**Logistic regression is the selected model and is intrinsically interpretable, so we explain it directly from its own weights rather than only through the random forest.** Because every input is standardized on the training seasons, each weight is the change in the log-odds of a podium for a one-standard-deviation increase in that feature, which makes the weights comparable with each other. Globally, `grid_position` dominates (−1.44, about five times larger than any other weight): starting further back strongly lowers the predicted podium probability, which agrees with the ablation, permutation importance and SHAP results. A pit-lane start (−0.63) also pushes strongly away from a podium, while recent constructor form (+0.29), driver points so far (+0.25), experience (+0.24) and recent driver form (+0.22) push towards one. `constructor_points_before` has a small negative weight even though more points should help. It overlaps heavily with constructor rank and constructor form, and when predictors are correlated the model can split the credit between them in ways that are hard to read one weight at a time.

For a local explanation we use the same validation row explained by LIME and SHAP: a driver starting P11 at the 2021 Dutch Grand Prix. Each feature's contribution is its weight multiplied by the driver's standardized value, so it is measured **relative to the average training driver** (1950–2019). The model predicts a 13% podium probability, below the 0.625 threshold, and the driver indeed did not finish on the podium. The largest push down comes from `year` (−0.60), because 2021 is far later than the training average and the model learned a negative weight for later seasons. Grid P11 pushes slightly *up* (+0.21) because it is a little better than the historical average start of P12. The random-forest SHAP explanation ranks the same grid position as the main negative factor, which shows that each explanation depends on its model and its reference point. These weights describe what the fitted model relies on and are **not causal effects**.
""")

md("## 17. Complete and partially missing inference")
code('display(results["summary"]["inference_demos"])')
md("""
The complete example follows the normal inference path. The partial example demonstrates that missing inputs are handled by the imputer fitted on training seasons, without consulting validation or test data. Its output demonstrates software robustness rather than a historical base rate.
""")

md("""
## 18. Limitations

- Qualifying coverage is sparse and era-dependent in older seasons.
- Regulations, field size, reliability, and competitive structure change over time.
- Constructor identifiers do not bridge team renames, and a few old identifiers are reused by unrelated later teams (section 10.4).
- The nationality-to-country mapping is incomplete and cannot represent multiple nationalities.
- Mechanical status classification is rules-based and can miss ambiguous causes.
- Validation contains only the 2020-2021 seasons, so selection estimates have sampling uncertainty.
- Probabilities were evaluated for ranking and threshold classification, not formal calibration.
- Permutation importance, SHAP, and LIME explain associations inside fitted models, not causes of podium finishes.
""")

nb["cells"] = cells
OUT.parent.mkdir(parents=True, exist_ok=True)
nbf.write(nb, OUT)
print(OUT)
