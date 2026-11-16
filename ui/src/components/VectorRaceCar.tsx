import { useId } from "react";

/**
 * An original open-wheel car, seen from above with its nose to the right, for circuit maps. It is drawn in the proportions of a
 * real one (about 2.8 times as long as it is wide, 37 by 14 units at scale 1), in team colour with the parts a car has: a
 * front wing of three elements with end plates, a nose, four tyres with their rims, suspension arms, the floor showing between
 * the wheels, a body that swells into sidepods with their intakes, mirrors, a shark fin, the halo and the driver's helmet, and a
 * rear wing with its flap, end plates and beam wing. The bodywork is shaded as a curved surface, and a ground shadow sits it on
 * the track. Nothing in it is a real team's livery or marking.
 */

type Pt = [number, number];

const r = (n: number) => String(Math.round(n * 100) / 100);

/** A smooth closed outline through the points (a Catmull-Rom curve, written as cubic Béziers). */
function smooth(points: Pt[]): string {
  const n = points.length;
  let d = `M${r(points[0][0])} ${r(points[0][1])}`;
  for (let i = 0; i < n; i++) {
    const a = points[(i - 1 + n) % n];
    const b = points[i];
    const c = points[(i + 1) % n];
    const e = points[(i + 2) % n];
    d += `C${r(b[0] + (c[0] - a[0]) / 6)} ${r(b[1] + (c[1] - a[1]) / 6)} ${r(c[0] - (e[0] - b[0]) / 6)} ${r(c[1] - (e[1] - b[1]) / 6)} ${r(c[0])} ${r(c[1])}`;
  }
  return d + "Z";
}

/** Both sides of a symmetrical shape from one: (x, half-width) pairs from the front to the back. */
const both = (half: Pt[]): Pt[] => [...half.map(([x, w]): Pt => [x, -w]), ...half.slice().reverse().map(([x, w]): Pt => [x, w])];

/** The bodywork: nose, monocoque, sidepods that swell and then fall away to the gearbox. */
const BODY = smooth(
  both([
    [15.5, 0.5],
    [14, 0.9],
    [11.5, 1.25],
    [9, 1.6],
    [6.5, 2],
    [5, 2.45],
    [3.8, 3.1],
    [2.4, 3.65],
    [0.6, 4],
    [-1.6, 4.1],
    [-3.8, 3.9],
    [-6, 3.35],
    [-8.2, 2.5],
    [-10.5, 1.8],
    [-12.5, 1.45],
    [-14.4, 1.25],
    [-15.3, 0.9],
  ]),
);

/** The floor: wider than the bodywork between the axles, so a strip of it shows beside the sidepods. */
const FLOOR = smooth(
  both([
    [7.6, 2.6],
    [6.4, 4.7],
    [4.5, 5.5],
    [-8.2, 5.5],
    [-9.1, 3.6],
    [-12, 3.2],
    [-15.4, 3.1],
  ]),
);

/** The engine cover, a raised ridge down the middle that narrows to the tail. */
const SPINE = smooth(
  both([
    [1.2, 0.7],
    [-1, 1.3],
    [-4, 1.25],
    [-8, 0.95],
    [-12, 0.7],
    [-14.2, 0.55],
  ]),
);

const DARK = "#0d0f13";
const EDGE = "#3a424d";

