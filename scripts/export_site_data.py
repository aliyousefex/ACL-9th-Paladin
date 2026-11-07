"""Export the data behind the Paladin race-prediction experience, from artifacts/ and data/raw/ only.

Nothing here retrains a model and nothing is invented:

* The selected model is the logistic regression the pipeline already fitted. Its coefficients and
  intercept are read from ``artifacts/figures/logistic_weights.csv`` and ``logistic_local.csv``.
  The imputer medians and scaler statistics are recomputed from the training rows (1950-2019) with
  the same definitions scikit-learn uses. The result is checked against the pipeline's own output
  before anything is written: the saved PR-AUC and ROC-AUC of all three splits, the saved F1,
  precision and recall at the frozen cutoff, and the standardized values and probability of the
  explained validation row must all be reproduced.
* Per-driver scores are produced for the 68 races of the held-out test seasons (2022-2024), the
  rows the model never saw. They are exported with the 16 raw feature values, so the browser can
  repeat the same arithmetic and a viewer can change an input.
* Results, lap-by-lap positions, pit stops and standings are historical records from data/raw.

Needs only numpy and pandas. Run from the repository root after scripts/run_analysis.py and
scripts/build_circuit_data.py::

    .venv\\Scripts\\python.exe scripts\\export_site_data.py
"""

from __future__ import annotations

import json
import math
import re
import unicodedata
from pathlib import Path

import numpy as np
import pandas as pd

ROOT = Path(__file__).resolve().parents[1]
ART = ROOT / "artifacts"
FIG = ART / "figures"
RAW = ROOT / "data" / "raw"
SRC = ROOT / "ui" / "src" / "data"
PUB = ROOT / "ui" / "public" / "data"

FEATURES = [
    "grid_position", "pit_lane_start", "front_row", "field_size",
    "qualifying_position", "qualifying_time_seconds", "qualifying_missing",
    "driver_podium_rate_5", "constructor_podium_rate_5", "driver_races_before",
    "driver_points_before", "driver_rank_before",
    "constructor_points_before", "constructor_rank_before",
    "driver_age", "year",
]
SELECTED = "Logistic regression"
TRAIN_LAST_YEAR = 2019
TEST_FIRST_YEAR = 2022

# The Kaggle copy of races.csv and circuits.csv stores a few accented letters as U+FFFD.
TEXT_FIXES = {
    "S�o Paulo": "São Paulo",
    "Aut�dromo Hermanos Rodr�guez": "Autódromo Hermanos Rodríguez",
    "Aut�dromo Jos� Carlos Pace": "Autódromo José Carlos Pace",
}
NATIONALITY_FIXES = {"Argentinian": "Argentine"}
FLAG = {
    "Dutch": "NL", "British": "GB", "Spanish": "ES", "Monegasque": "MC", "Mexican": "MX", "Australian": "AU",
    "German": "DE", "French": "FR", "Finnish": "FI", "Canadian": "CA", "Japanese": "JP", "Thai": "TH",
    "Chinese": "CN", "Danish": "DK", "American": "US", "New Zealander": "NZ", "Argentine": "AR",
    "Italian": "IT", "Brazilian": "BR", "Austrian": "AT", "Swiss": "CH",
}
COUNTRY_FLAG = {
    "Bahrain": "BH", "Saudi Arabia": "SA", "Australia": "AU", "Italy": "IT", "USA": "US", "United States": "US",
    "Spain": "ES", "Monaco": "MC", "Azerbaijan": "AZ", "Canada": "CA", "UK": "GB", "Austria": "AT",
    "France": "FR", "Hungary": "HU", "Belgium": "BE", "Netherlands": "NL", "Singapore": "SG", "Japan": "JP",
    "Mexico": "MX", "Brazil": "BR", "UAE": "AE", "Qatar": "QA", "China": "CN",
}

