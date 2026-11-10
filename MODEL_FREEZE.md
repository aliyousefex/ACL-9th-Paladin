# Advanced model freeze and prospective evaluation

The current 39-feature advanced model is frozen as a research baseline. Its authoritative manifest is `artifacts/advanced-research/model-freeze.json`, which records the feature list, selected models, residual scale, runtime versions, protocol, and SHA-256 hashes of the implementation and evaluation artifacts.

The official coursework pipeline is separate and unchanged.

## Governance

- The 2022–2024 results remain a retrospective development benchmark, not a pristine final holdout.
- No further model, feature, calibrator, threshold, or uncertainty-scale selection may use that benchmark.
- Future predictions must be generated and sealed before their outcomes are joined.
- Primary prospective metrics are podium Brier score and expected-position MAE, compared with grid baselines on identical races and entrants.
- Uncertainty is calculated by resampling whole races, preserving dependence among drivers in one event.
- Model-selection decisions wait for one complete season or at least 20 races.
- A genuine implementation defect may be fixed, but it creates a separately versioned freeze and both specifications must be reported.

Recreate the manifest only when intentionally creating a new frozen version:

```powershell
python scripts/freeze_advanced_model.py
```

Changing a hashed file after sealing makes the manifest fail its purpose; reviewers should compare the recorded digest with the current file before accepting prospective claims.
