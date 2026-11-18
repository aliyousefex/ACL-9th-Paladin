"""Offline checks of the Milestone 2 deliverables: milestone_2/Create_kg.py and milestone_2/queries.txt. No Neo4j needed.

Create_kg.py is run for real, but against a recording stand-in for the database session, so every node and every
relationship it would send is captured. Those are compared with what the CSV files say the graph must hold, worked out
by a different route (milestone_2/kg_oracle.py, written from the brief). The live check, against a real Neo4j, is
milestone_2/verify_kg.py. Needs only pandas.
"""

from __future__ import annotations

import re
import sys
import types
from collections import defaultdict
from datetime import date
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[1]
MS2 = ROOT / "milestone_2"
sys.path.insert(0, str(MS2))

try:  # the real driver is not needed here, only its name
    import neo4j  # noqa: F401
except ImportError:  # pragma: no cover
    stub = types.ModuleType("neo4j")
    stub.GraphDatabase = types.SimpleNamespace(driver=None)
    sys.modules["neo4j"] = stub

import Create_kg as ck  # noqa: E402
import kg_oracle as oracle  # noqa: E402

MISSING = chr(92) + "N"


# ---------------------------------------------------------------------------------------------------------------
# A stand-in for the driver that records what it is asked to run


class FakeResult:
    def consume(self):
        return None

    def single(self):
        return {"c": 0}


class FakeSession:
    def __init__(self, database):
        self.database = database
        self.calls: list[tuple[str, dict]] = []

    def run(self, query, **params):
        self.calls.append((query, params))
        return FakeResult()

    def execute_write(self, work):   # what the driver calls a managed write transaction
        work(self)

    def __enter__(self):
        return self

    def __exit__(self, *exc):
        return False


class FakeDriver:
    instances: list["FakeDriver"] = []

    def __init__(self, uri, auth):
        self.uri, self.auth, self.closed, self.sessions = uri, auth, False, []
        FakeDriver.instances.append(self)

    def verify_connectivity(self):
        return None

    def session(self, database=None):
        s = FakeSession(database)
        self.sessions.append(s)
        return s

    def close(self):
        self.closed = True


def build(tmp_path: Path, extra: str = "") -> FakeDriver:
    config = tmp_path / "config.txt"
    config.write_text(f"URI=neo4j://localhost:7687\nUSERNAME=neo4j\nPASSWORD=a=b c\n{extra}", encoding="utf-8")
    original = ck.GraphDatabase
    ck.GraphDatabase = types.SimpleNamespace(driver=lambda uri, auth: FakeDriver(uri, auth))
    try:
        ck.main(config)
    finally:
        ck.GraphDatabase = original
    return FakeDriver.instances[-1]


@pytest.fixture(scope="module")
def built(tmp_path_factory) -> FakeDriver:
    return build(tmp_path_factory.mktemp("kg"))


@pytest.fixture(scope="module")
def raw():
    return oracle.raw_tables()


@pytest.fixture(scope="module")
def sent(built):
    """What the script sent: nodes by label and key, and relationships by (source, type, target)."""
    calls = built.sessions[0].calls
    nodes: dict[str, dict] = defaultdict(dict)
    edges: dict[tuple[str, str, str], list] = defaultdict(list)
    order: list[str] = []
    batch_sizes: list[int] = []
    for query, params in calls:
        rows = params.get("rows")
        if rows is None:
            continue
        batch_sizes.append(len(rows))
        merge = re.search(r"MERGE \(n:(\w+) \{(\w+): row\.\w+\}\) SET n \+= row", query)
        if merge:
            label, key = merge.group(1), merge.group(2)
            if not order or order[-1] != label:
                order.append(label)
            for row in rows:
                assert row[key] not in nodes[label], f"{label} {row[key]!r} sent twice"
                nodes[label][row[key]] = row
            continue
        variables = {m.group(1): (m.group(2), m.group(4)) for m in re.finditer(r"MATCH \((\w+):(\w+) \{(\w+): row\.(\w+)\}\)", query)}
        variables = {v: (label, field) for v, (label, field) in {m.group(1): (m.group(2), m.group(4)) for m in re.finditer(r"MATCH \((\w+):(\w+) \{(\w+): row\.(\w+)\}\)", query)}.items()}
        for m in re.finditer(r"MERGE \((\w+)\)-\[:(\w+)\]->\((\w+)\)", query):
            (src, src_field), (dst, dst_field) = variables[m.group(1)], variables[m.group(3)]
            edges[(src, m.group(2), dst)].extend((row[src_field], row[dst_field]) for row in rows)
    return types.SimpleNamespace(nodes=nodes, edges=edges, order=order, batch_sizes=batch_sizes, calls=calls)


