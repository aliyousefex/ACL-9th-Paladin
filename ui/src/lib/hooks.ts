import { useEffect, useRef, useState, type RefObject } from "react";

const SUFFIX = "Paladin · F1 Podium Predictor";

export function useTitle(title: string | null): void {
  useEffect(() => {
    document.title = title ? `${title} · ${SUFFIX}` : SUFFIX;
  }, [title]);
}

/** A boolean kept in localStorage; falls back to memory when storage is blocked. */
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
