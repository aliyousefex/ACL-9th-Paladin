"""Checks for the quiet data mistakes we do not want to discover in evaluation.

The tests use direct examples so the setup, action, and expected result remain easy
to inspect.
"""

from __future__ import annotations

import numpy as np
import pandas as pd

from f1podium.pipeline import (
    DID_NOT_ENTER_CODE,
    FEATURES,
    MECHANICAL_TERMS,
    NON_START_STATUSES,
    INITIAL_SETTINGS,
    SEARCH_SPACE,
    feature_eda,
    audit_tables,
    raw_table_profile,
    _current_params,
    _time_to_seconds,
    build_modeling_table,
    clean_results,
    cleaning_eda,
    engineering_answers,
    load_raw_tables,
    non_starter_audit,
    non_starter_experiment,
    preprocessing_effects,
    preprocessing_order_experiments,
    split_by_time,
    split_integrity,
    split_summary,
    split_window_experiment,
    sprint_weekend_check,
    train_and_evaluate,
    validation_uncertainty,
    predict_podium,
    logistic_explanations,
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


def test_all_fourteen_tables_and_relational_keys_are_audited():
    """The required audit covers every raw table and all declared relationships."""
    tables = load_raw_tables("data/raw")
    pk, fk = audit_tables(tables)
    assert set(pk.table) == set(tables)
    assert pk.null_keys.sum() == 0 and pk.duplicate_keys.sum() == 0
    assert len(fk) >= 20 and fk.orphans.sum() == 0
    profile = raw_table_profile(tables)
    assert set(profile.table) == set(tables)
    assert profile.duplicate_full_rows.sum() == 0


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


def test_descriptive_questions_exclude_recorded_non_starters_and_report_sensitivity():
    """Front-row/home denominators are true starts and Q3 exposes a strict sensitivity check."""
    tables = load_raw_tables("data/raw")
    frame, _ = build_modeling_table(tables)
    answers = engineering_answers(frame, tables)
    assert set(answers["mechanical_sensitivity"].definition) == {
        "official instructor list", "conservative internal-system list"}
    adjusted = answers["home_adjusted"].iloc[0]
    assert adjusted["ci_low_2.5%"] < adjusted.home_odds_ratio < adjusted["ci_high_97.5%"]
    assert adjusted["ci_low_2.5%"] < 1 < adjusted["ci_high_97.5%"]


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


def test_cleaning_eda_quantifies_each_step_without_duplicates():
    """Shared drives fix the grain without moving the label; removing F rows loses no podium."""
    tables = load_raw_tables("data/raw")
    frame, _ = build_modeling_table(tables)
    comparison = cleaning_eda(tables["results"], frame).set_index("stage")

    raw = comparison.loc["Raw results"]
    shared = comparison.loc["Shared drives resolved"]
    final = comparison.loc["Modeling table (F rows removed)"]
    assert raw.rows > raw.unique_driver_races
    assert raw.duplicate_rows > 0
    # Step 1: resolving shared drives reaches the unique grain and leaves the podium rate alone.
    assert shared.rows == shared.unique_driver_races
    assert shared.duplicate_rows == 0
    assert abs(raw.podium_rate - shared.podium_rate) < 0.001
    # Step 2: the F rows go. The rate rises only because they never podium, so no podium row is lost.
    assert final.rows < shared.rows
    assert final.rows == final.unique_driver_races
    assert final.duplicate_rows == 0
    assert round(final.podium_rate * final.rows) == round(shared.podium_rate * shared.rows)
    assert final.podium_rate > shared.podium_rate


def test_did_not_enter_rows_leave_before_features_but_withdrawals_stay():
    """Piazza: only F rows may go. They leave before any feature, so they never count as races."""
    tables = load_raw_tables("data/raw")
    frame, diagnostics = build_modeling_table(tables)
    with_f, _ = build_modeling_table(tables, drop_did_not_enter=False)

    assert not frame.positionText.eq(DID_NOT_ENTER_CODE).any()
    assert frame.positionText.eq("W").any(), "withdrawals may not be removed"
    removed = int(with_f.positionText.eq(DID_NOT_ENTER_CODE).sum())
    assert removed > 0
    assert diagnostics["did_not_enter_rows_removed"] == removed == len(with_f) - len(frame)
    assert diagnostics["clean_rows"] == len(frame)
    assert diagnostics["rows_after_shared_drive_resolution"] == len(with_f)
    # A driver who did not qualify never podiums, so no positive label disappears.
    assert with_f.podium.sum() == frame.podium.sum()
    # Field size counts the drivers who entered, and the race count counts only entered races.
    assert (frame.field_size == frame.groupby("raceId").driverId.transform("size")).all()
    assert frame.field_size.mean() < with_f.field_size.mean()
    entered = frame.groupby("driverId").size()
    last = frame.sort_values(["date", "raceId"]).groupby("driverId").tail(1).set_index("driverId")
    assert (last.driver_races_before == entered.loc[last.index] - 1).all()
    # The row filter touches no other split: validation and test contain no F rows at all.
    assert set(zip(with_f[with_f.year >= 2020].raceId, with_f[with_f.year >= 2020].driverId)) == \
           set(zip(frame[frame.year >= 2020].raceId, frame[frame.year >= 2020].driverId))


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
    """The audit sees the F rows the modeling table removes: they never podium and are only in training."""
    tables = load_raw_tables("data/raw")
    with_f, _ = build_modeling_table(tables, drop_did_not_enter=False)
    audit = non_starter_audit(with_f, tables).set_index("group")
    assert audit.rows.sum() == len(with_f)
    failed = audit.loc[audit.index.str.startswith("F:")].iloc[0]
    assert failed.podium_rate == 0
    assert failed.rows_in_validation == 0 and failed.rows_in_test == 0
    assert failed.treatment.startswith("removed")
    # W rows are only known after the race, so the audit must record that they stay.
    assert audit.loc[audit.index.str.startswith("W:")].iloc[0].treatment.startswith("kept")


def test_non_starter_experiment_compares_the_decision_on_the_same_validation_rows():
    """Removing F rows is scored against keeping them; the validation rows are identical."""
    tables = load_raw_tables("data/raw")
    frame, _ = build_modeling_table(tables)
    with_f, _ = build_modeling_table(tables, drop_did_not_enter=False)
    runs = non_starter_experiment(with_f, frame)
    used = runs[runs.variant.str.endswith("(used)")]
    kept = runs[runs.variant.str.startswith("keep F rows in the history and")]
    assert set(used.model) == set(kept.model) == {"Logistic regression", "Shallow neural network"}
    assert (used["PR-AUC_change_vs_used"] == 0).all()
    assert used.train_rows.iloc[0] == (frame.year <= 2019).sum()
    assert kept.train_rows.iloc[0] == (with_f.year <= 2019).sum()
    assert used.train_pit_lane_share.iloc[0] < kept.train_pit_lane_share.iloc[0]


def test_every_model_feature_has_its_own_eda_row_from_training_only():
    """Each of the 16 features gets evidence, and its AUC is computed on training seasons."""
    frame, _ = build_modeling_table(load_raw_tables("data/raw"))
    summary = feature_eda(frame)
    assert list(summary.feature) == FEATURES
    assert summary.auc_train.between(0, 1).all()
    assert summary.missing_share_train.between(0, 1).all()
    # Grid and qualifying position are the strongest single signals; lower positions podium more.
    top = summary.sort_values("signal_strength", ascending=False).iloc[0]
    assert top.feature in {"grid_position", "qualifying_position"}
    assert summary.set_index("feature").loc["grid_position", "signal_strength"] > 0.7


def test_partial_inference_discloses_imputation():
    """A partial record must say exactly which fields the fitted imputer supplied."""
    frame, _ = build_modeling_table(load_raw_tables("data/raw"))
    models, _, thresholds = train_and_evaluate(frame)
    result = predict_podium({"grid_position": 3}, models["Logistic regression"],
                            thresholds["Logistic regression"])
    assert "qualifying_position" in result["missing_features"]
    assert result["imputation_warning"].startswith("15 of 16")


def test_selected_logistic_local_explanation_reconstructs_probability(tmp_path):
    """The selected model's saved local contributions must exactly reproduce its prediction."""
    frame, _ = build_modeling_table(load_raw_tables("data/raw"))
    models, _, _ = train_and_evaluate(frame)
    global_df, local_df = logistic_explanations(frame, models, tmp_path)
    assert set(global_df.feature) == set(FEATURES)
    log_odds = float(local_df.intercept.iloc[0] + local_df.log_odds_contribution.sum())
    reconstructed = 1 / (1 + np.exp(-log_odds))
    assert np.isclose(log_odds, local_df.total_log_odds.iloc[0])
    assert np.isclose(reconstructed, local_df.model_probability.iloc[0])


def test_bootstrap_can_report_the_test_seasons_without_rescoring_or_choosing():
    """The same race bootstrap covers validation and test; it only resamples existing predictions."""
    frame, _ = build_modeling_table(load_raw_tables("data/raw"))
    trained, _, _ = train_and_evaluate(frame)
    for split, column in [("validation", "validation_PR-AUC"), ("test", "test_PR-AUC")]:
        result = validation_uncertainty(frame, trained, n_boot=40, split=split)
        assert column in result.columns and len(result) == 5
        assert (result.races == split_by_time(frame)[split].raceId.nunique()).all()
        assert (result["ci_low_2.5%"] <= result["ci_high_97.5%"]).all()
