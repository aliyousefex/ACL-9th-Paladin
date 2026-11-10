# Paladin Phase 5 launch audit

Date: 10 November 2026

## Scope reviewed

The audit covered application routing and navigation, the home discovery flow, race selection and prediction workflow, circuit and driver explorers, model and method pages, the sealed-result boundary, Decision Replay, Strategy Laboratory, exports, generated data contracts, accessibility tests, responsive rules, bundle output, and advanced-model governance.

## Product findings and remediation

| Severity | Finding | Resolution |
|---|---|---|
| P1 | Strategy Laboratory could throw when the investigated driver had retired before the selected cutoff. | Scenario controls now resolve to a running fallback while preserving the retired driver’s investigation history. Regression-tested. |
| P1 | Decision Replay offered event jumps but no driver-centered view of forecast evolution. | Added a cutoff-bounded driver investigation chart and navigable forecast checkpoints connected to the same driver and lap state used by Strategy Laboratory. |
| P1 | The advanced specification lacked a sealed prospective-evaluation manifest. | Added `model-freeze.json`, source/artifact hashes, runtime versions, a change policy, and a prospective evaluation protocol. |
| P2 | Evolution history initially recomputed all checkpoints on every slider movement. | Fixed event checkpoints are memoized; only the live cutoff is recomputed. |
| P2 | Narrow layouts allowed long display headings and navigation labels to exert excessive minimum width. | Added zero-minimum grid/flex boundaries, safer heading wrapping and sizing, and bounded six-column bottom navigation. |
| P2 | Decision Replay and Strategy Laboratory used eyebrow styling despite being operational surfaces. | Replaced those labels with quiet sentence-case context text. |

## User journeys

1. **Discover a race:** the season home remains the primary entry, with a direct latest-race action, random race, model explanation, calendar, standings, and challenges.
2. **Understand the prediction:** race pages preserve the pre-race/result boundary and expose inputs, ranking, comparisons, ablation, and reveal controls in one ordered page.
3. **Investigate a turning point:** Decision Replay now combines the cutoff slider, evidence-backed moments, state ledger, estimated outcome field, driver evolution, analogues, and reliability disclosure.
4. **Branch an assumption:** the selected driver and cutoff flow into Strategy Laboratory, five common-random-number alternatives, JSON/CSV/print export, and reproducible scenario URLs.
5. **Recover from sparse state:** missing evidence remains explicit; retired drivers remain investigable, while scenario controls safely select a running driver.

## Visual QA evidence

Rendered Chromium captures were produced under `artifacts/visual-qa/` for home and race pages at requested 1440, 1920, 1024, 768, 390, 375, and 320 widths. Desktop and tablet layouts were visually inspected. The integrated browser-control host was unavailable. Headless Chrome enforces a minimum CSS layout viewport for the smallest raw window sizes, so the 320–390 captures are cropped and are **not** claimed as true phone emulation. Phone behavior is supported by source-level breakpoint review and automated accessibility/responsive contracts, but physical-device or CDP device-emulation QA remains a launch requirement.

## Research integrity preserved

- Official coursework artifacts remain unchanged.
- The 39-feature advanced specification is frozen rather than retuned.
- The 2022–2024 period remains labeled a retrospective benchmark.
- Prospective predictions must be sealed before outcomes are joined.
- Recorded, derived, estimated, and simulated information remain visibly distinct.
- Tyre, weather, traffic, damage, and safety-car behavior are not presented as learned when the data cannot support them.

## Launch verdict

Paladin is ready for academic evaluation and external technical review. It is functionally near-ready for public launch. The remaining release condition is a real mobile interaction pass at 320–390 CSS pixels with touch and keyboard coverage; raw headless window screenshots are insufficient evidence for that final claim.
