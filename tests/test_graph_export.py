"""Checks for the knowledge-graph export. Every expected value is recomputed by a different code path
(plain loops over the CSV rows), so a mistake in the exporter's merges cannot hide itself. Needs only pandas."""

from __future__ import annotations

import importlib.util
import json
import random
from collections import defaultdict
from pathlib import Path

import pandas as pd
import pytest

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location("export_graph_data", ROOT / "scripts" / "export_graph_data.py")
eg = importlib.util.module_from_spec(spec)
spec.loader.exec_module(eg)  # type: ignore[union-attr]

SRC = ROOT / "milestone_2"


@pytest.fixture(scope="module")
def graph() -> dict:
    return eg.build()


@pytest.fixture(scope="module")
def rows() -> list[dict]:
    results = pd.read_csv(SRC / "results.csv", na_values=["\\N"], low_memory=False)
    races = pd.read_csv(SRC / "races.csv", na_values=["\\N"])
    year = dict(zip(races.raceId, races.year))
    circuit = dict(zip(races.raceId, races.circuitId))
    return [
        {"race": int(r.raceId), "driver": int(r.driverId), "team": int(r.constructorId), "order": int(r.positionOrder),
         "pos": None if pd.isna(r.position) else int(r.position), "points": 0.0 if pd.isna(r.points) else float(r.points),
         "year": int(year[r.raceId]), "circuit": int(circuit[r.raceId])}
        for r in results.itertuples()
    ]


def best_finish(rows: list[dict]) -> dict[tuple[int, int, int], int]:
    """(race, constructor, driver) -> best positionOrder. A shared drive gives a driver two Results in one race."""
    best: dict[tuple[int, int, int], int] = {}
    for r in rows:
        key = (r["race"], r["team"], r["driver"])
        best[key] = min(best.get(key, 10**6), r["order"])
    return best


def test_championship_query_is_reproduced_and_the_missing_sprint_points_are_the_whole_gap(graph, rows):
    """milestone_2/queries.txt, Query 1: the 2021 driver standings, from race-result points."""
    points: dict[int, float] = defaultdict(float)
    wins: dict[int, int] = defaultdict(int)
    for s in graph["stints"]:
        if s[2] == 2021:
            points[s[0]] += s[6]
            wins[s[0]] += s[5]
    direct: dict[int, float] = defaultdict(float)
    for r in rows:
        if r["year"] == 2021:
            direct[r["driver"]] += r["points"]
    assert dict(points) == pytest.approx(dict(direct))
    ranked = sorted(points, key=lambda d: (-points[d], -wins[d]))
    assert [(d, points[d], wins[d]) for d in ranked[:2]] == [(830, 388.5, 10), (1, 385.5, 8)]
    # The published totals are 395.5 and 387.5. The difference is exactly the sprint points the graph does not load.
    sprints = pd.read_csv(ROOT / "data" / "raw" / "sprint_results.csv", na_values=["\\N"])
    races = pd.read_csv(SRC / "races.csv", na_values=["\\N"])
    sprints = sprints.merge(races[["raceId", "year"]], on="raceId")
    sprint_points = sprints[sprints.year == 2021].groupby("driverId").points.sum()
    assert points[830] + sprint_points[830] == 395.5
    assert points[1] + sprint_points[1] == 387.5
    assert "Sprint points" in graph["semantics"]["points"]


def test_head_to_head_query_is_reproduced_for_any_pair(graph, rows):
    """Query 3 was hard-coded to Hamilton (1) and Bottas (822). The export answers it for every pair."""
    best = best_finish(rows)
    shared = ahead_h = ahead_b = 0
    for (race, team, driver), order in best.items():
        if driver == 1 and team == 131 and (race, team, 822) in best:
            other = best[(race, team, 822)]
            shared += 1
            ahead_h += order < other
            ahead_b += other < order
    assert shared > 80
    edge = [e for e in graph["teammates"] if e[0] == 1 and e[1] == 822 and e[2] == 131]
    assert len(edge) == 1
    assert edge[0][3:6] == [shared, ahead_h, ahead_b]