export function VectorRaceCar({
  colour,
  ink,
  number,
  angle = 0,
  scale = 1,
  selected = false,
}: {
  colour: string;
  ink: string;
  number: number | null;
  angle?: number;
  scale?: number;
  selected?: boolean;
}) {
  const id = useId().replace(/:/g, "");
  const shade = `color-mix(in srgb, ${colour} 55%, #000)`;
  const light = `color-mix(in srgb, ${colour} 70%, #fff)`;
  return (
    <g data-race-car transform={`rotate(${angle}) scale(${scale})`} aria-hidden>
      <defs>
        {/* the body is lit from above: brightest down the middle, falling away to the sidepod edges */}
        <linearGradient id={`${id}-body`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={shade} />
          <stop offset="0.3" stopColor={colour} />
          <stop offset="0.5" stopColor={light} />
          <stop offset="0.7" stopColor={colour} />
          <stop offset="1" stopColor={shade} />
        </linearGradient>
        <linearGradient id={`${id}-wing`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#2a313a" />
          <stop offset="1" stopColor="#12161b" />
        </linearGradient>
        <linearGradient id={`${id}-tyre`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#262b33" />
          <stop offset="0.5" stopColor="#0a0c0f" />
          <stop offset="1" stopColor="#1f242b" />
        </linearGradient>
      </defs>

      {selected && <ellipse cx={0} cy={0} rx={27} ry={14} fill="none" stroke="var(--color-signal)" strokeWidth={2.5} strokeDasharray="4 3" />}

      {/* sits on the track: the whole car's footprint, offset and darkened */}
      <g transform="translate(0.9 1.6)" fill="#000" opacity={0.34}>
        <path d={FLOOR} />
        <path d={BODY} />
        <rect x={-14.2} y={-6.5} width={5.2} height={13} rx={1.2} />
        <rect x={8.5} y={-6.4} width={4.6} height={12.8} rx={1} />
        <rect x={13.6} y={-6.8} width={4.9} height={13.6} rx={0.6} />
        <rect x={-18.6} y={-4.7} width={4.2} height={9.4} rx={0.6} />
      </g>

      {/* rear wing: beam wing, main plane, the flap with its DRS slot, and end plates in team colour */}
      <rect x={-15.4} y={-3.6} width={0.95} height={7.2} rx={0.3} fill={`url(#${id}-wing)`} stroke={EDGE} strokeWidth={0.15} />
      <rect x={-16.9} y={-4} width={1.6} height={8} rx={0.3} fill={`url(#${id}-wing)`} stroke={EDGE} strokeWidth={0.15} />
      <rect x={-18.4} y={-3.9} width={1.8} height={7.8} rx={0.35} fill="#222830" stroke={EDGE} strokeWidth={0.15} />
      <path d="M-17.7 -3.7V3.7" stroke="#0a0c0f" strokeWidth={0.22} />
      <rect x={-18.6} y={-4.75} width={4.3} height={0.75} rx={0.35} fill={colour} stroke={DARK} strokeWidth={0.25} />
      <rect x={-18.6} y={4} width={4.3} height={0.75} rx={0.35} fill={colour} stroke={DARK} strokeWidth={0.25} />
      <rect x={-15.4} y={-0.55} width={0.5} height={1.1} rx={0.15} fill="#ff3b2f" />

      {/* the floor, with its edge, and the vanes ahead of the sidepods */}
      <path d={FLOOR} fill="#12161b" stroke={EDGE} strokeWidth={0.28} strokeLinejoin="round" />
      <path d="M6.9 3 7.5 4.5M6.1 2.8 6.6 4.2M5.4 2.6 5.7 3.8M6.9-3 7.5-4.5M6.1-2.8 6.6-4.2M5.4-2.6 5.7-3.8" fill="none" stroke="#2c343e" strokeWidth={0.36} strokeLinecap="round" />

      {/* suspension arms, hub to chassis */}
      <path d="M5.8 2.1 10.4 3.9M8.4 1.7 11 3.9M5.8-2.1 10.4-3.9M8.4-1.7 11-3.9M-7.6 2.2-11 3.2M-10.4 1.7-11.8 3.2M-7.6-2.2-11-3.2M-10.4-1.7-11.8-3.2" fill="none" stroke="#2a313a" strokeWidth={0.5} strokeLinecap="round" />

      {/* tyres: the wide rears, the narrower fronts, each with its lit edge and the rim showing on the outside */}
      {[-1, 1].map((side) => (
        <g key={side} transform={side === -1 ? "scale(1 -1)" : undefined}>
          <rect x={-14.2} y={3.1} width={5.2} height={3.4} rx={1.2} fill={`url(#${id}-tyre)`} stroke={DARK} strokeWidth={0.25} />
          <rect x={-13.4} y={6} width={3.6} height={0.5} rx={0.25} fill="#4a515c" />
          <path d="M-13.3 3.5H-9.9" stroke="#323943" strokeWidth={0.25} strokeLinecap="round" />
          <rect x={8.5} y={3.9} width={4.6} height={2.5} rx={1} fill={`url(#${id}-tyre)`} stroke={DARK} strokeWidth={0.25} />
          <rect x={9.3} y={5.95} width={3} height={0.45} rx={0.22} fill="#4a515c" />
          <path d="M9.4 4.25H12.3" stroke="#323943" strokeWidth={0.25} strokeLinecap="round" />
        </g>
      ))}

      {/* front wing: three elements, each a little wider than the one in front, and end plates in team colour */}
      <rect x={13.8} y={-6.3} width={1.45} height={12.6} rx={0.4} fill="#222830" stroke={EDGE} strokeWidth={0.15} />
      <rect x={15} y={-6.15} width={1.6} height={12.3} rx={0.4} fill={`url(#${id}-wing)`} stroke={EDGE} strokeWidth={0.15} />
      <rect x={16.4} y={-6} width={1.9} height={12} rx={0.45} fill={`url(#${id}-wing)`} stroke={EDGE} strokeWidth={0.15} />
      <path d="M15 -5.6V5.6M16.5-5.5V5.5" stroke="#0a0c0f" strokeWidth={0.2} />
      <rect x={13.7} y={-6.85} width={4.8} height={0.8} rx={0.4} fill={colour} stroke={DARK} strokeWidth={0.25} />
      <rect x={13.7} y={6.05} width={4.8} height={0.8} rx={0.4} fill={colour} stroke={DARK} strokeWidth={0.25} />
      <path d="M14.3 6.85 17.4 6.85 18 7.5 14.9 7.5ZM14.3-6.85 17.4-6.85 18-7.5 14.9-7.5Z" fill="#1c2128" stroke={EDGE} strokeWidth={0.15} strokeLinejoin="round" />

      {/* the body: shaded across, with an edge, the engine cover down the middle, and the sidepod intakes and vents */}
      <path d={BODY} fill={`url(#${id}-body)`} stroke={DARK} strokeWidth={0.45} strokeLinejoin="round" />
      <path d={SPINE} fill={light} opacity={0.3} />
      <path d="M14.2 -0.55V0.55" stroke={DARK} strokeWidth={0.5} strokeLinecap="round" opacity={0.7} />
      <path d="M4.9 2.5 2.5 3.55 2.9 2.95 4.7 2.15ZM4.9-2.5 2.5-3.55 2.9-2.95 4.7-2.15Z" fill={DARK} opacity={0.88} />
      <path d="M2.7 3.5 4.9 2.5M2.7-3.5 4.9-2.5" stroke={light} strokeOpacity={0.55} strokeWidth={0.2} strokeLinecap="round" />
      <path d="M-4.6 2.5-6.2 2.2M-5 3-6.8 2.6M-4.6-2.5-6.2-2.2M-5-3-6.8-2.6" stroke={DARK} strokeOpacity={0.55} strokeWidth={0.28} strokeLinecap="round" />
      <path d="M-3.2 0H-13.8" stroke={shade} strokeWidth={0.5} strokeLinecap="round" />
      <path d="M-3.2-0.28H-13.6" stroke={light} strokeOpacity={0.5} strokeWidth={0.18} strokeLinecap="round" />
      <path d="M-4.2 3.3C-6 3.6-8 3.3-9.6 2.5M-4.2-3.3C-6-3.6-8-3.3-9.6-2.5" fill="none" stroke={shade} strokeOpacity={0.7} strokeWidth={0.3} strokeLinecap="round" />

      {/* mirrors, on their stalks */}
      <path d="M5.7 2.3 5.9 2.9M5.7-2.3 5.9-2.9" stroke={DARK} strokeWidth={0.3} />
      <rect x={5.2} y={2.8} width={1.5} height={0.85} rx={0.3} fill={colour} stroke={DARK} strokeWidth={0.22} />
      <rect x={5.2} y={-3.65} width={1.5} height={0.85} rx={0.3} fill={colour} stroke={DARK} strokeWidth={0.22} />

      {/* the airbox behind the driver, and the cockpit: the opening, the headrest, the helmet with its stripe and visor, the halo */}
      <ellipse cx={-1.7} cy={0} rx={1.2} ry={0.95} fill={DARK} />
      <path d="M-2.7 -0.55Q-1.7 -1.1-0.7-0.55" fill="none" stroke={light} strokeOpacity={0.35} strokeWidth={0.2} />
      <ellipse cx={3} cy={0} rx={2.35} ry={1.3} fill={DARK} />
      <ellipse cx={0.95} cy={0} rx={0.6} ry={1.05} fill="#2a2f37" />
      <circle cx={2.7} cy={0} r={1.05} fill="#eceef2" />
      <path d="M1.7 0H3.7" stroke={colour} strokeWidth={0.42} />
      <path d="M3.5-0.68Q4 0 3.5 0.68" fill="none" stroke="#14171c" strokeWidth={0.6} strokeLinecap="round" />
      <path d="M5.7 0H4.1M4.1 0C3.9 1.8 2.1 2.3 1 1.9M4.1 0C3.9-1.8 2.1-2.3 1-1.9" fill="none" stroke="#262b32" strokeWidth={0.9} strokeLinecap="round" strokeLinejoin="round" />
      <path d="M5.7 0H4.1M4.1 0C3.9 1.8 2.1 2.3 1 1.9M4.1 0C3.9-1.8 2.1-2.3 1-1.9" fill="none" stroke="#7b8491" strokeWidth={0.34} strokeLinecap="round" strokeLinejoin="round" />

      {number !== null && (
        <text x={-7} y={1.5} textAnchor="middle" fontSize={4.2} fontWeight={800} fill={ink} style={{ fontFamily: "var(--font-display)" }}>
          {number}
        </text>
      )}
    </g>
  );
}
