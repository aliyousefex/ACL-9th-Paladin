"""Run an expanding-window audit without reusing an evaluation year for fitting.

This is a retrospective robustness audit of the now-frozen Ridge + HGB
specification, not a claim that the specification itself was chosen without
ever seeing later years.
"""

from __future__ import annotations

import json
from pathlib import Path
import sys

import numpy as np
import pandas as pd
from sklearn.metrics import brier_score_loss, mean_absolute_error

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "src"))
from f1podium.advanced import ADVANCED_FEATURES, _distribution_for_race, build_advanced_table, finish_models
from f1podium.pipeline import load_raw_tables

OUT = ROOT / "artifacts" / "advanced-research"


def main() -> None:
    tables = load_raw_tables(ROOT / "data" / "raw")
    frame = build_advanced_table(pd.read_csv(ROOT / "artifacts" / "modeling_table.csv", low_memory=False), tables)
    rows: list[dict[str, float | int]] = []
    driver_rows: list[dict[str, float | int]] = []

    for year in range(2019, 2025):
        train = frame.loc[frame.year.le(year - 2)]
        residual_year = frame.loc[frame.year.eq(year - 1)]
        evaluation = frame.loc[frame.year.eq(year)]
        models = finish_models(random_state=42)
        members = [models["Ridge"], models["Histogram gradient boosting"]]
        for model in members:
            model.fit(train[ADVANCED_FEATURES], train.finish_pct)

        def predict(part: pd.DataFrame) -> np.ndarray:
            return np.mean([model.predict(part[ADVANCED_FEATURES]) for model in members], axis=0)

        residuals = residual_year.finish_pct.to_numpy(float) - predict(residual_year)
        scored = evaluation[["raceId", "driverId", "positionOrder", "podium", "grid_position"]].copy()
        scored["latent"] = predict(evaluation)
        for race_id, group in scored.groupby("raceId", sort=True):
            matrix = _distribution_for_race(group.latent.to_numpy(float), residuals, seed=int(race_id), samples=1200, residual_scale=1.0)
            field = len(group)
            for index, (_, item) in enumerate(group.iterrows()):
                driver_rows.append({
                    "evaluation_year": year,
                    "raceId": int(race_id),
                    "driverId": int(item.driverId),
                    "actual_podium": int(item.podium),
                    "model_podium": float(matrix[index, :3].sum()),
                    "grid_podium": int(item.grid_position <= 3),
                    "actual_position": int(item.positionOrder),
                    "model_position": float(matrix[index] @ np.arange(1, field + 1)),
                    "grid_position": float(item.grid_position if pd.notna(item.grid_position) else field),
                })

        year_frame = pd.DataFrame([item for item in driver_rows if item["evaluation_year"] == year])
        rows.append({
            "evaluation_year": year,
            "train_through": year - 2,
            "residual_year": year - 1,
            "races": int(year_frame.raceId.nunique()),
            "rows": len(year_frame),
            "model_podium_brier": brier_score_loss(year_frame.actual_podium, year_frame.model_podium),
            "grid_podium_brier": brier_score_loss(year_frame.actual_podium, year_frame.grid_podium),
            "model_position_mae": mean_absolute_error(year_frame.actual_position, year_frame.model_position),
            "grid_position_mae": mean_absolute_error(year_frame.actual_position, year_frame.grid_position),
        })

    folds = pd.DataFrame(rows)
    predictions = pd.DataFrame(driver_rows)
    OUT.mkdir(parents=True, exist_ok=True)
    folds.to_csv(OUT / "rolling_origin_folds.csv", index=False)
    predictions.to_csv(OUT / "rolling_origin_predictions.csv", index=False)
    pooled = {
        "status": "Retrospective audit of a frozen specification; feature/model ideation previously saw some evaluation years.",
        "protocol": "For evaluation year Y, fit through Y-2, estimate residuals on Y-1, use fixed residual scale 1.0, and evaluate Y once.",
        "years": [2019, 2020, 2021, 2022, 2023, 2024],
        "races": int(predictions.raceId.nunique()),
        "rows": len(predictions),
        "modelPodiumBrier": float(brier_score_loss(predictions.actual_podium, predictions.model_podium)),
        "gridPodiumBrier": float(brier_score_loss(predictions.actual_podium, predictions.grid_podium)),
        "modelPositionMae": float(mean_absolute_error(predictions.actual_position, predictions.model_position)),
        "gridPositionMae": float(mean_absolute_error(predictions.actual_position, predictions.grid_position)),
    }
    (OUT / "rolling_origin_summary.json").write_text(json.dumps(pooled, indent=2), encoding="utf-8")
    print(json.dumps(pooled, indent=2))


if __name__ == "__main__":
    main()