def test_random_teammate_links_match_a_brute_force_count(graph, rows):
    best = best_finish(rows)
    year = {r["race"]: r["year"] for r in rows}
    chosen = random.Random(903).sample(graph["teammates"], 80)
    for a, b, team, shared, a_ahead, b_ahead, first, last in chosen:
        together = [race for (race, t, d) in best if t == team and d == a and (race, team, b) in best]
        assert shared == len(together)
        assert a_ahead == sum(best[(race, team, a)] < best[(race, team, b)] for race in together)
        assert b_ahead == sum(best[(race, team, b)] < best[(race, team, a)] for race in together)
        assert (first, last) == (min(year[r] for r in together), max(year[r] for r in together))


def test_every_link_is_well_formed(graph):
    driver_ids = {d[0] for d in graph["drivers"]}
    team_ids = {c[0] for c in graph["constructors"]}
    seen = set()
    for a, b, team, shared, a_ahead, b_ahead, first, last in graph["teammates"]:
        assert a < b, "each pair is stored once"
        assert a in driver_ids and b in driver_ids and team in team_ids
        assert shared >= 1 and a_ahead + b_ahead <= shared
        assert graph["source"]["yearFirst"] <= first <= last <= graph["source"]["yearLast"]
        assert (a, b, team) not in seen
        seen.add((a, b, team))
    for stint in graph["stints"]:
        assert stint[3] >= 1 and stint[4] <= stint[3] and stint[5] <= stint[3]


def test_circuit_podium_rows_account_for_every_podium_finish(graph, rows):
    best = best_finish(rows)
    race_circuit = {r["race"]: r["circuit"] for r in rows}
    expected = defaultdict(int)
    for (race, team, driver), order in best.items():
        if order <= 3:
            expected[(race_circuit[race], team, driver)] += 1
    exported = {(p[0], p[1], p[2]): p[3] for p in graph["podiums"]}
    assert exported == dict(expected)
    monaco = {c[0] for c in graph["circuits"] if "Monaco" in c[1]}
    assert monaco, "Monaco is in the graph"
    by_team = defaultdict(set)
    for circuit, team, driver, *_ in graph["podiums"]:
        if circuit in monaco:
            by_team[team].add(driver)
    assert any(len(drivers) >= 3 for drivers in by_team.values()), "some constructor has three different Monaco podium drivers"


def test_career_totals_count_a_driver_once_per_race(graph, rows):
    races_of: dict[int, set[int]] = defaultdict(set)
    podium_races: dict[int, set[int]] = defaultdict(set)
    win_races: dict[int, set[int]] = defaultdict(set)
    for r in rows:
        races_of[r["driver"]].add(r["race"])
        if r["order"] <= 3:
            podium_races[r["driver"]].add(r["race"])
        if r["pos"] == 1:
            win_races[r["driver"]].add(r["race"])
    assert len(graph["drivers"]) == len(races_of)
    for d in graph["drivers"]:
        assert [d[7], d[8], d[9]] == [len(races_of[d[0]]), len(win_races[d[0]]), len(podium_races[d[0]])]


def test_the_export_is_reproducible_and_the_saved_file_is_current(graph):
    assert json.dumps(eg.build(), sort_keys=True) == json.dumps(graph, sort_keys=True)
    assert len(graph["source"]["sha256"]) == 64
    if not eg.OUT.exists():
        pytest.skip("run scripts/export_graph_data.py first")
    assert json.loads(eg.OUT.read_text(encoding="utf-8")) == json.loads(json.dumps(graph))


def test_cypher_blocks_are_embedded_and_every_parameter_is_declared(graph):
    import re

    blocks = graph["cypher"]
    assert set(blocks) == {"season_standings", "head_to_head", "driver_history", "materialise_teammates", "teammate_path", "circuit_podium_network"}
    for name, block in blocks.items():
        assert block["query"].strip() and block["description"]
        used = set(re.findall(r"\$(\w+)", block["query"]))
        declared = set(re.findall(r"(\w+):", block["parameters"]))
        assert used == declared, f"{name}: query uses {used}, declares {declared}"
        assert not re.search(r"driverId:\s*\d+", block["query"]), f"{name}: ids must be parameters, not literals"


