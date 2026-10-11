# Formula 1 Podium Prediction Companion

This project predicts whether a Formula 1 driver will finish in the top three for ACL-903 Milestone 1.

The prediction is made **after qualifying and before the race starts**. Every model feature must be available at that cutoff.

Start with the executed notebook. It has the full analysis and the code in visible cells. The same logic is kept in `src/f1podium/pipeline.py` so we can test and maintain it normally.

## Project contract

| Item | Definition |
| --- | --- |
| Unit of analysis | One driver entering one race |
| Unique grain | `(raceId, driverId)` |
| Target | `podium = 1` when `positionOrder <= 3`, otherwise `0` |
| Data period | 1950-2024 |
| Training period | 1950-2019 |
| Validation period | 2020-2021 |
| Unseen test period | 2022-2024 |
| Primary metric | PR-AUC |
| Secondary metric | ROC-AUC |
| Compared models | Logistic regression, random forest, shallow neural network |

Current-race results, points, status, laps, pit stops, fastest-lap information, and post-race standings are forbidden as same-race predictors.

## Repository flow

```mermaid
flowchart TD
    A[14 immutable CSV tables<br/>data/raw] --> B[Load and normalize sentinels]
    B --> C[Primary-key and foreign-key audits]
    C --> D[Resolve shared-drive duplicates]
    D --> E[One row per raceId and driverId]
    E --> F[Three data-engineering analyses]
    E --> G[Leakage-safe feature engineering]
    G --> H[Chronological train / validation / test split]
    H --> I[Preprocessing experiments]
    H --> J[Three comparable models]
    J --> K[Metrics and validation-only thresholds]
    J --> L[Feature-group ablation]
    J --> M[Permutation importance and SHAP]
    F --> N[Generated artifacts and figures]
    K --> N
    L --> N
    M --> N
    N --> O[Executed Jupyter notebook]
    N --> P[Analytical PDF report]
```

The submission notebook is self-contained and does not import `src/f1podium/pipeline.py`. `scripts/build_notebook.py` embeds the repository implementation into ordered notebook cells, so the reusable module and submitted notebook can be regenerated together.

The analysis can run from the notebook or the command line. Both routes use the same pipeline code and produce the same results.

## Core repository contents

```text
ACL-9th-Paladin/
|-- course-materials/                 Official brief and F1 introduction
|-- data/
|   |-- README.md                     Dataset provenance and immutability rule
|   `-- raw/                          Original 14 Kaggle/Ergast CSV tables
|-- notebooks/
|   `-- milestone_1_f1_podium_prediction.ipynb
|                                      Executed, run-all submission notebook
|-- kaggle/
|   `-- f1podium_src.zip               Legacy optional source bundle
|-- reports/
|   `-- milestone_1_analytical_report.pdf
|                                      Final structured analytical report
|-- scripts/
|   |-- run_analysis.py               Run the complete analytical pipeline
|   |-- build_notebook.py             Rebuild the notebook source
|   |-- build_report.py               Build the report from artifacts
|   `-- build_kaggle_bundle.py        Package shared source for Kaggle
|-- src/f1podium/
|   |-- __init__.py                   Public package exports
|   `-- pipeline.py                   Cleaning, features, models, evaluation, XAI
|-- tests/
|   `-- test_pipeline.py              Grain, cleaning, split, and leakage tests
|-- pyproject.toml                    Python package and pytest configuration
|-- requirements.txt                  Python dependency ranges
`-- README.md                         This orientation document
```

Generated `artifacts/`, temporary files, the optional UI/design workspace, deployment metadata, and personal evaluation notes are excluded from Git.

## How the core files differ

Implementation, verification, presentation, and document generation are kept separate. The analysis is implemented once in the pipeline.

```text
                         +----------------------+
                         |  build_notebook.py   |
                         | notebook structure   |
                         +----------+-----------+
                                    |
                                    v
+------------------+      +----------------------+      +------------------+
| test_pipeline.py | ---> |     pipeline.py      | <--- | Jupyter notebook |
| verifies behavior|      | core implementation  |      | runs + explains  |
+------------------+      +----------+-----------+      +------------------+
                                  |
                                  v
                         +----------------------+
                         | artifacts and figures|
                         +----------+-----------+
                                    |
                                    v
                         +----------------------+
                         |   build_report.py    |
                         | publishes the PDF    |
                         +----------------------+
```

