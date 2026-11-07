# 2. Cells 0-12: setup, keys, loading, cleaning, the modelling table, the split

These cells only **define** things; nothing heavy runs until cell 40. Read them as a toolbox: each function is later called inside `run_analysis` (cell 38) and its output is displayed in cells 42-104.

For each code cell: **where it fits -> what it does -> line by line -> why this way / what if changed -> input -> output -> watch-outs.**

---

## Cell 0 (md): title and contract

States the whole project in three sentences. Memorise them, they are your opening:

- The notebook is a complete, **self-contained** Kaggle submission: it does *not* import `pipeline.py` (the same logic is kept in `src/f1podium/pipeline.py` for tests; `scripts/build_notebook.py` copies it into the notebook cells).
- **Cutoff** = after qualifying, before the race. **Unit** = one driver entering one race. **Target** = `positionOrder <= 3`.
- **PR-AUC primary** (podiums are rare), **ROC-AUC secondary**; F1/precision/recall use **thresholds chosen on validation only**.

## Cell 1 (md): "0. Kaggle setup"

Attach the public Kaggle dataset (14 CSVs), choose Run All. Raw CSVs are read, never modified. Supports **R1d (raw immutable)** and **D1 (run-all ready)**.

---

## Cell 2 (code): find the data and the output folder

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

## Cell 3 (md): "1. Imports and analytical contract"

"We begin with the libraries, feature groups, and relational keys used by every later stage." The *analytical contract* = the fixed definitions (features, keys) that every function shares.

## Cell 4 (code): imports, the feature list, the key declarations

**Where it fits:** one place that defines *what the model may see* and *what the database should satisfy*. Supports **R3a/R3c** (feature list), **R1d** (keys).

### Imports (what each library is for)

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

### The constants

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

## Cell 5 (md): "2. Loading and relational audits"

"These helpers load immutable CSVs and check every declared primary and foreign key before any joins are made."

## Cell 6 (code): `load_raw_tables`, `audit_tables`, `raw_table_profile`

**Where it fits:** **R1b** (sentinels), **R1d** (PK/FK), **R1a** (initial EDA).

### `load_raw_tables(data_dir)`

```python
for path in sorted(data_dir.glob("*.csv")):
    tables[path.stem] = pd.read_csv(path, na_values=[SENTINEL], low_memory=False)
```
- `glob("*.csv")` finds every CSV; `path.stem` = filename without extension (`results`) becomes the dictionary key.
- **`na_values=[SENTINEL]` is the sentinel handling:** any cell equal to `\N` becomes a real missing value (`NaN`) at load time. (pandas also treats empty cells and strings like `NA` as missing by default.) Without it, numeric columns containing `\N` would be read as text and could not be averaged or compared.
- `low_memory=False` reads each file in one pass so pandas infers one consistent type per column (avoids "mixed types" warnings on big files like `lap_times`).
- `required = set(PRIMARY_KEYS) | {"sprint_results", "lap_times", "pit_stops"}` then `missing = required - tables.keys()`: fail immediately with `FileNotFoundError` if a table is absent, rather than getting a confusing merge error later. (The union is redundant, those three are already in `PRIMARY_KEYS`.)
- The function *reads only*; the raw files are never written, so they stay **immutable** (**R1d**). Later functions work on `.copy()`s.

### `audit_tables(tables)`

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

### `raw_table_profile(tables)`

One row per table: rows, columns, missing cells, `missing_share` (mean of per-column missing fractions = share of cells missing), `columns_with_missing`, `duplicate_full_rows`, number of numeric and text columns. This is the **programmatic initial EDA** of **R1a**: counts and missingness, not eyeballing. Notable results (cell 42): `races` 56% of cells missing (practice/qualifying date columns that only exist for recent years), `results` 25.5%, `constructor_results` 20%, `drivers` 20%.

**Used later:** cell 38 computes them; cell 42 shows them; cell 32 plots `raw_table_profile.png` (row counts on a log scale; missing-cell share).

---

## Cell 7 (md): "2.1 Cleaning the race results"

"Qualifying durations receive numeric units, and shared-drive duplicates are resolved before the driver-race grain is built."

## Cell 8 (code): `_time_to_seconds` and `clean_results`

### `_time_to_seconds(value)` (semantic typing of durations, **R1b**)

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

