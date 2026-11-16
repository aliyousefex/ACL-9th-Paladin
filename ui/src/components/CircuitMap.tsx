import { createContext, useContext, useEffect, useId, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import type { Layout, LayoutMeta } from "../lib/data";
import { MIN_CROSSING_SIN, MIN_GRID_ROWS, circuitDetail, gridRows, nearestSample, offsetPath, wornLine } from "../lib/mapDetail";
import { unitsPerPixel, type ViewBox } from "../lib/mapView";

/**
 * A circuit drawn from real geometry (see scripts/build_circuit_data.py).
 *
 * Every layer is optional: kerb-coloured sectors, DRS usage zones, numbered corners, the start
 * line. Sector and zone positions are fractions of a lap from the start line, drawn with
 * dash arrays on a path whose `pathLength` is normalised to 1000.
 */

export const SECTOR_COLOURS = ["var(--color-sector1)", "var(--color-sector2)", "var(--color-sector3)"] as const;

type Range = [number, number];

function segments(from: number, to: number): [number, number][] {
  // returns [startFraction, lengthFraction] pairs; a zone that crosses the start line becomes two
  if (to >= from) return [[from, to - from]];
  return [
    [from, 1 - from],
    [0, to],
  ];
}

/** The part of a range of the lap that falls between two fractions, or null when none does. A range that wraps the start line is left whole. */
function clip(range: Range, lo: number, hi: number): Range | null {
  if (range[1] < range[0]) return null;
  const from = Math.max(range[0], lo);
  const to = Math.min(range[1], hi);
  return to > from ? [from, to] : null;
}

/** A range of the lap with some stretches taken out of it. Ranges that wrap the start line are handled as two. */
function without(range: Range, gaps: Range[]): Range[] {
  const whole = (r: Range): Range[] => (r[0] <= r[1] ? [r] : [[r[0], 1], [0, r[1]]]);
  let pieces = whole(range);
  for (const hole of gaps.flatMap(whole)) {
    pieces = pieces.flatMap(([a, b]): Range[] => {
      if (hole[1] <= a || hole[0] >= b) return [[a, b]];
      const kept: Range[] = [];
      if (hole[0] > a) kept.push([a, hole[0]]);
      if (hole[1] < b) kept.push([hole[1], b]);
      return kept;
    });
  }
  return pieces;
}

/** One stroke along the lap: all of it, or only the stretch between two fractions of the lap. */
function Stroke({
  d,
  range,
  stroke,
  width,
  opacity = 1,
  cap = "round",
  filter,
  style,
}: {
  d: string;
  range?: Range;
  stroke: string;
  width: number;
  opacity?: number;
  cap?: "butt" | "round";
  filter?: string;
  style?: CSSProperties;
}) {
  const common = { d, pathLength: 1000, fill: "none", stroke, strokeWidth: width, strokeLinecap: cap, strokeLinejoin: "round", strokeOpacity: opacity, filter } as const;
  if (!range) return <path {...common} style={style} />;
  return (
    <>
      {segments(range[0], range[1]).map(([start, length], i) => (
        <path key={i} {...common} strokeDasharray={`${length * 1000} 2000`} strokeDashoffset={-start * 1000} />
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
  /** Show only this window of the map (zoom and pan). Omit for the whole circuit. */
  box?: ViewBox;
  /** Cap the drawn height in pixels; the outline keeps its aspect ratio inside it. */
  maxHeight?: number;
}

/** Corner badges are sized in screen pixels so they stay readable on a phone and shrink back as you zoom in. */
const BADGE_PX = { wide: 9, narrow: 8 } as const;
const FALLBACK_UNIT = 1.4;

/**
 * Map units per screen pixel, for anything drawn inside a CircuitMap (race markers, driver codes) that should keep a
 * fixed size on screen instead of shrinking with the drawing.
 */
const MapUnitContext = createContext(FALLBACK_UNIT);
export const useMapUnit = (): number => useContext(MapUnitContext);

const ASPHALT = "#2b3037";
const RUBBER = "#14171b";
const LIMIT = "#e4e8ee";
const SHADOW_PX = 2;

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
  box,
  maxHeight,
}: CircuitMapProps) {
  const [w, h] = layout.viewBox;
  const [hover, setHover] = useState<number | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const [measure, setMeasure] = useState<{ width: number; height: number } | null>(null);
  const view: ViewBox = box ?? [0, 0, w, h];
  const zoomed = view[2] < w - 0.5 || view[3] < h - 0.5;

  // Only corner badges and caller-supplied markers need the rendered size, so the observer runs only for them.
  const measuring = corners || children !== undefined;
  useEffect(() => {
    const node = svgRef.current;
    if (!measuring || !node || typeof ResizeObserver === "undefined") return;
    const read = () => {
      const rect = node.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) setMeasure((prev) => (prev && Math.abs(prev.width - rect.width) < 1 && Math.abs(prev.height - rect.height) < 1 ? prev : { width: rect.width, height: rect.height }));
    };
    read();
    const observer = new ResizeObserver(read);
    observer.observe(node);
    return () => observer.disconnect();
  }, [measuring]);
  const unit = measure ? unitsPerPixel(view, measure.width, measure.height) : FALLBACK_UNIT;
  const badge = (measure && measure.width < 480 ? BADGE_PX.narrow : BADGE_PX.wide) * unit;
  const focus = activeCorner ?? hover;
  const edge = 27 * weight;
  const asphalt = 20 * weight;
  const uid = useId().replace(/:/g, "");
  // Small renders (a thumbnail-sized outline) keep to the plain track: the grain, kerbs and chevrons are for a map you read.
  const fine = weight < 1.6;
  const drawn = animateDraw ? { strokeDasharray: 1000, ["--len" as string]: 1000, animation: "draw 1.6s var(--ease-out) both" } : undefined;
  const fade = animateDraw ? "map-in" : undefined;

  const sectorBounds = layout.sectors ? [0, layout.sectors[0], layout.sectors[1], 1] : null;

  // Everything below is derived from the outline's own samples (360 points an equal distance apart along the lap), never invented:
  // how sharply the line turns at each one, from which the kerbs, the worn line and the direction chevrons are placed, and where
  // the lap crosses itself.
  const geometry = useMemo(() => circuitDetail(layout.samples), [layout.samples]);
  // Where one pass goes over another: the later pass is drawn again on top (the deck), with a shadow on the track beneath, and the
  // line worn into the track beneath is left out where the deck covers it.
  const bridges = useMemo(
    () =>
      geometry.length > 0
        ? geometry.crossings.map((c) => {
            const reach = (units: number) => units / geometry.length;
            const wrap = (v: number) => ((v % 1) + 1) % 1;
            const across = edge / 2 / Math.max(c.sin, MIN_CROSSING_SIN);
            const around = (at: number, units: number): Range => [wrap(at - reach(units)), wrap(at + reach(units))];
            return { deck: around(c.over, across + 8 * weight), outline: around(c.over, across + 5.5 * weight), cast: around(c.over, across + 2 * weight), under: around(c.under, across + 3 * weight) };
          })
        : [],
    [geometry, edge, weight],
  );
  const worn = useMemo(
    () => (fine ? wornLine(layout.samples, asphalt * 0.46, bridges.map((b) => b.under)) : ""),
    [fine, layout.samples, asphalt, bridges],
  );
  const grid = useMemo(() => {
    if (!fine || !layout.start || layout.samples.length === 0) return [];
    const rows = gridRows(layout.samples, nearestSample(layout.samples, layout.start.x, layout.start.y), 10, asphalt * 0.55);
    return rows.length >= MIN_GRID_ROWS ? rows : [];
  }, [fine, layout.start, layout.samples, asphalt]);

  const flag = useMemo(() => {
    if (!layout.start) return null;
    const cols = 8;
    const size = (20 * weight) / cols;
    const cells: { x: number; y: number; dark: boolean }[] = [];
    for (let col = 0; col < cols; col++) {
      for (let row = 0; row < 2; row++) cells.push({ x: (col - cols / 2) * size, y: (row - 1) * size, dark: (col + row) % 2 === 0 });
    }
    return { cells, size, cols };
  }, [layout.start, weight]);

  /** The run-off band, the white limits and the asphalt: all of the lap, or just the stretch in `range`. */
  const road = (range?: Range) => (
    <>
      <Stroke d={layout.path} range={range} stroke={fine ? "#47515c" : "#5d6672"} width={edge} cap={range ? "butt" : "round"} style={range ? undefined : drawn} />
      {sectors &&
        sectorBounds &&
        [0, 1, 2].map((i) => {
          const part = range ? clip(range, sectorBounds[i], sectorBounds[i + 1]) : ([sectorBounds[i], sectorBounds[i + 1]] as Range);
          if (!part) return null;
          return (
            <Stroke
              key={i}
              d={layout.path}
              range={part}
              stroke={SECTOR_COLOURS[i]}
              width={edge + (activeSector === i ? 6 * weight : 0)}
              opacity={activeSector === null || activeSector === i ? 1 : 0.35}
              cap="butt"
            />
          );
        })}
      <Stroke d={layout.path} range={range} stroke={LIMIT} opacity={0.78} width={asphalt + 2.4 * weight} cap={range ? "butt" : "round"} style={range ? undefined : drawn} />
      <Stroke d={layout.path} range={range} stroke={ASPHALT} width={asphalt} cap={range ? "butt" : "round"} filter={fine ? `url(#${uid}-grain)` : undefined} style={range ? undefined : drawn} />
    </>
  );

  const kerbWidth = 3.4 * weight;
  const kerbAt = asphalt / 2 - kerbWidth / 2 + 1.2 * weight;

  return (
    <svg
      ref={svgRef}
      viewBox={`${view[0]} ${view[1]} ${view[2]} ${view[3]}`}
      className={className}
      role="img"
      aria-label={label}
      style={{ overflow: zoomed ? "hidden" : "visible", maxHeight }}
      focusable="false"
    >
      <defs>
        {/* Filter regions cover the whole map: by default a filter clips to the path's geometry, which leaves out the stroke's width. */}
        <filter id={`${uid}-soft`} filterUnits="userSpaceOnUse" x={-80} y={-80} width={w + 160} height={h + 160}>
          <feGaussianBlur stdDeviation={1.6 * weight} />
        </filter>
        {fine && (
          <>
            {/* tarmac: a fine speck, and broad patches where it has weathered lighter */}
            <filter id={`${uid}-grain`} filterUnits="userSpaceOnUse" x={-80} y={-80} width={w + 160} height={h + 160} colorInterpolationFilters="sRGB">
              <feTurbulence type="fractalNoise" baseFrequency="1.05" numOctaves={2} seed={4} result="noise" />
              <feColorMatrix in="noise" type="matrix" values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0.55 0 0 0 -0.3" result="speck" />
              <feComposite in="speck" in2="SourceGraphic" operator="in" result="grain" />
              <feTurbulence type="fractalNoise" baseFrequency="0.04" numOctaves={3} seed={9} result="patches" />
              <feColorMatrix in="patches" type="matrix" values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0.32 0 0 0 -0.13" result="weathered" />
              <feComposite in="weathered" in2="SourceGraphic" operator="in" result="wear" />
              <feMerge>
                <feMergeNode in="SourceGraphic" />
                <feMergeNode in="wear" />
                <feMergeNode in="grain" />
              </feMerge>
            </filter>
            {/* the worn line is rubber laid down, so its edges are soft */}
            <filter id={`${uid}-rubber`} filterUnits="userSpaceOnUse" x={-80} y={-80} width={w + 160} height={h + 160}>
              <feGaussianBlur stdDeviation={1.5 * weight} />
            </filter>
            <filter id={`${uid}-cast`} filterUnits="userSpaceOnUse" x={-80} y={-80} width={w + 160} height={h + 160}>
              <feGaussianBlur stdDeviation={2.6 * weight} />
            </filter>
            {/* a bridge's shadow falls on the track beneath it and nowhere else, so on a light page it never smudges the ground beside it */}
            {bridges.map((bridge, i) => (
              <mask key={i} id={`${uid}-under-${i}`} maskUnits="userSpaceOnUse" x={-80} y={-80} width={w + 160} height={h + 160}>
                <Stroke d={layout.path} range={bridge.under} stroke="#fff" width={edge} cap="butt" />
              </mask>
            ))}
          </>
        )}
      </defs>

      {/* depth: a close contact shadow under the track, just past its edge and a little below it, not a halo round it */}
      {fine && (
        <path
          d={layout.path}
          fill="none"
          stroke="#000"
          strokeOpacity={0.36}
          strokeWidth={edge + 3 * weight}
          strokeLinejoin="round"
          strokeLinecap="round"
          transform={`translate(0 ${SHADOW_PX * weight})`}
          filter={`url(#${uid}-soft)`}
        />
      )}

      {road()}

      {/* kerbs: red and white on the inside of the sharp turns, where the cars cut the corner */}
      {fine && (
        <g className={fade} data-map-kerbs>
          {geometry.kerbs.map((kerb, i) => {
            const d = offsetPath(kerb.points, kerb.side * kerbAt);
            return (
              <g key={i}>
                <path d={d} fill="none" stroke="#05070a" strokeOpacity={0.55} strokeWidth={kerbWidth + 1.1 * weight} strokeLinejoin="round" />
                <path d={d} fill="none" stroke="#f2f2f0" strokeWidth={kerbWidth} strokeLinejoin="round" />
                <path d={d} fill="none" stroke="#d40a00" strokeWidth={kerbWidth} strokeLinejoin="round" strokeDasharray={`${2.7 * weight} ${2.7 * weight}`} />
              </g>
            );
          })}
        </g>
      )}

      {/* a bridge where the lap crosses itself: the later pass goes over, with its shadow cast on the track below */}
      {fine && bridges.length > 0 && (
        <g className={fade} data-map-bridge>
          {bridges.map((bridge, i) => (
            <g key={i}>
              <g mask={`url(#${uid}-under-${i})`}>
                <g transform={`translate(0 ${2 * weight})`}>
                  <Stroke d={layout.path} range={bridge.cast} stroke="#000" opacity={0.7} width={edge + 6 * weight} cap="butt" filter={`url(#${uid}-cast)`} />
                </g>
              </g>
              <Stroke d={layout.path} range={bridge.outline} stroke="#05070a" opacity={0.85} width={edge + 1.3 * weight} cap="butt" />
              {road(bridge.deck)}
            </g>
          ))}
        </g>
      )}

      {/* the line the cars have worn into the asphalt, laid down soft-edged (and left out where it runs under a bridge) */}
      {fine && worn && (
        <g className={fade} data-map-worn>
          <path d={worn} fill="none" stroke={RUBBER} strokeOpacity={0.62} strokeWidth={asphalt * 0.3} strokeLinecap="butt" strokeLinejoin="round" filter={`url(#${uid}-rubber)`} />
        </g>
      )}

      {/* DRS usage zones run down the middle of the asphalt */}
      {drs &&
        layout.drs?.flatMap((zone, i) =>
          without([zone.from, zone.to], bridges.map((b) => b.under)).map((piece, j) => (
            <Stroke key={`${i}-${j}`} d={layout.path} range={piece} stroke="var(--color-drs)" width={asphalt * (activeDrs === i ? 0.75 : 0.5)} opacity={activeDrs === null || activeDrs === i ? 0.95 : 0.4} cap="butt" />
          )),
        )}

      {/* which way round: chevrons on the straights */}
      {startLine && fine && (
        <g className={fade} opacity={0.62} data-map-chevrons>
          {geometry.chevrons.map((c, i) => (
            <path
              key={i}
              transform={`translate(${c.x} ${c.y}) rotate(${c.angle})`}
              d={`M${-3.4 * weight} ${-4.2 * weight}L${2.2 * weight} 0L${-3.4 * weight} ${4.2 * weight}`}
              fill="none"
              stroke="#f4f4f2"
              strokeWidth={1.7 * weight}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          ))}
        </g>
      )}

      {/* the starting grid: two staggered columns of boxes behind the line, as every grand prix has. Matte paint on the tarmac: a thin, dull
          line, never bright, so it sits in the surface and does not shine out of it. */}
      {startLine && grid.length > 0 && (
        <g className={fade} data-map-grid>
          {grid.map((row, i) =>
            [-1, 1].map((side) => {
              // the left column is on its mark; the right column sits half a row further back
              const back = side === 1 ? asphalt * 0.275 : 0;
              return (
                <rect
                  key={`${i}-${side}`}
                  transform={`translate(${row.x} ${row.y}) rotate(${row.angle}) translate(${-back} ${side * asphalt * 0.2})`}
                  x={-2.4 * weight}
                  y={-1.5 * weight}
                  width={4.8 * weight}
                  height={3 * weight}
                  fill="none"
                  stroke="#aeb4bc"
                  strokeOpacity={0.4}
                  strokeWidth={0.42 * weight}
                />
              );
            }),
          )}
        </g>
      )}

      {/* the sector timing lines, where the sectors begin */}
      {sectors &&
        sectorBounds &&
        [sectorBounds[1], sectorBounds[2]].map((fraction, i) => {
          const mark = geometry.at(fraction);
          return (
            <rect
              key={i}
              transform={`translate(${mark.x} ${mark.y}) rotate(${mark.angle + 90})`}
              x={-(edge / 2 + 1.5 * weight)}
              y={-0.9 * weight}
              width={edge + 3 * weight}
              height={1.8 * weight}
              fill="#f4f4f2"
              opacity={0.92}
            />
          );
        })}

      {startLine && layout.start && flag && (
        <g transform={`translate(${layout.start.x} ${layout.start.y}) rotate(${layout.start.heading + 90})`}>
          <rect x={-flag.size * flag.cols * 0.5 - 0.5 * weight} y={-flag.size - 0.5 * weight} width={flag.size * flag.cols + weight} height={flag.size * 2 + weight} fill="#0b0e12" />
          {flag.cells.map((c, i) => (
            <rect key={i} x={c.x} y={c.y} width={flag.size} height={flag.size} fill={c.dark ? "#0b0e12" : "#f4f4f2"} />
          ))}
        </g>
      )}

      {corners &&
        layout.corners.map((c) => {
          const on = focus === c.n;
          const r = badge * (on ? 1.25 : 1);
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
              <line x1={c.x} y1={c.y} x2={c.lx} y2={c.ly} stroke={on ? "#f4f4f2" : "#6b7480"} strokeWidth={(on ? 1.6 : 1) * unit} />
              <circle cx={c.lx} cy={c.ly} r={r} fill={on ? "#e10600" : "#0a0b0e"} stroke={on ? "#fff" : "#8a929d"} strokeWidth={1.2 * unit} />
              <text
                x={c.lx}
                y={c.ly + 0.5 * unit}
                textAnchor="middle"
                dominantBaseline="central"
                fontSize={r * 1.3}
                fontWeight={700}
                fill="#f4f4f2"
                style={{ fontFamily: "var(--font-display)", pointerEvents: "none" }}
              >
                {c.n}
              </text>
            </g>
          );
        })}

      <MapUnitContext.Provider value={unit}>{children}</MapUnitContext.Provider>
    </svg>
  );
}

/** Tiny static outline for cards: coarse path, one stroke, no layers. */
export function CircuitThumb({
  meta,
  className = "",
  stroke = "var(--color-ink)",
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
      <path d={meta.thumb} fill="none" stroke={accent ?? "var(--color-line2)"} strokeWidth={width + 12} strokeLinejoin="round" strokeLinecap="round" />
      <path d={meta.thumb} fill="none" stroke={stroke} strokeWidth={width} strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}
