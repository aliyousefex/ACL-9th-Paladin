/**
 * A small original mark for a race event, drawn on a 24-unit grid: the start lights on their gantry, a wheel for a pit stop, an arrow
 * going past another for an overtake, two crossing arrows for a change of lead, a yellow flag for an incident, a cross in a ring
 * for a retirement, a fork for a strategy call, the chequered flag for the finish, and a clock for a field that slowed. The word it
 * stands for is always written beside it: the mark helps you find the line, it never carries the meaning alone.
 *
 * Only the two flags have colours of their own (a marshal's yellow, the black and white of the chequered flag); the rest take the
 * colour of the text they sit in, so they follow the theme. Which recorded events may be a flag is decided in lib/eventMarks.ts.
 */

const YELLOW = "#ffd23f";
const LAMP = "#e10600";
const stroke = { fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round", strokeLinejoin: "round" } as const;

function glyph(kind: string) {
  switch (kind) {
    case "start":
      return (
        <>
          <rect x={2.5} y={5.5} width={19} height={8} rx={1.6} {...stroke} />
          {[6, 9, 12, 15, 18].map((x) => (
            <circle key={x} cx={x} cy={9.5} r={1.15} fill={LAMP} />
          ))}
          <path d="M6 13.5V20M18 13.5V20" {...stroke} />
        </>
      );
    case "pit":
      return (
        <>
          <circle cx={12} cy={12} r={8.5} {...stroke} />
          <circle cx={12} cy={12} r={2.8} {...stroke} />
          <path d="M12 3.5V9.2M12 14.8V20.5M3.5 12H9.2M14.8 12H20.5" {...stroke} />
        </>
      );
    case "pass":
      return <path d="M3 17.5H11M5 10.5H19M15 6.5L19 10.5L15 14.5" {...stroke} />;
    case "lead-change":
      return <path d="M4 8.5H17.5M13.5 4.5L17.5 8.5L13.5 12.5M20 16H6.5M10.5 12L6.5 16L10.5 20" {...stroke} />;
    case "incident":
      return (
        <>
          <path d="M6 3V21" {...stroke} />
          <path d="M6 4C9 2.4 11.5 5.4 14.5 4.2C16 3.6 17.5 3.6 19.5 4.2V12.4C17.5 11.8 16 11.8 14.5 12.4C11.5 13.6 9 10.6 6 12.2Z" fill={YELLOW} stroke="currentColor" strokeWidth={1.1} strokeLinejoin="round" />
        </>
      );
    case "retirement":
      return (
        <>
          <circle cx={12} cy={12} r={8.5} {...stroke} />
          <path d="M8.8 8.8L15.2 15.2M15.2 8.8L8.8 15.2" {...stroke} />
        </>
      );
    case "strategy":
      return <path d="M3 12H8.5M8.5 12C12 12 12 6 16 6H20M8.5 12C12 12 12 18 16 18H20M17.5 3.5L20 6L17.5 8.5M17.5 15.5L20 18L17.5 20.5" {...stroke} />;
    case "finish":
      return (
        <>
          <path d="M5 3V21" {...stroke} />
          {Array.from({ length: 12 }, (_, i) => {
            const col = i % 4;
            const row = Math.floor(i / 4);
            return <rect key={i} x={6.4 + col * 3.6} y={4 + row * 2.8} width={3.6} height={2.8} fill={(col + row) % 2 === 0 ? "#0b0e12" : "#f4f4f2"} />;
          })}
          <rect x={6.4} y={4} width={14.4} height={8.4} fill="none" stroke="currentColor" strokeWidth={1.1} />
        </>
      );
    case "slow-field":
      return (
        <>
          <circle cx={12} cy={12} r={8.5} {...stroke} />
          <path d="M12 7.5V12L15 14" {...stroke} />
        </>
      );
    default:
      return null;
  }
}

export function EventMark({ kind, size = 18, className = "" }: { kind: string; size?: number; className?: string }) {
  const drawing = glyph(kind);
  if (!drawing) return null;
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} className={`shrink-0 ${className}`} aria-hidden focusable="false" data-event-mark={kind}>
      {drawing}
    </svg>
  );
}
