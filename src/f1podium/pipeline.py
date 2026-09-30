"""Data engineering and modeling utilities for the F1 podium project.

Every predictor produced here is available after qualifying and before race start.
Post-race columns are used only to construct labels, historical lagged form, and the
three descriptive questions.
"""

from __future__ import annotations

import json
import re
from pathlib import Path
from typing import Any

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np
import pandas as pd
import seaborn as sns
from sklearn.base import clone
from sklearn.compose import ColumnTransformer
from sklearn.ensemble import RandomForestClassifier
from sklearn.impute import SimpleImputer
from sklearn.inspection import permutation_importance
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import (
    average_precision_score,
    f1_score,
    precision_score,
    recall_score,
    roc_auc_score,
)
from sklearn.neural_network import MLPClassifier
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler

SENTINEL = "\\N"

FEATURE_GROUPS = {
    "grid": ["grid_position", "pit_lane_start", "front_row", "field_size"],
    "qualifying": ["qualifying_position", "qualifying_time_seconds", "qualifying_missing"],
    "form": ["driver_podium_rate_5", "constructor_podium_rate_5", "driver_races_before"],
    "standings": ["driver_points_before", "driver_rank_before", "constructor_points_before", "constructor_rank_before"],
    "context": ["driver_age", "round", "year"],
}
FEATURES = [feature for group in FEATURE_GROUPS.values() for feature in group]

PRIMARY_KEYS = {
    "circuits": ["circuitId"], "constructors": ["constructorId"],
    "constructor_results": ["constructorResultsId"],
    "constructor_standings": ["constructorStandingsId"],
    "drivers": ["driverId"], "driver_standings": ["driverStandingsId"],
    "races": ["raceId"], "results": ["resultId"],
    "qualifying": ["qualifyId"], "seasons": ["year"], "status": ["statusId"],
}

FOREIGN_KEYS = [
    ("races", "circuitId", "circuits", "circuitId"),
    ("results", "raceId", "races", "raceId"),
    ("results", "driverId", "drivers", "driverId"),
    ("results", "constructorId", "constructors", "constructorId"),
    ("results", "statusId", "status", "statusId"),
    ("qualifying", "raceId", "races", "raceId"),
    ("qualifying", "driverId", "drivers", "driverId"),
    ("driver_standings", "raceId", "races", "raceId"),
    ("constructor_standings", "raceId", "races", "raceId"),
]


def load_raw_tables(data_dir: str | Path) -> dict[str, pd.DataFrame]:
    """Load every supplied CSV while converting the literal ``\\N`` sentinel."""
    data_dir = Path(data_dir)
    tables = {}
    for path in sorted(data_dir.glob("*.csv")):
        tables[path.stem] = pd.read_csv(path, na_values=[SENTINEL], low_memory=False)
    required = set(PRIMARY_KEYS) | {"sprint_results", "lap_times", "pit_stops"}
    missing = required - tables.keys()
    if missing:
        raise FileNotFoundError(f"Missing required tables: {sorted(missing)}")
    return tables


def audit_tables(tables: dict[str, pd.DataFrame]) -> tuple[pd.DataFrame, pd.DataFrame]:
    """Return machine-checkable primary-key and foreign-key audit results."""
    pk_rows = []
    for table, cols in PRIMARY_KEYS.items():
        frame = tables[table]
        pk_rows.append({"table": table, "key": "+".join(cols),
                        "rows": len(frame), "null_keys": int(frame[cols].isna().any(axis=1).sum()),
                        "duplicate_keys": int(frame.duplicated(cols).sum())})
    fk_rows = []
    for child, col, parent, parent_col in FOREIGN_KEYS:
        values = tables[child][col].dropna()
        orphan = ~values.isin(tables[parent][parent_col].dropna())
        fk_rows.append({"relationship": f"{child}.{col} -> {parent}.{parent_col}",
                        "checked": len(values), "orphans": int(orphan.sum())})
    return pd.DataFrame(pk_rows), pd.DataFrame(fk_rows)


def _time_to_seconds(value: Any) -> float:
    if pd.isna(value):
        return np.nan
    text = str(value).strip()
    match = re.fullmatch(r"(?:(\d+):)?(\d+(?:\.\d+)?)", text)
    if not match:
        return np.nan
    minutes = int(match.group(1) or 0)
    return minutes * 60 + float(match.group(2))


