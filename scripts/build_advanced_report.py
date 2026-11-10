"""Build a concise, reproducible research note from advanced model artifacts."""

from __future__ import annotations

import csv
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "artifacts" / "advanced-research"
TARGET = ROOT / "reports" / "advanced-decision-intelligence.md"


def rows(name: str) -> list[dict[str, str]]:
    with (SOURCE / name).open(encoding="utf-8", newline="") as handle:
        return list(csv.DictReader(handle))


def metric(value: float, digits: int = 3) -> str:
    return f"{value:.{digits}f}"


def main() -> None:
    summary = json.loads((SOURCE / "summary.json").read_text(encoding="utf-8"))
    rolling = json.loads((SOURCE / "rolling_origin_summary.json").read_text(encoding="utf-8"))
    ablations = rows("feature_family_ablation.csv")
    slices = rows("error_slices.csv")
    finish = rows("finish_model_metrics.csv")
    dnf = rows("dnf_model_metrics.csv")
    finish_validation = [item for item in finish if item["split"] == "validation"]
    dnf_validation = [item for item in dnf if item["split"] == "validation"]
    test = summary["test"]
    year_slices = [item for item in slices if item["slice"] == "year"]
    grid_slices = [item for item in slices if item["slice"] == "grid_band"]

    lines = [
        "# Paladin advanced decision intelligence",
        "",
        "> Reproducible research extension. The official coursework classifier and its artifacts remain unchanged.",
        "",
        "## Executive result",
        "",
        f"The selected **{summary['selectedFinishModel']}** improves retrospective-benchmark expected-position MAE to **{metric(test['expectedPositionMAE'])}**, versus **{metric(test['gridPositionMAE'])}** for grid position. Its podium Brier score is **{metric(test['podiumBrier'])}**, versus **{metric(test['gridPodiumBrier'])}** for the grid baseline. Evaluation covers **{test['races']} races / {test['rows']} driver-race rows from 2022–2024**.",
        "",
        f"Uncertainty was selected on pre-test validation data at a residual scale of **{summary['selectedResidualScale']}**. The resulting test calibration gap is **{metric(summary['testCalibrationError'] * 100, 2)} percentage points**. DNF probability uses **{summary['selectedDnfModel']}** with validation-only Platt calibration.",
        "",
        f"**Governance warning:** {summary['evaluationStatus']} The paired race bootstrap estimates a Brier improvement of **{metric(summary['raceBootstrap']['podiumBrierImprovement']['estimate'])}** (95% interval **{metric(summary['raceBootstrap']['podiumBrierImprovement']['lower95'])} to {metric(summary['raceBootstrap']['podiumBrierImprovement']['upper95'])}**) and a position-MAE improvement of **{metric(summary['raceBootstrap']['positionMaeImprovement']['estimate'])}** (95% interval **{metric(summary['raceBootstrap']['positionMaeImprovement']['lower95'])} to {metric(summary['raceBootstrap']['positionMaeImprovement']['upper95'])}**). These intervals cover race sampling, not repeated-development bias.",
        "",
        "## Rolling-origin robustness audit",
        "",
        f"A frozen-specification expanding-window audit across 2019–2024 covers **{rolling['races']} races / {rolling['rows']} rows**. It records podium Brier **{metric(rolling['modelPodiumBrier'])}** versus grid **{metric(rolling['gridPodiumBrier'])}**, and position MAE **{metric(rolling['modelPositionMae'])}** versus grid **{metric(rolling['gridPositionMae'])}**.",
        "",
        f"Protocol: {rolling['protocol']} This is still retrospective: the architecture and feature set were frozen only after later-year development.",
        "",
        "## Evaluation protocol",
        "",
        "- Training and feature history are chronological; rolling and circuit aggregates are shifted before joining to a race.",
        "- 2020 calibrates DNF probability and 2021 selects models and uncertainty scale. The 2022–2024 benchmark is temporally later, but no longer pristine because successive development phases inspected it.",
        "- Joint finishing orders are sampled from validation residuals, then made internally coherent with one position per classified finisher.",
        "- DNF is modeled separately. Tyres, weather, damage and safety-car causes are not invented because the source data does not contain them.",
        "",
        "## Finish-model validation",
        "",
        "| Candidate | Rank MAE | Finish-percentile MAE | Race Spearman |",
        "|---|---:|---:|---:|",
    ]
    for item in sorted(finish_validation, key=lambda row: float(row["rank_mae"])):
        lines.append(f"| {item['model']} | {metric(float(item['rank_mae']))} | {metric(float(item['finish_pct_mae']))} | {metric(float(item['race_spearman']))} |")

    lines += [
        "",
        "## DNF-model validation",
        "",
        "| Candidate | Brier | ROC AUC | PR AUC |",
        "|---|---:|---:|---:|",
    ]
    for item in sorted(dnf_validation, key=lambda row: float(row["brier"])):
        lines.append(f"| {item['model']} | {metric(float(item['brier']))} | {metric(float(item['roc_auc']))} | {metric(float(item['pr_auc']))} |")

    lines += [
        "",
        "## Feature-family ablation",
        "",
        "| Feature set | Features | Rank MAE | Race Spearman |",
        "|---|---:|---:|---:|",
    ]
    for item in ablations:
        lines.append(f"| {item['feature_set'].replace('_', ' ')} | {item['features']} | {metric(float(item['validation_rank_mae']))} | {metric(float(item['validation_race_spearman']))} |")

    lines += [
        "",
        "## Retrospective benchmark error slices",
        "",
        "| Slice | Rows | Position MAE | Podium Brier |",
        "|---|---:|---:|---:|",
    ]
    for item in year_slices + grid_slices:
        lines.append(f"| {item['value']} | {item['rows']} | {metric(float(item['position_mae']))} | {metric(float(item['podium_brier']))} |")

    lines += [
        "",
        "## Product interpretation",
        "",
        "The UI treats these outputs as bounded evidence: it exposes the calibration passport, links leakage-safe historical analogues, supports reproducible URL scenarios, and labels strategy experiments as assumption-driven simulations. Mid-race forecasts remain approximate state updates rather than live-calibrated claims.",
        "",
        "## Reproduce",
        "",
        "```powershell",
        "python scripts/run_advanced_research.py",
        "python scripts/run_rolling_origin_audit.py",
        "python scripts/export_advanced_ui_data.py",
        "python scripts/build_advanced_report.py",
        "python scripts/verify.py --full",
        "```",
        "",
    ]
    TARGET.parent.mkdir(parents=True, exist_ok=True)
    TARGET.write_text("\n".join(lines), encoding="utf-8")
    print(f"Wrote {TARGET.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
