"""Advanced research models kept separate from the official coursework baseline.

The official Milestone 1 task, features, artifacts and notebook remain owned by
``pipeline.py``.  This module reuses its cleaned driver-race table, adds only
strictly lagged or post-qualifying features, and evaluates additional outcome
tasks on the same chronological train/validation/test boundaries.
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

import numpy as np
import pandas as pd
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
from sklearn.ensemble import HistGradientBoostingClassifier, HistGradientBoostingRegressor, RandomForestClassifier, RandomForestRegressor
from sklearn.impute import SimpleImputer
from sklearn.linear_model import LogisticRegression, Ridge
from sklearn.metrics import average_precision_score, brier_score_loss, mean_absolute_error, roc_auc_score
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler

from .pipeline import FEATURES, split_by_time

ADVANCED_FEATURES = FEATURES + [
    "qualifying_gap_to_field_best",
    "grid_vs_qualifying",
    "driver_finish_pct_5",
    "constructor_finish_pct_5",
    "driver_dnf_rate_10",
    "constructor_dnf_rate_10",
    "driver_circuit_finish_pct",
    "constructor_circuit_finish_pct",
    "grid_percentile",
    "qualifying_percentile",
    "driver_points_per_round",
    "constructor_points_per_round",
    "grid_vs_team_mean",
    "qualifying_vs_team_mean",
    "driver_grid_gain_5",
    "constructor_grid_gain_5",
    "driver_finish_std_5",
    "constructor_finish_std_5",
    "circuit_dnf_rate_prior",
    "circuit_grid_volatility_prior",
    "circuit_pit_stops_per_driver_prior",
    "circuit_mean_stop_fraction_prior",
    "circuit_pit_history_missing",
]


def _prior_rolling(frame: pd.DataFrame, group: list[str], value: str, window: int) -> pd.Series:
    """Mean of prior observations only; the current outcome can never enter its feature."""
    return frame.groupby(group, sort=False)[value].transform(lambda s: s.shift().rolling(window, min_periods=1).mean())


def _prior_expanding(frame: pd.DataFrame, group: list[str], value: str) -> pd.Series:
    return frame.groupby(group, sort=False)[value].transform(lambda s: s.shift().expanding(min_periods=1).mean())


def build_advanced_table(modeling_table: pd.DataFrame, course_tables: dict[str, pd.DataFrame] | None = None) -> pd.DataFrame:
    """Add leakage-safe reliability, conversion and circuit-history features."""
    frame = modeling_table.copy().sort_values(["date", "raceId", "driverId"]).reset_index(drop=True)
    frame["finish_pct"] = (frame["positionOrder"] - 1) / (frame["field_size"] - 1).clip(lower=1)
    frame["dnf"] = ~frame["positionText"].astype(str).str.fullmatch(r"\d+")
    frame["dnf"] = frame["dnf"].astype(int)
    frame["qualifying_gap_to_field_best"] = frame["qualifying_time_seconds"] - frame.groupby("raceId")["qualifying_time_seconds"].transform("min")
    frame["grid_vs_qualifying"] = frame["grid_position"] - frame["qualifying_position"]
    frame["grid_percentile"] = (frame["grid_position"] - 1) / (frame["field_size"] - 1).clip(lower=1)
    frame["qualifying_percentile"] = (frame["qualifying_position"] - 1) / (frame["field_size"] - 1).clip(lower=1)
    previous_rounds = (frame["round"] - 1).clip(lower=1)
    frame["driver_points_per_round"] = frame["driver_points_before"] / previous_rounds
    frame["constructor_points_per_round"] = frame["constructor_points_before"] / previous_rounds
    frame["grid_vs_team_mean"] = frame["grid_position"] - frame.groupby(["raceId", "constructorId"])["grid_position"].transform("mean")
    frame["qualifying_vs_team_mean"] = frame["qualifying_position"] - frame.groupby(["raceId", "constructorId"])["qualifying_position"].transform("mean")
    frame["grid_gain"] = frame["grid_percentile"] - frame["finish_pct"]

    frame["driver_finish_pct_5"] = _prior_rolling(frame, ["driverId"], "finish_pct", 5)
    frame["driver_dnf_rate_10"] = _prior_rolling(frame, ["driverId"], "dnf", 10)
    frame["driver_circuit_finish_pct"] = _prior_expanding(frame, ["driverId", "circuitId"], "finish_pct")
    frame["driver_grid_gain_5"] = _prior_rolling(frame, ["driverId"], "grid_gain", 5)
    frame["driver_finish_std_5"] = frame.groupby("driverId", sort=False)["finish_pct"].transform(lambda s: s.shift().rolling(5, min_periods=2).std())

    # A constructor has multiple rows in a race. Aggregate first so teammates cannot
    # see one another's current-race outcome through row order.
    team_races = (frame.groupby(["constructorId", "raceId", "circuitId", "date"], as_index=False)
                  .agg(team_finish_pct=("finish_pct", "mean"), team_dnf=("dnf", "mean"), team_grid_gain=("grid_gain", "mean"))
                  .sort_values(["date", "raceId", "constructorId"]))
    team_races["constructor_finish_pct_5"] = _prior_rolling(team_races, ["constructorId"], "team_finish_pct", 5)
    team_races["constructor_dnf_rate_10"] = _prior_rolling(team_races, ["constructorId"], "team_dnf", 10)
    team_races["constructor_circuit_finish_pct"] = _prior_expanding(team_races, ["constructorId", "circuitId"], "team_finish_pct")
    team_races["constructor_grid_gain_5"] = _prior_rolling(team_races, ["constructorId"], "team_grid_gain", 5)
    team_races["constructor_finish_std_5"] = team_races.groupby("constructorId", sort=False)["team_finish_pct"].transform(lambda s: s.shift().rolling(5, min_periods=2).std())
    frame = frame.merge(
        team_races[["constructorId", "raceId", "constructor_finish_pct_5", "constructor_dnf_rate_10", "constructor_circuit_finish_pct", "constructor_grid_gain_5", "constructor_finish_std_5"]],
        on=["constructorId", "raceId"], how="left", validate="many_to_one",
    )
    race_context = (frame.groupby(["raceId", "circuitId", "date"], as_index=False)
                    .agg(race_dnf=("dnf", "mean"), race_grid_volatility=("grid_gain", lambda s: float(np.mean(np.abs(s)))) )
                    .sort_values(["date", "raceId"]))
    race_context["circuit_dnf_rate_prior"] = _prior_expanding(race_context, ["circuitId"], "race_dnf")
    race_context["circuit_grid_volatility_prior"] = _prior_expanding(race_context, ["circuitId"], "race_grid_volatility")

    if course_tables is not None:
        pits = course_tables["pit_stops"][["raceId", "driverId", "lap"]].copy()
        max_laps = frame.groupby("raceId")["laps"].max().rename("race_laps")
        pit_race = (pits.merge(max_laps, on="raceId", how="left")
                    .assign(stop_fraction=lambda x: x.lap / x.race_laps.clip(lower=1))
                    .groupby("raceId", as_index=False).agg(pit_stops=("lap", "size"), mean_stop_fraction=("stop_fraction", "mean")))
        entrants = frame.groupby("raceId").driverId.size().rename("entrants")
        race_context = race_context.merge(pit_race, on="raceId", how="left").merge(entrants, on="raceId", how="left")
        race_context["pit_stops_per_driver"] = race_context["pit_stops"] / race_context["entrants"]
        race_context["circuit_pit_stops_per_driver_prior"] = _prior_expanding(race_context, ["circuitId"], "pit_stops_per_driver")
        race_context["circuit_mean_stop_fraction_prior"] = _prior_expanding(race_context, ["circuitId"], "mean_stop_fraction")
    else:
        race_context["circuit_pit_stops_per_driver_prior"] = np.nan
        race_context["circuit_mean_stop_fraction_prior"] = np.nan
    race_context["circuit_pit_history_missing"] = race_context["circuit_pit_stops_per_driver_prior"].isna().astype(int)
    frame = frame.merge(race_context[["raceId", "circuit_dnf_rate_prior", "circuit_grid_volatility_prior", "circuit_pit_stops_per_driver_prior", "circuit_mean_stop_fraction_prior", "circuit_pit_history_missing"]], on="raceId", how="left", validate="many_to_one")
    return frame


def finish_models(random_state: int = 42) -> dict[str, Pipeline]:
    return {
        "Ridge": Pipeline([("impute", SimpleImputer(strategy="median")), ("scale", StandardScaler()), ("model", Ridge(alpha=10.0))]),
        "Random forest": Pipeline([("impute", SimpleImputer(strategy="median")), ("model", RandomForestRegressor(n_estimators=180, max_depth=14, min_samples_leaf=20, n_jobs=-1, random_state=random_state))]),
        "Histogram gradient boosting": Pipeline([("impute", SimpleImputer(strategy="median")), ("model", HistGradientBoostingRegressor(max_iter=180, learning_rate=0.055, max_leaf_nodes=23, l2_regularization=2.0, random_state=random_state))]),
    }


def dnf_models(random_state: int = 42) -> dict[str, Pipeline]:
    return {
        "Logistic regression": Pipeline([("impute", SimpleImputer(strategy="median")), ("scale", StandardScaler()), ("model", LogisticRegression(C=0.2, max_iter=2000, random_state=random_state))]),
        "Random forest": Pipeline([("impute", SimpleImputer(strategy="median")), ("model", RandomForestClassifier(n_estimators=180, max_depth=12, min_samples_leaf=30, n_jobs=-1, random_state=random_state, class_weight="balanced_subsample"))]),
        "Histogram gradient boosting": Pipeline([("impute", SimpleImputer(strategy="median")), ("model", HistGradientBoostingClassifier(max_iter=180, learning_rate=0.045, max_leaf_nodes=15, l2_regularization=4.0, random_state=random_state))]),
    }


def _rank_mae(part: pd.DataFrame, score: np.ndarray) -> float:
    work = part[["raceId", "positionOrder"]].copy()
    work["score"] = score
    work["predicted_rank"] = work.groupby("raceId")["score"].rank(method="first")
    return float(mean_absolute_error(work["positionOrder"], work["predicted_rank"]))


def _spearman(part: pd.DataFrame, score: np.ndarray) -> float:
    work = part[["raceId", "positionOrder"]].copy()
    work["score"] = score
    values = [group["positionOrder"].corr(group["score"], method="spearman") for _, group in work.groupby("raceId")]
    return float(np.nanmean(values))


def _distribution_for_race(prediction: np.ndarray, residuals: np.ndarray, seed: int, samples: int = 1200, residual_scale: float = 1.0) -> np.ndarray:
    """Residual-bootstrap joint order samples; every draw is a valid permutation."""
    rng = np.random.default_rng(seed)
    n = len(prediction)
    counts = np.zeros((n, n), dtype=np.int32)
    for _ in range(samples):
        draw = prediction + residual_scale * rng.choice(residuals, size=n, replace=True)
        order = np.argsort(draw, kind="stable")
        counts[order, np.arange(n)] += 1
    return counts / samples


def _race_bootstrap_comparison(scored: pd.DataFrame, draws: int = 5000, seed: int = 903) -> tuple[pd.DataFrame, dict[str, Any]]:
    """Paired race-level bootstrap for model-vs-grid performance differences.

    Resampling whole races preserves the within-race dependence between driver rows.
    Positive deltas mean the advanced model improves on the grid baseline.
    """
    races = np.sort(scored.raceId.unique())
    by_race = {race_id: scored.loc[scored.raceId.eq(race_id)] for race_id in races}
    rng = np.random.default_rng(seed)
    records: list[dict[str, float]] = []
    for _ in range(draws):
        sample = pd.concat([by_race[race_id] for race_id in rng.choice(races, size=len(races), replace=True)], ignore_index=True)
        model_brier = float(np.mean((sample.podium - sample.actualPodium) ** 2))
        grid_brier = float(np.mean((sample.gridPodium - sample.actualPodium) ** 2))
        model_mae = float(np.mean(np.abs(sample.expectedPosition - sample.actualPosition)))
        grid_mae = float(np.mean(np.abs(sample.gridExpectedPosition - sample.actualPosition)))
        records.append({
            "model_podium_brier": model_brier,
            "grid_podium_brier": grid_brier,
            "podium_brier_improvement": grid_brier - model_brier,
            "model_position_mae": model_mae,
            "grid_position_mae": grid_mae,
            "position_mae_improvement": grid_mae - model_mae,
        })
    samples = pd.DataFrame(records)

    def interval(column: str) -> dict[str, float]:
        values = samples[column]
        return {
            "estimate": float(values.mean()),
            "lower95": float(values.quantile(0.025)),
            "upper95": float(values.quantile(0.975)),
        }

    summary = {
        "unit": "race",
        "draws": draws,
        "podiumBrierImprovement": {**interval("podium_brier_improvement"), "probabilityBetter": float((samples.podium_brier_improvement > 0).mean())},
        "positionMaeImprovement": {**interval("position_mae_improvement"), "probabilityBetter": float((samples.position_mae_improvement > 0).mean())},
        "modelPodiumBrier": interval("model_podium_brier"),
        "modelPositionMae": interval("model_position_mae"),
    }
    return samples, summary


def run_advanced_research(modeling_table: pd.DataFrame, out_dir: str | Path, samples: int = 1200, course_tables: dict[str, pd.DataFrame] | None = None) -> dict[str, Any]:
    frame = build_advanced_table(modeling_table, course_tables)
    splits = split_by_time(frame)
    train, validation, test = splits["train"], splits["validation"], splits["test"]
    X_train, X_val, X_test = (part[ADVANCED_FEATURES] for part in (train, validation, test))

    finish_rows: list[dict[str, Any]] = []
    fitted_finish: dict[str, Pipeline] = {}
    for name, model in finish_models().items():
        model.fit(X_train, train["finish_pct"])
        fitted_finish[name] = model
        for split_name, part, X in (("train", train, X_train), ("validation", validation, X_val)):
            prediction = model.predict(X)
            finish_rows.append({
                "model": name, "split": split_name,
                "finish_pct_mae": float(mean_absolute_error(part["finish_pct"], prediction)),
                "rank_mae": _rank_mae(part, prediction),
                "race_spearman": _spearman(part, prediction),
            })
    ensemble_members = {
        "Ridge + HGB ensemble": ("Ridge", "Histogram gradient boosting"),
        "Three-model ensemble": tuple(fitted_finish),
    }
    for name, members in ensemble_members.items():
        for split_name, part, X in (("train", train, X_train), ("validation", validation, X_val)):
            prediction = np.mean([fitted_finish[member].predict(X) for member in members], axis=0)
            finish_rows.append({"model": name, "split": split_name, "finish_pct_mae": float(mean_absolute_error(part["finish_pct"], prediction)), "rank_mae": _rank_mae(part, prediction), "race_spearman": _spearman(part, prediction)})
    finish_metrics = pd.DataFrame(finish_rows)
    selected_finish = (finish_metrics[finish_metrics.split.eq("validation")]
                       .sort_values(["rank_mae", "finish_pct_mae", "model"]).iloc[0].model)
    def finish_predict(name: str, X: pd.DataFrame) -> np.ndarray:
        if name in fitted_finish:
            return fitted_finish[name].predict(X)
        return np.mean([fitted_finish[member].predict(X) for member in ensemble_members[name]], axis=0)

    selected_test_finish = finish_predict(selected_finish, X_test)
    finish_metrics = pd.concat([finish_metrics, pd.DataFrame([{
        "model": selected_finish, "split": "selected_test_only",
        "finish_pct_mae": float(mean_absolute_error(test["finish_pct"], selected_test_finish)),
        "rank_mae": _rank_mae(test, selected_test_finish), "race_spearman": _spearman(test, selected_test_finish),
    }])], ignore_index=True)

    val_prediction = finish_predict(selected_finish, X_val)
    calibration_mask = validation.year.eq(2020).to_numpy()
    scale_mask = validation.year.eq(2021).to_numpy()
    residuals = validation.loc[calibration_mask, "finish_pct"].to_numpy(float) - val_prediction[calibration_mask]
    scale_rows: list[dict[str, float]] = []
    scale_frame = validation.loc[scale_mask, ["raceId", "driverId", "positionOrder", "podium"]].copy()
    scale_frame["latent"] = val_prediction[scale_mask]
    for scale in (0.55, 0.7, 0.85, 1.0, 1.2, 1.45):
        predicted_podium: list[float] = []
        actual_podium: list[int] = []
        predicted_position: list[float] = []
        actual_position: list[int] = []
        for race_id, group in scale_frame.groupby("raceId", sort=True):
            matrix = _distribution_for_race(group.latent.to_numpy(float), residuals, seed=int(race_id), samples=700, residual_scale=scale)
            predicted_podium.extend(matrix[:, :3].sum(axis=1))
            actual_podium.extend(group.podium.astype(int))
            predicted_position.extend(matrix @ np.arange(1, len(group) + 1))
            actual_position.extend(group.positionOrder.astype(int))
        scale_rows.append({"residual_scale": scale, "podium_brier": float(brier_score_loss(actual_podium, predicted_podium)), "position_mae": float(mean_absolute_error(actual_position, predicted_position))})
    uncertainty_metrics = pd.DataFrame(scale_rows)
    selected_scale = float(uncertainty_metrics.sort_values(["podium_brier", "position_mae"]).iloc[0].residual_scale)
    # After scale selection on 2021, use both validation seasons as the residual pool for test inference.
    residuals = validation["finish_pct"].to_numpy(float) - val_prediction

    dnf_rows: list[dict[str, Any]] = []
    fitted_dnf: dict[str, Pipeline] = {}
    for name, model in dnf_models().items():
        model.fit(X_train, train["dnf"])
        fitted_dnf[name] = model
        for split_name, part, X in (("train", train, X_train), ("validation", validation, X_val)):
            probability = model.predict_proba(X)[:, 1]
            dnf_rows.append({
                "model": name, "split": split_name,
                "brier": float(brier_score_loss(part["dnf"], probability)),
                "roc_auc": float(roc_auc_score(part["dnf"], probability)),
                "pr_auc": float(average_precision_score(part["dnf"], probability)),
            })
    dnf_metrics = pd.DataFrame(dnf_rows)
    selected_dnf = dnf_metrics[dnf_metrics.split.eq("validation")].sort_values(["brier", "model"]).iloc[0].model
    raw_val_dnf = fitted_dnf[selected_dnf].predict_proba(X_val)[:, 1]
    raw_test_dnf = fitted_dnf[selected_dnf].predict_proba(X_test)[:, 1]
    dnf_metrics = pd.concat([dnf_metrics, pd.DataFrame([{
        "model": selected_dnf, "split": "selected_test_only",
        "brier": float(brier_score_loss(test["dnf"], raw_test_dnf)),
        "roc_auc": float(roc_auc_score(test["dnf"], raw_test_dnf)),
        "pr_auc": float(average_precision_score(test["dnf"], raw_test_dnf)),
    }])], ignore_index=True)
    # Platt calibration learns on 2020 and is assessed out-of-year on 2021 before test use.
    platt = LogisticRegression(C=1.0, max_iter=1000)
    platt.fit(raw_val_dnf[calibration_mask].reshape(-1, 1), validation.loc[calibration_mask, "dnf"])
    dnf_probability = platt.predict_proba(raw_test_dnf.reshape(-1, 1))[:, 1]
    dnf_calibration = {
        "raw_2021_brier": float(brier_score_loss(validation.loc[scale_mask, "dnf"], raw_val_dnf[scale_mask])),
        "platt_2021_brier": float(brier_score_loss(validation.loc[scale_mask, "dnf"], platt.predict_proba(raw_val_dnf[scale_mask].reshape(-1, 1))[:, 1])),
    }

    test_scored = test[["raceId", "driverId", "positionOrder", "podium", "grid_position"]].copy()
    test_scored["latent_finish"] = finish_predict(selected_finish, X_test)
    test_scored["dnf_probability"] = dnf_probability
    distribution_rows: list[dict[str, Any]] = []
    for race_id, group in test_scored.groupby("raceId", sort=True):
        matrix = _distribution_for_race(group.latent_finish.to_numpy(float), residuals, seed=int(race_id), samples=samples, residual_scale=selected_scale)
        for index, (_, row) in enumerate(group.iterrows()):
            probs = matrix[index]
            distribution_rows.append({
                "raceId": int(race_id), "driverId": int(row.driverId),
                "win": float(probs[0]), "podium": float(probs[:3].sum()),
                "expectedPosition": float(np.dot(probs, np.arange(1, len(probs) + 1))),
                "expectedPoints": float(np.dot(probs[:10], np.array([25, 18, 15, 12, 10, 8, 6, 4, 2, 1])[:len(probs[:10])])),
                "dnf": float(row.dnf_probability), "positions": [round(float(value), 6) for value in probs],
                "actualPosition": int(row.positionOrder), "actualPodium": int(row.podium),
            })
    distributions = pd.DataFrame(distribution_rows)
    podium_brier = float(brier_score_loss(distributions.actualPodium, distributions.podium))
    grid_brier = float(brier_score_loss(distributions.actualPodium, (test_scored.grid_position.le(3)).astype(int)))
    position_mae = float(mean_absolute_error(distributions.actualPosition, distributions.expectedPosition))
    grid_mae = float(mean_absolute_error(test_scored.positionOrder, test_scored.grid_position.fillna(test_scored.groupby("raceId").driverId.transform("size"))))
    comparison = distributions.merge(test_scored[["raceId", "driverId", "grid_position"]], on=["raceId", "driverId"], validate="one_to_one")
    comparison["gridExpectedPosition"] = comparison.grid_position.fillna(comparison.groupby("raceId").driverId.transform("size"))
    comparison["gridPodium"] = comparison.grid_position.le(3).astype(float)
    bootstrap_samples, bootstrap_summary = _race_bootstrap_comparison(comparison)

    out = Path(out_dir)
    out.mkdir(parents=True, exist_ok=True)

    # Feature-family ablations use one fixed model/settings and validation only.
    families = {
        "all": ADVANCED_FEATURES,
        "official_16_only": FEATURES,
        "without_reliability": [f for f in ADVANCED_FEATURES if "dnf" not in f and "pit_" not in f],
        "without_circuit_history": [f for f in ADVANCED_FEATURES if "circuit" not in f],
        "without_teammate_context": [f for f in ADVANCED_FEATURES if "team_mean" not in f],
        "without_form_and_consistency": [f for f in ADVANCED_FEATURES if not any(term in f for term in ("finish_pct_5", "grid_gain_5", "finish_std_5"))],
    }
    ablation_rows = []
    for family, features in families.items():
        model = finish_models()["Histogram gradient boosting"]
        model.fit(train[features], train["finish_pct"])
        prediction = model.predict(validation[features])
        ablation_rows.append({"feature_set": family, "features": len(features), "validation_rank_mae": _rank_mae(validation, prediction), "validation_finish_pct_mae": float(mean_absolute_error(validation.finish_pct, prediction)), "validation_race_spearman": _spearman(validation, prediction)})
    ablations = pd.DataFrame(ablation_rows).sort_values("validation_rank_mae")

    # Error slices expose where aggregate performance hides weakness.
    errors = test[["raceId", "driverId", "year", "circuitId", "constructorId", "grid_position", "positionOrder"]].copy()
    errors = errors.merge(distributions[["raceId", "driverId", "expectedPosition", "podium", "actualPodium"]], on=["raceId", "driverId"], validate="one_to_one")
    errors["absolute_position_error"] = (errors.expectedPosition - errors.positionOrder).abs()
    errors["podium_squared_error"] = (errors.podium - errors.actualPodium) ** 2
    errors["grid_band"] = pd.cut(errors.grid_position.fillna(99), [0, 3, 10, 20, 100], labels=["front 3", "P4-10", "P11-20", "pit/other"])
    error_slices = pd.concat([
        errors.groupby("year", observed=True).agg(rows=("driverId", "size"), position_mae=("absolute_position_error", "mean"), podium_brier=("podium_squared_error", "mean")).reset_index().assign(slice="year").rename(columns={"year": "value"}),
        errors.groupby("grid_band", observed=True).agg(rows=("driverId", "size"), position_mae=("absolute_position_error", "mean"), podium_brier=("podium_squared_error", "mean")).reset_index().assign(slice="grid_band").rename(columns={"grid_band": "value"}),
        errors.groupby("circuitId", observed=True).agg(rows=("driverId", "size"), position_mae=("absolute_position_error", "mean"), podium_brier=("podium_squared_error", "mean")).reset_index().query("rows >= 20").assign(slice="circuit").rename(columns={"circuitId": "value"}),
    ], ignore_index=True)

    bins = pd.qcut(distributions.podium, q=8, duplicates="drop")
    calibration = (distributions.assign(bin=bins).groupby("bin", observed=True)
                   .agg(rows=("driverId", "size"), mean_prediction=("podium", "mean"), observed_rate=("actualPodium", "mean"))
                   .reset_index(drop=True))
    calibration["absolute_gap"] = (calibration.mean_prediction - calibration.observed_rate).abs()
    calibration_error = float(np.average(calibration.absolute_gap, weights=calibration.rows))

    figures = out / "figures"
    figures.mkdir(exist_ok=True)
    fig, axes = plt.subplots(1, 2, figsize=(10, 4.2))
    axes[0].plot([0, 1], [0, 1], color="#777777", linestyle="--", linewidth=1)
    axes[0].plot(calibration.mean_prediction, calibration.observed_rate, "o-", color="#e10600", linewidth=2)
    axes[0].set(xlabel="Mean predicted podium share", ylabel="Observed podium rate", title="Held-out calibration")
    ordered = finish_metrics[finish_metrics.split.eq("validation")].sort_values("rank_mae")
    axes[1].barh(ordered.model, ordered.rank_mae, color="#9aa3ad")
    axes[1].invert_yaxis(); axes[1].set(xlabel="Mean absolute rank error", title="Validation model comparison")
    fig.tight_layout(); fig.savefig(figures / "advanced_model_diagnostics.png", dpi=180); plt.close(fig)

    finish_metrics.to_csv(out / "finish_model_metrics.csv", index=False)
    dnf_metrics.to_csv(out / "dnf_model_metrics.csv", index=False)
    uncertainty_metrics.to_csv(out / "uncertainty_scale_search.csv", index=False)
    ablations.to_csv(out / "feature_family_ablation.csv", index=False)
    error_slices.to_csv(out / "error_slices.csv", index=False)
    calibration.to_csv(out / "podium_calibration.csv", index=False)
    bootstrap_samples.to_csv(out / "race_bootstrap_comparison.csv", index=False)
    distributions.to_json(out / "test_distributions.json", orient="records")
    summary = {
        "contract": "paladin.advanced-research.v1",
        "officialCourseworkBaselineChanged": False,
        "evaluationStatus": "Retrospective development benchmark; 2022-2024 has been reviewed during successive product iterations and is not a pristine final holdout.",
        "features": ADVANCED_FEATURES,
        "selectedFinishModel": selected_finish,
        "selectedDnfModel": selected_dnf,
        "selectedResidualScale": selected_scale,
        "dnfCalibration": dnf_calibration,
        "testCalibrationError": calibration_error,
        "raceBootstrap": bootstrap_summary,
        "test": {"races": int(test.raceId.nunique()), "rows": int(len(test)), "podiumBrier": podium_brier, "gridPodiumBrier": grid_brier, "expectedPositionMAE": position_mae, "gridPositionMAE": grid_mae},
        "limitations": ["Research extension, not the official Milestone 1 model.", "The 2022-2024 benchmark has been inspected during development and must not be presented as a pristine final holdout.", "Race-level bootstrap intervals quantify sampling uncertainty, not feature-selection or repeated-evaluation bias.", "Distribution uncertainty is a validation-residual bootstrap.", "DNF means non-numeric positionText and does not distinguish causes.", "No tyre, weather, damage or safety-car feature is fabricated."],
    }
    (out / "summary.json").write_text(json.dumps(summary, indent=2), encoding="utf-8")
    return summary
