import { SECTIONS } from "../lib/sections";

export function Tower({ active }: { active: string }) {
  return (
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-56 flex-col bg-tower text-paper md:flex">
      <div className="border-b border-white/15 px-5 py-6">
        <p className="font-mono text-[15px] tracking-[-0.02em]">Paladin</p>
        <p className="mt-1 font-mono text-[12px] text-[#d5cec2]">ACL-903 Milestone 1</p>
      </div>
      <nav className="flex flex-1 flex-col gap-1 overflow-y-auto px-3 py-4" aria-label="Sections">
        {SECTIONS.map((section) => {
          const on = section.id === active;
          return (
            <a
              key={section.id}
              href={`#${section.id}`}
              aria-current={on ? "true" : undefined}
              className={`flex items-center gap-3 rounded-sm px-2 py-2 font-mono text-[12.5px] leading-snug no-underline ${
                on ? "text-paper" : "text-[#d5cec2] hover:text-paper"
              }`}
            >
              <span
                className={`h-2 w-2 shrink-0 ${on ? "bg-signal" : "bg-transparent ring-1 ring-[#d5cec2]"}`}
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
      className="sticky top-0 z-30 flex gap-2 overflow-x-auto border-b border-white/15 bg-tower px-3 py-3 md:hidden"
      aria-label="Sections"
    >
      {SECTIONS.map((section) => {
        const on = section.id === active;
        return (
          <a
            key={section.id}
            href={`#${section.id}`}
            aria-current={on ? "true" : undefined}
            className={`shrink-0 border-b font-mono text-[12px] no-underline ${
              on ? "border-signal text-paper" : "border-transparent text-[#d5cec2]"
            }`}
          >
            {section.label}
          </a>
        );
      })}
    </nav>
  );
}
