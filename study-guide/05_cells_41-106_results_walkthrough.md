# 5. Cells 41-106: the executed results, section by section

From here the notebook stops defining and starts **showing and interpreting**. Almost every code cell is just `display(results[...])` (a table) or `display(Image(...))` (a saved PNG). For each, this file gives: **what is displayed -> how to read it -> the numbers -> what to say -> caveats.**

I checked the numbers quoted in the notebook's markdown against the saved outputs; where a claim is slightly off I say so.

---

## Section 8: Audit, cleaning, and before/after EDA (cells 41-46)  [R1a, R1c, R1d]

### Cell 41 (md)
Announces what the next cell shows: key uniqueness, null keys, orphan references, and the cleaning comparison.

### Cell 42 (code): audits + profile + cleaning + three figures

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

### Cell 43 (md): the cleaning interpretation
Two steps. **Grain fix:** 85 groups -> 91 rows removed -> exactly one row per `(raceId, driverId)`, **without moving the target** (12.69% -> 12.73%) **or the median grid** (12). **`F` removal:** 1,366 rows, none a podium, so the podium rate rises to **13.42% by arithmetic alone** and the grid-0 share falls from 6.1% to 1.1%. Qualifying coverage is sparse in old seasons, so the notebook keeps a missingness flag and uses final grid as the historically broader pre-race signal "rather than discarding early history".

### Cell 44 (md) + Cell 45 (code): "8.1 Who has grid 0?" (audit and experiment)

`display(results["non_starters"].round(3))` and `display(results["non_starter_experiment"].round(4))`.

**Audit table (4 groups):**

| Group | Treatment | Rows | Share | Grid-0 share | Podium rate | Years | In train / val / test |
| --- | --- | --- | --- | --- | --- | --- | --- |
| regular grid start | kept | 24,880 | 93.3% | 0 | 13.6% | 1950-2024 | 22,806 / 759 / 1,315 |
| grid 0 but raced (pit-lane / exceptional) | kept | 87 | 0.3% | 1.0 | 0 | 1981-2024 | 34 / 16 / 37 |
| `W` withdrew | kept ("code only known after the race") | 335 | 1.3% | 0.60 | 0 | 1950-2024 | 323 / 5 / 7 |
| `F` did not qualify / prequalify / 107% | **removed before features** | 1,366 | 5.1% | 0.985 | 0 | 1952-2012 | 1,366 / 0 / 0 |

**Experiment table (4 variants x 2 models, same 780 validation rows):** PR-AUC changes vs the used choice: keep `F` rows: LR **-0.0005**, MLP **+0.0144**; keep `F` in history but drop from training only: -0.0001 / +0.0126; also drop `W` rows ("not allowed"): 0.0000 / +0.0182. Training field size: 23.25 (used) vs 25.06 with `F` rows. Training pit-lane share: 1.0% vs 6.4%.

### Cell 46 (md): "What the audit shows" / decision / evidence / what changes

