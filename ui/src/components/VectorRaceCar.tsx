/** A compact, original open-wheel car marker for circuit maps. */
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
  return (
    <g data-race-car transform={`rotate(${angle}) scale(${scale})`} aria-hidden>
      {selected && <ellipse cx={0} cy={0} rx={24} ry={15} fill="none" stroke="var(--color-signal)" strokeWidth={2.5} strokeDasharray="4 3" />}
      <rect x={-13} y={-9} width={7} height={5} rx={1} fill="#090a0c" />
      <rect x={-13} y={4} width={7} height={5} rx={1} fill="#090a0c" />
      <rect x={6} y={-9} width={7} height={5} rx={1} fill="#090a0c" />
      <rect x={6} y={4} width={7} height={5} rx={1} fill="#090a0c" />
      <path d="M-15-8h4v16h-4zM10-7h5v14h-5z" fill={colour} stroke="#090a0c" strokeWidth={1} />
      <path d="M-11-5L5-4l7 4-7 4-16 1-4-5z" fill={colour} stroke="#090a0c" strokeWidth={1.5} />
      <path d="M-4-3h7l4 3-4 3h-7z" fill="#11151b" />
      <path d="M-2-3v6M3-2l2 2-2 2" fill="none" stroke={colour} strokeWidth={1.3} />
      {number !== null && (
        <text x={-8} y={2.5} textAnchor="middle" fontSize={6.5} fontWeight={800} fill={ink} style={{ fontFamily: "var(--font-display)" }}>
          {number}
        </text>
      )}
    </g>
  );
}
