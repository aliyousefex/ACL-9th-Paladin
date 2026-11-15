import type { CSSProperties } from "react";
import { MARK, WORDMARK } from "./logo-data";

/**
 * The Paladin mark, drawn inline so it takes the colour of the theme (`--color-brand`: the logo's own blue on the light
 * page, a lighter tint of it on the dark one, where the original blue would be 1.5:1).
 *
 * The artwork is fine line work: its lines are about three quarters of a percent of its width, and at the size of a nav bar
 * that is a fraction of a pixel and the mark all but disappears. `weight` thickens every line by that many units of the
 * mark's own 600-unit width (so it scales with the mark): 12 is right from about 28px to 48px tall, and a large rendering
 * can pass 0 for the artwork as drawn.
 */
export function LogoMark({ height = 34, weight = 12, className = "" }: { height?: number; weight?: number; className?: string }) {
  return (
    <svg
      viewBox={MARK.viewBox}
      width={Math.round(height * MARK.aspect)}
      height={height}
      className={`logo-mark block shrink-0 ${className}`}
      fill="currentColor"
      stroke="currentColor"
      strokeWidth={weight}
      strokeLinejoin="round"
      aria-hidden
      focusable="false"
    >
      <path d={MARK.d} />
    </svg>
  );
}

/** "PALADIN F1" in the original lettering, outlined so it needs no font. Size it with a height class; colour comes from currentColor. */
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
