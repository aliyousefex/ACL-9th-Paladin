# Phase 6 release-readiness report

Date: 10 November 2026

## Recommendation

**GO for public launch.** No launch-critical defect remains in the tested static application. This covers the production Vite build and Chrome device emulation described below. A physical iOS Safari and Android Chrome smoke test remains prudent, but is not claimed here.

## Genuine browser and viewport evidence

Playwright 1.65 drove locally installed stable Chrome against `vite preview` after a fresh production build. Mobile projects used Chromium mobile context emulation, device-pixel ratio 2, `isMobile: true`, `hasTouch: true`, and low-level Chromium touch events for the native range-slider drag.

| Project | Configured viewport | `innerWidth` | `clientWidth` | `visualViewport.width` | `scrollWidth` | Touch points |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| mobile-320 | 320 x 800 | 320 | 320 | 320 | 320 | 1 |
| mobile-375 | 375 x 812 | 375 | 375 | 375 | 375 | 1 |
| mobile-390 | 390 x 844 | 390 | 390 | 390 | 390 | 1 |
| tablet-768 | 768 x 1024 | 768 | 768 | 768 | 768 | 0 |
| tablet-1024 | 1024 x 768 | 1024 | 1024 | 1024 | 1024 | 0 |
| desktop-1440 | 1440 x 900 | 1440 | 1440 | 1440 | 1440 | 0 |
| desktop-1920 | 1920 x 1080 | 1920 | 1920 | 1920 | 1920 | 0 |

Measurements are preserved as `artifacts/visual-qa/playwright/*-viewport.json`. Tests also verified that mobile primary navigation remains fixed after scrolling to the bottom.

The evidence set contains full-page home images and race viewport images at all seven sizes; home, Drivers, Circuits, Model, Method, and race route images at mobile-375 and desktop-1440; plus Decision Replay images at those two widths. The HTML report is `artifacts/visual-qa/playwright-report/index.html`.

## Journeys exercised

The complete journey ran in mobile-375 and desktop-1440 production contexts: open Abu Dhabi 2024; inspect the original podium prediction; reveal the podium; enter Decision Replay; change the cutoff; select Sergio Perez; inspect cutoff-bounded forecast evolution; activate a race moment; run and compare the deterministic +5 second scenario; export JSON; copy the compact scenario URL; reload it; and continue to lap 58 after the investigated driver is retired.

That race also exercises sparse information: Perez has no recorded lap series. The UI explicitly reports the missing lap data while forecast investigation remains available and the laboratory falls back to a valid active driver. Unit coverage additionally checks a race with no usable lap trace, malformed/missing scenario fields, and all 68 races before reveal. Temporal-ledger and presenter tests prove events after a cutoff and result-dependent material cannot enter earlier states.

Touch coverage includes a native range drag using Chromium `touchStart`, `touchMove`, and `touchEnd`, a tapped timeline checkpoint, scrolling, fixed navigation, controls, export, and shared URL restoration. Keyboard coverage verifies the skip link, main-content focus, and movement into interactive controls. Interactive charts expose named image alternatives. There is no modal-dialog workflow in this journey; Presenter is a labelled fixed region and its keyboard contract is unit tested.

## Defects resolved

- Replaced cropped-desktop evidence with exact Playwright viewport assertions and durable measurements.
- Added production route, resource, runtime-error, touch, overflow, fixed-navigation, keyboard, export, and URL-reload gates.
- Preserved retired-driver investigation while guaranteeing a valid Strategy Laboratory driver.
- Verified the sparse-lap fallback in the real journey.
- Added an independent frozen-model verifier for source hashes, specification fields, UI publication fields, and calibration rows.
- Upgraded Vite from 6.4.4 to patched 6.4.6 after `npm audit` identified a development-server path-deny bypass. Production and development audits now report zero vulnerabilities.

The final Impeccable source detector returned no findings. Screenshot review found coherent hierarchy and readable wrapping, with no document-level horizontal overflow. The long race-section navigation is intentionally horizontally scrollable rather than compressed into illegible labels.

## Release engineering and performance

All primary routes (`/`, Drivers, Circuits, Model, Method, and a race) rendered without page exceptions or HTTP responses of 400 or greater in mobile and desktop production contexts. No `.env` file, credential-shaped source match, `console.log`, `console.debug`, or `debugger` statement was found in release sources.

The production build contains 275 files / 5,222,664 bytes including generated data and imagery. Largest JavaScript assets are the shared index at 485.29 kB / 141.18 kB gzip and the lazy race page at 168.93 kB / 49.63 kB gzip. Route splitting is active. The browser journey took about 5.0 seconds on local mobile emulation and 6.0 seconds on local desktop during the final run; these are regression timings, not field network benchmarks. No interaction timeout, loading failure, or runtime error occurred.

## Frozen model and coursework integrity

`scripts/verify_model_freeze.py` verified all eight recorded SHA-256 hashes, the 39-feature list, selected finish and DNF models, residual scale, exact sealed summary fields in the UI contract, and calibration rows against their CSV source. The contract explicitly says the 2022-2024 evidence is a retrospective development benchmark and not a pristine final holdout. `officialCourseworkBaselineChanged` remains false. Cross-file validation passed shared numeric tables, 14 primary-key audits, and 22 foreign-key audits. No model was retrained or altered in Phase 6.

## Final command results

| Command | Result |
| --- | --- |
| `python scripts/verify.py --full` | Passed |
| `python -m pytest` | 35 passed in 156.54 s |
| `python scripts/verify_model_freeze.py` | 8 hashes, 39 features, UI contract exact |
| `python scripts/validate_cross_file_consistency.py` | Passed; 14 PK and 22 FK audits |
| `npm test` in `ui` | 188 passed in 8.27 s |
| `npm run build` in `ui` | TypeScript passed; Vite 6.4.6 build passed in 4.26 s |
| `npm run test:e2e` in `ui` | 13 passed, 15 intentionally project-filtered, 0 failed in 1.4 min |
| `npm audit` and `npm audit --omit=dev` | 0 vulnerabilities |
| Impeccable detector over `ui/src` | 0 findings |

## Remaining non-blocking issues

- This environment did not test physical devices, iOS Safari, screen-reader speech output, or mobile browser chrome/safe-area changes. Exact Chrome mobile viewport, touch, keyboard, and rendering behavior did run.
- No throttled 3G/Core Web Vitals field study was performed. Bundle sizes and local production interactions are acceptable; real-user monitoring would strengthen launch evidence.
- Circuit-subgroup calibration remains scientifically underpowered and is not claimed. Weather, tyre, safety-car cause, and live-feed capabilities remain absent because the dataset does not support them.

Reproduce with `cd ui`, `npm ci`, and `npm run test:e2e`. Open the report with `npm run test:e2e:report`.
