import { useEffect, useLayoutEffect, useRef, useState, type RefObject } from "react";

const SUFFIX = "Paladin · F1 Podium Predictor";

/** The document title for a page: its own name, then the site's. The home page is just the site's. */
export const pageTitle = (title: string | null): string => (title ? `${title} · ${SUFFIX}` : SUFFIX);

/** Head tags a page restates, as [selector, what it carries]. A page without its own title leaves the site-wide share title alone. */
const HEAD_TAGS: [string, "title" | "description"][] = [
  ['meta[name="description"]', "description"],
  ['meta[property="og:title"]', "title"],
  ['meta[property="og:description"]', "description"],
  ['meta[name="twitter:title"]', "title"],
  ['meta[name="twitter:description"]', "description"],
];

/**
 * Name the page for the browser tab, history, bookmarks and anything that reads the head after the app has run (a share
 * sheet, a crawler that renders scripts). `description` replaces the site-wide one while the page is open and is put back
 * when it closes, so a page that gives none shows the site's. The address of a hash route is not a separate page to a
 * search engine, so this is for the people and tools that do see it, not a promise of its own search listing.
 */
export function useTitle(title: string | null, description?: string): void {
  useEffect(() => {
    document.title = pageTitle(title);
    const undo: (() => void)[] = [];
    for (const [selector, kind] of HEAD_TAGS) {
      const value = kind === "title" ? (title ? pageTitle(title) : undefined) : description;
      const tag = document.head.querySelector(selector);
      if (value === undefined || !tag) continue;
      const before = tag.getAttribute("content") ?? "";
      tag.setAttribute("content", value);
      undo.push(() => tag.setAttribute("content", before));
    }
    return () => undo.forEach((restore) => restore());
  }, [title, description]);
}

/** A boolean kept in localStorage; falls back to memory when storage is blocked. */
/** Layout effect on the client, plain effect on the server, so rendering to markup stays quiet. */
const useIsoLayoutEffect = typeof window !== "undefined" ? useLayoutEffect : useEffect;

/**
 * Slide a pill to the current item of a row of links. The row marks each item with `data-nav-key`; the hook measures the
 * current one and publishes `--pill-x`, `--pill-w` and `--pill-on` on the row for the CSS to move the pill with. It stays
 * correct when the row resizes or the fonts arrive, and the first placement is instant, not animated from nothing.
 */
export function useSlidingPill<T extends HTMLElement>(activeKey: string | null): { ref: RefObject<T | null>; ready: boolean } {
  const ref = useRef<T>(null);
  const [ready, setReady] = useState(false);
  useIsoLayoutEffect(() => {
    const root = ref.current;
    if (!root) return;
    const place = () => {
      const item = activeKey !== null ? root.querySelector<HTMLElement>(`[data-nav-key="${activeKey}"]`) : null;
      if (!item) {
        root.style.setProperty("--pill-on", "0");
        return;
      }
      root.style.setProperty("--pill-x", `${item.offsetLeft}px`);
      root.style.setProperty("--pill-w", `${item.offsetWidth}px`);
      root.style.setProperty("--pill-on", "1");
    };
    place();
    const frame = requestAnimationFrame(() => setReady(true));
    const watch = typeof ResizeObserver !== "undefined" ? new ResizeObserver(place) : null;
    watch?.observe(root);
    void document.fonts?.ready.then(place);
    return () => {
      cancelAnimationFrame(frame);
      watch?.disconnect();
    };
  }, [activeKey]);
  return { ref, ready };
}

export function useStoredFlag(key: string, initial = false): [boolean, (next: boolean) => void] {
  const [value, setValue] = useState(() => {
    try {
      const stored = localStorage.getItem(key);
      return stored === null ? initial : stored === "1";
    } catch {
      return initial;
    }
  });
  const set = (next: boolean) => {
    setValue(next);
    try {
      localStorage.setItem(key, next ? "1" : "0");
    } catch {
      /* ignore */
    }
  };
  return [value, set];
}

/** Which of the given element ids is nearest the top of the viewport. */
export function useScrollSpy(ids: string[], offset = 150): string {
  const [active, setActive] = useState(ids[0] ?? "");
  useEffect(() => {
    const onScroll = () => {
      let current = ids[0];
      for (const id of ids) {
        const node = document.getElementById(id);
        if (node && node.getBoundingClientRect().top <= offset) current = id;
      }
      setActive(current);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ids.join("|"), offset]);
  return active;
}

/**
 * The rendered width of an element, for charts that draw in real pixels. A chart drawn in a fixed 1000-unit
 * viewBox and scaled down to a phone ends up with 4 px axis labels; drawing at the measured width keeps text at
 * its true size and lets the layout adapt instead. Returns `fallback` until the element has been measured (and
 * during server rendering), so a chart always has a sensible size.
 */
export function useElementWidth<T extends HTMLElement>(fallback = 1000): [RefObject<T | null>, number] {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(fallback);
  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const read = () => {
      const next = Math.round(node.getBoundingClientRect().width);
      if (next > 0) setWidth((prev) => (prev === next ? prev : next));
    };
    read();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(read);
    observer.observe(node);
    return () => observer.disconnect();
  }, []);
  return [ref, width];
}

/**
 * Whether a sticky strip has stuck to the top of the screen. `ref` goes on a marker element that sits directly above the
 * strip (it is also the strip's spacing from what is above it, so its bottom edge is exactly where the strip would be in the
 * page). Once that edge has risen above the line the strip sticks at, the strip is stuck. The strip then moves (with a
 * transform, never by changing its `top`, which snaps and shifts layout) in step with the bar that hides and shows above it.
 */
export function useStuck(): { ref: RefObject<HTMLSpanElement | null>; stuck: boolean } {
  const ref = useRef<HTMLSpanElement>(null);
  const [stuck, setStuck] = useState(false);
  useEffect(() => {
    const marker = ref.current;
    const strip = marker?.nextElementSibling as HTMLElement | null;
    if (!marker || !strip || typeof IntersectionObserver === "undefined") return;
    let observer: IntersectionObserver | null = null;
    const observe = () => {
      observer?.disconnect();
      const top = Math.max(0, parseFloat(getComputedStyle(strip).top) || 0);
      observer = new IntersectionObserver(([entry]) => setStuck(!entry.isIntersecting && entry.boundingClientRect.bottom < top + 1), {
        rootMargin: `${-top}px 0px 0px 0px`,
        threshold: 0,
      });
      observer.observe(marker);
    };
    observe();
    window.addEventListener("resize", observe);
    return () => {
      observer?.disconnect();
      window.removeEventListener("resize", observe);
    };
  }, []);
  return { ref, stuck };
}
