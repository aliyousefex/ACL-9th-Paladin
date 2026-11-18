"""What the Milestone 2 knowledge graph should contain, worked out from the CSV files alone.

Not part of the submission. verify_kg.py compares a live graph with this, and tests/test_create_kg.py compares
what Create_kg.py sends to Neo4j with it. It is written independently of Create_kg.py (its own conversions, its own
column mapping, written from the brief) so that a mistake in one cannot hide a mistake in the other. Needs only pandas.

Three things come out of it:

* ``expected_nodes``: every node, as {label: {key: properties}}, with the Python type each property must have;
* ``expected_edges``: every relationship, as {(source label, type, target label): {(source key, target key)}};
* ``answers``: the answers to the five verification queries of the brief, in output order.
"""

from __future__ import annotations

from datetime import date
from pathlib import Path
from types import SimpleNamespace

import pandas as pd

HERE = Path(__file__).resolve().parent
MISSING = chr(92) + "N"   # the literal \N the CSV files use for a missing value

# The schema of the brief: label -> {property: type}. date is a Neo4j date; everything else is a plain value.
SCHEMA: dict[str, dict[str, type]] = {
    "Driver": {"driverId": int, "driverRef": str, "number": int, "code": str, "forename": str, "surname": str, "dob": date, "nationality": str},
    "Constructor": {"constructorId": int, "constructorRef": str, "constructor_name": str, "constructor_nationality": str},
    "Circuit": {"circuitId": int, "circuitRef": str, "circuit_name": str, "circuit_loc": str, "circuit_country": str, "lat": float, "lng": float, "alt": int},
    "Season": {"year": int},
    "Status": {"statusId": int, "status": str},
    "Race": {"raceId": int, "year": int, "round": int, "name": str, "date": date, "time": str},
    "Result": {
        "resultId": int, "number": int, "grid": int, "position": int, "positionText": str, "positionOrder": int, "points": float,
        "laps": int, "time": str, "milliseconds": int, "fastestLap": int, "rank": int, "fastestLapTime": str, "fastestLapSpeed": float,
    },
    "Qualifying": {"qualifyId": int, "number": int, "position": int, "q1": str, "q2": str, "q3": str},
    "PitStop": {"eventId": str, "stop": int, "lap": int, "time": str, "duration": str, "milliseconds": int},
}

# label -> (csv file, key property, {property: csv column}). Only the renamed columns differ from their property.
NODES: dict[str, tuple[str, str, dict[str, str | None]]] = {
    "Driver": ("drivers", "driverId", {p: p for p in SCHEMA["Driver"]}),
    "Constructor": ("constructors", "constructorId", {"constructorId": "constructorId", "constructorRef": "constructorRef", "constructor_name": "name", "constructor_nationality": "nationality"}),
    "Circuit": ("circuits", "circuitId", {"circuitId": "circuitId", "circuitRef": "circuitRef", "circuit_name": "name", "circuit_loc": "location", "circuit_country": "country", "lat": "lat", "lng": "lng", "alt": "alt"}),
    "Season": ("seasons", "year", {"year": "year"}),
    "Status": ("status", "statusId", {"statusId": "statusId", "status": "status"}),
    "Race": ("races", "raceId", {p: p for p in SCHEMA["Race"]}),
    "Result": ("results", "resultId", {p: p for p in SCHEMA["Result"]}),
    "Qualifying": ("qualifying", "qualifyId", {p: p for p in SCHEMA["Qualifying"]}),
    "PitStop": ("pit_stops", "eventId", {"eventId": None, "stop": "stop", "lap": "lap", "time": "time", "duration": "duration", "milliseconds": "milliseconds"}),
}

# (relationship, source label, target label, csv file, source key column, target key column). A pit stop's key is built.
EDGES: list[tuple[str, str, str, str, str, str]] = [
    ("AT_CIRCUIT", "Race", "Circuit", "races", "raceId", "circuitId"),
    ("IN_SEASON", "Race", "Season", "races", "raceId", "year"),
    ("FOR_RACE", "Result", "Race", "results", "resultId", "raceId"),
    ("BY_DRIVER", "Result", "Driver", "results", "resultId", "driverId"),
    ("FOR_CONSTRUCTOR", "Result", "Constructor", "results", "resultId", "constructorId"),
    ("HAS_STATUS", "Result", "Status", "results", "resultId", "statusId"),
    ("FOR_RACE", "Qualifying", "Race", "qualifying", "qualifyId", "raceId"),
    ("BY_DRIVER", "Qualifying", "Driver", "qualifying", "qualifyId", "driverId"),
    ("FOR_CONSTRUCTOR", "Qualifying", "Constructor", "qualifying", "qualifyId", "constructorId"),
    ("FOR_RACE", "PitStop", "Race", "pit_stops", "eventId", "raceId"),
    ("BY_DRIVER", "PitStop", "Driver", "pit_stops", "eventId", "driverId"),
]

