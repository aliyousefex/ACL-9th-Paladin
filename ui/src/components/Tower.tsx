import { useEffect, useRef } from "react";
import { haptic } from "../lib/haptic";
import { SECTIONS } from "../lib/sections";

export function Nav({ active }: { active: string }) {
  const track = useRef<HTMLElement>(null);

  useEffect(() => {
    const root = track.current;
    if (!root) return;
    const link = root.querySelector<HTMLAnchorElement>(`[href="#${active}"]`);
    if (!link) return;
    const rootBox = root.getBoundingClientRect();
    const linkBox = link.getBoundingClientRect();
    if (linkBox.left >= rootBox.left - 1 && linkBox.right <= rootBox.right + 1) return;
    const left = link.offsetLeft - root.clientWidth / 2 + link.offsetWidth / 2;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    root.scrollTo({ left: Math.max(0, left), behavior: reduce ? "auto" : "smooth" });
  }, [active]);

  return (
    <header className="fixed inset-x-0 top-0 z-40 border-b border-signal bg-tower">
      <div className="flex flex-col md:h-16 md:flex-row md:items-center md:gap-5 md:px-8">
        <div className="flex items-center px-5 pt-3 pb-1 md:px-0 md:py-0">
          <a href="#decision" className="flex items-center gap-3 text-ink no-underline" onClick={() => haptic("select")}>
            <span className="mark-flag" aria-hidden>
              <span />
              <span />
              <span />
            </span>
            <span className="font-mark inline-block -skew-x-6 text-[2.15rem] leading-none tracking-[0.04em]">
              PALADIN
            </span>
          </a>
        </div>
        <span className="hidden h-7 w-px shrink-0 bg-signal md:block" aria-hidden />
        <nav
          ref={track}
          className="sections flex min-w-0 gap-1 overflow-x-auto px-3 pt-1 pb-2 md:flex-1 md:px-0 md:py-0"
          aria-label="Sections"
        >
          {SECTIONS.map((section) => {
            const on = section.id === active;
            return (
              <a
                key={section.id}
                href={`#${section.id}`}
                onClick={() => haptic("select")}
                aria-current={on ? "true" : undefined}
                className={`shrink-0 px-2.5 py-1.5 font-display text-[1.05rem] leading-none tracking-[0.06em] uppercase no-underline ${
                  on ? "bg-signal text-ink" : "text-steel hover:text-ink"
                }`}
              >
                {section.label}
              </a>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