# ---------------------------------------------------------------------------------------------------------------
# The "Knowledge graph" tab: milestone2.json. The answers are recomputed here with plain loops over the CSV rows, a
# different route from the pandas of milestone_2/kg_oracle.py that the export uses, so neither can hide a mistake in the other.


@pytest.fixture(scope="module")
def ms2() -> dict:
    return eg.build_milestone2()


@pytest.fixture(scope="module")
def facts() -> dict:
    """Plain lookups straight from the CSV files."""
    def table(name: str) -> pd.DataFrame:
        return pd.read_csv(SRC / f"{name}.csv", na_values=["\\N"], low_memory=False)

    races = {int(r.raceId): {"year": int(r.year), "circuit": int(r.circuitId), "date": str(r.date)} for r in table("races").itertuples()}
    status = {int(r.statusId): str(r.status) for r in table("status").itertuples()}
    name = {int(r.driverId): f"{r.forename} {r.surname}" for r in table("drivers").itertuples()}
    team = {int(r.constructorId): str(r.name) for r in table("constructors").itertuples()}
    results = []
    for r in table("results").itertuples():
        pos = None if pd.isna(r.position) else int(float(r.position))
        results.append({"race": int(r.raceId), "driver": int(r.driverId), "team": int(r.constructorId), "status": status[int(r.statusId)], "order": int(r.positionOrder), "pos": pos, "points": float(r.points), **races[int(r.raceId)]})
    return {"results": results, "name": name, "team": team}


def test_milestone2_file_is_current_and_carries_the_queries_as_submitted(ms2):
    assert ms2["contract"] == "paladin.milestone2.v1" and len(ms2["source"]["sha256"]) == 64
    assert ms2["counts"] == {"nodes": 51113, "relationships": 163510}
    assert [q["number"] for q in ms2["questions"]] == [1, 2, 3, 4, 5]
    text = (SRC / "queries.txt").read_text(encoding="utf-8").replace("\r\n", "\n")
    for q in ms2["questions"]:
        assert q["cypher"].startswith("MATCH")
        assert q["cypher"] in text, f"Query {q['number']} is queries.txt as submitted"
    if not eg.MS2_OUT.exists():
        pytest.skip("run scripts/export_graph_data.py first")
    assert json.loads(eg.MS2_OUT.read_text(encoding="utf-8")) == json.loads(json.dumps(ms2)), "the saved file is current: run scripts/export_graph_data.py"


