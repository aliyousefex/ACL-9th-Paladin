from pathlib import Path
from neo4j import GraphDatabase
from datetime import date
import pandas as pd

HERE = Path(__file__).parent   # the folder this script is in (CSVs and config.txt are here)


# ---------- 1. Config ----------

def read_config(path):
    """Read config.txt as KEY=VALUE lines, by key, not by line number."""
    config = {}
    for line in path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or "=" not in line:
            continue                          # skip empty or broken lines
        key, value = line.split("=", 1)       # split only at the FIRST "="
        config[key.strip().upper()] = value.strip()
    return config


# ---------- 2. Helpers: reading CSVs, types, missing values ----------

def load_csv(name):
    """Read a CSV as text. \\N and empty cells become missing (NaN)."""
    return pd.read_csv(HERE / f"{name}.csv", dtype=str,
                       keep_default_na=False, na_values=["\\N", ""])


def is_missing(value):
    return value is None or pd.isna(value)


def to_int(value):
    return None if is_missing(value) else int(float(value))


def to_float(value):
    return None if is_missing(value) else float(value)


def to_str(value):
    return None if is_missing(value) else str(value)


def to_date(value):
    """'1985-01-07' -> a Python date, which the driver stores as a Neo4j date."""
    return None if is_missing(value) else date.fromisoformat(value)


def props(**fields):
    """Keep only the properties that have a value, so missing ones are omitted."""
    return {key: value for key, value in fields.items() if value is not None}


# ---------- 3. Constraints ----------

CONSTRAINTS = [
    ("Driver", "driverId"),
    ("Constructor", "constructorId"),
    ("Circuit", "circuitId"),
    ("Season", "year"),
    ("Status", "statusId"),
    ("Race", "raceId"),
    ("Result", "resultId"),        # for Person B
    ("Qualifying", "qualifyId"),   # for Person C
    ("PitStop", "eventId"),        # for Person C
]


def create_constraints(session):
    """One uniqueness constraint per node label, so MERGE never creates duplicates."""
    for label, key in CONSTRAINTS:
        session.run(
            f"CREATE CONSTRAINT {label.lower()}_{key}_unique IF NOT EXISTS "
            f"FOR (n:{label}) REQUIRE n.{key} IS UNIQUE"
        )
    print(f"Constraints ready: {len(CONSTRAINTS)}")


# ---------- 4. Loading helpers ----------

BATCH = 1000   # send 1000 rows per query, which is much faster than one query per row


def run_batches(session, query, rows):
    """Run the same Cypher query on the rows, 1000 at a time."""
    for start in range(0, len(rows), BATCH):
        session.run(query, rows=rows[start:start + BATCH])


def merge_nodes(session, label, key, rows):
    """Create (or update) one node per row, matched by its unique key."""
    query = f"UNWIND $rows AS row MERGE (n:{label} {{{key}: row.{key}}}) SET n += row"
    run_batches(session, query, rows)
    print(f"{label}: {len(rows)} nodes")


# ---------- 5. Entity nodes ----------

def create_seasons(session):
    rows = [props(year=to_int(r.year)) for r in load_csv("seasons").itertuples()]
    merge_nodes(session, "Season", "year", rows)


def create_statuses(session):
    rows = [props(statusId=to_int(r.statusId), status=to_str(r.status))
            for r in load_csv("status").itertuples()]
    merge_nodes(session, "Status", "statusId", rows)


def create_circuits(session):
    rows = [props(circuitId=to_int(r.circuitId), circuitRef=to_str(r.circuitRef),
                  circuit_name=to_str(r.name), circuit_loc=to_str(r.location),
                  circuit_country=to_str(r.country), lat=to_float(r.lat),
                  lng=to_float(r.lng), alt=to_int(r.alt))
            for r in load_csv("circuits").itertuples()]
    merge_nodes(session, "Circuit", "circuitId", rows)


def create_drivers(session):
    rows = [props(driverId=to_int(r.driverId), driverRef=to_str(r.driverRef),
                  number=to_int(r.number), code=to_str(r.code),
                  forename=to_str(r.forename), surname=to_str(r.surname),
                  dob=to_date(r.dob), nationality=to_str(r.nationality))
            for r in load_csv("drivers").itertuples()]
    merge_nodes(session, "Driver", "driverId", rows)


def create_constructors(session):
    rows = [props(constructorId=to_int(r.constructorId),
                  constructorRef=to_str(r.constructorRef),
                  constructor_name=to_str(r.name),
                  constructor_nationality=to_str(r.nationality))
            for r in load_csv("constructors").itertuples()]
    merge_nodes(session, "Constructor", "constructorId", rows)


def create_races(session):
    """Race nodes + AT_CIRCUIT and IN_SEASON (needs Circuit and Season first)."""
    race_csv = load_csv("races")
    rows = [props(raceId=to_int(r.raceId), year=to_int(r.year), round=to_int(r.round),
                  name=to_str(r.name), date=to_date(r.date), time=to_str(r.time))
            for r in race_csv.itertuples()]
    merge_nodes(session, "Race", "raceId", rows)

    # Relationships: kept separate so circuitId is NOT stored as an extra Race property.
    links = [{"raceId": to_int(r.raceId), "circuitId": to_int(r.circuitId),
              "year": to_int(r.year)} for r in race_csv.itertuples()]
    run_batches(session, """
        UNWIND $rows AS row
        MATCH (r:Race {raceId: row.raceId})
        MATCH (c:Circuit {circuitId: row.circuitId})
        MATCH (s:Season {year: row.year})
        MERGE (r)-[:AT_CIRCUIT]->(c)
        MERGE (r)-[:IN_SEASON]->(s)
    """, links)
    print(f"AT_CIRCUIT and IN_SEASON: {len(links)} races linked")

