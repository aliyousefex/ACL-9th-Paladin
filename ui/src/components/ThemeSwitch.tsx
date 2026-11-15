import { useEffect, useRef, useState } from "react";
import { useTheme, type Theme } from "../lib/theme";

/**
 * The theme switch: one sliding day/night control. It is a real `role="switch"`, so a screen reader says "Dark mode, switch,
 * on", Space and Enter flip it, and it always shows the theme that is on screen. Until it is flipped the site follows the
 * device (and keeps following it live); flipping it saves an explicit choice. The page changes as a circle growing from the
 * knob (see `setThemePref`).
 *
 * The knob answers the press at once. The page cannot: the browser first takes a picture of the whole page to animate from,
 * and that can take a noticeable moment on a busy screen, so a control that waited for it would feel like it lagged. The
 * control therefore shows the theme being changed to (`pending`) until the page has caught up.
 */
export function ThemeSwitch() {
  const { theme, setPref } = useTheme();
  const knob = useRef<HTMLButtonElement>(null);
  // The knob and the faces animate only once the reader has used the switch, never on page load.
  const [touched, setTouched] = useState(false);
  const [pending, setPending] = useState<Theme | null>(null);
  const shown = pending ?? theme;
  const dark = shown === "dark";

  useEffect(() => {
    if (pending === null) return;
    if (theme === pending) return setPending(null);
    const timer = window.setTimeout(() => setPending(null), 1500); // never stay out of step with the page
    return () => window.clearTimeout(timer);
  }, [theme, pending]);

  return (
    <div className="theme-control" data-touched={touched ? "true" : undefined}>
      <button
        ref={knob}
        type="button"
        role="switch"
        className="theme-toggle"
        aria-checked={dark}
        aria-label="Dark mode"
        title={dark ? "Switch to light" : "Switch to dark"}
        onClick={() => {
          const next: Theme = dark ? "light" : "dark";
          setTouched(true);
          setPending(next);
          const box = knob.current?.getBoundingClientRect();
          setPref(next, box ? { x: box.left + box.width / 2, y: box.top + box.height / 2 } : undefined);
        }}
      >
        <span className="theme-toggle__track" aria-hidden>
          <span className="theme-toggle__sky" />
          <span className="theme-toggle__stars" />
          <span className="theme-toggle__clouds" />
          <span className="theme-toggle__knob">
            <span className="theme-toggle__face theme-toggle__face--sun" />
            <span className="theme-toggle__face theme-toggle__face--moon" />
          </span>
        </span>
      </button>
    </div>
  );
}