### `src/f1podium/pipeline.py`: the analytical engine

`pipeline.py` contains the reusable project logic. It performs the actual data-science work:

- Loads the 14 raw CSV tables.
- Converts sentinels and semantic types.
- Audits primary and foreign keys.
- Resolves shared-drive duplicates.
- Builds the unique driver-race table.
- Constructs leakage-safe features.
- Creates the chronological splits.
- Trains and evaluates all three models.
- Runs preprocessing and ablation experiments.
- Produces plots, permutation importance, and SHAP explanations.
- Supports complete and partially missing inference records.
- Writes the generated analytical artifacts.

If a feature calculation, cleaning rule, model, metric, or experiment changes, the change normally belongs in `pipeline.py`.

### `tests/test_pipeline.py`: checks for the important data rules

The test file does not perform the final analysis and does not replace `pipeline.py`. It imports pipeline functions, gives them controlled inputs, and verifies that their outputs satisfy important guarantees.

The tests protect behavior such as:

- Correct qualifying-duration parsing.
- Deterministic shared-drive resolution.
- Unique `(raceId, driverId)` grain.
- Correct chronological split boundaries.
- Leakage-safe rolling form.
- A current race result cannot modify its own predictors.
- Non-starters do not enter the mechanical-retirement denominator.
- Cleaning removes duplicate participation without materially shifting the target rate.

A typical test follows this pattern:

```text
Arrange an input -> call a pipeline function -> assert the expected result
```

The tests check that the implementation follows the intended rules. They do not prove every modeling choice is best, fa EDA and experiments are still needed.

### `notebooks/milestone_1_f1_podium_prediction.ipynb`: the executable presentation

The notebook contains and executes the full implementation, then presents the resulting tables, figures, and conclusions in the order expected by the evaluator. It does not require the repository package on Kaggle.

It contains:

- Markdown explanations and justification.
- Cleaning and audit output.
- EDA and the three data-engineering answers.
- Feature and split documentation.
- Preprocessing and model comparisons.
- Ablation and XAI results.
- Inference demonstrations and limitations.

The notebook shows the work and its outputs. We rebuild it from the pipeline source so the two copies do not drift, 3ashan a small difference can change the results without being obvious.

### `scripts/build_notebook.py`: the notebook blueprint

This script defines the notebook sections, Markdown, code cells, tables, and figures. Running it recreates the `.ipynb` file instead of editing generated cells by hand.

```text
build_notebook.py
        -> creates the notebook
        -> the notebook defines the complete pipeline in visible cells
        -> executing the notebook regenerates artifacts
```

When changing notebook wording or organization, edit `build_notebook.py` and regenerate the notebook so the source and final notebook remain consistent.

### `scripts/run_analysis.py`: the command-line start button

This is the smallest runner. It calls the complete pipeline directly without opening Jupyter. Use it to regenerate `artifacts/` from the terminal.

### `scripts/build_report.py`: the PDF publisher

This script reads the saved tables and figures from `artifacts/` and builds the analytical PDF. Report text and layout live here, while calculations stay in `pipeline.py`.

### What each file is for

| File | Role | What it does |
| --- | --- | --- |
| `pipeline.py` | Analysis code | Performs the data engineering and machine learning |
| `test_pipeline.py` | Tests | Checks the important data and leakage rules |
| Jupyter notebook | Submission | Runs the analysis and explains the evidence |
| `build_notebook.py` | Notebook builder | Recreates the notebook structure and narrative |
| `run_analysis.py` | Runner | Runs the pipeline directly |
| `build_report.py` | Report builder | Turns saved results into the final report |

`pipeline.py` is the maintainable repository source. The notebook builder embeds that implementation into the self-contained submission notebook, the tests verify the reusable module, and the report communicates the results.

## Milestone requirements covered

### 1. EDA, cleaning, and auditing

- EDA tables and plots before and after duplicate cleaning.
- Visual comparison of raw and cleaned grain and distributions.
- Literal `\N` sentinel conversion.
- Semantic typing for dates and qualifying durations.
- Primary-key uniqueness and null checks.
- Foreign-key reconciliation checks.
- Immutable raw CSVs; transformations operate on copies.
- Deterministic shared-drive handling:
  1. Prefer a row with a real grid start (`grid > 0`).
  2. Prefer the better finishing classification.
  3. Break remaining ties using the lowest `resultId`.
