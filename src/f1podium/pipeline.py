"""Data preparation, modeling, evaluation, and explanations for the F1 project.

Every model input is available after qualifying and before the race starts. Post-race
columns are only used for the target, lagged history, and the descriptive questions.
The one post-race column that also filters rows is ``positionText == "F"``, which the
instructor ruled is known before the race (see ``DID_NOT_ENTER_CODE``).
"""

from __future__ import annotations

import functools
import json
import re
import warnings
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
from sklearn.exceptions import ConvergenceWarning
from sklearn.experimental import enable_iterative_imputer  # noqa: F401  (activates IterativeImputer)
from sklearn.impute import IterativeImputer, KNNImputer, SimpleImputer
from sklearn.inspection import permutation_importance
from sklearn.linear_model import LogisticRegression, Ridge
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

# Piazza ruling on removing rows: ``positionText == "F"`` marks a driver who did not
# qualify, did not prequalify, or failed the 107% rule. That is settled before the race
# starts, so the driver never entered it and the row may be removed. ``W`` (withdrew) rows
# may NOT be removed: the code is only known after the race, and grid 0 can also be a
# real pit-lane start. The rows are dropped before any feature is built, so a skipped
# weekend never counts as a race in the form windows or in the field size.
DID_NOT_ENTER_CODE = "F"

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
    """Load the supplied CSV files and treat the literal ``\\N`` as missing."""
    data_dir = Path(data_dir)
    tables = {}
    for path in sorted(data_dir.glob("*.csv")):
        tables[path.stem] = pd.read_csv(path, na_values=[SENTINEL], low_memory=False)
    # Fail early here instead of getting a harder-to-read merge error later.
    required = set(PRIMARY_KEYS) | {"sprint_results", "lap_times", "pit_stops"}
    missing = required - tables.keys()
    if missing:
        raise FileNotFoundError(f"Missing required tables: {sorted(missing)}")
    return tables


def audit_tables(tables: dict[str, pd.DataFrame]) -> tuple[pd.DataFrame, pd.DataFrame]:
    """Check declared keys and return separate primary-key and foreign-key tables."""
    pk_rows = []
    for table, cols in PRIMARY_KEYS.items():
        frame = tables[table]
        pk_rows.append({"table": table, "key": "+".join(cols),
                        "rows": len(frame), "null_keys": int(frame[cols].isna().any(axis=1).sum()),
                        "duplicate_keys": int(frame.duplicated(cols).sum())})
    fk_rows = []
    for child, col, parent, parent_col in FOREIGN_KEYS:
        values = tables[child][col].dropna()
        # Any child value missing from the parent table is an orphaned reference.
        orphan = ~values.isin(tables[parent][parent_col].dropna())
        fk_rows.append({"relationship": f"{child}.{col} -> {parent}.{parent_col}",
                        "checked": len(values), "orphans": int(orphan.sum())})
    return pd.DataFrame(pk_rows), pd.DataFrame(fk_rows)


def _time_to_seconds(value: Any) -> float:
    """Convert a qualifying time such as ``1:23.456`` to seconds."""
    if pd.isna(value):
        return np.nan
    text = str(value).strip()
    # Minutes are optional because some files store short times as plain seconds.
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
    # Keep the downloaded table unchanged so the audit can still use the raw rows.
    frame = results.copy()
    frame["_started"] = frame["grid"].fillna(0).gt(0)
    counts = frame.groupby(["raceId", "driverId"]).size().rename("rows").reset_index()
    duplicates = counts[counts["rows"] > 1].copy()
    frame = frame.sort_values(
        ["raceId", "driverId", "_started", "positionOrder", "resultId"],
        ascending=[True, True, False, True, True], na_position="last",
    )
    # The sort puts the preferred row first within each driver-race group.
    clean = frame.drop_duplicates(["raceId", "driverId"], keep="first").drop(columns="_started")
    assert not clean.duplicated(["raceId", "driverId"]).any()
    return clean, duplicates


def _previous_standings(standings: pd.DataFrame, races: pd.DataFrame, entity: str) -> pd.DataFrame:
    """Move post-race standings forward so they describe the next race's starting state."""
    columns = ["raceId", entity, "points", "position"]
    s = standings[columns].merge(races[["raceId", "year", "round"]], on="raceId", how="left")
    s = s.sort_values([entity, "year", "round"])
    # A standings row is recorded after a race, so attach it to the next round.
    # Using it on the same race would leak the result we are trying to predict.
    s["next_raceId"] = s.groupby([entity, "year"])["raceId"].shift(-1)
    prefix = "driver" if entity == "driverId" else "constructor"
    return s.dropna(subset=["next_raceId"])[["next_raceId", entity, "points", "position"]].rename(
        columns={"next_raceId": "raceId", "points": f"{prefix}_points_before", "position": f"{prefix}_rank_before"}
    ).assign(raceId=lambda x: x.raceId.astype(int))


def build_modeling_table(tables: dict[str, pd.DataFrame],
                         drop_did_not_enter: bool = True) -> tuple[pd.DataFrame, dict[str, Any]]:
    """Build one pre-race feature row per driver and return cleaning diagnostics.

    Shared drives are resolved first, then the drivers who did not enter the race
    (``DID_NOT_ENTER_CODE``) are removed before any feature is computed. Pass
    ``drop_did_not_enter=False`` to keep them; the non-starter audit and experiment use that
    version to show what the decision changes.
    """
    races = tables["races"].copy()
    races["date"] = pd.to_datetime(races["date"], errors="coerce")
    results, duplicate_groups = clean_results(tables["results"])
    rows_after_shared_drives = len(results)
    if drop_did_not_enter:
        results = results[results["positionText"].ne(DID_NOT_ENTER_CODE)].copy()

    # Start from cleaned race results, then add the entities needed for features
    # and the three analysis questions.
    base = results.merge(races[["raceId", "year", "round", "date", "circuitId", "name"]], on="raceId", validate="many_to_one")
    base = base[base["year"].between(1950, 2024)].copy()
    base = base.merge(tables["drivers"][["driverId", "dob", "nationality"]].rename(columns={"nationality": "driver_nationality"}), on="driverId", validate="many_to_one")
    base = base.merge(tables["constructors"][["constructorId", "name"]].rename(columns={"name": "constructor_name"}), on="constructorId", validate="many_to_one")
    base = base.merge(tables["circuits"][["circuitId", "name", "country"]].rename(columns={"name": "circuit_name"}), on="circuitId", validate="many_to_one")
    base["dob"] = pd.to_datetime(base["dob"], errors="coerce")
    base["driver_age"] = (base["date"] - base["dob"]).dt.days / 365.2425
    base["podium"] = base["positionOrder"].le(3).astype(int)
    # Grid 0 means a pit-lane or exceptional start. Store it separately so zero is
    # not treated as a position ahead of pole.
    base["grid_position"] = base["grid"].where(base["grid"].gt(0))
    base["pit_lane_start"] = base["grid"].eq(0).astype(int)
    base["front_row"] = base["grid"].isin([1, 2]).astype(int)
    base["field_size"] = base.groupby("raceId")["driverId"].transform("size")

    qualifying = tables["qualifying"].copy()
    # Use the driver's best recorded session time. Older races often have no
    # qualifying row, so missingness is kept as its own feature.
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

    # No standings row yet means nothing has been scored yet this season: round 1,
    # a driver's or team's first race of the season, or 1950-1957 for constructors
    # (their championship began in 1958). The true value is 0 points, not an unknown
    # value for the median imputer to guess.
    for who in ["driver", "constructor"]:
        base[f"{who}_points_before"] = base[f"{who}_points_before"].fillna(0)
        base[f"{who}_rank_before"] = base[f"{who}_rank_before"].fillna(0)

    base = base.sort_values(["date", "raceId", "driverId"]).reset_index(drop=True)
    # Shift before rolling so a driver's current result cannot enter its own feature.
    base["driver_podium_rate_5"] = base.groupby("driverId")["podium"].transform(lambda s: s.shift().rolling(5, min_periods=1).mean())
    # Aggregate both cars at race level before shifting. A row-level shift could let
    # one teammate see the other teammate's result from the same race.
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
        "rows_after_shared_drive_resolution": int(rows_after_shared_drives),
        "did_not_enter_rows_removed": int(rows_after_shared_drives - len(results)),
        "clean_rows": int(len(base)),
        "unique_grain": bool(not base.duplicated(["raceId", "driverId"]).any()),
        "year_min": int(base.year.min()), "year_max": int(base.year.max()),
    }
    return base, diagnostics


SPLIT_YEARS = {"train": (1950, 2019), "validation": (2020, 2021), "test": (2022, 2024)}


