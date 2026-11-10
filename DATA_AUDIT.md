# Course dataset audit

The 14 course-provided CSVs remain Paladin's reproducible source of truth. External APIs are not required by either the official or advanced research pipelines.

## Temporal classes

- **Pre-race:** identity, circuit, event date, final grid, completed qualifying, prior-race standings and strictly lagged history.
- **In-race:** lap time/position records and pit stops become available only at or after their recorded lap.
- **Outcome-only:** finishing position, points earned, completed laps, status, fastest lap and post-race standings.
- **Metadata:** names, nationality, date of birth, coordinates and URLs; temporal use depends on the derived feature.

## Table coverage

| Table | Current use | Underused but defensible | Withheld from pre-race models |
|---|---|---|---|
| `circuits` | Identity, name, country; circuit joins and maps | Coordinates, altitude and location comparisons | None, subject to historical circuit-layout caveats |
| `constructors` | Identity, name, nationality | Nationality and longitudinal team analysis | URLs |
| `constructor_results` | Relational audit and descriptive analysis | Prior reliability/results if shifted by race | Current-race points and status |
| `constructor_standings` | Prior points and rank shifted to the next race | Prior wins and championship momentum | Same-race post-event standings |
| `drivers` | Identity, DOB, age, nationality, portraits | Career phase, cohort and nationality analysis | Permanent number changes require era care |
| `driver_standings` | Prior points and rank shifted to the next race | Prior wins and championship-pressure context | Same-race post-event standings |
| `lap_times` | Replay positions, cumulative time, gaps and slow-field detection | Pace consistency, stint shapes and supported analogue features | Any lap later than the selected replay cutoff |
| `pit_stops` | Recorded stop lap and duration, replay events | Historical stop-window and duration distributions | Stops later than the replay cutoff; no tyre compound inference |
| `qualifying` | Position and best available Q1/Q2/Q3 time | Gap to field best and grid-versus-qualifying conversion | None after qualifying; session-era missingness remains explicit |
| `races` | Season, round, date, circuit and session metadata | Era/regulation segmentation and schedule context | Future calendar facts should be frozen for historical as-of research |
| `results` | Official target, cleaning grain and historical outcomes | Lagged finish quality, reliability and circuit history | Current points, finish, status, laps, time and fastest-lap fields |
| `seasons` | Primary-key audit and coverage | Era catalogue | URL |
| `sprint_results` | Audited; verified as pre-race but excluded from official features | Optional post-2021 research with an explicit sparse-era model | Never join race outcomes merely by `raceId`; sprint semantics differ |
| `status` | Status lookup and mechanical/non-start analyses | Reliability cause taxonomy with sensitivity analysis | Current-race status in pre-race prediction |

## Advanced research features

The separate `f1podium.advanced` pipeline adds 23 features to the official 16-feature table:

1. Qualifying gap to the field's best recorded qualifying time.
2. Final grid position minus qualifying position.
3. Driver prior-five normalized finish performance.
4. Constructor prior-five normalized finish performance.
5. Driver prior-ten DNF rate.
6. Constructor prior-ten DNF rate.
7. Driver's prior normalized finish history at the circuit.
8. Constructor's prior normalized finish history at the circuit.
9. Grid and qualifying percentiles normalized to field size.
10. Driver and constructor points per completed round.
11. Grid and qualifying gaps to the current teammate mean.
12. Driver and constructor prior-five grid-to-finish gain.
13. Driver and constructor prior-five finish-position volatility.
14. Prior circuit DNF rate and grid-to-finish volatility.
15. Prior circuit pit stops per driver and mean stop-lap fraction.
16. An explicit missing-history flag for circuit pit context.

Items 9–16 expand to 15 columns, for 23 additions in total. All outcome-derived features shift before rolling or expanding. Constructor outcomes are aggregated to one constructor-race row before shifting so one teammate cannot see another's current-race result. Pit history is aggregated to a race-circuit row before its expanding prior is joined, preventing a current stop from entering its own feature.

## Known data limits

- No tyre compound or tyre-set history.
- No weather observations or forecasts.
- No race-control event stream for SC/VSC/red-flag causes.
- Lap positions are end-of-lap records, not continuous GPS.
- Pit-stop files begin late in the historical period and do not encode strategy intent.
- Points systems and classification rules change across eras; normalized finish position is used where cross-era comparison is required.
- Constructor IDs do not always preserve organisational continuity through renames.
- Historical qualifying coverage and format vary substantially.
