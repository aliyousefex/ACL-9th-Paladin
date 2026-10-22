import type { CSSProperties } from "react";
import { onColour, portraitFor, type Driver } from "../lib/data";

const FOCUS: Record<string, string> = {
  vettel: "50% 30%",
  max_verstappen: "50% 22%",
  hamilton: "50% 24%",
  alonso: "50% 16%",
};

/**
 * Driver portrait on a team-colour field. Photos are freely licensed Wikimedia Commons images
 * (credited on the Model page); a driver without one gets a number plate instead.
 */
export function Portrait({
  driver,
  colour,
  number,
  className = "",
  label,
  rounded = false,
  eager = false,
}: {
  driver: Driver;
  colour: string;
  number?: number | null;
  className?: string;
  label?: string;
  rounded?: boolean;
  eager?: boolean;
}) {
  const photo = portraitFor(driver.ref);
  const shown = number ?? driver.permanentNumber;
  const style: CSSProperties = {
    background: `linear-gradient(160deg, ${colour} 0%, ${colour}99 55%, #0a0b0e 130%)`,
  };
  return (
    <div
      className={`relative isolate overflow-hidden ${rounded ? "rounded-full" : ""} ${className}`}
      style={style}
      role={label ? "img" : undefined}
      aria-label={label}
    >
      {photo ? (
        <img
          src={`${import.meta.env.BASE_URL}portraits/${photo.file}`}
          alt=""
          width={photo.width}
          height={photo.height}
          loading={eager ? "eager" : "lazy"}
          decoding="async"
          className="absolute inset-0 h-full w-full object-cover mix-blend-normal"
          style={{ objectPosition: FOCUS[driver.ref] ?? "50% 20%" }}
        />
      ) : (
        <span
          className="absolute inset-0 grid place-items-center font-display text-[3.2em] font-bold"
          style={{ color: onColour(colour) }}
        >
          {shown ?? driver.code}
        </span>
      )}
      <span
        aria-hidden
        className="pointer-events-none absolute inset-x-0 bottom-0 h-1/3"
        style={{ background: `linear-gradient(to top, ${colour}cc, transparent)` }}
      />
    </div>
  );
}
