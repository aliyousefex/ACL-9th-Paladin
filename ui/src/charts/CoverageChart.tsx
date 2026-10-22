import { useState } from "react";
import site from "../data/site.json";
import { pct } from "../lib/format";

const W = 1000;
const H = 260;
const PAD = { l: 52, r: 10, t: 26, b: 28 };
const FIRST = 1950;
const LAST = 2024;

const x = (year: number) => PAD.l + ((year - FIRST) / (LAST - FIRST)) * (W - PAD.l - PAD.r);
const y = (value: number) => PAD.t + (1 - value) * (H - PAD.t - PAD.b);

/** Share of driver-race rows with a qualifying position, by season. Plain SVG: no chart library. */
export function CoverageChart({ year }: { year: number }) {
  const [hover, setHover] = useState<number | null>(null);
  const shown = hover ?? year;
  const point = site.coverage.find((row) => row.year === shown);
  const path = site.coverage.map((row, i) => `${i === 0 ? "M" : "L"}${x(row.year).toFixed(1)} ${y(row.coverage).toFixed(1)}`).join("");

  return (
    <figure aria-labelledby="coverage-chart-title">
      <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
        <div>
          <p id="coverage-chart-title" className="font-medium">Recorded qualifying-position coverage</p>
          <p className="mt-1 text-[0.92rem] text-steel">Y-axis · share of driver-race rows with qualifying data</p>
        </div>
        <p className="text-[0.92rem] text-steel">X-axis · Formula One season</p>
      </div>
      <div className="relative">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="h-auto w-full touch-pan-y"
          role="img"
          aria-label={`Coverage by season from 1950 to 2024. ${shown}: ${point ? pct(point.coverage) : "no data"}.`}
          onPointerMove={(event) => {
            const box = event.currentTarget.getBoundingClientRect();
            const px = ((event.clientX - box.left) / box.width) * W;
            const season = Math.round(FIRST + ((px - PAD.l) / (W - PAD.l - PAD.r)) * (LAST - FIRST));
            setHover(Math.min(LAST, Math.max(FIRST, season)));
          }}
          onPointerLeave={() => setHover(null)}
        >
          {[0, 0.5, 1].map((t) => (
            <g key={t}>
              <line x1={PAD.l} x2={W - PAD.r} y1={y(t)} y2={y(t)} stroke="#262b33" />
              <text x={PAD.l - 8} y={y(t) + 4} textAnchor="end" fill="#c5cad1" fontSize={13} style={{ fontFamily: "var(--font-display)" }}>
                {pct(t, 0)}
              </text>
            </g>
          ))}
          <rect x={x(1950)} y={PAD.t} width={x(1993) - x(1950)} height={H - PAD.t - PAD.b} fill="#c5cad1" fillOpacity={0.06} />
          <text x={(x(1950) + x(1993)) / 2} y={PAD.t + 16} textAnchor="middle" fill="#c5cad1" fontSize={13}>
            No qualifying rows recorded
          </text>
          {[1950, 1970, 1990, 2000, 2010, 2024].map((t) => (
            <text key={t} x={x(t)} y={H - 8} textAnchor="middle" fill="#c5cad1" fontSize={13} style={{ fontFamily: "var(--font-display)" }}>
              {t}
            </text>
          ))}
          <line x1={x(year)} x2={x(year)} y1={PAD.t} y2={H - PAD.b} stroke="#e10600" strokeWidth={1.5} />
          <path d={path} fill="none" stroke="#f4f4f2" strokeWidth={1.8} strokeLinejoin="round" />
          {point && <circle cx={x(point.year)} cy={y(point.coverage)} r={4.5} fill="#e10600" stroke="#f4f4f2" strokeWidth={1.5} />}
        </svg>
        {hover !== null && point && (
          <p
            className="pointer-events-none absolute top-0 border border-line bg-tower px-2 py-1 font-display text-[0.95rem] text-ink"
            style={{ left: `${(x(hover) / W) * 100}%`, transform: `translateX(${hover > 1990 ? "-105%" : "8%"})` }}
          >
            Season {point.year} · {pct(point.coverage)} of rows covered
          </p>
        )}
      </div>
      <figcaption className="mt-2 max-w-[72ch] text-[0.92rem] leading-relaxed text-steel">
        Zero means this public dataset has no recorded qualifying position for those rows. It does not mean qualifying sessions did not happen.
      </figcaption>
    </figure>
  );
}
