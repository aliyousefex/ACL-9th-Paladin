import { useMemo, useState, type PointerEvent } from "react";
import { Note, Tabs } from "../../components/Bits";
import { Panel } from "../../components/Panel";
import type { RaceDetail, RaceMeta } from "../../lib/data";
import { lapTime } from "../../lib/format";
import { useElementWidth } from "../../lib/hooks";
import { PLACE_COLOURS, classifiedLabel, type Row } from "./rows";
import { axisTicks, buildTrace, formatGap, gapAt, lapRange, orderAt, positionAt, stopsBy, traceStory, type Trace, type TraceDriver } from "./lapTrace";

type Mode = "gap" | "laps";

const FADED = "#39414c";

/**
 * Gap to the leader and position by lap, drawn from the recorded lap times, positions and pit stops.
 * Everything on it is the record or arithmetic on the record. The shaded "slow laps" are inferred from the field's
 * median lap time, and the page says the data does not record why.
 */
export function RaceTrace({ race, rows, detail }: { race: RaceMeta; rows: Row[]; detail: RaceDetail }) {
  const trace = useMemo(
    () =>
      buildTrace(
        detail.laps.d,
        detail.pits,
        rows.map((r) => ({ id: r.driver.id, grid: r.grid, classified: /^\d+$/.test(r.entry.txt), txt: r.entry.txt, status: r.entry.status })),
      ),
    [rows, detail],
  );
  const byRow = useMemo(() => new Map(rows.map((r) => [r.driver.id, r])), [rows]);
  const [mode, setMode] = useState<Mode>("gap");
  const [chosen, setChosen] = useState<Set<number>>(() => new Set(race.actual));
  const [lap, setLap] = useState(trace.totalLaps);

  // Teammates share a colour, so the second car of each team is drawn dashed.
  const dashed = useMemo(() => {
    const seen = new Set<number>();
    const out = new Set<number>();
    for (const row of [...rows].sort((a, b) => (a.finish ?? 99) - (b.finish ?? 99) || a.driver.id - b.driver.id)) {
      if (seen.has(row.team.id)) out.add(row.driver.id);
      seen.add(row.team.id);
    }
    return out;
  }, [rows]);

  const story = useMemo(
    () => traceStory(trace, rows.map((r) => ({ id: r.driver.id, name: r.driver.last, grid: r.grid, finish: r.finish }))),
    [trace, rows],
  );

  if (trace.totalLaps === 0) {
    return (
      <Panel eyebrow="Step 3 · After the flag" title="Race trace" tag="record">
        <p className="text-steel">The dataset has no lap times for this race, so no trace can be drawn.</p>
      </Panel>
    );
  }

  const toggle = (id: number) =>
    setChosen((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const preset = (ids: Iterable<number>) => setChosen(new Set(ids));
  const chips = [...rows].sort((a, b) => (a.finish ?? 99) - (b.finish ?? 99) || a.driver.id - b.driver.id);
  const lapNow = Math.min(Math.max(lap, 1), trace.totalLaps);

  return (
    <Panel
      eyebrow="Step 3 · After the flag"
      title="Race trace"
      tag="record"
      actions={
        <Tabs<Mode>
          value={mode}
          onChange={setMode}
          idPrefix="trace-mode"
          label="Trace view"
          size="sm"
          options={[
            { id: "gap", label: "Gap to leader" },
            { id: "laps", label: "Positions" },
          ]}
        />
      }
    >
      <p className="max-w-[72ch] text-steel">
        {mode === "gap"
          ? "How far each highlighted car was behind the fastest car at the end of every lap, in seconds. A flat line is a car holding its gap; a line that falls toward zero is a car closing."
          : "Each highlighted car's official position at the end of every lap, with lap 0 the starting grid. Lines crossing are overtakes or pit-stop cycles."}
      </p>

      <div className="mt-4 flex flex-wrap items-center gap-2" role="group" aria-label="Highlight presets">
        <span className="label mr-1">Highlight</span>
        <button type="button" className="btn btn-ghost !min-h-9 !px-3 !text-[0.95rem]" onClick={() => preset(race.actual)}>
          Podium
        </button>
        <button type="button" className="btn btn-ghost !min-h-9 !px-3 !text-[0.95rem]" onClick={() => preset(race.predicted)}>
          Model's picks
        </button>
        <button type="button" className="btn btn-ghost !min-h-9 !px-3 !text-[0.95rem]" onClick={() => preset(rows.map((r) => r.driver.id))}>
          Everyone
        </button>
        <button type="button" className="btn btn-ghost !min-h-9 !px-3 !text-[0.95rem]" onClick={() => preset([])}>
          Clear
        </button>
      </div>

      <TraceChart trace={trace} mode={mode} chosen={chosen} byRow={byRow} dashed={dashed} lap={lapNow} onLap={setLap} />

      <div className="mt-4">
        <p className="label" id="trace-chips">Or choose individual drivers</p>
        <div className="mt-2 flex flex-wrap gap-1.5" role="group" aria-labelledby="trace-chips">
          {chips.map((row) => (
            <button key={row.driver.id} type="button" className="chip !min-h-9 !gap-1.5 !px-2 !text-[0.92rem]" aria-pressed={chosen.has(row.driver.id)} onClick={() => toggle(row.driver.id)}>
              <span className="h-4 w-1" style={{ background: row.colour }} aria-hidden />
              {row.driver.code}
              <span className="sr-only">{row.driver.name}, {classifiedLabel(row)}</span>
            </button>
          ))}
        </div>
      </div>


      <div className="mt-4 grid gap-3 sm:grid-cols-[auto_minmax(0,1fr)] sm:items-center sm:gap-5">
        <label htmlFor="trace-lap" className="label">
          Inspect lap <span className="ml-1 text-ink tabular-nums">{lapNow}</span>
          <span className="text-mute"> of {trace.totalLaps}</span>
        </label>
        <input
          id="trace-lap"
          type="range"
          min={1}
          max={trace.totalLaps}
          step={1}
          value={lapNow}
          aria-valuetext={`Lap ${lapNow} of ${trace.totalLaps}`}
          onChange={(event) => setLap(Number(event.target.value))}
          className="w-full"
        />
      </div>

      <Readout trace={trace} lap={lapNow} chosen={chosen} byRow={byRow} />

      <details className="mt-4 border-t border-line pt-3">
        <summary className="flex min-h-11 cursor-pointer items-center font-display text-[1rem] tracking-[0.08em] uppercase hover:text-ink">Full order at lap {lapNow}</summary>
        <FullOrder trace={trace} lap={lapNow} byRow={byRow} />
      </details>

      <div className="mt-6 border-t border-line pt-4">
        <h3 className="label">What the lap times show</h3>
        <ul className="mt-2 space-y-1.5 text-[0.98rem] text-steel">
          {story.map((line) => (
            <li key={line} className="border-l-2 border-line2 pl-3">
              {line}
            </li>
          ))}
        </ul>
      </div>

      <div className="mt-5 space-y-2">
        <Note>
          Record: lap times, end-of-lap positions and pit stops. Derived: a gap is the sum of a car's lap times minus the fastest car's at the end of the same lap
          (so it ignores time penalties), and shaded laps are those where the field's median lap was more than 20% above the race median. The data does not say
          why, so no cause is shown. Lap 1 includes the standing start.
        </Note>
        {trace.withoutLaps.length > 0 && (
          <Note kind="warn">
            No lap times are recorded for {trace.withoutLaps.map((id) => byRow.get(id)?.driver.last ?? id).join(", ")}, so {trace.withoutLaps.length === 1 ? "that driver is" : "those drivers are"} not drawn.
          </Note>
        )}
      </div>
    </Panel>
  );
}

/* ------------------------------------------------------------------ chart */

function TraceChart({
  trace,
  mode,
  chosen,
  byRow,
  dashed,
  lap,
  onLap,
}: {
  trace: Trace;
  mode: Mode;
  chosen: Set<number>;
  byRow: Map<number, Row>;
  dashed: Set<number>;
  lap: number;
  onLap: (lap: number) => void;
}) {
  const [wrap, measured] = useElementWidth<HTMLDivElement>(1000);
  const W = Math.max(300, measured);
  const compact = W < 560;
  const pad = { l: compact ? 38 : 50, r: compact ? 40 : 54, t: 14, b: 30 };
  const maxPos = Math.max(2, ...trace.drivers.flatMap((d) => d.pos.map((p) => p ?? 0)));
  const highlighted = trace.drivers.filter((d) => chosen.has(d.id));

  const maxGap = Math.max(0, ...highlighted.flatMap((d) => d.cum.slice(1).map((_, i) => gapAt(trace, d.id, i + 1) ?? 0)));
  const ticks = axisTicks(highlighted.length ? maxGap * 1.04 : 60);
  const yTop = ticks[ticks.length - 1];
  const H = mode === "gap" ? (compact ? 300 : 360) : Math.max(compact ? 340 : 380, pad.t + pad.b + (maxPos - 1) * (compact ? 15 : 17));
  const ph = H - pad.t - pad.b;
  const pw = W - pad.l - pad.r;
  const x = (k: number) => pad.l + (k / trace.totalLaps) * pw;
  const yGap = (g: number) => pad.t + (g / yTop) * ph;
  const yPos = (p: number) => pad.t + ((p - 1) / (maxPos - 1)) * ph;

  const point = (d: TraceDriver, k: number): number | null => {
    if (mode === "gap") {
      const g = gapAt(trace, d.id, k);
      return g === null ? null : yGap(g);
    }
    const p = positionAt(trace, d.id, k);
    return p === null ? null : yPos(p);
  };
  const path = (d: TraceDriver) => {
    const start = mode === "gap" ? 1 : 0;
    let out = "";
    for (let k = start; k <= d.laps; k++) {
      const y = point(d, k);
      if (y === null) continue;
      out += `${out ? "L" : "M"}${x(k).toFixed(1)} ${y.toFixed(1)}`;
    }
    return out;
  };

  // Direct labels at the end of each highlighted line, nudged apart so they never overprint.
  const labels = (() => {
    const items = highlighted
      .map((d) => ({ d, y: point(d, d.laps) ?? pad.t, x: x(d.laps) + 6 }))
      .sort((a, b) => a.y - b.y);
    const gap = 13;
    for (let i = 1; i < items.length; i++) if (items[i].y - items[i - 1].y < gap) items[i].y = items[i - 1].y + gap;
    const overflow = items.length ? items[items.length - 1].y - (H - pad.b) : 0;
    if (overflow > 0) items.forEach((item) => (item.y -= overflow));
    return items;
  })();

  const setFromPointer = (event: PointerEvent<SVGSVGElement>) => {
    const box = event.currentTarget.getBoundingClientRect();
    const px = ((event.clientX - box.left) / box.width) * W;
    onLap(Math.min(trace.totalLaps, Math.max(1, Math.round(((px - pad.l) / pw) * trace.totalLaps))));
  };

  const xTicks = (() => {
    const every = trace.totalLaps > 60 ? 10 : 5;
    const out: number[] = [];
    for (let k = every; k <= trace.totalLaps; k += every) out.push(k);
    return [1, ...out.filter((k) => k > 2 && x(k) - x(1) > 24)];
  })();
  const label =
    mode === "gap"
      ? `Gap to the leader by lap for ${highlighted.length} highlighted ${highlighted.length === 1 ? "driver" : "drivers"}, up to ${Math.round(maxGap)} seconds.`
      : `Position by lap for ${highlighted.length} highlighted ${highlighted.length === 1 ? "driver" : "drivers"}.`;
  const clip = `trace-clip-${mode}`;

  return (
    <figure ref={wrap} className="mt-5">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        width={W}
        height={H}
        className="block h-auto w-full cursor-crosshair select-none"
        style={{ touchAction: "pan-y" }}
        role="img"
        aria-label={`${label} Use the lap slider below to read the values.`}
        onPointerDown={(event) => {
          event.currentTarget.setPointerCapture(event.pointerId);
          setFromPointer(event);
        }}
        onPointerMove={(event) => {
          if (event.buttons) setFromPointer(event);
        }}
      >
        <defs>
          <clipPath id={clip}>
            <rect x={pad.l} y={pad.t - 2} width={pw + 1} height={ph + 4} />
          </clipPath>
        </defs>

        {/* slow-lap bands: inferred from the field's median lap time, cause not recorded */}
        {trace.slowRuns.map((run) => (
          <rect key={run.from} x={x(run.from - 0.5)} y={pad.t} width={Math.max(2, x(run.to + 0.5) - x(run.from - 0.5))} height={ph} fill="#c5cad1" fillOpacity={run.severity === "stoppage" ? 0.16 : 0.08} />
        ))}

        {mode === "gap"
          ? ticks.map((t) => (
              <g key={t}>
                <line x1={pad.l} x2={W - pad.r} y1={yGap(t)} y2={yGap(t)} stroke="#262b33" />
                <text x={pad.l - 6} y={yGap(t) + 4} textAnchor="end" fill="#98a0ab" fontSize={12}>
                  {t === 0 ? "0" : t >= 120 && t % 60 === 0 ? `${t / 60}m` : `${t}s`}
                </text>
              </g>
            ))
          : [1, 5, 10, 15, 20].filter((p) => p <= maxPos).map((p) => (
              <g key={p}>
                <line x1={pad.l} x2={W - pad.r} y1={yPos(p)} y2={yPos(p)} stroke="#262b33" />
                <text x={pad.l - 6} y={yPos(p) + 4} textAnchor="end" fill="#98a0ab" fontSize={12}>
                  P{p}
                </text>
              </g>
            ))}

        {xTicks.map((k) => (
          <text key={k} x={x(k)} y={H - 10} textAnchor="middle" fill="#98a0ab" fontSize={12}>
            {k}
          </text>
        ))}
        <text x={pad.l - 6} y={H - 10} textAnchor="end" fill="#6b7480" fontSize={11}>
          lap
        </text>

        {/* every other car, faint, so the field is still there */}
        <g clipPath={`url(#${clip})`}>
          {trace.drivers
            .filter((d) => !chosen.has(d.id))
            .map((d) => (
              <path key={d.id} d={path(d)} fill="none" stroke={FADED} strokeWidth={1} strokeOpacity={0.55} strokeLinejoin="round" />
            ))}
        </g>

        <g clipPath={`url(#${clip})`}>
          {highlighted.map((d) => {
            const row = byRow.get(d.id);
            return (
              <path
                key={d.id}
                d={path(d)}
                fill="none"
                stroke={row?.colour ?? "#f4f4f2"}
                strokeWidth={2.4}
                strokeLinejoin="round"
                strokeLinecap="round"
                strokeDasharray={dashed.has(d.id) ? "7 4" : undefined}
              />
            );
          })}
        </g>

        {/* pit stops and retirements on the highlighted lines */}
        {highlighted.map((d) => {
          const row = byRow.get(d.id);
          const colour = row?.colour ?? "#f4f4f2";
          return (
            <g key={d.id}>
              {d.pits.map((p, i) => {
                const y = point(d, Math.min(p.lap, d.laps));
                return y === null ? null : <circle key={i} cx={x(p.lap)} cy={y} r={3.6} fill="#0a0b0e" stroke={colour} strokeWidth={1.8} />;
              })}
              {!d.classified &&
                (() => {
                  const y = point(d, d.laps);
                  if (y === null) return null;
                  const cx = x(d.laps);
                  return <path d={`M${cx - 4} ${y - 4}l8 8M${cx + 4} ${y - 4}l-8 8`} stroke={colour} strokeWidth={2.2} strokeLinecap="round" />;
                })()}
            </g>
          );
        })}

        {labels.map(({ d, x: lx, y }) => (
          <text key={d.id} x={lx} y={y + 4} fill={byRow.get(d.id)?.colour ?? "#f4f4f2"} stroke="#0a0b0e" strokeWidth={3} paintOrder="stroke" fontSize={12} fontWeight={700} style={{ fontFamily: "var(--font-display)" }}>
            {byRow.get(d.id)?.driver.code}
          </text>
        ))}

        {/* the lap being read */}
        <line x1={x(lap)} x2={x(lap)} y1={pad.t} y2={pad.t + ph} stroke="#f4f4f2" strokeOpacity={0.8} strokeWidth={1} />
        {highlighted.map((d) => {
          const y = point(d, lap);
          return y === null ? null : <circle key={d.id} cx={x(lap)} cy={y} r={4.2} fill={byRow.get(d.id)?.colour ?? "#f4f4f2"} stroke="#f4f4f2" strokeWidth={1.5} />;
        })}

        {highlighted.length === 0 && (
          <text x={pad.l + pw / 2} y={pad.t + ph / 2} textAnchor="middle" fill="#c5cad1" fontSize={14}>
            Choose drivers above to draw them
          </text>
        )}
      </svg>
      <figcaption className="mt-2 flex flex-wrap items-center gap-x-5 gap-y-1 text-[0.85rem] text-mute">
        <span className="flex items-center gap-1.5">
          <svg width="14" height="14" aria-hidden>
            <circle cx="7" cy="7" r="3.6" fill="#0a0b0e" stroke="#c5cad1" strokeWidth="1.8" />
          </svg>
          pit stop
        </span>
        <span className="flex items-center gap-1.5">
          <svg width="14" height="14" aria-hidden>
            <path d="M3 3l8 8M11 3l-8 8" stroke="#c5cad1" strokeWidth="2" strokeLinecap="round" />
          </svg>
          not classified, last recorded lap
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-3 w-4 bg-steel/20" aria-hidden />
          field-wide slow laps{trace.slowRuns.length ? `: ${trace.slowRuns.map((r) => lapRange(r.from, r.to)).join(", ")}` : " (none)"}
        </span>
        <span>Dashed line: a team's second car</span>
      </figcaption>
    </figure>
  );
}

/* ------------------------------------------------------------------ readouts */

function Readout({ trace, lap, chosen, byRow }: { trace: Trace; lap: number; chosen: Set<number>; byRow: Map<number, Row> }) {
  const drivers = orderAt(trace, lap).filter((d) => chosen.has(d.id));
  const gone = trace.drivers.filter((d) => chosen.has(d.id) && d.laps < lap);
  if (chosen.size === 0) return <p className="mt-4 text-steel">Choose drivers above to read their position and gap at any lap.</p>;
  return (
    <div className="mt-4">
      <p className="label mb-1">
        At the end of lap {lap}
        {lap === trace.totalLaps ? " (the flag)" : ""}
      </p>
      <ul className="divide-y divide-line border-y border-line">
        {drivers.map((d) => {
          const row = byRow.get(d.id);
          const gap = gapAt(trace, d.id, lap) ?? 0;
          const place = positionAt(trace, d.id, lap) ?? 99;
          const stops = stopsBy(trace, d.id, lap);
          const pit = d.pits.find((p) => p.lap === lap);
          return (
            <li key={d.id} className="grid grid-cols-[2.6rem_minmax(0,1fr)_auto] items-baseline gap-x-3 gap-y-0.5 py-2">
              <span className="figure text-[1.35rem]" style={{ color: place <= 3 ? PLACE_COLOURS[place - 1] : "var(--color-steel)" }}>
                P{place}
              </span>
              <span className="flex min-w-0 items-center gap-2">
                <span className="h-4 w-1 shrink-0" style={{ background: row?.colour }} aria-hidden />
                <span className="truncate font-display text-[1.1rem] font-bold uppercase">{row?.driver.last}</span>
              </span>
              <span className="text-right font-display text-[1.1rem] font-semibold tabular-nums">{formatGap(gap)}</span>
              <span className="col-span-3 pl-[3.35rem] text-[0.85rem] text-mute">
                Lap time {lapTime(d.lapMs[lap - 1])} · {stops} {stops === 1 ? "stop" : "stops"} so far
                {pit ? ` · pitting this lap${pit.ms ? ` (${(pit.ms / 1000).toFixed(1)} s in the pit lane)` : ""}` : ""}
              </span>
            </li>
          );
        })}
        {gone.map((d) => (
          <li key={d.id} className="grid grid-cols-[2.6rem_minmax(0,1fr)] items-baseline gap-x-3 py-2 text-steel">
            <span className="figure text-[1.35rem] text-mute">–</span>
            <span>
              <span className="font-display text-[1.1rem] font-bold uppercase">{byRow.get(d.id)?.driver.last}</span>{" "}
              <span className="text-[0.9rem] text-mute">{d.classified ? `finished ${d.laps === trace.totalLaps ? "" : `${trace.totalLaps - d.laps} ${trace.totalLaps - d.laps === 1 ? "lap" : "laps"} down`}` : `out after lap ${d.laps}: ${d.status}`}</span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function FullOrder({ trace, lap, byRow }: { trace: Trace; lap: number; byRow: Map<number, Row> }) {
  const order = orderAt(trace, lap);
  const out = trace.drivers.filter((d) => d.laps < lap);
  return (
    <div className="mt-2 overflow-x-auto">
      <table className="w-full min-w-[22rem] text-left text-[0.95rem]">
        <caption className="sr-only">Running order at the end of lap {lap}</caption>
        <thead>
          <tr className="border-b border-line text-[0.78rem] tracking-[0.1em] text-mute uppercase">
            <th scope="col" className="py-1.5 pr-3 font-semibold">Pos</th>
            <th scope="col" className="py-1.5 pr-3 font-semibold">Driver</th>
            <th scope="col" className="py-1.5 pr-3 text-right font-semibold">Gap</th>
            <th scope="col" className="py-1.5 pr-3 text-right font-semibold">Lap time</th>
            <th scope="col" className="py-1.5 text-right font-semibold">Stops</th>
          </tr>
        </thead>
        <tbody>
          {order.map((d) => (
            <tr key={d.id} className="border-b border-line">
              <td className="py-1.5 pr-3 font-display text-[1.05rem] font-semibold">{positionAt(trace, d.id, lap)}</td>
              <td className="py-1.5 pr-3">
                <span className="mr-2 inline-block h-3.5 w-1 align-middle" style={{ background: byRow.get(d.id)?.colour }} aria-hidden />
                {byRow.get(d.id)?.driver.name}
              </td>
              <td className="py-1.5 pr-3 text-right tabular-nums">{formatGap(gapAt(trace, d.id, lap) ?? 0)}</td>
              <td className="py-1.5 pr-3 text-right tabular-nums">{lapTime(d.lapMs[lap - 1])}</td>
              <td className="py-1.5 text-right tabular-nums">{stopsBy(trace, d.id, lap)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {out.length > 0 && (
        <p className="mt-3 text-[0.88rem] text-mute">
          Not running at this lap: {out.map((d) => `${byRow.get(d.id)?.driver.last} (${d.classified ? `${trace.totalLaps - d.laps} down` : `out after lap ${d.laps}`})`).join(", ")}.
        </p>
      )}
    </div>
  );
}
