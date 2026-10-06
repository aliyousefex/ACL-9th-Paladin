"""Export the numbers the UI is allowed to show, from artifacts/ only."""

from __future__ import annotations

import json
from pathlib import Path

import pandas as pd

ROOT = Path(__file__).resolve().parents[1]
ART = ROOT / "artifacts"
FIG = ART / "figures"
OUT = ROOT / "ui" / "src" / "data" / "site.json"

FEATURES = [
    "grid_position", "pit_lane_start", "front_row", "field_size",
    "qualifying_position", "qualifying_time_seconds", "qualifying_missing",
    "driver_podium_rate_5", "constructor_podium_rate_5", "driver_races_before",
    "driver_points_before", "driver_rank_before",
    "constructor_points_before", "constructor_rank_before",
    "driver_age", "round", "year",
]


def records(frame: pd.DataFrame) -> list[dict]:
    return json.loads(frame.to_json(orient="records"))


def main() -> None:
    summary = json.loads((ART / "summary.json").read_text(encoding="utf-8"))
    frame = pd.read_csv(ART / "modeling_table.csv", low_memory=False)
    drivers = pd.read_csv(ROOT / "data" / "raw" / "drivers.csv")
    pk = pd.read_csv(ART / "primary_key_audit.csv")
    fk = pd.read_csv(ART / "foreign_key_audit.csv")
    q1 = pd.read_csv(ART / "front_row_circuits.csv")
    q2 = pd.read_csv(ART / "home_effect.csv")
    q3 = pd.read_csv(ART / "mechanical_retirements.csv")
    metrics = pd.read_csv(ART / "model_metrics.csv")
    preprocessing = pd.read_csv(ART / "preprocessing_experiments.csv")
    ablation = pd.read_csv(ART / "ablation_results.csv")
    perm = pd.read_csv(FIG / "permutation_importance.csv")
    shap = pd.read_csv(FIG / "shap_global.csv")
    local = pd.read_csv(FIG / "shap_local.csv")

    coverage = (
        frame.groupby("year")["qualifying_position"]
        .apply(lambda s: float(s.notna().mean()))
        .reset_index(name="coverage")
    )

    def split_row(name: str, part: pd.DataFrame, seasons: str) -> dict:
        races = int(part.raceId.nunique())
        return {
            "name": name,
            "seasons": seasons,
            "rows": int(len(part)),
            "races": races,
            "startersPerRace": float(len(part) / races),
            "podiumRate": float(part.podium.mean()),
            "qualifyingMissing": float(part.qualifying_missing.mean()),
        }

    splits = [
        split_row("Training", frame[frame.year <= 2019], "1950-2019"),
        split_row("Validation", frame[frame.year.between(2020, 2021)], "2020-2021"),
        split_row("Test", frame[frame.year >= 2022], "2022-2024"),
    ]

    front = frame[frame.grid.isin([1, 2])].copy()
    front["era"] = front.year.map(lambda y: "2014-2024" if y >= 2014 else "1950-2013")
    base = frame.copy()
    base["era"] = base.year.map(lambda y: "2014-2024" if y >= 2014 else "1950-2013")

    def era_rate(part: pd.DataFrame, era: str) -> dict:
        rows = part[part.era == era]
        return {"era": era, "rate": float(rows.podium.mean()), "count": int(len(rows))}

    leaders = []
    for era in ["1950-2013", "2014-2024"]:
        for row in q1[q1.era == era].head(5).itertuples(index=False):
            leaders.append({
                "era": row.era,
                "circuit": row.circuit_name,
                "rate": float(row.mean),
                "starts": int(row.count),
            })

    def extreme(era: str, how: str) -> dict:
        part = q1[q1.era == era]
        row = part.sort_values("mean", ascending=(how == "min")).iloc[0]
        return {"circuit": row.circuit_name, "rate": float(row["mean"]), "starts": int(row["count"])}

    home = []
    for band in ["1-3", "4-6", "7-10", "11-15", "16+"]:
        part = q2[q2.grid_band == band]
        away = part[part.home_race == False].iloc[0]
        here = part[part.home_race == True].iloc[0]
        home.append({
            "band": band,
            "awayRate": float(away["mean"]),
            "awayStarts": int(away["count"]),
            "homeRate": float(here["mean"]),
            "homeStarts": int(here["count"]),
            "gap": float(here["mean"] - away["mean"]),
        })

    mechanical_eras = []
    for era, group in q3.groupby("era", sort=True):
        failures = int(group["sum"].sum())
        starts = int(group["count"].sum())
        mechanical_eras.append({
            "era": era,
            "failures": failures,
            "starts": starts,
            "rate": failures / starts,
            "median": float(group["mean"].median()),
            "teams": int(len(group)),
        })

    show = [
        ("2014-2021", "Caterham"), ("2014-2021", "Lotus F1"), ("2014-2021", "Toro Rosso"),
        ("2014-2021", "Mercedes"), ("2014-2021", "Aston Martin"), ("2014-2021", "Alfa Romeo"),
        ("2022-2024", "Alfa Romeo"), ("2022-2024", "Alpine F1 Team"), ("2022-2024", "AlphaTauri"),
        ("2022-2024", "Red Bull"), ("2022-2024", "McLaren"), ("2022-2024", "Sauber"),
    ]
    mechanical_rows = []
    for era, name in show:
        row = q3[(q3.era == era) & (q3.constructor_name == name)].iloc[0]
        mechanical_rows.append({
            "era": era,
            "constructor": name,
            "rate": float(row["mean"]),
            "failures": int(row["sum"]),
            "starts": int(row["count"]),
        })

    complete = frame.loc[frame.year.ge(2022), FEATURES + ["podium", "name", "constructor_name", "driverId"]].dropna(subset=FEATURES).iloc[0]
    driver = drivers[drivers.driverId == complete.driverId].iloc[0]
    demo = summary["inference_demos"]

    val = frame[frame.year.between(2020, 2021)]
    sample = val.sample(min(400, len(val)), random_state=42).iloc[0]
    russell = drivers[drivers.driverId == sample.driverId].iloc[0]

    perm_sorted = perm.sort_values("importance", ascending=False)
    perm_rows = pd.concat([perm_sorted.head(8), perm_sorted.tail(3)])

    payload = {
        "diagnostics": summary["diagnostics"],
        "podiumRate": float(frame.podium.mean()),
        "pitLaneShare": float(frame.pit_lane_start.mean()),
        "qualifyingMissing": float(frame.qualifying_position.isna().mean()),
        "audit": {
            "tables": int(len(pk)),
            "rows": int(pk.rows.sum()),
            "nullKeys": int(pk.null_keys.sum()),
            "duplicateKeys": int(pk.duplicate_keys.sum()),
            "foreignKeys": int(len(fk)),
            "orphans": int(fk.orphans.sum()),
            "checked": int(fk.checked.sum()),
        },
        "tableCounts": [
            {"table": row.table, "rows": int(row.rows)}
            for row in pk.itertuples(index=False)
        ],
        "splits": splits,
        "coverage": records(coverage),
        "frontRow": {
            "leaders": leaders,
            "overall": [era_rate(front, era) for era in ["1950-2013", "2014-2024"]],
            "allStarters": [era_rate(base, era) for era in ["1950-2013", "2014-2024"]],
            "median": [
                {"era": era, "rate": float(q1.loc[q1.era == era, "mean"].median()), "circuits": int((q1.era == era).sum())}
                for era in ["1950-2013", "2014-2024"]
            ],
            "low": [
                {"era": "1950-2013", **extreme("1950-2013", "min")},
                {"era": "2014-2024", **extreme("2014-2024", "min")},
            ],
            "high": [
                {"era": "1950-2013", **extreme("1950-2013", "max")},
                {"era": "2014-2024", **extreme("2014-2024", "max")},
            ],
        },
        "home": home,
        "mechanical": {
            "eras": mechanical_eras,
            "rows": mechanical_rows,
            "nonStarts": summary["non_start_statuses"],
            "statusCount": len(summary["mechanical_statuses"]),
        },
        "groups": [
            {"id": "grid", "name": "Grid", "inputs": ["Grid position", "Pit-lane start", "Front row", "Field size"], "why": "The final grid is set before the lights."},
            {"id": "qualifying", "name": "Qualifying", "inputs": ["Qualifying position", "Best session time", "Missingness flag"], "why": "Qualifying is already finished. The flag marks seasons where it was not recorded."},
            {"id": "form", "name": "Form", "inputs": ["Driver podium rate, previous 5", "Constructor podium rate, previous 5", "Starts already done"], "why": "The current race is shifted out before the window is computed."},
            {"id": "standings", "name": "Standings", "inputs": ["Driver points", "Driver rank", "Constructor points", "Constructor rank"], "why": "Taken from the previous race in the same season."},
            {"id": "context", "name": "Context", "inputs": ["Age", "Round", "Year"], "why": "Known on the morning of the race."},
        ],
        "excluded": ["Finishing position", "Points scored today", "Laps completed", "Status and retirement reason", "Pit stops", "Fastest lap"],
        "preprocessing": records(preprocessing),
        "metrics": records(metrics),
        "ablation": records(ablation),
        "permutation": [
            {"feature": row.feature, "importance": float(row.importance)}
            for row in perm_rows.itertuples(index=False)
        ],
        "shapGlobal": [
            {"feature": row.feature, "value": float(row.mean_abs_shap)}
            for row in shap.head(8).itertuples(index=False)
        ],
        "russell": {
            "driver": f"{russell.forename} {russell.surname}",
            "constructor": str(sample.constructor_name),
            "race": str(sample["name"]),
            "year": int(sample.year),
            "round": int(sample["round"]),
            "grid": float(sample.grid_position),
            "rank": float(sample.driver_rank_before),
            "podiumRate": float(sample.driver_podium_rate_5),
            "podium": int(sample.podium),
            "shap": [
                {"feature": row.feature, "value": float(row.shap_value), "observed": float(row.observed_value)}
                for row in local.head(6).itertuples(index=False)
            ],
        },
        "hamilton": {
            "driver": f"{driver.forename} {driver.surname}",
            "constructor": str(complete.constructor_name),
            "race": str(complete["name"]),
            "year": int(complete.year),
            "round": int(complete["round"]),
            "grid": float(complete.grid_position),
            "qualifying": float(complete.qualifying_position),
            "field": float(complete.field_size),
            "driverForm": float(complete.driver_podium_rate_5),
            "constructorForm": float(complete.constructor_podium_rate_5),
            "driverRank": float(complete.driver_rank_before),
            "driverPoints": float(complete.driver_points_before),
            "constructorRank": float(complete.constructor_rank_before),
            "constructorPoints": float(complete.constructor_points_before),
            "podium": int(complete.podium),
            "probability": float(demo["complete_record"]["podium_probability"]),
            "threshold": float(demo["complete_record"]["threshold"]),
            "predicted": bool(demo["complete_record"]["predicted_podium"]),
        },
        "partial": {
            "grid": 3,
            "field": 20,
            "year": 2024,
            "round": 5,
            "probability": float(demo["partial_record"]["podium_probability"]),
            "threshold": float(demo["partial_record"]["threshold"]),
            "predicted": bool(demo["partial_record"]["predicted_podium"]),
        },
        "selectedModel": demo["model"],
    }

    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(payload, indent=2), encoding="utf-8")
    print(OUT)


if __name__ == "__main__":
    main()
