"""Checks for the quiet data mistakes we do not want to discover in evaluation.

The tests use direct examples so the setup, action, and expected result remain easy
to inspect.
"""

from __future__ import annotations

import numpy as np
import pandas as pd

from f1podium.pipeline import (
    FEATURES,
    MECHANICAL_TERMS,
    NON_START_STATUSES,
    INITIAL_SETTINGS,
    SEARCH_SPACE,
    feature_eda,
    _current_params,
    _time_to_seconds,
    build_modeling_table,
    clean_results,
    cleaning_eda,
    engineering_answers,
    load_raw_tables,
    non_starter_audit,
    preprocessing_effects,
    preprocessing_order_experiments,
    split_by_time,
    split_integrity,
    split_summary,
    split_window_experiment,
    sprint_weekend_check,
)

# These tests focus on mistakes that can make the final scores look believable
# while the data is actually wrong. A plot can still look reasonable after leakage,
# so we check the grain and timing rules directly.


def test_duration_parser_handles_valid_and_missing_values():
    """Normal lap strings become seconds; messy values stay honestly missing."""
    assert _time_to_seconds("1:23.456") == 83.456
    assert _time_to_seconds("59.1") == 59.1
    assert np.isnan(_time_to_seconds(np.nan))
    assert np.isnan(_time_to_seconds("not-a-time"))


def test_duplicate_rule_prefers_a_started_car_then_best_finish():
    """A shared drive keeps the car that started, not the tempting best result."""
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
    """The real dataset must keep one prediction row and the agreed year cuts."""
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
    """A driver's current podium must never enter the current form feature."""
    frame, _ = build_modeling_table(load_raw_tables("data/raw"))
    first = frame.sort_values(["date", "raceId"]).groupby("driverId").head(1)
    assert first.driver_podium_rate_5.isna().all()
    assert (first.driver_races_before == 0).all()
    constructor_first_races = (frame.sort_values(["date", "raceId"])
                               .groupby("constructorId").raceId.first().reset_index())
    first_constructor_rows = frame.merge(constructor_first_races, on=["constructorId", "raceId"])
    assert first_constructor_rows.constructor_podium_rate_5.isna().all()


def test_randomized_duplicate_cleaning_is_deterministic_and_unique():
    """Changing row order must not change the retained shared-drive record."""
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


def test_mechanical_rate_denominator_contains_race_starts_only():
    """Mechanical rates use actual starters and exclude recorded non-starters."""
    tables = load_raw_tables("data/raw")
    frame, _ = build_modeling_table(tables)
    answers = engineering_answers(frame, tables)
    status = tables["status"].set_index("statusId")["status"]
    modern = frame[frame.year.between(2014, 2024)].copy()
    modern["status_text"] = modern.statusId.map(status)
    valid = modern[~modern.status_text.isin(NON_START_STATUSES)].copy()
    valid["era"] = np.where(valid.year <= 2021, "2014-2021", "2022-2024")
    expected = (valid.groupby(["era", "constructor_name"]).size().rename("expected_count")
                .reset_index().query("expected_count >= 20"))
    reported = answers["mechanical_retirements"][["era", "constructor_name", "count"]]
    check = reported.merge(expected, on=["era", "constructor_name"], validate="one_to_one")

    assert len(check) == len(reported) == len(expected)
    assert (check["count"] == check["expected_count"]).all()
    assert not modern.loc[modern.status_text.isin(NON_START_STATUSES), "status_text"].empty


def test_mechanical_statuses_follow_instructor_ruling():
    """Piazza @10: tyre, puncture, fire and safety-belt statuses count; refuelling does not."""
    status = load_raw_tables("data/raw")["status"]["status"]
    for term in ["Puncture", "Tyre", "Tyre puncture", "Fire", "Safety belt"]:
        assert term in set(status), f"{term} is not a real status label"
        assert term in MECHANICAL_TERMS
    assert "Refuelling" not in MECHANICAL_TERMS


def test_current_race_result_cannot_change_its_own_features():
    """Changing today's result may change the label, but never today's inputs."""
    tables = load_raw_tables("data/raw")
    original, _ = build_modeling_table(tables)
    latest_race = int(original.loc[original.date.eq(original.date.max()), "raceId"].max())

    changed_tables = {name: table.copy() for name, table in tables.items()}
    current = changed_tables["results"].raceId.eq(latest_race)
    changed_tables["results"].loc[current, "positionOrder"] = 99
    changed, _ = build_modeling_table(changed_tables)

    left = original[original.raceId.eq(latest_race)].sort_values("driverId").reset_index(drop=True)
    right = changed[changed.raceId.eq(latest_race)].sort_values("driverId").reset_index(drop=True)
    pd.testing.assert_frame_equal(left[FEATURES], right[FEATURES])
    assert not left.podium.equals(right.podium)


