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

It also writes ``milestone2.json`` for the "Knowledge graph" tab of the History page: the graph's schema and size, and the five
verification queries of the brief with the Cypher exactly as submitted in ``milestone_2/queries.txt`` and their answers. The answers
come from ``milestone_2/kg_oracle.py``, which works them out from the CSV files with plain pandas (no database is involved).
"""

from __future__ import annotations

import hashlib
import importlib.util
import json
import re
from pathlib import Path

import pandas as pd

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "milestone_2"
OUT = ROOT / "ui" / "public" / "data" / "graph" / "graph.json"
CONTRACT = "paladin.graph.v1"
FILES = ["results", "races", "drivers", "constructors", "circuits", "status", "seasons"]
CYPHER = SRC / "product_queries.cypher"
QUERIES = SRC / "queries.txt"
MS2_OUT = ROOT / "ui" / "public" / "data" / "graph" / "milestone2.json"
MS2_CONTRACT = "paladin.milestone2.v1"


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


# ---------------------------------------------------------------------------------------------------------------
# The Knowledge graph tab: the schema, its size, and the five questions of the brief


# The words the site uses for each of the brief's five questions (the brief gives them in full; these are shorter).
QUESTIONS = {
    1: ("The 2021 standings", "Each driver's total Grand Prix points and number of wins in 2021, the most points first.",
        "Race-result points only: the graph does not load sprint results, so a total can sit below the official one."),
    2: ("Which constructors finished races most often", "For every constructor with at least 100 race entries from 2014 to 2021: how many of those entries were classified finishes (status Finished, or a lap or more down), and what share is that?",
        "Reliability is classified entries divided by entries, a value from 0 to 1."),
    3: ("Hamilton and Bottas in the same car", "In the races the two drove for the same constructor: how many they shared, and how many times each finished ahead.",
        "Ahead means a lower positionOrder in the same race, for the same constructor."),
    4: ("Monaco before 2020", "At the Circuit de Monaco, in races before 2020, for drivers with at least five starts: their average finishing position and their wins, the best average first.",
        "A start is a race, however many Results a shared drive gave. The average and the wins are taken over all of a driver's remaining Results."),
    5: ("Who changed constructor between 2020 and 2021", "A driver's primary constructor in a season is the one with the most race entries (a tie goes to the lower constructorId). Which drivers who raced in both seasons had a different one in 2021?",
        "Constructors are compared by id, so a renamed team (Renault to Alpine) counts as a change."),
}


def load_oracle():
    """milestone_2/kg_oracle.py, the facts of the graph worked out from the CSV files with pandas. It needs nothing else."""
    spec = importlib.util.spec_from_file_location("kg_oracle", SRC / "kg_oracle.py")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)  # type: ignore[union-attr]
    return module


def parse_queries(text: str) -> dict[int, str]:
    """queries.txt as the grader reads it: blocks that begin ``//N. Query N``, then the query, kept exactly as written."""
    parts = re.split(r"(?m)^//(\d+)\. Query \d+[ \t\r]*$", text)
    return {int(parts[i]): "\n".join(line.rstrip() for line in parts[i + 1].strip("\n").splitlines()).rstrip() for i in range(1, len(parts), 2)}


def fingerprint_milestone2(oracle) -> str:
    digest = hashlib.sha256()
    for name in oracle.FILES:
        digest.update(name.encode())
        digest.update((SRC / f"{name}.csv").read_bytes())
    digest.update(b"queries")
    digest.update(QUERIES.read_bytes())
    return digest.hexdigest()


def build_milestone2() -> dict:
    oracle = load_oracle()
    raw = oracle.raw_tables()
    f = oracle.frames(raw)
    answers = oracle.answers(f)
    queries = parse_queries(QUERIES.read_text(encoding="utf-8"))
    assert sorted(queries) == [1, 2, 3, 4, 5], "queries.txt has Query 1 to Query 5"

    kinds = {"Driver": "entity", "Constructor": "entity", "Circuit": "entity", "Season": "entity", "Status": "entity", "Race": "entity",
             "Result": "fact", "Qualifying": "fact", "PitStop": "fact"}
    type_words = {int: "integer", float: "float", oracle.date: "date", str: "text"}
    schema = [
        {"label": label, "kind": kinds[label], "key": key, "count": len(raw[csv]),
         "properties": [{"name": name, "type": type_words[kind]} for name, kind in oracle.SCHEMA[label].items()]}
        for label, (csv, key, _) in oracle.NODES.items()
    ]
    relationships = [{"type": rel, "from": src, "to": dst, "count": len(raw[csv])} for rel, src, dst, csv, _, _ in oracle.EDGES]

    # Question 4: the drivers who had two Results in one Monaco race, which is why a start is a race and not a Result.
    r = f.results
    monaco = r[(r.circuitId == 6) & (r.date < "2020-01-01") & (~r.status.isin(["Did not qualify", "Did not prequalify", "Withdrew"]))]
    sizes = monaco.groupby(["full", "raceId", "year"]).size()
    shared = sorted(({"driver": d, "year": int(y)} for (d, _, y), n in sizes.items() if n > 1), key=lambda c: (c["year"], c["driver"]))

    # Question 5: where each of the drivers who changed went from and to (the brief asks only for the names).
    e = r[r.year.isin([2020, 2021])].groupby(["driverId", "year", "constructorId"]).size().reset_index(name="entries")
    e = e.sort_values(["driverId", "year", "entries", "constructorId"], ascending=[True, True, False, True])
    primary = e.groupby(["driverId", "year"]).head(1).pivot(index="driverId", columns="year", values="constructorId").dropna()
    team = dict(zip(f.cons.constructorId, f.cons.constructor_name))
    person = dict(zip(f.drivers.driverId, f.drivers.full))
    moves = sorted(
        ({"driver": person[int(d)], "from": team[int(row[2020])], "to": team[int(row[2021])]} for d, row in primary.iterrows() if row[2020] != row[2021]),
        key=lambda m: m["driver"],
    )
    assert [m["driver"] for m in moves] == answers["Q5"][0]["Drivers"], "the moves are the names Query 5 returns"

    extras = {1: {}, 2: {}, 3: {}, 4: {"sharedDrives": shared}, 5: {"moves": moves}}
    questions = []
    for number in range(1, 6):
        title, question, note = QUESTIONS[number]
        questions.append({
            "number": number, "title": title, "question": question, "note": note,
            "cypher": queries[number], "columns": oracle.COLUMNS[f"Q{number}"], "rows": answers[f"Q{number}"], **extras[number],
        })
    return {
        "contract": MS2_CONTRACT,
        "source": {"files": [f"milestone_2/{name}.csv" for name in oracle.FILES] + ["milestone_2/queries.txt"], "sha256": fingerprint_milestone2(oracle)},
        "counts": {"nodes": sum(n["count"] for n in schema), "relationships": sum(x["count"] for x in relationships)},
        "schema": schema,
        "relationships": relationships,
        "questions": questions,
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

    milestone2 = build_milestone2()
    MS2_OUT.write_text(json.dumps(milestone2, separators=(",", ":")) + "\n", encoding="utf-8")
    print(f"milestone2.json: {milestone2['counts']['nodes']:,} nodes, {milestone2['counts']['relationships']:,} relationships, {len(milestone2['questions'])} questions; {MS2_OUT.stat().st_size / 1024:.0f} KB")


if __name__ == "__main__":
    main()
