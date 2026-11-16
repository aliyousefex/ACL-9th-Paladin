import { useEffect, useMemo, useRef, useState } from "react";
import { CircuitMap, CircuitThumb } from "../../components/CircuitMap";
import { Flag } from "../../components/Flag";
import { Icon } from "../../components/Icon";
import { Panel } from "../../components/Panel";
import { Tag } from "../../components/Provenance";
import { Tabs } from "../../components/Bits";
import { VectorRaceCar } from "../../components/VectorRaceCar";
import {
  RACES,
  SEASONS,
  circuit as circuitOf,
  constructor as teamOf,
  currentLayout,
  driver as driverOf,
  loadLayout,
  raceHref,
  racesIn,
  seasonHits,
  standings,
  teamColour,
  useResource,
  type Layout,
  type RaceMeta,
} from "../../lib/data";
import { shortDate } from "../../lib/format";
import { useTitle } from "../../lib/hooks";
import { replaceQuery, href, navigate } from "../../lib/router";
import { usePrefersReducedMotion } from "../../lib/motion";
import { pickUniform, readBookmarks, readChallenge } from "../../lib/challenge";
import { frameAt, lapFrames, lapLength, launchDistance, launchFrames, sampleTrack, type LapPoint } from "../../lib/lap";
import model from "../../data/model.json";
import { ChallengeHub } from "../games/ChallengeHub";
import { FirstVisit } from "./FirstVisit";
import { playsFrom, summariseLeague } from "../../lib/league";

type View = "calendar" | "standings";

