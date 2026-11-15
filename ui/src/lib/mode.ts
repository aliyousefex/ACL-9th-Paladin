import { useSyncExternalStore } from "react";

/**
 * Simple and Expert view of the race page.
 *
 * The race page has sixteen panels. Simple mode keeps the path a first-time viewer needs: inspect the grid, make a call,
 * read the prediction and how firm it is, reveal the result, and read the autopsy. Expert mode adds the tools for
 * working with the model: the full ranking, comparisons, what-ifs, replay, strategy simulation and the experimental
 * field model. Nothing is removed; Expert is one switch away, and the choice is remembered in this browser.
 */

export type ViewMode = "simple" | "expert";
export const MODE_KEY = "paladin:mode";

/** Panels that only Expert mode shows. */
export const EXPERT_PANELS: readonly string[] = ["field", "rebels", "leaderboard", "compare", "reshuffle", "what-if", "decision", "trace", "replay", "lab", "championship"];

/** What each expert panel is, for the "more tools" note in Simple mode. */
export const EXPERT_TOOLS: readonly { id: string; label: string; detail: string }[] = [
  { id: "field", label: "Field model", detail: "An experimental model that ranks the whole podium at once" },
  { id: "rebels", label: "Rebels", detail: "Where the model and the starting grid disagree" },
  { id: "leaderboard", label: "Ranking", detail: "Every driver's score, with the inputs behind it" },
  { id: "compare", label: "Compare", detail: "Put two or three drivers side by side" },
  { id: "reshuffle", label: "Reshuffle", detail: "Switch whole groups of inputs off and watch the order change" },
  { id: "what-if", label: "What if", detail: "Change one driver's inputs and re-score" },
  { id: "decision", label: "Decision replay", detail: "Inspect the race as it was known, lap by lap" },
  { id: "trace", label: "Trace", detail: "Gaps and positions through the race" },
  { id: "replay", label: "Replay", detail: "Watch the race on the circuit map" },
  { id: "lab", label: "Strategy Lab", detail: "A clearly labelled strategy simulation" },
  { id: "championship", label: "Alternate", detail: "How the result would move the championship" },
];

export const parseMode = (value: string | null | undefined): ViewMode => (value === "expert" ? "expert" : "simple");

export const panelVisible = (id: string, mode: ViewMode): boolean => mode === "expert" || !EXPERT_PANELS.includes(id);

/**
 * A shared scenario link points into Decision replay, which Simple mode hides. Such a link opens in Expert view for
 * that visit without changing the viewer's saved choice.
 */
export function linkNeedsExpert(hash: string): boolean {
  return /[?&]dl=/.test(hash) && /[?&]dd=/.test(hash) && /[?&]ds=/.test(hash);
}

/* ------------------------------------------------------------------ stored choice, shared by every component */

let current: ViewMode | null = null;
const listeners = new Set<() => void>();

function stored(): ViewMode {
  if (current === null) {
    try {
      current = parseMode(localStorage.getItem(MODE_KEY));
    } catch {
      current = "simple";
    }
  }
  return current;
}

export function setViewMode(mode: ViewMode): void {
  current = mode;
  try {
    localStorage.setItem(MODE_KEY, mode);
  } catch {
    /* storage can be blocked; the choice then lasts until the page is closed */
  }
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  const onStorage = (event: StorageEvent) => {
    if (event.key === MODE_KEY) {
      current = parseMode(event.newValue);
      listener();
    }
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

export function useViewMode(): [ViewMode, (mode: ViewMode) => void] {
  const mode = useSyncExternalStore(subscribe, stored, () => "simple" as ViewMode);
  return [mode, setViewMode];
}
