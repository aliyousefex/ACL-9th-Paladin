# 7. EDA owner's guide: every piece of EDA, explained from scratch

**Written for:** the teammate who owns EDA and must explain and defend it at the evaluation.

**How to read this.** "Cell N" is the 0-based index in the `.ipynb` (same convention as files 00-06). Numbers marked **[notebook]** are printed in the notebook or saved in `artifacts/`. Numbers marked **[my check]** I computed myself with pandas from `artifacts/modeling_table.csv` or from the raw CSVs in `data/raw/` while preparing this guide. They are *not* in the notebook, so say "I checked this separately" if you quote them. (Correction: an earlier version of this note said the raw CSVs were not in the repo. They are, in `data/raw/`; see `09_data_files_columns_cleaning_features.md` for the full catalog.) Nothing here required scikit-learn.

**Your scope.** The README's team split lists, under the EDA owner: initial EDA; data-analysis plots; the three data-engineering questions and their interpretation; exploratory evidence for feature selection and the plots of feature effects; and the explanation of why form features use past races only. This guide covers exactly that list, plus the EDA-style audits that sit next to it. The evaluator may ask you about anything else in the notebook, so also keep files 02-06 nearby.

---

## 0. The map: where the EDA lives

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

## 1. What the brief requires of EDA, and the five rules it sets

From the brief (Objective 1, Deliverable 2, Objective 3, checklist items 2-3):

1. **"Initial EDA, exploratory data analysis of the data."** Plus the hint: *"this step should be done both before and after the cleaning, where you explore the impact of the cleaning on the data."*
2. **"EDA should be supported with the proper visualization."**
3. **The note:** *"Your EDA can not be based on manual inspection and has to be supported with implementation choices along with justification of these choices, and the visualization of them."* Everything must be code, not "we looked at the CSV".
4. **Feature choices must be justified with exploratory analysis**: either a *hypothesis from earlier EDA* or *empirical trials kept in the notebook*.
5. **The three data-engineering questions**: each needs multi-hop joins (not `results.csv` alone), "the answer, a visualization of the results, and a short justification of grain, missingness, and where relevant the pre-race cutoff". The analytical report must also state **known limitations (e.g. historical qualifying-coverage drift, era sensitivity)**.

The checklist gives you a ready-made example of what the evaluator wants to hear: *"EDA showed qualifying missingness jumps before year X, so we..."*. Your qualifying-coverage plot is exactly that story (X = 1994, then 2003). Know it cold.

**One-sentence description of your EDA:** "We profile every raw table programmatically, show what each cleaning step does to the target rate and grid, show when qualifying data exists, give every one of the 16 features its own training-only evidence, and answer three business questions with multi-table joins, always saying what the denominator is and that the results are associations."

---

## 2. Concepts you need to be able to teach (EDA vocabulary)

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

## 3. Stage 1: Initial EDA on the raw tables (cells 6, 32, 42)

### 3.1 What it is for
Before touching anything, answer "what did we get?" for all 14 tables: size, missing cells, full-row duplicates, numeric vs text columns. It is the **"before"** half of the brief's before/after hint for the whole dataset, and it is **programmatic** (a function returning a DataFrame), which satisfies the "no manual inspection" rule.

### 3.2 `load_raw_tables` (cell 6), the step before the profile

| Line | Meaning | If removed/changed |
| --- | --- | --- |
| `for path in sorted(data_dir.glob("*.csv"))` | Load every CSV in the folder, alphabetical. | Missing files would go unnoticed. |
| `pd.read_csv(path, na_values=[SENTINEL], low_memory=False)` | `\N` becomes `NaN` at load time. `low_memory=False` reads the file in one pass so column types are inferred consistently (avoids mixed-type warnings). | Without `na_values`, `\N` stays as text: numeric columns become text and **the missing-share EDA would show ~0% missing, hiding the problem**. |
| `required = set(PRIMARY_KEYS) \| {...}`; raise `FileNotFoundError` | Fail early with a clear message if a table is absent. | You would get a confusing merge error later. |

Raw CSVs stay immutable: every later step works on copies (brief requirement).

### 3.3 `raw_table_profile` line by line

