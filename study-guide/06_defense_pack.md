# 6. Defense pack

Contents: **(1)** project overview you can say aloud, **(2)** requirement-to-notebook map, **(3)** likely evaluation questions with sample answers, **(4)** revision checklist. Plus a **numbers sheet** and a few delivery tips.

Every answer follows **choice -> reason -> evidence -> limitation**. The brief says "say why each step makes sense for the F1 podium-prediction task, with evidence (plots, numbers, statistics, or experiment references)". "An AI tool suggested it" is not an answer.

---

## 0. Numbers to know cold

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

## 1. Concise overview of the project (for the introduction)

### The 30-second version

> We predict, for every driver in every Formula 1 race from 1950 to 2024, whether they will finish on the podium, using only information known after qualifying and before the race starts. We audited and cleaned the 14-table relational dataset, fixed the grain to exactly one row per driver per race, engineered 16 leakage-safe pre-race features, split the data chronologically, and compared logistic regression, a random forest and a two-layer neural network. All three rank podium finishers very well, and a race-level bootstrap shows they are statistically tied, so we selected logistic regression as the simplest, most explainable model. Grid position is the dominant signal, and our explanations describe what the models rely on, not what causes podiums.

### The 2-minute version (structure: task -> cutoff -> cleaning -> features -> split -> models -> metric -> result -> explanation -> limitations)

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

## 2. Requirement-to-notebook map

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

## 3. Likely evaluation questions, with sample answers

### A. Framing and leakage

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

### B. Data cleaning and relational integrity

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

### C. EDA and the three questions

**Q18. What does your EDA show, and how does it motivate decisions?**
A. (1) Cleaning fixes the grain without moving the target or the median grid, so it didn't distort the data. (2) Qualifying coverage is zero before 1994, erratic 1994-2002, and near-complete from 2003 ("coverage drift"), which motivated the missingness flag, median imputation, and keeping grid as the historically broader signal. (3) Per-feature EDA on training seasons shows position, form and standings features are strong, and flags/context are weak on their own.

**Q19. Q1: which circuits convert a front-row start best, and does the ranking change after 2014?**
A. We join results, races and circuits, keep final grid positions 1-2 (grid, not qualifying position, because penalties can change the start), split at 2014, and take the mean of the podium flag per circuit-era with at least 10 front-row starts. Overall conversion rises from 56.1% to 76.0%. Before 2014: Magny-Cours 80.6% (36 starts), Istanbul 78.6%, Dijon 75%. From 2014: Suzuka 88.9% (18), Yas Marina 86.4%, Monaco 85%. Caveat: samples are small and the result is descriptive (team dominance, weather and safety cars matter).

**Q20. Q2: do drivers podium more at home?**
A. We map driver nationality to the circuit country, and compare home vs away podium rates within grid bands and exact grid slots; the Mantel-Haenszel odds ratio pools across slots. The rates are nearly identical in every band and the odds ratio is 0.955 with a 95% race-cluster bootstrap interval of 0.825-1.110, which includes 1. So we find no home effect after controlling for starting position. Raw averages would be confounded because home drivers may qualify differently. Limits: incomplete one-country nationality mapping (928 rows excluded) and an interval spanning 1 doesn't prove there's no effect.

