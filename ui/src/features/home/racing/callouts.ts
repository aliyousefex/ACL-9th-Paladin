/**
 * What a spotter and a race engineer would say over the radio, decided from the race as the model has it. Nothing here makes a sound:
 * it returns short lines of text with a priority, and the audio layer speaks them (and drops the quiet ones while a louder one is
 * being said). It imports nothing from the browser, so the rules are tested in plain Node.
 *
 * The lines are the ones a driver hears: "on your left" when a car comes alongside, "overtake" when a place is taken, the position
 * after it, "car through" when one is lost, "off track" on the kerb, and lights out at the start.
 */
import type { Race, RaceEvent, Side } from "./traffic.ts";

export interface Callout {
  /** What to say. */
  text: string;
  /** Higher is more urgent: a line of lower priority is dropped while a higher one is being said. */
  priority: number;
  /** Which kind of line it is, for the cooldowns and for tests. */
  kind: "alongside" | "clear" | "overtake" | "lost" | "off-track" | "start" | "lap";
}

/** A car is "alongside" when it is this close along the road to the player's nose or tail, and in the next lane. */
export const ALONGSIDE_G = 7.5;
export const ALONGSIDE_MIN = 1.4;
export const ALONGSIDE_MAX = 5.8;
/** Seconds before the same car is called again, and before the same kind of line is repeated. */
const SAME_CAR = 5;
const SAME_KIND: Record<Callout["kind"], number> = { alongside: 0.9, clear: 4, overtake: 1.2, lost: 1.2, "off-track": 7, start: 30, lap: 20 };

const ORDINAL = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "eleven", "twelve", "thirteen", "fourteen", "fifteen", "sixteen", "seventeen", "eighteen", "nineteen", "twenty"];
/** A position, as it is said. */
export const sayPosition = (n: number): string => `Position ${ORDINAL[Math.min(Math.max(Math.round(n), 0), ORDINAL.length - 1)]}`;

export interface Spotter {
  /** Look at the race as it is now and return what is to be said, most urgent first. Call it every frame with the events not yet drained. */
  step(race: Race, events: readonly RaceEvent[]): Callout[];
  /** Forget what was said (a restart). */
  reset(): void;
}

export function createSpotter(): Spotter {
  /** Which side each car is alongside on, by slot. */
  let along = new Map<number, Side>();
  const said = new Map<string, number>();
  let wentOut = false;
  let kerbSince = -1;
  const out: Callout[] = [];

  const ready = (key: string, t: number, gap: number): boolean => {
    const last = said.get(key);
    if (last !== undefined && t - last < gap) return false;
    said.set(key, t);
    return true;
  };

  return {
    reset() {
      along = new Map();
      said.clear();
      wentOut = false;
      kerbSince = -1;
    },
    step(race, events) {
      out.length = 0;
      const t = race.t;
      const p = race.player;

      // the start: lights out, and the order they are in
      if (race.released && !wentOut) {
        wentOut = true;
        if (ready("start", t, SAME_KIND.start)) out.push({ text: "Lights out, go go go!", priority: 5, kind: "start" });
      }
      if (!race.released) {
        wentOut = false;
        return out;
      }

      // cars alongside: said once as it arrives, on the side it is on, and "clear" when the last one has gone
      const now = new Map<number, Side>();
      for (const c of race.cars) {
        if (!c.active) continue;
        const across = c.d - p.d;
        if (Math.abs(c.g) < ALONGSIDE_G && Math.abs(across) > ALONGSIDE_MIN && Math.abs(across) < ALONGSIDE_MAX) now.set(c.slot, across > 0 ? 1 : -1);
      }
      for (const [slot, side] of now) {
        if (along.get(slot) === side) continue;
        if (!ready(`car-${slot}`, t, SAME_CAR)) continue;
        if (!ready(`alongside-${side}`, t, SAME_KIND.alongside)) continue;
        out.push({ text: side < 0 ? "On your left, on your left!" : "On your right, on your right!", priority: 4, kind: "alongside" });
      }
      for (const [slot, side] of along) {
        if (now.has(slot)) continue;
        // it has gone from beside the car: clear on that side if nothing else is there
        const stillThere = [...now.values()].includes(side);
        if (!stillThere && ready(`clear-${side}`, t, SAME_KIND.clear)) out.push({ text: side < 0 ? "Clear left." : "Clear right.", priority: 1, kind: "clear" });
      }
      along = now;

      // places taken and lost
      for (const e of events) {
        if (e.kind === "passed" && ready("overtake", t, SAME_KIND.overtake)) out.push({ text: `Overtake, overtake! ${sayPosition(e.position)}.`, priority: 6, kind: "overtake" });
        else if (e.kind === "passed-by" && ready("lost", t, SAME_KIND.lost)) out.push({ text: `Car through. ${sayPosition(e.position)}.`, priority: 5, kind: "lost" });
        else if (e.kind === "lap" && e.lap > 1 && ready("lap", t, SAME_KIND.lap)) out.push({ text: `Lap ${e.lap <= 20 ? ORDINAL[e.lap] : e.lap}.`, priority: 2, kind: "lap" });
      }

      // wheels on the kerb or the grass for more than a moment
      if (p.kerb > 0.7) {
        if (kerbSince < 0) kerbSince = t;
        else if (t - kerbSince > 0.6 && ready("off-track", t, SAME_KIND["off-track"])) out.push({ text: "Off track, off track!", priority: 3, kind: "off-track" });
      } else kerbSince = -1;

      out.sort((a, b) => b.priority - a.priority);
      return out;
    },
  };
}
