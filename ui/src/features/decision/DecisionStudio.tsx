import { useMemo, useState } from "react";
import type { AdvancedRace, RaceDetail, RaceMeta } from "../../lib/data";
import { formatGap } from "../race/lapTrace";
import type { Row } from "../race/rows";
import { comparePitLoss, forecast, resolveScenarioDriverId } from "./forecast";
import { buildLedger, stateAt } from "./ledger";
import { detectMoments } from "./moments";
import { historicalAnalogues } from "./analogues";
import advancedSummary from "../../data/advanced-summary.json";
import { raceHref, raceMeta } from "../../lib/data";
import { href } from "../../lib/router";
import { parseSharedDecision, sharedDecisionHash } from "./share";
import { forecastEvolution } from "./evolution";
import type { RaceEvent } from "./schema";

const pct = (value: number) => `${Math.round(value * 100)}%`;

function eventLabel(event: RaceEvent, names: Map<number, string>): string {
  const name = event.driverId === null ? "Field" : names.get(event.driverId) ?? `Driver ${event.driverId}`;
  if (event.type === "pit") return `${name} stopped`;
  if (event.type === "lead-change") return `${name} took the recorded lead`;
  if (event.type === "slow-field") return "Field pace slowed";
  if (event.type === "start") return "Lights out";
  const payload = event.payload as { from?: number | null; to?: number | null };
  return `${name}: P${payload.from ?? "pit"} → P${payload.to ?? "—"}`;
}

