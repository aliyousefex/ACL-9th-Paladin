# Study guide: F1 podium-prediction notebook

Written for: a team member who must explain and defend `notebooks/milestone_1_f1_podium_prediction.ipynb` in the oral evaluation (the brief says *any* member can be asked about *any* part).

## The files

| File | What it covers |
| --- | --- |
| `00_START_HERE.md` (this file) | How to use the guide, **warnings about stale documents and weak spots**, the notebook map |
| `01_project_requirements_and_concepts.md` | What the project is, what each requirement asks, how data flows, plain-language glossary |
| `02_cells_00-12_setup_cleaning_features_split.md` | Cells 0-12: setup, keys, loading, audits, shared-drive cleaning, modelling table, split helpers |
| `03_cells_13-28_models_preprocessing_experiments.md` | Cells 13-28: models, metrics, preprocessing, feature evidence, missing values, tuning, robustness, sprints, non-starters |
| `04_cells_29-40_questions_xai_inference_runner.md` | Cells 29-40: the three data-engineering questions, plots, SHAP/LIME/logistic explanations, inference, `run_analysis` |
| `05_cells_41-106_results_walkthrough.md` | Cells 41-106: every executed result section, how to read each table/figure, what to say |
| `06_defense_pack.md` | **The four things you asked for:** overview, requirement map, likely questions with answers, revision checklist |

## Conventions

- **"Cell N" is the 0-based position in the `.ipynb` file.** Cell 0 is the title markdown cell, so "Cell 40" is the 41st cell from the top. Section headings (e.g. "## 8. Audit, cleaning, and before/after EDA") are quoted so you can also find cells by title.
- `(md)` = markdown cell, `(code)` = code cell.
- Every number comes from the **saved outputs inside the notebook** and from `artifacts/*.csv`. I did **not** re-run the notebook: this machine cannot import scikit-learn, and I do not bypass that. Where a number is not in a saved output, I say so.
- Where I am explaining something that is my own inference rather than something the notebook or README states, I mark it "(my inference)".

---

## Read this first: things that can hurt you tomorrow

### 1. Two documents in the repo are out of date. Do not quote them.

The **notebook is the source of truth** (it is what gets graded and its outputs match `artifacts/`). The 16-feature, `round`-removed, logistic-regression-selected version is the final one (commits `27c59a6` "Remove round, keep year... logistic regression becomes the selected model" through `1d70d35` "final").

| Fact | Stale document says | Current notebook says |
| --- | --- | --- |
| Number of features | **17**, including `round` (README lines ~251-259; Q&A PDF) | **16**, `round` removed (cells 4, 51, 63-64) |
| Rows in the modelling table | 26,668, podium rate 12.7% (Q&A PDF) | **25,302**, podium rate **13.4%** (after also removing 1,366 `F` rows; cells 40, 42) |
| Training rows | 24,529 (65.9% no qualifying) (Q&A PDF) | **23,163** (64.0% no qualifying) (cell 69) |
| Best model on validation | "The neural network won validation PR-AUC" (Q&A PDF); "network has the highest validation PR-AUC (0.735)" (README "Verified headline results") | **Logistic regression: 0.730**; forest 0.717; network 0.717 (cell 86) |
| Test PR-AUC | LR 0.704 / bootstrap +0.0135 for both (README line ~301) | LR **0.702**, forest **0.717**, network **0.716**; bootstrap differences +0.0149 and +0.0134 (cells 86, 92) |
| PK / FK audit scope | "11 tables... nine relationships" (Q&A PDF) | **14** tables, **22** foreign-key relationships (cell 42) |
| Rows left if you drop rows with missing values | "7,372 to 8,348" (README ~line 539) | **8,348** and **8,054** (cell 83) |
| Network alpha story | "the starting alpha 0.002 ranked second to 0.02" (README) | by the 3-seed average the adopted alpha 0.02 ranks 7th of 12 and the starting 0.002 ranks 9th (cell 89 / `hyperparameter_search.csv`) |

The Q&A PDF (`reports/milestone_1_evaluation_qa.pdf`, dated Oct 8) and the script that builds it are already listed in `.gitignore` as personal study material. The README has uncommitted edits in your working tree (`git status` shows `M README.md`). The LaTeX report's text I spot-checked (it says "all 16 features") agrees with the notebook, but I did not proofread it end to end.