def clean_results(results: pd.DataFrame) -> tuple[pd.DataFrame, pd.DataFrame]:
    """Resolve shared-drive duplicates deterministically.

    We retain the car the driver actually started (grid > 0), then the best final
    classification, then the smallest resultId. This is reproducible and preserves
    the pre-race identity of the entrant whenever possible.
    """
    frame = results.copy()
    frame["_started"] = frame["grid"].fillna(0).gt(0)
    counts = frame.groupby(["raceId", "driverId"]).size().rename("rows").reset_index()
    duplicates = counts[counts["rows"] > 1].copy()
    frame = frame.sort_values(
        ["raceId", "driverId", "_started", "positionOrder", "resultId"],
        ascending=[True, True, False, True, True], na_position="last",
    )
    clean = frame.drop_duplicates(["raceId", "driverId"], keep="first").drop(columns="_started")
    assert not clean.duplicated(["raceId", "driverId"]).any()
    return clean, duplicates


def _previous_standings(standings: pd.DataFrame, races: pd.DataFrame, entity: str) -> pd.DataFrame:
    columns = ["raceId", entity, "points", "position"]
    s = standings[columns].merge(races[["raceId", "year", "round"]], on="raceId", how="left")
    s = s.sort_values([entity, "year", "round"])
    s["next_raceId"] = s.groupby([entity, "year"])["raceId"].shift(-1)
    prefix = "driver" if entity == "driverId" else "constructor"
    return s.dropna(subset=["next_raceId"])[["next_raceId", entity, "points", "position"]].rename(
        columns={"next_raceId": "raceId", "points": f"{prefix}_points_before", "position": f"{prefix}_rank_before"}
    ).assign(raceId=lambda x: x.raceId.astype(int))


def build_modeling_table(tables: dict[str, pd.DataFrame]) -> tuple[pd.DataFrame, dict[str, Any]]:
    """Create one leakage-safe row per driver-race and return cleaning diagnostics."""
    races = tables["races"].copy()
    races["date"] = pd.to_datetime(races["date"], errors="coerce")
    results, duplicate_groups = clean_results(tables["results"])

    base = results.merge(races[["raceId", "year", "round", "date", "circuitId", "name"]], on="raceId", validate="many_to_one")
    base = base[base["year"].between(1950, 2024)].copy()
    base = base.merge(tables["drivers"][["driverId", "dob", "nationality"]].rename(columns={"nationality": "driver_nationality"}), on="driverId", validate="many_to_one")
    base = base.merge(tables["constructors"][["constructorId", "name"]].rename(columns={"name": "constructor_name"}), on="constructorId", validate="many_to_one")
    base = base.merge(tables["circuits"][["circuitId", "name", "country"]].rename(columns={"name": "circuit_name"}), on="circuitId", validate="many_to_one")
    base["dob"] = pd.to_datetime(base["dob"], errors="coerce")
    base["driver_age"] = (base["date"] - base["dob"]).dt.days / 365.2425
    base["podium"] = base["positionOrder"].le(3).astype(int)
    base["grid_position"] = base["grid"].where(base["grid"].gt(0))
    base["pit_lane_start"] = base["grid"].eq(0).astype(int)
    base["front_row"] = base["grid"].isin([1, 2]).astype(int)
    base["field_size"] = base.groupby("raceId")["driverId"].transform("size")

    qualifying = tables["qualifying"].copy()
    for col in ["q1", "q2", "q3"]:
        qualifying[col + "_seconds"] = qualifying[col].map(_time_to_seconds)
    qualifying["qualifying_time_seconds"] = qualifying[["q1_seconds", "q2_seconds", "q3_seconds"]].min(axis=1)
    qualifying = qualifying.sort_values(["raceId", "driverId", "position", "qualifyId"]).drop_duplicates(["raceId", "driverId"])
    base = base.merge(qualifying[["raceId", "driverId", "position", "qualifying_time_seconds"]].rename(columns={"position": "qualifying_position"}), on=["raceId", "driverId"], how="left", validate="one_to_one")
    base["qualifying_missing"] = base["qualifying_position"].isna().astype(int)

    dprev = _previous_standings(tables["driver_standings"], races, "driverId")
    cprev = _previous_standings(tables["constructor_standings"], races, "constructorId")
    base = base.merge(dprev, on=["raceId", "driverId"], how="left", validate="one_to_one")
    base = base.merge(cprev, on=["raceId", "constructorId"], how="left", validate="many_to_one")

    base = base.sort_values(["date", "raceId", "driverId"]).reset_index(drop=True)
    # shift(1) is the important bit: el current race result never enters its own feature.
    base["driver_podium_rate_5"] = base.groupby("driverId")["podium"].transform(lambda s: s.shift().rolling(5, min_periods=1).mean())
    # Aggregate both cars first. Row-wise shifting would let the second teammate see
    # the first teammate's result from the same race - subtle leakage, ya3ni.
    constructor_races = (base.groupby(["constructorId", "raceId", "date"], as_index=False)
                         .podium.mean().sort_values(["constructorId", "date", "raceId"]))
    constructor_races["constructor_podium_rate_5"] = constructor_races.groupby("constructorId")["podium"].transform(
        lambda s: s.shift().rolling(5, min_periods=1).mean())
    base = base.merge(constructor_races[["constructorId", "raceId", "constructor_podium_rate_5"]],
                      on=["constructorId", "raceId"], how="left", validate="many_to_one")
    base["driver_races_before"] = base.groupby("driverId").cumcount()

    diagnostics = {
        "raw_result_rows": int(len(tables["results"])),
        "duplicate_driver_race_groups": int(len(duplicate_groups)),
        "clean_rows": int(len(base)),
        "unique_grain": bool(not base.duplicated(["raceId", "driverId"]).any()),
        "year_min": int(base.year.min()), "year_max": int(base.year.max()),
    }
    return base, diagnostics


