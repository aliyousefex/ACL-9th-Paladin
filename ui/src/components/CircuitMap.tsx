import { useMemo, useState, type ReactNode } from "react";
import type { Layout, LayoutMeta } from "../lib/data";

/**
 * A circuit drawn from real geometry (see scripts/build_circuit_data.py).
 *
 * Every layer is optional: kerb-coloured sectors, DRS usage zones, numbered corners, the start
 * line. Sector and zone positions are fractions of a lap from the start line, drawn with
 * dash arrays on a path whose `pathLength` is normalised to 1000.
 */

export const SECTOR_COLOURS = ["var(--color-sector1)", "var(--color-sector2)", "var(--color-sector3)"] as const;

function segments(from: number, to: number): [number, number][] {
  // returns [startFraction, lengthFraction] pairs; a zone that crosses the start line becomes two
  if (to >= from) return [[from, to - from]];
  return [
    [from, 1 - from],
    [0, to],
  ];
}

function Seg({
  d,
  from,
  to,
  stroke,
  width,
  opacity = 1,
  cap = "butt",
}: {
  d: string;
  from: number;
  to: number;
  stroke: string;
  width: number;
  opacity?: number;
  cap?: "butt" | "round";
}) {
  return (
    <>
      {segments(from, to).map(([start, length], i) => (
        <path
          key={i}
          d={d}
          pathLength={1000}
          fill="none"
          stroke={stroke}
          strokeWidth={width}
          strokeLinecap={cap}
          strokeLinejoin="round"
          strokeOpacity={opacity}
          strokeDasharray={`${length * 1000} 2000`}
          strokeDashoffset={-start * 1000}
        />
      ))}
    </>
  );
}

export interface CircuitMapProps {
  layout: Layout;
  className?: string;
  corners?: boolean;
  sectors?: boolean;
  drs?: boolean;
  startLine?: boolean;
  /** Track width in viewBox units; thinner for small renders. */
  weight?: number;
  activeSector?: number | null;
  activeCorner?: number | null;
  activeDrs?: number | null;
  onCorner?: (n: number | null) => void;
  animateDraw?: boolean;
  label: string;
  /** SVG drawn above the track in viewBox coordinates (race markers, for example). */
  children?: ReactNode;
}

