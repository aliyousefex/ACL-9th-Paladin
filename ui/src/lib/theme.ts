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

/**
 * Change the theme. Changing it re-styles and repaints the whole page, which takes a moment (about 50 to 150ms on a desktop, and
 * several times that on a phone), and nothing the browser can animate across it is free: a view transition paints the page twice
 * more and holds the whole screen still, knob and all, while it does (measured at a phone's speed that was a stall of most of a
 * second between the press and the first change; a colour fade on every element was worse). So the page changes in one step,
 * and it changes in the frame after the next one, so the switch has already started to move before the page stops to repaint: a
 * transform animation carries on while the page is busy, and the control never feels held up by it. Under reduced motion there
 * is nothing to wait for. `update` is what actually changes the theme, and it always runs exactly once.
 */
function whenTheKnobHasMoved(update: () => void): void {
  if (typeof window === "undefined" || typeof document === "undefined") return update();
  if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return update();
  let done = false;
  const once = () => {
    if (done) return;
    done = true;
    update();
  };
  window.requestAnimationFrame(() => window.requestAnimationFrame(once));
  window.setTimeout(once, 250); // a frame that never comes (a hidden tab) must not leave the choice unmade
}

export function setThemePref(pref: ThemePref): void {
  whenTheKnobHasMoved(() => {
    try {
      if (pref === "system") localStorage.removeItem(THEME_KEY);
      else localStorage.setItem(THEME_KEY, pref);
    } catch {
      /* the choice then lasts until the page is closed */
    }
    commit(pref);
  });
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

export function useTheme(): State & { setPref: (pref: ThemePref) => void } {
  const state = useSyncExternalStore(subscribe, read, () => SERVER);
  return { ...state, setPref: setThemePref };
}
