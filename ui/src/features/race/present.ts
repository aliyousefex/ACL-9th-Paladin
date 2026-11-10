import { THRESHOLD } from "../../lib/model.ts";
import type { Autopsy } from "./autopsyModel.ts";
import { gridStory } from "./explain.ts";
import { PRESETS, reshuffle, reshuffleStory, type Group } from "./reshuffle.ts";
import type { Row } from "./rows";

/**
 * The presenter's script for one race: what to say at each step, written from the page's own numbers.
 *
 * The cutoff between what is known before lights out and what the race reveals is the product, so the script keeps it.
 * Steps after the flag are locked until the result has been revealed, and until then their title and text say nothing
 * about the race. `buildScript` is told whether the result is revealed and is only handed the post-race material
 * (`post`) when it is, so the steps before the reveal are built from the model's inputs and scores alone.
 */

export interface PresentStep {
  id: string;
  /** The id of the page section to bring into view and spotlight. */
  target: string;
  title: string;
  /** Talking points, shown as short lines. */
  say: string[];
  /** After the flag and not yet revealed. */
  locked: boolean;
  /** The step where pressing next reveals the result. */
  reveal: boolean;
}

export interface ScriptInput {
  raceName: string;
  year: number;
  round: number;
  circuitName: string;
  lengthM: number | null;
  turns: number | null;
  scheduledLaps: number | null;
  /** Pre-race fields only are read until `revealed` is true. */
  rows: readonly Row[];
  revealed: boolean;
  /** Post-race statements, supplied by the caller only once the result is revealed. */
  post: { autopsy: Autopsy; story: string[] } | null;
}

const LOCKED_TITLE = "After the flag";
const LOCKED_SAY = ["Locked until the result is revealed."];

/** The ids a script may point at, in page order. The race page must render a section with each of these ids. */
export const PRESENT_TARGETS = ["circuit", "grid", "challenge", "prediction", "rebels", "reshuffle", "result", "autopsy", "trace", "replay", "lab"] as const;

