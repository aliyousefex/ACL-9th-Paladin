import { useEffect, useRef } from "react";
import { Book } from "../../sections/Book";
import { Build } from "../../sections/Build";
import { Cases } from "../../sections/Cases";
import { Classification } from "../../sections/Classification";
import { Decision } from "../../sections/Decision";
import { Features } from "../../sections/Features";
import { Findings } from "../../sections/Findings";
import { Limits } from "../../sections/Limits";
import { Line } from "../../sections/Line";
import { Models } from "../../sections/Models";
import { SECTIONS } from "../../lib/sections";
import { useScrollSpy, useTitle } from "../../lib/hooks";
import { haptic } from "../../lib/haptic";
import { href } from "../../lib/router";

const IDS = SECTIONS.map((s) => s.id) as string[];

/**
 * The Milestone 1 walkthrough: the argument from raw tables to the selected model, kept whole.
 * It is one long document; the navigator below follows the reader and links to each section.
 */
export function MethodPage({ section }: { section?: string }) {
  useTitle("Method walkthrough");
  const active = useScrollSpy(IDS, 150);

  // The page mounts lazily, so a link such as #/method/book can arrive before its section exists.
  const arrived = useRef(false);
  useEffect(() => {
    if (!section) return;
    const node = document.getElementById(section);
    // Arriving from a link jumps straight to the section; moving around inside the page scrolls smoothly.
    const smooth = arrived.current && !matchMedia("(prefers-reduced-motion: reduce)").matches;
    arrived.current = true;
    if (node) node.scrollIntoView({ behavior: smooth ? "smooth" : "instant", block: "start" });
  }, [section]);
  const track = useRef<HTMLElement>(null);

  useEffect(() => {
    const root = track.current;
    const link = root?.querySelector<HTMLAnchorElement>(`[data-id="${active}"]`);
    if (!root || !link) return;
    const rootBox = root.getBoundingClientRect();
    const linkBox = link.getBoundingClientRect();
    if (linkBox.left >= rootBox.left - 1 && linkBox.right <= rootBox.right + 1) return;
    const left = link.offsetLeft - root.clientWidth / 2 + link.offsetWidth / 2;
    root.scrollTo({ left: Math.max(0, left), behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
  }, [active]);

  return (
    <div className="page-in">
      <header className="border-b border-line pt-[calc(var(--nav-h)+2rem)] pb-8">
        <div className="mx-auto max-w-[1320px] px-4 sm:px-6 lg:px-10">
          <p className="eyebrow">Method walkthrough · ACL-903 Milestone 1</p>
          <h1 className="display mt-3 text-[3rem] sm:text-[4.8rem]">From raw tables to one model</h1>
          <p className="mt-4 max-w-[68ch] text-[1.1rem] leading-relaxed text-steel">
            The full argument behind the predictions: how the data was audited and cleaned, how a row is built so the race cannot leak into
            its own inputs, how the split was cut, and why logistic regression was selected. Every number comes from the same run as the written
            report.
          </p>
        </div>
      </header>

      <nav
        ref={track}
        aria-label="Walkthrough sections"
        className="scroll-x sticky z-40 overflow-x-auto border-b border-line bg-tower/95 backdrop-blur-sm"
        style={{ top: "var(--nav-h)" }}
      >
        <ul className="mx-auto flex max-w-[1320px] items-center gap-1 px-4 sm:px-6 lg:px-10">
          {SECTIONS.map((item) => {
            const on = item.id === active;
            return (
              <li key={item.id} className="shrink-0">
                <a
                  data-id={item.id}
                  href={href(`/method/${item.id}`)}
                  onClick={() => haptic("select")}
                  aria-current={on ? "true" : undefined}
                  className={`relative block px-3 py-3 font-display text-[0.98rem] leading-none font-semibold tracking-[0.1em] uppercase no-underline transition-colors ${on ? "text-ink" : "text-mute hover:text-ink"}`}
                >
                  {item.label}
                  <span aria-hidden className={`absolute inset-x-3 bottom-0 h-[2px] bg-signal transition-opacity ${on ? "opacity-100" : "opacity-0"}`} />
                </a>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="mx-auto max-w-6xl px-4 pb-8 sm:px-6 lg:px-10" data-section={section}>
        <Decision />
        <Line />
        <Book />
        <Findings />
        <Build />
        <Features />
        <Models />
        <Classification />
        <Cases />
        <Limits />
      </div>
    </div>
  );
}