| Code | What it computes | Why it is there |
| --- | --- | --- |
| `numeric = frame.select_dtypes(include=np.number)` | The numeric columns | To count numeric vs text columns |
| `"rows": len(frame)`, `"columns": frame.shape[1]` | Table shape | Scale of each table |
| `"missing_cells": frame.isna().sum().sum()` | Total number of empty cells | Absolute missingness |
| `"missing_share": frame.isna().mean().mean()` | Mean of each column's missing fraction = **share of all cells that are empty** | Comparable across tables |
| `"columns_with_missing": frame.isna().any().sum()` | How many columns have at least one gap | Is the gap concentrated in one column or spread out? |
| `"duplicate_full_rows": frame.duplicated().sum()` | Rows that exactly repeat an earlier row | Detects accidental duplicated records |
| `"numeric_columns"`, `"object_columns"` | Column type counts | Dates are still text (`object`) at this stage; semantic typing comes later |

### 3.4 Results [notebook, cell 42]

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

### 3.5 How to read the figure `raw_table_profile.png`
Two horizontal bar charts sharing the same table order (sorted by row count). **Left: rows per table on a log axis** (log because `lap_times` has ~589k rows and `seasons` has 75, four orders of magnitude apart; on a linear axis everything else would be invisible). **Right: missing-cell share** (orange). Takeaways: (1) `lap_times` dwarfs everything and is not used for features (it is within-race data, post-start); (2) the tables that matter for modeling (`results`, `qualifying`, `races`, `drivers`) are exactly the ones with gaps; (3) most tables are complete.

### 3.6 What the gaps mean (and what I cannot confirm from the files)
- `races` 56% [my check on `data/raw/races.csv`; the notebook does not break it down]: it is entirely the session-schedule columns, which only exist for recent seasons: `time` (race start time) 65% missing, `fp1_date`/`fp2_date`/`quali_date` 92%, `fp1_time`/`fp2_time`/`quali_time` 94%, `fp3_date` 93.6%, `fp3_time` 95.3%, `sprint_date` 98.4%, `sprint_time` 98.7%. The 7 core columns (`raceId`, `year`, `round`, `circuitId`, `name`, `date`, `url`) are 100% complete. We do not use the schedule columns as features.
- `results` 25.5% [my check on the raw file]: `position` 40.9% (empty when not classified), `time` and `milliseconds` 71.3%, `fastestLap` and `fastestLapTime` and `fastestLapSpeed` 69.2%, `rank` 68.2%, and `number` 6 cells. These are **post-race fields** and never enter `FEATURES`, so their missingness is irrelevant to the model. The columns we need (`grid`, `positionText`, `positionOrder`, `statusId`) have **0 missing**.
- `qualifying` 12.4%: `q1` 1.5% missing, `q2` 44.3%, `q3` 65.4% (drivers knocked out early, or old single-lap formats, have no later sessions).
- `drivers` 20%: exactly two columns with gaps, `number` (93.1% missing; permanent numbers only exist from 2014) and `code` (87.9%). Neither is used.
- `constructor_results` 20%: one column, `status`, 99.9% empty (12,608 of 12,625 cells). Not used.

### 3.7 Limitations of this stage (say these before the evaluator does)
1. `missing_share` is an average over columns: it tells you *how much* is missing, not *which column*. We did not produce a per-column missingness table.
2. It profiles size, missingness and duplicates only. It does **not** show distributions of numeric columns (no histograms of grid, ages, lap counts) and no correlation matrix. The distribution-level evidence is in the feature EDA (Stage 5) and in the preprocessing distribution figures (Stage 8).
3. The "before and after" for *all tables* is not done; the after-cleaning comparison focuses on `results` (the grain table). That is reasonable because the cleaning actions only touch `results`/the modeling table.

---

## 4. Stage 2: Cleaning before/after EDA (cells 8, 14, 32, 42, 43)

### 4.1 What cleaning does (needed to understand the EDA)
`clean_results` (cell 8): finds `(raceId, driverId)` pairs that appear more than once (**85 groups**; on the raw file [my check], 79 are in the 1950s, 5 in the 1960s, 1 in the 1970s; 79 groups have 2 rows and 6 have 3 rows; 21 of them are in the Indianapolis 500), and keeps one row each using the rule **(1) the car the driver actually started (`grid > 0`), (2) best `positionOrder`, (3) smallest `resultId`**. The sort puts the preferred row first in each group; `drop_duplicates(keep="first")` keeps it; an `assert` proves the grain is now unique. This removes **91 rows** (176 rows were in duplicate groups, 176 - 85 = 91).

Then `build_modeling_table` removes the **1,366 `positionText == "F"` rows** (drivers who did not qualify, prequalify or pass the 107% rule), per the instructor ruling. `W` rows (withdrew) are kept.

### 4.2 `cleaning_eda` line by line (cell 14)

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