- Exactly one final row per `(raceId, driverId)`.

The raw `results.csv` contains 26,759 rows. Cleaning resolves 85 duplicate driver-race groups and leaves 26,668 unique modeling rows.

### 2. Data-engineering questions

The notebook and report answer and visualize all three required questions using multi-table joins:

1. Which circuits convert a front-row grid start into a podium most often, and how does the ranking change after 2014?
2. Do drivers podium more often at home after controlling for starting-grid band?
3. Which constructors have the highest mechanical-retirement rates in 2014-2021 and 2022-2024?

Grid and qualifying position remain distinct because penalties can change the final starting order. Mechanical-retirement denominators contain race starters only.

### 3. Feature selection and engineering

The model uses 17 pre-race features in five groups:

| Group | Features |
| --- | --- |
| Grid | `grid_position`, `pit_lane_start`, `front_row`, `field_size` |
| Qualifying | `qualifying_position`, `qualifying_time_seconds`, `qualifying_missing` |
| Form | `driver_podium_rate_5`, `constructor_podium_rate_5`, `driver_races_before` |
| Standings | `driver_points_before`, `driver_rank_before`, `constructor_points_before`, `constructor_rank_before` |
| Context | `driver_age`, `round`, `year` |

Leakage prevention is part of construction:

- Driver form uses `shift()` before the five-race rolling mean.
- Constructor outcomes are aggregated across both cars at race level before shifting and rolling.
- Driver and constructor standings are moved to the following race within the season.
- Grid position `0` becomes a pit-lane flag and is missing in the numeric grid feature; it is never treated as better than pole.

### 4. Preprocessing and splitting

- Missing values are imputed inside the fitted scikit-learn pipeline.
- Logistic regression and the neural network receive standardized inputs.
- The random forest does not require scaling.
- Preprocessing parameters are learned from training rows only.
- Three preprocessing variants are compared on validation:
  - Median imputation with scaling.
  - Median imputation without scaling.
  - Zero imputation with scaling.
- The effect of each step on the values is measured per feature (`preprocessing_effects`, `feature_engineering_effects`): missing share, fill value, range, mean, and spread before imputation, after imputation, and after scaling, plus validation and test means under the training-fitted transform.
- Three preprocessing-order experiments are run with logistic regression and the MLP (`preprocessing_order_experiments`):
  - A: impute -> scale vs scale -> impute.
  - B: zero-fill -> scale vs scale -> zero-fill.
  - C: preprocessing fitted after the split (train only) vs before the split (all seasons).
- The split is chronological rather than random to prevent future seasons from teaching the model about earlier races. `split_summary` and `split_integrity` document and check it (complete, no shared races, strictly ordered dates), and `split_strategy_experiment` shows the same-race and future leakage that random row or random race splits would introduce.

### 5. Predictive models and evaluation

All models receive the same rows and 17 features:

- Logistic regression: interpretable statistical baseline.
- Random forest: nonlinear tree ensemble.
- Shallow MLP: two hidden layers with 32 and 12 units.

Every model reports ROC-AUC, PR-AUC, F1, precision, and recall. Each model's classification threshold maximizes F1 on validation only and is frozen before test evaluation. PR-AUC is primary because podium rows are rare; ROC-AUC is secondary.

### 6. Experiments and XAI

- Feature-group ablation removes and retrains without grid, qualifying, form, standings, or context.
- Permutation importance explains global validation-score reliance.
- Global SHAP summarizes average feature contribution magnitude.
- Local LIME explains one validation prediction with a model-agnostic surrogate; local SHAP provides a supplementary cross-check.
- The explanations show model reliance, **not causal effects**.

### 7. Inference and deliverables

- Reusable inference accepts complete or partially missing pre-race records.
- Missing fields pass through the training-fitted imputer.
- The notebook is sectioned, executed, and Run All-ready.
- The report contains the three written analytical answers, figures, model results, feature justification, XAI, and limitations.

## Environment requirements

Python 3.11 or 3.12 is recommended.

Core libraries:

- pandas and NumPy for relational processing and feature engineering.
- scikit-learn for preprocessing, models, metrics, permutation importance, and pipelines.
- Matplotlib and Seaborn for figures.
- SHAP for global and local explanations.
- Jupyter, nbformat, and nbclient for the executed notebook.
- ReportLab for the analytical PDF.
- pytest for automated checks.

Exact supported version ranges are listed in `requirements.txt` and `pyproject.toml`.

## Setup

From the repository root in PowerShell:

```powershell
py -3.12 -m venv .venv
.\.venv\Scripts\python.exe -m pip install --upgrade pip
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
$env:PYTHONPATH = "src"
```

## Run and verify

Run the tests:

```powershell
.\.venv\Scripts\python.exe -m pytest
```

Run the complete analysis and regenerate `artifacts/`:

```powershell
.\.venv\Scripts\python.exe scripts\run_analysis.py
```

Rebuild and execute the notebook:

```powershell
.\.venv\Scripts\python.exe scripts\build_notebook.py
.\.venv\Scripts\python.exe -m jupyter nbconvert `
  --to notebook `
  --execute notebooks\milestone_1_f1_podium_prediction.ipynb `
  --output milestone_1_f1_podium_prediction.ipynb `
  --ExecutePreprocessor.timeout=1200
```

Rebuild the analytical report after regenerating artifacts:

```powershell
.\.venv\Scripts\python.exe scripts\build_report.py
```

Build order:

```text
run_analysis.py or executed notebook
                -> artifacts/
                -> build_report.py
                -> reports/milestone_1_analytical_report.pdf
```

## Kaggle notebook

The repository notebook is the Kaggle submission notebook too. Wa7ed notebook is easier to check and avoids local and Kaggle copies drifting apart.

The only difference is where inputs come from:

| Environment | Raw data | Pipeline source | Generated artifacts |
| --- | --- | --- | --- |
| Local repository | `data/raw/` | `src/f1podium/` | `artifacts/` |
| Kaggle | Attached dataset under `/kaggle/input/` | Code embedded in notebook | `/kaggle/working/artifacts/` |

To publish on Kaggle:

1. Create or open a Kaggle notebook.
2. Import `notebooks/milestone_1_f1_podium_prediction.ipynb`.
3. Attach the public Formula 1 World Championship dataset containing the 14 CSV tables.
4. Choose **Run All**.
5. Confirm that every code cell completes and that tables and figures appear.
6. Save a version with outputs, then make the notebook accessible using the visibility required for submission.

The first notebook cell searches `/kaggle/input` for `results.csv`. All analysis code is already contained in the notebook.

## Automated tests

`tests/test_pipeline.py` verifies:

1. Qualifying-duration parsing.
2. Shared-drive selection behavior.
3. Real modeling-table grain, features, and split boundaries.
4. Rolling-form leakage prevention.
5. Deterministic duplicate cleaning under randomized row order.
6. Correct race-start denominator for mechanical retirements.
7. Current-race results cannot change their own feature values.
8. Before/after cleaning EDA reaches unique driver-race grain without materially shifting the target rate.
9. The split is complete, has no race in two splits, and is strictly ordered in time.
10. Imputation fill values are training medians and only training is centred by the scaler.
11. At least two preprocessing-order experiments are reported, and zero-fill order changes the filled value as expected.

## Verified headline results

- 26,668 unique driver-race rows after cleaning.
- 12.7% overall podium rate.
- Zero null or duplicated audited primary keys.
- Zero orphan values in the audited foreign-key relationships.
- The shallow neural network has the highest validation PR-AUC and remains slightly first on the unseen test set.
- Grid is the most important feature group under ablation, permutation importance, and SHAP.
- The random forest shows the largest training-to-validation performance drop.

Exact scores, thresholds, plots, and sample sizes are stored in the executed notebook and analytical report rather than duplicated here.

## Known limitations

- Qualifying coverage is sparse and era-dependent in older seasons.
- Formula 1 regulations, field sizes, reliability, and competitive structure change over time.
- Constructor identifiers do not necessarily preserve history across team renames.
- The home-country analysis uses a documented but incomplete nationality-to-country mapping.
- Mechanical-status classification is rules-based and may miss rare ambiguous failures.
- The validation set contains only 39 races from 2020-2021.
- Model probabilities were evaluated for ranking and threshold performance, not formal calibration.
- Permutation importance and SHAP explain associations inside fitted models, not causes of podium finishes.

