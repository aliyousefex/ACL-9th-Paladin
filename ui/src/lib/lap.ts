/**
 * Where a car is on a lap, worked out so that it can be moved very smoothly.
 *
 * `pointAt` (replay.ts) takes the heading of whichever short stretch of the outline the car is on, so the car's rotation snaps at
 * every sample, and it runs along straight chords between samples, not along the drawn curve. This does neither: the points
 * come from the drawn path itself, an equal distance apart, the heading is that of a chord a few points either side, so it turns
 * continuously, and the headings are unwrapped (never more than half a turn from the one before), so an animation that blends
 * from one frame to the next turns the short way round and a lap never spins the car the long way.
 */

type Pt = [number, number];

export interface LapPoint {
  x: number;
  y: number;
  /** Degrees. Unwrapped along the lap, so it keeps growing (or shrinking) through a full turn instead of jumping from 180 to -180. */
  angle: number;
}

/** The heading, in degrees, of the chord between the points `reach` steps each side of every point of a closed loop. */
export function smoothHeadings(points: Pt[], reach = 3): number[] {
  const n = points.length;
  return points.map((_, i) => {
    const before = points[(i - reach + n * 4) % n];
    const after = points[(i + reach) % n];
    return (Math.atan2(after[1] - before[1], after[0] - before[0]) * 180) / Math.PI;
  });
}

/** Angles in degrees made continuous: each is moved by whole turns until it is within half a turn of the one before. */
export function unwrap(angles: number[]): number[] {
  const out: number[] = [];
  for (const angle of angles) {
    let a = angle;
    if (out.length) {
      const previous = out[out.length - 1];
      while (a - previous > 180) a -= 360;
      while (a - previous < -180) a += 360;
    }
    out.push(a);
  }
  return out;
}

/**
 * The frames of a lap, from points an equal distance apart round a closed loop. There is one more frame than there are points:
 * the first is repeated at the end, and its angle is a whole turn on from the start (a clockwise lap turns the car through 360).
 */
export function lapFrames(points: Pt[], reach = 3): LapPoint[] {
  if (points.length < 3) return [];
  const headings = smoothHeadings(points, reach);
  const angles = unwrap([...headings, headings[0]]);
  const closed: Pt[] = [...points, points[0]];
  const frames = closed.map(([x, y], i): LapPoint => ({ x, y, angle: angles[i] }));
  // the loop is closed, so the last angle is the first plus whole turns; make it exactly that, whatever the rounding
  const turns = Math.round((frames[frames.length - 1].angle - frames[0].angle) / 360);
  frames[frames.length - 1].angle = frames[0].angle + turns * 360;
  return frames;
}

/** The length of a lap, in the units of its points. */
export function lapLength(frames: LapPoint[]): number {
  let length = 0;
  for (let i = 1; i < frames.length; i++) length += Math.hypot(frames[i].x - frames[i - 1].x, frames[i].y - frames[i - 1].y);
  return length;
}

/** The place and heading a fraction `s` of the way round the lap (any number: it wraps), by blending the two frames either side. */
export function frameAt(frames: LapPoint[], s: number): LapPoint {
  const n = frames.length - 1;
  if (n < 1) return { x: 0, y: 0, angle: 0 };
  const position = (((s % 1) + 1) % 1) * n;
  const i = Math.min(Math.floor(position), n - 1);
  const f = position - i;
  const a = frames[i];
  const b = frames[i + 1];
  return { x: a.x + (b.x - a.x) * f, y: a.y + (b.y - a.y) * f, angle: a.angle + (b.angle - a.angle) * f };
}

/**
 * A standing start: the car sets off from the fraction `from` of the lap and speeds up steadily over `distance` of a lap (the
 * distance covered grows as the square of the time, so the speed rises in a straight line from nothing). Played at an even pace
 * over the launch time, the frames come out right. `steps` frames, and the angles are unwrapped as they go, because a launch from
 * just before the start line crosses the seam of the lap.
 */
export function launchFrames(frames: LapPoint[], from: number, distance: number, steps = 40): LapPoint[] {
  const raw: LapPoint[] = [];
  for (let j = 0; j <= steps; j++) raw.push(frameAt(frames, from + distance * (j / steps) ** 2));
  const angles = unwrap(raw.map((p) => p.angle));
  return raw.map((p, j) => ({ ...p, angle: angles[j] }));
}

/**
 * Where to launch to, so the speed at the end of the launch is the cruising speed: with the cruise taking `cruiseMs` for a lap and the
 * launch `launchMs`, the launch covers launchMs / (2 * cruiseMs) of a lap (the average speed over a launch from rest is half its last speed).
 */
export function launchDistance(launchMs: number, cruiseMs: number): number {
  return launchMs / (2 * cruiseMs);
}

/** The points of a path an equal distance apart along it, found by asking the browser (so they lie on the drawn curve), or null where it cannot. */
export function sampleTrack(path: string, count = 720): Pt[] | null {
  if (typeof document === "undefined") return null;
  try {
    const probe = document.createElementNS("http://www.w3.org/2000/svg", "path");
    probe.setAttribute("d", path);
    const length = probe.getTotalLength();
    if (!Number.isFinite(length) || length <= 0) return null;
    const points: Pt[] = [];
    for (let i = 0; i < count; i++) {
      const p = probe.getPointAtLength((length * i) / count);
      points.push([p.x, p.y]);
    }
    return points;
  } catch {
    return null;
  }
}