### 4.3 The numbers [notebook, cell 42 / `cleaning_eda.csv`]

| Stage | Rows | Unique pairs | Duplicate rows | Podium rate | Grid-0 share | Missing finish | Median grid |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Raw results | 26,759 | 26,668 | **176** | 12.69% | 6.12% | 0 | 12 |
| Shared drives resolved | 26,668 | 26,668 | **0** | 12.73% | 6.13% | 0 | 12 |
| Modeling table (F removed) | 25,302 | 25,302 | 0 | **13.42%** | **1.14%** | 0 | 12 |

### 4.4 The arithmetic that proves the story [my check, derived from the table]
Rate x rows gives the counts, and they reconcile exactly:

- **Podium rows:** 3,397 (raw) -> 3,395 (after dedup) -> 3,395 (after `F` removal). So deduplication removed **2 podium rows** out of 91, and `F` removal removed **0**.
- **Grid-0 rows:** 1,638 -> 1,635 -> 289. Dedup removed 3; `F` removal removed **1,346**.
- Hence the podium rate rises from 12.73% to 13.42% **only because the denominator shrank** (3,395 / 26,668 = 12.73%; 3,395 / 25,302 = 13.42%). No podium was lost, so no real podium information changed.

This is the clean answer when asked "why did your target rate change?": *it is arithmetic, not distortion.*

### 4.5 How to read `cleaning_before_after.png`
- **Left panel ("Grain at each cleaning stage")**: two bars per stage, `rows` and `unique_driver_races`. In the raw stage the two bars differ slightly (duplicates); after dedup they are equal. The visible lesson is "bars become equal"; the 91-row difference is only ~0.3% so it is hard to see by eye. (That is a weakness of the plot, not of the data; the table has the exact numbers.)
- **Right panel ("Rates affected by row selection")**: grouped by measure, colored by stage. `podium_rate` bars are almost identical for stages 1-2 and a bit higher for stage 3; `pit_lane_share` is flat for stages 1-2 and collapses at stage 3; `missing_finish_share` is zero (nothing visible). That last measure is a **sanity check** that finishing order is never missing, not a finding.

### 4.6 Why the dedup rule is defensible
- **Started car first (`grid > 0`)**: a shared-drive driver can appear twice (two cars in one race). The car the driver *started from the grid* reflects pre-race identity; a car taken over later is not a pre-race fact.
- **Then best `positionOrder`**: deterministic tie-break that prefers the stronger result. This slightly favors podiums, but only 2 of the 91 removed rows were podiums, so any bias is negligible (<0.01% of rows).
- **Then lowest `resultId`**: guarantees reproducibility.
- It is rule-based and reproducible, which is what the brief asks ("choose a rule, apply it, explain why").

### 4.7 Why `F` removal and what `cleaning_eda` shows about it
`F` rows are known *before* the race (the driver did not qualify), so they are not "a driver entering a race". Removing them before features are built means a skipped weekend does not count as a race in form windows or inflate `field_size` (training mean field size 25.06 with them, 23.25 without, [notebook cell 45]). The EDA stage 3 row shows the effect: grid-0 share drops 6.1% -> 1.1%.

### 4.8 Limits
- The EDA compares *rates*, not distributions. It does not prove the full distribution of features is unchanged, only the target rate and median grid.
- "Median grid unchanged at 12" is a weak statement: the median is a robust statistic that hides changes in the tails. (It is still correct.)
- `missing_finish_share` carries no information (always 0).

---

## 5. Stage 3: Qualifying coverage by season (cells 32, 42, 43)

### 5.1 The code (first block of `_plot_analysis_results`, cell 32)
```python
coverage = frame.groupby("year").qualifying_position.apply(lambda x: x.notna().mean()).reset_index(name="coverage")
plt.figure(figsize=(10, 4)); sns.lineplot(coverage, x="year", y="coverage"); ...
```
For each season, the fraction of modeling-table rows that have a `qualifying_position` after the left join from `qualifying`. `x.notna().mean()` is "share non-missing". It is computed on the **final modeling table**, so it is the coverage the model actually sees.

### 5.2 The result [my check on the table; the plot is in the notebook]

| Seasons | Coverage | Meaning |
| --- | --- | --- |
| 1950-1993 | **0%** | No qualifying rows in the dataset at all |
| 1994 | 93.5% | Appears |
| 1995 | 100% | |
| 1996-2002 | **erratic: 44.6%, 58.8%, 44.1%, 18.5%, 23.6%, 5.9%, 11.7%** | Partial coverage, swinging by year |
| **2003 onward** | **~100%** (never below 98%) | Reliable from here |

