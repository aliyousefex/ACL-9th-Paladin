import { useMemo } from "react";
import { CircuitMap, useMapUnit } from "../../components/CircuitMap";
import { StartLights } from "../../components/StartLights";
import { VectorRaceCar } from "../../components/VectorRaceCar";
import type { Layout } from "../../lib/data";
import { initialView, viewBoxFor } from "../../lib/mapView";
import { pointAt } from "../race/replay";
import { TOP, brakeCue, gapSeconds, gridOrder, lapOf, orderOf, playerIndex, type RaceState } from "./raceEngine";
import type { Camera } from "./GrandPrixSetup";
import { gapPlain, gapText, lapText, towerWindow } from "./grandPrixView";

export type RacePhase = "lights" | "race" | "paused";

const FOLLOW_ZOOM = 3.2;

export interface RaceViewProps {
  state: RaceState;
  layout: Layout;
  phase: RacePhase;
  /** Start lights showing, 0 to 5. */
  lit: number;
  /** The lights have gone out and the race is on. */
  go: boolean;
  throttle: boolean;
  camera: Camera;
  /** A short race-control message, such as a rival running wide. */
  notice: string | null;
  onThrottle: (on: boolean) => void;
  onPause: () => void;
  onResume: () => void;
  onRetire: () => void;
  onCamera: (camera: Camera) => void;
}

