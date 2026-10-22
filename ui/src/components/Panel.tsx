import type { ReactNode } from "react";
import { Tag, type Provenance } from "./Provenance";

/** A titled surface. The tag says whether its numbers are model output, record, or illustration. */
export function Panel({
  id,
  eyebrow,
  title,
  tag,
  actions,
  children,
  className = "",
  bodyClassName = "",
  flat = false,
  level = 2,
}: {
  id?: string;
  eyebrow?: string;
  title?: ReactNode;
  tag?: Provenance | Provenance[];
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
  flat?: boolean;
  level?: 2 | 3;
}) {
  const Heading = level === 2 ? "h2" : "h3";
  const tags = tag ? (Array.isArray(tag) ? tag : [tag]) : [];
  return (
    <section id={id} className={`panel ${flat ? "panel-flat" : ""} scroll-mt-32 ${className}`}>
      {(eyebrow || title || tags.length > 0 || actions) && (
        <header className="flex flex-wrap items-start justify-between gap-x-4 gap-y-3 border-b border-line px-4 pt-5 pb-4 sm:px-6">
          <div className="min-w-0">
            {eyebrow && <p className="eyebrow">{eyebrow}</p>}
            {title && (
              <Heading className="display mt-2 text-[1.9rem] leading-none text-ink sm:text-[2.3rem]">{title}</Heading>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {tags.map((kind) => (
              <Tag key={kind} kind={kind} />
            ))}
            {actions}
          </div>
        </header>
      )}
      <div className={`px-4 py-5 sm:px-6 sm:py-6 ${bodyClassName}`}>{children}</div>
    </section>
  );
}
