import { useEffect, useState } from "react";
import { useTheme, type Theme } from "../lib/theme";

/**
 * The theme switch: one sliding day/night control, drawn as a stretch of circuit. It is a real `role="switch"`, so a screen
 * reader says "Dark mode, switch, on", Space and Enter flip it, and it always shows the theme that is on screen. Until it is
 * flipped the site follows the device (and keeps following it live); flipping it saves an explicit choice.
 *
 * The knob is an F1 car seen from above: pale, with a red stripe, at the start by day with a chequered finish ahead of it; at
 * night it has driven to the far end and turned round, carbon-black with its lights on, while floodlights come on one by one
 * and the kerb dims. It is made of CSS shapes and one decorative SVG inside an aria-hidden track, so there is nothing for a
 * screen reader but the name and the state. Its colours live in the stylesheet (see `.theme-toggle__car`).
 *
 * The control answers the press at once. The page cannot: it has to re-style and repaint all of it, and that takes a moment on
 * a busy screen, so a control that waited for it would feel like it lagged. The control therefore shows the theme being
 * changed to (`pending`) until the page has caught up, and the page changes in the frame after the car has started to drive
 * (see `setThemePref`).
 */
export function ThemeSwitch() {
  const { theme, setPref } = useTheme();
  // The car and the lights animate only once the reader has used the switch, never on page load.
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
          setPref(next);
        }}
      >
        <span className="theme-toggle__track" aria-hidden>
          <span className="theme-toggle__lane">
            <span className="theme-toggle__night" />
            <span className="theme-toggle__lights">
              <i />
              <i />
              <i />
              <i />
            </span>
            <span className="theme-toggle__finish" />
            <span className="theme-toggle__knob">
              <svg className="theme-toggle__car" viewBox="0 0 40 16" aria-hidden focusable="false">
                <defs>
                  <linearGradient id="theme-beam" x1="0" x2="1" y1="0" y2="0">
                    <stop className="beam-near" offset="0" />
                    <stop className="beam-far" offset="1" />
                  </linearGradient>
                </defs>
                <path className="car__beam" d="M38.6 6.1 L62 -1 V17 L38.6 9.9Z" />
                <rect className="car__wing" x="0" y="2" width="3.2" height="12" rx="0.7" />
                <rect className="car__wheel" x="4.2" y="0.2" width="7.4" height="4.4" rx="1.3" />
                <rect className="car__wheel" x="4.2" y="11.4" width="7.4" height="4.4" rx="1.3" />
                <rect className="car__wheel" x="25" y="1" width="5.6" height="3.8" rx="1.1" />
                <rect className="car__wheel" x="25" y="11.2" width="5.6" height="3.8" rx="1.1" />
                <path className="car__body" d="M3 6.3 10 5.7 12 4.1H20.5L23 5.8 31 6.9 37.6 7.3V8.7L31 9.1 23 10.2 20.5 11.9H12L10 10.3 3 9.7Z" />
                <rect className="car__wing" x="37.2" y="1.2" width="2.8" height="13.6" rx="0.7" />
                <path className="car__stripe" d="M5 8H36.5" />
                <ellipse className="car__cockpit" cx="18.5" cy="8" rx="2.3" ry="1.7" />
                <rect className="car__tail" x="0.4" y="7" width="1.4" height="2" rx="0.4" />
                <circle className="car__lamp" cx="38.9" cy="6.5" r="0.8" />
                <circle className="car__lamp" cx="38.9" cy="9.5" r="0.8" />
              </svg>
            </span>
          </span>
        </span>
      </button>
    </div>
  );
}
