import type { TeammateLine } from "../../lib/graph";

/**
 * A driver and the teammates they shared the most races with, drawn as a ring. Line weight is shared races. The same
 * information is in the list beside it as full-size links, so nothing depends on seeing the picture, and the nodes here are
 * a mouse shortcut: hidden from assistive technology and the tab order rather than offered twice.
 */
export function EgoGraph({ centre, mates, hrefFor }: { centre: string; mates: TeammateLine[]; hrefFor: (id: number) => string }) {
  const width = 860;
  const height = 460;
  const cx = width / 2;
  const cy = height / 2;
  const rx = 255;
  const ry = 150;
  const most = Math.max(1, ...mates.map((mate) => mate.sharedRaces));
  return (
    <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`${centre} and ${mates.length} of their teammates. Line weight shows races shared; the list beside the picture has the same numbers.`} className="h-auto w-full">
      {mates.map((mate, i) => {
        const angle = (i / mates.length) * Math.PI * 2 - Math.PI / 2;
        const x = cx + rx * Math.cos(angle);
        const y = cy + ry * Math.sin(angle);
        return <line key={`edge-${mate.id}`} x1={cx} y1={cy} x2={x} y2={y} stroke="var(--color-line2)" strokeWidth={1 + 4.5 * (mate.sharedRaces / most)} strokeLinecap="round" />;
      })}
      {mates.map((mate, i) => {
        const angle = (i / mates.length) * Math.PI * 2 - Math.PI / 2;
        const cos = Math.cos(angle);
        const x = cx + rx * cos;
        const y = cy + ry * Math.sin(angle);
        const anchor = cos > 0.25 ? "start" : cos < -0.25 ? "end" : "middle";
        const lx = x + (anchor === "start" ? 12 : anchor === "end" ? -12 : 0);
        const ly = y + (anchor === "middle" ? (Math.sin(angle) > 0 ? 24 : -14) : 5);
        return (
          <a key={mate.id} href={hrefFor(mate.id)} aria-hidden tabIndex={-1} className="graph-node">
            <circle cx={x} cy={y} r={5.5} fill="var(--color-steel)" />
            <circle cx={x} cy={y} r={16} fill="transparent" />
            <text x={lx} y={ly} textAnchor={anchor} fontSize={17} fill="var(--color-steel)" style={{ fontFamily: "var(--font-sans)" }}>
              {mate.name}
            </text>
          </a>
        );
      })}
      <circle cx={cx} cy={cy} r={9} fill="var(--color-ink)" />
      <text x={cx} y={cy + 32} textAnchor="middle" fontSize={19} fontWeight={600} fill="var(--color-ink)" style={{ fontFamily: "var(--font-display)", textTransform: "uppercase", letterSpacing: "0.04em" }}>
        {centre}
      </text>
    </svg>
  );
}
