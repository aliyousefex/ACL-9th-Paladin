"""Export the Milestone 2 knowledge graph as a compact JSON file the website can query.

The graph in Neo4j is built by ``milestone_2/Create_kg.py`` from the CSV files next to it::

    (Result)-[:BY_DRIVER]->(Driver)      (Result)-[:FOR_RACE]->(Race)
    (Result)-[:FOR_CONSTRUCTOR]->(Constructor)      (Result)-[:HAS_STATUS]->(Status)
    (Race)-[:AT_CIRCUIT]->(Circuit)      (Race)-[:IN_SEASON]->(Season)

The website is static, so it cannot talk to a database. This script reads the *same CSV files* and
precomputes the relationships the product questions need, using exactly the semantics of the Cypher in
``milestone_2/product_queries.cypher``:

* Two drivers are **teammates** when each has a Result in the same Race for the same Constructor.
* A driver's finish in a race is the best ``positionOrder`` among their Results there (a shared drive can give a
  driver two); a **podium** is a finish of 3 or better and a **win** is ``position = 1``, each counted in races.

Nothing is estimated and nothing outside the CSVs is used. The output records a SHA-256 over the input
files, so a viewer can tell which data a page was built from. Needs only numpy and pandas.

    .venv\\Scripts\\python.exe scripts\\export_graph_data.py
"""

from __future__ import annotations

import hashlib
import json
from pathlib import Path

import pandas as pd

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "milestone_2"
OUT = ROOT / "ui" / "public" / "data" / "graph" / "graph.json"
CONTRACT = "paladin.graph.v1"
FILES = ["results", "races", "drivers", "constructors", "circuits", "status", "seasons"]
CYPHER = SRC / "product_queries.cypher"


def read(name: str) -> pd.DataFrame:
    return pd.read_csv(SRC / f"{name}.csv", na_values=["\\N"], low_memory=False)


def cypher_blocks() -> dict[str, dict[str, str]]:
    """Split product_queries.cypher at its ``// @name:`` markers. The website shows exactly this text."""
    notes: dict[str, list[str]] = {}
    code: dict[str, list[str]] = {}
    current = ""
    for line in CYPHER.read_text(encoding="utf-8").splitlines():
        if line.startswith("// @name:"):
            current = line.split(":", 1)[1].strip()
            notes[current], code[current] = [], []
        elif current and line.startswith("//"):
            notes[current].append(line[2:].strip())
        elif current and line.strip():
            code[current].append(line.rstrip())
    out = {}
    for key in notes:
        parameters = next((n.split("Parameters:", 1)[1].strip() for n in notes[key] if "Parameters:" in n), "")
        description = " ".join(n for n in notes[key] if "Parameters:" not in n)
        out[key] = {"description": description, "parameters": parameters, "query": "\n".join(code[key])}
    return out


def fingerprint() -> str:
    digest = hashlib.sha256()
    for name in FILES:
        digest.update(name.encode())
        digest.update((SRC / f"{name}.csv").read_bytes())
    digest.update(b"cypher")
    digest.update(CYPHER.read_bytes())
    return digest.hexdigest()


