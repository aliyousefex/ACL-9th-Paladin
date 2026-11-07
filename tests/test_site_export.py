"""Checks for the website data exporter: its metrics, and that the rebuilt model matches the pipeline.

The exporter needs only numpy and pandas, so these tests do not import scikit-learn.
"""

from __future__ import annotations

import importlib.util
import json
from pathlib import Path

import numpy as np
import pandas as pd
import pytest

ROOT = Path(__file__).resolve().parents[1]
ARTIFACTS = ROOT / "artifacts"

spec = importlib.util.spec_from_file_location("export_site_data", ROOT / "scripts" / "export_site_data.py")
export = importlib.util.module_from_spec(spec)
spec.loader.exec_module(export)  # type: ignore[union-attr]


def test_roc_auc_and_average_precision_known_values():
    y = np.array([0, 0, 1, 1])
    score = np.array([0.1, 0.4, 0.35, 0.8])
    # the textbook example: ROC-AUC 0.75, average precision 0.8333...
    assert export.roc_auc(y, score) == pytest.approx(0.75)
    assert export.average_precision(y, score) == pytest.approx(0.8333333333)


def test_ties_use_average_ranks_and_distinct_thresholds():
    y = np.array([1, 0, 1, 0])
    score = np.array([0.5, 0.5, 0.5, 0.5])
    assert export.roc_auc(y, score) == pytest.approx(0.5)
    assert export.average_precision(y, score) == pytest.approx(0.5)


def test_threshold_metrics():
    y = np.array([1, 1, 0, 0, 1])
    score = np.array([0.9, 0.4, 0.7, 0.1, 0.8])
    m = export.threshold_metrics(y, score, 0.5)  # predicted: 1, 0, 1, 0, 1
    assert m["Precision"] == pytest.approx(2 / 3)
    assert m["Recall"] == pytest.approx(2 / 3)
    assert m["F1"] == pytest.approx(2 / 3)


def test_feature_list_matches_the_pipeline_without_importing_it():
    source = (ROOT / "src" / "f1podium" / "pipeline.py").read_text(encoding="utf-8")
    for feature in export.FEATURES:
        assert f'"{feature}"' in source
    assert "round" not in export.FEATURES  # removed after the context-feature experiment
    assert len(export.FEATURES) == 16


@pytest.mark.skipif(not (ARTIFACTS / "modeling_table.csv").exists(), reason="run scripts/run_analysis.py first")
def test_rebuilt_logistic_regression_reproduces_the_saved_metrics():
    table = pd.read_csv(ARTIFACTS / "modeling_table.csv", low_memory=False)
    model = export.SelectedModel(table)
    report = model.verify(table)  # raises SystemExit on any mismatch
    for split in ("train", "validation", "test"):
        assert report[split]["maxAbsDifference"] < 1e-9
    assert report["explainedRow"]["probabilityDifference"] < 1e-12


@pytest.mark.skipif(not (ARTIFACTS / "modeling_table.csv").exists(), reason="run scripts/run_analysis.py first")
def test_scores_are_probabilities_and_threshold_comes_from_validation():
    table = pd.read_csv(ARTIFACTS / "modeling_table.csv", low_memory=False)
    model = export.SelectedModel(table)
    scores = model.score(table[export.FEATURES].to_numpy(float))
    assert np.all((scores >= 0) & (scores <= 1))
    summary = json.loads((ARTIFACTS / "summary.json").read_text(encoding="utf-8"))
    assert model.threshold == pytest.approx(summary["thresholds"]["Logistic regression"])


def test_slugs_and_text_repairs():
    assert export.slugify("São Paulo") == "sao-paulo"
    assert export.slugify("Emilia Romagna") == "emilia-romagna"
    assert export.fix("S�o Paulo Grand Prix") == "São Paulo Grand Prix"
