# Paladin advanced decision intelligence

> Reproducible research extension. The official coursework classifier and its artifacts remain unchanged.

## Executive result

The selected **Ridge + HGB ensemble** improves retrospective-benchmark expected-position MAE to **3.021**, versus **3.511** for grid position. Its podium Brier score is **0.068**, versus **0.105** for the grid baseline. Evaluation covers **68 races / 1359 driver-race rows from 2022–2024**.

Uncertainty was selected on pre-test validation data at a residual scale of **0.55**. The resulting test calibration gap is **0.85 percentage points**. DNF probability uses **Histogram gradient boosting** with validation-only Platt calibration.

**Governance warning:** Retrospective development benchmark; 2022-2024 has been reviewed during successive product iterations and is not a pristine final holdout. The paired race bootstrap estimates a Brier improvement of **0.037** (95% interval **0.027 to 0.048**) and a position-MAE improvement of **0.493** (95% interval **0.316 to 0.669**). These intervals cover race sampling, not repeated-development bias.

## Rolling-origin robustness audit

A frozen-specification expanding-window audit across 2019–2024 covers **128 races / 2559 rows**. It records podium Brier **0.067** versus grid **0.096**, and position MAE **3.213** versus grid **3.504**.

Protocol: For evaluation year Y, fit through Y-2, estimate residuals on Y-1, use fixed residual scale 1.0, and evaluate Y once. This is still retrospective: the architecture and feature set were frozen only after later-year development.

## Evaluation protocol

- Training and feature history are chronological; rolling and circuit aggregates are shifted before joining to a race.
- 2020 calibrates DNF probability and 2021 selects models and uncertainty scale. The 2022–2024 benchmark is temporally later, but no longer pristine because successive development phases inspected it.
- Joint finishing orders are sampled from validation residuals, then made internally coherent with one position per classified finisher.
- DNF is modeled separately. Tyres, weather, damage and safety-car causes are not invented because the source data does not contain them.

## Finish-model validation

| Candidate | Rank MAE | Finish-percentile MAE | Race Spearman |
|---|---:|---:|---:|
| Random forest | 3.326 | 0.179 | 0.652 |
| Ridge + HGB ensemble | 3.326 | 0.177 | 0.651 |
| Ridge | 3.344 | 0.178 | 0.648 |
| Three-model ensemble | 3.346 | 0.177 | 0.646 |
| Histogram gradient boosting | 3.369 | 0.178 | 0.649 |

## DNF-model validation

| Candidate | Brier | ROC AUC | PR AUC |
|---|---:|---:|---:|
| Histogram gradient boosting | 0.117 | 0.538 | 0.156 |
| Logistic regression | 0.125 | 0.570 | 0.172 |
| Random forest | 0.127 | 0.555 | 0.166 |

## Feature-family ablation

| Feature set | Features | Rank MAE | Race Spearman |
|---|---:|---:|---:|
| all | 39 | 3.369 | 0.649 |
| without teammate context | 37 | 3.390 | 0.646 |
| without circuit history | 32 | 3.392 | 0.648 |
| official 16 only | 16 | 3.400 | 0.643 |
| without reliability | 33 | 3.413 | 0.644 |
| without form and consistency | 33 | 3.444 | 0.639 |

## Retrospective benchmark error slices

| Slice | Rows | Position MAE | Podium Brier |
|---|---:|---:|---:|
| 2022 | 440 | 3.363 | 0.067 |
| 2023 | 440 | 3.007 | 0.066 |
| 2024 | 479 | 2.719 | 0.071 |
| front 3 | 203 | 2.836 | 0.198 |
| P4-10 | 474 | 3.100 | 0.092 |
| P11-20 | 642 | 2.925 | 0.013 |
| pit/other | 40 | 4.570 | 0.000 |

## Product interpretation

The UI treats these outputs as bounded evidence: it exposes the calibration passport, links leakage-safe historical analogues, supports reproducible URL scenarios, and labels strategy experiments as assumption-driven simulations. Mid-race forecasts remain approximate state updates rather than live-calibrated claims.

## Reproduce

```powershell
python scripts/run_advanced_research.py
python scripts/run_rolling_origin_audit.py
python scripts/export_advanced_ui_data.py
python scripts/build_advanced_report.py
python scripts/verify.py --full
```