def split_by_time(frame: pd.DataFrame) -> dict[str, pd.DataFrame]:
    return {
        "train": frame[frame.year <= 2019].copy(),
        "validation": frame[frame.year.between(2020, 2021)].copy(),
        "test": frame[frame.year >= 2022].copy(),
    }


def _pipeline(model: Any, scale: bool = True, strategy: str = "median") -> Pipeline:
    steps = [("imputer", SimpleImputer(strategy=strategy, fill_value=0))]
    if scale:
        steps.append(("scaler", StandardScaler()))
    return Pipeline([("preprocess", Pipeline(steps)), ("model", model)])


def model_definitions(random_state: int = 42) -> dict[str, Pipeline]:
    return {
        "Logistic regression": _pipeline(LogisticRegression(max_iter=2000, solver="liblinear", class_weight="balanced", random_state=random_state)),
        "Random forest": _pipeline(RandomForestClassifier(n_estimators=240, min_samples_leaf=4, class_weight="balanced_subsample", n_jobs=1, random_state=random_state), scale=False),
        "Shallow neural network": _pipeline(MLPClassifier(hidden_layer_sizes=(32, 12), alpha=0.002, early_stopping=True, max_iter=300, random_state=random_state)),
    }


def _best_threshold(y: pd.Series, probability: np.ndarray) -> float:
    candidates = np.linspace(0.05, 0.80, 151)
    scores = [f1_score(y, probability >= value, zero_division=0) for value in candidates]
    return float(candidates[int(np.argmax(scores))])


def _metrics(y: pd.Series, probability: np.ndarray, threshold: float) -> dict[str, float]:
    prediction = probability >= threshold
    return {
        "ROC-AUC": float(roc_auc_score(y, probability)),
        "PR-AUC": float(average_precision_score(y, probability)),
        "F1": float(f1_score(y, prediction, zero_division=0)),
        "Precision": float(precision_score(y, prediction, zero_division=0)),
        "Recall": float(recall_score(y, prediction, zero_division=0)),
    }


def train_and_evaluate(frame: pd.DataFrame, random_state: int = 42) -> tuple[dict[str, Pipeline], pd.DataFrame, dict[str, float]]:
    splits = split_by_time(frame)
    trained, rows, thresholds = {}, [], {}
    for name, model in model_definitions(random_state).items():
        model.fit(splits["train"][FEATURES], splits["train"]["podium"])
        val_probability = model.predict_proba(splits["validation"][FEATURES])[:, 1]
        threshold = _best_threshold(splits["validation"]["podium"], val_probability)
        thresholds[name] = threshold
        trained[name] = model
        for split_name, split in splits.items():
            probability = model.predict_proba(split[FEATURES])[:, 1]
            rows.append({"model": name, "split": split_name, "threshold": threshold,
                         **_metrics(split["podium"], probability, threshold)})
    return trained, pd.DataFrame(rows), thresholds