def build() -> dict:
    results, races, drivers = read("results"), read("races"), read("drivers")
    constructors, circuits = read("constructors"), read("circuits")

    table = results.merge(races[["raceId", "year", "circuitId"]], on="raceId", how="inner")
    table["points"] = table["points"].fillna(0.0)
    table["won"] = (table["position"] == 1).astype(int)

    # One row per driver, constructor and race. In the early seasons a driver could hold two Results in one race
    # (a shared drive); that is one start, and the driver's finish is the best of the two. Points add up, because
    # each Result carries that driver's own share.
    rdc = table.groupby(["raceId", "constructorId", "driverId"], as_index=False).agg(
        best=("positionOrder", "min"), won=("won", "max"), points=("points", "sum"), year=("year", "first"), circuitId=("circuitId", "first")
    )
    rdc["podium"] = (rdc["best"] <= 3).astype(int)

    # ---- Driver --[RACED_FOR in year]--> Constructor: one row per driver, constructor and season.
    stints = (
        rdc.groupby(["driverId", "constructorId", "year"], as_index=False)
        .agg(races=("raceId", "nunique"), podiums=("podium", "sum"), wins=("won", "sum"), points=("points", "sum"))
        .sort_values(["driverId", "year", "constructorId"])
    )

    # ---- Driver --[TEAMMATE_OF via constructor]--> Driver.
    # Two drivers with a Result in the same Race for the same Constructor. Each pair is stored once with a < b.
    left = rdc[["raceId", "constructorId", "driverId", "best", "year"]]
    pairs = left.merge(left, on=["raceId", "constructorId"], suffixes=("_a", "_b"))
    pairs = pairs[pairs["driverId_a"] < pairs["driverId_b"]].copy()
    pairs["a_ahead"] = (pairs["best_a"] < pairs["best_b"]).astype(int)
    pairs["b_ahead"] = (pairs["best_b"] < pairs["best_a"]).astype(int)
    teammates = (
        pairs.groupby(["driverId_a", "driverId_b", "constructorId"], as_index=False)
        .agg(shared=("raceId", "nunique"), a_ahead=("a_ahead", "sum"), b_ahead=("b_ahead", "sum"), first=("year_a", "min"), last=("year_a", "max"))
        .sort_values(["driverId_a", "driverId_b", "constructorId"])
    )

    # ---- Circuit <-[AT_CIRCUIT]- Race <-[FOR_RACE]- Result: podium finishes by circuit, constructor and driver.
    podiums = (
        rdc[rdc["podium"] == 1]
        .groupby(["circuitId", "constructorId", "driverId"], as_index=False)
        .agg(podiums=("raceId", "nunique"), wins=("won", "sum"), first=("year", "min"), last=("year", "max"))
        .sort_values(["circuitId", "constructorId", "driverId"])
    )

    # ---- Career line: a driver at a race counts once, even for two constructors in the same race.
    per_driver_race = rdc.groupby(["raceId", "driverId"], as_index=False).agg(best=("best", "min"), won=("won", "max"), points=("points", "sum"), year=("year", "first"))
    per_driver_race["podium"] = (per_driver_race["best"] <= 3).astype(int)
    career = per_driver_race.groupby("driverId", as_index=False).agg(
        starts=("raceId", "nunique"), wins=("won", "sum"), podiums=("podium", "sum"), points=("points", "sum"), first=("year", "min"), last=("year", "max")
    )
    career = drivers.merge(career, on="driverId", how="inner")

    def text(value) -> str:
        return "" if pd.isna(value) else str(value)

    used_constructors = set(table["constructorId"].unique())
    used_circuits = set(table["circuitId"].unique())
    return {
        "contract": CONTRACT,
        "source": {"files": [f"milestone_2/{name}.csv" for name in FILES], "sha256": fingerprint(), "yearFirst": int(table["year"].min()), "yearLast": int(table["year"].max())},
        "cypher": cypher_blocks(),
        "semantics": {
            "teammates": "Two drivers with a Result in the same Race for the same Constructor.",
            "start": "A driver at a race counts once, even with two Results (a shared drive) or two constructors.",
            "finish": "The best (lowest) positionOrder among that driver's Results in the race, for the constructor.",
            "podium": "finish <= 3, counted in races",
            "win": "position = 1, counted in races",
            "ahead": "Lower finish than the teammate in a race they shared a constructor.",
            "points": "Race-result points only. Sprint points are in sprint_results.csv, which the Milestone 2 graph does not load, so season totals can sit a few points under the official ones.",
        },
        "columns": {
            "drivers": ["id", "code", "forename", "surname", "nationality", "firstYear", "lastYear", "starts", "wins", "podiums", "points"],
            "constructors": ["id", "name", "nationality"],
            "circuits": ["id", "name", "country"],
            "stints": ["driverId", "constructorId", "year", "races", "podiums", "wins", "points"],
            "teammates": ["driverA", "driverB", "constructorId", "sharedRaces", "aAhead", "bAhead", "firstYear", "lastYear"],
            "podiums": ["circuitId", "constructorId", "driverId", "podiums", "wins", "firstYear", "lastYear"],
        },
        "drivers": [
            [int(r.driverId), text(r.code), text(r.forename), text(r.surname), text(r.nationality), int(r.first), int(r.last), int(r.starts), int(r.wins), int(r.podiums), float(r.points)]
            for r in career.sort_values("driverId").itertuples()
        ],
        "constructors": [[int(r.constructorId), text(r.name), text(r.nationality)] for r in constructors.itertuples() if int(r.constructorId) in used_constructors],
        "circuits": [[int(r.circuitId), text(r.name), text(r.country)] for r in circuits.itertuples() if int(r.circuitId) in used_circuits],
        "stints": [[int(r.driverId), int(r.constructorId), int(r.year), int(r.races), int(r.podiums), int(r.wins), float(r.points)] for r in stints.itertuples()],
        "teammates": [
            [int(r.driverId_a), int(r.driverId_b), int(r.constructorId), int(r.shared), int(r.a_ahead), int(r.b_ahead), int(r.first), int(r.last)]
            for r in teammates.itertuples()
        ],
        "podiums": [[int(r.circuitId), int(r.constructorId), int(r.driverId), int(r.podiums), int(r.wins), int(r.first), int(r.last)] for r in podiums.itertuples()],
    }


def main() -> None:
    graph = build()
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(graph, separators=(",", ":")) + "\n", encoding="utf-8")
    kb = OUT.stat().st_size / 1024
    print(
        f"{len(graph['drivers'])} drivers, {len(graph['constructors'])} constructors, {len(graph['circuits'])} circuits, "
        f"{len(graph['stints'])} driver-constructor-seasons, {len(graph['teammates'])} teammate links, {len(graph['podiums'])} circuit podium rows; {kb:.0f} KB"
    )
    print("source sha256", graph["source"]["sha256"][:16], "...")


if __name__ == "__main__":
    main()
