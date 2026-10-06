import type { ReactNode } from "react";

export function Section({
  id,
  title,
  children,
}: {
  id: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-24 border-t border-line py-16 md:scroll-mt-12">
      <h2 className="max-w-[18ch] font-display text-[2.6rem] leading-[0.95] font-semibold tracking-[-0.03em] text-ink md:text-[3.4rem]">
        {title}
      </h2>
      <div className="mt-8 space-y-5 text-[1.05rem] leading-[1.55] text-ink">{children}</div>
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
        className="invisible absolute bottom-full left-0 z-20 mb-2 w-64 border border-line bg-tower p-3 text-left font-sans text-[0.85rem] leading-snug font-normal tracking-normal text-ink normal-case group-focus-within:visible group-hover:visible"
      >
        {children}
      </span>
    </span>
  );
}
