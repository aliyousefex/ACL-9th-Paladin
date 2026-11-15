import { useSyncExternalStore } from "react";

/**
 * Light and dark theme.
 *
 * A visitor's choice is "system" (follow the device), "light" or "dark", saved in this browser. The page itself only ever
 * sees a resolved theme, on <html data-theme="light|dark">. index.html runs the same resolution before the first paint,
 * so a light-theme visitor never sees a dark flash; this module keeps it current afterwards, including when the device
 * switches between light and dark while the pref is "system".
 */

export type ThemePref = "system" | "light" | "dark";
export type Theme = "light" | "dark";
export const THEME_KEY = "paladin:theme";

/** What the browser's own chrome (address bar on a phone) should match. The page colour of each theme. */
export const THEME_CHROME: Record<Theme, string> = { light: "#f3f2ee", dark: "#0a0b0e" };

export const parsePref = (value: string | null | undefined): ThemePref => (value === "light" || value === "dark" ? value : "system");

export const resolveTheme = (pref: ThemePref, systemPrefersDark: boolean): Theme => (pref === "system" ? (systemPrefersDark ? "dark" : "light") : pref);

export const PREF_LABEL: Record<ThemePref, string> = { system: "Match my device", light: "Light", dark: "Dark" };

export function applyTheme(theme: Theme, pref: ThemePref, doc: Document = document): void {
  doc.documentElement.dataset.theme = theme;
  doc.documentElement.dataset.themePref = pref;
  doc.querySelector('meta[name="theme-color"]')?.setAttribute("content", THEME_CHROME[theme]);
}

/* ------------------------------------------------------------------ stored choice, shared by every component */

interface State {
  pref: ThemePref;
  theme: Theme;
}

const query = (): MediaQueryList | null => (typeof window !== "undefined" && window.matchMedia ? window.matchMedia("(prefers-color-scheme: dark)") : null);

let current: State | null = null;
const listeners = new Set<() => void>();

function read(): State {
  if (current === null) {
    let stored: string | null = null;
    try {
      stored = localStorage.getItem(THEME_KEY);
    } catch {
      /* blocked storage: follow the device */
    }
    const pref = parsePref(stored);
    current = { pref, theme: resolveTheme(pref, query()?.matches ?? true) };
  }
  return current;
}

function commit(pref: ThemePref): void {
  const next: State = { pref, theme: resolveTheme(pref, query()?.matches ?? true) };
  if (current && current.pref === next.pref && current.theme === next.theme) return;
  current = next;
  applyTheme(next.theme, next.pref);
  listeners.forEach((listener) => listener());
}

/** Radius of the circle, centred on (x, y), that just covers a width by height viewport. */
export const revealRadius = (x: number, y: number, width: number, height: number): number => Math.hypot(Math.max(x, width - x), Math.max(y, height - y));

type TransitionDocument = Document & { startViewTransition?: (update: () => void) => { finished: Promise<unknown> } };

/**
 * Whether a page-wide animated change is worth what it costs here. Changing the theme re-styles and re-paints the whole page
 * (about 50 to 150ms of work, which a phone's processor takes several times over), and a view transition then paints it
 * twice more and holds the screen still while it does. Measured at a phone's speed that was a stall of most of a second
 * between the press and the first change. A precise pointer means a desktop or laptop, which does it in about a tenth of a
 * second; everything else changes in one step.
 */
const canAffordWipe = (): boolean => window.matchMedia?.("(hover: hover) and (pointer: fine)").matches ?? false;

/**
 * Change the theme. On a desktop with view transitions the new theme grows as a circle from `origin` (the switch) over the
 * old one. Everywhere else, and always under reduced motion, it simply changes: reduced motion at once, the rest in the frame
 * after the next one, so the switch's knob has already started to move before the page stops to repaint (a transform
 * animation carries on while the page is busy, so the control never feels held up by it). There is no page-wide colour
 * fade: animating every element's colours took seconds on a phone. `update` is what actually changes the theme, and it
 * always runs exactly once.
 */
function withThemeTransition(update: () => void, origin?: { x: number; y: number }): void {
  if (typeof document === "undefined" || typeof window === "undefined") return update();
  const doc = document as TransitionDocument;
  const root = doc.documentElement;
  if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return update();
  if (typeof doc.startViewTransition === "function" && canAffordWipe()) {
    const x = origin?.x ?? window.innerWidth / 2;
    const y = origin?.y ?? 0;
    root.style.setProperty("--vt-x", `${x}px`);
    root.style.setProperty("--vt-y", `${y}px`);
    root.style.setProperty("--vt-r", `${revealRadius(x, y, window.innerWidth, window.innerHeight)}px`);
    const transition = doc.startViewTransition(update);
    void transition.finished.finally(() => ["--vt-x", "--vt-y", "--vt-r"].forEach((name) => root.style.removeProperty(name)));
    return;
  }
  let done = false;
  const once = () => {
    if (done) return;
    done = true;
    update();
  };
  window.requestAnimationFrame(() => window.requestAnimationFrame(once));
  window.setTimeout(once, 250); // a frame that never comes (a hidden tab) must not leave the choice unmade
}

export function setThemePref(pref: ThemePref, origin?: { x: number; y: number }): void {
  withThemeTransition(() => {
    try {
      if (pref === "system") localStorage.removeItem(THEME_KEY);
      else localStorage.setItem(THEME_KEY, pref);
    } catch {
      /* the choice then lasts until the page is closed */
    }
    commit(pref);
  }, origin);
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  const media = query();
  const onDevice = () => {
    if (read().pref === "system") commit("system");
  };
  const onStorage = (event: StorageEvent) => {
    if (event.key === THEME_KEY || event.key === null) commit(parsePref(event.newValue));
  };
  media?.addEventListener("change", onDevice);
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    media?.removeEventListener("change", onDevice);
    window.removeEventListener("storage", onStorage);
  };
}

const SERVER: State = { pref: "system", theme: "dark" };

export function useTheme(): State & { setPref: (pref: ThemePref, origin?: { x: number; y: number }) => void } {
  const state = useSyncExternalStore(subscribe, read, () => SERVER);
  return { ...state, setPref: setThemePref };
}
