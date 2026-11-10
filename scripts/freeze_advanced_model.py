"""Seal the advanced research specification before any future data is ingested."""

from __future__ import annotations

import hashlib
import importlib.metadata
import json
from datetime import date
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
TARGET = ROOT / "artifacts" / "advanced-research" / "model-freeze.json"
FILES = [
    "src/f1podium/advanced.py",
    "scripts/run_advanced_research.py",
    "scripts/run_rolling_origin_audit.py",
    "requirements.txt",
    "artifacts/advanced-research/summary.json",
    "artifacts/advanced-research/finish_model_metrics.csv",
    "artifacts/advanced-research/dnf_model_metrics.csv",
    "artifacts/advanced-research/uncertainty_scale_search.csv",
]


def digest(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def main() -> None:
    missing = [name for name in FILES if not (ROOT / name).exists()]
    if missing:
        raise SystemExit(f"Cannot freeze; missing: {', '.join(missing)}")
    summary = json.loads((ROOT / "artifacts/advanced-research/summary.json").read_text(encoding="utf-8"))
    payload = {
        "contract": "paladin.advanced-model-freeze.v1",
        "sealedOn": date.today().isoformat(),
        "dataThrough": 2024,
        "specification": {
            "features": summary["features"],
            "finishModel": summary["selectedFinishModel"],
            "dnfModel": summary["selectedDnfModel"],
            "residualScale": summary["selectedResidualScale"],
            "evaluationStatus": summary["evaluationStatus"],
        },
        "prospectiveProtocol": {
            "eligibleData": "The first complete race records added after this seal that were absent from the repository at seal time.",
            "predictions": "Generate and timestamp predictions before joining results; never rewrite a sealed prediction.",
            "primaryMetrics": ["driver-row podium Brier score", "expected-position MAE"],
            "comparison": "Paired grid baseline on identical races and entrants, with race-level bootstrap intervals.",
            "minimumWindow": "One complete season or at least 20 races before model-selection decisions.",
            "changePolicy": "Defect fixes create a new freeze version and are evaluated separately; no tuning on the prospective window.",
        },
        "runtime": {name: importlib.metadata.version(name) for name in ("numpy", "pandas", "scikit-learn", "matplotlib")},
        "sha256": {name: digest(ROOT / name) for name in FILES},
    }
    TARGET.write_text(json.dumps(payload, indent=2), encoding="utf-8")
    print(f"Sealed {TARGET.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
