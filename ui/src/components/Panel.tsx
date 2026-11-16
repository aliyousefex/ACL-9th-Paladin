import type { ReactNode } from "react";
import { Tag, type Provenance } from "./Provenance";

/**
 * A titled surface. The tag says whether its numbers are model output, record, or illustration. `context` is a plain line under the title
 * for what the title does not say (the phase of the race, the season, the scope). It is never a label over the title: see DESIGN.md.
 */
export function Panel({
  id,
  context,
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
  context?: string;
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
      {(context || title || tags.length > 0 || actions) && (
        <header className="panel-heading flex flex-wrap items-start justify-between gap-x-4 gap-y-3 border-b border-line px-4 pt-5 pb-4 sm:px-6">
          <div className="min-w-0">
            {title && (
              <Heading className="panel-title text-ink">{title}</Heading>
            )}
            {context && <p className="panel-context mt-1">{context}</p>}
          </div>
          <div className="flex max-w-full min-w-0 flex-wrap items-center gap-2">
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
