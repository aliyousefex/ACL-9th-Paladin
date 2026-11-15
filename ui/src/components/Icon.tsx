import type { SVGProps } from "react";

const PATHS = {
  arrowRight: "M4 12h14M12 5l7 7-7 7",
  sun: "M12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM12 2v2.5M12 19.5V22M2 12h2.5M19.5 12H22M4.9 4.9l1.8 1.8M17.3 17.3l1.8 1.8M4.9 19.1l1.8-1.8M17.3 6.7l1.8-1.8",
  moon: "M20 14.5A8.5 8.5 0 0 1 9.5 4 8.5 8.5 0 1 0 20 14.5z",
  auto: "M3 5h18v11H3zM8 20h8M12 16v4",
  graph: "M6 20a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM18 8a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM18 20a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM7.7 16.6l8.6-6.2M8 18h8",
  more: "M5 12h.01M12 12h.01M19 12h.01",
  arrowLeft: "M20 12H6M12 5l-7 7 7 7",
  arrowDown: "M12 4v14M5 12l7 7 7-7",
  arrowUp: "M12 20V6M5 12l7-7 7 7",
  chevronDown: "M6 9l6 6 6-6",
  chevronRight: "M9 6l6 6-6 6",
  play: "M7 4.5v15l12-7.5z",
  pause: "M7 4h4v16H7zM13 4h4v16h-4z",
  replay: "M4 12a8 8 0 1 0 3-6.2M4 4v5h5",
  check: "M4 12.5l5 5 11-11",
  cross: "M5 5l14 14M19 5L5 19",
  info: "M12 11v6M12 7.5v.01M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z",
  search: "M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14zM20 20l-4-4",
  compare: "M8 4v16M16 4v16M4 8h8M12 16h8",
  external: "M14 4h6v6M20 4l-9 9M18 14v5H5V6h5",
  trophy: "M7 4h10v5a5 5 0 0 1-10 0zM7 6H4v2a3 3 0 0 0 3 3M17 6h3v2a3 3 0 0 1-3 3M12 14v4M8 20h8",
  flag: "M5 21V4M5 5h13l-2 4 2 4H5",
  grid: "M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z",
  track: "M5 15c-2-3 0-8 5-8 4 0 4 3 7 3 3 0 4 3 2 6-2 3-6 3-9 2-3-1-4 0-5-3z",
  user: "M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 20c1-4 4-6 8-6s7 2 8 6",
  chart: "M4 20V10M10 20V4M16 20v-7M22 20H2",
  book: "M5 4h10a3 3 0 0 1 3 3v13H8a3 3 0 0 1-3-3zM5 17a3 3 0 0 1 3-3h10",
  home: "M4 11l8-7 8 7v9h-5v-6H9v6H4z",
  sliders: "M4 7h10M18 7h2M4 17h2M10 17h10M14 4v6M6 14v6",
  menu: "M4 7h16M4 12h16M4 17h16",
  skip: "M6 5v14M10 5l9 7-9 7z",
  plus: "M12 5v14M5 12h14",
  minus: "M5 12h14",
  lock: "M7.5 11V8a4.5 4.5 0 0 1 9 0v3M6 11h12a1 1 0 0 1 1 1v7.5a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V12a1 1 0 0 1 1-1zM12 15v2",
  calendar: "M5 4.5h14A1.5 1.5 0 0 1 20.5 6v13a1.5 1.5 0 0 1-1.5 1.5H5A1.5 1.5 0 0 1 3.5 19V6A1.5 1.5 0 0 1 5 4.5zM3.5 9.5h17M8 2.5v4M16 2.5v4M8 13.5h.01M12 13.5h.01M16 13.5h.01M8 17h.01M12 17h.01",
  flagGrid: "M5 21V3.5M5 4.5h14.5v10H5M9.83 4.5v10M14.67 4.5v10M5 9.5h14.5",
  target: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 16.5a4.5 4.5 0 1 0 0-9 4.5 4.5 0 0 0 0 9z",
  flask: "M9.5 3h5M10.5 3v5.6L5.2 18.2A2 2 0 0 0 7 21h10a2 2 0 0 0 1.8-2.8L13.5 8.6V3M7.8 15.2h8.4",
  bookOpen: "M12 7c-1.8-1.6-4.4-2.3-8-2.3v13c3.6 0 6.2.7 8 2.3 1.8-1.6 4.4-2.3 8-2.3v-13C16.4 4.7 13.8 5.4 12 7zM12 7v13.3",
  database: "M4 6c0 1.66 3.58 3 8 3s8-1.34 8-3-3.58-3-8-3-8 1.34-8 3zM4 6v12c0 1.66 3.58 3 8 3s8-1.34 8-3V6M4 12c0 1.66 3.58 3 8 3s8-1.34 8-3",
  legend: "M10 6.5h10.5M10 12h10.5M10 17.5h10.5M5.5 8.1a1.6 1.6 0 1 0 0-3.2 1.6 1.6 0 0 0 0 3.2zM3.9 10.4h3.2v3.2H3.9zM5.5 15.5l2 2-2 2-2-2z",
  network: "M12 8a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5zM5.5 21a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5zM18.5 21a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5zM10.9 7.7 6.6 16.3M13.1 7.7l4.3 8.6M8 18.5h8",
  cup: "M8 4h8v5.5a4 4 0 0 1-8 0zM8 6H5.2c-.4 0-.7.3-.7.7 0 2.4 1.6 4 3.5 4.3M16 6h2.8c.4 0 .7.3.7.7 0 2.4-1.6 4-3.5 4.3M12 13.5V17M9 20.5h6M10 17h4",
  helmet: "M4 16C4 9.5 8 5 13 5c4 0 7 3 7 7.5V16a2 2 0 0 1-2 2H7a3 3 0 0 1-3-2zM20 10.5H13.5a1.5 1.5 0 0 0-1.5 1.5v1a1.5 1.5 0 0 0 1.5 1.5H20",
  circuit: "M3.5 17.5V11q0-2.5 2.5-2.5h3L11 5.5h8q2 0 2 2V10q0 2-2 2h-4l-1.5 3q-.5 1 .5 2l1 1q.5 1.5-1 1.5H5.5q-2 0-2-2z",
} as const;

