# 3. Cells 13-28: models, metrics, preprocessing, feature evidence, experiments

Still only **definitions**. Each function is called once inside `run_analysis` (cell 38); results are displayed in cells 42-104. The "Where it fits" lines map to the requirement IDs in file 01.

---

## Cell 13 (md): "4. Cleaning EDA and model definitions"

"We measure the effect of cleaning, define the three comparable models, and keep threshold selection on validation data only."

## Cell 14 (code): `cleaning_eda`, `_pipeline`, `model_definitions`, `_best_threshold`, `_metrics`, `train_and_evaluate`

### `cleaning_eda(raw_results, cleaned)`: before/after cleaning (**R1a**)

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

### `_pipeline(model, scale=True, strategy="median")`: preprocessing + model in one object

```python
steps = [("imputer", SimpleImputer(strategy=strategy, fill_value=0))]
if scale: steps.append(("scaler", StandardScaler()))
return Pipeline([("preprocess", Pipeline(steps)), ("model", model)])
```
- A **Pipeline inside a Pipeline**: `preprocess` (impute, optionally scale) then `model`.
- `SimpleImputer(strategy="median")` fills each missing cell with that column's **training median**. `fill_value=0` is only used when `strategy="constant"` (the "zero + scaling" experiment); for `"median"` it is ignored.
- `StandardScaler` rescales to mean 0, std 1 (training statistics).
- **Why a Pipeline:** `.fit(X_train, y_train)` learns the medians, means, stds and model weights from training rows **only**; `.predict_proba(X_new)` re-applies the same frozen transforms. That prevents train/test contamination (a classic leakage route) and makes inference one call. `named_steps["preprocess"]` and `["model"]` let later code reach inside (SHAP, logistic weights).

### `model_definitions(random_state=42)`: the three candidate models (**R4a**)

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

### `_best_threshold(y, probability)`: threshold selection on validation only (**R4d**)

```python
candidates = np.linspace(0.05, 0.80, 151)
scores = [f1_score(y, probability >= value, zero_division=0) for value in candidates]
return float(candidates[int(np.argmax(scores))])
```
Tries 151 thresholds from 0.05 to 0.80 (step 0.005), computes F1 for each, returns the best. It is only ever called with **validation** labels/probabilities. `zero_division=0` avoids warnings when nothing is predicted positive.

### `_metrics(y, probability, threshold)`

`prediction = probability >= threshold`. Returns **ROC-AUC** and **PR-AUC** (`average_precision_score`), which use the raw probabilities and need no threshold, and **F1, precision, recall**, which use the thresholded predictions.

### `train_and_evaluate(frame, random_state=42)`

For each model: `fit` on train; `predict_proba(validation)[:, 1]` (probability of class 1 = podium); pick **that model's** threshold on validation ("each model gets its own cutoff because their probability scales differ"); then compute the five metrics on **train, validation and test** with that frozen threshold. Returns `(trained_models, metrics_table[9 rows], thresholds)`.

**Used later:** cell 86 (metrics table + `model_comparison.png`), cells 98/101 (explanations use `trained`), cell 104 (inference).

**Watch-outs:** thresholds are 0.625 (LR), 0.775 (forest), 0.455 (MLP). They differ because probability scales differ (class weighting inflates LR/forest probabilities; the MLP has none). Validation F1/precision/recall are optimistic because the threshold was tuned on that same data.

---

## Cell 15 (md): "4.1 Preprocessing evidence"

"These experiments compare imputation strategies and record how feature distributions change after imputation and scaling." Supports **R5b** and the checklist item "effect of the step on data distribution/range/values".

## Cell 16 (code): preprocessing experiments, effects and order experiments

### `preprocessing_experiments(frame)`: three strategies

Three logistic-regression pipelines scored on **validation**: `median + scaling`, `median, no scaling`, `zero + scaling` (`strategy="constant"`, fill 0). Results (cell 80): PR-AUC 0.7301 / 0.7313 / 0.7262. Differences of ~0.005: preprocessing strategy is **not the main performance lever** for logistic regression.

### `preprocessing_effects(frame)`: what imputation and scaling do to each feature

For all 16 features, **fitted on training rows**:
- `imputer = SimpleImputer(strategy="median").fit(train)`, `scaler = StandardScaler().fit(imputed)`.
- Table columns: `missing_share`, `fill_value` (= the training median, `imputer.statistics_`), raw min/max/mean/std, `imputed_mean/std`, **`std_change_from_imputation = imputed.std()/raw.std() - 1`** (filling many cells with one value shrinks spread), scaled min/max/mean/std, and **`validation_scaled_mean`, `test_scaled_mean`** (the later splits pushed through the *training-fitted* transforms).
- The inner function `later_scaled(name)` applies the training-fitted imputer and scaler to validation/test.

Key results (cell 77-78): `qualifying_position` and `qualifying_time_seconds` have 64% missing in training; the median fill makes their std fall ~40%; ranges don't change (the median lies inside the observed range); after scaling every training feature has mean 0, std 1; but validation/test means are **not** 0, for example `year` +1.67/+1.80, `field_size` -0.95, `qualifying_missing` -1.33, prior points ~+0.95/+1.30. That is the honest **period shift** the model faces.

