import type { LabEventKind } from "../features/raceLab/engine";

/**
 * What the little marks beside a race's events mean, kept apart from the drawing (components/EventMark.tsx) so it can be checked.
 *
 * Race Lab is a simulation and says so on every event, so its incident is shown as the yellow flag a real one would bring out, and
 * its finish as the chequered flag. The decision studio shows what was recorded, and the record does not say why the field slowed
 * (a safety car, a red flag, rain), so no recorded event is ever drawn as a flag: a flag would name a cause the data does not hold.
 */

/** Race Lab's events, as a word, in the sentence case the interface uses. */
export const LAB_WORD: Record<LabEventKind, string> = {
  start: "Start",
  pass: "Overtake",
  pit: "Pit stop",
  incident: "Incident",
  retirement: "Retirement",
  finish: "Finish",
  strategy: "Strategy call",
};

/** The simulated events drawn as a marshal's flag. */
export const FLAG_KINDS = ["incident", "finish"] as const;

/** The recorded events of the decision studio's ledger that have a mark (a position change has none, and is not shown). */
export const RECORDED_KINDS = ["start", "pit", "lead-change", "slow-field"] as const;
