"""Check a Milestone 2 knowledge graph against the CSV files and the brief. Not part of the submission.

    python verify_kg.py                    read-only: check the graph config.txt points at
    python verify_kg.py --rebuild          run Create_kg.py first (on a graph that is already built, this is the re-run test)
    python verify_kg.py --config PATH      use another config file (it needs URI, USERNAME, PASSWORD, optionally DATABASE)
    python verify_kg.py --skip-rehearsal   leave out the twenty extra questions
    python verify_kg.py --product          also run the read-only queries of product_queries.cypher

What it checks, each against kg_oracle.py (the same facts worked out from the CSVs by a different route):

  1. the size: 51,113 nodes and 163,510 relationships, and the count of each label and relationship type;
  2. every node: present once, with exactly the properties the CSV row gives (a missing value is left off, not stored
     as null, "" or the text \\N), each of the type the brief asks for (integers, floats, dates, text);
  3. every relationship: the right pairs, in the right direction, none twice and none missing;
  4. the nine uniqueness constraints;
  5. the five queries in queries.txt, run as written, return the brief's columns, in the brief's order, with the answers
     the CSVs give;
  6. the rehearsal questions (rehearsal.py).

It exits with status 1 if anything fails. Run it twice (once on a fresh graph, once with --rebuild) to see that building
again changes nothing. It never writes to the graph unless --rebuild is given.
"""

from __future__ import annotations

import argparse
import json
import logging
import math
import re
import sys
import time
from pathlib import Path

from neo4j import GraphDatabase

import kg_oracle as oracle
from Create_kg import read_config

HERE = Path(__file__).resolve().parent
logging.getLogger("neo4j").setLevel(logging.ERROR)   # the driver warns when count(CASE ...) skips a null: that is how those queries are meant to work
RESULTS: list[tuple[bool, str]] = []


def report(ok: bool, title: str, detail: str = "") -> None:
    RESULTS.append((ok, title))
    print(f"  {'ok  ' if ok else 'FAIL'} {title}" + (f": {detail}" if detail else ""))


def fail_lines(lines: list[str], limit: int = 6) -> str:
    shown = "; ".join(lines[:limit])
    return shown + (f"; and {len(lines) - limit} more" if len(lines) > limit else "")


# ---------------------------------------------------------------------------------------------------------------
# Comparing values


def plain(value):
    """A value from the driver as a plain Python value: a Neo4j date becomes a datetime.date."""
    if hasattr(value, "to_native") and not isinstance(value, (list, dict)):
        return value.to_native()
    if isinstance(value, list):
        return [plain(v) for v in value]
    return value


def same(a, b) -> bool:
    if isinstance(a, float) or isinstance(b, float):
        return isinstance(a, (int, float)) and isinstance(b, (int, float)) and math.isclose(a, b, rel_tol=1e-9, abs_tol=1e-9)
    if isinstance(a, list) and isinstance(b, list):
        return len(a) == len(b) and all(same(x, y) for x, y in zip(a, b))
    return a == b


def normal(row: dict) -> tuple:
    """A row in a form that sorts and compares: floats rounded to nine places."""
    return tuple((k, round(v, 9) if isinstance(v, float) else (tuple(v) if isinstance(v, list) else v)) for k, v in sorted(row.items()))


def compare_rows(actual: list[dict], expected: list[dict], ordered: bool) -> list[str]:
    problems = []
    if len(actual) != len(expected):
        problems.append(f"{len(actual)} rows, expected {len(expected)}")
    if ordered:
        for i, (a, e) in enumerate(zip(actual, expected)):
            if a.keys() != e.keys() or not all(same(a[k], e[k]) for k in e):
                problems.append(f"row {i + 1} is {a}, expected {e}")
                break
    else:
        left = sorted(map(normal, actual), key=repr)
        right = sorted(map(normal, expected), key=repr)
        if left != right:
            extra = [r for r in left if r not in right]
            missing = [r for r in right if r not in left]
            problems.append(f"{len(extra)} rows are not expected (first: {dict(extra[0]) if extra else None}) and {len(missing)} expected rows are absent (first: {dict(missing[0]) if missing else None})")
    return problems


def sorted_as_asked(rows: list[dict], keys: list[tuple[str, int]]) -> bool:
    """Whether the rows come in the order the brief asks for (non-strict, so a tie may fall either way)."""
    for a, b in zip(rows, rows[1:]):
        for column, direction in keys:
            x, y = a[column], b[column]
            if not same(x, y):
                if (x - y) * direction > 0:   # a should come after b
                    return False
                break
    return True


# ---------------------------------------------------------------------------------------------------------------
# The checks