**Q21. Q3: how did you define mechanical retirement and what did you find?**
A. A race *start* whose final status is a component failure (Engine, Gearbox, Hydraulics, Brakes, Power Unit, etc., following the instructor's ruling including Tyre puncture/Fire/Safety belt, but not Refuelling). The denominator is race starters only (recorded non-starters removed); crashes and driver errors are excluded. With at least 20 starts: Caterham (23.5%) and Lotus F1 (20.0%) lead 2014-2021; Alfa Romeo (12.5%) and Alpine (11.0%) lead 2022-2024; overall 10.1% -> 6.1%. A stricter internal-systems list gives 8.4% -> 5.6%, so the conclusion holds. Limit: rules-based status mapping; renamed teams are separate rows.

### D. Features and preprocessing

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

### E. Splitting

**Q30. Why a chronological split, and why these boundaries?**
A. Deployment predicts future races from the past, so the evaluation must too. Train 1950-2019, validation 2020-21 (the most recent regime: ~20 cars, near-complete qualifying), test 2022-24 (the unseen ground-effect era). Integrity checks confirm every race is in one split and dates are strictly ordered. The instructor said the `<= 2019` boundary was only an example and had to be justified: we scored four validation windows ending before the test (2014-15 ... 2020-21) and bootstrapped the validation races.

**Q31. What would go wrong with a random split? You said random splits scored lower, so isn't that a counter-argument?**
A. A random-row split puts same-race teammates and rivals in training for 100% of held-out rows, and 98% have later seasons in training; random races removes same-race leakage but still has 100% future leakage. The random splits score *lower* because their held-out sets mix all eras, including old seasons with a lower podium rate and no qualifying; PR-AUC also depends on the base rate. So scores aren't comparable. The point is that only the chronological split answers "how well do we predict the next seasons?" with zero same-race and zero future leakage.

**Q32. Why is the training score lower than validation, and why do validation and test have a higher podium rate?**
A. Training includes 1950-1993 (no qualifying, bigger and less reliable fields, podium rate 13.3%), which is harder than modern racing. Modern fields have ~20 cars and three podium places, so ~15% of rows are podiums. Evidence: the split summary and `chronological_split.png`. For the forest it holds only because depth/leaf were limited; its first settings memorised (training 0.918 vs validation 0.696).

### F. Models, metrics and selection

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

### G. Experiments and explainability

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

### H. Inference

**Q48. Show how your inference function handles a partial record.**
A. `predict_podium(record, model, threshold)` builds a one-row table with the 16 features in order; features not supplied become missing and are filled by the Pipeline's training-fitted imputer (no validation/test data involved); it returns the probability, the thresholded decision, a list of imputed features, and a warning. Demo: Hamilton at the 2022 Bahrain GP (complete) -> 0.906, predicted podium; a record with only grid 3, front_row 0, pit_lane_start 0, field_size 20, year 2024 -> 0.387, not a podium, with 11 of 16 features disclosed as imputed. The partial prediction demonstrates robustness; the imputed values describe a typical training driver, so it's biased towards "no podium".

### I. Process, honesty, and "what if"

**Q49. Did you use the test set to make any choice?**
A. No. Preprocessing variants, ablation, model choice, thresholds and hyperparameters all use validation only. The test set is scored once after choices are frozen. Even the test bootstrap only resamples predictions that already exist. A repository test asserts validation windows never reach the test seasons.

**Q50. What would you do next?**
A. Merge renamed constructor lineages with an explicit, documented mapping; add multiple seeds for all models and rolling-origin validation across several windows; calibrate probabilities; clip or fix the 1002 s qualifying typo; test other form window lengths; consider era-specific models or replacing `year` with an era indicator to avoid extrapolation; add pre-race signals not in this dataset (practice pace, weather).

**Q51. If I ask you to remove a feature group or change a setting live, what do you do?**
A. Edit `FEATURE_GROUPS` (cell 4) or the model settings (cell 14) and re-run from there. `FEATURES` is derived from `FEATURE_GROUPS`, so every model, experiment and plot updates. Cell 40 (`run_analysis`) is the slow cell, so to save time point to the saved CSVs and figures in `artifacts/` and `OUT/figures` for the existing results.

**Q52. Who did what?** *(If asked.)* Per the README: Yahia, EDA/analytical questions/feature evidence; Rana, models/evaluation/ablation/XAI; Ali, cleaning/relational integrity/integration; Aya, preprocessing/feature engineering/splitting. "Everyone should still understand the full pipeline because the evaluator can ask anyone."

---

## 4. Revision checklist

Tick each when you can explain it **without looking** and with a number or evidence.

### Framing and leakage
- [ ] Unit, target, cutoff, and why leakage matters
- [ ] The list of forbidden columns and the `FEATURES` whitelist idea
- [ ] `shift()` before `rolling()`; race-level constructor aggregation
- [ ] Standings moved to the next race; round-1 = 0 points, rank 0 (and why not imputed)
- [ ] Why `F` rows are removed and `W` rows kept (the ruling and the caveat)

### Cleaning and integrity
- [ ] `\N` sentinel, `na_values`; semantic typing; `_time_to_seconds` regex
- [ ] PK vs FK audits; results (14 / 0 nulls / 0 duplicates; 22 / 0 orphans)
- [ ] Shared drives: why, how many (85), the 3-step rule, what changed (91 rows)
- [ ] Why `(raceId, driverId)` uniqueness is separate from `resultId` uniqueness
- [ ] `validate=` in merges; left join for qualifying
- [ ] Grid 0 meaning (1,635 rows = 1,346 `F` + 202 `W` + 87 real)
- [ ] Before/after EDA: rows, duplicates, podium rate, grid-0 share, median grid
- [ ] The 1002.6 s typo (honest limitation)

### Questions
- [ ] Q1: final grid vs qualifying; 56% -> 76%; top circuits per era; small samples
- [ ] Q2: nationality mapping; grid bands; Mantel-Haenszel OR 0.955; why interval spanning 1 isn't proof
- [ ] Q3: mechanical definition, denominator, sensitivity list, results

### Features and preprocessing
- [ ] The 16 features in 5 groups and why each is valid at the cutoff
- [ ] Feature EDA: one-feature AUC meaning; which are strong and weak; why weak ones are kept
- [ ] `round` removed, `year` kept (with numbers)
- [ ] Median imputation + flag; the 8-way missing-value experiment
- [ ] Standardisation: formula, training-only fit, why validation/test means aren't 0
- [ ] Preprocessing order experiments A, B, C
- [ ] Effects of the steps on distributions, ranges, values

### Split
- [ ] The three periods and their sizes; integrity checks; why chronological
- [ ] Random-split experiment, **including why its scores are lower**
- [ ] Why training PR-AUC < validation PR-AUC
- [ ] Alternative validation windows; the bootstrap and its width

### Models and metrics
- [ ] How LR, forest and MLP work; every setting in `model_definitions`; limitations
- [ ] `class_weight="balanced"`; uncalibrated probabilities; why thresholds differ
- [ ] Precision, recall, F1, ROC-AUC, PR-AUC; why PR-AUC primary
- [ ] Threshold selection on validation; why validation F1 is optimistic
- [ ] The full metrics table (cell 86), train vs validation vs test
- [ ] Hyperparameter search: sizes (8/9/12), the forest's memorisation story, network noise
- [ ] Why LR is selected (rule + tie + simplicity); the test bootstrap

### Experiments and XAI
- [ ] Ablation numbers and ranking; its limitations
- [ ] Permutation importance, SHAP, LIME: how each works; what each top-5 looks like
- [ ] LIME weighted R^2 = 0.20 and what to say about it; local SHAP cross-check
- [ ] Logistic coefficients and the exact local decomposition (-1.897 -> 13%)
- [ ] "Not causal" statement and why

### Inference and limitations
- [ ] `predict_podium` flow and the disclosure of imputed fields; the 0.906 and 0.387 demos
- [ ] The notebook's nine limitations plus the extra ones you'd volunteer
- [ ] Which repo documents are stale (README features, Q&A PDF): use the notebook numbers

---

## 5. Delivery tips

- **Use the structure choice -> reason -> evidence -> limitation.** If you don't remember a number, point to the cell ("cell 86 has the full table") and give the direction and rough size.
- **Don't oversell the model.** The honest, evidence-backed message is: strong ranking (ROC-AUC 0.93), models tied within noise, grid dominates, explanations are associations. The brief explicitly asks for known limitations (e.g. qualifying-coverage drift, era sensitivity) and for explanations that are not presented as causal, and the notebook already states both.
- **Know the weak spots in `00_START_HERE.md` section 4 before they do.** Volunteering a limitation with a mitigation scores better than being caught.
- **If you're asked about something you can't answer from the files** (for example, the exact Piazza wording), say that the ruling is summarised in the README and the notebook comments but the original export isn't archived in the repo, rather than guessing.