/** The race itself: the circuit, every car, the timing tower and the driver's controls. */
export function GrandPrixRace(props: RaceViewProps) {
  const { state, layout, phase } = props;
  const me = playerIndex(state);
  const order = useMemo(() => orderOf(state), [state]);
  const position = order.indexOf(me) + 1;
  const car = state.cars[me];
  const entrant = state.entrants[me];
  const [w, h] = layout.viewBox;
  const grid = useMemo(() => new Map(gridOrder(state.entrants).map((index, i) => [index, i + 1])), [state.entrants]);

  const here = pointAt(layout.samples, car.s - Math.floor(car.s));
  const box = props.camera === "follow" ? viewBoxFor({ k: FOLLOW_ZOOM, cx: here.x, cy: here.y }, w, h) : viewBoxFor(initialView(w, h), w, h);
  const ahead = position > 1 ? order[position - 2] : null;
  const behind = position < order.length ? order[position] : null;
  const cue = state.config.assist !== "assisted" && phase === "race" && brakeCue(state.track, car.s, car.v);
  const speed = Math.round((car.v / TOP) * 100);
  const started = grid.get(me) ?? position;
  const delta = started - position;
  const leaderIdx = order[0];

  return (
    <div className="grid xl:grid-cols-[minmax(0,1fr)_17rem]">
      <div className="min-w-0">
        <div className="relative border-b border-line bg-tower xl:border-r">
          <div className="px-2 pt-[5.2rem] pb-[4.6rem] sm:px-6">
          <CircuitMap layout={layout} className="mx-auto block h-[20rem] w-full sm:h-[26rem]"  weight={0.85} corners={false} box={box} maxHeight={520} label={`Race on a real circuit outline. You are P${position} of ${order.length}, ${lapText(lapOf(car, state.config.laps), state.config.laps)}.`}>
            <Cars state={state} samples={layout.samples} order={order} me={me} />
          </CircuitMap>
          </div>

          {/* HUD */}
          <div className="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between gap-2 p-3 sm:p-4">
            <div className="bg-tower/90 px-2.5 py-2 whitespace-nowrap sm:px-3">
              <p className="label !text-[0.68rem]" data-hud="lap">{lapText(lapOf(car, state.config.laps), state.config.laps)}</p>
              <p className="font-display text-[0.9rem] font-bold tracking-wide text-ink uppercase">
                {entrant.code}
                <span className="hidden sm:inline"> · {entrant.team}</span>
              </p>
            </div>
            <div className="bg-tower/90 px-3 py-1.5 text-center whitespace-nowrap sm:px-4" aria-hidden>
              <p className="figure text-[2.6rem] leading-none sm:text-[3.2rem]" data-hud="position" style={{ color: position === 1 ? "var(--color-gold)" : undefined }}>P{position}</p>
              <p className={`text-[0.72rem] font-semibold tracking-wide uppercase ${delta > 0 ? "text-hit" : delta < 0 ? "text-signal-text" : "text-mute"}`}>
                {delta > 0 ? `▲ ${delta}` : delta < 0 ? `▼ ${-delta}` : `Started P${started}`}
                {delta !== 0 && <span className="hidden sm:inline"> from the grid</span>}
              </p>
            </div>
            <div className="bg-tower/90 px-2.5 py-2 text-right whitespace-nowrap sm:min-w-[7rem] sm:px-3" aria-hidden>
              <p className="label !text-[0.68rem]">{ahead === null ? (behind === null ? "Alone" : `Lead over ${state.entrants[behind].code}`) : `Behind ${state.entrants[ahead].code}`}</p>
              <p className="figure text-[1.35rem]">{ahead === null ? (behind === null ? "–" : gapPlain(gapSeconds(state, behind, me))) : gapPlain(gapSeconds(state, me, ahead))}</p>
            </div>
          </div>

          {props.notice && phase === "race" && (
            <p className="pointer-events-none absolute inset-x-0 top-[4.9rem] mx-auto w-fit max-w-[90%] bg-amber px-3 py-1 text-center font-display text-[0.95rem] font-bold tracking-[0.08em] text-paper uppercase" aria-hidden>
              {props.notice}
            </p>
          )}
          <div className="pointer-events-none absolute inset-x-0 bottom-0 flex items-end justify-between gap-3 p-3 sm:p-4">
            <div className="w-40 bg-tower/90 px-3 py-2" aria-hidden>
              <div className="flex items-baseline justify-between">
                <span className="label !text-[0.68rem]">Speed</span>
                <span className="figure text-[1.1rem]" data-hud="speed">{speed}</span>
              </div>
              <span className="mt-1 block h-2 bg-line">
                <span className="block h-2 transition-[width] duration-100 motion-reduce:transition-none" style={{ width: `${Math.min(100, speed)}%`, background: props.throttle ? "var(--color-hit)" : entrant.colour }} />
              </span>
              <p className="mt-1 text-[0.7rem] font-semibold tracking-wide text-mute uppercase">{props.throttle ? "Accelerating" : "Braking"}</p>
            </div>
            {cue ? (
              <p className="bg-signal px-4 py-2 font-display text-[1.3rem] font-bold tracking-[0.1em] text-white uppercase" role="status">Brake</p>
            ) : state.config.assist === "assisted" && phase === "race" ? (
              <p className="bg-panel2/90 px-3 py-2 text-[0.8rem] text-steel">The car brakes for corners for you</p>
            ) : null}
          </div>

          {props.go && phase === "race" && (
            <p className="pointer-events-none absolute inset-x-0 top-1/3 text-center" role="status">
              <span className="display bg-hit px-6 py-2 text-[3rem] text-paper sm:text-[4rem]">Go</span>
            </p>
          )}
          {phase === "lights" && (
            <div className="absolute inset-0 grid place-items-center bg-tower/70">
              <div className="text-center">
                <div className="flex justify-center">
                  <StartLights lit={props.lit} className="h-10 w-5 sm:h-12 sm:w-6" />
                </div>
                <p className="display mt-4 text-[2rem] sm:text-[2.6rem]">{props.lit === 0 ? "Get ready" : props.lit < 5 ? "Lights" : "Wait for it"}</p>
                <p className="mt-1 text-[0.9rem] text-steel">Hold the throttle the moment they go out.</p>
              </div>
            </div>
          )}
          {phase === "paused" && (
            <div className="absolute inset-0 grid place-items-center bg-tower/85 p-4">
              <div className="w-full max-w-xs text-center">
                <p className="display text-[2.4rem]">Paused</p>
                <div className="mt-4 grid gap-2">
                  <button type="button" className="btn min-h-12" onClick={props.onResume} autoFocus>Resume</button>
                  <button type="button" className="btn btn-ghost min-h-12" onClick={props.onRetire}>Retire from the race</button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Controls */}
        <div className="grid gap-3 p-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-stretch sm:p-5">
          <button
            type="button"
            disabled={phase === "paused"}
            data-throttle
            aria-label="Throttle. Press and hold to accelerate, release to brake."
            className={`min-h-16 select-none border px-4 font-display text-[1.3rem] font-bold tracking-[0.08em] uppercase transition-colors disabled:opacity-50 ${props.throttle ? "border-hit bg-hit text-paper" : "border-line2 bg-panel text-ink hover:border-steel"}`}
            style={{ touchAction: "none" }}
            onContextMenu={(event) => event.preventDefault()}
            onPointerDown={(event) => {
              event.currentTarget.setPointerCapture(event.pointerId);
              props.onThrottle(true);
            }}
            onPointerUp={() => props.onThrottle(false)}
            onPointerCancel={() => props.onThrottle(false)}
            onLostPointerCapture={() => props.onThrottle(false)}
          >
            {props.throttle ? "Accelerating · release to brake" : "Hold to accelerate"}
          </button>
          <div className="flex gap-2">
            <button type="button" className="btn btn-ghost !min-h-16 flex-1 !px-4" onClick={phase === "paused" ? props.onResume : props.onPause}>
              {phase === "paused" ? "Resume" : "Pause"}
            </button>
            <button type="button" className="btn btn-ghost !min-h-16 flex-1 !px-4" onClick={() => props.onCamera(props.camera === "follow" ? "track" : "follow")} aria-pressed={props.camera === "follow"}>
              {props.camera === "follow" ? "Whole track" : "Follow car"}
            </button>
          </div>
        </div>
        <p className="px-4 pb-4 text-[0.78rem] text-mute sm:px-5">Keyboard: hold Space or the Up arrow to accelerate, release to brake, P to pause.</p>

        {/* Nearby rivals, for screens too narrow for the tower */}
        <ul className="grid grid-cols-3 gap-px border-t border-line bg-line text-center xl:hidden" aria-label="Cars around you">
          {[ahead, me, behind].map((index, slot) =>
            index === null ? (
              <li key={slot} className="bg-panel px-2 py-2 text-[0.8rem] text-mute">{slot === 0 ? "Leading" : "Last"}</li>
            ) : (
              <li key={slot} className={`bg-panel px-2 py-2 ${index === me ? "!bg-panel2" : ""}`}>
                <span className="block font-display text-[1.05rem] font-bold uppercase" style={{ color: index === me ? "var(--color-ink)" : undefined }}>
                  <span className="mr-1 text-mute">P{order.indexOf(index) + 1}</span>
                  {state.entrants[index].code}
                </span>
                <span className="block text-[0.72rem] text-mute">{index === me ? "You" : slot === 0 ? `${gapPlain(gapSeconds(state, me, index))} ahead` : `${gapPlain(gapSeconds(state, index, me))} behind`}</span>
              </li>
            ),
          )}
        </ul>
      </div>

      {/* Timing tower */}
      <aside className="hidden border-l border-line bg-panel p-3 xl:block" aria-label="Live timing">
        <p className="label px-1 pb-2">Live timing</p>
        <ol className="space-y-px">
          {towerWindow(order.length, position, 11).map((row, i) => {
            if (row.kind === "gap") return <li key={`gap-${i}`} className="px-2 py-0.5 text-center text-[0.8rem] text-mute" aria-hidden>···</li>;
            const index = order[row.position - 1];
            const e = state.entrants[index];
            const c = state.cars[index];
            const startedAt = grid.get(index) ?? row.position;
            const moved = startedAt - row.position;
            const lead = state.cars[leaderIdx];
            const gapToLeader = row.position === 1 ? null : c.finishedAt !== null && lead.finishedAt !== null ? c.finishedAt - lead.finishedAt : Math.abs(lead.s - c.s) / Math.max(0.02, lead.v);
            return (
              <li key={e.id} className={`grid grid-cols-[1.6rem_0.3rem_minmax(0,1fr)_2.4rem_3.3rem] items-center gap-1.5 px-2 py-1 ${index === me ? "bg-ink text-paper" : "bg-tower"}`}>
                <span className="figure text-right text-[1.05rem]">{row.position}</span>
                <span className="h-4 w-1" style={{ background: e.colour }} aria-hidden />
                <span className="truncate font-display text-[1rem] font-bold uppercase">{e.code}</span>
                <span className={`text-[0.72rem] font-semibold ${index === me ? "text-paper/70" : moved > 0 ? "text-hit" : moved < 0 ? "text-signal-text" : "text-mute"}`} aria-hidden>
                  {moved > 0 ? `▲${moved}` : moved < 0 ? `▼${-moved}` : "–"}
                </span>
                <span className={`text-right text-[0.78rem] tabular-nums ${index === me ? "text-paper/80" : "text-steel"}`}>{gapToLeader === null ? "Leader" : gapText(gapToLeader)}</span>
              </li>
            );
          })}
        </ol>
        <p className="mt-3 px-1 text-[0.72rem] leading-snug text-mute">▲ ▼ show places gained or lost since the start. Gaps are rough: distance to the leader at the leader's current speed.</p>
      </aside>
    </div>
  );
}

/** Every car on the circuit, drawn as the original vector car in team colours, rotated along the track. */
function Cars({ state, samples, order, me }: { state: RaceState; samples: [number, number][]; order: number[]; me: number }) {
  const unit = useMapUnit();
  // Everyone else first, the player's car on top.
  const draw = [...order].reverse().filter((i) => i !== me).concat(me);
  return (
    <>
      {draw.map((index) => {
        const e = state.entrants[index];
        const c = state.cars[index];
        if (c.retired) return null;
        const p = pointAt(samples, c.s - Math.floor(c.s));
        const mine = index === me;
        const lane = ((index % 3) - 1) * Math.min(5 * unit, 6);
        const rad = (p.angle * Math.PI) / 180;
        const x = p.x - Math.sin(rad) * lane;
        const y = p.y + Math.cos(rad) * lane;
        const scale = ((mine ? 26 : 18) * unit) / 30;
        return (
          <g key={e.id} transform={`translate(${x} ${y})`} opacity={c.finishedAt !== null && !mine ? 0.55 : 1}>
            <VectorRaceCar colour={e.colour} ink={e.ink} number={null} angle={p.angle} scale={scale} selected={mine} />
            {mine && (
              <text y={-20 * unit} textAnchor="middle" fontSize={13 * unit} fontWeight={700} fill="#fff" stroke="#0a0b0e" strokeWidth={3 * unit} paintOrder="stroke" style={{ fontFamily: "var(--font-display)" }}>
                {e.code}
              </text>
            )}
          </g>
        );
      })}
    </>
  );
}