def check_size(session, raw) -> None:
    nodes, rels = oracle.expected_counts(raw)
    got_nodes = session.run("MATCH (n) RETURN count(n) AS c").single()["c"]
    got_rels = session.run("MATCH ()-[r]->() RETURN count(r) AS c").single()["c"]
    report(got_nodes == nodes == oracle.EXPECTED_NODE_COUNT, "nodes", f"{got_nodes:,} (the brief says {oracle.EXPECTED_NODE_COUNT:,})")
    report(got_rels == rels == oracle.EXPECTED_RELATIONSHIP_COUNT, "relationships", f"{got_rels:,} (the brief says {oracle.EXPECTED_RELATIONSHIP_COUNT:,})")
    stray = session.run("MATCH (n) WHERE size(labels(n)) <> 1 RETURN count(n) AS c").single()["c"]
    report(stray == 0, "every node has exactly one label", f"{stray} do not" if stray else "")
    types = {r["t"]: r["c"] for r in session.run("MATCH ()-[r]->() RETURN type(r) AS t, count(*) AS c")}
    wanted: dict[str, int] = {}
    for rel, _, _, csv, _, _ in oracle.EDGES:
        wanted[rel] = wanted.get(rel, 0) + len(raw[csv])
    report(types == wanted, "relationship types and their counts", "" if types == wanted else f"got {types}, expected {wanted}")


def check_nodes(session, nodes_expected) -> None:
    for label, expected in nodes_expected.items():
        key = oracle.NODES[label][1]
        problems: list[str] = []
        seen: set = set()
        count = 0
        for record in session.run(f"MATCH (n:{label}) RETURN properties(n) AS p"):
            count += 1
            props = {k: plain(v) for k, v in record["p"].items()}
            ident = props.get(key)
            want = expected.get(ident)
            if want is None:
                problems.append(f"unexpected {label} {ident!r}")
                continue
            if ident in seen:
                problems.append(f"{label} {ident!r} twice")
            seen.add(ident)
            if props.keys() != want.keys():
                problems.append(f"{label} {ident!r} has properties {sorted(props.keys() ^ want.keys())} that differ from the CSV row")
                continue
            for name, value in want.items():
                got = props[name]
                if type(got) is not type(value) or not (got == value):
                    problems.append(f"{label} {ident!r}.{name} is {got!r} ({type(got).__name__}), expected {value!r} ({type(value).__name__})")
                    break
        absent = set(expected) - seen
        if absent:
            problems.append(f"{len(absent)} missing, e.g. {sorted(absent, key=repr)[0]!r}")
        report(not problems and count == len(expected), f"{label} nodes", f"{count:,} found" if not problems else fail_lines(problems))


def check_edges(session, edges_expected) -> None:
    for (src, rel, dst), expected in edges_expected.items():
        src_key, dst_key = oracle.NODES[src][1], oracle.NODES[dst][1]
        pairs = [(r["a"], r["b"]) for r in session.run(f"MATCH (a:{src})-[:{rel}]->(b:{dst}) RETURN a.{src_key} AS a, b.{dst_key} AS b")]
        problems = []
        if len(pairs) != len(set(pairs)):
            problems.append(f"{len(pairs) - len(set(pairs))} duplicated")
        got = set(pairs)
        if got - expected:
            problems.append(f"{len(got - expected)} not in the CSV, e.g. {sorted(got - expected, key=repr)[0]}")
        if expected - got:
            problems.append(f"{len(expected - got)} missing, e.g. {sorted(expected - got, key=repr)[0]}")
        report(not problems, f"({src})-[:{rel}]->({dst})", f"{len(pairs):,}" if not problems else fail_lines(problems))


def check_constraints(session) -> None:
    try:
        rows = list(session.run("SHOW CONSTRAINTS YIELD labelsOrTypes, properties, type"))
    except Exception as error:   # noqa: BLE001
        report(False, "uniqueness constraints", f"could not list them: {error}")
        return
    have = {(r["labelsOrTypes"][0], r["properties"][0]) for r in rows if "UNIQUE" in str(r["type"]).upper()}
    want = {(label, spec[1]) for label, spec in oracle.NODES.items()}
    report(want <= have, "uniqueness constraints", "" if want <= have else f"missing {sorted(want - have)}")


def parse_queries(text: str) -> list[tuple[int, str]]:
    """queries.txt as the grader reads it: blocks that begin //N. Query N, then the query."""
    parts = re.split(r"(?m)^//(\d+)\. Query \d+[ \t\r]*$", text)
    return [(int(parts[i]), parts[i + 1].strip()) for i in range(1, len(parts), 2)]


def check_queries(session, expected: dict) -> None:
    path = HERE / "queries.txt"
    raw = path.read_bytes()
    report(not raw.startswith(b"\xef\xbb\xbf"), "queries.txt is UTF-8 without a byte-order mark")
    blocks = parse_queries(raw.decode("utf-8"))
    report([n for n, _ in blocks] == [1, 2, 3, 4, 5], "queries.txt has Query 1 to Query 5, in order", f"found {[n for n, _ in blocks]}")
    for number, query in blocks:
        name = f"Q{number}"
        if name not in expected:
            continue
        begin = time.time()
        try:
            result = session.run(query)
            columns = list(result.keys())
            rows = [{k: plain(v) for k, v in r.items()} for r in result]
        except Exception as error:   # noqa: BLE001
            report(False, f"Query {number}", f"did not run: {str(error).splitlines()[0]}")
            continue
        problems = []
        if columns != oracle.COLUMNS[name]:
            problems.append(f"columns {columns}, the brief asks for {oracle.COLUMNS[name]}")
        problems += compare_rows(rows, expected[name], ordered=False)
        if not sorted_as_asked(rows, oracle.SORT[name]):
            problems.append("not sorted as the brief asks")
        report(not problems, f"Query {number} ({len(rows)} rows, {time.time() - begin:.1f} s)", fail_lines(problems))


