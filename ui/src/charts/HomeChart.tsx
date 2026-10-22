import { useState } from "react";
import site from "../data/site.json";
import { pct } from "../lib/format";

const W = 1000;
const H = 230;
const PAD = { l: 52, r: 24, t: 14, b: 30 };
const MAX = 0.6;

/** Podium rate by grid band, away drivers against home drivers. Plain SVG: no chart library. */
export function HomeChart() {
  const rows = site.home;
  const [hover, setHover] = useState<number | null>(null);
  const x = (i: number) => PAD.l + (i / (rows.length - 1)) * (W - PAD.l - PAD.r);
  const y = (v: number) => PAD.t + (1 - v / MAX) * (H - PAD.t - PAD.b);
  const line = (pick: (row: (typeof rows)[number]) => number) =>
    rows.map((row, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)} ${y(pick(row)).toFixed(1)}`).join("");
  const slot = (W - PAD.l - PAD.r) / (rows.length - 1);

  return (
    <div className="w-full">
      <p className="mb-2 text-[1rem]">
        <span className="text-steel">Away</span>
        <span className="mx-2 text-line2">/</span>
        <span className="text-ink">Home</span>
      </p>
      <div className="relative">
        <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label="Podium rate by grid band for away and home drivers">
          {[0, 0.15, 0.3, 0.45, 0.6].map((t) => (
            <g key={t}>
              <line x1={PAD.l} x2={W - PAD.r} y1={y(t)} y2={y(t)} stroke="#262b33" />
              <text x={PAD.l - 8} y={y(t) + 4} textAnchor="end" fill="#c5cad1" fontSize={13} style={{ fontFamily: "var(--font-display)" }}>
                {pct(t, 0)}
              </text>
            </g>
          ))}
          {rows.map((row, i) => (
            <text key={row.band} x={x(i)} y={H - 8} textAnchor="middle" fill="#c5cad1" fontSize={13} style={{ fontFamily: "var(--font-display)" }}>
              {row.band}
            </text>
          ))}
          {hover !== null && <line x1={x(hover)} x2={x(hover)} y1={PAD.t} y2={H - PAD.b} stroke="#39414c" />}
          <path d={line((r) => r.awayRate)} fill="none" stroke="#c5cad1" strokeWidth={1.9} strokeLinejoin="round" />
          <path d={line((r) => r.homeRate)} fill="none" stroke="#e10600" strokeWidth={1.9} strokeLinejoin="round" />
          {rows.map((row, i) => (
            <g key={row.band}>
              <circle cx={x(i)} cy={y(row.awayRate)} r={hover === i ? 5.5 : 3.5} fill="#c5cad1" />
              <circle cx={x(i)} cy={y(row.homeRate)} r={hover === i ? 5.5 : 3.5} fill="#e10600" />
              <rect
                x={x(i) - slot / 2}
                y={PAD.t}
                width={slot}
                height={H - PAD.t - PAD.b}
                fill="transparent"
                onPointerEnter={() => setHover(i)}
                onPointerLeave={() => setHover(null)}
              />
            </g>
          ))}
        </svg>
        {hover !== null && (
          <p
            className="pointer-events-none absolute top-0 border border-line bg-tower px-2 py-1 font-display text-[0.95rem] text-ink"
            style={{ left: `${(x(hover) / W) * 100}%`, transform: `translateX(${hover > 2 ? "-105%" : "8%"})` }}
          >
            Grid {rows[hover].band} · away {pct(rows[hover].awayRate)} · home {pct(rows[hover].homeRate)}
          </p>
        )}
      </div>
    </div>
  );
}