def test_the_answers_match_a_plain_loop_over_the_csv_rows(ms2, facts):
    results, name, team = facts["results"], facts["name"], facts["team"]
    q = {item["number"]: item["rows"] for item in ms2["questions"]}

    # Query 1: 2021 points and wins per driver
    points: dict[int, float] = defaultdict(float)
    wins: dict[int, int] = defaultdict(int)
    for r in results:
        if r["year"] == 2021:
            points[r["driver"]] += r["points"]
            wins[r["driver"]] += r["pos"] == 1
    want1 = sorted(((name[d], points[d], wins[d]) for d in points), key=lambda x: (-x[1], -x[2], x[0]))
    assert [(r["Driver"], r["Points"], r["Wins"]) for r in q[1]] == want1

    # Query 2: classified share of entries, 2014 to 2021, for constructors with at least 100 entries
    entries: dict[int, int] = defaultdict(int)
    classified: dict[int, int] = defaultdict(int)
    for r in results:
        if 2014 <= r["year"] <= 2021:
            entries[r["team"]] += 1
            classified[r["team"]] += r["status"] == "Finished" or r["status"].startswith("+")
    want2 = sorted(((team[c], entries[c], classified[c]) for c in entries if entries[c] >= 100), key=lambda x: (-x[2] / x[1], x[0]))
    assert [(r["Constructor"], r["Entries"], r["Classified"]) for r in q[2]] == want2
    assert all(abs(r["Reliability"] - r["Classified"] / r["Entries"]) < 1e-12 for r in q[2])

    # Query 3: Hamilton (1) and Bottas (822) in the same race for the same constructor
    by_slot: dict[tuple[int, int], dict[int, int]] = defaultdict(dict)
    for r in results:
        if r["driver"] in (1, 822):
            by_slot[(r["race"], r["team"])][r["driver"]] = r["order"]
    shared: dict[int, list[int]] = defaultdict(lambda: [0, 0, 0])
    for (_, t), seen in by_slot.items():
        if len(seen) == 2:
            shared[t][0] += 1
            shared[t][1] += seen[1] < seen[822]
            shared[t][2] += seen[822] < seen[1]
    assert q[3] == [{"Constructor": team[t], "Shared_Races": s, "Hamilton_Ahead": h, "Bottas_Ahead": b} for t, (s, h, b) in sorted(shared.items())]

    # Query 4: Monaco (6) before 2020. A start is a race; the average and the wins are over every remaining Result.
    monaco: dict[int, dict] = defaultdict(lambda: {"races": set(), "orders": [], "wins": 0})
    for r in results:
        if r["circuit"] == 6 and r["date"] < "2020-01-01" and r["status"] not in ("Did not qualify", "Did not prequalify", "Withdrew"):
            d = monaco[r["driver"]]
            d["races"].add(r["race"])
            d["orders"].append(r["order"])
            d["wins"] += r["pos"] == 1
    want4 = sorted(((name[i], len(d["races"]), sum(d["orders"]) / len(d["orders"]), d["wins"]) for i, d in monaco.items() if len(d["races"]) >= 5), key=lambda x: (x[2], -x[3], x[0]))
    got4 = [(r["Driver"], r["Starts"], round(r["Avg_Finish"], 9), r["Wins"]) for r in q[4]]
    assert got4 == [(a, b, round(c, 9), d) for a, b, c, d in want4]
    # the drivers who had two Results in one of those races, counted here in Results minus races
    twice = sum(len(d["orders"]) - len(d["races"]) for d in monaco.values())
    assert len(ms2["questions"][3]["sharedDrives"]) == twice == 6

    # Query 5: primary constructor in 2020 and in 2021 (most entries; a tie goes to the lower constructorId)
    count: dict[tuple[int, int], dict[int, int]] = defaultdict(lambda: defaultdict(int))
    for r in results:
        if r["year"] in (2020, 2021):
            count[(r["driver"], r["year"])][r["team"]] += 1
    primary = {k: min(v, key=lambda t: (-v[t], t)) for k, v in count.items()}
    movers = [d for d in {k[0] for k in primary} if (d, 2020) in primary and (d, 2021) in primary and primary[(d, 2020)] != primary[(d, 2021)]]
    changed = sorted(name[d] for d in movers)
    assert q[5] == [{"Drivers_Changed": len(changed), "Drivers": changed}]
    moves = {m["driver"]: (m["from"], m["to"]) for m in ms2["questions"][4]["moves"]}
    assert moves == {name[d]: (team[primary[(d, 2020)]], team[primary[(d, 2021)]]) for d in movers}


def test_the_schema_in_the_file_is_the_one_the_brief_gives(ms2):
    labels = [n["label"] for n in ms2["schema"]]
    assert labels == ["Driver", "Constructor", "Circuit", "Season", "Status", "Race", "Result", "Qualifying", "PitStop"]
    assert {n["label"] for n in ms2["schema"] if n["kind"] == "fact"} == {"Result", "Qualifying", "PitStop"}
    assert len(ms2["relationships"]) == 11
    assert sum(n["count"] for n in ms2["schema"]) == 51113 and sum(r["count"] for r in ms2["relationships"]) == 163510
    result = next(n for n in ms2["schema"] if n["label"] == "Result")
    assert [p["name"] for p in result["properties"]] == ["resultId", "number", "grid", "position", "positionText", "positionOrder", "points", "laps", "time", "milliseconds", "fastestLap", "rank", "fastestLapTime", "fastestLapSpeed"]
    assert {p["name"]: p["type"] for p in result["properties"]}["points"] == "float"