def check_rehearsal(session, frames) -> None:
    import rehearsal

    for item in rehearsal.REHEARSALS:
        try:
            rows = [{k: plain(v) for k, v in r.items()} for r in session.run(item.cypher, **item.params)]
        except Exception as error:   # noqa: BLE001
            report(False, f"rehearsal: {item.name}", f"did not run: {str(error).splitlines()[0]}")
            continue
        problems = compare_rows(rows, item.expected(frames), ordered=item.ordered)
        report(not problems, f"rehearsal: {item.name}", item.question if not problems else fail_lines(problems))


READ_ONLY_PRODUCT = {"season_standings", "head_to_head", "driver_history", "circuit_podium_network"}


def product_blocks(text: str) -> dict[str, tuple[dict, str]]:
    """product_queries.cypher: {name: (parameters, query)}, from the '// @name:' markers and 'Parameters: {...}' comments."""
    out = {}
    for chunk in re.split(r"(?m)^// @name: ", text)[1:]:
        name, _, body = chunk.partition("\n")
        match = re.search(r"Parameters: (\{[^}]*\})", body)
        params = json.loads(re.sub(r"(\w+):", r'"\1":', match.group(1))) if match else {}
        query = "\n".join(line for line in body.splitlines() if not line.lstrip().startswith("//")).strip()
        out[name.strip()] = (params, query)
    return out


def check_product(session, expected: dict) -> None:
    blocks = product_blocks((HERE / "product_queries.cypher").read_text(encoding="utf-8"))
    for name, (params, query) in blocks.items():
        if name not in READ_ONLY_PRODUCT:
            print(f"  skip product query {name}: it writes (it adds TEAMMATE_OF relationships), so it is not run on the graded graph")
            continue
        try:
            rows = [{k: plain(v) for k, v in r.items()} for r in session.run(query, **params)]
        except Exception as error:   # noqa: BLE001
            report(False, f"product query {name}", f"did not run: {str(error).splitlines()[0]}")
            continue
        problems = []
        if not rows:
            problems.append("no rows")
        if name == "season_standings":   # the same question as Query 1
            problems += compare_rows([{k: r[k] for k in ("Driver", "Points", "Wins")} for r in rows], expected["Q1"], ordered=True)
        if name == "head_to_head":       # the same question as Query 3, for Hamilton (1) and Bottas (822)
            want = [{"Constructor": r["Constructor"], "Shared_Races": r["Shared_Races"], "A_Ahead": r["Hamilton_Ahead"], "B_Ahead": r["Bottas_Ahead"]} for r in expected["Q3"]]
            problems += compare_rows([{k: r[k] for k in ("Constructor", "Shared_Races", "A_Ahead", "B_Ahead")} for r in rows], want, ordered=False)
        report(not problems, f"product query {name} ({len(rows)} rows)", fail_lines(problems))


# ---------------------------------------------------------------------------------------------------------------


def main() -> int:
    parser = argparse.ArgumentParser(description="Verify a Milestone 2 knowledge graph.")
    parser.add_argument("--config", type=Path, default=HERE / "config.txt")
    parser.add_argument("--rebuild", action="store_true", help="run Create_kg.py first")
    parser.add_argument("--skip-rehearsal", action="store_true")
    parser.add_argument("--product", action="store_true", help="also run the read-only product queries")
    args = parser.parse_args()

    started = time.time()
    print("Reading the CSV files and working out what the graph should hold ...")
    raw = oracle.raw_tables()
    nodes_expected = oracle.expected_nodes(raw)
    edges_expected = oracle.expected_edges(raw)
    frames = oracle.frames(raw)
    answers = oracle.answers(frames)

    if args.rebuild:
        import Create_kg

        print("Running Create_kg.py ...")
        Create_kg.main(args.config)

    config = read_config(args.config)
    driver = GraphDatabase.driver(config["URI"], auth=(config["USERNAME"], config["PASSWORD"]))
    try:
        driver.verify_connectivity()
        with driver.session(database=config.get("DATABASE")) as session:
            print("\nSize")
            check_size(session, raw)
            print("\nNodes: every one, with its properties and their types")
            check_nodes(session, nodes_expected)
            print("\nRelationships: every pair")
            check_edges(session, edges_expected)
            print("\nConstraints")
            check_constraints(session)
            print("\nThe five queries of queries.txt")
            check_queries(session, answers)
            if not args.skip_rehearsal:
                print("\nRehearsal for the private queries")
                check_rehearsal(session, frames)
            if args.product:
                print("\nProduct queries (the website's)")
                check_product(session, answers)
    finally:
        driver.close()

    failed = [title for ok, title in RESULTS if not ok]
    print(f"\n{len(RESULTS) - len(failed)} of {len(RESULTS)} checks passed in {time.time() - started:.0f} s")
    if failed:
        print("FAILED: " + "; ".join(failed))
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
