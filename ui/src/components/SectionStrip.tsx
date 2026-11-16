import { useEffect, useRef } from "react";
import { useStuck } from "../lib/hooks";

export type StripItem = {
  id: string;
  label: string;
  href: string;
  onClick?: (event: React.MouseEvent<HTMLAnchorElement>) => void;
  /** Draws the red "lights out" tick before this item: the split between what was known before the race and what happened. */
  divider?: boolean;
};

/**
 * A page's own section strip (the parts of a race, of the method, of the model page): a floating glass pill of the same
 * material, shape and width as the top bar, which it docks under as the page scrolls. It is the same pill whether it is in the
 * page or stuck to the screen, so there is nothing to change shape when the two meet; the page's content simply passes behind
 * it. It keeps the current section's tab in view, and marks it the way the main navigation marks the current page: with a tonal
 * pill. On a phone it moves down and up with the bar above it, in step (see `useStuck` and `.subnav` in the stylesheet).
 */
export function SectionStrip({ label, items, active }: { label: string; items: StripItem[]; active: string }) {
  const { ref: marker, stuck } = useStuck();
  const list = useRef<HTMLUListElement>(null);

  useEffect(() => {
    const root = list.current;
    const link = root?.querySelector<HTMLElement>('[aria-current="true"]');
    if (!root || !link) return;
    const rootBox = root.getBoundingClientRect();
    const linkBox = link.getBoundingClientRect();
    if (linkBox.left >= rootBox.left + 8 && linkBox.right <= rootBox.right - 8) return;
    const left = link.offsetLeft - root.clientWidth / 2 + link.offsetWidth / 2;
    root.scrollTo({ left: Math.max(0, left), behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
  }, [active]);

  return (
    <>
      <span ref={marker} className="subnav-marker" aria-hidden />
      <nav aria-label={label} className="subnav" data-stuck={stuck ? "true" : undefined}>
        <ul ref={list} className="subnav__list">
          {items.map((item) => (
            <li key={item.id} className="subnav__item">
              {item.divider && <span className="subnav__flag" aria-hidden title="Lights out" />}
              <a href={item.href} onClick={item.onClick} data-id={item.id} aria-current={active === item.id ? "true" : undefined} className="subnav__link">
                {item.label}
              </a>
            </li>
          ))}
        </ul>
      </nav>
    </>
  );
}