def test_cleaning_eda_quantifies_grain_change_without_duplicates():
    """Cleaning fixes duplicate grain without quietly moving the podium rate."""
    tables = load_raw_tables("data/raw")
    frame, _ = build_modeling_table(tables)
    comparison = cleaning_eda(tables["results"], frame).set_index("stage")

    raw = comparison.loc["Raw results"]
    clean = comparison.loc["Cleaned modeling table"]
    assert raw.rows > raw.unique_driver_races
    assert raw.duplicate_rows > 0
    assert clean.rows == clean.unique_driver_races
    assert clean.duplicate_rows == 0
    assert abs(raw.podium_rate - clean.podium_rate) < 0.001


def test_split_is_complete_disjoint_and_ordered():
    """Every row lands in one split, no race straddles two, and time only moves forward."""
    frame, _ = build_modeling_table(load_raw_tables("data/raw"))
    integrity = split_integrity(frame)
    assert integrity.passed.all(), integrity[~integrity.passed]
    summary = split_summary(frame).set_index("split")
    assert summary.rows.sum() == len(frame)
    assert abs(summary.share_of_rows.sum() - 1) < 1e-9


def test_preprocessing_is_fitted_on_training_rows_only():
    """Fill values are training medians, and only training is exactly centred by the scaler."""
    frame, _ = build_modeling_table(load_raw_tables("data/raw"))
    train = split_by_time(frame)["train"]
    effects = preprocessing_effects(frame).set_index("feature")
    for feature in FEATURES:
        assert np.isclose(effects.loc[feature, "fill_value"], train[feature].median())
    assert effects.isna().sum().sum() == 0
    assert np.allclose(effects.scaled_mean, 0, atol=1e-9)
    complete = effects.missing_share.eq(0)
    assert np.allclose(effects.loc[complete, "std_change_from_imputation"], 0, atol=1e-9)
    assert (effects.loc[~complete, "std_change_from_imputation"] != 0).all()


def test_preprocessing_order_experiments_report_two_or_more_orders():
    """The order experiments must swap steps and record how missing cells are filled."""
    frame, _ = build_modeling_table(load_raw_tables("data/raw"))
    result = preprocessing_order_experiments(frame)
    assert result.groupby("experiment").order.nunique().ge(2).sum() >= 2
    rows = result[result.model.eq("Logistic regression")].set_index("order")
    # Zero-filling before scaling writes a literal zero; after scaling it means the training mean.
    assert rows.loc["zero-fill -> scale", "missing_grid_position_becomes"] == 0
    train = split_by_time(frame)["train"]
    assert np.isclose(rows.loc["scale -> zero-fill", "missing_grid_position_becomes"], train.grid_position.mean())


def test_hyperparameter_search_includes_the_settings_we_use():
    """The tuning grid must contain each model's current settings, so 'used' is one candidate."""
    for name, grid in SEARCH_SPACE.items():
        assert _current_params(name) in grid, name
        assert INITIAL_SETTINGS[name] in grid, name


def test_validation_windows_never_reach_the_test_seasons():
    """Every alternative validation window ends before 2022 and trains only on earlier seasons."""
    frame, _ = build_modeling_table(load_raw_tables("data/raw"))
    windows = split_window_experiment(frame)
    assert (windows.validation_window.str[5:9].astype(int) <= 2021).all()
    assert (windows.train_years.str[-4:].astype(int) < windows.validation_window.str[:4].astype(int)).all()


def test_sprint_results_end_before_the_race_and_are_absent_from_training():
    """Sprints are known before lights out, but no training row has one, so they are not features."""
    tables = load_raw_tables("data/raw")
    frame, _ = build_modeling_table(tables)
    check = sprint_weekend_check(frame, tables)
    assert (check.sprint_ends_before_race_share == 1).all()
    assert (check.sprint_rows_in_training == 0).all()
    assert not any("sprint" in feature for feature in FEATURES)


def test_non_starter_audit_covers_every_row_and_never_podiums():
    """Grid-0 drivers who failed to qualify are in the table, never podium, and only in training."""
    tables = load_raw_tables("data/raw")
    frame, _ = build_modeling_table(tables)
    audit = non_starter_audit(frame, tables).set_index("group")
    assert audit.rows.sum() == len(frame)
    failed = audit.loc[audit.index.str.startswith("F:")].iloc[0]
    assert failed.podium_rate == 0
    assert failed.rows_in_validation == 0 and failed.rows_in_test == 0


def test_every_model_feature_has_its_own_eda_row_from_training_only():
    """Each of the 17 features gets evidence, and its AUC is computed on training seasons."""
    frame, _ = build_modeling_table(load_raw_tables("data/raw"))
    summary = feature_eda(frame)
    assert list(summary.feature) == FEATURES
    assert summary.auc_train.between(0, 1).all()
    assert summary.missing_share_train.between(0, 1).all()
    # Grid and qualifying position are the strongest single signals; lower positions podium more.
    top = summary.sort_values("signal_strength", ascending=False).iloc[0]
    assert top.feature in {"grid_position", "qualifying_position"}
    assert summary.set_index("feature").loc["grid_position", "signal_strength"] > 0.7
