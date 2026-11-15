// Product queries for the Paladin website (Milestone 2 knowledge graph).
//
// Each block answers one question on the website's History page, with parameters ($name) instead of the
// hard-coded ids used in queries.txt. They are written against the schema built by Create_kg.py:
//
//   (Result)-[:BY_DRIVER]->(Driver)   (Result)-[:FOR_RACE]->(Race)   (Result)-[:FOR_CONSTRUCTOR]->(Constructor)
//   (Result)-[:HAS_STATUS]->(Status)  (Race)-[:AT_CIRCUIT]->(Circuit) (Race)-[:IN_SEASON]->(Season)
//
// The website is static, so it answers these questions from scripts/export_graph_data.py, which reads the same
// CSV files and applies the same rules:
//   * a driver's finish in a race is the best positionOrder among their Results there (a shared drive can give
//     a driver two); a podium is a finish of 3 or better, a win is position = 1, each counted in races;
//   * two drivers are teammates when each has a Result in the same Race for the same Constructor;
//   * points are race-result points only (the graph does not load sprint_results.csv).
//
// STATUS: these queries were NOT executed against a live Neo4j instance when they were written. The exported
// answers are checked against independent recomputation from the CSVs (tests/test_graph_export.py); the Cypher
// itself should be run against your database before it is relied on.
//
// Blocks start with a "// @name:" marker; the exporter embeds them so the website shows exactly this text.

// @name: season_standings
// Driver championship for any season (queries.txt Query 1, with the year as a parameter).
// Parameters: { year: 2021 }
MATCH (d:Driver)<-[:BY_DRIVER]-(res:Result)-[:FOR_RACE]->(r:Race)-[:IN_SEASON]->(:Season {year: $year})
WITH d, r, sum(res.points) AS points, max(CASE WHEN res.position = 1 THEN 1 ELSE 0 END) AS won
WITH d, sum(points) AS Points, sum(won) AS Wins
RETURN d.forename + ' ' + d.surname AS Driver, Points, Wins
ORDER BY Points DESC, Wins DESC, Driver ASC

// @name: head_to_head
// How two drivers compared in the races they shared a constructor (queries.txt Query 3, for any pair).
// Parameters: { driverA: 1, driverB: 822 }
MATCH (a:Driver {driverId: $driverA})<-[:BY_DRIVER]-(ra:Result)-[:FOR_RACE]->(r:Race)<-[:FOR_RACE]-(rb:Result)-[:BY_DRIVER]->(b:Driver {driverId: $driverB}),
      (ra)-[:FOR_CONSTRUCTOR]->(c:Constructor)<-[:FOR_CONSTRUCTOR]-(rb)
WITH c, r, min(ra.positionOrder) AS aFinish, min(rb.positionOrder) AS bFinish
RETURN c.constructor_name AS Constructor,
       count(r) AS Shared_Races,
       sum(CASE WHEN aFinish < bFinish THEN 1 ELSE 0 END) AS A_Ahead,
       sum(CASE WHEN bFinish < aFinish THEN 1 ELSE 0 END) AS B_Ahead,
       min(r.year) AS First_Year,
       max(r.year) AS Last_Year
ORDER BY Shared_Races DESC, Constructor ASC

// @name: driver_history
// A driver's seasons: which constructor, how many races, podiums, wins and race-result points.
// Parameters: { driverId: 1 }
MATCH (d:Driver {driverId: $driverId})<-[:BY_DRIVER]-(res:Result)-[:FOR_RACE]->(r:Race),
      (res)-[:FOR_CONSTRUCTOR]->(c:Constructor)
WITH r.year AS Year, c, r, min(res.positionOrder) AS finish, sum(res.points) AS points, max(CASE WHEN res.position = 1 THEN 1 ELSE 0 END) AS won
RETURN Year,
       c.constructor_name AS Constructor,
       count(r) AS Races,
       sum(CASE WHEN finish <= 3 THEN 1 ELSE 0 END) AS Podiums,
       sum(won) AS Wins,
       sum(points) AS Points
ORDER BY Year ASC, Constructor ASC

// @name: materialise_teammates
// One-off step: turn "shared a constructor in a race" into a TEAMMATE_OF relationship, so path queries are short.
// This is NOT part of Create_kg.py. Run it once after the import; it is safe to run again (MERGE).
MATCH (a:Driver)<-[:BY_DRIVER]-(ra:Result)-[:FOR_RACE]->(r:Race)<-[:FOR_RACE]-(rb:Result)-[:BY_DRIVER]->(b:Driver),
      (ra)-[:FOR_CONSTRUCTOR]->(c:Constructor)<-[:FOR_CONSTRUCTOR]-(rb)
WHERE a.driverId < b.driverId
WITH a, b, c, r, min(ra.positionOrder) AS aFinish, min(rb.positionOrder) AS bFinish
WITH a, b, c,
     count(r) AS shared,
     sum(CASE WHEN aFinish < bFinish THEN 1 ELSE 0 END) AS aAhead,
     sum(CASE WHEN bFinish < aFinish THEN 1 ELSE 0 END) AS bAhead,
     min(r.year) AS firstYear,
     max(r.year) AS lastYear
MERGE (a)-[t:TEAMMATE_OF {constructorId: c.constructorId}]->(b)
SET t.sharedRaces = shared, t.aAhead = aAhead, t.bAhead = bAhead, t.firstYear = firstYear, t.lastYear = lastYear

// @name: teammate_path
// The shortest chain of teammates between two drivers ("How are these two connected?").
// Requires the materialise_teammates step above. Parameters: { driverA: 1, driverB: 830 }
MATCH p = shortestPath((a:Driver {driverId: $driverA})-[:TEAMMATE_OF*..12]-(b:Driver {driverId: $driverB}))
RETURN [n IN nodes(p) | n.forename + ' ' + n.surname] AS Chain,
       [t IN relationships(p) | {constructorId: t.constructorId, sharedRaces: t.sharedRaces, firstYear: t.firstYear, lastYear: t.lastYear}] AS Links,
       length(p) AS Links_In_Chain

// @name: circuit_podium_network
// Which constructors have had several different drivers on the podium at a circuit.
// Parameters: { circuitId: 6, minDrivers: 3 }
MATCH (:Circuit {circuitId: $circuitId})<-[:AT_CIRCUIT]-(r:Race)<-[:FOR_RACE]-(res:Result)-[:BY_DRIVER]->(d:Driver),
      (res)-[:FOR_CONSTRUCTOR]->(c:Constructor)
WITH c, d, r, min(res.positionOrder) AS finish
WHERE finish <= 3
WITH c, d, count(r) AS podiums
WITH c, count(d) AS Distinct_Drivers, sum(podiums) AS Podiums,
     collect(d.forename + ' ' + d.surname + ' (' + toString(podiums) + ')') AS Drivers
WHERE Distinct_Drivers >= $minDrivers
RETURN c.constructor_name AS Constructor, Distinct_Drivers, Podiums, Drivers
ORDER BY Distinct_Drivers DESC, Podiums DESC, Constructor ASC