### `feature_engineering_effects(frame, tables)`

Compares each raw source column with the feature built from it: `grid (raw)` vs `grid_position (0 -> missing)` vs `pit_lane_start`; raw `q1/q2/q3` text vs parsed seconds vs the joined `qualifying_time_seconds`; `driver_podium_rate_5 (shifted)`; `driver_points_before`. Columns: missing share, zero share, min, median, max, mean. Shows that zero-grid becomes missing and moves into a flag; that the join exposes 59% missing qualifying time across all years; that shifted form is empty on a first race. (Max `qualifying_time_seconds` 1002.64 is the typo noted earlier.)

### `_ordered_preprocessor(order)`, `PREPROCESSING_ORDERS`, `preprocessing_order_experiments` (**R5b**)

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

## Cell 17 (md) and Cell 18 (code): "4.2 Preprocessing visualisations"

Helpers that draw figures only; they do not change the data used by models. **R1a/R3, "plot the effect of the step".**

- `preprocessing_plots(frame, effects, out_dir)` writes two PNGs.
  1. `preprocessing_distributions.png`: 2x4 grid for four features (`grid_position`, `qualifying_time_seconds`, `driver_points_before`, `constructor_podium_rate_5`). **Top row:** histogram after median imputation (orange) over the raw observed values (dark), log y-axis, dashed line = training median, i.e. you see the tall spike at the median. **Bottom row:** training (scaled, centred at 0) vs validation through the same transform (shifted).
  2. `preprocessing_ranges.png`: left, raw training range (max - min, symmetric-log axis); right, range after scaling with a dot for each feature's validation mean.
  - Code notes: `np.histogram_bin_edges` forces both histograms onto the same bins; `set_yscale("log")` so the spike doesn't hide the rest; `plt.close(fig)` frees memory.
- `split_plot(frame, out_dir)`: three bar panels per season coloured by split (train/validation/test): rows, podium rate, share of missing qualifying. Shows the era shift at a glance. Saves `chronological_split.png`, displayed in cell 69.

---

## Cell 19 (md) and Cell 20 (code): "4.3 Feature evidence and ablation"

### `ablation_experiments(frame)` (**R5a**)

```python
variants = {"all features": FEATURES}
variants.update({f"without {group}": [f for f in FEATURES if f not in columns] for group, columns in FEATURE_GROUPS.items()})
```
Six variants: all features, then without each of grid / qualifying / form / standings / context. For each: build a fresh logistic pipeline, fit on **train**, score **validation** PR-AUC and ROC-AUC; `PR-AUC_change = variant - all features` (negative = the removed group was helping).

**Results (cell 95):** all features 0.7301; without grid **-0.0253**; without standings **-0.0173**; without form **-0.0165**; without qualifying **-0.0061**; without context **-0.0013**. Grid contributes most; qualifying adds little *once grid is present* (they overlap); context adds least.

**Limitations (be ready):** uses logistic regression only (not all three models); one validation window (39 races); removal measures *incremental* contribution given the other groups (correlated groups share credit); not causal.

### `_quiet(function)`: a decorator

Wraps a function in `warnings.catch_warnings()` and ignores (1) messages containing "penalty" (newer sklearn deprecates the `penalty` argument the search grid uses on purpose) and (2) `ConvergenceWarning` (the iterative imputer stopping at its iteration cap). `@functools.wraps` preserves the function's name/docstring. Purely cosmetic: it keeps hundreds of repeated warnings from burying the tables; it doesn't change results.

### `_feature_bins(values)`

If the feature has <=2 distinct values (a flag), return the values themselves. Otherwise `pd.qcut(observed.rank(method="first"), q=5, labels=False)`: **five equal-count bins**. Ranking first splits tied values (e.g. many zero form rates) across bins so every bin is populated.

### `feature_eda(frame)`: per-feature exploratory evidence (**R3a**), training rows only

For each of the 16 features (looping over `FEATURE_GROUPS`):
- `missing_share_train`, `podium_rate_when_missing`.
- Podium rate in the **lowest bin** and **highest bin**.
- **`auc_train`:** ROC-AUC using the raw feature value as the score. **>0.5 = higher value goes with more podiums; <0.5 = lower value goes with more podiums** (e.g. `grid_position` 0.12: small grid number = podium). `auc_validation`: same on validation, to check the pattern persists. `signal_strength = |AUC - 0.5| * 2`. `same_direction_in_validation`.
- Missing cells are excluded from the AUC and the bins.

### `feature_eda_panels` and `feature_eda_plot`

