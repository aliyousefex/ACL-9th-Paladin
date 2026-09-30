# Formula 1 Podium Prediction Companion

Milestone 1 for ACL-903 builds a complete relational-data and machine-learning pipeline that predicts whether a Formula 1 driver will finish in the top three. Every model input is limited to information available after qualifying and before the race starts.

## What is included

- A run-all notebook: `notebooks/milestone_1_f1_podium_prediction.ipynb`
- Reusable implementation: `src/f1podium/pipeline.py`
- Immutable copies of all 14 Kaggle/Ergast CSV tables in `data/raw/`
- The supplied brief and F1 introduction in `course-materials/milestone-1/`
- Automated tests in `tests/`
- A generated analytical report in `reports/`

The pipeline audits keys and relationships, converts sentinels and semantic types, resolves early shared-drive duplicates, answers the three data-engineering questions, constructs leakage-safe rolling form and prior-standings features, compares two statistical models with a shallow neural network, runs preprocessing and feature-group ablations, produces permutation and SHAP explanations, and demonstrates inference with complete and partial records.

## Reproduce everything

Python 3.11 or 3.12 is recommended.

```powershell
py -3.12 -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
$env:PYTHONPATH = "src"
.\.venv\Scripts\python.exe scripts\build_notebook.py
.\.venv\Scripts\python.exe -m jupyter nbconvert --to notebook --execute notebooks\milestone_1_f1_podium_prediction.ipynb --output milestone_1_f1_podium_prediction.ipynb --ExecutePreprocessor.timeout=1200
.\.venv\Scripts\python.exe -m pytest
```

The notebook regenerates `artifacts/`, which is intentionally ignored because it contains reproducible tables and figures. Raw course resources and dataset CSVs are not ignored.

## Data decisions

- `\\N` is parsed as missing; dates and lap/qualifying times receive semantic types.
- Modeling grain is exactly one row per `(raceId, driverId)`. For shared drives, a row with a real grid start is preferred, followed by best classification and then lowest `resultId`.
- Grid position 0 is retained as a pit-lane indicator and treated as missing for numeric grid position.
- Driver and constructor form use shifted rolling histories. Driver and constructor standings are shifted to the next race within the same season.
- Post-race position, points, status, laps, pit stops, and fastest-lap data never enter the feature matrix.
- Time split: training through 2019, validation in 2020-2021, test in 2022-2024.
- PR-AUC is primary because podiums are rare; ROC-AUC is secondary. F1, precision, and recall use thresholds chosen on validation only.

## Verified results

The final run covers 26,668 unique driver-race rows after resolving 85 duplicate groups. All audited primary keys are unique/non-null and all audited foreign keys reconcile. Exact model scores and figures are embedded in the executed notebook and PDF report; they are generated from the supplied 1950-2024 snapshot rather than hand-entered.

## Repository map

```text
course-materials/milestone-1/  Original, unmodified PDFs
data/raw/                      Original Kaggle/Ergast CSV tables
notebooks/                     Run-all milestone notebook
reports/                       Submission-ready analytical PDF
scripts/                       Reproducible notebook/report runners
src/f1podium/                  Data, modeling, evaluation, and XAI code
tests/                         Integrity, edge-case, and leakage tests
```

## Known limitations

Qualifying coverage is sparse in older eras; constructor renames reset identity history; home-country analysis relies on a documented nationality mapping; rare or ambiguous retirement statuses may escape the conservative mechanical-failure list; and regulation changes create era shift. Model explanations describe reliance, not causality.