def split_by_time(frame: pd.DataFrame) -> dict[str, pd.DataFrame]:
    """Create fixed chronological train, validation, and test periods."""
    return {name: frame[frame.year.between(first, last)].copy()
            for name, (first, last) in SPLIT_YEARS.items()}


def split_summary(frame: pd.DataFrame) -> pd.DataFrame:
    """Describe the size, period, target rate, and missingness of each split."""
    rows = []
    for name, part in split_by_time(frame).items():
        rows.append({
            "split": name,
            "years": f"{int(part.year.min())}-{int(part.year.max())}",
            "first_race": part.date.min().date().isoformat(),
            "last_race": part.date.max().date().isoformat(),
            "rows": int(len(part)),
            "share_of_rows": len(part) / len(frame),
            "races": int(part.raceId.nunique()),
            "drivers": int(part.driverId.nunique()),
            "starters_per_race": len(part) / part.raceId.nunique(),
            "podiums": int(part.podium.sum()),
            "podium_rate": float(part.podium.mean()),
            "qualifying_missing": float(part.qualifying_missing.mean()),
        })
    return pd.DataFrame(rows)


def split_integrity(frame: pd.DataFrame) -> pd.DataFrame:
    """Check that the split is complete, disjoint, and strictly ordered in time."""
    splits = split_by_time(frame)
    train, val, test = splits["train"], splits["validation"], splits["test"]
    races = {name: set(part.raceId) for name, part in splits.items()}
    checks = {
        "every row assigned to exactly one split": sum(len(p) for p in splits.values()) == len(frame),
        "no race shared by train and validation": not races["train"] & races["validation"],
        "no race shared by validation and test": not races["validation"] & races["test"],
        "no race shared by train and test": not races["train"] & races["test"],
        "last training race before first validation race": train.date.max() < val.date.min(),
        "last validation race before first test race": val.date.max() < test.date.min(),
        "both classes present in every split": all(p.podium.nunique() == 2 for p in splits.values()),
    }
    return pd.DataFrame({"check": list(checks), "passed": [bool(v) for v in checks.values()]})


def split_strategy_experiment(frame: pd.DataFrame, random_state: int = 42) -> pd.DataFrame:
    """Compare the chronological split with two random alternatives.

    Each strategy holds out the same number of rows as the validation seasons and
    trains the logistic baseline on the rest. The leakage columns show what a random
    split lets the model see that would not exist on a real race morning.
    """
    rng = np.random.default_rng(random_state)
    chrono = split_by_time(frame)
    holdout_size = len(chrono["validation"])
    # Hold out whole races so one strategy is random in time but not split inside a race.
    race_ids = frame.raceId.unique()
    shuffled = rng.permutation(race_ids)
    race_sizes = frame.groupby("raceId").size().loc[shuffled]
    held_races = set(race_sizes.index[race_sizes.cumsum() <= holdout_size])
    random_rows = frame.index[rng.permutation(len(frame))[:holdout_size]]
    strategies = {
        "chronological (used)": (chrono["train"], chrono["validation"]),
        "random races": (frame[~frame.raceId.isin(held_races)], frame[frame.raceId.isin(held_races)]),
        "random rows": (frame.drop(index=random_rows), frame.loc[random_rows]),
    }
    rows = []
    for name, (train, held) in strategies.items():
        model = clone(model_definitions(random_state)["Logistic regression"])
        model.fit(train[FEATURES], train.podium)
        p = model.predict_proba(held[FEATURES])[:, 1]
        rows.append({
            "strategy": name,
            "train_rows": int(len(train)),
            "held_out_rows": int(len(held)),
            "held_out_years": f"{int(held.year.min())}-{int(held.year.max())}",
            "held_out_podium_rate": float(held.podium.mean()),
            # Same-race leakage: another row from the held-out row's race sits in training.
            "held_out_races_also_in_train": float(held.raceId.isin(set(train.raceId)).mean()),
            # Future leakage: training contains seasons later than the held-out row.
            "held_out_rows_with_future_training": float(held.year.lt(train.year.max()).mean()),
            "PR-AUC": float(average_precision_score(held.podium, p)),
            "ROC-AUC": float(roc_auc_score(held.podium, p)),
        })
    return pd.DataFrame(rows)


def cleaning_eda(raw_results: pd.DataFrame, cleaned: pd.DataFrame) -> pd.DataFrame:
    """Compare row counts and key rates at each cleaning stage.

    Three stages show what each step does on its own: the raw results, the table after
    shared drives are resolved (the grain fix), and the final modeling table after the
    drivers who did not enter the race are removed.
    """
    raw = raw_results.copy()
    deduplicated, _ = clean_results(raw_results)
    stages = [("Raw results", raw),
              ("Shared drives resolved", deduplicated),
              ("Modeling table (F rows removed)", cleaned)]
    rows = []
    for stage, data in stages:
        podium = data["positionOrder"].le(3)
        rows.append({
            "stage": stage,
            "rows": int(len(data)),
            "unique_driver_races": int(data[["raceId", "driverId"]].drop_duplicates().shape[0]),
            "duplicate_rows": int(data.duplicated(["raceId", "driverId"], keep=False).sum()),
            "podium_rate": float(podium.mean()),
            "pit_lane_share": float(data["grid"].eq(0).mean()),
            "missing_finish_share": float(data["positionOrder"].isna().mean()),
            "median_grid": float(data.loc[data["grid"].gt(0), "grid"].median()),
        })
    return pd.DataFrame(rows)


def _pipeline(model: Any, scale: bool = True, strategy: str = "median") -> Pipeline:
    """Wrap a model with imputation and optional scaling fitted on training data."""
    steps = [("imputer", SimpleImputer(strategy=strategy, fill_value=0))]
    if scale:
        steps.append(("scaler", StandardScaler()))
    return Pipeline([("preprocess", Pipeline(steps)), ("model", model)])


def model_definitions(random_state: int = 42) -> dict[str, Pipeline]:
    """Return the three candidate models with reproducible settings.

    The forest and the network use the settings that won ``hyperparameter_search`` on
    validation: depth 12 with leaf size 30 for the forest (its starting settings, an
    unlimited depth with leaf size 4, memorized the training seasons), and a stronger
    regularization of 0.02 for the network (the starting 0.002 ranked second). Logistic
    regression kept its starting settings because the top three tie within 0.0001.
    """
    return {
        "Logistic regression": _pipeline(LogisticRegression(max_iter=2000, solver="liblinear", class_weight="balanced", random_state=random_state)),
        "Random forest": _pipeline(RandomForestClassifier(n_estimators=240, max_depth=12, min_samples_leaf=30, class_weight="balanced_subsample", n_jobs=1, random_state=random_state), scale=False),
        "Shallow neural network": _pipeline(MLPClassifier(hidden_layer_sizes=(32, 12), alpha=0.02, early_stopping=True, max_iter=300, random_state=random_state)),
    }


def _best_threshold(y: pd.Series, probability: np.ndarray) -> float:
    """Choose the validation threshold with the highest F1 score."""
    candidates = np.linspace(0.05, 0.80, 151)
    # Threshold selection uses validation predictions only. The test set stays out.
    scores = [f1_score(y, probability >= value, zero_division=0) for value in candidates]
    return float(candidates[int(np.argmax(scores))])


def _metrics(y: pd.Series, probability: np.ndarray, threshold: float) -> dict[str, float]:
    """Calculate ranking metrics and threshold-based classification metrics."""
    prediction = probability >= threshold
    return {
        "ROC-AUC": float(roc_auc_score(y, probability)),
        "PR-AUC": float(average_precision_score(y, probability)),
        "F1": float(f1_score(y, prediction, zero_division=0)),
        "Precision": float(precision_score(y, prediction, zero_division=0)),
        "Recall": float(recall_score(y, prediction, zero_division=0)),
    }


def train_and_evaluate(frame: pd.DataFrame, random_state: int = 42) -> tuple[dict[str, Pipeline], pd.DataFrame, dict[str, float]]:
    """Fit each candidate on training years and score every chronological split."""
    splits = split_by_time(frame)
    trained, rows, thresholds = {}, [], {}
    for name, model in model_definitions(random_state).items():
        model.fit(splits["train"][FEATURES], splits["train"]["podium"])
        # Each model gets its own cutoff because their probability scales differ.
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
    """Compare imputation and scaling choices using validation scores only."""
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


