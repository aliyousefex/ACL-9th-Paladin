import type { SVGProps } from "react";

/**
 * The icon set: outline icons from Tabler Icons (https://tabler.io/icons, MIT licence, (c) Paweł Kuna; the licence text is in ICONS-LICENSE.txt beside this file), drawn on one 24px grid
 * with one stroke weight, round caps and joins, so every icon has the same weight, corner radius and optical size. They are
 * copied in as path data (nothing is loaded at runtime). Our names are kept, so a few share a drawing (the trophy and the cup,
 * the flag and the grid flag, the network and the graph): the name says what it is for, the drawing is the best one the set has.
 * To change one, pick another Tabler icon of the same name's meaning; do not draw by hand, or the set stops being consistent.
 */
const PATHS = {
  arrowRight: "M5 12l14 0M13 18l6 -6M13 6l6 6",
  arrowLeft: "M5 12l14 0M5 12l6 6M5 12l6 -6",
  arrowDown: "M12 5l0 14M18 13l-6 6M6 13l6 6",
  arrowUp: "M12 5l0 14M18 11l-6 -6M6 11l6 -6",
  chevronDown: "M6 9l6 6l6 -6",
  chevronRight: "M9 6l6 6l-6 6",
  check: "M5 12l5 5l10 -10",
  cross: "M18 6l-12 12M6 6l12 12",
  plus: "M12 5l0 14M5 12l14 0",
  minus: "M5 12l14 0",
  search: "M3 10a7 7 0 1 0 14 0a7 7 0 1 0 -14 0M21 21l-6 -6",
  info: "M3 12a9 9 0 1 0 18 0a9 9 0 0 0 -18 0M12 9h.01M11 12h1v4h1",
  lock: "M5 13a2 2 0 0 1 2 -2h10a2 2 0 0 1 2 2v6a2 2 0 0 1 -2 2h-10a2 2 0 0 1 -2 -2v-6M11 16a1 1 0 1 0 2 0a1 1 0 0 0 -2 0M8 11v-4a4 4 0 1 1 8 0v4",
  external: "M12 6h-6a2 2 0 0 0 -2 2v10a2 2 0 0 0 2 2h10a2 2 0 0 0 2 -2v-6M11 13l9 -9M15 4h5v5",
  compare: "M11 16h10M11 16l4 4M11 16l4 -4M13 8h-10M13 8l-4 4M13 8l-4 -4",
  sliders: "M12 6a2 2 0 1 0 4 0a2 2 0 1 0 -4 0M4 6l8 0M16 6l4 0M6 12a2 2 0 1 0 4 0a2 2 0 1 0 -4 0M4 12l2 0M10 12l10 0M15 18a2 2 0 1 0 4 0a2 2 0 1 0 -4 0M4 18l11 0M19 18l1 0",
  more: "M4 12a1 1 0 1 0 2 0a1 1 0 1 0 -2 0M11 12a1 1 0 1 0 2 0a1 1 0 1 0 -2 0M18 12a1 1 0 1 0 2 0a1 1 0 1 0 -2 0",
  menu: "M4 6l16 0M4 12l16 0M4 18l16 0",
  play: "M7 4v16l13 -8l-13 -8",
  pause: "M6 6a1 1 0 0 1 1 -1h2a1 1 0 0 1 1 1v12a1 1 0 0 1 -1 1h-2a1 1 0 0 1 -1 -1l0 -12M14 6a1 1 0 0 1 1 -1h2a1 1 0 0 1 1 1v12a1 1 0 0 1 -1 1h-2a1 1 0 0 1 -1 -1l0 -12",
  skip: "M4 5v14l12 -7l-12 -7M20 5l0 14",
  replay: "M19.95 11a8 8 0 1 0 -.5 4m.5 5v-5h-5",
  sun: "M8 12a4 4 0 1 0 8 0a4 4 0 1 0 -8 0M3 12h1m8 -9v1m8 8h1m-9 8v1m-6.4 -15.4l.7 .7m12.1 -.7l-.7 .7m0 11.4l.7 .7m-12.1 -.7l-.7 .7",
  moon: "M12 3c.132 0 .263 0 .393 0a7.5 7.5 0 0 0 7.92 12.446a9 9 0 1 1 -8.313 -12.454l0 .008",
  auto: "M3 5a1 1 0 0 1 1 -1h16a1 1 0 0 1 1 1v10a1 1 0 0 1 -1 1h-16a1 1 0 0 1 -1 -1v-10M7 20h10M9 16v4M15 16v4",
  calendar: "M4 7a2 2 0 0 1 2 -2h12a2 2 0 0 1 2 2v12a2 2 0 0 1 -2 2h-12a2 2 0 0 1 -2 -2l0 -12M16 3l0 4M8 3l0 4M4 11l16 0M8 15h2v2h-2l0 -2",
  flag: "M5 5a5 5 0 0 1 7 0a5 5 0 0 0 7 0v9a5 5 0 0 1 -7 0a5 5 0 0 0 -7 0v-9M5 21v-7",
  flagGrid: "M5 5a5 5 0 0 1 7 0a5 5 0 0 0 7 0v9a5 5 0 0 1 -7 0a5 5 0 0 0 -7 0v-9M5 21v-7",
  target: "M11 12a1 1 0 1 0 2 0a1 1 0 1 0 -2 0M7 12a5 5 0 1 0 10 0a5 5 0 1 0 -10 0M3 12a9 9 0 1 0 18 0a9 9 0 1 0 -18 0",
  flask: "M9 3l6 0M10 9l4 0M10 3v6l-4 11a.7 .7 0 0 0 .5 1h11a.7 .7 0 0 0 .5 -1l-4 -11v-6",
  book: "M3 19a9 9 0 0 1 9 0a9 9 0 0 1 9 0M3 6a9 9 0 0 1 9 0a9 9 0 0 1 9 0M3 6l0 13M12 6l0 13M21 6l0 13",
  bookOpen: "M3 19a9 9 0 0 1 9 0a9 9 0 0 1 9 0M3 6a9 9 0 0 1 9 0a9 9 0 0 1 9 0M3 6l0 13M12 6l0 13M21 6l0 13",
  database: "M4 6a8 3 0 1 0 16 0a8 3 0 1 0 -16 0M4 6v6a8 3 0 0 0 16 0v-6M4 12v6a8 3 0 0 0 16 0v-6",
  legend: "M3 12a9 9 0 1 0 18 0a9 9 0 0 0 -18 0M12 9h.01M11 12h1v4h1",
  network: "M5.931 6.936l1.275 4.249m5.607 5.609l4.251 1.275M11.683 12.317l5.759 -5.759M4 5.5a1.5 1.5 0 1 0 3 0a1.5 1.5 0 1 0 -3 0M17 5.5a1.5 1.5 0 1 0 3 0a1.5 1.5 0 1 0 -3 0M17 18.5a1.5 1.5 0 1 0 3 0a1.5 1.5 0 1 0 -3 0M4 15.5a4.5 4.5 0 1 0 9 0a4.5 4.5 0 1 0 -9 0",
  graph: "M5.931 6.936l1.275 4.249m5.607 5.609l4.251 1.275M11.683 12.317l5.759 -5.759M4 5.5a1.5 1.5 0 1 0 3 0a1.5 1.5 0 1 0 -3 0M17 5.5a1.5 1.5 0 1 0 3 0a1.5 1.5 0 1 0 -3 0M17 18.5a1.5 1.5 0 1 0 3 0a1.5 1.5 0 1 0 -3 0M4 15.5a4.5 4.5 0 1 0 9 0a4.5 4.5 0 1 0 -9 0",
  trophy: "M8 21l8 0M12 17l0 4M7 4l10 0M17 4v8a5 5 0 0 1 -10 0v-8M3 9a2 2 0 1 0 4 0a2 2 0 1 0 -4 0M17 9a2 2 0 1 0 4 0a2 2 0 1 0 -4 0",
  cup: "M8 21l8 0M12 17l0 4M7 4l10 0M17 4v8a5 5 0 0 1 -10 0v-8M3 9a2 2 0 1 0 4 0a2 2 0 1 0 -4 0M17 9a2 2 0 1 0 4 0a2 2 0 1 0 -4 0",
  helmet: "M12 4a9 9 0 0 1 5.656 16h-11.312a9 9 0 0 1 5.656 -16M20 9h-8.8a1 1 0 0 0 -.968 1.246c.507 2 1.596 3.418 3.268 4.254c2 1 4.333 1.5 7 1.5",
  circuit: "M3 19a2 2 0 1 0 4 0a2 2 0 0 0 -4 0M19 7a2 2 0 1 0 0 -4a2 2 0 0 0 0 4M11 19h5.5a3.5 3.5 0 0 0 0 -7h-8a3.5 3.5 0 0 1 0 -7h4.5",
  track: "M3 19a2 2 0 1 0 4 0a2 2 0 0 0 -4 0M19 7a2 2 0 1 0 0 -4a2 2 0 0 0 0 4M11 19h5.5a3.5 3.5 0 0 0 0 -7h-8a3.5 3.5 0 0 1 0 -7h4.5",
  user: "M8 7a4 4 0 1 0 8 0a4 4 0 0 0 -8 0M6 21v-2a4 4 0 0 1 4 -4h4a4 4 0 0 1 4 4v2",
  chart: "M3 13a1 1 0 0 1 1 -1h4a1 1 0 0 1 1 1v6a1 1 0 0 1 -1 1h-4a1 1 0 0 1 -1 -1l0 -6M15 9a1 1 0 0 1 1 -1h4a1 1 0 0 1 1 1v10a1 1 0 0 1 -1 1h-4a1 1 0 0 1 -1 -1l0 -10M9 5a1 1 0 0 1 1 -1h4a1 1 0 0 1 1 1v14a1 1 0 0 1 -1 1h-4a1 1 0 0 1 -1 -1l0 -14M4 20h14",
  home: "M5 12l-2 0l9 -9l9 9l-2 0M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2 -2v-7M9 21v-6a2 2 0 0 1 2 -2h2a2 2 0 0 1 2 2v6",
  grid: "M4 5a1 1 0 0 1 1 -1h4a1 1 0 0 1 1 1v4a1 1 0 0 1 -1 1h-4a1 1 0 0 1 -1 -1l0 -4M14 5a1 1 0 0 1 1 -1h4a1 1 0 0 1 1 1v4a1 1 0 0 1 -1 1h-4a1 1 0 0 1 -1 -1l0 -4M4 15a1 1 0 0 1 1 -1h4a1 1 0 0 1 1 1v4a1 1 0 0 1 -1 1h-4a1 1 0 0 1 -1 -1l0 -4M14 15a1 1 0 0 1 1 -1h4a1 1 0 0 1 1 1v4a1 1 0 0 1 -1 1h-4a1 1 0 0 1 -1 -1l0 -4",
} as const;

export type IconName = keyof typeof PATHS;

export function Icon({
  name,
  size = 20,
  strokeWidth = 1.75,
  ...rest
}: { name: IconName; size?: number; strokeWidth?: number } & Omit<SVGProps<SVGSVGElement>, "name">) {
  const filled = name === "play" || name === "pause";
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={filled ? "currentColor" : "none"}
      stroke={filled ? "none" : "currentColor"}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      focusable="false"
      {...rest}
    >
      <path d={PATHS[name]} />
    </svg>
  );
}
