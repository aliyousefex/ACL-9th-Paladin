"""Publish advanced research outputs as compact, lazy-loaded UI contracts."""

from __future__ import annotations

import json
from pathlib import Path

import pandas as pd
import numpy as np

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "artifacts" / "advanced-research"
PUBLIC = ROOT / "ui" / "public" / "data" / "advanced"
SRC = ROOT / "ui" / "src" / "data" / "advanced-summary.json"
INDEX = ROOT / "ui" / "src" / "data" / "advanced-index.json"


def main() -> None:
    summary_path = SOURCE / "summary.json"
    distributions_path = SOURCE / "test_distributions.json"
    if not summary_path.exists() or not distributions_path.exists():
        raise SystemExit("Run scripts/run_advanced_research.py first.")
    summary = json.loads(summary_path.read_text(encoding="utf-8"))
    rows = pd.read_json(distributions_path)
    PUBLIC.mkdir(parents=True, exist_ok=True)
    for race_id, group in rows.groupby("raceId", sort=True):
        drivers = []
        for row in group.itertuples(index=False):
            drivers.append({
                "d": int(row.driverId), "w": round(float(row.win), 6),
                "p": round(float(row.podium), 6), "e": round(float(row.expectedPosition), 4),
                "x": round(float(row.expectedPoints), 4), "r": round(float(row.dnf), 6),
                "o": row.positions,
            })
        payload = {
            "contract": summary["contract"], "raceId": int(race_id),
            "finishModel": summary["selectedFinishModel"], "dnfModel": summary["selectedDnfModel"],
            "drivers": drivers,
            "provenance": {"source": "coursework modeling table", "split": "retrospective development benchmark 2022-2024", "kind": "estimated"},
        }
        (PUBLIC / f"{int(race_id)}.json").write_text(json.dumps(payload, separators=(",", ":")), encoding="utf-8")
    calibration_path = SOURCE / "podium_calibration.csv"
    summary["calibration"] = pd.read_csv(calibration_path).round(6).to_dict("records") if calibration_path.exists() else []
    SRC.write_text(json.dumps(summary, indent=2), encoding="utf-8")
    race_meta = {int(row["id"]): row for row in json.loads((ROOT / "ui" / "src" / "data" / "races.json").read_text(encoding="utf-8"))}
    index = []
    for race_id, group in rows.groupby("raceId", sort=True):
        meta = race_meta[int(race_id)]
        probabilities = group.podium.clip(1e-9, 1 - 1e-9)
        index.append({
            "id": int(race_id), "year": int(meta["year"]), "circuitId": int(meta["circuitId"]), "field": int(len(group)),
            "meanDnf": round(float(group.dnf.mean()), 6), "frontier": round(float(group.nlargest(3, "podium").podium.mean()), 6),
            "uncertainty": round(float((-(probabilities * np.log(probabilities) + (1 - probabilities) * np.log(1 - probabilities))).mean()), 6),
            "expectedSpread": round(float(group.expectedPosition.std()), 6),
        })
    INDEX.write_text(json.dumps(index, separators=(",", ":")), encoding="utf-8")
    print(f"Exported {rows.raceId.nunique()} advanced race files and {len(rows)} driver distributions.")


if __name__ == "__main__":
    main()