export type IconName = keyof typeof PATHS;

/**
 * A few icons carry a soft fill behind their line (a calendar's header band, a helmet's visor, a circuit's track), which makes
 * the set read as drawn rather than stock. `TONE` is that fill at low opacity; `SOLID` is a small accent at full strength.
 */
const TONE: Partial<Record<IconName, string>> = {
  calendar: "M3.5 6A1.5 1.5 0 0 1 5 4.5h14A1.5 1.5 0 0 1 20.5 6v3.5h-17z",
  flagGrid: "M5 4.5h4.83v5H5zM14.67 4.5h4.83v5h-4.83zM9.83 9.5h4.84v5H9.83z",
  target: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 16.5a4.5 4.5 0 1 0 0-9 4.5 4.5 0 0 0 0 9z",
  flask: "M6.86 15.2h10.28l1.66 3A2 2 0 0 1 17 21H7a2 2 0 0 1-1.8-2.8z",
  bookOpen: "M12 7c-1.8-1.6-4.4-2.3-8-2.3v13c3.6 0 6.2.7 8 2.3z",
  database: "M4 6c0 1.66 3.58 3 8 3s8-1.34 8-3-3.58-3-8-3-8 1.34-8 3z",
  legend: "M5.5 8.1a1.6 1.6 0 1 0 0-3.2 1.6 1.6 0 0 0 0 3.2zM3.9 10.4h3.2v3.2H3.9zM5.5 15.5l2 2-2 2-2-2z",
  network: "M12 8a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5zM5.5 21a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5zM18.5 21a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z",
  cup: "M8 4h8v5.5a4 4 0 0 1-8 0z",
  helmet: "M20 10.5H13.5a1.5 1.5 0 0 0-1.5 1.5v1a1.5 1.5 0 0 0 1.5 1.5H20z",
  circuit: "M3.5 17.5V11q0-2.5 2.5-2.5h3L11 5.5h8q2 0 2 2V10q0 2-2 2h-4l-1.5 3q-.5 1 .5 2l1 1q.5 1.5-1 1.5H5.5q-2 0-2-2z",
};

const SOLID: Partial<Record<IconName, string>> = {
  target: "M12 13.6a1.6 1.6 0 1 0 0-3.2 1.6 1.6 0 0 0 0 3.2z",
  circuit: "M16.5 10.1a1.3 1.3 0 1 0 0-2.6 1.3 1.3 0 0 0 0 2.6z",
};

export function Icon({
  name,
  size = 20,
  strokeWidth = 1.8,
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
      {TONE[name] && <path d={TONE[name]} fill="currentColor" fillOpacity={0.2} fillRule="evenodd" stroke="none" />}
      <path d={PATHS[name]} />
      {SOLID[name] && <path d={SOLID[name]} fill="currentColor" stroke="none" />}
    </svg>
  );
}