### 2. Small wording slips inside the notebook (better you know than the evaluator finds them)

- **Cell 102 (md)** says `grid_position` is "about five times larger than any other weight". Precisely: |-1.44| is **2.3x** the next weight (`pit_lane_start`, -0.63), **4.0x** `year` (-0.36) and 4-5x most of the rest. Say "more than twice the next largest and four to five times most others".
- **Cell 90 (md)**, random-forest paragraph: "The best setting ... is only 0.000 higher". The adopted forest setting (depth 12, leaf 30) **is** the top-ranked setting in the search (rank 1 of 9), so there is no gap to the best. That sentence is a leftover from an earlier version.
- Cross-references inside the markdown ("section 10.3", "section 14.1", "section 11.1") are all correct. They point to cells 62-64, 88-90 and 71-73 respectively, so you can follow them.

### 3. What I cannot verify from the files

- **The Piazza posts** (@6-@16 and "Removing F rows, Keeping W"). The notebook comments and the README quote them, and the notebook itself says "the original Piazza export is not archived in this repository" (cell 49, cell 106). If an evaluator asks to see the ruling, you only have your teammates' summary.
- **The saved outputs were produced on a local Windows machine**, not on Kaggle (cell 2's output shows `C:\D-\semester-9\...` paths; versions in `summary.json`: Python 3.12.10, pandas 3.0.6, scikit-learn 1.9.1). The brief requires a Kaggle notebook link. I can't confirm the Kaggle copy has been run or is accessible. The README's own to-do says to confirm both links open.

### 4. Real weak spots: have an honest answer ready

These are things a sharp evaluator could probe. The honest answers are in `06_defense_pack.md`.

1. **One absurd qualifying time is left in.** `qualifying.csv` row `qualifyId 2569` (raceId 255, driverId 87) has `q1 = "16:42.640"` = 1002.64 s. It is almost certainly a typo in the source. The parser converts it faithfully and nothing clips it, which is why `qualifying_time_seconds` has a max of 1002.64 and a scaled max of about 97 standard deviations (cells 75, 77, 78). The notebook mentions the 97 SD but never says it is a data error.
2. **`field_size` and `pit_lane_start` include `W` (withdrew) rows.** The instructor said the `W` code is only known after the race, which is why those rows were *kept*, but they still feed `field_size` (row count per race) and `pit_lane_start` (grid 0). The effect is tiny (289 rows flagged), and it follows the instructor's ruling.
3. **LIME is a hand-written implementation, not the `lime` package**, and its local fidelity (weighted R^2) is only **0.20**. The notebook says so openly (cell 99) and keeps local SHAP as a cross-check.
4. **Permutation importance, SHAP and LIME explain the random forest, not the selected logistic regression.** The selected model is explained separately, directly from its coefficients (cells 100-102).
5. **`year` is a feature and the test years (2022-2024) lie outside the training years (1950-2019).** A forest treats 2022 as 2019; the notebook states this caveat (cell 64).
6. **Validation F1/precision/recall are optimistic**, because each threshold was tuned on validation to maximise F1. Test numbers are the unbiased ones (e.g. LR on test: precision 0.53, recall 0.89, so the threshold transfers imperfectly).
7. **Only the network is averaged over 3 seeds.** Logistic regression is deterministic, but the random forest is also random and was run with one seed (42) everywhere.
8. **The ablation uses logistic regression only and one validation window (39 races).** The bootstrap shows validation PR-AUC has a ~0.2-wide 95% interval.
9. **Probabilities are not calibrated.** `class_weight="balanced"` inflates positive-class probabilities, which is why thresholds are 0.625 (LR) and 0.775 (forest), not 0.5. The notebook states "not formal calibration" (cell 106).
10. **Q1 per-circuit samples are small** (>=10 front-row starts per circuit-era; the 2014-2024 leaders have only 14-22).
11. **Team renames reset constructor form** (cell 66-67) and the mechanical-retirement list counts wing/wheel/tyre/suspension statuses (instructor ruling; a stricter list is shown as a sensitivity).
12. **The Indianapolis 500 (1950-1960) is neither excluded nor mentioned anywhere in the notebook, README or code**, although the course primer (`f1-introduction.pdf`, "Oddities of early F1") says excluding it is a defensible choice that should be documented. It is 11 races, 381 modeling rows (1.6% of training), and 380 of the 2,304 home rows in Q2. Re-running Q2 without them gives OR 0.957 (CI 0.802-1.136), the same conclusion. Models were not re-trained without them. Details and a ready answer: `09_data_files_columns_cleaning_features.md` section 11.

**New file for data questions:** `09_data_files_columns_cleaning_features.md` covers where the 14 raw CSVs are (`data/raw/`, tracked by git), every table and column, the cleaning steps with row counts, and the 16 features. (An earlier version of this guide wrongly implied the raw CSVs were not in the repo; they are.)

---

## Who the README says did what (the evaluator can still ask anyone)

| Teammate (README) | Main area | Notebook cells that match |
| --- | --- | --- |
| Yahia | EDA, the three data-engineering questions, feature evidence | 14 (`cleaning_eda`), 20 (`feature_eda`), 30-32, 41-49, 59-61 |
| Rana | Models, evaluation, ablation, XAI | 14, 20 (`ablation_experiments`), 24, 34-36, 85-102 |
| Ali | Cleaning, relational integrity, integration | 2-8, 10 (`build_modeling_table`), 28 (`non_starter_*`), 38-46 |
| Aya | Preprocessing, feature engineering, splitting | 10, 12, 16, 18, 51-55, 68-84 |

Your `git config` user is "ali yousef", so if you are the "Ali" in the README, your deepest questions will be on Sections 2-2.2, 8 and 8.1 (loading, sentinels, keys, shared drives, grain, `F`/`W` rows, grid 0). Still read everything: the checklist says any member can be asked about anything.

---

## One-page map of the notebook

| Notebook section | Cells | What happens |
| --- | --- | --- |
| Title, 0. Kaggle setup | 0-2 | Find the data folder (local or Kaggle) and an output folder |
| 1. Imports and analytical contract | 3-4 | Libraries, the 16 features in 5 groups, primary/foreign-key declarations |
| 2. Loading and relational audits | 5-6 | Load 14 CSVs (`\N` -> missing), PK/FK audit, raw-table profile |
| 2.1 Cleaning the race results | 7-8 | Time parser; shared-drive duplicate rule |
| 2.2 Building the modelling table | 9-10 | Joins, target, features, leakage controls |
| 3. Chronological splitting | 11-12 | Train 1950-2019 / val 2020-21 / test 2022-24, integrity checks, random-split comparison |
| 4. Cleaning EDA and model definitions | 13-14 | Before/after cleaning table; the three models; thresholds; metrics |
| 4.1 / 4.2 Preprocessing | 15-18 | Preprocessing experiments, order experiments, effects, plots |
| 4.3 Feature evidence and ablation | 19-20 | Ablation, per-feature EDA |
| 4.4 Missing-value experiments | 21-22 | Impute vs drop columns vs drop rows |
| 4.5 Hyperparameter search | 23-24 | 29 settings across 3 models |
| 4.6 Robustness and historical checks | 25-26 | Constructor renames, `round`/`year`, validation windows, bootstrap |
| 4.7 Sprints and non-starters | 27-28 | Sprint leakage check; `F`/`W`/grid-0 audit and experiment |
| 5. Data-engineering questions | 29-30 | Q1 front-row, Q2 home race, Q3 mechanical retirements |
| 5.1-5.3 Plots and explanations | 31-36 | Plot helpers; SHAP, LIME; logistic-regression explanation |
| 6. Inference and end-to-end execution | 37-38 | `predict_podium`; `run_analysis` (the whole pipeline) |
| 7. Run the complete pipeline | 39-40 | **The one cell that actually computes everything** |
| 8-18 | 41-106 | Display and interpret each result (tables, figures, conclusions, limitations) |

**Key idea to hold on to:** cells 2-38 only *define* things (functions and constants). Nothing heavy runs until **cell 40**, which calls `run_analysis(...)` once and stores everything in the dictionary `results`. Cells 42-104 then just *display and discuss* pieces of `results`. If cell 40 has not been run, every later cell fails with `NameError: results`.
