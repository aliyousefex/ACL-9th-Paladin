# Phase 7 — Paladin Race Lab

## Delivered experience

Race Lab is a dedicated `#/race-lab` product route, linked from primary navigation, every historical race header, and the footer. It supports three complete modes on one engine:

- **Race Simulator:** configure a historical field and watch explicit AI strategy policies run.
- **Race Strategist:** control one driver’s pace, tyre assumption, planned stop, and immediate pit call during a running race.
- **Model Battle:** run the same field and seed through every compatible model adapter and compare winners and podiums.

The setup uses the 68 exported 2022-2024 races, their valid driver/constructor combinations, pre-race scores, versioned research distributions, and checked circuit geometry. Users can include or remove drivers, randomise or reverse the grid, select 5-60 laps, set a reproducible seed, choose a model, and choose a controlled driver. Duplicate entries are rejected and fewer than six entrants cannot start.

## Architecture

`ui/src/features/raceLab/engine.ts` is a framework-independent deterministic state machine. It owns configuration validation, model adapters, seeded variation, AI strategy defaults, tyre-age effects, pit loss, incidents, reliability, lap timing, ordering, classification, structured events, approximate in-race forecasts, model battles, and export records.

`share.ts` owns the bounded URL contract. `RaceLabPage.tsx` adapts historical data, renders setup, drives the timer, and projects the same canonical state into the circuit, timing tower, strategy console, forecasts, race control, and result classification. No visual element carries a second race state.

Every event has a lap, kind, driver reference, message, and `simulated: true`. Exported records use `paladin.race-lab.v1` and include configuration, classification, events, forecasts, and the explicit evidence label `assumption-driven simulation`.

## Model contracts

| Adapter | Gameplay input | Effect | Limitation |
| --- | --- | --- | --- |
| Grid baseline | Starting position | Grid-normalized relative pace | Transparent sporting baseline; not trained |
| Coursework logistic model | Validated pre-race podium score | Score-normalized relative pace | Classifier output is mapped into a declared game pace rule; it does not predict laps |
| Research finishing order | Expected position and DNF risk | Relative pace and reliability | Retrospective 2022-2024 research evidence; not a pristine final holdout |
| Strategy ensemble | Grid, coursework score, research order | Weighted relative pace plus research reliability | Assumption-driven game adapter; not independently validated |

The same model name never aliases the same underlying strength calculation. Unit tests verify different supported inputs produce different strengths and Model Battle produces four independent runs with common configuration and seed.

## Play and analysis

The race console supports pause/resume, 0.5×/1×/2×/4× speed, single-lap advance, restart with the same seed, driver following, live order and gaps, tyre age, retirements, structured race control, strategy changes, approximate winner forecasts, model limitations, final classification, position-versus-grid context, stops, best laps, points, JSON export, shared setup URL, model comparison, and direct return to recorded history.

The circuit uses checked Paladin layout geometry. Car positions, timing, forecast, events, and classification update only when the engine advances. Reduced-motion users receive discrete position updates without animated transitions.

## Scientific boundary

Race Lab does not claim validated vehicle physics, tyre degradation, weather modelling, safety-car causality, or counterfactual truth. Its tyre offsets, wear rates, 20.5-second pit loss, pace/risk trade-off, incidents, and in-race forecast are transparent game assumptions. Changed grids are hypothetical. Cross-era grids are not offered because the current product exports only 2022-2024 rosters and cannot normalize cars or regulations honestly.

The frozen 39-feature research model was neither retrained nor changed. The official coursework baseline remains unchanged.

## Verification evidence

- Framework-independent tests cover invalid fields, duplicate drivers, determinism, valid classification, structured pit events, strategy consequences, model differences, URL round trips, malformed URLs, and a 20-car/60-lap performance bound.
- Playwright completes the full setup-to-export journey on genuine Chrome mobile emulation at 375 CSS pixels and desktop at 1440 pixels.
- Mobile testing uses touch taps for start and pause, verifies exact viewport measurements and no global horizontal overflow, changes strategy, schedules a stop, runs at 4×, finishes, and downloads the record.
- Screenshots are stored under `artifacts/visual-qa/playwright/` as `*-race-lab-setup.png`, `*-race-lab-live.png`, and `*-race-lab-result.png`.
- The Impeccable detector reported no mechanical design findings in the changed UI.
- Independent finish review initially identified stale scroll positions between setup, live race, and results. Phase transitions now synchronously restore focus and scroll to the live command header or result winner, and mobile classification exposes a named, focusable horizontal region with visible swipe/keyboard guidance. The corrected mobile and desktop evidence received a final **ship** verdict.

Run `python scripts/verify.py --full` for the complete analytical, model-contract, TypeScript, production-build, and browser release gate.

Final result on 10 November 2026: 35 Python tests passed; all eight frozen hashes and the 39-feature contract verified; shared numeric tables, 14 primary-key audits, and 22 foreign-key audits passed; 197 UI/engine tests passed; TypeScript and Vite 6.4.6 production build passed; Playwright passed 15 tests with 20 intentional project filters and zero failures across 320, 375, 390, 768, 1024, 1440, and 1920 pixel projects. After the reviewed phase-transition and naming refinements, the unit suite and production build passed again. Race Lab's lazy production chunk is 30.16 kB (9.93 kB gzip).

## Deliberately deferred

Championship persistence, challenge objectives, cross-era driver imports, weather, safety cars, and richer compound/degradation models remain future work. They were not added as decorative or scientifically unsupported controls. The implemented Race Simulator, Strategist, and Model Battle modes are complete and share one tested engine.
