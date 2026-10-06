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
    <section id={id} className="scroll-mt-20 border-t border-line py-14 md:scroll-mt-10">
      <h2 className="max-w-[22ch] text-[1.7rem] leading-tight font-semibold tracking-[-0.03em] text-ink">
        {title}
      </h2>
      <div className="mt-6 max-w-[68ch] space-y-4 text-[1.02rem] leading-[1.55] text-ink">{children}</div>
    </section>
  );
}

export function Prose({ children }: { children: ReactNode }) {
  return <p>{children}</p>;
}

export function Takeaway({ children }: { children: ReactNode }) {
  return (
    <p className="border-t border-line pt-4 text-quiet">
      <span className="font-medium text-ink">Takeaway. </span>
      {children}
    </p>
  );
}
