import { useRef, useState } from "react";
import { Icon } from "./Icon";
import { useTheme } from "../lib/theme";

/**
 * The theme switch: one sliding light/dark control. It is a real `role="switch"`, so a screen reader says "Dark mode, switch,
 * on", Space and Enter flip it, and it always shows the theme that is on screen. Until it is flipped the site follows the
 * device (and keeps following it live); flipping it saves an explicit choice. The change grows as a soft-edged wipe from the
 * knob (see `setThemePref`).
 */
export function ThemeSwitch() {
  const { theme, setPref } = useTheme();
  const knob = useRef<HTMLButtonElement>(null);
  // The knob and the icons animate only once the reader has used the switch, never on page load.
  const [touched, setTouched] = useState(false);
  const dark = theme === "dark";

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
          setTouched(true);
          const box = knob.current?.getBoundingClientRect();
          setPref(dark ? "light" : "dark", box ? { x: box.left + box.width / 2, y: box.top + box.height / 2 } : undefined);
        }}
      >
        <span className="theme-toggle__track" aria-hidden>
          <Icon name="sun" size={13} className="theme-toggle__hint theme-toggle__hint--sun" />
          <Icon name="moon" size={13} className="theme-toggle__hint theme-toggle__hint--moon" />
          <span className="theme-toggle__knob">
            <Icon name="sun" size={14} strokeWidth={2} className="theme-toggle__icon theme-toggle__icon--sun" />
            <Icon name="moon" size={14} strokeWidth={2} className="theme-toggle__icon theme-toggle__icon--moon" />
          </span>
        </span>
      </button>
    </div>
  );
}
