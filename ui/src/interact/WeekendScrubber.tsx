import { useEffect, useRef, useState } from "react";
import site from "../data/site.json";
import { StartLights } from "../components/StartLights";
import { haptic } from "../lib/haptic";

const STAGES = [
  {
    label: "Practice",
    summary: "Context, recent form, and last race's standings are already known. Qualifying and the grid are not.",
  },
  {
    label: "Qualifying",
    summary: "Qualifying order and the best session time are in. A penalty can still change the grid.",
  },
  {
    label: "Grid",
    summary: "The final grid is set, including a pit-lane start. The race has not begun.",
  },
  {
    label: "Lights out",
    summary: "Every model input is available. The result is not an input.",
  },
  {
    label: "Race",
    summary: "Laps, pits, and status are happening. They stay off this row.",
  },
  {
    label: "Classification",
    summary: "The finish is public. It is the label, and it is still not an input.",
  },
] as const;

const KNOWN = [
  { label: "Age and year", from: 0 },
  { label: "Podium rate over the previous five races", from: 0 },
  { label: "Starts already done", from: 0 },
  { label: "Points and rank from the previous race", from: 0 },
  { label: "Qualifying order, time, and whether it is missing", from: 1 },
  { label: "Grid position, pit-lane flag, front row, and field size", from: 2 },
];

export function WeekendScrubber() {
  const [index, setIndex] = useState(3);
  const [lit, setLit] = useState(5);
  const [running, setRunning] = useState(false);
  const timers = useRef<number[]>([]);
  const stage = STAGES[index];

  const clearRun = () => {
    timers.current.forEach((timer) => window.clearTimeout(timer));
    timers.current = [];
  };

  useEffect(() => clearRun, []);

  const go = (next: number) => {
    clearRun();
    setRunning(false);
    setIndex(next);
    setLit(next === 3 ? 5 : 0);
    haptic(next === 3 ? "lights" : "step");
  };

  const runStart = () => {
    if (running) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) {
      setIndex(4);
      setLit(0);
      haptic("lights");
      return;
    }
    clearRun();
    setRunning(true);
    setIndex(2);
    setLit(0);
    haptic("select");
    let at = 380;
    for (let count = 1; count <= 5; count += 1) {
      const lights = count;
      timers.current.push(
        window.setTimeout(() => {
          setIndex(3);
          setLit(lights);
        }, at),
      );
      at += 260;
    }
    timers.current.push(
      window.setTimeout(() => {
        setIndex(4);
        setLit(0);
        setRunning(false);
        haptic("lights");
      }, at + 720),
    );
  };

  return (
    <div>
      <p className="max-w-[62ch] text-steel">
        Run the start. Five lights come on, hold, then go out together. While they are held, the row is complete. When they go out, the race is underway, and the struck list is still not an input.
      </p>
      <div className="mt-6 flex flex-wrap items-end justify-between gap-6">
        <p className="sr-only" aria-live="polite">
          {stage.label}. {stage.summary}
        </p>
        <div className="min-w-[min(100%,16rem)] flex-1">
          <p className="figure text-[2rem] leading-none">{stage.label}</p>
          <p className="mt-3 max-w-[46ch] text-steel">{stage.summary}</p>
        </div>
        <StartLamps lit={lit} index={index} running={running} onRun={runStart} />
      </div>

      <label className="mt-8 block">
        <span className="sr-only">Session</span>
        <input
          type="range"
          min={0}
          max={STAGES.length - 1}
          step={1}
          value={index}
          aria-valuetext={stage.label}
          onChange={(event) => go(Number(event.target.value))}
        />
      </label>
      <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-6" role="group" aria-label="Session">
        {STAGES.map((item, itemIndex) => {
          const on = itemIndex === index;
          return (
            <button
              key={item.label}
              type="button"
              aria-pressed={on}
              onClick={() => go(itemIndex)}
              className="switch w-full"
            >
              {item.label}
            </button>
          );
        })}
      </div>

      <div className="mt-10 grid gap-10 md:grid-cols-[1fr_28px_1fr] md:gap-0">
        <div className="md:pr-8">
          <p className="font-medium">On the row</p>
          <ul className="mt-4">
            {KNOWN.map((item) => {
              const ready = index >= item.from;
              return (
                <li key={item.label} className={`state-shift border-b border-line py-3 ${ready ? "text-ink" : "text-steel"}`}>
                  <span className="flex items-baseline justify-between gap-4">
                    <span>{item.label}</span>
                    <span className="shrink-0 text-[0.92rem]">{ready ? "Known" : "Not yet"}</span>
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
        <div className="flex items-stretch gap-3 md:flex-col md:items-center">
          <span className="text-[0.85rem] text-steel md:[writing-mode:vertical-rl] md:rotate-180">Lights out</span>
          <span className="h-px flex-1 bg-signal md:h-auto md:w-px" />
        </div>
        <div className="md:pl-8">
          <p className="font-medium">Struck from this row</p>
          <ul className="mt-4">
            {site.excluded.map((item) => (
              <li key={item} className="border-b border-line py-3">
                <span className="flex items-baseline justify-between gap-4">
                  <span className="text-steel line-through decoration-signal">{item}</span>
                  <span className="shrink-0 text-[0.92rem] text-steel">
                    {index >= 4 ? "Revealed, still off the row" : "Still ahead"}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

function StartLamps({
  lit,
  index,
  running,
  onRun,
}: {
  lit: number;
  index: number;
  running: boolean;
  onRun: () => void;
}) {
  const caption = running && lit > 0 && lit < 5 ? `${lit} of 5` : lit === 5 ? "Held" : index > 3 ? "Out" : "Not yet";
  return (
    <div className="shrink-0 text-right">
      <div className="ml-auto w-fit border border-line bg-tower px-2.5 py-2.5">
        <StartLights lit={lit} />
      </div>
      <p className="mt-2 text-[0.92rem] text-steel">{caption}</p>
      <button type="button" className="switch mt-3" disabled={running} onClick={onRun}>
        {running ? "Running" : index > 3 ? "Run it again" : "Run the start"}
      </button>
    </div>
  );
}
