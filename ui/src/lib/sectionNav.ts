import { useSyncExternalStore } from "react";
import type { MouseEvent } from "react";

/**
 * The page's own section strip and the top bar share one list of sections. The page publishes it (what the sections are, which
 * one the reader is in, and whether the strip has reached the bar); the bar reads it. When the strip reaches the bar it stops
 * being a second bar and becomes a dropdown inside the first: the bar shows the current section as a chip that opens this list.
 */

export type StripItem = {
  id: string;
  label: string;
  href: string;
  onClick?: (event: MouseEvent<HTMLAnchorElement>) => void;
  /** Draws the red "lights out" tick before this item: the split between what was known before the race and what happened. */
  divider?: boolean;
};

export type SectionNav = { label: string; items: StripItem[]; active: string; stuck: boolean };

let current: SectionNav | null = null;
const listeners = new Set<() => void>();

const same = (a: SectionNav | null, b: SectionNav | null): boolean =>
  a === b ||
  (!!a && !!b && a.label === b.label && a.active === b.active && a.stuck === b.stuck && a.items.length === b.items.length && a.items.every((item, i) => item.id === b.items[i].id && item.label === b.items[i].label));

/** Publish the page's sections (or null when the page has none). The page republishes on every render; only a real change notifies. */
export function publishSectionNav(next: SectionNav | null): void {
  if (same(current, next)) {
    if (current && next) current = { ...current, items: next.items }; // keep the latest click handlers without waking anyone
    return;
  }
  current = next;
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useSectionNav(): SectionNav | null {
  return useSyncExternalStore(subscribe, () => current, () => null);
}
