# F1 Podium Prediction: Full Project Study Guide

Everything explained in the 2026-10-15 session, in one file, **updated after the `F`-row change** (see Part 3).

- Numbers come from the regenerated `artifacts/` and from reading the code. Part 2 also uses read-only queries run through the pipeline's own functions.
- Line links like `pipeline.py#L165` point at the current working tree and will drift if the file is edited.
- The UI was checked at its entry points, lib files and section headings, not every component line by line.

**Contents**

- [Part 1: The whole project](#part-1-the-whole-project)
  - [1. What the project is](#1-what-the-project-is) · [2. The milestone](#2-the-milestone) · [3. The data](#3-the-data) · [4. Repo map](#4-repo-map)
  - [5. pipeline.py function by function](#5-pipelinepy-function-by-function) · [6. The 17 features](#6-the-17-features) · [7. Results and decisions](#7-results-and-the-evidence-behind-decisions)
  - [8. Tests](#8-tests) · [9. Running it](#9-running-it) · [10. Things noticed](#10-things-noticed) · [11. Ali's part](#11-alis-part)
- [Part 2: Deep dive on the five integration topics](#part-2-deep-dive-on-the-five-integration-topics)
- [Part 3: The F-row decision and everything that changed](#part-3-the-f-row-decision-and-everything-that-changed)
- [Part 4: Questions still worth asking the TA](#part-4-questions-still-worth-asking-the-ta)

---

# Part 1: The whole project

## 1. What the project is

For every driver who entered a Formula 1 race from 1950 to 2024, predict whether they finish in the top 3. The prediction may use only what is known after qualifying and before the race starts.

- **Row:** one driver entering one race. The unique key is `(raceId, driverId)`, and there are **25,302 rows** (26,759 raw result rows, minus 91 shared-drive duplicates, minus 1,366 drivers who did not enter).
- **Label:** `podium = 1` if `positionOrder <= 3`, else 0. About **13.4%** of rows are positive.
- **Cutoff:** after qualifying, before lights-out. Anything the race itself produces is future information and counts as **leakage**. That covers finishing position, points, status, laps, pit stops, fastest lap, and post-race standings.
- **Why it matters:** a model that sees race results scores almost perfectly and is useless. The milestone mostly grades whether you can find and block leakage.

## 2. The milestone

ACL-903 Milestone 1 is due **18 Oct 2026, 11:59 PM**. You submit a Kaggle notebook link, a GitHub link, and a report PDF through the Google form in the brief. The evaluation is oral and any teammate can be asked about any step. "An AI tool suggested it" is not accepted as a justification.

| Brief requirement | Where it's done |
| --- | --- |
| EDA before and after cleaning | `cleaning_eda`, `create_plots`, notebook §8 |
| `\N` sentinels and typed dates and durations | `load_raw_tables`, `_time_to_seconds`, `pd.to_datetime` in `build_modeling_table` |
| One row per `(raceId, driverId)` | `clean_results` |
| Primary-key and foreign-key audit | `audit_tables` |
| Three data-engineering questions | `engineering_answers` |
| Feature evidence | `feature_eda`, `sprint_weekend_check`, `non_starter_*` |
| Train, validation and test split | `split_by_time` and the `split_*` helpers |
| Preprocessing effects and order experiments | `preprocessing_effects`, `preprocessing_order_experiments`, `missing_value_experiments` |
| Three models, five metrics, thresholds | `model_definitions`, `train_and_evaluate` |
| At least three modeling attempts | `hyperparameter_search` |
| Feature-group ablation | `ablation_experiments` |
| Explanations (XAI) | permutation importance in `create_plots`, `shap_explanations`, `lime_explanation` |
| Inference on a complete and a partial record | `predict_podium` |

## 3. The data

[data/raw/](data/raw) holds 14 untouched Kaggle/Ergast CSVs. Cleaning happens only in memory on copies.

- **Used for the table:** `results` (the core), `races` (year, round, date, circuit), `drivers` (birth date, nationality), `constructors`, `circuits`, `qualifying`, `driver_standings`, `constructor_standings`.
- **Used for questions and audits only:** `status` (Question 3 and the non-starter audit) and `sprint_results` (leakage check).
- **Loaded but never a feature:** `lap_times`, `pit_stops` (post-race), `constructor_results`, `seasons`.

## 4. Repo map

| Path | Role |
| --- | --- |
| [src/f1podium/pipeline.py](src/f1podium/pipeline.py) | The engine: cleaning, features, models, experiments, XAI |
| [src/f1podium/\_\_init\_\_.py](src/f1podium/__init__.py) | Exports `FEATURE_GROUPS`, `FEATURES`, `build_modeling_table`, `load_raw_tables` |
| [tests/test_pipeline.py](tests/test_pipeline.py) | 20 tests guarding grain, leakage and split rules |
| [scripts/run_analysis.py](scripts/run_analysis.py) | CLI runner that calls `run_analysis()` and writes `artifacts/` |
| [scripts/build_notebook.py](scripts/build_notebook.py) | Generates the notebook: slices of `pipeline.py` pasted into code cells, plus commentary that **quotes its numbers from `artifacts/`** |
| [notebooks/milestone_1_f1_podium_prediction.ipynb](notebooks/milestone_1_f1_podium_prediction.ipynb) | Self-contained submission notebook, executed, never imports `f1podium` |
| [scripts/build_report.py](scripts/build_report.py) | Builds a ReportLab PDF from `artifacts/` (a preview, not submitted) |
| [scripts/build_report_latex.py](scripts/build_report_latex.py) | Reuses `build_report`'s prose and numbers, swaps in LaTeX renderers, and draws charts with pgfplots. Output is one `.tex` file for Overleaf |
| [reports/](reports) | The `.tex` and the compiled submission PDF (`..._latex.pdf`) |
| `artifacts/` | Generated and gitignored: ~25 CSVs, figures, `summary.json` |
| [ui/](ui) | Optional walkthrough website (Vite, React 19, Tailwind 4, Recharts), deployed through [vercel.json](vercel.json) |
| [pyproject.toml](pyproject.toml), [requirements.txt](requirements.txt) | Package metadata (Python ≥ 3.11) and pytest config (`pythonpath=src`) |

Gitignored local extras are `.impeccable/`, `.vercel/`, `PRODUCT.md`, `scripts/export_ui_data.py` and `scripts/build_evaluation_qa.py`.

- `export_ui_data.py` writes `ui/src/data/site.json` from the artifacts, so every number on the site comes from the pipeline.
- `build_evaluation_qa.py` builds a personal oral-exam study PDF (its text was written before the latest changes and still quotes older numbers).

**How the pieces connect:** `pipeline.py` is the single source of truth. The notebook is generated from it, so the two can't drift in code. Tests import it. The reports and UI read its saved outputs.

**The UI:** one scrolling page with 10 sections (Lights, The line, The book, The trace, The row, The garage, ML lab, Classification, Two cars, Limits). `App.tsx` composes the sections and tracks the active section and reading progress. `lib/` has number formatting (`pct`, `num`, `integer`, `gap`, feature labels), metric lookups (`metricAt`, `thresholdAt`, `ablationOf`) and the section list. `interact/` holds the interactive widgets and `charts/` the Recharts charts. It is optional and not graded.

## 5. `pipeline.py` function by function

### Constants

| Name | Meaning |
| --- | --- |
| [SENTINEL](src/f1podium/pipeline.py#L43) | `"\N"`, the missing-value placeholder in the CSVs |
| [DID_NOT_ENTER_CODE](src/f1podium/pipeline.py#L51) | `"F"`. Result rows with this finishing code did not qualify, prequalify, or pass the 107% rule. The instructor ruled they may be removed (known before the race), but `W` rows may not |
| [FEATURE_GROUPS](src/f1podium/pipeline.py#L53) | The 5 groups mapped to the 17 feature names. Drives ablation and feature EDA |
| [FEATURES](src/f1podium/pipeline.py#L60) | Flat list of the 17 names. This is the only set of columns a model ever sees |
| [PRIMARY_KEYS](src/f1podium/pipeline.py#L62) | Key columns for 11 tables |
| [FOREIGN_KEYS](src/f1podium/pipeline.py#L71) | 9 child-to-parent links to check for orphans |
| [SPLIT_YEARS](src/f1podium/pipeline.py#L238) | Train 1950–2019, validation 2020–2021, test 2022–2024 |
| [MECHANICAL_TERMS](src/f1podium/pipeline.py#L1042) | About 50 `status` labels counted as component failure. Includes Tyre puncture, Fire and Safety belt per Piazza @10. Excludes Refuelling |
| [NON_START_STATUSES](src/f1podium/pipeline.py#L1058) | Withdrew, Did not start, Did not qualify, Did not prequalify, Excluded. Removed from Question 3's denominator |
| [NATIONALITY_TO_COUNTRY](src/f1podium/pipeline.py#L1060) | 27-entry map such as "British" to "UK", for the home-race question. Drivers with other nationalities are dropped from Question 2 |
| [SEARCH_SPACE](src/f1podium/pipeline.py#L817) | Tuning grids: logistic regression 8 (C × penalty), forest 9 (depth × leaf), network 12 (6 layouts × 2 alphas) |
| [SEARCH_SEEDS](src/f1podium/pipeline.py#L823) | Seeds averaged per model. The network uses 3 (42, 43, 44), the others 1 |
| [INITIAL_SETTINGS](src/f1podium/pipeline.py#L837) | Settings before tuning, kept to show before/after |
| [PREPROCESSING_ORDERS](src/f1podium/pipeline.py#L512) | The 5 arms of the order experiments (A, B, C) |

### Load, audit, clean

| Function | What it does |
| --- | --- |
| [load_raw_tables](src/f1podium/pipeline.py#L84) | Reads every CSV into a dict with `\N` as NaN. Raises early if a required table is missing |
| [audit_tables](src/f1podium/pipeline.py#L98) | Returns a primary-key table (rows, null keys, duplicate keys) and a foreign-key table (orphans per relationship). All are 0 |
| [_time_to_seconds](src/f1podium/pipeline.py#L116) | `"1:23.456"` becomes 83.456. Garbage and NaN become NaN |
| [clean_results](src/f1podium/pipeline.py#L129) | Resolves shared-drive duplicates. See below |
| [cleaning_eda](src/f1podium/pipeline.py#L327) | Three stages (raw, shared drives resolved, `F` rows removed): rows, unique pairs, duplicate rows, podium rate, pit-lane share, median grid |

`clean_results` keeps one row per driver-race using three tie-breakers in order:

1. A row with `grid > 0`, meaning the car that actually started.
2. The better `positionOrder`.
3. The smallest `resultId`.

- **Why this rule:** it is deterministic and never mixes fields from two rows. Piazza @12 said mixing would be leakage, and @16 confirmed that choosing the car the driver finished in is **not** a violation.
- **Result:** 26,759 raw rows, 85 duplicate groups (176 rows), 91 rows dropped, 26,668 kept. The podium rate moves from 12.69% to 12.73%.
- **Then the `F` step** (in `build_modeling_table`) removes 1,366 rows: 25,302 remain and the podium rate is 13.42%, because none of those rows is a podium.

### Building the modeling table

[_previous_standings](src/f1podium/pipeline.py#L151) moves post-race standings onto the **next** race within the same season. This avoids leaking the current race's result, and round 1 of each season has no standings.

[build_modeling_table](src/f1podium/pipeline.py#L165) builds the table in this order (the parameter `drop_did_not_enter=False` keeps the `F` rows for the audit and experiment):

1. Resolve shared drives, then remove the `F` rows (before any feature, so a skipped weekend never counts as a race), then join races, drivers, constructors and circuits with `validate="many_to_one"`. Those checks fail loudly if a join would duplicate rows.
2. Compute `driver_age` and the label.
3. Compute the grid features. `grid_position` is NaN where `grid == 0`. `pit_lane_start` is `grid == 0`. `front_row` is `grid ∈ {1, 2}`. `field_size` is the row count of the race, now the drivers who entered. A raw grid 0 would otherwise look like "ahead of pole".
4. Join qualifying. Take the best of Q1/Q2/Q3 in seconds, deduplicate, join `one_to_one`, and set `qualifying_missing`.
5. Join the shifted driver and constructor standings.
6. Sort by date and compute form:
   - `driver_podium_rate_5` is `shift()` then `rolling(5).mean()`, so the current result can't enter.
   - Constructor form aggregates both cars per race **before** shifting, so a teammate's same-race result can't leak.
   - `driver_races_before` is `cumcount()`.
7. Return `(frame, diagnostics)`. The diagnostics now include `rows_after_shared_drive_resolution` (26,668) and `did_not_enter_rows_removed` (1,366).

### Splitting

| Function | What it does |
| --- | --- |
| [split_by_time](src/f1podium/pipeline.py#L241) | Returns the three year-range DataFrames |
| [split_summary](src/f1podium/pipeline.py#L247) | Size, dates, races, podium rate, qualifying-missing per split |
| [split_integrity](src/f1podium/pipeline.py#L268) | 7 pass/fail checks: complete, no shared races, strictly ordered, both classes present |
| [split_strategy_experiment](src/f1podium/pipeline.py#L285) | Compares chronological, random-race and random-row splits and measures their leakage |

The splits:

| Split | Rows | Races | Podium rate | Qualifying missing |
| --- | --- | --- | --- | --- |
| Train | 23,163 | 1,018 | 13.3% | 64.0% |
| Validation | 780 | 39 | 15.0% | 0.1% |
| Test | 1,359 | 68 | 15.0% | 0% |

### Models and evaluation

| Function | What it does |
| --- | --- |
| [_pipeline](src/f1podium/pipeline.py#L355) | Wraps a model as `Pipeline[preprocess(imputer [+ scaler]) → model]`. Fitting on training data only prevents preprocessing leakage |
| [model_definitions](src/f1podium/pipeline.py#L363) | The three models: logistic regression (`liblinear`, balanced), random forest (240 trees, depth 12, leaf 30, no scaling), MLP (hidden layers 32 and 12, **alpha 0.02**, early stopping) |
| [_best_threshold](src/f1podium/pipeline.py#L379) | Scans 151 thresholds from 0.05 to 0.80 and picks the one with the best validation F1 |
| [_metrics](src/f1podium/pipeline.py#L387) | ROC-AUC, PR-AUC, F1, precision, recall |
| [train_and_evaluate](src/f1podium/pipeline.py#L399) | Fits on train, picks each model's threshold on validation, scores train, validation and test |

Thresholds differ (0.645, 0.78 and 0.275) because the probability scales differ. Logistic regression and the forest use class weights, which inflate probabilities, and the MLP does not.

### Preprocessing and split experiments

| Function | What it does |
| --- | --- |
| [preprocessing_experiments](src/f1podium/pipeline.py#L417) | Median+scale vs median vs zero+scale (logistic regression, validation) |
| [preprocessing_effects](src/f1podium/pipeline.py#L434) | Per feature: missing share, fill value, raw/imputed/scaled min, max, mean, std, and how validation and test shift under the training-fitted transform |
| [feature_engineering_effects](src/f1podium/pipeline.py#L472) | Raw column vs engineered feature for 8 pairs, such as grid vs `grid_position` |
| [_ordered_preprocessor](src/f1podium/pipeline.py#L498) | Builds imputer/scaler in 4 orders |
| [preprocessing_order_experiments](src/f1podium/pipeline.py#L522) | A: impute→scale vs scale→impute. B: zero-fill→scale vs scale→zero-fill. C: fit preprocessing on train vs all seasons. Run with logistic regression and the MLP |
| [preprocessing_plots](src/f1podium/pipeline.py#L566), [split_plot](src/f1podium/pipeline.py#L614) | Figures for the above |
| [split_window_experiment](src/f1podium/pipeline.py#L886) | Re-scores 4 validation windows (2014–15 up to 2020–21). Each trains on all earlier seasons and ends before 2022. The used window sits at the top of the range for both models, so validation is somewhat optimistic |
| [validation_uncertainty](src/f1podium/pipeline.py#L908) | Bootstraps whole races 1,000 times for PR-AUC intervals and model differences. Runs on validation (39 races) and, for reporting only, on the test seasons (68 races) |

### Feature evidence, ablation, tuning

| Function | What it does |
| --- | --- |
| [feature_eda](src/f1podium/pipeline.py#L683) | Per feature on **training rows only**: missing share, podium rate in lowest and highest bin, one-feature ROC-AUC on train and validation, and direction. An AUC below 0.5 means lower is better |
| [_feature_bins](src/f1podium/pipeline.py#L671), [feature_eda_panels](src/f1podium/pipeline.py#L718), [feature_eda_plot](src/f1podium/pipeline.py#L739) | Five equal-count bins (flags stay as-is) and the 17-panel figure. The orange bar is the podium rate where the feature is missing |
| [ablation_experiments](src/f1podium/pipeline.py#L635) | Retrains logistic regression with all features, then without each group, and reports the change in validation PR-AUC |
| [_quiet](src/f1podium/pipeline.py#L654) | Decorator that silences expected scikit-learn warnings |
| [_validation_scores](src/f1podium/pipeline.py#L761) | Helper: fit a preprocessor once, then score logistic regression and the MLP on validation |
| [missing_value_experiments](src/f1podium/pipeline.py#L777) | 8 variants: median, mean, KNN, iterative, no flag, drop sparse columns, drop rows without qualifying, drop rows with any missing value |
| [_model_from_params](src/f1podium/pipeline.py#L826), [_current_params](src/f1podium/pipeline.py#L844), [hyperparameter_search](src/f1podium/pipeline.py#L855) | Trains every grid setting on train and scores on validation only. Reports mean and std over seeds, train PR-AUC (to expose memorizing) and rank |

### Audits driven by Piazza answers

- [sprint_weekend_check](src/f1podium/pipeline.py#L943) shows sprints end a day before the race, so they aren't leakage by timing. They are excluded anyway: training has zero sprint rows, and the grid already carries the sprint information in 2021–22.
- [non_starter_audit](src/f1podium/pipeline.py#L973) runs on the table that still holds the `F` rows and splits grid-0 rows into four groups, with a `treatment` column recording what we do with each (`F` removed, `W` kept).
- [non_starter_experiment](src/f1podium/pipeline.py#L1009) scores four variants on the same validation rows: drop `F` before features (used), keep `F`, keep `F` in the history but drop it from training only, and also drop `W` (not allowed). The first three move validation PR-AUC by at most 0.004.

### The three questions

[engineering_answers](src/f1podium/pipeline.py#L1071) returns three tables.

| Question | Method | Answer |
| --- | --- | --- |
| 1. Front-row conversion by circuit | Final **grid** 1–2 (not qualifying, because penalties change the grid). At least 10 starts per circuit-era, split at 2014 | 1950–2013 leaders: Magny-Cours 81%, Istanbul 79%. 2014–2024 leaders: Suzuka 89%, Yas Marina 86%, Monaco 85%. The ranking changes |
| 2. Home advantage | Podium rate home vs away inside grid bands 1–3, 4–6, 7–10, 11–15, 16+ | No home boost once grid is controlled. Band 1–3: 54.9% home vs 55.7% away. Descriptive, not causal |
| 3. Mechanical retirements | Numerator: status in `MECHANICAL_TERMS`. Denominator: race starters only. At least 20 starts | 2014–21: Caterham 23.5%, Lotus 20%, Toro Rosso 16.5%. 2022–24: Alfa Romeo 12.5%, Alpine 11%, AlphaTauri 8% |

Removing the `F` rows left Questions 1 and 3 identical and moved only 20 rows of Question 2 (the 16+ band), with no change in its rates.

### Plots, explanations, inference, orchestrator

- [create_plots](src/f1podium/pipeline.py#L1102) makes the cleaning (now three stages), coverage, three-question, model-comparison and ablation figures. It also runs **permutation importance** on the random forest (1,000 validation rows, PR-AUC scoring, 5 repeats).
- [shap_explanations](src/f1podium/pipeline.py#L1157) runs TreeExplainer on the forest over 400 validation rows. It gives global mean |SHAP| and one local row. If `shap` can't import (Numba blocked on Windows), it reuses saved CSVs.
- [lime_explanation](src/f1podium/pipeline.py#L1191) is a hand-written LIME, not the `lime` package. It builds 5,000 perturbed rows that keep each feature with probability 0.8, takes replacements from training rows, applies distance weights, and fits a Ridge surrogate. It reports the surrogate's weighted R² as fidelity (0.17 for the explained row).
- [predict_podium](src/f1podium/pipeline.py#L1248) takes a dict, fills omitted fields with NaN so the fitted imputer handles them, and returns the probability and predicted class.
- [run_analysis](src/f1podium/pipeline.py#L1255) runs everything in order (building the table twice: with and without the `F` rows), writes all the artifacts and `summary.json`, runs the two inference demos with the model that has the best validation PR-AUC (the MLP), and returns one big dict. Both the CLI runner and the notebook call it.

## 6. The 17 features

All are known after qualifying and before the start.

| Group | Features | Why valid at the cutoff |
| --- | --- | --- |
| Grid | `grid_position`, `pit_lane_start`, `front_row`, `field_size` | The starting grid is set before the race. `field_size` is the row count of the race, now the drivers who entered |
| Qualifying | `qualifying_position`, `qualifying_time_seconds`, `qualifying_missing` | The session is over. 64% missing in training, so the flag is kept |
| Form | `driver_podium_rate_5`, `constructor_podium_rate_5`, `driver_races_before` | Past races only, via shift then rolling. A skipped weekend (an `F` row) no longer counts as a race |
| Standings | `driver_points_before`, `driver_rank_before`, `constructor_points_before`, `constructor_rank_before` | Standings after the previous round |
| Context | `driver_age`, `round`, `year` | Known from the calendar. `round` and `year` act as era controls |

`grid_position` alone has a one-feature AUC of about 0.88 (the table's 0.119, flipped). `round` and `year` have almost no solo signal (AUC 0.50), so they are the first to remove.

## 7. Results and the evidence behind decisions

| Model | Val PR-AUC | Test PR-AUC | Val ROC-AUC | Test ROC-AUC | Test F1 | Threshold |
| --- | --- | --- | --- | --- | --- | --- |
| Logistic regression | 0.729 | 0.704 | 0.926 | 0.935 | 0.669 | 0.645 |
| Random forest | 0.723 | 0.717 | 0.927 | 0.938 | 0.652 | 0.780 |
| Shallow network | 0.735 | 0.717 | 0.927 | 0.938 | 0.667 | 0.275 |

The three models are statistically tied. Bootstraps over whole races give model-minus-baseline intervals that all include zero:

| Difference from logistic regression | Validation (39 races) | Test (68 races) |
| --- | --- | --- |
| Random forest | −0.006 (−0.044 to +0.032) | +0.0135 (−0.012 to +0.044) |
| Shallow network | +0.006 (−0.016 to +0.031) | +0.0135 (−0.012 to +0.039) |

The network's 0.735 validation score is from seed 42. Averaged over three seeds it is 0.725 (seed sd 0.007), slightly below logistic regression's 0.729. Logistic regression stays as the explainable baseline.

**Ablation (logistic regression, change in validation PR-AUC):**

| Group removed | Change |
| --- | --- |
| Grid | −0.023 |
| Standings | −0.016 |
| Form | −0.007 |
| Qualifying | −0.005 |
| Context | −0.004 |

Grid is the dominant group.

| Decision | Evidence |
| --- | --- |
| Chronological split | A random-row split puts 100% of held-out races in training and 98.2% of rows have future training data, PR-AUC 0.571. A random-race split has 100% future leakage, 0.619. Chronological: 0 leakage, 0.729 |
| Median imputation + flag | For logistic regression every alternative is within 0.005. The best network alternative gains 0.008 (about one seed sd) while dropping the flag, columns or rows costs it 0.03 to 0.05 |
| Fit preprocessing on training only | Experiment C: fitting on all seasons uses the future and didn't help (network −0.002, logistic regression +0.0001) |
| PR-AUC is primary | Podiums are rare. A random PR-AUC would be about 0.13 and a random ROC-AUC 0.5 |
| Thresholds from validation F1 | Frozen before test scoring, so the test set never influences a choice |
| Limit the forest | Initial settings scored 0.92 on train and 0.70 on validation (memorizing). Depth 12, leaf 30 ranks first on validation and scores 0.65 on train |
| Network alpha 0.02 | Ranks first (0.7253 over three seeds) ahead of 0.002 (0.7211). Inside the seed spread, but also the simpler model, so adopted |
| Remove `F` rows, keep `W` | Instructor ruling. Validation PR-AUC moves by at most 0.004 either way |

XAI results describe model reliance and are not causal effects. The brief requires saying so explicitly.

## 8. Tests

[test_pipeline.py](tests/test_pipeline.py) has **20 tests**. They fall into these groups:

- **Duration parsing and shared-drive rule:** includes a 20,000-row random shuffle that must give an identical result.
- **Real-data checks:** unique grain, split year boundaries, and cleaning EDA that reports each stage (shared drives fix the grain without moving the label, removing `F` rows loses no podium).
- **Leakage mutation test:** sets the latest race's `positionOrder` to 99 and asserts its feature values are unchanged while the label changes.
- **`F`-row rules:** no `F` row in the table, `W` rows stay, no podium lost, field size and race counts use entered races only, validation and test rows unchanged.
- **Rule checks:** the first race for each driver and constructor has NaN form, the Piazza @10 status list, and the mechanical-rate denominator.
- **Experiment sanity:** preprocessing fit on train only, order-experiment behavior, split integrity, tuning-grid coverage, validation windows ending before 2022, the sprint and non-starter audits, the `F` decision experiment, one EDA row per feature, and the race bootstrap for validation and test.

## 9. Running it

```powershell
.\.venv\Scripts\python.exe -m pytest
.\.venv\Scripts\python.exe scripts\run_analysis.py        # regenerates artifacts/ (about 11 minutes)
.\.venv\Scripts\python.exe scripts\build_notebook.py      # needs artifacts/; then execute with nbconvert
.\.venv\Scripts\python.exe scripts\build_report_latex.py  # paste the .tex into Overleaf, or compile with pdflatex
```

## 10. Things noticed

1. **Stale numbers in hard-coded prose (fixed).** The commentary in the notebook and report used to contain typed-in numbers that drifted from the tables (the forest's validation score, its rank, and the bootstrap interval). Now `build_notebook.py` and `build_report.py` quote every result number from `artifacts/`, and both contain guard assertions: if a rerun makes a claim false (for example "the network leads validation", "the interval includes zero", "context is the smallest ablation loss"), the build stops instead of printing stale prose.
2. **XAI explains the random forest, not the network.** The inference demo and the "best" model are the MLP, so be ready to justify that. TreeExplainer is exact and fast for trees.
3. **The partial-record demo is imputed with 1950–2019 medians.** The median of `qualifying_missing` there is 1, so a partial 2024 record looks like an old-era no-qualifying row. That is why a grid-3 input gets only about 3%. The notebook says this demonstrates robustness, not a base rate.
4. **`build_notebook.py` slices `pipeline.py` by string markers.** The markers are `from __future__ import annotations`, `def load_raw_tables`, `def split_by_time`, `MECHANICAL_TERMS =`, `def create_plots` and `def predict_podium`. Renaming or moving any of them breaks the notebook build.
5. **The test-season bootstrap and the "tied" claim.** With the final numbers the logistic-regression gap on test (0.013) is larger than a single seed's spread, so the old "inside the seed spread" argument no longer holds. The tie claim now rests on the bootstrap intervals, which include zero on both validation and test.
6. **The notebook kernel decides the forest's numbers.** The default `python3` kernel on this machine is a system Python 3.14 with scikit-learn 1.8.0, not the project's `.venv` (Python 3.12, scikit-learn 1.9.1). Logistic regression and the network gave identical results in both, but the random forest did not (for example validation PR-AUC 0.7255 vs 0.7226). Execute the notebook with a kernel that points at `.venv` (`f1venv` or `acl-f1` here). The commentary quotes the `.venv` numbers, so a Kaggle run, whose scikit-learn version differs again, can leave the text slightly different from the printed tables: check the forest's scores against the text after running there.

## 11. Ali's part

The README assigns Ali cleaning, relational integrity and integration. Be ready to explain:

- **Join validation:** why `many_to_one` and `one_to_one` protect against silent row multiplication.
- **Shared-drive rule:** the three-step tie-break and why it avoids mixing rows.
- **Grid zero and the `F` rows:** why 0 becomes a flag plus NaN instead of pole, and why the `F` rows are removed before features while `W` rows stay.
- **Audits:** primary-key vs foreign-key checks.
- **Pipeline flow:** raw CSVs to artifacts to notebook to report.

Part 2 explains each of these.

---

# Part 2: Deep dive on the five integration topics

These were checked against the real data with read-only queries, so the examples below are actual rows and counts. One finding changes how to describe the shared-drive rule (section 2.2).

## 2.1 Join validation: why `many_to_one` and `one_to_one` matter

A join can silently multiply rows. If the right-hand table has two rows for one key, every left row with that key is copied twice and no error appears.

Here is a real example of what that costs. Joining the 26,668 resolved results to the constructor standings on `raceId` alone, and forgetting `constructorId`, gives **329,408 rows (×12.4)**. Every driver gets matched to every team's standings in that race. Your podium rate, split sizes and form features would all be quietly wrong.

`validate=` turns that into an immediate error. Pandas checks that the keys are unique **in the right-hand table** for `many_to_one`, and **on both sides** for `one_to_one`. It raises `MergeError` if not.

| Join (in [build_modeling_table](src/f1podium/pipeline.py#L165)) | Declared | Why that shape is true |
| --- | --- | --- |
| results → races, drivers, constructors, circuits | `many_to_one` | Many results per race, driver, team or circuit. Exactly one parent row each |
| results → qualifying on `(raceId, driverId)` | `one_to_one` | One qualifying row per driver per race, and one result row after cleaning |
| results → previous driver standings | `one_to_one` | One standings row per driver per race |
| results → previous constructor standings | `many_to_one` | Two cars (two results rows) share one team standings row. The data has 26,668 results rows but only 13,024 distinct `(race, constructor)` pairs |

Two details worth knowing:

- **The qualifying `one_to_one` depends on `clean_results`.** It runs first. If the shared-drive duplicates were still there, the left side would repeat `(raceId, driverId)` and this join would raise. So `validate` is also a downstream proof that the cleaning worked.
- **`validate` stops row multiplication, not row loss.** Row loss is the foreign-key audit's job (section 2.4). Together they mean the row count is preserved.

If asked: "validate encodes the cardinality we believe each join has, and fails loudly instead of letting a wrong key inflate the table."

## 2.2 The shared-drive rule

**What shared drives are.** Early on, two drivers could swap into the same car mid-race, and both got credit. The `results` table then has two rows for one driver in one race, each with its own `resultId`, grid slot, finish and status. The grain `(raceId, driverId)` must be unique, so one row has to be chosen.

**Real example.** 1950 Indianapolis 500, driver Bettenhausen:

| resultId | grid | positionOrder | status |
| --- | --- | --- | --- |
| 20097 | 8 | 31 | Wheel bearing |
| 20179 | 9 | 5 | +2 Laps |

The rule keeps `20179`.

**The rule** ([clean_results](src/f1podium/pipeline.py#L129)) sorts each group by:

1. started (`grid > 0`) first
2. best `positionOrder`
3. lowest `resultId`

It then keeps the first row. The sort has to be fully ordered so the result can't depend on row order. A test shuffles 20,000 random rows and asserts an identical outcome.

**Why it avoids mixing.** The rule keeps a **whole row**. It never takes the grid from one car and the finish from another. That matters because Piazza @12 said combining a pre-race field from one row with the result from another uses post-race information to fill a gap, which is leakage. Example: taking grid 8 from the first row and "finished 5th" from the second creates a row that never happened. Piazza @16 then confirmed that choosing the car the driver finished in is **not** a post-race cut-off violation.

**What the real data showed:**

- There are **85 duplicate groups** (79 with 2 rows, 6 with 3). **79 are from the 1950s, 5 from the 1960s, 1 from 1978.** They are all in the training period, about 0.3% of rows.
- In **82 of the 85 groups every row has `grid > 0`**, and in the other 3 none do. No group has exactly one starter.
- So **step 1 never decides anything in this dataset.** A plain "best finish, then lowest `resultId`" rule keeps exactly the same 26,668 rows (0 differences). Step 1 is a safeguard that the unit test exercises with a made-up case. In practice step 2 does the work.
- Step 2 reads a post-race column (`positionOrder`), as the README admits. It only chooses between rows that both started, so it never fills a pre-race gap from another row, and @16 says that is allowed. It does mean the finish influences which car's grid and team are kept, within about 0.3% of training rows.
- The raw table has 3,397 podium rows and the cleaned table 3,395. Two podium rows disappear because one driver podiumed in both cars of the same race.

Be ready to say step 1 is a principle that doesn't bind here. If an evaluator asks "why `grid > 0` first?", the honest answer is that it preserves the pre-race identity of the entrant wherever the data allows. In this dataset it changes nothing.

## 2.3 Grid zero and the `F` rows: flag plus NaN, not pole

In `results`, `grid == 0` is a code, not a position. Before the `F` step, **1,635 rows (6.1%)** have it:

| Group | Rows | Meaning | Treatment |
| --- | --- | --- | --- |
| `F` | 1,346 | Did not qualify, prequalify, or pass the 107% rule. Never raced | **Removed** (instructor ruling: known before the race) |
| `W` | 202 | Withdrew | Kept (the code is only known after the race) |
| Everything else | 87 | Raced from the pit lane or an exceptional start | Kept |

(The `F` group has 1,366 rows in total; 20 of them have a real grid number.)

If you kept the 0 as a number, "lower grid means more podiums" would put grid 0 **ahead of pole**. The real rates are:

- grid 1: podium rate **64.1%**
- grid 0: podium rate **0.0%**, across every grid-0 row

A logistic regression or a network would treat 0 as the best start ever and push these rows toward predicting a podium, which is exactly backwards.

The code ([lines 193–195](src/f1podium/pipeline.py#L193)) therefore does three things:

- `grid_position` = `grid` where `grid > 0`, else NaN. The imputer later fills it with the training median, a mid-pack value.
- `pit_lane_start` = 1 where `grid == 0`. This keeps the information that the row is special.
- `front_row` = `grid ∈ {1, 2}`, so zero is never front row.

After the `F` step, `pit_lane_start` marks **289 rows (1.1%)**: 202 withdrawals and 87 real pit-lane or exceptional starts. It is no longer mostly a did-not-qualify marker, but it is still not a pure pit-lane flag. The experiment shows that removing or keeping the `F` rows moves validation PR-AUC by at most 0.004, so the decision rests on the ruling and on what a row means, not on a score.

## 2.4 Audits: primary key vs foreign key

| | Primary-key audit | Foreign-key audit |
| --- | --- | --- |
| **Question** | Does this table's key uniquely identify every row, with no nulls? | Does every reference point at a row that exists? |
| **Example** | `results.resultId`: 26,759 rows, 0 nulls, 0 duplicates | `results.driverId → drivers.driverId`: 26,759 checked, 0 orphans |
| **Failure mode if broken** | Joins on that key multiply rows | Inner joins silently drop rows |
| **Code** | `duplicated(cols)` and `isna()` in [audit_tables](src/f1podium/pipeline.py#L98) | `values.isin(parent_keys)` for 9 relationships |

Overall result: 11 tables, 0 null keys, 0 duplicate keys, 9 relationships, **177,403 values checked, 0 orphans**.

Two points that come up in evaluation:

- **Primary-key uniqueness is not the same as grain.** `resultId` passes with zero duplicates, yet the grain `(raceId, driverId)` is still violated by 85 groups. Each duplicate row has its own `resultId`. That is why a separate cleaning step is needed.
- **The FK check skips nulls** (`dropna()`), so a missing reference isn't counted as an orphan. Null keys are caught separately in the primary-key check.

Not audited: `lap_times`, `pit_stops` and `sprint_results`, which have no single-column key declared and never feed the modeling table.

## 2.5 Pipeline flow: raw CSVs → artifacts → notebook → report

```
data/raw/*.csv  (immutable, never edited)
      │  load_raw_tables  (\N → NaN)
      ▼
audit_tables → build_modeling_table (shared drives, then F rows, then features)
      │  run_analysis() calls every experiment, plot and explanation
      ▼
artifacts/   (~25 CSVs, figures/, summary.json)  ← generated, gitignored
      ├──► build_notebook.py (commentary quotes the artifacts) → notebook (executing it re-runs run_analysis)
      ├──► build_report.py → ReportLab PDF (preview only)
      │         └─ build_report_latex.py → .tex → Overleaf or pdflatex → submitted PDF
      └──► export_ui_data.py → site.json → Vite build → Vercel site
```

- **One engine, two ways to run it.** [run_analysis.py](scripts/run_analysis.py) and the notebook both call `run_analysis()`. [build_notebook.py](scripts/build_notebook.py) pastes slices of [pipeline.py](src/f1podium/pipeline.py) into code cells, so the Kaggle notebook is self-contained and never imports `f1podium`.
- **Kaggle differs only in paths.** The first cell finds `results.csv` under `/kaggle/input` and writes artifacts to `/kaggle/working/artifacts`.
- **Reports don't retrain.** They read the saved CSVs and figures, so a number in a table is the number the pipeline produced.
- **Tests sit beside the engine.** They import `pipeline.py` and run on `data/raw`.
- **Submitted:** the executed notebook, the compiled PDF, `pipeline.py`, the tests and the raw data.
- **Regeneration order after any change:** edit `pipeline.py` → `run_analysis.py` → `build_notebook.py` and execute it → `build_report_latex.py` and compile → `export_ui_data.py`.

---

# Part 3: The F-row decision and everything that changed

## The instructor's two rulings

- **@16:** choosing the row of the car the driver *finished* in, instead of the one they started in, is **not** a post-race cut-off violation. Our shared-drive tie-break is allowed, and no change was needed.
- **"Removing F rows, Keeping W":** only `F` rows may be removed, because they are the only ones known before the race starts. `W` rows may not be removed.

## What we did, and why

The brief's unit is one driver *entering* one race. An `F` driver did not enter, so the row does not belong. The old reason for keeping them ("dropping them barely changes scores") was weaker than the instructor's reasoning. The `F` rows are now removed **before any feature is built**.

| | Before | After |
| --- | --- | --- |
| Modeling rows | 26,668 | **25,302** (−1,366) |
| Podium rate | 12.73% | **13.42%** (the removed rows never podium) |
| Training rows / podium rate | 24,529 / 12.5% | 23,163 / 13.3% |
| Validation and test rows | 780 / 1,359 | unchanged |
| `pit_lane_start = 1` | 1,635 | **289** (202 withdrawals, 87 real starts) |
| Mean `field_size` in training | 25.1 | 23.2 |
| Questions 1 and 3 | | identical |
| Question 2 | | 20 rows leave the 16+ band, rates unchanged |

**Why before features:** dropping the rows from the training set after features were computed would leave skipped weekends counted as races (with 0 podiums) in the five-race form windows and in `driver_races_before`, and would keep inflating `field_size`.

**Evidence the choice is safe:** keeping the `F` rows instead changes validation PR-AUC by −0.0012 (logistic regression) and −0.0038 (network); dropping them from training only changes it by −0.0008 and −0.0010. The largest change is 0.0038, against a network seed spread of about 0.007. Removing `W` rows as well, which the ruling forbids, would cost the network 0.046.

## Other changes made in the same pass

1. **Cleaning EDA has three stages** (raw, shared drives resolved, `F` rows removed), in the notebook, both reports and the figure.
2. **Network regularization 0.002 → 0.02.** With the new data the validation search ranked alpha 0.02 first (0.7253 over three seeds) and the starting 0.002 second (0.7211). The gap is inside the seed spread (about 0.007), but the stronger penalty is also the simpler model, so it was adopted. The forest's adopted setting (depth 12, leaf 30) now ranks first too.
3. **A bootstrap over the 68 test races was added** (`test_uncertainty.csv`). It resamples predictions that already exist and chooses nothing. Reason: the old argument that the models are tied relied on the network's seed spread, and with the final numbers the test gap between logistic regression and the other two (0.013) is larger than that. The bootstrap shows both differences include zero.
4. **Notebook and report text is generated from the artifacts**, with build-time guard assertions, so it cannot drift from the tables again.
5. **Tests:** two rewritten, three added (20 in total). The README's Piazza log, project contract, flowchart, results and test list were updated, and the UI text and metadata (row counts, podium rate, network description) now read from the data.
6. Small fixes: the report's ablation chart now has readable axis ticks; "improved/confirmed" wording about the models follows the search table.

## How to defend it in the oral

- "The instructor ruled `F` is known before the race, so those drivers did not enter. We remove them before building features so a skipped weekend never counts as a race, and we keep `W` because that code is only known after the race."
- "It barely changes the scores (at most 0.004 on validation), so the decision is about what a row means, not about performance."
- "Questions 1 and 3 did not change at all, and Question 2 lost 20 rows."

---

# Part 4: Questions still worth asking the TA

Crossed off by the rulings above: the non-starters question and the shared-drive tie-break. Still open, in priority order:

1. **Team renames.** Should Toro Rosso and AlphaTauri, or Renault and Alpine, count as one constructor for Question 3 and the form features? We key on `constructorId`, so a renamed team starts with no history. We have not tested merging.
2. **Round-1 standings.** For round 1 of a season, should prior points and rank be zero, carried over from last season's final standings, or missing? All round-1 rows (14% of training rows) currently get the training median (4 points, rank 12) instead of the true 0 points.
3. **`year` and `round` as features.** With a chronological split the test years sit about 1.8 standard deviations beyond the training range. Their one-feature AUC is 0.50 and the whole context group adds 0.004 PR-AUC. We can drop them cheaply.
4. **Mechanical-retirement edge cases.** Should Engine fire and Heat shield fire count (the instructor named only plain Fire)? What about vague labels like Technical or Mechanical? Is the denominator all starters, including lapped finishers?
5. **Home-race control.** Is stratifying by grid band enough, or do you want a regression with a home indicator and grid as covariates? Our nationality map covers 27 nationalities and drops drivers outside it.
6. **Explainability choices.** We explain the random forest, while the best model by validation PR-AUC is the network. Is that acceptable, and is a hand-written LIME acceptable instead of the `lime` package?
7. **Reporting a tie.** With 39 validation and 68 test races the three models are statistically tied. Is it fine to report that and keep logistic regression as the baseline, or would you prefer time-series cross-validation?

Practical tip: for any ruling that would change code, ask the TA to confirm it on Piazza so it is on record.
