# 8. EDA question bank: every question an evaluator could ask, with an answer

**Written for:** the EDA owner, rehearsing out loud for the oral evaluation.

**How to use.** Read the question, answer aloud *before* reading the sample, then compare. Tags: **[notebook]** = the number or statement is in the notebook; **[my check]** = I computed it from `artifacts/modeling_table.csv` while preparing, so say "we checked this separately"; **[not in files]** = the repo cannot answer it, so say so instead of guessing. Background and derivations are in `07_EDA_owner_guide.md` (called "guide" below).

**Answer style that works:** (1) the answer in one sentence, (2) the number or figure that supports it, (3) the limitation or "this is association, not causation" when it is relevant. If you do not know, say what the notebook does show and what it does not. The checklist says "an AI tool suggested it" is not a justification, so always give the *project-specific reason*.

Sections: A big picture and the brief - B initial EDA - C cleaning EDA - D qualifying coverage - E grid 0, `F`, `W` - F feature EDA - G leakage and "past races only" - H Q1 - I Q2 - J Q3 - K statistics concepts - L test-set hygiene - M curveballs and "what would you change" - O the primer's early-F1 oddities, the Indianapolis 500 and the raw files - N quick navigation.

---

## A. Big picture and the brief

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

## B. Initial EDA on the raw tables

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

## C. Cleaning EDA

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

## D. Qualifying coverage

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

## E. Grid 0, `F` rows, `W` rows

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

## F. Feature-level EDA

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

## G. Leakage and "why form uses past races only"

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

## H. Question 1: front-row conversion

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

## I. Question 2: home-country effect

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

## J. Question 3: mechanical retirements

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

## K. Statistics concepts you may be asked to explain

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

## L. Test-set hygiene: "did you look at the test set during EDA?"

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

## M. Curveballs and "what would you change?"

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

## O. The primer's "oddities of early F1", the Indianapolis 500, and the raw data

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

## N. If asked "show me where": quick navigation

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