EXPECTED_NODE_COUNT = 51113
EXPECTED_RELATIONSHIP_COUNT = 163510

FILES = ["drivers", "constructors", "circuits", "seasons", "status", "races", "results", "qualifying", "pit_stops"]


def raw_tables(root: Path = HERE) -> dict[str, pd.DataFrame]:
    """Every CSV as text, with \\N and empty cells as missing."""
    out = {}
    for name in FILES:
        table = pd.read_csv(root / f"{name}.csv", dtype=str, keep_default_na=False, na_values=[MISSING, ""], encoding="utf-8-sig")
        table.columns = [c.strip() for c in table.columns]
        out[name] = table
    return out


def _convert(kind: type, text: str):
    if kind is int:
        return int(float(text))
    if kind is float:
        return float(text)
    if kind is date:
        return date.fromisoformat(text)
    return text


def _clean(value) -> str | None:
    """A cell as text, or None when it is missing (the tables hold text, and a missing cell is NaN, the one value not equal to itself)."""
    return None if value is None or value != value else str(value)


def _event_id(row) -> str:
    return f"{int(float(row['raceId']))}:{int(float(row['driverId']))}:{int(float(row['stop']))}"


def expected_nodes(raw: dict[str, pd.DataFrame]) -> dict[str, dict]:
    """{label: {key value: {property: value}}}, leaving a property out when its cell is missing."""
    out: dict[str, dict] = {}
    for label, (csv, key, columns) in NODES.items():
        nodes = {}
        for row in raw[csv].to_dict("records"):
            node = {}
            for prop, column in columns.items():
                if column is None:   # the pit stop's own key
                    node[prop] = _event_id(row)
                    continue
                text = _clean(row[column])
                if text is not None:
                    node[prop] = _convert(SCHEMA[label][prop], text)
            nodes[node[key]] = node
        out[label] = nodes
    return out


def expected_edges(raw: dict[str, pd.DataFrame]) -> dict[tuple[str, str, str], set]:
    """{(source label, relationship, target label): {(source key, target key)}}."""
    out: dict[tuple[str, str, str], set] = {}
    for rel, src, dst, csv, src_col, dst_col in EDGES:
        pairs = set()
        for row in raw[csv].to_dict("records"):
            a = _event_id(row) if src == "PitStop" else int(float(row[src_col]))
            pairs.add((a, int(float(row[dst_col]))))
        out[(src, rel, dst)] = pairs
    return out


def expected_counts(raw: dict[str, pd.DataFrame]) -> tuple[int, int]:
    """Nodes and relationships the graph should hold: one node per row of each file, and the links the schema lists."""
    nodes = sum(len(raw[csv]) for csv, _, _ in NODES.values())
    rels = sum(len(raw[csv]) for _, _, _, csv, _, _ in EDGES)
    return nodes, rels


# ---------------------------------------------------------------------------------------------------------------
# Typed frames, for the answers


def frames(raw: dict[str, pd.DataFrame]) -> SimpleNamespace:
    """The joined, typed tables the answers are computed from."""
    races = raw["races"][["raceId", "year", "circuitId", "date", "round", "name"]].copy()
    for c in ["raceId", "year", "circuitId", "round"]:
        races[c] = races[c].astype(int)
    races["date"] = pd.to_datetime(races["date"])
    races = races.rename(columns={"name": "race_name"})

    drivers = raw["drivers"].copy()
    drivers["driverId"] = drivers["driverId"].astype(int)
    drivers["full"] = drivers["forename"] + " " + drivers["surname"]
    drivers["dob"] = pd.to_datetime(drivers["dob"])

    cons = raw["constructors"].copy()
    cons["constructorId"] = cons["constructorId"].astype(int)
    cons = cons.rename(columns={"name": "constructor_name"})

    status = raw["status"].copy()
    status["statusId"] = status["statusId"].astype(int)

    results = raw["results"].copy()
    for c in ["resultId", "raceId", "driverId", "constructorId", "statusId", "positionOrder", "grid"]:
        results[c] = results[c].astype(int)
    results["points"] = results["points"].astype(float)
    for c in ["position", "rank"]:
        results[c] = pd.to_numeric(results[c])   # float with NaN where missing
    results = (results.merge(races, on="raceId").merge(status, on="statusId")
               .merge(drivers[["driverId", "full", "dob", "nationality"]], on="driverId")
               .merge(cons[["constructorId", "constructor_name"]], on="constructorId"))

    quali = raw["qualifying"].copy()
    for c in ["qualifyId", "raceId", "driverId", "constructorId"]:
        quali[c] = quali[c].astype(int)
    quali["position"] = pd.to_numeric(quali["position"])
    quali = quali.merge(races, on="raceId").merge(drivers[["driverId", "full"]], on="driverId")

    pits = raw["pit_stops"].copy()
    for c in ["raceId", "driverId", "stop"]:
        pits[c] = pits[c].astype(int)
    pits = pits.merge(races, on="raceId")

    circuits = raw["circuits"].copy()
    circuits["circuitId"] = circuits["circuitId"].astype(int)
    return SimpleNamespace(races=races, drivers=drivers, cons=cons, status=status, results=results, quali=quali, pits=pits, circuits=circuits,
                           races_time_missing=int(raw["races"]["time"].isna().sum()))


