import { useState } from "react";
import { PLACE_COLOURS } from "../race/rows";
import { raceHref, racesIn, type Driver } from "../../lib/data";
import { THRESHOLD } from "../../lib/model";
import { href } from "../../lib/router";

export interface Series {
  driver: Driver;
  colour: string;
  dashed?: boolean;
  /** Indexed by position in the season's race list; null when the driver did not start that race. */
  points: ({ score: number; grid: number | null; finish: number; text: string } | null)[];
}

const W = 1000;
const H = 300;
const PAD = { l: 44, r: 16, t: 18, b: 40 };

/** Podium score by round for one or more drivers, with the actual result marked on each point. */
export function ScoreLines({ season, series }: { season: number; series: Series[] }) {
  const races = racesIn(season);
  const [hover, setHover] = useState<number | null>(null);
  const x = (i: number) => PAD.l + (i / Math.max(1, races.length - 1)) * (W - PAD.l - PAD.r);
  const y = (v: number) => PAD.t + (1 - v) * (H - PAD.t - PAD.b);
  const step = (W - PAD.l - PAD.r) / Math.max(1, races.length - 1);

  return (
    <figure className="relative">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={`Podium score by round in ${season} for ${series.map((s) => s.driver.name).join(", ")}`}>
        {[0, 0.25, 0.5, 0.75, 1].map((t) => (
          <g key={t}>
            <line x1={PAD.l} x2={W - PAD.r} y1={y(t)} y2={y(t)} stroke="#262b33" />
            <text x={PAD.l - 8} y={y(t) + 4} textAnchor="end" fill="#98a0ab" fontSize={13}>
              {t.toFixed(2)}
            </text>
          </g>
        ))}
        <line x1={PAD.l} x2={W - PAD.r} y1={y(THRESHOLD)} y2={y(THRESHOLD)} stroke="#f4f4f2" strokeOpacity={0.55} strokeDasharray="5 5" />
        <text x={W - PAD.r - 2} y={y(THRESHOLD) - 6} textAnchor="end" fill="#c5cad1" fontSize={12}>
          cutoff {THRESHOLD.toFixed(3)}
        </text>

        {races.map((race, i) => (
          <text key={race.id} x={x(i)} y={H - 16} textAnchor="middle" fill="#98a0ab" fontSize={12.5}>
            {race.round}
          </text>
        ))}
        <text x={PAD.l} y={H - 2} fill="#98a0ab" fontSize={11}>
          round
        </text>

        {hover !== null && <line x1={x(hover)} x2={x(hover)} y1={PAD.t} y2={H - PAD.b} stroke="#39414c" />}

        {series.map((s) => {
          const segments: string[] = [];
          let current = "";
          s.points.forEach((p, i) => {
            if (!p) {
              if (current) segments.push(current);
              current = "";
              return;
            }
            current += `${current ? "L" : "M"}${x(i).toFixed(1)} ${y(p.score).toFixed(1)}`;
          });
          if (current) segments.push(current);
          return (
            <g key={s.driver.id}>
              {segments.map((d, i) => (
                <path key={i} d={d} fill="none" stroke={s.colour} strokeWidth={2.6} strokeLinejoin="round" strokeLinecap="round" strokeDasharray={s.dashed ? "7 5" : undefined} />
              ))}
              {s.points.map((p, i) =>
                p ? (
                  <g key={i}>
                    <circle cx={x(i)} cy={y(p.score)} r={p.finish <= 3 ? 7.5 : 4} fill={p.finish <= 3 ? PLACE_COLOURS[p.finish - 1] : s.colour} stroke={p.finish <= 3 ? "#0a0b0e" : "none"} strokeWidth={2} />
                  </g>
                ) : null,
              )}
            </g>
          );
        })}

        {races.map((race, i) => (
          <rect
            key={race.id}
            x={x(i) - step / 2}
            y={PAD.t}
            width={step}
            height={H - PAD.t - PAD.b}
            fill="transparent"
            onPointerEnter={() => setHover(i)}
            onPointerLeave={() => setHover(null)}
          />
        ))}
      </svg>

      <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-[0.85rem] text-steel">
        <span className="flex items-center gap-2">
          <span className="inline-block h-3 w-3 rounded-full" style={{ background: PLACE_COLOURS[0] }} aria-hidden /> Podium finish (gold, silver, bronze by place)
        </span>
        <span className="flex items-center gap-2">
          <span className="inline-block h-2 w-2 rounded-full bg-mute" aria-hidden /> Finished lower
        </span>
        <span className="text-mute">Height is the model's podium score before that race.</span>
      </div>

      <div className="pointer-events-none absolute top-0 right-0 left-0" aria-live="polite">
        {hover !== null && (
          <div
            className="pointer-events-auto absolute z-10 min-w-[12rem] border border-line2 bg-tower px-3 py-2 text-[0.85rem] shadow-lg"
            style={{ left: `${(x(hover) / W) * 100}%`, top: 4, transform: `translateX(${hover > races.length / 2 ? "-105%" : "5%"})` }}
          >
            <a className="font-display text-[1rem] font-bold tracking-wide uppercase no-underline hover:underline" href={href(raceHref(races[hover]))}>
              R{races[hover].round} {races[hover].name.replace(" Grand Prix", "")}
            </a>
            <ul className="mt-1 space-y-0.5">
              {series.map((s) => {
                const p = s.points[hover];
                return (
                  <li key={s.driver.id} className="flex items-center gap-2">
                    <span className="inline-block h-2.5 w-2.5 shrink-0" style={{ background: s.colour }} aria-hidden />
                    <span className="font-semibold">{s.driver.code}</span>
                    <span className="ml-auto text-steel tabular-nums">
                      {p ? `${p.score.toFixed(2)} · ${/^\d+$/.test(p.text) ? `P${p.finish}` : p.text}` : "did not start"}
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </div>
    </figure>
  );
}

export function seriesFor(driver: Driver, season: number, colour: string, dashed = false): Series {
  const races = racesIn(season);
  const log = driver.seasons[String(season)]?.log ?? [];
  const byRace = new Map(log.map((row) => [row[0], row]));
  return {
    driver,
    colour,
    dashed,
    points: races.map((race) => {
      const row = byRace.get(race.id);
      return row ? { score: row[2], grid: row[3], finish: row[4], text: row[6] } : null;
    }),
  };
}