# ---------------------------------------------------------------------------------------------------------------


def test_every_node_sent_is_the_csv_row_with_the_right_types(sent, raw):
    expected = oracle.expected_nodes(raw)
    assert set(sent.nodes) == set(expected)
    problems = []
    for label, want in expected.items():
        got = sent.nodes[label]
        if set(got) != set(want):
            problems.append(f"{label}: {len(set(got) ^ set(want))} nodes differ")
            continue
        for key, node in want.items():
            sent_node = got[key]
            if sent_node.keys() != node.keys():
                problems.append(f"{label} {key!r}: properties {sorted(sent_node.keys() ^ node.keys())}")
            elif any(type(sent_node[p]) is not type(v) or sent_node[p] != v for p, v in node.items()):
                problems.append(f"{label} {key!r}: values or types differ")
    assert not problems, problems[:5]


def test_every_relationship_sent_is_one_the_schema_lists_and_none_twice(sent, raw):
    expected = oracle.expected_edges(raw)
    assert set(sent.edges) == set(expected), "the same eleven relationship kinds as the brief"
    for kind, want in expected.items():
        pairs = sent.edges[kind]
        assert len(pairs) == len(set(pairs)), f"{kind}: a relationship sent twice"
        assert set(pairs) == want, f"{kind}: differs from the CSV"


def test_the_graph_has_the_size_the_brief_gives(sent):
    assert sum(len(v) for v in sent.nodes.values()) == 51113
    assert sum(len(v) for v in sent.edges.values()) == 163510
    assert {k: len(v) for k, v in sent.nodes.items()} == {
        "Driver": 861, "Constructor": 212, "Circuit": 77, "Season": 75, "Status": 139, "Race": 1125, "Result": 26759, "Qualifying": 10494, "PitStop": 11371,
    }


def test_properties_follow_the_schema_of_the_brief_and_have_its_types(sent):
    """Checked against the brief's own list, with no help from the oracle's column mapping."""
    for label, nodes in sent.nodes.items():
        schema = oracle.SCHEMA[label]
        for key, node in nodes.items():
            for name, value in node.items():
                assert name in schema, f"{label} has a property {name} the schema does not"
                want = schema[name]
                assert type(value) is want, f"{label} {key!r}.{name} is {type(value).__name__}, the brief says {want.__name__}"


def test_a_missing_value_is_never_stored(sent):
    """The literal \\N, an empty cell and NaN are all left off the node, not kept as null, "" or text."""
    for label, nodes in sent.nodes.items():
        for key, node in nodes.items():
            for name, value in node.items():
                assert value is not None, f"{label} {key!r}.{name} is None"
                assert value == value, f"{label} {key!r}.{name} is NaN"
                if isinstance(value, str):
                    assert value != "" and value != MISSING and value.lower() != "nan", f"{label} {key!r}.{name} is {value!r}"
    # and the properties that are often missing really are: they are absent from some nodes and present on others
    results = sent.nodes["Result"].values()
    assert sum("position" not in r for r in results) == 10953
    assert sum("q3" not in q for q in sent.nodes["Qualifying"].values()) == 6865
    assert sum("code" not in d for d in sent.nodes["Driver"].values()) == 757


def test_foreign_keys_are_used_to_link_and_never_stored(sent):
    banned = {"Race": {"circuitId"}, "Result": {"raceId", "driverId", "constructorId", "statusId"}, "Qualifying": {"raceId", "driverId", "constructorId"}, "PitStop": {"raceId", "driverId"}}
    for label, names in banned.items():
        for node in list(sent.nodes[label].values())[:500]:
            assert not names & node.keys(), f"{label} stores a foreign key"


def test_parents_come_before_the_facts_that_link_to_them(sent):
    order = sent.order
    for parent in ["Season", "Status", "Circuit", "Driver", "Constructor", "Race"]:
        for fact in ["Result", "Qualifying", "PitStop"]:
            assert order.index(parent) < order.index(fact), f"{parent} before {fact}"
    assert order.index("Season") < order.index("Race") and order.index("Circuit") < order.index("Race")