Decade view [my check]: qualifying missing for 100% of rows in the 1950s-1980s, 64.2% in the 1990s, 26.2% in the 2000s, 0.5% in the 2010s, 0% in the 2020s.

Per split [notebook cell 69]: **training 64.0% missing, validation 0.13%, test 0%**.

### 5.3 What to say about it
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

### 5.4 Limits
- The flag `qualifying_missing` has almost no single-feature signal (AUC 0.49): rows without a qualifying record podium at about the base rate (12.9% vs 13.3%), so the flag marks *imputed rows*, not a predictive pattern. (In 1994-2002 the rates are 13.9% missing vs 12.8% present [my check]; a small difference.)
- 154 rows have a qualifying *position* but no parseable *time* [my check] (24 in 1995 and some in 2003-2005, e.g. a single-lap format), so the time feature is slightly more missing than the position (64.5% vs 64.0% in training).

---

## 6. Stage 4: "Who has grid 0?" audit (cells 44-46)

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

## 7. Stage 5: A profile of the final modeling table [my check, not in the notebook]

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

## 8. Stage 6: Feature-level EDA (cells 20, 59-61)

### 8.1 Purpose
Brief Objective 3: *"Feature choices must be justified with exploratory analysis; report the evidence"*, and the checklist's "hypothesis-driven (EDA-supported)" route. The notebook gives **every one of the 16 features its own row of evidence**, computed on **training seasons only**.

Why **training only**? Choosing features by looking at validation or test results would leak information about those sets into the design. The training seasons are the only data we are allowed to learn from. Validation AUC is shown only as a *stability check* (does the pattern persist in later seasons?), not used to select features.

### 8.2 `_feature_bins` line by line

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

### 8.3 `feature_eda` line by line

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

### 8.4 The results [notebook cell 60, `feature_eda.csv`]

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

### 8.5 How to read `feature_eda.png`
A 4x5 grid of small bar charts, 16 used and 4 blank. One panel = one feature; x-axis = its five equal-count bins labeled by the **median value inside each bin** (or the two flag values); y-axis = podium rate, fixed 0-1 in every panel so heights are comparable across panels; **orange bar** = rows where the feature is missing; title = feature, training AUC, % missing. A strong feature shows a steep staircase (`grid_position`: 47% to 0.5%; `qualifying_position` likewise); a useless one is flat (`year`, `qualifying_missing`).

### 8.6 The story (cell 61) and the facts to hold
1. **Strong single signals:** position features (`qualifying_position` 0.095 on the 36% of rows that have it, `grid_position` 0.119), then standings ranks (~0.26), recent-form rates (0.81, 0.83), standings points (0.76, 0.72); `front_row` (0.67) and `driver_races_before` (0.66) are clear but smaller. All keep the same direction on validation.
2. **Weak single signals, kept for a different reason:** `field_size` 0.45, `driver_age` 0.55, `qualifying_time_seconds` 0.45, `pit_lane_start` 0.49, `qualifying_missing` 0.49, `year` 0.50. Reasons:
   - **Qualifying time** is not comparable across circuits and eras (a 75 s lap and a 105 s lap are both normal for different tracks), so its single-feature AUC is meaningless; the model needs it *with* the rest of the row.
   - **The two flags** mark *which rows were imputed or special*. A rare flag cannot raise AUC much: `pit_lane_start` is 1 in only ~1% of rows and those rows never podium, which is a real effect but invisible to AUC.
   - **`year`**: no single-feature signal, but removing it hurts the nonlinear models (-0.012 forest, -0.021 network, cell 63), so it is kept.
   - **`field_size`/`year` on validation**: flat/constant because every 2020-21 race has 20 starters.
3. **What the evidence does not show:** a one-feature AUC ignores the other 15 features, so a weak feature can still help in combination and a strong one can add little once grid is present. Qualifying adds only +0.006 PR-AUC on top of grid (ablation, cell 95). AUCs are **association, not cause**.

### 8.7 Things to notice in the figure that the notebook does not say [my reading]
- **The rank panels peak in the *second* bin, not the first** (`driver_rank_before`: 22% in the lowest bin, ~31% in the next; `constructor_rank_before` 21% then ~31%). The lowest bin's median is 0, so it is mostly rank-0 rows ("no standings yet", which podium at roughly the base rate) mixed with genuine front-runners (ranks 1-2). Cell 55 acknowledges that rank 0 "could look better than first place". The AUC is still 0.26-0.27 because the later bins fall off monotonically.
- **The `field_size` last two bins both read "26"** because the bins are cut by rank and ties are split by row order (see 8.2).
- The plot title of each panel shows only AUC and missing share, not `signal_strength` or the validation AUC; those are in the table.