export function buildScript(input: ScriptInput): PresentStep[] {
  const { rows, revealed, post } = input;
  const show = revealed && post !== null;
  const ranked = [...rows].sort((a, b) => a.rank - b.rank);
  const top = ranked.slice(0, 3);
  const pole = rows.find((r) => r.grid === 1);
  const above = rows.filter((r) => r.score >= THRESHOLD).length;

  const circuitFacts = [
    input.lengthM ? `${(input.lengthM / 1000).toFixed(3)} km a lap` : null,
    input.turns ? `${input.turns} corners` : null,
    input.scheduledLaps ? `${input.scheduledLaps} scheduled laps` : null,
  ].filter(Boolean);

  const gridOnly = new Set<Group>(PRESETS.find((p) => p.id === "grid-only")!.hold);
  const shuffled = rows.length >= 3 ? reshuffleStory(reshuffle(rows, gridOnly), gridOnly) : [];

  const steps: PresentStep[] = [
    {
      id: "circuit",
      target: "circuit",
      title: "The circuit",
      say: [`${input.raceName} ${input.year}, round ${input.round}.`, ...(circuitFacts.length ? [`${input.circuitName}: ${circuitFacts.join(", ")}.`] : [input.circuitName])],
      locked: false,
      reveal: false,
    },
    {
      id: "grid",
      target: "grid",
      title: "The starting grid",
      say: [
        ...(pole ? [`Pole position: ${pole.driver.name} for ${pole.team.name}.`] : []),
        "The grid is final after qualifying and penalties. Paladin sees 16 inputs for every driver, and all of them are known before lights out.",
      ],
      locked: false,
      reveal: false,
    },
    {
      id: "challenge",
      target: "challenge",
      title: "Your call",
      say: [
        "Pick three drivers for the podium before the result is revealed.",
        "Paladin's own top three is already visible on the page, so this compares your call with the model's. It is not a blind test.",
      ],
      locked: false,
      reveal: false,
    },
    {
      id: "prediction",
      target: "prediction",
      title: "Paladin's call",
      say: [
        `Top three by podium score: ${top.map((r) => `${r.driver.last} (${r.score.toFixed(2)})`).join(", ")}.`,
        `${above} ${above === 1 ? "driver scores" : "drivers score"} at or above the ${THRESHOLD.toFixed(3)} cutoff, and the race has three podium places.`,
        "A score ranks drivers. It is not a calibrated probability.",
      ],
      locked: false,
      reveal: false,
    },
    {
      id: "rebels",
      target: "rebels",
      title: "Where Paladin disagrees with the grid",
      say: gridStory(rows),
      locked: false,
      reveal: false,
    },
    {
      id: "reshuffle",
      target: "reshuffle",
      title: "What each input group is doing",
      say: ["Hold a group of inputs at the training average and the same model re-ranks the field. This is not retraining.", ...shuffled.slice(0, 2)],
      locked: false,
      reveal: false,
    },
    show
      ? { id: "result", target: "result", title: "The result", say: [post!.autopsy.statements.verdict], locked: false, reveal: false }
      : {
          id: "result",
          target: "result",
          title: "Lights out",
          say: ["Everything so far was known before the start.", "Press the next key to reveal the real result."],
          locked: false,
          reveal: true,
        },
    show
      ? {
          id: "autopsy",
          target: "autopsy",
          title: "What Paladin got right and wrong",
          say: [post!.autopsy.statements.podium, post!.autopsy.statements.cutoff, ...(post!.autopsy.statements.retirements ? [post!.autopsy.statements.retirements] : [])],
          locked: false,
          reveal: false,
        }
      : { id: "autopsy", target: "autopsy", title: LOCKED_TITLE, say: LOCKED_SAY, locked: true, reveal: false },
    show
      ? { id: "trace", target: "trace", title: "The race, lap by lap", say: post!.story.slice(0, 3), locked: false, reveal: false }
      : { id: "trace", target: "trace", title: LOCKED_TITLE, say: LOCKED_SAY, locked: true, reveal: false },
    show
      ? {
          id: "replay",
          target: "replay",
          title: "The replay",
          say: ["Lap times and end-of-lap positions are the record.", "Where a car is inside a lap is interpolated, so the replay is also tagged illustrative."],
          locked: false,
          reveal: false,
        }
      : { id: "replay", target: "replay", title: LOCKED_TITLE, say: LOCKED_SAY, locked: true, reveal: false },
    show
      ? {
          id: "lab",
          target: "lab",
          title: "Strategy Laboratory: a synthetic scenario",
          say: ["Everything here follows documented, illustrative rules from a seed.", "It is not a historical result and not a forecast of what would have happened."],
          locked: false,
          reveal: false,
        }
      : { id: "lab", target: "lab", title: LOCKED_TITLE, say: LOCKED_SAY, locked: true, reveal: false },
  ];
  return steps;
}

/** The first step that can be shown, moving in a direction from an index, or the same index when there is none. */
export function nextOpen(steps: readonly PresentStep[], from: number, direction: 1 | -1): number {
  for (let i = from + direction; i >= 0 && i < steps.length; i += direction) if (!steps[i].locked) return i;
  return from;
}

/**
 * Where "next" goes. On the reveal step it reveals the result and stays, so the verdict is what the audience sees;
 * the following press moves on. Anywhere else it goes to the next step that is not locked.
 */
export function advance(steps: readonly PresentStep[], index: number): { index: number; reveal: boolean } {
  if (steps[index]?.reveal) return { index, reveal: true };
  return { index: nextOpen(steps, index, 1), reveal: false };
}

export type PresentKey = "next" | "prev" | "first" | "close" | "fullscreen";

/**
 * The presenter's keyboard contract. It leaves form controls alone, never takes a key combined with a modifier, and
 * lets Space and Enter do their normal job on a focused button, link or disclosure instead of treating them as "next".
 * `inField`: focus is in an input, select, text area, radio group or slider. `native`: focus is on a button, link or summary.
 */
export function presentKey(key: string, ctx: { inField: boolean; native: boolean; modifier: boolean }): PresentKey | null {
  if (ctx.modifier || ctx.inField) return null;
  switch (key) {
    case "ArrowRight":
    case "PageDown":
      return "next";
    case " ":
    case "Enter":
      return ctx.native ? null : "next";
    case "ArrowLeft":
    case "PageUp":
      return "prev";
    case "Home":
      return "first";
    case "Escape":
      return "close";
    case "f":
    case "F":
      return ctx.native ? null : "fullscreen";
    default:
      return null;
  }
}
