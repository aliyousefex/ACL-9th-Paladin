/**
 * What a Formula 1 car can do, in the few numbers that matter to a picture of one. Everything is per kilogram, so there is no mass:
 *
 *  - Pulling away is limited by the rear tyres until the engine runs out of power, which is why a car gets to 100 km/h in under three
 *    seconds but takes ten to find 300.
 *  - Drag grows with the square of speed, and it is most of what stops the car at the top end.
 *  - Downforce grows with the square of speed too, and presses the tyres into the road: the faster the car goes, the harder it can
 *    brake and the harder it can corner. That is the whole character of the car.
 *  - Following another car closely takes the air off it (the tow, a few per cent of the drag), and costs the downforce of the car
 *    that is following (dirty air).
 *
 * The numbers are chosen to land in the right places (0 to 100 km/h in about 2.6 s, 0 to 200 in about 5, a top speed above 330,
 * braking from 300 km/h to a standstill-ish corner in about 120 m, 4 to 5 g in the fast corners), not to be a simulation.
 */

export const G = 9.81;

/** Engine power per kilogram of car, after the gearbox and what the hybrid system adds, W/kg. */
const POWER = 780;
/** The most the rear tyres can push with at low speed, m/s^2. */
const TRACTION = 12.5;
/** Half the air's density times drag area, per kilogram: drag in m/s^2 is this times speed squared. */
const DRAG_K = 0.00092;
/** The grip of the tyres with no downforce, and how much downforce adds per (m/s)^2, in m/s^2 and 1/m. */
const GRIP_BASE = 25;
const GRIP_AERO = 0.0026;
/** Braking is a little stronger than cornering, as the tyres are loaded straight on. */
const BRAKE_BASE = 21;
const BRAKE_AERO = 0.0019;
/** What the engine and the harvesting hybrid system take back when the throttle is lifted at speed, m/s^2. */
export const ENGINE_BRAKE = 2.6;

/** Push, m/s^2, at a speed: the tyres' limit first, then the engine's. `circle` is the share of the tyres' grip not already used for cornering (1 when going straight). */
export const driveAccel = (v: number, circle = 1): number => Math.min(TRACTION * circle, POWER / Math.max(v, 10));
/** The air, m/s^2 (positive means slowing the car). */
export const dragDecel = (v: number): number => DRAG_K * v * v;
/** The most the brakes and tyres can slow the car, not counting the drag, m/s^2. */
export const brakeDecel = (v: number, circle = 1): number => (BRAKE_BASE + BRAKE_AERO * v * v) * circle;
/** What is left to speed up with at full throttle. */
export const netAccel = (v: number): number => driveAccel(v) - dragDecel(v);
/** The sideways acceleration the tyres can hold, m/s^2: about 2.5 g in a slow corner, over 4 g in a fast one. */
export const gripLat = (v: number): number => GRIP_BASE + GRIP_AERO * v * v;

/**
 * The fastest a car can take a bend of this curvature (1/m), which is where the sideways acceleration v^2 k meets the grip it has
 * at that speed. Infinity for a bend so gentle that the downforce always holds it.
 */
export function cornerSpeed(curv: number): number {
  const k = Math.abs(curv);
  if (k <= GRIP_AERO + 1e-6) return Infinity;
  return Math.sqrt(GRIP_BASE / (k - GRIP_AERO));
}

/**
 * The share of the drag taken away by sitting behind a car at this distance (bumper to bumper, m) and this much to one side (m):
 * most of it when close and in line, nothing past about 35 m or when more than a car's width off the line.
 */
export function tow(distance: number, offLine: number): number {
  if (distance < 0 || distance > 35) return 0;
  const lateral = Math.max(0, 1 - Math.abs(offLine) / 2.1);
  const near = distance < 5 ? 1 : 1 - (distance - 5) / 30;
  return 0.38 * lateral * near;
}

/** The share of the downforce lost by following closely in the wake of a car (dirty air): up to about 12%. */
export function wake(distance: number, offLine: number): number {
  if (distance < 0 || distance > 22) return 0;
  const lateral = Math.max(0, 1 - Math.abs(offLine) / 2.4);
  return 0.12 * lateral * (1 - distance / 22);
}

/** Move a value towards a target by at most `up` per second going up and `down` per second going down: a foot on a pedal, a hand on a wheel. */
export function slew(current: number, target: number, up: number, down: number, dt: number): number {
  const diff = target - current;
  return diff > 0 ? current + Math.min(diff, up * dt) : current + Math.max(diff, -down * dt);
}
