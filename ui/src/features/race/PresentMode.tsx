import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Icon } from "../../components/Icon";
import { advance, nextOpen, presentKey, type PresentStep } from "./present";

const pad = (n: number) => String(n).padStart(2, "0");

/**
 * A guided walk through one race for a talk or a demo: the page scrolls to each section, the rest dim, and a lower-third
 * carries the talking points. The page itself is unchanged and stays fully usable, so a presenter can still click.
 *
 * Steps after the flag stay locked until the result is revealed, and the reveal is an explicit key press on its own step,
 * so the audience never sees the result by accident.
 */
export function PresentMode({ steps, onReveal, onClose }: { steps: PresentStep[]; onReveal: () => void; onClose: () => void }) {
  const [index, setIndex] = useState(0);
  const bar = useRef<HTMLElement>(null);
  const latest = useRef({ steps, index, onReveal, onClose });
  latest.current = { steps, index, onReveal, onClose };
  const [fullscreen, setFullscreen] = useState(false);
  // On a phone the talking points start collapsed so the section being presented stays in view.
  const [notes, setNotes] = useState(false);

  const step = steps[Math.min(index, steps.length - 1)];
  const canNext = step.reveal || nextOpen(steps, index, 1) !== index;
  const canPrev = nextOpen(steps, index, -1) !== index;

  const next = useCallback(() => {
    const { steps: s, index: i, onReveal: reveal, onClose: close } = latest.current;
    const move = advance(s, i);
    if (move.reveal) reveal();
    else if (move.index === i) close();
    else setIndex(move.index);
  }, []);
  const prev = useCallback(() => {
    const { steps: s, index: i } = latest.current;
    setIndex(nextOpen(s, i, -1));
  }, []);
  const go = useCallback((target: number) => {
    const { steps: s } = latest.current;
    if (s[target] && !s[target].locked) setIndex(target);
  }, []);

  // The presenting class dims every panel but the spotlit one (see index.css) and clears the bar's space at the bottom.
  useEffect(() => {
    document.documentElement.classList.add("presenting");
    bar.current?.focus({ preventScroll: true });
    return () => {
      document.documentElement.classList.remove("presenting");
      document.querySelectorAll("[data-spot]").forEach((node) => node.removeAttribute("data-spot"));
    };
  }, []);

  // Bring the step's section into view and spotlight it. Sections mount lazily and change height, so look again once
  // the layout has settled.
  useEffect(() => {
    document.querySelectorAll("[data-spot]").forEach((node) => node.removeAttribute("data-spot"));
    const target = document.getElementById(step.target);
    if (!target) return;
    target.setAttribute("data-spot", "");
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const show = (behavior: ScrollBehavior) => target.scrollIntoView({ behavior, block: "start" });
    show(reduce ? "auto" : "smooth");
    const timers = [700, 1600].map((delay) => window.setTimeout(() => show("auto"), delay));
    return () => timers.forEach((t) => window.clearTimeout(t));
  }, [step.target, step.locked, step.reveal, step.title]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const action = presentKey(event.key, {
        modifier: event.altKey || event.ctrlKey || event.metaKey,
        inField: Boolean(target?.closest('input, select, textarea, [contenteditable="true"], [role="radiogroup"], [role="slider"]')),
        native: Boolean(target?.closest("button, a, summary")),
      });
      if (!action) return;
      if (action !== "close") event.preventDefault();
      if (action === "next") next();
      else if (action === "prev") prev();
      else if (action === "first") go(0);
      else if (action === "close") latest.current.onClose();
      else toggleFullscreen();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [next, prev, go]);

  useEffect(() => {
    const onChange = () => setFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  const canFullscreen = typeof document !== "undefined" && document.fullscreenEnabled;

  // Rendered on document.body: an ancestor with a transform (the page's entrance animation) would otherwise make
  // "fixed" mean "fixed to that ancestor" and the bar would not stay at the bottom of the screen.
  return createPortal(
    <section
      ref={bar}
      role="region"
      aria-label="Presenter"
      tabIndex={-1}
      className="fixed inset-x-0 bottom-[var(--bottom-nav-h)] z-[60] max-h-[50svh] overflow-y-auto border-t-2 border-signal bg-tower/95 shadow-[0_-12px_30px_rgb(0_0_0/0.5)] outline-none backdrop-blur-sm md:bottom-0"
    >
      <div className="mx-auto grid max-w-[1320px] gap-3 px-4 py-3 sm:px-6 lg:grid-cols-[minmax(0,1fr)_23rem] lg:items-center lg:gap-8 lg:px-10">
        <div className="min-w-0">
          <div className="flex items-center gap-3">
            <p className="figure shrink-0 text-[1.5rem]" aria-hidden>
              {pad(index + 1)}
              <span className="text-[1rem] text-mute"> / {pad(steps.length)}</span>
            </p>
            <ol className="flex min-w-0 flex-1 gap-1" aria-label="Steps">
              {steps.map((s, i) => (
                <li key={s.id} className="min-w-0 flex-1">
                  <button
                    type="button"
                    aria-label={`Step ${i + 1} of ${steps.length}: ${s.locked ? "locked until the result is revealed" : s.title}`}
                    aria-current={i === index ? "step" : undefined}
                    disabled={s.locked}
                    onClick={() => go(i)}
                    className="group flex h-7 w-full items-center disabled:cursor-not-allowed"
                  >
                    <span className={`block h-1.5 w-full transition-colors ${i === index ? "bg-signal" : s.locked ? "bg-line" : i < index ? "bg-steel" : "bg-line2 group-hover:bg-steel"}`} />
                  </button>
                </li>
              ))}
            </ol>
          </div>
          <div aria-live="polite" aria-atomic="true" className="mt-1">
            <p className="display text-[1.5rem] leading-none text-ink sm:text-[1.9rem]">
              <span className="sr-only">Step {index + 1} of {steps.length}. </span>
              {step.title}
            </p>
            <ul id="present-notes" className={`mt-2 space-y-1 text-[1rem] leading-snug text-steel sm:block sm:text-[1.08rem] ${notes ? "" : "hidden"}`}>
              {step.say.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          </div>
          <button type="button" className="mt-1 flex min-h-8 items-center gap-1 text-[0.9rem] font-semibold text-steel underline underline-offset-4 hover:text-ink sm:hidden" aria-expanded={notes} aria-controls="present-notes" onClick={() => setNotes((v) => !v)}>
            {notes ? "Hide notes" : "Show notes"}
          </button>
        </div>

        <div className="flex items-center gap-2 sm:flex-wrap lg:flex-col lg:items-stretch">
          <div className="flex min-w-0 flex-1 gap-2 lg:flex-none">
            <button type="button" className="btn btn-ghost !min-h-11 flex-1 !px-3" onClick={prev} disabled={!canPrev}>
              <Icon name="arrowLeft" size={18} /> Back
            </button>
            <button type="button" className="btn !min-h-11 flex-[2] whitespace-nowrap !px-4" onClick={next}>
              {step.reveal ? "Reveal the result" : canNext ? "Next" : "Finish"} <Icon name="arrowRight" size={18} />
            </button>
          </div>
          <div className="flex gap-2">
            {canFullscreen && (
              <button type="button" className="btn btn-ghost !hidden !min-h-11 flex-1 !px-3 !text-[0.95rem] sm:!inline-flex" onClick={toggleFullscreen} aria-pressed={fullscreen}>
                {fullscreen ? "Exit full screen" : "Full screen"}
              </button>
            )}
            <button type="button" className="btn btn-ghost !min-h-11 flex-1 !px-3 !text-[0.95rem]" onClick={onClose}>
              Exit <span className="sr-only">presenter</span>
            </button>
          </div>
          <p className="hidden text-center text-[0.78rem] text-mute lg:block">← → step · Home restart · F full screen · Esc exit</p>
        </div>
      </div>
    </section>,
    document.body,
  );
}

function toggleFullscreen() {
  if (document.fullscreenElement) void document.exitFullscreen();
  else void document.documentElement.requestFullscreen?.();
}
