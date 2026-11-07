import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Tag } from "../../components/Provenance";
import { LightsLoader } from "../../components/Bits";
import { RACES, SEASONS, circuit as circuitOf, layoutFor, loadLayout, loadRace, useResource } from "../../lib/data";
import { haptic } from "../../lib/haptic";
import { usePrefersReducedMotion } from "../../lib/motion";
import { buildRows } from "../race/rows";
import {
  addResult,
  buildTrack,
  classify,
  entrantsFrom,
  finishRace,
  initialRace,
  lapOf,
  orderOf,
  parseRecord,
  playerDone,
  playerIndex,
  retirePlayer,
  stepRace,
  type Assist,
  type Classified,
  type GpRecord,
  type RaceState,
} from "./raceEngine";
import { GrandPrixRace, type RacePhase } from "./GrandPrixRace";
import { GrandPrixResults } from "./GrandPrixResults";
import { GrandPrixSetup, type Camera } from "./GrandPrixSetup";
import { lapText } from "./grandPrixView";

const RECORD_KEY = "paladin:gp:record";
const PLAYABLE = RACES.filter((race) => layoutFor(circuitOf(race.circuitId), race.year).file);

function readRecord(): GpRecord {
  try {
    return parseRecord(localStorage.getItem(RECORD_KEY));
  } catch {
    return parseRecord(null);
  }
}

type Phase = "setup" | RacePhase | "finished";

/**
 * Track Attack: Grand Prix. Choose a real race and one of its real drivers, then race the whole grid on the real circuit
 * outline and see whether you win. Illustrative: rival pace comes from pre-race information only (see grandPrix.ts).
 */