# One colour per constructor and season. The values are the broadcast livery colours that are
# widely published for these seasons; they are styling, not data.
TEAM_COLOURS = {
    "red_bull": {"short": "Red Bull", "colour": {2022: "#3671C6", 2023: "#3671C6", 2024: "#3671C6"}},
    "ferrari": {"short": "Ferrari", "colour": {2022: "#E8002D", 2023: "#E8002D", 2024: "#E8002D"}},
    "mercedes": {"short": "Mercedes", "colour": {2022: "#27F4D2", 2023: "#27F4D2", 2024: "#27F4D2"}},
    "mclaren": {"short": "McLaren", "colour": {2022: "#FF8000", 2023: "#FF8000", 2024: "#FF8000"}},
    "aston_martin": {"short": "Aston Martin", "colour": {2022: "#229971", 2023: "#229971", 2024: "#229971"}},
    "alpine": {"short": "Alpine", "colour": {2022: "#2293D1", 2023: "#2293D1", 2024: "#FF87BC"}},
    "williams": {"short": "Williams", "colour": {2022: "#64C4FF", 2023: "#64C4FF", 2024: "#64C4FF"}},
    "haas": {"short": "Haas", "colour": {2022: "#B6BABD", 2023: "#B6BABD", 2024: "#B6BABD"}},
    "alphatauri": {"short": "AlphaTauri", "colour": {2022: "#5B8FB9", 2023: "#5B8FB9", 2024: "#5B8FB9"}},
    "rb": {"short": "RB", "colour": {2022: "#6692FF", 2023: "#6692FF", 2024: "#6692FF"}},
    "alfa": {"short": "Alfa Romeo", "colour": {2022: "#C92D4B", 2023: "#C92D4B", 2024: "#C92D4B"}},
    "sauber": {"short": "Sauber", "colour": {2022: "#52E252", 2023: "#52E252", 2024: "#52E252"}},
}


def fix(text: str) -> str:
    for bad, good in TEXT_FIXES.items():
        text = text.replace(bad, good)
    return text


def slugify(text: str) -> str:
    text = unicodedata.normalize("NFKD", text).encode("ascii", "ignore").decode()
    return re.sub(r"[^a-z0-9]+", "-", text.lower()).strip("-")


def num(value, digits: int | None = None):
    """JSON-safe number: NaN becomes null."""
    if value is None or (isinstance(value, float) and math.isnan(value)) or pd.isna(value):
        return None
    value = float(value)
    if digits is not None:
        value = round(value, digits)
    return int(value) if value.is_integer() else value


# ------------------------------------------------------------------------- metrics, from scratch


def roc_auc(y: np.ndarray, score: np.ndarray) -> float:
    ranks = pd.Series(score).rank(method="average").to_numpy()
    pos = y == 1
    n_pos, n_neg = pos.sum(), (~pos).sum()
    return float((ranks[pos].sum() - n_pos * (n_pos + 1) / 2) / (n_pos * n_neg))


def average_precision(y: np.ndarray, score: np.ndarray) -> float:
    order = np.argsort(-score, kind="mergesort")
    s, t = score[order], y[order]
    tp = np.cumsum(t)
    fp = np.cumsum(1 - t)
    last = np.r_[np.where(np.diff(s))[0], len(s) - 1]
    precision = tp[last] / (tp[last] + fp[last])
    recall = tp[last] / tp[-1]
    return float(np.sum((recall - np.r_[0.0, recall[:-1]]) * precision))


def threshold_metrics(y: np.ndarray, score: np.ndarray, threshold: float) -> dict:
    pred = score >= threshold
    tp = int((pred & (y == 1)).sum())
    fp = int((pred & (y == 0)).sum())
    fn = int((~pred & (y == 1)).sum())
    precision = tp / (tp + fp) if tp + fp else 0.0
    recall = tp / (tp + fn) if tp + fn else 0.0
    f1 = 2 * precision * recall / (precision + recall) if precision + recall else 0.0
    return {"F1": f1, "Precision": precision, "Recall": recall}


# ------------------------------------------------------------------------- the selected model