export function CircuitMap({
  layout,
  className = "",
  corners = false,
  sectors = false,
  drs = false,
  startLine = true,
  weight = 1,
  activeSector = null,
  activeCorner = null,
  activeDrs = null,
  onCorner,
  animateDraw = false,
  label,
  children,
}: CircuitMapProps) {
  const [w, h] = layout.viewBox;
  const [hover, setHover] = useState<number | null>(null);
  const focus = activeCorner ?? hover;
  const edge = 27 * weight;
  const asphalt = 20 * weight;

  const sectorBounds = layout.sectors ? [0, layout.sectors[0], layout.sectors[1], 1] : null;

  const flag = useMemo(() => {
    if (!layout.start) return null;
    const cells: { x: number; y: number; dark: boolean }[] = [];
    const size = 5 * weight;
    for (let col = 0; col < 8; col++) {
      for (let row = 0; row < 2; row++) cells.push({ x: (col - 4) * size, y: (row - 1) * size, dark: (col + row) % 2 === 0 });
    }
    return { cells, size };
  }, [layout.start, weight]);

  const arrow = useMemo(() => {
    const samples = layout.samples;
    if (samples.length < 20) return null;
    const a = samples[9];
    const b = samples[11];
    const angle = (Math.atan2(b[1] - a[1], b[0] - a[0]) * 180) / Math.PI;
    return { x: samples[10][0], y: samples[10][1], angle };
  }, [layout.samples]);

  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      className={className}
      role="img"
      aria-label={label}
      style={{ overflow: "visible" }}
      focusable="false"
    >
      {/* kerbs: grey, or sector colours when sectors are on */}
      <path
        d={layout.path}
        pathLength={1000}
        fill="none"
        stroke="#5d6672"
        strokeWidth={edge}
        strokeLinejoin="round"
        strokeLinecap="round"
        style={animateDraw ? { strokeDasharray: 1000, ["--len" as string]: 1000, animation: "draw 1.6s var(--ease-out) both" } : undefined}
      />
      {sectors &&
        sectorBounds &&
        [0, 1, 2].map((i) => (
          <Seg
            key={i}
            d={layout.path}
            from={sectorBounds[i]}
            to={sectorBounds[i + 1]}
            stroke={SECTOR_COLOURS[i]}
            width={edge + (activeSector === i ? 6 * weight : 0)}
            opacity={activeSector === null || activeSector === i ? 1 : 0.35}
          />
        ))}
      {/* asphalt */}
      <path
        d={layout.path}
        pathLength={1000}
        fill="none"
        stroke="#0b0e12"
        strokeWidth={asphalt}
        strokeLinejoin="round"
        strokeLinecap="round"
        style={animateDraw ? { strokeDasharray: 1000, ["--len" as string]: 1000, animation: "draw 1.6s var(--ease-out) both" } : undefined}
      />
      {/* DRS usage zones run down the middle of the asphalt */}
      {drs &&
        layout.drs?.map((zone, i) => (
          <Seg
            key={i}
            d={layout.path}
            from={zone.from}
            to={zone.to}
            stroke="var(--color-drs)"
            width={asphalt * (activeDrs === i ? 0.75 : 0.5)}
            opacity={activeDrs === null || activeDrs === i ? 0.95 : 0.4}
          />
        ))}
      {/* faint racing line */}
      <path
        d={layout.path}
        fill="none"
        stroke="#ffffff"
        strokeOpacity={0.14}
        strokeWidth={1.6 * weight}
        strokeDasharray={`${7 * weight} ${9 * weight}`}
      />

      {startLine && layout.start && flag && (
        <g transform={`translate(${layout.start.x} ${layout.start.y}) rotate(${layout.start.heading + 90})`}>
          <rect x={-4.5 * flag.size} y={-flag.size} width={9 * flag.size} height={2 * flag.size} fill="#0b0e12" />
          {flag.cells.map((c, i) => (
            <rect key={i} x={c.x} y={c.y} width={flag.size} height={flag.size} fill={c.dark ? "#0b0e12" : "#f4f4f2"} />
          ))}
        </g>
      )}
      {startLine && arrow && (
        <g transform={`translate(${arrow.x} ${arrow.y}) rotate(${arrow.angle})`} opacity={0.9}>
          <path d={`M${-6 * weight} ${-6 * weight}L${4 * weight} 0L${-6 * weight} ${6 * weight}`} fill="none" stroke="#f4f4f2" strokeWidth={2.2 * weight} strokeLinecap="round" strokeLinejoin="round" />
        </g>
      )}

      {corners &&
        layout.corners.map((c) => {
          const on = focus === c.n;
          return (
            <g
              key={c.n}
              onPointerEnter={() => {
                setHover(c.n);
                onCorner?.(c.n);
              }}
              onPointerLeave={() => {
                setHover(null);
                onCorner?.(null);
              }}
              style={{ cursor: "default" }}
            >
              <line x1={c.x} y1={c.y} x2={c.lx} y2={c.ly} stroke={on ? "#f4f4f2" : "#6b7480"} strokeWidth={on ? 2 : 1.2} />
              <circle cx={c.lx} cy={c.ly} r={on ? 15 : 12.5} fill={on ? "#e10600" : "#0a0b0e"} stroke={on ? "#fff" : "#8a929d"} strokeWidth={1.4} />
              <text
                x={c.lx}
                y={c.ly + 0.5}
                textAnchor="middle"
                dominantBaseline="central"
                fontSize={on ? 15 : 13}
                fontWeight={700}
                fill="#f4f4f2"
                style={{ fontFamily: "var(--font-display)", pointerEvents: "none" }}
              >
                {c.n}
              </text>
            </g>
          );
        })}

      {children}
    </svg>
  );
}

/** Tiny static outline for cards: coarse path, one stroke, no layers. */
export function CircuitThumb({
  meta,
  className = "",
  stroke = "#f4f4f2",
  width = 14,
  accent,
}: {
  meta: LayoutMeta;
  className?: string;
  stroke?: string;
  width?: number;
  accent?: string;
}) {
  if (!meta.thumb || !meta.viewBox) return null;
  const [w, h] = meta.viewBox;
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className={className} aria-hidden focusable="false">
      <path d={meta.thumb} fill="none" stroke={accent ?? "#39414c"} strokeWidth={width + 12} strokeLinejoin="round" strokeLinecap="round" />
      <path d={meta.thumb} fill="none" stroke={stroke} strokeWidth={width} strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}
