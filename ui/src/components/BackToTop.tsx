import { useEffect, useState } from "react";
import { Icon } from "./Icon";

/**
 * On a long page, a way back to the top that does not need a long scroll. It appears after about two screens, moves focus
 * to the main content so keyboard and screen-reader users land at the top too, and does not animate if motion is reduced.
 */
export function BackToTop() {
  const [show, setShow] = useState(false);
  useEffect(() => {
    const onScroll = () => setShow(window.scrollY > window.innerHeight * 2);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
  if (!show) return null;
  return (
    <button
      type="button"
      aria-label="Back to the top of the page"
      onClick={() => {
        const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        window.scrollTo({ top: 0, behavior: reduce ? "auto" : "smooth" });
        document.getElementById("main")?.focus({ preventScroll: true });
      }}
      className="to-top"
    >
      <Icon name="arrowUp" size={20} />
    </button>
  );
}
