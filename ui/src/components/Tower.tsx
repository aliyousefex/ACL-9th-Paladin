import { SECTIONS } from "../lib/sections";

export function Tower({ active }: { active: string }) {
  return (
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-72 flex-col border-r border-line bg-tower text-ink md:flex">
      <div className="px-6 pt-7 pb-5">
        <p className="font-display text-[2rem] leading-none font-semibold tracking-[-0.03em]">Paladin</p>
        <p className="mt-2 text-[0.95rem] text-steel">ACL-903 Milestone 1</p>
      </div>
      <nav className="flex flex-1 flex-col overflow-y-auto px-3 pb-6" aria-label="Sections">
        {SECTIONS.map((section) => {
          const on = section.id === active;
          return (
            <a
              key={section.id}
              href={`#${section.id}`}
              aria-current={on ? "true" : undefined}
              className={`flex items-center gap-3 px-3 py-2.5 text-[1.02rem] leading-snug no-underline transition-colors ${
                on ? "bg-white/5 text-ink" : "text-steel hover:text-ink"
              }`}
            >
              <span
                className={`h-2.5 w-2.5 shrink-0 ${on ? "bg-signal" : "bg-transparent ring-1 ring-steel"}`}
                aria-hidden
              />
              {section.label}
            </a>
          );
        })}
      </nav>
    </aside>
  );
}

export function MobileNav({ active }: { active: string }) {
  return (
    <nav
      className="sticky top-0 z-30 flex gap-1 overflow-x-auto border-b border-line bg-tower px-3 py-3 md:hidden"
      aria-label="Sections"
    >
      {SECTIONS.map((section) => {
        const on = section.id === active;
        return (
          <a
            key={section.id}
            href={`#${section.id}`}
            aria-current={on ? "true" : undefined}
            className={`flex shrink-0 items-center gap-2 px-2 py-1 text-[0.95rem] no-underline ${
              on ? "text-ink" : "text-steel"
            }`}
          >
            <span className={`h-2 w-2 ${on ? "bg-signal" : "bg-transparent ring-1 ring-steel"}`} aria-hidden />
            {section.label}
          </a>
        );
      })}
    </nav>
  );
}