def preprocessing_effects(frame: pd.DataFrame) -> pd.DataFrame:
    """Measure what median imputation and scaling do to every feature.

    Both steps are fitted on training rows. Validation and test pass through the
    same fitted transform, so their scaled means show the shift between periods.
    """
    splits = split_by_time(frame)
    train = splits["train"][FEATURES]
    imputer = SimpleImputer(strategy="median").fit(train)
    imputed = pd.DataFrame(imputer.transform(train), columns=FEATURES, index=train.index)
    scaler = StandardScaler().fit(imputed)
    scaled = pd.DataFrame(scaler.transform(imputed), columns=FEATURES, index=train.index)

    def later_scaled(name: str) -> pd.DataFrame:
        """Apply the training-fitted imputer and scaler to a later split."""
        filled = pd.DataFrame(imputer.transform(splits[name][FEATURES]), columns=FEATURES)
        return pd.DataFrame(scaler.transform(filled), columns=FEATURES)

    val_scaled, test_scaled = later_scaled("validation"), later_scaled("test")
    rows = []
    for i, f in enumerate(FEATURES):
        rows.append({
            "feature": f,
            "missing_share": float(train[f].isna().mean()),
            "fill_value": float(imputer.statistics_[i]),
            "raw_min": float(train[f].min()), "raw_max": float(train[f].max()),
            "raw_mean": float(train[f].mean()), "raw_std": float(train[f].std()),
            "imputed_mean": float(imputed[f].mean()), "imputed_std": float(imputed[f].std()),
            # Filling many rows with one value shrinks the spread of that feature.
            "std_change_from_imputation": float(imputed[f].std() / train[f].std() - 1),
            "scaled_min": float(scaled[f].min()), "scaled_max": float(scaled[f].max()),
            "scaled_mean": float(scaled[f].mean()), "scaled_std": float(scaled[f].std()),
            "validation_scaled_mean": float(val_scaled[f].mean()),
            "test_scaled_mean": float(test_scaled[f].mean()),
        })
    return pd.DataFrame(rows)


def feature_engineering_effects(frame: pd.DataFrame, tables: dict[str, pd.DataFrame]) -> pd.DataFrame:
    """Compare raw source columns with the engineered features built from them."""
    qualifying = tables["qualifying"]
    raw_times = qualifying[["q1", "q2", "q3"]]
    parsed = pd.concat([raw_times[c].map(_time_to_seconds) for c in raw_times], axis=1)
    pairs = [
        ("grid (raw)", frame["grid"]),
        ("grid_position (0 -> missing)", frame["grid_position"]),
        ("pit_lane_start (grid == 0)", frame["pit_lane_start"]),
        ("q1/q2/q3 text present", raw_times.notna().any(axis=1).astype(float)),
        ("best qualifying seconds (parsed)", parsed.min(axis=1)),
        ("qualifying_time_seconds (joined)", frame["qualifying_time_seconds"]),
        ("driver_podium_rate_5 (shifted)", frame["driver_podium_rate_5"]),
        ("driver_points_before (previous race)", frame["driver_points_before"]),
    ]
    rows = []
    for name, values in pairs:
        values = pd.to_numeric(values, errors="coerce")
        rows.append({"column": name, "rows": int(len(values)),
                     "missing_share": float(values.isna().mean()),
                     "zero_share": float(values.eq(0).mean()),
                     "min": float(values.min()), "median": float(values.median()),
                     "max": float(values.max()), "mean": float(values.mean())})
    return pd.DataFrame(rows)


def _ordered_preprocessor(order: str) -> Pipeline:
    """Return imputation and scaling steps in the requested order."""
    median = ("imputer", SimpleImputer(strategy="median"))
    zero = ("imputer", SimpleImputer(strategy="constant", fill_value=0))
    scale = ("scaler", StandardScaler())
    steps = {
        "impute -> scale": [median, scale],
        "scale -> impute": [scale, median],
        "zero-fill -> scale": [zero, scale],
        "scale -> zero-fill": [scale, zero],
    }[order]
    return Pipeline(steps)


PREPROCESSING_ORDERS = [
    # (experiment, order, fit preprocessing on)
    ("A: impute vs scale first", "impute -> scale", "train"),
    ("A: impute vs scale first", "scale -> impute", "train"),
    ("B: zero-fill vs scale first", "zero-fill -> scale", "train"),
    ("B: zero-fill vs scale first", "scale -> zero-fill", "train"),
    ("C: split vs preprocess first", "impute -> scale", "all years (before split)"),
]


def preprocessing_order_experiments(frame: pd.DataFrame, random_state: int = 42) -> pd.DataFrame:
    """Swap the order of preprocessing steps and score each order on validation.

    Experiment A swaps median imputation and scaling. Experiment B swaps zero-filling
    and scaling, where order changes the value written into missing cells. Experiment C
    fits the preprocessing before splitting, which lets later seasons set the medians
    and scaling statistics used in training.
    """
    splits = split_by_time(frame)
    train, val = splits["train"], splits["validation"]
    base_models = model_definitions(random_state)
    rows = []
    for experiment, order, fitted_on in PREPROCESSING_ORDERS:
        pre = _ordered_preprocessor(order)
        pre.fit(frame[FEATURES] if fitted_on.startswith("all") else train[FEATURES])
        X_train, X_val = pre.transform(train[FEATURES]), pre.transform(val[FEATURES])
        # Express the value given to a missing cell in original units for two features.
        scaler = pre.named_steps["scaler"]
        filled = pre.transform(pd.DataFrame([{f: np.nan for f in FEATURES}]))[0] * scaler.scale_ + scaler.mean_
        for model_name in ["Logistic regression", "Shallow neural network"]:
            model = clone(base_models[model_name].named_steps["model"]).fit(X_train, train.podium)
            p = model.predict_proba(X_val)[:, 1]
            rows.append({
                "experiment": experiment, "order": order, "preprocessing_fitted_on": fitted_on,
                "model": model_name,
                "missing_grid_position_becomes": float(filled[FEATURES.index("grid_position")]),
                "missing_qualifying_time_becomes": float(filled[FEATURES.index("qualifying_time_seconds")]),
                "train_std_qualifying_time": float(X_train[:, FEATURES.index("qualifying_time_seconds")].std()),
                "validation_PR-AUC": float(average_precision_score(val.podium, p)),
                "validation_ROC-AUC": float(roc_auc_score(val.podium, p)),
            })
    result = pd.DataFrame(rows)
    # Compare each order with the first order of the same experiment and model.
    first = result.groupby(["experiment", "model"])["validation_PR-AUC"].transform("first")
    result["PR-AUC_change_vs_reference"] = result["validation_PR-AUC"] - first
    reference = result[result.experiment.str.startswith("A") & result.order.eq("impute -> scale")]
    reference = reference.set_index("model")["validation_PR-AUC"]
    # Experiment C has a single row per model, so compare it with the fit-on-train run.
    leaky = result.experiment.str.startswith("C")
    result.loc[leaky, "PR-AUC_change_vs_reference"] = (
        result.loc[leaky, "validation_PR-AUC"] - result.loc[leaky, "model"].map(reference))
    return result


def preprocessing_plots(frame: pd.DataFrame, effects: pd.DataFrame, out_dir: str | Path) -> dict[str, str]:
    """Plot feature distributions and ranges before and after preprocessing."""
    out = Path(out_dir); out.mkdir(parents=True, exist_ok=True)
    sns.set_theme(style="whitegrid", context="notebook")
    splits = split_by_time(frame)
    train = splits["train"][FEATURES]
    imputer = SimpleImputer(strategy="median").fit(train)
    imputed = pd.DataFrame(imputer.transform(train), columns=FEATURES)
    scaler = StandardScaler().fit(imputed)
    scaled = pd.DataFrame(scaler.transform(imputed), columns=FEATURES)
    val_filled = pd.DataFrame(imputer.transform(splits["validation"][FEATURES]), columns=FEATURES)
    val_scaled = pd.DataFrame(scaler.transform(val_filled), columns=FEATURES)
    shown = ["grid_position", "qualifying_time_seconds", "driver_points_before", "constructor_podium_rate_5"]

    fig, axes = plt.subplots(2, len(shown), figsize=(15, 6.5))
    for j, f in enumerate(shown):
        # Top row: the imputed column has a spike at the training median.
        bins = np.histogram_bin_edges(imputed[f], bins=40)
        axes[0, j].hist(imputed[f], bins=bins, color="#e76f51", alpha=0.55, label="after median imputation")
        axes[0, j].hist(train[f].dropna(), bins=bins, color="#264653", alpha=0.7, label="raw (observed)")
        axes[0, j].axvline(imputer.statistics_[FEATURES.index(f)], color="black", ls="--", lw=1)
        axes[0, j].set_title(f"{f}\n{train[f].isna().mean():.0%} missing in training")
        axes[0, j].set_yscale("log")
        # Bottom row: training is centred at zero; validation shows the later-season shift.
        bins = np.histogram_bin_edges(np.r_[scaled[f], val_scaled[f]], bins=40)
        axes[1, j].hist(scaled[f], bins=bins, density=True, color="#2a9d8f", alpha=0.6, label="training, scaled")
        axes[1, j].hist(val_scaled[f], bins=bins, density=True, color="#f4a261", alpha=0.6, label="validation, same transform")
        axes[1, j].axvline(0, color="black", lw=1)
        axes[1, j].set_xlabel("standardized value")
    axes[0, 0].set_ylabel("rows (log)"); axes[1, 0].set_ylabel("density")
    axes[0, 0].legend(fontsize=8); axes[1, 0].legend(fontsize=8)
    fig.suptitle("Effect of median imputation (top) and training-fitted scaling (bottom)")
    fig.tight_layout(); fig.savefig(out / "preprocessing_distributions.png", dpi=150, bbox_inches="tight"); plt.close(fig)

    fig, axes = plt.subplots(1, 2, figsize=(13, 6), sharey=True)
    order = effects.sort_values("raw_std")["feature"]
    e = effects.set_index("feature").loc[order]
    axes[0].barh(order, e.raw_max - e.raw_min, color="#264653")
    axes[0].set_xscale("symlog", linthresh=1); axes[0].set_title("Raw training range (max - min)")
    axes[1].hlines(order, e.scaled_min, e.scaled_max, color="#2a9d8f", lw=4)
    axes[1].plot(e.validation_scaled_mean, order, "o", color="#e76f51", label="validation mean")
    axes[1].axvline(0, color="black", lw=1); axes[1].legend()
    axes[1].set_title("Range after scaling (training)")
    fig.tight_layout(); fig.savefig(out / "preprocessing_ranges.png", dpi=150, bbox_inches="tight"); plt.close(fig)
    return {"preprocessing_distributions": str(out / "preprocessing_distributions.png"),
            "preprocessing_ranges": str(out / "preprocessing_ranges.png")}


