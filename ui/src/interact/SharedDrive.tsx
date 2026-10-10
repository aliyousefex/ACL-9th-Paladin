import { useState } from "react";
import site from "../data/site.json";
import { integer, pct } from "../lib/format";
import { haptic } from "../lib/haptic";

type Drive = { resultId: number; grid: number; positionOrder: number };

const SCENES: { title: string; rows: [Drive, Drive] }[] = [
  {
    title: "A win that never started",
    rows: [
      { resultId: 1, grid: 0, positionOrder: 1 },
      { resultId: 2, grid: 4, positionOrder: 8 },
    ],
  },
  {
    title: "Both cars started",
    rows: [
      { resultId: 3, grid: 5, positionOrder: 7 },
      { resultId: 4, grid: 6, positionOrder: 3 },
    ],
  },
];

export function SharedDrive() {
  const [scene, setScene] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const rows = SCENES[scene].rows;
  const shown = flipped ? [rows[1], rows[0]] : rows;
  const kept = retained(rows);

  return (
    <div>
      <p className="max-w-[68ch] text-steel">
        A worked example of the rule, not a row from the file. Reorder the cards. The kept result does not follow the order on screen.
      </p>
      <div className="mt-4 flex flex-wrap gap-2">
        {SCENES.map((item, index) => (
          <button
            key={item.title}
            type="button"
            aria-pressed={index === scene}
            onClick={() => {
              haptic("select");
              setScene(index);
              setFlipped(false);
            }}
            className="switch"
          >
            {item.title}
          </button>
        ))}
        <button
          type="button"
          aria-pressed={flipped}
          onClick={() => {
            haptic("toggle");
            setFlipped((value) => !value);
          }}
          className="switch"
        >
          Swap the order
        </button>
      </div>
      <ul className="mt-5 grid gap-3 sm:grid-cols-2">
        {shown.map((row) => {
          const keep = row.resultId === kept;
          return (
            <li key={row.resultId} className={`border p-4 ${keep ? "border-ink" : "border-line"}`}>
              <p className="flex items-baseline justify-between gap-3">
                <span className="font-medium">Result {row.resultId}</span>
                <span className={keep ? "text-ink" : "text-steel"}>{keep ? "Kept" : "Dropped"}</span>
              </p>
              <dl className="mt-4 grid grid-cols-2 gap-4">
                <div>
                  <dt className="text-steel">Grid</dt>
                  <dd className="figure mt-1 text-[2.2rem]">{row.grid}</dd>
                </div>
                <div>
                  <dt className="text-steel">Finish</dt>
                  <dd className="figure mt-1 text-[2.2rem]">{row.positionOrder}</dd>
                </div>
              </dl>
            </li>
          );
        })}
      </ul>
      <p className="mt-4 max-w-[68ch] text-steel">
        Prefer a start, grid greater than 0. Then the better finish. Then the smaller result id. The file itself has {site.diagnostics.duplicate_driver_race_groups} duplicate driver-race groups inside {integer(site.diagnostics.raw_result_rows)} result rows. Cleaning leaves {integer(site.diagnostics.clean_rows)} rows, and the podium rate stays {pct(site.podiumRate)}.
      </p>
    </div>
  );
}

function retained(rows: Drive[]): number {
  return [...rows].sort((a, b) => {
    const started = Number(b.grid > 0) - Number(a.grid > 0);
    if (started !== 0) return started;
    if (a.positionOrder !== b.positionOrder) return a.positionOrder - b.positionOrder;
    return a.resultId - b.resultId;
  })[0].resultId;
}
