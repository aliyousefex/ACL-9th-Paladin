import { useEffect, useRef, useState, type ReactNode } from "react";

/**
 * Mount a heavy block only when it is about to scroll into view. The wrapper keeps the anchor id
 * and a reserved height, so in-page links and the scrollbar behave as if the block were already there.
 */
export function Lazy({
  id,
  minHeight,
  children,
  className = "",
  margin = 1100,
}: {
  id?: string;
  minHeight: number;
  children: ReactNode;
  className?: string;
  margin?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [show, setShow] = useState(typeof IntersectionObserver === "undefined");

  useEffect(() => {
    if (show) return;
    const node = ref.current;
    if (!node) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setShow(true);
          observer.disconnect();
        }
      },
      { rootMargin: `${margin}px 0px` },
    );
    observer.observe(node);
    // A link such as #replay can target a block that has not mounted yet.
    const reveal = () => {
      if (id && window.location.hash === `#${id}`) setShow(true);
    };
    window.addEventListener("hashchange", reveal);
    return () => {
      observer.disconnect();
      window.removeEventListener("hashchange", reveal);
    };
  }, [show, margin, id]);

  return (
    <div ref={ref} id={id} className={`scroll-mt-32 ${className}`} style={show ? undefined : { minHeight }}>
      {show ? children : null}
    </div>
  );
}
