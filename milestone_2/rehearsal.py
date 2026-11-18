"""Rehearsal for the private queries: twenty natural questions the brief's own five do not cover, each with its answer.

Not part of the submission. The brief says the graph will also be marked by "a separate set of private queries" to check
it is "flexible and not hardcoded". This is a stand-in for them. Each question is written as Cypher against the finished
graph and answered a second way, in pandas, straight from the CSV files (kg_oracle.py). verify_kg.py runs both and
compares. The questions were picked to lean on the places a graph built from tables tends to go wrong:

* a property that is absent rather than null (a driver with no code, a qualifying row with no Q3, a race with no time);
* dates and numbers that must be real dates and numbers (a date range, age in days, sums and averages);
* text that must stay text (pit stop durations are strings, so averaging them needs toFloat);
* hops that cross an entity and a fact node (Result to Race to Circuit, Qualifying beside Result);
* a driver with two Results in one race (a shared drive), which counts once as a start but twice as a Result.

Each query sorts completely (a tie-break on the name), so the order can be compared too.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from types import SimpleNamespace
from typing import Callable

import pandas as pd


@dataclass
class Rehearsal:
    name: str
    question: str
    cypher: str
    expected: Callable[[SimpleNamespace], list[dict]]
    ordered: bool = True
    params: dict = field(default_factory=dict)


def _top(counts: pd.Series, label: str, value: str, n: int) -> list[dict]:
    """The n biggest counts, ties broken by name, as {label: name, value: count} rows."""
    df = counts.rename(value).reset_index().rename(columns={counts.index.name or "index": label})
    df = df.sort_values([value, label], ascending=[False, True]).head(n)
    return [{label: str(r[label]), value: int(r[value])} for _, r in df.iterrows()]


def _seconds(text) -> float | None:
    """Neo4j's toFloat on a duration like 24.567: a number if it is one, nothing if it is not (1:02.3 is not)."""
    try:
        return float(text)
    except (TypeError, ValueError):
        return None


def _nationalities(f):
    return _top(f.drivers.groupby("nationality").size(), "Nationality", "Drivers", 5)


def _winners(f):
    return _top(f.results[f.results.position == 1].groupby("full").size(), "Driver", "Wins", 5)


def _races_per_season(f):
    s = f.races[(f.races.year >= 2018) & (f.races.year <= 2021)].groupby("year").size()
    return [{"Season": int(y), "Races": int(n)} for y, n in s.items()]


def _march_2021(f):
    r = f.races[(f.races.date >= "2021-03-01") & (f.races.date < "2021-04-01")].sort_values(["date", "race_name"])
    return [{"Race": x.race_name, "Date": x.date.strftime("%Y-%m-%d")} for x in r.itertuples()]


def _not_in_q3(f):
    q = f.quali
    return [{"Not_In_Q3": int(((q.year == 2021) & q.q3.isna()).sum())}]


def _pit_stops(f):
    p = f.pits[(f.pits.driverId == 1) & (f.pits.year == 2021)]
    seconds = [s for s in (_seconds(x) for x in p.duration) if s is not None]
    return [{"Stops": int(len(p)), "Timed_Stops": len(seconds), "Avg_Duration": sum(seconds) / len(seconds)}]


def _fastest_laps(f):
    return _top(f.results[f.results["rank"] == 1].groupby("full").size(), "Driver", "Fastest_Laps", 5)


def _gained(f):
    r = f.results[(f.results.year == 2021) & (f.results.grid > 0) & f.results.position.notna()].copy()
    r["Gained"] = r.grid - r.position.astype(int)
    r = r.sort_values(["Gained", "full", "race_name"], ascending=[False, True, True]).head(5)
    return [{"Driver": x.full, "Race": x.race_name, "Gained": int(x.Gained)} for x in r.itertuples()]


def _ferrari_and_mclaren(f):
    r = f.results
    both = set(r[r.constructorId == 6].driverId) & set(r[r.constructorId == 1].driverId)
    return [{"Driver": n} for n in sorted(set(f.drivers[f.drivers.driverId.isin(both)]["full"]))]


def _circuit_countries(f):
    return _top(f.circuits.groupby("country").size(), "Country", "Circuits", 5)


def _retirements(f):
    r = f.results[(f.results.year == 2021) & (f.results.status != "Finished") & (~f.results.status.str.startswith("+"))]
    return _top(r.groupby("status").size(), "Status", "Entries", 5)


def _poles(f):
    q = f.quali[(f.quali.position == 1) & (f.quali.year >= 2010) & (f.quali.year <= 2019)]
    return _top(q.groupby("full").size(), "Driver", "Poles", 5)


def _shared_drives(f):
    n = f.results.groupby(["driverId", "raceId"]).size()
    return [{"Shared_Drive_Entries": int((n > 1).sum())}]


