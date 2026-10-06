import { useEffect, useRef, useState } from "react";
import { SECTIONS } from "../lib/sections";

export function Nav({ active }: { active: string }) {
  const hidden = useHideOnScroll();
  const track = useRef<HTMLElement>(null);

  useEffect(() => {
    const root = track.current;
    if (!root) return;
    const link = root.querySelector<HTMLAnchorElement>(`[href="#${active}"]`);
    if (!link) return;
    const left = link.offsetLeft - root.clientWidth / 2 + link.offsetWidth / 2;
    root.scrollTo({ left: Math.max(0, left) });
  }, [active]);

  return (
    <header
      className="site-nav fixed inset-x-0 top-0 z-40 border-b border-line bg-tower"
      data-hidden={hidden}
      inert={hidden || undefined}
    >
      <div className="flex items-center gap-4 px-5 py-3 md:px-8">
        <a
          href="#decision"
          className="shrink-0 font-display text-[1.85rem] leading-none font-semibold tracking-[-0.03em] text-ink no-underline"
        >
          Paladin
        </a>
        <nav ref={track} className="sections flex min-w-0 flex-1 gap-1 overflow-x-auto" aria-label="Sections">
          {SECTIONS.map((section) => {
            const on = section.id === active;
            return (
              <a
                key={section.id}
                href={`#${section.id}`}
                aria-current={on ? "true" : undefined}
                className={`flex shrink-0 items-center gap-2 px-2 py-1.5 text-[0.98rem] leading-none no-underline ${
                  on ? "text-ink" : "text-steel hover:text-ink"
                }`}
              >
                <span
                  className={`h-2 w-2 shrink-0 ${on ? "bg-signal" : "bg-transparent ring-1 ring-steel"}`}
                  aria-hidden
                />
                {section.label}
              </a>
            );
          })}
        </nav>
      </div>
    </header>
  );
}

function useHideOnScroll(): boolean {
  const [hidden, setHidden] = useState(false);
  const last = useRef(0);
  const hiddenRef = useRef(false);

  useEffect(() => {
    last.current = window.scrollY;

    const onScroll = () => {
      const y = window.scrollY;
      const delta = y - last.current;
      let next = hiddenRef.current;
      if (y < 48) next = false;
      else if (delta > 8) next = true;
      else if (delta < -8) next = false;
      last.current = y;
      if (next === hiddenRef.current) return;
      hiddenRef.current = next;
      setHidden(next);
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return hidden;
}
