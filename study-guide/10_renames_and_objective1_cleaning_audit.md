# 10. Do renames reset a team's history? And how the notebook meets Objective 1 (Data Cleaning & Auditing)

**Written for:** the teammate who owns EDA and cleaning and must defend both at the evaluation.

**Tags.** **[notebook]** = printed in the notebook or saved in `artifacts/`. **[my check]** = I computed it with pandas on `data/raw/*.csv` or `artifacts/modeling_table.csv`; it is not in the notebook, so say "we checked this separately".

---

# Part A. Do renames reset a team's history?

## A1. The direct answer

**It depends on the `constructorId`, not on the name. For a rename that gets a new id (most of them), yes: our constructor-form feature treats the renamed team as a brand-new team, and the course primer tells us to accept that.** The primer says: *"A 'constructor form' feature must follow constructorId, and we should accept that renames reset history."*

Three cases exist in the data:

| Case | What the dataset does | What our feature sees |
| --- | --- | --- |
| **Rename with a new id** (Toro Rosso -> AlphaTauri) | New `constructorId` | History starts **empty**; the old team's races are not linked |
| **Old id reused years later** (Aston Martin 2021 reuses the 1959-60 id) | Same `constructorId` as an unrelated earlier team | The form window **inherits the old era's races** |
| **Same id throughout** (Ferrari, McLaren, Williams, Mercedes, Red Bull) | One id | Continuous history, no issue |

## A2. The mechanism (cell 10, `build_modeling_table`)

```python
constructor_races = (base.groupby(["constructorId", "raceId", "date"], as_index=False)
                     .podium.mean().sort_values(["constructorId", "date", "raceId"]))
constructor_races["constructor_podium_rate_5"] = constructor_races.groupby("constructorId")["podium"].transform(
    lambda s: s.shift().rolling(5, min_periods=1).mean())
```
`groupby("constructorId")` builds one sequence per id. Whatever has a different id is a different sequence, whatever it is called. The name (`constructor_name`) is never used to build a feature; it is only used to label the Q3 results.

## A3. What the data shows for the modern rebrands [my check on `constructors.csv` and the modeling table]

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

## A4. What is reset, and what is not

| Feature | Affected by a rename? | Why |
| --- | --- | --- |
| `constructor_podium_rate_5` | **Yes** | Keyed by `constructorId`; new id = empty history, reused id = inherited history |
| `constructor_points_before`, `constructor_rank_before` | **No** | Standings restart every season (`_previous_standings` shifts within `(constructorId, year)`), so round 1 is always 0 / rank 0 for every team |
| `driver_podium_rate_5`, `driver_points_before`, `driver_races_before`, `driver_age` | **No** | They follow the **driver** across teams. For example, a driver moving from Force India to Racing Point keeps their own form |
| Grid, qualifying, field size, year | **No** | Not team-history features |

Also: **the model never sees a team name or a team id** (no one-hot encoding, no `constructorId` feature). It only sees numbers. A "reset" simply means a team looks like one with no recent podiums.

## A5. How big is the effect? [notebook, cells 66-67]

- Only the **first five races** of each listed season are affected (the window is 5 races), i.e. 10 driver rows per team-season (two cars x five races).
- **30 of 780 validation rows** (AlphaTauri 2020, Alpine 2021, Aston Martin 2021) and **20 of 1,359 test rows** (RB 2024, Sauber 2024).
- **None of those rows is a podium**, and `max_constructor_form` is 0 for every one. A missing form is filled with the **training median, which is 0**, so a reset team and a team with no recent podiums look the same to the model.
- Across the whole table, 324 rows have no constructor form at all, and **every one of them is a row from the very first race of one of the 202 constructor ids** (and every first-race row is missing) [my check]. After that first race, `min_periods=1` gives every id a value, built only from its own races.
- **The audit only looks at 2014 onward.** Renames and ownership changes in 1950-2013 (for example Toleman -> Benetton -> Renault, Lotus -> Caterham) are the same mechanism and affect some training rows, but the notebook does not quantify them.

## A6. Why we did not link renamed teams (cell 67)

"Linking renamed teams would need a judgement for every case: Toro Rosso to AlphaTauri was a rebrand of the same team, but Force India to Racing Point followed a sale out of administration, and a merged history would also join eras with different owners, budgets and engines. With 50 affected validation and test rows, no podiums among them, and a feature that is already 0 for them, a hand-made mapping would add assumptions for very little effect on the evaluation. The reset stays listed as a limitation."

## A7. Where the name does matter: Q3

In Q3 (mechanical retirements) teams are grouped by `constructor_name`, so a rebrand splits one organisation into separate bars: Toro Rosso (2014-2019) vs AlphaTauri (2020-2023) vs RB (2024), Force India vs Racing Point vs Aston Martin. Each name-era needs at least **20 starts** to be ranked. State this as a Q3 limitation.

