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
Logistic regression is the statistical baseline, random forest captures nonlinear interactions, and the two-hidden-layer MLP is the shallow neural network. PR-AUC is the selection metric because the positive class is uncommon. Model-specific thresholds maximize validation F1 and are frozen before test scoring. Training-to-validation differences, especially for the forest, reveal overfitting and historical distribution shift.
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
