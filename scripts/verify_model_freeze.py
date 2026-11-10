"""Fail when the sealed advanced-model contract or its published mirror drifts."""

from __future__ import annotations

import hashlib
import csv
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def load(relative: str) -> dict:
    return json.loads((ROOT / relative).read_text(encoding="utf-8"))


def main() -> None:
    freeze = load("artifacts/advanced-research/model-freeze.json")
    summary = load("artifacts/advanced-research/summary.json")
    published = load("ui/src/data/advanced-summary.json")
    errors: list[str] = []

    if freeze.get("contract") != "paladin.advanced-model-freeze.v1":
        errors.append("unexpected freeze contract")
    if freeze.get("dataThrough") != 2024:
        errors.append("unexpected frozen data boundary")

    for relative, expected in freeze.get("sha256", {}).items():
        path = ROOT / relative
        if not path.is_file():
            errors.append(f"missing sealed file: {relative}")
            continue
        actual = hashlib.sha256(path.read_bytes()).hexdigest()
        if actual != expected:
            errors.append(f"SHA-256 mismatch: {relative}")

    specification = freeze.get("specification", {})
    expected_contract = {
        "features": summary.get("features"),
        "finishModel": summary.get("selectedFinishModel"),
        "dnfModel": summary.get("selectedDnfModel"),
        "residualScale": summary.get("selectedResidualScale"),
        "evaluationStatus": summary.get("evaluationStatus"),
    }
    if specification != expected_contract:
        errors.append("freeze specification differs from advanced research summary")
    for key, expected in summary.items():
        if published.get(key) != expected:
            errors.append(f"published UI research summary differs at {key}")
    calibration_path = ROOT / "artifacts/advanced-research/podium_calibration.csv"
    with calibration_path.open(encoding="utf-8", newline="") as handle:
        calibration = [
            {key: int(value) if key == "rows" else round(float(value), 6) for key, value in row.items()}
            for row in csv.DictReader(handle)
        ]
    if published.get("calibration") != calibration:
        errors.append("published UI calibration differs from source calibration artifact")

    status = str(specification.get("evaluationStatus", "")).lower()
    if "retrospective" not in status or "not a pristine final holdout" not in status:
        errors.append("evaluation status does not disclose retrospective/non-pristine evidence")
    if summary.get("officialCourseworkBaselineChanged") is not False:
        errors.append("coursework baseline change flag is not false")

    if errors:
        raise SystemExit("Model freeze verification failed:\n- " + "\n- ".join(errors))
    print(f"Model freeze verified: {len(freeze['sha256'])} hashes, {len(specification['features'])} features, UI contract exact")


if __name__ == "__main__":
    main()
