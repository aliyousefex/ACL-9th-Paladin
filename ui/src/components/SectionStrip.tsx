import { useEffect, useRef } from "react";
import { useStuck } from "../lib/hooks";
import { publishSectionNav, type StripItem } from "../lib/sectionNav";

export type { StripItem };

/**
 * A page's own section strip (the parts of a race, of the method, of the model page): a floating glass pill of the same
 * material, shape and width as the top bar, sitting in the page. When it reaches the bar it does not dock under it as a second
 * bar: it melts into the first. The strip fades up into the bar and the bar grows a chip for the current section, which opens a
 * dropdown of the sections (see `SectionMenu` in the shell). Scrolled back up it returns. The strip tells the bar about its
 * sections through `publishSectionNav`. It keeps the current section's tab in view while it is showing, and marks it the way
 * the main navigation marks the current page: a tonal pill.
 *
 * On a phone the bar hides while reading, so the strip is the way around then: it comes back, alone, at the top of the screen,
 * and gives way to the bar's chip again when the bar returns. There are never two bars on screen at once.
 */
export function SectionStrip({ label, items, active }: { label: string; items: StripItem[]; active: string }) {
  const { ref: marker, stuck } = useStuck();
  const list = useRef<HTMLUListElement>(null);

  // Tell the bar what the sections are, which one is current, and whether the strip has reached it. (Runs every render so the
  // bar always has the latest click handlers; the store only wakes the bar when something it shows has changed.)
  useEffect(() => {
    publishSectionNav({ label, items, active, stuck });
  });
  useEffect(() => () => publishSectionNav(null), []);

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
