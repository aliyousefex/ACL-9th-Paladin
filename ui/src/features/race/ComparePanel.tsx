import { useMemo, useState } from "react";
import { Icon } from "../../components/Icon";
import { Panel } from "../../components/Panel";
import { Portrait } from "../../components/Portrait";
import { Note } from "../../components/Bits";
import { FEATURES, INTERCEPT, THRESHOLD, contributions, logOdds } from "../../lib/model";
import { featureLabel, signed } from "../../lib/format";
import { classifiedLabel, type Row } from "./rows";

/** Compare one to three drivers: where they sit in the field, and exactly why the model scores them as it does. */
export function ComparePanel({
  rows,
  selected,
  onRemove,
  onAdd,
  revealed,
}: {
  rows: Row[];
  selected: number[];
  onRemove: (driverId: number) => void;
  onAdd: (driverId: number) => void;
  revealed: boolean;
}) {
  const [all, setAll] = useState(false);
  const chosen = selected.map((id) => rows.find((r) => r.driver.id === id)).filter((r): r is Row => Boolean(r));

  const matrix = useMemo(() => {
    const parts = chosen.map((row) => contributions(row.entry.x));
    return FEATURES.map((feature, i) => ({
      feature,
      cells: parts.map((p) => p[i]),
      spread: Math.max(...parts.map((p) => Math.abs(p[i].contribution))),
      range: chosen.length > 1 ? Math.max(...parts.map((p) => p[i].contribution)) - Math.min(...parts.map((p) => p[i].contribution)) : 0,
    })).sort((a, b) => (chosen.length > 1 ? b.range - a.range : b.spread - a.spread));
  }, [chosen]);

  const shown = all ? matrix : matrix.slice(0, 7);
  const scale = Math.max(0.3, ...matrix.map((m) => m.spread));
  const available = rows.filter((r) => !selected.includes(r.driver.id));

  return (
    <Panel
      eyebrow="Compare drivers"
      title="Why the model scores them this way"
      tag="model"
      actions={
        selected.length < 3 && available.length > 0 ? (
          <label className="flex items-center gap-2">
            <span className="sr-only">Add a driver to the comparison</span>
            <select
              className="select"
              value=""
              onChange={(event) => event.target.value && onAdd(Number(event.target.value))}
              aria-label="Add a driver to the comparison"
            >
              <option value="">+ Add driver</option>
              {rows.map((r) => (
                <option key={r.driver.id} value={r.driver.id} disabled={selected.includes(r.driver.id)}>
                  {r.driver.name}
                </option>
              ))}
            </select>
          </label>
        ) : null
      }
    >
      {chosen.length === 0 ? (
        <p className="text-steel">Select a driver in the ranking above to see how the model arrives at their score.</p>
      ) : (
        <>
          <div className={`grid gap-3 ${chosen.length === 1 ? "" : chosen.length === 2 ? "sm:grid-cols-2" : "sm:grid-cols-3"}`}>
            {chosen.map((row) => (
              <DriverCard key={row.driver.id} row={row} onRemove={() => onRemove(row.driver.id)} revealed={revealed} field={rows.length} />
            ))}
          </div>

          <FieldStrip rows={rows} chosen={chosen} />

          <h3 className="display mt-8 text-[1.5rem]">
            {chosen.length > 1 ? "What separates them" : "What drives this score"}
          </h3>
          <p className="mt-1 max-w-[70ch] text-[0.95rem] leading-snug text-steel">
            Each bar is one input's share of the model's log-odds: the standardised input times its learned weight. Bars to the
            right raise the podium score, bars to the left lower it. The intercept ({signed(INTERCEPT)}) plus all sixteen bars
            gives the log-odds that becomes the score.
          </p>

          <ul className="mt-4 space-y-1" aria-label="Feature contributions">
            {shown.map((m) => (
              <li key={m.feature} className="grid grid-cols-[minmax(0,10.5rem)_1fr] items-center gap-3 sm:grid-cols-[13rem_1fr]">
                <div className="min-w-0">
                  <p className="truncate text-[0.95rem] leading-tight text-steel">{featureLabel(m.feature)}</p>
                  <p className="mt-0.5 flex flex-wrap gap-x-2 text-[0.78rem] leading-tight text-mute">
                    {m.cells.map((c, i) => (
                      <span key={i} className="inline-flex items-center gap-1">
                        <span className="inline-block h-1.5 w-1.5" style={{ background: chosen[i].colour }} aria-hidden />
                        {formatValue(m.feature, c.value)}
                      </span>
                    ))}
                  </p>
                </div>
                <div className="relative py-1">
                  <span className="absolute inset-y-0 left-1/2 w-px bg-line2" aria-hidden />
                  {m.cells.map((c, i) => {
                    const width = (Math.abs(c.contribution) / scale) * 50;
                    return (
                      <div key={i} className="relative my-[3px] h-[7px]">
                        <span
                          className="absolute inset-y-0 transition-[width] duration-500"
                          style={{
                            background: chosen[i].colour,
                            width: `${Math.min(50, width)}%`,
                            left: c.contribution >= 0 ? "50%" : undefined,
                            right: c.contribution < 0 ? "50%" : undefined,
                          }}
                        />
                        <span className="sr-only">
                          {chosen[i].driver.last}: {signed(c.contribution)}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </li>
            ))}
          </ul>
          <button
            type="button"
            className="chip mt-4"
            aria-pressed={all}
            onClick={() => setAll((v) => !v)}
          >
            {all ? "Show the largest seven" : `Show all ${FEATURES.length} inputs`}
          </button>

          <div className="mt-6 grid gap-2 border-t border-line pt-4 sm:grid-cols-3">
            {chosen.map((row) => (
              <p key={row.driver.id} className="text-[0.92rem] text-steel">
                <span className="inline-block h-2 w-2 align-middle" style={{ background: row.colour }} aria-hidden />{" "}
                <span className="font-semibold text-ink">{row.driver.last}</span>: log-odds {signed(logOdds(row.entry.x))} → score{" "}
                <span className="figure text-[1.15rem] text-ink">{row.score.toFixed(3)}</span>
              </p>
            ))}
          </div>
          <div className="mt-4">
            <Note>
              These are exact for a logistic regression, not an approximation. They describe what the fitted model relies on. They are
              associations in historical data and do not say what would happen if a driver started one place higher.
            </Note>
          </div>
        </>
      )}
    </Panel>
  );
}

function DriverCard({ row, onRemove, revealed, field }: { row: Row; onRemove: () => void; revealed: boolean; field: number }) {
  const above = row.score >= THRESHOLD;
  return (
    <article className="relative flex gap-4 border border-line bg-tower p-3 sm:p-4" style={{ borderTop: `3px solid ${row.colour}` }}>
      <Portrait driver={row.driver} colour={row.colour} number={row.entry.n} className="h-20 w-20 shrink-0 sm:h-24 sm:w-24" label={row.driver.name} />
      <div className="min-w-0 flex-1">
        <p className="truncate font-display text-[1.5rem] leading-none font-bold uppercase">{row.driver.last}</p>
        <p className="mt-1 truncate text-[0.88rem] text-mute">
          {row.driver.first} · {row.team.short}
        </p>
        <p className="figure mt-2 text-[2.6rem]">{row.score.toFixed(2)}</p>
        <p className="text-[0.85rem] leading-tight text-mute">
          rank {row.rank} of {field} · {above ? "above" : "below"} the cutoff
        </p>
        {revealed && (
          <p className={`mt-1 text-[0.9rem] font-semibold ${row.podium ? "text-hit" : "text-steel"}`}>
            Result: {classifiedLabel(row)} {row.podium ? "· podium" : ""}
          </p>
        )}
      </div>
      <button
        type="button"
        onClick={onRemove}
        aria-label={`Remove ${row.driver.name} from the comparison`}
        className="absolute top-2 right-2 grid h-7 w-7 place-items-center text-mute hover:text-ink"
      >
        <Icon name="cross" size={16} />
      </button>
    </article>
  );
}

/** Where every driver sits on the 0 to 1 score axis, with the chosen drivers named. */
function FieldStrip({ rows, chosen }: { rows: Row[]; chosen: Row[] }) {
  const lanes = useMemo(() => {
    const placed: { row: Row; lane: number }[] = [];
    const ends: number[] = [];
    [...rows]
      .sort((a, b) => a.score - b.score)
      .forEach((row) => {
        let lane = 0;
        while (ends[lane] !== undefined && row.score - ends[lane] < 0.028) lane++;
        ends[lane] = row.score;
        placed.push({ row, lane });
      });
    return placed;
  }, [rows]);
  const maxLane = Math.max(...lanes.map((l) => l.lane));
  const height = 28 + (maxLane + 1) * 16;

  return (
    <figure className="mt-6">
      <figcaption className="label mb-2">Where the field sits on the score axis</figcaption>
      <svg viewBox={`0 0 1000 ${height + 26}`} className="w-full" role="img" aria-label="Podium scores of every driver on a 0 to 1 axis">
        <line x1={0} x2={1000} y1={height} y2={height} stroke="#39414c" />
        {[0, 0.25, 0.5, 0.75, 1].map((t) => (
          <g key={t}>
            <line x1={t * 1000} x2={t * 1000} y1={height} y2={height + 6} stroke="#39414c" />
            <text x={t * 1000} y={height + 22} fill="#98a0ab" fontSize={15} textAnchor={t === 0 ? "start" : t === 1 ? "end" : "middle"}>
              {t.toFixed(2)}
            </text>
          </g>
        ))}
        <line x1={THRESHOLD * 1000} x2={THRESHOLD * 1000} y1={4} y2={height} stroke="#f4f4f2" strokeOpacity={0.7} strokeDasharray="4 4" />
        <text x={THRESHOLD * 1000 + 6} y={14} fill="#c5cad1" fontSize={14}>
          cutoff {THRESHOLD.toFixed(3)}
        </text>
        {lanes.map(({ row, lane }) => {
          const on = chosen.some((c) => c.driver.id === row.driver.id);
          const cx = row.score * 1000;
          const cy = height - 12 - lane * 16;
          return (
            <g key={row.driver.id}>
              <circle cx={cx} cy={cy} r={on ? 8 : 5.5} fill={on ? row.colour : "#4a525d"} stroke={on ? "#f4f4f2" : "none"} strokeWidth={2} />
              {on && (
                <text x={cx} y={cy - 13} fill="#f4f4f2" fontSize={16} fontWeight={700} textAnchor="middle" style={{ fontFamily: "var(--font-display)" }}>
                  {row.driver.code}
                </text>
              )}
            </g>
          );
        })}
      </svg>
    </figure>
  );
}

function formatValue(feature: string, value: number | null): string {
  if (value === null) return "n/a";
  switch (feature) {
    case "grid_position":
    case "qualifying_position":
      return `P${value}`;
    case "pit_lane_start":
    case "front_row":
    case "qualifying_missing":
      return value ? "yes" : "no";
    case "driver_podium_rate_5":
    case "constructor_podium_rate_5":
      return `${Math.round(value * 100)}%`;
    case "driver_rank_before":
    case "constructor_rank_before":
      return value === 0 ? "—" : `P${value}`;
    case "qualifying_time_seconds":
      return `${value.toFixed(3)}s`;
    case "driver_age":
      return value.toFixed(1);
    default:
      return String(Number.isInteger(value) ? value : value.toFixed(2));
  }
}
