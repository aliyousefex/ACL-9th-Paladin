from __future__ import annotations

import pandas as pd
import pytest

from f1podium.advanced import ADVANCED_FEATURES, _race_bootstrap_comparison, build_advanced_table
from f1podium.pipeline import FEATURES


@pytest.fixture(scope="module")
def modeling() -> pd.DataFrame:
    return pd.read_csv("artifacts/modeling_table.csv", low_memory=False)


def test_advanced_features_extend_without_replacing_official_contract(modeling: pd.DataFrame):
    advanced = build_advanced_table(modeling)
    assert FEATURES == ADVANCED_FEATURES[: len(FEATURES)]
    assert len(ADVANCED_FEATURES) == len(FEATURES) + 23
    assert len(advanced) == len(modeling)
    assert not advanced.duplicated(["raceId", "driverId"]).any()


def test_current_outcome_cannot_change_its_own_advanced_history(modeling: pd.DataFrame):
    ordered = modeling.sort_values(["date", "raceId", "driverId"]).reset_index(drop=True)
    # Choose a row whose driver and constructor both have established history.
    index = ordered.index[(ordered.driver_races_before > 20) & (ordered.year > 2000)][20]
    original = build_advanced_table(ordered)
    mutated = ordered.copy()
    mutated.loc[index, "positionOrder"] = 1 if ordered.loc[index, "positionOrder"] > 1 else int(ordered.loc[index, "field_size"])
    mutated.loc[index, "positionText"] = "R" if str(ordered.loc[index, "positionText"]).isdigit() else "1"
    changed = build_advanced_table(mutated)
    historical = [
        "driver_finish_pct_5", "constructor_finish_pct_5", "driver_dnf_rate_10",
        "constructor_dnf_rate_10", "driver_circuit_finish_pct", "constructor_circuit_finish_pct",
    ]
    pd.testing.assert_series_equal(original.loc[index, historical], changed.loc[index, historical], check_names=False)


def test_same_race_teammate_outcome_cannot_leak_through_constructor_features(modeling: pd.DataFrame):
    ordered = modeling.sort_values(["date", "raceId", "driverId"]).reset_index(drop=True)
    groups = ordered.groupby(["raceId", "constructorId"]).filter(lambda group: len(group) >= 2)
    race_id, constructor_id = groups.loc[groups.year > 2000, ["raceId", "constructorId"]].iloc[30]
    indices = ordered.index[(ordered.raceId == race_id) & (ordered.constructorId == constructor_id)].tolist()
    original = build_advanced_table(ordered)
    mutated = ordered.copy()
    mutated.loc[indices[0], "positionOrder"] = int(mutated.loc[indices[0], "field_size"])
    mutated.loc[indices[0], "positionText"] = "R"
    changed = build_advanced_table(mutated)
    columns = ["constructor_finish_pct_5", "constructor_dnf_rate_10", "constructor_circuit_finish_pct"]
    for index in indices:
        pd.testing.assert_series_equal(original.loc[index, columns], changed.loc[index, columns], check_names=False)


def test_race_bootstrap_is_paired_and_reports_improvement_direction():
    scored = pd.DataFrame({
        "raceId": [1, 1, 2, 2],
        "podium": [0.9, 0.1, 0.8, 0.2],
        "actualPodium": [1, 0, 1, 0],
        "gridPodium": [0, 1, 0, 1],
        "expectedPosition": [1.2, 1.8, 1.1, 1.9],
        "actualPosition": [1, 2, 1, 2],
        "gridExpectedPosition": [2, 1, 2, 1],
    })
    samples, summary = _race_bootstrap_comparison(scored, draws=200, seed=7)
    assert len(samples) == 200
    assert summary["unit"] == "race"
    assert summary["podiumBrierImprovement"]["lower95"] > 0
    assert summary["positionMaeImprovement"]["lower95"] > 0
