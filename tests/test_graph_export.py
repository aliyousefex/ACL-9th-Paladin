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