def _grid_vs_quali(f):
    q = f.quali[(f.quali.year == 2021) & (f.quali.driverId == 1)][["raceId", "position"]].rename(columns={"position": "quali"})
    g = f.results[(f.results.year == 2021) & (f.results.driverId == 1)][["raceId", "grid"]]
    j = q.merge(g, on="raceId")
    return [{"Races_With_Both": int(len(j)), "Grid_Equals_Quali": int((j.quali == j.grid).sum())}]


def _constructor_points(f):
    s = f.results[f.results.year == 2021].groupby("constructor_name").points.sum().rename("Points").reset_index()
    s = s.sort_values(["Points", "constructor_name"], ascending=[False, True]).head(5)
    return [{"Constructor": x.constructor_name, "Points": float(x.Points)} for x in s.itertuples()]


def _without_code(f):
    return [{"Without_Code": int(f.drivers.code.isna().sum())}]


def _races_without_time(f):
    return [{"Races_Without_Time": int(f.races_time_missing)}]


def _oldest_winners(f):
    r = f.results[f.results.position == 1].copy()
    r["Age_Days"] = (r.date - r.dob).dt.days
    r = r.sort_values(["Age_Days", "full"], ascending=[False, True]).head(3)
    return [{"Driver": x.full, "Age_Days": int(x.Age_Days)} for x in r.itertuples()]


def _no_q1(f):
    return [{"No_Q1": int(f.quali.q1.isna().sum())}]


def _hamilton_circuits(f):
    r = f.results[(f.results.driverId == 1) & (f.results.position == 1)].merge(f.circuits[["circuitId", "name"]], on="circuitId")
    return _top(r.groupby("name").size(), "Circuit", "Wins", 5)