Build, per feature, bar heights (podium rate per bin, labelled with the bin's median value, plus an orange "missing" bar if any), then draw a **4x5 grid of 16 panels** (the last 4 axes are switched off) with the AUC and missing share in each title. Saved as `feature_eda.png` (cell 60). **Training seasons only**, so validation/test never influence feature choice.

---

## Cell 21 (md) and Cell 22 (code): "4.4 Missing-value experiments"

### `_validation_scores(train, val, features, preprocessor, random_state)`

Helper: `clone(preprocessor).fit(train[features])`, transform train and val, then for **logistic regression and the MLP** (cloned final estimators) fit and compute validation PR-AUC and ROC-AUC. Returns a nested dict.

### `missing_value_experiments(frame)` (decorated with `@_quiet`) (**R3a/R5c, trial-and-error evidence**)

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

## Cell 23 (md) and Cell 24 (code): "4.5 Hyperparameter search"

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

## Cell 25 (md) and Cell 26 (code): "4.6 Robustness and historical checks"

### `constructor_history_audit(frame)`

Constructor form is computed per `constructorId`. Renames get a **new id** (form starts empty); some old ids are **reused** years later by an unrelated team (link to a different era). The function finds, for 2014+, each team-season that starts with a brand-new id or an id unused for >=3 seasons, tags it ("new id: form starts empty" / "reused id: form comes from YEAR"), and counts how many rows fall in that season's first five races (the window length). Output (cell 66): 10 team-seasons (e.g. Haas 2016, Renault 2016, Alfa Romeo 2019, Racing Point 2019, AlphaTauri 2020, Alpine 2021, Aston Martin 2021, RB 2024, Sauber 2024); 10 rows each; **no podiums** in any; constructor form 0 or empty.

### `context_feature_experiment(frame)` (`@_quiet`)

Tests the two calendar features. Four variants: `used (no round)`, `put round back`, `also remove year`, `round back, year removed` (the last two keep/remove `year`), each trained on 1950-2019 and scored on 2020-21, **averaged over the same seeds** (3 for the network), reporting mean, std, and the seed-42 score. Outcome (cells 63-64): `round` adds nothing (changes within noise, and means different things across eras: a season had ~8 races in the 1950s, 24 in 2024), so it was removed; removing `year` hurts the nonlinear models (-0.0123 forest, -0.0212 network), so `year` stays. The **why-one-seed-is-not-enough** story: with `round`, the network's seed-42 score was 0.7443, 0.021 above its 3-seed mean.

### `split_window_experiment(frame)` (`@_quiet`)

Scores the LR and MLP on **four validation windows that all end before the test seasons**: 2014-15, 2016-17, 2018-19, 2020-21; for each, training = *all earlier seasons*. Answers "is 2019 the right boundary / is the 2020-21 choice unusual?". Result (cell 72): LR ranges 0.689-0.730 (2020-21 is the best of the four), MLP 0.714-0.740 (2020-21 is 3rd of 4). Conclusion: a ~40-race validation score moves by a few hundredths with the window, so it should not be read as the expected test score.

### `validation_uncertainty(frame, trained, n_boot=1000, split="validation")`: race-level bootstrap

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

## Cell 27 (md) and Cell 28 (code): "4.7 Sprints and recorded non-starters"

### `sprint_weekend_check(frame, tables)`: the sprint leakage judgement call

Inner-joins the modelling table to `sprint_results` on `(raceId, driverId)` and adds `sprint_date` from `races`. Per sprint season: number of sprint races, driver rows, which split the season is in, `sprint_ends_before_race_share` (is the sprint date before the race date?), `days_before_race` (median), and **Spearman** rank correlation between the main-race grid and (a) the sprint finish, (b) the qualifying position; `sprint_rows_in_training` (0). Result (cell 57-58): every sprint ends the day before the race; sprints exist only from 2021 (0 training rows); in 2021-22 the sprint set the grid (grid vs sprint finish 0.89, 0.99) so grid features already carry it; from 2023 the sprint no longer sets the grid. Decision: **excluded by design, not because it leaks**. The *real hazard* is joining by `raceId`: sprint position/points sit under the same `raceId` but are a different race's result.

### `non_starter_audit(frame, tables)`

`frame` must be built with `drop_did_not_enter=False` (so the `F` rows are still there). Labels each row via `np.select` into four groups: `F` (did not qualify/prequalify/pass 107%), `W` (withdrew), grid-0-but-raced (pit-lane or exceptional start), regular grid start. Joins `status` for the main statuses; per group: treatment (kept/removed), rows, share, grid-zero share, podium rate, first/last year, rows in train/validation/test. Output (cell 45): regular 24,880 rows kept; grid-0 but raced 87 kept; `W` 335 kept; `F` 1,366 removed (1952-2012, all in training, 0 podiums).

### `non_starter_experiment(with_f, frame)` (`@_quiet`)

Scores four variants on the same 780 validation rows: **drop `F` rows before features (used)**; keep `F` in history and training; keep `F` in history but drop from training only; also drop `W` rows ("not allowed" by the ruling). Result (cell 45-46): logistic regression moves at most 0.0005; the network up to 0.0144 (inside seed noise). Conclusion: **the decision rests on the ruling and on what a row means (one driver entering one race), not on a score.**
