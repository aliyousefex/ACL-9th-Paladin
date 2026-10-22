import { useEffect, useRef, useState } from "react";
import {
  constructor as teamOf,
  driver as driverOf,
  onColour,
  teamColour,
  type Constructor,
  type Driver,
  type Entry,
  type RaceDetail,
} from "../../lib/data";
import { usePrefersReducedMotion } from "../../lib/motion";
import model from "../../data/model.json";

/** One driver in one race, with everything a panel needs. */
export interface Row {
  entry: Entry;
  driver: Driver;
  team: Constructor;
  colour: string;
  ink: string;
  /** Podium score from the selected model. */
  score: number;
  /** 1 = highest podium score in the field. */
  rank: number;
  /** Starting grid slot (null for a pit-lane start). */
  grid: number | null;
  /** Classified finishing order (positionOrder). */
  finish: number | null;
  /** Finished on the podium. */
  podium: boolean;
}

export function buildRows(detail: RaceDetail, year: number): Row[] {
  const rows = detail.entries
    .map((entry) => {
      const colour = teamColour(entry.c, year);
      return {
        entry,
        driver: driverOf(entry.d),
        team: teamOf(entry.c),
        colour,
        ink: onColour(colour),
        score: entry.p,
        rank: 0,
        grid: entry.x[0] === null || entry.x[0] === undefined ? null : entry.x[0],
        finish: entry.pos,
        podium: entry.pos !== null && entry.pos <= 3,
      } satisfies Row;
    })
    .sort((a, b) => b.score - a.score || a.driver.id - b.driver.id);
  rows.forEach((row, i) => (row.rank = i + 1));
  return rows;
}

/** Share of unseen-season drivers who reached the podium in the same score band (test seasons, 2022-24). */
export function bandRate(score: number): { lo: number; hi: number; n: number; podiums: number; rate: number } {
  const bins = model.reliability.test;
  const bin = bins.find((b) => score >= b.lo && (score < b.hi || b.hi === 1)) ?? bins[bins.length - 1];
  return { lo: bin.lo, hi: bin.hi, n: bin.n, podiums: bin.podiums, rate: bin.n ? bin.podiums / bin.n : 0 };
}

/** Animate a number from zero to its target; honours reduced motion. */
export function useCountUp(target: number, run: boolean, duration = 900): number {
  const reduce = usePrefersReducedMotion();
  const [value, setValue] = useState(run ? 0 : target);
  const frame = useRef(0);

  useEffect(() => {
    if (!run || reduce) {
      setValue(target);
      return;
    }
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      setValue(target * eased);
      if (t < 1) frame.current = requestAnimationFrame(tick);
    };
    setValue(0);
    frame.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame.current);
  }, [target, run, duration, reduce]);

  return value;
}

export const PLACE_COLOURS = ["var(--color-gold)", "var(--color-silver)", "var(--color-bronze)"] as const;

/** "Finished 5th", "Retired", "Disqualified": how the race ended for a driver. */
export function finishLabel(row: Row): string {
  const text = row.entry.txt;
  if (/^\d+$/.test(text)) return `Finished ${ordinalOf(Number(text))}`;
  if (text === "R") return "Retired";
  if (text === "D") return "Disqualified";
  if (text === "W") return "Withdrew";
  return row.entry.status || "Did not finish";
}

export function classifiedLabel(row: Row): string {
  const text = row.entry.txt;
  return /^\d+$/.test(text) ? `P${text}` : text === "R" ? "Ret" : text === "D" ? "DSQ" : text === "W" ? "WD" : text;
}

function ordinalOf(value: number): string {
  const rest = value % 100;
  if (rest >= 11 && rest <= 13) return `${value}th`;
  return `${value}${["th", "st", "nd", "rd"][value % 10 > 3 ? 0 : value % 10]}`;
}
