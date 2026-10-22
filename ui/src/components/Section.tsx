import type { ReactNode } from "react";
import { SECTIONS } from "../lib/sections";

export function Section({
  id,
  title,
  children,
}: {
  id: string;
  title: string;
  children: ReactNode;
}) {
  const index = SECTIONS.findIndex((section) => section.id === id);
  const next = index >= 0 ? SECTIONS[index + 1] : undefined;
  return (
    <section id={id} className="scroll-mt-32 border-t border-line py-16 xl:py-24">
      <h2 className="max-w-[18ch] font-display text-[2.6rem] leading-[0.95] font-semibold tracking-[-0.03em] text-ink md:text-[3.4rem]">
        {title}
      </h2>
      <div className="mt-8 space-y-5 text-[1.05rem] leading-[1.55] text-ink">{children}</div>
      {next && (
        <a className="section-next mt-14 flex items-center justify-between border-t border-line pt-5 no-underline" href={`#/method/${next.id}`}>
          <span className="text-[0.92rem] text-steel">Continue the argument</span>
          <span className="font-display text-[1.15rem] tracking-[0.04em] uppercase text-ink">{next.label}<span aria-hidden className="ml-3 text-signal">↓</span></span>
        </a>
      )}
    </section>
  );
}

export function Prose({ children }: { children: ReactNode }) {
  return <p className="max-w-[68ch]">{children}</p>;
}

export function Takeaway({ children }: { children: ReactNode }) {
  return (
    <p className="max-w-[68ch] border-t border-line pt-4 text-steel">
      <span className="font-medium text-ink">Takeaway. </span>
      {children}
    </p>
  );
}

export function Term({ label, children }: { label: string; children: string }) {
  return (
    <span className="group relative inline-block">
      <button
        type="button"
        className="cursor-help border-b border-signal text-inherit"
        aria-describedby={`${label.replace(/\s+/g, "-").toLowerCase()}-tip`}
      >
        {label}
      </button>
      <span
        role="tooltip"
        id={`${label.replace(/\s+/g, "-").toLowerCase()}-tip`}
        className="absolute bottom-full left-0 z-20 mb-2 hidden w-64 max-w-[calc(100vw-2.5rem)] border border-line bg-tower p-3 text-left font-sans text-[0.85rem] leading-snug font-normal tracking-normal text-ink normal-case group-focus-within:block group-hover:block"
      >
        {children}
      </span>
    </span>
  );
}