## Collaboration rules

- Do not edit files in `data/raw/`.
- Put reusable analysis logic in `src/f1podium/pipeline.py`, not only in notebook cells.
- Add or update tests when changing grain, joins, leakage controls, features, or evaluation behavior.
- Regenerate the notebook and report after changing analysis results.
- Do not commit `artifacts/`, temporary renders, local environments, the optional UI/design workspace, or personal study notes.
- Never select models, hyperparameters, or thresholds using the test set.

## Who worked on what

Kol wahed focused on a different part, bas everyone should still understand the full pipeline because the evaluator can ask anyone.

### Yahia: EDA, analytical questions, and feature evidence

Yahia worked mainly on the exploratory and descriptive analysis.

Main tasks:

- Initial exploratory data analysis.
- Data-analysis plots.
- The three data-engineering questions and their interpretation.
- Plots and written notebook conclusions for the three questions.
- Exploratory evidence supporting feature selection.
- Plots showing feature effects.
- Explanation of why the form features use past races only.

Main code locations:

- `src/f1podium/pipeline.py`
  - `cleaning_eda`
  - `engineering_answers`
  - `create_plots`
  - `FEATURE_GROUPS` and `FEATURES`
- `scripts/build_notebook.py`
  - Sections 2, 3, and 4.
- `scripts/build_report.py`
  - Cleaning-impact EDA, qualifying coverage, the three analytical answers, and feature motivation.
- `artifacts/front_row_circuits.csv`
- `artifacts/home_effect.csv`
- `artifacts/mechanical_retirements.csv`
- `artifacts/figures/qualifying_coverage.png`
- `artifacts/figures/front_row_conversion.png`
- `artifacts/figures/home_effect.png`
- `artifacts/figures/mechanical_retirements.png`

Key points for Yahia:

- What changed before and after cleaning and why the distribution remained stable.
- Why final grid, not qualifying position, defines a front-row start.
- Why grid bands are used to control starting position in the home-race analysis.
- Which statuses and denominators define a mechanical retirement.
- How qualifying coverage motivated the missingness flag and retention of grid features.
- Why descriptive results and feature importance are associations rather than causal effects.

### Rana: predictive models, evaluation, ablation, and XAI

Rana worked mainly on modeling and explainability, plus the analytical results used when interpreting the models.

Main tasks:

- Logistic-regression baseline.
- Random-forest model.
- Shallow feed-forward neural network.
- Explanation of how each model works.
- Model limitations.
- Training and validation performance.
- Unseen test performance.
- Model-comparison plots and tables.
- Feature-group ablation.
- Global permutation importance.
- Global SHAP.
- Local LIME explanation, with local SHAP as a supplementary cross-check.
- XAI plots and interpretation in the report.

Main code locations:

- `src/f1podium/pipeline.py`
  - `_pipeline`
  - `model_definitions`
  - `_best_threshold`
  - `_metrics`
  - `train_and_evaluate`
  - `ablation_experiments`
  - `create_plots`
  - `shap_explanations`
  - `predict_podium`
- `scripts/build_notebook.py`
  - Sections 6, 7, 8, 9, and 10.
- `scripts/build_report.py`
  - Model comparison, ablation, XAI, inference, conclusions, and limitations.
- `artifacts/model_metrics.csv`
- `artifacts/ablation_results.csv`
- `artifacts/figures/model_comparison.png`
- `artifacts/figures/permutation_importance.*`
- `artifacts/figures/shap_global.*`
- `artifacts/figures/lime_local.*`
- `artifacts/figures/shap_local.*`

Key points for Rana:

- Why logistic regression is the baseline.
- How a random forest and a two-hidden-layer MLP work.
- Why all models use identical rows and features.
- Why PR-AUC is primary and ROC-AUC is secondary.
- Precision, recall, F1, ROC-AUC, PR-AUC, and validation-only threshold selection.
- Why the random forest shows overfitting.
- Why test data cannot be used for model, hyperparameter, or threshold selection.
- Why permutation importance and SHAP can disagree.
- How local LIME explains one prediction and why local SHAP is kept as a cross-check.
- Why XAI results must not be presented as causal effects.

### Ali: cleaning, relational integrity, and integration