### 8.8 About correlation between features [my check; **no correlation matrix is in the notebook**]
The brief lists "plots, correlations, or experiments" as acceptable evidence. The notebook uses *plots + one-feature AUC + experiments (ablation, context experiment, missing-value experiments)* and never shows a correlation heatmap. If asked about redundancy, this is the honest answer plus numbers (Spearman, all rows):

- `grid_position` vs `qualifying_position`: **0.97**
- `driver_points_before` vs `constructor_points_before`: **0.86**
- `driver_podium_rate_5` vs `constructor_podium_rate_5`: **0.78**
- `driver_rank_before` vs `constructor_rank_before`: 0.72
- Pearson correlation with the target: qualifying position -0.49, grid position -0.44, driver form +0.47, constructor form +0.46, driver points +0.31.

So several features overlap heavily. For logistic regression that makes individual coefficients harder to interpret, but not predictions worse. The ablation (which removes whole groups) is the notebook's tool for judging overlapping features.

---

## 9. Stage 6b: Why the form features use past races only (cells 10, 51-55)

This is explicitly on your list. The rule: **every feature must be known after qualifying and before the start.** Cell 52 states it: current-race position, points, status, laps, pit stops and fastest-lap info never enter `FEATURES`.

### 9.1 Driver form: `shift` then `rolling`
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

### 9.2 Constructor form: aggregate per race, *then* shift
```python
constructor_races = base.groupby(["constructorId","raceId","date"], as_index=False).podium.mean() ...
constructor_races["constructor_podium_rate_5"] = constructor_races.groupby("constructorId")["podium"].transform(
    lambda s: s.shift().rolling(5, min_periods=1).mean())
```
A team has two cars per race. If you shifted per *row*, one car's row would see its teammate's result from the **same** race in its window. Averaging both cars into one value per (team, race) first, then shifting at race level, guarantees only earlier races are used. The result is merged back by `(constructorId, raceId)`.

### 9.3 Standings: attach to the *next* race
`_previous_standings`: a standings row is recorded **after** a race, so `shift(-1)` within `(entity, year)` moves it to the next round. Using it on the same race would leak that race's points. Consequences:
- Round-1 rows (and a driver's/team's first race of a season, and constructors before 1958 when their championship began) have **no** previous standing. These are set to **0 points and rank 0** (cell 53-54). Earlier, they were empty and the median imputer filled them with ~3 points and rank 13, "inventing points nobody has scored". Cell 54 proves it: round-1 values are `[0.]`, and **0 empty standings cells remain**.
- Flags marking those rows were tried and gave no validation gain, so they were not added (cell 55).
- Caveat: rank 0 is numerically "ahead of P1". It works because points = 0 does the real work and the rank coefficient is small (about -0.076).

### 9.4 Sprint weekends: a judgement call, not a leak (cells 56-58)
A sprint ends one day before the race (share = 1.0 in all seasons 2021-2024), so it *is* pre-race information. It is still excluded because: sprints exist only from 2021, so there are **0 training rows** with one; in 2021-22 the sprint set the grid (rank correlation 0.89 / 0.99 with the grid), so the grid features already carry it; and from 2023 it adds a separate signal for only 12 weekends. The real hazard is that sprint results sit under the **same `raceId`**, so a naive join would mix a different race's result into this race's row.

### 9.5 How the code is protected
`tests/test_pipeline.py` has leakage tests: for example, they set a race's `positionOrder` to 99 and assert the **features are unchanged** while the **label changes**. That proves the features do not read the current result.

---

## 10. Stage 7: The three data-engineering questions (cells 30, 32, 47-49)

All three live in `engineering_answers(frame, tables)` (cell 30). Common setup:

```python
status = tables["status"].set_index("statusId")["status"]
starters = frame.assign(status_text=frame.statusId.map(status))
starters = starters[~starters.status_text.isin(NON_START_STATUSES)].copy()
```
- `status` table: maps a numeric `statusId` to text ("Finished", "Engine", "Withdrew"...). **This is a multi-hop join** (results -> status), as the brief demands.
- `NON_START_STATUSES = {"Withdrew","Did not start","Did not qualify","Did not prequalify","Excluded"}`: rows that never really started are **excluded from every denominator**. Result: 25,047 starters.
- Note: `Excluded` (disqualified after the race) is included in this list, so a disqualified driver who *did* start is dropped from the question denominators even though the model table keeps them. That is a small, undocumented simplification. [my reading]

