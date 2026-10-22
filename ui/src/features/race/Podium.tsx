import { useEffect, useState, type CSSProperties } from "react";
import { Icon } from "../../components/Icon";
import { Portrait } from "../../components/Portrait";
import { Panel } from "../../components/Panel";
import { usePrefersReducedMotion } from "../../lib/motion";
import { THRESHOLD } from "../../lib/model";
import { PLACE_COLOURS, bandRate, finishLabel, useCountUp, type Row } from "./rows";

/**
 * The predicted podium: the three drivers with the highest podium score.
 *
 * The model answers "podium or not" for each driver. It does not predict finishing order, so
 * the steps follow score rank and the caption says so.
 */

type Phase = "lights" | "rise" | "done";

const ORDER = [1, 0, 2]; // left to right on a real podium: P2, P1, P3
const STEP = [
  "[--step-h:215px] sm:[--step-h:290px]",
  "[--step-h:185px] sm:[--step-h:245px]",
  "[--step-h:160px] sm:[--step-h:210px]",
];

export function Podium({
  top,
  runKey,
  onRun,
  revealed,
}: {
  top: Row[];
  runKey: number;
  onRun: () => void;
  /** After the chequered flag: show where each predicted driver actually finished. */
  revealed: boolean;
}) {
  const reduce = usePrefersReducedMotion();
  const [phase, setPhase] = useState<Phase>(reduce ? "done" : "lights");
  const [lit, setLit] = useState(reduce ? 5 : 0);

  useEffect(() => {
    if (reduce) {
      setPhase("done");
      setLit(5);
      return;
    }
    setPhase("lights");
    setLit(0);
    const timers: number[] = [];
    for (let i = 1; i <= 5; i++) timers.push(window.setTimeout(() => setLit(i), i * 260));
    timers.push(window.setTimeout(() => setLit(0), 5 * 260 + 380)); // lights out
    timers.push(window.setTimeout(() => setPhase("rise"), 5 * 260 + 420));
    timers.push(window.setTimeout(() => setPhase("done"), 5 * 260 + 420 + 1500));
    return () => timers.forEach(window.clearTimeout);
  }, [runKey, reduce]);

  const showSteps = phase !== "lights";
  const winner = top[0];

  return (
    <Panel
      eyebrow="Step 2 · The model runs at lights out"
      title="Predicted podium"
      tag="model"
      actions={
        <button type="button" className="btn btn-ghost !min-h-9 !px-3 !text-[0.95rem]" onClick={onRun}>
          <Icon name="replay" size={16} /> Replay
        </button>
      }
    >
      <div className="relative">
        {/* start lights */}
        <div className="mb-3 flex justify-center gap-2.5 sm:mb-5" aria-hidden>
          {[0, 1, 2, 3, 4].map((i) => (
            <span
              key={i}
              className={`h-3.5 w-3.5 rounded-full transition-colors duration-100 sm:h-5 sm:w-5 ${
                i < lit ? "bg-signal shadow-[0_0_14px_rgba(225,6,0,.7)]" : "bg-line"
              }`}
            />
          ))}
        </div>

        <ol
          className="mx-auto grid max-w-[780px] grid-cols-3 items-end gap-2 sm:gap-4"
          aria-label="Predicted podium, ranked by podium score"
        >
          {ORDER.map((idx, col) => {
            const row = top[idx];
            if (!row) return <li key={col} />;
            const place = idx + 1;
            return (
              <PodiumStep
                key={row.driver.id}
                row={row}
                place={place}
                show={showSteps}
                revealed={revealed}
                delay={(3 - place) * 280}
                run={phase !== "lights"}
              />
            );
          })}
        </ol>
      </div>

      <div className="mx-auto mt-6 grid max-w-[780px] gap-4 border-t border-line pt-4 text-[0.95rem] leading-snug text-steel sm:grid-cols-2">
        <p>
          <span className="font-semibold text-ink">Read the steps as a ranking, not a finishing order.</span> The model decides
          podium or not for each driver. It was never trained to say who wins, so P1 here means the highest podium score
          {winner ? ` (${winner.driver.last}).` : "."}
        </p>
        <p>
          A score is the model's output for that driver, not a calibrated probability. The cutoff chosen on the 2020–21
          validation seasons is {THRESHOLD.toFixed(3)}.
        </p>
      </div>
    </Panel>
  );
}

