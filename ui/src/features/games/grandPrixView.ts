/** Pure helpers for the Grand Prix screens: time text and which rows of the timing tower to show. */

/** 65.342 -> "1:05.342"; under a minute -> "42.100". */
export function raceTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return "–";
  const m = Math.floor(seconds / 60);
  const s = seconds - m * 60;
  return m > 0 ? `${m}:${s.toFixed(3).padStart(6, "0")}` : s.toFixed(3);
}

/** A gap to the car ahead or the winner: "+1.234", or "+1:05.2" past a minute. */
export function gapText(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return "–";
  if (seconds < 60) return `+${seconds.toFixed(seconds < 10 ? 3 : 1)}`;
  const m = Math.floor(seconds / 60);
  return `+${m}:${(seconds - m * 60).toFixed(1).padStart(4, "0")}`;
}

/** A gap with no sign, for a readout whose label says who it is to: "0.866 s", or "1:05.2" past a minute. */
export function gapPlain(seconds: number): string {
  const text = gapText(seconds);
  if (text === "–") return text;
  return text.startsWith("+") && !text.includes(":") ? `${text.slice(1)} s` : text.slice(1);
}

export type TowerRow = { kind: "row"; position: number } | { kind: "gap" };

/**
 * The rows of a timing tower to show for a field of `size` when the player runs `position`: the leader, then a window
 * around the player, with a gap marker wherever positions are skipped. Always `max` rows or fewer.
 */
export function towerWindow(size: number, position: number, max = 9): TowerRow[] {
  if (size <= max) return Array.from({ length: size }, (_, i) => ({ kind: "row", position: i + 1 }));
  const around = max - 2;
  let from = Math.max(2, position - Math.floor(around / 2));
  let to = from + around - 1;
  if (to > size) {
    to = size;
    from = Math.max(2, to - around + 1);
  }
  const positions = [1, ...Array.from({ length: to - from + 1 }, (_, i) => from + i)];
  const rows: TowerRow[] = [];
  positions.forEach((p, i) => {
    if (i > 0 && p !== positions[i - 1] + 1) rows.push({ kind: "gap" });
    rows.push({ kind: "row", position: p });
  });
  return rows;
}

/** "Lap 2 of 3". The first lap is shown from the grid, and the number never passes the race distance. */
export function lapText(lap: number, laps: number): string {
  return `Lap ${Math.min(laps, Math.max(1, lap))} of ${laps}`;
}

/** "About 1 min" for a race of this many laps on a circuit whose lap takes `lapSeconds`. */
export function durationHint(laps: number, lapSeconds = 22): string {
  const seconds = laps * lapSeconds;
  return seconds < 90 ? `about ${Math.round(seconds / 10) * 10} s` : `about ${Math.round(seconds / 30) / 2} min`;
}
