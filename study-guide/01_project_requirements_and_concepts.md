# 1. The project, the requirements, and the concepts you need

Sources for this file: `course-materials/milestone-1/milestone-1-brief.pdf` (the requirements), `course-materials/milestone-1/f1-introduction.pdf` (the F1 primer), the notebook, and the README.

---

## 1.1 What the project is supposed to do

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

### F1 mini-primer (from the intro PDF, in your own words)

- A **season** (year) has many **races** (Grands Prix) at different **circuits**. **Drivers** drive for **constructors** (teams). Points go to the **Drivers' Championship** and (since 1958) the **Constructors' Championship**.
- A race weekend: practice -> **qualifying** (fastest lap gets **pole**, P1 on the grid; P1 and P2 are the **front row**) -> **starting grid** (qualifying order *plus penalties*, so **qualifying position != grid position**) -> **race** -> **results** (positions, points, **status** such as "Finished", "+1 Lap", "Engine", "Collision").
- Only about **3 of ~20 drivers** finish on the podium in the modern era (~15%); far less in eras with 30+ entrants. So the positive class is **rare**, which is why PR-AUC is the primary metric.
- **Grid 0** in the data does *not* mean "better than pole". It marks a pit-lane start, or a driver who never took the grid.
- **Qualifying data are patchy:** the dataset has essentially none before 1994, erratic coverage 1994-2002, and near-complete coverage from 2003 (cell 42's coverage figure). The brief calls this "historical qualifying-coverage drift".
- **Shared drives (1950s):** until 1957 a driver could take over a teammate's car mid-race, so the same driver can have two result rows in one race. That breaks "one row per driver per race".
- **Eras matter:** 1.6-litre turbo-hybrid era 2014-2021, ground-effect era 2022-2024, etc. Reliability, field size and who is fast all change.

---

## 1.2 What each requirement asks for

I've given every requirement an ID (R1, R2, ...) so the map in `06_defense_pack.md` can refer to it.

### R1. Data cleaning and auditing (brief section 1)

| ID | The brief asks for | In plain words |
| --- | --- | --- |
| R1a | Initial EDA, **before and after** cleaning, **with visualisation**, supported by implementation and justification (not manual inspection) | Quantify the data programmatically and show how cleaning changes it, with plots |
| R1b | Clean `\N` sentinels; apply semantic typing (dates -> date objects; lap-time strings -> numeric seconds) | Turn placeholder text into real "missing"; turn text dates/times into real dates/numbers |
| R1c | Exactly **one row per `(raceId, driverId)`**; find duplicates (shared drives); **choose a rule, apply it, explain why** | Make the table's grain match the prediction unit |
| R1d | Verify **primary keys** unique and non-null; **foreign keys** reconcile (every FK value exists in the parent table); raw CSVs immutable, cleaning on copies | Prove the relational structure is sound |

### R2. Data-engineering questions (brief section 2)

Each needs a **multi-table join**, an **answer**, a **visualisation**, and a short justification of **grain, missingness and (where relevant) the pre-race cutoff**.

| ID | Question |
| --- | --- |
| R2-Q1 | Which circuits convert a front-row start into a podium most often, and does the ranking change after the 2014 hybrid era? Distinguish qualifying position from grid. |
| R2-Q2 | Do drivers podium more often at their home country's circuit, **after controlling for starting position**? |
| R2-Q3 | Which constructors have the highest **mechanical-retirement** rate in 2014-2021 vs 2022-2024? (Crashes, driver errors and regulation decisions are *not* mechanical.) |

### R3. Feature selection and engineering (brief section 3)

| ID | The brief asks for |
| --- | --- |
| R3a | Feature choices justified with **exploratory evidence** (plots, correlations or experiments): either a hypothesis from EDA **or** trial-and-error kept visible in the notebook |
| R3b | An appropriate **train/validation/test split**, justified |
| R3c | (checklist) **Leakage-safe form feature** that uses only past races |

### R4. Predictive modelling (brief section 4)

| ID | The brief asks for |
| --- | --- |
| R4a | **>=2 statistical ML models** and **1 shallow neural network (1-2 hidden layers)**, trained on **the same rows and same feature set** |
| R4b | **ROC-AUC, PR-AUC, F1** for every model (the notebook also reports precision and recall: "all five metrics") |
| R4c | Performance on **train/validation** and on the **unseen test set** |
| R4d | **Thresholds and hyperparameters chosen with training+validation only**, never the test set |
| R4e | Justify the choice against a **baseline** (simplest reasonable model) |

### R5. Experiments (brief section 5 + deliverable 5)

| ID | The brief asks for |
| --- | --- |
| R5a | **Feature-group ablation**: remove one group at a time, retrain, see how much performance drops |
| R5b | **At least two preprocessing-order experiments** |
| R5c | (checklist) Compare multiple approaches for anything you tried to improve; **>=3 distinct modelling attempts**; each attempt visible in its own cell/section with before/after |

### R6. Explainability, XAI (brief section 6)

| ID | The brief asks for |
| --- | --- |
| R6a | **Global**: permutation importance **and** SHAP |
| R6b | **Local**: at least one single-prediction explanation (LIME and/or local SHAP) |
| R6c | All plotted and interpreted; **state explicitly that explanations are not causal effects** |

### R7. Deliverables and notebook rules

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

### R8. What the evaluator will do (checklist page)

1. Any team member can be asked about any step.
2. Every step must be **explained and justified in the F1 context with evidence**. "An AI tool suggested it" is not a justification.
3. Two legitimate ways to motivate a step: **hypothesis-driven** (cite the EDA that led you there) or **trial-and-error** (show before/after on the whole pipeline).
4. Compare multiple approaches; >=3 distinct modelling attempts.
5. A **baseline** (statistical model or shallow FFNN) must be in the notebook.

Submission: Kaggle notebook link (accessible), GitHub repo link (accessible), PDF report. Deadline was 18 Oct 2026.

---

## 1.3 How the data moves through the project

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

## 1.4 Glossary: every technical term you will be asked about

### Relational data

- **Table / row / column:** a CSV file is a table; one line = a row (record); a header name = a column (field).
- **Primary key (PK):** the column(s) that uniquely identify a row of a table, non-null (e.g. `results.resultId`, or the *composite* key `(raceId, driverId, lap)` for `lap_times`). Audit = count nulls and duplicates; both must be 0.
- **Foreign key (FK):** a column that references a primary key in another table (e.g. `results.driverId` -> `drivers.driverId`). Audit = every non-null value must exist in the parent table. A value that doesn't is an **orphan**.
- **Join / merge:** combining two tables on matching key columns. **`validate="many_to_one"`** makes pandas *raise an error* if the right-hand table has duplicate keys, so a join can never silently multiply rows. **`one_to_one`** requires unique keys on both sides.
- **Grain:** "what one row means". Here: one driver in one race. `results.csv` is *almost* at that grain but not exactly (shared drives).
- **Multi-hop join:** answering a question requires chaining joins through several tables, e.g. `results -> races -> circuits` plus `results -> status`.

### Missing data

- **Sentinel:** a placeholder that stands for "missing" but is stored as ordinary text. Here the literal two-character string `\N` (backslash, N). If you don't convert it, pandas reads numeric columns as text.
- **NaN / missing:** pandas' real missing marker. `pd.read_csv(..., na_values=["\\N"])` converts the sentinel at load time.
- **Semantic typing:** giving columns their real meaning: date strings -> `datetime`, `"1:23.456"` -> `83.456` seconds, flags -> integers.
- **Imputation:** replacing missing values with an estimate. **Median imputation** uses the middle value of the *training* column. **Missing-indicator flag** (`qualifying_missing`): a 0/1 column recording that the value was missing, so the model can tell a filled value from a real one.
- **Structured (non-random) missingness:** here qualifying is missing *because of the era* (no data before 1994), not at random. That is why a flag is used and why dropping rows would delete two thirds of history.

### Leakage and splitting

- **Leakage:** see 1.1. Examples here: current-race `positionOrder`, `points`, `status`, `laps`, pit stops, fastest lap, post-race standings. Subtler: including the current race in a "last 5 races" average; attaching post-race standings to the same race; fitting an imputer/scaler on data that includes the test years.
- **Train / validation / test:** train = fit parameters; validation = make *decisions* (features, preprocessing, model choice, thresholds); test = a final, once-only score. Using the test set for any decision makes its score optimistic.
- **Chronological (temporal) split:** split by time so the model never trains on later seasons than the ones it is scored on. This mimics deployment: on race morning you only know the past.
- **Distribution shift:** the data in later periods differ from earlier ones (smaller fields, near-complete qualifying, more reliable cars). Here the training podium rate is 13.3% but validation/test are 15.0%.
- **Overfitting / memorising:** very high training score, much lower validation score. The first random-forest settings had training PR-AUC 0.918 vs validation 0.696.
- **Seed (`random_state`):** the number that fixes a random generator so results repeat. Neural networks (random initial weights) and forests (random samples) change with it.

### Preprocessing

- **Standardisation (`StandardScaler`):** `z = (x - mean) / std`, with mean and std taken from the **training** rows. After it, each training feature has mean 0 and std 1. Validation/test use the *same* frozen mean/std, so their scaled means are not zero (and that shift is information about period shift).
- **Why scale:** logistic regression's penalty and the neural network's gradient steps are sensitive to feature units (a 0-722 points column vs a 0/1 flag). Trees only compare thresholds, so they don't need scaling.
- **`sklearn.pipeline.Pipeline`:** chains steps (impute -> scale -> model) into one object. `.fit` learns every step from training data only; `.predict_proba` replays the identical transformations on new data. This is what prevents train/test contamination and makes inference reproducible.

### Models

- **Logistic regression:** computes a weighted sum `z = b + w1*x1 + ... + wk*xk` (the **log-odds**) and turns it into a probability with `p = 1 / (1 + e^(-z))`. **Regularisation** (`C`, penalty L1/L2) shrinks weights to avoid overfitting; smaller `C` = stronger penalty. Interpretable: with standardised inputs each weight = change in log-odds per +1 standard deviation.
- **`class_weight="balanced"`:** weights each class inversely to its frequency (`n / (2 * n_class)`), so with ~13% podiums a podium row counts about 3.8x and a non-podium about 0.58x. Helps the rare class but **shifts probabilities upward**, so they are not calibrated.
- **Random forest:** many decision trees, each trained on a bootstrap sample with random feature subsets; the forest averages their votes. `max_depth` and `min_samples_leaf` limit tree size (more limit = less memorising). Captures non-linear effects and interactions; no scaling needed.
- **Shallow neural network / MLP (multi-layer perceptron):** layers of weighted sums + non-linearities (ReLU by default). "Shallow" = 1-2 hidden layers; here `(32, 12)` = 32 units then 12 units. `alpha` is the L2 penalty; `early_stopping=True` stops training when an internal 10% hold-out stops improving.
- **Hyperparameter vs parameter:** parameters (weights) are learned from data; hyperparameters (`C`, depth, layer sizes, alpha) are set by you and chosen on validation.
- **Baseline:** the simplest reasonable model to compare against. Here: logistic regression.

### Metrics

- **Confusion matrix terms:** TP (predicted podium, was podium), FP (predicted podium, wasn't), FN (missed podium), TN.
- **Precision** = TP / (TP + FP): of those we flagged, how many were podiums. **Recall** = TP / (TP + FN): of real podiums, how many we caught. **F1** = 2PR / (P + R): harmonic mean (punishes imbalance between them). These need a **threshold** (probability above which we say "podium").
- **ROC-AUC:** area under the curve of true-positive rate vs false-positive rate across all thresholds. 0.5 = random, 1.0 = perfect. Equals the probability a random podium row is scored above a random non-podium row. Can look flattering when negatives dominate.
- **PR-AUC** (computed with `average_precision_score`): area under the precision-recall curve. Its "random" baseline is the **positive rate** (~0.15 here), so 0.70 is ~4.7x better than chance. More informative when positives are rare, which is why it is the **primary** metric; ROC-AUC is **secondary**.
- **Threshold selection on validation:** for each model, scan 0.05-0.80 in steps of 0.005 and keep the value that maximises validation F1; freeze it; then report test.

### Experiments and explainability

- **Ablation:** remove one group of features, retrain, and measure the score change. A drop = the group was contributing.
- **Permutation importance:** shuffle one feature's values in validation rows and measure how much the score drops; big drop = the model relies on it. Model-agnostic, global.
- **SHAP (SHapley Additive exPlanations):** assigns each feature a contribution to a prediction using Shapley values from game theory, so that *baseline average prediction + sum of contributions = this prediction*. `TreeExplainer` is exact and fast for tree models. Mean of |SHAP| over many rows = global importance; one row's SHAP = local explanation.
- **LIME:** explains one prediction by perturbing that row many times, asking the model for predictions, and fitting a simple weighted linear **surrogate** around it. **Fidelity** (weighted R^2) says how well the surrogate imitates the model locally.
- **Global vs local:** global = how the model behaves overall; local = why *this* row got *this* probability.
- **Association vs causation:** an important feature means the *model relies on it*, not that changing it would change real podium outcomes. The brief demands you say this explicitly.

### Statistics used in the analysis questions

- **Bootstrap:** repeatedly resample the data with replacement and recompute a statistic to see how much it varies. Here whole **races** are resampled (a *cluster* bootstrap) because rows within a race are not independent. The 2.5th-97.5th percentiles give a **95% interval**.
- **Odds / odds ratio (OR):** odds = p / (1 - p). OR = odds for home drivers / odds for away drivers; OR = 1 means no difference.
- **Mantel-Haenszel (MH) common odds ratio:** pools the home/away comparison across many strata (here: each exact grid slot P1, P2, ...) so a home-vs-away difference isn't just a difference in where they start.
- **Spearman correlation:** correlation of *ranks* (used to compare grid with sprint finish).