# ---------- 6. Person B: results (placeholder) ----------

def create_results(session):
    """Result nodes + FOR_RACE, BY_DRIVER, FOR_CONSTRUCTOR, HAS_STATUS
    (needs Race, Driver, Constructor and Status first)."""
    result_csv = load_csv("results")
    rows = [props(resultId=to_int(r.resultId), number=to_int(r.number),
                  grid=to_int(r.grid), position=to_int(r.position),
                  positionText=to_str(r.positionText),
                  positionOrder=to_int(r.positionOrder), points=to_float(r.points),
                  laps=to_int(r.laps), time=to_str(r.time),
                  milliseconds=to_int(r.milliseconds), fastestLap=to_int(r.fastestLap),
                  rank=to_int(r.rank), fastestLapTime=to_str(r.fastestLapTime),
                  fastestLapSpeed=to_float(r.fastestLapSpeed))
            for r in result_csv.itertuples()]
    merge_nodes(session, "Result", "resultId", rows)

    # Relationships: the foreign keys are used only for linking, not stored on Result.
    links = [{"resultId": to_int(r.resultId), "raceId": to_int(r.raceId),
              "driverId": to_int(r.driverId), "constructorId": to_int(r.constructorId),
              "statusId": to_int(r.statusId)} for r in result_csv.itertuples()]
    run_batches(session, """
        UNWIND $rows AS row
        MATCH (res:Result {resultId: row.resultId})
        MATCH (r:Race {raceId: row.raceId})
        MATCH (d:Driver {driverId: row.driverId})
        MATCH (c:Constructor {constructorId: row.constructorId})
        MATCH (s:Status {statusId: row.statusId})
        MERGE (res)-[:FOR_RACE]->(r)
        MERGE (res)-[:BY_DRIVER]->(d)
        MERGE (res)-[:FOR_CONSTRUCTOR]->(c)
        MERGE (res)-[:HAS_STATUS]->(s)
    """, links)
    print(f"FOR_RACE, BY_DRIVER, FOR_CONSTRUCTOR and HAS_STATUS: {len(links)} results linked")

# ---------- 7. Person C: qualifying and pit stops (placeholders) ----------

def create_qualifying(session):
    """Person C: Qualifying nodes + FOR_RACE, BY_DRIVER, FOR_CONSTRUCTOR."""
    qualifying_csv = load_csv("qualifying")
    rows = [props(qualifyId=to_int(r.qualifyId), number=to_int(r.number),
                  position=to_int(r.position), q1=to_str(r.q1),
                  q2=to_str(r.q2), q3=to_str(r.q3))
            for r in qualifying_csv.itertuples()]
    merge_nodes(session, "Qualifying", "qualifyId", rows)

    # The foreign keys are used only to create the required graph links.
    links = [{"qualifyId": to_int(r.qualifyId), "raceId": to_int(r.raceId),
              "driverId": to_int(r.driverId),
              "constructorId": to_int(r.constructorId)}
             for r in qualifying_csv.itertuples()]
    run_batches(session, """
        UNWIND $rows AS row
        MATCH (q:Qualifying {qualifyId: row.qualifyId})
        MATCH (r:Race {raceId: row.raceId})
        MATCH (d:Driver {driverId: row.driverId})
        MATCH (c:Constructor {constructorId: row.constructorId})
        MERGE (q)-[:FOR_RACE]->(r)
        MERGE (q)-[:BY_DRIVER]->(d)
        MERGE (q)-[:FOR_CONSTRUCTOR]->(c)
    """, links)
    print(f"FOR_RACE, BY_DRIVER and FOR_CONSTRUCTOR: {len(links)} qualifying rows linked")


def create_pitstops(session):
    """Person C: PitStop nodes (eventId = raceId:driverId:stop) + FOR_RACE, BY_DRIVER."""
    pit_stop_csv = load_csv("pit_stops")
    records = []
    links = []
    for row in pit_stop_csv.itertuples():
        race_id = to_int(row.raceId)
        driver_id = to_int(row.driverId)
        stop = to_int(row.stop)
        event_id = f"{race_id}:{driver_id}:{stop}"
        records.append(props(eventId=event_id, stop=stop, lap=to_int(row.lap),
                             time=to_str(row.time), duration=to_str(row.duration),
                             milliseconds=to_int(row.milliseconds)))
        links.append({"eventId": event_id, "raceId": race_id,
                      "driverId": driver_id})

    merge_nodes(session, "PitStop", "eventId", records)
    run_batches(session, """
        UNWIND $rows AS row
        MATCH (p:PitStop {eventId: row.eventId})
        MATCH (r:Race {raceId: row.raceId})
        MATCH (d:Driver {driverId: row.driverId})
        MERGE (p)-[:FOR_RACE]->(r)
        MERGE (p)-[:BY_DRIVER]->(d)
    """, links)
    print(f"FOR_RACE and BY_DRIVER: {len(links)} pit stops linked")


# ---------- 8. Run everything in order ----------

def main():
    config = read_config(HERE / "config.txt")
    driver = GraphDatabase.driver(config["URI"], auth=(config["USERNAME"], config["PASSWORD"]))
    try:
        driver.verify_connectivity()          # fails here if the URI or password is wrong
        print("Connected to Neo4j")
        with driver.session() as session:     # no database name: the default one is used
            create_constraints(session)
            # Entity nodes first: fact nodes link to them.
            create_seasons(session)
            create_statuses(session)
            create_circuits(session)
            create_drivers(session)
            create_constructors(session)
            create_races(session)
            # Fact nodes.
            create_results(session)         # Person B
            create_qualifying(session)      # Person C
            create_pitstops(session)        # Person C
    finally:
        driver.close()                        # always close the connection at the end


if __name__ == "__main__":
    main()
