# MASTER STUDY GUIDE: Formula 1 Podium Prediction (ACL-903, Milestone 1)

**Written for:** a teammate who must explain and defend the whole project at tomorrow's oral evaluation, and who owns the EDA (data audit, cleaning, EDA, the three data-engineering questions and the feature evidence).

**What this file is.** Everything we did in this study session, in one place: (1) the **official checklist mapped to the notebook and report**, (2) a one-page story, key numbers, the **ranked list of things to own**, a changelog of corrections and the submission status, and then (3) **all twelve parts** of the earlier guide (Parts 0-11), complete and unabridged. Nothing was re-run (scikit-learn is blocked on this machine); every number comes from reading the notebook, `artifacts/`, `data/raw/` and the report, and my own pandas checks are tagged **[my check]**.

**Nothing in your repo was changed** except one new untracked folder, `study-guide/`. The README says not to commit personal study notes and `study-guide/` is not in `.gitignore`, so do not run `git add .`.

---

## Contents

| Section / Part | What it is |
| --- | --- |
| [A. How to use this file](#a-how-to-use-this-file) | Reading plans, conventions, who owns what |
| [B. The official checklist, mapped to the project](#b-the-official-checklist-mapped-to-the-project) | Every checkbox: status, notebook cells, report section, figures, one-line answer, what to own |
| [C. The project on one page](#c-the-project-on-one-page) | The data flow and the story in a dozen lines |
| [D. Key numbers, consolidated](#d-key-numbers-consolidated) | Everything numeric you should know cold |
| [E. Things to own: the ranked weak spots](#e-things-to-own-the-ranked-weak-spots) | 20 honest gaps, ordered by risk, with the safe answer |
| [F. Corrections and updates made along the way](#f-corrections-and-updates-made-along-the-way) | What I got wrong or found out later, and what changed |
| [G. Deliverables and submission status](#g-deliverables-and-submission-status) | Brief deliverables 1-8 and the submission items |
| [Part 0](#part-00) | Start here: file index, stale documents, weak spots, notebook map |
| [Part 1](#part-01) | Project description, F1 primer, requirement IDs, data-flow diagram, glossary |
| [Part 2](#part-02) | Notebook cells 0-12: setup, loading, audits, cleaning, table building, split |
| [Part 3](#part-03) | Notebook cells 13-28: models, preprocessing, experiments |
| [Part 4](#part-04) | Notebook cells 29-40: the three questions, plots, XAI code, inference, the runner |
| [Part 5](#part-05) | Notebook cells 41-106: every executed result, section by section |
| [Part 6](#part-06) | Defense pack: overview, requirement map, 52 Q&As, revision checklist |
| [Part 7](#part-07) | **EDA owner's guide:** every EDA stage, line by line |
| [Part 8](#part-08) | **EDA question bank:** about 130 likely questions with answers |
| [Part 9](#part-09) | **The data:** where the CSVs are, every table and column, cleaning with row counts, the 16 features, Indianapolis 500 |
| [Part 10](#part-10) | Do renames reset team history? Objective 1 (cleaning and auditing) bullet by bullet |
| [Part 11](#part-11) | "Explanations are not causal effects": where we state it, rank/sign flips, wording watch-list |

---

## A. How to use this file

### A1. Reading plans
| Time | Read |
| --- | --- |
| **30 minutes** | Sections B, C, D, E of this front section, then Part 6 section 1 (the 30-second and 2-minute overviews) |
| **2 hours** | The above, plus Part 6 (Q&A), Part 1 glossary, Part 7 sections 3-8 and 13-15, Part 8 sections A-F and M |
| **A full evening** | Everything in order; do the rehearsal drills at the end of Parts 6 and 8 aloud |

### A2. Conventions
- **"Cell N" is the 0-based index in `notebooks/milestone_1_f1_podium_prediction.ipynb`** (cell 0 is the title). Section titles are quoted too, so you can find cells by title.
- **"File NN" in the Parts means Part NN here** (the Parts were written as separate files `00_...md` to `11_...md`).
- **[notebook]** = printed in the notebook or saved in `artifacts/`. **[report]** = in `reports/milestone_1_analytical_report.tex`. **[my check]** = I computed it with pandas on `data/raw/*.csv` or `artifacts/modeling_table.csv`; it is not in the notebook, so say "we checked this separately".
- **Report section numbers** below are taken from the order of headings in the `.tex` (Section 4 = the three questions, with 4.1, 4.2, 4.3 for Q1-Q3, and so on); the PDF pagination may differ.
- **The key idea to hold:** cells 2-38 only *define* functions; **cell 40 runs everything** into the dict `results`; cells 41-106 only *display and interpret* it. Nothing after cell 40 works unless cell 40 has run.

### A3. Your role
You said you own EDA. The README's team split lists EDA, the three data-engineering questions and the feature evidence together, so your core material is **Parts 7-11** plus checklist items B1-B9 below. The brief says any team member may be asked about anything, so skim the rest.

---

## B. The official checklist, mapped to the project

This is the checklist from the brief (page 7). For each item: **Status**, where in the **notebook** and **report**, the **figures**, the **sentence to say**, and what to **own** (an honest gap). "Learn" points to the Part that teaches it.

> **The brief's overarching rule:** "All plots and data-engineering answers included in both the notebook and the structured report." Every item below has its plot in the notebook (displayed from `artifacts/figures/`) and in the report.

### ☐ Exploratory Data Analysis (EDA)
- **Status: Done** (programmatic, before and after cleaning, with figures).
- **Notebook:** raw-table profile (cell 6, shown in cell 42); before/after cleaning (cell 14, cells 42-43); grid-0 audit (cells 44-46); qualifying coverage (cell 32, cell 42); per-feature EDA (cell 20, cells 59-61).
- **Report:** Section 2 (checks before trusting the joins), Section 3 (qualifying coverage), Section 5.3 (evidence per feature).
- **Figures:** `raw_table_profile.png`, `cleaning_before_after.png`, `qualifying_coverage.png`, `feature_eda.png`.
- **Say:** "Every EDA output is a function that runs in `run_analysis` and writes a CSV and a PNG. Cleaning moves the podium rate from 12.73% to 13.42% only because 1,366 non-podium rows leave; no podium was lost."
- **Own:** no histograms or correlation matrix; one 1,002.64 s qualifying time left in; the Indianapolis 500 not handled (section E).
- **Learn:** Part 7 sections 3-8, Part 8 sections A-F.

### ☐ Data Cleaning
**– ☐ Sentinel handling (`\N`), semantic typing**
- **Status: Done** (we typed the columns we use).
- **Notebook:** `na_values=["\\N"]` in `load_raw_tables` (cell 6); `_time_to_seconds` (cell 8) turns `q1/q2/q3` strings like `"1:26.572"` into 86.572 s; `pd.to_datetime` for the race date and birth date (cell 10); effects shown in cells 75-76. **Report:** Section 2.
- **Evidence:** 0 of 1,125 race dates, 0 of 861 birth dates and 0 of 19,814 qualifying strings fail to parse [my check]. Test: `test_duration_parser_handles_valid_and_missing_values`.
- **Own:** other date and duration columns (`fp1_date`, `fastestLapTime`, `lap_times.time`, `pit_stops.duration`) stay as text because they are unused post-race or schedule columns.
- **Learn:** Part 10 section B2, Part 9 sections 1 and 5.

**– ☐ Grain fixed to one row per `(raceId, driverId)`, duplicates documented**
- **Status: Done.**
- **Notebook:** `clean_results` (cell 8); counted in `cleaning_eda` (cell 14); displayed and explained in cells 42-43. **Report:** Section 2.
- **Rule:** keep the car the driver started (`grid > 0`), then the best `positionOrder`, then the smallest `resultId`. **Evidence:** 85 groups (176 rows), 91 rows removed, 0 duplicates after; podium rate 12.69% to 12.73%, median grid 12 to 12; `assert` and `unique_grain: True`; 79 of the 85 groups are in the 1950s [my check]. Tests: `test_duplicate_rule_prefers_a_started_car_then_best_finish`, `test_randomized_duplicate_cleaning_is_deterministic_and_unique`.
- **Also:** 1,366 `F` rows (never entered) removed before features; `W` kept (instructor ruling).
- **Learn:** Part 10 section B3, Part 7 section 4, Part 2.

### ☐ Data Analysis: plotting the results
- **Status: Done.** The descriptive analysis is the EDA plus the question plots.
- **Figures (19 PNGs in `artifacts/figures/`):** the four EDA figures above, the four question figures, `chronological_split.png`, `preprocessing_distributions.png`, `preprocessing_ranges.png`, `model_comparison.png`, `ablation.png`, and the XAI figures.
- **Own:** four question figures have no title (`front_row_conversion`, `home_effect`, `home_effect_exact_grid`, `mechanical_retirements`); describe each aloud.
- **Learn:** Part 7 sections 3-5 for how to read each figure.

### ☐ Answering the Data-Engineering Questions (all 3)
**– ☐ Plotting the results** and **– ☐ Answered in markdown in the notebook, and added to the report**
- **Status: Done.**
- **Notebook:** `engineering_answers` (cell 30), plots (cell 32), tables and figures (cells 47-48), written answers in markdown (**cell 49**). **Report:** Section 4 (4.1 Q1, 4.2 Q2, 4.3 Q3).
- **Figures:** `front_row_conversion.png`, `home_effect.png`, `home_effect_exact_grid.png`, `mechanical_retirements.png`.
- **Answers:**
  - **Q1:** front-row-to-podium conversion rises **56.1% (1950-2013) to 76.0% (2014-2024)** and the leading circuits change (Magny-Cours, Istanbul, Dijon before; Suzuka, Yas Marina, Monaco since). Uses final **grid**, not qualifying position.
  - **Q2:** after controlling for starting position, Mantel-Haenszel home odds ratio **0.955, 95% CI 0.825-1.110**: no demonstrated home effect (association, not causal).
  - **Q3:** mechanical-retirement rate falls **10.1% to 6.1%** of starts (official list; 8.4% to 5.6% on the stricter list). 2014-21 leaders Caterham 23.5%, Lotus F1 20.0%, Toro Rosso 16.5%; 2022-24 leaders Alfa Romeo 12.5%, Alpine 11.0%, AlphaTauri 8.0%.
- **Own:** small samples (7-11 races per circuit in Q1; Caterham 34 starts); the mechanical list follows an instructor ruling that is not archived; the Indianapolis 500 makes up 380 of Q2's 2,304 home rows (re-run without them: OR 0.957, CI 0.802-1.136).
- **Learn:** Part 7 section 10, Part 8 sections H-J, Part 4.

### ☐ Feature Selection
**– ☐ Reason for chosen features, with evidence**
- **Status: Done** (hypothesis-driven by EDA plus experiments).
- **Notebook:** the 16 features and 5 groups (cell 4); `feature_eda` (cell 20); cells 59-61 (one-feature AUC, training seasons only, with the validation check); `round` removed and `year` kept by experiment (cells 62-64); missing-value experiments (cells 82-84); ablation (cells 94-96). **Report:** Sections 5 and 5.3-5.4.
- **Say:** "Position, standings and form are strong single signals (AUC 0.12 and 0.095 for position, 0.72-0.83 for form and points); qualifying time, age, flags and `year` are near 0.5 alone and are kept for stated reasons; `round` was removed because adding it changed validation PR-AUC by -0.0008 to +0.0003, inside seed noise."
- **Own:** AUC is one feature at a time and an association; no correlation matrix (grid and qualifying position correlate 0.97 [my check]).
- **Learn:** Part 7 section 8, Part 9 section 8, Part 8 section F.

**– ☐ Plotting the effect of the features**
- **Figures:** `feature_eda.png` (16 panels: podium rate by feature bin, training seasons; orange bar = rows where the feature is missing), `ablation.png`, `permutation_importance.png`, `shap_global.png`, `logistic_weights.png`.

**– ☐ Leakage-safe form feature implemented (using only past races)**
- **Status: Done.**
- **Notebook:** `build_modeling_table` (cell 10): `shift()` then `rolling(5, min_periods=1)` for driver form; constructor results **aggregated per race before shifting**; standings attached to the **next** race (`_previous_standings`); round-1 standings set to 0 points, rank 0 (cells 53-55); the leakage statement in cell 52. **Report:** Section 5.
- **Tests:** `test_form_features_cannot_see_current_target`, `test_current_race_result_cannot_change_its_own_features` (set a race's `positionOrder` to 99 and assert the features are unchanged while the label changes).
- **Own:** the window length 5 was never tuned; renamed teams reset constructor form (30 of 780 validation rows, 20 of 1,359 test rows, no podiums).
- **Learn:** Part 7 section 9 (toy example), Part 10 Part A, Part 2.

### ☐ Data Pre-processing and Feature Engineering
**– ☐ Effect of the step on data distribution/range/values**
- **Status: Done.**
- **Notebook:** `feature_engineering_effects` (cells 74-76: raw `grid` has 1.1% zeros that would sit "ahead of pole", `grid_position` makes them missing; qualifying strings become seconds; joined qualifying time is missing for 59%); `preprocessing_effects` (cells 77-78: median imputation shrinks the standard deviation of the 64%-missing qualifying features by about 40%; standardisation keeps long tails, so the 1,002.6 s time lands 97 SD out; validation and test are not centred because the transform is fitted on training only: `year` +1.7 SD). **Report:** Sections 6.1-6.2.
- **Figures:** `preprocessing_distributions.png`, `preprocessing_ranges.png`.
- **Learn:** Part 5 section 12, Part 3.

**– ☐ Preprocessing-order experiment(s) reported**
- **Status: Done** (the brief requires at least two; we report three, plus three strategies and eight missing-value variants).
- **Notebook:** `preprocessing_order_experiments` (cell 16, shown in cells 79-81); missing-value experiments (cells 82-84). **Report:** Sections 6.3-6.4.
- **Results (validation PR-AUC, logistic regression / network):** A impute-then-scale 0.7301 / 0.7166 vs scale-then-impute 0.7301 / 0.7330; B zero-fill-then-scale 0.7262 / 0.7401 vs scale-then-zero-fill 0.7304 / 0.7347; C scaling fitted on all years 0.7302 / 0.7374. The logistic model (no seed) stays within about 0.004 across all five variants; the network's changes are inside its seed noise (one seed can sit 0.021 from its mean). **Decision:** split, then median imputation, then scaling (forest: median imputation, no scaling), fitted on training only. Experiment C is leakage, shown only as a contrast.
- **Learn:** Part 5 section 13, Part 3.

### ☐ Proper Dataset Splitting for training, validation and testing
- **Status: Done.**
- **Notebook:** `split_by_time` (cell 12); displayed and justified in cells 68-73. **Report:** Section 5 (split paragraph) and 7.2.
- **Split:** chronological by season: **train 1950-2019 (23,163 rows, 1,018 races), validation 2020-2021 (780, 39 races), test 2022-2024 (1,359, 68 races)**; all seven integrity checks pass; training fits the imputer, scaler and weights, validation makes every decision, test is scored once.
- **Justification:** random-row and random-race splits leak same-race and future information (held-out rows have later seasons in training; random-row held-out races are also in training for 100%); a validation-window experiment (2014-15, 2016-17, 2018-19, 2020-21) shows scores move by a few hundredths; a race-cluster bootstrap gives a 39-race validation interval about 0.2 wide.
- **Figure:** `chronological_split.png`.
- **Own:** training scores are lower than validation (distribution shift: 13.3% vs 15.0% podium rate, 64% vs 0% missing qualifying); test years lie outside the training years for `year`.
- **Learn:** Part 5 section 11, Part 2.

### ☐ Prediction Model
**– ☐ Statistical model / shallow FFNN, and how it works**
- **Status: Done** (three models on the same rows and features).
- **Notebook:** `model_definitions` (cell 14); results (cells 85-93). **Report:** Section 7.
- **Models:** logistic regression (baseline: `C=1`, L2, `liblinear`, `class_weight="balanced"`: a weighted sum of standardized features passed through a sigmoid); random forest (240 trees, depth 12, min leaf 30, `balanced_subsample`: many decision trees averaged); shallow neural network (two hidden layers of 32 and 12 units, `alpha` 0.02, early stopping: stacked weighted sums with nonlinearities).
- **Learn:** Part 3 (how each works), Part 6.

**– ☐ Its limitations**
- **Status: Done, but spread across places** (cells 87, 90, 93, 106; report Section 11). Know per model: **logistic regression** is linear and additive, cannot capture interactions, and correlated inputs make single weights hard to read; **random forest** memorized the training seasons with its first settings (training PR-AUC 0.918), cannot extrapolate `year` (treats 2022 as 2019) and its probabilities are not calibrated; **network** is seed-sensitive (a single seed can sit 0.021 from its 3-seed mean) and the least interpretable. All three: validation is only 39 races, thresholds tuned on validation make validation F1 optimistic, probabilities are not formally calibrated.

**– ☐ Performance during training and validation** and **– ☐ Performance on unseen test data** (all five metrics; thresholds frozen from validation)

| Model (threshold) | Split | ROC-AUC | PR-AUC | F1 | Precision | Recall |
| --- | --- | --- | --- | --- | --- | --- |
| Logistic regression (0.625) | train | 0.899 | 0.562 | 0.578 | 0.461 | 0.773 |
| | validation | 0.926 | **0.730** | 0.700 | 0.630 | 0.786 |
| | test | 0.935 | **0.702** | 0.664 | 0.529 | 0.892 |
| Random forest (0.775) | train | 0.927 | 0.646 | 0.602 | 0.606 | 0.599 |
| | validation | 0.927 | **0.717** | 0.704 | 0.717 | 0.692 |
| | test | 0.937 | **0.717** | 0.657 | 0.662 | 0.652 |
| Shallow network (0.455) | train | 0.902 | 0.576 | 0.525 | 0.603 | 0.465 |
| | validation | 0.922 | **0.717** | 0.710 | 0.784 | 0.650 |
| | test | 0.933 | **0.716** | 0.626 | 0.720 | 0.554 |

  **Say:** all three rank podiums very well (ROC-AUC about 0.93); PR-AUC (primary, because podiums are rare, 13-15% of rows) is 0.70-0.73. **Selection** used validation only: logistic regression has the highest validation PR-AUC (0.730). On test the forest and network are slightly higher (+0.015 and +0.013 PR-AUC), but a 68-race bootstrap puts both differences inside intervals that include 0 ([-0.011, +0.046] and [-0.016, +0.044]), so the three are statistically tied and we keep the simplest, most explainable one. **Own:** validation F1 is optimistic (threshold tuned on it); logistic regression on test has precision 0.53 and recall 0.89, so its frozen threshold flags too many drivers.

**– ☐ Plotting the reports:** `model_comparison.png` (test metrics by model), the validation-versus-test tables, `chronological_split.png`, and the report's model tables.

**– ☐ Feature-group ablation**
- **Status: Done** (cell 20 `ablation_experiments`; cells 94-96; report Section 8; `ablation.png`).
- **Result (validation PR-AUC change, logistic regression, full model 0.730):** without grid **-0.025**, standings **-0.017**, form **-0.016**, qualifying **-0.006**, context **-0.001**. Grid dominates; qualifying adds little once grid is present (it repeats the grid and its penalties). It complements the pre-training EDA: EDA justifies features *before* training, ablation measures contribution *after*.
- **Own:** logistic regression only; one validation window; correlated groups share credit; it measures reliance, not cause.

### ☐ XAI
**– ☐ Global Explanation (permutation importance, SHAP)**
- **Status: Done** (random forest). **Notebook:** permutation importance (cell 32, 1,000 validation rows, 5 repeats); SHAP `TreeExplainer` (cell 34, 400 validation rows); displayed in cells 97-99. **Report:** Sections 9.2 and 9.3. **Figures:** `permutation_importance.png`, `shap_global.png`.
- **Result:** grid position first in every method (permutation 0.098, SHAP 0.140, logistic weight -1.443); the next places go to constructor and driver form, ordered differently by each method (see the SHAP slip in section E, item 2).

**– ☐ Local Explanation (LIME)**
- **Status: Done** (and extended). **Notebook:** a hand-written LIME-style explanation (5,000 perturbations, distance-weighted ridge surrogate) plus local SHAP (cell 34), and the **selected logistic model's exact local log-odds decomposition** (cell 36), displayed in cells 98-102. **Report:** Sections 9.1, 9.4. **Figures:** `lime_local.png`, `shap_local.png`, `logistic_local.png`.
- **The row explained:** driver 847 (a Williams driver, starting P11) at the 2021 Dutch Grand Prix; predicted podium probability 13%, below the 0.625 threshold; the driver did not podium.
- **Own:** LIME's weighted R-squared is only **0.203** (weak, unstable local evidence), so local SHAP and the exact logistic decomposition back it up; it is not the `lime` package.

**– ☐ Plotting and explaining in the report**
- **Status: Done.** Report Section 9 explains every plot; the "**not causal effects**" statement appears in the XAI intro, the coefficient paragraph, the permutation paragraph and the takeaway (Part 11).
- **Own:** permutation importance, SHAP and LIME explain the **forest**; the **selected** model, logistic regression, is explained directly through its weights.

### Also required by the brief
- **Inference function on a complete and a partially-missing record: Done.** `predict_podium` (cell 38), shown in cells 103-105: the complete record gives probability **0.906** (predicted podium); the partial record (only grid 3, field 20, year 2024 supplied) gives **0.387** (not a podium) with `missing_features` listing 11 of 16 features and an explicit imputation warning. **Report:** Section 10.
- **One run-all notebook:** cell 2 finds data locally or in `/kaggle/input`; cell 40 runs everything; sections 0-18.
- **Known limitations in the report:** Section 11 "What we do not want the results to be taken to say", plus the notebook's cell 106.

---

## C. The project on one page

**Task.** Binary classification: will a driver finish in the top three of a Formula 1 race? One row = one driver entering one race, key `(raceId, driverId)`; target `podium = positionOrder <= 3`; prediction made **after qualifying, before the start**, so anything known only after the start is forbidden as a feature (that is data leakage).

```
data/raw/ : 14 CSVs (Kaggle/Ergast, 1950-2024, ~22 MB)
   |  read-only, `\N` -> missing (cell 6)
   v
AUDIT: 14 primary keys + 22 foreign keys: 0 null / 0 duplicate / 0 orphans; raw profile (cells 6, 42)
   |
   v
CLEAN: 26,759 rows --(85 shared-drive groups, -91)--> 26,668 --(1,366 `F` rows, -1,366)--> 25,302
       one row per (raceId, driverId); before/after EDA shows the target barely moved (cells 8, 10, 14)
   |
   v
FEATURES: 16 in 5 groups (grid 4, qualifying 3, form 3, standings 4, context 2), leakage-safe (cell 10)
   |
   v
SPLIT (chronological): train 1950-2019 | validation 2020-21 | test 2022-24 (cell 12)
   |
   v
PIPELINE (fitted on training only): median imputer -> scaler -> model (LR / random forest / shallow NN)
   |  thresholds and hyperparameters chosen on validation only
   v
EXPERIMENTS: preprocessing order, missing values, 29 hyperparameter settings, `round`/`year`, windows, F/W, sprints, ablation
   |
   v
XAI: permutation + SHAP + LIME (forest); coefficients + exact decomposition (selected logistic model)
   |
   v
INFERENCE: predict_podium (complete and partial record)   -->   REPORT (PDF) + notebook + repo
```

**The story in twelve lines.** (1) We predict podiums from pre-race information. (2) 14 linked tables, all keys clean. (3) `results` is unique per `resultId` but not per `(raceId, driverId)`: 85 shared-drive groups, resolved by a rule. (4) 1,366 drivers who never entered a race are removed, per the instructor. (5) Qualifying data exist only from 1994 and are complete from 2003, so we keep a missingness flag and use the grid as the broad position signal. (6) 16 features, each with its own training-only EDA row. (7) Form uses past races only. (8) Chronological split. (9) Three models, same rows and features; logistic regression is the baseline and the selected model. (10) PR-AUC is primary; ROC-AUC about 0.93 for all; the three are statistically tied. (11) Grid dominates every explanation; explanations are associations, not causes. (12) Limitations are stated.

**The 30-second introduction (Part 6 has the 2-minute version):**
> We predict, for every driver in every F1 race from 1950 to 2024, whether they finish on the podium, using only information known after qualifying and before the race. We audited the 14-table dataset, fixed it to one row per driver per race (25,302 rows), engineered 16 leakage-safe features, split chronologically, and compared logistic regression, a random forest and a shallow neural network. All three rank podiums very well (ROC-AUC about 0.93); a race-level bootstrap shows they are tied, so we chose logistic regression as the simplest, most explainable. Grid position dominates in every method, and our explanations describe what the models rely on, not what causes podiums.

---

## D. Key numbers, consolidated

| Topic | Numbers |
| --- | --- |
| **Files** | 14 CSVs in `data/raw/` (tracked by git), ~22 MB; `lap_times` 17.6 MB; source Kaggle `rohanrao/formula-1-world-championship-1950-2020` (files run to 2024) |
| **Rows** | results 26,759; lap_times 589,081; driver_standings 34,863; constructor_standings 13,391; constructor_results 12,625; pit_stops 11,371; qualifying 10,494; races 1,125; drivers 861; sprint_results 360; constructors 212; status 139; circuits 77; seasons 75 |
| **Keys** | 14 PKs (2 composite), 22 FKs: 0 null, 0 duplicate, 0 orphans |
| **Raw missingness** | races 56% (schedule columns), results 25.5%, drivers 20%, constructor_results 20%, qualifying 12.4%, sprint_results 1.3%; 0 full-row duplicates anywhere |
| **Cleaning** | 26,759 to 26,668 (85 groups, 91 rows; 79 groups in the 1950s) to **25,302** (1,366 `F` rows); 1,457 rows dropped in total (5.4%) |
| **Podium rate** | 12.69% raw, 12.73% grain fixed, **13.42%** final (3,395 podium rows constant after dedup); train 13.27%, val/test 15.0% |
| **Grid 0** | 6.12% to 1.14%; of 1,635 grid-0 rows: 1,346 `F`, 202 `W`, only 87 real pit-lane starts; `pit_lane_start` now marks 289 rows |
| **Qualifying** | first season **1994**; 494 of 1,125 races; 44 of 75 seasons empty; erratic 1996-2002 (44%, 59%, 44%, 18%, 24%, 6%, 12%); complete from 2003; 64% of training rows missing, 0.1% validation, 0% test |
| **Modeling table** | 25,302 rows x 44 columns; 16 features; 1,125 races, 814 drivers, 202 constructors |
| **Split** | train 1950-2019: 23,163 rows, 1,018 races; validation 2020-21: 780, 39 races; test 2022-24: 1,359, 68 races |
| **Feature EDA (train AUC)** | qualifying_position 0.095, grid_position 0.119, constructor form 0.826, driver form 0.810, driver points 0.755, constructor points 0.724, front_row 0.672, driver_races 0.662, age 0.552, year 0.505, flags 0.49, field_size 0.454, qualifying time 0.451 |
| **Models** | LR (C=1, L2, balanced); forest (240 trees, depth 12, leaf 30, balanced_subsample); MLP (32,12), alpha 0.02, early stopping |
| **Thresholds** | LR 0.625, forest 0.775, MLP 0.455 (max validation F1) |
| **PR-AUC (val / test)** | LR 0.730 / 0.702; forest 0.717 / 0.717; MLP 0.717 / 0.716 |
| **Test ROC-AUC** | LR 0.935; forest 0.937; MLP 0.933 |
| **Test bootstrap (68 races)** | forest minus LR +0.015 [-0.011, +0.046]; MLP minus LR +0.013 [-0.016, +0.044] |
| **Validation bootstrap (39 races)** | each PR-AUC interval about 0.2 wide; forest minus LR -0.013 [-0.048, +0.028]; MLP minus LR -0.013 [-0.040, +0.015] |
| **Ablation (LR val PR-AUC change)** | grid -0.025, standings -0.017, form -0.016, qualifying -0.006, context -0.001 |
| **Preprocessing order** | A 0.7301/0.7166 vs 0.7301/0.7330; B 0.7262/0.7401 vs 0.7304/0.7347; C 0.7302/0.7374 (LR/network) |
| **Missing values** | drop rows without qualifying (8,348 of 23,163 kept): -0.001 LR, -0.011 network; drop qualifying columns: -0.006 LR, -0.030 network |
| **`round`/`year`** | put `round` back: -0.0008 / -0.0036 / +0.0003 (LR / forest / network); remove `year`: +0.0006 / -0.0123 / -0.0212 |
| **Q1** | front-row conversion 56.1% (n=1,786) to 76.0% (n=454); base rate 13.3% to 14.8% |
| **Q2** | MH odds ratio 0.955, CI 0.825-1.110; 2,304 home / 21,815 away; 928 excluded; without Indy 500: 0.957, CI 0.802-1.136 |
| **Q3** | 10.1% (329/3,257) to 6.1% (83/1,354) official; 8.4% to 5.6% conservative |
| **XAI** | LR weights: grid -1.443, pit_lane_start -0.631, year -0.356, constructor form +0.291; permutation: grid 0.098, constructor form 0.022; SHAP: grid 0.140, driver form 0.070, constructor form 0.065; LIME weighted R-squared 0.203 |
| **Inference demo** | complete 0.906 (podium); partial 0.387 (not), 11 of 16 features imputed and disclosed |
| **Sprints** | 2021: 3, 2022: 3, 2023: 6, 2024: 6; sprint ends the day before the race; 0 training rows; excluded by design |
| **Renames** | 10 team-seasons since 2014; 30 of 780 validation and 20 of 1,359 test rows; no podiums |
| **Indianapolis 500 (1950-60)** | 11 races; 405 raw / 381 modeling rows (1.6% of training); 107 drivers (103 Indy-only); 380 of 2,304 Q2 home rows |
| **Tests** | 24 tests in `tests/test_pipeline.py` |

---

## E. Things to own: the ranked weak spots

Say these before the evaluator finds them. Each has the safe answer and where to read more.

1. **The Indianapolis 500 (1950-1960) is neither excluded nor mentioned anywhere**, although the course primer says excluding it is a defensible choice we should document. *Safe answer:* "We kept it and did not document it, a gap in our write-up. It is 381 modeling rows (1.6% of training), none in validation or test; re-running Q2 without it gives OR 0.957, CI 0.80-1.14, same conclusion. The models were not re-trained without it." (Part 9 section 11)
2. **The report (and the UI Classification page) says permutation importance and SHAP both put constructor form second.** The report's own SHAP table has driver form at 0.0695 and constructor form at 0.0653. Under permutation, constructor form is clearly second (0.022 vs 0.0095). *Safe answer:* "Grid is first under every method; constructor and driver form fill the next two places, in a different order per method." Source: `scripts/build_report.py` lines 1999, 2085, 2223. (Part 11 section 6)
3. **LIME is hand-written and its local fidelity is 0.203.** It is weak local evidence; local SHAP and the exact logistic decomposition back it up. (Part 0, Part 4)
4. **Permutation importance, SHAP and LIME explain the forest, not the selected logistic regression**; the logistic model is explained by its own weights. (Part 11)
5. **The three models are statistically tied.** We select logistic regression on validation PR-AUC (0.730), the test seasons put the forest and network 0.013-0.015 higher, but both differences have bootstrap intervals that include 0. (Part 6)
6. **One implausible qualifying time (1,002.64 s, 1995, `qualifyId 2569`) is left in the data;** it lands 97 SD out after scaling. It is 1 of 10,332 times, in a feature that is 64% missing and weak alone. (Part 7 section 13)
7. **Validation F1 is optimistic** (threshold tuned on it); logistic regression on test has precision 0.53 and recall 0.89. Probabilities are not formally calibrated. (Part 5, Part 6)
8. **Training scores are lower than validation** for all three models: distribution shift (13.3% vs 15.0% podium rate; 64% vs 0% missing qualifying; larger, less reliable fields). (Part 5 section 14)
9. **`year` is a feature but the test years lie outside the training years**; a forest treats 2022 as 2019. The `year` logistic weight is not meaningful on its own. (Part 5 section 10.3, Part 11)
10. **`round` was removed after an experiment;** the README and the old Q&A PDF still say 17 features and other stale numbers (Part 0 has the full list). Quote the notebook.
11. **Constructor renames reset constructor form** (new `constructorId`), and a few ids are reused (Aston Martin 2021 reuses a 1959-60 id). Only constructor form is affected, only in the first five races of the season: 30 validation and 20 test rows, no podiums. The audit covers 2014 onward only. (Part 10 Part A)
12. **The mechanical-retirement list follows an instructor ruling (Piazza @10) that is not archived,** and includes damage-prone labels (wing, wheel, tyre, puncture, suspension, fire). A stricter list is shown as a sensitivity (10.1% to 6.1% vs 8.4% to 5.6%). (Part 7 section 10.3)
13. **Q2's "home" is a nationality-to-country map with 27 entries;** other nationalities are dropped; the odds ratio's interval contains 1 and is wide, so the answer is "no demonstrated effect", not "no effect". (Part 7 section 10.2)
14. **Qualifying-coverage drift:** 64% of training rows have imputed qualifying values; the flag has AUC 0.49 (it marks imputed rows). Dropping those rows costs nothing but loses two thirds of the history. (Part 7 section 5)
15. **The ablation uses logistic regression only and one 39-race validation window;** correlated groups share credit. (Part 5)
16. **No correlation matrix or histograms;** several features overlap strongly (grid~qualifying 0.97, driver~constructor points 0.86, driver~constructor form 0.78), which makes single logistic weights hard to read and flips some signs (`constructor_points_before`, `driver_age`). (Part 7 section 8.8, Part 11 section 4)
17. **Notebook wording slips:** cell 102 says the grid weight is "about five times larger than any other weight" (it is 2.3 times the next); cell 90 contains a leftover "0.000 higher" sentence; four question figures have no titles. (Part 0)
18. **The Kaggle and GitHub links, and whether the Kaggle copy has been run, cannot be verified from the repo;** the saved outputs came from a local run (cell 2 prints a `C:\D-\...\data\raw` path). The Piazza rulings are not archived. (Part 0)
19. **Small simplifications:** `W` rows still count in `field_size` and `pit_lane_start`; disqualified (`Excluded`) starters are dropped from the Q1-Q3 denominators; 18 early races have 4-5 podium rows (shared cars); a trailing-space nationality (`"Argentinian "`, 9 rows) is unmapped. (Part 7 section 7, Part 9)
20. **Sample sizes:** Q1 circuits rest on 7-11 races in 2014-2024; Caterham's 23.5% is 8 failures in 34 starts. Rankings are descriptive.

---

## F. Corrections and updates made along the way

Where I was wrong or found something new, and what changed in the Parts below (the Parts have been fixed; this list tells you what to trust).

| # | What | Correction |
| --- | --- | --- |
| 1 | **Raw CSVs "not in the repo"** (my earlier claim) | **Wrong.** They are in `data/raw/`, 14 files, tracked by git. My first search used a non-recursive glob. Fixed in Parts 7, 8, 9 |
| 2 | `races` 56% / `results` 25.5% missing "unexplained" | Now confirmed from the raw files: `races` = session-schedule columns only; `results` = post-race fields; `drivers` = `number` and `code`; `constructor_results` = `status` (99.9% empty) |
| 3 | "qualifying.csv begins in the mid-1990s" (primer: "must be confirmed") | Confirmed: first season **1994**; 494 of 1,125 races; 44 of 75 seasons empty |
| 4 | The 1954 field of 42 rows was unexplained | It is the **1954 Indianapolis 500** (55 raw rows, 42 after dedup) |
| 5 | Indianapolis 500 not mentioned in the guide | Found it is **not handled** in the project; added numbers, a Q2 re-run (reproduced the notebook exactly, then OR 0.957) and a defense (Part 9 section 11) |
| 6 | Dedup duplicates by decade "not in the notebook" | Added: 79 groups in the 1950s, 5 in the 1960s, 1 in the 1970s; 21 at Indy |
| 7 | "Constructor form second under both" (report, UI) | **Slip** found in the report and UI: under SHAP the second place is driver form (Part 11) |
| 8 | Form-group ablation listed as -0.017 | Corrected to **-0.016** (-0.0165) in Parts 5 and 6 |
| 9 | Earlier wrong bullet: section cross-references as a "wording slip" | They point to the right cells (62-64, 88-90, 71-73); removed |
| 10 | "MCAR/structured missingness" glossary header | Renamed "Structured (non-random) missingness" |
| 11 | Leakage-test description based on test names | Rewritten after reading the test bodies (set `positionOrder` to 99; features unchanged, label changes) |
| 12 | An unsupported claim about what evaluators look for | Replaced with a statement grounded in the brief |
| 13 | README / Q&A PDF numbers (17 features, 26,668 rows, NN best on validation) | **Stale**; the notebook is the source of truth (Part 0) |

---

## G. Deliverables and submission status

**Deliverables from the brief, and status in the repo**

| # | Deliverable | Status |
| --- | --- | --- |
| 1 | One run-all Jupyter notebook (audit, cleaning, questions, features, modeling, experiments, XAI, inference) | Present: `notebooks/milestone_1_f1_podium_prediction.ipynb` (107 cells, run-all ready) |
| 2 | EDA with plots | Present (Part 7; four EDA figures plus question and preprocessing figures) |
| 3 | Unique driver-race modeling table with documented duplicate handling and leakage-safe features | Present (`artifacts/modeling_table.csv`, regenerated by the notebook; `artifacts/` is git-ignored) |
| 4 | Model comparison table (all five metrics, validation and test; primary/secondary metric justified) | Present (cell 86; PR-AUC primary, ROC-AUC secondary) |
| 5 | Feature-group ablation and at least two preprocessing-order experiments | Present (ablation; three order experiments A, B, C) |
| 6 | Global (permutation, SHAP) and local (LIME and/or local SHAP) explanations, plotted and interpreted | Present |
| 7 | Inference function on a complete and a partially-missing record | Present (cells 38, 103-105) |
| 8 | Analytical report (answers to Q1-Q3 with figures; selected features and why each is valid at the cutoff; limitations) | PDFs exist: `reports/milestone_1_analytical_report.pdf` and `..._latex.pdf` |

**Submission items (brief, page 8):** deadline **18 October 2026, 11:59 PM**, via a Google form; an **accessible Kaggle notebook link**; an **accessible GitHub repo link**; the report **in PDF format**. *I cannot verify the links or what was submitted;* the README's own to-do says to confirm both links open. Today is 3 November 2026, so the deadline date has passed; treat this as "know what you submitted".

**At the evaluation (brief checklist):** every member may be asked about cleaning, feature engineering, modeling choices and evaluation metrics (including the primary/secondary choice); explain and justify every step with evidence ("an AI tool suggested it" is not a justification); steps are motivated either **hypothesis-driven** (EDA showed X, so we did Y) or **trial-and-error** (a visible before/after baseline); compare multiple approaches; a baseline (a statistical model or shallow FFNN) is required, and a different architecture must beat it to earn its complexity; the notebook runs top to bottom with Run All, in logical order, with clear markdown.

---

---

<a id="part-00"></a>

## Part 0. Study guide: F1 podium-prediction notebook

> **Note for this combined file:** Part 0 was the original entry point and lists only Parts 0-6 as separate files. Parts 7-11 were added later (EDA guide, EDA question bank, the data catalog, renames and Objective 1, and the not-causal explanations). Sections A-G above are the up-to-date entry point; where Part 0 and sections A-G differ, trust A-G.


Written for: a team member who must explain and defend `notebooks/milestone_1_f1_podium_prediction.ipynb` in the oral evaluation (the brief says *any* member can be asked about *any* part).

### The files

| File | What it covers |
| --- | --- |
| `00_START_HERE.md` (this file) | How to use the guide, **warnings about stale documents and weak spots**, the notebook map |
| `01_project_requirements_and_concepts.md` | What the project is, what each requirement asks, how data flows, plain-language glossary |
| `02_cells_00-12_setup_cleaning_features_split.md` | Cells 0-12: setup, keys, loading, audits, shared-drive cleaning, modelling table, split helpers |
| `03_cells_13-28_models_preprocessing_experiments.md` | Cells 13-28: models, metrics, preprocessing, feature evidence, missing values, tuning, robustness, sprints, non-starters |
| `04_cells_29-40_questions_xai_inference_runner.md` | Cells 29-40: the three data-engineering questions, plots, SHAP/LIME/logistic explanations, inference, `run_analysis` |
| `05_cells_41-106_results_walkthrough.md` | Cells 41-106: every executed result section, how to read each table/figure, what to say |
| `06_defense_pack.md` | **The four things you asked for:** overview, requirement map, likely questions with answers, revision checklist |

### Conventions

- **"Cell N" is the 0-based position in the `.ipynb` file.** Cell 0 is the title markdown cell, so "Cell 40" is the 41st cell from the top. Section headings (e.g. "## 8. Audit, cleaning, and before/after EDA") are quoted so you can also find cells by title.
- `(md)` = markdown cell, `(code)` = code cell.
- Every number comes from the **saved outputs inside the notebook** and from `artifacts/*.csv`. I did **not** re-run the notebook: this machine cannot import scikit-learn, and I do not bypass that. Where a number is not in a saved output, I say so.
- Where I am explaining something that is my own inference rather than something the notebook or README states, I mark it "(my inference)".

---

### Read this first: things that can hurt you tomorrow

#### 1. Two documents in the repo are out of date. Do not quote them.

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

#### 2. Small wording slips inside the notebook (better you know than the evaluator finds them)

- **Cell 102 (md)** says `grid_position` is "about five times larger than any other weight". Precisely: |-1.44| is **2.3x** the next weight (`pit_lane_start`, -0.63), **4.0x** `year` (-0.36) and 4-5x most of the rest. Say "more than twice the next largest and four to five times most others".
- **Cell 90 (md)**, random-forest paragraph: "The best setting ... is only 0.000 higher". The adopted forest setting (depth 12, leaf 30) **is** the top-ranked setting in the search (rank 1 of 9), so there is no gap to the best. That sentence is a leftover from an earlier version.
- Cross-references inside the markdown ("section 10.3", "section 14.1", "section 11.1") are all correct. They point to cells 62-64, 88-90 and 71-73 respectively, so you can follow them.

#### 3. What I cannot verify from the files

- **The Piazza posts** (@6-@16 and "Removing F rows, Keeping W"). The notebook comments and the README quote them, and the notebook itself says "the original Piazza export is not archived in this repository" (cell 49, cell 106). If an evaluator asks to see the ruling, you only have your teammates' summary.
- **The saved outputs were produced on a local Windows machine**, not on Kaggle (cell 2's output shows `C:\D-\semester-9\...` paths; versions in `summary.json`: Python 3.12.10, pandas 3.0.6, scikit-learn 1.9.1). The brief requires a Kaggle notebook link. I can't confirm the Kaggle copy has been run or is accessible. The README's own to-do says to confirm both links open.

#### 4. Real weak spots: have an honest answer ready

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

### Who the README says did what (the evaluator can still ask anyone)

| Teammate (README) | Main area | Notebook cells that match |
| --- | --- | --- |
| Yahia | EDA, the three data-engineering questions, feature evidence | 14 (`cleaning_eda`), 20 (`feature_eda`), 30-32, 41-49, 59-61 |
| Rana | Models, evaluation, ablation, XAI | 14, 20 (`ablation_experiments`), 24, 34-36, 85-102 |
| Ali | Cleaning, relational integrity, integration | 2-8, 10 (`build_modeling_table`), 28 (`non_starter_*`), 38-46 |
| Aya | Preprocessing, feature engineering, splitting | 10, 12, 16, 18, 51-55, 68-84 |

Your `git config` user is "ali yousef", so if you are the "Ali" in the README, your deepest questions will be on Sections 2-2.2, 8 and 8.1 (loading, sentinels, keys, shared drives, grain, `F`/`W` rows, grid 0). Still read everything: the checklist says any member can be asked about anything.

---

### One-page map of the notebook

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

---

<a id="part-01"></a>

## Part 1. The project, the requirements, and the concepts you need


Sources for this file: `course-materials/milestone-1/milestone-1-brief.pdf` (the requirements), `course-materials/milestone-1/f1-introduction.pdf` (the F1 primer), the notebook, and the README.

---

### 1.1 What the project is supposed to do

**One sentence:** for every driver in every Formula 1 race from 1950 to 2024, predict whether they will finish on the podium (1st, 2nd or 3rd), using **only information available after qualifying and before the race starts**.

The brief stresses that this is *not mainly a modelling exercise*. It is a **data-engineering + leakage-control** exercise:

> "...a domain where careful feature engineering and leakage control matter as much as model choice, since results, points, and status are only known *after* the race."

Four definitions from the brief that everything else hangs on:

| Term | Definition in this project |
| --- | --- |
| **Unit of analysis** | One driver entering one race. One row = one prediction. |
| **Target** | `podium = 1` if `positionOrder <= 3`, else 0. (Binary classification.) |
| **Prediction cutoff** | After qualifying, before the race starts. Anything only known after that is forbidden as a feature. |
| **Data leakage** | Using information from the future (relative to the cutoff) as an input. It inflates offline scores and makes the model useless in real use. |

#### F1 mini-primer (from the intro PDF, in your own words)

- A **season** (year) has many **races** (Grands Prix) at different **circuits**. **Drivers** drive for **constructors** (teams). Points go to the **Drivers' Championship** and (since 1958) the **Constructors' Championship**.
- A race weekend: practice -> **qualifying** (fastest lap gets **pole**, P1 on the grid; P1 and P2 are the **front row**) -> **starting grid** (qualifying order *plus penalties*, so **qualifying position != grid position**) -> **race** -> **results** (positions, points, **status** such as "Finished", "+1 Lap", "Engine", "Collision").
- Only about **3 of ~20 drivers** finish on the podium in the modern era (~15%); far less in eras with 30+ entrants. So the positive class is **rare**, which is why PR-AUC is the primary metric.
- **Grid 0** in the data does *not* mean "better than pole". It marks a pit-lane start, or a driver who never took the grid.
- **Qualifying data are patchy:** the dataset has essentially none before 1994, erratic coverage 1994-2002, and near-complete coverage from 2003 (cell 42's coverage figure). The brief calls this "historical qualifying-coverage drift".
- **Shared drives (1950s):** until 1957 a driver could take over a teammate's car mid-race, so the same driver can have two result rows in one race. That breaks "one row per driver per race".
- **Eras matter:** 1.6-litre turbo-hybrid era 2014-2021, ground-effect era 2022-2024, etc. Reliability, field size and who is fast all change.

---

### 1.2 What each requirement asks for

I've given every requirement an ID (R1, R2, ...) so the map in `06_defense_pack.md` can refer to it.

#### R1. Data cleaning and auditing (brief section 1)

| ID | The brief asks for | In plain words |
| --- | --- | --- |
| R1a | Initial EDA, **before and after** cleaning, **with visualisation**, supported by implementation and justification (not manual inspection) | Quantify the data programmatically and show how cleaning changes it, with plots |
| R1b | Clean `\N` sentinels; apply semantic typing (dates -> date objects; lap-time strings -> numeric seconds) | Turn placeholder text into real "missing"; turn text dates/times into real dates/numbers |
| R1c | Exactly **one row per `(raceId, driverId)`**; find duplicates (shared drives); **choose a rule, apply it, explain why** | Make the table's grain match the prediction unit |
| R1d | Verify **primary keys** unique and non-null; **foreign keys** reconcile (every FK value exists in the parent table); raw CSVs immutable, cleaning on copies | Prove the relational structure is sound |

#### R2. Data-engineering questions (brief section 2)

Each needs a **multi-table join**, an **answer**, a **visualisation**, and a short justification of **grain, missingness and (where relevant) the pre-race cutoff**.

| ID | Question |
| --- | --- |
| R2-Q1 | Which circuits convert a front-row start into a podium most often, and does the ranking change after the 2014 hybrid era? Distinguish qualifying position from grid. |
| R2-Q2 | Do drivers podium more often at their home country's circuit, **after controlling for starting position**? |
| R2-Q3 | Which constructors have the highest **mechanical-retirement** rate in 2014-2021 vs 2022-2024? (Crashes, driver errors and regulation decisions are *not* mechanical.) |

#### R3. Feature selection and engineering (brief section 3)

| ID | The brief asks for |
| --- | --- |
| R3a | Feature choices justified with **exploratory evidence** (plots, correlations or experiments): either a hypothesis from EDA **or** trial-and-error kept visible in the notebook |
| R3b | An appropriate **train/validation/test split**, justified |
| R3c | (checklist) **Leakage-safe form feature** that uses only past races |

#### R4. Predictive modelling (brief section 4)

| ID | The brief asks for |
| --- | --- |
| R4a | **>=2 statistical ML models** and **1 shallow neural network (1-2 hidden layers)**, trained on **the same rows and same feature set** |
| R4b | **ROC-AUC, PR-AUC, F1** for every model (the notebook also reports precision and recall: "all five metrics") |
| R4c | Performance on **train/validation** and on the **unseen test set** |
| R4d | **Thresholds and hyperparameters chosen with training+validation only**, never the test set |
| R4e | Justify the choice against a **baseline** (simplest reasonable model) |

#### R5. Experiments (brief section 5 + deliverable 5)

| ID | The brief asks for |
| --- | --- |
| R5a | **Feature-group ablation**: remove one group at a time, retrain, see how much performance drops |
| R5b | **At least two preprocessing-order experiments** |
| R5c | (checklist) Compare multiple approaches for anything you tried to improve; **>=3 distinct modelling attempts**; each attempt visible in its own cell/section with before/after |

#### R6. Explainability, XAI (brief section 6)

| ID | The brief asks for |
| --- | --- |
| R6a | **Global**: permutation importance **and** SHAP |
| R6b | **Local**: at least one single-prediction explanation (LIME and/or local SHAP) |
| R6c | All plotted and interpreted; **state explicitly that explanations are not causal effects** |

#### R7. Deliverables and notebook rules

| ID | Requirement |
| --- | --- |
| D1 | One **run-all** notebook with everything, sectioned, **including the inference function**; no hidden manual cells |
| D2 | EDA with plots |
| D3 | The unique driver-race modelling table with documented duplicate handling and leakage-safe form/standings/grid/qualifying features |
| D4 | Model comparison table (all five metrics, on validation and test) with the **primary/secondary metric justified** |
| D5 | Ablation results and >=2 preprocessing-order experiments |
| D6 | Global and local explanations, plotted and interpreted |
| D7 | **Inference function** demonstrated on a **complete** and a **partially-missing** record |
| D8 | **Analytical report** (PDF): written answers to the three questions with figures, selected features and why each is valid at the cutoff, known limitations (e.g. qualifying-coverage drift, era sensitivity) |

#### R8. What the evaluator will do (checklist page)

1. Any team member can be asked about any step.
2. Every step must be **explained and justified in the F1 context with evidence**. "An AI tool suggested it" is not a justification.
3. Two legitimate ways to motivate a step: **hypothesis-driven** (cite the EDA that led you there) or **trial-and-error** (show before/after on the whole pipeline).
4. Compare multiple approaches; >=3 distinct modelling attempts.
5. A **baseline** (statistical model or shallow FFNN) must be in the notebook.

Submission: Kaggle notebook link (accessible), GitHub repo link (accessible), PDF report. Deadline was 18 Oct 2026.

---

### 1.3 How the data moves through the project

```
 14 raw CSVs (data/raw, read-only)
        |  Cell 6: read_csv(na_values=["\N"])  -> real missing values
        v
 PK / FK audit + raw-table profile  (cells 6, 42)         [R1d, R1a]
        |
        v
 results.csv  --(cell 8) shared-drive rule-->  1 row per (raceId, driverId)   [R1c]
        |
        |--(cell 10) drop positionText == "F" rows (did not enter)            [instructor ruling]
        |
        |--(cell 10) join races, drivers, constructors, circuits, qualifying, standings
        |            build target `podium`, 16 pre-race features (shifted, never same-race)
        v
 MODELLING TABLE: 25,302 rows x 44 columns   (cell 40; saved as artifacts/modeling_table.csv)
        |                                   ^ superset: also keeps post-race columns
        |                                     for the analysis questions. Models only see the
        |                                     16 columns named in FEATURES.
        |-- statuses + nationalities --> Q1, Q2, Q3 tables and figures (cell 30, 48)     [R2]
        |
        v
 chronological split (cell 12):  train 1950-2019 | validation 2020-21 | test 2022-24   [R3b]
        |
        |  fit imputer + scaler + model on TRAIN only (sklearn Pipeline)
        v
 3 models: Logistic regression | Random forest | Shallow MLP (32,12)                    [R4a]
        |
        |-- thresholds chosen on VALIDATION (max F1)         [R4d]
        |-- 5 metrics on train / validation / test           [R4b, R4c]
        |-- experiments on validation only: preprocessing order, missing values,
        |   hyperparameters, ablation, split windows, bootstrap                          [R5]
        |-- explanations: permutation importance, SHAP, LIME (forest); coefficients (LR) [R6]
        v
 predict_podium(record) -> probability + list of imputed fields                          [D7]
```

The **test set is touched once for scoring, after every choice is frozen**. Even the bootstrap on the test seasons (cell 92) only resamples predictions that already exist and decides nothing.

---

### 1.4 Glossary: every technical term you will be asked about

#### Relational data

- **Table / row / column:** a CSV file is a table; one line = a row (record); a header name = a column (field).
- **Primary key (PK):** the column(s) that uniquely identify a row of a table, non-null (e.g. `results.resultId`, or the *composite* key `(raceId, driverId, lap)` for `lap_times`). Audit = count nulls and duplicates; both must be 0.
- **Foreign key (FK):** a column that references a primary key in another table (e.g. `results.driverId` -> `drivers.driverId`). Audit = every non-null value must exist in the parent table. A value that doesn't is an **orphan**.
- **Join / merge:** combining two tables on matching key columns. **`validate="many_to_one"`** makes pandas *raise an error* if the right-hand table has duplicate keys, so a join can never silently multiply rows. **`one_to_one`** requires unique keys on both sides.
- **Grain:** "what one row means". Here: one driver in one race. `results.csv` is *almost* at that grain but not exactly (shared drives).
- **Multi-hop join:** answering a question requires chaining joins through several tables, e.g. `results -> races -> circuits` plus `results -> status`.

#### Missing data

- **Sentinel:** a placeholder that stands for "missing" but is stored as ordinary text. Here the literal two-character string `\N` (backslash, N). If you don't convert it, pandas reads numeric columns as text.
- **NaN / missing:** pandas' real missing marker. `pd.read_csv(..., na_values=["\\N"])` converts the sentinel at load time.
- **Semantic typing:** giving columns their real meaning: date strings -> `datetime`, `"1:23.456"` -> `83.456` seconds, flags -> integers.
- **Imputation:** replacing missing values with an estimate. **Median imputation** uses the middle value of the *training* column. **Missing-indicator flag** (`qualifying_missing`): a 0/1 column recording that the value was missing, so the model can tell a filled value from a real one.
- **Structured (non-random) missingness:** here qualifying is missing *because of the era* (no data before 1994), not at random. That is why a flag is used and why dropping rows would delete two thirds of history.

#### Leakage and splitting

- **Leakage:** see 1.1. Examples here: current-race `positionOrder`, `points`, `status`, `laps`, pit stops, fastest lap, post-race standings. Subtler: including the current race in a "last 5 races" average; attaching post-race standings to the same race; fitting an imputer/scaler on data that includes the test years.
- **Train / validation / test:** train = fit parameters; validation = make *decisions* (features, preprocessing, model choice, thresholds); test = a final, once-only score. Using the test set for any decision makes its score optimistic.
- **Chronological (temporal) split:** split by time so the model never trains on later seasons than the ones it is scored on. This mimics deployment: on race morning you only know the past.
- **Distribution shift:** the data in later periods differ from earlier ones (smaller fields, near-complete qualifying, more reliable cars). Here the training podium rate is 13.3% but validation/test are 15.0%.
- **Overfitting / memorising:** very high training score, much lower validation score. The first random-forest settings had training PR-AUC 0.918 vs validation 0.696.
- **Seed (`random_state`):** the number that fixes a random generator so results repeat. Neural networks (random initial weights) and forests (random samples) change with it.

#### Preprocessing

- **Standardisation (`StandardScaler`):** `z = (x - mean) / std`, with mean and std taken from the **training** rows. After it, each training feature has mean 0 and std 1. Validation/test use the *same* frozen mean/std, so their scaled means are not zero (and that shift is information about period shift).
- **Why scale:** logistic regression's penalty and the neural network's gradient steps are sensitive to feature units (a 0-722 points column vs a 0/1 flag). Trees only compare thresholds, so they don't need scaling.
- **`sklearn.pipeline.Pipeline`:** chains steps (impute -> scale -> model) into one object. `.fit` learns every step from training data only; `.predict_proba` replays the identical transformations on new data. This is what prevents train/test contamination and makes inference reproducible.

#### Models

- **Logistic regression:** computes a weighted sum `z = b + w1*x1 + ... + wk*xk` (the **log-odds**) and turns it into a probability with `p = 1 / (1 + e^(-z))`. **Regularisation** (`C`, penalty L1/L2) shrinks weights to avoid overfitting; smaller `C` = stronger penalty. Interpretable: with standardised inputs each weight = change in log-odds per +1 standard deviation.
- **`class_weight="balanced"`:** weights each class inversely to its frequency (`n / (2 * n_class)`), so with ~13% podiums a podium row counts about 3.8x and a non-podium about 0.58x. Helps the rare class but **shifts probabilities upward**, so they are not calibrated.
- **Random forest:** many decision trees, each trained on a bootstrap sample with random feature subsets; the forest averages their votes. `max_depth` and `min_samples_leaf` limit tree size (more limit = less memorising). Captures non-linear effects and interactions; no scaling needed.
- **Shallow neural network / MLP (multi-layer perceptron):** layers of weighted sums + non-linearities (ReLU by default). "Shallow" = 1-2 hidden layers; here `(32, 12)` = 32 units then 12 units. `alpha` is the L2 penalty; `early_stopping=True` stops training when an internal 10% hold-out stops improving.
- **Hyperparameter vs parameter:** parameters (weights) are learned from data; hyperparameters (`C`, depth, layer sizes, alpha) are set by you and chosen on validation.
- **Baseline:** the simplest reasonable model to compare against. Here: logistic regression.

#### Metrics

- **Confusion matrix terms:** TP (predicted podium, was podium), FP (predicted podium, wasn't), FN (missed podium), TN.
- **Precision** = TP / (TP + FP): of those we flagged, how many were podiums. **Recall** = TP / (TP + FN): of real podiums, how many we caught. **F1** = 2PR / (P + R): harmonic mean (punishes imbalance between them). These need a **threshold** (probability above which we say "podium").
- **ROC-AUC:** area under the curve of true-positive rate vs false-positive rate across all thresholds. 0.5 = random, 1.0 = perfect. Equals the probability a random podium row is scored above a random non-podium row. Can look flattering when negatives dominate.
- **PR-AUC** (computed with `average_precision_score`): area under the precision-recall curve. Its "random" baseline is the **positive rate** (~0.15 here), so 0.70 is ~4.7x better than chance. More informative when positives are rare, which is why it is the **primary** metric; ROC-AUC is **secondary**.
- **Threshold selection on validation:** for each model, scan 0.05-0.80 in steps of 0.005 and keep the value that maximises validation F1; freeze it; then report test.

#### Experiments and explainability

- **Ablation:** remove one group of features, retrain, and measure the score change. A drop = the group was contributing.
- **Permutation importance:** shuffle one feature's values in validation rows and measure how much the score drops; big drop = the model relies on it. Model-agnostic, global.
- **SHAP (SHapley Additive exPlanations):** assigns each feature a contribution to a prediction using Shapley values from game theory, so that *baseline average prediction + sum of contributions = this prediction*. `TreeExplainer` is exact and fast for tree models. Mean of |SHAP| over many rows = global importance; one row's SHAP = local explanation.
- **LIME:** explains one prediction by perturbing that row many times, asking the model for predictions, and fitting a simple weighted linear **surrogate** around it. **Fidelity** (weighted R^2) says how well the surrogate imitates the model locally.
- **Global vs local:** global = how the model behaves overall; local = why *this* row got *this* probability.
- **Association vs causation:** an important feature means the *model relies on it*, not that changing it would change real podium outcomes. The brief demands you say this explicitly.

#### Statistics used in the analysis questions

- **Bootstrap:** repeatedly resample the data with replacement and recompute a statistic to see how much it varies. Here whole **races** are resampled (a *cluster* bootstrap) because rows within a race are not independent. The 2.5th-97.5th percentiles give a **95% interval**.
- **Odds / odds ratio (OR):** odds = p / (1 - p). OR = odds for home drivers / odds for away drivers; OR = 1 means no difference.
- **Mantel-Haenszel (MH) common odds ratio:** pools the home/away comparison across many strata (here: each exact grid slot P1, P2, ...) so a home-vs-away difference isn't just a difference in where they start.
- **Spearman correlation:** correlation of *ranks* (used to compare grid with sprint finish).

---

<a id="part-02"></a>

## Part 2. Cells 0-12: setup, keys, loading, cleaning, the modelling table, the split


These cells only **define** things; nothing heavy runs until cell 40. Read them as a toolbox: each function is later called inside `run_analysis` (cell 38) and its output is displayed in cells 42-104.

For each code cell: **where it fits -> what it does -> line by line -> why this way / what if changed -> input -> output -> watch-outs.**

---

### Cell 0 (md): title and contract

States the whole project in three sentences. Memorise them, they are your opening:

- The notebook is a complete, **self-contained** Kaggle submission: it does *not* import `pipeline.py` (the same logic is kept in `src/f1podium/pipeline.py` for tests; `scripts/build_notebook.py` copies it into the notebook cells).
- **Cutoff** = after qualifying, before the race. **Unit** = one driver entering one race. **Target** = `positionOrder <= 3`.
- **PR-AUC primary** (podiums are rare), **ROC-AUC secondary**; F1/precision/recall use **thresholds chosen on validation only**.

### Cell 1 (md): "0. Kaggle setup"

Attach the public Kaggle dataset (14 CSVs), choose Run All. Raw CSVs are read, never modified. Supports **R1d (raw immutable)** and **D1 (run-all ready)**.

---

### Cell 2 (code): find the data and the output folder

**Where it fits:** Section 0. Makes the same notebook run on a laptop and on Kaggle without editing paths. Supports **D1**.

| Line | Meaning |
| --- | --- |
| `ROOT = Path.cwd().resolve()` | The folder the notebook is running from, as an absolute path |
| `if ROOT.name == "notebooks": ROOT = ROOT.parent` | If run from the `notebooks/` folder, step up to the project root so `data/raw` is found |
| `def locate_data()` | Returns the folder containing the raw CSVs |
| `local = ROOT / "data" / "raw"`; `if (local / "results.csv").exists()` | Prefer the repository copy of the data |
| `kaggle_root = Path("/kaggle/input")`; `sorted(kaggle_root.rglob("results.csv"))` | Otherwise search the Kaggle input directory recursively for `results.csv` (Kaggle's folder name varies, so the code doesn't hard-code it) |
| `raise FileNotFoundError(...)` | Fail early with a readable message if no dataset is attached |
| `return matches[0].parent` | Use the folder that holds the first `results.csv` found |
| `DATA = locate_data()` | The raw-data folder, used by cell 40 |
| `OUT = Path("/kaggle/working/artifacts") if Path("/kaggle/working").exists() else ROOT / "artifacts"` | Kaggle only allows writing under `/kaggle/working`; locally use `artifacts/` |
| `OUT.mkdir(parents=True, exist_ok=True)` | Create the folder (and parents) if absent, no error if it exists |

**What if changed/removed:** hard-coding a path would work on one machine only and break "Run All" elsewhere.

**Output:** two printed paths. Saved output shows `C:\D-\semester-9\...\data\raw`, i.e. this run was **local**, not Kaggle.

**Used later:** `DATA` and `OUT` are passed to `run_analysis(DATA, OUT)` in cell 40; every figure is read back from `OUT / "figures"` in cells 42-101.

**Watch-outs:** if two folders under `/kaggle/input` each contain a `results.csv` it silently takes the first.

---

### Cell 3 (md): "1. Imports and analytical contract"

"We begin with the libraries, feature groups, and relational keys used by every later stage." The *analytical contract* = the fixed definitions (features, keys) that every function shares.

### Cell 4 (code): imports, the feature list, the key declarations

**Where it fits:** one place that defines *what the model may see* and *what the database should satisfy*. Supports **R3a/R3c** (feature list), **R1d** (keys).

#### Imports (what each library is for)

| Import | Purpose |
| --- | --- |
| `from __future__ import annotations` | Lets type hints such as `str | Path` be written as text so they work on older Python versions |
| `functools` | `functools.wraps` is used by the `_quiet` decorator (cell 20) |
| `json`, `sys` | Write `summary.json`; record the Python version |
| `re` | Regular expression for time parsing (cell 8) |
| `warnings` | Silence known harmless warnings inside experiments |
| `Path` (pathlib), `Any` | File paths; type hint for "anything" |
| `matplotlib`, `matplotlib.use("Agg")` | Plotting library. `"Agg"` is a **non-interactive backend**: it draws straight to image files with no window, which is what a headless Kaggle run or a script needs |
| `numpy as np`, `pandas as pd`, `seaborn as sns` | Arrays/maths; tables; statistical plotting |
| `sklearn` | scikit-learn: the ML library |
| `clone` | Make an *unfitted* copy of an estimator with the same settings |
| `RandomForestClassifier`, `LogisticRegression`, `MLPClassifier` | The three model types (`Ridge` is only the LIME surrogate) |
| `enable_iterative_imputer` + `IterativeImputer`, `KNNImputer`, `SimpleImputer` | Imputation methods (iterative imputation is flagged "experimental" in sklearn, so you must import the enabler first) |
| `permutation_importance` | Global importance (cell 32) |
| `average_precision_score` (PR-AUC), `roc_auc_score`, `f1_score`, `precision_score`, `recall_score` | The five metrics |
| `Pipeline`, `StandardScaler` | Chain steps; standardise |
| `ConvergenceWarning` | The warning class that `_quiet` ignores |

#### The constants

- `SENTINEL = "\\N"`: the Python string `\N` (backslash + N), the dataset's placeholder for missing.
- `DID_NOT_ENTER_CODE = "F"`: the **instructor-ruled** code for drivers who did not qualify/prequalify or failed the 107% rule. The long comment records the ruling: `F` rows may be removed (settled before the race); `W` (withdrew) rows may **not** (the code is only known after the race; grid 0 can also be a real pit-lane start). The rows are dropped *before any feature is built* so a skipped weekend never counts as a race in the form windows or in the field size.
- `FEATURE_GROUPS` (dictionary, 16 features in 5 groups):

| Group | Features | Why it is available at the cutoff |
| --- | --- | --- |
| grid | `grid_position`, `pit_lane_start`, `front_row`, `field_size` | Final starting grid is fixed before lights out |
| qualifying | `qualifying_position`, `qualifying_time_seconds`, `qualifying_missing` | Qualifying finishes before the race |
| form | `driver_podium_rate_5`, `constructor_podium_rate_5`, `driver_races_before` | Computed only from **earlier** races |
| standings | `driver_points_before`, `driver_rank_before`, `constructor_points_before`, `constructor_rank_before` | Championship table **before** this race |
| context | `driver_age`, `year` | Known from the calendar and date of birth |

  The comment notes that `round` was removed after `context_feature_experiment` (cells 62-64) showed it changes validation PR-AUC by far less than the network's seed spread, while `year` stays.
- `FEATURES = [feature for group in FEATURE_GROUPS.values() for feature in group]`: a nested list comprehension that flattens the dictionary into one 16-item list **in group order**. *Every* model, experiment, plot and explanation uses this list, which is how the notebook guarantees "same rows, same feature set" (**R4a**).
- `PRIMARY_KEYS`: for each of the 14 tables, the column(s) that should uniquely identify a row. Two are **composite**: `lap_times` = `(raceId, driverId, lap)`, `pit_stops` = `(raceId, driverId, stop)`.
- `FOREIGN_KEYS`: 22 tuples `(child_table, child_column, parent_table, parent_column)` such as `("results", "driverId", "drivers", "driverId")`.

**What if changed:** editing `FEATURES` changes every result in the notebook. Editing `FOREIGN_KEYS` only changes what the audit checks.

**Watch-outs:** the 22 foreign keys are the ones the team *chose to declare*. The audit proves those hold, not that every possible relationship in the dataset does.

---

### Cell 5 (md): "2. Loading and relational audits"

"These helpers load immutable CSVs and check every declared primary and foreign key before any joins are made."

### Cell 6 (code): `load_raw_tables`, `audit_tables`, `raw_table_profile`

**Where it fits:** **R1b** (sentinels), **R1d** (PK/FK), **R1a** (initial EDA).

#### `load_raw_tables(data_dir)`

```python
for path in sorted(data_dir.glob("*.csv")):
    tables[path.stem] = pd.read_csv(path, na_values=[SENTINEL], low_memory=False)
```
- `glob("*.csv")` finds every CSV; `path.stem` = filename without extension (`results`) becomes the dictionary key.
- **`na_values=[SENTINEL]` is the sentinel handling:** any cell equal to `\N` becomes a real missing value (`NaN`) at load time. (pandas also treats empty cells and strings like `NA` as missing by default.) Without it, numeric columns containing `\N` would be read as text and could not be averaged or compared.
- `low_memory=False` reads each file in one pass so pandas infers one consistent type per column (avoids "mixed types" warnings on big files like `lap_times`).
- `required = set(PRIMARY_KEYS) | {"sprint_results", "lap_times", "pit_stops"}` then `missing = required - tables.keys()`: fail immediately with `FileNotFoundError` if a table is absent, rather than getting a confusing merge error later. (The union is redundant, those three are already in `PRIMARY_KEYS`.)
- The function *reads only*; the raw files are never written, so they stay **immutable** (**R1d**). Later functions work on `.copy()`s.

#### `audit_tables(tables)`

Returns two DataFrames.

- **Primary-key audit:** for each table and key columns `cols`:
  - `rows = len(frame)`
  - `null_keys = frame[cols].isna().any(axis=1).sum()`: rows where *any* key column is missing
  - `duplicate_keys = frame.duplicated(cols).sum()`: rows whose key repeats an earlier row (first occurrence is not counted)
- **Foreign-key audit:** for each `(child, col, parent, parent_col)`:
  - `values = tables[child][col].dropna()`, `orphan = ~values.isin(tables[parent][parent_col].dropna())`: a child value that is not in the parent's key column is an **orphan** reference.
  - Output: `relationship` text, `checked` (how many values), `orphans`.

**Result (cell 42):** 14/14 tables have 0 null keys and 0 duplicate keys; 22/22 relationships have 0 orphans.

**Important subtlety to be able to explain:** `results.resultId` is a valid unique key, **but the *modelling* grain `(raceId, driverId)` is not unique** in `results` (shared drives). So the PK audit passing does not mean the grain is right; that's what cell 8 fixes.

#### `raw_table_profile(tables)`

One row per table: rows, columns, missing cells, `missing_share` (mean of per-column missing fractions = share of cells missing), `columns_with_missing`, `duplicate_full_rows`, number of numeric and text columns. This is the **programmatic initial EDA** of **R1a**: counts and missingness, not eyeballing. Notable results (cell 42): `races` 56% of cells missing (practice/qualifying date columns that only exist for recent years), `results` 25.5%, `constructor_results` 20%, `drivers` 20%.

**Used later:** cell 38 computes them; cell 42 shows them; cell 32 plots `raw_table_profile.png` (row counts on a log scale; missing-cell share).

---

### Cell 7 (md): "2.1 Cleaning the race results"

"Qualifying durations receive numeric units, and shared-drive duplicates are resolved before the driver-race grain is built."

### Cell 8 (code): `_time_to_seconds` and `clean_results`

#### `_time_to_seconds(value)` (semantic typing of durations, **R1b**)

```python
match = re.fullmatch(r"(?:(\d+):)?(\d+(?:\.\d+)?)", text)
minutes = int(match.group(1) or 0)
return minutes * 60 + float(match.group(2))
```
- `pd.isna(value)` -> return `NaN` (already missing).
- The regular expression reads: *optionally* `digits:` (group 1 = minutes, the `(?: ... )?` part is a non-capturing optional wrapper) followed by `digits` with an optional `.digits` (group 2 = seconds). `fullmatch` requires the **entire** string to fit.
- `"1:23.456"` -> minutes 1, seconds 23.456 -> **83.456**. `"83.456"` (no minutes) -> 83.456. Anything else (garbage) -> `NaN`, never an exception.
- **What if changed:** without it `q1/q2/q3` stay text and cannot be compared or used as a feature.
- **Limitation:** it converts "16:42.640" faithfully to 1002.64 s. That one raw value (`qualifyId 2569`, `q1`) is almost certainly a typo, and nothing clips outliers.

#### `clean_results(results)`: the shared-drive rule (**R1c**)

Problem: some `(raceId, driverId)` pairs appear in **more than one** `results` row (shared drives, mostly 1950s). Each row is one prediction, so duplicates would double-count a driver and violate the grain.

```python
frame = results.copy()                                   # raw table untouched
frame["_started"] = frame["grid"].fillna(0).gt(0)        # True if the car actually took a grid slot
counts = frame.groupby(["raceId","driverId"]).size().rename("rows").reset_index()
duplicates = counts[counts["rows"] > 1].copy()           # which groups are duplicated
frame = frame.sort_values(["raceId","driverId","_started","positionOrder","resultId"],
                          ascending=[True, True, False, True, True], na_position="last")
clean = frame.drop_duplicates(["raceId","driverId"], keep="first").drop(columns="_started")
assert not clean.duplicated(["raceId","driverId"]).any()
```

Read the sort as a **priority list inside each driver-race group** (the first row after sorting is kept):
1. `_started` **descending** (`False` sorts before `True`, so descending puts `True` first): **prefer the car the driver actually started** (grid > 0), which preserves the pre-race identity of the entrant.
2. `positionOrder` **ascending**: then the **best final classification**.
3. `resultId` **ascending**: then the lowest id, a deterministic final tie-break (so the result is reproducible).

`drop_duplicates(..., keep="first")` keeps the first row of each group; the `assert` proves uniqueness (the notebook stops if it ever fails).

**Why this rule (what to say):** it is deterministic, reproducible, and uses a pre-race fact (did this car start?) first. Only if that doesn't decide does it look at the finishing position, which the instructor confirmed is not a cut-off violation (Piazza @16 per the README) because it only breaks a tie between rows that both started and never fills a pre-race field from another row (Piazza @12). Per the README, in this dataset 82 of the 85 duplicate groups have every row started and 3 have none, so the "started" step never actually changes the result and the rule behaves as "best finish, then lowest `resultId`" (README claim, not shown in the notebook).

**Numbers (cell 42):** 85 duplicated groups, 176 raw rows involved, 91 rows removed -> 26,759 -> 26,668 rows, 0 duplicates left. (176 rows in 85 groups means a few groups had three rows.)

**What if removed:** `(raceId, driverId)` stays non-unique; later merges with `validate="one_to_one"` would raise errors; shared-drive drivers would be double-counted.

**Limitations:** shared-drive history is genuinely ambiguous; keeping the best finish can label a relief driver a podium finisher; it is a defensible rule, not a perfect one.

**Input -> output:** `results` DataFrame -> `(clean, duplicates)` tuple. Used by `build_modeling_table` (cell 10) and `cleaning_eda` (cell 14).

---

### Cell 9 (md): "2.2 Building the modelling table"

"Previous standings are shifted to the next race, while form features use only earlier starts. **This is the main leakage-control boundary.**"

### Cell 10 (code): `_previous_standings` and `build_modeling_table`

#### `_previous_standings(standings, races, entity)`: leakage-safe standings (**R3c**)

A row in `driver_standings` for race *r* describes the championship table **after** race *r*. Using it as a feature for race *r* leaks the result. So it is attached to the **next** race.

```python
s = standings[["raceId", entity, "points", "position"]].merge(races[["raceId","year","round"]], on="raceId", how="left")
s = s.sort_values([entity, "year", "round"])
s["next_raceId"] = s.groupby([entity, "year"])["raceId"].shift(-1)
return s.dropna(subset=["next_raceId"])[["next_raceId", entity, "points", "position"]].rename(
    columns={"next_raceId": "raceId", "points": f"{prefix}_points_before", "position": f"{prefix}_rank_before"})
```
- `entity` is `"driverId"` or `"constructorId"`; `prefix` is `"driver"` or `"constructor"`.
- `groupby([entity, "year"])["raceId"].shift(-1)`: within each driver-season, `shift(-1)` moves each row's `raceId` **up** one place, so each row learns *the id of the next race that driver/team has a standings row in*.
- The standings after race *i* are therefore stored under race *i+1*'s `raceId`, renamed `..._points_before` / `..._rank_before`.
- `dropna(subset=["next_raceId"])` drops the last race of each season (no next race).
- **Grouping by `year`** means standings never carry across seasons (the championship resets), so round 1 has no "before" value.

Tiny example: a driver's standings after rounds 1, 2, 3 are (25 pts, P1), (43, P1), (60, P1). After the function: round 2 has `points_before=25`, round 3 has 43; round 1 has nothing (becomes 0, below); the standings after round 3 are dropped.

#### `build_modeling_table(tables, drop_did_not_enter=True)`: step by step

| # | Code idea | Why |
| --- | --- | --- |
| 1 | `races["date"] = pd.to_datetime(races["date"], errors="coerce")` | Semantic typing: date text -> real date; invalid -> `NaT` (missing date) rather than a crash |
| 2 | `results, duplicate_groups = clean_results(tables["results"])`; record `rows_after_shared_drives` | Fix the grain first |
| 3 | `if drop_did_not_enter: results = results[results["positionText"].ne("F")]` | Remove `F` rows (never entered) **before any feature exists**. The parameter lets cell 38 also build the version *with* `F` rows to audit the decision |
| 4 | `results.merge(races[...], on="raceId", validate="many_to_one")` | Attach year, round, date, circuit id, race name. `many_to_one` = many result rows to one race; raises if `races` had duplicate ids |
| 5 | `base[base["year"].between(1950, 2024)]` | Keep the project's period |
| 6-8 | Merge `drivers` (dob, nationality -> `driver_nationality`), `constructors` (name -> `constructor_name`), `circuits` (name -> `circuit_name`, country) | Needed for age (feature) and for Q1-Q3. The renames avoid clashes: `races.name` is the race name, `circuits.name` the circuit |
| 9 | `driver_age = (date - dob).dt.days / 365.2425` | Age in years at race date (365.2425 = average Gregorian year) |
| 10 | `podium = positionOrder.le(3).astype(int)` | **The target.** Built from a post-race column but only ever used as the label, or in shifted form |
| 11 | `grid_position = grid.where(grid > 0)`, `pit_lane_start = grid.eq(0)`, `front_row = grid.isin([1,2])`, `field_size = groupby("raceId").transform("size")` | Grid 0 must not be a number "ahead of pole": it becomes missing in `grid_position` and a separate flag. `field_size` = rows in that race after cleaning |
| 12 | Qualifying: parse `q1/q2/q3` with `_time_to_seconds`; `qualifying_time_seconds = min(q1,q2,q3)` row-wise (skips NaN); sort and `drop_duplicates` per driver-race; **left** merge on `[raceId, driverId]` with `validate="one_to_one"`; `qualifying_missing = qualifying_position.isna()` | Best session time. **`how="left"`** keeps every race row even if there is no qualifying record (an inner join would delete 1950-1993). The flag records which rows have no data |
| 13 | `dprev`, `cprev` from `_previous_standings`; left-merge (drivers `one_to_one`, constructors `many_to_one` because two cars share one team row) | Pre-race standings |
| 14 | Fill missing standings with **0 points, rank 0** | No standings row yet = nothing scored yet this season (round 1, a first race of the season, or constructors before 1958). 0 is the *true* value; letting the median imputer guess (~3 points, rank 13) would invent points (cell 53) |
| 15 | `base.sort_values(["date","raceId","driverId"])` | Chronological order is required for rolling windows |
| 16 | `driver_podium_rate_5 = groupby("driverId").podium.transform(lambda s: s.shift().rolling(5, min_periods=1).mean())` | **Driver form** |
| 17 | Constructor: `groupby(["constructorId","raceId","date"]).podium.mean()` -> sort -> `shift().rolling(5, min_periods=1).mean()` -> merge back | **Constructor form** |
| 18 | `driver_races_before = groupby("driverId").cumcount()` | Number of earlier rows (starts) for that driver: 0 on a debut |
| 19 | Diagnostics dictionary | Row counts and `unique_grain` check |

##### Why `shift()` before `rolling()` (the most-asked leakage question)

`s.shift()` moves each value one row *down*, so at a driver's row *i* the series holds the podium flag of row *i-1*. `rolling(5, min_periods=1).mean()` then averages up to the **five previous starts**. If `shift()` were removed, the window would include the current row's own `podium`, i.e. **the target would be inside the feature**. `min_periods=1` means "give a value as soon as one earlier race exists"; a driver's first-ever race is `NaN` (nothing before it), later imputed. The window length 5 is a design choice, not tuned.

##### Why constructors are aggregated per race before shifting

A team has two cars in the same race. If each car's row were shifted separately, the second teammate's feature could include the **first teammate's result from the same race**. So the code first takes one number per team-race (`mean` of the teammates' podium flags: 0, 0.5 or 1), then shifts and rolls over the team's previous five **races**. Merge key `[constructorId, raceId]`, `validate="many_to_one"`.

##### Why the table has 44 columns

The modelling table is a **superset**: it keeps post-race columns (`points`, `laps`, `statusId`, `positionOrder`, ...) because Q3 needs `statusId` and the target needs `positionOrder`. The leakage control is the whitelist `FEATURES`: models are only ever given those 16 columns. (Repository test `test_current_race_result_cannot_change_its_own_features` in `tests/test_pipeline.py` sets the latest race's `positionOrder` to 99 for everyone, rebuilds the table, and asserts that the 16 `FEATURES` of that race are **identical** while the `podium` label **does** change. A second test, `test_form_features_cannot_see_current_target`, asserts that each driver's and constructor's first-ever row has an empty form feature and `driver_races_before == 0`.)

**Diagnostics output (cell 40):** 26,759 raw -> 85 duplicate groups -> 26,668 -> 1,366 `F` rows removed -> **25,302** rows; `unique_grain: True`; 1950-2024.

**Assumptions/limits:** `field_size` counts every row in the race including `W` rows; `pit_lane_start` includes `W` rows with grid 0 (cell 46 says so). Early-career form (`min_periods=1`) is noisy: after one race it is 0 or 1. The same driver id is assumed to be the same person throughout; constructor ids reset on renames (cell 66).

---

### Cell 11 (md): "3. Chronological splitting and split checks"

"The split helpers keep whole seasons and races together, then compare the chosen chronological split with tempting random alternatives."

### Cell 12 (code): split constants and helpers

#### `SPLIT_YEARS`, `split_by_time(frame)`

```python
SPLIT_YEARS = {"train": (1950, 2019), "validation": (2020, 2021), "test": (2022, 2024)}
{name: frame[frame.year.between(first, last)].copy() for name, (first, last) in SPLIT_YEARS.items()}
```
`between` is inclusive. Result: three DataFrames (23,163 / 780 / 1,359 rows). Every function that needs a split calls this, so the boundaries are defined once. **Supports R3b.**

#### `split_summary(frame)`

For each split: years, first/last race date, rows, share of rows, races, drivers, starters per race, number of podiums, podium rate, share of rows with no qualifying. Output (cell 69): train 1950-2019, 23,163 rows (91.5%), 1,018 races, podium rate **13.3%**, qualifying missing **64%**; validation 2020-21, 780 rows, 39 races, **15.0%**, 0.1%; test 2022-24, 1,359 rows, 68 races, **15.0%**, 0%.

#### `split_integrity(frame)`: seven pass/fail checks

Every row assigned to exactly one split; no race shared between any pair of splits; last training race before the first validation race; last validation race before the first test race; both classes present in every split. All `True` (cell 69). Proves the split is complete, disjoint, strictly ordered in time.

#### `split_strategy_experiment(frame, random_state=42)`: why not a random split (**R3b** justification)

Holds out the **same number of rows as validation** (780) in three ways and trains the logistic baseline on the rest:

| Strategy | How the held-out set is chosen |
| --- | --- |
| chronological (used) | train 1950-2019, hold out 2020-21 |
| random races | shuffle race ids; add whole races until the cumulative row count reaches 780 (768 rows) |
| random rows | 780 random rows |

For each it reports PR-AUC and ROC-AUC **plus two leakage diagnostics**:
- `held_out_races_also_in_train`: share of held-out rows whose *race* also has other rows in training (same-race leakage). Chronological 0%, random races 0%, **random rows 100%**.
- `held_out_rows_with_future_training`: share of held-out rows whose year is earlier than the latest training year (the model has seen the future). Chronological **0%**, random races **100%**, random rows **98%**.

`clone(model_definitions(random_state)["Logistic regression"])` gives a fresh, unfitted copy of the pipeline (it relies on `model_definitions` from cell 14; fine because it's only *called* later).

**Result (cell 69):** PR-AUC 0.730 (chronological), 0.627 (random races), 0.588 (random rows).

**Do not misread this.** The random splits score *lower*, not higher. The reason (my inference, consistent with the notebook's own wording in cell 70) is that their held-out sets are a mix of all eras, including old low-podium-rate, no-qualifying seasons (held-out podium rate 13.3% and 11.0% vs 15.0%), so they are a *different, harder question* ("predict a random historical row") and PR-AUC also moves with the base rate. The point of the experiment is the leakage columns: only the chronological split has **zero same-race and zero future leakage**, i.e. it is the only one that answers "how well do we predict the next seasons?".

**Input -> output -> used later:** `frame` -> DataFrames; called in cell 38 (`split_summary`, `split_integrity`, `split_strategy_experiment`), shown in cell 69. `split_by_time` is used by almost every later function.

---

<a id="part-03"></a>

## Part 3. Cells 13-28: models, metrics, preprocessing, feature evidence, experiments


Still only **definitions**. Each function is called once inside `run_analysis` (cell 38); results are displayed in cells 42-104. The "Where it fits" lines map to the requirement IDs in file 01.

---

### Cell 13 (md): "4. Cleaning EDA and model definitions"

"We measure the effect of cleaning, define the three comparable models, and keep threshold selection on validation data only."

### Cell 14 (code): `cleaning_eda`, `_pipeline`, `model_definitions`, `_best_threshold`, `_metrics`, `train_and_evaluate`

#### `cleaning_eda(raw_results, cleaned)`: before/after cleaning (**R1a**)

Compares **three stages**: raw `results`, after shared drives are resolved (`clean_results`), and the final modelling table (after `F` rows are removed). For each stage it computes:

| Column | Meaning |
| --- | --- |
| `rows`, `unique_driver_races` | Row count vs distinct `(raceId, driverId)` pairs. Equal = grain is unique |
| `duplicate_rows` | `duplicated([...], keep=False).sum()`: **all** rows involved in any duplicate group (176 raw) |
| `podium_rate` | Share with `positionOrder <= 3` (the target) |
| `pit_lane_share` | Share with `grid == 0` |
| `missing_finish_share` | Share with missing `positionOrder` (0, the column is always filled) |
| `median_grid` | Median of grid among real grid slots (`grid > 0`) |

Results (cell 42): rows 26,759 -> 26,668 -> 25,302; duplicates 176 -> 0 -> 0; podium rate 12.69% -> 12.73% -> **13.42%**; grid-0 share 6.12% -> 6.13% -> **1.14%**; median grid 12 throughout.

**How to explain it:** the first step (grain) barely moves the target or grid distribution, so it didn't distort the data. The second step raises the podium rate **by arithmetic only** (the 1,366 removed rows were all non-podiums, so the denominator shrinks) and collapses the grid-0 share, because most grid-0 rows were drivers who never raced.

#### `_pipeline(model, scale=True, strategy="median")`: preprocessing + model in one object

```python
steps = [("imputer", SimpleImputer(strategy=strategy, fill_value=0))]
if scale: steps.append(("scaler", StandardScaler()))
return Pipeline([("preprocess", Pipeline(steps)), ("model", model)])
```
- A **Pipeline inside a Pipeline**: `preprocess` (impute, optionally scale) then `model`.
- `SimpleImputer(strategy="median")` fills each missing cell with that column's **training median**. `fill_value=0` is only used when `strategy="constant"` (the "zero + scaling" experiment); for `"median"` it is ignored.
- `StandardScaler` rescales to mean 0, std 1 (training statistics).
- **Why a Pipeline:** `.fit(X_train, y_train)` learns the medians, means, stds and model weights from training rows **only**; `.predict_proba(X_new)` re-applies the same frozen transforms. That prevents train/test contamination (a classic leakage route) and makes inference one call. `named_steps["preprocess"]` and `["model"]` let later code reach inside (SHAP, logistic weights).

#### `model_definitions(random_state=42)`: the three candidate models (**R4a**)

| Model | Exact settings | What each setting does |
| --- | --- | --- |
| **Logistic regression** (baseline) | `max_iter=2000, solver="liblinear", class_weight="balanced", random_state` (default `C=1.0`, L2 penalty) | `max_iter`: cap on solver iterations. `liblinear`: coordinate-descent solver for small/medium data, supports L1 and L2. `class_weight="balanced"`: up-weights podiums (~3.8x) and down-weights non-podiums (~0.58x). Scaled inputs (`scale=True`) |
| **Random forest** | `n_estimators=240, max_depth=12, min_samples_leaf=30, class_weight="balanced_subsample", n_jobs=1, random_state`; **no scaling** | 240 trees; trees at most 12 levels deep; every leaf must hold >=30 training rows (strong regularisation); `balanced_subsample` recomputes class weights per tree's bootstrap sample; `n_jobs=1` = one CPU core (reproducible, Kaggle-safe) |
| **Shallow neural network** (MLP) | `hidden_layer_sizes=(32, 12), alpha=0.02, early_stopping=True, max_iter=300, random_state`; scaled | Two hidden layers (32 then 12 units); ReLU activations and the Adam optimiser are sklearn defaults; `alpha` = L2 weight penalty; `early_stopping=True` holds out 10% of the training rows (random, internal) and stops when it stops improving; max 300 epochs. `MLPClassifier` has **no** `class_weight` option |

The docstring documents *why* the settings are what they are (all chosen on validation in cell 24's search): the forest's starting settings (no depth limit, leaf size 4) **memorised the training seasons**, so depth 12 / leaf 30 replaced them; the network got stronger regularisation (0.02); logistic regression kept its starting settings because the top settings tie within 0.0005.

**Why these three:** logistic regression = interpretable linear **baseline**; forest = non-linear tree ensemble that captures interactions; MLP = the required shallow NN. All use identical rows and the identical 16 `FEATURES`, so scores are directly comparable (**R4a**). Together with the hyperparameter variants this satisfies "at least three distinct modelling attempts" (**R5c**).

**Why the forest has no scaler:** trees split on thresholds, so a monotonic rescale changes nothing.

**Limitations (the brief asks for them):**
- Logistic regression: assumes a **linear** effect on the log-odds, can't model interactions unless built in; correlated features make single weights hard to read.
- Random forest: harder to interpret, can still overfit (it did at first), can't extrapolate beyond the training range (relevant for `year`).
- MLP: a black box, sensitive to the random seed and to input scaling; with only 2020-21 for validation, tuning it is noisy.

#### `_best_threshold(y, probability)`: threshold selection on validation only (**R4d**)

```python
candidates = np.linspace(0.05, 0.80, 151)
scores = [f1_score(y, probability >= value, zero_division=0) for value in candidates]
return float(candidates[int(np.argmax(scores))])
```
Tries 151 thresholds from 0.05 to 0.80 (step 0.005), computes F1 for each, returns the best. It is only ever called with **validation** labels/probabilities. `zero_division=0` avoids warnings when nothing is predicted positive.

#### `_metrics(y, probability, threshold)`

`prediction = probability >= threshold`. Returns **ROC-AUC** and **PR-AUC** (`average_precision_score`), which use the raw probabilities and need no threshold, and **F1, precision, recall**, which use the thresholded predictions.

#### `train_and_evaluate(frame, random_state=42)`

For each model: `fit` on train; `predict_proba(validation)[:, 1]` (probability of class 1 = podium); pick **that model's** threshold on validation ("each model gets its own cutoff because their probability scales differ"); then compute the five metrics on **train, validation and test** with that frozen threshold. Returns `(trained_models, metrics_table[9 rows], thresholds)`.

**Used later:** cell 86 (metrics table + `model_comparison.png`), cells 98/101 (explanations use `trained`), cell 104 (inference).

**Watch-outs:** thresholds are 0.625 (LR), 0.775 (forest), 0.455 (MLP). They differ because probability scales differ (class weighting inflates LR/forest probabilities; the MLP has none). Validation F1/precision/recall are optimistic because the threshold was tuned on that same data.

---

### Cell 15 (md): "4.1 Preprocessing evidence"

"These experiments compare imputation strategies and record how feature distributions change after imputation and scaling." Supports **R5b** and the checklist item "effect of the step on data distribution/range/values".

### Cell 16 (code): preprocessing experiments, effects and order experiments

#### `preprocessing_experiments(frame)`: three strategies

Three logistic-regression pipelines scored on **validation**: `median + scaling`, `median, no scaling`, `zero + scaling` (`strategy="constant"`, fill 0). Results (cell 80): PR-AUC 0.7301 / 0.7313 / 0.7262. Differences of ~0.005: preprocessing strategy is **not the main performance lever** for logistic regression.

#### `preprocessing_effects(frame)`: what imputation and scaling do to each feature

For all 16 features, **fitted on training rows**:
- `imputer = SimpleImputer(strategy="median").fit(train)`, `scaler = StandardScaler().fit(imputed)`.
- Table columns: `missing_share`, `fill_value` (= the training median, `imputer.statistics_`), raw min/max/mean/std, `imputed_mean/std`, **`std_change_from_imputation = imputed.std()/raw.std() - 1`** (filling many cells with one value shrinks spread), scaled min/max/mean/std, and **`validation_scaled_mean`, `test_scaled_mean`** (the later splits pushed through the *training-fitted* transforms).
- The inner function `later_scaled(name)` applies the training-fitted imputer and scaler to validation/test.

Key results (cell 77-78): `qualifying_position` and `qualifying_time_seconds` have 64% missing in training; the median fill makes their std fall ~40%; ranges don't change (the median lies inside the observed range); after scaling every training feature has mean 0, std 1; but validation/test means are **not** 0, for example `year` +1.67/+1.80, `field_size` -0.95, `qualifying_missing` -1.33, prior points ~+0.95/+1.30. That is the honest **period shift** the model faces.

#### `feature_engineering_effects(frame, tables)`

Compares each raw source column with the feature built from it: `grid (raw)` vs `grid_position (0 -> missing)` vs `pit_lane_start`; raw `q1/q2/q3` text vs parsed seconds vs the joined `qualifying_time_seconds`; `driver_podium_rate_5 (shifted)`; `driver_points_before`. Columns: missing share, zero share, min, median, max, mean. Shows that zero-grid becomes missing and moves into a flag; that the join exposes 59% missing qualifying time across all years; that shifted form is empty on a first race. (Max `qualifying_time_seconds` 1002.64 is the typo noted earlier.)

#### `_ordered_preprocessor(order)`, `PREPROCESSING_ORDERS`, `preprocessing_order_experiments` (**R5b**)

Builds impute/scale pipelines in four orders: `impute -> scale`, `scale -> impute` (median), `zero-fill -> scale`, `scale -> zero-fill`. `PREPROCESSING_ORDERS` lists five experiments: **A** (impute vs scale first), **B** (zero-fill vs scale first), **C** (fit preprocessing on **all years before splitting** vs on train only).

For each, and for **logistic regression and the MLP**:
- Fit the preprocessor, transform train and validation, fit a *clone of just the final estimator* (`base_models[...].named_steps["model"]`) on the transformed array.
- To show "what value does a missing cell become, in original units", transform an all-NaN row and undo the scaling: `pre.transform(all_nan_row)[0] * scaler.scale_ + scaler.mean_`.
- Record fill values, the training std of the transformed qualifying time, validation PR-AUC/ROC-AUC, and `PR-AUC_change_vs_reference` (each order vs the first order of the same experiment; C vs A's `impute -> scale`).

What the experiments mean (cell 81):
- **A:** median imputation commutes with a linear rescale (a missing cell still maps to the raw median either way); the difference is the scaler's statistics: scaling *first* uses observed values only, so after imputation the qualifying time's training std is 0.60 instead of 1. LR unchanged (+0.0000); the MLP, which depends on input scale, moves +0.016.
- **B:** order changes the *value*. Zero-fill before scaling writes a literal **0** (meaning "grid 0, ahead of pole" and a "0-second lap"); scaling first then zero-filling writes the **training mean** (grid ~12.0, qualifying ~88.8 s). LR +0.0043, MLP -0.005.
- **C:** fitting preprocessing on all seasons lets 2020-2024 set the medians/scales used in training: **future information in preprocessing**. It moved the MLP +0.021 and LR +0.0001; whatever the score, it is leakage, so the final pipeline fits preprocessing on training rows only (it lives inside the `Pipeline`).

**Caveat:** MLP differences ~0.016-0.021 are about the size of one seed's noise (cell 64: a single seed sits up to 0.021 from its 3-seed average), so only the principle (don't fit on future data) rests on logic, not on these scores.

---

### Cell 17 (md) and Cell 18 (code): "4.2 Preprocessing visualisations"

Helpers that draw figures only; they do not change the data used by models. **R1a/R3, "plot the effect of the step".**

- `preprocessing_plots(frame, effects, out_dir)` writes two PNGs.
  1. `preprocessing_distributions.png`: 2x4 grid for four features (`grid_position`, `qualifying_time_seconds`, `driver_points_before`, `constructor_podium_rate_5`). **Top row:** histogram after median imputation (orange) over the raw observed values (dark), log y-axis, dashed line = training median, i.e. you see the tall spike at the median. **Bottom row:** training (scaled, centred at 0) vs validation through the same transform (shifted).
  2. `preprocessing_ranges.png`: left, raw training range (max - min, symmetric-log axis); right, range after scaling with a dot for each feature's validation mean.
  - Code notes: `np.histogram_bin_edges` forces both histograms onto the same bins; `set_yscale("log")` so the spike doesn't hide the rest; `plt.close(fig)` frees memory.
- `split_plot(frame, out_dir)`: three bar panels per season coloured by split (train/validation/test): rows, podium rate, share of missing qualifying. Shows the era shift at a glance. Saves `chronological_split.png`, displayed in cell 69.

---

### Cell 19 (md) and Cell 20 (code): "4.3 Feature evidence and ablation"

#### `ablation_experiments(frame)` (**R5a**)

```python
variants = {"all features": FEATURES}
variants.update({f"without {group}": [f for f in FEATURES if f not in columns] for group, columns in FEATURE_GROUPS.items()})
```
Six variants: all features, then without each of grid / qualifying / form / standings / context. For each: build a fresh logistic pipeline, fit on **train**, score **validation** PR-AUC and ROC-AUC; `PR-AUC_change = variant - all features` (negative = the removed group was helping).

**Results (cell 95):** all features 0.7301; without grid **-0.0253**; without standings **-0.0173**; without form **-0.0165**; without qualifying **-0.0061**; without context **-0.0013**. Grid contributes most; qualifying adds little *once grid is present* (they overlap); context adds least.

**Limitations (be ready):** uses logistic regression only (not all three models); one validation window (39 races); removal measures *incremental* contribution given the other groups (correlated groups share credit); not causal.

#### `_quiet(function)`: a decorator

Wraps a function in `warnings.catch_warnings()` and ignores (1) messages containing "penalty" (newer sklearn deprecates the `penalty` argument the search grid uses on purpose) and (2) `ConvergenceWarning` (the iterative imputer stopping at its iteration cap). `@functools.wraps` preserves the function's name/docstring. Purely cosmetic: it keeps hundreds of repeated warnings from burying the tables; it doesn't change results.

#### `_feature_bins(values)`

If the feature has <=2 distinct values (a flag), return the values themselves. Otherwise `pd.qcut(observed.rank(method="first"), q=5, labels=False)`: **five equal-count bins**. Ranking first splits tied values (e.g. many zero form rates) across bins so every bin is populated.

#### `feature_eda(frame)`: per-feature exploratory evidence (**R3a**), training rows only

For each of the 16 features (looping over `FEATURE_GROUPS`):
- `missing_share_train`, `podium_rate_when_missing`.
- Podium rate in the **lowest bin** and **highest bin**.
- **`auc_train`:** ROC-AUC using the raw feature value as the score. **>0.5 = higher value goes with more podiums; <0.5 = lower value goes with more podiums** (e.g. `grid_position` 0.12: small grid number = podium). `auc_validation`: same on validation, to check the pattern persists. `signal_strength = |AUC - 0.5| * 2`. `same_direction_in_validation`.
- Missing cells are excluded from the AUC and the bins.

#### `feature_eda_panels` and `feature_eda_plot`

Build, per feature, bar heights (podium rate per bin, labelled with the bin's median value, plus an orange "missing" bar if any), then draw a **4x5 grid of 16 panels** (the last 4 axes are switched off) with the AUC and missing share in each title. Saved as `feature_eda.png` (cell 60). **Training seasons only**, so validation/test never influence feature choice.

---

### Cell 21 (md) and Cell 22 (code): "4.4 Missing-value experiments"

#### `_validation_scores(train, val, features, preprocessor, random_state)`

Helper: `clone(preprocessor).fit(train[features])`, transform train and val, then for **logistic regression and the MLP** (cloned final estimators) fit and compute validation PR-AUC and ROC-AUC. Returns a nested dict.

#### `missing_value_experiments(frame)` (decorated with `@_quiet`) (**R3a/R5c, trial-and-error evidence**)

Scores eight ways of handling missing values on the **same validation rows**:

| Variant | What it tests |
| --- | --- |
| median imputation (**used**) | baseline |
| mean imputation | different central value |
| KNN imputation (k=5) | fill from the 5 most similar rows (scale first: distance-based) |
| iterative imputation (regression) | model each missing column from the others (`max_iter=10`) |
| median, without the `qualifying_missing` flag | is the flag useful? |
| drop sparse columns | remove `qualifying_position`, `qualifying_time_seconds` (>50% missing) |
| drop training rows with no qualifying | keeps 1994+ only (8,348 rows) |
| drop training rows with any missing feature | 8,054 rows |

`sparse = [f for f in FEATURES if train[f].isna().mean() > 0.5 and not f.endswith("_missing")]`; `first_qualifying_year = 1994` is computed from the data. Final column `PR-AUC_change_vs_used`.

**Decision logic (cell 84):** median + flag keeps **all 23,163** training rows and is "never meaningfully beaten". Judge on **logistic regression** (no seed noise): every alternative is within 0.006. The network's single-seed changes run -0.030 to +0.022, which is noise-sized (one seed can sit 0.021 from its 3-seed mean), except dropping the qualifying columns (-0.030), which argues *against* dropping them.

---

### Cell 23 (md) and Cell 24 (code): "4.5 Hyperparameter search"

```python
SEARCH_SPACE = {
 "Logistic regression": [{"C": c, "penalty": p} for p in ("l1","l2") for c in (0.01, 0.1, 1.0, 10.0)],       # 8
 "Random forest": [{"max_depth": d, "min_samples_leaf": leaf} for d in (6, 12, None) for leaf in (4, 12, 30)], # 9
 "Shallow neural network": [{"hidden_layer_sizes": h, "alpha": a}
      for h in [(8,), (16,), (32,), (64,), (32,12), (64,32)] for a in (0.002, 0.02)],                          # 12
}
SEARCH_SEEDS = {"Logistic regression": (42,), "Random forest": (42,), "Shallow neural network": (42, 43, 44)}
```
- 29 settings in total. The network is **averaged over three seeds** because its score moves with random initialisation; the others use one.
- `_model_from_params(name, params, seed)`: builds one candidate with fixed settings + the searched params (`**params` unpacks the dictionary into keyword arguments).
- `INITIAL_SETTINGS`: where each model started *before* the search.
- `_current_params(name)`: reads the settings **currently used** in `model_definitions`; maps sklearn's newer "deprecated" penalty marker back to `"l2"`.
- `hyperparameter_search(frame)` (`@_quiet`): for every setting and seed, fit on **train 1950-2019**, score **validation 2020-21**; also records **training PR-AUC** (to expose overfitting); averages over seeds; reports `validation_PR-AUC`, its **std across seeds**, `is_current`, `is_initial`, `rank_within_model` (1 = best), `selected`. **The test seasons are never used.** (**R4d**)

Key reading of results (cells 89-90): the forest's initial setting (None depth, leaf 4) has validation 0.696 but **training 0.918**: memorised; depth 12 / leaf 30 has validation 0.717 (rank 1) and training 0.646. Logistic regression is insensitive (0.710-0.730; the adopted C=1, L2 is within 0.0002 of the top). For the network the adopted (32,12) with alpha 0.02 ranks 7th of 12 at 0.7228; the top is (64,) alpha 0.002 at 0.7362 but with seed spread up to 0.025, so the notebook declines to "chase the top of a ranking that moves with one input and one seed", i.e. it avoids selecting noise.

---

### Cell 25 (md) and Cell 26 (code): "4.6 Robustness and historical checks"

#### `constructor_history_audit(frame)`

Constructor form is computed per `constructorId`. Renames get a **new id** (form starts empty); some old ids are **reused** years later by an unrelated team (link to a different era). The function finds, for 2014+, each team-season that starts with a brand-new id or an id unused for >=3 seasons, tags it ("new id: form starts empty" / "reused id: form comes from YEAR"), and counts how many rows fall in that season's first five races (the window length). Output (cell 66): 10 team-seasons (e.g. Haas 2016, Renault 2016, Alfa Romeo 2019, Racing Point 2019, AlphaTauri 2020, Alpine 2021, Aston Martin 2021, RB 2024, Sauber 2024); 10 rows each; **no podiums** in any; constructor form 0 or empty.

#### `context_feature_experiment(frame)` (`@_quiet`)

Tests the two calendar features. Four variants: `used (no round)`, `put round back`, `also remove year`, `round back, year removed` (the last two keep/remove `year`), each trained on 1950-2019 and scored on 2020-21, **averaged over the same seeds** (3 for the network), reporting mean, std, and the seed-42 score. Outcome (cells 63-64): `round` adds nothing (changes within noise, and means different things across eras: a season had ~8 races in the 1950s, 24 in 2024), so it was removed; removing `year` hurts the nonlinear models (-0.0123 forest, -0.0212 network), so `year` stays. The **why-one-seed-is-not-enough** story: with `round`, the network's seed-42 score was 0.7443, 0.021 above its 3-seed mean.

#### `split_window_experiment(frame)` (`@_quiet`)

Scores the LR and MLP on **four validation windows that all end before the test seasons**: 2014-15, 2016-17, 2018-19, 2020-21; for each, training = *all earlier seasons*. Answers "is 2019 the right boundary / is the 2020-21 choice unusual?". Result (cell 72): LR ranges 0.689-0.730 (2020-21 is the best of the four), MLP 0.714-0.740 (2020-21 is 3rd of 4). Conclusion: a ~40-race validation score moves by a few hundredths with the window, so it should not be read as the expected test score.

#### `validation_uncertainty(frame, trained, n_boot=1000, split="validation")`: race-level bootstrap

```python
by_race = [index.to_numpy() for _, index in val.groupby("raceId").groups.items()]
rows = np.concatenate([by_race[i] for i in rng.integers(0, len(by_race), len(by_race))])
average_precision_score(val.podium.to_numpy()[rows], p[rows])
```
- Each bootstrap draw **resamples whole races with replacement**, concatenates their rows, and recomputes PR-AUC for all three models on the **same** resample (so differences are *paired*).
- 1,000 draws -> 2.5th and 97.5th percentiles = **95% interval**. It also bootstraps **"forest minus logistic regression"** and **"network minus logistic regression"** differences.
- Resamples *predictions that already exist*: nothing is refit; with `split="test"` the test seasons are not re-scored for any decision.
- **Why by race:** rows within a race are not independent (same weather, safety cars, grid), so the race is the sampling unit.

Results: validation intervals ~0.20 wide (e.g. LR 0.62-0.84); both differences straddle zero (-0.048 to +0.028; -0.040 to +0.015). So the validation ranking is a statistical tie (cell 73).

---

### Cell 27 (md) and Cell 28 (code): "4.7 Sprints and recorded non-starters"

#### `sprint_weekend_check(frame, tables)`: the sprint leakage judgement call

Inner-joins the modelling table to `sprint_results` on `(raceId, driverId)` and adds `sprint_date` from `races`. Per sprint season: number of sprint races, driver rows, which split the season is in, `sprint_ends_before_race_share` (is the sprint date before the race date?), `days_before_race` (median), and **Spearman** rank correlation between the main-race grid and (a) the sprint finish, (b) the qualifying position; `sprint_rows_in_training` (0). Result (cell 57-58): every sprint ends the day before the race; sprints exist only from 2021 (0 training rows); in 2021-22 the sprint set the grid (grid vs sprint finish 0.89, 0.99) so grid features already carry it; from 2023 the sprint no longer sets the grid. Decision: **excluded by design, not because it leaks**. The *real hazard* is joining by `raceId`: sprint position/points sit under the same `raceId` but are a different race's result.

#### `non_starter_audit(frame, tables)`

`frame` must be built with `drop_did_not_enter=False` (so the `F` rows are still there). Labels each row via `np.select` into four groups: `F` (did not qualify/prequalify/pass 107%), `W` (withdrew), grid-0-but-raced (pit-lane or exceptional start), regular grid start. Joins `status` for the main statuses; per group: treatment (kept/removed), rows, share, grid-zero share, podium rate, first/last year, rows in train/validation/test. Output (cell 45): regular 24,880 rows kept; grid-0 but raced 87 kept; `W` 335 kept; `F` 1,366 removed (1952-2012, all in training, 0 podiums).

#### `non_starter_experiment(with_f, frame)` (`@_quiet`)

Scores four variants on the same 780 validation rows: **drop `F` rows before features (used)**; keep `F` in history and training; keep `F` in history but drop from training only; also drop `W` rows ("not allowed" by the ruling). Result (cell 45-46): logistic regression moves at most 0.0005; the network up to 0.0144 (inside seed noise). Conclusion: **the decision rests on the ruling and on what a row means (one driver entering one race), not on a score.**

---

<a id="part-04"></a>

## Part 4. Cells 29-40: the three questions, plots, explanations, inference, and the runner


---

### Cell 29 (md): "5. Data-engineering questions"

"The status and nationality rules below support the three required multi-table questions." (**R2**)

### Cell 30 (code): term lists and `engineering_answers`

#### The constants

| Constant | What it is | Why |
| --- | --- | --- |
| `MECHANICAL_TERMS` | Set of ~51 `status` labels counted as **mechanical failures** (Engine, Gearbox, Hydraulics, Brakes, Electrical, Power Unit, Turbo, ERS, Suspension, Tyre, Puncture, Front wing, Rear wing, Wheel, ...) | Q3 needs a mechanical vs non-mechanical grouping that the dataset doesn't supply. Comments record rulings: the instructor (Piazza @10) said to count **Tyre puncture, Fire, Safety belt** as mechanical but **not "Refuelling"**; Engine fire / Engine misfire count (engine failures); Heat shield fire is left out (TA feedback). None of those added statuses occur in 2014-2024, so Q3's result didn't change |
| `CORE_MECHANICAL_TERMS` | A **conservative** set of ~38 labels that name internal systems directly (omits wing, wheel, suspension, tyre, puncture, fire, safety belt, undertray, brake duct) | **Sensitivity analysis only**; the official answer uses `MECHANICAL_TERMS` |
| `NON_START_STATUSES` | `{"Withdrew","Did not start","Did not qualify","Did not prequalify","Excluded"}` | "Recorded non-starters": removed from descriptive denominators, because the question is about race **starts** |
| `NATIONALITY_TO_COUNTRY` | Maps 27 driver nationalities to the circuit `country` strings (e.g. "British" -> "UK", "American" -> "USA", "Monegasque" -> "Monaco") | Q2 needs nationality (a `drivers` field) comparable with the circuit country (a `circuits` field) |

#### `engineering_answers(frame, tables)`: returns a dictionary of eight tables

**Setup:** `starters = frame.assign(status_text=frame.statusId.map(status))` joins the `status` table (by mapping `statusId` -> text), then drops `NON_START_STATUSES`. The modelling table itself already joined `results -> races -> circuits`, `drivers`, `constructors` (cell 10), so each question is a **multi-hop join** (**R2**: "a conclusion from `results.csv` alone is not sufficient").

##### Q1: front-row conversion by circuit and era

```python
q1_source = starters[starters.grid.isin([1, 2])]
q1_source["era"] = np.where(q1_source.year >= 2014, "2014-2024", "1950-2013")
q1 = q1_source.groupby(["era","circuit_name"]).podium.agg(["mean","count"]).reset_index().query("count >= 10")...
```
- **Grain:** one row = one driver start. **Front row** = final **grid** 1 or 2 (not qualifying position) because penalties can make the two differ and the question concerns the actual start (Piazza @9; the brief says "Distinguish qualifying position from grid").
- `groupby(...).podium.agg(["mean","count"])`: the **mean of the 0/1 `podium` flag is the conversion rate**; `count` is the number of front-row starts.
- `.query("count >= 10")`: ignore circuit-eras with fewer than 10 front-row starts (small-sample rates are meaningless).
- Also returns `front_row_overall` (by era) and `starter_overall` (all starters, by era) for context.
- **Missingness/cutoff:** grid is known before the race; qualifying coverage doesn't matter for this question.
- **Answer (cell 48):** overall front-row conversion **56.1% (1950-2013) -> 76.0% (2014-2024)**, against 13.3% -> 14.8% for all starters. Top circuits before 2014: Magny-Cours 80.6% (n=36), Istanbul Park 78.6% (14), Dijon 75% (12). From 2014: Suzuka 88.9% (n=18), Yas Marina 86.4% (22), Monaco 85% (20). **The ranking changes**, and conversion rises everywhere.
- **Caveats:** per-circuit samples are small (10-56; the 2014+ leaders have 14-22); descriptive, not causal (team dominance in the hybrid era, weather and safety cars all play a role).

##### Q2: home advantage, controlling for starting position

```python
home["home_country"] = home.driver_nationality.map(NATIONALITY_TO_COUNTRY)
home = home[home.home_country.notna() & home.grid_position.notna()]
home["home_race"] = home.home_country.eq(home.country)
home["grid_band"] = pd.cut(home.grid_position, [0,3,6,10,15,100], labels=["1-3","4-6","7-10","11-15","16+"])
```
- `home_race` = driver's mapped country equals the circuit's country. Rows with an **unmapped nationality or no grid** are excluded (928 rows, reported).
- **Control for starting position in two ways:**
  1. **Grid bands** (right-closed bins: (0,3], (3,6], (6,10], (10,15], (15,100]): compare podium rate for home vs away *within* a band (`home_effect`; `home_effect.png`).
  2. **Exact grid slot** (`home_exact_grid`; `home_effect_exact_grid.png`), plus a formal **Mantel-Haenszel odds ratio** pooled across slots.
- **The count cube:** `cube[race, grid_slot, home(0/1), podium(0/1)]` holds counts. `common_odds_ratio(counts)` sums the cube over races to get a 2x2 table per grid slot and computes
  `OR_MH = sum_k(home_podium_k * away_nopodium_k / n_k) / sum_k(home_nopodium_k * away_podium_k / n_k)`.
  The **bootstrap** resamples the **race axis** of the cube with replacement 1,000 times (`cube[rng.integers(0, len(races), len(races))]`), recomputes the OR each time, and takes the 2.5th/97.5th percentiles. Working on counts avoids re-fitting 1,000 row-level models.
- **Answer (cells 48-49):** within every grid band home and away podium rates are nearly identical (e.g. P1-3: 55.7% away vs 54.9% home; P16+: 0.76% vs 0.75%). **MH OR = 0.955, 95% interval 0.825-1.110, which includes 1.** (home 2,304 rows, away 21,815.) So there is **no evidence of a home advantage or disadvantage** once starting position is controlled. The raw home/away comparison would be confounded: home drivers may qualify differently.
- **Limits:** the nationality-to-country map is incomplete and one-country-per-driver; an interval spanning 1 *doesn't prove* no effect, only that the data can't show one; observational, not causal.

##### Q3: mechanical-retirement rate by constructor and era

```python
q3_source = starters[starters.year.between(2014, 2024)]
q3_source["mechanical"] = q3_source.status_text.isin(MECHANICAL_TERMS)
q3_source["era"] = np.where(q3_source.year <= 2021, "2014-2021", "2022-2024")
q3 = q3_source.groupby(["era","constructor_name"]).mechanical.agg(["mean","sum","count"]).reset_index()
q3 = q3[q3["count"] >= 20]...
```
- **Numerator:** starts whose final `status` is a component failure. **Denominator:** race starts only (non-starters removed; "ambiguous statuses stay out of the numerator"). **Rate = mean of the 0/1 `mechanical` flag.** `count >= 20`: at least twenty starts per constructor-era.
- **Answer (cell 48):** 2014-2021 highest: **Caterham 23.5% (8/34)**, Lotus F1 20.0% (15/75), Toro Rosso 16.5% (40/242), Renault 14.5% (29/200), McLaren 14.5% (46/318). 2022-2024: **Alfa Romeo 12.5% (11/88)**, Alpine 11.0% (15/136), AlphaTauri 8.0% (7/88), Ferrari 6.6% (9/136). Fleet-wide: **10.1% (329/3,257) -> 6.1% (83/1,354)** with the official list; **8.4% -> 5.6%** with the conservative list. Mechanical reliability improved markedly in the ground-effect era, and the picture holds under the stricter definition.
- **Limits:** the status-to-mechanical mapping is rules-based; renamed teams fragment (Toro Rosso, AlphaTauri, RB are separate rows); small teams have few starts.

Returns: `front_row_circuits`, `front_row_overall`, `starter_overall`, `home_effect`, `home_exact_grid`, `home_adjusted`, `mechanical_retirements`, `mechanical_sensitivity`.

---

### Cell 31 (md) and Cell 32 (code): "5.1 Core result plots"

Helpers; each draws one family of figures and saves a PNG into `artifacts/figures/`. (**R1a, R2 "visualisation of the results"**)

| Function | Draws |
| --- | --- |
| `_save_current_plot(out, name)` | Shared tail: `plt.tight_layout()`, `savefig(..., dpi=150, bbox_inches="tight")`, `plt.close()` (free memory), returns the path |
| `_plot_raw_table_profile` | `raw_table_profile.png`: horizontal bars of **rows per table (log scale)** and **missing-cell share** (initial EDA) |
| `_plot_cleaning_effects` | `cleaning_before_after.png`: left, **rows vs unique driver-races at each stage** (grain); right, podium rate, pit-lane share, missing-finish share per stage. (Seen in the figure: the rows and unique-pair bars match after the first step; the grid-0 share collapses at the last stage) |
| `_plot_analysis_results` | `qualifying_coverage.png` (line: share of rows with a qualifying position per season: **0 before 1994, erratic 1994-2002, ~1.0 from 2003**); `front_row_conversion.png` (top 10 circuits per era); `home_effect.png` (podium rate by grid band, home vs away); `home_effect_exact_grid.png`; `mechanical_retirements.png` (top 10 constructors per era); `model_comparison.png` (**test-set** bars of the five metrics per model); `ablation.png` (PR-AUC change by removed group) |
| `_plot_permutation_importance` | Permutation importance of the **random forest** on a fixed **1,000-row validation sample**: `permutation_importance(forest, X, y, scoring="average_precision", n_repeats=5, random_state=42)`; `importances_mean` = average PR-AUC drop when a feature is shuffled; saves the top-12 bar chart and a CSV |
| `create_plots` | Orchestrates the above and returns a dictionary of paths |

Notes: `groupby("era").head(10)` works because the Q1/Q3 tables are already sorted by era then descending rate, so it keeps each era's top 10. `permutation_importance` is passed the whole **pipeline**, so it shuffles the *raw* columns and lets the imputer/forest see the shuffled data; a sample (not all 780 rows) keeps repeated scoring fast. Permutation importance top values (saved CSV): `grid_position` 0.098, `constructor_podium_rate_5` 0.022, `driver_podium_rate_5` 0.010, `constructor_points_before` 0.009, `driver_age` 0.007.

---

### Cell 33 (md) and Cell 34 (code): "5.2 Random-forest explanations" (**R6a, R6b**)

"Global and local SHAP plus a local LIME surrogate explain the forest from complementary reference points."

#### `shap_explanations(frame, trained, out_dir)`

```python
import shap        # inside try/except ImportError
sample = split["validation"].sample(min(400, len(split["validation"])), random_state=42)
X = forest.named_steps["preprocess"].transform(sample[FEATURES])
explainer = shap.TreeExplainer(forest.named_steps["model"])
values = explainer.shap_values(X)
if isinstance(values, list): values = values[1]          # list of per-class arrays
elif values.ndim == 3:       values = values[:, :, 1]    # 3-D array: rows x features x classes
global_df = DataFrame({"feature": FEATURES, "mean_abs_shap": np.abs(values).mean(axis=0)})
row_values = values[0]                                   # local explanation = first sampled row
```
- **SHAP:** each feature gets a contribution to moving the prediction from the **average prediction** (base value) to this row's prediction; for a forest these are in probability units. `TreeExplainer` computes them **exactly** and fast for tree models.
- The sample is fixed (400 validation rows, seed 42) so the plot is reproducible; transformation through the pipeline's `preprocess` step gives the exact inputs the forest saw.
- The code handles two output formats SHAP has used over versions (list of arrays vs 3-D array) and keeps **class 1 (podium)** only.
- **Global** = **mean absolute SHAP** per feature (bar chart + CSV). **Local** = the SHAP values of row 0 of the sample, saved as bar chart + CSV (with the observed values).
- **The `try/except ImportError` fallback:** if `shap` can't be imported (the comment says Numba's compiled extension is blocked on some managed Windows setups), it reuses saved `shap_global.csv` / `shap_local.csv` if they exist, otherwise re-raises. **Implication for Run All:** on Kaggle `shap` is available and everything is recomputed; on a machine where SHAP can't import *and* there are no cached CSVs, the cell fails.
- **Results (cell 98):** mean |SHAP|: `grid_position` 0.140, `driver_podium_rate_5` 0.070, `constructor_podium_rate_5` 0.065, `constructor_rank_before` 0.041, `driver_rank_before` 0.037, `year` 0.034.

#### `lime_explanation(frame, trained, out_dir, n_samples=5000)`: a hand-written LIME-style surrogate

LIME's idea: to explain one prediction, create many **perturbed copies** of that row, ask the model for their predictions, and fit a **simple weighted linear model** that mimics the model *near that row*.

| Step | Code | Meaning |
| --- | --- | --- |
| Pick the case | `explained = split["validation"].sample(1, random_state=42).iloc[0]` | One fixed validation row: **driver 847 (George Russell, 2021 Dutch GP, grid 11)**; it is the same row SHAP and the logistic explanation use |
| Background | `train.iloc[rng.integers(0, len(train), size=n_samples)]` | 5,000 random **training** rows to draw replacement values from, so the test period can't influence LIME |
| Interpretable mask | `rng.binomial(1, 0.8, size=(n_samples, 16))`; `interpretable[0, :] = 1.0` | For each synthetic row and feature, a 1 means "keep the explained row's value" (probability 0.8). Keeping most values keeps samples *local*. Row 0 is forced to the exact original so the surrogate is anchored at it |
| Perturbed rows | `perturbed.loc[interpretable[:, j].astype(bool), feature] = explained[feature]` | Where the mask is 1, overwrite the background value with the explained row's value; elsewhere keep the random training row's value |
| Model answers | `model.predict_proba(perturbed)[:, 1]` | The **random forest's** podium probability for each perturbed row |
| Distance and weight | `distances = sqrt(sum((1 - mask)**2))`; `kernel_width = 0.75 * sqrt(16) = 3`; `weights = exp(-d^2 / width^2)` | Rows with more replaced features are further from the case and get smaller weight |
| Surrogate | `Ridge(alpha=0.01).fit(interpretable, probabilities, sample_weight=weights)` | A weighted linear regression of the model's probability on the keep/replace mask. Each coefficient = "how much does *keeping this feature's observed value* (rather than a random training value) change the predicted probability" |
| Fidelity | `surrogate.score(interpretable, probabilities, sample_weight=weights)` = **weighted R^2** | How well the surrogate reproduces the model locally |

Results (cell 98): forest probability **0.152**, surrogate **0.152**, **weighted R^2 = 0.203**. Top weights: `grid_position` -0.076 (keeping grid 11 lowers the probability relative to a typical training grid), `driver_rank_before` -0.053, `driver_podium_rate_5` +0.049, `year` -0.037.

**Be honest about it (the notebook is):** it is a *LIME-style* re-implementation (the `lime` package isn't used); local R^2 is only about 0.20, so the individual weights are weak, unstable evidence, which is why **local SHAP is kept as a cross-check** (cell 99). Both agree that `grid_position` is the main negative factor for this driver.

---

### Cell 35 (md) and Cell 36 (code): "5.3 Selected logistic-model explanations"

#### `logistic_explanations(frame, trained, out_dir)`: explain the *selected* model from its own weights

```python
weights = np.asarray(estimator.coef_[0])
scaled  = model.named_steps["preprocess"].transform(pd.DataFrame([explained[FEATURES]]))[0]
contributions = scaled * weights
log_odds = intercept + contributions.sum()
probability = model.predict_proba(...)[0, 1]
```
- **Global:** the 16 standardised coefficients. Because inputs are standardised on training, each weight = **change in log-odds of a podium per +1 training standard deviation** of that feature, so weights are comparable with one another.
- **Local (exact):** for the same validation row (George Russell, 2021 Dutch GP), `contribution_j = standardised_value_j x coefficient_j`; `intercept + sum(contributions) = log-odds`, and `p = 1/(1+e^(-log-odds))`. This is **exact** (no approximation), and a repository test (`test_selected_logistic_local_explanation_reconstructs_probability`) checks it reconstructs the probability. Check: -1.385 + sum -> total -1.897 -> p = 0.1305 = the model's 0.1305.
- Contributions are **relative to the average training driver** (standardised values are measured from the training mean).
- Outputs: `logistic_weights.png/.csv` (global coefficients coloured by sign) and `logistic_local.png/.csv`.

---

### Cell 37 (md) and Cell 38 (code): "6. Inference and end-to-end execution" (**D7, D1**)

#### `predict_podium(record, model, threshold)`: the inference function

```python
row = pd.DataFrame([{feature: record.get(feature, np.nan) for feature in FEATURES}])
probability = float(model.predict_proba(row)[0, 1])
missing = [feature for feature in FEATURES if pd.isna(row.at[0, feature])]
return {"podium_probability": probability, "predicted_podium": bool(probability >= threshold),
        "threshold": threshold, "missing_features": missing, "imputation_warning": ...}
```
- Accepts a dictionary of pre-race values. **Any feature not supplied becomes `NaN`**; the Pipeline's **training-fitted imputer** fills it (the training median), so a partial record still gets a prediction.
- Builds the row in `FEATURES` order (the pipeline was fitted on those named columns). Extra keys are ignored.
- Returns the probability, the thresholded decision, and **discloses every imputed field**, so "silent mass imputation is impossible" (cell 105).
- **Limitation:** the imputed values describe a *typical training driver* (e.g. zero recent podiums), not "unknown", so heavily missing records are biased towards "no podium" (see cell 104).

#### `run_analysis(data_dir, out_dir)`: the whole pipeline in one call

Order of work (this is the notebook's workflow in code, so learn it):

1. `load_raw_tables` -> `audit_tables` (PK/FK) -> `raw_table_profile`.
2. `build_modeling_table` -> `frame` + `diagnostics`; `cleaning_eda` (before/after).
3. `engineering_answers` (Q1-Q3).
4. `train_and_evaluate` -> `trained`, `metrics`, `thresholds` (the three models).
5. Preprocessing: `preprocessing_experiments`, `preprocessing_effects`, `feature_engineering_effects`, `preprocessing_order_experiments`.
6. Split: `split_summary`, `split_integrity`, `split_strategy_experiment`, `split_window_experiment`.
7. Uncertainty: `validation_uncertainty` on validation and on test.
8. Experiments: `missing_value_experiments`, `hyperparameter_search`, `context_feature_experiment`, `constructor_history_audit`, `sprint_weekend_check`; `with_f = build_modeling_table(tables, drop_did_not_enter=False)` then `non_starter_audit`, `non_starter_experiment`.
9. Feature evidence and ablation: `feature_eda`, `ablation_experiments`.
10. Figures: `create_plots`, `preprocessing_plots`, `split_plot`, `feature_eda_plot`.
11. Explanations: `shap_explanations`, `lime_explanation`, `logistic_explanations`.
12. **Save everything** to `artifacts/` as CSVs (so the report can be rebuilt without retraining): `modeling_table.csv`, `model_metrics.csv`, `ablation_results.csv`, ... and each answer table.
13. **Inference demos:** `best_name = metrics[validation].sort_values("PR-AUC", ascending=False).iloc[0].model` -> **Logistic regression** (highest *validation* PR-AUC). `complete` = `frame.loc[frame.year.ge(2022), FEATURES].dropna().iloc[0]`: the first 2022+ row with no missing feature, which is **Lewis Hamilton at the 2022 Bahrain GP** (grid 5, he finished 3rd); `partial` = `{"grid_position": 3, "pit_lane_start": 0, "front_row": 0, "field_size": 20, "year": 2024}`.
14. Write `summary.json` (diagnostics, thresholds, demos, status lists, library versions) and return everything in one dictionary.

**Why one big function:** the notebook is "Run All"-ready with no hidden manual steps (D1), and every table/figure is produced from the same fitted objects.

---

### Cell 39 (md) and Cell 40 (code): "7. Run the complete pipeline"

```python
from IPython.display import Image, display
pd.set_option("display.max_rows", 200)
pd.set_option("display.max_colwidth", None)
results = run_analysis(DATA, OUT)
display(results["summary"])
```
- `Image`, `display`: show tables and PNGs inline. The `pd.set_option` lines stop pandas truncating long tables and text.
- `results = run_analysis(DATA, OUT)`: **this is the only cell that does the heavy computation** (hundreds of model fits across the search, experiments and bootstraps, plus SHAP/LIME). It is the slowest cell; the saved output has no timing, so I can't quote a runtime.
- **Every later cell reads from `results`** (and the PNGs under `OUT/figures`). If this cell is skipped, they fail with `NameError`.

**Saved output (what to say):**
- `diagnostics`: `raw_result_rows 26,759` -> `duplicate_driver_race_groups 85` -> `rows_after_shared_drive_resolution 26,668` -> `did_not_enter_rows_removed 1,366` -> `clean_rows 25,302`; `unique_grain: True`; years 1950-2024.
- `thresholds`: LR **0.625**, forest **0.775**, network **0.455**.
- `inference_demos`: model Logistic regression; complete record probability **0.906**, predicted podium True; partial record probability **0.387**, predicted False, 11 of 16 features imputed.
- `mechanical_statuses` (the counted labels), `non_start_statuses`, `runtime_versions` (Python 3.12.10, numpy 2.5.3, pandas 3.0.6, scikit-learn 1.9.1, matplotlib 3.11.2, seaborn 0.13.2).

---

<a id="part-05"></a>

## Part 5. Cells 41-106: the executed results, section by section


From here the notebook stops defining and starts **showing and interpreting**. Almost every code cell is just `display(results[...])` (a table) or `display(Image(...))` (a saved PNG). For each, this file gives: **what is displayed -> how to read it -> the numbers -> what to say -> caveats.**

I checked the numbers quoted in the notebook's markdown against the saved outputs; where a claim is slightly off I say so.

---

### Section 8: Audit, cleaning, and before/after EDA (cells 41-46)  [R1a, R1c, R1d]

#### Cell 41 (md)
Announces what the next cell shows: key uniqueness, null keys, orphan references, and the cleaning comparison.

#### Cell 42 (code): audits + profile + cleaning + three figures

```python
display(results["pk_audit"]);  display(results["fk_audit"]);  display(results["raw_table_profile"])
display(results["summary"]["diagnostics"]);  display(results["cleaning_eda"])
display(Image(filename=str(OUT / "figures" / "cleaning_before_after.png"))) ... qualifying_coverage.png ... raw_table_profile.png
```

| Output | How to read it | Key numbers |
| --- | --- | --- |
| `pk_audit` (14 rows) | One row per table: key, rows, null keys, duplicate keys | **All 14: 0 null, 0 duplicate.** Sizes: `results` 26,759; `lap_times` 589,081; `races` 1,125; `drivers` 861; `qualifying` 10,494 |
| `fk_audit` (22 rows) | One row per relationship: values checked, orphans | **All 22: 0 orphans** (e.g. `results.driverId -> drivers.driverId`: 26,759 checked, 0 orphans) |
| `raw_table_profile` | Per-table size and missingness (after `\N` -> NaN) | `races` 56% of cells missing; `results` 25.5%; `constructor_results` 20%; `drivers` 20%; `qualifying` 12.4%; most others 0% |
| `diagnostics` | The row-count story | 26,759 -> 85 groups -> 26,668 -> -1,366 `F` -> 25,302 |
| `cleaning_eda` | Three stages | rows 26,759 / 26,668 / 25,302; duplicates 176 / 0 / 0; podium rate 12.69% / 12.73% / 13.42%; grid-0 share 6.12% / 6.13% / 1.14%; median grid 12 / 12 / 12 |
| `cleaning_before_after.png` | Left: rows vs unique driver-race pairs (equal bars once fixed). Right: podium rate / pit-lane share / missing-finish share per stage | The grid-0 share collapses only at the third stage |
| `qualifying_coverage.png` | Share of rows with a qualifying position, per season | **0 before 1994; erratic 1994-2002 (dipping to ~0.06 in 2001); ~1.0 from 2003.** This is the "historical qualifying-coverage drift" |
| `raw_table_profile.png` | Log-scale row counts; missing share per table | `lap_times` dwarfs the rest |

**Why the PK audit passing isn't the end of the story:** `resultId` is unique, but `(raceId, driverId)` is not (85 groups). That's why grain is audited separately in `cleaning_eda`.

#### Cell 43 (md): the cleaning interpretation
Two steps. **Grain fix:** 85 groups -> 91 rows removed -> exactly one row per `(raceId, driverId)`, **without moving the target** (12.69% -> 12.73%) **or the median grid** (12). **`F` removal:** 1,366 rows, none a podium, so the podium rate rises to **13.42% by arithmetic alone** and the grid-0 share falls from 6.1% to 1.1%. Qualifying coverage is sparse in old seasons, so the notebook keeps a missingness flag and uses final grid as the historically broader pre-race signal "rather than discarding early history".

#### Cell 44 (md) + Cell 45 (code): "8.1 Who has grid 0?" (audit and experiment)

`display(results["non_starters"].round(3))` and `display(results["non_starter_experiment"].round(4))`.

**Audit table (4 groups):**

| Group | Treatment | Rows | Share | Grid-0 share | Podium rate | Years | In train / val / test |
| --- | --- | --- | --- | --- | --- | --- | --- |
| regular grid start | kept | 24,880 | 93.3% | 0 | 13.6% | 1950-2024 | 22,806 / 759 / 1,315 |
| grid 0 but raced (pit-lane / exceptional) | kept | 87 | 0.3% | 1.0 | 0 | 1981-2024 | 34 / 16 / 37 |
| `W` withdrew | kept ("code only known after the race") | 335 | 1.3% | 0.60 | 0 | 1950-2024 | 323 / 5 / 7 |
| `F` did not qualify / prequalify / 107% | **removed before features** | 1,366 | 5.1% | 0.985 | 0 | 1952-2012 | 1,366 / 0 / 0 |

**Experiment table (4 variants x 2 models, same 780 validation rows):** PR-AUC changes vs the used choice: keep `F` rows: LR **-0.0005**, MLP **+0.0144**; keep `F` in history but drop from training only: -0.0001 / +0.0126; also drop `W` rows ("not allowed"): 0.0000 / +0.0182. Training field size: 23.25 (used) vs 25.06 with `F` rows. Training pit-lane share: 1.0% vs 6.4%.

#### Cell 46 (md): "What the audit shows" / decision / evidence / what changes

- **Surprise to explain:** before the `F` step, 6.1% of rows have grid 0 and the name `pit_lane_start` suggests pit-lane starts. **They mostly are not.** Of 1,635 grid-0 rows: 1,346 are `F` drivers who never raced, 202 are withdrawals, only **87** are genuine pit-lane or exceptional starts (1,346 + 202 + 87 = 1,635 ✓).
- **Decision (instructor ruling):** remove `F` (known before the race; the driver never entered it, so the row isn't "one driver entering one race"); keep `W` (code only known after the race; grid 0 may also be a real pit-lane start). `F` rows are removed **before any feature is built**, so a skipped weekend doesn't count as a race in `driver_podium_rate_5` or `driver_races_before`, and doesn't inflate `field_size`.
- **Evidence it's safe:** logistic regression moves <=0.0005; the network's ~0.014 is inside seed noise (a single seed sits up to 0.021 from its 3-seed mean). **"The choice rests on the ruling and on what a row means, not on a score."**
- **What changes:** `pit_lane_start` now marks **289** rows (202 `W` + 87 real) and is "still not a pure pit-lane flag".

---

### Section 9: Answers to the three data-engineering questions (cells 47-49)  [R2]

#### Cell 48 (code)
Loops over `results["answers"]` printing each table (top 10 per era for tables with an `era` column), then prints the mechanical and non-start status lists, then shows four figures: `front_row_conversion`, `home_effect`, `home_effect_exact_grid`, `mechanical_retirements`.

**Q1 (front-row conversion):** see file 04 for the table. One-line answer: **front-row conversion jumps from 56.1% (1950-2013) to 76.0% (2014-2024); the best circuits change** (Magny-Cours 80.6% / Istanbul 78.6% / Dijon 75% pre-2014; Suzuka 88.9% / Yas Marina 86.4% / Monaco 85% since). Uses final **grid**, not qualifying position.

**Q2 (home race):** podium rate by grid band is virtually the same for home and away in every band; the **Mantel-Haenszel odds ratio is 0.955 (95% CI 0.825-1.110)**: the interval contains 1, so no demonstrated home effect. Home rows 2,304, away 21,815; 928 excluded (unmapped nationality or no grid).

**Q3 (mechanical retirements):** 2014-2021 leaders Caterham 23.5%, Lotus F1 20.0%, Toro Rosso 16.5%; 2022-2024 leaders Alfa Romeo 12.5%, Alpine 11.0%, AlphaTauri 8.0%; fleet-wide 10.1% -> 6.1% (official list) and 8.4% -> 5.6% (conservative list).

#### Cell 49 (md): the three interpretations
- **Front-row conversion:** eras split at 2014; >=10 front-row starts per circuit-era; final grid defines the front row; non-starters excluded from the denominator.
- **Home-country effect:** bands + exact slot + MH odds ratio with a race-cluster bootstrap; "an interval spanning 1 does not establish a home advantage or disadvantage"; **associational, not causal**.
- **Mechanical retirements:** starters as denominator, documented component statuses as numerator, >=20 starts per constructor-era; the official list is shown beside a stricter sensitivity list; "ambiguous status coding remains a limitation, and the original Piazza export is not archived in this repository".

---

### Section 10: Leakage-safe features (cells 50-67)  [R3a, R3c]

#### Cell 50 (md) / Cell 51 (code) / Cell 52 (md)
`display(FEATURE_GROUPS)` prints the 5 groups / 16 features. Cell 52 (md) is the **leakage statement**: every selected feature is known after qualifying and before the start; driver form shifts before rolling; constructor outcomes are aggregated by race before shifting; standings attach only to the following race; **current-race position, points, status, laps, pit stops and fastest-lap information never enter `FEATURES`.**

#### Cells 53-55: "Standings before the first race of a season"

- **Cell 53 (md):** originally, before a driver's or team's first race of a season there were no standings, the cells were empty, and the median imputer filled them with ~3 points and rank 13 (inventing points nobody had scored). **Fix:** set them to **0 points, rank 0** when features are built, so the imputer no longer touches the standings columns.
- **Cell 54 (code):** a sanity check on the modelling table: round-1 rows have `driver_points_before == 0` and `driver_rank_before == 0` (printed `[0.]`), and **0 empty standings cells remain**.
- **Cell 55 (md):** they also tried adding flag columns to mark these rows (rank 0 could look "better than first place"); no validation gain (LR unchanged, forest and network lower), so **no flags** were added.
- **Caveat to know:** rank 0 is numerically "ahead of P1". It works because points = 0 and the rank weight is small (`driver_rank_before` coefficient -0.076).

#### Cells 56-58: "10.1 Sprint races: a leakage judgement call"

- **Cell 57 (code):** `display(results["sprint_check"].round(3))`: one row per sprint season: 2021 (3 sprints, 60 rows, validation), 2022 (3, 60, test), 2023 (6, 120, test), 2024 (6, 120, test); `sprint_ends_before_race_share` = 1.0 and `days_before_race` = 1.0 in all; Spearman grid vs sprint finish 0.886 / 0.989 / 0.619 / 0.542; grid vs qualifying 0.826 / 0.723 / 0.987 / 0.963; `sprint_rows_in_training` = 0.
- **Cell 58 (md): the argument.**
  1. **Timing:** every sprint ends one day before the main race, so a sprint result *is* known before lights out: **not post-race information**.
  2. **Why still excluded:** (a) sprints exist only from 2021, so **0 training rows**: a sprint feature would be empty for everything the model learns from; (b) in 2021-2022 the sprint **set the main-race grid**, so grid features already contain it; from 2023 the sprint stopped setting the grid and would add a separate signal for only 12 weekends. So "by design, not because they leak".
  3. **The real hazard:** sprint finishing position and points sit under the same `raceId` as the main race, so a naive join by `raceId` would look harmless but mixes a *different race's* result. Standings are already moved to the next race, so sprint points reach features only through the previous round.

#### Cells 59-61: "10.2 Exploratory evidence for every individual feature"  [R3a]

- **Cell 60 (code):** `display(results["feature_eda"].drop(columns=["bins"]).round(3))` then `feature_eda.png`.
- **How to read the table** (training seasons only): `missing_share_train`; `podium_rate_when_missing`; podium rate in the lowest vs highest bin; `auc_train` / `auc_validation` (one-feature ROC-AUC: >0.5 higher value = more podiums; <0.5 the reverse); `signal_strength = |AUC-0.5|*2`; `same_direction_in_validation`. **How to read the figure:** a 4x5 grid, one small bar panel per feature (podium rate per equal-count bin; orange bar = rows where the feature is missing; title shows AUC and % missing).
- **Key numbers (verified against output):**

| Feature | AUC (train) | Direction | Note |
| --- | --- | --- | --- |
| `qualifying_position` | 0.095 | lower = more podiums | measured only on the 36% of rows that have it; podium rate falls from 52.5% (best bin) to 0.7% |
| `grid_position` | 0.119 | lower = more podiums | 47.1% -> 0.5% |
| `driver_podium_rate_5`, `constructor_podium_rate_5` | 0.810, 0.826 | higher = more | validation 0.836, 0.854 |
| `driver_points_before`, `constructor_points_before` | 0.755, 0.724 | higher = more | |
| `driver_rank_before`, `constructor_rank_before` | 0.265, 0.259 | lower = more | |
| `front_row`, `driver_races_before` | 0.672, 0.662 | higher = more | |
| `field_size` 0.454, `driver_age` 0.552, `qualifying_time_seconds` 0.451, `pit_lane_start` 0.494, `qualifying_missing` 0.490, `year` 0.505 | near 0.5 | weak alone | |

- **Cell 61 (md), the narrative:** *Strong single signals* = position features, then standings ranks, form, points; `front_row` and `driver_races_before` clear but smaller; all keep the same direction on validation. *Weak single signals, kept for a different reason:* `field_size`, `driver_age`, `qualifying_time_seconds` (not comparable across circuits and eras without the rest of the row), the two flags (they mark *which rows were imputed*; rows with no qualifying podium at about the average rate, 12.9% vs 13.3%), and `year` (essentially no single-feature signal; flat on validation). The ablation shows the whole context group adds the least (0.001). **What this evidence does and does not show:** a one-feature AUC ignores the other 15 features, so a weak feature can still help in combination and a strong one can add little once grid is present (qualifying adds only 0.006 on top of grid); AUCs are **association**, not causal.

**This is the "hypothesis-driven (EDA-supported)" motivation** the checklist describes, backed by the ablation (after training) and the context experiment (trial-and-error).

#### Cells 62-64: "10.3 Calendar features: keep `year`, remove `round`"

- **Cell 63 (code):** the `context_experiment` table and a pivot of `PR-AUC_change_vs_used` by variant and model.
- **Numbers (validation PR-AUC change vs used):**

| Variant | LR | Forest | Network |
| --- | --- | --- | --- |
| put `round` back | -0.0008 | -0.0036 | +0.0003 |
| also remove `year` | +0.0006 | **-0.0123** | **-0.0212** |
| `round` back, `year` removed | -0.0012 | -0.0074 | -0.0360 |

- **Cell 64 (md):** *`round` adds nothing* (changes within the ~0.010 noise of a 3-seed average; they don't even agree in direction; the information is already in the standings, since points/rank accumulate race by race; and `round` doesn't mean the same across eras: ~8 races in the 1950s vs 24 in 2024). *`year` helps the nonlinear models* (-0.012, -0.021), because together with grid and form it lets them adjust for era (larger fields, worse reliability, missing qualifying in old seasons). **Caveat:** the test years lie outside the training years, so the models must extrapolate `year`; a tree can't, so the forest treats 2022 like 2019. *Why one seed isn't enough:* with `round`, the network's seed-42 score was 0.7443 (0.021 above its 3-seed mean 0.7232); without `round` it's 0.7166 vs 0.7228 mean; "this is why we read single-seed network differences of about 0.021 as noise throughout the notebook."

#### Cells 65-67: "10.4 Team renames and reused constructor ids"

- **Cell 66 (code):** `display(results["constructor_history"])`: 10 team-seasons since 2014 flagged "new id: form starts empty" (Manor Marussia 2015, Haas 2016, Racing Point 2019, AlphaTauri 2020, Alpine 2021, RB 2024) or "reused id: form comes from YEAR" (Renault 2016 <- 2011, Alfa Romeo 2019 <- 1985, Aston Martin 2021 <- 1960, Sauber 2024 <- 2018). Each has 10 rows in its first five races, **0 podiums**, max constructor form 0.
- **Cell 67 (md):** what happens; **how much it matters** (only constructor form; standings restart each season; driver form follows the driver; 30 of 780 validation rows and 20 of 1,359 test rows affected; none a podium; an empty value is filled with the training median, which is 0, so a reset team and a team with no recent podiums look the same); **Decision:** keep ids as in the data and document the reset (merging renamed teams needs a judgement per case: e.g. Toro Rosso -> AlphaTauri was a rebrand but Force India -> Racing Point followed a sale out of administration). Listed as a limitation. (README: "Still open".)

---

### Section 11: Proper train / validation / test split (cells 68-73)  [R3b]

#### Cells 69-70: split table, integrity, plot, strategy experiment

`display(split_summary)`, `display(split_integrity)`, `chronological_split.png`, `display(split_strategies)`.

| Split | Years | Rows | Races | Drivers | Podium rate | Qualifying missing |
| --- | --- | --- | --- | --- | --- | --- |
| train | 1950-2019 | 23,163 (91.5%) | 1,018 | 800 | 13.27% | 64.0% |
| validation | 2020-2021 | 780 (3.1%) | 39 | 28 | 15.00% | 0.13% |
| test | 2022-2024 | 1,359 (5.4%) | 68 | 28 | 15.01% | 0% |

All seven integrity checks pass. Strategy experiment: chronological PR-AUC 0.730 / ROC 0.926 with 0% same-race and 0% future leakage; random races 0.627 / 0.920 with 0% and 100%; random rows 0.588 / 0.901 with 100% and 98%.

**Cell 70 (md), the three paragraphs to know:**
- **Choice:** by season, every race in exactly one split, all training races before all validation races before all test races; matches deployment (on race morning you only know earlier seasons).
- **Roles:** training fits the imputer, scaler and model weights; **validation is used for every decision** (preprocessing variant/order, ablation, model choice, threshold); the **test seasons are scored once**, after choices are frozen.
- **Why not random:** a random-row split puts same-race teammates/rivals in training for ~all held-out rows and trains on later seasons; random races removes same-race leakage but still trains on later seasons; random splits also mix every era, so their score answers a different question. **Shift between splits:** training has far more missing qualifying and larger fields, hence a lower podium rate; that shift is real and is the reason for a separate *recent* validation period.

(Remember: the random splits score *lower*, not higher; see file 02 for the explanation.)

#### Cells 71-73: "11.1 Is 2019 the right boundary? Other validation windows and uncertainty"

- **Cell 72 (code):** `split_windows` and `validation_uncertainty` (rounded).
- **Windows:** LR PR-AUC 0.716 (2014-15), 0.728 (2016-17), 0.689 (2018-19), **0.730 (2020-21, used)**; MLP 0.714, 0.740, 0.726, **0.717**. Validation podium rate 14.3-15.0%; 38-42 races each.
- **Bootstrap (39 validation races):** LR 0.730 [0.621, 0.838]; forest 0.717 [0.600, 0.832]; MLP 0.717 [0.605, 0.828]; forest minus LR **-0.013 [-0.048, +0.028]**; MLP minus LR **-0.014 [-0.040, +0.015]**.
- **Cell 73 (md) conclusions:** the score depends on which two seasons are held out (LR 0.689-0.730; MLP 0.714-0.740): **a validation score shouldn't be read as the expected test score**; each model's 95% interval is ~0.2 wide; both difference intervals include 0 => "the data do not show that any model is better than the baseline"; **keep the chronological split but report the ranking as a tie within validation uncertainty.** (Test seasons score lower: LR 0.702, MLP 0.716.)

---

### Section 12: Effect of feature engineering and preprocessing (cells 74-78)  [checklist: effect of the step on data distribution/range/values]

#### Cells 75-76: "12.1 Feature-engineering steps"
`display(results["feature_engineering_effects"])`, 8 rows (all 25,302 rows):

| Column | missing | zero share | min / median / max | Reading |
| --- | --- | --- | --- | --- |
| `grid (raw)` | 0 | 1.14% | 0 / 11 / 34 | zeros sit numerically *ahead of pole* |
| `grid_position (0 -> missing)` | 1.14% | 0 | 1 / 12 / 34 | zeros became missing; min is now 1 |
| `pit_lane_start (grid == 0)` | 0 | 98.86% | 0 / 0 / 1 | the information moved to a flag (mean 0.0114) |
| `q1/q2/q3 text present` | 0 | 1.5% | | 98.5% of qualifying rows have some time |
| `best qualifying seconds (parsed)` | 1.5% | | 53.4 / 86.7 / **1002.6** | strings -> seconds (the 1002.6 is the typo row) |
| `qualifying_time_seconds (joined)` | **59.2%** | | | the left join exposes missing qualifying history |
| `driver_podium_rate_5 (shifted)` | 3.2% | 64.7% | 0 / 0 / 1 | missing on a first race |
| `driver_points_before` | 0 | 40.8% | 0 / 3 / 549 | zero when nothing has been scored yet |

#### Cells 77-78: "12.2 Imputation and scaling"
`display(effects[...])`, `preprocessing_distributions.png`, `preprocessing_ranges.png`.
- **Cell 78 (md):** **Median imputation** writes the training median into every missing cell; qualifying position/time (64% missing) get a tall spike and their std falls ~40%; other features lose 0-1%; ranges don't change; the flag keeps the information that a value was filled. **Standardisation** gives every training feature mean 0 / std 1; ranges that differ by orders of magnitude (`constructor_points_before` 0-722 vs flags 0-1) become comparable, so neither LR's penalty nor the MLP's gradient steps are dominated by large-unit features; it is linear, so shape and order are unchanged: long right tails stay long (the 1002.6 s time lands ~97 SD out). **Fitted on training only:** validation/test means are *not* zero: `year` ~+1.7 SD, prior points ~+0.9, `field_size` ~-1.0, `qualifying_missing` ~-1.3, "the honest view of period shift ... what the model sees at deployment".

---

### Section 13: Preprocessing experiments: strategy and order (cells 79-84)  [R5b, R5c]

#### Cells 80-81
`display(results["preprocessing"])` (3 strategies, validation): median+scaling PR-AUC 0.7301 / ROC 0.9257; median no scaling 0.7313 / 0.9255; zero+scaling 0.7262 / 0.9268.

`display(order)` and a pivot:

| Experiment / order | LR PR-AUC | MLP PR-AUC | Value a missing cell becomes |
| --- | --- | --- | --- |
| A: impute -> scale (train) | 0.7301 | 0.7166 | grid 12.0, qual. time 87.24 |
| A: scale -> impute (train) | 0.7301 | 0.7330 (+0.0164) | same medians; qualifying std after imputation 0.597 |
| B: zero-fill -> scale | 0.7262 | 0.7401 | grid **0**, time **0** |
| B: scale -> zero-fill | 0.7304 (+0.0043) | 0.7347 (-0.0054) | grid 12.002, time 88.78 (training means) |
| C: impute -> scale fitted on **all years** | 0.7302 (+0.0001) | 0.7374 (+0.0208) | grid 12.0, time 86.69 |

**Cell 81 (md)** interprets A/B/C (see file 03). **Closing line:** "We keep split -> median imputation -> scaling for the linear model and the MLP, and median imputation without scaling for the forest."

**What to say about C:** it uses future seasons to set the medians and scales used in training. Even if it nudged a score, it is leakage, which is why preprocessing sits inside the Pipeline and is fitted on training rows only.

#### Cells 82-84: "13.1 Missing values: impute, drop columns, or drop rows?"
`display(missing.round(4))` and a pivot of `PR-AUC_change_vs_used`:

| Variant | Train rows | LR change | MLP change |
| --- | --- | --- | --- |
| median imputation (used) | 23,163 | 0 | 0 |
| mean imputation | 23,163 | +0.0003 | -0.0100 |
| KNN (k=5) | 23,163 | -0.0024 | +0.0160 |
| iterative (regression) | 23,163 | -0.0021 | +0.0169 |
| median, without `qualifying_missing` flag | 23,163 | -0.0007 | -0.0053 |
| drop sparse columns (`qualifying_position`, `qualifying_time_seconds`) | 23,163 | -0.0059 | **-0.0305** |
| drop training rows with no qualifying (1994+) | 8,348 | -0.0011 | -0.0111 |
| drop training rows with any missing feature | 8,054 | +0.0014 | +0.0221 |

**Cell 84 (md) decision:** median + missing flag, fitted on training rows only, keeps all 23,163 rows and is "never meaningfully beaten". Judge on **logistic regression** (no seed noise; every alternative within 0.006). Network changes (-0.030 to +0.022) are noise-sized: one seed can move 0.021. Only dropping the qualifying columns (-0.030) stands out, which argues *against* dropping them. Dropping rows throws away about two thirds of history, including most long-run driver and team form.

---

### Section 14: Model comparison: train, validation, unseen test (cells 85-93)  [R4, D4]

#### Cells 86-87: the metrics table

`display(results["metrics"])`, `model_comparison.png` (test bars), and the validation-only ranking.

| Model (threshold) | Split | ROC-AUC | **PR-AUC** | F1 | Precision | Recall |
| --- | --- | --- | --- | --- | --- | --- |
| Logistic regression (0.625) | train | 0.899 | 0.562 | 0.578 | 0.461 | 0.773 |
| | validation | 0.926 | **0.730** | 0.700 | 0.630 | 0.786 |
| | test | 0.935 | **0.702** | 0.664 | 0.529 | 0.892 |
| Random forest (0.775) | train | 0.927 | 0.646 | 0.602 | 0.606 | 0.599 |
| | validation | 0.927 | **0.717** | 0.704 | 0.717 | 0.692 |
| | test | 0.937 | **0.717** | 0.657 | 0.662 | 0.652 |
| Shallow NN (0.455) | train | 0.902 | 0.576 | 0.525 | 0.603 | 0.465 |
| | validation | 0.922 | **0.717** | 0.710 | 0.784 | 0.650 |
| | test | 0.933 | **0.716** | 0.626 | 0.720 | 0.554 |

**How to read it:**
- **ROC-AUC ~0.93 for all three:** each model separates podium from non-podium very well and almost identically. PR-AUC is stricter: ~0.70-0.73 (the random baseline is the podium rate, ~0.15, so ~4.7x better than chance).
- **Validation-only selection ranking:** LR 0.730 > forest 0.717 > network 0.717 (the *selection* uses validation PR-AUC only).
- **Training scores are *lower* than validation** for all three (LR 0.562 vs 0.730). That is the **distribution shift** (cell 87): training includes 1950-1993 (no qualifying, lower podium rate 13.3% vs 15.0%, bigger and less reliable fields), a harder problem than modern racing. For the forest it holds *only because* depth/leaf were limited (its first settings memorised: training 0.918).
- **Test F1 is below validation F1** for all (LR 0.700 -> 0.664; MLP 0.710 -> 0.626): validation F1 is optimistic because the threshold was tuned on it. LR on test: precision 0.529 / recall 0.892 means the frozen threshold flags too many drivers on test.

**Cell 87 (md):** LR = statistical baseline; forest = non-linear interactions; MLP = the two-hidden-layer shallow NN. **PR-AUC is the selection metric because the positive class is uncommon.** Thresholds 0.625 / 0.775 / 0.455 maximise validation F1 and are frozen before test scoring.

#### Cells 88-90: "14.1 Hyperparameter search and an honest improvement attempt for each model"

`display(tuning[...].round(4))`: 29 rows (8 + 9 + 12).

| Model | Initial setting (validation / **training** PR-AUC) | Adopted (validation / training; rank) | Best in grid |
| --- | --- | --- | --- |
| LR | C=1, L2: 0.7301 / 0.562 | same; rank 3 of 8 (top is 0.7303) | C=1, L1: 0.7303 |
| Forest | depth None, leaf 4: 0.6955 / **0.918** (rank 6/9) | depth 12, leaf 30: 0.7175 / 0.646 (**rank 1/9**) | same as adopted |
| Network | (32,12), alpha 0.002: 0.7179 (rank 9/12) | (32,12), alpha 0.02: 0.7228 ± 0.005 (rank 7/12) | (64,), alpha 0.002: 0.7362 ± 0.012 |

**Cell 90 (md), three paragraphs:**
- **Forest improved:** unlimited depth and tiny leaves memorised (training 0.918 vs validation 0.696); limiting depth/leaf fixed it without touching test. *(The sentence "only 0.000 higher" is a leftover: the adopted forest is the best in the grid.)*
- **Network: a noisy search:** 1-2 layers of 8-64 units x two alphas, all 3-seed averages. The adopted (32,12)/0.02 ranks 7th of 12; the best is only 0.013 higher while a single setting's seed spread reaches 0.025; with `round` in the features the adopted setting ranked first, so the ranking moves with one input and one seed, and "chasing the top ... would be selecting noise". Networks with 8 units are clearly worse, so **the network is not a deliberately weak model** (a point the instructor raised, README @6).
- **Logistic regression: insensitive** (all settings 0.710-0.730).
- **A caution about the headline number:** the network's 0.7166 in section 14 is seed 42; its 3-seed average is 0.7228 (SD 0.005), still below LR's 0.7301, so **LR is highest on validation by either measure**.

#### Cells 91-93: "14.2 Does the added complexity earn its place?"

- **Cell 92 (code):** `display(results["test_uncertainty"].round(4))`: bootstrap over the **68 test races**: LR 0.702 [0.647, 0.761]; forest 0.717 [0.659, 0.778]; MLP 0.716 [0.662, 0.774]; forest minus LR **+0.0149 [-0.011, +0.046]**; MLP minus LR **+0.0134 [-0.016, +0.044]**.
- **Cell 93 (md):** the forest and network are level at the top (0.717 / 0.716), LR ~0.013 behind, but both difference intervals include zero (as do the validation ones), so **"the data do not support claiming that a more complex model is better."** Treat the three as equivalent in ranking quality and decide on other properties: LR is the baseline, easiest to explain (readable coefficients), stable across seeds, little tuning; it is nominally highest on validation PR-AUC (the selection score) so it's used for the inference demo; the forest/network are slightly higher on test, but the bootstrap puts that within noise and the **test seasons were not used to choose a model**. The non-linear models gain little because the strongest signals (grid, qualifying position, recent form) are close to **monotonic** in podium odds, which the linear model already captures. PR-AUC is primary because ~1 in 8 entrants reaches the podium; ROC-AUC is secondary.

*(Why this is a safe stance: the selection rule was fixed in advance (validation PR-AUC), complexity has to earn its place, and the intervals say there is no significant difference, so the simplest, most explainable model wins the tie.)*

---

### Section 15: Feature-group ablation (cells 94-96)  [R5a]

- **Cell 95 (code):** `display(results["ablations"])` and `ablation.png`.

| Variant | Features | Validation PR-AUC | Change |
| --- | --- | --- | --- |
| all features | 16 | 0.7301 | 0 |
| without grid | 12 | 0.7047 | **-0.0253** |
| without qualifying | 13 | 0.7240 | -0.0061 |
| without form | 13 | 0.7136 | -0.0165 |
| without standings | 12 | 0.7127 | **-0.0173** |
| without context | 14 | 0.7288 | -0.0013 |

- **Cell 96 (md):** each experiment removes one complete feature group and retrains the logistic baseline; the change from the full model measures **incremental predictive contribution after training**, and complements the earlier (pre-training) exploratory motivation. That pairing is exactly what the brief describes.
- **Say:** *grid* matters most (-0.025), then *standings* (-0.017) and *form* (-0.016); *qualifying* adds little once grid is present (-0.006, because they overlap); *context* adds least (-0.001).

---

### Section 16: Global and local explainability (cells 97-102)  [R6]

#### Cells 98-99: random-forest explanations

Cell 98 shows four figures (`permutation_importance`, `shap_global`, `lime_local`, `shap_local`) then three tables: `shap_global.head(12)`, `lime_local.head(12)`, `shap_local.head(12)`.

| Method | Scope | Top features |
| --- | --- | --- |
| Permutation importance (forest, 1,000 validation rows, 5 repeats) | global | `grid_position` 0.098; `constructor_podium_rate_5` 0.022; `driver_podium_rate_5` 0.010; `constructor_points_before` 0.009 |
| SHAP (TreeExplainer, 400 validation rows) | global | mean abs SHAP: `grid_position` 0.140; `driver_podium_rate_5` 0.070; `constructor_podium_rate_5` 0.065; `constructor_rank_before` 0.041; `driver_rank_before` 0.037; `year` 0.034 |
| LIME-style surrogate | local (George Russell, 2021 Dutch GP, grid 11, actual: no podium) | `grid_position` -0.076, `driver_rank_before` -0.053, `driver_podium_rate_5` +0.049, `year` -0.037; forest probability 0.152; **weighted R^2 0.203** |
| Local SHAP | local (same row) | `grid_position` -0.160, `driver_rank_before` -0.071, `constructor_rank_before` -0.060, `driver_podium_rate_5` +0.055, `year` -0.039 |

**Cell 99 (md) to say:** permutation importance = validation PR-AUC change after shuffling one feature; global SHAP = average contribution magnitude; local LIME explains one fixed validation prediction with 5,000 perturbations around that row and a distance-weighted ridge surrogate; **its weighted R^2 is only ~0.20, so its coefficients are weak, unstable local evidence rather than a faithful decomposition**; positive weights push towards a podium, negative away; local SHAP is a supplementary cross-check; correlated predictors can split importance differently across methods; these describe fitted-model reliance and are **not causal effects**.

**Key agreement:** grid position is #1 in permutation importance, SHAP, LIME, local SHAP, and the ablation. **Why the methods can disagree on the rest:** permutation importance measures score loss from breaking a feature (correlated features can compensate), SHAP shares credit among correlated features, LIME is a local linear approximation.

#### Cells 100-102: "16.1 Explaining the selected model directly: logistic regression weights"

- **Cell 101 (code):** `logistic_weights.png`, the global coefficient table, `logistic_local.png`, the local decomposition table.
- **Global coefficients (per +1 training SD):** `grid_position` **-1.443**; `pit_lane_start` -0.631; `year` -0.356; `constructor_podium_rate_5` +0.291; `driver_points_before` +0.251; `driver_races_before` +0.244; `constructor_rank_before` -0.238; `driver_podium_rate_5` +0.218; `driver_age` -0.185; `qualifying_position` -0.164; `constructor_points_before` -0.147; `qualifying_missing` +0.096; `driver_rank_before` -0.076; `front_row` +0.045; `field_size` +0.040; `qualifying_time_seconds` +0.020. Intercept -1.385.
- **Local decomposition (George Russell, 2021 Dutch GP, grid 11, did not podium):** intercept -1.385 + contributions = log-odds **-1.897** -> probability **13.0%**, below the 0.625 threshold. Largest contributions: `year` **-0.603** (2021 is +1.69 SD from the training mean and the weight is negative), `driver_age` +0.232, `grid_position` +0.211 (P11 is slightly *better* than the historical average start of P12), `constructor_rank_before` -0.159, `qualifying_missing` -0.127.
- **Cell 102 (md) to say:** logistic regression is the selected model and intrinsically interpretable, so we explain it **directly from its own weights**; standardised weights are comparable; `grid_position` dominates (*precisely: 2.3x the next-largest weight and ~4-5x most others*); a pit-lane start pushes away from a podium; recent constructor form, driver points so far, experience and recent driver form push towards one; `constructor_points_before` has a small *negative* weight because it overlaps heavily with constructor rank and form (**correlated predictors split credit in ways hard to read one weight at a time**). For the local case: contributions are relative to the **average training driver (1950-2019)**; the biggest push down is `year` because 2021 is far later than the training average and the model learned a negative weight for later seasons; grid P11 pushes slightly *up* because it beats the historical average start; the forest's SHAP ranks grid position as the main negative factor, which shows each explanation depends on its model and its reference point. **Not causal.**
- **Interpretation caution (my inference):** the negative `year` weight probably reflects that, for the same grid slot and form, podiums were easier in older, less reliable eras (many cars retired), and it is conditional on the other 15 features. The notebook only says the model "learned a negative weight for later seasons".

---

### Section 17: Complete and partially missing inference (cells 103-105)  [D7]

- **Cell 104 (code):** `display(results["summary"]["inference_demos"])`.
- **Complete record:** the first 2022+ row with all 16 features = **Lewis Hamilton, 2022 Bahrain GP** (grid 5, qualifying 5, driver form 1.0, constructor form 0.7, 288 prior starts, age 37.2): probability **0.906** >= 0.625 -> predicted podium **True** (he finished 3rd). `missing_features: []`.
- **Partial record:** `{"grid_position": 3, "pit_lane_start": 0, "front_row": 0, "field_size": 20, "year": 2024}`: **11 of 16 features missing**, filled by the training-fitted imputer; probability **0.387** < 0.625 -> predicted podium **False**; `imputation_warning`: "11 of 16 features were missing and filled by the training-fitted imputer."
- **Cell 105 (md):** missing inputs are handled by the training-fitted imputer **without consulting validation or test data**; the API returns `missing_features` and an explicit `imputation_warning`, so **silent mass imputation is impossible**; the probability "demonstrates software robustness rather than a historical base rate".
- **Why 0.387 for a P3 start (my inference):** the imputer fills form with the training median (0 podiums), points 2, 40 prior starts, qualifying "missing" = 1: the model sees an unremarkable driver with a good grid slot. A grid-3 start with no history lands between "podium likely" and "unlikely", and below the 0.625 threshold.

---

### Section 18: Limitations (cell 106)

The notebook's list (know each one and what it says about your work):
1. Qualifying coverage is sparse and era-dependent in older seasons.
2. Regulations, field size, reliability and competitive structure change over time (era sensitivity).
3. Constructor ids don't bridge renames, and a few old ids are reused by unrelated later teams (section 10.4).
4. The nationality-to-country mapping is incomplete and can't represent multiple nationalities.
5. Mechanical status classification is rules-based and can miss ambiguous causes.
6. The original Piazza/TA ruling export is not archived in the repo; the sensitivity table shows how a stricter definition changes totals.
7. Validation contains only 2020-2021, so selection estimates have sampling uncertainty.
8. Probabilities were evaluated for ranking and threshold classification, **not formal calibration**.
9. Permutation importance, SHAP and LIME explain associations inside fitted models, **not causes** of podium finishes.

Extra ones the notebook doesn't list that you may want to volunteer: the 1002.6 s qualifying typo; the shared-drive "best finish" rule can label a relief driver a podium finisher; `field_size`/`pit_lane_start` include `W` rows; `year` extrapolation; one seed for forest and logistic regression; the ablation is logistic regression on one validation window.

---

<a id="part-06"></a>

## Part 6. Defense pack


Contents: **(1)** project overview you can say aloud, **(2)** requirement-to-notebook map, **(3)** likely evaluation questions with sample answers, **(4)** revision checklist. Plus a **numbers sheet** and a few delivery tips.

Every answer follows **choice -> reason -> evidence -> limitation**. The brief says "say why each step makes sense for the F1 podium-prediction task, with evidence (plots, numbers, statistics, or experiment references)". "An AI tool suggested it" is not an answer.

---

### 0. Numbers to know cold

| Fact | Value |
| --- | --- |
| Raw tables | 14 (`results` 26,759 rows; `qualifying` 10,494; `races` 1,125; `drivers` 861; `lap_times` 589,081) |
| Key audits | 14 primary keys, 0 null / 0 duplicate; 22 foreign keys, 0 orphans |
| Shared-drive groups | **85** groups (176 rows) -> 91 rows removed |
| `F` rows removed | **1,366** (all 1952-2012, all in training, 0 podiums); `W` rows (335) kept |
| Rows after each step | 26,759 -> 26,668 -> **25,302** |
| Podium rate | 12.69% raw -> 12.73% (grain fixed) -> **13.42%** (after `F` removal); train 13.3%, val/test **15.0%** |
| Target / unit / cutoff | `positionOrder <= 3` / one driver in one race / after qualifying, before the race |
| Features | **16** in 5 groups (grid 4, qualifying 3, form 3, standings 4, context 2) |
| Split | train **1950-2019** (23,163 rows, 1,018 races); validation **2020-2021** (780, 39 races); test **2022-2024** (1,359, 68 races) |
| Qualifying missing | 64% of training rows; ~0% in validation/test. No qualifying data before 1994, solid from 2003 |
| Models | LR (C=1, L2, balanced); forest (240 trees, depth 12, leaf 30, balanced_subsample); MLP (32,12), alpha 0.02, early stopping |
| Thresholds (validation max-F1) | LR **0.625**, forest **0.775**, MLP **0.455** |
| Validation PR-AUC | LR **0.730**, forest 0.717, MLP 0.717 |
| Test PR-AUC / ROC-AUC | LR 0.702 / 0.935; forest **0.717** / 0.937; MLP 0.716 / 0.933 |
| Test bootstrap (68 races), difference vs LR | forest +0.015 [-0.011, +0.046]; MLP +0.013 [-0.016, +0.044]; both include 0 |
| Ablation (validation PR-AUC change, LR) | grid -0.025, standings -0.017, form -0.016, qualifying -0.006, context -0.001 |
| Q1 | front-row conversion 56.1% (1950-2013) -> 76.0% (2014-2024) |
| Q2 | Mantel-Haenszel home odds ratio **0.955** [0.825, 1.110] |
| Q3 | fleet mechanical-retirement 10.1% -> 6.1%; leaders Caterham 23.5% (2014-21), Alfa Romeo 12.5% (2022-24) |
| Selected model | **Logistic regression** (highest validation PR-AUC; ties within noise; simplest, explainable) |
| Tests in repo | 24 tests in `tests/test_pipeline.py` |

---

### 1. Concise overview of the project (for the introduction)

#### The 30-second version

> We predict, for every driver in every Formula 1 race from 1950 to 2024, whether they will finish on the podium, using only information known after qualifying and before the race starts. We audited and cleaned the 14-table relational dataset, fixed the grain to exactly one row per driver per race, engineered 16 leakage-safe pre-race features, split the data chronologically, and compared logistic regression, a random forest and a two-layer neural network. All three rank podium finishers very well, and a race-level bootstrap shows they are statistically tied, so we selected logistic regression as the simplest, most explainable model. Grid position is the dominant signal, and our explanations describe what the models rely on, not what causes podiums.

#### The 2-minute version (structure: task -> cutoff -> cleaning -> features -> split -> models -> metric -> result -> explanation -> limitations)

1. **Task and cutoff.** Binary classification: will this driver finish in the top three? Prediction is made after qualifying, before the race. Anything only known after the start (results, points, status, laps, pit stops, post-race standings) is forbidden as a feature; that is *data leakage*.
2. **Data and cleaning.** 14 linked Kaggle/Ergast tables, 1950-2024. We converted the `\N` sentinel to real missing values, gave dates and qualifying times real types, and verified all 14 primary keys and 22 foreign keys (no nulls, duplicates or orphans). `results` wasn't unique per driver-race because of 1950s shared drives (85 groups); we keep the car the driver started, then the best finish, then the lowest `resultId`. Following the instructor's ruling we also removed 1,366 `F` rows (drivers who never entered the race), but kept withdrawals. Result: **25,302 rows, one per driver-race**, with before/after EDA showing the target barely moved.
3. **Three data-engineering questions** (multi-table joins): front-row conversion by circuit and era (56% -> 76% after 2014); home advantage after controlling for grid position (odds ratio 0.95, interval includes 1, so none shown); mechanical-retirement rates by constructor and era (10.1% -> 6.1%).
4. **Features (16, five groups):** grid, qualifying, recent form, pre-race standings, context (age, year). Form is shifted before rolling; constructor results are aggregated per race before shifting; standings are moved to the next race. Each feature has training-only EDA evidence, and a feature-group ablation measures contributions after training.
5. **Split:** chronological, train to 2019, validation 2020-21, test 2022-24. A random split would leak same-race and future information.
6. **Models:** logistic regression (baseline), random forest, shallow MLP (32, 12). Same rows, same features, preprocessing inside a Pipeline fitted on training only. Hyperparameters and thresholds chosen on validation only.
7. **Metric:** PR-AUC primary (podiums are ~13-15% of rows), ROC-AUC secondary, plus F1/precision/recall at validation-tuned thresholds.
8. **Result:** ROC-AUC ~0.93 for all three; PR-AUC ~0.70-0.73. Differences are inside the race-to-race noise (bootstrap), so we call it a tie and pick logistic regression for simplicity and explainability.
9. **Explainability:** permutation importance, SHAP and LIME on the forest; direct coefficients and an exact local decomposition for the selected logistic model. Grid position dominates in every method. These are associations, not causes.
10. **Limitations:** sparse historical qualifying, era sensitivity, constructor renames, a 39-race validation set, uncalibrated probabilities.

---

### 2. Requirement-to-notebook map

Requirement IDs are defined in file `01_project_requirements_and_concepts.md`.

| Req | What the brief asks | Where it is addressed | Evidence in the notebook |
| --- | --- | --- | --- |
| **R1a** | EDA before and after cleaning, with plots, implemented not manual | Cells 6 (`raw_table_profile`), 14 (`cleaning_eda`), 32 (plots); shown in **Section 8, cells 41-43**; feature-level EDA in **10.2, cells 59-61**; 8.1 audit in cells 44-46 | `raw_table_profile`, `cleaning_eda` tables; `raw_table_profile.png`, `cleaning_before_after.png`, `qualifying_coverage.png`, `feature_eda.png` |
| **R1b** | Clean sentinels; semantic typing of dates and lap times | Cell 6 `load_raw_tables` (`na_values=[SENTINEL]`); cell 8 `_time_to_seconds`; cell 10 (`to_datetime`, `driver_age`) | Cell 75-76 `feature_engineering_effects` (raw vs parsed) |
| **R1c** | One row per `(raceId, driverId)`; choose and justify a duplicate rule | Cell 8 `clean_results`; cell 10 diagnostics; **cells 42-43** | 85 groups, 176 -> 0 duplicate rows, `unique_grain: True`, rule explained in cell 8's docstring |
| **R1d** | PKs unique and non-null; FKs reconcile; raw immutable | Cell 4 (`PRIMARY_KEYS`, `FOREIGN_KEYS`); cell 6 `audit_tables`; **cell 42** | 14 PK rows all 0/0; 22 FK rows all 0 orphans; raw read-only (`.copy()` everywhere) |
| **R2-Q1** | Front-row to podium by circuit; ranking change after 2014; qualifying vs grid | Cell 30 `engineering_answers`; plots cell 32; **cells 48-49** | `front_row_circuits`, `front_row_overall`, `front_row_conversion.png` (uses final `grid`) |
| **R2-Q2** | Home vs away podium rate, controlling for starting position | Cell 30 (`NATIONALITY_TO_COUNTRY`, grid bands, Mantel-Haenszel bootstrap); **cells 48-49** | `home_effect`, `home_exact_grid`, `home_adjusted`; `home_effect.png`, `home_effect_exact_grid.png` |
| **R2-Q3** | Mechanical-retirement rate by constructor, 2014-2021 vs 2022-2024 | Cell 30 (`MECHANICAL_TERMS`, `NON_START_STATUSES`); **cells 48-49** | `mechanical_retirements`, `mechanical_sensitivity`; `mechanical_retirements.png` |
| **R3a** | Feature choices justified by exploratory evidence | Cell 20 `feature_eda*`; cell 24/26 experiments; **Section 10, cells 50-67** | `feature_eda` table and figure; context experiment (cell 63); ablation (cell 95) |
| **R3b** | Appropriate train/validation/test split, justified | Cell 12; **Section 11, cells 68-73** | `split_summary`, `split_integrity`, `split_strategy_experiment`, `split_window_experiment`, `chronological_split.png` |
| **R3c** (checklist) | Leakage-safe form using only past races | Cell 10 (`shift().rolling`, race-level constructor aggregation, `_previous_standings`) | Cells 52, 54-55; tests `test_form_features_cannot_see_current_target`, `test_current_race_result_cannot_change_its_own_features` |
| **R4a** | >=2 statistical models + shallow NN, same rows and features | Cell 14 `model_definitions` | Cell 86 table: LR, forest, MLP (32,12) |
| **R4b** | ROC-AUC, PR-AUC, F1 (plus precision/recall) for every model | Cell 14 `_metrics`, `train_and_evaluate` | Cell 86: all five metrics, every model |
| **R4c** | Performance on training/validation and on unseen test | Cell 14 `train_and_evaluate` | Cell 86: train, validation, test rows per model; `model_comparison.png` |
| **R4d** | Thresholds and hyperparameters from train+validation only | Cell 14 `_best_threshold` (validation only); cell 24 `hyperparameter_search` | Cells 86-90; cell 92 shows the test bootstrap resamples existing predictions only |
| **R4e** | Justify choice against a baseline | Cells 86-93 (**14, 14.1, 14.2**) | LR as baseline; complexity doesn't earn its place (bootstrap intervals include 0) |
| **R5a** | Feature-group ablation | Cell 20 `ablation_experiments`; **Section 15, cells 94-96** | `ablation_results`, `ablation.png` |
| **R5b** | >=2 preprocessing-order experiments | Cell 16 `preprocessing_order_experiments`; **Section 13, cells 79-81** | Experiments A, B, C (cell 80); strategies (cell 80); missing-value experiments (cells 82-84) |
| **R5c** | Compare multiple approaches; >=3 modelling attempts; before/after visible | Cells 16, 22, 24, 26, 28; **Sections 8.1, 10.3, 13, 13.1, 14.1** | Preprocessing, imputers, hyperparameter grid (29 settings), `round`/`year`, `F`/`W` experiments, windows |
| **R6a** | Global explanations: permutation importance **and** SHAP | Cells 32 (permutation), 34 (`shap_explanations`); **Section 16, cells 97-99** | `permutation_importance.png`, `shap_global.png` + tables |
| **R6b** | Local explanation: LIME and/or local SHAP | Cell 34 (`lime_explanation`, local SHAP), cell 36 (logistic decomposition); **cells 98-102** | `lime_local.png`, `shap_local.png`, `logistic_local.png` |
| **R6c** | Plotted, interpreted, **not causal** | Cells 99, 102, 106 | Explicit "not causal effects" statements in each |
| **D1** | One run-all notebook, sectioned, includes inference | Whole notebook; cell 2 (Kaggle-aware paths); cell 40 runs everything | Section headers 0-18; no hidden cells |
| **D3** | Unique driver-race table, documented duplicate handling, leakage-safe features | Cells 8-10, 40; `modeling_table.csv` | Cells 42-43, 50-55 |
| **D4** | Model comparison table; primary/secondary metric justified | Cells 86-87, 93 | PR-AUC primary (rare positives), ROC-AUC secondary |
| **D7** | Inference function on a complete and a partially-missing record | Cell 38 `predict_podium`; **Section 17, cells 103-105** | Complete 0.906 (predicted podium), partial 0.387 with 11 fields disclosed |
| **D8** | Analytical report (answers to Q1-Q3, selected features and validity, limitations) | `reports/milestone_1_analytical_report_latex.pdf` (not part of the notebook); limitations also in cell 106 | Out of scope of this guide beyond a spot check |

**Gaps/risks against the brief to be aware of:** the Kaggle copy and the accessible links are outside the repo (can't verify); permutation importance/SHAP/LIME are computed on the forest while the selected model is LR (the LR is explained separately); LIME is a custom implementation with weighted R^2 ~0.20.

---

### 3. Likely evaluation questions, with sample answers

#### A. Framing and leakage

**Q1. What is the project, the unit of analysis, the target and the cutoff?**
A. We predict whether a driver finishes in the top three of a Formula 1 race. One row = one driver entering one race, uniquely identified by `(raceId, driverId)`. The target is `podium = (positionOrder <= 3)`. The prediction is made after qualifying and before the race starts, so only information available then can be used as a feature.

**Q2. What is data leakage? Give examples from this dataset and say how you prevented them.**
A. Leakage is using information that wouldn't exist at prediction time, which inflates scores and makes the model useless in practice. Direct examples: the current race's `positionOrder`, points, status, laps, pit stops, fastest lap, and post-race standings. Indirect ones: a "last five races" average that includes the current race; post-race standings attached to the same race; fitting an imputer/scaler on future seasons. We prevent them by a feature whitelist (`FEATURES`, 16 columns), `shift()` before rolling, per-race aggregation of constructor results, standings moved to the next race, a chronological split, and preprocessing fitted on training only inside a Pipeline. A repository test changes the latest race's `positionOrder` to 99 and asserts the features don't change.

**Q3. Why does `shift()` come before `rolling()`?**
A. `shift()` moves each driver's podium flag one row down, so at race *i* the series holds the result of race *i-1*; `rolling(5, min_periods=1).mean()` then averages up to the five previous starts. Without the shift the window would include the current race's own `podium`, putting the label inside the feature. A driver's first race has no history, so its form is missing and is imputed.

**Q4. Why aggregate constructor results per race before shifting?**
A. A team has two cars per race. Shifting each car's row separately would let the second teammate's feature contain the first teammate's result from the same race. We take one number per team-race (the teammates' mean podium), then shift and roll over the team's previous five races.

**Q5. How are standings made leakage-safe, and what happens in round 1?**
A. A standings row describes the table *after* a race, so it's attached to the driver's or team's *next* race within the same season (`groupby([entity, year]).shift(-1)`). Before the first race of a season there is no row, which means nothing has been scored yet, so we set 0 points and rank 0 rather than let the median imputer invent about 3 points and rank 13. We tested adding flags for these rows and they didn't help.

**Q6. Is `positionText == "F"` filtering a form of leakage?**
A. It reads a result-table column, but only as a row filter, never as a feature. The instructor ruled that `F` (did not qualify, did not prequalify, failed the 107% rule) is settled before the race, so those drivers never entered it and the row isn't "one driver entering one race". `W` (withdrew) rows stay because that code is only known after the race. We removed `F` rows before computing any feature so skipped weekends don't count in form windows or field size. Evidence: 1,366 `F` rows, all 1952-2012, all in training, none a podium; the experiment shows the choice moves logistic regression by at most 0.0005. Limitation: this rests on the ruling, which isn't archived in the repo.

**Q7. Why didn't you use sprint results? Are they leakage?**
A. Timing-wise they're not leakage: every sprint ends the day before the race. We exclude them because sprints exist only from 2021, so there are zero training rows, and in 2021-22 the sprint set the main-race grid so grid features already carry that information. The real hazard is a naive join on `raceId`, because sprint position/points are a different race's result under the same id.

**Q8. Is `year` leakage? Is `field_size`?**
A. No: both are known before the race. The issues are different. `year` lets nonlinear models adjust for era (removing it costs the forest -0.012 and the network -0.021 PR-AUC), but the test years lie outside the training years, so a model must extrapolate and a forest cannot. `field_size` counts every row in the race, including withdrawals (`W`), a code the instructor said is only known afterwards; the effect is tiny and we kept `W` rows as instructed.

#### B. Data cleaning and relational integrity

**Q9. What is a sentinel and how did you handle it?**
A. A placeholder that stands for "missing" but is stored as ordinary text; here the literal string `\N`. `pd.read_csv(..., na_values=["\\N"])` converts it to real missing values at load time. Otherwise numeric columns would be read as text.

**Q10. What semantic typing did you apply?**
A. Race dates and birth dates become `datetime`; driver age is computed in years at the race date; qualifying times such as `"1:23.456"` become seconds (83.456) with a regular expression (optional minutes, then seconds); IDs and flags stay numeric.

**Q11. Why were there duplicate rows, how did you find them, and what rule did you choose?**
A. Until 1957 a driver could take over a teammate's car, so the same driver can appear twice in one race. We counted `(raceId, driverId)` groups with more than one row: 85 groups (176 rows). The rule: keep the row where the car actually started (`grid > 0`), then the best `positionOrder`, then the lowest `resultId`. It is deterministic, reproducible, and uses a pre-race fact first. Effect: 91 rows removed, target rate 12.69% -> 12.73%, median grid unchanged at 12. Limitation: shared-drive history is genuinely ambiguous, and keeping the best finish can credit a relief driver with a podium.

**Q12. Primary keys vs foreign keys: what did you check and what did you find?**
A. A primary key uniquely identifies a row in its table (non-null, no duplicates). A foreign key references a primary key in another table, so every value must exist in the parent. We checked 14 primary keys (two composite: `lap_times`, `pit_stops`) and 22 foreign keys: zero null keys, zero duplicates, zero orphans. Note that passing the `resultId` check doesn't make `(raceId, driverId)` unique, which is why grain is a separate check.

**Q13. What does `validate="many_to_one"` do and why use it?**
A. It makes pandas raise an error if the right-hand table has duplicate keys, so a join can never silently multiply rows. `one_to_one` requires uniqueness on both sides. We use them on every merge to protect the grain.

**Q14. Why do you use a left join for qualifying?**
A. Qualifying data don't exist before 1994, so an inner join would delete about two thirds of the history. A left join keeps every driver-race row, and `qualifying_missing` records which rows have no data.

**Q15. What does grid 0 mean, and how did you handle it?**
A. In the data, grid 0 doesn't mean better than pole. It marks a pit-lane or exceptional start, a driver who never took the grid, or a withdrawal. We turn it into a missing `grid_position` plus a `pit_lane_start` flag. Of 1,635 grid-0 rows, 1,346 were `F` drivers who never raced (removed), 202 withdrawals and 87 genuine pit-lane/exceptional starts (kept); `pit_lane_start` now marks 289 rows and is "still not a pure pit-lane flag".

**Q16. Why keep the raw CSVs immutable?**
A. They're the evidence layer. All cleaning is done on in-memory copies by code, so anyone can reproduce and audit each step; nobody hand-edits a value.

**Q17. Is there any data problem you did not handle?**
A. Yes: one qualifying row (`qualifyId 2569`) has `q1 = "16:42.640"`, which parses to 1002.64 s; it's almost certainly a typo. It stays in `qualifying_time_seconds` and shows up as an extreme value (~97 standard deviations after scaling). Its effect is small because it's one row among 25,302 and the feature is weak, but we should have flagged or clipped it.

#### C. EDA and the three questions

**Q18. What does your EDA show, and how does it motivate decisions?**
A. (1) Cleaning fixes the grain without moving the target or the median grid, so it didn't distort the data. (2) Qualifying coverage is zero before 1994, erratic 1994-2002, and near-complete from 2003 ("coverage drift"), which motivated the missingness flag, median imputation, and keeping grid as the historically broader signal. (3) Per-feature EDA on training seasons shows position, form and standings features are strong, and flags/context are weak on their own.

**Q19. Q1: which circuits convert a front-row start best, and does the ranking change after 2014?**
A. We join results, races and circuits, keep final grid positions 1-2 (grid, not qualifying position, because penalties can change the start), split at 2014, and take the mean of the podium flag per circuit-era with at least 10 front-row starts. Overall conversion rises from 56.1% to 76.0%. Before 2014: Magny-Cours 80.6% (36 starts), Istanbul 78.6%, Dijon 75%. From 2014: Suzuka 88.9% (18), Yas Marina 86.4%, Monaco 85%. Caveat: samples are small and the result is descriptive (team dominance, weather and safety cars matter).

**Q20. Q2: do drivers podium more at home?**
A. We map driver nationality to the circuit country, and compare home vs away podium rates within grid bands and exact grid slots; the Mantel-Haenszel odds ratio pools across slots. The rates are nearly identical in every band and the odds ratio is 0.955 with a 95% race-cluster bootstrap interval of 0.825-1.110, which includes 1. So we find no home effect after controlling for starting position. Raw averages would be confounded because home drivers may qualify differently. Limits: incomplete one-country nationality mapping (928 rows excluded) and an interval spanning 1 doesn't prove there's no effect.

**Q21. Q3: how did you define mechanical retirement and what did you find?**
A. A race *start* whose final status is a component failure (Engine, Gearbox, Hydraulics, Brakes, Power Unit, etc., following the instructor's ruling including Tyre puncture/Fire/Safety belt, but not Refuelling). The denominator is race starters only (recorded non-starters removed); crashes and driver errors are excluded. With at least 20 starts: Caterham (23.5%) and Lotus F1 (20.0%) lead 2014-2021; Alfa Romeo (12.5%) and Alpine (11.0%) lead 2022-2024; overall 10.1% -> 6.1%. A stricter internal-systems list gives 8.4% -> 5.6%, so the conclusion holds. Limit: rules-based status mapping; renamed teams are separate rows.

#### D. Features and preprocessing

**Q22. Which features did you choose and why is each valid at the cutoff?**
A. Grid (`grid_position`, `pit_lane_start`, `front_row`, `field_size`): the final grid is fixed before the start. Qualifying (`qualifying_position`, `qualifying_time_seconds`, `qualifying_missing`): the session ends before the race. Form (`driver_podium_rate_5`, `constructor_podium_rate_5`, `driver_races_before`): only earlier races. Standings (`driver/constructor_points_before`, `rank_before`): the table before this race. Context (`driver_age`, `year`): calendar facts. Evidence: training-only EDA per feature, the ablation, and the context experiment.

**Q23. Why keep weak features such as `year`, `driver_age`, `field_size` and the flags?**
A. Their single-feature AUC is near 0.5, so we don't claim they work alone. They help in combination or as controls: the flags record which values were imputed; `year` lets nonlinear models adjust for era (the experiment shows it helps the forest and network); the ablation shows context adds little (-0.001), and we say so. A one-feature AUC ignores the other 15 features, so it can't rule a feature out.

**Q24. Why did you remove `round`?**
A. Adding it back changes validation PR-AUC by -0.0008 (LR), -0.0036 (forest) and +0.0003 (network), well inside the ~0.010 noise of a three-seed average and not even in a consistent direction. The information is already in the standings (points accumulate race by race), and `round` means different things across eras (about 8 races in the 1950s, 24 now). Simpler wins.

**Q25. Why include both grid and qualifying position?**
A. Qualifying position is the session result; grid is the actual start after penalties, so they differ. The ablation shows qualifying adds only 0.006 PR-AUC on top of grid because they overlap and qualifying is missing for 64% of training rows; we keep it because it's pre-race and informative where it exists.

**Q26. How did you handle missing values and why median?**
A. Median imputation fitted on training rows inside the Pipeline, plus a `qualifying_missing` flag. We compared mean, KNN and iterative imputation, dropping the sparse columns, dropping the flag, and dropping rows. For logistic regression (no seed noise) every alternative is within 0.006; the network's changes (-0.030 to +0.022) are noise-sized. Dropping rows would throw away two thirds of the history, and dropping the qualifying columns hurt the network by 0.030. The median is robust to the skew and the extreme values in these columns.

**Q27. Why standardise features, and why not for the forest?**
A. Logistic regression's penalty and the network's gradient steps are sensitive to feature scale (points range 0-722, flags 0-1), so we standardise using training mean/std. Trees split on thresholds, so scaling changes nothing; the forest pipeline has no scaler. Scaling is linear, so distribution shapes and rank order don't change.

**Q28. Explain your preprocessing-order experiments.**
A. A: impute-then-scale vs scale-then-impute: the same raw median is written, but the scaler's statistics differ (computed with or without the filled values); LR unchanged, MLP +0.016. B: zero-fill vs scaling first: order changes the value written (a literal 0, i.e. "ahead of pole", vs the training mean); LR +0.004, MLP -0.005. C: fitting preprocessing on all seasons vs on training only: uses future data to set medians/scales (MLP +0.021, LR +0.0001). Whatever the score, C is leakage, so preprocessing is fitted on training only. MLP differences are about one seed's noise (~0.021), so the principle matters more than the numbers.

**Q29. What does imputation do to the distributions?**
A. It writes one value into every missing cell, creating a spike at the median and shrinking the spread: about -40% standard deviation for the qualifying columns (64% missing), 0-1% for the others. The range doesn't change because the median is inside it. The flag preserves the fact that a value was filled.

#### E. Splitting

**Q30. Why a chronological split, and why these boundaries?**
A. Deployment predicts future races from the past, so the evaluation must too. Train 1950-2019, validation 2020-21 (the most recent regime: ~20 cars, near-complete qualifying), test 2022-24 (the unseen ground-effect era). Integrity checks confirm every race is in one split and dates are strictly ordered. The instructor said the `<= 2019` boundary was only an example and had to be justified: we scored four validation windows ending before the test (2014-15 ... 2020-21) and bootstrapped the validation races.

**Q31. What would go wrong with a random split? You said random splits scored lower, so isn't that a counter-argument?**
A. A random-row split puts same-race teammates and rivals in training for 100% of held-out rows, and 98% have later seasons in training; random races removes same-race leakage but still has 100% future leakage. The random splits score *lower* because their held-out sets mix all eras, including old seasons with a lower podium rate and no qualifying; PR-AUC also depends on the base rate. So scores aren't comparable. The point is that only the chronological split answers "how well do we predict the next seasons?" with zero same-race and zero future leakage.

**Q32. Why is the training score lower than validation, and why do validation and test have a higher podium rate?**
A. Training includes 1950-1993 (no qualifying, bigger and less reliable fields, podium rate 13.3%), which is harder than modern racing. Modern fields have ~20 cars and three podium places, so ~15% of rows are podiums. Evidence: the split summary and `chronological_split.png`. For the forest it holds only because depth/leaf were limited; its first settings memorised (training 0.918 vs validation 0.696).

#### F. Models, metrics and selection

**Q33. Why these three models, and how does each work?**
A. Logistic regression: a weighted sum of the features turned into a probability by the sigmoid; the interpretable baseline. Random forest: 240 trees, each on a bootstrap sample with random feature subsets, averaged; captures non-linear effects and interactions. Shallow MLP: two hidden layers (32 then 12 ReLU units), trained with Adam, L2 penalty 0.02, early stopping; roughly 950 weights (my arithmetic: 16x32+32 + 32x12+12 + 12+1 = 953). All get the same rows and features. Limits: LR is linear; the forest can't extrapolate `year` and can memorise; the MLP is a black box that depends on the seed and scaling.

**Q34. What does `class_weight="balanced"` do?**
A. It weights each class inversely to its frequency (`n / (2 x class count)`): with ~13% podiums a podium counts about 3.8x and a non-podium about 0.58x. It helps the rare class but inflates predicted probabilities, so the probabilities aren't calibrated; that's why the best thresholds are 0.625 (LR) and 0.775 (forest), not 0.5. `MLPClassifier` has no class weights, hence its 0.455 threshold.

**Q35. Why is PR-AUC the primary metric and ROC-AUC secondary?**
A. Only about 13-15% of rows are podiums. ROC-AUC includes a large true-negative population and looks flattering (~0.93 for everything). PR-AUC (average precision) focuses on how well the true podium finishers are ranked above the rest, and its chance baseline is the podium rate (~0.15), so 0.70 is about 4.7x chance. We still report ROC-AUC, F1, precision and recall.

**Q36. How did you choose thresholds, and are the validation F1 numbers fair?**
A. For each model we scan 0.05-0.80 in steps of 0.005 and pick the threshold with the highest validation F1, freeze it, then report test. The validation F1/precision/recall are optimistic because they're tuned on that data; the test values are the honest ones (e.g. LR: F1 0.700 on validation vs 0.664 on test; precision 0.53, recall 0.89 on test).

**Q37. Which model is best and why did you select logistic regression when the forest and network score higher on test?**
A. The selection rule was fixed in advance: validation PR-AUC, where LR is highest (0.730 vs 0.717/0.717; also highest under the network's three-seed average). On test the forest/network are ~0.013-0.015 higher, but a bootstrap over the 68 test races gives intervals (-0.011 to +0.046; -0.016 to +0.044) that include zero, as do the validation ones. The data don't support that complexity helps, so the simplest and most explainable model wins the tie. We didn't use the test set to choose.

**Q38. How did you tune hyperparameters without touching the test set?**
A. A small explicit grid per model (8 + 9 + 12 = 29 settings), each trained on 1950-2019 and scored on 2020-21 only; the network is averaged over three seeds. The forest's first setting (no depth limit, leaf 4) had training PR-AUC 0.918 vs validation 0.696; depth 12/leaf 30 ranks first (validation 0.717, training 0.646). The network's top setting is only 0.013 above the adopted one while a single setting's seed spread reaches 0.025, so we kept the adopted one rather than select noise. LR is insensitive (0.710-0.730).

**Q39. Is your neural network a deliberately weak baseline?**
A. No. We searched one and two hidden layers of 8-64 units with two regularisation strengths over three seeds; networks with 8 units are clearly worse, so size matters; our adopted (32,12) is within the noise of the best (64,). Averaged over seeds it isn't ahead of logistic regression, which is the honest finding.

**Q40. How reliable is your validation score?**
A. Not very: 39 races. The race-level bootstrap gives a 95% interval about 0.2 wide for each model (e.g. 0.62-0.84 for LR), and across four validation windows LR ranges 0.689-0.730. So a validation score isn't the expected test score; we report the model ranking as a tie within uncertainty.

**Q41. Are the probabilities calibrated?**
A. No, we evaluated ranking and thresholded classification only (the limitations say so). Class weighting shifts the probabilities upward. If we needed calibrated probabilities we'd apply Platt or isotonic calibration on validation data.

#### G. Experiments and explainability

**Q42. What is a feature-group ablation and what did you find?**
A. Remove one group of features, retrain, and see how validation PR-AUC changes. Removing grid costs -0.025, standings -0.017, form -0.016, qualifying -0.006, context -0.001. Grid dominates; qualifying adds little given grid. This complements the pre-training EDA with a post-training measurement. Limitations: logistic regression only, one validation window, correlated groups share credit.

**Q43. How do permutation importance, SHAP and LIME work and why might they disagree?**
A. Permutation importance shuffles a feature and measures how much PR-AUC drops (global, model-agnostic). SHAP gives each feature a Shapley contribution so that base value + contributions = the prediction; mean |SHAP| is global importance and one row's values are a local explanation; `TreeExplainer` is exact for the forest. LIME perturbs one row 5,000 times, queries the model and fits a distance-weighted linear surrogate. They can differ because permutation importance measures score loss (correlated features compensate), SHAP shares credit among correlated features, and LIME is a local linear approximation. All agree grid position is #1.

**Q44. Your LIME fidelity is only 0.20. Why trust it?**
A. We don't over-trust it, and the notebook says so: "weak, unstable local evidence rather than a faithful decomposition". We keep local SHAP as a cross-check; both point to grid position as the main negative factor for this driver (my inference for the low fidelity: a tree ensemble's response around one row is non-linear and interaction-heavy, which a 16-term linear surrogate can't capture). Also, our LIME is a transparent re-implementation of the idea, not the `lime` package.

**Q45. Why explain the random forest rather than the selected logistic regression?**
A. SHAP's `TreeExplainer` is exact for the forest and permutation importance/LIME are model-agnostic, so the forest is the natural subject for the required global/local methods; but since the selected model is logistic regression and is interpretable, we also explain it directly from its own standardised coefficients and an *exact* local log-odds decomposition (the contributions sum to the model's probability). Both views agree grid dominates.

**Q46. How do you read the local logistic explanation?**
A. For the 2021 Dutch GP row (driver 847, grid 11), log-odds = intercept (-1.385) + sum of (standardised value x coefficient) = -1.897, i.e. 13.0%, below the 0.625 threshold; the driver didn't podium. Contributions are relative to the average training driver. The biggest negative is `year` (-0.60) because 2021 is far later than the training average and the model's weight for year is negative; grid 11 is slightly *better* than the historical average of 12, so it adds +0.21. These are what the model relies on, not causes.

**Q47. Are your explanations causal?**
A. No. A feature being important means the fitted model relies on it to predict, not that changing it would change real podium outcomes. Correlated predictors (grid and qualifying, constructor rank and form) share credit, and the model is trained on observational data across eras.

#### H. Inference

**Q48. Show how your inference function handles a partial record.**
A. `predict_podium(record, model, threshold)` builds a one-row table with the 16 features in order; features not supplied become missing and are filled by the Pipeline's training-fitted imputer (no validation/test data involved); it returns the probability, the thresholded decision, a list of imputed features, and a warning. Demo: Hamilton at the 2022 Bahrain GP (complete) -> 0.906, predicted podium; a record with only grid 3, front_row 0, pit_lane_start 0, field_size 20, year 2024 -> 0.387, not a podium, with 11 of 16 features disclosed as imputed. The partial prediction demonstrates robustness; the imputed values describe a typical training driver, so it's biased towards "no podium".

#### I. Process, honesty, and "what if"

**Q49. Did you use the test set to make any choice?**
A. No. Preprocessing variants, ablation, model choice, thresholds and hyperparameters all use validation only. The test set is scored once after choices are frozen. Even the test bootstrap only resamples predictions that already exist. A repository test asserts validation windows never reach the test seasons.

**Q50. What would you do next?**
A. Merge renamed constructor lineages with an explicit, documented mapping; add multiple seeds for all models and rolling-origin validation across several windows; calibrate probabilities; clip or fix the 1002 s qualifying typo; test other form window lengths; consider era-specific models or replacing `year` with an era indicator to avoid extrapolation; add pre-race signals not in this dataset (practice pace, weather).

**Q51. If I ask you to remove a feature group or change a setting live, what do you do?**
A. Edit `FEATURE_GROUPS` (cell 4) or the model settings (cell 14) and re-run from there. `FEATURES` is derived from `FEATURE_GROUPS`, so every model, experiment and plot updates. Cell 40 (`run_analysis`) is the slow cell, so to save time point to the saved CSVs and figures in `artifacts/` and `OUT/figures` for the existing results.

**Q52. Who did what?** *(If asked.)* Per the README: Yahia, EDA/analytical questions/feature evidence; Rana, models/evaluation/ablation/XAI; Ali, cleaning/relational integrity/integration; Aya, preprocessing/feature engineering/splitting. "Everyone should still understand the full pipeline because the evaluator can ask anyone."

---

### 4. Revision checklist

Tick each when you can explain it **without looking** and with a number or evidence.

#### Framing and leakage
- [ ] Unit, target, cutoff, and why leakage matters
- [ ] The list of forbidden columns and the `FEATURES` whitelist idea
- [ ] `shift()` before `rolling()`; race-level constructor aggregation
- [ ] Standings moved to the next race; round-1 = 0 points, rank 0 (and why not imputed)
- [ ] Why `F` rows are removed and `W` rows kept (the ruling and the caveat)

#### Cleaning and integrity
- [ ] `\N` sentinel, `na_values`; semantic typing; `_time_to_seconds` regex
- [ ] PK vs FK audits; results (14 / 0 nulls / 0 duplicates; 22 / 0 orphans)
- [ ] Shared drives: why, how many (85), the 3-step rule, what changed (91 rows)
- [ ] Why `(raceId, driverId)` uniqueness is separate from `resultId` uniqueness
- [ ] `validate=` in merges; left join for qualifying
- [ ] Grid 0 meaning (1,635 rows = 1,346 `F` + 202 `W` + 87 real)
- [ ] Before/after EDA: rows, duplicates, podium rate, grid-0 share, median grid
- [ ] The 1002.6 s typo (honest limitation)

#### Questions
- [ ] Q1: final grid vs qualifying; 56% -> 76%; top circuits per era; small samples
- [ ] Q2: nationality mapping; grid bands; Mantel-Haenszel OR 0.955; why interval spanning 1 isn't proof
- [ ] Q3: mechanical definition, denominator, sensitivity list, results

#### Features and preprocessing
- [ ] The 16 features in 5 groups and why each is valid at the cutoff
- [ ] Feature EDA: one-feature AUC meaning; which are strong and weak; why weak ones are kept
- [ ] `round` removed, `year` kept (with numbers)
- [ ] Median imputation + flag; the 8-way missing-value experiment
- [ ] Standardisation: formula, training-only fit, why validation/test means aren't 0
- [ ] Preprocessing order experiments A, B, C
- [ ] Effects of the steps on distributions, ranges, values

#### Split
- [ ] The three periods and their sizes; integrity checks; why chronological
- [ ] Random-split experiment, **including why its scores are lower**
- [ ] Why training PR-AUC < validation PR-AUC
- [ ] Alternative validation windows; the bootstrap and its width

#### Models and metrics
- [ ] How LR, forest and MLP work; every setting in `model_definitions`; limitations
- [ ] `class_weight="balanced"`; uncalibrated probabilities; why thresholds differ
- [ ] Precision, recall, F1, ROC-AUC, PR-AUC; why PR-AUC primary
- [ ] Threshold selection on validation; why validation F1 is optimistic
- [ ] The full metrics table (cell 86), train vs validation vs test
- [ ] Hyperparameter search: sizes (8/9/12), the forest's memorisation story, network noise
- [ ] Why LR is selected (rule + tie + simplicity); the test bootstrap

#### Experiments and XAI
- [ ] Ablation numbers and ranking; its limitations
- [ ] Permutation importance, SHAP, LIME: how each works; what each top-5 looks like
- [ ] LIME weighted R^2 = 0.20 and what to say about it; local SHAP cross-check
- [ ] Logistic coefficients and the exact local decomposition (-1.897 -> 13%)
- [ ] "Not causal" statement and why

#### Inference and limitations
- [ ] `predict_podium` flow and the disclosure of imputed fields; the 0.906 and 0.387 demos
- [ ] The notebook's nine limitations plus the extra ones you'd volunteer
- [ ] Which repo documents are stale (README features, Q&A PDF): use the notebook numbers

---

### 5. Delivery tips

- **Use the structure choice -> reason -> evidence -> limitation.** If you don't remember a number, point to the cell ("cell 86 has the full table") and give the direction and rough size.
- **Don't oversell the model.** The honest, evidence-backed message is: strong ranking (ROC-AUC 0.93), models tied within noise, grid dominates, explanations are associations. The brief explicitly asks for known limitations (e.g. qualifying-coverage drift, era sensitivity) and for explanations that are not presented as causal, and the notebook already states both.
- **Know the weak spots in `00_START_HERE.md` section 4 before they do.** Volunteering a limitation with a mitigation scores better than being caught.
- **If you're asked about something you can't answer from the files** (for example, the exact Piazza wording), say that the ruling is summarised in the README and the notebook comments but the original export isn't archived in the repo, rather than guessing.

---

<a id="part-07"></a>

## Part 7. EDA owner's guide: every piece of EDA, explained from scratch


**Written for:** the teammate who owns EDA and must explain and defend it at the evaluation.

**How to read this.** "Cell N" is the 0-based index in the `.ipynb` (same convention as files 00-06). Numbers marked **[notebook]** are printed in the notebook or saved in `artifacts/`. Numbers marked **[my check]** I computed myself with pandas from `artifacts/modeling_table.csv` or from the raw CSVs in `data/raw/` while preparing this guide. They are *not* in the notebook, so say "I checked this separately" if you quote them. (Correction: an earlier version of this note said the raw CSVs were not in the repo. They are, in `data/raw/`; see `09_data_files_columns_cleaning_features.md` for the full catalog.) Nothing here required scikit-learn.

**Your scope.** The README's team split lists, under the EDA owner: initial EDA; data-analysis plots; the three data-engineering questions and their interpretation; exploratory evidence for feature selection and the plots of feature effects; and the explanation of why form features use past races only. This guide covers exactly that list, plus the EDA-style audits that sit next to it. The evaluator may ask you about anything else in the notebook, so also keep files 02-06 nearby.

---

### 0. The map: where the EDA lives

| # | EDA stage | What it answers | Code cell(s) | Result cell(s) | Saved artifact |
| --- | --- | --- | --- | --- | --- |
| 1 | **Initial EDA on raw tables** | How big is each table, how much is missing, any full-row duplicates? | 6 (`raw_table_profile`), 32 (`_plot_raw_table_profile`) | 42 | `raw_table_profile.csv/.png` |
| 2 | **Cleaning before/after EDA** | What did cleaning change, and did it distort the data? | 8 (`clean_results`), 14 (`cleaning_eda`), 32 (`_plot_cleaning_effects`) | 42, 43 | `cleaning_eda.csv`, `cleaning_before_after.png` |
| 3 | **Qualifying coverage by season** | When is qualifying data actually available? | 32 (`_plot_analysis_results`, first block) | 42, 43 | `qualifying_coverage.png` |
| 4 | **Who has grid 0?** audit | Is `pit_lane_start` really about the pit lane? What are the `F` and `W` rows? | 4 (`DID_NOT_ENTER_CODE`), 10 (`build_modeling_table`), 28 (`non_starter_*`) | 44-46 | `non_starter_audit.csv`, `non_starter_experiment.csv` |
| 5 | **Feature-level EDA** (one-feature evidence) | Which of the 16 features carry signal on their own, and in which direction? | 20 (`_feature_bins`, `feature_eda`, `feature_eda_panels`, `feature_eda_plot`) | 59-61 | `feature_eda.csv/.png` |
| 6 | **Why form uses past races only** | How are form/standings built without leakage? | 10, 4 | 50-55 | (tests in `tests/test_pipeline.py`) |
| 7 | **The three data-engineering questions** | Q1 front-row conversion, Q2 home-country effect, Q3 mechanical retirements | 30 (`engineering_answers`), 32 (plots) | 47-49 | `front_row_*.csv`, `home_*.csv`, `mechanical_*.csv`, 4 PNGs |
| 8 | **Supporting EDA-style checks** | Sprints, calendar features, renamed teams, preprocessing distributions | 26, 28 | 56-67, 74-78 | `sprint_weekend_check.csv`, `context_feature_experiment.csv`, `constructor_history_audit.csv`, `preprocessing_*.png` |

Remember the "defining vs displaying" rule: cells 2-38 only *define* functions; **cell 40 runs everything** into the `results` dict; cells 42+ only *display* it. So every EDA result cell needs cell 40 to have been run first.

---

### 1. What the brief requires of EDA, and the five rules it sets

From the brief (Objective 1, Deliverable 2, Objective 3, checklist items 2-3):

1. **"Initial EDA, exploratory data analysis of the data."** Plus the hint: *"this step should be done both before and after the cleaning, where you explore the impact of the cleaning on the data."*
2. **"EDA should be supported with the proper visualization."**
3. **The note:** *"Your EDA can not be based on manual inspection and has to be supported with implementation choices along with justification of these choices, and the visualization of them."* Everything must be code, not "we looked at the CSV".
4. **Feature choices must be justified with exploratory analysis**: either a *hypothesis from earlier EDA* or *empirical trials kept in the notebook*.
5. **The three data-engineering questions**: each needs multi-hop joins (not `results.csv` alone), "the answer, a visualization of the results, and a short justification of grain, missingness, and where relevant the pre-race cutoff". The analytical report must also state **known limitations (e.g. historical qualifying-coverage drift, era sensitivity)**.

The checklist gives you a ready-made example of what the evaluator wants to hear: *"EDA showed qualifying missingness jumps before year X, so we..."*. Your qualifying-coverage plot is exactly that story (X = 1994, then 2003). Know it cold.

**One-sentence description of your EDA:** "We profile every raw table programmatically, show what each cleaning step does to the target rate and grid, show when qualifying data exists, give every one of the 16 features its own training-only evidence, and answer three business questions with multi-table joins, always saying what the denominator is and that the results are associations."

---

### 2. Concepts you need to be able to teach (EDA vocabulary)

| Term | Plain-language meaning | Where it appears |
| --- | --- | --- |
| **EDA** | Looking at the data with code and plots to understand it and to decide what to clean, keep, or build. It is evidence-gathering, not model-fitting. | Everywhere in your scope |
| **Grain** | What one row stands for. Here: one driver entering one race, key `(raceId, driverId)`. | Cleaning EDA |
| **Sentinel** | A placeholder that means "missing" but looks like data. In these CSVs it is the literal text `\N`. Read as text it is not detected as missing. | `load_raw_tables` (`na_values=["\\N"]`) |
| **Missingness** | Cells with no value. *Structural* missingness is missing because the data was never recorded (old qualifying), not by chance. | Qualifying coverage |
| **Target / label** | `podium = positionOrder <= 3`. 1 if the driver finished 1st-3rd. | Everywhere |
| **Class imbalance / prevalence** | Only **13.4%** of rows are podiums, so "always predict no podium" is 86.6% accurate and useless. Hence PR-AUC and F1. | Cleaning EDA, metrics |
| **Pre-race cutoff / leakage** | Only use what is known after qualifying and before the start. Using results, points, laps, status of the *same* race is leakage. | Section 6 below |
| **Binning (quantile bins)** | Cut a numeric feature into groups with equal row counts (here 5), then compare the podium rate across them. Makes a trend visible without assuming a shape. | Feature EDA |
| **One-feature ROC-AUC** | Treat the raw feature value as if it were a model score. AUC = probability that a randomly chosen podium row has a *higher* value than a randomly chosen non-podium row. 0.5 = no ordering information; >0.5 higher value goes with podiums; <0.5 lower value goes with podiums. | Feature EDA |
| **Association vs causation** | A feature relating to podiums does not mean it causes them. The brief demands this be stated explicitly. | Q2, feature EDA |
| **Denominator** | What you divide by. Changing it (all rows vs starters only vs one era) changes the answer. | Q1-Q3 |
| **Stratification / controlling** | Compare like with like: e.g. home vs away drivers *within the same grid slot*. | Q2 |
| **Odds ratio (OR)** | odds(home podium) / odds(away podium). 1 = no difference. | Q2 |
| **Mantel-Haenszel (MH)** | A standard way to combine one odds ratio per stratum (here per exact grid slot) into one overall odds ratio. | Q2 |
| **Bootstrap / cluster bootstrap** | Resample the data many times to see how much a statistic wobbles. *Cluster* means resample whole groups (here whole races), because rows in a race are not independent. | Q2 |
| **Confidence interval (CI)** | The range the statistic would plausibly fall in under resampling. If a 95% CI for an OR contains 1, the data do not show an effect. | Q2 |
| **Coverage drift** | The share of rows having a given field changes over time. The brief names this as a known limitation. | Qualifying coverage |

---

### 3. Stage 1: Initial EDA on the raw tables (cells 6, 32, 42)

#### 3.1 What it is for
Before touching anything, answer "what did we get?" for all 14 tables: size, missing cells, full-row duplicates, numeric vs text columns. It is the **"before"** half of the brief's before/after hint for the whole dataset, and it is **programmatic** (a function returning a DataFrame), which satisfies the "no manual inspection" rule.

#### 3.2 `load_raw_tables` (cell 6), the step before the profile

| Line | Meaning | If removed/changed |
| --- | --- | --- |
| `for path in sorted(data_dir.glob("*.csv"))` | Load every CSV in the folder, alphabetical. | Missing files would go unnoticed. |
| `pd.read_csv(path, na_values=[SENTINEL], low_memory=False)` | `\N` becomes `NaN` at load time. `low_memory=False` reads the file in one pass so column types are inferred consistently (avoids mixed-type warnings). | Without `na_values`, `\N` stays as text: numeric columns become text and **the missing-share EDA would show ~0% missing, hiding the problem**. |
| `required = set(PRIMARY_KEYS) \| {...}`; raise `FileNotFoundError` | Fail early with a clear message if a table is absent. | You would get a confusing merge error later. |

Raw CSVs stay immutable: every later step works on copies (brief requirement).

#### 3.3 `raw_table_profile` line by line

| Code | What it computes | Why it is there |
| --- | --- | --- |
| `numeric = frame.select_dtypes(include=np.number)` | The numeric columns | To count numeric vs text columns |
| `"rows": len(frame)`, `"columns": frame.shape[1]` | Table shape | Scale of each table |
| `"missing_cells": frame.isna().sum().sum()` | Total number of empty cells | Absolute missingness |
| `"missing_share": frame.isna().mean().mean()` | Mean of each column's missing fraction = **share of all cells that are empty** | Comparable across tables |
| `"columns_with_missing": frame.isna().any().sum()` | How many columns have at least one gap | Is the gap concentrated in one column or spread out? |
| `"duplicate_full_rows": frame.duplicated().sum()` | Rows that exactly repeat an earlier row | Detects accidental duplicated records |
| `"numeric_columns"`, `"object_columns"` | Column type counts | Dates are still text (`object`) at this stage; semantic typing comes later |

#### 3.4 Results [notebook, cell 42]

| Table | Rows | Columns | Missing share | Columns with gaps |
| --- | --- | --- | --- | --- |
| lap_times | 589,081 | 6 | 0% | 0 |
| driver_standings | 34,863 | 7 | 0% | 0 |
| results | 26,759 | 18 | **25.5%** | 8 of 18 |
| constructor_standings | 13,391 | 7 | 0% | 0 |
| constructor_results | 12,625 | 5 | **20.0%** (12,608 empty cells in one column) | 1 of 5 |
| pit_stops | 11,371 | 7 | 0% | 0 |
| qualifying | 10,494 | 9 | **12.4%** | 3 of 9 |
| races | 1,125 | 18 | **56.0%** | 11 of 18 |
| drivers | 861 | 9 | **20.1%** | 2 of 9 |
| sprint_results | 360 | 16 | 1.3% | 5 of 16 |
| constructors / status / circuits / seasons | 212 / 139 / 77 / 75 | | 0% | 0 |

**Duplicate full rows: 0 in every table.**

#### 3.5 How to read the figure `raw_table_profile.png`
Two horizontal bar charts sharing the same table order (sorted by row count). **Left: rows per table on a log axis** (log because `lap_times` has ~589k rows and `seasons` has 75, four orders of magnitude apart; on a linear axis everything else would be invisible). **Right: missing-cell share** (orange). Takeaways: (1) `lap_times` dwarfs everything and is not used for features (it is within-race data, post-start); (2) the tables that matter for modeling (`results`, `qualifying`, `races`, `drivers`) are exactly the ones with gaps; (3) most tables are complete.

#### 3.6 What the gaps mean (and what I cannot confirm from the files)
- `races` 56% [my check on `data/raw/races.csv`; the notebook does not break it down]: it is entirely the session-schedule columns, which only exist for recent seasons: `time` (race start time) 65% missing, `fp1_date`/`fp2_date`/`quali_date` 92%, `fp1_time`/`fp2_time`/`quali_time` 94%, `fp3_date` 93.6%, `fp3_time` 95.3%, `sprint_date` 98.4%, `sprint_time` 98.7%. The 7 core columns (`raceId`, `year`, `round`, `circuitId`, `name`, `date`, `url`) are 100% complete. We do not use the schedule columns as features.
- `results` 25.5% [my check on the raw file]: `position` 40.9% (empty when not classified), `time` and `milliseconds` 71.3%, `fastestLap` and `fastestLapTime` and `fastestLapSpeed` 69.2%, `rank` 68.2%, and `number` 6 cells. These are **post-race fields** and never enter `FEATURES`, so their missingness is irrelevant to the model. The columns we need (`grid`, `positionText`, `positionOrder`, `statusId`) have **0 missing**.
- `qualifying` 12.4%: `q1` 1.5% missing, `q2` 44.3%, `q3` 65.4% (drivers knocked out early, or old single-lap formats, have no later sessions).
- `drivers` 20%: exactly two columns with gaps, `number` (93.1% missing; permanent numbers only exist from 2014) and `code` (87.9%). Neither is used.
- `constructor_results` 20%: one column, `status`, 99.9% empty (12,608 of 12,625 cells). Not used.

#### 3.7 Limitations of this stage (say these before the evaluator does)
1. `missing_share` is an average over columns: it tells you *how much* is missing, not *which column*. We did not produce a per-column missingness table.
2. It profiles size, missingness and duplicates only. It does **not** show distributions of numeric columns (no histograms of grid, ages, lap counts) and no correlation matrix. The distribution-level evidence is in the feature EDA (Stage 5) and in the preprocessing distribution figures (Stage 8).
3. The "before and after" for *all tables* is not done; the after-cleaning comparison focuses on `results` (the grain table). That is reasonable because the cleaning actions only touch `results`/the modeling table.

---

### 4. Stage 2: Cleaning before/after EDA (cells 8, 14, 32, 42, 43)

#### 4.1 What cleaning does (needed to understand the EDA)
`clean_results` (cell 8): finds `(raceId, driverId)` pairs that appear more than once (**85 groups**; on the raw file [my check], 79 are in the 1950s, 5 in the 1960s, 1 in the 1970s; 79 groups have 2 rows and 6 have 3 rows; 21 of them are in the Indianapolis 500), and keeps one row each using the rule **(1) the car the driver actually started (`grid > 0`), (2) best `positionOrder`, (3) smallest `resultId`**. The sort puts the preferred row first in each group; `drop_duplicates(keep="first")` keeps it; an `assert` proves the grain is now unique. This removes **91 rows** (176 rows were in duplicate groups, 176 - 85 = 91).

Then `build_modeling_table` removes the **1,366 `positionText == "F"` rows** (drivers who did not qualify, prequalify or pass the 107% rule), per the instructor ruling. `W` rows (withdrew) are kept.

#### 4.2 `cleaning_eda` line by line (cell 14)

```python
raw = raw_results.copy()
deduplicated, _ = clean_results(raw_results)
stages = [("Raw results", raw), ("Shared drives resolved", deduplicated),
          ("Modeling table (F rows removed)", cleaned)]
```
Three snapshots of the *same table* at three moments. `cleaned` is the final modeling table passed in from `run_analysis`. Splitting the cleaning into two stages lets you attribute each effect to **one** step (the function's docstring says exactly this: "what each step does on its own"). Comparing only raw vs final would mix the two effects.

| Column | Definition | Why this metric |
| --- | --- | --- |
| `rows` | `len(data)` | Size |
| `unique_driver_races` | `drop_duplicates(["raceId","driverId"])` count | The grain we want; should equal `rows` when clean |
| `duplicate_rows` | `data.duplicated(["raceId","driverId"], keep=False).sum()` | **All** rows involved in duplicates (keep=False flags every member, not just the repeats) |
| `podium_rate` | `(positionOrder <= 3).mean()` | **The target distribution.** If cleaning moved it a lot we would be changing the problem |
| `pit_lane_share` | `(grid == 0).mean()` | Share of anomalous grid-0 rows |
| `missing_finish_share` | `positionOrder.isna().mean()` | Is the finishing order always present? (it is: 0) |
| `median_grid` | median of `grid` where `grid > 0` | Stability of the starting-position distribution; zeros excluded so they do not drag the median down |

#### 4.3 The numbers [notebook, cell 42 / `cleaning_eda.csv`]

| Stage | Rows | Unique pairs | Duplicate rows | Podium rate | Grid-0 share | Missing finish | Median grid |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Raw results | 26,759 | 26,668 | **176** | 12.69% | 6.12% | 0 | 12 |
| Shared drives resolved | 26,668 | 26,668 | **0** | 12.73% | 6.13% | 0 | 12 |
| Modeling table (F removed) | 25,302 | 25,302 | 0 | **13.42%** | **1.14%** | 0 | 12 |

#### 4.4 The arithmetic that proves the story [my check, derived from the table]
Rate x rows gives the counts, and they reconcile exactly:

- **Podium rows:** 3,397 (raw) -> 3,395 (after dedup) -> 3,395 (after `F` removal). So deduplication removed **2 podium rows** out of 91, and `F` removal removed **0**.
- **Grid-0 rows:** 1,638 -> 1,635 -> 289. Dedup removed 3; `F` removal removed **1,346**.
- Hence the podium rate rises from 12.73% to 13.42% **only because the denominator shrank** (3,395 / 26,668 = 12.73%; 3,395 / 25,302 = 13.42%). No podium was lost, so no real podium information changed.

This is the clean answer when asked "why did your target rate change?": *it is arithmetic, not distortion.*

#### 4.5 How to read `cleaning_before_after.png`
- **Left panel ("Grain at each cleaning stage")**: two bars per stage, `rows` and `unique_driver_races`. In the raw stage the two bars differ slightly (duplicates); after dedup they are equal. The visible lesson is "bars become equal"; the 91-row difference is only ~0.3% so it is hard to see by eye. (That is a weakness of the plot, not of the data; the table has the exact numbers.)
- **Right panel ("Rates affected by row selection")**: grouped by measure, colored by stage. `podium_rate` bars are almost identical for stages 1-2 and a bit higher for stage 3; `pit_lane_share` is flat for stages 1-2 and collapses at stage 3; `missing_finish_share` is zero (nothing visible). That last measure is a **sanity check** that finishing order is never missing, not a finding.

#### 4.6 Why the dedup rule is defensible
- **Started car first (`grid > 0`)**: a shared-drive driver can appear twice (two cars in one race). The car the driver *started from the grid* reflects pre-race identity; a car taken over later is not a pre-race fact.
- **Then best `positionOrder`**: deterministic tie-break that prefers the stronger result. This slightly favors podiums, but only 2 of the 91 removed rows were podiums, so any bias is negligible (<0.01% of rows).
- **Then lowest `resultId`**: guarantees reproducibility.
- It is rule-based and reproducible, which is what the brief asks ("choose a rule, apply it, explain why").

#### 4.7 Why `F` removal and what `cleaning_eda` shows about it
`F` rows are known *before* the race (the driver did not qualify), so they are not "a driver entering a race". Removing them before features are built means a skipped weekend does not count as a race in form windows or inflate `field_size` (training mean field size 25.06 with them, 23.25 without, [notebook cell 45]). The EDA stage 3 row shows the effect: grid-0 share drops 6.1% -> 1.1%.

#### 4.8 Limits
- The EDA compares *rates*, not distributions. It does not prove the full distribution of features is unchanged, only the target rate and median grid.
- "Median grid unchanged at 12" is a weak statement: the median is a robust statistic that hides changes in the tails. (It is still correct.)
- `missing_finish_share` carries no information (always 0).

---

### 5. Stage 3: Qualifying coverage by season (cells 32, 42, 43)

#### 5.1 The code (first block of `_plot_analysis_results`, cell 32)
```python
coverage = frame.groupby("year").qualifying_position.apply(lambda x: x.notna().mean()).reset_index(name="coverage")
plt.figure(figsize=(10, 4)); sns.lineplot(coverage, x="year", y="coverage"); ...
```
For each season, the fraction of modeling-table rows that have a `qualifying_position` after the left join from `qualifying`. `x.notna().mean()` is "share non-missing". It is computed on the **final modeling table**, so it is the coverage the model actually sees.

#### 5.2 The result [my check on the table; the plot is in the notebook]

| Seasons | Coverage | Meaning |
| --- | --- | --- |
| 1950-1993 | **0%** | No qualifying rows in the dataset at all |
| 1994 | 93.5% | Appears |
| 1995 | 100% | |
| 1996-2002 | **erratic: 44.6%, 58.8%, 44.1%, 18.5%, 23.6%, 5.9%, 11.7%** | Partial coverage, swinging by year |
| **2003 onward** | **~100%** (never below 98%) | Reliable from here |

Decade view [my check]: qualifying missing for 100% of rows in the 1950s-1980s, 64.2% in the 1990s, 26.2% in the 2000s, 0.5% in the 2010s, 0% in the 2020s.

Per split [notebook cell 69]: **training 64.0% missing, validation 0.13%, test 0%**.

#### 5.3 What to say about it
- **The course primer says "we believe qualifying.csv begins in the mid-1990s, but that must be confirmed from our own copy". Confirmed from the raw `data/raw/qualifying.csv` [my check]: the first season with any row is 1994, the last is 2024; 494 of the 1,125 races have at least one qualifying row; 44 of the 75 seasons have none.** Raw qualifying rows per results row: 1994 0.88, 1995 1.00, 1996 0.44, 1997 0.59, 1998 0.44, 1999 0.18, 2000 0.24, 2001 0.06, 2002 0.12, then 1.00 from 2003 (the modeling-table figures in 5.2 differ slightly in 1994 because `F` rows were removed first).
- It is **structural missingness**, not random: qualifying data were not recorded in the dataset, not "drivers randomly failed to qualify". The *sport* had qualifying (the grid existed) but the dataset has no rows for it. The files do not say why; do not guess a cause.
- This is the brief's named limitation, **"historical qualifying-coverage drift"**. It is also the checklist's example of hypothesis-driven motivation.
- **Decisions it motivated:**
  1. A **`qualifying_missing` flag** (1 if no qualifying record) so the model knows when a value is imputed.
  2. **Median imputation** for the numeric qualifying features, fitted on training only.
  3. **Keep `grid` as the main pre-race position signal**, because grid exists for every era while qualifying position does not. (Qualifying position and grid agree closely where both exist: Spearman 0.97, identical in 76.7% of 10,405 rows, [my check].)
  4. **Do not throw away the early seasons**: the missing-value experiments show that dropping training rows with no qualifying (leaving 8,348 of 23,163 rows) changes validation PR-AUC by -0.001 (LR) and -0.011 (network) [notebook cell 84]. It buys nothing and removes two-thirds of the history, including most long driver/team form.
  5. **`year` kept as a feature**, letting nonlinear models adjust for era (cell 64).
- The cost: the model is trained mostly on rows where qualifying is imputed (64%), but validated and tested on rows where it is nearly always real. That is **distribution shift** between train and evaluation, and it is the reason validation uses recent seasons (cell 70).

#### 5.4 Limits
- The flag `qualifying_missing` has almost no single-feature signal (AUC 0.49): rows without a qualifying record podium at about the base rate (12.9% vs 13.3%), so the flag marks *imputed rows*, not a predictive pattern. (In 1994-2002 the rates are 13.9% missing vs 12.8% present [my check]; a small difference.)
- 154 rows have a qualifying *position* but no parseable *time* [my check] (24 in 1995 and some in 2003-2005, e.g. a single-lap format), so the time feature is slightly more missing than the position (64.5% vs 64.0% in training).

---

### 6. Stage 4: "Who has grid 0?" audit (cells 44-46)

This stage is shared with the cleaning owner, but it is part of the EDA story because it came from a *surprise in the cleaning EDA*: grid-0 share of 6.1%.

**The surprise.** The flag was named `pit_lane_start`, which suggests pit-lane starts. The audit shows it was mostly **not**:

| Group | Treatment | Rows | Share | Grid-0 share | Podium rate | Years | Train / val / test |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Regular grid start | kept | 24,880 | 93.3% | 0 | 13.6% | 1950-2024 | 22,806 / 759 / 1,315 |
| Grid 0 but raced (pit-lane or exceptional) | kept | 87 | 0.3% | 1.0 | 0 | 1981-2024 | 34 / 16 / 37 |
| `W` withdrew | kept (code known only after the race) | 335 | 1.3% | 0.60 | 0 | 1950-2024 | 323 / 5 / 7 |
| `F` did not qualify / prequalify / 107% | **removed before features** | 1,366 | 5.1% | 0.985 | 0 | 1952-2012 | 1,366 / 0 / 0 |

Of 1,635 grid-0 rows after dedup: **1,346 are `F` drivers who never raced, 202 are withdrawals, only 87 are real pit-lane/exceptional starts**. After removing `F`, `pit_lane_start` marks **289 rows** (202 + 87): "no longer a did-not-qualify marker, but still not a pure pit-lane flag" (cell 46).

**The evidence the choice is safe** (cell 45, same 780 validation rows): keeping `F` rows changes validation PR-AUC by -0.0005 (LR) and +0.0144 (network); dropping them only from training by -0.0001 / +0.0126; the not-allowed removal of `W` as well by 0 / +0.0182. LR (deterministic) moves by at most 0.0005; the network's movement is inside its seed noise (a single seed sits up to 0.021 from its 3-seed mean). "**The choice rests on the ruling and on what a row means, not on a score.**"

---

### 7. Stage 5: A profile of the final modeling table [my check, not in the notebook]

These are facts I computed so you can answer "describe your data" questions. Present them as "we checked this on the final table".

| Fact | Value |
| --- | --- |
| Rows / columns | 25,302 rows (44 columns including raw ones; 16 model features) |
| Seasons / races / drivers / constructors / circuits | 75 / 1,125 / 814 / 202 / 77 |
| Podium rows | 3,395 = **13.42%** (so 86.58% would be right by always guessing "no") |
| Podium rows per race | exactly 3 in **1,107** races, **4 in 16** races, **5 in 2** races, all in **1950-1960** |
| Field size (rows per race, `W` rows included) | mean 22.5, median 22, min 10 (1958), max 42 (1954). **The 42 is the 1954 Indianapolis 500** (55 raw rows, 42 after dedup); see section 13 item 1 [my check on the raw files] |
| Races per season | 7 (1950), 13 (1970), 17 (2000), 24 (2024) |
| Podium rate by decade | 14.5%, 14.8%, 12.4%, 11.8%, 12.5%, 14.3%, 13.8%, 15.0% (1950s...2020s) |
| `grid_position` | mean 11.9, median 12, range 1-34, 289 missing |
| Podium rate by exact grid slot | P1 **64.1%**, P2 55.9%, P3 46.4%, P4 34.2%, P5 25.1%, P6 18.7%, P7 13.0%, P8 10.0%, P9 8.3%, P10 5.9% |
| Pole-sitter podium rate | 59.9% before 2014, **80.7%** from 2014 |
| `driver_age` | mean 30.0, range 17.5 to 56.8 |
| Splits | train 23,163 rows / 1,018 races / 13.27% podium / 64% no qualifying; validation 780 / 39 / 15.0% / 0.1%; test 1,359 / 68 / 15.0% / 0% |

**Why does a race sometimes have 4 or 5 podium rows?** In 18 early races, `positionOrder` values repeat (for example `[1, 1, 2, 3]` or `[1, 2, 2, 2, 3]`). That is consistent with co-drivers sharing a car and each receiving the same classification. I checked the raw files [my check]: the 18 races are all 1950-1960 and spread over 14 different Grands Prix (Monza several times, Reims, Zandvoort, Nurburgring, Monaco, Argentina, Silverstone, Spa, Aintree) plus three Indianapolis 500s, so it is not an Indy-only effect. The notebook does not discuss this. It is harmless for the label (each of those rows really is classified top three), but it means "3 podium rows per race" is a good approximation, not an identity. Say it as "I noticed this in the early 1950s-1960 data", not as a documented finding.

**Why does the podium base rate drift?** It is roughly 3 / field size. Smaller modern fields (20 starters) give ~15%; larger old fields (24-25) give ~12%. That is also why train (13.3%) and validation/test (15.0%) differ, as noted in cell 70.

---

### 8. Stage 6: Feature-level EDA (cells 20, 59-61)

#### 8.1 Purpose
Brief Objective 3: *"Feature choices must be justified with exploratory analysis; report the evidence"*, and the checklist's "hypothesis-driven (EDA-supported)" route. The notebook gives **every one of the 16 features its own row of evidence**, computed on **training seasons only**.

Why **training only**? Choosing features by looking at validation or test results would leak information about those sets into the design. The training seasons are the only data we are allowed to learn from. Validation AUC is shown only as a *stability check* (does the pattern persist in later seasons?), not used to select features.

#### 8.2 `_feature_bins` line by line

```python
observed = values.dropna()
if observed.nunique() <= 2:
    return values
return pd.qcut(observed.rank(method="first"), q=5, labels=False).reindex(values.index)
```
| Line | Meaning |
| --- | --- |
| `observed = values.dropna()` | Missing cells never go into a bin (they get their own orange bar later). |
| `if observed.nunique() <= 2: return values` | Binary flags (0/1) are their own bins; no cutting needed. |
| `observed.rank(method="first")` | Replace each value by its rank, breaking ties by **order of appearance**. This makes every rank unique. |
| `pd.qcut(..., q=5, labels=False)` | Cut the ranks into **5 equal-count bins**, coded 0-4. Because ranks are unique, `qcut` never fails with "Bin edges must be unique". Cutting the raw values would fail or merge bins for features with huge ties (e.g. 65% of driver-form values are exactly 0). |
| `.reindex(values.index)` | Put the codes back on the original row positions; missing rows get NaN. |

**A subtlety worth knowing:** ties are split by row order, and the modeling table is sorted by date. So when many rows share the same value (e.g. points = 0), they are split into bins *chronologically*, not randomly. Two bins can carry the same median value yet different podium rates (see `driver_points_before`: bins labelled 0 and 0 show about 6.6% and 3.7%). That difference comes from different eras being mixed into the tied bins, not from the feature value. [This is my reading of the code and figure; the notebook does not mention it.] It does not change the AUCs or the conclusions, but do not over-read two adjacent bars that carry the same label.

#### 8.3 `feature_eda` line by line

| Code | Meaning |
| --- | --- |
| `splits = split_by_time(frame); train, val = ...` | Training seasons (1950-2019) and validation (2020-21). Test is never touched. |
| `observed = train[[feature, "podium"]].dropna()` | Rows where the feature exists. For `qualifying_position` this is only the ~36% post-1994 rows. |
| `bins = _feature_bins(observed[feature])`; `rates = observed.podium.groupby(bins).mean()` | Podium rate in each bin. `rates.iloc[0]` = lowest-value bin, `rates.iloc[-1]` = highest-value bin. |
| `auc_train = roc_auc_score(observed.podium, observed[feature])` | One-feature ROC-AUC on training. |
| `auc_val` | Same on validation; NaN if only one class present. |
| `missing = train.loc[train[feature].isna(), "podium"]` | Podium rate among rows where the feature is missing. Tells you whether "missing" is itself informative. |
| `missing_share_train` | Share of training rows with the feature missing. |
| `direction` | "higher value, more podiums" if AUC >= 0.5, else "lower value, more podiums". |
| `signal_strength = abs(auc_train - 0.5) * 2` | Rescales distance from chance to 0-1 (this is the Gini coefficient, 2·AUC - 1, ignoring sign). 0 = nothing, 1 = perfect ordering. |
| `same_direction_in_validation` | True if validation AUC is missing or on the same side of 0.5 as training. |

**How to explain AUC 0.119 for `grid_position`:** "In 88% of random (podium, non-podium) pairs, the podium driver started from the lower grid number. AUC 0.12 is the same information as 0.88 with the direction flipped, which is why the table also reports `direction`."

**Why AUC is the right yardstick:** threshold-free, unit-free (so a 0-1 flag, a 1-34 position and a 0-722 points total are comparable), and unaffected by class imbalance. **Its limits:** it only sees monotone relations (a U-shape could score 0.5 yet be informative); it looks at one feature at a time, ignoring interactions and overlap with the other 15; and a rare flag can look weak (see `pit_lane_start`).

#### 8.4 The results [notebook cell 60, `feature_eda.csv`]

| Feature | Group | Missing (train) | Podium rate: lowest bin | highest bin | AUC train | AUC val | Direction |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `grid_position` | grid | 1.0% | 47.1% | 0.5% | **0.119** | 0.093 | lower = more |
| `pit_lane_start` | grid | 0 | 13.4% (flag 0) | 0.0% (flag 1) | 0.494 | 0.487 | (rare flag) |
| `front_row` | grid | 0 | 8.9% | 58.5% | 0.672 | 0.733 | higher = more |
| `field_size` | grid | 0 | 16.1% | 11.1% | 0.454 | 0.500 | lower = more |
| `qualifying_position` | qualifying | **64.0%** | 52.5% | 0.7% | **0.095** | 0.081 | lower = more |
| `qualifying_time_seconds` | qualifying | 64.5% | 17.1% | 10.8% | 0.451 | 0.458 | lower = more |
| `qualifying_missing` | qualifying | 0 | 13.9% | 12.9% | 0.490 | 0.499 | |
| `driver_podium_rate_5` | form | 3.5% | 5.8% | 42.5% | **0.810** | 0.836 | higher = more |
| `constructor_podium_rate_5` | form | 1.4% | 3.7% | 40.3% | **0.826** | 0.854 | higher = more |
| `driver_races_before` | form | 0 | 4.7% | 22.3% | 0.662 | 0.702 | higher = more |
| `driver_points_before` | standings | 0 | 6.6% | 34.0% | 0.755 | 0.803 | higher = more |
| `driver_rank_before` | standings | 0 | 22.3% | 2.1% | 0.265 | 0.153 | lower = more |
| `constructor_points_before` | standings | 0 | 8.2% | 32.1% | 0.724 | 0.792 | higher = more |
| `constructor_rank_before` | standings | 0 | 21.2% | 1.6% | 0.259 | 0.156 | lower = more |
| `driver_age` | context | 0 | 8.9% | 13.9% | 0.552 | 0.597 | higher = more |
| `year` | context | 0 | 14.4% | 13.9% | 0.505 | 0.500 | |

Rows with the feature **missing** (the orange bars): `grid_position` 0.0% podium (these are withdrawals/pit-lane rows); `driver_podium_rate_5` 2.8% and `constructor_podium_rate_5` 5.0% (a driver's/team's first race ever, nothing to average); `qualifying_position` 12.9% (about the base rate).

#### 8.5 How to read `feature_eda.png`
A 4x5 grid of small bar charts, 16 used and 4 blank. One panel = one feature; x-axis = its five equal-count bins labeled by the **median value inside each bin** (or the two flag values); y-axis = podium rate, fixed 0-1 in every panel so heights are comparable across panels; **orange bar** = rows where the feature is missing; title = feature, training AUC, % missing. A strong feature shows a steep staircase (`grid_position`: 47% to 0.5%; `qualifying_position` likewise); a useless one is flat (`year`, `qualifying_missing`).

#### 8.6 The story (cell 61) and the facts to hold
1. **Strong single signals:** position features (`qualifying_position` 0.095 on the 36% of rows that have it, `grid_position` 0.119), then standings ranks (~0.26), recent-form rates (0.81, 0.83), standings points (0.76, 0.72); `front_row` (0.67) and `driver_races_before` (0.66) are clear but smaller. All keep the same direction on validation.
2. **Weak single signals, kept for a different reason:** `field_size` 0.45, `driver_age` 0.55, `qualifying_time_seconds` 0.45, `pit_lane_start` 0.49, `qualifying_missing` 0.49, `year` 0.50. Reasons:
   - **Qualifying time** is not comparable across circuits and eras (a 75 s lap and a 105 s lap are both normal for different tracks), so its single-feature AUC is meaningless; the model needs it *with* the rest of the row.
   - **The two flags** mark *which rows were imputed or special*. A rare flag cannot raise AUC much: `pit_lane_start` is 1 in only ~1% of rows and those rows never podium, which is a real effect but invisible to AUC.
   - **`year`**: no single-feature signal, but removing it hurts the nonlinear models (-0.012 forest, -0.021 network, cell 63), so it is kept.
   - **`field_size`/`year` on validation**: flat/constant because every 2020-21 race has 20 starters.
3. **What the evidence does not show:** a one-feature AUC ignores the other 15 features, so a weak feature can still help in combination and a strong one can add little once grid is present. Qualifying adds only +0.006 PR-AUC on top of grid (ablation, cell 95). AUCs are **association, not cause**.

#### 8.7 Things to notice in the figure that the notebook does not say [my reading]
- **The rank panels peak in the *second* bin, not the first** (`driver_rank_before`: 22% in the lowest bin, ~31% in the next; `constructor_rank_before` 21% then ~31%). The lowest bin's median is 0, so it is mostly rank-0 rows ("no standings yet", which podium at roughly the base rate) mixed with genuine front-runners (ranks 1-2). Cell 55 acknowledges that rank 0 "could look better than first place". The AUC is still 0.26-0.27 because the later bins fall off monotonically.
- **The `field_size` last two bins both read "26"** because the bins are cut by rank and ties are split by row order (see 8.2).
- The plot title of each panel shows only AUC and missing share, not `signal_strength` or the validation AUC; those are in the table.

#### 8.8 About correlation between features [my check; **no correlation matrix is in the notebook**]
The brief lists "plots, correlations, or experiments" as acceptable evidence. The notebook uses *plots + one-feature AUC + experiments (ablation, context experiment, missing-value experiments)* and never shows a correlation heatmap. If asked about redundancy, this is the honest answer plus numbers (Spearman, all rows):

- `grid_position` vs `qualifying_position`: **0.97**
- `driver_points_before` vs `constructor_points_before`: **0.86**
- `driver_podium_rate_5` vs `constructor_podium_rate_5`: **0.78**
- `driver_rank_before` vs `constructor_rank_before`: 0.72
- Pearson correlation with the target: qualifying position -0.49, grid position -0.44, driver form +0.47, constructor form +0.46, driver points +0.31.

So several features overlap heavily. For logistic regression that makes individual coefficients harder to interpret, but not predictions worse. The ablation (which removes whole groups) is the notebook's tool for judging overlapping features.

---

### 9. Stage 6b: Why the form features use past races only (cells 10, 51-55)

This is explicitly on your list. The rule: **every feature must be known after qualifying and before the start.** Cell 52 states it: current-race position, points, status, laps, pit stops and fastest-lap info never enter `FEATURES`.

#### 9.1 Driver form: `shift` then `rolling`
```python
base["driver_podium_rate_5"] = base.groupby("driverId")["podium"].transform(
    lambda s: s.shift().rolling(5, min_periods=1).mean())
```
- `groupby("driverId")`: each driver's own sequence (the table is sorted by date first).
- `.shift()`: move values down one row so each row sees the **previous** race's result, not its own.
- `.rolling(5, min_periods=1).mean()`: the average over the last 5 values, using fewer if the driver has fewer than 5 earlier races.

**Toy example.** A driver's podium results over 7 starts: `[0, 0, 1, 0, 1, 1, 0]`.

| Race | Own result | After `shift()` | `rolling(5, min_periods=1).mean()` = feature |
| --- | --- | --- | --- |
| 1 | 0 | NaN | NaN (no past race: the driver's first race ever) |
| 2 | 0 | 0 | 0.00 |
| 3 | 1 | 0 | 0.00 |
| 4 | 0 | 1 | 0.33 |
| 5 | 1 | 0 | 0.25 |
| 6 | 1 | 1 | 0.40 |
| 7 | 0 | 1 | 0.60 |

Without `shift()`, race 3's feature would already include race 3's own podium. That is leakage of the target into the feature, and the model would "predict" well for the wrong reason. The window is the last **5 starts**, which cross season boundaries (no per-season reset).

`min_periods=1`: allow a feature after just one prior race instead of leaving the first four races empty. The cost is that early values are noisy (a single race gives 0 or 1). `driver_races_before` (`groupby.cumcount`) tells the model how many races the average is based on.

**Where the 3.5% missing comes from:** a driver's first race ever has nothing to average. **The 5-race window is a design choice; I found no experiment in the notebook that tunes the window length.**

#### 9.2 Constructor form: aggregate per race, *then* shift
```python
constructor_races = base.groupby(["constructorId","raceId","date"], as_index=False).podium.mean() ...
constructor_races["constructor_podium_rate_5"] = constructor_races.groupby("constructorId")["podium"].transform(
    lambda s: s.shift().rolling(5, min_periods=1).mean())
```
A team has two cars per race. If you shifted per *row*, one car's row would see its teammate's result from the **same** race in its window. Averaging both cars into one value per (team, race) first, then shifting at race level, guarantees only earlier races are used. The result is merged back by `(constructorId, raceId)`.

#### 9.3 Standings: attach to the *next* race
`_previous_standings`: a standings row is recorded **after** a race, so `shift(-1)` within `(entity, year)` moves it to the next round. Using it on the same race would leak that race's points. Consequences:
- Round-1 rows (and a driver's/team's first race of a season, and constructors before 1958 when their championship began) have **no** previous standing. These are set to **0 points and rank 0** (cell 53-54). Earlier, they were empty and the median imputer filled them with ~3 points and rank 13, "inventing points nobody has scored". Cell 54 proves it: round-1 values are `[0.]`, and **0 empty standings cells remain**.
- Flags marking those rows were tried and gave no validation gain, so they were not added (cell 55).
- Caveat: rank 0 is numerically "ahead of P1". It works because points = 0 does the real work and the rank coefficient is small (about -0.076).

#### 9.4 Sprint weekends: a judgement call, not a leak (cells 56-58)
A sprint ends one day before the race (share = 1.0 in all seasons 2021-2024), so it *is* pre-race information. It is still excluded because: sprints exist only from 2021, so there are **0 training rows** with one; in 2021-22 the sprint set the grid (rank correlation 0.89 / 0.99 with the grid), so the grid features already carry it; and from 2023 it adds a separate signal for only 12 weekends. The real hazard is that sprint results sit under the **same `raceId`**, so a naive join would mix a different race's result into this race's row.

#### 9.5 How the code is protected
`tests/test_pipeline.py` has leakage tests: for example, they set a race's `positionOrder` to 99 and assert the **features are unchanged** while the **label changes**. That proves the features do not read the current result.

---

### 10. Stage 7: The three data-engineering questions (cells 30, 32, 47-49)

All three live in `engineering_answers(frame, tables)` (cell 30). Common setup:

```python
status = tables["status"].set_index("statusId")["status"]
starters = frame.assign(status_text=frame.statusId.map(status))
starters = starters[~starters.status_text.isin(NON_START_STATUSES)].copy()
```
- `status` table: maps a numeric `statusId` to text ("Finished", "Engine", "Withdrew"...). **This is a multi-hop join** (results -> status), as the brief demands.
- `NON_START_STATUSES = {"Withdrew","Did not start","Did not qualify","Did not prequalify","Excluded"}`: rows that never really started are **excluded from every denominator**. Result: 25,047 starters.
- Note: `Excluded` (disqualified after the race) is included in this list, so a disqualified driver who *did* start is dropped from the question denominators even though the model table keeps them. That is a small, undocumented simplification. [my reading]

#### 10.1 Q1: Which circuits convert a front-row start into a podium most often, and does that change after 2014?

**Tables joined:** `results` -> `races` (year, circuit id) -> `circuits` (name) (+ `status` for non-starters).
**Grain:** one driver-race, restricted to rows that started from grid 1 or 2.
**Definition:** *front row = final grid position 1 or 2* (`starters.grid.isin([1, 2])`). The brief says "distinguish qualifying position from grid (which can differ due to penalties)". The notebook uses **grid**, because the grid is the actual start after penalties and exists for every era; qualifying position exists only from 1994 and is incomplete until 2003. (Where both exist, they differ for the front-row membership in only 0.7% of rows [my check], so the choice matters little; the notebook does not quantify this, it only argues it.)

```python
q1_source["era"] = np.where(q1_source.year >= 2014, "2014-2024", "1950-2013")
q1 = (q1_source.groupby(["era","circuit_name"]).podium.agg(["mean","count"]).reset_index()
      .query("count >= 10").sort_values(["era","mean"], ascending=[True,False]))
```
`mean` = podium rate among front-row starts; `count` = number of front-row starts (2 per race, so count / 2 ~ number of races: Magny-Cours 36 = 18 races, Suzuka 2014-24 = 18 = 9 races, Monaco 20 = 10 races, which agrees with my general knowledge of the F1 calendar, including the cancelled 2020 and 2021 races; that is a sanity check from memory, not something computed from the data). `count >= 10` removes circuits with too few starts to rank.

**Result [notebook]:**

| Era | Overall front-row podium rate | n | Top circuits |
| --- | --- | --- | --- |
| 1950-2013 | **56.1%** | 1,786 | Magny-Cours 80.6% (36), Istanbul 78.6% (14), Dijon 75.0% (12), Bremgarten 70% (10), Sepang 70% (30), Suzuka 70% (50) |
| 2014-2024 | **76.0%** | 454 | Suzuka 88.9% (18), Yas Marina 86.4% (22), Monaco 85.0% (20), Barcelona 81.8% (22), Spa 81.8% (22), Sochi 81.3% (16) |

All starters, for comparison: 13.3% (1950-2013), 14.8% (2014-2024). So a front-row start is worth about 4x the base rate in the old era and about 5x in the hybrid era.

**Answer:** "Yes, the ranking changes. Front-row conversion rises from 56% to 76%, and the leading circuits change (old: Magny-Cours, Istanbul, Dijon; new: Suzuka, Yas Marina, Monaco). Part of the reshuffle is that the old top 10 contains circuits that had left the calendar before 2014 (Magny-Cours, Istanbul Park, Dijon, Bremgarten). A like-for-like comparison is still possible: 16 of the 19 circuits with at least 10 front-row starts in 2014-2024 also have at least 10 in 1950-2013 [my check], and the two that appear in both top-10 lists rise sharply: Suzuka 70% -> 89% and Barcelona 65% -> 82%."

**Figure `front_row_conversion.png`:** horizontal bars, top 10 circuits per era, blue = 1950-2013, orange = 2014-2024, x = front-row-to-podium rate. A circuit with one bar appears in only one era's top 10. (The figure has no title; its axis label says it.)

**Caveats:** the 2014-2024 sample per circuit is small (14-22 front-row starts, i.e. 7-11 races), so differences of a few points between circuits are within noise; the ranking is descriptive; era boundary 2014 is the brief's hybrid-era cut, not a statistical break-point; circuit layouts and cars change inside an era.

#### 10.2 Q2: Do drivers podium more often at their home-country circuit, after controlling for starting position?

**Tables joined:** `results` -> `drivers` (nationality) -> `races` -> `circuits` (country) (+ `status`). Multi-hop and needs a **mapping from nationality (adjective) to country (name)**.

```python
home["home_country"] = home.driver_nationality.map(NATIONALITY_TO_COUNTRY)
home = home[home.home_country.notna() & home.grid_position.notna()].copy()
home["home_race"] = home.home_country.eq(home.country)
home["grid_band"] = pd.cut(home.grid_position, [0,3,6,10,15,100], labels=["1-3","4-6","7-10","11-15","16+"])
```
- `NATIONALITY_TO_COUNTRY` has **27** entries ("British" -> "UK", "Monegasque" -> "Monaco", ...). Drivers whose nationality is not in the dictionary, and rows with no grid position, are dropped: **928 rows excluded** [notebook, after non-starters are removed]. In the whole modeling table, 832 rows have a nationality that is not in the dictionary (Danish 218, Thai 124, Colombian 118, Venezuelan 115, Polish 99, Irish 67 ... [my check]); the notebook's 928 also counts rows with no grid position. One dirty value, `"Argentinian "` with a trailing space (9 rows), is also unmapped. None of those countries hosted a race in this dataset, so the dropped drivers could never have had a home race, **except** the 9 trailing-space Argentine rows (Argentina did host).
- One label quirk: circuit `country` is `"USA"` for most US tracks but `"United States"` for the newer Las Vegas Strip circuit [my check]. Only one American-driver row is mis-classified as away, so it is immaterial.
- **Controlling for starting position:** done in two ways.
  1. **Grid bands**: compare home vs away *within* the bands 1-3, 4-6, 7-10, 11-15, 16+.
  2. **Exact grid slot** + **Mantel-Haenszel** odds ratio (below).
- **Home share:** 2,304 home rows vs 21,815 away (9.6% of rows).

**Band results [notebook]:** podium rates, away vs home, are almost identical in every band: 1-3: 55.7% vs 54.9%; 4-6: 26.4% vs 24.7%; 7-10: 9.6% vs 8.9%; 11-15: 3.1% vs 3.4%; 16+: 0.76% vs 0.75%. Differences are under two points and **not in a consistent direction**.

**Figure `home_effect.png`:** podium rate (y) against grid band (x), two lines (home / away) that almost overlap, both falling steeply from ~55% to ~1%. The message of the figure: *starting position dominates; home status moves nothing visible.* **`home_effect_exact_grid.png`:** the same by exact grid slot 1-24. The home line is jagged because home samples are small (about 80-110 per slot, down to a handful at the back), so wiggles are noise.

**Mantel-Haenszel odds ratio, explained from scratch.**
- *Odds* of a podium = p / (1 - p). The *odds ratio* compares home and away: OR = 1 means no difference, OR < 1 means home drivers are *less* likely to podium *from the same slot*, OR > 1 the opposite.
- Within each exact grid slot you can form a 2x2 table (home/away x podium/no podium). MH combines the slot-specific tables into one overall OR:
  `OR_MH = sum(home_podium x away_nopodium / n) / sum(home_nopodium x away_podium / n)` (sum over slots, `n` = rows in the slot). In the code: `num = np.sum(home_yes * away_no / n)`, `den = np.sum(home_no * away_yes / n)`.
- **Why stratify by exact slot:** "a driver from pole podiums far more than a driver from 15th" is exactly the confounder the brief tells us to remove ("so the effect isn't just because home drivers happen to qualify better").
- **The race-cluster bootstrap:** the code builds a **cube** `cube[race, grid slot, home?, podium?]` of counts, then 1,000 times resamples **races with replacement** (`rng.integers(0, len(races), len(races))`, seed 42), recomputes the OR, and takes the 2.5th and 97.5th percentiles. Why *races*, not rows: only three drivers can podium in a race, so rows inside one race are not independent (one driver's podium takes a place away from others). Resampling rows would give intervals that are too narrow. Using a count cube avoids refitting a model 1,000 times.

**Result [notebook]:** **OR = 0.955, 95% CI 0.825 to 1.110.** The interval contains 1, so **the data do not show a home advantage or disadvantage**. (Not "there is no effect": absence of evidence, with an interval wide enough to hide a ~10% change in odds either way.)

**Caveats to state:** association not causation; nationality is only a proxy for "home" (a driver can live elsewhere, and a country can have many nationalities); some nationalities unmapped; home samples small per slot; era mixed (1950-2024) though home dynamics may differ by era; the OR is a single summary across all grid slots.

#### 10.3 Q3: Which constructors have the highest mechanical-retirement rate in 2014-2021 vs 2022-2024?

**Tables joined:** `results` -> `status` (why the race ended) -> `constructors` (name) -> `races` (year).
**Grain:** one driver start (so a team has up to two "starts" per race).
**Definition per the brief:** *"a race start that ended early because a component of the car failed. It excludes failures caused by a crash, by the driver, or by a regulation decision."*

```python
q3_source = starters[starters.year.between(2014, 2024)] ... mechanical = status_text.isin(MECHANICAL_TERMS)
q3_source["era"] = np.where(q3_source.year <= 2021, "2014-2021", "2022-2024")
q3 = ... groupby(["era","constructor_name"]).mechanical.agg(["mean","sum","count"]); q3 = q3[q3["count"] >= 20]
```
- **Numerator:** starts whose status text is in `MECHANICAL_TERMS` (a list of component statuses: Engine, Gearbox, Hydraulics, Power Unit, ERS, Electrical, Brakes, ...).
- **Denominator:** all recorded **starters** in the era (non-starters excluded by `NON_START_STATUSES`). So `rate = component failures / starts`.
- Minimum **20 starts** per constructor-era to be ranked.
- **Two lists, on purpose.** The *official* list follows the instructor's Piazza ruling (@10): count `Tyre puncture`, `Fire`, `Safety belt` as mechanical for simplicity, and also includes damage-prone labels (wing, wheel, suspension, tyre, puncture). The *conservative* list `CORE_MECHANICAL_TERMS` keeps only internal-system labels. The conservative one is a **sensitivity analysis** only; the official one gives the answer. The original Piazza export is **not archived** in the repo, so the notebook cannot prove the ruling, and you should say so if asked.

**Result [notebook]:**

| Era | Top 3 (rate, failures/starts) |
| --- | --- |
| 2014-2021 | Caterham **23.5%** (8/34), Lotus F1 **20.0%** (15/75), Toro Rosso **16.5%** (40/242) |
| 2022-2024 | Alfa Romeo **12.5%** (11/88), Alpine **11.0%** (15/136), AlphaTauri **8.0%** (7/88) |

Fleet-wide: **10.1% -> 6.1%** (official list: 329/3,257 -> 83/1,354) and **8.4% -> 5.6%** (conservative list). Both lists agree: reliability improved a lot, and the leaders are mid/back-field teams.

**Figure `mechanical_retirements.png`:** top 10 constructors per era, blue = 2014-2021, orange = 2022-2024; x = rate. Teams with only one bar existed in one era only.

**Caveats:** very small denominators for some teams (Caterham 34 starts, so one or two failures move the rate by 3-6 points); constructors are split by name changes (Toro Rosso vs AlphaTauri vs RB; Force India vs Racing Point vs Aston Martin) because the dataset gives rebrands new names/ids; the status labels are ambiguous (a "Wheel" or "Front wing" status may come from a collision, not a component fault) - this is why the sensitivity list exists; the denominator excludes disqualified (`Excluded`) starters. Also: the 2022-2024 window is only three seasons.

**For all three questions, state grain, missingness and the pre-race cutoff** (the brief's required justification): Q1-Q3 are *descriptive* questions about outcomes, not predictions, so the pre-race cutoff matters only in the sense that Q1 uses the grid (a pre-race fact) as the grouping variable; the outcome (podium, status) is of course post-race, which is allowed for analysis and is never fed to the model.

---

### 11. Stage 8: Supporting EDA-style checks (cells 56-67, 74-78)

| Check | Cell | One-line takeaway |
| --- | --- | --- |
| **Sprint check** | 57-58 | Sprints end 1 day before the race; excluded because 0 training rows and the grid already contains them. |
| **Calendar features** (`year`, `round`) | 62-64 | `round` removed (changes of -0.0008/-0.0036/+0.0003, inside noise; meaning differs across eras: ~8 races in 1950s vs 24 in 2024); `year` kept (removing it costs -0.012 forest, -0.021 network). Caveat: the test years are outside the training years, so a tree treats 2022 as 2019. |
| **Constructor renames** | 65-67 | Form is keyed by `constructorId`; renames reset form (Toro Rosso -> AlphaTauri), reused ids inherit old history (Aston Martin 2021 from 1960, Alfa Romeo 2019 from 1985). Affects 30 of 780 validation rows and 20 of 1,359 test rows, none of them podiums. Kept and documented. |
| **Feature-engineering effects** | 75-76 | Raw `grid` has 1.1% zeros (would sit "ahead of pole"); `grid_position` turns them to missing (min becomes 1); qualifying strings become seconds; joined qualifying time is missing for 59% of all rows; shifted form is missing on a driver's first race. |
| **Imputation and scaling effects** | 77-78 | Median imputation shrinks the standard deviation of the 64%-missing qualifying features by about 40% (tall spike at the median); standardisation puts features on one scale but keeps tails: **one qualifying time of 1,002.6 s lands about 97 standard deviations out.** Validation/test scaled means are not zero (`year` +1.7 SD, `field_size` -1.0 SD, `qualifying_missing` -1.3 SD), which is the honest view of period shift. |

---

### 12. Traceability: from EDA finding to decision (your "hypothesis-driven" table)

| EDA finding | Evidence | Decision |
| --- | --- | --- |
| 85 groups of repeated (raceId, driverId) | `cleaning_eda`: 176 duplicate rows | Dedup rule: started car, best finish, smallest `resultId` -> unique grain |
| Dedup did not move the target or median grid | 12.69% -> 12.73%; 12 -> 12; only 2 of 91 removed rows were podiums | Safe to keep the rule |
| 6.1% of rows have grid 0 | `cleaning_eda`, cell 46 | Audit: 1,346 `F`, 202 `W`, 87 true pit-lane starts; remove `F`, keep `W`, store grid 0 as missing + flag |
| Podium rate rises 12.73% -> 13.42% after `F` removal | 3,395 podiums unchanged, denominator smaller | Not distortion; arithmetic |
| Qualifying absent before 1994, erratic to 2002, full from 2003 | coverage plot, 64% missing in training | `qualifying_missing` flag, median imputation, grid as the main signal, keep early seasons, keep `year` |
| Grid/qualifying position are the strongest single signals | AUC 0.12 / 0.095, podium rate 47-52% -> <1% | Keep both groups |
| Form and standings are strong, same direction in validation | AUC 0.72-0.83 train, 0.79-0.85 val | Keep; build them without leakage |
| Round-1 standings missing | imputer would invent ~3 points/rank 13 | Set to 0 points, rank 0 |
| Qualifying time, age, field size, flags, year ~0.5 AUC alone | feature EDA | Keep, with reasons; test `round`/`year` by experiment; ablation shows context adds 0.001 |
| Sprint results exist from 2021 only | sprint check | Exclude by design |
| Renames/reused ids | constructor audit | Keep ids, document as limitation |

---

### 13. The weak spots of your EDA, most dangerous first

1. **The Indianapolis 500 (1950-1960) is still in the data, and nothing in the notebook, README or code mentions it.** The course primer lists it among the "oddities of early F1" and says "excluding it is a defensible choice we should document". On the raw files [my check]: 11 races, 405 raw rows (381 after dedup, 1.5% of the modeling table, 1.6% of training rows), 107 distinct drivers of whom 103 never appear in any other race in the dataset, 404 of the 405 raw rows are American drivers, 33 distinct constructors of which 30 appear nowhere else in the dataset (Adams, Bromme, Christensen, Deidt, Dunn, Elder, Epperly, Ewing...; only Ferrari, Maserati and Kurtis Kraft also race elsewhere), fields of 33-55 raw rows (the two largest fields in the whole dataset), no qualifying data, podium rate 9.4% vs 15.6% for the rest of 1950-60. It affects Q2 directly: **380 of the 2,304 home rows (16.5%) are Indianapolis 500 rows**. I reproduced Q2 exactly (OR 0.9546, CI 0.8246-1.1104) and re-ran it without those rows: **OR 0.957, CI 0.802-1.136, 1,924 home rows**, so the conclusion does not change. We did not re-train the models without them (that needs scikit-learn, which is blocked on this machine). See section 11 of `09_data_files_columns_cleaning_features.md` for the full defense.
2. **One absurd qualifying time stays in the data** (`qualifyId 2569`, `raceId 255`, `driverId 87`, year 1995, `q1 = "16:42.640"` = 1,002.64 s; the only value above 200 s [my check]). It is almost certainly a typo. The parser converts it faithfully and nothing clips it, so the scaled max is ~97 SD (cell 78). The notebook mentions the 97 SD but never calls it a data error. Say: "we found a single implausible value, it is one row in 10,332, and it only affects the scaled range of a feature that is 64% missing and weak alone; with more time we would cap or null it".
3. **No correlation matrix or histograms.** Evidence is one-feature AUC + binned rates + experiments. The brief accepts "plots, correlations, or experiments", so this is compliant, but redundancy between features (grid~qualifying 0.97, driver~constructor points 0.86) is not shown. Have the numbers from section 8.8 ready.
4. **Q1 does not quantify grid vs qualifying.** It argues the choice in words but never shows a table comparing the two definitions. Numbers if asked: they differ for front-row membership in 0.7% of rows where both exist [my check].
5. **Small samples in Q1 (7-11 races per circuit in 2014-2024) and Q3 (e.g. Caterham 34 starts).** Rankings are descriptive.
6. **The official mechanical list includes damage-prone statuses** (wing, wheel, tyre, puncture, suspension, fire, safety belt), which conflicts with the brief's "excludes crash" wording. It follows the instructor ruling (Piazza @10), which is not archived. The conservative list is the safeguard.
7. **Q2's "home" is nationality-based and 27 nationalities are mapped**; Danish, Thai, Colombian, Venezuelan, Polish, Irish and others are dropped. Those countries never hosted a race here, so this is harmless, but say so.
8. **Plots lack titles** (`front_row_conversion`, `home_effect`, `home_effect_exact_grid`, `mechanical_retirements` have axis labels and legends but no title). Describe each one aloud.
9. **The cleaning figure cannot show a 91-row change** (0.3%); use the table.
10. **The feature-EDA bins split tied values by row order** (chronologically), so two adjacent bins with the same label can show different rates; the AUCs are unaffected.
11. **Stale documents**: the README says 17 features, 26,668 rows, and "network best on validation" (file 00 has the full list). Your EDA numbers (26,759 -> 26,668 -> 25,302; 16 features) match the notebook, so quote the notebook.
12. **Piazza rulings are not archived**, and the saved outputs came from a local run (cell 2 prints `C:\D-\semester-9\...\data\raw`), so whether the Kaggle copy of the notebook has been run cannot be verified from the repo. The CSVs themselves are in `data/raw/` and tracked by git.
13. **Podium rows per race are not always 3** (18 early races have 4-5), the notebook does not mention it.

---

### 14. Numbers to know cold (EDA edition)

| Topic | Numbers |
| --- | --- |
| Raw dataset | 14 tables; `results` 26,759 rows; `lap_times` 589,081; `qualifying` 10,494; `races` 1,125; `drivers` 861 |
| Key checks | 14 primary keys and 22 foreign keys: **0 null, 0 duplicate, 0 orphans** |
| Raw missingness | races 56%, results 25.5%, drivers 20%, constructor_results 20%, qualifying 12.4%, sprint_results 1.3%, others 0%; 0 full-row duplicates anywhere |
| Cleaning | 26,759 -> **85 groups, 91 rows** -> 26,668 -> **1,366 `F` rows** -> **25,302** |
| Duplicate rows | 176 in raw (85 groups) -> 0 |
| Podium rate | 12.69% -> 12.73% -> **13.42%** (3,397 -> 3,395 -> 3,395 podium rows) |
| Grid-0 share | 6.12% -> 6.13% -> **1.14%**; of 1,635: 1,346 `F` + 202 `W` + 87 real |
| Median grid | 12 at every stage |
| Qualifying coverage | 0% before 1994; erratic 1994-2002; ~100% from 2003; training 64% missing, validation 0.1%, test 0% |
| Splits | 23,163 / 780 / 1,359 rows; 1,018 / 39 / 68 races |
| Feature EDA AUCs (train) | qualifying_pos 0.095, grid_pos 0.119, constructor form 0.826, driver form 0.810, driver points 0.755, constructor points 0.724, front_row 0.672, driver_races 0.662, age 0.552, year 0.505, flags 0.49, field_size 0.454, qual time 0.451 |
| Q1 | front row -> podium: **56.1% (1950-2013) -> 76.0% (2014-24)**; base 13.3% -> 14.8% |
| Q2 | MH OR **0.955**, 95% CI **0.825-1.110**; 2,304 home / 21,815 away; 928 excluded |
| Q3 | fleet 10.1% -> 6.1% (official), 8.4% -> 5.6% (conservative); leaders Caterham 23.5%, Lotus F1 20.0% / Alfa Romeo 12.5%, Alpine 11.0% |
| Sprints | 2021: 3, 2022: 3, 2023: 6, 2024: 6 sprints; 0 training rows |
| Constructor resets | 30 of 780 validation rows, 20 of 1,359 test rows, 0 podiums |

---

### 15. Presenting your EDA live: a 3-minute script and the cell order

**Open the notebook at Section 8 (cell 41) with cell 40 already run.**

1. **(20 s) Framing.** "Our EDA has three jobs: show what the data is and how cleaning changed it, justify the features, and answer the three questions. Everything is computed in code and saved as tables and figures."
2. **(30 s) Cell 42, raw profile.** "14 tables, `results` 26,759 rows, `lap_times` 589k. Missingness is concentrated in `races`, `results`, `qualifying`. All keys are unique and every foreign key reconciles."
3. **(40 s) Cleaning table and figure (cell 42-43).** "Three stages. Resolving 85 shared-drive groups removes 91 rows and makes the grain unique without moving the podium rate or the median grid. Removing 1,366 did-not-qualify rows lifts the podium rate to 13.4% only because none of them was a podium."
4. **(30 s) Qualifying coverage plot.** "Zero before 1994, erratic to 2002, complete from 2003: this is the coverage drift. It is why we keep a missingness flag, use grid as the broad signal, and validate on recent seasons."
5. **(30 s) Cells 44-46.** "The grid-zero audit: only 87 of 1,635 are real pit-lane starts, so we removed the did-not-enters per the ruling and kept withdrawals."
6. **(30 s) Cells 59-61, feature EDA.** "Each of the 16 features has training-only evidence: missing share, podium rate across bins, one-feature AUC and whether it holds on validation. Grid, form and standings are strong; qualifying time, age, flags are weak alone and are kept for stated reasons. It is association, not causation."
7. **(30 s) Cells 47-49.** "Q1: front-row conversion rose from 56% to 76% and the leading circuits changed. Q2: after controlling for grid slot with Mantel-Haenszel, OR 0.955 (0.825-1.110) so no demonstrated home effect. Q3: mechanical retirements fell from 10% to 6% of starts; rates for small teams are noisy and we show a stricter definition as a sensitivity."

If the evaluator interrupts, answer first and return to the next numbered step. Use file 08 for the question bank.

---

<a id="part-08"></a>

## Part 8. EDA question bank: every question an evaluator could ask, with an answer


**Written for:** the EDA owner, rehearsing out loud for the oral evaluation.

**How to use.** Read the question, answer aloud *before* reading the sample, then compare. Tags: **[notebook]** = the number or statement is in the notebook; **[my check]** = I computed it from `artifacts/modeling_table.csv` while preparing, so say "we checked this separately"; **[not in files]** = the repo cannot answer it, so say so instead of guessing. Background and derivations are in `07_EDA_owner_guide.md` (called "guide" below).

**Answer style that works:** (1) the answer in one sentence, (2) the number or figure that supports it, (3) the limitation or "this is association, not causation" when it is relevant. If you do not know, say what the notebook does show and what it does not. The checklist says "an AI tool suggested it" is not a justification, so always give the *project-specific reason*.

Sections: A big picture and the brief - B initial EDA - C cleaning EDA - D qualifying coverage - E grid 0, `F`, `W` - F feature EDA - G leakage and "past races only" - H Q1 - I Q2 - J Q3 - K statistics concepts - L test-set hygiene - M curveballs and "what would you change" - O the primer's early-F1 oddities, the Indianapolis 500 and the raw files - N quick navigation.

---

### A. Big picture and the brief

**A1. What is your EDA, in one breath?**
We profile every raw table in code, show what each cleaning step does to the target rate and the grid, show when qualifying data exists, give each of the 16 features its own training-only evidence (missing share, podium rate across bins, one-feature AUC), and answer the three multi-table questions with a stated grain and denominator, always as associations. Everything is a function in the notebook, saved as a CSV and a figure.

**A2. What does the brief require from EDA?**
Initial EDA done **before and after cleaning** to show the impact of cleaning; **visualisation**; and it **cannot be manual inspection**, it must be supported by implementation and justification. Feature choices must also be justified by exploratory evidence (hypothesis from EDA, or kept trial-and-error), and the three data-engineering questions need multi-table answers with figures.

**A3. How do you show your EDA is not "manual inspection"?**
Every EDA output is produced by a function: `raw_table_profile`, `cleaning_eda`, `feature_eda`, `engineering_answers`, and the plot helpers in `create_plots`. They run inside `run_analysis` (cell 40) and write CSVs and PNGs, so the evidence regenerates from raw data on Run All.

**A4. Where is the before/after cleaning EDA?**
Cell 14 defines `cleaning_eda`; cell 42 displays it with `cleaning_before_after.png`. It has three stages: raw results (26,759 rows), shared drives resolved (26,668), modeling table after removing `F` rows (25,302), and for each stage the rows, unique driver-races, duplicate rows, podium rate, grid-0 share, missing finish share and median grid.

**A5. Give me three findings from the EDA and the decision each led to.**
(1) 85 duplicate driver-race groups (176 rows) -> a deterministic dedup rule, and the target rate and median grid did not move. (2) Qualifying data are absent before 1994, erratic to 2002 and complete from 2003 -> a missingness flag, median imputation, grid as the main position signal, and keep the early seasons. (3) Grid, form and standings features are strong single signals, while qualifying time, age, flags, `year` are weak alone -> keep them with stated reasons and test `round`/`year` by experiment.

**A6. Which of your decisions are hypothesis-driven and which trial-and-error?**
Hypothesis-driven (from EDA): the dedup rule and `F` removal (cleaning EDA and 8.1 audit), the missingness flag and keeping grid (qualifying coverage plot), keeping the position/form/standings features (feature EDA). Trial-and-error (kept in the notebook): dropping `round` and keeping `year` (cell 63), the missing-value experiments (cells 83-84), preprocessing order, hyperparameters, the feature-group ablation.

**A7. List your EDA figures.**
`raw_table_profile.png`, `cleaning_before_after.png`, `qualifying_coverage.png`, `feature_eda.png` (16 panels), `front_row_conversion.png`, `home_effect.png`, `home_effect_exact_grid.png`, `mechanical_retirements.png`. The preprocessing figures (`preprocessing_distributions.png`, `preprocessing_ranges.png`) show the effect of imputation and scaling.

**A8. Did your EDA use the test set?**
See section L: the feature-level EDA uses training only (validation only as a stability check). The cleaning, coverage and three-question analyses describe the whole 1950-2024 table, including 2022-24, but none of them selects a model, feature, hyperparameter or threshold; the modeling choices they motivate would have been the same on 1950-2019 alone.

**A9. What would an evaluator want to see in the "explain every step" part?**
For each step: what it does, why it is right for this task, and evidence (plot, number or experiment). Say the *why* in terms of the F1 problem: "grain = one driver in one race", "cutoff = after qualifying, before the start".

---

### B. Initial EDA on the raw tables

**B1. What does `raw_table_profile` compute?**
Per table: rows, columns, missing cells, missing share (mean of per-column missing fractions = share of empty cells), columns with missing, duplicate full rows, numeric and text column counts. One row per table.

**B2. What did it find?**
`lap_times` is 589,081 rows, `results` 26,759. Missingness is concentrated in `races` (56%), `results` (25.5%), `drivers` (20%), `constructor_results` (20%), `qualifying` (12.4%), `sprint_results` (1.3%). There are **0 full-row duplicates** in any table, and all 14 primary keys and 22 foreign keys check out (0 null, 0 duplicate, 0 orphans).

**B3. Why is `races` 56% missing?**
The notebook does not break it down by column, but I checked the raw file [my check on `data/raw/races.csv`]: it is entirely the session-schedule columns, which exist only for recent seasons: race start `time` 65% missing, `fp1/fp2/fp3/quali` date and time 92-95% missing, `sprint_date`/`sprint_time` about 98%. The seven core columns (`raceId`, `year`, `round`, `circuitId`, `name`, `date`, `url`) are complete. We do not use the schedule columns as features.

**B4. Why does `results` have 25.5% missing, and is that a problem?**
Mostly post-race fields (finish time, milliseconds, fastest-lap data, `position` for non-classified drivers) [likely, not broken down in the notebook]. They are never in `FEATURES` because they are post-race information, so their missingness does not touch the model. The features that matter (`grid`, `positionOrder`) have no problematic gaps.

**B5. What is `\N` and what would happen if you had not handled it?**
The literal text the CSVs use for "no value". Read as ordinary text, numeric columns become text columns, `isna()` reports ~0% missing, dates cannot be parsed, and the profile would hide the missingness. `read_csv(..., na_values=["\\N"])` converts it at load time.

**B6. Why a log scale in the first panel?**
Table sizes span four orders of magnitude (75 rows for `seasons`, 589k for `lap_times`). On a linear axis only `lap_times` would be visible.

**B7. Why profile `lap_times` and `pit_stops` if you do not use them?**
They are part of the 14-table dataset, we audit their keys (composite keys `raceId+driverId+lap` and `raceId+driverId+stop`), and the profile shows they are within-race, post-start data, which is precisely why they cannot be features at the pre-race cutoff.

**B8. Did you check data types and outliers in the raw tables?**
Types: dates are parsed with `pd.to_datetime(errors="coerce")` and qualifying strings converted to seconds by `_time_to_seconds`. Outliers: not systematically. One came up through the preprocessing effects: a single qualifying time of 1,002.6 s (about 97 standard deviations after scaling), almost certainly a source typo. Other ranges look plausible (driver age 17.5-56.8, field size 10-42, grid 1-34) [my check]. We did not clip it.

**B9. Why do you only report missing share and not per-column missingness?**
It is a summary for the table-level EDA. The per-feature missingness that matters for modeling is reported in the feature EDA (`missing_share_train`), where each of the 16 features has its own value (e.g. qualifying position 64%).

**B10. Why do the duplicate-full-row counts matter if they are all zero?**
They show the duplication problem is *not* exact repeated records; it is the same `(raceId, driverId)` pair appearing with different content (shared drives), which only the grain audit detects.

---

### C. Cleaning EDA

**C1. Why a three-stage comparison instead of raw vs final?**
So each effect has one cause. Stage 2 isolates the grain fix (shared drives); stage 3 isolates the `F` removal. The docstring states this purpose.

**C2. Walk me through the table.**
Rows 26,759 -> 26,668 -> 25,302. Duplicate rows 176 -> 0 -> 0. Podium rate 12.69% -> 12.73% -> 13.42%. Grid-0 share 6.12% -> 6.13% -> 1.14%. Median grid 12 at every stage. Missing finish share 0.

**C3. Why does the podium rate go up after cleaning? Did you change the target distribution?**
Only by arithmetic. The number of podium rows is **3,395** both before and after the `F` removal (rate x rows: 0.127306 x 26,668 = 3,395 and 0.134179 x 25,302 = 3,395 [derived from the table]). The 1,366 removed rows contained no podium, so the denominator shrank and the rate rose from 12.73% to 13.42%. The dedup step moved it by 0.04 points (3,397 -> 3,395 podium rows).

**C4. What is a shared drive and how did you choose which row to keep?**
In early F1 drivers could swap cars mid-race, so the same driver appears twice in one race. We keep (1) the row with `grid > 0`, the car the driver actually started, (2) then the best `positionOrder`, (3) then the smallest `resultId`. It is deterministic and reproducible, and favours the pre-race identity of the entrant.

**C5. Does "keep the best finishing position" bias the target upward?**
In principle slightly. In practice only 85 groups (91 rows removed, 0.34% of rows) are affected, and the net podium count changed by just 2 (3,397 -> 3,395) [derived]. So any bias is under 0.01% of rows.

**C6. How many duplicates are there and where?**
85 `(raceId, driverId)` groups, 176 rows in those groups, 91 rows removed. The brief says they come mainly from the 1950s. The notebook does not give a per-decade breakdown, but I checked the raw file [my check]: **79 groups are in the 1950s, 5 in the 1960s, 1 in the 1970s**; 79 groups have 2 rows and 6 have 3 rows; 21 of them are at the Indianapolis 500.

**C7. What does `keep=False` do in `duplicate_rows`?**
`duplicated(keys, keep=False)` marks **every** member of a duplicate group, so the count (176) is "rows that participate in a duplicate", whereas `keep="first"` would count only the extra copies (91).

**C8. Why is the median grid computed only over `grid > 0`?**
Grid 0 is not a position. Including zeros would drag the median down artificially. Excluding them makes "median grid 12" mean the median of actual starting slots.

**C9. Why is median grid 12 a weak check?**
The median is robust, so it hides tail changes. It is one of three stability checks (with podium rate and, for dedup, the unique grain); I would not claim it proves the whole distribution is unchanged.

**C10. What does `missing_finish_share = 0` show?**
It is a sanity check: `positionOrder` is never missing, so the target is defined for every row. It is not a finding.

**C11. Why remove `F` rows but not `W` rows?**
Instructor ruling. `F` (did not qualify, prequalify or pass the 107% rule) is known before the race starts, so the driver never entered it and the row is not "one driver entering one race". `W` (withdrew) is known only after the race, and grid 0 can also be a genuine pit-lane start, so `W` rows must stay. [The Piazza thread itself is not archived in the repo.]

**C12. Does removing `F` rows hurt the model?**
No evidence it does. Keeping them changes validation PR-AUC by -0.0005 for logistic regression and +0.0144 for the network; the network's number is inside its seed noise (a single seed can sit 0.021 from its 3-seed mean). The choice rests on what a row means, not on a score.

**C13. Why remove `F` rows *before* building features?**
So a skipped weekend does not count as a race in `driver_podium_rate_5` or `driver_races_before`, and does not inflate `field_size` (training mean 25.06 with `F` rows, 23.25 without).

**C14. Why are the cleaning bars in the left panel almost identical?**
The change is 91 rows of 26,759 (0.3%), too small to see. The point of the panel is that "rows" and "unique driver-races" become equal. The exact numbers are in the table.

**C15. Is cleaning done before the split?**
Yes, the grain and `F` removal are rule-based and use no outcome-based statistic fitted on data; they happen before splitting. Anything that learns from data (imputer medians, scaler) is fitted on training only, inside the sklearn `Pipeline`.

**C16. The raw CSVs: are they modified?**
No. `load_raw_tables` reads; every cleaning function works on a copy (`results.copy()`), as the brief requires.

---

### D. Qualifying coverage

**D1. What does the coverage plot show?**
For each season, the share of modeling rows with a qualifying position. **0% for 1950-1993, 93.5% in 1994, 100% in 1995, then erratic 1996-2002 (44.6%, 58.8%, 44.1%, 18.5%, 23.6%, 5.9%, 11.7%), and about 100% from 2003 on** [my check for the exact yearly values; the shape is in the notebook figure].

**D2. Why does this matter?**
It is the "historical qualifying-coverage drift" the brief names as a limitation, and the checklist's own example of hypothesis-driven motivation. The model would otherwise treat a missing qualifying value as if it carried information.

**D3. What decisions did it cause?**
A `qualifying_missing` flag; median imputation (fitted on training only); grid as the historically broader position signal; keeping the early seasons; keeping `year` so that nonlinear models can adjust for era.

**D4. Why not simply drop all rows without qualifying?**
That keeps only 8,348 of 23,163 training rows (1994 onward), discards two thirds of the history including long driver and team form, and the experiment shows no benefit: validation PR-AUC changes by -0.001 (logistic regression) and -0.011 (network) [cell 84].

**D5. Why not drop the qualifying features entirely?**
Because they carry signal where they exist: `qualifying_position` has a one-feature AUC of 0.095 on the rows where it is present. The ablation says qualifying adds +0.006 PR-AUC on top of grid. We keep it, with a flag.

**D6. Isn't median-imputing 64% of a column dangerous?**
It creates a tall spike at the median and shrinks the standard deviation by about 40% (qualifying position 6.36 -> 3.82; qualifying time 15.76 -> 9.42, cell 77). That is why the flag exists and why we compared alternatives (impute vs drop columns vs drop rows, cells 82-84). Median imputation was kept because the alternatives were not better.

**D7. What does the flag mean at deployment?**
In real use qualifying is nearly always available, so the flag would almost always be 0. Its job in training is to stop the 64% imputed rows from corrupting the qualifying relationship. Validation and test have ~0% missing, which is the **distribution shift** between training and evaluation.

**D8. Why is `qualifying_missing`'s AUC 0.49 if it matters?**
Because it marks *imputed rows*, not a podium pattern. Rows with no qualifying record podium at about the base rate (12.9% vs 13.3% in training). It is for bookkeeping, not prediction. Removing it changes validation PR-AUC only slightly (cell 61 refers to section 13.1).

**D9. Why is the coverage erratic between 1996 and 2002?**
[not in files] The dataset does not say. The pattern is partial recording, not a change in the sport. I would not claim a cause.

**D10. Why 2003 as the turning point? Did you pick it from the data?**
It is read off the plot (the first year from which coverage stays at about 100%, and never below 98% afterwards [my check]). It is an observation used to motivate the flag, not a parameter fed to the model.

**D11. Qualifying position vs grid: which did you use and why?**
Grid for the broad signal and for Q1, because it exists in all eras and reflects penalties; qualifying position as an additional feature where available. Where both exist (10,405 rows) they are almost the same: Spearman 0.97, identical in 76.7% of rows [my check].

**D12. Does the coverage drift affect evaluation?**
Yes. Training sees 64% imputed qualifying rows; validation and test see ~0%. We validate on recent seasons (2020-21) because that shift is real; cell 70 states it.

---

### E. Grid 0, `F` rows, `W` rows

**E1. What is grid 0 and why did you not keep it as a position?**
Raw `grid == 0` means "no normal grid slot" (pit-lane start, exceptional start, or never started). Left as 0 it would sit numerically *ahead of pole*. We set it to missing in `grid_position` and carry the information in the `pit_lane_start` flag.

**E2. What surprised you in the grid-0 audit?**
That `pit_lane_start` was mostly not about the pit lane: of 1,635 grid-0 rows, **1,346 are `F` drivers who never raced, 202 are withdrawals, and only 87 are genuine pit-lane or exceptional starts.** After removing `F`, the flag marks 289 rows (202 + 87).

**E3. So is `pit_lane_start` a good name?**
Not perfect. The notebook says it is "still not a pure pit-lane flag" (cell 46). It marks "no normal grid slot among drivers who entered".

**E4. What are the podium rates of those groups?**
Regular starts 13.6%; grid-0-but-raced 0%; `W` 0%; `F` 0%. All 87 + 335 + 1,366 non-standard rows have no podium.

**E5. Why is `W` known "only after the race"?**
Instructor ruling: the withdrawal code is only recorded after the event, and a grid-0 row can also be a real pit-lane start, so removing `W` would use post-race information to filter rows. Removing `W` would change the network by +0.0182 (not allowed, shown only to illustrate).

**E6. Where are the `F` rows in time?**
All 1,366 are in 1952-2012, all are in training; validation and test contain none.

**E7. `field_size` includes `W` rows. Is that a leak?**
It counts every row for the race including 335 `W` rows. That follows the ruling (they are kept) and the effect is tiny: 289 rows overall are flagged. It is a minor, documented simplification, not a use of the race result.

---

### F. Feature-level EDA

**F1. What does the feature EDA show?**
For each of the 16 features, on training seasons only: share missing, podium rate when missing, podium rate in the lowest and highest of five equal-count bins, one-feature ROC-AUC on training and validation, a direction, a signal strength and whether the direction persists on validation. The figure has one bar panel per feature.

**F2. What is a one-feature ROC-AUC?**
Treat the raw feature value as a score. AUC is the probability that a randomly chosen podium row has a higher value than a randomly chosen non-podium row. 0.5 means no ordering information; above 0.5 higher values go with podiums; below 0.5 lower values do.

**F3. `grid_position` has AUC 0.119. Is that bad?**
No, it is very strong with the direction reversed: lower grid number means more podiums. 0.119 is equivalent to 0.881 for the negative of the feature. In 88% of random podium/non-podium pairs the podium driver started further forward.

**F4. What is `signal_strength`?**
`|AUC - 0.5| x 2`, a 0-1 rescaling of distance from chance (it equals the Gini coefficient up to sign). 0.762 for grid position, 0.012 for `pit_lane_start`.

**F5. Why use AUC and not correlation?**
It is threshold-free, unit-free (a 0/1 flag, a 1-34 position and a 0-722 points total are comparable), not distorted by class imbalance, and works for binary features. Its limitation: it only captures monotone ordering, so a U-shaped relation could look useless.

**F6. Why training seasons only?**
Choosing features by looking at validation or test results would leak information about those sets into the design. Validation AUC is shown only as a stability check, not as a selection criterion.

**F7. Why five bins? Why equal-count?**
Five is a readability choice (not tuned). Equal-count (quantile) bins keep every bar supported by the same number of rows, unlike equal-width bins that leave sparse tails for skewed features like points.

**F8. Why `rank(method="first")` before `qcut`?**
Many features have heavy ties (65% of driver-form values are exactly 0), and `qcut` on raw values fails or merges bins when edges are not unique. Ranking first gives unique values so five equal-count bins always exist.

**F9. Any artifact from that choice?**
Yes. Ties are split by row order, and the table is sorted by date, so tied values are separated chronologically. Two bins labelled with the same median value (for example 0 and 0 for driver points) can show different podium rates because they contain different eras. The AUCs are unaffected [my reading of the code; the notebook does not mention it].

**F10. Which features are strong and which weak?**
Strong: `qualifying_position` 0.095, `grid_position` 0.119, `constructor_podium_rate_5` 0.826, `driver_podium_rate_5` 0.810, `driver_points_before` 0.755, `constructor_points_before` 0.724, rank features about 0.26. Moderate: `front_row` 0.672, `driver_races_before` 0.662. Weak: `driver_age` 0.552, `year` 0.505, `pit_lane_start` 0.494, `qualifying_missing` 0.490, `field_size` 0.454, `qualifying_time_seconds` 0.451.

**F11. Why keep features with AUC near 0.5?**
Different reasons: qualifying time is not comparable across circuits and eras (needs the rest of the row); the two flags mark imputed or special rows and a rare flag barely moves AUC; `year` lets nonlinear models adjust for era (removing it costs -0.012 forest, -0.021 network); `field_size` and `driver_age` are low-cost context. The ablation shows the whole context group adds the least (0.001), and `round` was tested and removed.

**F12. Does a low single-feature AUC mean a feature is useless?**
No. AUC ignores interactions and the other 15 features. A feature can matter in combination, and a strong feature can add little once another strong feature is present: qualifying adds only +0.006 PR-AUC on top of grid.

**F13. `front_row` has AUC 0.67 but `grid_position` 0.12. Why such a gap?**
`front_row` is a coarse yes/no version of the grid. Only about 9% of rows are front-row starts, so the flag can separate only part of the podium rows; AUC for a binary feature is the average of its hit rate and its correct-rejection rate, which caps it well below the 0.88 that the full grid ordering reaches.

**F14. Why does `pit_lane_start` have AUC 0.49 if those rows never podium?**
They are about 1% of rows, so the effect is real but too rare to move AUC. The bar at flag = 1 is at 0%, which is the useful reading.

**F15. `qualifying_position` AUC 0.095 vs `grid_position` 0.119. Is qualifying better?**
Not comparable directly: qualifying position is measured only on the ~36% of training rows that have it (1994 onward), where positions may be more informative than in the 1950s-1980s. The ablation (qualifying adds +0.006 on top of grid) is the fair comparison.

**F16. What does `same_direction_in_validation = False` for `field_size` mean?**
Not a real reversal: validation AUC is exactly 0.500 because every race in 2020-21 has 20 starters, so the feature is constant, and the check's product is 0, which evaluates as False.

**F17. What do the orange bars mean?**
The podium rate of rows where the feature is missing: grid position missing 0% (withdrawals/pit-lane rows never podium), driver form 2.8% and constructor form 5.0% (first race ever), qualifying position 12.9% (about the base rate).

**F18. Why do the rank panels peak in the second bar?**
[my reading] The lowest bin's median is 0, so it is mostly rank-0 rows ("no standings yet", about the base podium rate) mixed with genuine front-runners. Cell 55 acknowledges rank 0 "could look better than first place".

**F19. Is there redundancy between features? Did you check correlations?**
The notebook has no correlation matrix; evidence is AUC, binned rates and experiments (which the brief accepts). Separately, I checked: grid vs qualifying position Spearman 0.97, driver points vs constructor points 0.86, driver form vs constructor form 0.78, driver rank vs constructor rank 0.72 [my check]. Overlap makes individual logistic coefficients harder to read; the ablation (removing groups) is our tool for judging it.

**F20. Why is `driver_age` valid at the pre-race cutoff?**
It is race date minus date of birth, known before the race.

**F21. Why is `driver_races_before` valid?**
It is the number of earlier rows for the driver in the date-sorted table (`cumcount`), so it counts only past starts.

**F22. The feature EDA says "association". What does that mean for the report?**
That the AUCs and bin rates describe patterns in past races, not causes: a driver does not podium *because* the grid number is low; the grid reflects car and driver quality. The brief explicitly requires this distinction.

---

### G. Leakage and "why form uses past races only"

**G1. What is data leakage here?**
Using information that is not available at prediction time (after qualifying, before the start): the current race's finishing position, points, status, laps, pit stops, post-race standings.

**G2. Explain `shift().rolling(5, min_periods=1).mean()`.**
`shift()` moves each driver's results down one row so each row sees only previous races; `rolling(5)` averages the previous five (fewer when the driver has fewer); `min_periods=1` allows a value after one prior race. Toy example: results `[0,0,1,0,1,1,0]` give features `[NaN, 0, 0, 0.33, 0.25, 0.40, 0.60]`. Without `shift()` the third race's own podium would be inside its feature.

**G3. Why aggregate constructor results per race before shifting?**
Two cars per team per race. A row-level shift would let one teammate's row see the other teammate's result from the same race in the window. Averaging both cars into one value per (team, race) and then shifting at race level guarantees only earlier races are used.

**G4. How are standings handled?**
`_previous_standings`: a standings row is recorded after a race, so it is attached to the *next* race in the same season (`shift(-1)` within the entity and year). Using it for the same race would leak that race's points.

**G5. What about the first race of a season, where there are no previous standings?**
Set to 0 points and rank 0 (cell 53-54), because nothing has been scored yet. Earlier they were left empty and the imputer invented ~3 points and rank 13. Cell 54 proves round-1 values are `[0.]` and no standings cell is empty. Flags for these rows gave no validation gain.

**G6. Isn't rank 0 "better than first place"?**
Numerically yes, which is a caveat. It works because points = 0 carries the information and the rank coefficient is small (about -0.076 in the selected logistic model).

**G7. Why a window of 5?**
It is a design choice (recent form); I found **no experiment in the notebook that tunes the window length** [not in files]. Say so rather than inventing a justification. It is long enough to smooth single results and short enough to track current form.

**G8. Does form cross seasons?**
Yes. The window is the last five *starts*, grouped by driver (or constructor) only, with no season reset. So early-season form uses late-previous-season races. Standings, in contrast, reset every season.

**G9. How is a new driver's or team's first race handled?**
NaN for form (3.5% of training rows for driver form, 1.4% for constructor form), then the training median (0) in the pipeline; `driver_races_before` = 0 tells the model it is a first race.

**G10. What happens when a team is renamed?**
Form is keyed by `constructorId`. Renames mostly get a new id, so form restarts at empty; some old ids are reused (Aston Martin 2021 inherits 1960, Alfa Romeo 2019 inherits 1985). It touches 30 of 780 validation rows and 20 of 1,359 test rows, none of them podiums. Documented as a limitation (cells 65-67).

**G11. How do you prove there is no leakage?**
Four layers: a whitelist (`FEATURES`) that contains only pre-race columns; shifted construction; unit tests (one sets a race's `positionOrder` to 99 and asserts the features are unchanged while the label changes); and a chronological split where every training race precedes every validation race (all integrity checks pass, cell 69).

**G12. Are sprint results a leak?**
Not by timing: sprints end a day before the race. We exclude them because there are 0 training rows (sprints start in 2021), and in 2021-22 the sprint set the grid so grid features already contain it. The real hazard is that sprint rows share the main race's `raceId`, so a careless join would mix another race's result in.

**G13. Is `field_size` known before the race?**
It is the number of entrants in the race table. See E7.

**G14. Why are post-race fields never in the features even though the table has them?**
The modeling table keeps them (they are used for the label and for Q1-Q3) but `FEATURES` is an explicit whitelist of 16 columns; the model is only ever given `splits[...][FEATURES]`.

---

### H. Question 1: front-row conversion

**H1. State the question and your answer.**
Which circuits convert a front-row start into a podium most often, and does the ranking change after 2014? Front-row conversion rises from **56.1% (1950-2013) to 76.0% (2014-2024)**, and the leading circuits change: Magny-Cours 80.6%, Istanbul 78.6%, Dijon 75.0% before; Suzuka 88.9%, Yas Marina 86.4%, Monaco 85.0% since.

**H2. What tables did you join?**
`results` -> `races` (year, circuit) -> `circuits` (name), plus `status` to exclude non-starters. Not `results` alone, as the brief requires.

**H3. What is the grain and denominator?**
One driver-race; the denominator is front-row starts (final grid 1 or 2) by drivers who actually started (`NON_START_STATUSES` removed), per circuit and era.

**H4. Why grid rather than qualifying position?**
Penalties can change the actual start after qualifying; the front row is defined by who *starts* in positions 1-2. Also, qualifying data do not exist before 1994 and are patchy until 2003. Where both exist they differ for front-row membership in only 0.7% of rows [my check]. The notebook argues this in words but does not tabulate the difference.

**H5. Why 2014 and why a minimum of 10?**
2014 is the hybrid-engine era boundary given by the brief. A minimum of 10 front-row starts per circuit-era removes circuits with too little data to rank.

**H6. How many races are behind a circuit's rate?**
Each race contributes two front-row starts, so count / 2 is roughly the number of races: Magny-Cours 36 = 18 races, Suzuka 2014-24 = 18 = 9 races, Monaco 20 = 10 races (this matches my general knowledge of the calendar, including the cancelled 2020-21 races; it is not computed from the data). So the 2014-24 leaders rest on roughly 7-11 races.

**H7. Is the ranking statistically reliable?**
It is descriptive. With 14-22 front-row starts per circuit in 2014-24, gaps of a few percentage points are within noise. The robust finding is the era-wide rise (56% -> 76%), not the exact order.

**H8. Why did conversion increase?**
[not in files] The notebook does not test causes. Plausible explanations (reliability, a dominant team, fewer overtakes) are hypotheses, not findings.

**H9. Compare with the baseline.**
All starters podium at 13.3% (1950-2013) and 14.8% (2014-2024), so a front-row start is worth about 4x and 5x the base rate respectively.

**H10. Describe the figure.**
Horizontal bars, top 10 circuits per era (blue 1950-2013, orange 2014-2024), x = front-row-to-podium rate. A circuit with one bar is in only one era's top 10. The chart has no title, so state this aloud.

---

### I. Question 2: home-country effect

**I1. State the question and your answer.**
Do drivers podium more often at a home-country circuit after controlling for starting position? No demonstrated effect: Mantel-Haenszel odds ratio **0.955, 95% CI 0.825-1.110**; the interval contains 1.

**I2. How did you define "home"?**
Driver nationality (`drivers`) mapped to a country name (27 mappings, e.g. "British" -> "UK") and compared to the circuit country (`circuits`). Home = equal.

**I3. What got excluded?**
928 starter rows: nationalities not in the dictionary (Danish, Thai, Colombian, Venezuelan, Polish, Irish...) and rows with no grid position. Those countries hosted no race in this dataset, so no real home race was lost, apart from 9 rows of a typo'd `"Argentinian "` [my check].

**I4. How did you "control for starting position"?**
Two ways. Grid bands (1-3, 4-6, 7-10, 11-15, 16+): home and away podium rates within each band are nearly identical (55.7% vs 54.9%, 26.4% vs 24.7%, 9.6% vs 8.9%, 3.1% vs 3.4%, 0.76% vs 0.75%). And a Mantel-Haenszel odds ratio stratified by exact grid slot.

**I5. Why not just compare home vs away podium rates?**
Because grid position drives podiums enormously (55% from slots 1-3, 1% from 16+). If home drivers happened to start further forward, the raw gap would reflect starting position, not "home". The brief says exactly this.

**I6. Explain the odds ratio.**
Odds = p/(1-p). OR = odds(home podium) / odds(away podium). 1 means no difference; below 1 means home drivers are less likely to podium from the same slot; above 1 more likely.

**I7. Explain Mantel-Haenszel in plain language.**
For each exact grid slot, make a 2x2 table (home/away x podium/no podium). MH combines these tables into one overall odds ratio, weighting each slot by its size, so that each home driver is compared only with away drivers *from the same slot*. Formula: sum(home_podium x away_nopodium / n) / sum(home_nopodium x away_podium / n).

**I8. What does it assume?**
That the home effect (odds ratio) is roughly the same across grid slots. It also needs enough rows in the slots that matter. It is a summary across 34 slots.

**I9. Why a race-cluster bootstrap?**
Rows in the same race are not independent: only three drivers can podium, so one driver's podium takes a place from the others. Resampling whole races (1,000 times, seed 42) respects that and gives a more honest interval. The notebook stores counts in a race x grid-slot x (home, podium) cube so each resample is fast.

**I10. How do you read the CI?**
The 95% interval 0.825-1.110 contains 1, so the data do not show a home advantage or disadvantage. It does *not* prove there is none: the interval is wide enough to be consistent with roughly a 10-15% change in odds either way.

**I11. Why is the exact-grid plot jagged?**
Home samples per slot are small (about 80-110 for slots 1-20, a handful at the back), so wiggles are noise. That is why the band plot and the MH summary exist.

**I12. Could a causal claim be made?**
No. It is observational; unobserved factors (car quality, team nationality, track knowledge) can differ between home and away starts. State: associational, not causal.

**I13. Limitations of "home".**
Nationality is a proxy (a driver may live elsewhere); some countries are not mapped; one label inconsistency ("USA" vs "United States") affects one row [my check]; the data cover 1950-2024 and mix eras; the home sample is only 2,304 rows of 24,119 (9.6%); and **380 of those 2,304 home rows (16.5%) are American drivers at the 1950-1960 Indianapolis 500**, which the course primer flags as distorting Q2. I re-ran Q2 without them [my check]: OR 0.957, CI 0.802-1.136, same conclusion (section O).

**I14. Do bands and exact slots agree?**
Yes: no consistent direction and very small differences in both views.

---

### J. Question 3: mechanical retirements

**J1. State the question and your answer.**
Which constructors have the highest mechanical-retirement rate in 2014-2021 vs 2022-2024? 2014-2021 leaders: Caterham 23.5%, Lotus F1 20.0%, Toro Rosso 16.5%; 2022-2024 leaders: Alfa Romeo 12.5%, Alpine 11.0%, AlphaTauri 8.0%. Fleet-wide the rate falls from 10.1% to 6.1% of starts (official list).

**J2. What tables did you join?**
`results` -> `status` (cause text) -> `constructors` (names) -> `races` (year). Again multi-hop.

**J3. What is the numerator and denominator?**
Numerator: starts whose status text is in `MECHANICAL_TERMS` (component failures: Engine, Gearbox, Hydraulics, Power Unit, ERS, Electrical, Brakes...). Denominator: all recorded starts for that constructor and era, excluding non-starters (`Withdrew`, `Did not start`, `Did not qualify`, `Did not prequalify`, `Excluded`). Minimum 20 starts per constructor-era.

**J4. The brief says to exclude crashes, driver errors and regulation decisions. Did you?**
The official list follows an instructor ruling (Piazza @10), which counts some borderline labels (`Fire`, `Safety belt`, `Tyre puncture`) as mechanical "for simplicity", and the official list also contains damage-prone labels (wing, wheel, suspension, tyre, puncture) that can come from collisions. So we also compute a **conservative internal-systems-only list** as a sensitivity analysis. Result: 10.1% -> 6.1% (official) and 8.4% -> 5.6% (conservative); the conclusion (reliability improved) holds under both. The Piazza export itself is not archived in the repo [not in files].

**J5. What is excluded from the numerator?**
Accidents, collisions, spins, disqualifications, finished races, laps down, and anything ambiguous.

**J6. Why is the denominator "starts" and not "races" or "retirements"?**
The brief defines it as "a race start that ended early because a component failed", so the natural rate is failures per start. Dividing by retirements would answer a different question (which share of retirements were mechanical).

**J7. Why a minimum of 20 starts?**
To avoid tiny samples: Caterham's 23.5% is 8 failures in 34 starts, so one or two failures move the rate by 3-6 points. The ranking is descriptive, and small teams are noisy.

**J8. How do renames affect Q3?**
Constructors are keyed by name in the table, so a rebrand splits history (Toro Rosso 2014-19 vs AlphaTauri 2020-23 vs RB 2024; Force India, Racing Point, Aston Martin). Each name-era needs 20 starts to appear.

**J9. Why split at 2022?**
The brief specifies 2014-2021 vs 2022-2024.

**J10. Why would reliability improve in 2022?**
[not in files] The notebook only describes the drop; do not offer causes as facts.

**J11. Describe the figure.**
Horizontal bars for the top 10 constructors per era (blue 2014-2021, orange 2022-2024), x = mechanical-retirement rate. Teams with a single bar existed in only one era with at least 20 starts. No title, so describe it aloud.

**J12. Why does "Excluded" matter?**
Excluded (disqualified) rows are removed from the Q1-Q3 starter denominators even though those drivers did start; that is a small simplification [my reading, not stated in the notebook]. The modeling table itself keeps them.

---

### K. Statistics concepts you may be asked to explain

**K1. ROC-AUC vs PR-AUC, and why PR-AUC primary?**
ROC-AUC is the chance a random podium row scores above a random non-podium row; PR-AUC summarises precision vs recall and is more informative when the positive class is rare (13.4% podiums). We report both, PR-AUC as primary.

**K2. What is class imbalance and how does it show up in your EDA?**
13.4% of rows are podiums (3,395 / 25,302), so a model that always says "no podium" is 86.6% accurate and useless. That is why accuracy is not used.

**K3. Mean vs median imputation?**
Median is robust to outliers (the 1,002 s qualifying time would distort a mean). It is fitted on the training rows only.

**K4. What is standardisation and why does it not remove the outlier?**
Subtract the training mean, divide by the training standard deviation. It is linear, so shapes and orders are unchanged: long tails stay long (the 1,002.6 s time lands about 97 SD out). It matters for logistic regression's penalty and the network's gradient steps, not for trees.

**K5. What is a quantile bin?**
A bin holding the same number of rows as the others; five bins = quintiles.

**K6. What is a bootstrap and why 1,000?**
Resample the data with replacement many times, recompute the statistic, and read the spread. 1,000 resamples give a stable 2.5th-97.5th percentile interval.

**K7. What is a confidence interval here?**
The range of values of the statistic that resampling suggests are plausible; if it includes the null value (1 for an odds ratio), we cannot claim an effect.

**K8. Odds ratio vs risk ratio?**
A risk ratio compares probabilities; an odds ratio compares odds. For rare events they are similar; for common ones (podium rate near 50% in front slots) they differ. MH is defined on odds, which is why we use it.

**K9. What is stratification?**
Comparing like with like: split the data into groups with the same value of a confounder (here grid slot) and combine the within-group comparisons.

**K10. What is a confounder?**
A variable related to both the exposure and the outcome. Here starting position is related to being a home driver and to podium chance.

**K11. Association vs causation, concretely.**
Grid position is strongly associated with podiums, but the grid is a *consequence* of car and driver strength (via qualifying), not a switch you can flip. Importance of a feature to a model means the model relies on it, nothing more.

---

### L. Test-set hygiene: "did you look at the test set during EDA?"

Be precise. The three layers:

| Analysis | Seasons used | Test seasons (2022-24) included? | Does it select a model/feature/hyperparameter/threshold? |
| --- | --- | --- | --- |
| `feature_eda` (AUCs, bins, missing) | **Training only**, validation AUC as a check | No | No (it motivates features; keeping all 16 and later tests on validation) |
| Context experiment (`round`/`year`), missing-value experiments, ablation, hyperparameters, thresholds | Train fit, **validation** scoring | No | Yes, on validation, as the brief allows |
| Raw profile, `cleaning_eda`, qualifying coverage, grid-0 audit | All 1950-2024 | Yes (descriptive) | The decisions they motivate (dedup, `F` removal, flag, imputation) rest on rules and on training/validation evidence |
| Sprint check | 2021-24 | Yes | Excludes sprint features because training has 0 sprint rows, which is true without the test years |
| Q1, Q2, Q3 | All 1950-2024 (Q3 only 2014-2024) | Yes | No; they are descriptive questions, not model inputs |

**L1. Is it a problem that your cleaning EDA and coverage plot include the test seasons?**
They are descriptive and aggregate. They tell us that 2022-24 qualifying coverage is complete and that no `F` rows exist there, but no choice depends on those numbers. The qualifying decisions (flag, median imputation) are justified by the pre-2020 pattern alone (coverage is ~100% from 2003, so training has 64% missing).

**L2. Did test results influence anything?**
No. The brief forbids selecting thresholds and hyperparameters with the test set, and the README repeats it. The test seasons are scored once after choices are frozen.

---

### M. Curveballs and "what would you change?"

**M1. What is the weakest part of your EDA?**
(0) The Indianapolis 500 (1950-60), which the course primer tells us to treat and document, is neither excluded nor mentioned (section O has the numbers and the Q2 re-run). (1) A single implausible qualifying time (1,002.64 s, 1995) is left in. (2) There is no correlation matrix or per-column missingness table. (3) Q1 argues grid vs qualifying but does not quantify the difference. (4) Small samples in Q1 and Q3. (5) Four of the figures have no titles.

**M2. What would you do with another week?**
Cap or null the 1,002.64 s time and report the effect; add a correlation heatmap and a per-column missingness table; tabulate grid vs qualifying front-row membership; add Q2 results split by era; add confidence intervals to Q1 and Q3 rates; check the early-1950s races with 4-5 podium rows.

**M3. What surprised you?**
That `pit_lane_start` was mostly not about the pit lane (87 real pit-lane starts out of 1,635 grid-0 rows), and that removing 1,366 rows moved the podium rate only because none of them was a podium.

**M4. Why are there 4 or 5 podium rows in some races?**
In 18 races from 1950-1960 `positionOrder` repeats (for example `[1,1,2,3]`), consistent with co-drivers sharing a classification [my check; the notebook does not discuss it]. The label is still "finished top three". Say "I noticed it; it is harmless for the label".

**M5. If the evaluator says "your EDA does not show distributions of numeric features".**
Agree partly: the distribution-level evidence is the binned podium rates (feature EDA) and the raw-vs-imputed-vs-scaled tables and figures in section 12 (ranges, means, SDs, shifts between splits). We did not produce standalone histograms.

**M6. If the evaluator says "the README says 17 features and 26,668 rows".**
The README is stale; the notebook is the source of truth: 16 features after `round` was removed (cell 62-64) and 25,302 rows after removing the 1,366 `F` rows (26,668 is the count *before* `F` removal).

**M7. If asked who is responsible for what.**
The README's split lists EDA, the three questions and the feature evidence under the EDA owner. The checklist says any member may be asked anything, so you also know the pipeline end to end.

**M8. If asked "is your Q2 result evidence of no home advantage?"**
No. It is *no demonstrated effect*: the CI contains 1 and also contains moderately sized effects.

**M9. If asked "what would change if you defined the era boundary at 2010?"**
[not tested] We used 2014 because the brief specifies it. I would not state what happens at another cut without running it.

**M10. Why did you not use lap times or pit stops for EDA?**
They are within-race data, only known after the start, so they are outside the prediction cutoff; they appear in the raw profile and key audit but not in features. (Q1-Q3 do not need them either.)

**M11. What is the single most important plot and why?**
`qualifying_coverage.png`: it is the plot that motivates the largest preprocessing decisions (flag, imputation, grid as main signal, validate on recent seasons) and it is the brief's own example of EDA-driven motivation.

**M12. How do you know the dedup rule is right and not just plausible?**
The brief asks for *a rule, applied, and explained*. Ours is deterministic and reproducible, prefers the pre-race identity of the entrant, and changes the target rate by 0.04 percentage points and the median grid by 0 (stage 2 vs stage 1), so alternative reasonable rules would not change the findings materially. [We did not run alternative dedup rules.]

---

### O. The primer's "oddities of early F1", the Indianapolis 500, and the raw data

(Full numbers in `09_data_files_columns_cleaning_features.md`, section 11.)

**O1. Did you exclude the Indianapolis 500?**
No, and the notebook does not mention it. The course primer says excluding it is "a defensible choice we should document". Say: "We kept it and did not document it, which is a gap in our write-up. It is 11 races, 381 modeling rows, 1.6% of training, none in validation or test. The place it can matter is Q2, where 380 of 2,304 home rows are American drivers at the Indy 500. I re-ran Q2 without them: odds ratio 0.957, CI 0.80-1.14, the same conclusion as 0.955 (0.825-1.110)."

**O2. Why does the Indy 500 distort things?**
Per the primer: it counted for the championship, almost no F1 regulars entered, its drivers rarely raced elsewhere, and the grid structure is very different. In our data [my check]: 107 drivers of whom 103 appear nowhere else; 404 of 405 raw rows are American; 30 of 33 constructors appear nowhere else; fields of 33-55 rows (the largest in the dataset); no qualifying data; podium rate 9.4% vs 15.6% for the rest of 1950-60.

**O3. Does it affect your models?**
It is 1.6% of the training rows, with unusual field sizes (33-42) and one-off constructors, so the effect is probably small, but **we did not test it** (re-training needs scikit-learn). Do not claim the models are unaffected; say it is untested and small in share.

**O4. How would you exclude it?**
Filter out `circuitId == 19` for years 1950-1960 before building features, document the 405 raw rows, and report results with and without. That is a team decision because it changes every downstream number.

**O5. The primer lists five oddities. How does your project handle each?**
Shared drives: covered by the dedup rule (85 groups). Qualifying drift: covered (coverage plot, flag, imputation, grid, window test). Oversized fields: `F` rows removed (1,366), `field_size` and `year` kept. Identity drift: form keyed by `constructorId`, renames reset history, audited for 2014+. Low reliability: implicit through `year`; the data show the share of rows ending "Finished"/"+N Laps" rising from 44-52% in 1950-1990 to 85% in the 2020s. Indianapolis 500: not handled.

**O6. The primer says "grid 0 means a pit-lane start (verify in EDA)". What did you find?**
It is mostly not: of 1,635 grid-0 rows, 1,346 are `F` drivers who never raced, 202 are withdrawals, and only 87 are real pit-lane or exceptional starts.

**O7. The primer says "we believe qualifying.csv begins in the mid-1990s". Did you confirm it?**
Yes [my check on the raw file]: first season 1994; 494 of 1,125 races have rows; 44 of 75 seasons have none; 1996-2002 coverage is 44%, 59%, 44%, 18%, 24%, 6%, 12%; complete from 2003.

**O8. Where are the CSV files and how many are there?**
`data/raw/`: 14 CSVs, about 22 MB, tracked by git. The notebook's cell 2 prints the path and cell 6 loads them.

**O9. Is there an "extraction" step?**
Only loading: the data is a static Kaggle (Ergast) snapshot, read with `pd.read_csv(na_values=["\\N"])`. There is no scraping or database query.

**O10. Why do `races.csv` and `results.csv` have so much missing data?**
`races`: session-schedule columns that exist only for recent seasons (56% of cells). `results`: post-race fields (finish time, fastest-lap data, `position` for unclassified drivers). Neither affects the model because those columns are not features.

---

### N. If asked "show me where": quick navigation

| They ask about | Go to |
| --- | --- |
| Raw profile, missingness, key audit | Cell 42 (and code in cell 6) |
| Before/after cleaning | Cell 42-43 (code cell 14) |
| Qualifying coverage | Cell 42 figure `qualifying_coverage.png` |
| Grid 0, `F`, `W` | Cells 44-46 |
| Per-feature evidence and the 4x5 figure | Cells 59-61 (code cell 20) |
| Shifted form / standings, round-1 fix | Cells 50-55 (code cell 10) |
| Sprint decision | Cells 56-58 |
| Q1 / Q2 / Q3 | Cells 47-49 (code cells 30 and 32) |
| `round` vs `year` | Cells 62-64 |
| Renamed teams | Cells 65-67 |
| Imputation/scaling effect, the 97-SD value | Cells 74-78 |
| Missing-value experiments | Cells 82-84 |
| Splits, shift between train and test | Cells 68-70 |

**Final rehearsal drill (5 minutes):** answer A5, C3, D3, F2, G2, H1, I7, I9, J4 and M1 aloud without notes. If you can do those ten, you can handle almost anything the evaluator will ask about EDA.

---

<a id="part-09"></a>

## Part 9. The data: where the files are, how they are loaded, every table and column, how the data is cleaned, and the 16 features


**Written for:** the teammate who owns EDA and must explain the data from the raw CSVs to the final features.

**Conventions.** "Cell N" is the 0-based index in the `.ipynb`. **[notebook]** = printed in the notebook or saved in `artifacts/`. **[my check]** = I computed it with pandas directly on `data/raw/*.csv` or `artifacts/modeling_table.csv` while preparing this guide; it is *not* in the notebook, so say "we checked this separately". Column meanings marked **(std)** come from the standard Ergast/Kaggle schema and the course primer, not from the notebook, which never defines most columns.

**A correction first.** In `07_EDA_owner_guide.md` and `08_EDA_question_bank.md` I earlier said the raw CSVs were not in the repo. That was wrong: they are in `data/raw/` and tracked by git. I have fixed those two files.

---

### 0. The short answers

| You asked | Answer |
| --- | --- |
| **Where are the CSV files?** | `data/raw/` in the repo: `C:\D-\semester-9\ACL-903\ACL-Project\ACL-9th-Paladin\data\raw`. Tracked by git. Cell 2 of the notebook prints this path. On Kaggle the notebook searches `/kaggle/input` for `results.csv` instead. |
| **How many CSVs?** | **14**, about **22 MB** in total (`lap_times.csv` alone is 17.6 MB). |
| **How did we do "extraction"?** | There is no scraping, API or database. The 14 CSVs are a static snapshot of the Kaggle (Ergast) dataset. "Extraction" = `load_raw_tables` (cell 6): `pd.read_csv(path, na_values=["\\N"], low_memory=False)` for every file, into a dictionary `tables["results"]`, `tables["races"]`, and so on. |
| **What are the columns?** | See section 3: all 14 tables, every column, type, missing share, meaning, and whether we use it. |
| **How did we clean / drop?** | Only **two row-dropping steps** exist: (1) 85 shared-drive duplicate groups, **91 rows** removed; (2) **1,366** `positionText == "F"` rows (drivers who never entered the race) removed. 26,759 -> 26,668 -> **25,302 rows**. Everything else is kept and handled by imputation. See sections 5-6. |
| **What are the features?** | 16, in five groups: grid (4), qualifying (3), form (3), standings (4), context (2). Section 8. |
| **Is qualifying coverage really from 1994?** | Yes, confirmed from the raw `qualifying.csv`: first season 1994, 494 of 1,125 races covered, 44 of 75 seasons with no rows. Section 10. |
| **Is the Indianapolis 500 excluded?** | **No, and the notebook never mentions it.** Section 11 has the numbers, the effect on Q2, and the defense. |

---

### 1. Where the files are and how they got there

```
ACL-9th-Paladin/
  data/
    README.md        <- says: raw/ is the unmodified 14-table snapshot; do not edit CSVs
    raw/             <- the 14 CSV files (tracked by git, read-only by convention)
  artifacts/         <- everything the notebook generates (git-ignored)
  notebooks/milestone_1_f1_podium_prediction.ipynb
```

- **Source:** the Kaggle dataset `rohanrao/formula-1-world-championship-1950-2020` (the URL still says 2020, but the files run to the 2024 season: `races.csv` has years 1950-2024). **The URL name is a leftover, not an error in our data.** `data/README.md` says it was downloaded on 2026-09-30; the file timestamps (29 Jan 2025) are the dataset's own snapshot date.
- **Immutability:** the brief says raw CSVs stay unchanged. The notebook only reads them; every cleaning function works on `.copy()`s.
- **Where outputs go:** `artifacts/` locally, `/kaggle/working/artifacts` on Kaggle. `.gitignore` excludes `artifacts/`, so teammates regenerate them with Run All.

#### Cell 2: finding the data (`locate_data`)
```python
ROOT = Path.cwd().resolve()
if ROOT.name == "notebooks": ROOT = ROOT.parent
local = ROOT / "data" / "raw"
if (local / "results.csv").exists(): return local
kaggle_root = Path("/kaggle/input")
matches = sorted(kaggle_root.rglob("results.csv")) if kaggle_root.exists() else []
```
Look for `data/raw/results.csv` locally; otherwise search `/kaggle/input` for any folder containing `results.csv`; otherwise raise a clear error. This is why the same notebook runs on a laptop and on Kaggle. The saved output prints `Raw data: ...\data\raw`, proving the saved results came from a **local** run.

#### Cell 6: loading (`load_raw_tables`)
`for path in sorted(data_dir.glob("*.csv")): tables[path.stem] = pd.read_csv(path, na_values=[SENTINEL], low_memory=False)`. Then it checks that all required tables exist (`PRIMARY_KEYS` plus `sprint_results`, `lap_times`, `pit_stops`) and raises `FileNotFoundError` if not. The sentinel `SENTINEL = "\\N"` (the literal two characters backslash-N) becomes `NaN` at load time.

**What a raw line looks like** [my check]:
```
results.csv    1,18,1,1,22,1,1,"1",1,10,58,"1:34:50.616",5690616,39,2,"1:27.452","218.300",1
races.csv      1,2009,1,1,"Australian Grand Prix","2009-03-29","06:00:00","http://...",\N,\N,\N,\N,\N,\N,\N,\N,\N,\N
qualifying.csv 1,18,1,1,22,1,"1:26.572","1:25.187","1:26.714"
```
The `\N` cells in `races.csv` (practice/qualifying/sprint session dates that did not exist in 2009) are the sentinel. Left unconverted, those columns would be read as text and look "complete".

---

### 2. The 14 tables at a glance

| # | File | Rows | Columns | Primary key | Size | Role in our project |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | `results.csv` | 26,759 | 18 | `resultId` | 1.7 MB | **The grain table.** Target, grid, status, ids |
| 2 | `races.csv` | 1,125 | 18 | `raceId` | 0.16 MB | Year, round, date, circuit link |
| 3 | `drivers.csv` | 861 | 9 | `driverId` | 0.09 MB | Birth date (age), nationality (Q2) |
| 4 | `constructors.csv` | 212 | 5 | `constructorId` | 0.02 MB | Team name (Q3) |
| 5 | `circuits.csv` | 77 | 9 | `circuitId` | 0.01 MB | Circuit name, country (Q1, Q2) |
| 6 | `qualifying.csv` | 10,494 | 9 | `qualifyId` | 0.47 MB | Qualifying position and best time (features) |
| 7 | `driver_standings.csv` | 34,863 | 7 | `driverStandingsId` | 0.88 MB | Driver points/rank (shifted to "before the race") |
| 8 | `constructor_standings.csv` | 13,391 | 7 | `constructorStandingsId` | 0.32 MB | Team points/rank (shifted) |
| 9 | `status.csv` | 139 | 2 | `statusId` | 2 KB | Why a race ended (Q1-Q3, non-start audit) |
| 10 | `sprint_results.csv` | 360 | 16 | `resultId` | 0.02 MB | Sprint leakage check only |
| 11 | `constructor_results.csv` | 12,625 | 5 | `constructorResultsId` | 0.22 MB | Key audit only |
| 12 | `seasons.csv` | 75 | 2 | `year` | 5 KB | Key audit only |
| 13 | `lap_times.csv` | 589,081 | 6 | `raceId+driverId+lap` | 17.6 MB | Key audit only (within-race, post-start) |
| 14 | `pit_stops.csv` | 11,371 | 7 | `raceId+driverId+stop` | 0.44 MB | Key audit only (post-start) |

**By role:** 6 tables feed features or the label (results, races, drivers, qualifying, driver_standings, constructor_standings); 3 feed only the three analytical questions (circuits, constructors, status; plus `drivers.nationality`); 1 is used only for the sprint check (sprint_results); **4 are audited and profiled but never joined** (lap_times, pit_stops, constructor_results, seasons). The brief says "you will need to join several of these tables", so the joins are the 6-table core plus lookups.

`lap_times` covers 1996-2024 and `pit_stops` 2011-2024 [my check], so they could not be features for 1950-2019 anyway. `constructor_standings` starts in **1958** (the Constructors' Championship began then) [my check]; that is why constructor standings are empty for 1950-1957.

---

### 3. Every table, every column

Missing % is after `\N` -> `NaN` [my check, matches the notebook's `raw_table_profile` totals]. "Used" = read by the pipeline.

#### 3.1 `results.csv` (26,759 rows, 18 columns): one row per driver per car per race
| Column | Type | Missing | Meaning | Used? |
| --- | --- | --- | --- | --- |
| `resultId` | int | 0 | Unique row id (PK); tie-breaker in dedup | yes |
| `raceId` | int | 0 | -> `races` | yes |
| `driverId` | int | 0 | -> `drivers` | yes |
| `constructorId` | int | 0 | -> `constructors` | yes |
| `number` | float | 6 cells | Car number | carried, not a feature |
| `grid` | int | 0 | Starting position after penalties; **0 = no normal grid slot** | **yes -> `grid_position`, `pit_lane_start`, `front_row`** |
| `position` | float | 40.9% | Official classified finishing place; empty if not classified | no (post-race) |
| `positionText` | text | 0 | Position as text, or a code: `R` retired, `F` failed to qualify, `W` withdrew, `D` disqualified, `E` excluded, `N` not classified | **yes: used to drop `F`** |
| `positionOrder` | int | 0 | Full ranking of every entrant, **always filled** | **yes: the target** (`<= 3`) |
| `points` | float | 0 | Championship points scored in this race | no (post-race) |
| `laps` | int | 0 | Laps completed | no (post-race) |
| `time` | text | 71.3% | Finish time or gap | no |
| `milliseconds` | float | 71.3% | Finish time in ms | no |
| `fastestLap` | float | 69.2% | Lap number of own fastest lap | no |
| `rank` | float | 68.2% | Rank of own fastest lap | no |
| `fastestLapTime` | text | 69.2% | Fastest lap time | no |
| `fastestLapSpeed` | float | 69.2% | Fastest lap speed | no |
| `statusId` | int | 0 | -> `status` (why the race ended) | Q1-Q3 and audits |

`positionText` codes in the raw file [my check]: numeric 15,808 rows; **R 8,897; F 1,368; W 336; N 190; D 151; E 9** (total 26,759). The notebook removes the **1,366** `F` rows that survive the dedup step.

The primer's three position columns: `position` (official, empty if not classified), `positionText` (text/letter code), `positionOrder` (**full ranking, always filled, our target source**).

#### 3.2 `races.csv` (1,125 rows, 18 columns): one row per Grand Prix
| Column | Missing | Meaning | Used? |
| --- | --- | --- | --- |
| `raceId` (PK) | 0 | Race id | yes |
| `year` | 0 | Season | **yes: feature `year`, split by year** |
| `round` | 0 | Race number in the season | carried; was a feature, now removed |
| `circuitId` | 0 | -> `circuits` | yes |
| `name` | 0 | Grand Prix name, e.g. "Monaco Grand Prix" | carried (race name) |
| `date` | 0 | Race date | **yes: sorting, age, form windows** |
| `time` | 65.0% | Race start time (UTC) | no |
| `url` | 0 | Wikipedia link | no |
| `fp1_date`, `fp1_time`, `fp2_date`, `fp2_time` | 92-94% | Practice sessions (only recent seasons) | no |
| `fp3_date`, `fp3_time` | 93.6%, 95.3% | Practice 3 | no |
| `quali_date`, `quali_time` | 92.0%, 94.0% | Qualifying session | no |
| `sprint_date`, `sprint_time` | 98.4%, 98.7% | Sprint session (18 sprint races exist) | sprint check only |

The 56% missing share of `races` comes entirely from the 11 session-schedule columns [my check].

#### 3.3 `drivers.csv` (861 rows, 9 columns)
`driverId` (PK) - `driverRef` (slug, e.g. `hamilton`) - `number` (**93.1% missing**; permanent number, only recent) - `code` (**87.9% missing**; 3-letter code) - `forename`, `surname` - `dob` (birth date) **(used: age)** - `nationality` **(used: Q2 home mapping)** - `url`. Gaps: only `number` and `code` (20.1% of cells), neither used. 43 distinct nationality strings.

#### 3.4 `constructors.csv` (212 rows, 5 columns)
`constructorId` (PK), `constructorRef`, `name` **(used: Q3, and carried as `constructor_name`)**, `nationality`, `url`. No gaps. A rebrand usually gets a new `constructorId` and name (Toro Rosso -> AlphaTauri -> RB).

#### 3.5 `circuits.csv` (77 rows, 9 columns)
`circuitId` (PK), `circuitRef`, `name` **(used: Q1, `circuit_name`)**, `location` (city), `country` **(used: Q2 home mapping)**, `lat`, `lng`, `alt`, `url`. No gaps. The country strings include both `"USA"` and `"United States"` (the latter only for the Las Vegas Strip circuit).

#### 3.6 `qualifying.csv` (10,494 rows, 9 columns)
| Column | Missing | Meaning | Used? |
| --- | --- | --- | --- |
| `qualifyId` | 0 | PK; dedup tie-breaker | yes |
| `raceId`, `driverId` | 0 | join keys (one qualifying row per driver per race after dedup) | yes |
| `constructorId` | 0 | team | no |
| `number` | 0 | car number | no |
| `position` | 0 | Qualifying position | **yes -> `qualifying_position`** |
| `q1` | 1.5% | Q1 lap time text, e.g. `"1:26.572"` | **yes -> best time** |
| `q2` | 44.3% | Q2 time (empty if knocked out in Q1 or old format) | yes |
| `q3` | 65.4% | Q3 time (only the top 10 in the modern format) | yes |

**Starts in 1994** (section 10). The times are text and must be parsed (`_time_to_seconds`).

#### 3.7 `driver_standings.csv` (34,863 rows) and `constructor_standings.csv` (13,391 rows)
Both: PK, `raceId`, the entity id, `points` (cumulative **after** this race), `position` (rank after this race), `positionText`, `wins`. No gaps. **We use only `points` and `position`, and only after shifting them to the next race** (section 8). Constructor standings start in 1958.

#### 3.8 `status.csv` (139 rows, 2 columns)
`statusId`, `status` ("Finished", "Disqualified", "Accident", "Collision", "Engine", "Gearbox", "+1 Lap", "Withdrew", "Did not qualify"...). Used only for Q1-Q3 and the non-starter audit (post-race information, never a feature).

#### 3.9 `sprint_results.csv` (360 rows, 16 columns)
A subset of the `results` layout (`resultId`, `raceId`, `driverId`, `constructorId`, `number`, `grid`, `position`, `positionText`, `positionOrder`, `points`, `laps`, `time`, `milliseconds`, `fastestLap`, `fastestLapTime`, `statusId`), 1.3% missing. Used only in the sprint check (cells 56-58).

#### 3.10 The four audit-only tables
- `constructor_results.csv` (12,625 rows): `constructorResultsId`, `raceId`, `constructorId`, `points`, `status` (99.9% empty).
- `seasons.csv` (75 rows): `year`, `url`. One row per season 1950-2024.
- `lap_times.csv` (589,081 rows): `raceId`, `driverId`, `lap`, `position`, `time`, `milliseconds`.
- `pit_stops.csv` (11,371 rows): `raceId`, `driverId`, `stop`, `lap`, `time`, `duration`, `milliseconds`.

They get PK/FK checks and a profile row. They are not joined because everything in them happens **after the start**.

---

### 4. How the tables connect (22 foreign keys, all verified)

```
circuits <-- races <-- results --> drivers
                |          |------> constructors
                |          '------> status
                |-- qualifying ---> drivers, constructors
                |-- driver_standings ---> drivers
                |-- constructor_standings ---> constructors
                |-- constructor_results ---> constructors
                |-- lap_times ---> drivers
                |-- pit_stops ---> drivers
                '-- sprint_results ---> drivers, constructors, status
seasons: PK only (year)
```
The 22 audited foreign keys (cell 4 `FOREIGN_KEYS`) are all `child.col -> parent.col`; `fk_audit` reports `checked` and `orphans` for each, and **every one has 0 orphans**. The 14 primary keys all have 0 null and 0 duplicate keys.

**Important:** the primary key of `results` is `resultId`, which is unique, but the **grain we need is `(raceId, driverId)`**, and that is *not* unique in the raw file (85 groups). So the PK audit passes while the grain audit fails; that is exactly why `cleaning_eda` exists.

---

### 5. The pipeline from raw CSV to modeling table, with the rows at every step

All of this is `load_raw_tables` (cell 6), `clean_results` (cell 8) and `build_modeling_table` (cell 10), run inside `run_analysis` (cell 40).

| Step | Operation | Code | Rows after | Rows dropped |
| --- | --- | --- | --- | --- |
| 0 | Read the 14 CSVs, `\N` -> NaN | `load_raw_tables` | `results` 26,759 | 0 |
| 1 | PK/FK audit, raw profile | `audit_tables`, `raw_table_profile` | 26,759 | 0 (checks only) |
| 2 | **Resolve shared drives** | `clean_results` | 26,668 | **91** (85 groups) |
| 3 | **Remove `positionText == "F"`** | `results[results.positionText.ne("F")]` | **25,302** | **1,366** |
| 4 | Join `races` (`validate="many_to_one"`); keep years 1950-2024 | `merge`, `.between(1950, 2024)` | 25,302 | 0 (the filter drops nothing) |
| 5 | Join `drivers`, `constructors`, `circuits` (`validate="many_to_one"`) | `merge` | 25,302 | 0 |
| 6 | Derive `driver_age`, `podium`, `grid_position`, `pit_lane_start`, `front_row`, `field_size` | column assignments | 25,302 | 0 |
| 7 | Parse `q1/q2/q3` to seconds, take the best; one qualifying row per driver-race; **left-join** | `_time_to_seconds`, `merge(..., how="left", validate="one_to_one")` | 25,302 | 0 (missing qualifying stays NaN) |
| 8 | Shift standings to the next race; **left-join**; fill empty with 0 | `_previous_standings` | 25,302 | 0 |
| 9 | Sort by `date, raceId, driverId`; build form features | `shift().rolling(5)`, `cumcount` | 25,302 | 0 |
| 10 | Chronological split | `split_by_time` | 23,163 / 780 / 1,359 | 0 |

**Total dropped: 91 + 1,366 = 1,457 rows (5.4% of the raw results).** Nothing else is dropped. In particular **no row is dropped because a feature is missing**: missing values are handled later by the pipeline's median imputer, fitted on training rows only.

**The `validate=` arguments are guardrails.** `many_to_one` means "each left row matches at most one right row" (so a merge cannot silently multiply rows); `one_to_one` for qualifying means both sides are unique on the join key. If the grain were broken, pandas would raise an error instead of duplicating rows.

#### 5.1 Step 2 in detail: shared drives
Rule (cell 8): sort by `[raceId, driverId, _started (descending), positionOrder, resultId]`, where `_started = grid > 0`, then `drop_duplicates(["raceId","driverId"], keep="first")`, then `assert` uniqueness. Per row: prefer the car the driver started, then the best finish, then the smallest `resultId`. 85 groups: 79 have 2 rows, 6 have 3 rows; **79 are in the 1950s, 5 in the 1960s, 1 in the 1970s**; 21 are at the Indianapolis 500 [my check on the raw file].

#### 5.2 Step 3 in detail: the `F` rows
1,368 raw `F` rows (1,366 after dedup). By decade [my check]: 1950s 50; 1960s 75; 1970s 331; **1980s 545**; 1990s 358; 2000s 5; 2010s 4, so **90% are in the 1970s-1990s**, matching the primer's "oversized, uneven fields" point. All are in training; none in validation or test. Rule (instructor ruling): `F` is known before the race starts, so the driver never entered it; `W` (withdrew, 336 raw rows) is known only after the race and is **kept**.

#### 5.3 Step 7 in detail: qualifying
```python
for col in ["q1","q2","q3"]: qualifying[col+"_seconds"] = qualifying[col].map(_time_to_seconds)
qualifying["qualifying_time_seconds"] = qualifying[["q1_seconds","q2_seconds","q3_seconds"]].min(axis=1)
qualifying = qualifying.sort_values(["raceId","driverId","position","qualifyId"]).drop_duplicates(["raceId","driverId"])
```
`_time_to_seconds` uses the regex `(?:(\d+):)?(\d+(?:\.\d+)?)`: optional minutes, then seconds; `"1:26.572"` -> 86.572; anything unparseable -> NaN. The best of the three sessions is the minimum. The sort+drop makes sure each driver-race has one row.

#### 5.4 Step 8 in detail: standings
`driver_points_before`/`driver_rank_before` (and constructor equivalents) are the standings **after the previous race of the same season**. Rows with no previous standing (round 1, a driver's/team's first race of a season, constructors before 1958) are set to **0 points, rank 0**, not imputed.

---

### 6. What is dropped, kept and never used

#### 6.1 Rows
| Rows | Treatment | Why |
| --- | --- | --- |
| 91 shared-drive duplicates | **Dropped** | The grain must be one row per driver per race (brief) |
| 1,366 `F` rows | **Dropped** | Known before the race; the driver never entered it (instructor ruling) |
| 336 raw `W` rows (withdrew) | **Kept** | Code known only after the race (instructor ruling) |
| 87 grid-0 rows that raced (pit-lane/exceptional start) | Kept; `grid_position` = missing, `pit_lane_start` = 1 | Grid 0 is not a position |
| Retirements, accidents, disqualifications | Kept | The target is just the final classification; a DNF is simply "not a podium" |
| Rows with no qualifying record (58.6% overall, 64.0% of training) | **Kept**, imputed with a flag | Dropping them would remove two thirds of history; tested: -0.001 / -0.011 PR-AUC |
| Pre-1994 seasons | Kept | Same reason; grid is available |
| **Indianapolis 500 (1950-1960), 381 modeling rows** | **Kept, not mentioned in the notebook** | See section 11 |
| Rows outside 1950-2024 | none exist | The filter is a safety check |

#### 6.2 Columns
- **44 columns** exist in the modeling table [my check]. **Only 16 are fed to any model** (the `FEATURES` whitelist). The other 28 are identifiers, post-race result columns (kept for the label and for Q1-Q3), and descriptive context.
- **Never used for anything beyond audits:** `lap_times`, `pit_stops`, `constructor_results`, `seasons`; and from used tables, columns such as `url`, `lat/lng/alt`, `forename/surname`, `number`, `code`, `time`, `fp*`, `quali_*` session times.
- **Post-race columns that are explicitly never features:** `position`, `positionText`, `positionOrder` (target source), `points`, `laps`, `time`, `milliseconds`, `fastestLap`, `rank`, `fastestLapTime`, `fastestLapSpeed`, `statusId`.

#### 6.3 What the 44 modeling-table columns are
| Bucket | Columns | Count |
| --- | --- | --- |
| Raw result columns carried along | `resultId, raceId, driverId, constructorId, number, grid, position, positionText, positionOrder, points, laps, time, milliseconds, fastestLap, rank, fastestLapTime, fastestLapSpeed, statusId` | 18 |
| From `races` | `year`*, `round`, `date`, `circuitId`, `name` (race name) | 5 |
| Lookups for Q1-Q3 | `dob`, `driver_nationality`, `constructor_name`, `circuit_name`, `country` | 5 |
| Target and derived pre-race | `podium` (target), `driver_age`*, `grid_position`*, `pit_lane_start`*, `front_row`*, `field_size`* | 6 |
| Qualifying | `qualifying_position`*, `qualifying_time_seconds`*, `qualifying_missing`* | 3 |
| Standings | `driver_points_before`*, `driver_rank_before`*, `constructor_points_before`*, `constructor_rank_before`* | 4 |
| Form | `driver_podium_rate_5`*, `constructor_podium_rate_5`*, `driver_races_before`* | 3 |
| **Total** | (* = one of the 16 features) | **44** |

---

### 7. The target

`podium = (positionOrder <= 3).astype(int)`. `positionOrder` is the final ranking, **already reflecting post-race disqualifications and appeals** (primer), and it is never missing. 3,395 podium rows of 25,302 = **13.42%**. It is computed after dedup, so each driver-race has one label.

---

### 8. The 16 features, one by one

Pipeline for modeling: features are selected as `frame[FEATURES]`; a `Pipeline` first applies a **median imputer fitted on training rows** and then (for logistic regression and the network, not the forest) a **StandardScaler fitted on training rows**.

#### Group 1: grid (4) — known when the grid is set
| Feature | Definition | Source | Notes |
| --- | --- | --- | --- |
| `grid_position` | `results.grid` where `grid > 0`, else NaN | results | 1.1% missing (289 rows). One-feature AUC 0.119 (lower = more podiums) |
| `pit_lane_start` | 1 if `grid == 0` | results | Marks 289 rows: 202 withdrawals + 87 real pit-lane/exceptional starts. **Not a pure pit-lane flag** |
| `front_row` | 1 if `grid` is 1 or 2 | results | 2,243 rows (8.9%). AUC 0.672 |
| `field_size` | Number of rows for the race (`groupby("raceId").transform("size")`) | results | Includes `W` rows; larger in old eras (mean 23.25 in training). AUC 0.454 |

#### Group 2: qualifying (3) — known after qualifying
| Feature | Definition | Notes |
| --- | --- | --- |
| `qualifying_position` | `qualifying.position` | **Missing for 64.0% of training rows** (pre-1994 and erratic 1994-2002). AUC 0.095 on the rows that have it |
| `qualifying_time_seconds` | Best of q1/q2/q3, in seconds | 64.5% missing in training. Not comparable across circuits and eras. Contains one 1,002.64 s outlier |
| `qualifying_missing` | 1 if `qualifying_position` is NaN | Marks rows whose qualifying values are imputed. AUC 0.490 |

#### Group 3: form (3) — built only from earlier races
| Feature | Definition | Notes |
| --- | --- | --- |
| `driver_podium_rate_5` | Mean podium indicator over the driver's previous **5 starts** (`shift()` then `rolling(5, min_periods=1)`) | 3.5% missing = a driver's first race. AUC 0.810 |
| `constructor_podium_rate_5` | Same for the team, computed **per race** (both cars averaged) before shifting | 1.4% missing. Keyed by `constructorId`, so renames reset it. AUC 0.826 |
| `driver_races_before` | Number of earlier starts (`cumcount`) | How much experience / how reliable the form is. AUC 0.662 |

#### Group 4: standings (4) — "before this race"
| Feature | Definition | Notes |
| --- | --- | --- |
| `driver_points_before` | Driver points after the previous race of the season | 0 for round 1. AUC 0.755 |
| `driver_rank_before` | Driver championship rank after the previous race | 0 when no standing yet. AUC 0.265 (lower is better) |
| `constructor_points_before` | Team points after the previous race | 0 before 1958 and for round 1 |
| `constructor_rank_before` | Team rank after the previous race | 0 when none. AUC 0.259 |

#### Group 5: context (2)
| Feature | Definition | Notes |
| --- | --- | --- |
| `driver_age` | `(race date - dob) / 365.2425` years | Range 17.5-56.8. AUC 0.552 |
| `year` | Season | AUC 0.505 alone, but removing it hurts the nonlinear models (-0.012 forest, -0.021 network). The test years lie outside the training years |

**`round` was a 17th feature and was removed** after the context experiment (cell 63). The README and the old Q&A PDF still say 17.

**Why every feature is valid at the cutoff:** grid, qualifying and age are fixed before the start; form uses only earlier races; standings are moved to the next race; none of them reads the current race's result, points, status, laps, pit stops or fastest lap.

---

### 9. After the table is built: the split (cell 12)

Chronological by season: **train 1950-2019 (23,163 rows, 1,018 races), validation 2020-2021 (780, 39 races), test 2022-2024 (1,359, 68 races)**. Integrity checks (no shared race, ordered in time, both classes present) all pass. Imputer and scaler are fitted on training only. Details are in `02_cells_00-12_setup_cleaning_features_split.md`.

---

### 10. Qualifying coverage: the primer says "must be confirmed from our own copy". Confirmed.

The primer: *"We believe qualifying.csv begins in the mid-1990s, but that must be confirmed from our own copy."*

[my check on `data/raw/qualifying.csv`]: **first season with any row = 1994, last = 2024; 494 of 1,125 races have at least one qualifying row; 44 of 75 seasons have none.**

| Season | Results rows | Qualifying rows | Ratio |
| --- | --- | --- | --- |
| 1992-1993 | 478 / 412 | 0 | 0.00 |
| 1994 | 444 | 392 | 0.88 |
| 1995 | 418 | 418 | 1.00 |
| 1996 | 340 | 148 | 0.44 |
| 1997 | 376 | 220 | 0.59 |
| 1998 | 349 | 153 | 0.44 |
| 1999 | 352 | 65 | 0.18 |
| 2000 | 373 | 88 | 0.24 |
| 2001 | 374 | 22 | 0.06 |
| 2002 | 362 | 42 | 0.12 |
| 2003-2005 | 320 / 360 / 376 | same | 1.00 |

The primer's menu was "impute, fall back to grid, or restrict the training window". The project did **all three and compared them**: a missingness flag plus median imputation (the main path), grid as the broad pre-race signal that exists in every era, and a tested restriction to 1994+ rows (-0.001 for logistic regression and -0.011 for the network, so not adopted; cell 84).

---

### 11. The primer's "oddities of early F1" versus what the project does

| Primer oddity | What the raw data shows [my check] | What the notebook does | Status |
| --- | --- | --- | --- |
| **Shared drives** | 85 duplicate groups: 79 in the 1950s, 5 in 1960s, 1 in 1970s; 21 at Indy | Deterministic rule: started car, best finish, smallest `resultId` | **Covered** |
| **Qualifying-coverage drift** | Starts 1994; erratic to 2002; complete from 2003 | Coverage plot, flag, imputation, grid kept, window restriction tested | **Covered** |
| **Oversized, uneven fields** (non-qualifiers have result rows) | 1,368 raw `F` rows, 90% in 1970s-1990s; raw rows per race 28.9 in the 1980s vs 20.0 in the 2020s | `F` rows removed before features; `field_size` and `year` kept as features | **Covered** |
| **Team and driver identity drift** | Renames get new ids; some ids reused | Form keyed by `constructorId`; renames reset history; 10 team-seasons since 2014 audited (cells 65-67); driver form follows the driver | **Covered** (audit is 2014+ only) |
| **Low reliability in early decades** | Share of rows ending "Finished" or "+N Laps": 52% (1950s), 47%, 51%, 44% (1980s), 50%, 68% (2000s), 80% (2010s), 85% (2020s). Pole-sitter podium rate: 54%, 48%, 53%, 48%, 63%, 75%, 81%, 78% | No explicit reliability feature; `year` lets nonlinear models adjust for era; Q3 looks at 2014-2024 only | **Implicitly covered** by `year` and standings/form |
| **`grid == 0` is a pit-lane start ("verify in EDA")** (primer glossary) | Only 87 of 1,635 grid-0 rows are real pit-lane starts | Verified in the 8.1 audit; `F` removed, flag kept | **Covered, and the primer's guess was mostly wrong** |
| **The Indianapolis 500 (1950-1960)** | See below | **Nothing: not excluded, not mentioned** | **Gap** |

#### 11.1 The Indianapolis 500: what is in the data [my check]
- **11 races** (1950-1960), `circuitId` 19 ("Indianapolis Motor Speedway"), race name "Indianapolis 500". The same circuit id also hosts the 2000-2007 US Grands Prix on the road course, so the circuit mixes two very different races.
- **405 raw rows (381 after dedup)** = 18% of the 2,230 results rows of 1950-1960, **1.5% of the whole modeling table, 1.6% of training rows**.
- **107 distinct drivers; 103 of them appear in no other race in the dataset**; 404 of the 405 raw rows are American drivers.
- **33 constructors at Indy; 30 of them appear nowhere else** (Adams, Bromme, Christensen, Deidt, Dunn, Elder, Epperly, Ewing...); only Ferrari, Maserati and Kurtis Kraft also race elsewhere.
- **Fields of 33-55 raw rows** (the 1954 race has 55 raw / 42 modeling rows, the largest `field_size` in the data, and 1953 has 47 raw rows). Typical grid structure is very different (33 cars, no `F` rows, no qualifying data).
- **Podium rate 9.4%** vs 15.6% for the rest of 1950-1960 (bigger fields, same 3 podium places).
- **21 of the 85 shared-drive duplicate groups** are in these races. Their features look like newcomers' (0 standing points before the race, at most 11 prior starts, 28% with no driver form).

#### 11.2 Where it can matter
| Area | Effect | Size |
| --- | --- | --- |
| **Q2 (home race)** | American drivers racing the Indy 500 are counted as "home" starters | **380 of the 2,304 home rows (16.5%)** |
| **Q1 (front-row conversion)** | Circuit 19 appears with 51.4% from 37 front-row starts, mixing the 500s and the 2000-2007 road course; not in the top 10 either way | negligible for the headline answer |
| **Training** | 381 rows with unusual field sizes (33-42) and one-off constructors | 1.6% of training rows |
| **Features** | A regular driver who also raced Indy has that race inside their last-5-starts form window | tiny |
| **Evaluation** | None of these rows is in validation or test (1950-1960) | zero |

#### 11.3 I re-ran Q2 without them [my check]
I reproduced the notebook's Q2 **exactly** (OR 0.9546, 95% CI 0.8246-1.1104, 2,304 home rows, 21,815 away, 928 excluded) using the same code logic and seed, then removed the 1950-60 Indianapolis 500 rows:

| | Odds ratio | 95% CI | Home rows | Away rows |
| --- | --- | --- | --- | --- |
| Notebook (Indy kept) | 0.955 | 0.825 - 1.110 | 2,304 | 21,815 |
| Indy 500 1950-60 excluded | **0.957** | **0.802 - 1.136** | 1,924 | 21,814 |

**The conclusion is unchanged** (OR near 0.96, interval contains 1); the interval is just wider because 380 home rows were removed. I did **not** re-train the models without these rows, because scikit-learn is blocked on this machine; that experiment is a one-line filter that the team could run in the notebook environment if wanted.

#### 11.4 How to defend it if asked "did you exclude the Indy 500?"
Say it plainly:
1. "**No, we kept it, and our notebook does not discuss it.** The course primer describes it as a defensible exclusion to document, and we did not document it. That is a gap in our write-up."
2. "These are legitimate championship races with a valid podium label, they are all in the training years, and they are 1.6% of the training rows. None is in validation or test."
3. "The place it could matter is Q2, where 16.5% of the home rows are American drivers at the Indy 500. **I re-ran Q2 without them: odds ratio 0.957, CI 0.80-1.14, same conclusion.**"
4. "If we were to change the pipeline, we would exclude `circuitId == 19` for 1950-1960, document the 405 rows, and report the models with and without them."

**Do not claim** the notebook handled it, and do not claim the models are unaffected (not tested). Whether to edit the notebook is a team decision; the README says results are regenerated from the notebook, so a change needs the whole team.

---

### 12. Likely questions on data, extraction, cleaning and features

**Q1. Where is the data and how many files?**
`data/raw/`, 14 CSV files (about 22 MB), tracked by git; the notebook finds them with `locate_data` locally or in `/kaggle/input`.

**Q2. How did you extract the data?**
No scraping or API: the dataset is a static Kaggle snapshot of the Ergast F1 database. We read each CSV with `pd.read_csv(na_values=["\\N"])` into a dictionary of DataFrames and never write back to them.

**Q3. What is `\N`?**
The CSV export's placeholder for "no value" (a sentinel). If left as text it makes numeric columns text and hides missingness, so it is converted to `NaN` at load time.

**Q4. Which tables do you actually use for features?**
`results`, `races`, `drivers`, `qualifying`, `driver_standings`, `constructor_standings`. `circuits`, `constructors` and `status` are used for the three analytical questions; `sprint_results` for the sprint check; `lap_times`, `pit_stops`, `constructor_results`, `seasons` are only audited.

**Q5. Why not use `lap_times` or `pit_stops`?**
They record events during the race, so they are unavailable at the prediction cutoff (after qualifying, before the start). Using them would be leakage. (They also start in 1996 and 2011, so they could not cover most of the training period.)

**Q6. How many rows do you drop, and why?**
Exactly 1,457 of 26,759 (5.4%): 91 shared-drive duplicates to make the grain unique, and 1,366 `F` rows because those drivers never entered the race. No row is dropped for a missing feature.

**Q7. How do you handle missing values?**
Not by dropping: qualifying features get a median imputation (fitted on training only) plus a `qualifying_missing` flag; round-1 standings are set to 0 points/rank 0 because nothing has been scored yet; a driver's first-race form is NaN and imputed by the median (0); grid 0 becomes NaN plus a flag. We compared imputation against dropping columns or rows (cells 82-84).

**Q8. Why is the grain `(raceId, driverId)` and what breaks it?**
The brief says each row is one prediction: one driver entering one race. Early shared drives gave the same driver two rows in a race (85 groups), so we keep one by rule.

**Q9. What does `validate="many_to_one"` do?**
It makes pandas raise an error if a merge would match one left row to more than one right row, so a join can never silently inflate the row count.

**Q10. How many features, and which?**
16: `grid_position, pit_lane_start, front_row, field_size` (grid); `qualifying_position, qualifying_time_seconds, qualifying_missing` (qualifying); `driver_podium_rate_5, constructor_podium_rate_5, driver_races_before` (form); `driver_points_before, driver_rank_before, constructor_points_before, constructor_rank_before` (standings); `driver_age, year` (context).

**Q11. Which columns are deliberately not features and why?**
Everything known only after the race: `position`, `positionText`, `positionOrder`, `points`, `laps`, `time`, `milliseconds`, `fastestLap`, `rank`, `fastestLapTime`, `fastestLapSpeed`, `statusId`; plus ids and descriptive columns. `FEATURES` is an explicit whitelist, so nothing else can reach a model.

**Q12. Is `qualifying.csv` really missing before 1994?**
Yes. First season with any qualifying row is 1994; 494 of 1,125 races have rows; 44 of 75 seasons have none; coverage is 44%, 59%, 44%, 18%, 24%, 6%, 12% for 1996-2002 and complete from 2003 [raw file check].

**Q13. Why are there 44 columns in the modeling table but only 16 features?**
It carries the raw result columns (for the label and for Q1-Q3), identifiers, descriptive lookups, the target, and the 16 features.

**Q14. What is the sprint situation?**
18 races have `sprint_date`; `sprint_results` has 360 rows from 2021 on. We excluded sprint information from features because training has no sprint rows and the grid already carries it in 2021-22; cells 56-58.

**Q15. Did you remove the Indianapolis 500?**
No; we did not discuss it. Section 11.4 has the script and the Q2 sensitivity (OR 0.957, CI 0.80-1.14).

**Q16. Why does the URL say 1950-2020 if your data goes to 2024?**
It is the Kaggle dataset's original slug; the files themselves cover 1950-2024 (`races.csv` has 1,125 races up to 2024).

**Q17. How do you know the raw data was not modified?**
The notebook only reads it, cleaning works on copies, `data/README.md` forbids in-place edits, and the CSVs are tracked in git so any change would show in a diff.

**Q18. How would a teammate reproduce your numbers?**
Run the notebook top to bottom (cell 40 runs everything). Cell 2 locates the data. The random seed is 42 everywhere.

**Q19. How many seasons, races, drivers, constructors, circuits?**
75 seasons (1950-2024), 1,125 races, 861 drivers in `drivers.csv` (814 appear in the modeling table), 212 constructors (202 in the table), 77 circuits.

**Q20. What are the possible values of `positionText`?**
A number (finishing position) or a letter code: R retired (8,897), F failed to qualify (1,368), W withdrew (336), N not classified (190), D disqualified (151), E excluded (9) [raw file].

**Q21. What exactly is in `status`?**
139 reasons a race ended: "Finished", "+1 Lap", "Engine", "Gearbox", "Accident", "Collision", "Withdrew", "Did not qualify"... Used only for Q1-Q3 and the non-starter audit; never a feature.

**Q22. Which cells load and clean the data?**
Cell 2 (locate data), cell 6 (load, PK/FK audit, raw profile), cell 8 (time parser, `clean_results`), cell 10 (`build_modeling_table`), cell 12 (split). Results are displayed in cells 41-46.

---

### 13. Numbers to know cold

| Item | Value |
| --- | --- |
| Files | 14 CSVs in `data/raw/`, about 22 MB; `lap_times` 17.6 MB |
| Rows | results 26,759; lap_times 589,081; driver_standings 34,863; constructor_standings 13,391; constructor_results 12,625; pit_stops 11,371; qualifying 10,494; races 1,125; drivers 861; sprint_results 360; constructors 212; status 139; circuits 77; seasons 75 |
| Keys | 14 PKs, 22 FKs: 0 null, 0 duplicate, 0 orphans |
| Cleaning | 26,759 -> 26,668 (-91; 85 groups) -> 25,302 (-1,366 `F` rows); 1,457 dropped in total (5.4%) |
| Modeling table | 25,302 rows x 44 columns; 16 features; target `podium` 13.42% |
| Qualifying | first season 1994; 494 of 1,125 races; 44 of 75 seasons empty; complete from 2003; 64% of training rows lack it |
| Shared drives | 85 groups: 79 in 1950s, 5 in 1960s, 1 in 1970s; 21 at Indy |
| `F` rows | 1,368 raw / 1,366 after dedup; 90% in 1970s-1990s |
| Indy 500 1950-60 | 11 races; 405 raw / 381 modeling rows; 107 drivers (103 Indy-only); 380 of 2,304 home rows; Q2 without them OR 0.957 (0.802-1.136) |
| Splits | 23,163 / 780 / 1,359 rows |

---

<a id="part-10"></a>

## Part 10. Do renames reset a team's history? And how the notebook meets Objective 1 (Data Cleaning & Auditing)


**Written for:** the teammate who owns EDA and cleaning and must defend both at the evaluation.

**Tags.** **[notebook]** = printed in the notebook or saved in `artifacts/`. **[my check]** = I computed it with pandas on `data/raw/*.csv` or `artifacts/modeling_table.csv`; it is not in the notebook, so say "we checked this separately".

---

### Part A. Do renames reset a team's history?

#### A1. The direct answer

**It depends on the `constructorId`, not on the name. For a rename that gets a new id (most of them), yes: our constructor-form feature treats the renamed team as a brand-new team, and the course primer tells us to accept that.** The primer says: *"A 'constructor form' feature must follow constructorId, and we should accept that renames reset history."*

Three cases exist in the data:

| Case | What the dataset does | What our feature sees |
| --- | --- | --- |
| **Rename with a new id** (Toro Rosso -> AlphaTauri) | New `constructorId` | History starts **empty**; the old team's races are not linked |
| **Old id reused years later** (Aston Martin 2021 reuses the 1959-60 id) | Same `constructorId` as an unrelated earlier team | The form window **inherits the old era's races** |
| **Same id throughout** (Ferrari, McLaren, Williams, Mercedes, Red Bull) | One id | Continuous history, no issue |

#### A2. The mechanism (cell 10, `build_modeling_table`)

```python
constructor_races = (base.groupby(["constructorId", "raceId", "date"], as_index=False)
                     .podium.mean().sort_values(["constructorId", "date", "raceId"]))
constructor_races["constructor_podium_rate_5"] = constructor_races.groupby("constructorId")["podium"].transform(
    lambda s: s.shift().rolling(5, min_periods=1).mean())
```
`groupby("constructorId")` builds one sequence per id. Whatever has a different id is a different sequence, whatever it is called. The name (`constructor_name`) is never used to build a feature; it is only used to label the Q3 results.

#### A3. What the data shows for the modern rebrands [my check on `constructors.csv` and the modeling table]

| Team story | Ids and seasons in the dataset | Podiums | What the model sees |
| --- | --- | --- | --- |
| **Toro Rosso -> AlphaTauri -> RB** | Toro Rosso id 5 (2006-2019); AlphaTauri id 213 (2020-2023); RB F1 Team id 215 (2024) | 3 / 2 / 0 | Two resets (2020, 2024) |
| **Force India -> Racing Point -> Aston Martin** | Force India id 10 (2008-2018); Racing Point id 211 (2019-2020); Aston Martin id **117** (2021-2024) | 6 / 4 / 9 | A reset in 2019; in 2021 id 117 **reuses the id of the unrelated 1959-60 Aston Martin** |
| **Lotus F1 -> Renault -> Alpine** | Lotus F1 id 208 (2012-2015); Renault id **4** (1977-2020, with gaps); Alpine F1 Team id 214 (2021-2024) | 25 / 103 / 6 | Renault 2016 **reuses id 4**, so its form comes from 2011; Alpine 2021 is a new id |
| **Sauber / Alfa Romeo** | Sauber id 15 (1993-2024); Alfa Romeo id **51** (1950-2023, with gaps) | 10 / 28 | Alfa Romeo 2019 **reuses id 51**, form from 1985; Sauber 2024 resumes id 15, form from 2018 |
| **Marussia -> Manor Marussia** | Marussia id 206 (2012-2014); Manor Marussia id 209 (2015-2016) | 0 / 0 | Reset in 2015 |
| **Lotus -> Caterham** | Lotus (Malaysian) id 205 (2010-2011); Caterham id 207 (2012-2014) | 0 / 0 | Reset (pre-2014, not in the audit) |
| **Haas** | id 210 (2016-2024) | 0 | A genuinely new team in 2016 |

The notebook's own audit (`constructor_history_audit`, cells 26 and 66) lists the **ten team-seasons since 2014** where the form window is affected: Manor Marussia 2015, Haas 2016, Renault 2016 (reused), Alfa Romeo 2019 (reused), Racing Point 2019, AlphaTauri 2020, Alpine 2021, Aston Martin 2021 (reused), RB 2024, Sauber 2024 (reused).

#### A4. What is reset, and what is not

| Feature | Affected by a rename? | Why |
| --- | --- | --- |
| `constructor_podium_rate_5` | **Yes** | Keyed by `constructorId`; new id = empty history, reused id = inherited history |
| `constructor_points_before`, `constructor_rank_before` | **No** | Standings restart every season (`_previous_standings` shifts within `(constructorId, year)`), so round 1 is always 0 / rank 0 for every team |
| `driver_podium_rate_5`, `driver_points_before`, `driver_races_before`, `driver_age` | **No** | They follow the **driver** across teams. For example, a driver moving from Force India to Racing Point keeps their own form |
| Grid, qualifying, field size, year | **No** | Not team-history features |

Also: **the model never sees a team name or a team id** (no one-hot encoding, no `constructorId` feature). It only sees numbers. A "reset" simply means a team looks like one with no recent podiums.

#### A5. How big is the effect? [notebook, cells 66-67]

- Only the **first five races** of each listed season are affected (the window is 5 races), i.e. 10 driver rows per team-season (two cars x five races).
- **30 of 780 validation rows** (AlphaTauri 2020, Alpine 2021, Aston Martin 2021) and **20 of 1,359 test rows** (RB 2024, Sauber 2024).
- **None of those rows is a podium**, and `max_constructor_form` is 0 for every one. A missing form is filled with the **training median, which is 0**, so a reset team and a team with no recent podiums look the same to the model.
- Across the whole table, 324 rows have no constructor form at all, and **every one of them is a row from the very first race of one of the 202 constructor ids** (and every first-race row is missing) [my check]. After that first race, `min_periods=1` gives every id a value, built only from its own races.
- **The audit only looks at 2014 onward.** Renames and ownership changes in 1950-2013 (for example Toleman -> Benetton -> Renault, Lotus -> Caterham) are the same mechanism and affect some training rows, but the notebook does not quantify them.

#### A6. Why we did not link renamed teams (cell 67)

"Linking renamed teams would need a judgement for every case: Toro Rosso to AlphaTauri was a rebrand of the same team, but Force India to Racing Point followed a sale out of administration, and a merged history would also join eras with different owners, budgets and engines. With 50 affected validation and test rows, no podiums among them, and a feature that is already 0 for them, a hand-made mapping would add assumptions for very little effect on the evaluation. The reset stays listed as a limitation."

#### A7. Where the name does matter: Q3

In Q3 (mechanical retirements) teams are grouped by `constructor_name`, so a rebrand splits one organisation into separate bars: Toro Rosso (2014-2019) vs AlphaTauri (2020-2023) vs RB (2024), Force India vs Racing Point vs Aston Martin. Each name-era needs at least **20 starts** to be ranked. State this as a Q3 limitation.

#### A8. Questions you may get on this

**Does a rename make the team a new team?**
For our constructor-form feature, yes whenever the dataset assigns a new `constructorId` (most rebrands). It is keyed on the id, and the course primer says to accept that.

**What if the same id is used again years later?**
Then the new team inherits the old id's history: Aston Martin 2021 inherits 1959-60, Alfa Romeo 2019 inherits 1985, Renault 2016 inherits 2011, Sauber 2024 inherits 2018. In every one of those cases the inherited form window is 0 podiums, so the practical effect is again "0".

**Does it make the model wrong for a strong team that gets renamed?**
It can understate the team's recent form for up to five races (Racing Point 2019 continued a Force India team that finished 7th in the 2018 constructors' standings with 52 points [my check on `constructor_standings.csv`], but its form started empty). The driver features, which follow the driver, still carry information, and in the audited cases none of those rows was a podium.

**Why not map lineages?**
Because each case needs a judgement (rebrand vs sale vs reuse), it affects 50 evaluation rows with no podiums, and a merged history crosses owners, budgets and engines.

**Does it leak the future?**
No. A reset only removes information; it never adds information from the current or later races.

**How would you fix it properly?**
Add a hand-made `team_lineage_id` for the ~10 modern cases, compute form on that, and report results with and without the mapping.

---

### Part B. Objective 1: Data Cleaning & Auditing, bullet by bullet

You pasted the brief's Objective 1. Here is how each bullet is met, where, with evidence, tests, and what to say if pressed.

#### B0. The one-minute answer for "walk me through your cleaning"
"We load the 14 CSVs read-only and convert the `\N` sentinel to missing values. We audit all 14 primary keys and 22 foreign keys (all clean). Profiling the raw tables, we found that the primary key of `results` is unique but the required grain `(raceId, driverId)` is not: 85 shared-drive groups. We resolve them with a deterministic rule (started car, then best finish, then lowest `resultId`), which removes 91 rows. We then remove 1,366 `F` rows because those drivers never entered the race. That leaves 25,302 rows, one per driver per race. We typed the dates we use and converted qualifying lap-time strings to seconds. We compare the data before and after every step with a three-stage table and figures. Raw files are never modified."

#### B1. Bullet 1: "Initial EDA, before and after cleaning, supported with proper visualization"

| Brief says | Where | What we did |
| --- | --- | --- |
| Initial EDA | Cell 6 `raw_table_profile`; displayed in cell 42 | Per table: rows, columns, missing cells and share, columns with gaps, full-row duplicates, numeric/text counts |
| Before **and after** cleaning | Cell 14 `cleaning_eda`; cells 42-43 | Three stages (raw 26,759 rows; shared drives resolved 26,668; `F` rows removed 25,302) with rows, unique driver-races, duplicate rows, podium rate, grid-0 share, missing finish share, median grid |
| Visualization | Cell 32 helpers; cell 42 | `raw_table_profile.png`, `cleaning_before_after.png`, `qualifying_coverage.png` |
| Not manual inspection | Functions inside `run_analysis` (cell 40) | Everything is code and regenerates on Run All |
| Test | `test_cleaning_eda_quantifies_each_step_without_duplicates` | Checks the stage table |

Full detail: file 07 sections 3-5.

#### B2. Bullet 2: "Clean sentinels and apply semantic typing to dates and durations"

| Item | Where | What we did | Check |
| --- | --- | --- | --- |
| **Sentinel `\N`** | Cell 6 `load_raw_tables` | `pd.read_csv(path, na_values=["\\N"], low_memory=False)`: converted at load time in every table | `raw_table_profile` then reports real missingness (races 56%, results 25.5%...) |
| **Dates -> date objects** | Cell 10 | `races["date"] = pd.to_datetime(..., errors="coerce")`, `base["dob"] = pd.to_datetime(...)`; `sprint_date` in the sprint check (cell 28) | 0 of 1,125 race dates and 0 of 861 birth dates fail to parse [my check], so `errors="coerce"` silently loses nothing |
| **Lap-time strings -> seconds** | Cell 8 `_time_to_seconds` | Regex `(?:(\d+):)?(\d+(?:\.\d+)?)`: `"1:26.572"` -> 86.572; unparseable -> NaN. Applied to `q1`, `q2`, `q3`; the best of the three (minimum) becomes `qualifying_time_seconds` | 0 of 19,814 non-null `q1/q2/q3` strings fail the regex [my check]. Test: `test_duration_parser_handles_valid_and_missing_values` |
| **Derived duration** | Cell 10 | `driver_age = (race date - dob).dt.days / 365.2425` | Range 17.5-56.8 [my check] |

**Honest scope.** We typed the dates and durations we **use**. Other date columns (`fp1_date`, `quali_date`, `sprint_date` outside the sprint check; 92-98% missing) and other duration strings (`results.time`, `fastestLapTime`, `lap_times.time`, `pit_stops.duration`) are left as text because they are post-race, within-race, or unused. If asked "why not all of them", say: they never reach a feature, and converting them is a one-line change. The brief's own example (lap-time strings to numeric seconds) is met with the qualifying lap times.

#### B3. Bullet 3: "Exactly one row per driver per race; choose a rule and explain it"

| Brief says | Where | What we did |
| --- | --- | --- |
| `(raceId, driverId)` must be unique; check for repeats | Cell 8 `clean_results`; counted in cell 14 | Group by `(raceId, driverId)`: **85 groups, 176 rows**, in the raw `results` |
| Shared drives, mainly the 1950s | Raw check [my check] | **79 groups in the 1950s, 5 in the 1960s, 1 in the 1970s**; 79 groups of 2 rows, 6 of 3 rows |
| Choose a rule, apply it, explain | Cell 8 docstring; cell 43; README | Sort by `[raceId, driverId, started (grid>0, descending), positionOrder, resultId]` and keep the first: **(1) the car the driver started, (2) best finish, (3) smallest `resultId`**. Removes **91 rows** |
| Prove uniqueness | `assert not clean.duplicated(["raceId","driverId"]).any()`; `unique_grain: True` in the diagnostics; merges use `validate="many_to_one"`/`"one_to_one"` | After the rule: 26,668 unique pairs, 0 duplicate rows |
| Tests | `test_duplicate_rule_prefers_a_started_car_then_best_finish`, `test_randomized_duplicate_cleaning_is_deterministic_and_unique`, `test_real_modeling_table_grain_features_and_splits` | Rule, determinism and real-table grain |

**Why that rule:** the started car reflects pre-race identity (a car taken over later is not a pre-race fact); best finish is a deterministic tie-break; `resultId` makes it reproducible. **Evidence it is safe:** the podium rate moves 12.69% -> 12.73% and the median grid stays 12; only 2 of the 91 removed rows were podiums [derived from the cleaning table].

**A second dedup you may be asked about:** the qualifying table is also reduced to one row per `(raceId, driverId)` (sort by position then `qualifyId`, then `drop_duplicates`). The raw file has **0** such duplicates [my check], so it changes nothing; it is a safeguard, and the join uses `validate="one_to_one"`.

**Additional cleaning decision beyond the list:** `F` rows (1,366) removed per the instructor ruling; `W` kept. Evidence and experiment: file 07 section 6.

#### B4. Bullet 4: "PKs unique and non-null; FKs reconcile; raw immutable, cleaning on copies"

| Brief says | Where | What we did | Result |
| --- | --- | --- | --- |
| PKs unique and non-null | Cell 4 `PRIMARY_KEYS`; cell 6 `audit_tables`; cell 42 | One row per table: `rows`, `null_keys`, `duplicate_keys`. Includes the two **composite** keys (`lap_times`: raceId+driverId+lap; `pit_stops`: raceId+driverId+stop) | **14 of 14: 0 null, 0 duplicate** |
| FKs reconcile | Cell 4 `FOREIGN_KEYS` (22); cell 6; cell 42 | For each child column: `values.isin(parent_column)`; count orphans | **22 of 22: 0 orphans** (e.g. `results.driverId -> drivers.driverId`: 26,759 checked, 0 orphans) |
| Raw files immutable | Cell 6; `data/README.md` | The notebook only reads; every cleaning function works on `.copy()` | `git status data/` is clean [my check], so the CSVs are byte-identical to the committed versions |
| Test | `test_all_fourteen_tables_and_relational_keys_are_audited` | | |

**Details that show depth:**
- The FK audit uses `values = tables[child][col].dropna()`, so a null FK would be skipped rather than counted as an orphan. There are **no null FKs** in `results` [my check], so nothing is hidden.
- `races.year -> seasons.year` is **not** in the audited list. I checked it separately: 0 of 1,125 race years are missing from `seasons` [my check]. `seasons` is therefore audited for its primary key only.
- **The PK audit passing is not the end of the story:** `resultId` is unique, but the grain `(raceId, driverId)` is not (85 groups). That is why `cleaning_eda` audits the grain separately.

#### B5. "Your own exploration may turn up additional issues worth handling and documenting"

| Issue found | Handled and documented? | Where |
| --- | --- | --- |
| `F` rows (never entered) | **Yes** | Cells 44-46; instructor ruling |
| `grid == 0` is mostly not a pit-lane start | **Yes** | Cell 46 (only 87 of 1,635 are real) |
| Missing round-1 standings (imputer would invent 3 points) | **Yes** | Cells 53-55 |
| Sprint results: leakage judgement | **Yes** | Cells 56-58 |
| Renamed / reused constructor ids | **Yes** (documented, not linked) | Cells 65-67; Part A above |
| Historical qualifying-coverage drift | **Yes** | Coverage plot, flag, imputation |
| One implausible qualifying time (1,002.64 s, 1995) | **No** | Seen only as "97 SD" in cell 78 |
| **Indianapolis 500, 1950-1960** (primer's own "oddity") | **No** | See file 09 section 11 (Q2 re-run: OR 0.957, CI 0.80-1.14) |
| Dirty value `"Argentinian "` (trailing space, 9 rows) in driver nationality | **No** | Affects only Q2's mapping |
| Early races with 4-5 podium rows (shared cars) | **No** | 18 races, 1950-60; harmless for the label |

Say the first six confidently. Own the last four as "found, small, not handled".

#### B6. The Note: "EDA cannot be manual inspection"
Every EDA output is a function (`raw_table_profile`, `cleaning_eda`, `feature_eda`, `engineering_answers`, the plot helpers) that runs in `run_analysis` and writes a CSV and a PNG; the justification for each choice sits in the markdown cells (43, 46, 49, 61). That is the brief's "implementation choices along with justification, and the visualization of them".

---

### Part C. Likely evaluator questions on Part B

**C1. What is a sentinel and how did you clean it?** A placeholder that stands for "missing" but looks like data (`\N`). We converted it to `NaN` at load time with `na_values=["\\N"]`, so every table's missingness is real.

**C2. How did you type dates and durations?** `pd.to_datetime` for the race date and birth date (0 failures), and a regex parser `_time_to_seconds` for qualifying lap-time strings (0 failures in 19,814 strings), converting `"1:26.572"` to 86.572 s. We typed what we use.

**C3. Why is `(raceId, driverId)` the grain?** Each row is one prediction: "will this driver finish on the podium in this race?" Two rows for the same pair would be two predictions for one event.

**C4. How many duplicates and why do they exist?** 85 groups (176 rows), 79 in the 1950s, from shared drives where a driver took over another car and received a row for each.

**C5. Why keep the started car first?** It is the pre-race identity of the entrant; the car taken over later is not known at the cutoff.

**C6. Does your rule change the data distribution?** Barely: podium rate 12.69% -> 12.73%, median grid 12 -> 12; 2 of the 91 removed rows were podiums.

**C7. How did you verify keys?** 14 primary keys (two composite) for null and duplicate values; 22 foreign keys for orphans. All clean.

**C8. A key audit passes, but the grain is broken. How?** `resultId` is unique but `(raceId, driverId)` is not. The two are different keys; we audit both.

**C9. How do you know the raw CSVs weren't changed?** The code only reads them, `.copy()` is used for cleaning, `data/README.md` forbids editing, and `git status` on `data/` is clean.

**C10. Did your own exploration find extra issues?** Yes: `F` rows, grid 0 semantics, round-1 standings, sprints, renamed/reused constructor ids and qualifying drift were handled and documented. We also found, but did not handle, an implausible 1,002 s qualifying time and the Indianapolis 500.

**C11. Do renames reset history?** See Part A: for constructor form, yes when the id is new, and the primer tells us to accept it; only constructor form is affected; 50 evaluation rows, no podiums.

**C12. Why didn't you convert every date and duration column?** They are unused post-race or schedule columns; the brief's requirement is semantic typing where it matters for the pipeline, and our example conversions are tested.

**C13. Where is the before/after cleaning evidence?** Cell 42: the `cleaning_eda` table and `cleaning_before_after.png`; interpretation in cell 43.

**C14. What would you add?** A hand-made team lineage mapping for renames, an exclusion or flag for the Indianapolis 500 with a with/without comparison, capping the 1,002 s qualifying time, and stripping whitespace in nationality strings.

---

<a id="part-11"></a>

## Part 11. "Explanations must not be presented as causal effects": how the project handles it, and how to defend it


**Written for:** the teammate who owns EDA and the interpretation of results, preparing for the evaluation.

**Tags.** **[notebook]** = in the notebook; **[report]** = in `reports/milestone_1_analytical_report.tex` (built by `scripts/build_report.py`); **[my check]** = I computed or read it from `artifacts/` while preparing this guide.

---

### 1. The requirement and the sentence to say

The brief (Objective 6, XAI): *"Important: explanations must not be presented as causal effects. A feature being important to the model is not proof that it causes podium finishes – it only means the model relies on it to make predictions. (This distinction was a common point of confusion last year, so state it explicitly in your report.)"*

**The sentence to memorise:** "A feature's importance, weight, SHAP value or AUC tells you what the fitted model, or the past data, associates with podiums. It does not tell you what would happen to a driver's podium chance if we changed that feature."

**Project-specific example:** "Grid position is the strongest signal in every method. That does not show that moving a driver one slot forward would raise their podium chance by the model's amount, because the grid is itself a result of car and driver speed in qualifying."

---

### 2. Where the project states it (so you can quote it)

#### Notebook
| Cell | What it says | Covers |
| --- | --- | --- |
| Code comment in `engineering_answers` (cell 30) | "Compare home and away drivers within broad grid bands. This does not make the result causal, but it avoids comparing front-row and back-row starts directly." | Q2 |
| Cell 49 | "an interval spanning 1 does not establish a home advantage or disadvantage. The result remains associational rather than causal." | Q2 |
| Cell 61 | "The AUCs describe association in past races and are not causal effects." | Feature EDA |
| Cell 96 | The change from the full model "measures the group's incremental predictive contribution after training" | Ablation |
| Cell 99 | "These values describe fitted-model reliance and are **not causal effects**." (also: LIME's R-squared is only about 0.20, so its weights are "weak, unstable local evidence") | Permutation importance, SHAP, LIME |
| Cell 102 | "These weights describe what the fitted model relies on and are **not causal effects**." | Logistic regression weights and local explanation |
| Cell 106 (Limitations) | "Permutation importance, SHAP, and LIME explain associations inside fitted models, not causes of podium finishes." | All XAI |

#### Report (the brief says "state it explicitly in your report")
| Where | Wording |
| --- | --- |
| Q1-Q3 intro (line 291) | "We separate what the counts show from what we are willing to infer. None of the three answers is a causal claim." |
| Q1 (line 348) | "We cannot say that a circuit causes the conversion rate. The front row is already occupied by the fastest cars." |
| Q2 (lines 417, 420) | "The stratification is a control, not a causal model." / "This is an association, not a causal effect." |
| Feature evidence (line 765) | "The AUCs describe association in past races, not causes." |
| XAI section intro (line 1262) | "These are associations inside the fitted forest. They are not estimates of what would happen if we moved a driver up the grid." |
| Logistic coefficients (line 1303) | "The sign gives the fitted direction after all other columns are held fixed; it is not a causal effect." |
| Permutation importance (line 1383) | A negative value is read as "the forest not getting stable help from that column", "not ... evidence that the feature causes worse finishes". |
| XAI takeaway (line 1512) | "None of these values is a causal effect of starting further forward." |
| Dedicated section "What we do not want the results to be taken to say" (line 1538) | Ends: "The models are associating historical patterns. They do not tell a team what would happen if it started one place further forward." |

#### Also
- **README:** "The explanations show model reliance, **not causal effects**" (line 309) and in the limitations list (line 563).
- **UI pages:** Findings ("None of the answers is a causal claim"), Classification ("They are not causal effects"), Cases ("neither list is a causal claim"), ModelPage (the sign of `year` "is not meaningful on its own").

So the requirement is met in the notebook **and** the report, in the explicit places the brief asks for.

---

### 3. What each analysis actually measures, and what it does not

| Analysis | What it measures | What it does NOT tell you |
| --- | --- | --- |
| **Feature EDA: one-feature AUC, binned podium rates** (cells 59-61) | How well one feature alone orders podium vs non-podium rows in 1950-2019 | That the feature causes podiums; it ignores the other 15 features |
| **Q1 front-row conversion** | The share of front-row starts that finish top three, by circuit and era | That a circuit, or the front row itself, causes the result (the front row is occupied by the fastest cars) |
| **Q2 home effect: bands, exact slots, Mantel-Haenszel OR 0.955 (0.825-1.110)** | A home/away difference in podium odds among drivers from the same grid slot | A causal home advantage: stratifying by grid slot controls for one confounder only; car quality, team and driver skill are unobserved |
| **Q3 mechanical retirement rates** | Component-failure statuses per start, by constructor and era | Why reliability changed; the report itself notes the lower 2022-24 totals are "also consistent with changes in how retirements were described" |
| **Feature-group ablation** (cells 94-96) | The drop in validation PR-AUC of **logistic regression** when a feature group is removed | That the group causes podiums; correlated groups share credit |
| **Context experiment (`round`, `year`)** (cells 62-64) | Validation PR-AUC with or without a column | That the calendar causes podiums |
| **Logistic-regression coefficients** (cells 100-102) | The change in log-odds of a podium per standard deviation of a feature, **holding the other 15 features fixed in this fitted model** | A real-world effect; correlated features split credit and can flip sign |
| **Permutation importance** (random forest) | The PR-AUC drop when one validation column is shuffled | A causal effect; a negative value just means the forest got no stable help from that column |
| **SHAP** (random forest) | How far each feature moves one prediction from the forest's background value | What would happen if the feature were changed in reality |
| **LIME** (hand-written, forest) | A weighted linear fit around one row; fidelity only 0.20 | Anything global; the report calls it "weak, unstable local evidence" |

**Which model does each tool explain?** Permutation importance, SHAP and LIME explain the **random forest**. The **selected** model, logistic regression, is explained directly through its own weights (cells 100-102). Do not present the forest's explanations as an account of the logistic model.

---

### 4. Your own results prove that "importance" is model-specific reliance, not causation

Same features, three methods, very different answers [my check on `artifacts/figures/logistic_weights.csv`, `permutation_importance.csv`, `shap_global.csv`, and `feature_eda.csv`]:

| Feature | LR weight (rank by size) | Permutation, forest (rank) | Mean abs SHAP, forest (rank) | One-feature AUC (EDA) |
| --- | --- | --- | --- | --- |
| `grid_position` | -1.443 (1) | 0.098 (1) | 0.140 (1) | 0.119 |
| `pit_lane_start` | -0.631 (**2**) | 0.000 (tied with two others, about rank 11-13) | 0.00005 (**16**) | 0.494 |
| `year` | -0.356 (**3**) | 0.000 (tied with two others, about rank 11-13) | 0.034 (6) | 0.505 |
| `constructor_podium_rate_5` | +0.291 (4) | 0.0216 (2) | 0.0653 (3) | 0.826 |
| `driver_podium_rate_5` | +0.218 (8) | 0.0095 (3) | 0.0695 (2) | 0.810 |
| `constructor_rank_before` | -0.238 (7) | -0.0011 (**15**) | 0.0410 (**4**) | 0.259 |
| `qualifying_position` | -0.164 (10) | -0.0021 (**16, last**) | 0.0200 (8) | 0.095 |
| `constructor_points_before` | **-0.147** (11) | +0.0088 (4) | 0.0069 (10) | **0.724** |
| `driver_age` | **-0.185** (9) | 0.0071 (5) | 0.0038 (14) | **0.552** |

What to say about it:
- **Rank flips.** `pit_lane_start` is the second-largest logistic weight but the smallest SHAP value; `constructor_rank_before` is 4th under SHAP and 15th under permutation. If importance were causal, these could not disagree this much.
- **Sign flips versus the EDA.** `constructor_points_before` has an AUC of 0.724 on its own (more points, more podiums) but a **negative** logistic weight (-0.147). `driver_age` has AUC 0.552 (older, more podiums) but weight -0.185. The cause is overlap: points overlap with constructor rank and constructor form (Spearman 0.86 between driver and constructor points, and -0.64 between constructor form and constructor rank, where rank 1 is best [my check]); age overlaps with experience (`driver_races_before`, +0.24). A negative weight does **not** mean "more constructor points make a podium less likely".
- **`year` is not a cause.** The logistic weight is -0.356, but cell 102 and the UI both say its sign is not meaningful on its own: the test seasons lie outside the training years, and `year` absorbs how the other features change meaning across eras.
- **Negative permutation importance** (`qualifying_position` -0.002, `constructor_rank_before` -0.001) means shuffling the column slightly *improved* the forest's score on that sample. The report explicitly refuses to read that as "the feature causes worse finishes".
- **Qualifying adds only +0.006 in the ablation** even though `qualifying_position` has the strongest single-feature AUC (0.095): it repeats the grid. That is redundancy, not irrelevance and not a causal statement.

---

### 5. The causal traps in the EDA and the three questions

| Result | The tempting causal reading | The correct reading |
| --- | --- | --- |
| Podium rate falls from 47% (grid bin 1) to 0.5% (last bin) | "Starting further back makes you lose" | Grid order reflects car and driver speed; it is an association, strongly predictive, mechanism not isolated |
| Front-row conversion rose from 56.1% to 76.0% after 2014 | "The hybrid era caused it" | Descriptive; dominant teams, reliability and rules all changed together |
| Suzuka 88.9% | "Suzuka rewards the pole sitter" | 18 front-row starts (about 9 races); descriptive, and "a circuit does not cause the conversion rate" |
| Home OR 0.955 (0.825-1.110) | "Home drivers have no advantage" | "No demonstrated home advantage": the CI contains 1 and is wide; unobserved confounders remain |
| Mechanical retirement 10.1% -> 6.1% | "Cars became more reliable" | Consistent with that, and also with changes in how retirements were coded |
| `qualifying_missing` AUC 0.49 | "Missing qualifying doesn't matter" | The flag marks imputed rows, not a podium pattern |
| Grid group costs 0.025 PR-AUC in ablation | "The grid causes podiums" | Removing it costs the **linear model** predictive accuracy on 39 validation races; it measures reliance |

---

### 6. Wording watch-list: phrases in our own text that could be read as causal, and a factual slip

These are **not errors in the requirement**: every one sits next to a disclaimer. They are the phrases an evaluator might quote against you, so know the safe reading.

| Where | Phrase | Safe reading / how to say it |
| --- | --- | --- |
| Report line 1563 | "Home nationality, inside a grid band, **does not produce** a consistent extra podium rate." | "is not associated with"; descriptive. Say "we find no consistent difference" |
| Cell 64 | `year` "lets the nonlinear models **adjust for the era**: larger fields, worse reliability, and missing qualifying in the older seasons" | A plausible **hypothesis** for why dropping `year` costs the forest and network; the notebook does not test those mechanisms |
| Cells 100-102 and report | "**pushes** toward/away from a podium" | SHAP/logistic vocabulary: a push **in the fitted model's prediction**, relative to a background or the training average |
| Cell 102 | "starting further back strongly **lowers** the predicted podium probability" | Fine: it says *predicted* probability, i.e. the model's output |
| Report line 1566 | The Hamilton example: a start in fifth place "**lifted him over the cutoff**" | A statement about the model's score for that row, not about why he finished third |
| Cell 49 / `home_effect` variable | "Home-country **effect**" | "Effect" here is a statistical difference between groups, not a causal effect; the same paragraph says associational |
| Section heading "Removing the grid hurts more than removing anything else" | "hurts" | Hurts **validation PR-AUC**, which the section text states |
| Cell 102 | `grid_position` is "about **five times larger** than any other weight" | Inaccurate: -1.44 is 2.3 times the next weight (`pit_lane_start`, -0.63) and 4.0 times the third (`year`, -0.36) [my check]. Say "the largest by a wide margin" |

#### A factual slip I found while checking (not a causal one, but an evaluator may catch it)
The report says, in three places, that **permutation importance and SHAP both put constructor form second**: "constructor form second under both" (line 1512), "constructor form comes second" (line 1566), and "constructor podium rate second (0.065) ... Driver podium rate follows at 0.070" (line 1426). The report's own SHAP table contradicts this: **mean absolute SHAP is 0.0695 for `driver_podium_rate_5` and 0.0653 for `constructor_podium_rate_5`**, so under SHAP the *driver* form is second and constructor form third (a very small gap). Under permutation importance the constructor form is clearly second (0.0216 vs 0.0095). The same sentence is in `scripts/build_report.py` (lines 1999, 2085, 2223) and on the UI page `ui/src/sections/Classification.tsx` (line 159). The notebook itself does not make this claim. **Safe statement:** "Grid position is first under every method. Constructor form and driver form fill the next two places under both permutation and SHAP, in a different order." I did not edit the report; fixing it means editing `build_report.py` and regenerating, which is a team decision.

---

### 7. Likely questions and answers

**Q1. What does it mean that a feature is "important"?**
That the fitted model relies on it: removing it, shuffling it, or changing it changes the model's predictions or score. It says nothing about what would happen in the real world if the feature changed.

**Q2. Does grid position cause podium finishes?**
Our analysis cannot say. Grid position is the strongest predictor in every method, but it is itself shaped by car and driver speed (qualifying) and by penalties. The model uses it because it is informative, not because we showed it causes podiums.

**Q3. If a driver moved up one grid slot, how much would their podium probability change?**
We cannot answer that from these results. The coefficient (-1.44 per standard deviation) is a fitted-model association holding the other 15 columns fixed; the report says explicitly that these values are "not estimates of what would happen if we moved a driver up the grid".

**Q4. Your logistic model gives `constructor_points_before` a negative weight. Do constructor points hurt?**
No. On its own, constructor points have an AUC of 0.72 (more points, more podiums). The negative weight appears because the feature overlaps with constructor rank and constructor form, and the model splits the credit between correlated inputs. That is why we say weights are hard to read one at a time.

**Q5. Why do permutation importance, SHAP and the logistic weights disagree?**
They answer different questions about different models. Logistic weights are conditional linear coefficients; permutation importance measures a score drop when a column is shuffled in a forest; SHAP measures how far a feature moves predictions. Correlated features (grid with qualifying; points with rank and form; year with standings) share credit differently. Example: `pit_lane_start` is 2nd for logistic regression and 16th under SHAP.

**Q6. What does a negative permutation importance mean?**
Shuffling that column slightly improved PR-AUC on the 1,000-row validation sample (`qualifying_position` -0.002). It means the forest got no stable help from the column there, not that it causes worse finishes. The values are small and noisy.

**Q7. Is SHAP causal?**
No. SHAP attributes a model's prediction to its inputs relative to a background; it is a property of the model. The report says SHAP values are "associations inside the fitted forest".

**Q8. Why is LIME in the notebook if its R-squared is 0.20?**
The brief asks for at least one local explanation (LIME, local SHAP, or both). We implemented LIME ourselves and report its fidelity honestly: the coefficients are weak, unstable local evidence, so local SHAP and the exact logistic decomposition back it up.

**Q9. Is the ablation a causal test?**
No. It measures how much the **logistic regression's** validation PR-AUC falls when a feature group is removed, on 39 races; it is a measure of predictive contribution, and correlated groups share credit.

**Q10. Your home-effect odds ratio is 0.955. Is there no home advantage?**
We cannot demonstrate one. The 95% interval (0.825-1.110) contains 1 and is wide. Stratifying by grid slot removes one confounder; car quality, team and driver skill remain, so even a significant OR would be an association.

**Q11. Why not say the hybrid era caused higher front-row conversion?**
Because Q1 is descriptive. Conversion rose from 56% to 76%, but cars, reliability, teams and rules changed together, and the front row is occupied by the fastest cars.

**Q12. How is "association" different from "causation" in one example from your project?**
Starting grid and podium finish are strongly associated (pole position podiums about 64% of the time [my check]), but both are driven by how fast the car and driver are. Changing a driver's grid slot without changing their speed is exactly what our data cannot show.

**Q13. Where in your deliverables did you state this?**
In the notebook (cells 49, 61, 99, 102, 106) and in the report: an explicit sentence in the XAI section, in Q2, Q1 and the feature evidence, plus a dedicated section "What we do not want the results to be taken to say".

**Q14. What would it take to estimate a causal effect of grid position?**
A design that changes the grid independently of speed. One idea (not done here): grid penalties move drivers back after qualifying, so comparing drivers with the same qualifying position but different final grid slots could separate the effect of the slot from the effect of pace; it would need care because penalties correlate with car problems. We only claim prediction and association.

**Q15. Does the model "understand" why a podium happens?**
No. It uses patterns in 70 seasons of data. Its probabilities are for ranking and thresholded classification and are not formally calibrated (limitations, cell 106).

**Q16. Both logistic regression and the forest put grid first. Does agreement make it causal?**
No. Agreement across methods makes the reliance on grid robust, which is why we call it the reliable finding. It does not turn reliance into a cause.

**Q17. Someone says "year is important, so later seasons are worse for podiums".**
Wrong reading. The logistic `year` weight (-0.356) mainly absorbs how the other features change meaning over time, and the test seasons (2022-2024) lie outside the training years (1950-2019). The UI says its sign "is not meaningful on its own".

---

### 8. Revision checklist

- [ ] The one sentence: importance = model reliance, not cause (and the grid example).
- [ ] Which cells and report sections state it (cells 49, 61, 99, 102, 106; report XAI intro, Q2, Q1, features, "What we do not want the results to be taken to say").
- [ ] Which tool explains which model (permutation, SHAP, LIME = forest; coefficients = logistic regression).
- [ ] Two examples of rank or sign flips (`pit_lane_start`; `constructor_points_before`).
- [ ] Why the ablation, EDA AUCs and Q2's odds ratio are all associations.
- [ ] The wording watch-list, and the SHAP "constructor form second" slip.
- [ ] How you would pursue a causal question (penalties idea) without claiming it.