function PodiumStep({
  row,
  place,
  show,
  revealed,
  delay,
  run,
}: {
  row: Row;
  place: number;
  show: boolean;
  revealed: boolean;
  delay: number;
  run: boolean;
}) {
  const score = useCountUp(row.score, run, 1100);
  const band = bandRate(row.score);
  const style = { "--delay": `${delay}ms` } as CSSProperties;
  const hit = revealed && row.podium;

  return (
    <li className="flex min-w-0 flex-col items-stretch" style={style}>
      {/* driver card above the step */}
      <div className={`mb-2 flex flex-col items-center text-center ${show ? "pop-in" : "opacity-0"}`} style={{ "--delay": `${delay + 450}ms` } as CSSProperties}>
        <Portrait
          driver={row.driver}
          colour={row.colour}
          number={row.entry.n}
          className="h-[68px] w-[68px] border-2 sm:h-[112px] sm:w-[112px]"
          rounded
          eager
          label={`${row.driver.name}, ${row.team.short}`}
        />
        <p className="mt-2 w-full truncate font-display text-[0.82rem] leading-none font-semibold tracking-[0.1em] text-mute uppercase sm:text-[0.95rem]">
          {row.team.short}
        </p>
        <p className="mt-1 w-full truncate font-display text-[1.15rem] leading-none font-bold tracking-[-0.01em] uppercase sm:text-[1.7rem]">
          <span className="hidden sm:inline">{row.driver.first} </span>
          {row.driver.last}
        </p>
      </div>

      {/* the step */}
      <div className={`relative h-[var(--step-h)] ${STEP[place - 1]}`}>
        <div
          className={`absolute inset-0 ${show ? "rise" : "scale-y-0"}`}
          style={{
            ...style,
            background: `linear-gradient(180deg, ${row.colour}33 0%, #11151b 38%, #0b0e12 100%)`,
            borderTop: `4px solid ${row.colour}`,
            boxShadow: "inset 0 0 0 1px #262b33",
          }}
        />
        <div className={`relative flex h-full flex-col items-center justify-between px-1 pt-2 pb-3 sm:pt-3 ${show ? "pop-in" : "opacity-0"}`} style={{ "--delay": `${delay + 650}ms` } as CSSProperties}>
          <span
            className="figure select-none text-[3.6rem] leading-[0.8] sm:text-[6.4rem]"
            style={{ color: PLACE_COLOURS[place - 1] }}
            aria-hidden
          >
            {place}
          </span>
          <div className="w-full text-center">
            <p className="label !text-[0.7rem] sm:!text-[0.8rem]">Podium score</p>
            <p className="figure text-[1.9rem] sm:text-[2.7rem]">{score.toFixed(2)}</p>
          </div>
        </div>
      </div>
      <div className="mt-2 min-h-[3.6rem] text-center">
        {band.n > 0 && (
          <p className="text-[0.78rem] leading-tight text-mute sm:text-[0.85rem]">
            {Math.round(band.rate * 100)}% of 2022–24 scores in {band.lo.toFixed(1)}–{band.hi.toFixed(1)} finished top 3
          </p>
        )}
        {revealed && (
          <p className={`mt-1.5 inline-flex items-center gap-1 text-[0.85rem] font-semibold sm:text-[0.95rem] ${hit ? "text-hit" : "text-signal-text"}`}>
            <Icon name={hit ? "check" : "cross"} size={16} strokeWidth={2.6} />
            {finishLabel(row)}
          </p>
        )}
      </div>
    </li>
  );
}
