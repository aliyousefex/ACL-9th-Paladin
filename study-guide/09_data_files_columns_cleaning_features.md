# 9. The data: where the files are, how they are loaded, every table and column, how the data is cleaned, and the 16 features

**Written for:** the teammate who owns EDA and must explain the data from the raw CSVs to the final features.

**Conventions.** "Cell N" is the 0-based index in the `.ipynb`. **[notebook]** = printed in the notebook or saved in `artifacts/`. **[my check]** = I computed it with pandas directly on `data/raw/*.csv` or `artifacts/modeling_table.csv` while preparing this guide; it is *not* in the notebook, so say "we checked this separately". Column meanings marked **(std)** come from the standard Ergast/Kaggle schema and the course primer, not from the notebook, which never defines most columns.

**A correction first.** In `07_EDA_owner_guide.md` and `08_EDA_question_bank.md` I earlier said the raw CSVs were not in the repo. That was wrong: they are in `data/raw/` and tracked by git. I have fixed those two files.

---

## 0. The short answers

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

## 1. Where the files are and how they got there

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

### Cell 2: finding the data (`locate_data`)
```python
ROOT = Path.cwd().resolve()
if ROOT.name == "notebooks": ROOT = ROOT.parent
local = ROOT / "data" / "raw"
if (local / "results.csv").exists(): return local
kaggle_root = Path("/kaggle/input")
matches = sorted(kaggle_root.rglob("results.csv")) if kaggle_root.exists() else []
```
Look for `data/raw/results.csv` locally; otherwise search `/kaggle/input` for any folder containing `results.csv`; otherwise raise a clear error. This is why the same notebook runs on a laptop and on Kaggle. The saved output prints `Raw data: ...\data\raw`, proving the saved results came from a **local** run.

### Cell 6: loading (`load_raw_tables`)
`for path in sorted(data_dir.glob("*.csv")): tables[path.stem] = pd.read_csv(path, na_values=[SENTINEL], low_memory=False)`. Then it checks that all required tables exist (`PRIMARY_KEYS` plus `sprint_results`, `lap_times`, `pit_stops`) and raises `FileNotFoundError` if not. The sentinel `SENTINEL = "\\N"` (the literal two characters backslash-N) becomes `NaN` at load time.

**What a raw line looks like** [my check]:
```
results.csv    1,18,1,1,22,1,1,"1",1,10,58,"1:34:50.616",5690616,39,2,"1:27.452","218.300",1
races.csv      1,2009,1,1,"Australian Grand Prix","2009-03-29","06:00:00","http://...",\N,\N,\N,\N,\N,\N,\N,\N,\N,\N
qualifying.csv 1,18,1,1,22,1,"1:26.572","1:25.187","1:26.714"
```
The `\N` cells in `races.csv` (practice/qualifying/sprint session dates that did not exist in 2009) are the sentinel. Left unconverted, those columns would be read as text and look "complete".

---

## 2. The 14 tables at a glance

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

## 3. Every table, every column