# ---------------------------------------------------------------------------------------------------------------
# The five verification queries of the brief


def answers(f: SimpleNamespace) -> dict[str, list[dict]]:
    """Q1 to Q5, as lists of rows in the order the brief asks for (ties broken by name, as queries.txt does)."""
    r = f.results

    s = r[r.year == 2021].groupby("full").agg(Points=("points", "sum"), Wins=("position", lambda x: int((x == 1).sum()))).reset_index()
    s = s.sort_values(["Points", "Wins", "full"], ascending=[False, False, True])
    q1 = [{"Driver": x.full, "Points": float(x.Points), "Wins": int(x.Wins)} for x in s.itertuples()]

    t = r[(r.year >= 2014) & (r.year <= 2021)].copy()
    t["classified"] = (t.status == "Finished") | t.status.str.startswith("+")
    c = t.groupby("constructor_name").agg(Entries=("resultId", "count"), Classified=("classified", "sum")).reset_index()
    c = c[c.Entries >= 100]
    c["Reliability"] = c.Classified / c.Entries
    c = c.sort_values(["Reliability", "constructor_name"], ascending=[False, True])
    q2 = [{"Constructor": x.constructor_name, "Entries": int(x.Entries), "Classified": int(x.Classified), "Reliability": float(x.Reliability)} for x in c.itertuples()]

    h = r[r.driverId == 1][["raceId", "constructorId", "positionOrder", "constructor_name"]]
    b = r[r.driverId == 822][["raceId", "constructorId", "positionOrder"]]
    j = h.merge(b, on=["raceId", "constructorId"], suffixes=("_h", "_b"))
    q3 = [
        {"Constructor": name, "Shared_Races": int(len(g)), "Hamilton_Ahead": int((g.positionOrder_h < g.positionOrder_b).sum()), "Bottas_Ahead": int((g.positionOrder_b < g.positionOrder_h).sum())}
        for name, g in j.groupby("constructor_name")
    ]

    m = r[(r.circuitId == 6) & (r.date < pd.Timestamp("2020-01-01")) & (~r.status.isin(["Did not qualify", "Did not prequalify", "Withdrew"]))]
    d = m.groupby("full").agg(Starts=("raceId", "nunique"), Avg_Finish=("positionOrder", "mean"), Wins=("position", lambda x: int((x == 1).sum()))).reset_index()
    d = d[d.Starts >= 5].sort_values(["Avg_Finish", "Wins", "full"], ascending=[True, False, True])
    q4 = [{"Driver": x.full, "Starts": int(x.Starts), "Avg_Finish": float(x.Avg_Finish), "Wins": int(x.Wins)} for x in d.itertuples()]

    e = r[r.year.isin([2020, 2021])].groupby(["driverId", "year", "constructorId"]).size().reset_index(name="entries")
    e = e.sort_values(["driverId", "year", "entries", "constructorId"], ascending=[True, True, False, True])
    primary = e.groupby(["driverId", "year"]).head(1).pivot(index="driverId", columns="year", values="constructorId").dropna()
    changed = primary[primary[2020] != primary[2021]].index
    names = sorted(f.drivers[f.drivers.driverId.isin(changed)]["full"])
    q5 = [{"Drivers_Changed": len(names), "Drivers": names}]

    return {"Q1": q1, "Q2": q2, "Q3": q3, "Q4": q4, "Q5": q5}


# The columns each query must return, in order, and the columns it is sorted by (with the direction), from the brief.
COLUMNS = {
    "Q1": ["Driver", "Points", "Wins"],
    "Q2": ["Constructor", "Entries", "Classified", "Reliability"],
    "Q3": ["Constructor", "Shared_Races", "Hamilton_Ahead", "Bottas_Ahead"],
    "Q4": ["Driver", "Starts", "Avg_Finish", "Wins"],
    "Q5": ["Drivers_Changed", "Drivers"],
}
SORT = {
    "Q1": [("Points", -1), ("Wins", -1)],
    "Q2": [("Reliability", -1)],
    "Q3": [],
    "Q4": [("Avg_Finish", 1), ("Wins", -1)],
    "Q5": [],
}