def preprocessing_experiments(frame: pd.DataFrame) -> pd.DataFrame:
    splits = split_by_time(frame)
    variants = {
        "median + scaling": _pipeline(LogisticRegression(max_iter=2000, solver="liblinear", class_weight="balanced", random_state=42), True, "median"),
        "median, no scaling": _pipeline(LogisticRegression(max_iter=2000, solver="liblinear", class_weight="balanced", random_state=42), False, "median"),
        "zero + scaling": _pipeline(LogisticRegression(max_iter=2000, solver="liblinear", class_weight="balanced", random_state=42), True, "constant"),
    }
    rows = []
    for name, model in variants.items():
        model.fit(splits["train"][FEATURES], splits["train"].podium)
        p = model.predict_proba(splits["validation"][FEATURES])[:, 1]
        rows.append({"preprocessing": name, "validation_ROC-AUC": roc_auc_score(splits["validation"].podium, p),
                     "validation_PR-AUC": average_precision_score(splits["validation"].podium, p)})
    return pd.DataFrame(rows)


def ablation_experiments(frame: pd.DataFrame) -> pd.DataFrame:
    splits = split_by_time(frame)
    rows = []
    variants = {"all features": FEATURES}
    variants.update({f"without {group}": [f for f in FEATURES if f not in columns] for group, columns in FEATURE_GROUPS.items()})
    for name, features in variants.items():
        model = _pipeline(LogisticRegression(max_iter=2000, solver="liblinear", class_weight="balanced", random_state=42))
        model.fit(splits["train"][features], splits["train"].podium)
        p = model.predict_proba(splits["validation"][features])[:, 1]
        rows.append({"variant": name, "features": len(features), "validation_PR-AUC": average_precision_score(splits["validation"].podium, p),
                     "validation_ROC-AUC": roc_auc_score(splits["validation"].podium, p)})
    result = pd.DataFrame(rows)
    baseline = result.loc[result.variant.eq("all features"), "validation_PR-AUC"].iloc[0]
    result["PR-AUC_change"] = result["validation_PR-AUC"] - baseline
    return result


MECHANICAL_TERMS = {
    "Engine", "Gearbox", "Transmission", "Clutch", "Hydraulics", "Electrical", "Suspension",
    "Brakes", "Differential", "Overheating", "Mechanical", "Tyre", "Puncture", "Driveshaft",
    "Radiator", "Oil pressure", "Water leak", "Fuel pump", "Power Unit", "Turbo", "ERS",
    "Water pressure", "Oil leak", "Fuel pressure", "Wheel bearing", "Throttle", "Steering",
    "Technical", "Electronics", "Battery", "Alternator", "Spark plugs", "Fuel system",
}

NATIONALITY_TO_COUNTRY = {
    "American": "USA", "Argentine": "Argentina", "Australian": "Australia", "Austrian": "Austria",
    "Belgian": "Belgium", "Brazilian": "Brazil", "British": "UK", "Canadian": "Canada",
    "Chinese": "China", "Dutch": "Netherlands", "Finnish": "Finland", "French": "France",
    "German": "Germany", "Hungarian": "Hungary", "Indian": "India", "Italian": "Italy",
    "Japanese": "Japan", "Malaysian": "Malaysia", "Mexican": "Mexico", "Monegasque": "Monaco",
    "New Zealander": "New Zealand", "Portuguese": "Portugal", "Russian": "Russia",
    "South African": "South Africa", "Spanish": "Spain", "Swedish": "Sweden", "Swiss": "Switzerland",
}