def split_plot(frame: pd.DataFrame, out_dir: str | Path) -> str:
    """Plot rows, podium rate, and qualifying missingness by season, coloured by split."""
    out = Path(out_dir); out.mkdir(parents=True, exist_ok=True)
    labelled = pd.concat([part.assign(split=name) for name, part in split_by_time(frame).items()])
    by_year = labelled.groupby(["year", "split"]).agg(rows=("podium", "size"), podium_rate=("podium", "mean"),
                                                      qualifying_missing=("qualifying_missing", "mean")).reset_index()
    palette = {"train": "#264653", "validation": "#f4a261", "test": "#e76f51"}
    fig, axes = plt.subplots(1, 3, figsize=(15, 4))
    for ax, col, title in zip(axes, ["rows", "podium_rate", "qualifying_missing"],
                              ["Driver-race rows", "Podium rate", "Qualifying missing"]):
        sns.barplot(by_year, x="year", y=col, hue="split", palette=palette, dodge=False, ax=ax, width=1)
        ax.set_title(title); ax.set_xlabel("season"); ax.set_ylabel("")
        ax.set_xticks(range(0, len(by_year.year.unique()), 10))
        ax.set_xticklabels(sorted(by_year.year.unique())[::10])
        if ax is not axes[0]:
            ax.get_legend().remove()
    fig.tight_layout(); path = out / "chronological_split.png"
    fig.savefig(path, dpi=150, bbox_inches="tight"); plt.close(fig)
    return str(path)


def ablation_experiments(frame: pd.DataFrame) -> pd.DataFrame:
    """Remove one feature group at a time and measure the validation score change."""
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
    # Negative changes mean the removed group was helping the full model.
    baseline = result.loc[result.variant.eq("all features"), "validation_PR-AUC"].iloc[0]
    result["PR-AUC_change"] = result["validation_PR-AUC"] - baseline
    return result


def _quiet(function):
    """Hide two expected scikit-learn notices inside an experiment.

    Newer scikit-learn deprecates the ``penalty`` argument that the search grid uses on
    purpose (older versions need it), and the iterative imputer reports that it stopped at
    its iteration limit. Neither changes the result, and repeating them hundreds of times
    would bury the tables.
    """
    @functools.wraps(function)
    def wrapper(*args, **kwargs):
        with warnings.catch_warnings():
            warnings.filterwarnings("ignore", message=".*penalty.*")
            warnings.filterwarnings("ignore", category=ConvergenceWarning)
            return function(*args, **kwargs)
    return wrapper


def _feature_bins(values: pd.Series) -> pd.Series:
    """Return a bin code per row: the value itself for flags, else five equal-count bins.

    Ranking first splits tied values (for example many zero form rates) across bins, so
    every bin is populated; tied rows then share the same rate, which is correct.
    """
    observed = values.dropna()
    if observed.nunique() <= 2:
        return values
    return pd.qcut(observed.rank(method="first"), q=5, labels=False).reindex(values.index)


def feature_eda(frame: pd.DataFrame) -> pd.DataFrame:
    """Give every model feature its own exploratory evidence, using training rows only.

    For each feature: how much is missing, how the podium rate changes between its low
    and high values, and a one-feature ROC-AUC (above 0.5 means a higher value goes with
    more podiums). The same one-feature AUC on validation shows whether the pattern
    holds in later seasons. Missing cells are excluded from the AUC and from the bins.
    """
    splits = split_by_time(frame)
    train, val = splits["train"], splits["validation"]
    rows = []
    for group, columns in FEATURE_GROUPS.items():
        for feature in columns:
            observed = train[[feature, "podium"]].dropna()
            observed_val = val[[feature, "podium"]].dropna()
            bins = _feature_bins(observed[feature])
            rates = observed.podium.groupby(bins, observed=True).mean()
            auc_train = float(roc_auc_score(observed.podium, observed[feature]))
            auc_val = (float(roc_auc_score(observed_val.podium, observed_val[feature]))
                       if observed_val.podium.nunique() == 2 else np.nan)
            missing = train.loc[train[feature].isna(), "podium"]
            rows.append({
                "group": group, "feature": feature,
                "missing_share_train": float(train[feature].isna().mean()),
                "podium_rate_when_missing": float(missing.mean()) if len(missing) else np.nan,
                "podium_rate_lowest_bin": float(rates.iloc[0]), "podium_rate_highest_bin": float(rates.iloc[-1]),
                "bins": int(len(rates)),
                "auc_train": auc_train, "auc_validation": auc_val,
                "direction": "higher value, more podiums" if auc_train >= 0.5 else "lower value, more podiums",
                "signal_strength": abs(auc_train - 0.5) * 2,
                "same_direction_in_validation": bool(np.isnan(auc_val) or (auc_val - 0.5) * (auc_train - 0.5) > 0),
            })
    return pd.DataFrame(rows)


def feature_eda_panels(frame: pd.DataFrame) -> dict[str, dict[str, Any]]:
    """Return the bars behind each feature panel: labels, podium rates, and which bar is 'missing'."""
    train = split_by_time(frame)["train"]
    summary = feature_eda(frame).set_index("feature")
    panels = {}
    for feature in FEATURES:
        observed = train[[feature, "podium"]].dropna()
        bins = _feature_bins(observed[feature])
        rates = observed.podium.groupby(bins, observed=True).mean()
        # Label each bin by the median feature value inside it.
        labels = [f"{observed[feature][bins == code].median():.4g}" for code in rates.index]
        heights = [float(v) for v in rates.values]
        has_missing = bool(summary.loc[feature, "missing_share_train"] > 0)
        if has_missing:
            heights.append(float(summary.loc[feature, "podium_rate_when_missing"])); labels.append("missing")
        panels[feature] = {"labels": labels, "heights": heights, "has_missing_bar": has_missing,
                           "auc": float(summary.loc[feature, "auc_train"]),
                           "missing_share": float(summary.loc[feature, "missing_share_train"])}
    return panels


def feature_eda_plot(frame: pd.DataFrame, out_dir: str | Path) -> str:
    """Draw one small panel per feature: podium rate by feature bin, training rows only."""
    out = Path(out_dir); out.mkdir(parents=True, exist_ok=True)
    sns.set_theme(style="whitegrid", context="notebook")
    panels = feature_eda_panels(frame)
    fig, axes = plt.subplots(4, 5, figsize=(17, 11))
    for ax, (feature, panel) in zip(axes.ravel(), panels.items()):
        colors = ["#264653"] * len(panel["heights"])
        if panel["has_missing_bar"]:
            colors[-1] = "#e76f51"
        ax.bar(range(len(panel["heights"])), panel["heights"], color=colors)
        ax.set_xticks(range(len(panel["heights"]))); ax.set_xticklabels(panel["labels"], rotation=45, ha="right", fontsize=8)
        ax.set_title(f"{feature}\nAUC {panel['auc']:.2f}, {panel['missing_share']:.0%} missing", fontsize=9)
        ax.set_ylim(0, 1); ax.set_ylabel("podium rate" if ax in axes[:, 0] else "")
    for ax in axes.ravel()[len(FEATURES):]:
        ax.axis("off")
    fig.suptitle("Podium rate by feature value, training seasons 1950-2019 (orange = rows where the feature is missing)")
    fig.tight_layout(); path = out / "feature_eda.png"
    fig.savefig(path, dpi=150, bbox_inches="tight"); plt.close(fig)
    return str(path)


