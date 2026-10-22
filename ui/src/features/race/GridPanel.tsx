import { Panel } from "../../components/Panel";
import { FEATURES } from "../../lib/model";
import { FEATURE_GROUP, featureLabel, qualifyingTime } from "../../lib/format";
import type { Row } from "./rows";

/** What the model is allowed to know: the starting grid and the inputs behind every score. */
export function GridPanel({
  rows,
  focus,
  onFocus,
}: {
  rows: Row[];
  focus: number;
  onFocus: (driverId: number) => void;
}) {
  const grid = [...rows].filter((r) => r.grid !== null).sort((a, b) => (a.grid ?? 0) - (b.grid ?? 0));
  const pit = rows.filter((r) => r.grid === null);
  const active = rows.find((r) => r.driver.id === focus) ?? grid[0];

  return (
    <Panel
      eyebrow="Step 1 · Before lights out"
      title="The starting grid and what the model sees"
      tag="record"
    >
      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)]">
        <div>
          <p className="max-w-[56ch] text-[0.98rem] leading-snug text-steel">
            The grid is final after qualifying and penalties. It is the strongest input the model has. Choose a driver to see all
            sixteen inputs for that row.
          </p>
          <ol className="mt-5 grid grid-cols-2 gap-x-3 gap-y-0" aria-label="Starting grid">
            {grid.map((row, i) => {
              const on = row.driver.id === active?.driver.id;
              return (
                <li key={row.driver.id} className={`${i % 2 === 1 ? "mt-6" : ""}`}>
                  <button
                    type="button"
                    aria-pressed={on}
                    onClick={() => onFocus(row.driver.id)}
                    className={`relative flex h-[3.1rem] w-full cursor-pointer items-center gap-2.5 border px-2.5 text-left transition-colors ${
                      on ? "border-ink bg-panel2" : "border-line bg-tower hover:border-line2"
                    }`}
                  >
                    <span className="sr-only">Grid position</span>
                    <span className="figure w-6 text-right text-[1.35rem] text-mute">{row.grid}</span>
                    <span className="h-6 w-1.5 shrink-0" style={{ background: row.colour }} aria-hidden />
                    <span className="font-display text-[1.2rem] leading-none font-bold tracking-wide uppercase">{row.driver.code}</span>
                    <span className="ml-auto hidden truncate text-[0.82rem] text-mute min-[420px]:block">{row.team.short}</span>
                  </button>
                </li>
              );
            })}
          </ol>
          {pit.length > 0 && (
            <div className="mt-6">
              <p className="label">Started from the pit lane</p>
              <ul className="mt-2 flex flex-wrap gap-2">
                {pit.map((row) => (
                  <li key={row.driver.id}>
                    <button
                      type="button"
                      aria-pressed={row.driver.id === active?.driver.id}
                      onClick={() => onFocus(row.driver.id)}
                      className={`flex items-center gap-2 border px-2.5 py-1.5 text-left ${
                        row.driver.id === active?.driver.id ? "border-ink bg-panel2" : "border-line bg-tower hover:border-line2"
                      }`}
                    >
                      <span className="h-5 w-1.5" style={{ background: row.colour }} aria-hidden />
                      <span className="font-display text-[1.1rem] leading-none font-bold uppercase">{row.driver.code}</span>
                    </button>
                  </li>
                ))}
              </ul>
              <p className="mt-2 text-[0.85rem] text-mute">The model treats a pit-lane start as its own input, not as a grid position.</p>
            </div>
          )}
        </div>

        {active && <Inputs row={active} />}
      </div>
    </Panel>
  );
}

function format(feature: string, value: number | null): string {
  if (value === null) return "missing";
  switch (feature) {
    case "grid_position":
    case "qualifying_position":
      return `P${value}`;
    case "pit_lane_start":
    case "front_row":
    case "qualifying_missing":
      return value ? "Yes" : "No";
    case "field_size":
      return `${value} cars`;
    case "qualifying_time_seconds":
      return qualifyingTime(value);
    case "driver_podium_rate_5":
    case "constructor_podium_rate_5":
      return `${Math.round(value * 100)}% of last 5`;
    case "driver_races_before":
      return `${value} starts`;
    case "driver_points_before":
    case "constructor_points_before":
      return `${value} pts`;
    case "driver_rank_before":
    case "constructor_rank_before":
      return value === 0 ? "no points yet" : `P${value}`;
    case "driver_age":
      return `${value.toFixed(1)} years`;
    default:
      return String(value);
  }
}

function Inputs({ row }: { row: Row }) {
  const groups = ["Grid", "Qualifying", "Form", "Standings", "Context"];
  return (
    <div className="border border-line bg-tower p-4 sm:p-5" aria-live="polite">
      <div className="flex items-center gap-3">
        <span className="h-9 w-1.5" style={{ background: row.colour }} aria-hidden />
        <div className="min-w-0">
          <p className="font-display text-[1.7rem] leading-none font-bold uppercase">{row.driver.name}</p>
          <p className="mt-1 text-[0.9rem] text-mute">
            {row.team.name} · inputs known before the start
          </p>
        </div>
      </div>
      <dl className="mt-4 divide-y divide-line">
        {groups.map((group) => (
          <div key={group} className="grid grid-cols-[6.4rem_1fr] gap-x-3 py-2.5">
            <dt className="label pt-0.5">{group}</dt>
            <dd className="space-y-1">
              {FEATURES.filter((f) => FEATURE_GROUP[f] === group).map((f) => (
                <p key={f} className="flex items-baseline justify-between gap-3">
                  <span className="text-[0.95rem] text-steel">{featureLabel(f)}</span>
                  <span className="font-display text-[1.1rem] font-semibold tracking-wide tabular-nums">
                    {format(f, row.entry.x[FEATURES.indexOf(f)] ?? null)}
                  </span>
                </p>
              ))}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
