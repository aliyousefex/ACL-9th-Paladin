"""Build the fully self-contained Kaggle submission notebook."""

from pathlib import Path
import nbformat as nbf

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "notebooks" / "milestone_1_f1_podium_prediction.ipynb"
PIPELINE = ROOT / "src" / "f1podium" / "pipeline.py"

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
md("""
Cleaning reaches exactly one row per `(raceId, driverId)` without materially changing the target or starting-position distributions. Qualifying coverage is sparse in older seasons, so we retain an explicit missingness flag and use final grid as the historically broader pre-race signal rather than discarding early history.
""")

md("""
### 8.1 Who has grid 0? Non-starters, withdrawals, and the pit-lane flag
""")
code("""
display(results["non_starters"].round(3))
display(results["non_starter_experiment"].round(4))
""")
md("""
**What the audit shows.** 6.1% of rows have grid 0, and the flag name `pit_lane_start` makes them sound like pit-lane starts. They are mostly not. Of the 1,635 grid-0 rows, 1,346 are drivers who never raced (positionText `F`: did not qualify, did not prequalify, or failed the 107% rule), 202 are withdrawals, and only 87 are real pit-lane or exceptional starts. All 1,366 `F` rows are in 1952-2012, all are in training, and none finished on the podium. Validation and test contain no `F` rows.

**Decision: keep every row.** The experiment trains with and without these rows and scores the same 2020-2021 validation rows. Dropping the `F` rows changes validation PR-AUC by +0.0003 for logistic regression and -0.0027 for the network, which is within noise, so there is nothing to gain. Dropping the `W` rows as well cost the network about 0.05. Two further reasons: the evaluation seasons are unchanged either way, and a `W` row cannot be shown to be known before the start, because the same code covers 227 recorded withdrawals and drivers who started and then retired. We therefore keep the table as the unique driver-race table the brief describes and record the caveat: in training, `pit_lane_start` is mostly a did-not-qualify marker, and only from 2013 onward does it mean a true pit-lane start. Dropping the `F` rows is a reasonable alternative if the instructor rules that a driver who did not qualify did not enter the race.
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

**Mechanical retirements.** Rates use recorded race starters as the denominator and documented component-status labels as the numerator, with at least twenty starts per constructor-era. Ambiguous status coding remains a limitation.
""")

