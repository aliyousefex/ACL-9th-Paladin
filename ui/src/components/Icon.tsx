import type { SVGProps } from "react";

const PATHS = {
  arrowRight: "M4 12h14M12 5l7 7-7 7",
  arrowLeft: "M20 12H6M12 5l-7 7 7 7",
  arrowDown: "M12 4v14M5 12l7 7 7-7",
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
} as const;

export type IconName = keyof typeof PATHS;

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
      <path d={PATHS[name]} />
    </svg>
  );
}
