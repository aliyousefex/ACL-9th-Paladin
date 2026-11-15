import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import { Icon } from "./Icon";
import { navigate } from "../lib/router";
import { prepare, search, type SearchItem, type SearchKind } from "../lib/search";
import { buildIndex, suggestions } from "../lib/searchIndex";

const KIND_LABEL: Record<SearchKind, string> = { page: "Page", race: "Race", driver: "Driver", circuit: "Circuit" };

function editable(target: EventTarget | null): boolean {
  const node = target as HTMLElement | null;
  if (!node?.tagName) return false;
  return node.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(node.tagName);
}

/**
 * Search for any race, driver, circuit or page. Opens from the header button, from Ctrl/Cmd+K, or from "/" when no field
 * is focused. A combobox over a listbox: arrow keys move, Enter opens, Escape closes and returns focus to the button.
 */
export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [active, setActive] = useState(0);
  const trigger = useRef<HTMLButtonElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const pressedOnBackdrop = useRef(false);
  const prepared = useMemo(() => prepare(buildIndex()), []);
  const results = useMemo(() => search(prepared, text, 10, suggestions()), [prepared, text]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setOpen((value) => !value);
      } else if (event.key === "/" && !event.ctrlKey && !event.metaKey && !event.altKey && !editable(event.target)) {
        event.preventDefault();
        setOpen(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (open) input.current?.focus();
  }, [open]);

  // While it is open the page behind does not scroll (on a phone; a desktop keeps its scrollbar), and the panel is sized to
  // the part of the screen the on-screen keyboard leaves, so the list is never hidden behind the keys.
  const [visibleHeight, setVisibleHeight] = useState<number | null>(null);
  useEffect(() => {
    if (!open) return;
    document.documentElement.classList.add("palette-open");
    const viewport = window.visualViewport;
    const measure = () => setVisibleHeight(viewport ? Math.round(viewport.height) : null);
    measure();
    viewport?.addEventListener("resize", measure);
    return () => {
      document.documentElement.classList.remove("palette-open");
      viewport?.removeEventListener("resize", measure);
    };
  }, [open]);

  const close = () => {
    setOpen(false);
    setText("");
    setActive(0);
    trigger.current?.focus();
  };
  const choose = (item: SearchItem | undefined) => {
    if (!item) return;
    navigate(item.to);
    close();
  };

  const onInputKey = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActive((value) => (results.length ? (value + 1) % results.length : 0));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
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
    document.getElementById(`palette-option-${active}`)?.scrollIntoView({ block: "nearest" });
  }, [active, open]);

  return (
    <>
      <button
        ref={trigger}
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Search races, drivers and pages"
        aria-keyshortcuts="Control+K Meta+K /"
        title="Search (Ctrl K)"
        className="site-tool shrink-0"
      >
        <Icon name="search" size={20} />
      </button>

      {/* A portal: the bar that holds the button is frosted glass, and a frosted ancestor becomes the containing block of its
          position-fixed descendants, which would shrink the dimmed backdrop to the size of the bar. */}
      {open &&
        createPortal(
          <div
            className="palette"
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
                <p className="px-4 py-6 text-steel">Nothing matches “{text}”. Try a Grand Prix, a driver's surname or a country.</p>
              ) : (
                <ul id="palette-list" role="listbox" aria-label={text ? "Results" : "Suggestions"} className="palette__list">
                  {results.map((item, i) => (
                    <li
                      key={item.id}
                      id={`palette-option-${i}`}
                      role="option"
                      aria-selected={i === active}
                      onMouseMove={() => active !== i && setActive(i)}
                      onClick={() => choose(item)}
                      className={`flex cursor-pointer items-baseline gap-3 px-4 py-2.5 ${i === active ? "bg-panel2" : ""}`}
                    >
                      <span className="w-14 shrink-0 font-display text-[0.8rem] font-semibold tracking-wide text-mute uppercase sm:w-16">{KIND_LABEL[item.kind]}</span>
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