def _validation_scores(train: pd.DataFrame, val: pd.DataFrame, features: list[str],
                       preprocessor: Pipeline, random_state: int = 42) -> dict[str, dict[str, float]]:
    """Fit a preprocessor on ``train`` once, then score logistic regression and the MLP on ``val``."""
    base = model_definitions(random_state)
    preprocessor = clone(preprocessor).fit(train[features])
    X_train, X_val = preprocessor.transform(train[features]), preprocessor.transform(val[features])
    scores = {}
    for name in ["Logistic regression", "Shallow neural network"]:
        model = clone(base[name].named_steps["model"]).fit(X_train, train.podium)
        p = model.predict_proba(X_val)[:, 1]
        scores[name] = {"PR-AUC": float(average_precision_score(val.podium, p)),
                        "ROC-AUC": float(roc_auc_score(val.podium, p))}
    return scores


@_quiet
def missing_value_experiments(frame: pd.DataFrame, random_state: int = 42) -> pd.DataFrame:
    """Compare ways of handling missing values, scored on validation only.

    About two thirds of training rows have no qualifying record. Each variant either
    fills those cells (four imputers), drops the sparse columns, drops the rows, or
    removes the missing-indicator flag, so the choice is backed by a score instead of
    a preference. Every variant is scored on the same 2020-2021 validation rows.
    """
    splits = split_by_time(frame)
    train, val = splits["train"], splits["validation"]
    first_qualifying_year = int(frame.loc[frame.qualifying_position.notna(), "year"].min())
    sparse = [f for f in FEATURES if train[f].isna().mean() > 0.5 and not f.endswith("_missing")]
    median = Pipeline([("imputer", SimpleImputer(strategy="median")), ("scaler", StandardScaler())])
    # KNN and iterative imputation use the other columns, so they work on scaled inputs.
    knn = Pipeline([("scaler", StandardScaler()), ("imputer", KNNImputer(n_neighbors=5))])
    iterative = Pipeline([("scaler", StandardScaler()),
                          ("imputer", IterativeImputer(max_iter=10, random_state=random_state))])
    mean = Pipeline([("imputer", SimpleImputer(strategy="mean")), ("scaler", StandardScaler())])
    variants = [
        ("median imputation (used)", "impute", FEATURES, train, median),
        ("mean imputation", "impute", FEATURES, train, mean),
        ("KNN imputation (k=5)", "impute", FEATURES, train, knn),
        ("iterative (regression) imputation", "impute", FEATURES, train, iterative),
        ("median, without the qualifying_missing flag", "flag", [f for f in FEATURES if f != "qualifying_missing"], train, median),
        (f"drop the sparse columns ({', '.join(sparse)})", "drop columns", [f for f in FEATURES if f not in sparse], train, median),
        (f"drop training rows with no qualifying (keeps {first_qualifying_year}+)", "drop rows", FEATURES, train[train.qualifying_position.notna()], median),
        ("drop training rows with any missing feature", "drop rows", FEATURES, train.dropna(subset=FEATURES), median),
    ]
    rows = []
    for name, kind, features, train_part, pre in variants:
        for model, score in _validation_scores(train_part, val, features, pre, random_state).items():
            rows.append({"variant": name, "approach": kind, "train_rows": int(len(train_part)),
                         "features": len(features), "model": model,
                         "validation_PR-AUC": score["PR-AUC"], "validation_ROC-AUC": score["ROC-AUC"]})
    result = pd.DataFrame(rows)
    used = result[result.variant.eq("median imputation (used)")].set_index("model")["validation_PR-AUC"]
    result["PR-AUC_change_vs_used"] = result["validation_PR-AUC"] - result["model"].map(used)
    return result


SEARCH_SPACE = {
    "Logistic regression": [{"C": c, "penalty": p} for p in ("l1", "l2") for c in (0.01, 0.1, 1.0, 10.0)],
    "Random forest": [{"max_depth": d, "min_samples_leaf": leaf} for d in (6, 12, None) for leaf in (4, 12, 30)],
    "Shallow neural network": [{"hidden_layer_sizes": h, "alpha": a}
                               for h in [(8,), (16,), (32,), (64,), (32, 12), (64, 32)] for a in (0.002, 0.02)],
}
SEARCH_SEEDS = {"Logistic regression": (42,), "Random forest": (42,), "Shallow neural network": (42, 43, 44)}


def _model_from_params(name: str, params: dict[str, Any], seed: int) -> Pipeline:
    """Build one candidate with the fixed settings plus the searched ``params``."""
    if name == "Logistic regression":
        return _pipeline(LogisticRegression(max_iter=2000, solver="liblinear", class_weight="balanced", random_state=seed, **params))
    if name == "Random forest":
        return _pipeline(RandomForestClassifier(n_estimators=240, class_weight="balanced_subsample", n_jobs=1, random_state=seed, **params), scale=False)
    return _pipeline(MLPClassifier(early_stopping=True, max_iter=300, random_state=seed, **params))


# The settings we started with, before the search. The forest was changed to the
# validation winner; the other two models kept their starting settings.
INITIAL_SETTINGS = {
    "Logistic regression": {"C": 1.0, "penalty": "l2"},
    "Random forest": {"max_depth": None, "min_samples_leaf": 4},
    "Shallow neural network": {"hidden_layer_sizes": (32, 12), "alpha": 0.002},
}


def _current_params(name: str) -> dict[str, Any]:
    """Return the searched settings of the model currently used in ``model_definitions``."""
    model = model_definitions()[name].named_steps["model"]
    params = {key: model.get_params()[key] for key in SEARCH_SPACE[name][0]}
    # Newer scikit-learn reports the default penalty as 'deprecated'; it is still L2.
    if params.get("penalty") not in (None, "l1", "l2"):
        params["penalty"] = "l2"
    return params


@_quiet
def hyperparameter_search(frame: pd.DataFrame) -> pd.DataFrame:
    """Search each model's settings on validation only; the test seasons are never touched.

    Every setting is trained on 1950-2019 and scored on 2020-2021. The network is
    averaged over three seeds because its score moves with the random initialization,
    and the spread is reported so a gain smaller than the noise is not mistaken for progress.
    """
    splits = split_by_time(frame)
    train, val = splits["train"], splits["validation"]
    rows = []
    for name, grid in SEARCH_SPACE.items():
        current = _current_params(name)
        for params in grid:
            pr, roc, train_pr = [], [], []
            for seed in SEARCH_SEEDS[name]:
                model = _model_from_params(name, params, seed).fit(train[FEATURES], train.podium)
                p = model.predict_proba(val[FEATURES])[:, 1]
                pr.append(average_precision_score(val.podium, p)); roc.append(roc_auc_score(val.podium, p))
                train_pr.append(average_precision_score(train.podium, model.predict_proba(train[FEATURES])[:, 1]))
            rows.append({"model": name, "settings": str(params), "is_current": params == current,
                         "is_initial": params == INITIAL_SETTINGS[name],
                         "seeds": len(pr), "validation_PR-AUC": float(np.mean(pr)),
                         "validation_PR-AUC_std": float(np.std(pr)), "validation_ROC-AUC": float(np.mean(roc)),
                         "train_PR-AUC": float(np.mean(train_pr))})
    result = pd.DataFrame(rows)
    result["rank_within_model"] = result.groupby("model")["validation_PR-AUC"].rank(ascending=False, method="min").astype(int)
    result["selected"] = result.rank_within_model.eq(1)
    return result.sort_values(["model", "rank_within_model"]).reset_index(drop=True)


