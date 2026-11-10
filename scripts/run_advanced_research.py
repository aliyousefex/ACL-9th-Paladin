"""Run the separate advanced research pipeline without changing coursework artifacts."""

from __future__ import annotations

import json
from pathlib import Path
import sys

import pandas as pd

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "src"))
from f1podium.advanced import run_advanced_research
from f1podium.pipeline import load_raw_tables


def main() -> None:
    source = ROOT / "artifacts" / "modeling_table.csv"
    if not source.exists():
        raise SystemExit("Run scripts/run_analysis.py first; the official modeling table is missing.")
    tables = load_raw_tables(ROOT / "data" / "raw")
    summary = run_advanced_research(pd.read_csv(source, low_memory=False), ROOT / "artifacts" / "advanced-research", course_tables=tables)
    print(json.dumps(summary, indent=2))


if __name__ == "__main__":
    main()
