import { useEffect, useMemo, useRef, useState } from "react";
import { CircuitMap } from "../../components/CircuitMap";
import { VectorRaceCar } from "../../components/VectorRaceCar";
import { RACE_CIRCUITS, currentLayout, loadLayout, useResource } from "../../lib/data";
import { usePrefersReducedMotion } from "../../lib/motion";
import { pointAt } from "../race/replay";
import { advanceAttack, curvatureAt, ghostProgressAt, ghostTimeAt, initialAttackState, type GhostSample } from "./driving";

const TRACKS = RACE_CIRCUITS.filter((circuit) => currentLayout(circuit).file).slice(0, 4);

export function TimeAttack() {
  const reduce = usePrefersReducedMotion();
  const [circuitId, setCircuitId] = useState(TRACKS[0]?.circuitId ?? 0);
  const circuit = TRACKS.find((item) => item.circuitId === circuitId) ?? TRACKS[0];
  const meta = currentLayout(circuit);
  const layout = useResource(meta.id, () => loadLayout(meta.id));
  const [state, setState] = useState(initialAttackState);
  const [running, setRunning] = useState(false);
  const [throttle, setThrottle] = useState(false);
  const throttleRef = useRef(false);
  const traceRef = useRef<GhostSample[]>([]);
  const bestKey = `paladin:track-attack:${meta.id}`;
  const [best, setBest] = useState<number | null>(() => readBest(bestKey));
  const [ghost, setGhost] = useState<GhostSample[]>(() => readGhost(bestKey));
  const [showGhost, setShowGhost] = useState(true);
  const total = state.elapsed + state.penalty;

  useEffect(() => {
    setState(initialAttackState());
    setRunning(false);
    setThrottle(false);
    throttleRef.current = false;
    traceRef.current = [];
    setBest(readBest(bestKey));
    setGhost(readGhost(bestKey));
  }, [bestKey]);

  useEffect(() => {
    if (!running || !layout.data) return;
    const timer = window.setInterval(() => {
      setState((current) => {
        const next = advanceAttack(current, throttleRef.current, layout.data!.samples, reduce ? 0.12 : 0.05);
        traceRef.current.push({ time: next.elapsed + next.penalty, progress: next.progress });
        if (next.finished) setRunning(false);
        return next;
      });
    }, reduce ? 180 : 50);
    return () => window.clearInterval(timer);
  }, [running, layout.data, reduce]);

  useEffect(() => {
    if (!state.finished || (best !== null && total >= best)) return;
    setBest(total);
    const nextGhost = [...traceRef.current];
    setGhost(nextGhost);
    try {
      localStorage.setItem(bestKey, String(total));
      localStorage.setItem(`${bestKey}:ghost`, JSON.stringify(nextGhost));
    } catch { /* result remains visible */ }
  }, [state.finished, total, best, bestKey]);

  useEffect(() => {
    if (!running) return;
    const down = (event: KeyboardEvent) => {
      if (event.code !== "Space") return;
      event.preventDefault();
      throttleRef.current = true;
      setThrottle(true);
    };
    const up = (event: KeyboardEvent) => {
      if (event.code !== "Space") return;
      event.preventDefault();
      throttleRef.current = false;
      setThrottle(false);
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => { window.removeEventListener("keydown", down); window.removeEventListener("keyup", up); };
  }, [running]);

  const point = useMemo(() => layout.data ? pointAt(layout.data.samples, state.progress) : null, [layout.data, state.progress]);
  const ghostProgress = showGhost ? ghostProgressAt(ghost, total) : 0;
  const ghostPoint = useMemo(() => layout.data && ghost.length > 0 && showGhost ? pointAt(layout.data.samples, ghostProgress) : null, [layout.data, ghost, showGhost, ghostProgress]);
  const ghostTime = ghostTimeAt(ghost, state.progress);
  const delta = ghostTime === null ? null : total - ghostTime;
  const curve = layout.data ? curvatureAt(layout.data.samples, state.progress) : 0;
  const zone = curve > 0.55 ? "Heavy corner" : curve > 0.22 ? "Technical section" : "Open throttle";
  const begin = () => {
    setState(initialAttackState());
    setThrottle(false);
    throttleRef.current = false;
    traceRef.current = [{ time: 0, progress: 0 }];
    setRunning(true);
  };

  return (
    <div className="panel mt-6 overflow-hidden">
      <div className="grid lg:grid-cols-[minmax(0,1.35fr)_22rem]">
        <div className="relative min-h-[28rem] border-b border-line bg-tower p-5 lg:border-r lg:border-b-0 sm:p-8">
          {layout.data && point ? (
            <CircuitMap layout={layout.data} className="mx-auto h-[26rem] w-full" weight={0.85} corners={false} label={`Illustrative track attack on ${circuit.name}`}>
              {ghostPoint && (
                <g opacity={0.48} transform={`translate(${ghostPoint.x} ${ghostPoint.y}) rotate(${ghostPoint.angle})`}>
                  <VectorRaceCar colour="#c5cad1" ink="#090a0c" number={0} scale={0.9} />
                </g>
              )}
              <g transform={`translate(${point.x} ${point.y}) rotate(${point.angle})`}>
                <VectorRaceCar colour="#e10600" ink="#ffffff" number={9} scale={1.05} selected={running} />
              </g>
            </CircuitMap>
          ) : <p className="grid h-[26rem] place-items-center text-steel">{layout.error ? "This circuit could not be loaded." : "Loading verified circuit geometry…"}</p>}
          <div className="absolute top-4 left-4 bg-tower/95 px-3 py-2">
            <p className="label">Track progress</p>
            <p className="figure text-[1.8rem]">{Math.round(state.progress * 100)}%</p>
          </div>
          <div className={`absolute right-4 bottom-4 px-3 py-2 text-right ${curve > 0.55 ? "bg-signal text-white" : "bg-panel2 text-ink"}`} aria-live="polite">
            <p className="font-display text-[0.9rem] font-bold uppercase">{zone}</p>
            <p className={`text-[0.75rem] ${curve > 0.55 ? "text-white/80" : "text-mute"}`}>{throttle ? "Throttle applied" : "Coasting"}</p>
          </div>
        </div>

        <div className="flex flex-col p-5 sm:p-6">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className="display text-[1.9rem]">Time attack</h3>
              <p className="mt-2 text-[0.88rem] leading-snug text-mute">Hold throttle on the straights. Release before tight geometry or collect a 1.5-second off-track penalty.</p>
            </div>
            <span className="tag tag-illus">Solo lap</span>
          </div>

          <label className="label mt-6" htmlFor="attack-track">Verified circuit</label>
          <select id="attack-track" className="select mt-2 w-full" value={circuitId} disabled={running} onChange={(event) => setCircuitId(Number(event.target.value))}>
            {TRACKS.map((item) => <option key={item.circuitId} value={item.circuitId}>{item.name}</option>)}
          </select>
          <label className="mt-3 flex min-h-10 items-center justify-between gap-3 border-y border-line py-2 text-[0.86rem] text-steel">
            <span>Show personal-best ghost</span>
            <input type="checkbox" checked={showGhost} disabled={ghost.length === 0} onChange={(event) => setShowGhost(event.target.checked)} />
          </label>

          <dl className="mt-6 grid grid-cols-2 gap-px bg-line">
            <Readout label="Running time" value={`${total.toFixed(2)}s`} />
            <Readout label="Penalties" value={`${state.incidents} · ${state.penalty.toFixed(1)}s`} />
            <Readout label="Speed index" value={Math.round(state.speed * 1000).toString()} />
            <Readout label="Ghost delta" value={delta === null || !running ? "—" : `${delta >= 0 ? "+" : ""}${delta.toFixed(2)}s`} tone={delta !== null && delta < 0 ? "good" : delta !== null && delta > 0 ? "bad" : undefined} />
            <Readout label="Local best" value={best === null ? "—" : `${best.toFixed(2)}s`} />
            <Readout label="Ghost trace" value={ghost.length === 0 ? "Not set" : `${ghost.length} samples`} />
          </dl>

          <div className="mt-auto pt-6">
            {state.finished ? (
              <div className="mb-4 border-y border-line py-3" role="status"><p className="font-display text-[1.2rem] font-bold uppercase">Lap complete · {total.toFixed(2)} seconds</p><p className="mt-1 text-[0.8rem] text-mute">{state.incidents === 0 ? "Clean lap" : `${state.incidents} off-track ${state.incidents === 1 ? "penalty" : "penalties"}`}</p></div>
            ) : null}
            {!running ? (
              <button type="button" className="btn min-h-14 w-full !text-[1.1rem]" disabled={!layout.data} onClick={begin}>{state.finished ? "Run another lap" : "Start flying lap"}</button>
            ) : (
              <button
                type="button"
                className={`btn min-h-16 w-full select-none !text-[1.15rem] ${throttle ? "!bg-hit !text-paper" : ""}`}
                onPointerDown={() => { throttleRef.current = true; setThrottle(true); }}
                onPointerUp={() => { throttleRef.current = false; setThrottle(false); }}
                onPointerCancel={() => { throttleRef.current = false; setThrottle(false); }}
                onPointerLeave={() => { throttleRef.current = false; setThrottle(false); }}
              >
                {throttle ? "Throttle · release to coast" : "Hold for throttle"}
              </button>
            )}
            <p className="mt-3 text-center text-[0.78rem] text-mute">Touch, mouse, or hold Space · illustrative handling rules</p>
          </div>
        </div>
      </div>
    </div>
  );
}

function readBest(key: string): number | null {
  try { return Number(localStorage.getItem(key)) || null; } catch { return null; }
}

function readGhost(key: string): GhostSample[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(`${key}:ghost`) ?? "[]");
    return Array.isArray(parsed) && parsed.every((item) => Number.isFinite(item?.time) && Number.isFinite(item?.progress)) ? parsed : [];
  } catch { return []; }
}

function Readout({ label, value, tone }: { label: string; value: string; tone?: "good" | "bad" }) {
  return <div className="bg-panel p-3"><dt className="label !text-[0.68rem]">{label}</dt><dd className={`figure mt-1 text-[1.35rem] ${tone === "good" ? "text-hit" : tone === "bad" ? "text-signal-text" : ""}`}>{value}</dd></div>;
}
