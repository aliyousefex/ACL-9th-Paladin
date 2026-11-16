import { useEffect, useRef, useState } from "react";
import { ordinal } from "../lib/format";
import type { ArcPoint } from "../features/drivers/profile";

/**
 * Where a driver or a team stood in the championship after each round of a season: the line drops as the position improves, with P1
 * at the top. It is drawn in the pixels it is shown in (the width is measured), so its numbers are never scaled below the size the
 * rest of the site is set in, on a phone or a monitor. The team's colour is the line; the figures beside it say the same in words.
 */
export function ArcChart({ points, colour, label, raceName }: { points: ArcPoint[]; colour: string; label: string; raceName: (raceId: number) => string }) {
  const box = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(640);
  useEffect(() => {
    const node = box.current;
    if (!node) return;
    const read = () => setWidth(Math.max(260, Math.round(node.getBoundingClientRect().width)));
    read();
    if (typeof ResizeObserver === "undefined") return;
    const watch = new ResizeObserver(read);
    watch.observe(node);
    return () => watch.disconnect();
  }, []);

  const known = points.filter((p) => p.position !== null);
  if (known.length === 0) return null;

  const worst = Math.max(...known.map((p) => p.position!));
  const bottom = Math.max(5, Math.ceil(worst / 5) * 5);
  const height = 220;
  const pad = { left: 34, right: 46, top: 14, bottom: 30 };
  const innerW = width - pad.left - pad.right;
  const innerH = height - pad.top - pad.bottom;
  const x = (round: number) => pad.left + (points.length === 1 ? innerW / 2 : ((round - 1) / (points.length - 1)) * innerW);
  const y = (position: number) => pad.top + ((position - 1) / (bottom - 1)) * innerH;

  // the line, broken where the person had no position yet or any more
  let path = "";
  let open = false;
  for (const p of points) {
    if (p.position === null) {
      open = false;
      continue;
    }
    path += `${open ? "L" : "M"}${x(p.round).toFixed(1)} ${y(p.position).toFixed(1)}`;
    open = true;
  }
  const grid = [1, ...Array.from({ length: bottom / 5 }, (_, i) => (i + 1) * 5)].filter((v, i, all) => all.indexOf(v) === i && v <= bottom);
  const last = known[known.length - 1];
  const tickEvery = points.length > 16 ? 5 : points.length > 8 ? 2 : 1;
  const best = known.reduce((a, b) => (b.position! < a.position! ? b : a));

  return (
    <div ref={box} className="w-full">
      <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} role="img" aria-label={label} className="block overflow-visible" focusable="false">
        {grid.map((v) => (
          <g key={v}>
            <line x1={pad.left} x2={width - pad.right} y1={y(v)} y2={y(v)} stroke="var(--color-line)" strokeWidth={1} />
            <text x={pad.left - 8} y={y(v)} textAnchor="end" dominantBaseline="central" fontSize={12} fill="var(--color-mute)" style={{ fontVariantNumeric: "tabular-nums" }}>
              P{v}
            </text>
          </g>
        ))}
        {points.map((p) =>
          p.round === 1 || p.round === points.length || p.round % tickEvery === 0 ? (
            <text key={p.round} x={x(p.round)} y={height - 8} textAnchor="middle" fontSize={12} fill="var(--color-mute)" style={{ fontVariantNumeric: "tabular-nums" }}>
              {p.round}
            </text>
          ) : null,
        )}
        <text x={pad.left} y={height - 8} textAnchor="end" fontSize={12} fill="var(--color-mute)" dx={-8}>
          Rd
        </text>
        <path d={path} fill="none" stroke={colour} strokeWidth={2.4} strokeLinejoin="round" strokeLinecap="round" />
        {known.map((p) => (
          <circle key={p.round} cx={x(p.round)} cy={y(p.position!)} r={p.round === last.round || p.round === best.round ? 4.2 : 2.3} fill={p.round === last.round ? colour : "var(--color-paper)"} stroke={colour} strokeWidth={1.8}>
            <title>{`After round ${p.round}, ${raceName(p.raceId)}: ${ordinal(p.position!)}${p.points !== null ? `, ${p.points} points` : ""}`}</title>
          </circle>
        ))}
        <text x={x(last.round) + 10} y={y(last.position!)} dominantBaseline="central" fontSize={13} fontWeight={700} fill="var(--color-ink)" style={{ fontVariantNumeric: "tabular-nums" }}>
          P{last.position}
        </text>
      </svg>
    </div>
  );
}
