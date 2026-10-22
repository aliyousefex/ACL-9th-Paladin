import { useEffect, useMemo, useState } from "react";
import { Flag } from "../../components/Flag";
import { Icon } from "../../components/Icon";
import { ErrorNote, LightsLoader } from "../../components/Bits";
import { Lazy } from "../../components/Lazy";
import { rememberRace } from "../../components/Shell";
import {
  RACES,
  SEASONS,
  circuit as circuitOf,
  currentLayout,
  layoutFor,
  loadLayout,
  loadRace,
  raceHref,
  racesIn,
  useResource,
  type Layout,
  type RaceMeta,
} from "../../lib/data";
import { longDate } from "../../lib/format";
import { useScrollSpy, useStoredFlag, useTitle } from "../../lib/hooks";
import { href, navigate } from "../../lib/router";
import { CircuitPanel } from "./CircuitPanel";
import { ComparePanel } from "./ComparePanel";
import { GridPanel } from "./GridPanel";
import { Podium } from "./Podium";
import { ReplayPanel } from "./ReplayPanel";
import { ResultPanel } from "./ResultPanel";
import { Tower } from "./Tower";
import { WhatIfPanel } from "./WhatIfPanel";
import { PLACE_COLOURS, buildRows, type Row } from "./rows";

const SPY = ["circuit", "grid", "prediction", "leaderboard", "compare", "what-if", "result", "replay"];

export function RacePage({ year, slug }: { year: number; slug: string }) {
  const race = RACES.find((r) => r.year === year && r.slug === slug);
  if (!race) return <NotFound year={year} slug={slug} />;
  return <Race key={race.id} race={race} />;
}

function Race({ race }: { race: RaceMeta }) {
  const circuit = circuitOf(race.circuitId);
  useTitle(`${race.name} ${race.year}`);
  useEffect(() => rememberRace(raceHref(race)), [race]);

  const detail = useResource(String(race.id), () => loadRace(race.id));
  const meta = layoutFor(circuit, race.year);
  const layout = useResource<Layout>(meta.file ? meta.id : null, () => loadLayout(meta.id));

  const rows = useMemo(() => (detail.data ? buildRows(detail.data, race.year) : []), [detail.data, race.year]);

  const [selected, setSelected] = useState<number[]>([]);
  const [focus, setFocus] = useState<number>(0);
  const [hovered, setHovered] = useState<number | null>(null);
  const [runKey, setRunKey] = useState(1);
  const [always, setAlways] = useStoredFlag("paladin:show-results", false);
  const [flag, setFlag] = useState(false);
  const revealed = always || flag;

  // defaults once the rows exist: compare the two highest scores, look at the top-ranked driver
  useEffect(() => {
    if (rows.length === 0) return;
    setSelected(rows.slice(0, 2).map((r) => r.driver.id));
    setFocus(rows[0].driver.id);
  }, [rows]);

  const toggle = (id: number) => {
    setFocus(id);
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id].slice(-3)));
  };

  const active = useScrollSpy(SPY);

  return (
    <div className="page-in">
      <RaceHeader race={race} circuitName={circuit.name} flag={circuit.flag} top={rows.slice(0, 3)} revealed={revealed} />
      <SubNav active={active} />
      <div className="mx-auto max-w-[1320px] space-y-6 px-4 pt-6 sm:px-6 lg:px-10">
        <CircuitPanel race={race} circuit={circuit} />

        {detail.loading && !detail.data && (
          <div className="panel">
            <LightsLoader label="Loading the grid and the model's scores" />
          </div>
        )}
        {detail.error && <ErrorNote detail={`Race ${race.id} could not be loaded.`} />}

        {rows.length > 0 && (
          <>
            <Lazy id="grid" minHeight={760}>
              <GridPanel rows={rows} focus={focus} onFocus={setFocus} />
            </Lazy>
            <Lazy id="prediction" minHeight={640}>
              <Podium top={rows.slice(0, 3)} runKey={runKey} onRun={() => setRunKey((k) => k + 1)} revealed={revealed} />
            </Lazy>
            <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-[minmax(0,0.92fr)_minmax(0,1.08fr)]">
              <Lazy id="leaderboard" minHeight={1150}>
                <Tower rows={rows} selected={selected} onToggle={toggle} revealed={revealed} hovered={hovered} onHover={setHovered} />
              </Lazy>
              <Lazy id="compare" minHeight={900}>
                <ComparePanel
                  rows={rows}
                  selected={selected}
                  onRemove={(id) => setSelected((prev) => prev.filter((x) => x !== id))}
                  onAdd={(id) => setSelected((prev) => [...prev, id].slice(-3))}
                  revealed={revealed}
                />
              </Lazy>
            </div>
            <Lazy id="what-if" minHeight={560}>
              <WhatIfPanel rows={rows} focus={focus} onFocus={setFocus} />
            </Lazy>

            <LightsOut />

            <Lazy id="result" minHeight={revealed ? 1500 : 220}>
              <ResultPanel race={race} rows={rows} revealed={revealed} onReveal={() => setFlag(true)} alwaysShow={always} onAlwaysShow={setAlways} />
            </Lazy>
            <Lazy id="replay" minHeight={revealed ? 900 : 0}>
              {revealed && detail.data ? (
                <ReplayPanel
                  rows={rows}
                  detail={detail.data}
                  layout={layout.data}
                  lapLengthM={meta.lengthM ?? currentLayout(circuit).lengthM ?? 5000}
                  predicted={race.predicted}
                />
              ) : null}
            </Lazy>
          </>
        )}
      </div>
    </div>
  );
}