class SelectedModel:
    """The fitted logistic-regression pipeline, rebuilt from the pipeline's saved numbers."""

    def __init__(self, table: pd.DataFrame):
        weights = pd.read_csv(FIG / "logistic_weights.csv").set_index("feature")["coefficient"]
        local = pd.read_csv(FIG / "logistic_local.csv")
        self.coef = weights.reindex(FEATURES).to_numpy(float)
        self.intercept = float(local["intercept"].iloc[0])
        train = table[table.year <= TRAIN_LAST_YEAR]
        # SimpleImputer(strategy="median"): median of the non-missing training values.
        self.median = train[FEATURES].median(skipna=True).to_numpy(float)
        filled = train[FEATURES].fillna(dict(zip(FEATURES, self.median)))
        # StandardScaler: mean and population standard deviation of the imputed training rows.
        self.mean = filled.mean().to_numpy(float)
        self.scale = filled.std(ddof=0).to_numpy(float).copy()
        self.scale[self.scale == 0] = 1.0
        self.local = local
        self.threshold = float(json.loads((ART / "summary.json").read_text(encoding="utf-8"))["thresholds"][SELECTED])

    def standardize(self, x: np.ndarray) -> np.ndarray:
        x = np.where(np.isnan(x), self.median, x)
        return (x - self.mean) / self.scale

    def logit(self, x: np.ndarray) -> np.ndarray:
        return self.standardize(x) @ self.coef + self.intercept

    def score(self, x: np.ndarray) -> np.ndarray:
        return 1.0 / (1.0 + np.exp(-self.logit(x)))

    def verify(self, table: pd.DataFrame) -> dict:
        """Reproduce what the pipeline saved. Any mismatch stops the export."""
        saved = pd.read_csv(ART / "model_metrics.csv")
        saved = saved[saved.model == SELECTED].set_index("split")
        parts = {
            "train": table[table.year <= TRAIN_LAST_YEAR],
            "validation": table[table.year.between(2020, 2021)],
            "test": table[table.year >= TEST_FIRST_YEAR],
        }
        report = {}
        for name, part in parts.items():
            p = self.score(part[FEATURES].to_numpy(float))
            y = part["podium"].to_numpy(int)
            mine = {"ROC-AUC": roc_auc(y, p), "PR-AUC": average_precision(y, p), **threshold_metrics(y, p, self.threshold)}
            worst = max(abs(mine[k] - float(saved.loc[name, k])) for k in mine)
            report[name] = {"maxAbsDifference": worst, **mine}
            if worst > 1e-9:
                raise SystemExit(f"{SELECTED} {name}: rebuilt model differs from the saved metrics by {worst:.2e}")
        # the explained validation row in logistic_local.csv: standardized values and probability
        row = self.local
        match = table[(table.driverId == int(row["driver_id"].iloc[0])) & (table.year == int(row["year"].iloc[0]))
                      & (table["name"] == row["race_name"].iloc[0])]
        if len(match) != 1:
            raise SystemExit("could not find the explained validation row")
        x = match[FEATURES].to_numpy(float)[0]
        z = self.standardize(x)
        saved_z = row.set_index("feature")["standardized_value"].reindex(FEATURES).to_numpy(float)
        worst_z = float(np.abs(z - saved_z).max())
        worst_p = abs(float(self.score(x[None, :])[0]) - float(row["model_probability"].iloc[0]))
        report["explainedRow"] = {"maxStandardizedDifference": worst_z, "probabilityDifference": worst_p}
        if worst_z > 1e-9 or worst_p > 1e-12:
            raise SystemExit(f"explained row mismatch: z {worst_z:.2e}, p {worst_p:.2e}")
        return report

    def export(self) -> dict:
        return {
            "name": SELECTED,
            "features": FEATURES,
            "median": self.median.tolist(),
            "mean": self.mean.tolist(),
            "scale": self.scale.tolist(),
            "coef": self.coef.tolist(),
            "intercept": self.intercept,
            "threshold": self.threshold,
        }


# ------------------------------------------------------------------------- build