def engineering_answers(frame: pd.DataFrame, tables: dict[str, pd.DataFrame]) -> dict[str, pd.DataFrame]:
    q1_source = frame[frame.grid.isin([1, 2])].copy()
    q1_source["era"] = np.where(q1_source.year >= 2014, "2014-2024", "1950-2013")
    q1 = (q1_source.groupby(["era", "circuit_name"]).podium.agg(["mean", "count"]).reset_index()
          .query("count >= 10").sort_values(["era", "mean"], ascending=[True, False]))

    home = frame.copy()
    home["home_country"] = home.driver_nationality.map(NATIONALITY_TO_COUNTRY)
    home = home[home.home_country.notna() & home.grid_position.notna()].copy()
    home["home_race"] = home.home_country.eq(home.country)
    home["grid_band"] = pd.cut(home.grid_position, [0, 3, 6, 10, 15, 100], labels=["1-3", "4-6", "7-10", "11-15", "16+"])
    q2 = home.groupby(["grid_band", "home_race"], observed=True).podium.agg(["mean", "count"]).reset_index()

    status = tables["status"].set_index("statusId")["status"]
    q3_source = frame[frame.year.between(2014, 2024)].copy()
    q3_source["status_text"] = q3_source.statusId.map(status)
    q3_source["mechanical"] = q3_source.status_text.isin(MECHANICAL_TERMS)
    q3_source["era"] = np.where(q3_source.year <= 2021, "2014-2021", "2022-2024")
    q3 = q3_source.groupby(["era", "constructor_name"]).mechanical.agg(["mean", "sum", "count"]).reset_index()
    q3 = q3[q3["count"] >= 20].sort_values(["era", "mean"], ascending=[True, False])
    return {"front_row_circuits": q1, "home_effect": q2, "mechanical_retirements": q3}


def create_plots(frame: pd.DataFrame, answers: dict[str, pd.DataFrame], metrics: pd.DataFrame,
                 ablations: pd.DataFrame, trained: dict[str, Pipeline], out_dir: str | Path) -> dict[str, str]:
    out = Path(out_dir); out.mkdir(parents=True, exist_ok=True)
    sns.set_theme(style="whitegrid", context="notebook")
    paths = {}
    def save(name: str):
        path = out / f"{name}.png"; plt.tight_layout(); plt.savefig(path, dpi=150, bbox_inches="tight"); plt.close(); paths[name] = str(path)

    coverage = frame.groupby("year").qualifying_position.apply(lambda x: x.notna().mean()).reset_index(name="coverage")
    plt.figure(figsize=(10, 4)); sns.lineplot(coverage, x="year", y="coverage"); plt.ylabel("Qualifying coverage"); plt.title("Qualifying coverage by season"); save("qualifying_coverage")

    q1 = answers["front_row_circuits"].groupby("era").head(10)
    plt.figure(figsize=(10, 6)); sns.barplot(q1, y="circuit_name", x="mean", hue="era"); plt.xlabel("Front-row to podium rate"); plt.ylabel(""); save("front_row_conversion")

    q2 = answers["home_effect"]
    plt.figure(figsize=(8, 4)); sns.lineplot(q2, x="grid_band", y="mean", hue="home_race", marker="o"); plt.ylabel("Podium rate"); plt.xlabel("Starting-grid band"); save("home_effect")

    q3 = answers["mechanical_retirements"].groupby("era").head(10)
    plt.figure(figsize=(10, 6)); sns.barplot(q3, y="constructor_name", x="mean", hue="era"); plt.xlabel("Mechanical-retirement rate"); plt.ylabel(""); save("mechanical_retirements")

    test_metrics = metrics[metrics.split.eq("test")].melt(id_vars=["model", "split", "threshold"], value_vars=["ROC-AUC", "PR-AUC", "F1", "Precision", "Recall"], var_name="metric", value_name="score")
    plt.figure(figsize=(10, 5)); sns.barplot(test_metrics, x="metric", y="score", hue="model"); plt.ylim(0, 1); save("model_comparison")

    plt.figure(figsize=(9, 4)); sns.barplot(ablations, y="variant", x="PR-AUC_change"); plt.axvline(0, color="black", lw=1); save("ablation")

    split = split_by_time(frame); forest = trained["Random forest"]
    sample = split["validation"].sample(min(1000, len(split["validation"])), random_state=42)
    perm = permutation_importance(forest, sample[FEATURES], sample.podium, scoring="average_precision", n_repeats=5, random_state=42, n_jobs=1)
    importance = pd.DataFrame({"feature": FEATURES, "importance": perm.importances_mean}).sort_values("importance", ascending=False)
    plt.figure(figsize=(9, 6)); sns.barplot(importance.head(12), y="feature", x="importance"); save("permutation_importance")
    importance.to_csv(out / "permutation_importance.csv", index=False)
    return paths