@_quiet
def split_window_experiment(frame: pd.DataFrame, random_state: int = 42) -> pd.DataFrame:
    """Score the same two models on four validation windows that all precede the test seasons.

    Each window trains on every earlier season. If the 2020-2021 choice were unusual,
    its score would stand apart from the others; the spread also shows how much a
    validation score of about 40 races can move.
    """
    rows = []
    windows = [(2014, 2015), (2016, 2017), (2018, 2019), (2020, 2021)]
    pre = Pipeline([("imputer", SimpleImputer(strategy="median")), ("scaler", StandardScaler())])
    for start, end in windows:
        train, val = frame[frame.year < start], frame[frame.year.between(start, end)]
        scores = _validation_scores(train, val, FEATURES, pre, random_state)
        rows.append({"validation_window": f"{start}-{end}" + (" (used)" if start == 2020 else ""),
                     "train_years": f"1950-{start - 1}", "train_rows": int(len(train)),
                     "validation_rows": int(len(val)), "validation_races": int(val.raceId.nunique()),
                     "validation_podium_rate": float(val.podium.mean()),
                     "Logistic regression PR-AUC": scores["Logistic regression"]["PR-AUC"],
                     "Shallow neural network PR-AUC": scores["Shallow neural network"]["PR-AUC"]})
    return pd.DataFrame(rows)


def validation_uncertainty(frame: pd.DataFrame, trained: dict[str, Pipeline],
                           n_boot: int = 1000, random_state: int = 42,
                           split: str = "validation") -> pd.DataFrame:
    """Bootstrap whole races to show how uncertain a split's PR-AUC is.

    The default is the validation split, where the choices are made. ``split="test"`` gives the
    same interval for the unseen seasons. It only resamples predictions that already exist, so
    the test seasons are not scored again and nothing is chosen with it.
    """
    val = split_by_time(frame)[split].reset_index(drop=True)
    score = f"{split}_PR-AUC"
    probabilities = {name: m.predict_proba(val[FEATURES])[:, 1] for name, m in trained.items()}
    by_race = [index.to_numpy() for _, index in val.groupby("raceId").groups.items()]
    rng = np.random.default_rng(random_state)
    draws = {name: [] for name in probabilities}
    for _ in range(n_boot):
        rows = np.concatenate([by_race[i] for i in rng.integers(0, len(by_race), len(by_race))])
        for name, p in probabilities.items():
            draws[name].append(average_precision_score(val.podium.to_numpy()[rows], p[rows]))
    draws = {name: np.array(v) for name, v in draws.items()}
    out = []
    for name, v in draws.items():
        out.append({"comparison": name, score: float(average_precision_score(val.podium, probabilities[name])),
                    "ci_low_2.5%": float(np.percentile(v, 2.5)), "ci_high_97.5%": float(np.percentile(v, 97.5)),
                    "races": len(by_race)})
    for name in ["Random forest", "Shallow neural network"]:
        diff = draws[name] - draws["Logistic regression"]
        out.append({"comparison": f"{name} minus Logistic regression",
                    score: float(average_precision_score(val.podium, probabilities[name])
                                 - average_precision_score(val.podium, probabilities["Logistic regression"])),
                    "ci_low_2.5%": float(np.percentile(diff, 2.5)), "ci_high_97.5%": float(np.percentile(diff, 97.5)),
                    "races": len(by_race)})
    return pd.DataFrame(out)


def sprint_weekend_check(frame: pd.DataFrame, tables: dict[str, pd.DataFrame]) -> pd.DataFrame:
    """Decide the sprint leakage question with evidence, one row per sprint season.

    Sprint results are joined only to answer it; they never enter ``FEATURES``. The
    table shows when a sprint ends relative to the race, whether it sets the main-race
    grid (it did in 2021-2022), and how many sprint rows each split would contain.
    """
    races = tables["races"][["raceId", "year", "date", "sprint_date"]].copy()
    races["date"] = pd.to_datetime(races["date"]); races["sprint_date"] = pd.to_datetime(races["sprint_date"])
    sprint = tables["sprint_results"][["raceId", "driverId", "grid", "positionOrder"]].rename(
        columns={"grid": "sprint_grid", "positionOrder": "sprint_finish"})
    weekend = frame.merge(sprint, on=["raceId", "driverId"], how="inner").merge(
        races[["raceId", "sprint_date"]], on="raceId", how="left")
    rows = []
    for year, part in weekend.groupby("year"):
        rows.append({
            "season": int(year), "sprint_races": int(part.raceId.nunique()), "driver_rows": int(len(part)),
            "split": next(name for name, (a, b) in SPLIT_YEARS.items() if a <= year <= b),
            "sprint_ends_before_race_share": float((part.sprint_date < part.date).mean()),
            "days_before_race": float((part.date - part.sprint_date).dt.days.median()),
            # Rank correlation between the main-race grid and each earlier session.
            "grid_vs_sprint_finish": float(part.grid_position.corr(part.sprint_finish, method="spearman")),
            "grid_vs_qualifying": float(part.grid_position.corr(part.qualifying_position, method="spearman")),
        })
    result = pd.DataFrame(rows)
    # A sprint feature would be empty for every training row: sprints start in 2021.
    result["sprint_rows_in_training"] = int(weekend.year.le(SPLIT_YEARS["train"][1]).sum())
    return result


def non_starter_audit(frame: pd.DataFrame, tables: dict[str, pd.DataFrame]) -> pd.DataFrame:
    """Describe who has grid 0 and what we do with each group.

    ``frame`` must be built with ``drop_did_not_enter=False``, so it still holds the F rows
    that the modeling table removes. The ``treatment`` column records the decision per group.
    """
    status = tables["status"].set_index("statusId")["status"]
    f = frame.assign(status_text=frame.statusId.map(status))
    f["group"] = np.select(
        [f.positionText.eq("F"), f.positionText.eq("W"), f.grid.eq(0)],
        ["F: did not qualify, prequalify, or pass 107%", "W: withdrew", "grid 0 but raced (pit-lane or exceptional start)"],
        default="regular grid start")
    treatment = {
        "regular grid start": "kept",
        "grid 0 but raced (pit-lane or exceptional start)": "kept",
        "W: withdrew": "kept (the code is only known after the race)",
        "F: did not qualify, prequalify, or pass 107%": "removed before features (known before the race)",
    }
    rows = []
    for group, part in f.groupby("group"):
        rows.append({
            "group": group, "treatment": treatment[group],
            "rows": int(len(part)), "share_of_rows": float(len(part) / len(f)),
            "grid_zero_share": float(part.grid.eq(0).mean()), "podium_rate": float(part.podium.mean()),
            "first_year": int(part.year.min()), "last_year": int(part.year.max()),
            "rows_in_training": int(part.year.le(2019).sum()),
            "rows_in_validation": int(part.year.between(2020, 2021).sum()),
            "rows_in_test": int(part.year.ge(2022).sum()),
            "main_statuses": "; ".join(f"{k} ({v})" for k, v in part.status_text.value_counts().head(3).items()),
        })
    order = {"regular grid start": 0, "grid 0 but raced (pit-lane or exceptional start)": 1,
             "W: withdrew": 2, "F: did not qualify, prequalify, or pass 107%": 3}
    return pd.DataFrame(rows).sort_values("group", key=lambda s: s.map(order)).reset_index(drop=True)


@_quiet
def non_starter_experiment(with_f: pd.DataFrame, frame: pd.DataFrame, random_state: int = 42) -> pd.DataFrame:
    """Score the decision about F rows on the same validation rows.

    ``with_f`` is the table built with ``drop_did_not_enter=False`` and ``frame`` is the
    modeling table with the F rows removed before features. No F row is in the validation
    seasons, so every variant is scored on the same 780 validation rows. The last variant
    shows what removing W rows would do; the instructor does not allow it.
    """
    all_train, all_val = split_by_time(with_f)["train"], split_by_time(with_f)["validation"]
    used = split_by_time(frame)
    pre = Pipeline([("imputer", SimpleImputer(strategy="median")), ("scaler", StandardScaler())])
    variants = [
        ("drop F rows before features (used)", used["train"], used["validation"]),
        ("keep F rows in the history and in training", all_train, all_val),
        ("keep F rows in the history, drop them from training only",
         all_train[~all_train.positionText.eq(DID_NOT_ENTER_CODE)], all_val),
        ("also drop W rows from training (not allowed)",
         all_train[~all_train.positionText.isin([DID_NOT_ENTER_CODE, "W"])], all_val),
    ]
    rows = []
    for name, part, val in variants:
        for model, score in _validation_scores(part, val, FEATURES, pre, random_state).items():
            rows.append({"variant": name, "train_rows": int(len(part)),
                         "train_podium_rate": float(part.podium.mean()),
                         "train_pit_lane_share": float(part.pit_lane_start.mean()),
                         "train_field_size": float(part.field_size.mean()),
                         "model": model, "validation_PR-AUC": score["PR-AUC"], "validation_ROC-AUC": score["ROC-AUC"]})
    result = pd.DataFrame(rows)
    used = result[result.variant.eq("drop F rows before features (used)")].set_index("model")["validation_PR-AUC"]
    result["PR-AUC_change_vs_used"] = result["validation_PR-AUC"] - result["model"].map(used)
    return result