md("## 10. Leakage-safe features")
code('display(FEATURE_GROUPS)')
md("""
Every selected feature is known after qualifying and before the start. Driver form shifts before rolling, constructor outcomes are aggregated by race before shifting, and standings attach only to the following race. Current-race position, points, status, laps, pit stops, and fastest-lap information never enter `FEATURES`.
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
md("""
The table and figure use **training seasons only**. For each of the 17 features they show the share of missing cells, the podium rate in its lowest and highest bin, and a one-feature ROC-AUC (above 0.5 means a higher value goes with more podiums, below 0.5 the reverse). The same AUC on validation checks that the pattern still holds in later seasons. Missing cells are left out of the AUC and the bins, and the orange bar in the figure shows the podium rate of the rows where the feature is missing.

**Strong single signals.** Position features carry the most: `qualifying_position` (AUC 0.09, so lower is better, measured on the 34% of rows that have it) and `grid_position` (0.12). The podium rate falls from about 45-50% in the best bin to under 1% in the worst. The standings ranks (0.15 and 0.16), form rates (0.82 and 0.83), and points (0.79 and 0.80) are next, and `front_row` (0.67) and `driver_races_before` (0.67) are clear but smaller. All of these keep the same direction on validation, with similar or slightly stronger AUCs (for example 0.09 for grid and 0.84-0.85 for form).

**Weak single signals, kept for a different reason.** `field_size` (0.44), `driver_age` (0.55), `qualifying_time_seconds` (0.45), `pit_lane_start` (0.46), and `qualifying_missing` (0.48) are close to 0.5 on their own. The qualifying time is not comparable across circuits and eras, so a raw time says little without the rest of the row. The two flags are indicators: the missing-value experiment in section 13.1 shows removing `qualifying_missing` costs the network 0.041 PR-AUC, and rows with no grid position (drivers who never started) never podium, while rows with no qualifying record podium at about the average rate (11.8% against 12.5%). `round` (0.50) and `year` (0.51) have essentially no single-feature signal, and `field_size`, `round`, and `year` are flat or constant on validation (every 2020-2021 race has 20 starters). We keep them as context and era controls, and the ablation shows the whole context group adds the least of the five (0.004 PR-AUC). We have not shown that `round` or `year` help on their own, so they are the first candidates to remove.

**What this evidence does and does not show.** A one-feature AUC ignores the other 16 features, so a feature that looks weak here can still help in combination, and a strong feature can add little once the grid is present (the ablation shows qualifying adds only 0.005 on top of the grid). The AUCs describe association in past races and are not causal effects.
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
md("""
The first table keeps the same two models and scores four validation windows, each training on all earlier seasons and each ending before the test seasons, so the test set is never used. The score depends on the window: logistic regression ranges from 0.689 to 0.728 PR-AUC and the network from 0.668 to 0.739. The 2020-2021 window we use is at the top of both ranges, so validation scores are somewhat optimistic and should not be read as the expected test score. The test seasons, which were never used for a decision, score lower for both models (0.70 and 0.72).

The second table bootstraps whole validation races. With only 39 races, each model's PR-AUC has a 95% interval about 0.2 wide (for example 0.62-0.84 for logistic regression). The difference between the network and logistic regression is +0.011 with an interval of -0.011 to +0.031, and for the forest it is -0.010 with an interval of -0.044 to +0.028. Both intervals include zero, so the data do not show that any model is better than the baseline. We keep the chronological split because it is the only one with no same-race or future leakage, but we report the model ranking as a tie within validation uncertainty.
""")

md("""
## 12. Effect of feature engineering and preprocessing on distributions, ranges, and values

### 12.1 Feature-engineering steps
""")
code('display(results["feature_engineering_effects"])')
md("""
The table compares each raw source column with the feature built from it (all 1950-2024 rows). Raw `grid` contains 6.1% zeros (pit-lane or exceptional starts), which would sit numerically *ahead* of pole. In `grid_position` those zeros become missing, the minimum becomes 1, and the information moves to the binary `pit_lane_start` flag. Qualifying strings such as `1:23.456` become numeric seconds; the left join to every driver-race row then exposes the missing qualifying history of older seasons (61% of rows have no qualifying time). The shifted form and previous-race standings are missing on a driver's first race and on the first round of a season, because no earlier result exists. These gaps are what the imputer fills in the next step.

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
md("""
**Median imputation** writes the training median into every missing cell. Qualifying position and time are missing in about two thirds of training rows, so they get a tall spike at the median and their standard deviation falls by about 42%. Standings and form features lose only a few percent. Ranges do not change, because the median is inside the observed range. The `qualifying_missing` flag keeps the information that a value was filled.

**Standardization** moves every training feature to mean 0 and standard deviation 1. Raw ranges differ by orders of magnitude (`constructor_points_before` spans 0-722, the flags 0-1). After scaling they share one scale, so neither logistic regression's penalty nor the MLP's gradient steps are dominated by large-unit features. Scaling is linear, so the shape of each distribution and the order of values are unchanged. Long right tails stay long: one recorded qualifying time of 1002.6 s lands about 100 standard deviations out, and the points features reach about 11.

**Fitted on training only.** Validation and test pass through the training-fitted transform, so their means are *not* zero. `year` sits about +1.7 standard deviations above the training mean, prior points about +1.0, `field_size` about -1.0 (smaller modern grids), and `qualifying_missing` about -1.4 (qualifying is almost always recorded now). This is the honest view of period shift, and it is what the model sees at deployment.
""")

md("## 13. Preprocessing experiments: strategy and order")
code("""
display(results["preprocessing"])
order = results["preprocessing_order"]
display(order.round(4))
display(order.pivot_table(index=["experiment", "order", "preprocessing_fitted_on"], columns="model",
                          values="validation_PR-AUC").round(4))
""")
md("""
The first table compares preprocessing **strategies** (median with and without scaling, zero with scaling). The second reports three preprocessing-**order** experiments, each scored on validation with logistic regression and the shallow neural network:

- **A: impute → scale vs scale → impute.** Median imputation commutes with a linear rescale, so the missing value maps to the same raw median either way. The difference is the scaler's statistics: scaling first computes mean and spread from observed values only, so after imputation qualifying time has a training standard deviation of 0.58 instead of 1. Logistic regression is unchanged; the MLP, which is sensitive to input scale, loses about 0.012 validation PR-AUC.
- **B: zero-fill → scale vs scale → zero-fill.** Here the order changes the value. Filling zero *before* scaling writes a literal 0, which means "grid 0, ahead of pole" and "a 0-second qualifying lap". Filling zero *after* scaling writes the training mean (grid ≈ 12.0, qualifying ≈ 88.8 s). The `missing_..._becomes` columns show the fill in original units. The impossible raw zeros cost the MLP about 0.010 PR-AUC; logistic regression barely moves.
- **C: preprocess before vs after the split.** Fitting the imputer and scaler on all seasons lets 2020-2024 set the medians and scaling used in training. Here it did not help: the MLP lost about 0.038 PR-AUC and logistic regression was unchanged. Whatever the score, it uses future seasons, so the pipeline fits preprocessing inside the scikit-learn `Pipeline` on training rows only.

We keep split → median imputation → scaling for the linear model and the MLP, and median imputation without scaling for the forest.
""")

md("""
### 13.1 Missing values: impute, drop columns, or drop rows?

About two thirds of training rows have no qualifying record, and standings and form are missing on a driver's first race. Instead of choosing by preference, each approach below is scored on the same 2020-2021 validation rows.
""")
code("""
missing = results["missing_experiments"]
display(missing.round(4))
display(missing.pivot_table(index=["approach", "variant"], columns="model", values="PR-AUC_change_vs_used").round(4))
""")
md("""
**Imputers.** Mean, k-nearest-neighbour, and iterative regression imputation all land within 0.005 PR-AUC of median imputation for logistic regression (KNN is +0.0022, the largest gain). For the network every alternative is worse, by 0.015 for mean and about 0.045 for KNN and iterative. The network's seed-to-seed spread is about 0.016 (see section 14.1), so the mean difference is within noise but the KNN and iterative drops are not.

**Dropping columns.** Removing the two columns with more than 50% missing values (`qualifying_position` and `qualifying_time_seconds`) costs 0.005 for logistic regression and 0.035 for the network. Removing the `qualifying_missing` flag instead costs the network 0.041, so the flag carries real information.

**Dropping rows.** Keeping only training rows with qualifying data (1994 onward) leaves 8,356 of 24,529 rows and lowers the score by 0.002 (logistic regression) and 0.023 (network). Keeping only complete rows leaves 7,374 and lowers it by 0.004 and 0.047. Dropping rows throws away about two thirds of the history, including most of the long driver and team form.

**Decision.** Median imputation plus the missing-indicator flag, fitted on training rows only, is the best or tied for best for both models. It keeps all 24,529 training rows. We keep it. None of the alternatives helped, so leaving the nulls, dropping columns, and dropping rows were all tested against it and rejected on evidence.
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
md("""
Logistic regression is the statistical baseline, random forest captures nonlinear interactions, and the two-hidden-layer MLP is the shallow neural network. PR-AUC is the selection metric because the positive class is uncommon. Model-specific thresholds maximize validation F1 and are frozen before test scoring. All three models score lower on training than on validation, which reflects historical distribution shift (a lower podium rate and far more missing qualifying in the training years). The forest only behaves this way because its depth and leaf size were limited by the validation search in section 14.1; its first settings memorized the training seasons.
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
md("""
**Random forest: improved.** The starting forest (unlimited depth, leaf size 4) scored 0.702 on validation but 0.919 on training, a memorized fit. The search ranked it 7th of 9. Depth 12 with leaf size 30 scores 0.717 on validation, and its training PR-AUC falls from 0.919 to 0.647, so it no longer memorizes the training seasons. We adopted it, and test PR-AUC rose from 0.689 to 0.712 without the test set influencing the choice.

**Shallow neural network: confirmed, not improved.** We tried one hidden layer of 8, 16, 32, and 64 units and two layers (32, 12) and (64, 32), each with two regularization strengths. The starting (32, 12) with alpha 0.002 was best at 0.7248 averaged over three seeds. Wider and deeper networks did not help, so we kept it. The network is not a deliberately weak model. Smaller ones are worse and larger ones are no better.

**Logistic regression: insensitive.** L1 and L2 penalties and C from 0.01 to 10 all fall between 0.713 and 0.728. C = 1 with L2 ties for best, so we keep it.

**A caution about the headline number.** The network's 0.7385 validation score comes from seed 42. Averaged over three seeds it is 0.7248, with a seed standard deviation of 0.016, which is slightly below logistic regression's 0.7276. Differences between the three models are smaller than that spread, as the bootstrap in section 11.1 also shows.
""")

md("""
### 14.2 Does the added complexity earn its place?

On unseen test seasons (2022-2024) PR-AUC is 0.703 for logistic regression, 0.712 for the random forest and 0.716 for the network; ROC-AUC is 0.935, 0.937 and 0.938. The gap between the baseline and the best model is about 0.013 PR-AUC. That is smaller than the network's seed-to-seed spread (0.016) and well inside the bootstrap interval over 39 validation races in section 11.1, where the forest minus logistic regression difference spans zero. **The data do not support claiming that a more complex model is better.**

We therefore treat the three models as equivalent in ranking quality and use the other properties to decide. Logistic regression is the baseline and the easiest to defend and explain: its coefficients are directly readable, it is stable across seeds, and it needs no tuning to behave. The network is nominally highest on both primary (PR-AUC) and secondary (ROC-AUC) metrics, so it is the model used for the inference demo, but we report that its edge is within noise. The reason a nonlinear model gains so little is that the strongest signals (grid, qualifying position, and recent form) act close to monotonically on podium odds, which a linear model already captures. PR-AUC is primary because only about one in eight entrants finishes on the podium, so ROC-AUC rewards correctly ranking the many easy non-podium rows; ROC-AUC stays as the secondary metric.
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

md("## 17. Complete and partially missing inference")
code('display(results["summary"]["inference_demos"])')
md("""
The complete example follows the normal inference path. The partial example demonstrates that missing inputs are handled by the imputer fitted on training seasons, without consulting validation or test data. Its output demonstrates software robustness rather than a historical base rate.
""")

md("""
## 18. Limitations

- Qualifying coverage is sparse and era-dependent in older seasons.
- Regulations, field size, reliability, and competitive structure change over time.
- Constructor identifiers do not necessarily bridge team renames.
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