export function DecisionStudio({ race, detail, rows, advanced }: { race: RaceMeta; detail: RaceDetail; rows: Row[]; advanced: AdvancedRace | null }) {
  const ledger = useMemo(() => buildLedger(race.id, detail, rows), [race.id, detail, rows]);
  const shared = typeof window === "undefined" ? null : parseSharedDecision(window.location.hash);
  const [lap, setLap] = useState(() => Math.min(shared?.lap ?? 0, ledger.trace.totalLaps));
  const [driverId, setDriverId] = useState(() => rows.some((row) => row.driver.id === shared?.driverId) ? shared!.driverId : rows[0]?.driver.id ?? 0);
  const [seconds, setSeconds] = useState(shared?.seconds ?? 5);
  const [exported, setExported] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);
  const state = useMemo(() => stateAt(ledger, lap), [ledger, lap]);
  const prediction = useMemo(() => forecast(rows, state), [rows, state]);
  const scenarioDriverId = resolveScenarioDriverId(state, driverId) ?? driverId;
  const scenario = useMemo(() => comparePitLoss(rows, state, scenarioDriverId, seconds), [rows, state, scenarioDriverId, seconds]);
  const scenarioSet = useMemo(() => [-5, 0, 3, 5, 8].map((assumption) => comparePitLoss(rows, state, scenarioDriverId, assumption, 903, 1200)), [rows, state, scenarioDriverId]);
  const names = useMemo(() => new Map(rows.map((row) => [row.driver.id, row.driver.last])), [rows]);
  const moments = useMemo(() => detectMoments(ledger, rows), [ledger, rows]);
  const evolutionCheckpoints = useMemo(() => forecastEvolution(ledger, rows, driverId, [0, ...moments.map((moment) => moment.lap)]), [ledger, rows, driverId, moments]);
  const evolution = useMemo(() => {
    const visible = evolutionCheckpoints.filter((item) => item.lap <= lap);
    return visible.some((item) => item.lap === lap) ? visible : [...visible, ...forecastEvolution(ledger, rows, driverId, [lap])].sort((a, b) => a.lap - b.lap);
  }, [evolutionCheckpoints, ledger, rows, driverId, lap]);
  const evolutionLine = evolution.map((item) => `${20 + (item.lap / Math.max(1, ledger.trace.totalLaps)) * 560},${160 - item.podium * 130}`).join(" ");
  const analogues = useMemo(() => historicalAnalogues(race.id), [race.id]);
  const visibleEvents = state.events.filter((event) => event.type !== "position");
  const recent = visibleEvents.slice(-6).reverse();
  const trained = useMemo(() => advanced?.drivers.slice().sort((a, b) => a.e - b.e || a.d - b.d), [advanced]);
  const top = lap === 0 && trained ? trained.slice(0, 6).map((item) => ({ driverId: item.d, win: item.w, podium: item.p, expectedPosition: item.e, expectedPoints: item.x, positions: item.o })) : prediction.drivers.slice(0, 6);
  const investigated = rows.find((row) => row.driver.id === driverId)!;
  const chosen = rows.find((row) => row.driver.id === scenarioDriverId)!;
  const chosenState = state.drivers.find((driver) => driver.driverId === scenarioDriverId);

  const exportAnalysis = () => {
    const artifact = {
      title: `${race.name} ${race.year} — lap ${lap} decision analysis`,
      generatedBy: "Paladin Decision Intelligence",
      schema: state.schema,
      race: { id: race.id, name: race.name, year: race.year, round: race.round },
      cutoff: { lap, rule: "Only events whose availableLap is at or before the cutoff are included." },
      state,
      forecast: prediction,
      scenario,
      limitations: ["Historical classification is intentionally excluded from this artifact.", ...prediction.assumptions, ...scenario.assumptions],
    };
    const blob = new Blob([JSON.stringify(artifact, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `paladin-${race.year}-${race.slug}-lap-${lap}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
    setExported(true);
    window.setTimeout(() => setExported(false), 1800);
  };

  const exportCsv = () => {
    const header = "driver_id,driver,win_share,podium_share,expected_position,expected_points,cutoff_lap,model\n";
    const body = prediction.drivers.map((item) => [item.driverId, JSON.stringify(names.get(item.driverId) ?? ""), item.win, item.podium, item.expectedPosition, item.expectedPoints, lap, prediction.model].join(",")).join("\n");
    const url = URL.createObjectURL(new Blob([header + body + "\n"], { type: "text/csv" }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `paladin-${race.year}-${race.slug}-lap-${lap}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const copyScenario = async () => {
    const url = `${window.location.origin}${window.location.pathname}${sharedDecisionHash(raceHref(race), { lap, driverId: scenarioDriverId, seconds })}`;
    try { await navigator.clipboard.writeText(url); } catch { window.prompt("Copy this reproducible scenario", url); }
    setLinkCopied(true);
    window.setTimeout(() => setLinkCopied(false), 1600);
  };

  return (
    <section className="decision-workspace" aria-labelledby="decision-title">
      <header className="decision-head">
        <div>
          <p className="decision-context">Decision Replay · historical record + bounded estimate</p>
          <h2 id="decision-title" className="display mt-2 text-[2.3rem] text-ink sm:text-[3.4rem]">Inspect the race as it was known</h2>
          <p className="mt-3 max-w-[72ch] text-steel">Move the cutoff. Recorded events stop at that lap; the ranking distribution is recomputed from the pre-race model and the running order visible then.</p>
        </div>
        <div className="flex flex-wrap gap-2 print:hidden">
          <button type="button" className="btn btn-ghost" onClick={exportAnalysis} aria-live="polite">{exported ? "JSON exported" : "Export JSON"}</button>
          <button type="button" className="btn btn-ghost" onClick={exportCsv}>Export CSV</button>
          <button type="button" className="btn btn-ghost" onClick={copyScenario}>{linkCopied ? "Scenario link copied" : "Copy scenario link"}</button>
          <button type="button" className="btn btn-ghost" onClick={() => window.print()}>Print summary</button>
        </div>
      </header>

      <div className="decision-cutoff">
        <div className="flex items-baseline justify-between gap-4">
          <label htmlFor="decision-lap" className="label">Information cutoff</label>
          <output htmlFor="decision-lap" className="figure text-[2rem] text-ink">{lap === 0 ? "Grid" : `Lap ${lap}`}</output>
        </div>
        <input id="decision-lap" className="decision-range" type="range" min={0} max={ledger.trace.totalLaps} value={lap} onChange={(event) => setLap(Number(event.target.value))} />
        <div className="mt-2 flex justify-between text-[0.76rem] text-mute"><span>Pre-race</span><span>Recorded lap {ledger.trace.totalLaps}</span></div>
        <div className="decision-moments" aria-label="Highest-signal recorded moments">
          {moments.map((moment) => <button type="button" key={`${moment.lap}:${moment.kind}`} className="chip" aria-current={lap === moment.lap} onClick={() => setLap(moment.lap)}><span>L{moment.lap}</span> {moment.headline}{moment.driverId ? ` · ${names.get(moment.driverId)}` : ""}</button>)}
        </div>
      </div>

      <div className="decision-grid">
        <section className="decision-pane" aria-labelledby="state-title">
          <div className="decision-pane-head"><h3 id="state-title" className="display text-[1.45rem]">State ledger</h3><span className="tag tag-record">Recorded to lap {lap}</span></div>
          <ol className="decision-events">
            {recent.length ? recent.map((event) => (
              <li key={event.id}>
                <span className="figure text-steel">L{event.lap}</span>
                <span>{eventLabel(event, names)}</span>
                <span className={`tag ${event.provenance.kind === "derived" ? "tag-illus" : "tag-record"}`}>{event.provenance.kind}</span>
              </li>
            )) : <li className="text-mute">No recorded event is available before this cutoff.</li>}
          </ol>
          <p className="decision-note">Future events are removed by the ledger query, not hidden with CSS. Lap time does not reveal cause.</p>
        </section>

        <section className="decision-pane" aria-labelledby="forecast-title">
          <div className="decision-pane-head"><h3 id="forecast-title" className="display text-[1.45rem]">Outcome field</h3><span className="tag tag-model">{lap === 0 && trained ? `Trained · ${advanced?.finishModel}` : `State update · ${prediction.samples.toLocaleString()} draws`}</span></div>
          <div className="decision-forecast" role="table" aria-label={`Estimated outcome distribution at lap ${lap}`}>
            <div role="row" className="decision-row decision-row-head"><span role="columnheader">Driver</span><span role="columnheader">Win</span><span role="columnheader">Podium</span><span role="columnheader">Expected</span></div>
            {top.map((item) => (
              <div role="row" className="decision-row" key={item.driverId}>
                <span role="cell" className="font-semibold text-ink">{names.get(item.driverId)}</span>
                <span role="cell" className="figure">{pct(item.win)}</span>
                <span role="cell" className="figure text-signal">{pct(item.podium)}</span>
                <span role="cell" className="figure">P{item.expectedPosition.toFixed(1)}</span>
              </div>
            ))}
          </div>
          <p className="decision-note">{lap === 0 && trained ? "Chronologically evaluated Python model with validation-residual joint order sampling. Retrospective research benchmark, separate from the official coursework classifier." : "Approximate state update from the trained pre-race evidence and recorded running order. It is not calibrated for live-race use."}</p>
        </section>
      </div>

      <section className="decision-evolution" aria-labelledby="evolution-title">
        <div className="decision-evolution-head">
          <div><h3 id="evolution-title" className="display text-[1.45rem]">Follow one driver through the evidence</h3><p className="mt-2 text-[0.82rem] text-mute">Estimated podium share at event cutoffs up to the selected lap. Each point uses only state available there.</p></div>
          <label><span className="label">Investigate driver</span><select className="select mt-2" value={driverId} onChange={(event) => setDriverId(Number(event.target.value))}>{rows.map((row) => <option key={row.driver.id} value={row.driver.id}>{row.driver.name}</option>)}</select></label>
        </div>
        <svg className="decision-evolution-chart" viewBox="0 0 600 180" role="img" aria-labelledby="evolution-chart-title evolution-chart-desc">
          <title id="evolution-chart-title">{investigated.driver.name} estimated podium-share evolution</title>
          <desc id="evolution-chart-desc">From {pct(evolution[0]?.podium ?? 0)} before the race to {pct(evolution.at(-1)?.podium ?? 0)} at lap {lap}.</desc>
          <path d="M20 30H580 M20 95H580 M20 160H580" className="decision-evolution-grid" />
          <polyline points={evolutionLine} className="decision-evolution-line" />
          {evolution.map((item) => <circle key={item.lap} cx={20 + (item.lap / Math.max(1, ledger.trace.totalLaps)) * 560} cy={160 - item.podium * 130} r="4" className="decision-evolution-point" />)}
        </svg>
        <div className="decision-evolution-stops" aria-label="Forecast checkpoints">
          {evolution.map((item) => <button type="button" key={item.lap} onClick={() => setLap(item.lap)} aria-current={lap === item.lap}><span>{item.lap === 0 ? "Grid" : `L${item.lap}`}</span><strong>{item.running ? pct(item.podium) : "Out"}</strong><small>{item.expectedPosition === null ? "not running" : `expected P${item.expectedPosition.toFixed(1)}`}</small></button>)}
        </div>
      </section>

      <div className="decision-intelligence-strip">
        <section aria-labelledby="analogue-title">
          <h3 id="analogue-title" className="display text-[1.35rem]">Comparable pre-race fields</h3>
          <p className="mt-1 text-[0.8rem] text-mute">Nearest benchmark races by pre-race distribution shape; no result or future lap is used.</p>
          <div className="mt-3 grid gap-2">
            {analogues.map((item) => { const other = raceMeta(item.raceId)!; return <a className="decision-analogue" href={href(raceHref(other))} key={item.raceId}><span><strong>{other.name.replace(" Grand Prix", "")}</strong> {other.year}</span><span>{item.reasons.join(" · ")}</span></a>; })}
          </div>
        </section>
        <section aria-labelledby="reliability-title">
          <h3 id="reliability-title" className="display text-[1.35rem]">Research benchmark, with uncertainty</h3>
          <div className="decision-reliability">
            <div><span>Benchmark podium Brier</span><strong>{advancedSummary.test.podiumBrier.toFixed(3)}</strong></div>
            <div><span>Calibration gap</span><strong>{Math.round(advancedSummary.testCalibrationError * 1000) / 10}%</strong></div>
            <div><span>Expected-position MAE</span><strong>{advancedSummary.test.expectedPositionMAE.toFixed(2)}</strong></div>
          </div>
          <p className="decision-note">68 races, 2022–2024. Race-bootstrap Brier improvement versus grid: {advancedSummary.raceBootstrap.podiumBrierImprovement.estimate.toFixed(3)} (95% {advancedSummary.raceBootstrap.podiumBrierImprovement.lower95.toFixed(3)}–{advancedSummary.raceBootstrap.podiumBrierImprovement.upper95.toFixed(3)}). This period has been inspected during development, so it is not a pristine final holdout.</p>
        </section>
      </div>

      <section className="decision-lab" aria-labelledby="lab-title">
        <div className="decision-pane-head">
          <div><p className="decision-context">Strategy laboratory</p><h3 id="lab-title" className="display mt-1 text-[1.8rem]">Stress-test an assumed time loss</h3></div>
          <span className="tag tag-illus">Assumption-driven simulation</span>
        </div>
        <div className="decision-lab-grid">
          <div className="space-y-4">
            <label className="block"><span className="label">Driver</span><select className="select mt-2 w-full" value={scenarioDriverId} onChange={(event) => setDriverId(Number(event.target.value))}>{state.drivers.filter((driver) => driver.running).map((driver) => <option key={driver.driverId} value={driver.driverId}>{names.get(driver.driverId)}</option>)}</select></label>
            <fieldset><legend className="label">Assumed additional loss</legend><div className="mt-2 flex flex-wrap gap-2">{[-5, 0, 3, 5, 8].map((value) => <button type="button" key={value} className="chip" aria-current={seconds === value} onClick={() => setSeconds(value)}>{value > 0 ? "+" : ""}{value}s</button>)}</div></fieldset>
            <p className="text-[0.85rem] text-mute">Current recorded state: {chosenState?.position ? `P${chosenState.position}` : "not running"}{chosenState?.gapSeconds !== null && chosenState?.gapSeconds !== undefined ? ` · ${formatGap(chosenState.gapSeconds)}` : ""} · {chosenState?.stops ?? 0} stops.</p>
          </div>
          <div className="decision-delta">
            <p className="label">{chosen.driver.name}</p>
            <div><span>Expected finish</span><strong>P{scenario.reference.expectedPosition.toFixed(1)}</strong><span aria-hidden>→</span><strong>P{scenario.alternative.expectedPosition.toFixed(1)}</strong></div>
            <div><span>Podium share</span><strong>{pct(scenario.reference.podium)}</strong><span aria-hidden>→</span><strong>{pct(scenario.alternative.podium)}</strong></div>
            <div><span>Expected points</span><strong>{scenario.reference.expectedPoints.toFixed(1)}</strong><span aria-hidden>→</span><strong>{scenario.alternative.expectedPoints.toFixed(1)}</strong></div>
          </div>
          <div className="decision-scenario-set">
            <p className="label">Robustness envelope</p>
            <div className="mt-2" role="table" aria-label="Five time-loss assumptions compared with common random numbers">
              {scenarioSet.map((item) => <button type="button" role="row" key={item.assumedSeconds} aria-current={seconds === item.assumedSeconds} onClick={() => setSeconds(item.assumedSeconds)}><span role="cell">{item.assumedSeconds > 0 ? "+" : ""}{item.assumedSeconds}s</span><span role="cell">P{item.alternative.expectedPosition.toFixed(1)}</span><span role="cell">{pct(item.alternative.podium)}</span><span role="cell">{item.alternative.expectedPoints.toFixed(1)} pts</span></button>)}
            </div>
          </div>
          <div className="decision-assumptions"><p className="label">Boundaries</p><ul>{scenario.assumptions.map((line) => <li key={line}>{line}</li>)}</ul></div>
        </div>
      </section>
    </section>
  );
}