MECHANICAL_TERMS = {
    "Engine", "Gearbox", "Transmission", "Clutch", "Hydraulics", "Electrical", "Suspension",
    "Brakes", "Differential", "Overheating", "Mechanical", "Tyre", "Puncture", "Driveshaft",
    "Radiator", "Oil pressure", "Water leak", "Fuel pump", "Power Unit", "Turbo", "ERS",
    "Water pressure", "Oil leak", "Fuel pressure", "Wheel bearing", "Throttle", "Steering",
    "Technical", "Electronics", "Battery", "Alternator", "Spark plugs", "Fuel system",
    "Power loss", "Wheel", "Exhaust", "Undertray", "Wheel nut", "Front wing", "Rear wing",
    "Fuel leak", "Vibrations", "Drivetrain", "Brake duct", "Cooling system", "Water pump",
    # The instructor (Piazza @10) said to count these as mechanical for simplicity.
    # "Refuelling" is the one listed status that is deliberately left out.
    "Tyre puncture", "Fire", "Safety belt",
    # Engine fire and engine misfire are engine failures, so they count as mechanical.
    # Heat shield fire is left out, following TA feedback. None of these statuses
    # occur in 2014-2024, so this choice does not change the Question 3 results.
    "Engine fire", "Engine misfire",
    
}

# Exclude recorded non-starters from the mechanical-failure denominator. The F rows are
# already gone from the modeling table, so "Did not qualify" and "Did not prequalify" only
# matter if someone builds the table with ``drop_did_not_enter=False``.
NON_START_STATUSES = {"Withdrew", "Did not start", "Did not qualify", "Did not prequalify", "Excluded"}

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
    """Build the result tables for the three required data-engineering questions."""
    # Use the final grid for the front-row question because penalties can change a
    # driver's position between qualifying and the actual start.
    q1_source = frame[frame.grid.isin([1, 2])].copy()
    q1_source["era"] = np.where(q1_source.year >= 2014, "2014-2024", "1950-2013")
    q1 = (q1_source.groupby(["era", "circuit_name"]).podium.agg(["mean", "count"]).reset_index()
          .query("count >= 10").sort_values(["era", "mean"], ascending=[True, False]))

    # Compare home and away drivers within broad grid bands. This does not make the
    # result causal, but it avoids comparing front-row and back-row starts directly.
    home = frame.copy()
    home["home_country"] = home.driver_nationality.map(NATIONALITY_TO_COUNTRY)
    home = home[home.home_country.notna() & home.grid_position.notna()].copy()
    home["home_race"] = home.home_country.eq(home.country)
    home["grid_band"] = pd.cut(home.grid_position, [0, 3, 6, 10, 15, 100], labels=["1-3", "4-6", "7-10", "11-15", "16+"])
    q2 = home.groupby(["grid_band", "home_race"], observed=True).podium.agg(["mean", "count"]).reset_index()

    # Count only the component failures listed above. Ambiguous statuses stay out of
    # the numerator, and recorded non-starters stay out of the denominator.
    status = tables["status"].set_index("statusId")["status"]
    q3_source = frame[frame.year.between(2014, 2024)].copy()
    q3_source["status_text"] = q3_source.statusId.map(status)
    q3_source = q3_source[~q3_source.status_text.isin(NON_START_STATUSES)].copy()
    q3_source["mechanical"] = q3_source.status_text.isin(MECHANICAL_TERMS)
    q3_source["era"] = np.where(q3_source.year <= 2021, "2014-2021", "2022-2024")
    q3 = q3_source.groupby(["era", "constructor_name"]).mechanical.agg(["mean", "sum", "count"]).reset_index()
    q3 = q3[q3["count"] >= 20].sort_values(["era", "mean"], ascending=[True, False])
    return {"front_row_circuits": q1, "home_effect": q2, "mechanical_retirements": q3}


def create_plots(frame: pd.DataFrame, cleaning: pd.DataFrame,
                 answers: dict[str, pd.DataFrame], metrics: pd.DataFrame,
                 ablations: pd.DataFrame, trained: dict[str, Pipeline], out_dir: str | Path) -> dict[str, str]:
    """Create the report figures and return their output paths."""
    out = Path(out_dir); out.mkdir(parents=True, exist_ok=True)
    sns.set_theme(style="whitegrid", context="notebook")
    paths = {}
    def save(name: str):
        """Apply the shared layout, save the active figure, and close it."""
        path = out / f"{name}.png"; plt.tight_layout(); plt.savefig(path, dpi=150, bbox_inches="tight"); plt.close(); paths[name] = str(path)

    # Show whether each cleaning step changed the grain or important outcome rates.
    staged = cleaning.assign(stage=cleaning.stage.str.replace(" (", "\n(", regex=False))
    fig, axes = plt.subplots(1, 2, figsize=(13, 4.4))
    counts = staged.melt(id_vars="stage", value_vars=["rows", "unique_driver_races"],
                         var_name="measure", value_name="count")
    sns.barplot(counts, x="stage", y="count", hue="measure", ax=axes[0])
    axes[0].set_title("Grain at each cleaning stage")
    axes[0].set_xlabel(""); axes[0].set_ylabel("Rows / unique pairs")
    rates = staged.melt(id_vars="stage", value_vars=["podium_rate", "pit_lane_share", "missing_finish_share"],
                        var_name="measure", value_name="share")
    sns.barplot(rates, x="measure", y="share", hue="stage", ax=axes[1])
    axes[1].set_title("Rates affected by row selection")
    axes[1].set_xlabel(""); axes[1].set_ylabel("Share of rows")
    axes[1].tick_params(axis="x", rotation=15)
    fig.tight_layout(); fig.savefig(out / "cleaning_before_after.png", dpi=150, bbox_inches="tight"); plt.close(fig)
    paths["cleaning_before_after"] = str(out / "cleaning_before_after.png")

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

    # Use a fixed validation sample to keep repeated permutation scoring manageable.
    split = split_by_time(frame); forest = trained["Random forest"]
    sample = split["validation"].sample(min(1000, len(split["validation"])), random_state=42)
    perm = permutation_importance(forest, sample[FEATURES], sample.podium, scoring="average_precision", n_repeats=5, random_state=42, n_jobs=1)
    importance = pd.DataFrame({"feature": FEATURES, "importance": perm.importances_mean}).sort_values("importance", ascending=False)
    plt.figure(figsize=(9, 6)); sns.barplot(importance.head(12), y="feature", x="importance"); save("permutation_importance")
    importance.to_csv(out / "permutation_importance.csv", index=False)
    return paths


def shap_explanations(frame: pd.DataFrame, trained: dict[str, Pipeline], out_dir: str | Path) -> tuple[pd.DataFrame, pd.DataFrame]:
    """Create global and single-row SHAP explanations for the random forest."""
    out = Path(out_dir); out.mkdir(parents=True, exist_ok=True)
    try:
        import shap
    except ImportError:
        # Some managed Windows setups block Numba's compiled extension. Reuse saved
        # SHAP results there; Kaggle and normal environments calculate them directly.
        global_csv, local_csv = out / "shap_global.csv", out / "shap_local.csv"
        if global_csv.exists() and local_csv.exists():
            return pd.read_csv(global_csv), pd.read_csv(local_csv)
        raise
    split = split_by_time(frame)
    # A fixed sample keeps the plot reproducible without explaining every row.
    sample = split["validation"].sample(min(400, len(split["validation"])), random_state=42)
    forest = trained["Random forest"]
    X = forest.named_steps["preprocess"].transform(sample[FEATURES])
    explainer = shap.TreeExplainer(forest.named_steps["model"])
    values = explainer.shap_values(X)
    # SHAP has used both list and 3D-array outputs across versions. We only need the
    # contributions for the podium class.
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


