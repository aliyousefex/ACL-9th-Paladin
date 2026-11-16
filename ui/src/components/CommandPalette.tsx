import { useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import { Icon } from "./Icon";
import { navigate } from "../lib/router";
import { usePrefersReducedMotion } from "../lib/motion";
import { prepare, search, type SearchItem, type SearchKind } from "../lib/search";
import { buildIndex, suggestions } from "../lib/searchIndex";

const KIND_LABEL: Record<SearchKind, string> = { page: "Page", race: "Race", driver: "Driver", team: "Team", leader: "Leader", circuit: "Circuit" };

/** How long the palette takes to leave, in milliseconds. It must be at least as long as the exit in index.css (`palette-out`). */
const LEAVE_MS = 130;

function editable(target: EventTarget | null): boolean {
  const node = target as HTMLElement | null;
  if (!node?.tagName) return false;
  return node.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(node.tagName);
}

/**
 * Search for any race, driver, circuit or page. Opens from the header button, from Ctrl/Cmd+K, or from "/" when no field
 * is focused. A combobox over a listbox: arrow keys move, Enter opens, Escape closes and returns focus to the button.
 *
 * It fades and settles in, and fades out instead of vanishing, which takes `LEAVE_MS`: while it leaves it is still on screen but
 * out of reach (clicks go through to the page, and it is hidden from assistive technology, because focus has already gone back to
 * the button). One highlight glides to the active row when the keys or the pointer move it, and stays put, with no glide, when a
 * new search replaces the list. None of it moves when the person has asked for reduced motion.
 */
export function CommandPalette() {
  const reduce = usePrefersReducedMotion();
  const [open, setOpen] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [text, setText] = useState("");
  const [active, setActive] = useState(0);
  const [slide, setSlide] = useState(false);
  const [cursor, setCursor] = useState({ y: 0, h: 0 });
  const [listHeight, setListHeight] = useState<number | null>(null);
  const [sizing, setSizing] = useState(false);
  const list = useRef<HTMLUListElement>(null);
  const lastHeight = useRef<number | null>(null);
  const sizeTimer = useRef(0);
  const trigger = useRef<HTMLButtonElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const pressedOnBackdrop = useRef(false);
  const leaveTimer = useRef(0);
  const prepared = useMemo(() => prepare(buildIndex()), []);
  const results = useMemo(() => search(prepared, text, 10, suggestions()), [prepared, text]);
  const shown = open || leaving;

  const show = () => {
    window.clearTimeout(leaveTimer.current);
    setLeaving(false);
    setText("");
    setActive(0);
    setSlide(false);
    setListHeight(null);
    lastHeight.current = null;
    setOpen(true);
  };
  const close = () => {
    if (!open) return;
    setOpen(false);
    trigger.current?.focus();
    window.clearTimeout(leaveTimer.current);
    if (reduce) {
      setLeaving(false);
      return;
    }
    setLeaving(true);
    leaveTimer.current = window.setTimeout(() => setLeaving(false), LEAVE_MS);
  };
  const choose = (item: SearchItem | undefined) => {
    if (!item) return;
    navigate(item.to);
    close();
  };

  // The shortcut handler lives for the whole page, so it reads the current state through refs.
  const state = useRef({ open, show, close });
  state.current = { open, show, close };
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        if (state.current.open) state.current.close();
        else state.current.show();
      } else if (event.key === "/" && !event.ctrlKey && !event.metaKey && !event.altKey && !editable(event.target)) {
        event.preventDefault();
        if (!state.current.open) state.current.show();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.clearTimeout(leaveTimer.current);
      window.clearTimeout(sizeTimer.current);
    };
  }, []);

  useEffect(() => {
    // preventScroll: focusing the field must never move the page behind it
    if (open) input.current?.focus({ preventScroll: true });
  }, [open]);

  // While it is open the page behind does not scroll (on a phone; a desktop keeps its scrollbar), and the panel is sized to
  // the part of the screen the on-screen keyboard leaves, so the list is never hidden behind the keys.
  const [visibleHeight, setVisibleHeight] = useState<number | null>(null);
  useEffect(() => {
    if (!shown) return;
    document.documentElement.classList.add("palette-open");
    const viewport = window.visualViewport;
    const measure = () => setVisibleHeight(viewport ? Math.round(viewport.height) : null);
    measure();
    viewport?.addEventListener("resize", measure);
    return () => {
      document.documentElement.classList.remove("palette-open");
      viewport?.removeEventListener("resize", measure);
    };
  }, [shown]);

  const onInputKey = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setSlide(true);
      setActive((value) => (results.length ? (value + 1) % results.length : 0));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setSlide(true);
      setActive((value) => (results.length ? (value - 1 + results.length) % results.length : 0));
    } else if (event.key === "Enter") {
      event.preventDefault();
      choose(results[active]);
    } else if (event.key === "Escape") {
      event.preventDefault();
      close();
    } else if (event.key === "Tab") {
      event.preventDefault(); // one tab stop inside the dialog; the list is driven from the field
    }
  };

  useEffect(() => {
    // an instant jump, never a smooth scroll: held down, the arrow keys repeat faster than a smooth scroll can follow
    if (open) document.getElementById(`palette-option-${active}`)?.scrollIntoView({ block: "nearest" });
  }, [active, open]);

  // The highlight sits behind the active row. It is placed before the screen is painted, so it is never seen in the wrong place.
  useLayoutEffect(() => {
    if (!open) return;
    const row = document.getElementById(`palette-option-${active}`);
    if (row) setCursor((now) => (now.y === row.offsetTop && now.h === row.offsetHeight ? now : { y: row.offsetTop, h: row.offsetHeight }));
  }, [open, active, results]);

  // The list is as tall as its rows, and moves between heights with a glide instead of a jump as the search narrows or widens. Its own
  // scrollbar is held back while it moves, or a bar would flash across a list that is briefly shorter than its rows.
  useLayoutEffect(() => {
    const rows = list.current?.querySelectorAll<HTMLElement>("[role=option]");
    if (!list.current || !rows?.length) return;
    const last = rows[rows.length - 1];
    const next = last.offsetTop + last.offsetHeight + (parseFloat(getComputedStyle(list.current).paddingBottom) || 0);
    setListHeight(next);
    if (lastHeight.current !== null && lastHeight.current !== next && !reduce) {
      setSizing(true);
      window.clearTimeout(sizeTimer.current);
      sizeTimer.current = window.setTimeout(() => setSizing(false), 170);
    }
    lastHeight.current = next;
  }, [open, results, reduce]);

  return (
    <>
      <button
        ref={trigger}
        type="button"
        onClick={show}
        aria-label="Search races, drivers and pages"
        aria-keyshortcuts="Control+K Meta+K /"
        title="Search (Ctrl K)"
        className="site-tool shrink-0"
      >
        <Icon name="search" size={20} />
      </button>

      {/* A portal: the bar that holds the button is frosted glass, and a frosted ancestor becomes the containing block of its
          position-fixed descendants, which would shrink the dimmed backdrop to the size of the bar. */}
      {shown &&
        createPortal(
          <div
            className="palette"
            data-state={open ? "open" : "closing"}
            aria-hidden={open ? undefined : true}
            style={visibleHeight ? ({ "--vv-h": `${visibleHeight}px` } as CSSProperties) : undefined}
            // Closes on a whole click that began and ended on the dimmed page (not a drag that ends there after selecting text in
            // the field), and on the click, not the press: pressing moves focus to the page after any handler has run, which
            // would undo the focus returning to the search button.
            onMouseDown={(event) => {
              pressedOnBackdrop.current = event.target === event.currentTarget;
            }}
            onClick={(event) => {
              if (pressedOnBackdrop.current && event.target === event.currentTarget) close();
              pressedOnBackdrop.current = false;
            }}
          >
            <div role="dialog" aria-modal="true" aria-label="Search races, drivers and pages" className="palette__panel">
              <div className="palette__field">
                <Icon name="search" size={18} className="shrink-0 text-mute" />
                <input
                  ref={input}
                  role="combobox"
                  aria-expanded="true"
                  aria-controls="palette-list"
                  aria-autocomplete="list"
                  aria-activedescendant={results.length ? `palette-option-${active}` : undefined}
                  aria-label="Search"
                  value={text}
                  placeholder="Search races, drivers, circuits"
                  autoComplete="off"
                  autoCapitalize="off"
                  enterKeyHint="go"
                  spellCheck={false}
                  onChange={(event) => {
                    setText(event.target.value);
                    setActive(0);
                    setSlide(false); // a new list: the highlight goes to its first row at once, it does not travel there
                  }}
                  onKeyDown={onInputKey}
                  className="palette__input"
                />
                <button type="button" onClick={close} className="palette__close" aria-label="Close search">
                  <span className="palette__esc">Esc</span>
                  <Icon name="cross" size={20} className="palette__x" />
                </button>
              </div>
              {results.length === 0 ? (
                <p className="palette__empty px-4 py-6 text-steel">Nothing matches “{text}”. Try a Grand Prix, a driver's surname or a country.</p>
              ) : (
                <ul
                  ref={list}
                  id="palette-list"
                  role="listbox"
                  aria-label={text ? "Results" : "Suggestions"}
                  className="palette__list"
                  data-sizing={sizing || undefined}
                  style={listHeight === null ? undefined : { height: listHeight }}
                >
                  <li aria-hidden role="presentation" className="palette__cursor" data-slide={slide || undefined} style={{ transform: `translateY(${cursor.y}px)`, height: cursor.h }} />
                  {results.map((item, i) => (
                    <li
                      key={item.id}
                      id={`palette-option-${i}`}
                      role="option"
                      aria-selected={i === active}
                      onMouseMove={() => {
                        if (active === i) return;
                        setSlide(true);
                        setActive(i);
                      }}
                      onClick={() => choose(item)}
                      className="relative flex cursor-pointer items-baseline gap-3 px-4 py-2.5"
                    >
                      <span className="w-14 shrink-0 font-display text-[0.9rem] font-semibold text-mute sm:w-16">{KIND_LABEL[item.kind]}</span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-display text-[1.1rem] leading-tight font-semibold uppercase text-ink">{item.title}</span>
                        <span className="block truncate text-[0.85rem] text-mute">{item.subtitle}</span>
                      </span>
                    </li>
                  ))}
                </ul>
              )}
              <p className="sr-only" aria-live="polite">{results.length} {results.length === 1 ? "result" : "results"}</p>
              <p className="palette__hint">Up and down to move · Enter to open · Esc to close</p>
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}
