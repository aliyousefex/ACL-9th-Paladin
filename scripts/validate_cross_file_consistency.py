"""Fail if the executed notebook, report source, and saved evidence drift apart.

Run after executing the notebook and generating the LaTeX report.  The check covers
every numeric table shared by those deliverables: model scores, tuning, uncertainty,
the three forest explanations, the selected-model explanations, and key audits.
"""

from __future__ import annotations

import json
from pathlib import Path

import numpy as np
import pandas as pd

ROOT = Path(__file__).resolve().parents[1]
ART = ROOT / "artifacts"
FIG = ART / "figures"
NOTEBOOK = ROOT / "notebooks" / "milestone_1_f1_podium_prediction.ipynb"
REPORT = ROOT / "reports" / "milestone_1_analytical_report.tex"


def notebook_output_text() -> str:
    notebook = json.loads(NOTEBOOK.read_text(encoding="utf-8"))
    outputs = []
    counts = []
    for cell in notebook["cells"]:
        if cell.get("cell_type") != "code":
            continue
        counts.append(cell.get("execution_count"))
        for output in cell.get("outputs", []):
            if output.get("output_type") == "error":
                raise AssertionError(f"Notebook error output: {output.get('ename')}: {output.get('evalue')}")
            outputs.append(json.dumps(output, ensure_ascii=False, sort_keys=True))
    assert counts == list(range(1, len(counts) + 1)), f"Notebook execution counts are not clean: {counts}"
    return "\n".join(outputs)


def require_number(text: str, value: float, decimals: int, context: str, signed: bool = False) -> None:
    if not np.isfinite(value):
        return
    token = f"{value:+.{decimals}f}" if signed else f"{value:.{decimals}f}"
    compact = token.rstrip("0").rstrip(".")
    tex_token = "$-$" + token[1:] if token.startswith("-") else token
    tex_compact = "$-$" + compact[1:] if compact.startswith("-") else compact
    assert any(candidate in text for candidate in (token, compact, tex_token, tex_compact)), \
        f"{context}: {token} is absent"


def main() -> None:
    notebook = notebook_output_text()
    report = REPORT.read_text(encoding="utf-8")

    # Complete relational evidence must be visible in the notebook and generated report.
    pk = pd.read_csv(ART / "primary_key_audit.csv")
    fk = pd.read_csv(ART / "foreign_key_audit.csv")
    assert len(pk) == 14 and {"lap_times", "pit_stops", "sprint_results"} <= set(pk.table)
    assert len(fk) == 22 and not fk.orphans.any()
    for row in pk.itertuples(index=False):
        assert str(row.table) in notebook and str(int(row.rows)) in notebook
        assert str(row.table).replace("_", r"\_") in report and f"{int(row.rows):,}" in report
    for row in fk.itertuples(index=False):
        relationship = str(row.relationship)
        assert relationship in notebook
        report_relationship = relationship.replace("_", r"\_").replace("->", r"$\rightarrow$")
        assert report_relationship in report

    # Notebook tables use pandas' six-decimal display; report tables and prose use three.
    metrics = pd.read_csv(ART / "model_metrics.csv")
    for _, row in metrics.iterrows():
        for column in ["threshold", "ROC-AUC", "PR-AUC", "F1", "Precision", "Recall"]:
            value = float(row[column])
            require_number(notebook, value, 6, f"notebook model_metrics {row['model']}/{row['split']}/{column}")
            require_number(report, value, 3, f"report model_metrics {row['model']}/{row['split']}/{column}")

    tuning = pd.read_csv(ART / "hyperparameter_search.csv")
    for _, row in tuning[tuning.is_current | tuning.selected | tuning.is_initial].iterrows():
        require_number(notebook, float(row["validation_PR-AUC"]), 4, f"notebook tuning {row['model']}")
        require_number(report, float(row["validation_PR-AUC"]), 4, f"report tuning {row['model']}")

    for filename, column, signed in [
        ("validation_uncertainty.csv", "validation_PR-AUC", False),
        ("test_uncertainty.csv", "test_PR-AUC", False),
    ]:
        table = pd.read_csv(ART / filename)
        for value in table[column]:
            require_number(notebook, float(value), 3, f"notebook {filename}", signed=signed)
            require_number(report, float(value), 3, f"report {filename}", signed=signed)

    for filename, column in [
        ("permutation_importance.csv", "importance"),
        ("shap_global.csv", "mean_abs_shap"),
        ("shap_local.csv", "shap_value"),
        ("lime_local.csv", "lime_weight"),
        ("logistic_weights.csv", "coefficient"),
        ("logistic_local.csv", "log_odds_contribution"),
    ]:
        table = pd.read_csv(FIG / filename).head(8)
        for row in table.itertuples(index=False):
            value = float(getattr(row, column))
            # Permutation importance is a report table and a notebook figure; the
            # other five are numeric tables in both deliverables.
            if filename != "permutation_importance.csv":
                require_number(notebook, value, 6, f"notebook {filename}/{row.feature}")
            signed_report = filename not in {"shap_global.csv"}
            require_number(report, value, 3, f"report {filename}/{row.feature}", signed=signed_report)

    summary = json.loads((ART / "summary.json").read_text(encoding="utf-8"))
    for version in summary["runtime_versions"].values():
        assert str(version) in notebook, f"runtime version {version} is absent from notebook outputs"
    print("Cross-file consistency passed for all shared numeric tables, 14 primary-key audits, and 22 foreign-key audits.")


if __name__ == "__main__":
    main()