def test_it_is_safe_to_run_again(sent):
    """Every node is merged on its unique key under a constraint, every relationship is merged, nothing is created blindly."""
    constraints = [q for q, _ in sent.calls if q.startswith("CREATE CONSTRAINT")]
    assert len(constraints) == 9 and all("IF NOT EXISTS" in q and "IS UNIQUE" in q for q in constraints)
    assert {(label, key) for label, key in ck.CONSTRAINTS} == {(label, spec[1]) for label, spec in oracle.NODES.items()}
    for query, params in sent.calls:
        if "rows" in params:
            assert "CREATE (" not in query and "CREATE (n" not in query
            assert "MERGE" in query
    assert max(sent.batch_sizes) <= 1000


def test_the_database_comes_from_config_and_is_never_hardcoded(tmp_path):
    assert build(tmp_path).sessions[0].database is None, "no DATABASE line: the server's default database"
    other = tmp_path / "other"
    other.mkdir()
    driver = build(other, "DATABASE=graph2\n")
    assert driver.sessions[0].database == "graph2"
    assert driver.closed, "the connection is closed at the end"
    source = (MS2 / "Create_kg.py").read_text(encoding="utf-8")
    assert not re.search(r"database\s*=\s*[\"']", source), "no database name written into the script"


def test_config_is_read_by_key_not_by_line(tmp_path):
    path = tmp_path / "config.txt"
    path.write_text("\ufeffDATABASE=main\n\nPASSWORD=p=q=r\nnot a setting\nURI=neo4j://localhost:7687\n  USERNAME = neo4j  \n", encoding="utf-8")
    config = ck.read_config(path)
    assert config == {"DATABASE": "main", "PASSWORD": "p=q=r", "URI": "neo4j://localhost:7687", "USERNAME": "neo4j"}


def test_the_small_conversions():
    import pandas as pd

    assert ck.to_int("3.0") == 3 and ck.to_int(None) is None and ck.to_int(float("nan")) is None
    assert ck.to_float("0.5") == 0.5 and ck.to_float(pd.NA) is None
    assert ck.to_date("1985-01-07") == date(1985, 1, 7) and ck.to_date(None) is None
    assert ck.to_str(None) is None and ck.to_str("x") == "x"
    assert ck.props(a=1, b=None, c=0, d="") == {"a": 1, "c": 0, "d": ""}, "only a missing value is dropped, not a zero or an empty string"


def test_a_csv_with_a_byte_order_mark_and_padded_headers_still_loads(tmp_path, monkeypatch):
    (tmp_path / "seasons.csv").write_bytes("\ufeffyear , url\n2021,http://x\n".encode("utf-8"))
    monkeypatch.setattr(ck, "HERE", tmp_path)
    table = ck.load_csv("seasons")
    assert list(table.columns) == ["year", "url"] and table.iloc[0].year == "2021"


def test_the_summary_only_reports(capsys):
    class Broken:
        def run(self, *a, **k):
            raise RuntimeError("no connection")

    ck.print_summary(Broken(), 0)   # must not raise
    assert "could not count" in capsys.readouterr().out


def test_a_pit_stop_is_keyed_by_race_driver_and_stop(sent, raw):
    first = raw["pit_stops"].iloc[0]
    key = f"{int(first.raceId)}:{int(first.driverId)}:{int(first.stop)}"
    assert key in sent.nodes["PitStop"] and sent.nodes["PitStop"][key]["stop"] == int(first.stop)
    assert all(re.fullmatch(r"\d+:\d+:\d+", k) for k in sent.nodes["PitStop"])


# ---------------------------------------------------------------------------------------------------------------
# queries.txt


def read_queries() -> list[tuple[int, str]]:
    text = (MS2 / "queries.txt").read_bytes()
    assert not text.startswith(b"\xef\xbb\xbf"), "UTF-8 without a byte-order mark"
    parts = re.split(r"(?m)^//(\d+)\. Query \d+[ \t\r]*$", text.decode("utf-8"))
    return [(int(parts[i]), parts[i + 1].strip()) for i in range(1, len(parts), 2)]


def columns_of(query: str) -> list[str]:
    """The names a query returns: the text after AS, or the bare name, for each item of its last RETURN."""
    clause = query[query.rindex("RETURN") + len("RETURN"):]
    clause = re.split(r"\bORDER BY\b|\bLIMIT\b", clause)[0]
    items, depth, quote, current = [], 0, "", ""
    for ch in clause:
        if quote:
            current += ch
            quote = "" if ch == quote else quote
        elif ch in "'\"":
            quote = ch
            current += ch
        elif ch in "([{":
            depth += 1
            current += ch
        elif ch in ")]}":
            depth -= 1
            current += ch
        elif ch == "," and depth == 0:
            items.append(current)
            current = ""
        else:
            current += ch
    items.append(current)
    return [re.split(r"\s+AS\s+", i.strip())[-1].strip() for i in items]