export function GrandPrix() {
  const reduce = usePrefersReducedMotion();
  const latest = PLAYABLE[PLAYABLE.length - 1];
  const [season, setSeason] = useState<number>(latest.year);
  const [raceId, setRaceId] = useState(latest.id);
  const [driverId, setDriverId] = useState<number | null>(null);
  const [laps, setLaps] = useState(3);
  const [assist, setAssist] = useState<Assist>("standard");
  const [auto, setAuto] = useState(false);
  const [camera, setCamera] = useState<Camera>("follow");
  const [phase, setPhase] = useState<Phase>("setup");
  const [race, setRace] = useState<RaceState | null>(null);
  const [lit, setLit] = useState(0);
  const [go, setGo] = useState(false);
  const [throttle, setThrottleState] = useState(false);
  const [results, setResults] = useState<Classified[] | null>(null);
  const [record, setRecord] = useState<GpRecord>(readRecord);
  const [announcement, setAnnouncement] = useState("");
  const [notice, setNotice] = useState<string | null>(null);
  const noticeTimer = useRef(0);

  const meta = PLAYABLE.find((r) => r.id === raceId) ?? latest;
  const circuit = circuitOf(meta.circuitId);
  const layoutMeta = layoutFor(circuit, meta.year);
  const detail = useResource(String(meta.id), () => loadRace(meta.id));
  const layoutRes = useResource(layoutMeta.file ? layoutMeta.id : null, () => loadLayout(layoutMeta.id));
  const layout = layoutRes.data && layoutRes.data.id === layoutMeta.id ? layoutRes.data : null;
  const entrants = useMemo(() => (detail.data && detail.data.id === meta.id ? entrantsFrom(buildRows(detail.data, meta.year)) : null), [detail.data, meta.id, meta.year]);

  const autoRef = useRef(auto);
  autoRef.current = auto;
  const stateRef = useRef<RaceState | null>(null);
  const throttleRef = useRef(false);
  const timers = useRef<number[]>([]);
  const seedRef = useRef(0);
  const noticed = useRef({ lap: 0, position: 0, at: 0 });

  const setThrottle = useCallback((on: boolean) => {
    throttleRef.current = on;
    setThrottleState(on);
  }, []);
  const clearTimers = () => {
    timers.current.forEach((t) => window.clearTimeout(t));
    timers.current = [];
  };
  useEffect(() => () => { clearTimers(); window.clearTimeout(noticeTimer.current); }, []);

  // Keep the chosen driver valid for the chosen race: default to whoever starts on pole.
  useEffect(() => {
    if (!entrants) return;
    if (driverId !== null && entrants.some((e) => e.id === driverId)) return;
    const pole = [...entrants].sort((a, b) => (a.grid ?? 99) - (b.grid ?? 99))[0];
    setDriverId(pole?.id ?? null);
  }, [entrants, driverId]);
  useEffect(() => setCamera(reduce ? "track" : "follow"), [reduce]);

  const seasonRaces = useMemo(() => PLAYABLE.filter((r) => r.year === season), [season]);
  const chooseSeason = (year: number) => {
    setSeason(year);
    const list = PLAYABLE.filter((r) => r.year === year);
    setRaceId(list[list.length - 1].id);
    setDriverId(null);
  };
  const chooseRace = (id: number) => {
    setRaceId(id);
    setDriverId(null);
  };

  const finish = useCallback(
    (final: RaceState) => {
      const done = finishRace(final);
      const table = classify(done);
      setResults(table);
      setPhase("finished");
      setThrottle(false);
      const me = table.find((c) => c.entrant.id === done.config.playerId);
      if (me) {
        setAnnouncement(me.retired ? "You retired from the race." : `Chequered flag. You finished P${me.position} of ${table.length}${me.position === 1 ? ". You won the Grand Prix" : ""}.`);
        if (!me.retired && !autoRef.current) {
          const next = addResult(readRecord(), meta.id, me.position, me.points);
          setRecord(next);
          try {
            localStorage.setItem(RECORD_KEY, JSON.stringify(next));
          } catch {
            /* the result is still on screen */
          }
        }
      }
    },
    [meta.id, setThrottle],
  );
  const begin = () => {
    if (!layout || !entrants || driverId === null) return;
    clearTimers();
    seedRef.current = Math.floor(Math.random() * 899999) + 100000;
    const state = initialRace(entrants, buildTrack(layout.samples), { laps, seed: seedRef.current, playerId: driverId, assist: auto ? "assisted" : assist });
    stateRef.current = state;
    noticed.current = { lap: 0, position: 0, at: 0 };
    setRace(state);
    setResults(null);
    setThrottle(false);
    setGo(false);
    setLit(0);
    setPhase("lights");
    setAnnouncement("Race starting. Five lights, then go. Hold the throttle when they go out.");
    // Five lights one by one, then a random hold before they go out, as at a real start.
    for (let i = 1; i <= 5; i++) {
      timers.current.push(
        window.setTimeout(() => {
          setLit(i);
          haptic("lights");
        }, (reduce ? 500 : 750) * i),
      );
    }
    const hold = (reduce ? 500 : 750) * 5 + 500 + Math.random() * 1100;
    timers.current.push(
      window.setTimeout(() => {
        setLit(0);
        setGo(true);
        setPhase("race");
        setAnnouncement("Go.");
        haptic("lights");
      }, hold),
    );
    timers.current.push(window.setTimeout(() => setGo(false), hold + 1100));
  };

  // The race clock: a fixed step, with the player's input read from a ref so it never waits for a render.
  useEffect(() => {
    if (phase !== "race") return;
    const dt = reduce ? 0.1 : 0.05;
    const timer = window.setInterval(() => {
      const current = stateRef.current;
      if (!current) return;
      const next = stepRace(current, throttleRef.current || autoRef.current, dt);
      stateRef.current = next;
      setRace(next);
      const me = playerIndex(next);
      const now = performance.now();
      const lap = lapOf(next.cars[me], next.config.laps);
      const position = orderOf(next).indexOf(me) + 1;
      const seen = noticed.current;
      for (const event of next.events) {
        const text = event.kind === "mistake" ? `${next.entrants.find((e) => e.id === event.id)?.last ?? "A rival"} runs wide` : event.kind === "incident" && event.id === next.config.playerId ? "You ran wide" : null;
        if (text) {
          setNotice(text);
          window.clearTimeout(noticeTimer.current);
          noticeTimer.current = window.setTimeout(() => setNotice(null), 2600);
        }
      }
      if (next.events.some((e) => e.kind === "incident" && e.id === next.config.playerId)) {
        setAnnouncement("Off track. You lose time.");
        seen.at = now;
      } else if (lap !== seen.lap && seen.lap !== 0) {
        setAnnouncement(`${lapText(lap, next.config.laps)}. You are P${position}.`);
        seen.at = now;
      } else if (position !== seen.position && seen.position !== 0 && now - seen.at > 2500) {
        setAnnouncement(position < seen.position ? `Up to P${position}.` : `Down to P${position}.`);
        seen.at = now;
      }
      seen.lap = lap;
      seen.position = position;
      if (playerDone(next)) finish(next);
    }, dt * 1000);
    return () => window.clearInterval(timer);
  }, [phase, reduce, finish]);

  // Keyboard: hold Space or Up to accelerate, P or Escape to pause. Pause when the tab is hidden.
  useEffect(() => {
    if (phase !== "race" && phase !== "lights" && phase !== "paused") return;
    const down = (event: KeyboardEvent) => {
      if (event.code === "Space" || event.code === "ArrowUp") {
        // Space on a button, link or field keeps its normal job, except on the throttle button, which Space drives.
        if (event.code === "Space" && (event.target as HTMLElement | null)?.closest("button:not([data-throttle]), a, select, input")) return;
        event.preventDefault();
        if (phase !== "paused") setThrottle(true);
      } else if (event.code === "KeyP" || event.code === "Escape") {
        event.preventDefault();
        setPhase((p) => (p === "race" ? "paused" : p === "paused" ? "race" : p));
        setThrottle(false);
      }
    };
    const up = (event: KeyboardEvent) => {
      if (event.code === "Space" || event.code === "ArrowUp") {
        event.preventDefault();
        setThrottle(false);
      }
    };
    const hidden = () => {
      if (document.visibilityState === "hidden") {
        setPhase((p) => (p === "race" ? "paused" : p));
        setThrottle(false);
      }
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    document.addEventListener("visibilitychange", hidden);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
      document.removeEventListener("visibilitychange", hidden);
    };
  }, [phase, setThrottle]);

  const retire = () => {
    const current = stateRef.current;
    clearTimers();
    if (current) finish(retirePlayer(current));
  };
  const backToSetup = () => {
    clearTimers();
    setPhase("setup");
    setResults(null);
    setRace(null);
    setThrottle(false);
  };

  return (
    <div className="panel overflow-hidden">
      <header className="flex flex-wrap items-start justify-between gap-3 border-b border-line px-5 py-4 sm:px-7">
        <div>
          <h3 className="display text-[2rem] sm:text-[2.4rem]">Grand Prix</h3>
          <p className="mt-1 max-w-[62ch] text-[0.92rem] leading-snug text-mute">
            Pick a real race and one of its real drivers, race the whole grid on the real circuit outline, and see whether you win.
          </p>
        </div>
        <Tag kind="illustrative">Illustrative game</Tag>
      </header>

      {phase === "setup" && (
        <GrandPrixSetup
          seasons={SEASONS}
          season={season}
          onSeason={chooseSeason}
          races={seasonRaces}
          raceId={raceId}
          onRace={chooseRace}
          layout={layoutMeta}
          circuitName={circuit.name}
          entrants={entrants}
          loadError={Boolean(detail.error)}
          driverId={driverId}
          onDriver={setDriverId}
          laps={laps}
          onLaps={setLaps}
          assist={assist}
          onAssist={setAssist}
          auto={auto}
          onAuto={setAuto}
          camera={camera}
          onCamera={setCamera}
          onStart={begin}
          record={record}
        />
      )}

      {(phase === "lights" || phase === "race" || phase === "paused") && race && layout && (
        <GrandPrixRace
          state={race}
          layout={layout}
          phase={phase}
          lit={lit}
          go={go}
          throttle={throttle || auto}
          camera={camera}
          notice={notice}
          onThrottle={setThrottle}
          onPause={() => {
            setPhase("paused");
            setThrottle(false);
          }}
          onResume={() => setPhase("race")}
          onRetire={retire}
          onCamera={setCamera}
        />
      )}
      {(phase === "lights" || phase === "race" || phase === "paused") && !layout && <LightsLoader label="Loading the circuit" />}

      {phase === "finished" && results && driverId !== null && (
        <GrandPrixResults results={results} playerId={driverId} race={meta} laps={laps} assist={assist} auto={auto} seed={seedRef.current} record={record} onAgain={begin} onSetup={backToSetup} />
      )}

      <p className="sr-only" role="status" aria-live="polite">{announcement}</p>
    </div>
  );
}