### `clean_results(results)`: the shared-drive rule (**R1c**)

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

## Cell 9 (md): "2.2 Building the modelling table"

"Previous standings are shifted to the next race, while form features use only earlier starts. **This is the main leakage-control boundary.**"

## Cell 10 (code): `_previous_standings` and `build_modeling_table`

### `_previous_standings(standings, races, entity)`: leakage-safe standings (**R3c**)

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

### `build_modeling_table(tables, drop_did_not_enter=True)`: step by step

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

#### Why `shift()` before `rolling()` (the most-asked leakage question)

`s.shift()` moves each value one row *down*, so at a driver's row *i* the series holds the podium flag of row *i-1*. `rolling(5, min_periods=1).mean()` then averages up to the **five previous starts**. If `shift()` were removed, the window would include the current row's own `podium`, i.e. **the target would be inside the feature**. `min_periods=1` means "give a value as soon as one earlier race exists"; a driver's first-ever race is `NaN` (nothing before it), later imputed. The window length 5 is a design choice, not tuned.

#### Why constructors are aggregated per race before shifting

A team has two cars in the same race. If each car's row were shifted separately, the second teammate's feature could include the **first teammate's result from the same race**. So the code first takes one number per team-race (`mean` of the teammates' podium flags: 0, 0.5 or 1), then shifts and rolls over the team's previous five **races**. Merge key `[constructorId, raceId]`, `validate="many_to_one"`.

#### Why the table has 44 columns

The modelling table is a **superset**: it keeps post-race columns (`points`, `laps`, `statusId`, `positionOrder`, ...) because Q3 needs `statusId` and the target needs `positionOrder`. The leakage control is the whitelist `FEATURES`: models are only ever given those 16 columns. (Repository test `test_current_race_result_cannot_change_its_own_features` in `tests/test_pipeline.py` sets the latest race's `positionOrder` to 99 for everyone, rebuilds the table, and asserts that the 16 `FEATURES` of that race are **identical** while the `podium` label **does** change. A second test, `test_form_features_cannot_see_current_target`, asserts that each driver's and constructor's first-ever row has an empty form feature and `driver_races_before == 0`.)

**Diagnostics output (cell 40):** 26,759 raw -> 85 duplicate groups -> 26,668 -> 1,366 `F` rows removed -> **25,302** rows; `unique_grain: True`; 1950-2024.

**Assumptions/limits:** `field_size` counts every row in the race including `W` rows; `pit_lane_start` includes `W` rows with grid 0 (cell 46 says so). Early-career form (`min_periods=1`) is noisy: after one race it is 0 or 1. The same driver id is assumed to be the same person throughout; constructor ids reset on renames (cell 66).

---

## Cell 11 (md): "3. Chronological splitting and split checks"

"The split helpers keep whole seasons and races together, then compare the chosen chronological split with tempting random alternatives."

## Cell 12 (code): split constants and helpers

### `SPLIT_YEARS`, `split_by_time(frame)`

```python
SPLIT_YEARS = {"train": (1950, 2019), "validation": (2020, 2021), "test": (2022, 2024)}
{name: frame[frame.year.between(first, last)].copy() for name, (first, last) in SPLIT_YEARS.items()}
```
`between` is inclusive. Result: three DataFrames (23,163 / 780 / 1,359 rows). Every function that needs a split calls this, so the boundaries are defined once. **Supports R3b.**

### `split_summary(frame)`

For each split: years, first/last race date, rows, share of rows, races, drivers, starters per race, number of podiums, podium rate, share of rows with no qualifying. Output (cell 69): train 1950-2019, 23,163 rows (91.5%), 1,018 races, podium rate **13.3%**, qualifying missing **64%**; validation 2020-21, 780 rows, 39 races, **15.0%**, 0.1%; test 2022-24, 1,359 rows, 68 races, **15.0%**, 0%.

### `split_integrity(frame)`: seven pass/fail checks

Every row assigned to exactly one split; no race shared between any pair of splits; last training race before the first validation race; last validation race before the first test race; both classes present in every split. All `True` (cell 69). Proves the split is complete, disjoint, strictly ordered in time.

### `split_strategy_experiment(frame, random_state=42)`: why not a random split (**R3b** justification)

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
