from __future__ import annotations

import numpy as np
import pandas as pd

from f1podium.pipeline import (
    FEATURES,
    _time_to_seconds,
    build_modeling_table,
    clean_results,
    load_raw_tables,
    split_by_time,
)


def test_duration_parser_handles_valid_and_missing_values():
    assert _time_to_seconds("1:23.456") == 83.456
    assert _time_to_seconds("59.1") == 59.1
    assert np.isnan(_time_to_seconds(np.nan))
    assert np.isnan(_time_to_seconds("not-a-time"))


def test_duplicate_rule_prefers_a_started_car_then_best_finish():
    rows = pd.DataFrame([
        {"raceId": 1, "driverId": 7, "resultId": 1, "grid": 0, "positionOrder": 1},
        {"raceId": 1, "driverId": 7, "resultId": 2, "grid": 4, "positionOrder": 8},
        {"raceId": 1, "driverId": 8, "resultId": 3, "grid": 5, "positionOrder": 7},
        {"raceId": 1, "driverId": 8, "resultId": 4, "grid": 6, "positionOrder": 3},
    ])
    clean, duplicates = clean_results(rows)
    assert len(duplicates) == 2
    assert clean.loc[clean.driverId.eq(7), "resultId"].item() == 2
    assert clean.loc[clean.driverId.eq(8), "resultId"].item() == 4


def test_real_modeling_table_grain_features_and_splits():
    frame, diagnostics = build_modeling_table(load_raw_tables("data/raw"))
    assert diagnostics["unique_grain"]
    assert not frame.duplicated(["raceId", "driverId"]).any()
    assert set(frame.podium.unique()) <= {0, 1}
    assert set(FEATURES) <= set(frame.columns)
    splits = split_by_time(frame)
    assert splits["train"].year.max() == 2019
    assert set(splits["validation"].year.unique()) == {2020, 2021}
    assert splits["test"].year.min() == 2022


def test_form_features_cannot_see_current_target():
    frame, _ = build_modeling_table(load_raw_tables("data/raw"))
    first = frame.sort_values(["date", "raceId"]).groupby("driverId").head(1)
    assert first.driver_podium_rate_5.isna().all()
    assert (first.driver_races_before == 0).all()
    constructor_first_races = (frame.sort_values(["date", "raceId"])
                               .groupby("constructorId").raceId.first().reset_index())
    first_constructor_rows = frame.merge(constructor_first_races, on=["constructorId", "raceId"])
    assert first_constructor_rows.constructor_podium_rate_5.isna().all()


def test_randomized_duplicate_cleaning_is_deterministic_and_unique():
    rng = np.random.default_rng(903)
    size = 20_000
    rows = pd.DataFrame({
        "raceId": rng.integers(1, 300, size),
        "driverId": rng.integers(1, 500, size),
        "resultId": np.arange(size),
        "grid": rng.integers(0, 31, size),
        "positionOrder": rng.integers(1, 31, size),
    })
    clean_a, _ = clean_results(rows)
    clean_b, _ = clean_results(rows.sample(frac=1, random_state=42))
    assert not clean_a.duplicated(["raceId", "driverId"]).any()
    pd.testing.assert_frame_equal(
        clean_a.sort_values("resultId").reset_index(drop=True),
        clean_b.sort_values("resultId").reset_index(drop=True),
    )