Missing % is after `\N` -> `NaN` [my check, matches the notebook's `raw_table_profile` totals]. "Used" = read by the pipeline.

### 3.1 `results.csv` (26,759 rows, 18 columns): one row per driver per car per race
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

### 3.2 `races.csv` (1,125 rows, 18 columns): one row per Grand Prix
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

### 3.3 `drivers.csv` (861 rows, 9 columns)
`driverId` (PK) - `driverRef` (slug, e.g. `hamilton`) - `number` (**93.1% missing**; permanent number, only recent) - `code` (**87.9% missing**; 3-letter code) - `forename`, `surname` - `dob` (birth date) **(used: age)** - `nationality` **(used: Q2 home mapping)** - `url`. Gaps: only `number` and `code` (20.1% of cells), neither used. 43 distinct nationality strings.

### 3.4 `constructors.csv` (212 rows, 5 columns)
`constructorId` (PK), `constructorRef`, `name` **(used: Q3, and carried as `constructor_name`)**, `nationality`, `url`. No gaps. A rebrand usually gets a new `constructorId` and name (Toro Rosso -> AlphaTauri -> RB).

### 3.5 `circuits.csv` (77 rows, 9 columns)
`circuitId` (PK), `circuitRef`, `name` **(used: Q1, `circuit_name`)**, `location` (city), `country` **(used: Q2 home mapping)**, `lat`, `lng`, `alt`, `url`. No gaps. The country strings include both `"USA"` and `"United States"` (the latter only for the Las Vegas Strip circuit).

### 3.6 `qualifying.csv` (10,494 rows, 9 columns)
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

### 3.7 `driver_standings.csv` (34,863 rows) and `constructor_standings.csv` (13,391 rows)
Both: PK, `raceId`, the entity id, `points` (cumulative **after** this race), `position` (rank after this race), `positionText`, `wins`. No gaps. **We use only `points` and `position`, and only after shifting them to the next race** (section 8). Constructor standings start in 1958.

### 3.8 `status.csv` (139 rows, 2 columns)
`statusId`, `status` ("Finished", "Disqualified", "Accident", "Collision", "Engine", "Gearbox", "+1 Lap", "Withdrew", "Did not qualify"...). Used only for Q1-Q3 and the non-starter audit (post-race information, never a feature).

### 3.9 `sprint_results.csv` (360 rows, 16 columns)
A subset of the `results` layout (`resultId`, `raceId`, `driverId`, `constructorId`, `number`, `grid`, `position`, `positionText`, `positionOrder`, `points`, `laps`, `time`, `milliseconds`, `fastestLap`, `fastestLapTime`, `statusId`), 1.3% missing. Used only in the sprint check (cells 56-58).

### 3.10 The four audit-only tables
- `constructor_results.csv` (12,625 rows): `constructorResultsId`, `raceId`, `constructorId`, `points`, `status` (99.9% empty).
- `seasons.csv` (75 rows): `year`, `url`. One row per season 1950-2024.
- `lap_times.csv` (589,081 rows): `raceId`, `driverId`, `lap`, `position`, `time`, `milliseconds`.
- `pit_stops.csv` (11,371 rows): `raceId`, `driverId`, `stop`, `lap`, `time`, `duration`, `milliseconds`.

They get PK/FK checks and a profile row. They are not joined because everything in them happens **after the start**.

---

## 4. How the tables connect (22 foreign keys, all verified)

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

## 5. The pipeline from raw CSV to modeling table, with the rows at every step

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

### 5.1 Step 2 in detail: shared drives
Rule (cell 8): sort by `[raceId, driverId, _started (descending), positionOrder, resultId]`, where `_started = grid > 0`, then `drop_duplicates(["raceId","driverId"], keep="first")`, then `assert` uniqueness. Per row: prefer the car the driver started, then the best finish, then the smallest `resultId`. 85 groups: 79 have 2 rows, 6 have 3 rows; **79 are in the 1950s, 5 in the 1960s, 1 in the 1970s**; 21 are at the Indianapolis 500 [my check on the raw file].

### 5.2 Step 3 in detail: the `F` rows
1,368 raw `F` rows (1,366 after dedup). By decade [my check]: 1950s 50; 1960s 75; 1970s 331; **1980s 545**; 1990s 358; 2000s 5; 2010s 4, so **90% are in the 1970s-1990s**, matching the primer's "oversized, uneven fields" point. All are in training; none in validation or test. Rule (instructor ruling): `F` is known before the race starts, so the driver never entered it; `W` (withdrew, 336 raw rows) is known only after the race and is **kept**.

### 5.3 Step 7 in detail: qualifying
```python
for col in ["q1","q2","q3"]: qualifying[col+"_seconds"] = qualifying[col].map(_time_to_seconds)
qualifying["qualifying_time_seconds"] = qualifying[["q1_seconds","q2_seconds","q3_seconds"]].min(axis=1)
qualifying = qualifying.sort_values(["raceId","driverId","position","qualifyId"]).drop_duplicates(["raceId","driverId"])
```
`_time_to_seconds` uses the regex `(?:(\d+):)?(\d+(?:\.\d+)?)`: optional minutes, then seconds; `"1:26.572"` -> 86.572; anything unparseable -> NaN. The best of the three sessions is the minimum. The sort+drop makes sure each driver-race has one row.

### 5.4 Step 8 in detail: standings
`driver_points_before`/`driver_rank_before` (and constructor equivalents) are the standings **after the previous race of the same season**. Rows with no previous standing (round 1, a driver's/team's first race of a season, constructors before 1958) are set to **0 points, rank 0**, not imputed.

---

## 6. What is dropped, kept and never used

### 6.1 Rows
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

### 6.2 Columns
- **44 columns** exist in the modeling table [my check]. **Only 16 are fed to any model** (the `FEATURES` whitelist). The other 28 are identifiers, post-race result columns (kept for the label and for Q1-Q3), and descriptive context.
- **Never used for anything beyond audits:** `lap_times`, `pit_stops`, `constructor_results`, `seasons`; and from used tables, columns such as `url`, `lat/lng/alt`, `forename/surname`, `number`, `code`, `time`, `fp*`, `quali_*` session times.
- **Post-race columns that are explicitly never features:** `position`, `positionText`, `positionOrder` (target source), `points`, `laps`, `time`, `milliseconds`, `fastestLap`, `rank`, `fastestLapTime`, `fastestLapSpeed`, `statusId`.

### 6.3 What the 44 modeling-table columns are
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

## 7. The target

`podium = (positionOrder <= 3).astype(int)`. `positionOrder` is the final ranking, **already reflecting post-race disqualifications and appeals** (primer), and it is never missing. 3,395 podium rows of 25,302 = **13.42%**. It is computed after dedup, so each driver-race has one label.

---

## 8. The 16 features, one by one

Pipeline for modeling: features are selected as `frame[FEATURES]`; a `Pipeline` first applies a **median imputer fitted on training rows** and then (for logistic regression and the network, not the forest) a **StandardScaler fitted on training rows**.

### Group 1: grid (4) — known when the grid is set
| Feature | Definition | Source | Notes |
| --- | --- | --- | --- |
| `grid_position` | `results.grid` where `grid > 0`, else NaN | results | 1.1% missing (289 rows). One-feature AUC 0.119 (lower = more podiums) |
| `pit_lane_start` | 1 if `grid == 0` | results | Marks 289 rows: 202 withdrawals + 87 real pit-lane/exceptional starts. **Not a pure pit-lane flag** |
| `front_row` | 1 if `grid` is 1 or 2 | results | 2,243 rows (8.9%). AUC 0.672 |
| `field_size` | Number of rows for the race (`groupby("raceId").transform("size")`) | results | Includes `W` rows; larger in old eras (mean 23.25 in training). AUC 0.454 |

### Group 2: qualifying (3) — known after qualifying
| Feature | Definition | Notes |
| --- | --- | --- |
| `qualifying_position` | `qualifying.position` | **Missing for 64.0% of training rows** (pre-1994 and erratic 1994-2002). AUC 0.095 on the rows that have it |
| `qualifying_time_seconds` | Best of q1/q2/q3, in seconds | 64.5% missing in training. Not comparable across circuits and eras. Contains one 1,002.64 s outlier |
| `qualifying_missing` | 1 if `qualifying_position` is NaN | Marks rows whose qualifying values are imputed. AUC 0.490 |

### Group 3: form (3) — built only from earlier races
| Feature | Definition | Notes |
| --- | --- | --- |
| `driver_podium_rate_5` | Mean podium indicator over the driver's previous **5 starts** (`shift()` then `rolling(5, min_periods=1)`) | 3.5% missing = a driver's first race. AUC 0.810 |
| `constructor_podium_rate_5` | Same for the team, computed **per race** (both cars averaged) before shifting | 1.4% missing. Keyed by `constructorId`, so renames reset it. AUC 0.826 |
| `driver_races_before` | Number of earlier starts (`cumcount`) | How much experience / how reliable the form is. AUC 0.662 |

### Group 4: standings (4) — "before this race"
| Feature | Definition | Notes |
| --- | --- | --- |
| `driver_points_before` | Driver points after the previous race of the season | 0 for round 1. AUC 0.755 |
| `driver_rank_before` | Driver championship rank after the previous race | 0 when no standing yet. AUC 0.265 (lower is better) |
| `constructor_points_before` | Team points after the previous race | 0 before 1958 and for round 1 |
| `constructor_rank_before` | Team rank after the previous race | 0 when none. AUC 0.259 |

### Group 5: context (2)
| Feature | Definition | Notes |
| --- | --- | --- |
| `driver_age` | `(race date - dob) / 365.2425` years | Range 17.5-56.8. AUC 0.552 |
| `year` | Season | AUC 0.505 alone, but removing it hurts the nonlinear models (-0.012 forest, -0.021 network). The test years lie outside the training years |

**`round` was a 17th feature and was removed** after the context experiment (cell 63). The README and the old Q&A PDF still say 17.

**Why every feature is valid at the cutoff:** grid, qualifying and age are fixed before the start; form uses only earlier races; standings are moved to the next race; none of them reads the current race's result, points, status, laps, pit stops or fastest lap.

---

## 9. After the table is built: the split (cell 12)

Chronological by season: **train 1950-2019 (23,163 rows, 1,018 races), validation 2020-2021 (780, 39 races), test 2022-2024 (1,359, 68 races)**. Integrity checks (no shared race, ordered in time, both classes present) all pass. Imputer and scaler are fitted on training only. Details are in `02_cells_00-12_setup_cleaning_features_split.md`.

---

## 10. Qualifying coverage: the primer says "must be confirmed from our own copy". Confirmed.

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

## 11. The primer's "oddities of early F1" versus what the project does

| Primer oddity | What the raw data shows [my check] | What the notebook does | Status |
| --- | --- | --- | --- |
| **Shared drives** | 85 duplicate groups: 79 in the 1950s, 5 in 1960s, 1 in 1970s; 21 at Indy | Deterministic rule: started car, best finish, smallest `resultId` | **Covered** |
| **Qualifying-coverage drift** | Starts 1994; erratic to 2002; complete from 2003 | Coverage plot, flag, imputation, grid kept, window restriction tested | **Covered** |
| **Oversized, uneven fields** (non-qualifiers have result rows) | 1,368 raw `F` rows, 90% in 1970s-1990s; raw rows per race 28.9 in the 1980s vs 20.0 in the 2020s | `F` rows removed before features; `field_size` and `year` kept as features | **Covered** |
| **Team and driver identity drift** | Renames get new ids; some ids reused | Form keyed by `constructorId`; renames reset history; 10 team-seasons since 2014 audited (cells 65-67); driver form follows the driver | **Covered** (audit is 2014+ only) |
| **Low reliability in early decades** | Share of rows ending "Finished" or "+N Laps": 52% (1950s), 47%, 51%, 44% (1980s), 50%, 68% (2000s), 80% (2010s), 85% (2020s). Pole-sitter podium rate: 54%, 48%, 53%, 48%, 63%, 75%, 81%, 78% | No explicit reliability feature; `year` lets nonlinear models adjust for era; Q3 looks at 2014-2024 only | **Implicitly covered** by `year` and standings/form |
| **`grid == 0` is a pit-lane start ("verify in EDA")** (primer glossary) | Only 87 of 1,635 grid-0 rows are real pit-lane starts | Verified in the 8.1 audit; `F` removed, flag kept | **Covered, and the primer's guess was mostly wrong** |
| **The Indianapolis 500 (1950-1960)** | See below | **Nothing: not excluded, not mentioned** | **Gap** |

### 11.1 The Indianapolis 500: what is in the data [my check]
- **11 races** (1950-1960), `circuitId` 19 ("Indianapolis Motor Speedway"), race name "Indianapolis 500". The same circuit id also hosts the 2000-2007 US Grands Prix on the road course, so the circuit mixes two very different races.
- **405 raw rows (381 after dedup)** = 18% of the 2,230 results rows of 1950-1960, **1.5% of the whole modeling table, 1.6% of training rows**.
- **107 distinct drivers; 103 of them appear in no other race in the dataset**; 404 of the 405 raw rows are American drivers.
- **33 constructors at Indy; 30 of them appear nowhere else** (Adams, Bromme, Christensen, Deidt, Dunn, Elder, Epperly, Ewing...); only Ferrari, Maserati and Kurtis Kraft also race elsewhere.
- **Fields of 33-55 raw rows** (the 1954 race has 55 raw / 42 modeling rows, the largest `field_size` in the data, and 1953 has 47 raw rows). Typical grid structure is very different (33 cars, no `F` rows, no qualifying data).
- **Podium rate 9.4%** vs 15.6% for the rest of 1950-1960 (bigger fields, same 3 podium places).
- **21 of the 85 shared-drive duplicate groups** are in these races. Their features look like newcomers' (0 standing points before the race, at most 11 prior starts, 28% with no driver form).

### 11.2 Where it can matter
| Area | Effect | Size |
| --- | --- | --- |
| **Q2 (home race)** | American drivers racing the Indy 500 are counted as "home" starters | **380 of the 2,304 home rows (16.5%)** |
| **Q1 (front-row conversion)** | Circuit 19 appears with 51.4% from 37 front-row starts, mixing the 500s and the 2000-2007 road course; not in the top 10 either way | negligible for the headline answer |
| **Training** | 381 rows with unusual field sizes (33-42) and one-off constructors | 1.6% of training rows |
| **Features** | A regular driver who also raced Indy has that race inside their last-5-starts form window | tiny |
| **Evaluation** | None of these rows is in validation or test (1950-1960) | zero |

### 11.3 I re-ran Q2 without them [my check]
I reproduced the notebook's Q2 **exactly** (OR 0.9546, 95% CI 0.8246-1.1104, 2,304 home rows, 21,815 away, 928 excluded) using the same code logic and seed, then removed the 1950-60 Indianapolis 500 rows:

| | Odds ratio | 95% CI | Home rows | Away rows |
| --- | --- | --- | --- | --- |
| Notebook (Indy kept) | 0.955 | 0.825 - 1.110 | 2,304 | 21,815 |
| Indy 500 1950-60 excluded | **0.957** | **0.802 - 1.136** | 1,924 | 21,814 |

**The conclusion is unchanged** (OR near 0.96, interval contains 1); the interval is just wider because 380 home rows were removed. I did **not** re-train the models without these rows, because scikit-learn is blocked on this machine; that experiment is a one-line filter that the team could run in the notebook environment if wanted.

### 11.4 How to defend it if asked "did you exclude the Indy 500?"
Say it plainly:
1. "**No, we kept it, and our notebook does not discuss it.** The course primer describes it as a defensible exclusion to document, and we did not document it. That is a gap in our write-up."
2. "These are legitimate championship races with a valid podium label, they are all in the training years, and they are 1.6% of the training rows. None is in validation or test."
3. "The place it could matter is Q2, where 16.5% of the home rows are American drivers at the Indy 500. **I re-ran Q2 without them: odds ratio 0.957, CI 0.80-1.14, same conclusion.**"
4. "If we were to change the pipeline, we would exclude `circuitId == 19` for 1950-1960, document the 405 rows, and report the models with and without them."

**Do not claim** the notebook handled it, and do not claim the models are unaffected (not tested). Whether to edit the notebook is a team decision; the README says results are regenerated from the notebook, so a change needs the whole team.

---

## 12. Likely questions on data, extraction, cleaning and features

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

## 13. Numbers to know cold

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