## A8. Questions you may get on this

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

# Part B. Objective 1: Data Cleaning & Auditing, bullet by bullet

You pasted the brief's Objective 1. Here is how each bullet is met, where, with evidence, tests, and what to say if pressed.

## B0. The one-minute answer for "walk me through your cleaning"
"We load the 14 CSVs read-only and convert the `\N` sentinel to missing values. We audit all 14 primary keys and 22 foreign keys (all clean). Profiling the raw tables, we found that the primary key of `results` is unique but the required grain `(raceId, driverId)` is not: 85 shared-drive groups. We resolve them with a deterministic rule (started car, then best finish, then lowest `resultId`), which removes 91 rows. We then remove 1,366 `F` rows because those drivers never entered the race. That leaves 25,302 rows, one per driver per race. We typed the dates we use and converted qualifying lap-time strings to seconds. We compare the data before and after every step with a three-stage table and figures. Raw files are never modified."

## B1. Bullet 1: "Initial EDA, before and after cleaning, supported with proper visualization"

| Brief says | Where | What we did |
| --- | --- | --- |
| Initial EDA | Cell 6 `raw_table_profile`; displayed in cell 42 | Per table: rows, columns, missing cells and share, columns with gaps, full-row duplicates, numeric/text counts |
| Before **and after** cleaning | Cell 14 `cleaning_eda`; cells 42-43 | Three stages (raw 26,759 rows; shared drives resolved 26,668; `F` rows removed 25,302) with rows, unique driver-races, duplicate rows, podium rate, grid-0 share, missing finish share, median grid |
| Visualization | Cell 32 helpers; cell 42 | `raw_table_profile.png`, `cleaning_before_after.png`, `qualifying_coverage.png` |
| Not manual inspection | Functions inside `run_analysis` (cell 40) | Everything is code and regenerates on Run All |
| Test | `test_cleaning_eda_quantifies_each_step_without_duplicates` | Checks the stage table |

Full detail: file 07 sections 3-5.

## B2. Bullet 2: "Clean sentinels and apply semantic typing to dates and durations"

| Item | Where | What we did | Check |
| --- | --- | --- | --- |
| **Sentinel `\N`** | Cell 6 `load_raw_tables` | `pd.read_csv(path, na_values=["\\N"], low_memory=False)`: converted at load time in every table | `raw_table_profile` then reports real missingness (races 56%, results 25.5%...) |
| **Dates -> date objects** | Cell 10 | `races["date"] = pd.to_datetime(..., errors="coerce")`, `base["dob"] = pd.to_datetime(...)`; `sprint_date` in the sprint check (cell 28) | 0 of 1,125 race dates and 0 of 861 birth dates fail to parse [my check], so `errors="coerce"` silently loses nothing |
| **Lap-time strings -> seconds** | Cell 8 `_time_to_seconds` | Regex `(?:(\d+):)?(\d+(?:\.\d+)?)`: `"1:26.572"` -> 86.572; unparseable -> NaN. Applied to `q1`, `q2`, `q3`; the best of the three (minimum) becomes `qualifying_time_seconds` | 0 of 19,814 non-null `q1/q2/q3` strings fail the regex [my check]. Test: `test_duration_parser_handles_valid_and_missing_values` |
| **Derived duration** | Cell 10 | `driver_age = (race date - dob).dt.days / 365.2425` | Range 17.5-56.8 [my check] |

**Honest scope.** We typed the dates and durations we **use**. Other date columns (`fp1_date`, `quali_date`, `sprint_date` outside the sprint check; 92-98% missing) and other duration strings (`results.time`, `fastestLapTime`, `lap_times.time`, `pit_stops.duration`) are left as text because they are post-race, within-race, or unused. If asked "why not all of them", say: they never reach a feature, and converting them is a one-line change. The brief's own example (lap-time strings to numeric seconds) is met with the qualifying lap times.

## B3. Bullet 3: "Exactly one row per driver per race; choose a rule and explain it"

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

## B4. Bullet 4: "PKs unique and non-null; FKs reconcile; raw immutable, cleaning on copies"

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

## B5. "Your own exploration may turn up additional issues worth handling and documenting"

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

## B6. The Note: "EDA cannot be manual inspection"
Every EDA output is a function (`raw_table_profile`, `cleaning_eda`, `feature_eda`, `engineering_answers`, the plot helpers) that runs in `run_analysis` and writes a CSV and a PNG; the justification for each choice sits in the markdown cells (43, 46, 49, 61). That is the brief's "implementation choices along with justification, and the visualization of them".

---

# Part C. Likely evaluator questions on Part B

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