def test_queries_txt_follows_the_format_the_grader_reads():
    blocks = read_queries()
    assert [n for n, _ in blocks] == [1, 2, 3, 4, 5], "Query 1 to Query 5, in order"
    text = (MS2 / "queries.txt").read_text(encoding="utf-8")
    assert re.findall(r"(?m)^//\d+\. Query \d+$", text) == [f"//{n}. Query {n}" for n in range(1, 6)]
    for n, query in blocks:
        assert query.startswith("MATCH"), f"Query {n} begins with MATCH"
        assert "RETURN" in query
        assert not re.search(r"\b(CREATE|MERGE|DELETE|SET|REMOVE|DROP)\b", query), f"Query {n} only reads"


def test_each_query_returns_the_columns_the_brief_names_in_its_order():
    for n, query in read_queries():
        assert columns_of(query) == oracle.COLUMNS[f"Q{n}"], f"Query {n}"


def test_each_query_is_sorted_as_the_brief_asks():
    asked = {1: "ORDER BY Points DESC, Wins DESC", 2: "ORDER BY Reliability DESC", 4: "ORDER BY Avg_Finish ASC, Wins DESC"}
    queries = dict(read_queries())
    for n, clause in asked.items():
        assert clause in queries[n], f"Query {n}: {clause}"


def test_the_questions_pin_the_traps_the_brief_warns_about():
    q = dict(read_queries())
    assert "driverId: 1" in q[3] and "driverId: 822" in q[3]
    assert "circuitId: 6" in q[4] and "date('2020-01-01')" in q[4] and "count(DISTINCT r)" in q[4], "a start is a race, however many Results a shared drive gave"
    for status in ["Did not qualify", "Did not prequalify", "Withdrew"]:
        assert status in q[4]
    assert "STARTS WITH '+'" in q[2] and "'Finished'" in q[2] and ">= 100" in q[2]
    assert "constructorId ASC" in q[5], "a tie for a driver's primary constructor goes to the lower constructorId"


# ---------------------------------------------------------------------------------------------------------------
# The answers the CSV files give: pinned, so a changed file is noticed, and so there is a number to compare a live graph with


@pytest.fixture(scope="module")
def answers(raw):
    return oracle.answers(oracle.frames(raw))


def test_query_1_2021_points_exclude_sprints(answers):
    q1 = answers["Q1"]
    assert len(q1) == 21
    assert q1[0] == {"Driver": "Max Verstappen", "Points": 388.5, "Wins": 10}   # 395.5 officially: the 7 sprint points are not in the graph
    assert q1[1] == {"Driver": "Lewis Hamilton", "Points": 385.5, "Wins": 8}


def test_query_2_reliability_is_classified_over_entries(answers):
    q2 = answers["Q2"]
    assert len(q2) == 11 and all(r["Entries"] >= 100 for r in q2)
    assert q2[0] == {"Constructor": "Mercedes", "Entries": 320, "Classified": 298, "Reliability": 298 / 320}
    assert all(0 <= r["Reliability"] <= 1 for r in q2)


def test_query_3_hamilton_and_bottas_share_only_mercedes(answers):
    assert answers["Q3"] == [{"Constructor": "Mercedes", "Shared_Races": 100, "Hamilton_Ahead": 75, "Bottas_Ahead": 25}]


def test_query_4_counts_a_shared_drive_once_as_a_start(raw, answers):
    f = oracle.frames(raw)
    m = f.results[(f.results.circuitId == 6) & (f.results.date < "2020-01-01")]
    per_driver = m.groupby("full").agg(results=("resultId", "count"), races=("raceId", "nunique"))
    assert (per_driver.results > per_driver.races).any(), "Monaco before 2020 does hold a shared drive: the trap is real"
    q4 = answers["Q4"]
    assert len(q4) == 106 and q4[0] == {"Driver": "Ayrton Senna", "Starts": 10, "Avg_Finish": 3.8, "Wins": 6}
    assert all(r["Starts"] >= 5 for r in q4)


def test_query_5_six_drivers_changed_their_primary_constructor(answers):
    (row,) = answers["Q5"]
    assert row["Drivers_Changed"] == 6 == len(row["Drivers"])
    assert row["Drivers"] == sorted(row["Drivers"])
    assert {"Sebastian Vettel", "Carlos Sainz", "Daniel Ricciardo", "Esteban Ocon", "Lance Stroll"} <= set(row["Drivers"])