### 10.1 Q1: Which circuits convert a front-row start into a podium most often, and does that change after 2014?

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

### 10.2 Q2: Do drivers podium more often at their home-country circuit, after controlling for starting position?

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

### 10.3 Q3: Which constructors have the highest mechanical-retirement rate in 2014-2021 vs 2022-2024?

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

## 11. Stage 8: Supporting EDA-style checks (cells 56-67, 74-78)

| Check | Cell | One-line takeaway |
| --- | --- | --- |
| **Sprint check** | 57-58 | Sprints end 1 day before the race; excluded because 0 training rows and the grid already contains them. |
| **Calendar features** (`year`, `round`) | 62-64 | `round` removed (changes of -0.0008/-0.0036/+0.0003, inside noise; meaning differs across eras: ~8 races in 1950s vs 24 in 2024); `year` kept (removing it costs -0.012 forest, -0.021 network). Caveat: the test years are outside the training years, so a tree treats 2022 as 2019. |
| **Constructor renames** | 65-67 | Form is keyed by `constructorId`; renames reset form (Toro Rosso -> AlphaTauri), reused ids inherit old history (Aston Martin 2021 from 1960, Alfa Romeo 2019 from 1985). Affects 30 of 780 validation rows and 20 of 1,359 test rows, none of them podiums. Kept and documented. |
| **Feature-engineering effects** | 75-76 | Raw `grid` has 1.1% zeros (would sit "ahead of pole"); `grid_position` turns them to missing (min becomes 1); qualifying strings become seconds; joined qualifying time is missing for 59% of all rows; shifted form is missing on a driver's first race. |
| **Imputation and scaling effects** | 77-78 | Median imputation shrinks the standard deviation of the 64%-missing qualifying features by about 40% (tall spike at the median); standardisation puts features on one scale but keeps tails: **one qualifying time of 1,002.6 s lands about 97 standard deviations out.** Validation/test scaled means are not zero (`year` +1.7 SD, `field_size` -1.0 SD, `qualifying_missing` -1.3 SD), which is the honest view of period shift. |

---

## 12. Traceability: from EDA finding to decision (your "hypothesis-driven" table)

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

## 13. The weak spots of your EDA, most dangerous first

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

## 14. Numbers to know cold (EDA edition)

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

## 15. Presenting your EDA live: a 3-minute script and the cell order

**Open the notebook at Section 8 (cell 41) with cell 40 already run.**

1. **(20 s) Framing.** "Our EDA has three jobs: show what the data is and how cleaning changed it, justify the features, and answer the three questions. Everything is computed in code and saved as tables and figures."
2. **(30 s) Cell 42, raw profile.** "14 tables, `results` 26,759 rows, `lap_times` 589k. Missingness is concentrated in `races`, `results`, `qualifying`. All keys are unique and every foreign key reconciles."
3. **(40 s) Cleaning table and figure (cell 42-43).** "Three stages. Resolving 85 shared-drive groups removes 91 rows and makes the grain unique without moving the podium rate or the median grid. Removing 1,366 did-not-qualify rows lifts the podium rate to 13.4% only because none of them was a podium."
4. **(30 s) Qualifying coverage plot.** "Zero before 1994, erratic to 2002, complete from 2003: this is the coverage drift. It is why we keep a missingness flag, use grid as the broad signal, and validate on recent seasons."
5. **(30 s) Cells 44-46.** "The grid-zero audit: only 87 of 1,635 are real pit-lane starts, so we removed the did-not-enters per the ruling and kept withdrawals."
6. **(30 s) Cells 59-61, feature EDA.** "Each of the 16 features has training-only evidence: missing share, podium rate across bins, one-feature AUC and whether it holds on validation. Grid, form and standings are strong; qualifying time, age, flags are weak alone and are kept for stated reasons. It is association, not causation."
7. **(30 s) Cells 47-49.** "Q1: front-row conversion rose from 56% to 76% and the leading circuits changed. Q2: after controlling for grid slot with Mantel-Haenszel, OR 0.955 (0.825-1.110) so no demonstrated home effect. Q3: mechanical retirements fell from 10% to 6% of starts; rates for small teams are noisy and we show a stricter definition as a sensitivity."

If the evaluator interrupts, answer first and return to the next numbered step. Use file 08 for the question bank.