def shap_explanations(frame: pd.DataFrame, trained: dict[str, Pipeline], out_dir: str | Path) -> tuple[pd.DataFrame, pd.DataFrame]:
    import shap
    out = Path(out_dir); out.mkdir(parents=True, exist_ok=True)
    split = split_by_time(frame)
    sample = split["validation"].sample(min(400, len(split["validation"])), random_state=42)
    forest = trained["Random forest"]
    X = forest.named_steps["preprocess"].transform(sample[FEATURES])
    explainer = shap.TreeExplainer(forest.named_steps["model"])
    values = explainer.shap_values(X)
    if isinstance(values, list):
        values = values[1]
    elif values.ndim == 3:
        values = values[:, :, 1]
    global_df = pd.DataFrame({"feature": FEATURES, "mean_abs_shap": np.abs(values).mean(axis=0)}).sort_values("mean_abs_shap", ascending=False)
    plt.figure(figsize=(9, 6)); sns.barplot(global_df.head(12), y="feature", x="mean_abs_shap"); plt.tight_layout(); plt.savefig(out / "shap_global.png", dpi=150, bbox_inches="tight"); plt.close()
    row_values = values[0]
    local_df = pd.DataFrame({"feature": FEATURES, "shap_value": row_values, "observed_value": sample.iloc[0][FEATURES].values}).sort_values("shap_value", key=np.abs, ascending=False)
    plt.figure(figsize=(9, 6)); sns.barplot(local_df.head(12), y="feature", x="shap_value"); plt.axvline(0, color="black", lw=1); plt.tight_layout(); plt.savefig(out / "shap_local.png", dpi=150, bbox_inches="tight"); plt.close()
    global_df.to_csv(out / "shap_global.csv", index=False); local_df.to_csv(out / "shap_local.csv", index=False)
    return global_df, local_df


def predict_podium(record: dict[str, Any], model: Pipeline, threshold: float) -> dict[str, Any]:
    """Predict one complete or partial pre-race record; missing values are imputed."""
    row = pd.DataFrame([{feature: record.get(feature, np.nan) for feature in FEATURES}])
    probability = float(model.predict_proba(row)[0, 1])
    return {"podium_probability": probability, "predicted_podium": bool(probability >= threshold), "threshold": threshold}


def run_analysis(data_dir: str | Path = "data/raw", out_dir: str | Path = "artifacts") -> dict[str, Any]:
    out = Path(out_dir); out.mkdir(parents=True, exist_ok=True)
    tables = load_raw_tables(data_dir)
    pk, fk = audit_tables(tables)
    frame, diagnostics = build_modeling_table(tables)
    answers = engineering_answers(frame, tables)
    trained, metrics, thresholds = train_and_evaluate(frame)
    preprocessing = preprocessing_experiments(frame)
    ablations = ablation_experiments(frame)
    plots = create_plots(frame, answers, metrics, ablations, trained, out / "figures")
    shap_global, shap_local = shap_explanations(frame, trained, out / "figures")

    frame.to_csv(out / "modeling_table.csv", index=False)
    pk.to_csv(out / "primary_key_audit.csv", index=False); fk.to_csv(out / "foreign_key_audit.csv", index=False)
    metrics.to_csv(out / "model_metrics.csv", index=False); preprocessing.to_csv(out / "preprocessing_experiments.csv", index=False)
    ablations.to_csv(out / "ablation_results.csv", index=False)
    for name, answer in answers.items(): answer.to_csv(out / f"{name}.csv", index=False)
    complete = frame.loc[frame.year.ge(2022), FEATURES].dropna().iloc[0].to_dict()
    partial = {"grid_position": 3, "pit_lane_start": 0, "front_row": 0, "field_size": 20, "year": 2024, "round": 5}
    best_name = metrics[metrics.split.eq("validation")].sort_values("PR-AUC", ascending=False).iloc[0].model
    demos = {"model": best_name,
             "complete_record": predict_podium(complete, trained[best_name], thresholds[best_name]),
             "partial_record": predict_podium(partial, trained[best_name], thresholds[best_name])}
    summary = {"diagnostics": diagnostics, "thresholds": thresholds, "inference_demos": demos}
    (out / "summary.json").write_text(json.dumps(summary, indent=2), encoding="utf-8")
    return {"tables": tables, "modeling_table": frame, "pk_audit": pk, "fk_audit": fk,
            "answers": answers, "models": trained, "metrics": metrics, "thresholds": thresholds,
            "preprocessing": preprocessing, "ablations": ablations, "plots": plots,
            "shap_global": shap_global, "shap_local": shap_local, "summary": summary}