- **Surprise to explain:** before the `F` step, 6.1% of rows have grid 0 and the name `pit_lane_start` suggests pit-lane starts. **They mostly are not.** Of 1,635 grid-0 rows: 1,346 are `F` drivers who never raced, 202 are withdrawals, only **87** are genuine pit-lane or exceptional starts (1,346 + 202 + 87 = 1,635 ✓).
- **Decision (instructor ruling):** remove `F` (known before the race; the driver never entered it, so the row isn't "one driver entering one race"); keep `W` (code only known after the race; grid 0 may also be a real pit-lane start). `F` rows are removed **before any feature is built**, so a skipped weekend doesn't count as a race in `driver_podium_rate_5` or `driver_races_before`, and doesn't inflate `field_size`.
- **Evidence it's safe:** logistic regression moves <=0.0005; the network's ~0.014 is inside seed noise (a single seed sits up to 0.021 from its 3-seed mean). **"The choice rests on the ruling and on what a row means, not on a score."**
- **What changes:** `pit_lane_start` now marks **289** rows (202 `W` + 87 real) and is "still not a pure pit-lane flag".

---

## Section 9: Answers to the three data-engineering questions (cells 47-49)  [R2]

### Cell 48 (code)
Loops over `results["answers"]` printing each table (top 10 per era for tables with an `era` column), then prints the mechanical and non-start status lists, then shows four figures: `front_row_conversion`, `home_effect`, `home_effect_exact_grid`, `mechanical_retirements`.

**Q1 (front-row conversion):** see file 04 for the table. One-line answer: **front-row conversion jumps from 56.1% (1950-2013) to 76.0% (2014-2024); the best circuits change** (Magny-Cours 80.6% / Istanbul 78.6% / Dijon 75% pre-2014; Suzuka 88.9% / Yas Marina 86.4% / Monaco 85% since). Uses final **grid**, not qualifying position.

**Q2 (home race):** podium rate by grid band is virtually the same for home and away in every band; the **Mantel-Haenszel odds ratio is 0.955 (95% CI 0.825-1.110)**: the interval contains 1, so no demonstrated home effect. Home rows 2,304, away 21,815; 928 excluded (unmapped nationality or no grid).

**Q3 (mechanical retirements):** 2014-2021 leaders Caterham 23.5%, Lotus F1 20.0%, Toro Rosso 16.5%; 2022-2024 leaders Alfa Romeo 12.5%, Alpine 11.0%, AlphaTauri 8.0%; fleet-wide 10.1% -> 6.1% (official list) and 8.4% -> 5.6% (conservative list).

### Cell 49 (md): the three interpretations
- **Front-row conversion:** eras split at 2014; >=10 front-row starts per circuit-era; final grid defines the front row; non-starters excluded from the denominator.
- **Home-country effect:** bands + exact slot + MH odds ratio with a race-cluster bootstrap; "an interval spanning 1 does not establish a home advantage or disadvantage"; **associational, not causal**.
- **Mechanical retirements:** starters as denominator, documented component statuses as numerator, >=20 starts per constructor-era; the official list is shown beside a stricter sensitivity list; "ambiguous status coding remains a limitation, and the original Piazza export is not archived in this repository".

---

## Section 10: Leakage-safe features (cells 50-67)  [R3a, R3c]

### Cell 50 (md) / Cell 51 (code) / Cell 52 (md)
`display(FEATURE_GROUPS)` prints the 5 groups / 16 features. Cell 52 (md) is the **leakage statement**: every selected feature is known after qualifying and before the start; driver form shifts before rolling; constructor outcomes are aggregated by race before shifting; standings attach only to the following race; **current-race position, points, status, laps, pit stops and fastest-lap information never enter `FEATURES`.**

### Cells 53-55: "Standings before the first race of a season"

- **Cell 53 (md):** originally, before a driver's or team's first race of a season there were no standings, the cells were empty, and the median imputer filled them with ~3 points and rank 13 (inventing points nobody had scored). **Fix:** set them to **0 points, rank 0** when features are built, so the imputer no longer touches the standings columns.
- **Cell 54 (code):** a sanity check on the modelling table: round-1 rows have `driver_points_before == 0` and `driver_rank_before == 0` (printed `[0.]`), and **0 empty standings cells remain**.
- **Cell 55 (md):** they also tried adding flag columns to mark these rows (rank 0 could look "better than first place"); no validation gain (LR unchanged, forest and network lower), so **no flags** were added.
- **Caveat to know:** rank 0 is numerically "ahead of P1". It works because points = 0 and the rank weight is small (`driver_rank_before` coefficient -0.076).

### Cells 56-58: "10.1 Sprint races: a leakage judgement call"

- **Cell 57 (code):** `display(results["sprint_check"].round(3))`: one row per sprint season: 2021 (3 sprints, 60 rows, validation), 2022 (3, 60, test), 2023 (6, 120, test), 2024 (6, 120, test); `sprint_ends_before_race_share` = 1.0 and `days_before_race` = 1.0 in all; Spearman grid vs sprint finish 0.886 / 0.989 / 0.619 / 0.542; grid vs qualifying 0.826 / 0.723 / 0.987 / 0.963; `sprint_rows_in_training` = 0.
- **Cell 58 (md): the argument.**
  1. **Timing:** every sprint ends one day before the main race, so a sprint result *is* known before lights out: **not post-race information**.
  2. **Why still excluded:** (a) sprints exist only from 2021, so **0 training rows**: a sprint feature would be empty for everything the model learns from; (b) in 2021-2022 the sprint **set the main-race grid**, so grid features already contain it; from 2023 the sprint stopped setting the grid and would add a separate signal for only 12 weekends. So "by design, not because they leak".
  3. **The real hazard:** sprint finishing position and points sit under the same `raceId` as the main race, so a naive join by `raceId` would look harmless but mixes a *different race's* result. Standings are already moved to the next race, so sprint points reach features only through the previous round.

### Cells 59-61: "10.2 Exploratory evidence for every individual feature"  [R3a]

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

### Cells 62-64: "10.3 Calendar features: keep `year`, remove `round`"

- **Cell 63 (code):** the `context_experiment` table and a pivot of `PR-AUC_change_vs_used` by variant and model.
- **Numbers (validation PR-AUC change vs used):**

| Variant | LR | Forest | Network |
| --- | --- | --- | --- |
| put `round` back | -0.0008 | -0.0036 | +0.0003 |
| also remove `year` | +0.0006 | **-0.0123** | **-0.0212** |
| `round` back, `year` removed | -0.0012 | -0.0074 | -0.0360 |

- **Cell 64 (md):** *`round` adds nothing* (changes within the ~0.010 noise of a 3-seed average; they don't even agree in direction; the information is already in the standings, since points/rank accumulate race by race; and `round` doesn't mean the same across eras: ~8 races in the 1950s vs 24 in 2024). *`year` helps the nonlinear models* (-0.012, -0.021), because together with grid and form it lets them adjust for era (larger fields, worse reliability, missing qualifying in old seasons). **Caveat:** the test years lie outside the training years, so the models must extrapolate `year`; a tree can't, so the forest treats 2022 like 2019. *Why one seed isn't enough:* with `round`, the network's seed-42 score was 0.7443 (0.021 above its 3-seed mean 0.7232); without `round` it's 0.7166 vs 0.7228 mean; "this is why we read single-seed network differences of about 0.021 as noise throughout the notebook."

### Cells 65-67: "10.4 Team renames and reused constructor ids"

- **Cell 66 (code):** `display(results["constructor_history"])`: 10 team-seasons since 2014 flagged "new id: form starts empty" (Manor Marussia 2015, Haas 2016, Racing Point 2019, AlphaTauri 2020, Alpine 2021, RB 2024) or "reused id: form comes from YEAR" (Renault 2016 <- 2011, Alfa Romeo 2019 <- 1985, Aston Martin 2021 <- 1960, Sauber 2024 <- 2018). Each has 10 rows in its first five races, **0 podiums**, max constructor form 0.
- **Cell 67 (md):** what happens; **how much it matters** (only constructor form; standings restart each season; driver form follows the driver; 30 of 780 validation rows and 20 of 1,359 test rows affected; none a podium; an empty value is filled with the training median, which is 0, so a reset team and a team with no recent podiums look the same); **Decision:** keep ids as in the data and document the reset (merging renamed teams needs a judgement per case: e.g. Toro Rosso -> AlphaTauri was a rebrand but Force India -> Racing Point followed a sale out of administration). Listed as a limitation. (README: "Still open".)

---

## Section 11: Proper train / validation / test split (cells 68-73)  [R3b]

### Cells 69-70: split table, integrity, plot, strategy experiment

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

### Cells 71-73: "11.1 Is 2019 the right boundary? Other validation windows and uncertainty"

- **Cell 72 (code):** `split_windows` and `validation_uncertainty` (rounded).
- **Windows:** LR PR-AUC 0.716 (2014-15), 0.728 (2016-17), 0.689 (2018-19), **0.730 (2020-21, used)**; MLP 0.714, 0.740, 0.726, **0.717**. Validation podium rate 14.3-15.0%; 38-42 races each.
- **Bootstrap (39 validation races):** LR 0.730 [0.621, 0.838]; forest 0.717 [0.600, 0.832]; MLP 0.717 [0.605, 0.828]; forest minus LR **-0.013 [-0.048, +0.028]**; MLP minus LR **-0.014 [-0.040, +0.015]**.
- **Cell 73 (md) conclusions:** the score depends on which two seasons are held out (LR 0.689-0.730; MLP 0.714-0.740): **a validation score shouldn't be read as the expected test score**; each model's 95% interval is ~0.2 wide; both difference intervals include 0 => "the data do not show that any model is better than the baseline"; **keep the chronological split but report the ranking as a tie within validation uncertainty.** (Test seasons score lower: LR 0.702, MLP 0.716.)

---

## Section 12: Effect of feature engineering and preprocessing (cells 74-78)  [checklist: effect of the step on data distribution/range/values]

### Cells 75-76: "12.1 Feature-engineering steps"
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

### Cells 77-78: "12.2 Imputation and scaling"
`display(effects[...])`, `preprocessing_distributions.png`, `preprocessing_ranges.png`.
- **Cell 78 (md):** **Median imputation** writes the training median into every missing cell; qualifying position/time (64% missing) get a tall spike and their std falls ~40%; other features lose 0-1%; ranges don't change; the flag keeps the information that a value was filled. **Standardisation** gives every training feature mean 0 / std 1; ranges that differ by orders of magnitude (`constructor_points_before` 0-722 vs flags 0-1) become comparable, so neither LR's penalty nor the MLP's gradient steps are dominated by large-unit features; it is linear, so shape and order are unchanged: long right tails stay long (the 1002.6 s time lands ~97 SD out). **Fitted on training only:** validation/test means are *not* zero: `year` ~+1.7 SD, prior points ~+0.9, `field_size` ~-1.0, `qualifying_missing` ~-1.3, "the honest view of period shift ... what the model sees at deployment".

---

## Section 13: Preprocessing experiments: strategy and order (cells 79-84)  [R5b, R5c]

### Cells 80-81
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

### Cells 82-84: "13.1 Missing values: impute, drop columns, or drop rows?"
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

## Section 14: Model comparison: train, validation, unseen test (cells 85-93)  [R4, D4]

### Cells 86-87: the metrics table

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

### Cells 88-90: "14.1 Hyperparameter search and an honest improvement attempt for each model"

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

### Cells 91-93: "14.2 Does the added complexity earn its place?"

- **Cell 92 (code):** `display(results["test_uncertainty"].round(4))`: bootstrap over the **68 test races**: LR 0.702 [0.647, 0.761]; forest 0.717 [0.659, 0.778]; MLP 0.716 [0.662, 0.774]; forest minus LR **+0.0149 [-0.011, +0.046]**; MLP minus LR **+0.0134 [-0.016, +0.044]**.
- **Cell 93 (md):** the forest and network are level at the top (0.717 / 0.716), LR ~0.013 behind, but both difference intervals include zero (as do the validation ones), so **"the data do not support claiming that a more complex model is better."** Treat the three as equivalent in ranking quality and decide on other properties: LR is the baseline, easiest to explain (readable coefficients), stable across seeds, little tuning; it is nominally highest on validation PR-AUC (the selection score) so it's used for the inference demo; the forest/network are slightly higher on test, but the bootstrap puts that within noise and the **test seasons were not used to choose a model**. The non-linear models gain little because the strongest signals (grid, qualifying position, recent form) are close to **monotonic** in podium odds, which the linear model already captures. PR-AUC is primary because ~1 in 8 entrants reaches the podium; ROC-AUC is secondary.

*(Why this is a safe stance: the selection rule was fixed in advance (validation PR-AUC), complexity has to earn its place, and the intervals say there is no significant difference, so the simplest, most explainable model wins the tie.)*

---

## Section 15: Feature-group ablation (cells 94-96)  [R5a]

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

## Section 16: Global and local explainability (cells 97-102)  [R6]

### Cells 98-99: random-forest explanations

Cell 98 shows four figures (`permutation_importance`, `shap_global`, `lime_local`, `shap_local`) then three tables: `shap_global.head(12)`, `lime_local.head(12)`, `shap_local.head(12)`.

| Method | Scope | Top features |
| --- | --- | --- |
| Permutation importance (forest, 1,000 validation rows, 5 repeats) | global | `grid_position` 0.098; `constructor_podium_rate_5` 0.022; `driver_podium_rate_5` 0.010; `constructor_points_before` 0.009 |
| SHAP (TreeExplainer, 400 validation rows) | global | mean abs SHAP: `grid_position` 0.140; `driver_podium_rate_5` 0.070; `constructor_podium_rate_5` 0.065; `constructor_rank_before` 0.041; `driver_rank_before` 0.037; `year` 0.034 |
| LIME-style surrogate | local (George Russell, 2021 Dutch GP, grid 11, actual: no podium) | `grid_position` -0.076, `driver_rank_before` -0.053, `driver_podium_rate_5` +0.049, `year` -0.037; forest probability 0.152; **weighted R^2 0.203** |
| Local SHAP | local (same row) | `grid_position` -0.160, `driver_rank_before` -0.071, `constructor_rank_before` -0.060, `driver_podium_rate_5` +0.055, `year` -0.039 |

**Cell 99 (md) to say:** permutation importance = validation PR-AUC change after shuffling one feature; global SHAP = average contribution magnitude; local LIME explains one fixed validation prediction with 5,000 perturbations around that row and a distance-weighted ridge surrogate; **its weighted R^2 is only ~0.20, so its coefficients are weak, unstable local evidence rather than a faithful decomposition**; positive weights push towards a podium, negative away; local SHAP is a supplementary cross-check; correlated predictors can split importance differently across methods; these describe fitted-model reliance and are **not causal effects**.

**Key agreement:** grid position is #1 in permutation importance, SHAP, LIME, local SHAP, and the ablation. **Why the methods can disagree on the rest:** permutation importance measures score loss from breaking a feature (correlated features can compensate), SHAP shares credit among correlated features, LIME is a local linear approximation.

### Cells 100-102: "16.1 Explaining the selected model directly: logistic regression weights"

- **Cell 101 (code):** `logistic_weights.png`, the global coefficient table, `logistic_local.png`, the local decomposition table.
- **Global coefficients (per +1 training SD):** `grid_position` **-1.443**; `pit_lane_start` -0.631; `year` -0.356; `constructor_podium_rate_5` +0.291; `driver_points_before` +0.251; `driver_races_before` +0.244; `constructor_rank_before` -0.238; `driver_podium_rate_5` +0.218; `driver_age` -0.185; `qualifying_position` -0.164; `constructor_points_before` -0.147; `qualifying_missing` +0.096; `driver_rank_before` -0.076; `front_row` +0.045; `field_size` +0.040; `qualifying_time_seconds` +0.020. Intercept -1.385.
- **Local decomposition (George Russell, 2021 Dutch GP, grid 11, did not podium):** intercept -1.385 + contributions = log-odds **-1.897** -> probability **13.0%**, below the 0.625 threshold. Largest contributions: `year` **-0.603** (2021 is +1.69 SD from the training mean and the weight is negative), `driver_age` +0.232, `grid_position` +0.211 (P11 is slightly *better* than the historical average start of P12), `constructor_rank_before` -0.159, `qualifying_missing` -0.127.
- **Cell 102 (md) to say:** logistic regression is the selected model and intrinsically interpretable, so we explain it **directly from its own weights**; standardised weights are comparable; `grid_position` dominates (*precisely: 2.3x the next-largest weight and ~4-5x most others*); a pit-lane start pushes away from a podium; recent constructor form, driver points so far, experience and recent driver form push towards one; `constructor_points_before` has a small *negative* weight because it overlaps heavily with constructor rank and form (**correlated predictors split credit in ways hard to read one weight at a time**). For the local case: contributions are relative to the **average training driver (1950-2019)**; the biggest push down is `year` because 2021 is far later than the training average and the model learned a negative weight for later seasons; grid P11 pushes slightly *up* because it beats the historical average start; the forest's SHAP ranks grid position as the main negative factor, which shows each explanation depends on its model and its reference point. **Not causal.**
- **Interpretation caution (my inference):** the negative `year` weight probably reflects that, for the same grid slot and form, podiums were easier in older, less reliable eras (many cars retired), and it is conditional on the other 15 features. The notebook only says the model "learned a negative weight for later seasons".

---

## Section 17: Complete and partially missing inference (cells 103-105)  [D7]

- **Cell 104 (code):** `display(results["summary"]["inference_demos"])`.
- **Complete record:** the first 2022+ row with all 16 features = **Lewis Hamilton, 2022 Bahrain GP** (grid 5, qualifying 5, driver form 1.0, constructor form 0.7, 288 prior starts, age 37.2): probability **0.906** >= 0.625 -> predicted podium **True** (he finished 3rd). `missing_features: []`.
- **Partial record:** `{"grid_position": 3, "pit_lane_start": 0, "front_row": 0, "field_size": 20, "year": 2024}`: **11 of 16 features missing**, filled by the training-fitted imputer; probability **0.387** < 0.625 -> predicted podium **False**; `imputation_warning`: "11 of 16 features were missing and filled by the training-fitted imputer."
- **Cell 105 (md):** missing inputs are handled by the training-fitted imputer **without consulting validation or test data**; the API returns `missing_features` and an explicit `imputation_warning`, so **silent mass imputation is impossible**; the probability "demonstrates software robustness rather than a historical base rate".
- **Why 0.387 for a P3 start (my inference):** the imputer fills form with the training median (0 podiums), points 2, 40 prior starts, qualifying "missing" = 1: the model sees an unremarkable driver with a good grid slot. A grid-3 start with no history lands between "podium likely" and "unlikely", and below the 0.625 threshold.

---

## Section 18: Limitations (cell 106)

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