REHEARSALS: list[Rehearsal] = [
    Rehearsal("nationalities", "Which five nationalities have the most drivers?",
              "MATCH (d:Driver) RETURN d.nationality AS Nationality, count(*) AS Drivers ORDER BY Drivers DESC, Nationality ASC LIMIT 5", _nationalities),
    Rehearsal("winners", "Who has won the most races, ever?",
              "MATCH (res:Result)-[:BY_DRIVER]->(d:Driver) WHERE res.position = 1 RETURN d.forename + ' ' + d.surname AS Driver, count(*) AS Wins ORDER BY Wins DESC, Driver ASC LIMIT 5", _winners),
    Rehearsal("races_per_season", "How many races were there in each season from 2018 to 2021?",
              "MATCH (r:Race)-[:IN_SEASON]->(s:Season) WHERE s.year >= 2018 AND s.year <= 2021 RETURN s.year AS Season, count(r) AS Races ORDER BY Season ASC", _races_per_season),
    Rehearsal("march_2021", "Which races were run in March 2021? (a range over real dates)",
              "MATCH (r:Race) WHERE r.date >= date('2021-03-01') AND r.date < date('2021-04-01') RETURN r.name AS Race, toString(r.date) AS Date ORDER BY r.date ASC, Race ASC", _march_2021),
    Rehearsal("not_in_q3", "How many 2021 qualifying entries have no Q3 time? (an absent property)",
              "MATCH (q:Qualifying)-[:FOR_RACE]->(r:Race {year: 2021}) WHERE q.q3 IS NULL RETURN count(q) AS Not_In_Q3", _not_in_q3),
    Rehearsal("pit_stops", "What was Hamilton's average pit stop in 2021? (durations are text)",
              "MATCH (p:PitStop)-[:BY_DRIVER]->(:Driver {driverId: 1}), (p)-[:FOR_RACE]->(:Race {year: 2021}) WITH p, toFloat(p.duration) AS seconds RETURN count(p) AS Stops, count(seconds) AS Timed_Stops, avg(seconds) AS Avg_Duration", _pit_stops),
    Rehearsal("fastest_laps", "Who set the most fastest laps? (rank = 1)",
              "MATCH (res:Result)-[:BY_DRIVER]->(d:Driver) WHERE res.rank = 1 RETURN d.forename + ' ' + d.surname AS Driver, count(*) AS Fastest_Laps ORDER BY Fastest_Laps DESC, Driver ASC LIMIT 5", _fastest_laps),
    Rehearsal("gained", "Which five drives in 2021 gained the most places from the grid to the flag?",
              "MATCH (res:Result)-[:FOR_RACE]->(r:Race {year: 2021}), (res)-[:BY_DRIVER]->(d:Driver) WHERE res.grid > 0 AND res.position IS NOT NULL RETURN d.forename + ' ' + d.surname AS Driver, r.name AS Race, res.grid - res.position AS Gained ORDER BY Gained DESC, Driver ASC, Race ASC LIMIT 5", _gained),
    Rehearsal("ferrari_and_mclaren", "Who has driven for both Ferrari (6) and McLaren (1)?",
              "MATCH (d:Driver)<-[:BY_DRIVER]-(:Result)-[:FOR_CONSTRUCTOR]->(:Constructor {constructorId: 6}) WITH DISTINCT d MATCH (d)<-[:BY_DRIVER]-(:Result)-[:FOR_CONSTRUCTOR]->(:Constructor {constructorId: 1}) RETURN DISTINCT d.forename + ' ' + d.surname AS Driver ORDER BY Driver ASC", _ferrari_and_mclaren),
    Rehearsal("circuit_countries", "Which five countries have the most circuits?",
              "MATCH (c:Circuit) RETURN c.circuit_country AS Country, count(*) AS Circuits ORDER BY Circuits DESC, Country ASC LIMIT 5", _circuit_countries),
    Rehearsal("retirements", "What were the five most common ways a 2021 entry did not finish?",
              "MATCH (res:Result)-[:FOR_RACE]->(:Race {year: 2021}), (res)-[:HAS_STATUS]->(s:Status) WHERE s.status <> 'Finished' AND NOT s.status STARTS WITH '+' RETURN s.status AS Status, count(*) AS Entries ORDER BY Entries DESC, Status ASC LIMIT 5", _retirements),
    Rehearsal("poles", "Who took the most poles in the 2010s?",
              "MATCH (q:Qualifying)-[:FOR_RACE]->(r:Race), (q)-[:BY_DRIVER]->(d:Driver) WHERE q.position = 1 AND r.year >= 2010 AND r.year <= 2019 RETURN d.forename + ' ' + d.surname AS Driver, count(*) AS Poles ORDER BY Poles DESC, Driver ASC LIMIT 5", _poles),
    Rehearsal("shared_drives", "How many times did a driver have two Results in one race? (a shared drive)",
              "MATCH (res:Result)-[:BY_DRIVER]->(d:Driver), (res)-[:FOR_RACE]->(r:Race) WITH d, r, count(res) AS n WHERE n > 1 RETURN count(*) AS Shared_Drive_Entries", _shared_drives),
    Rehearsal("grid_vs_quali", "In 2021, how often did Hamilton start from the grid slot he qualified in?",
              "MATCH (q:Qualifying)-[:FOR_RACE]->(r:Race {year: 2021}), (q)-[:BY_DRIVER]->(:Driver {driverId: 1}), (res:Result)-[:FOR_RACE]->(r), (res)-[:BY_DRIVER]->(:Driver {driverId: 1}) RETURN count(*) AS Races_With_Both, sum(CASE WHEN q.position = res.grid THEN 1 ELSE 0 END) AS Grid_Equals_Quali", _grid_vs_quali),
    Rehearsal("constructor_points", "Which five constructors scored the most points in 2021?",
              "MATCH (res:Result)-[:FOR_RACE]->(:Race {year: 2021}), (res)-[:FOR_CONSTRUCTOR]->(c:Constructor) RETURN c.constructor_name AS Constructor, sum(res.points) AS Points ORDER BY Points DESC, Constructor ASC LIMIT 5", _constructor_points),
    Rehearsal("without_code", "How many drivers have no three-letter code? (an absent property)",
              "MATCH (d:Driver) WHERE d.code IS NULL RETURN count(d) AS Without_Code", _without_code),
    Rehearsal("races_without_time", "How many races have no start time?",
              "MATCH (r:Race) WHERE r.time IS NULL RETURN count(r) AS Races_Without_Time", _races_without_time),
    Rehearsal("oldest_winners", "Which three wins came to the oldest drivers, in days? (arithmetic on two dates)",
              "MATCH (res:Result {position: 1})-[:FOR_RACE]->(r:Race), (res)-[:BY_DRIVER]->(d:Driver) RETURN d.forename + ' ' + d.surname AS Driver, duration.inDays(d.dob, r.date).days AS Age_Days ORDER BY Age_Days DESC, Driver ASC LIMIT 3", _oldest_winners),
    Rehearsal("no_q1", "How many qualifying entries have no Q1 time?",
              "MATCH (q:Qualifying) WHERE q.q1 IS NULL RETURN count(q) AS No_Q1", _no_q1),
    Rehearsal("hamilton_circuits", "Where has Hamilton won most? (Result to Race to Circuit)",
              "MATCH (:Driver {driverId: 1})<-[:BY_DRIVER]-(res:Result {position: 1})-[:FOR_RACE]->(:Race)-[:AT_CIRCUIT]->(c:Circuit) RETURN c.circuit_name AS Circuit, count(*) AS Wins ORDER BY Wins DESC, Circuit ASC LIMIT 5", _hamilton_circuits),
]