export function Home({ query }: { query: URLSearchParams }) {
  useTitle(null);
  const season = SEASONS.includes(Number(query.get("season")) as never) ? Number(query.get("season")) : 2024;
  const view: View = query.get("view") === "standings" ? "standings" : "calendar";
  const set = (next: { season?: number; view?: View }) =>
    replaceQuery({ season: next.season ?? season, view: next.view ?? view });

  return (
    <div className="page-in">
      <Hero />
      <div className="mx-auto max-w-[1320px] space-y-16 px-4 pt-10 sm:px-6 lg:px-10">
        <FirstVisit />
        <section aria-labelledby="season-title" id="season" className="scroll-mt-24">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <h2 id="season-title" className="section-title">Choose a Grand Prix</h2>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <Tabs<string>
                value={String(season)}
                onChange={(v) => set({ season: Number(v) })}
                idPrefix="season"
                label="Season"
                options={SEASONS.map((s) => ({ id: String(s), label: String(s) }))}
              />
              <Tabs<View>
                value={view}
                onChange={(v) => set({ view: v })}
                idPrefix="view"
                label="View"
                options={[
                  { id: "calendar", label: "Calendar" },
                  { id: "standings", label: "Standings" },
                ]}
              />
            </div>
          </div>

          <Scoreboard season={season} />
          <ChallengeProgress season={season} />

          <div className="mt-8">
            {view === "calendar" ? <Calendar season={season} /> : <Standings season={season} />}
          </div>
        </section>

        <Highlights />
        <ChallengeHub />
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ hero */

function Hero() {
  const latest = RACES[RACES.length - 1];
  const test = model.metrics.find((m) => m.model === model.name && m.split === "test")!;
  const rows = RACES.reduce((n, r) => n + r.drivers, 0);

  return (
    <header className="home-console relative overflow-hidden border-b border-line pt-[calc(var(--nav-h)+1.5rem)] pb-8">
      <div className="mx-auto grid max-w-[1320px] items-center gap-8 px-4 sm:px-6 lg:grid-cols-[1.1fr_0.9fr] lg:px-10">
        <div className="min-w-0">
          <h1 className="product-title mt-3">Predict the podium.<br />Replay the evidence.</h1>
          <p className="mt-5 max-w-[60ch] text-[1.05rem] leading-relaxed text-steel">
            Choose a completed Grand Prix and inspect Paladin’s lights-out podium call using only what was known after qualifying. Then reveal the result, reconstruct the race, or test a clearly labelled strategy simulation.
          </p>
          <div className="mt-6 flex flex-wrap gap-2">
            <a className="btn" href={href(raceHref(latest))}>
              Open {latest.name.replace(" Grand Prix", "")} {latest.year} <Icon name="arrowRight" size={18} />
            </a>
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => {
                navigate(raceHref(pickUniform(RACES) ?? latest));
              }}
            >
              Surprise me
            </button>
            <a className="btn btn-ghost" href={href("/race-lab")}>Open simulation</a>
          </div>
          <p className="mt-3 max-w-[54ch] text-[0.82rem] text-mute">Random selection is uniform across all held-out races and does not inspect their results.</p>
          <dl className="mt-7 grid max-w-[640px] grid-cols-2 gap-x-8 gap-y-4 border-t border-line pt-5 sm:grid-cols-4">
            <Kpi label="Races never seen in training" value={String(RACES.length)} />
            <Kpi label="Driver entries scored" value={rows.toLocaleString("en-GB")} />
            <Kpi label="ROC-AUC on test" value={test["ROC-AUC"].toFixed(3)} />
            <Kpi label="PR-AUC on test" value={test["PR-AUC"].toFixed(3)} note="a no-skill ranking scores 0.150" />
          </dl>
        </div>
        <Tracer />
      </div>
    </header>
  );
}

function Kpi({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div>
      <dt className="label min-h-[2.3em] !text-[0.75rem] !leading-tight">{label}</dt>
      <dd className="figure mt-1.5 text-[2.3rem]">{value}</dd>
      {note && <dd className="mt-0.5 text-[0.78rem] leading-tight text-mute">{note}</dd>}
    </div>
  );
}

/** The home car's timing, in milliseconds: the lights go out, the launch builds to a steady speed, and a lap at that speed takes this long. */
const LIGHTS_OUT = 2800;
const LAUNCH_MS = 3000;
const LAP_MS = 24000;
/** The first grid slot is this many map units behind the line. */
const POLE_BACK = 11;
/** The car is a little smaller than the track is wide (the wings sit well inside the white lines), and drawn in a box that holds it. */
const CAR_SCALE = 1.1;
const CAR_BOX = { w: 48, h: 26 };

/** A real circuit with a car lapping it. Pure illustration, and labelled as such. */
function Tracer() {
  const meta = currentLayout(circuitOf(22)); // Suzuka: a figure-eight reads well at a glance
  const { data: layout } = useResource<Layout>(meta.id, () => loadLayout(meta.id));
  const reduce = usePrefersReducedMotion();
  const stage = useRef<HTMLDivElement>(null); // the map, and the layer the car rides in laid over it
  const deck = useRef<HTMLDivElement>(null); // that layer: the map's own coordinates, scaled to fit the drawing
  const car = useRef<HTMLDivElement>(null);
  const born = useRef(performance.now());
  const [lit, setLit] = useState(reduce ? 5 : 0);
  // the lap, from points on the drawn curve itself (the outline's samples where the browser cannot measure a path)
  const frames = useMemo(() => (layout ? lapFrames(sampleTrack(layout.path) ?? layout.samples) : []), [layout]);

  useEffect(() => {
    if (reduce) {
      setLit(5);
      return;
    }
    const timers = [1, 2, 3, 4, 5].map((i) => window.setTimeout(() => setLit(i), 500 + i * 320));
    timers.push(window.setTimeout(() => setLit(0), 500 + 5 * 320 + 700));
    return () => timers.forEach(window.clearTimeout);
  }, [reduce]);

  // The car's layer sits over the map's drawn area (the map is drawn to fit its box, so there may be room either side of it).
  useEffect(() => {
    const outer = stage.current;
    const layer = deck.current;
    const svg = outer?.querySelector("svg");
    if (!outer || !layer || !svg || !layout) return;
    const [w, h] = layout.viewBox;
    const place = () => {
      const around = outer.getBoundingClientRect();
      const box = svg.getBoundingClientRect();
      if (box.width <= 0 || box.height <= 0) return;
      const k = Math.min(box.width / w, box.height / h);
      const x = box.left - around.left + (box.width - w * k) / 2;
      const y = box.top - around.top + (box.height - h * k) / 2;
      layer.style.transform = `translate(${x}px, ${y}px) scale(${k})`;
      layer.style.visibility = "visible";
    };
    place();
    const watch = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(place);
    watch?.observe(svg);
    watch?.observe(outer);
    return () => watch?.disconnect();
  }, [layout]);

  // The car's lap. It is moved by the browser's animation engine, not by this code frame by frame, so it runs on the compositor and
  // a busy page (a phone drawing the map, a script, a scroll) cannot make it stutter. It waits in the first grid slot for the lights to
  // go out, pulls away with a steady build of speed, and then laps at an even pace with the heading turning continuously.
  useEffect(() => {
    const node = car.current;
    const outer = stage.current;
    if (!node || !outer || frames.length === 0) return;
    const pose = (p: LapPoint) => ({ transform: `translate(${p.x.toFixed(2)}px, ${p.y.toFixed(2)}px) rotate(${p.angle.toFixed(2)}deg)` });
    if (reduce || typeof node.animate !== "function") {
      node.style.transform = pose(frameAt(frames, 0.08)).transform;
      return;
    }
    const wait = Math.max(0, LIGHTS_OUT - (performance.now() - born.current));
    const from = 1 - POLE_BACK / lapLength(frames);
    const reach = launchDistance(LAUNCH_MS, LAP_MS);
    node.style.transform = pose(frameAt(frames, from)).transform;
    const launch = node.animate(launchFrames(frames, from, reach).map(pose), { delay: wait, duration: LAUNCH_MS, easing: "linear", fill: "both" });
    const cruise = node.animate(frames.map(pose), { delay: wait + LAUNCH_MS, duration: LAP_MS, iterations: Infinity, iterationStart: (from + reach) % 1, easing: "linear", fill: "forwards" });
    // Only while the map is on screen: scrolled away there is nothing to see, so the car waits where it is and goes on from there.
    const held: Animation[] = [];
    const watch =
      typeof IntersectionObserver === "undefined"
        ? null
        : new IntersectionObserver(
            ([entry]) => {
              if (entry.isIntersecting) held.splice(0).forEach((a) => a.play());
              else {
                for (const a of [launch, cruise]) {
                  if (a.playState !== "running") continue;
                  a.pause();
                  held.push(a);
                }
              }
            },
            { rootMargin: "120px" },
          );
    watch?.observe(outer);
    return () => {
      watch?.disconnect();
      launch.cancel();
      cruise.cancel();
    };
  }, [frames, reduce]);

  return (
    <div className="relative">
      <div className="panel panel-flat bg-tower/60 p-5 sm:p-8">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div className="flex gap-2" aria-hidden>
            {[0, 1, 2, 3, 4].map((i) => (
              <span key={i} className={`h-4 w-4 rounded-full transition-colors duration-100 ${i < lit ? "bg-signal shadow-[0_0_14px_rgba(225,6,0,.7)]" : "bg-line"}`} />
            ))}
          </div>
          <Tag kind="illustrative" />
        </div>
        <div className="grid min-h-[300px] place-items-center">
          {layout ? (
            <div ref={stage} className="relative w-full">
              <CircuitMap layout={layout} className="block w-full max-h-[420px]" sectors animateDraw weight={1} label="Suzuka circuit with a car lapping it" />
              {/* the car's layer: the map's own coordinates, so the car is placed and turned in them, and scaled with the drawing */}
              <div
                ref={deck}
                aria-hidden
                className="map-in pointer-events-none absolute left-0 top-0"
                style={{ width: layout.viewBox[0], height: layout.viewBox[1], transformOrigin: "0 0", transform: "scale(0)", visibility: "hidden" }}
              >
                <div ref={car} data-lapping-car className="absolute" style={{ left: -CAR_BOX.w / 2, top: -CAR_BOX.h / 2, width: CAR_BOX.w, height: CAR_BOX.h, transformOrigin: "50% 50%", willChange: "transform" }}>
                  <svg viewBox={`${-CAR_BOX.w / 2} ${-CAR_BOX.h / 2} ${CAR_BOX.w} ${CAR_BOX.h}`} width={CAR_BOX.w} height={CAR_BOX.h} className="block overflow-visible" focusable="false">
                    <VectorRaceCar colour="#e10600" ink="#ffffff" number={null} scale={CAR_SCALE} />
                  </svg>
                </div>
              </div>
            </div>
          ) : (
            <span className="skeleton h-64 w-full" />
          )}
        </div>
        <p className="mt-4 flex items-center justify-between gap-3 text-[0.85rem] text-mute">
          <span>
            <span className="font-semibold text-steel">Suzuka</span> · real F1 timing map, sectors from telemetry
          </span>
          <a className="inline-flex min-h-11 items-center text-steel underline decoration-line2 underline-offset-2 hover:text-ink" href={href("/circuits/suzuka")}>
            Explore circuits
          </a>
        </p>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ scoreboard */

function Scoreboard({ season }: { season: number }) {
  const hits = seasonHits(season);
  const races = racesIn(season);
  const perfect = races.filter((r) => r.hits === 3).length;
  return (
    <div className="mt-8 grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.6fr)]">
      <div className="panel p-5">
        <div className="flex items-start justify-between gap-3">
          <p className="label">How many of the 3 podium finishers did the top three contain?</p>
          <Tag kind="model" />
        </div>
        <dl className="mt-4 grid grid-cols-2 gap-6">
          <div>
            <dt className="text-[0.95rem] text-steel">Model's top three</dt>
            <dd className="figure mt-1 text-[3.2rem]">
              {hits.model.toFixed(2)}
              <span className="text-[1.2rem] text-mute"> / 3</span>
            </dd>
          </div>
          <div>
            <dt className="text-[0.95rem] text-steel">Starting-grid top three</dt>
            <dd className="figure mt-1 text-[3.2rem] text-steel">
              {hits.grid.toFixed(2)}
              <span className="text-[1.2rem] text-mute"> / 3</span>
            </dd>
          </div>
        </dl>
        <p className="mt-4 text-[0.88rem] leading-snug text-mute">
          Average over the {hits.races} races of {season}; {perfect} were called perfectly. The grid is a strong baseline because
          qualifying already tells most of the story.
        </p>
      </div>
      <HitsStrip season={season} />
    </div>
  );
}

function ChallengeProgress({ season }: { season: number }) {
  const [version, setVersion] = useState(0);
  useEffect(() => {
    const refresh = () => setVersion((value) => value + 1);
    window.addEventListener("paladin:challenge", refresh);
    window.addEventListener("storage", refresh);
    return () => {
      window.removeEventListener("paladin:challenge", refresh);
      window.removeEventListener("storage", refresh);
    };
  }, []);
  const races = racesIn(season);
  // The same rule as the season league: only picks locked while the result was hidden count.
  const league = summariseLeague(RACES, playsFrom(readChallenge, races).plays);
  const bookmarks = readBookmarks().map((id) => RACES.find((race) => race.id === id)).filter((race): race is RaceMeta => Boolean(race));
  void version;

  return (
    <div className="mt-4 border border-line bg-tower px-4 py-4 sm:px-5">
      <div className="flex flex-wrap items-center gap-x-8 gap-y-3">
        <div>
          <p className="label">Your {season} league</p>
          <p className="mt-1 text-[0.9rem] text-mute">Picks are stored only in this browser. <a className="text-steel underline decoration-line2 underline-offset-2 hover:text-ink" href={href("/league", { season })}>Open your league</a></p>
        </div>
        <p className="figure text-[1.8rem]">{league.played}<span className="ml-1 font-sans text-[0.9rem] font-normal tracking-normal text-mute">/ {races.length} races called blind</span></p>
        <p className="figure text-[1.8rem]">{league.you}<span className="ml-1 font-sans text-[0.9rem] font-normal tracking-normal text-mute">your podium names</span></p>
        <p className="figure text-[1.8rem] text-steel">{league.paladin}<span className="ml-1 font-sans text-[0.9rem] font-normal tracking-normal text-mute">Paladin's on the same races</span></p>
        {bookmarks.length > 0 && (
          <div className="ml-auto flex flex-wrap items-center gap-2">
            <span className="label">Saved</span>
            {bookmarks.slice(0, 4).map((race) => <a key={race.id} className="chip !min-h-11 no-underline" href={href(raceHref(race))}>{race.name.replace(" Grand Prix", "")} {String(race.year).slice(2)}</a>)}
          </div>
        )}
      </div>
    </div>
  );
}

function HitsStrip({ season }: { season: number }) {
  const races = racesIn(season);
  const [hover, setHover] = useState<RaceMeta | null>(null);
  return (
    <div className="panel p-5">
      <div className="flex items-start justify-between gap-3">
        <p className="label">Model hits round by round</p>
        <Tag kind="record" />
      </div>
      <div className="no-scrollbar mt-4 overflow-x-auto pb-1">
      <ol className="flex h-28 min-w-[40rem] items-end gap-1.5" aria-label={`Model hits by round, ${season}`}>
        {races.map((race) => {
          const h = race.hits;
          return (
            <li key={race.id} className="flex h-full min-w-6 flex-1 flex-col justify-end">
              <a
                href={href(raceHref(race))}
                className="group relative flex h-full flex-col justify-end no-underline"
                onPointerEnter={() => setHover(race)}
                onPointerLeave={() => setHover(null)}
                onFocus={() => setHover(race)}
                onBlur={() => setHover(null)}
              >
                <span className="sr-only">
                  Round {race.round}, {race.name}: model found {h} of 3
                </span>
                <span
                  className="block w-full transition-[filter] group-hover:brightness-125"
                  style={{
                    height: `${(Math.max(h, 0.15) / 3) * 100}%`,
                    background: h === 3 ? "var(--color-hit)" : h === 2 ? "#6e7783" : h === 1 ? "#4a525d" : "var(--color-signal)",
                  }}
                />
              </a>
              <span className="mt-1.5 text-center text-[0.75rem] leading-none text-mute">{race.round}</span>
            </li>
          );
        })}
      </ol>
      </div>
      <p className="mt-3 min-h-5 text-[0.9rem] text-steel" aria-live="polite">
        {hover ? (
          <>
            <span className="font-semibold text-ink">{hover.name}</span>: {hover.hits} of 3 (grid pick: {hover.baselineHits})
          </>
        ) : (
          <span className="text-mute">Bar height is the number of correct podium drivers in the model's top three. Hover or tab to read one.</span>
        )}
      </p>
    </div>
  );
}

/* ------------------------------------------------------------------ calendar */

function Calendar({ season }: { season: number }) {
  const races = racesIn(season);
  return (
    <ul className="race-calendar grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4" aria-label={`${season} calendar`}>
      {races.map((race) => (
        <li key={race.id}>
          <RaceCard race={race} />
        </li>
      ))}
    </ul>
  );
}

function RaceCard({ race }: { race: RaceMeta }) {
  const circuit = circuitOf(race.circuitId);
  const layoutMeta = circuit.layouts.find((l) => l.years.includes(race.year)) ?? circuit.layouts[circuit.layouts.length - 1];
  const thumb = layoutMeta.thumb ? layoutMeta : circuit.layouts.find((l) => l.thumb) ?? layoutMeta;
  return (
    <a
      href={href(raceHref(race))}
      className="race-card panel group flex h-full flex-col no-underline transition-colors hover:border-line2 hover:bg-panel2"
    >
      <span className="sr-only">
        {race.year} round {race.round}. Model found {race.hits} of 3 podium drivers.
      </span>
      <div className="flex items-start justify-between gap-3 px-4 pt-4">
        <div className="min-w-0">
          <p className="label">
            Round {race.round} · {shortDate(race.date)}
          </p>
          <h3 className="display mt-1.5 truncate text-[1.6rem] leading-none text-ink">{race.name.replace(" Grand Prix", "")}</h3>
          <p className="mt-1.5 flex items-center gap-2 text-[0.85rem] text-mute">
            <Flag code={circuit.flag} />
            <span className="truncate">{circuit.location || circuit.country}</span>
          </p>
        </div>
        <span className="figure shrink-0 pt-1 text-[1.9rem]" aria-hidden>
          <span className={race.hits === 3 ? "text-hit" : race.hits === 0 ? "text-signal-text" : "text-steel"}>{race.hits}</span>
          <span className="text-[1rem] text-mute">/3</span>
        </span>
      </div>
      <div className="race-card-map grid flex-1 place-items-center px-5 py-4">
        {thumb.thumb && layoutMeta.years.includes(race.year) ? (
          <CircuitThumb meta={thumb} className="h-24 w-full max-w-[210px] transition-transform duration-500 group-hover:scale-105" stroke="var(--color-steel)" width={13} accent="var(--color-line)" />
        ) : (
          <p className="text-center text-[0.8rem] text-mute">Layout outline not available</p>
        )}
      </div>
      <div className="border-t border-line px-4 py-3">
        <p className="label !text-[0.75rem]">Model's podium</p>
        <ul className="mt-1.5 flex gap-2">
          {race.predicted.map((id, i) => {
            const d = driverOf(id);
            const colour = teamColour(race.teams[String(id)], race.year);
            const ok = race.actual.includes(id);
            return (
              <li
                key={id}
                className="flex items-center gap-1.5 border px-1.5 py-1"
                style={{ borderColor: ok ? "var(--color-hit)" : "var(--color-line2)" }}
                title={ok ? "Finished on the podium" : "Did not finish on the podium"}
              >
                <span className="figure text-[0.9rem] text-mute">{i + 1}</span>
                <span className="h-3.5 w-1" style={{ background: colour }} aria-hidden />
                <span className="font-display text-[0.98rem] leading-none font-bold tracking-wide">{d.code}</span>
              </li>
            );
          })}
        </ul>
      </div>
    </a>
  );
}

/* ------------------------------------------------------------------ standings */

function Standings({ season }: { season: number }) {
  const block = standings[String(season)];
  const rounds = block.rounds.length;
  const drivers = Object.entries(block.drivers)
    .map(([id, v]) => ({ id: Number(id), ...v }))
    .filter((d) => d.pts.some((p) => p !== null))
    .map((d) => ({ ...d, total: d.pts.filter((p) => p !== null).pop() ?? 0 }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 22);
  const teams = Object.entries(block.constructors)
    .map(([id, v]) => ({ id: Number(id), ...v, total: v.pts.filter((p) => p !== null).pop() ?? 0 }))
    .sort((a, b) => b.total - a.total);
  const maxDriver = Math.max(...drivers.map((d) => d.total));
  const maxTeam = Math.max(...teams.map((t) => t.total));

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Panel context={`${season} · after round ${rounds}`} title="Drivers' championship" tag="record" level={3}>
        <ol className="divide-y divide-line" aria-label="Driver standings">
          {drivers.map((d, i) => {
            const info = driverOf(d.id);
            const team = info.seasons[String(season)]?.constructorId ?? 0;
            const colour = teamColour(team, season);
            return (
              <li key={d.id} className="grid grid-cols-[1.8rem_0.4rem_1fr_auto] items-center gap-3 py-2">
                <span className="figure text-center text-[1.3rem] text-steel">{i + 1}</span>
                <span className="h-7 w-1" style={{ background: colour }} aria-hidden />
                <span className="min-w-0">
                  <a className="block truncate font-display text-[1.15rem] leading-none font-bold uppercase no-underline hover:underline" href={href("/drivers/" + info.ref, { season })}>
                    {info.name}
                  </a>
                  <span className="mt-1 block h-1.5 bg-line">
                    <span className="block h-full" style={{ width: `${(d.total / maxDriver) * 100}%`, background: colour }} />
                  </span>
                </span>
                <span className="figure w-12 text-right text-[1.4rem]">{d.total}</span>
              </li>
            );
          })}
        </ol>
      </Panel>
      <Panel context={`${season} · after round ${rounds}`} title="Constructors' championship" tag="record" level={3}>
        <ol className="divide-y divide-line" aria-label="Constructor standings">
          {teams.map((t, i) => {
            const info = teamOf(t.id);
            const colour = teamColour(t.id, season);
            return (
              <li key={t.id} className="grid grid-cols-[1.8rem_0.4rem_1fr_auto] items-center gap-3 py-2">
                <span className="figure text-center text-[1.3rem] text-steel">{i + 1}</span>
                <span className="h-7 w-1" style={{ background: colour }} aria-hidden />
                <span className="min-w-0">
                  <span className="block truncate font-display text-[1.15rem] leading-none font-bold uppercase">{info?.name ?? t.id}</span>
                  <span className="mt-1 block h-1.5 bg-line">
                    <span className="block h-full" style={{ width: `${(t.total / maxTeam) * 100}%`, background: colour }} />
                  </span>
                </span>
                <span className="figure w-12 text-right text-[1.4rem]">{t.total}</span>
              </li>
            );
          })}
        </ol>
        <p className="mt-4 text-[0.85rem] text-mute">
          These totals feed the model: the points and rank <em>before</em> each race are two of its sixteen inputs.
        </p>
      </Panel>
    </div>
  );
}

/* ------------------------------------------------------------------ highlights and explainer */

function Highlights() {
  const perfect = RACES.filter((r) => r.hits === 3);
  const misses = RACES.filter((r) => r.hits === 0);
  const beat = RACES.filter((r) => r.hits > r.baselineHits);
  const lost = RACES.filter((r) => r.hits < r.baselineHits);
  const cards = [
    { title: "Called perfectly", note: "All three podium drivers in the model's top three", count: perfect.length, list: perfect },
    { title: "Beat the grid", note: "More podium drivers than the first three on the grid", count: beat.length, list: beat },
    { title: "Behind the grid", note: "Fewer podium drivers than the first three on the grid", count: lost.length, list: lost },
    { title: "Complete misses", note: "None of the model's three reached the podium", count: misses.length, list: misses },
  ];
  return (
    <section aria-labelledby="highlights-title">
      <h2 id="highlights-title" className="section-title">Where it worked—and where it did not</h2>
      <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {cards.map((card) => (
          <div key={card.title} className="panel p-5">
            <p className="figure text-[3.4rem]">{card.count}</p>
            <h3 className="display mt-1 text-[1.45rem] leading-none">{card.title}</h3>
            <p className="mt-2 min-h-[2.6rem] text-[0.88rem] leading-snug text-mute">{card.note}</p>
            <ul className="mt-3 flex flex-wrap gap-1.5">
              {card.list.slice(0, 6).map((r) => (
                <li key={r.id}>
                  <a className="chip !min-h-11 !px-2 !text-[0.85rem] no-underline" href={href(raceHref(r))} title={`${r.name} ${r.year}`}>
                    {r.name.replace(" Grand Prix", "").slice(0, 10)} {String(r.year).slice(2)}
                  </a>
                </li>
              ))}
              {card.list.length > 6 && <li className="self-center text-[0.8rem] text-mute">+{card.list.length - 6}</li>}
            </ul>
          </div>
        ))}
      </div>
    </section>
  );
}