/** The cutoff, drawn once: everything above it is what the model may use, everything below happens after. */
function LightsOut() {
  return (
    <div className="relative my-10 flex items-center gap-4" role="separator" aria-label="Lights out: the model's cutoff">
      <span className="h-px flex-1 bg-signal" />
      <p className="display flex items-center gap-3 text-[1.5rem] text-ink sm:text-[2rem]">
        <span className="flex gap-1.5" aria-hidden>
          {[0, 1, 2, 3, 4].map((i) => (
            <span key={i} className="h-3 w-3 rounded-full bg-line2" />
          ))}
        </span>
        Lights out
      </p>
      <span className="h-px flex-1 bg-signal" />
    </div>
  );
}

function RaceHeader({ race, circuitName, flag, top, revealed }: { race: RaceMeta; circuitName: string; flag: string | null; top: Row[]; revealed: boolean }) {
  const index = RACES.findIndex((r) => r.id === race.id);
  const prev = RACES[index - 1];
  const next = RACES[index + 1];
  const goto = (value: string) => {
    const target = RACES.find((r) => String(r.id) === value);
    if (target) navigate(raceHref(target));
  };

  return (
    <header className="relative overflow-hidden border-b border-line pt-[calc(var(--nav-h)+1.5rem)] pb-6">
      <div className="mx-auto max-w-[1320px] px-4 sm:px-6 lg:px-10">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="eyebrow">
            <a className="no-underline hover:text-ink" href={href("/", { season: race.year })}>
              {race.year} season
            </a>
            <span aria-hidden className="text-mute">/</span>
            Round {race.round}
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <a
              className={`btn btn-ghost !min-h-10 !px-3 ${prev ? "" : "pointer-events-none opacity-30"}`}
              href={prev ? href(raceHref(prev)) : undefined}
              aria-label={prev ? `Previous race: ${prev.name} ${prev.year}` : "No previous race"}
              aria-disabled={!prev}
            >
              <Icon name="arrowLeft" size={16} />
              <span className="hidden sm:inline">Prev</span>
            </a>
            <label>
              <span className="sr-only">Choose a Grand Prix</span>
              <select className="select max-w-[14rem] sm:max-w-none" value={race.id} onChange={(e) => goto(e.target.value)} aria-label="Choose a Grand Prix">
                {SEASONS.map((season) => (
                  <optgroup key={season} label={`${season}`}>
                    {racesIn(season).map((r) => (
                      <option key={r.id} value={r.id}>
                        R{r.round} · {r.name.replace(" Grand Prix", "")}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
            </label>
            <a
              className={`btn btn-ghost !min-h-10 !px-3 ${next ? "" : "pointer-events-none opacity-30"}`}
              href={next ? href(raceHref(next)) : undefined}
              aria-label={next ? `Next race: ${next.name} ${next.year}` : "No next race"}
              aria-disabled={!next}
            >
              <span className="hidden sm:inline">Next</span>
              <Icon name="arrowRight" size={16} />
            </a>
          </div>
        </div>

        <div className="mt-5 grid items-end gap-6 lg:grid-cols-[1fr_auto]">
          <div>
            <h1 className="display text-[2.9rem] text-ink sm:text-[4.6rem] lg:text-[5.6rem]">{race.name}</h1>
            <p className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-[1.05rem] text-steel">
              <span>{longDate(race.date)}</span>
              <span className="flex items-center gap-2">
                <Flag code={flag} />
                {circuitName}
              </span>
              <span className="text-mute">Test season: the model never saw this race in training.</span>
            </p>
          </div>
          <PredictionStrip top={top} revealed={revealed} />
        </div>
      </div>
    </header>
  );
}

const SUBNAV = [
  { id: "circuit", label: "Circuit" },
  { id: "grid", label: "Grid" },
  { id: "prediction", label: "Prediction" },
  { id: "leaderboard", label: "Ranking" },
  { id: "compare", label: "Compare" },
  { id: "what-if", label: "What if" },
  { id: "result", label: "Result", after: true },
  { id: "replay", label: "Replay", after: true },
];

function SubNav({ active }: { active: string }) {
  const jump = (id: string) => (event: React.MouseEvent) => {
    event.preventDefault();
    const node = document.getElementById(id);
    if (!node) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    node.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
  };
  return (
    <nav
      aria-label="On this race"
      className="sticky z-40 border-b border-line bg-tower/95 backdrop-blur-sm"
      style={{ top: "var(--nav-h)" }}
    >
      <ul className="no-scrollbar mx-auto flex max-w-[1320px] items-center gap-1 overflow-x-auto px-4 sm:px-6 lg:px-10">
        {SUBNAV.map((item, i) => (
          <li key={item.id} className="flex shrink-0 items-center">
            {item.after && !SUBNAV[i - 1]?.after && <span className="mx-2 h-5 w-[3px] -skew-x-12 bg-signal" aria-hidden title="Lights out" />}
            <a
              href={`#${item.id}`}
              onClick={jump(item.id)}
              aria-current={active === item.id ? "true" : undefined}
              className={`relative px-3 py-3 font-display text-[0.98rem] leading-none font-semibold tracking-[0.1em] uppercase no-underline transition-colors ${
                active === item.id ? "text-ink" : "text-mute hover:text-ink"
              }`}
            >
              {item.label}
              <span aria-hidden className={`absolute inset-x-3 bottom-0 h-[2px] bg-signal transition-opacity ${active === item.id ? "opacity-100" : "opacity-0"}`} />
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}

function NotFound({ year, slug }: { year: number; slug: string }) {
  return (
    <div className="mx-auto max-w-[760px] px-4 pt-32 pb-10">
      <p className="eyebrow">Race not found</p>
      <h1 className="display mt-3 text-[3rem]">No race “{slug}” in {year}</h1>
      <p className="mt-4 text-steel">Predictions cover the 68 held-out Grands Prix of 2022 to 2024.</p>
      <a className="btn mt-6" href={href("/")}>
        Back to the season
      </a>
    </div>
  );
}

/** The headline at a glance: the model's three highest scores, with a link down to the full prediction. */
function PredictionStrip({ top, revealed }: { top: Row[]; revealed: boolean }) {
  return (
    <a
      href="#prediction"
      onClick={(event) => {
        event.preventDefault();
        document.getElementById("prediction")?.scrollIntoView({ behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
      }}
      className="group block min-w-[17rem] border border-line bg-panel px-4 py-3 no-underline transition-colors hover:border-line2 hover:bg-panel2"
      aria-label="Jump to the predicted podium"
    >
      <span className="flex items-center justify-between gap-3">
        <span className="label !text-[0.74rem]">Model's top three</span>
        <span className="tag tag-model !text-[0.66rem]">Model output</span>
      </span>
      <span className="mt-2 flex gap-2" aria-hidden={top.length === 0}>
        {top.length === 0
          ? [0, 1, 2].map((i) => <span key={i} className="skeleton h-12 w-[5.2rem]" />)
          : top.map((row, i) => {
              const hit = revealed && row.podium;
              return (
                <span key={row.driver.id} className="relative flex w-[5.2rem] flex-col border bg-tower px-2 pt-2 pb-1.5" style={{ borderColor: hit ? "var(--color-hit)" : "var(--color-line2)" }}>
                  <span className="absolute inset-x-[-1px] top-[-1px] h-[3px]" style={{ background: row.colour }} aria-hidden />
                  <span className="flex items-baseline justify-between">
                    <span className="font-display text-[1.15rem] leading-none font-bold tracking-wide uppercase">{row.driver.code}</span>
                    <span className="figure text-[0.95rem]" style={{ color: PLACE_COLOURS[i] }}>{i + 1}</span>
                  </span>
                  <span className="figure mt-1 text-[1.3rem] text-steel">{row.score.toFixed(2)}</span>
                </span>
              );
            })}
      </span>
      <span className="mt-2 block text-[0.78rem] text-mute group-hover:text-steel">See the full prediction ↓</span>
    </a>
  );
}
