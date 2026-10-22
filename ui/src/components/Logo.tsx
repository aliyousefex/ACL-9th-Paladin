import type { CSSProperties } from "react";
import { LOCKUP, WORDMARK } from "./logo-data";

/** The rearing horse from the Paladin F1 logo. "solid" is a filled silhouette that holds up at nav size; "line" is the full engraving. */
export function LogoMark({
  height = 40,
  variant = "solid",
  className = "",
}: {
  height?: number;
  variant?: "solid" | "line";
  className?: string;
}) {
  return (
    <img
      src={`/brand/horse-${variant}.webp`}
      alt=""
      width={Math.round(height * LOCKUP.horse.ratio)}
      height={height}
      decoding="async"
      className={`block shrink-0 ${className}`}
      aria-hidden
    />
  );
}

/** "PALADIN F1" in the logo's own lettering, outlined so it needs no font. Size it with a height class; colour comes from currentColor. */
export function Wordmark({ className = "", style }: { className?: string; style?: CSSProperties }) {
  return (
    <svg
      viewBox={WORDMARK.viewBox}
      className={`block shrink-0 ${className}`}
      style={{ aspectRatio: WORDMARK.aspect, ...style }}
      fill="currentColor"
      aria-hidden
      focusable="false"
    >
      {WORDMARK.glyphs.map((glyph, index) => (
        <path key={index} transform={`translate(${glyph.x} 0)`} d={glyph.d} />
      ))}
    </svg>
  );
}

/** The full logo as supplied: engraved horse with the wordmark at its foot. Sized by height in px. */
export function LogoLockup({ height = 150, className = "" }: { height?: number; className?: string }) {
  const { aspect, horse, wordmark } = LOCKUP;
  return (
    <div role="img" aria-label="Paladin F1" className={`relative shrink-0 ${className}`} style={{ height, width: Math.round(height * aspect) }}>
      <img
        src="/brand/horse-line.webp"
        alt=""
        loading="lazy"
        decoding="async"
        aria-hidden
        className="absolute top-0 block h-full"
        style={{ left: `${horse.left}%`, width: `${horse.width}%` }}
      />
      <Wordmark
        className="absolute left-0 text-ink"
        style={{ top: `${wordmark.top}%`, height: `${wordmark.height}%`, width: `${wordmark.width}%` }}
      />
    </div>
  );
}