def lime_explanation(frame: pd.DataFrame, trained: dict[str, Pipeline], out_dir: str | Path,
                     n_samples: int = 5000) -> pd.DataFrame:
    """Explain one validation prediction with a small local LIME surrogate.

    Each synthetic row keeps some values from the explained case and replaces the
    rest with values from training rows. ``n_samples`` controls the local sample size.
    The returned table includes signed feature weights and a fidelity score.
    """
    out = Path(out_dir); out.mkdir(parents=True, exist_ok=True)
    split = split_by_time(frame)
    train = split["train"][FEATURES].reset_index(drop=True)
    explained = split["validation"].sample(1, random_state=42).iloc[0]
    model = trained["Random forest"]
    rng = np.random.default_rng(42)

    # Draw replacements from training data so the test period cannot affect LIME.
    background = train.iloc[rng.integers(0, len(train), size=n_samples)].reset_index(drop=True)
    # A 1 keeps the explained value. Keeping most values makes these synthetic rows
    # local rather than unrelated points drawn across the full data set.
    interpretable = rng.binomial(1, 0.8, size=(n_samples, len(FEATURES))).astype(float)
    # Include the exact row so the surrogate is anchored at the shown prediction.
    interpretable[0, :] = 1.0
    perturbed = background.copy()
    for j, feature in enumerate(FEATURES):
        perturbed.loc[interpretable[:, j].astype(bool), feature] = explained[feature]

    # Fit a simple model to the forest's local predictions. Rows with more replaced
    # values get less weight because they are farther from the case being explained.
    probabilities = model.predict_proba(perturbed)[:, 1]
    distances = np.sqrt(((1.0 - interpretable) ** 2).sum(axis=1))
    kernel_width = 0.75 * np.sqrt(len(FEATURES))
    weights = np.exp(-(distances ** 2) / (kernel_width ** 2))
    surrogate = Ridge(alpha=0.01).fit(interpretable, probabilities, sample_weight=weights)
    local_prediction = float(surrogate.predict(np.ones((1, len(FEATURES))))[0])
    model_prediction = float(model.predict_proba(pd.DataFrame([explained[FEATURES]]))[0, 1])
    # Report weighted R2 so a weak local approximation is visible to the reader.
    fidelity = float(surrogate.score(interpretable, probabilities, sample_weight=weights))

    local_df = pd.DataFrame({
        "feature": FEATURES,
        "lime_weight": surrogate.coef_,
        "observed_value": explained[FEATURES].values,
        "model_probability": model_prediction,
        "surrogate_probability": local_prediction,
        "local_fidelity_r2": fidelity,
    }).sort_values("lime_weight", key=np.abs, ascending=False)
    colors = np.where(local_df.head(12).lime_weight.ge(0), "#2a9d8f", "#e76f51")
    plt.figure(figsize=(9, 6))
    plt.barh(local_df.head(12).feature[::-1], local_df.head(12).lime_weight[::-1], color=colors[::-1])
    plt.axvline(0, color="black", lw=1)
    plt.xlabel("Local LIME contribution toward podium probability")
    plt.title(f"Local LIME explanation (surrogate weighted R² = {fidelity:.3f})")
    plt.tight_layout(); plt.savefig(out / "lime_local.png", dpi=150, bbox_inches="tight"); plt.close()
    local_df.to_csv(out / "lime_local.csv", index=False)
    return local_df


def predict_podium(record: dict[str, Any], model: Pipeline, threshold: float) -> dict[str, Any]:
    """Score one pre-race record, leaving omitted fields for the fitted imputer."""
    row = pd.DataFrame([{feature: record.get(feature, np.nan) for feature in FEATURES}])
    probability = float(model.predict_proba(row)[0, 1])
    return {"podium_probability": probability, "predicted_podium": bool(probability >= threshold), "threshold": threshold}


def run_analysis(data_dir: str | Path = "data/raw", out_dir: str | Path = "artifacts") -> dict[str, Any]:
    """Run the full analysis and write the tables and figures used by the deliverables."""
    out = Path(out_dir); out.mkdir(parents=True, exist_ok=True)
    tables = load_raw_tables(data_dir)
    pk, fk = audit_tables(tables)
    frame, diagnostics = build_modeling_table(tables)
    cleaning = cleaning_eda(tables["results"], frame)
    answers = engineering_answers(frame, tables)
    trained, metrics, thresholds = train_and_evaluate(frame)
    preprocessing = preprocessing_experiments(frame)
    effects = preprocessing_effects(frame)
    engineering_effects = feature_engineering_effects(frame, tables)
    order_experiments = preprocessing_order_experiments(frame)
    splits_table, integrity = split_summary(frame), split_integrity(frame)
    split_strategies = split_strategy_experiment(frame)
    split_windows = split_window_experiment(frame)
    uncertainty = validation_uncertainty(frame, trained)
    test_uncertainty = validation_uncertainty(frame, trained, split="test")
    missing_experiments = missing_value_experiments(frame)
    tuning = hyperparameter_search(frame)
    sprint_check = sprint_weekend_check(frame, tables)
    # The audit and experiment need the table that still contains the F rows.
    with_f, _ = build_modeling_table(tables, drop_did_not_enter=False)
    non_starters, non_starter_runs = non_starter_audit(with_f, tables), non_starter_experiment(with_f, frame)
    feature_summary = feature_eda(frame)
    ablations = ablation_experiments(frame)
    plots = create_plots(frame, cleaning, answers, metrics, ablations, trained, out / "figures")
    plots.update(preprocessing_plots(frame, effects, out / "figures"))
    plots["chronological_split"] = split_plot(frame, out / "figures")
    plots["feature_eda"] = feature_eda_plot(frame, out / "figures")
    shap_global, shap_local = shap_explanations(frame, trained, out / "figures")
    lime_local = lime_explanation(frame, trained, out / "figures")

    # Save the intermediate evidence so the report can be rebuilt without retraining.
    frame.to_csv(out / "modeling_table.csv", index=False)
    cleaning.to_csv(out / "cleaning_eda.csv", index=False)
    pk.to_csv(out / "primary_key_audit.csv", index=False); fk.to_csv(out / "foreign_key_audit.csv", index=False)
    metrics.to_csv(out / "model_metrics.csv", index=False); preprocessing.to_csv(out / "preprocessing_experiments.csv", index=False)
    effects.to_csv(out / "preprocessing_effects.csv", index=False)
    engineering_effects.to_csv(out / "feature_engineering_effects.csv", index=False)
    order_experiments.to_csv(out / "preprocessing_order_experiments.csv", index=False)
    splits_table.to_csv(out / "split_summary.csv", index=False); integrity.to_csv(out / "split_integrity.csv", index=False)
    split_strategies.to_csv(out / "split_strategy_experiment.csv", index=False)
    split_windows.to_csv(out / "split_window_experiment.csv", index=False)
    uncertainty.to_csv(out / "validation_uncertainty.csv", index=False)
    test_uncertainty.to_csv(out / "test_uncertainty.csv", index=False)
    missing_experiments.to_csv(out / "missing_value_experiments.csv", index=False)
    tuning.to_csv(out / "hyperparameter_search.csv", index=False)
    sprint_check.to_csv(out / "sprint_weekend_check.csv", index=False)
    non_starters.to_csv(out / "non_starter_audit.csv", index=False)
    feature_summary.to_csv(out / "feature_eda.csv", index=False)
    non_starter_runs.to_csv(out / "non_starter_experiment.csv", index=False)
    ablations.to_csv(out / "ablation_results.csv", index=False)
    for name, answer in answers.items(): answer.to_csv(out / f"{name}.csv", index=False)
    # Check a complete historical row and an intentionally partial input using the
    # model selected on validation PR-AUC.
    complete = frame.loc[frame.year.ge(2022), FEATURES].dropna().iloc[0].to_dict()
    partial = {"grid_position": 3, "pit_lane_start": 0, "front_row": 0, "field_size": 20, "year": 2024, "round": 5}
    best_name = metrics[metrics.split.eq("validation")].sort_values("PR-AUC", ascending=False).iloc[0].model
    demos = {"model": best_name,
             "complete_record": predict_podium(complete, trained[best_name], thresholds[best_name]),
             "partial_record": predict_podium(partial, trained[best_name], thresholds[best_name])}
    summary = {
        "diagnostics": diagnostics,
        "thresholds": thresholds,
        "inference_demos": demos,
        "mechanical_statuses": sorted(MECHANICAL_TERMS),
        "non_start_statuses": sorted(NON_START_STATUSES),
    }
    (out / "summary.json").write_text(json.dumps(summary, indent=2), encoding="utf-8")
    return {"tables": tables, "modeling_table": frame, "pk_audit": pk, "fk_audit": fk,
            "answers": answers, "models": trained, "metrics": metrics, "thresholds": thresholds,
            "preprocessing": preprocessing, "preprocessing_effects": effects,
            "feature_engineering_effects": engineering_effects, "preprocessing_order": order_experiments,
            "split_summary": splits_table, "split_integrity": integrity, "split_strategies": split_strategies,
            "split_windows": split_windows, "validation_uncertainty": uncertainty,
            "test_uncertainty": test_uncertainty,
            "missing_experiments": missing_experiments, "tuning": tuning, "sprint_check": sprint_check,
            "non_starters": non_starters, "non_starter_experiment": non_starter_runs, "feature_eda": feature_summary,
            "ablations": ablations, "cleaning_eda": cleaning, "plots": plots,
            "shap_global": shap_global, "shap_local": shap_local, "lime_local": lime_local,
            "summary": summary}