def main() -> None:
    table = pd.read_csv(ART / "modeling_table.csv", low_memory=False)
    model = SelectedModel(table)
    verification = model.verify(table)
    print("rebuilt model reproduces the saved metrics:",
          {k: f"{v['maxAbsDifference']:.1e}" for k, v in verification.items() if "maxAbsDifference" in v})

    drivers_raw = pd.read_csv(RAW / "drivers.csv", na_values=["\\N"])
    constructors_raw = pd.read_csv(RAW / "constructors.csv", na_values=["\\N"])
    races_raw = pd.read_csv(RAW / "races.csv", na_values=["\\N"])
    circuits_raw = pd.read_csv(RAW / "circuits.csv", na_values=["\\N"])
    status = pd.read_csv(RAW / "status.csv").set_index("statusId")["status"]
    laps_raw = pd.read_csv(RAW / "lap_times.csv", na_values=["\\N"])
    pits_raw = pd.read_csv(RAW / "pit_stops.csv", na_values=["\\N"])
    dstand = pd.read_csv(RAW / "driver_standings.csv", na_values=["\\N"])
    cstand = pd.read_csv(RAW / "constructor_standings.csv", na_values=["\\N"])
    circuit_index = {c["circuitId"]: c for c in json.loads((SRC / "circuits.json").read_text(encoding="utf-8"))}

    test = table[table.year >= TEST_FIRST_YEAR].copy()
    test["score"] = model.score(test[FEATURES].to_numpy(float))
    test["flag"] = test["score"] >= model.threshold

    # ---- registries -------------------------------------------------------------------------
    ids = sorted(test.driverId.unique())
    d_rows = drivers_raw[drivers_raw.driverId.isin(ids)].set_index("driverId")
    refs = constructors_raw.set_index("constructorId")["constructorRef"].to_dict()

    # ---- race meta and per-race files -----------------------------------------------------
    races_meta = []
    (PUB / "races").mkdir(parents=True, exist_ok=True)
    laps_all = laps_raw[laps_raw.raceId.isin(test.raceId.unique())]
    pits_all = pits_raw[pits_raw.raceId.isin(test.raceId.unique())]
    slug_seen: set[tuple[int, str]] = set()

    for race_id, g in test.groupby("raceId", sort=False):
        head = g.iloc[0]
        year, rnd = int(head.year), int(head["round"])
        name = fix(str(head["name"]))
        slug = slugify(name.replace(" Grand Prix", ""))
        if (year, slug) in slug_seen:
            slug = f"{slug}-{rnd}"
        slug_seen.add((year, slug))
        circuit_id = int(head.circuitId)
        circuit = circuit_index.get(circuit_id)
        layout = None
        if circuit:
            for lay in circuit["layouts"]:
                if year in lay["years"]:
                    layout = lay
        length_m = layout["lengthM"] if layout else None
        distance_km = circuit["distanceKm"] if circuit else 305
        scheduled = math.ceil(distance_km * 1000 / length_m) if length_m else None

        ordered = g.sort_values("score", ascending=False)
        predicted = [int(v) for v in ordered.driverId.head(3)]
        actual = [int(v) for v in g.sort_values("positionOrder").driverId.head(3)]
        baseline = [int(v) for v in g.dropna(subset=["grid_position"]).sort_values(["grid_position", "driverId"]).driverId.head(3)]
        winner_row = g.loc[g.positionOrder == 1].iloc[0]
        race_laps = laps_all[laps_all.raceId == race_id]
        laps_run = int(winner_row["laps"])

        meta = {
            "id": int(race_id), "slug": slug, "year": year, "round": rnd, "name": name, "date": str(head["date"])[:10],
            "circuitId": circuit_id, "layout": layout["id"] if layout else None,
            "scheduledLaps": scheduled, "lapsRun": laps_run,
            "winner": {"driverId": int(winner_row.driverId), "constructorId": int(winner_row.constructorId)},
            "predicted": predicted, "actual": actual, "baseline": baseline,
            "teams": {str(d): int(g.loc[g.driverId == d, "constructorId"].iloc[0]) for d in sorted(set(predicted + actual + baseline))},
            "hits": len(set(predicted) & set(actual)),
            "baselineHits": len(set(baseline) & set(actual)),
            "drivers": int(len(g)),
            "flagged": int(g["flag"].sum()),
            "scoreSum": round(float(g["score"].sum()), 3),
        }
        races_meta.append(meta)

        entries = []
        for r in g.sort_values("score", ascending=False).itertuples(index=False):
            entries.append({
                "d": int(r.driverId), "c": int(r.constructorId),
                "n": num(r.number), "grid": num(r.grid),
                "x": [num(getattr(r, f)) for f in FEATURES],
                "p": round(float(r.score), 6),
                "pos": num(r.positionOrder), "txt": str(r.positionText), "pts": num(r.points),
                "laps": num(r.laps), "time": None if pd.isna(r.time) else str(r.time),
                "status": str(status.get(int(r.statusId), "")),
                "fl": None if pd.isna(r.rank) else int(r.rank),
            })

        lap_block = {"n": int(race_laps.lap.max()) if len(race_laps) else 0, "d": {}}
        for driver_id, dl in race_laps.groupby("driverId"):
            n = lap_block["n"]
            pos = [None] * n
            ms = [None] * n
            for lap, p, t in zip(dl.lap, dl.position, dl.milliseconds):
                pos[int(lap) - 1] = num(p)
                ms[int(lap) - 1] = num(t)
            lap_block["d"][str(int(driver_id))] = {"p": pos, "t": ms}
        pit_block = {}
        for driver_id, pl in pits_all[pits_all.raceId == race_id].groupby("driverId"):
            pit_block[str(int(driver_id))] = [[int(a), num(b, 0)] for a, b in zip(pl.lap, pl.milliseconds)]

        (PUB / "races" / f"{race_id}.json").write_text(
            json.dumps({"id": int(race_id), "entries": entries, "laps": lap_block, "pits": pit_block}, separators=(",", ":")),
            encoding="utf-8")

    races_meta.sort(key=lambda r: (r["year"], r["round"]))
    meta_by_id = {m["id"]: m for m in races_meta}

    # ---- drivers --------------------------------------------------------------------------
    drivers = []
    for driver_id in ids:
        d = d_rows.loc[driver_id]
        rows = test[test.driverId == driver_id]
        seasons = {}
        for year, s in rows.groupby("year"):
            top_teams = s.constructorId.value_counts()
            numbers = s.number.dropna()
            flagged_hits = 0
            top3_appearances = 0
            top3_correct = 0
            for rid in s.raceId:
                m = meta_by_id[int(rid)]
                if driver_id in m["predicted"]:
                    top3_appearances += 1
                    top3_correct += int(driver_id in m["actual"])
            classified = s[s.position.notna()]
            seasons[int(year)] = {
                "constructorId": int(top_teams.index[0]),
                "constructors": [int(c) for c in top_teams.index],
                "number": int(numbers.mode().iloc[0]) if len(numbers) else None,
                "races": int(len(s)),
                "podiums": int((s.positionOrder <= 3).sum()),
                "wins": int((s.positionOrder == 1).sum()),
                "points": num(s.points.sum()),
                "avgGrid": num(s.grid_position.mean(), 2),
                "avgFinish": num(classified.positionOrder.mean(), 2),
                "meanScore": round(float(s.score.mean()), 4),
                "modelTop3": top3_appearances,
                "modelTop3Correct": top3_correct,
                "flagged": int(s["flag"].sum()),
                "flaggedCorrect": int((s["flag"] & (s.podium == 1)).sum()),
                # one row per race: raceId, round, podium score, grid slot (null = pit lane), finishing order,
                # constructor, positionText
                "log": [[int(r.raceId), int(r.rnd), round(float(r.score), 4), num(r.grid_position), int(r.positionOrder),
                         int(r.constructorId), str(r.positionText)]
                        for r in s.rename(columns={"round": "rnd"}).sort_values("rnd").itertuples(index=False)],
            }
        nationality = NATIONALITY_FIXES.get(str(d.nationality), str(d.nationality))
        drivers.append({
            "id": int(driver_id), "ref": str(d.driverRef), "code": str(d.code), "first": str(d.forename), "last": str(d.surname),
            "name": f"{d.forename} {d.surname}", "nationality": nationality, "flag": FLAG.get(nationality),
            "dob": str(d.dob), "permanentNumber": num(d.number), "seasons": seasons,
        })
    drivers.sort(key=lambda d: d["last"])

    constructors = []
    for cid in sorted(test.constructorId.unique()):
        ref = refs[cid]
        info = TEAM_COLOURS[ref]
        years = sorted(int(y) for y in test[test.constructorId == cid].year.unique())
        row = constructors_raw[constructors_raw.constructorId == cid].iloc[0]
        constructors.append({
            "id": int(cid), "ref": ref, "name": str(row["name"]), "short": info["short"],
            "colour": {str(y): info["colour"][y] for y in years}, "years": years,
        })

    # ---- standings ------------------------------------------------------------------------
    standings = {}
    for year in (2022, 2023, 2024):
        round_ids = [m["id"] for m in races_meta if m["year"] == year]
        ds = dstand[dstand.raceId.isin(round_ids)]
        cs = cstand[cstand.raceId.isin(round_ids)]
        block = {"rounds": round_ids, "drivers": {}, "constructors": {}}
        for did, g in ds.groupby("driverId"):
            by_race = g.set_index("raceId")
            block["drivers"][str(int(did))] = {
                "pts": [num(by_race.points.get(r)) for r in round_ids],
                "pos": [num(by_race.position.get(r)) for r in round_ids],
                "wins": num(by_race.wins.get(round_ids[-1])) if round_ids[-1] in by_race.index else None,
            }
        for cid, g in cs.groupby("constructorId"):
            by_race = g.set_index("raceId")
            block["constructors"][str(int(cid))] = {
                "pts": [num(by_race.points.get(r)) for r in round_ids],
                "pos": [num(by_race.position.get(r)) for r in round_ids],
                "wins": num(by_race.wins.get(round_ids[-1])) if round_ids[-1] in by_race.index else None,
            }
        standings[str(year)] = block

    # ---- circuit statistics (whole dataset; the model's own history) -----------------------
    all_rows = table.copy()
    cstats = {}
    fastest = (laps_all.merge(races_raw[["raceId", "year", "circuitId"]], on="raceId")
               .sort_values("milliseconds").groupby(["circuitId", "year"]).first().reset_index())
    for circuit_id, g in all_rows.groupby("circuitId"):
        if circuit_id not in circuit_index:
            continue
        years = sorted(int(y) for y in g.year.unique())
        winners = (g[g.positionOrder == 1].sort_values("year")
                   .merge(drivers_raw[["driverId", "forename", "surname"]], on="driverId"))
        modern = g[g.year >= 2014]
        grid_rows = []
        for slot in range(1, 11):
            s = modern[modern.grid == slot]
            grid_rows.append({"grid": slot, "starts": int(len(s)), "podiums": int(s.podium.sum()),
                              "wins": int((s.positionOrder == 1).sum())})
        front = g[g.front_row == 1]
        pole = g[g.grid == 1]
        fl = fastest[fastest.circuitId == circuit_id]
        cstats[str(int(circuit_id))] = {
            "races": int(g.raceId.nunique()), "firstYear": years[0], "lastYear": years[-1],
            "recentWinners": [{"year": int(w.year), "driver": f"{w.forename} {w.surname}", "driverId": int(w.driverId),
                               "constructor": str(w.constructor_name)} for w in winners.tail(8).itertuples()],
            "gridConversion2014": grid_rows,
            "frontRow": {"starts": int(len(front)), "podiums": int(front.podium.sum())},
            "pole": {"starts": int(len(pole)), "wins": int((pole.positionOrder == 1).sum()), "podiums": int(pole.podium.sum())},
            "fastestLap": {str(int(r.year)): {"ms": int(r.milliseconds), "driverId": int(r.driverId)} for r in fl.itertuples()},
        }

    # ---- circuits table (names fixed, flag codes) -------------------------------------------
    circuits_out = []
    for cid, info in circuit_index.items():
        row = circuits_raw[circuits_raw.circuitId == cid]
        if row.empty:
            continue
        row = row.iloc[0]
        circuits_out.append({
            "circuitId": int(cid), "ref": info["ref"], "name": fix(str(row["name"])), "location": fix(str(row["location"])),
            "country": str(row["country"]), "flag": COUNTRY_FLAG.get(str(row["country"])),
            "lat": num(row.lat), "lng": num(row.lng), "alt": num(row.alt),
        })

    # ---- reliability: what a score means ---------------------------------------------------
    edges = np.linspace(0, 1, 11)
    reliability = {}
    for name, part in {"validation": table[table.year.between(2020, 2021)], "test": table[table.year >= TEST_FIRST_YEAR]}.items():
        p = model.score(part[FEATURES].to_numpy(float))
        y = part.podium.to_numpy(int)
        bins = []
        for lo, hi in zip(edges[:-1], edges[1:]):
            m = (p >= lo) & (p < hi if hi < 1 else p <= hi)
            bins.append({"lo": round(float(lo), 1), "hi": round(float(hi), 1), "n": int(m.sum()),
                         "podiums": int(y[m].sum()), "meanScore": num(p[m].mean(), 4) if m.any() else None})
        reliability[name] = bins

    # ---- season summaries -------------------------------------------------------------------
    seasons_out = {}
    for year in (2022, 2023, 2024):
        rs = [m for m in races_meta if m["year"] == year]
        seasons_out[str(year)] = {
            "races": len(rs),
            "meanHits": round(sum(m["hits"] for m in rs) / len(rs), 3),
            "meanBaselineHits": round(sum(m["baselineHits"] for m in rs) / len(rs), 3),
        }
    hist = {k: sum(1 for m in races_meta if m["hits"] == k) for k in range(4)}
    base_hist = {k: sum(1 for m in races_meta if m["baselineHits"] == k) for k in range(4)}

    metrics = pd.read_csv(ART / "model_metrics.csv")
    uncertainty = pd.read_csv(ART / "test_uncertainty.csv")
    val_uncertainty = pd.read_csv(ART / "validation_uncertainty.csv")

    model_out = {
        **model.export(),
        "verification": {k: v for k, v in verification.items()},
        "metrics": json.loads(metrics.to_json(orient="records")),
        "testUncertainty": json.loads(uncertainty.to_json(orient="records")),
        "validationUncertainty": json.loads(val_uncertainty.to_json(orient="records")),
        "reliability": reliability,
        "raceHits": {
            "races": len(races_meta),
            "model": hist, "grid": base_hist,
            "meanModel": round(sum(m["hits"] for m in races_meta) / len(races_meta), 3),
            "meanGrid": round(sum(m["baselineHits"] for m in races_meta) / len(races_meta), 3),
            "bySeason": seasons_out,
        },
    }

    SRC.mkdir(parents=True, exist_ok=True)
    (SRC / "model.json").write_text(json.dumps(model_out, indent=1), encoding="utf-8")
    (SRC / "races.json").write_text(json.dumps(races_meta, separators=(",", ":")), encoding="utf-8")
    (SRC / "drivers.json").write_text(json.dumps({"drivers": drivers, "constructors": constructors}, separators=(",", ":")), encoding="utf-8")
    (SRC / "standings.json").write_text(json.dumps(standings, separators=(",", ":")), encoding="utf-8")
    (SRC / "circuit-stats.json").write_text(json.dumps({"circuits": circuits_out, "stats": cstats}, separators=(",", ":")), encoding="utf-8")

    print(f"{len(races_meta)} races, {len(drivers)} drivers, {len(constructors)} constructors")
    print("model top-3 hits per race:", hist, "mean", model_out["raceHits"]["meanModel"])
    print("grid top-3 hits per race: ", base_hist, "mean", model_out["raceHits"]["meanGrid"])
    for name, bins in reliability.items():
        print(name, [(b["lo"], b["n"], None if not b["n"] else round(b["podiums"] / b["n"], 2)) for b in bins])


if __name__ == "__main__":
    main()
