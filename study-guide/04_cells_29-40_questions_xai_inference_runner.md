# 4. Cells 29-40: the three questions, plots, explanations, inference, and the runner

---

## Cell 29 (md): "5. Data-engineering questions"

"The status and nationality rules below support the three required multi-table questions." (**R2**)

## Cell 30 (code): term lists and `engineering_answers`

### The constants

| Constant | What it is | Why |
| --- | --- | --- |
| `MECHANICAL_TERMS` | Set of ~51 `status` labels counted as **mechanical failures** (Engine, Gearbox, Hydraulics, Brakes, Electrical, Power Unit, Turbo, ERS, Suspension, Tyre, Puncture, Front wing, Rear wing, Wheel, ...) | Q3 needs a mechanical vs non-mechanical grouping that the dataset doesn't supply. Comments record rulings: the instructor (Piazza @10) said to count **Tyre puncture, Fire, Safety belt** as mechanical but **not "Refuelling"**; Engine fire / Engine misfire count (engine failures); Heat shield fire is left out (TA feedback). None of those added statuses occur in 2014-2024, so Q3's result didn't change |
| `CORE_MECHANICAL_TERMS` | A **conservative** set of ~38 labels that name internal systems directly (omits wing, wheel, suspension, tyre, puncture, fire, safety belt, undertray, brake duct) | **Sensitivity analysis only**; the official answer uses `MECHANICAL_TERMS` |
| `NON_START_STATUSES` | `{"Withdrew","Did not start","Did not qualify","Did not prequalify","Excluded"}` | "Recorded non-starters": removed from descriptive denominators, because the question is about race **starts** |
| `NATIONALITY_TO_COUNTRY` | Maps 27 driver nationalities to the circuit `country` strings (e.g. "British" -> "UK", "American" -> "USA", "Monegasque" -> "Monaco") | Q2 needs nationality (a `drivers` field) comparable with the circuit country (a `circuits` field) |

### `engineering_answers(frame, tables)`: returns a dictionary of eight tables

**Setup:** `starters = frame.assign(status_text=frame.statusId.map(status))` joins the `status` table (by mapping `statusId` -> text), then drops `NON_START_STATUSES`. The modelling table itself already joined `results -> races -> circuits`, `drivers`, `constructors` (cell 10), so each question is a **multi-hop join** (**R2**: "a conclusion from `results.csv` alone is not sufficient").

#### Q1: front-row conversion by circuit and era

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

#### Q2: home advantage, controlling for starting position

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

#### Q3: mechanical-retirement rate by constructor and era

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

## Cell 31 (md) and Cell 32 (code): "5.1 Core result plots"

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

## Cell 33 (md) and Cell 34 (code): "5.2 Random-forest explanations" (**R6a, R6b**)

"Global and local SHAP plus a local LIME surrogate explain the forest from complementary reference points."

### `shap_explanations(frame, trained, out_dir)`

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

### `lime_explanation(frame, trained, out_dir, n_samples=5000)`: a hand-written LIME-style surrogate

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

## Cell 35 (md) and Cell 36 (code): "5.3 Selected logistic-model explanations"

### `logistic_explanations(frame, trained, out_dir)`: explain the *selected* model from its own weights

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

## Cell 37 (md) and Cell 38 (code): "6. Inference and end-to-end execution" (**D7, D1**)

### `predict_podium(record, model, threshold)`: the inference function

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

### `run_analysis(data_dir, out_dir)`: the whole pipeline in one call

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

## Cell 39 (md) and Cell 40 (code): "7. Run the complete pipeline"

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
