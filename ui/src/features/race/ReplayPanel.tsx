import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CircuitMap } from "../../components/CircuitMap";
import { Icon } from "../../components/Icon";
import { Panel } from "../../components/Panel";
import { Note, Tabs } from "../../components/Bits";
import type { Layout, RaceDetail } from "../../lib/data";
import { usePrefersReducedMotion } from "../../lib/motion";
import { haptic } from "../../lib/haptic";
import { buildReplay, pointAt, type DriverState } from "./replay";
import type { Row } from "./rows";

const ROW_H = 31;
const SPEEDS = ["45", "90", "180", "360"] as const;

interface Snapshot {
  t: number;
  states: DriverState[];
  gaps: Map<number, string>;
  lap: number;
  finished: boolean;
  stopped: boolean;
}

function clock(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return `${h}:${String(m).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}

/**
 * Replay of the real race. Lap times and end-of-lap positions are the record; the movement
 * between start-line crossings is interpolated, so the panel carries both tags.
 */
export function ReplayPanel({
  rows,
  detail,
  layout,
  lapLengthM,
  predicted,
}: {
  rows: Row[];
  detail: RaceDetail;
  layout: Layout | null;
  lapLengthM: number;
  predicted: number[];
}) {
  const reduce = usePrefersReducedMotion();
  const byId = useMemo(() => new Map(rows.map((r) => [r.driver.id, r])), [rows]);

  const model = useMemo(
    () =>
      buildReplay(
        detail.laps.d,
        rows.map((r) => ({
          id: r.driver.id,
          slot: r.grid,
          running: /^\d+$/.test(r.entry.txt),
          pits: (detail.pits[String(r.driver.id)] ?? []).map(([lap]) => lap),
        })),
        detail.laps.n,
        lapLengthM,
      ),
    [rows, detail, lapLengthM],
  );

  const tRef = useRef(0);
  const markers = useRef(new Map<number, SVGGElement>());
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState<(typeof SPEEDS)[number]>("90");
  const [halo, setHalo] = useState(true);
  const [hover, setHover] = useState<number | null>(null);
  const [snap, setSnap] = useState<Snapshot>(() => snapshot(0));

  function snapshot(t: number): Snapshot {
    const states = model.stateAt(t);
    const gaps = model.gapAt(t, states);
    const leader = model.leaderAt(t);
    return {
      t,
      states,
      gaps,
      lap: Math.min(model.totalLaps, leader.completed + 1),
      finished: t >= model.duration,
      stopped: model.stoppageAt(t),
    };
  }

  const paint = useCallback(
    (t: number, withState: boolean) => {
      const states = model.stateAt(t);
      if (layout) {
        for (const state of states) {
          const node = markers.current.get(state.id);
          if (!node) continue;
          if (state.s === null) {
            node.style.display = "none";
            continue;
          }
          node.style.display = "";
          const p = pointAt(layout.samples, state.s);
          node.setAttribute("transform", `translate(${p.x.toFixed(1)} ${p.y.toFixed(1)})`);
        }
      }
      if (withState) setSnap(snapshot(t));
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [model, layout],
  );

  // a new race or layout: back to the grid
  useEffect(() => {
    tRef.current = 0;
    setPlaying(false);
    paint(0, true);
  }, [model, layout, paint]);

  // animation loop
  useEffect(() => {
    if (!playing) return;
    let frame = 0;
    let last = performance.now();
    let lastState = 0;
    const tick = (now: number) => {
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      // a red-flag lap lasts an hour of real time: run through it fast instead of watching cars crawl
      const boost = model.stoppageAt(tRef.current) ? 14 : 1;
      tRef.current = Math.min(model.duration, tRef.current + dt * Number(speed) * boost);
      const slow = now - lastState > 100;
      paint(tRef.current, slow);
      if (slow) lastState = now;
      if (tRef.current >= model.duration) {
        paint(tRef.current, true);
        setPlaying(false);
        return;
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [playing, speed, model, paint]);

  const seek = (t: number) => {
    tRef.current = t;
    setPlaying(false);
    paint(t, true);
  };

  const order = [...snap.states].sort((a, b) => b.distance - a.distance);
  const position = new Map(order.map((s, i) => [s.id, i]));
  const rowsInOrder = order.map((s) => byId.get(s.id)).filter((r): r is Row => Boolean(r));
  const lapOf = snap.lap;
  const missing = rows.filter((r) => !model.drivers.some((d) => d.id === r.driver.id));

  return (
    <Panel
      eyebrow="Step 3 · After the flag"
      title="Race replay"
      tag={["record", "illustrative"]}
    >
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_21rem]">
        <div className="min-w-0">
          <div className="relative border border-line bg-tower px-3 py-4 sm:px-6 sm:py-6">
            {layout ? (
              <CircuitMap layout={layout} className="mx-auto block max-h-[520px] w-full" weight={0.9} label="Circuit with a marker for each car">
                {rows.map((row) => {
                  const id = row.driver.id;
                  const hot = halo && predicted.includes(id);
                  const focus = hover === id;
                  return (
                    <g
                      key={id}
                      ref={(node) => {
                        if (node) markers.current.set(id, node);
                        else markers.current.delete(id);
                      }}
                    >
                      {hot && <circle r={17} fill="none" stroke="#ff3b30" strokeWidth={3} strokeDasharray="5 4" />}
                      <circle r={focus ? 11 : 8.5} fill={row.colour} stroke="#0a0b0e" strokeWidth={2.5} />
                      {(hot || focus) && (
                        <text
                          y={-20}
                          textAnchor="middle"
                          fontSize={19}
                          fontWeight={700}
                          fill="#fff"
                          stroke="#0a0b0e"
                          strokeWidth={4}
                          paintOrder="stroke"
                          style={{ fontFamily: "var(--font-display)" }}
                        >
                          {row.driver.code}
                        </text>
                      )}
                    </g>
                  );
                })}
              </CircuitMap>
            ) : (
              <p className="grid min-h-48 place-items-center text-center text-steel">
                There is no verified outline for this layout, so the order is shown without a map.
              </p>
            )}
            <div className="absolute top-3 left-3 bg-tower/90 px-3 py-2 sm:top-5 sm:left-5">
              <p className="label">Lap</p>
              <p className="figure text-[2rem]">
                {Math.min(lapOf, model.totalLaps)}
                <span className="text-[1.1rem] text-mute"> / {model.totalLaps}</span>
              </p>
              <p className="mt-0.5 text-[0.8rem] text-mute tabular-nums">{clock(snap.t)}</p>
            </div>
            {snap.stopped && !snap.finished && (
              <p className="absolute right-3 bottom-3 bg-amber px-3 py-1.5 font-display text-[0.95rem] font-bold tracking-[0.1em] text-paper uppercase sm:right-5 sm:bottom-5">
                Race stopped · fast-forwarding
              </p>
            )}
            {snap.finished && (
              <p className="absolute top-3 right-3 flex items-center gap-2 bg-ink px-3 py-1.5 font-display text-[1rem] font-bold tracking-[0.12em] text-paper uppercase sm:top-5 sm:right-5">
                <Icon name="flag" size={16} /> Chequered flag
              </p>
            )}
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-3">
            <button
              type="button"
              className="btn !min-h-11"
              onClick={() => {
                haptic("select");
                if (tRef.current >= model.duration) {
                  tRef.current = 0;
                  paint(0, true);
                }
                setPlaying((p) => !p);
              }}
              aria-label={playing ? "Pause replay" : "Play replay"}
            >
              <Icon name={playing ? "pause" : "play"} size={18} /> {playing ? "Pause" : snap.t > 0 && !snap.finished ? "Resume" : snap.finished ? "Replay" : "Play"}
            </button>
            <button type="button" className="btn btn-ghost !min-h-11" onClick={() => seek(0)} aria-label="Back to the grid">
              <Icon name="skip" size={16} className="rotate-180" /> Grid
            </button>
            <Tabs
              value={speed}
              onChange={setSpeed}
              idPrefix="replay-speed"
              label="Replay speed"
              size="sm"
              options={SPEEDS.map((s) => ({ id: s, label: `${s}×` }))}
            />
            <label className="ml-auto flex cursor-pointer items-center gap-2 text-[0.95rem] text-steel">
              <input type="checkbox" checked={halo} onChange={(e) => setHalo(e.target.checked)} className="h-4 w-4 accent-[var(--color-signal)]" />
              Ring the model's predicted podium
            </label>
          </div>

          <div className="mt-4">
            <label className="label" htmlFor="replay-time">
              Race time
            </label>
            <input
              id="replay-time"
              type="range"
              min={0}
              max={Math.round(model.duration)}
              step={1}
              value={Math.round(snap.t)}
              onChange={(e) => seek(Number(e.target.value))}
              aria-valuetext={`Lap ${Math.min(lapOf, model.totalLaps)} of ${model.totalLaps}, ${clock(snap.t)}`}
              className="mt-2"
            />
          </div>
        </div>

        <div>
          <p className="label mb-2">Timing tower · gap measured at the leader's last lap</p>
          <ul className="relative" style={{ height: rowsInOrder.length * ROW_H }} aria-label="Race order">
            {rowsInOrder.map((row) => {
              const state = snap.states.find((s) => s.id === row.driver.id)!;
              const i = position.get(row.driver.id) ?? 0;
              const hot = halo && predicted.includes(row.driver.id);
              const gap = snap.gaps.get(row.driver.id) ?? "";
              return (
                <li
                  key={row.driver.id}
                  className="absolute inset-x-0 transition-transform duration-300 ease-out motion-reduce:transition-none"
                  style={{ transform: `translateY(${i * ROW_H}px)`, height: ROW_H }}
                  onPointerEnter={() => setHover(row.driver.id)}
                  onPointerLeave={() => setHover(null)}
                >
                  <div
                    className={`flex h-[27px] items-center gap-2 border-l-[3px] bg-panel px-2 ${state.out ? "opacity-45" : ""}`}
                    style={{ borderColor: hot ? "#ff3b30" : "transparent" }}
                  >
                    <span className="figure w-5 text-right text-[1.05rem] text-steel">{i + 1}</span>
                    <span className="h-4 w-1 shrink-0" style={{ background: row.colour }} aria-hidden />
                    <span className="w-9 font-display text-[1rem] leading-none font-bold tracking-wide uppercase">{row.driver.code}</span>
                    <span className="ml-auto flex items-center gap-1.5 text-[0.8rem] tabular-nums text-steel">
                      {state.inPit && !state.out && <span className="bg-amber px-1 font-display text-[0.7rem] font-bold text-paper">PIT</span>}
                      {state.out ? <span className="text-mute">OUT L{state.k}</span> : gap}
                    </span>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      </div>

      <div className="mt-6 space-y-2">
        <Note>
          Real: every lap time and the position at the end of every lap, from lap_times.csv. Interpolated: each car moves at a constant
          speed between start-line crossings, because a lap time does not say where the car was inside the lap. Pit stops appear as a
          slower lap, not as a pit-lane visit. A red-flag stoppage lasts one very long lap in the data, so the replay fast-forwards through it. {reduce ? "Motion is paused until you press play." : ""}
        </Note>
        <Note>
          Cars disappear after their last recorded lap because the data does not say where they stopped. The red ring marks the model's
          predicted podium; it is the pre-race prediction, not something the replay computes.
          {missing.length > 0 ? ` No lap data exists for ${missing.map((m) => m.driver.code).join(", ")}.` : ""}
        </Note>
      </div>
    </Panel>
  );
}