Ali worked mainly on data cleaning, auditing, modeling grain, integration, and the data-availability side of feature selection.

Main tasks:

- Raw-table loading and immutability.
- Sentinel handling and semantic typing.
- Primary-key and foreign-key audits.
- Shared-drive duplicate discovery and documented resolution.
- Final one-row-per-`(raceId, driverId)` grain.
- Join correctness and relationship validation.
- Integration of feature-selection reasoning with data availability.
- Notebook/report assembly and final submission checks.

Main code locations:

- `src/f1podium/pipeline.py`
  - `load_raw_tables`
  - `audit_tables`
  - `_time_to_seconds`
  - `clean_results`
  - `build_modeling_table`
  - `cleaning_eda`
  - `run_analysis`
- `tests/test_pipeline.py`
  - Duration parsing.
  - Duplicate rules and determinism.
  - Modeling-table grain.
  - Cleaning-impact checks.
  - Current-race leakage mutation test.
- `data/README.md`
- `README.md`
- `scripts/run_analysis.py`
- `scripts/build_notebook.py`
- `scripts/build_report.py`

Key points for Ali:

- The purpose and grain of every important raw table.
- How `\N` becomes a missing value and how dates/durations receive semantic types.
- The difference between primary-key and foreign-key validation.
- Why `validate="many_to_one"` and `validate="one_to_one"` protect joins.
- Why shared drives violate the required modeling grain.
- The exact deterministic rule for retaining a shared-drive row.
- Why grid zero becomes a pit-lane flag instead of numeric pole position.
- How the complete pipeline flows from raw CSVs to artifacts, notebook, and report.
- Which files are generated, ignored, or intended for submission.

### Aya: preprocessing, feature engineering, and splitting

Aya worked mainly on turning the cleaned table into a leakage-safe model-ready dataset, with feature choices supported by the cleaning work and EDA.

Main tasks:

- Data preprocessing.
- Feature engineering.
- Effects of preprocessing on feature values, ranges, and distributions.
- Preprocessing experiments.
- Leakage-safe driver and constructor form.
- Prior driver and constructor standings.
- Proper training, validation, and test splitting.
- Feature-list documentation and pre-race validity.

Main code locations:

- `src/f1podium/pipeline.py`
  - `FEATURE_GROUPS` and `FEATURES`
  - `_previous_standings`
  - `build_modeling_table`
  - `split_by_time`, `split_summary`, `split_integrity`, `split_strategy_experiment`
  - `_pipeline`
  - `preprocessing_experiments`, `preprocessing_order_experiments`
  - `preprocessing_effects`, `feature_engineering_effects`, `preprocessing_plots`, `split_plot`
- `scripts/build_notebook.py`
  - Sections 4 and 5.
- `scripts/build_report.py`
  - Feature table, chronological split, and preprocessing experiment sections.
- `artifacts/preprocessing_experiments.csv`
- `artifacts/preprocessing_order_experiments.csv`
- `artifacts/preprocessing_effects.csv` and `artifacts/feature_engineering_effects.csv`
- `artifacts/split_summary.csv`, `artifacts/split_integrity.csv`, `artifacts/split_strategy_experiment.csv`
- `artifacts/figures/preprocessing_distributions.png`, `preprocessing_ranges.png`, `chronological_split.png`
- `artifacts/modeling_table.csv`

Key points for Aya:

- All 17 features and their five groups.
- Why every feature is available after qualifying and before race start.
- Why driver form uses `shift()` before `rolling()`.
- Why constructor outcomes are aggregated by race before shifting.
- Why standings must be attached to the following race.
- How median imputation and standardization work.
- Why preprocessing is fitted on training only.
- Why trees do not require scaling but logistic regression and the MLP benefit from it.
- The three preprocessing variants and their validation results.
- Why the split is chronological rather than random.
- Why training has more qualifying missingness and a lower podium rate than later splits.

## Submission outputs

The core files intended for review are:

- `notebooks/milestone_1_f1_podium_prediction.ipynb`
- `reports/milestone_1_analytical_report.pdf`
- `src/f1podium/pipeline.py`
- `tests/test_pipeline.py`
- `data/raw/*.csv`

Before submission, confirm that the Kaggle notebook link and GitHub repository link are accessible to the evaluator.
